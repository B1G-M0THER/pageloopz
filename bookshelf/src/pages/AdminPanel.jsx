import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAdminStats,
  getAdminUsers,
  updateUserRole,
  getPendingReviews,
  approveReview,
  rejectReview,
  adminDeleteReview,
  getPendingCustomBooks,
  approveCustomBook,
  rejectCustomBook,
  getAdminReports,
  dismissReports,
  removeReportedReview,
} from '../api/apiClient';

const ROLES = ['user', 'moderator', 'admin'];

const TABS = [
  { id: 'overview', label: 'Огляд',        icon: '📊' },
  { id: 'reviews',  label: 'Відгуки',      icon: '💬' },
  { id: 'books',    label: 'Книги',        icon: '📚' },
  { id: 'users',    label: 'Користувачі',  icon: '👥' },
  { id: 'reports',  label: 'Скарги',       icon: '🚩' },
];

const StatCard = ({ label, value, accent = false }) => (
    <div className={`admin-stat ${accent ? 'admin-stat--accent' : ''}`}>
      <span className="admin-stat__value">{value ?? '—'}</span>
      <span className="admin-stat__label">{label}</span>
    </div>
);

const AdminPanel = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]                       = useState('overview');
  const [stats, setStats]                   = useState(null);
  const [users, setUsers]                   = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [pendingBooks, setPendingBooks]     = useState([]);
  const [reports, setReports]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [actionLoading, setActionLoading]   = useState('');
  const [error, setError]                   = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (profile && profile.role !== 'admin') { navigate('/'); return; }
  }, [user, profile, navigate]);

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    const t = setTimeout(loadAll, 300);
    return () => clearTimeout(t);
  }, [profile]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, u, pr, pb, rp] = await Promise.all([
        getAdminStats(),
        getAdminUsers(),
        getPendingReviews(),
        getPendingCustomBooks(),
        getAdminReports(),
      ]);
      setStats(s.stats);
      setUsers(u.users || []);
      setPendingReviews(pr.reviews || []);
      setPendingBooks(pb.books || []);
      setReports(rp.reportedReviews || []);
    } catch (err) {
      setError(err.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = async (id) => {
    setActionLoading(id);
    try {
      await approveReview(id);
      setPendingReviews(prev => prev.filter(r => r.id !== id));
      setStats(s => s ? { ...s, pendingReviews: s.pendingReviews - 1 } : s);
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleRejectReview = async (id) => {
    const reason = window.prompt('Причина відхилення:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await rejectReview(id, reason);
      setPendingReviews(prev => prev.filter(r => r.id !== id));
      setStats(s => s ? { ...s, pendingReviews: s.pendingReviews - 1 } : s);
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleDeleteReview = async (id) => {
    if (!window.confirm('Видалити відгук назавжди?')) return;
    setActionLoading(id);
    try {
      await adminDeleteReview(id);
      setPendingReviews(prev => prev.filter(r => r.id !== id));
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleApproveBook = async (id) => {
    setActionLoading(id);
    try {
      await approveCustomBook(id);
      setPendingBooks(prev => prev.filter(b => b.id !== id));
      setStats(s => s ? { ...s, pendingCustomBooks: s.pendingCustomBooks - 1 } : s);
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleRejectBook = async (id) => {
    const reason = window.prompt('Причина відхилення:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await rejectCustomBook(id, reason);
      setPendingBooks(prev => prev.filter(b => b.id !== id));
      setStats(s => s ? { ...s, pendingCustomBooks: s.pendingCustomBooks - 1 } : s);
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleRoleChange = async (userId, role) => {
    setActionLoading(userId);
    try {
      await updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleRemoveReported = async (reviewId) => {
    if (!window.confirm('Видалити відгук?')) return;
    setActionLoading(reviewId);
    try {
      await removeReportedReview(reviewId);
      setReports(prev => prev.filter(r => r.reviewId !== reviewId));
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  const handleDismissReports = async (reviewId) => {
    setActionLoading(reviewId);
    try {
      await dismissReports(reviewId);
      setReports(prev => prev.filter(r => r.reviewId !== reviewId));
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  };

  if (!profile) {
    return (
        <main className="admin-page container">
          <div className="admin-loading">Перевірка прав доступу...</div>
        </main>
    );
  }

  if (loading) {
    return (
        <main className="admin-page container">
          <div className="admin-loading">Завантаження адмін-панелі...</div>
        </main>
    );
  }

  return (
      <main className="admin-page container">
        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">Адмін-панель</h1>
            <p className="admin-header__sub">Управління платформою Pageloopz</p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={loadAll}>↻ Оновити</button>
        </div>

        {error && <div className="admin-error" role="alert">{error}</div>}

        {/* Вкладки */}
        <div className="admin-tabs" role="tablist">
          {TABS.map(({ id, label, icon }) => (
              <button
                  key={id}
                  role="tab"
                  className={`admin-tab ${tab === id ? 'admin-tab--active' : ''}`}
                  onClick={() => setTab(id)}
                  aria-selected={tab === id}
              >
                <span>{icon}</span>
                <span>{label}</span>
                {id === 'reviews' && stats?.pendingReviews > 0 && (
                    <span className="admin-badge">{stats.pendingReviews}</span>
                )}
                {id === 'books' && stats?.pendingCustomBooks > 0 && (
                    <span className="admin-badge">{stats.pendingCustomBooks}</span>
                )}
                {id === 'reports' && reports.length > 0 && (
                    <span className="admin-badge">{reports.length}</span>
                )}
              </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && stats && (
            <div className="admin-content">
              <div className="admin-stats-grid">
                <StatCard label="Користувачів"          value={stats.totalUsers} />
                <StatCard label="Книг у базі"            value={stats.totalBooks} />
                <StatCard label="Всього відгуків"        value={stats.totalReviews} />
                <StatCard label="Відгуків на модерацію"  value={stats.pendingReviews}     accent={stats.pendingReviews > 0} />
                <StatCard label="Книг на модерацію"      value={stats.pendingCustomBooks} accent={stats.pendingCustomBooks > 0} />
              </div>
            </div>
        )}

        {/* ── Reviews ── */}
        {tab === 'reviews' && (
            <div className="admin-content">
              <h2 className="admin-section-title">
                Відгуки на модерацію
                {pendingReviews.length > 0 && (
                    <span className="admin-badge admin-badge--lg">{pendingReviews.length}</span>
                )}
              </h2>
              {pendingReviews.length === 0 ? (
                  <div className="admin-empty">✅ Немає відгуків, що очікують модерації</div>
              ) : (
                  <div className="admin-list">
                    {pendingReviews.map(review => (
                        <div key={review.id} className="admin-card">
                          <div className="admin-card__meta">
                            <span className="admin-card__user">👤 {review.profiles?.username}</span>
                            <span className="admin-card__book">📖 {review.books?.title}</span>
                            <span className="admin-card__rating">
                      {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </span>
                          </div>
                          {review.is_spoiler && <span className="admin-card__spoiler-tag">⚠️ Спойлер</span>}
                          <p className="admin-card__text">{review.comment}</p>
                          <div className="admin-card__actions">
                            <button className="btn btn--sm btn--primary"
                                    onClick={() => handleApproveReview(review.id)}
                                    disabled={actionLoading === review.id}>
                              ✓ Схвалити
                            </button>
                            <button className="btn btn--sm btn--outline"
                                    onClick={() => handleRejectReview(review.id)}
                                    disabled={actionLoading === review.id}>
                              ✕ Відхилити
                            </button>
                            <button className="btn btn--sm btn--ghost"
                                    onClick={() => handleDeleteReview(review.id)}
                                    disabled={actionLoading === review.id}>
                              🗑 Видалити
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </div>
        )}

        {/* ── Books ── */}
        {tab === 'books' && (
            <div className="admin-content">
              <h2 className="admin-section-title">
                Запропоновані книги
                {pendingBooks.length > 0 && (
                    <span className="admin-badge admin-badge--lg">{pendingBooks.length}</span>
                )}
              </h2>
              {pendingBooks.length === 0 ? (
                  <div className="admin-empty">✅ Немає книг, що очікують схвалення</div>
              ) : (
                  <div className="admin-list">
                    {pendingBooks.map(book => (
                        <div key={book.id} className="admin-card admin-card--book">
                          {/* Обкладинка */}
                          <div className="admin-book-cover">
                            {book.cover_url ? (
                                <img
                                    src={book.cover_url}
                                    alt={book.title}
                                    className="admin-book-cover__img"
                                    loading="lazy"
                                    onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                                />
                            ) : null}
                            <div className="admin-book-cover__placeholder" style={{ display: book.cover_url ? 'none' : 'flex' }}>
                              📖
                            </div>
                          </div>

                          {/* Деталі */}
                          <div className="admin-book-details">
                            <div className="admin-card__meta">
                              <span className="admin-card__user">Додав: {book.profiles?.username}</span>
                              {book.isbn && <span className="admin-card__isbn">ISBN: {book.isbn}</span>}
                            </div>
                            <p className="admin-card__title">{book.title}</p>
                            <p className="admin-card__author">— {book.author}</p>
                            {book.description && (
                                <p className="admin-card__text admin-card__text--muted">
                                  {book.description.slice(0, 220)}{book.description.length > 220 ? '…' : ''}
                                </p>
                            )}
                            {book.cover_url && (
                                <a
                                    href={book.cover_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="admin-card__book-link"
                                >
                                  🔗 Переглянути обкладинку
                                </a>
                            )}
                            <div className="admin-card__actions">
                              <button className="btn btn--sm btn--primary"
                                      onClick={() => handleApproveBook(book.id)}
                                      disabled={actionLoading === book.id}>
                                ✓ Схвалити
                              </button>
                              <button className="btn btn--sm btn--outline"
                                      onClick={() => handleRejectBook(book.id)}
                                      disabled={actionLoading === book.id}>
                                ✕ Відхилити
                              </button>
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </div>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
            <div className="admin-content">
              <h2 className="admin-section-title">Користувачі ({users.length})</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                  <tr>
                    <th>Користувач</th>
                    <th>ID</th>
                    <th>Дата реєстрації</th>
                    <th>Роль</th>
                  </tr>
                  </thead>
                  <tbody>
                  {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <a
                              href={`/user/${u.username}`}
                              target="_blank"
                              rel="noreferrer"
                              className="admin-user-cell admin-user-cell--link"
                          >
                            {u.avatar_url
                                ? <img src={u.avatar_url} alt={u.username} className="admin-user-avatar" />
                                : <div className="admin-user-avatar admin-user-avatar--placeholder">
                                  {u.username?.[0]?.toUpperCase()}
                                </div>
                            }
                            <span>{u.username}</span>
                          </a>
                        </td>
                        <td><code className="admin-id">{u.id.slice(0, 8)}…</code></td>
                        <td>{new Date(u.created_at).toLocaleDateString('uk-UA')}</td>
                        <td>
                          <select
                              className="admin-role-select"
                              value={u.role || 'user'}
                              onChange={e => handleRoleChange(u.id, e.target.value)}
                              disabled={actionLoading === u.id || u.id === profile?.id}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {/* ── Reports ── */}
        {tab === 'reports' && (
            <div className="admin-content">
              <h2 className="admin-section-title">
                Скарги на відгуки
                {reports.length > 0 && (
                    <span className="admin-badge admin-badge--lg">{reports.length}</span>
                )}
              </h2>
              {reports.length === 0 ? (
                  <div className="admin-empty">✅ Немає активних скарг</div>
              ) : (
                  <div className="admin-list">
                    {reports.map(item => (
                        <div key={item.reviewId} className="admin-card">
                          <div className="admin-card__meta">
                    <span className="admin-card__user">
                      🚩 <strong>{item.reportCount}</strong>{' '}
                      {item.reportCount === 1 ? 'скарга' : item.reportCount < 5 ? 'скарги' : 'скарг'}
                    </span>
                            {Object.entries(item.reasonCounts || {}).map(([reason, count]) => (
                                <span key={reason} className="admin-report-reason">
                        {reason}: {count}
                      </span>
                            ))}
                          </div>
                          {item.review?.book_id && (
                              <div className="admin-card__meta" style={{ marginTop: 4 }}>
                                <a
                                    href={`/book/${encodeURIComponent(item.review.book_id.replace('/works/', ''))}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="admin-card__book-link"
                                >
                                  📖 Переглянути книгу →
                                </a>
                              </div>
                          )}
                          {item.review?.is_spoiler && (
                              <span className="admin-card__spoiler-tag">⚠️ Спойлер</span>
                          )}
                          <p className="admin-card__text">{item.review?.comment}</p>
                          <div className="admin-card__actions">
                            <button
                                className="btn btn--sm btn--primary"
                                onClick={() => handleRemoveReported(item.reviewId)}
                                disabled={actionLoading === item.reviewId}
                            >
                              🗑 Видалити відгук
                            </button>
                            <button
                                className="btn btn--sm btn--ghost"
                                onClick={() => handleDismissReports(item.reviewId)}
                                disabled={actionLoading === item.reviewId}
                            >
                              ✕ Відхилити скарги
                            </button>
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </div>
        )}
      </main>
  );
};

export default AdminPanel;