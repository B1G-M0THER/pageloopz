import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const MIN_LENGTH = Number(process.env.MIN_REVIEW_LENGTH) || 10;
const MAX_LENGTH = Number(process.env.MAX_REVIEW_LENGTH) || 2000;

// ─── Модерація ─────────────────────────────────────────────────────────────────

// Базовий список заблокованих слів (розширте за потреби)
const BLOCKED_WORDS = [
  'spam', 'casino', 'viagra', 'xxx',
  // додайте українські/російські токсичні слова
];

const moderateText = (text) => {
  const lower = text.toLowerCase();
  const found = BLOCKED_WORDS.filter((w) => lower.includes(w));
  return {
    isClean: found.length === 0,
    flaggedWords: found,
  };
};

const validateReview = (rating, comment) => {
  const errors = [];
  if (!rating || rating < 1 || rating > 5) errors.push('Rating must be between 1 and 5');
  if (!comment || typeof comment !== 'string') errors.push('Comment is required');
  else if (comment.trim().length < MIN_LENGTH) errors.push(`Comment must be at least ${MIN_LENGTH} characters`);
  else if (comment.trim().length > MAX_LENGTH) errors.push(`Comment must not exceed ${MAX_LENGTH} characters`);
  return errors;
};

// ─── GET /api/reviews/:bookId ─────────────────────────────────────────────────
router.get('/:bookId', async (req, res) => {
  const bookId = decodeURIComponent(req.params.bookId);

  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        id, rating, comment, is_spoiler, created_at, status,
        profiles ( id, username, avatar_url )
      `)
      .eq('book_id', bookId)
      .eq('status', 'approved')           // тільки схвалені відгуки
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Статистика
    const avg = data.length
      ? (data.reduce((s, r) => s + r.rating, 0) / data.length).toFixed(1)
      : null;

    res.json({ reviews: data, total: data.length, averageRating: avg ? Number(avg) : null });
  } catch (err) {
    console.error('[reviews/GET] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ─── POST /api/reviews ────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { bookId, rating, comment, isSpoiler = false } = req.body;
  const userId = req.profile.id;

  if (!bookId) return res.status(400).json({ error: 'bookId is required' });

  // Валідація
  const validationErrors = validateReview(rating, comment);
  if (validationErrors.length > 0) {
    return res.status(422).json({ error: 'Validation failed', details: validationErrors });
  }

  // Модерація тексту
  const { isClean, flaggedWords } = moderateText(comment);
  const status = isClean ? 'approved' : 'pending';

  try {
    // Перевірка на дублікат
    const { data: existing } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single();

    if (existing) {
      return res.status(409).json({
        error: 'You already have a review for this book. Use PUT to update it.',
        reviewId: existing.id,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        user_id: userId,
        book_id: bookId,
        rating: Number(rating),
        comment: comment.trim(),
        is_spoiler: Boolean(isSpoiler),
        status,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      review: data,
      moderation: {
        status,
        message: isClean
          ? 'Review published successfully'
          : `Review is pending moderation (flagged words: ${flaggedWords.join(', ')})`,
      },
    });
  } catch (err) {
    console.error('[reviews/POST] Error:', err.message);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ─── PUT /api/reviews/:reviewId ───────────────────────────────────────────────
router.put('/:reviewId', requireAuth, async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment, isSpoiler } = req.body;
  const userId = req.profile.id;

  const validationErrors = validateReview(rating, comment);
  if (validationErrors.length > 0) {
    return res.status(422).json({ error: 'Validation failed', details: validationErrors });
  }

  try {
    // Перевіряємо що відгук належить цьому користувачу
    const { data: existing } = await supabaseAdmin
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Review not found' });
    if (existing.user_id !== userId) return res.status(403).json({ error: 'Cannot edit another user\'s review' });

    const { isClean } = moderateText(comment);
    const status = isClean ? 'approved' : 'pending';

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({
        rating: Number(rating),
        comment: comment.trim(),
        is_spoiler: Boolean(isSpoiler),
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    res.json({ review: data, moderation: { status } });
  } catch (err) {
    console.error('[reviews/PUT] Error:', err.message);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// ─── DELETE /api/reviews/:reviewId ───────────────────────────────────────────
router.delete('/:reviewId', requireAuth, async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.profile.id;
  const userRole = req.profile.role;

  try {
    const { data: existing } = await supabaseAdmin
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Review not found' });

    // Власник або модератор/адмін можуть видаляти
    const canDelete = existing.user_id === userId ||
      ['moderator', 'admin'].includes(userRole);

    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this review' });

    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', reviewId);
    if (error) throw error;

    res.json({ success: true, deletedId: reviewId });
  } catch (err) {
    console.error('[reviews/DELETE] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;
