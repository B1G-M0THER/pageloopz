import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserBooksByStatus, uploadAvatar, updateProfile, supabase } from '../lib/supabaseClient';
import { getMySubmissions } from '../api/apiClient';
import BookCard from '../components/BookCard';

const STATUSES = [
  { value: 'reading',      label: 'Читаю зараз',    icon: '📖' },
  { value: 'want_to_read', label: 'Хочу прочитати', icon: '📌' },
  { value: 'finished',     label: 'Прочитано',       icon: '✅' },
];

const SUBMISSION_FILTERS = [
  { value: '',         label: 'Всі',              icon: '📋' },
  { value: 'pending',  label: 'Очікують',         icon: '⏳' },
  { value: 'approved', label: 'Підтверджені',     icon: '✅' },
  { value: 'rejected', label: 'Відхилені',        icon: '❌' },
];

const STATUS_BADGE = {
  pending:  { label: 'Очікує',         color: 'var(--warning)',  bg: 'rgba(224,168,87,0.1)',  icon: '⏳' },
  approved: { label: 'Підтверджено',   color: 'var(--success)',  bg: 'rgba(76,175,130,0.1)',  icon: '✅' },
  rejected: { label: 'Відхилено',      color: 'var(--error)',    bg: 'rgba(224,87,87,0.1)',   icon: '❌' },
};

// ─── Таблиця запропонованих книг ──────────────────────────────────────────────
const SubmissionsTable = ({ books }) => (
    <div className="sub-table-wrap">
      <table className="sub-table">
        <thead>
          <tr>
            <th className="sub-table__th sub-table__th--cover" aria-hidden="true" />
            <th className="sub-table__th">Книга</th>
            <th className="sub-table__th sub-table__th--center">Статус</th>
            <th className="sub-table__th sub-table__th--date">Дата</th>
          </tr>
        </thead>
        <tbody>
          {books.map(book => {
            const badge = STATUS_BADGE[book.status] || STATUS_BADGE.pending;
            return (
                <tr key={book.id} className="sub-table__row">
                  <td className="sub-table__td sub-table__td--cover">
                    {book.status === 'approved'
                        ? <Link to={`/book/custom_${book.id}`} className="sub-table__cover-link">
                            {book.cover_url
                                ? <img src={book.cover_url} alt={book.title} className="sub-table__cover" loading="lazy" />
                                : <div className="sub-table__cover sub-table__cover--empty">📖</div>
                            }
                          </Link>
                        : book.cover_url
                            ? <img src={book.cover_url} alt="" className="sub-table__cover" loading="lazy" />
                            : <div className="sub-table__cover sub-table__cover--empty">📖</div>
                    }
                  </td>
                  <td className="sub-table__td sub-table__td--main">
                    {book.status === 'approved'
                        ? <Link to={`/book/custom_${book.id}`} className="sub-table__title sub-table__title--link">{book.title}</Link>
                        : <span className="sub-table__title">{book.title}</span>
                    }
                    <span className="sub-table__author">{book.author}</span>
                    {book.isbn && <span className="sub-table__isbn">ISBN: {book.isbn}</span>}
                    {book.rejection_reason && (
                        <span className="sub-table__rejection">
                          {book.rejection_reason}
                        </span>
                    )}
                  </td>
                  <td className="sub-table__td sub-table__td--center">
                    <span className="sub-table__badge" style={{ color: badge.color, background: badge.bg }}>
                      {badge.icon} {badge.label}
                    </span>
                  </td>
                  <td className="sub-table__td sub-table__td--date">
                    {new Date(book.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
            );
          })}
        </tbody>
      </table>
    </div>
);

// ─── Profile Page ─────────────────────────────────────────────────────────────
const Profile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab]             = useState('reading');
  const [books, setBooks]                     = useState({});
  const [loadingBooks, setLoadingBooks]       = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername]         = useState('');
  const [savingUsername, setSavingUsername]   = useState(false);
  const [usernameError, setUsernameError]     = useState('');
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  // Submissions
  const [submissions, setSubmissions]         = useState([]);
  const [subFilter, setSubFilter]             = useState('');
  const [loadingSubs, setLoadingSubs]         = useState(false);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (!user || profile) return;
    const t = setTimeout(() => setProfileTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [user, profile]);

  useEffect(() => {
    if (!user || !profile) return;
    const loadAllBooks = async () => {
      setLoadingBooks(true);
      try {
        const [reading, wantToRead, finished] = await Promise.all([
          getUserBooksByStatus(user.id, 'reading'),
          getUserBooksByStatus(user.id, 'want_to_read'),
          getUserBooksByStatus(user.id, 'finished'),
        ]);
        setBooks({ reading, want_to_read: wantToRead, finished });
      } catch (err) { console.error(err); }
      finally { setLoadingBooks(false); }
    };
    loadAllBooks();
  }, [user, profile]);

  // Завантажуємо заявки при відкритті вкладки або зміні фільтра
  useEffect(() => {
    if (activeTab !== 'submissions' || !user) return;
    setLoadingSubs(true);
    getMySubmissions(subFilter || undefined)
        .then(res => setSubmissions(res.books || []))
        .catch(console.error)
        .finally(() => setLoadingSubs(false));
  }, [activeTab, subFilter, user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Файл занадто великий. Максимум 5MB.'); return; }
    setUploadingAvatar(true);
    try { await uploadAvatar(user.id, file); refreshProfile(); }
    catch (err) { console.error(err); alert('Помилка завантаження аватарки.'); }
    finally { setUploadingAvatar(false); }
  };

  const handleUsernameEdit = () => {
    setNewUsername(profile?.username ?? '');
    setEditingUsername(true);
    setUsernameError('');
  };

  const handleUsernameSave = async () => {
    const trimmed = newUsername.trim();
    if (!trimmed) return setUsernameError("Ім'я не може бути порожнім");
    if (trimmed.length < 3) return setUsernameError('Мінімум 3 символи');
    if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+$/.test(trimmed)) {
      return setUsernameError('Тільки букви, цифри та підкреслення');
    }
    setSavingUsername(true);
    try {
      if (trimmed !== profile?.username) {
        const { data: existing } = await supabase
            .from('profiles').select('id').eq('username', trimmed).maybeSingle();
        if (existing) { setUsernameError("Це ім'я вже зайнято іншим користувачем"); return; }
      }
      await updateProfile(user.id, { username: trimmed });
      refreshProfile();
      setEditingUsername(false);
    } catch (err) { setUsernameError(err.message || 'Помилка збереження'); }
    finally { setSavingUsername(false); }
  };

  // ── Стани завантаження ────────────────────────────────────────────────────
  if (!user) return null;

  if (user && !profile) {
    if (profileTimedOut) {
      return (
          <main className="profile-page container" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh',flexDirection:'column',gap:'16px' }}>
            <p style={{ color:'var(--error)',fontSize:'0.9rem' }}>Не вдалось завантажити профіль.</p>
            <button className="btn btn--outline" onClick={() => window.location.reload()}>Спробувати знову</button>
          </main>
      );
    }
    return (
        <main className="profile-page container" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh',flexDirection:'column',gap:'16px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ animation:'spin 0.8s linear infinite' }}>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
            <circle cx="12" cy="12" r="10" stroke="#c9a84c" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10"/>
          </svg>
          <p style={{ color:'var(--text-2)',fontSize:'0.9rem' }}>Завантажуємо профіль...</p>
        </main>
    );
  }

  const currentBooks = books[activeTab] ?? [];

  return (
      <main className="profile-page container">
        {/* Шапка */}
        <section className="profile-header">
          <div className="profile-avatar-wrap">
            <button className="profile-avatar-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} aria-label="Змінити аватарку">
              {profile.avatar_url
                  ? <img className="profile-avatar" src={profile.avatar_url} alt={profile.username} loading="lazy" />
                  : <div className="profile-avatar profile-avatar--placeholder">{profile.username?.[0]?.toUpperCase() ?? '?'}</div>
              }
              <div className="profile-avatar-overlay">
                {uploadingAvatar
                    ? <svg className="spinner" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/></svg>
                }
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="visually-hidden" />
          </div>

          <div className="profile-info">
            {editingUsername ? (
                <div className="profile-username-edit">
                  <input className="profile-username-input" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                         onKeyDown={e => { if (e.key==='Enter') handleUsernameSave(); if (e.key==='Escape') setEditingUsername(false); }}
                         autoFocus maxLength={30} />
                  {usernameError && <p className="profile-username-error">{usernameError}</p>}
                  <div className="profile-username-actions">
                    <button className="btn btn--primary btn--sm" onClick={handleUsernameSave} disabled={savingUsername}>
                      {savingUsername ? 'Зберігаємо...' : 'Зберегти'}
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditingUsername(false)}>Скасувати</button>
                  </div>
                </div>
            ) : (
                <div className="profile-username-display">
                  <h1 className="profile-username">{profile.username}</h1>
                  <button className="profile-edit-btn" onClick={handleUsernameEdit} aria-label="Редагувати ім'я">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
            )}
            <p className="profile-email">{user.email}</p>
            <div className="profile-stats">
              {STATUSES.map(({ value, icon }) => (
                  <div key={value} className="profile-stat">
                    <span className="profile-stat__icon">{icon}</span>
                    <strong className="profile-stat__count">{(books[value] ?? []).length}</strong>
                  </div>
              ))}
            </div>
          </div>
        </section>

        {/* Вкладки */}
        <div className="profile-tabs" role="tablist">
          {STATUSES.map(({ value, label, icon }) => (
              <button key={value} role="tab"
                      className={`profile-tab ${activeTab === value ? 'profile-tab--active' : ''}`}
                      onClick={() => setActiveTab(value)} aria-selected={activeTab === value}>
                <span>{icon}</span><span>{label}</span>
                <span className="profile-tab__count">{(books[value] ?? []).length}</span>
              </button>
          ))}
          <button role="tab"
                  className={`profile-tab ${activeTab === 'submissions' ? 'profile-tab--active' : ''}`}
                  onClick={() => setActiveTab('submissions')} aria-selected={activeTab === 'submissions'}>
            <span>📤</span><span>Мої пропозиції</span>
          </button>
        </div>

        {/* Контент */}
        <div className="profile-books" role="tabpanel">
          {/* Бібліотека */}
          {activeTab !== 'submissions' && (
              loadingBooks ? (
                  <div className="books-grid">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="book-card-skeleton" aria-hidden="true">
                          <div className="book-card-skeleton__cover"/>
                          <div className="book-card-skeleton__title"/>
                          <div className="book-card-skeleton__author"/>
                        </div>
                    ))}
                  </div>
              ) : currentBooks.length === 0 ? (
                  <div className="profile-books__empty">
                    <span className="profile-books__empty-icon">{STATUSES.find(s => s.value === activeTab)?.icon}</span>
                    <p>Список порожній</p>
                    <a href="/" className="btn btn--outline">Знайти книги</a>
                  </div>
              ) : (
                  <div className="books-grid">
                    {currentBooks.map(({ books: book, status }) => (
                        <BookCard key={book.id} book={{ ...book, status }} showStatus />
                    ))}
                  </div>
              )
          )}

          {/* Мої пропозиції */}
          {activeTab === 'submissions' && (
              <div className="submissions-wrap">
                {/* Заголовок + кнопка додати */}
                <div className="submissions-header">
                  <h2 className="submissions-title">Запропоновані книги</h2>
                  <Link to="/add-book" className="btn btn--primary btn--sm">+ Запропонувати книгу</Link>
                </div>

                {/* Фільтри */}
                <div className="submissions-filters">
                  {SUBMISSION_FILTERS.map(({ value, label, icon }) => (
                      <button key={value}
                              className={`submissions-filter ${subFilter === value ? 'submissions-filter--active' : ''}`}
                              onClick={() => setSubFilter(value)}>
                        <span>{icon}</span>
                        <span>{label}</span>
                      </button>
                  ))}
                </div>

                {/* Список */}
                {loadingSubs ? (
                    <div className="submissions-loading">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation:'spin 0.8s linear infinite' }}>
                        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                        <circle cx="12" cy="12" r="10" stroke="#c9a84c" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10"/>
                      </svg>
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="profile-books__empty">
                      <span className="profile-books__empty-icon">📤</span>
                      <p>{subFilter ? 'Немає книг з таким статусом' : 'Ви ще не пропонували книг'}</p>
                      {!subFilter && <Link to="/add-book" className="btn btn--outline">Запропонувати першу</Link>}
                    </div>
                ) : (
                    <SubmissionsTable books={submissions} />
                )}
              </div>
          )}
        </div>
      </main>
  );
};

export default Profile;