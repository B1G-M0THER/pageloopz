import { Router } from 'express';
import axios from 'axios';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

const OL_BASE = 'https://openlibrary.org';
const OL_COVERS = 'https://covers.openlibrary.org/b';

const olClient = axios.create({
  baseURL: OL_BASE,
  timeout: 8000,
  headers: {
    'User-Agent': process.env.OPEN_LIBRARY_USER_AGENT || 'BookShelfApp/1.0',
  },
});

const getCoverUrl = (coverId, size = 'M') =>
    coverId ? `${OL_COVERS}/id/${coverId}-${size}.jpg` : null;

// in-memory cache, 5min TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const setCache = (key, value) => cache.set(key, { value, ts: Date.now() });
const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.value;
};

// GET /search?q=&page=&limit=
router.get('/search', async (req, res) => {
  const { q, page = 1, limit = 12 } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const cacheKey = `search:${q}:${page}:${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const { data } = await olClient.get('/search.json', {
      params: {
        q: q.trim(),
        page: Number(page),
        limit: Math.min(Number(limit), 40),
      },
    });

    const books = (data.docs || []).map((doc) => ({
      id: doc.key,
      title: doc.title || 'Без назви',
      author: doc.author_name?.[0] || 'Невідомий автор',
      year: doc.first_publish_year || null,
      editions: doc.edition_count || 0,
      cover_url: getCoverUrl(doc.cover_i, 'M'),
    }));

    const result = { books, total: data.numFound || 0, page: Number(page) };
    setCache(cacheKey, result);

    res.json(result);
  } catch (err) {
    console.error('[books/search] Error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from Open Library', details: err.message });
  }
});

// GET /:workId — book details (workId without /works/ prefix)
router.get('/:workId', optionalAuth, async (req, res) => {
  const rawId = req.params.workId;
  const workId = rawId.startsWith('/works/') ? rawId : `/works/${rawId}`;

  const cacheKey = `book:${workId}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const { data: dbBook } = await supabaseAdmin
        .from('books')
        .select('*')
        .eq('id', workId)
        .single();

    const { data: work } = await olClient.get(`${workId}.json`);

    let description = '';
    if (work.description) {
      description = typeof work.description === 'string'
          ? work.description
          : work.description.value || '';
      description = description.slice(0, 2000);
    }

    const coverId = work.covers?.[0];
    const coverUrl = coverId ? getCoverUrl(coverId, 'L') : dbBook?.cover_url || null;

    let author = dbBook?.author || 'Невідомий автор';
    if (work.authors?.length > 0) {
      try {
        const authorKey = work.authors[0].author?.key;
        if (authorKey) {
          const { data: authorData } = await olClient.get(`${authorKey}.json`);
          author = authorData.name || author;
        }
      } catch { /* ignore author fetch errors */ }
    }

    const book = {
      id: workId,
      title: work.title || dbBook?.title || 'Без назви',
      author,
      description,
      cover_url: coverUrl,
      subjects: (work.subjects || []).slice(0, 8),
      first_publish_date: work.first_publish_date || null,
      source: 'open_library',
    };

    await supabaseAdmin.from('books').upsert(
        { id: workId, title: book.title, author, description, cover_url: coverUrl },
        { onConflict: 'id' }
    );

    setCache(cacheKey, book);
    res.json(book);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Book not found' });
    }
    console.error('[books/:workId] Error:', err.message);
    res.status(502).json({ error: 'Failed to fetch book details', details: err.message });
  }
});

export default router;