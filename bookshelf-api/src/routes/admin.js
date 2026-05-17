import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// Всі маршрути потребують авторизації та ролі admin
router.use(requireAuth, requireRole('admin'));

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, books, reviews, pending, customBooks] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('books').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('reviews').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('custom_books').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    res.json({
      stats: {
        totalUsers:          users.count    ?? 0,
        totalBooks:          books.count    ?? 0,
        totalReviews:        reviews.count  ?? 0,
        pendingReviews:      pending.count  ?? 0,
        pendingCustomBooks:  customBooks.count ?? 0,
      },
    });
  } catch (err) {
    console.error('[admin/stats] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── GET /api/admin/users — всі користувачі ───────────────────────────────────
router.get('/users', async (req, res) => {
  const { page = 1, limit = 50, role } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  try {
    let query = supabaseAdmin
        .from('profiles')
        .select('id, username, avatar_url, role, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

    if (role) query = query.eq('role', role);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ users: data, total: count, page: Number(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── PATCH /api/admin/users/:userId/role — змінити роль ──────────────────────
router.patch('/users/:userId/role', async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  const adminId = req.profile.id;

  const validRoles = ['user', 'moderator', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  // Адмін не може змінити власну роль
  if (userId === adminId) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  try {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select('id, username, role')
        .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });

    res.json({ user: data, message: `Role updated to "${role}"` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ─── GET /api/admin/reviews/pending — відгуки на модерацію ───────────────────
router.get('/reviews/pending', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('id, rating, comment, is_spoiler, created_at, status, user_id, book_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ reviews: data, total: data.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending reviews' });
  }
});

// ─── PATCH /api/admin/reviews/:reviewId/approve ───────────────────────────────
router.patch('/reviews/:reviewId/approve', async (req, res) => {
  const { reviewId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
        .from('reviews')
        .update({ status: 'approved' })
        .eq('id', reviewId)
        .select()
        .single();

    if (error) throw error;
    res.json({ review: data, message: 'Review approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve review' });
  }
});

// ─── PATCH /api/admin/reviews/:reviewId/reject ────────────────────────────────
router.patch('/reviews/:reviewId/reject', async (req, res) => {
  const { reviewId } = req.params;
  const { reason } = req.body;

  try {
    const { data, error } = await supabaseAdmin
        .from('reviews')
        .update({ status: 'rejected', rejection_reason: reason || null })
        .eq('id', reviewId)
        .select()
        .single();

    if (error) throw error;
    res.json({ review: data, message: 'Review rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject review' });
  }
});

// ─── DELETE /api/admin/reviews/:reviewId ─────────────────────────────────────
router.delete('/reviews/:reviewId', async (req, res) => {
  const { reviewId } = req.params;

  try {
    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', reviewId);
    if (error) throw error;
    res.json({ success: true, deletedId: reviewId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;