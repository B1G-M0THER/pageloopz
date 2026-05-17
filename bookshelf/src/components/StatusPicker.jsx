import { useState } from 'react';
import { setBookStatus } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const STATUSES = [
  { value: 'want_to_read', label: 'Хочу прочитати', icon: '📌' },
  { value: 'reading',      label: 'Читаю зараз',    icon: '📖' },
  { value: 'finished',     label: 'Прочитано',       icon: '✅' },
];

const StatusPicker = ({ book, currentStatus, onStatusChange }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSelect = async (status) => {
    if (!user) return;
    setLoading(true);
    try {
      await setBookStatus(user.id, book.id, status);
      onStatusChange?.(status);
    } catch (err) {
      console.error('Failed to set status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
        <div className="status-picker status-picker--locked">
          <p>Увійдіть, щоб відстежувати книги</p>
        </div>
    );
  }

  return (
      <div className="status-picker" aria-label="Статус читання">
        {STATUSES.map(({ value, label, icon }) => (
            <button
                key={value}
                className={`status-picker__btn ${currentStatus === value ? 'status-picker__btn--active' : ''}`}
                onClick={() => handleSelect(value)}
                disabled={loading}
                aria-pressed={currentStatus === value}
            >
              <span className="status-picker__icon">{icon}</span>
              <span>{label}</span>
            </button>
        ))}
      </div>
  );
};

export default StatusPicker;