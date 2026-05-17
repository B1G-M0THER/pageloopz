import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBookDetails } from '../api/openLibrary';
import { getBookById, getUserBookActivity, upsertBook } from '../lib/supabaseClient';
import ReviewSection from '../components/ReviewSection';
import StatusPicker from '../components/StatusPicker';
import { useAuth } from '../context/AuthContext';
import { translateText } from '../api/apiClient';


// Maps browser language tag to a DeepL target_lang code; returns null for English
const getTargetLang = () => {
  const lang = (navigator.language || '').toLowerCase();
  if (!lang || lang.startsWith('en')) return null;
  if (lang === 'pt-br') return 'PT-BR';
  if (lang.startsWith('pt')) return 'PT-PT';
  if (lang.startsWith('zh')) return 'ZH';
  return lang.split('-')[0].toUpperCase() || null;
};

// ─── Розгортуваний опис ───────────────────────────────────
const BookDescription = ({ description, bookId }) => {
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState('');
  const [showTranslated, setShowTranslated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const LIMIT = 600;
  const targetLang = getTargetLang();

  if (!description) {
    return (
      <div className="book-details__description">
        <h2 className="book-details__section-title">Про книгу</h2>
        <p className="book-details__no-desc">Опис для цієї книги відсутній.</p>
      </div>
    );
  }

  const activeText = showTranslated && translated ? translated : description;
  const isLong = activeText.length > LIMIT;
  const shown = expanded || !isLong ? activeText : activeText.slice(0, LIMIT) + '…';

  const handleTranslate = async () => {
    if (translated) {
      setShowTranslated(!showTranslated);
      return;
    }
    setTranslating(true);
    setTranslateError('');
    try {
      const result = await translateText(bookId, description, targetLang);
      setTranslated(result.translatedText);
      setShowTranslated(true);
    } catch (err) {
      setTranslateError(err.message || 'Помилка перекладу');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="book-details__description">
      <h2 className="book-details__section-title">Про книгу</h2>
      <p className="book-details__desc-text" style={{ whiteSpace: 'pre-line' }}>
        {shown}
      </p>
      <div className="book-details__desc-actions">
        {isLong && (
          <button
            className="book-details__desc-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▲ Згорнути' : '▼ Читати далі'}
          </button>
        )}
        {targetLang && (
          <button
            className="book-details__translate-btn"
            onClick={handleTranslate}
            disabled={translating}
          >
            {translating ? 'Перекладаємо…' : showTranslated ? '🔤 Оригінал' : '🌐 Перекласти'}
          </button>
        )}
      </div>
      {translateError && (
        <p className="book-details__translate-error">{translateError}</p>
      )}
    </div>
  );
};

const BookDetails = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [book, setBook] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [error, setError] = useState('');

  const isCustomBook = bookId.startsWith('custom_');
  const decodedId = isCustomBook ? bookId : `/works/${decodeURIComponent(bookId)}`;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const cached = await getBookById(decodedId);

        let bookData;
        if (isCustomBook) {
          if (!cached) throw new Error('Книгу не знайдено');
          bookData = { ...cached, subjects: [], first_publish_date: null };
        } else {
          // Завантажуємо деталі з Open Library
          const details = await getBookDetails(decodedId);
          bookData = cached ? { ...cached, ...details } : details;

          // Кешуємо в Supabase (потрібно для foreign key у reviews та activity)
          await upsertBook({
            id: bookData.id,
            title: bookData.title,
            author: bookData.author,
            description: bookData.description,
            cover_url: bookData.cover_url,
          });
        }
        setBook(bookData);

        // Завантажуємо статус читання (якщо авторизований)
        if (user) {
          const activity = await getUserBookActivity(user.id, decodedId);
          setStatus(activity?.status ?? null);
        }
      } catch (err) {
        console.error(err);
        setError('Не вдалося завантажити інформацію про книгу.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [decodedId, user?.id]); // eslint-disable-line

  if (loading) {
    return (
        <main className="book-details container">
          <div className="book-details__skeleton">
            <div className="book-details-skeleton__cover" />
            <div className="book-details-skeleton__info">
              <div className="book-details-skeleton__title" />
              <div className="book-details-skeleton__author" />
              <div className="book-details-skeleton__line" />
              <div className="book-details-skeleton__line book-details-skeleton__line--short" />
            </div>
          </div>
        </main>
    );
  }

  if (error || !book) {
    const isTimeout = error?.includes('timeout') || error?.includes('10000');
    return (
        <main className="book-details container">
          <div className="book-details__error">
            <p>{isTimeout
                ? '⏱ Open Library відповідає повільно. Спробуйте ще раз.'
                : (error || 'Книгу не знайдено')}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {isTimeout && (
                  <button className="btn btn--primary" onClick={() => window.location.reload()}>
                    ↻ Спробувати ще раз
                  </button>
              )}
              <button className="btn btn--outline" onClick={() => navigate(-1)}>
                ← Назад
              </button>
            </div>
          </div>
        </main>
    );
  }

  return (
      <main className="book-details">
        {/* Фонове зображення-блюр */}
        {book.cover_url && (
            <div
                className="book-details__backdrop"
                style={{ backgroundImage: `url(${book.cover_url})` }}
                aria-hidden="true"
            />
        )}

        <div className="container">
          {/* Навігація */}
          <button className="book-details__back btn btn--ghost" onClick={() => navigate(-1)}>
            ← Назад
          </button>

          {/* Головний блок */}
          <div className="book-details__hero">
            {/* Обкладинка */}
            <div className="book-details__cover-wrap">
              {book.cover_url ? (
                  <img
                      className={`book-details__cover ${imgLoaded ? 'book-details__cover--loaded' : ''}`}
                      src={book.cover_url}
                      alt={`Обкладинка: ${book.title}`}
                      loading="eager"
                      onLoad={() => setImgLoaded(true)}
                  />
              ) : (
                  <div className="book-details__no-cover">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5 14H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V6h9v2z" />
                    </svg>
                  </div>
              )}
            </div>

            {/* Інформація */}
            <div className="book-details__info">
              <h1 className="book-details__title">{book.title}</h1>
              <p className="book-details__author">{book.author}</p>

              {book.first_publish_date && (
                  <p className="book-details__date">
                    Перша публікація: {book.first_publish_date}
                  </p>
              )}

              {/* Теми/жанри */}
              {book.subjects?.length > 0 && (
                  <div className="book-details__subjects">
                    {book.subjects.map((s) => (
                        <span key={s} className="tag">{s}</span>
                    ))}
                  </div>
              )}

              {/* Опис */}
              <BookDescription description={book.description} bookId={decodedId} />

              {/* Вибір статусу */}
              <div className="book-details__status-wrap">
                <h2 className="book-details__section-title">Мій статус</h2>
                <StatusPicker
                    book={book}
                    currentStatus={status}
                    onStatusChange={setStatus}
                />
              </div>
            </div>
          </div>

          {/* Секція відгуків */}
          <ReviewSection bookId={decodedId} book={book} />
        </div>
      </main>
  );
};

export default BookDetails;