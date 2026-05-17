import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/supabaseClient';
import { useTheme } from '../hooks/useTheme';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const Navbar = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const close   = () => setMenuOpen(false);

  const handleSignOut = async () => {
    close();
    await signOut();
    navigate('/');
  };

  const navLinks = (
    <>
      {user && (
        <NavLink to="/profile" className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`} onClick={close}>
          Бібліотека
        </NavLink>
      )}
      {user && (
        <NavLink to="/add-book" className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`} onClick={close}>
          + Книга
        </NavLink>
      )}
      {user && isAdmin && (
        <NavLink to="/admin" className={({ isActive }) => `navbar__link navbar__link--admin ${isActive ? 'navbar__link--active' : ''}`} onClick={close}>
          ⚙ Адмін
        </NavLink>
      )}
    </>
  );

  const authSection = user ? (
    <div className="navbar__user">
      <Link to="/profile" className="navbar__avatar-link" aria-label="Профіль" onClick={close}>
        {profile?.avatar_url ? (
          <img className="navbar__avatar" src={profile.avatar_url} alt={profile.username} />
        ) : (
          <div className="navbar__avatar navbar__avatar--placeholder">
            {profile?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
      </Link>
      <button className="btn btn--ghost btn--sm" onClick={handleSignOut}>Вийти</button>
    </div>
  ) : (
    <div className="navbar__auth-links">
      <Link to="/login" className="btn btn--ghost btn--sm" onClick={close}>Увійти</Link>
      <Link to="/register" className="btn btn--primary btn--sm" onClick={close}>Реєстрація</Link>
    </div>
  );

  return (
    <header className="navbar">
      <div className="navbar__inner container">

        {/* Лого */}
        <Link to="/" className="navbar__brand" onClick={close}>
          <svg className="navbar__logo-icon" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="3" width="16" height="22" rx="2" fill="var(--accent)" opacity="0.9" />
            <rect x="8" y="7" width="16" height="22" rx="2" fill="var(--surface-2)" stroke="var(--accent)" strokeWidth="1.5" />
            <line x1="12" y1="13" x2="20" y2="13" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="12" y1="17" x2="18" y2="17" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="navbar__brand-text">Pageloopz</span>
        </Link>

        {/* Перемикач теми */}
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Навігація — десктоп */}
        <nav className="navbar__nav" aria-label="Головна навігація">
          {navLinks}
        </nav>

        {/* Авторизація — десктоп */}
        <div className="navbar__auth">{authSection}</div>

        {/* Бургер — мобільний */}
        <button
          className={`navbar__hamburger${menuOpen ? ' navbar__hamburger--open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Відкрити меню"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Мобільне меню */}
      <div className={`navbar__drawer${menuOpen ? ' navbar__drawer--open' : ''}`} aria-hidden={!menuOpen}>
        <nav className="navbar__drawer-nav">{navLinks}</nav>
        <div className="navbar__drawer-auth">{authSection}</div>
      </div>
    </header>
  );
};

export default Navbar;