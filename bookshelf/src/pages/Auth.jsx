// ─── Login.jsx ────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../lib/supabaseClient';

export const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) =>
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(form);
      navigate('/');
    } catch (err) {
      setError('Невірний email або пароль');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-card__icon">📚</div>
          <h1 className="auth-card__title">Вхід у Pageloopz</h1>
          <p className="auth-card__subtitle">Раді бачити вас знову</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-form__field">
              <label htmlFor="email">Email</label>
              <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ваш@email.com"
                  required
                  autoComplete="email"
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="password">Пароль</label>
              <input
                  id="password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
              />
            </div>

            {error && <p className="auth-form__error" role="alert">{error}</p>}

            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Входимо...' : 'Увійти'}
            </button>
          </form>

          <p className="auth-card__footer">
            Немає акаунту?{' '}
            <Link to="/register">Зареєструватись</Link>
          </p>
        </div>
      </main>
  );
};

// ─── Register.jsx ─────────────────────────────────────────────────────────────

export const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', username: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) =>
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.username.trim().length < 3) {
      return setError('Ім\'я користувача має бути не менше 3 символів');
    }
    if (form.password.length < 6) {
      return setError('Пароль має бути не менше 6 символів');
    }

    setLoading(true);
    setError('');
    try {
      const { supabase } = await import('../lib/supabaseClient');
      // Перевіряємо унікальність username до реєстрації
      const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', form.username.trim())
          .maybeSingle();
      if (existingUser) {
        setError('Це ім\'я користувача вже зайнято');
        return;
      }
      const { signUp } = await import('../lib/supabaseClient');
      await signUp(form);
      await new Promise((r) => setTimeout(r, 1500));
      navigate('/profile');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('already registered')) {
        setError('Цей email вже зареєстровано');
      } else if (msg.includes('duplicate') || msg.includes('username')) {
        setError('Це ім\'я користувача вже зайнято');
      } else {
        setError(msg || 'Помилка реєстрації');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-card__icon">📚</div>
          <h1 className="auth-card__title">Реєстрація</h1>
          <p className="auth-card__subtitle">Приєднуйтесь до спільноти читачів</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-form__field">
              <label htmlFor="username">Ім'я користувача</label>
              <input
                  id="username"
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="reader_2024"
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+"
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="email">Email</label>
              <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ваш@email.com"
                  required
                  autoComplete="email"
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="password">Пароль</label>
              <input
                  id="password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Мінімум 6 символів"
                  required
                  minLength={6}
                  autoComplete="new-password"
              />
            </div>

            {error && <p className="auth-form__error" role="alert">{error}</p>}

            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? 'Реєструємось...' : 'Створити акаунт'}
            </button>
          </form>

          <p className="auth-card__footer">
            Вже є акаунт?{' '}
            <Link to="/login">Увійти</Link>
          </p>
        </div>
      </main>
  );
};