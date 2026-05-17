import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// Encoding для безпечного URL
const encodeBookId = (id) => encodeURIComponent(id.replace('/works/', ''));

const BookCard = ({ book, showStatus = false }) => {
  const { id, title, author, cover_url, year, status } = book;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef(null);

  const bookPath = `/book/${encodeBookId(id)}`;

  const STATUS_LABELS = {
    want_to_read: { label: 'Хочу прочитати', emoji: '📌' },
    reading: { label: 'Читаю зараз', emoji: '📖' },
    finished: { label: 'Прочитано', emoji: '✅' },
  };

  return (
    <Link to={bookPath} className="book-card" aria-label={`${title} — ${author}`}>
      <div className="book-card__cover-wrap">
        {/* Skeleton placeholder */}
        {!imgLoaded && !imgError && (
          <div className="book-card__skeleton" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
              <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5 14H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V6h9v2z" />
            </svg>
          </div>
        )}

        {/* Зображення обкладинки з lazy loading */}
        {cover_url && !imgError ? (
          <img
            ref={imgRef}
            className={`book-card__cover ${imgLoaded ? 'book-card__cover--loaded' : ''}`}
            src={cover_url}
            alt={`Обкладинка: ${title}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="book-card__no-cover" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-5 14H7v-2h6v2zm3-4H7v-2h9v2zm0-4H7V6h9v2z" />
            </svg>
            <span>Без обкладинки</span>
          </div>
        )}

        {/* Статус читання (якщо є) */}
        {showStatus && status && STATUS_LABELS[status] && (
          <div className="book-card__status-badge">
            <span>{STATUS_LABELS[status].emoji}</span>
          </div>
        )}
      </div>

      <div className="book-card__info">
        <h3 className="book-card__title">{title}</h3>
        <p className="book-card__author">{author}</p>
        {year && <p className="book-card__year">{year}</p>}
        {showStatus && status && (
          <p className="book-card__status-label">{STATUS_LABELS[status].label}</p>
        )}
      </div>
    </Link>
  );
};

export default BookCard;
