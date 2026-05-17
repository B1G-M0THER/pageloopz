import axios from 'axios';

const BASE_URL  = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org/b';

const olClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});

export const getCoverUrl = (coverId, size = 'M') =>
    coverId ? `${COVERS_URL}/id/${coverId}-${size}.jpg` : null;

// Retry — повторює при таймауті або 5xx
const withRetry = async (fn, attempts = 3, delay = 1000) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isServer  = err.response?.status >= 500;
      if ((isTimeout || isServer) && i < attempts - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
        continue;
      }
      throw err;
    }
  }
};

// Очищаємо wiki-розмітку
const cleanDescription = (text) => {
  if (!text) return '';
  return text
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
      .replace(/\[https?:\/\/[^\s\]]+\]/g, '')
      .replace(/----------+/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
};

// ─── Пошук книг ───────────────────────────────────────────
export const searchBooks = async (query, page = 1, limit = 12) => {
  if (!query.trim() || query.trim().length < 2) return { books: [], total: 0 };

  const { data } = await olClient.get('/search.json', {
    params: { q: query.trim(), page, limit },
  });

  const books = (data.docs || []).map((doc) => ({
    id:        doc.key,
    title:     doc.title || 'Без назви',
    author:    doc.author_name?.[0] || 'Невідомий автор',
    year:      doc.first_publish_year || null,
    cover_url: doc.cover_i ? getCoverUrl(doc.cover_i, 'M') : null,
  }));

  return { books, total: data.numFound || 0 };
};

// ─── Деталі книги ─────────────────────────────────────────
export const getBookDetails = async (workId) => {
  const normalizedId = workId.startsWith('/works/')
      ? workId
      : `/works/${workId}`;

  // Головний запит з retry
  const { data: work } = await withRetry(() =>
      olClient.get(`${normalizedId}.json`)
  );

  // Опис з work
  let description = '';
  if (work.description) {
    const raw = typeof work.description === 'string'
        ? work.description
        : work.description.value || '';
    description = cleanDescription(raw);
  }

  // Якщо нема — шукаємо в едиціях
  if (!description) {
    try {
      const { data: editions } = await olClient.get(
          `${normalizedId}/editions.json`,
          { params: { limit: 3 } }
      );
      for (const edition of (editions.entries || [])) {
        const raw = edition.description
            ? (typeof edition.description === 'string'
                ? edition.description
                : edition.description?.value || '')
            : (edition.first_sentence?.value || '');
        const cleaned = cleanDescription(raw);
        if (cleaned.length > 50) { description = cleaned; break; }
      }
    } catch { /* ігноруємо */ }
  }

  // Обкладинка
  const coverId  = work.covers?.[0];
  const cover_url = coverId ? getCoverUrl(coverId, 'L') : null;

  // Автор
  let author = 'Невідомий автор';
  if (work.authors?.length > 0) {
    try {
      const authorKey = work.authors[0].author?.key;
      if (authorKey) {
        const { data: authorData } = await olClient.get(`${authorKey}.json`);
        author = authorData.name || author;
      }
    } catch { /* ігноруємо */ }
  }

  return {
    id:                 normalizedId,
    title:              work.title || 'Без назви',
    author,
    description:        description.slice(0, 3000),
    cover_url,
    subjects:           (work.subjects || []).slice(0, 8),
    first_publish_date: work.first_publish_date || null,
  };
};