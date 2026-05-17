import { useEffect, useState } from 'react';
import { submitReport } from '../api/apiClient';
import { Link } from 'react-router-dom';
import {
  deleteReview,
  getBookReviews,
  getUserReview,
  upsertReview,
} from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import StarRating from './StarRating';


// ─── Кнопка скарги ───────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { value: 'spam',      label: '🚫 Спам' },
  { value: 'offensive', label: '⚠️ Образливий вміст' },
  { value: 'spoiler',   label: '💬 Незапозначений спойлер' },
  { value: 'false',     label: '❌ Неправдива інформація' },
  { value: 'other',     label: '📋 Інше' },
];

const ReportButton = ({ reviewId }) => {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  const handleReport = async (reason) => {
    setLoading(true);
    try {
      await submitReport(reviewId, reason);
      setDone(true);
      setOpen(false);
    } catch (err) {
      if (err.status === 409) setDone(true); // вже скаржились
      else alert(err.message || 'Помилка відправки скарги');
    } finally {
      setLoading(false);
    }
  };

  if (done) return <span className="report-btn__done">✓ Скаргу надіслано</span>;

  return (
      <div className="report-btn__wrap">
        <button
            className="report-btn__trigger"
            onClick={() => setOpen(o => !o)}
            aria-label="Поскаржитись на відгук"
            title="Поскаржитись"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        </button>
        {open && (
            <div className="report-btn__dropdown">
              <p className="report-btn__title">Причина скарги:</p>
              {REPORT_REASONS.map(({ value, label }) => (
                  <button
                      key={value}
                      className="report-btn__option"
                      onClick={() => handleReport(value)}
                      disabled={loading}
                  >
                    {label}
                  </button>
              ))}
              <button className="report-btn__cancel" onClick={() => setOpen(false)}>
                Скасувати
              </button>
            </div>
        )}
      </div>
  );
};

// ─── Окремий відгук ──────────────────────────────────────────────────────────

const ReviewItem = ({ review, currentUserId, user, onDelete }) => {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const isOwn = review.user_id === currentUserId;

  const formatDate = (iso) =>
      new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
      <article className={`review-item ${isOwn ? 'review-item--own' : ''}`}>
        <header className="review-item__header">
          <div className="review-item__avatar">
            {review.profiles?.avatar_url ? (
                <img src={review.profiles.avatar_url} alt={review.profiles.username} />
            ) : (
                <span>{review.profiles?.username?.[0]?.toUpperCase() ?? '?'}</span>
            )}
          </div>

          <div className="review-item__meta">
            <Link
                to={`/user/${review.profiles?.username}`}
                className="review-item__username-link"
            >
              {review.profiles?.username ?? 'Анонім'}
            </Link>
            <time className="review-item__date" dateTime={review.created_at}>
              {formatDate(review.created_at)}
            </time>
          </div>

          <div className="review-item__rating">
            <StarRating value={review.rating} readOnly size="sm" />
          </div>
        </header>

        {/* Текст відгуку з blur для спойлерів */}
        {review.is_spoiler && !spoilerRevealed ? (
            <div className="review-item__spoiler-wrap">
              <p className="review-item__comment review-item__comment--blurred" aria-hidden="true">
                {review.comment}
              </p>
              <button
                  className="review-item__spoiler-btn"
                  onClick={() => setSpoilerRevealed(true)}
              >
                ⚠️ Спойлер — натисніть, щоб побачити
              </button>
            </div>
        ) : (
            <p className="review-item__comment">
              {review.is_spoiler && (
                  <span className="review-item__spoiler-tag">⚠️ Спойлер</span>
              )}
              {review.comment}
            </p>
        )}

        {/* Скарга — для чужих відгуків */}
        {!isOwn && user && <ReportButton reviewId={review.id} />}

        {/* Кнопка видалення для власного відгуку */}
        {isOwn && (
            <button
                className="review-item__delete"
                onClick={() => onDelete(review.id)}
                aria-label="Видалити відгук"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
        )}
      </article>
  );
};

// ─── Форма відгуку ───────────────────────────────────────────────────────────

const ReviewForm = ({ bookId, book, existingReview, onSubmit }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [isSpoiler, setIsSpoiler] = useState(existingReview?.is_spoiler ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Будь ласка, оберіть рейтинг');
    if (!comment.trim()) return setError('Будь ласка, залиште коментар');

    setLoading(true);
    setError('');

    try {
      const review = await upsertReview({
        userId: user.id,
        bookId,
        rating,
        comment: comment.trim(),
        isSpoiler,
      });

      onSubmit?.(review);
    } catch (err) {
      setError(err.message || 'Помилка збереження відгуку');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
        <div className="review-form review-form--locked">
          <p>Увійдіть, щоб залишити відгук</p>
        </div>
    );
  }

  return (
      <form className="review-form" onSubmit={handleSubmit} noValidate>
        <h3 className="review-form__title">
          {existingReview ? 'Редагувати відгук' : 'Залишити відгук'}
        </h3>

        {/* Рейтинг */}
        <div className="review-form__field">
          <label className="review-form__label">Оцінка</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        {/* Коментар */}
        <div className="review-form__field">
          <label className="review-form__label" htmlFor="review-comment">Коментар</label>
          <textarea
              id="review-comment"
              className="review-form__textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Поділіться враженнями від книги..."
              rows={4}
              maxLength={2000}
          />
          <span className="review-form__counter">{comment.length}/2000</span>
        </div>

        {/* Спойлер */}
        <div className="review-form__checkbox-wrap">
          <label className="review-form__checkbox">
            <input
                type="checkbox"
                checked={isSpoiler}
                onChange={(e) => setIsSpoiler(e.target.checked)}
            />
            <span className="review-form__checkbox-box" />
            <span>⚠️ Містить спойлери</span>
          </label>
        </div>

        {error && <p className="review-form__error">{error}</p>}

        <button
            type="submit"
            className="btn btn--primary"
            disabled={loading}
        >
          {loading ? 'Зберігаємо...' : existingReview ? 'Оновити відгук' : 'Опублікувати відгук'}
        </button>
      </form>
  );
};

// ─── Головна секція відгуків ─────────────────────────────────────────────────

const ReviewSection = ({ bookId, book }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [userReview, setUserReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadReviews = async () => {
    try {
      const [allReviews, myReview] = await Promise.all([
        getBookReviews(bookId),
        user ? getUserReview(user.id, bookId) : Promise.resolve(null),
      ]);
      setReviews(allReviews);
      setUserReview(myReview);
    } catch (err) {
      console.error('Error loading reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [bookId, user?.id]); // eslint-disable-line

  const handleSubmit = (review) => {
    setUserReview(review);
    setShowForm(false);
    loadReviews();
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Видалити відгук?')) return;
    try {
      await deleteReview(reviewId);
      setUserReview(null);
      loadReviews();
    } catch (err) {
      console.error('Error deleting review:', err);
    }
  };

  // Середній рейтинг
  const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
      <section className="review-section">
        {/* Заголовок з агрегованим рейтингом */}
        <div className="review-section__header">
          <h2 className="review-section__title">Відгуки</h2>
          {avgRating && (
              <div className="review-section__aggregate">
                <StarRating value={Math.round(avgRating)} readOnly />
                <span className="review-section__avg">{avgRating}</span>
                <span className="review-section__count">({reviews.length})</span>
              </div>
          )}
        </div>

        {/* CTA для написання відгуку */}
        {user && (
            <div className="review-section__cta">
              {userReview ? (
                  <div className="review-section__has-review">
                    <span>Ви вже залишили відгук</span>
                    <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => setShowForm(!showForm)}
                    >
                      {showForm ? 'Скасувати' : 'Редагувати'}
                    </button>
                  </div>
              ) : (
                  <button
                      className="btn btn--outline"
                      onClick={() => setShowForm(!showForm)}
                  >
                    {showForm ? 'Скасувати' : '✏️ Написати відгук'}
                  </button>
              )}
            </div>
        )}

        {/* Форма відгуку */}
        {showForm && (
            <ReviewForm
                bookId={bookId}
                book={book}
                existingReview={userReview}
                onSubmit={handleSubmit}
            />
        )}

        {!user && (
            <div className="review-section__login-prompt">
              <p>Щоб залишити відгук, потрібно <a href="/login">увійти</a></p>
            </div>
        )}

        {/* Список відгуків */}
        {loading ? (
            <div className="review-section__loading">
              {[1, 2, 3].map((i) => (
                  <div key={i} className="review-skeleton" aria-hidden="true">
                    <div className="review-skeleton__avatar" />
                    <div className="review-skeleton__lines">
                      <div className="review-skeleton__line" />
                      <div className="review-skeleton__line review-skeleton__line--short" />
                    </div>
                  </div>
              ))}
            </div>
        ) : reviews.length === 0 ? (
            <div className="review-section__empty">
              <p>Ще немає відгуків. Будьте першим! 📝</p>
            </div>
        ) : (
            <div className="review-section__list">
              {reviews.map((review) => (
                  <ReviewItem
                      key={review.id}
                      review={review}
                      currentUserId={user?.id}
                      user={user}
                      onDelete={handleDelete}
                  />
              ))}
            </div>
        )}
      </section>
  );
};

export default ReviewSection;