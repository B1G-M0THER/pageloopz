import { useEffect, useState } from 'react';

/**
 * Хук для debounce значень — затримує оновлення до завершення введення
 * @param {any} value - значення для debounce
 * @param {number} delay - затримка в мілісекундах
 */
export const useDebounce = (value, delay = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};
