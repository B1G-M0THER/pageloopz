import { useState } from 'react';

const StarRating = ({ value = 0, onChange, readOnly = false, size = 'md' }) => {
  const [hovered, setHovered] = useState(0);

  const stars = [1, 2, 3, 4, 5];
  const active = hovered || value;

  return (
    <div
      className={`star-rating star-rating--${size} ${readOnly ? 'star-rating--readonly' : ''}`}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={`Рейтинг: ${value} з 5 зірок`}
    >
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          className={`star-rating__star ${star <= active ? 'star-rating__star--active' : ''}`}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          disabled={readOnly}
          aria-label={`${star} зірок`}
        >
          ★
        </button>
      ))}
    </div>
  );
};

export default StarRating;
