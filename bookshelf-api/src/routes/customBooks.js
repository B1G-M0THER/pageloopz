import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// ─── GET /api/custom-books — список схвалених кастомних книг ──────────────────
router.get('/', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    const { data, error, count } = await supabaseAdmin
        .from('custom_books')
        .select('*', { count: 'exact' })
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    res.json({ books: data, total: count, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch custom books' });
  }
});

// ─── POST /api/custom-books — запропонувати книгу ─────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { title, author, description, cover_url, isbn } = req.body;
  const userId = req.profile.id;

  // Валідація
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!author?.trim()) return res.status(400).json({ error: 'Author is required' });
  if (title.trim().length < 1 || title.trim().length > 255) {
    return res.status(400).json({ error: 'Title must be 1–255 characters' });
  }

  try {
    // Перевірка на дублікат (схожий заголовок + автор)
    const { data: duplicate } = await supabaseAdmin
        .from('custom_books')
        .select('id, title, status')
        .ilike('title', title.trim())
        .ilike('author', author.trim())
        .single();

    if (duplicate) {
      return res.status(409).json({
        error: 'A book with this title and author already exists',
        existing: { id: duplicate.id, title: duplicate.title, status: duplicate.status },
      });
    }

    const { data, error } = await supabaseAdmin
        .from('custom_books')
        .insert({
          title: title.trim(),
          author: author.trim(),
          description: description?.trim() || null,
          cover_url: cover_url?.trim() || null,
          isbn: isbn?.trim() || null,
          submitted_by: userId,
          status: 'pending',   // чекає на схвалення модератором
        })
        .select()
        .single();

    if (error) throw error;

    res.status(201).json({
      book: data,
      message: 'Book submitted for review. It will appear after moderator approval.',
    });
  } catch (err) {
    console.error('[custom-books/POST] Error:', err.message);
    res.status(500).json({ error: 'Failed to submit book' });
  }
});

// ─── GET /api/custom-books/pending — список на модерацію (модератор+) ─────────
router.get('/pending', requireAuth, requireRole('moderator'), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
        .from('custom_books')
        .select('*, profiles:submitted_by(username)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ books: data, total: data.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending books' });
  }
});

// ─── GET /api/custom-books/search?q=... — пошук серед схвалених кастомних ──────
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return res.json({ books: [] });

  const term = q.trim();
  try {
    const { data, error } = await supabaseAdmin
        .from('custom_books')
        .select('id, title, author, cover_url, created_at')
        .eq('status', 'approved')
        .or(`title.ilike.%${term}%,author.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) throw error;
    res.json({ books: data });
  } catch (err) {
    console.error('[custom-books/search] Error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── GET /api/custom-books/my — власні пропозиції поточного користувача ───────
router.get('/my', requireAuth, async (req, res) => {
  const { status } = req.query;
  const userId = req.profile.id;

  try {
    let query = supabaseAdmin
        .from('custom_books')
        .select('*')
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ books: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// ─── PATCH /api/custom-books/:id/approve — схвалити (модератор+) ──────────────
router.patch('/:id/approve', requireAuth, requireRole('moderator'), async (req, res) => {
  const { id } = req.params;
  const moderatorId = req.profile.id;

  try {
    const { data, error } = await supabaseAdmin
        .from('custom_books')
        .update({
          status: 'approved',
          moderated_by: moderatorId,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Book not found' });

    // Додаємо книгу до головної таблиці books (як і книги з Open Library)
    await supabaseAdmin.from('books').upsert(
        {
          id: `custom_${id}`,
          title: data.title,
          author: data.author,
          description: data.description || null,
          cover_url: data.cover_url || null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
    );

    res.json({ book: data, message: 'Book approved successfully' });
  } catch (err) {
    console.error('[custom-books/approve] Error:', err.message);
    res.status(500).json({ error: 'Failed to approve book' });
  }
});

// ─── PATCH /api/custom-books/:id/reject — відхилити (модератор+) ──────────────
router.patch('/:id/reject', requireAuth, requireRole('moderator'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const moderatorId = req.profile.id;

  try {
    const { data, error } = await supabaseAdmin
        .from('custom_books')
        .update({
          status: 'rejected',
          rejection_reason: reason || null,
          moderated_by: moderatorId,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Book not found' });

    res.json({ book: data, message: 'Book rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject book' });
  }
});

export default router;