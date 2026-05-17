import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { searchBooks } from '../api/openLibrary';
import { searchCustomBooks } from '../api/apiClient';
import SearchBar from '../components/SearchBar';
import BookCard from '../components/BookCard';
import CircularGallery from '../components/CircularGallery';

const ITEMS_PER_PAGE = 12;
const MAX_PAGES      = 50;

const GENRES = [
  { label: 'Класика',    query: 'classic literature' },
  { label: 'Фантастика', query: 'science fiction' },
  { label: 'Детективи',  query: 'detective mystery thriller' },
  { label: 'Фентезі',    query: 'fantasy' },
  { label: 'Романи',     query: 'romance novel' },
  { label: 'Пригоди',    query: 'adventure' },
  { label: 'Наука',      query: 'popular science' },
  { label: 'Біографії',  query: 'biography memoir' },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    title: 'Мільйони книг',
    desc:  'Пошук по всесвітній базі Open Library — від античних текстів до сучасних новинок.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
    title: 'Особиста бібліотека',
    desc:  'Відстежуйте що читаєте, що прочитали, що плануєте — все в одному місці.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    title: 'Живі відгуки',
    desc:  'Залишайте рецензії, ставте рейтинги та читайте думки інших читачів.',
  },
];

const BOOK_QUERIES = [
  'Harry Potter Philosopher Stone Rowling',
  'Dune Frank Herbert',
  '1984 George Orwell',
  'The Master and Margarita Bulgakov',
  'The Little Prince Saint-Exupery',
  'Crime and Punishment Dostoevsky',
  'The Hunger Games Collins',
  'Pride and Prejudice Austen',
  'The Hobbit Tolkien',
  'The Count of Monte Cristo Dumas',
  'One Hundred Years of Solitude Marquez',
  'Moby Dick Melville',
  'The Alchemist Coelho',
  'The Great Gatsby Fitzgerald',
  'Dracula Stoker',
  'Frankenstein Shelley',
  'The Hitchhiker Guide Galaxy Adams',
  'Anna Karenina Tolstoy',
  'Don Quixote Cervantes',
  'Sherlock Holmes Doyle Adventures',
  'Treasure Island Stevenson',
  'Adventures Tom Sawyer Twain',
  'The Plague Camus',
  'War and Peace Tolstoy',
  'Romeo and Juliet Shakespeare',
];

const getDailyQueries = (count = 15) => {
  const today = new Date();
  const seed  = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  return [...BOOK_QUERIES].sort(() => rand() - 0.5).slice(0, count);
};

const fetchGalleryBooks = async (queries) => {
  const results = await Promise.allSettled(
      queries.map(async (q) => {
        const { data } = await axios.get('https://openlibrary.org/search.json', {
          params: { q, limit: 1, fields: 'key,title,author_name,cover_i' },
          timeout: 8000,
        });
        const doc = data.docs?.[0];
        if (!doc || !doc.cover_i) return null;
        return {
          id:    doc.key.replace('/works/', ''),
          text:  doc.title,
          image: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
        };
      })
  );
  return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
};

const getPageNumbers = (current, total, delta = 2) => {
  const pages = [];
  const lo = Math.max(1, current - delta);
  const hi = Math.min(total, current + delta);
  if (lo > 1) { pages.push(1); if (lo > 2) pages.push('...'); }
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < total) { if (hi < total - 1) pages.push('...'); pages.push(total); }
  return pages;
};

const Home = () => {
  const navigate   = useNavigate();
  const resultsRef = useRef(null);

  const [books, setBooks]               = useState([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [error, setError]               = useState('');
  const [hasSearched, setHasSearched]   = useState(false);
  const [heroQuery, setHeroQuery]       = useState('');

  const [galleryBooks, setGalleryBooks]     = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  const dailyQueries = useMemo(() => getDailyQueries(15), []);

  useEffect(() => {
    setGalleryLoading(true);
    fetchGalleryBooks(dailyQueries)
        .then(setGalleryBooks)
        .finally(() => setGalleryLoading(false));
  }, []);

  const doSearch = useCallback(async (query, pageNum = 1) => {
    if (!query.trim()) {
      setBooks([]); setTotal(0); setCurrentQuery(''); setHasSearched(false);
      return;
    }
    setLoading(true); setError(''); setBooks([]); setCurrentQuery(query); setHasSearched(true);
    try {
      const olPromise = searchBooks(query, pageNum, ITEMS_PER_PAGE);
      const customPromise = pageNum === 1
          ? searchCustomBooks(query).catch(() => ({ books: [] }))
          : Promise.resolve({ books: [] });

      const [{ books: olResults, total: olTotal }, { books: customResults }] =
          await Promise.all([olPromise, customPromise]);

      const normalized = customResults.map(b => ({
        id: `custom_${b.id}`,
        title: b.title,
        author: b.author,
        cover_url: b.cover_url || null,
        year: null,
        _isCustom: true,
      }));

      const olDeduped = olResults.filter(ol =>
          !normalized.some(c =>
              c.title.toLowerCase() === ol.title.toLowerCase() &&
              c.author.toLowerCase() === ol.author.toLowerCase()
          )
      );

      setBooks(pageNum === 1 ? [...normalized, ...olDeduped] : olResults);
      setTotal(olTotal + (pageNum === 1 ? normalized.length : 0));
      setPage(pageNum);
    } catch {
      setError('Помилка пошуку. Перевірте з\'єднання та спробуйте знову.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch  = useCallback((query) => { doSearch(query, 1); }, [doSearch]);

  const handleGenreClick = useCallback((genre) => {
    setHeroQuery(genre.query);
  }, []);

  const goToPage = useCallback((p) => {
    doSearch(currentQuery, p);
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [doSearch, currentQuery]);

  const handleGalleryClick = useCallback((item) => {
    navigate(`/book/${encodeURIComponent(item.id)}`);
  }, [navigate]);

  const totalPages = Math.min(MAX_PAGES, Math.ceil(total / ITEMS_PER_PAGE));

  return (
      <main className="home-page">

        {/* ── Герой ───────────────────────────────────────── */}
        <section className="home-hero">
          <div className="container home-hero__content">
            <p className="home-hero__eyebrow">Ваша особиста бібліотека</p>
            <h1 className="home-hero__title">
              Відкривайте нові<br /><em>світи у книгах</em>
            </h1>
            <p className="home-hero__subtitle">
              Мільйони книг на кінчиках пальців. Шукайте, відстежуйте, діліться думками.
            </p>
            <div className="home-hero__search">
              <SearchBar
                  onSearch={handleSearch}
                  loading={loading}
                  placeholder="Назва, автор, тема..."
                  initialQuery={heroQuery}
              />
            </div>

            {/* Жанрові чіпи */}
            {!hasSearched && (
                <div className="home-genres">
                  <span className="home-genres__label">Швидкий пошук:</span>
                  {GENRES.map((g) => (
                      <button
                          key={g.label}
                          className="home-genre-chip"
                          onClick={() => handleGenreClick(g)}
                      >
                        {g.label}
                      </button>
                  ))}
                </div>
            )}
          </div>
        </section>

        {/* ── Переваги ────────────────────────────────────── */}
        {!hasSearched && (
            <section className="home-features">
              <div className="container home-features__grid">
                {FEATURES.map((f) => (
                    <div key={f.title} className="home-feature-card">
                      <div className="home-feature-card__icon">{f.icon}</div>
                      <h3 className="home-feature-card__title">{f.title}</h3>
                      <p className="home-feature-card__desc">{f.desc}</p>
                    </div>
                ))}
              </div>
            </section>
        )}

        {/* ── Галерея ─────────────────────────────────────── */}
        {!hasSearched && (
            <section className="home-gallery-section">
              <div className="home-gallery-header container">
                <h2 className="home-gallery-title">Популярні книги</h2>
                <p className="home-gallery-sub">Гортайте та клікайте, щоб дізнатись більше</p>
              </div>
              <div className="home-gallery-wrap">
                {galleryLoading ? (
                    <div className="home-gallery-skeleton">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                           style={{ animation: 'spin 0.8s linear infinite' }}>
                        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                        <circle cx="12" cy="12" r="10" stroke="#c9a84c"
                                strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10"/>
                      </svg>
                      <p>Завантажуємо книги...</p>
                    </div>
                ) : galleryBooks.length > 0 ? (
                    <CircularGallery
                        items={galleryBooks}
                        bend={1.2}
                        textColor="#c9a84c"
                        borderRadius={0.07}
                        scrollSpeed={2.5}
                        scrollEase={0.04}
                        onItemClick={handleGalleryClick}
                    />
                ) : null}
              </div>
            </section>
        )}

        {/* ── Результати пошуку ───────────────────────────── */}
        <section className="home-results container" ref={resultsRef}>
          {currentQuery && !loading && (
              <div className="home-results__meta">
                {total > 0
                    ? <p>Знайдено <strong>{total.toLocaleString('uk-UA')}</strong> для «<em>{currentQuery}</em>»</p>
                    : <p>Нічого не знайдено для «<em>{currentQuery}</em>»</p>
                }
              </div>
          )}

          {error && (
              <div className="home-results__error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
          )}

          {loading ? (
              <div className="books-grid">
                {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
                    <div key={i} className="book-card-skeleton" aria-hidden="true">
                      <div className="book-card-skeleton__cover"/>
                      <div className="book-card-skeleton__title"/>
                      <div className="book-card-skeleton__author"/>
                    </div>
                ))}
              </div>
          ) : books.length > 0 ? (
              <div className="books-grid">
                {books.map((book) => <BookCard key={book.id} book={book} />)}
              </div>
          ) : null}

          {totalPages > 1 && !loading && (
              <nav className="pagination" aria-label="Навігація по сторінках">
                <button
                    className="pagination__btn pagination__btn--nav"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    aria-label="Попередня сторінка"
                >
                  ‹
                </button>
                {getPageNumbers(page, totalPages).map((p, i) =>
                    p === '...'
                        ? <span key={`el-${i}`} className="pagination__ellipsis">…</span>
                        : <button
                            key={p}
                            className={`pagination__btn${p === page ? ' pagination__btn--active' : ''}`}
                            onClick={() => p !== page && goToPage(p)}
                            aria-current={p === page ? 'page' : undefined}
                            aria-label={`Сторінка ${p}`}
                        >{p}</button>
                )}
                <button
                    className="pagination__btn pagination__btn--nav"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    aria-label="Наступна сторінка"
                >
                  ›
                </button>
              </nav>
          )}
        </section>

      </main>
  );
};

export default Home;
