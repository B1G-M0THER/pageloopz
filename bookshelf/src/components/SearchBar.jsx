import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';

const SearchBar = ({ onSearch, loading = false, placeholder = 'Пошук книг...', initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 450);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
      <div className="search-bar">
        <div className="search-bar__inner">
          {/* Іконка пошуку / спінер */}
          <span className="search-bar__icon" aria-hidden="true">
          {loading ? (
              <svg className="spinner" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="10" />
              </svg>
          ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
          )}
        </span>

          <input
              ref={inputRef}
              className="search-bar__input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck="false"
              aria-label="Пошук книг"
          />

          {/* Кнопка очищення */}
          {query && (
              <button
                  className="search-bar__clear"
                  onClick={handleClear}
                  aria-label="Очистити пошук"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
          )}
        </div>

        {/* Підказки клавіатури */}
        {query && query.length < 2 && (
            <p className="search-bar__hint">Введіть ще хоча б один символ для пошуку</p>
        )}
        {query && query.length >= 2 && (
            <p className="search-bar__hint">
              Натисніть <kbd>Enter</kbd> або зачекайте результатів
            </p>
        )}
      </div>
  );
};

export default SearchBar;