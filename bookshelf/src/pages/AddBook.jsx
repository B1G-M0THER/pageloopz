import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { submitCustomBook } from '../api/apiClient';

const AddBook = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    author: '',
    description: '',
    cover_url: '',
    isbn: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  if (!user) {
    return (
      <main className="add-book-page container">
        <div className="add-book-locked">
          <p>Для додавання книги потрібно <a href="/login">увійти</a></p>
        </div>
      </main>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await submitCustomBook({
        title: form.title.trim(),
        author: form.author.trim(),
        description: form.description.trim() || undefined,
        cover_url: form.cover_url.trim() || undefined,
        isbn: form.isbn.trim() || undefined,
      });

      setSuccess(result.message || 'Книгу відправлено на розгляд!');
      setForm({ title: '', author: '', description: '', cover_url: '', isbn: '' });
    } catch (err) {
      if (err.status === 409) {
        setError(`Така книга вже існує: «${err.details?.existing?.title ?? form.title}»`);
      } else if (err.details?.length) {
        setError(err.details.join('. '));
      } else {
        setError(err.message || 'Помилка. Спробуйте ще раз.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="add-book-page container">
      <div className="add-book-wrap">
        {/* Заголовок */}
        <div className="add-book-header">
          <div>
            <h1 className="add-book-header__title">Запропонувати книгу</h1>
            <p className="add-book-header__sub">
              Не знайшли книгу через пошук? Запропонуйте її — після перевірки модератором вона з'явиться на платформі.
            </p>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}>← Назад</button>
        </div>

        {/* Форма */}
        <form className="add-book-form" onSubmit={handleSubmit} noValidate>

          <div className="add-book-form__row">
            {/* Назва */}
            <div className="add-book-form__field add-book-form__field--required">
              <label htmlFor="title">Назва книги</label>
              <input
                id="title"
                name="title"
                type="text"
                value={form.title}
                onChange={handleChange}
                placeholder="Наприклад: Кобзар"
                maxLength={255}
                required
              />
            </div>

            {/* Автор */}
            <div className="add-book-form__field add-book-form__field--required">
              <label htmlFor="author">Автор</label>
              <input
                id="author"
                name="author"
                type="text"
                value={form.author}
                onChange={handleChange}
                placeholder="Ім'я та прізвище автора"
                maxLength={255}
                required
              />
            </div>
          </div>

          {/* ISBN */}
          <div className="add-book-form__field">
            <label htmlFor="isbn">
              ISBN
              <span className="add-book-form__optional">(необов'язково)</span>
            </label>
            <input
              id="isbn"
              name="isbn"
              type="text"
              value={form.isbn}
              onChange={handleChange}
              placeholder="978-x-xx-xxxxxx-x"
              maxLength={20}
            />
            <p className="add-book-form__hint">Допоможе точніше ідентифікувати видання</p>
          </div>

          {/* URL обкладинки */}
          <div className="add-book-form__field">
            <label htmlFor="cover_url">
              Посилання на обкладинку
              <span className="add-book-form__optional">(необов'язково)</span>
            </label>
            <input
              id="cover_url"
              name="cover_url"
              type="url"
              value={form.cover_url}
              onChange={handleChange}
              placeholder="https://..."
            />
            {/* Прев'ю обкладинки */}
            {form.cover_url && (
              <div className="add-book-form__cover-preview">
                <img
                  src={form.cover_url}
                  alt="Прев'ю обкладинки"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}
          </div>

          {/* Опис */}
          <div className="add-book-form__field">
            <label htmlFor="description">
              Короткий опис
              <span className="add-book-form__optional">(необов'язково)</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Про що ця книга? Кому варто прочитати?"
              rows={4}
              maxLength={1000}
            />
            <span className="add-book-form__counter">{form.description.length}/1000</span>
          </div>

          {/* Помилки / успіх */}
          {error && (
            <div className="add-book-form__error" role="alert">{error}</div>
          )}
          {success && (
            <div className="add-book-form__success" role="status">
              ✅ {success}
            </div>
          )}

          <div className="add-book-form__actions">
            <button
              type="submit"
              className="btn btn--primary btn--lg"
              disabled={loading || !form.title.trim() || !form.author.trim()}
            >
              {loading ? 'Відправляємо...' : '📤 Відправити на розгляд'}
            </button>
            <p className="add-book-form__disclaimer">
              Книга з'явиться на платформі після перевірки модератором. Зазвичай це займає до 24 годин.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AddBook;
