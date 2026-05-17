import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BookCard from '../components/BookCard';
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';

const STATUSES = [
    { value: 'reading',      label: 'Читає зараз',    icon: '📖' },
    { value: 'finished',     label: 'Прочитано',       icon: '✅' },
    { value: 'want_to_read', label: 'Хоче прочитати', icon: '📌' },
];

const UserProfile = () => {
    const { username } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile]   = useState(null);
    const [books, setBooks]       = useState({});
    const [reviews, setReviews]   = useState([]);
    const [activeTab, setActiveTab] = useState('reading');
    const [loading, setLoading]   = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Завантажуємо профіль за username
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, created_at')
                    .eq('username', username)
                    .maybeSingle();

                if (profileError || !profileData) {
                    setNotFound(true);
                    return;
                }

                // Якщо це власний профіль — редирект на /profile
                if (user && profileData.id === user.id) {
                    navigate('/profile', { replace: true });
                    return;
                }

                setProfile(profileData);

                // Завантажуємо книги та відгуки паралельно
                const [activityRes, reviewsRes] = await Promise.all([
                    supabase
                        .from('user_book_activity')
                        .select('status, books(id, title, author, cover_url)')
                        .eq('user_id', profileData.id),
                    supabase
                        .from('reviews')
                        .select('id, rating, comment, is_spoiler, created_at, book_id, books(id, title, author, cover_url)')
                        .eq('user_id', profileData.id)
                        .eq('status', 'approved')
                        .order('created_at', { ascending: false }),
                ]);

                // Групуємо книги за статусом
                const grouped = { reading: [], finished: [], want_to_read: [] };
                for (const item of activityRes.data || []) {
                    if (item.books && grouped[item.status]) {
                        grouped[item.status].push({ ...item.books, status: item.status });
                    }
                }
                setBooks(grouped);
                setReviews(reviewsRes.data || []);
            } catch (err) {
                console.error(err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [username, user, navigate]);

    const totalBooks = Object.values(books).flat().length;
    const formatDate = (iso) => new Date(iso).toLocaleDateString('uk-UA', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    if (loading) {
        return (
            <main className="user-profile-page container">
                <div className="user-profile__loading">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                         style={{ animation: 'spin 0.8s linear infinite' }}>
                        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                        <circle cx="12" cy="12" r="10" stroke="#c9a84c"
                                strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10"/>
                    </svg>
                </div>
            </main>
        );
    }

    if (notFound) {
        return (
            <main className="user-profile-page container">
                <div className="user-profile__not-found">
                    <span className="user-profile__not-found-icon">👤</span>
                    <h1>Користувача не знайдено</h1>
                    <p>Профіль «{username}» не існує</p>
                    <Link to="/" className="btn btn--outline">На головну</Link>
                </div>
            </main>
        );
    }

    const currentBooks = books[activeTab] ?? [];

    return (
        <main className="user-profile-page container">
            {/* Шапка профілю */}
            <section className="user-profile__header">
                <div className="user-profile__avatar-wrap">
                    {profile.avatar_url ? (
                        <img
                            className="user-profile__avatar"
                            src={profile.avatar_url}
                            alt={profile.username}
                            loading="lazy"
                        />
                    ) : (
                        <div className="user-profile__avatar user-profile__avatar--placeholder">
                            {profile.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                    )}
                </div>

                <div className="user-profile__info">
                    <h1 className="user-profile__username">{profile.username}</h1>
                    <p className="user-profile__joined">
                        На платформі з {formatDate(profile.created_at)}
                    </p>

                    {/* Статистика */}
                    <div className="user-profile__stats">
                        <div className="user-profile__stat">
                            <strong>{totalBooks}</strong>
                            <span>книг у бібліотеці</span>
                        </div>
                        <div className="user-profile__stat">
                            <strong>{books.finished?.length ?? 0}</strong>
                            <span>прочитано</span>
                        </div>
                        <div className="user-profile__stat">
                            <strong>{reviews.length}</strong>
                            <span>відгуків</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Вкладки */}
            <div className="user-profile__tabs" role="tablist">
                <button
                    role="tab"
                    className={`profile-tab ${activeTab !== 'reviews' ? '' : ''} ${activeTab !== 'reviews' ? (STATUSES.find(s => s.value === activeTab) ? 'profile-tab--active' : '') : ''}`}
                    style={{ display: 'none' }}
                />
                {STATUSES.map(({ value, label, icon }) => (
                    <button
                        key={value}
                        role="tab"
                        className={`profile-tab ${activeTab === value ? 'profile-tab--active' : ''}`}
                        onClick={() => setActiveTab(value)}
                        aria-selected={activeTab === value}
                    >
                        <span>{icon}</span>
                        <span>{label}</span>
                        <span className="profile-tab__count">{(books[value] ?? []).length}</span>
                    </button>
                ))}
                <button
                    role="tab"
                    className={`profile-tab ${activeTab === 'reviews' ? 'profile-tab--active' : ''}`}
                    onClick={() => setActiveTab('reviews')}
                    aria-selected={activeTab === 'reviews'}
                >
                    <span>💬</span>
                    <span>Відгуки</span>
                    <span className="profile-tab__count">{reviews.length}</span>
                </button>
            </div>

            {/* Контент вкладок */}
            <div role="tabpanel">
                {activeTab !== 'reviews' ? (
                    currentBooks.length === 0 ? (
                        <div className="user-profile__empty">
                            <span>{STATUSES.find(s => s.value === activeTab)?.icon}</span>
                            <p>Список порожній</p>
                        </div>
                    ) : (
                        <div className="books-grid">
                            {currentBooks.map((book) => (
                                <BookCard key={book.id} book={book} showStatus />
                            ))}
                        </div>
                    )
                ) : (
                    <div className="user-profile__reviews">
                        {reviews.length === 0 ? (
                            <div className="user-profile__empty">
                                <span>💬</span>
                                <p>Ще немає відгуків</p>
                            </div>
                        ) : (
                            reviews.map((review) => (
                                <UserReviewCard key={review.id} review={review} />
                            ))
                        )}
                    </div>
                )}
            </div>
        </main>
    );
};

// ─── Картка відгуку ───────────────────────────────────────────────────────────
const UserReviewCard = ({ review }) => {
    const [spoilerRevealed, setSpoilerRevealed] = useState(false);
    const book = review.books;

    const formatDate = (iso) => new Date(iso).toLocaleDateString('uk-UA', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <article className="user-review-card">
            {/* Книга */}
            {book && (
                <Link to={`/book/${encodeURIComponent(book.id.replace('/works/', ''))}`}
                      className="user-review-card__book">
                    {book.cover_url && (
                        <img
                            src={book.cover_url}
                            alt={book.title}
                            className="user-review-card__book-cover"
                            loading="lazy"
                        />
                    )}
                    <div>
                        <p className="user-review-card__book-title">{book.title}</p>
                        <p className="user-review-card__book-author">{book.author}</p>
                    </div>
                </Link>
            )}

            {/* Рейтинг і дата */}
            <div className="user-review-card__meta">
                <StarRating value={review.rating} readOnly size="sm" />
                <time className="user-review-card__date">{formatDate(review.created_at)}</time>
            </div>

            {/* Текст */}
            {review.is_spoiler && !spoilerRevealed ? (
                <div className="review-item__spoiler-wrap">
                    <p className="review-item__comment review-item__comment--blurred" aria-hidden="true">
                        {review.comment}
                    </p>
                    <button className="review-item__spoiler-btn" onClick={() => setSpoilerRevealed(true)}>
                        ⚠️ Спойлер — натисніть, щоб побачити
                    </button>
                </div>
            ) : (
                <p className="user-review-card__comment">
                    {review.is_spoiler && <span className="review-item__spoiler-tag">⚠️ Спойлер</span>}
                    {review.comment}
                </p>
            )}
        </article>
    );
};

export default UserProfile;