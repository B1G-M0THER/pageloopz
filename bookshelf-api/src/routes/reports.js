import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

const VALID_REASONS = ['spam', 'offensive', 'spoiler', 'false', 'other'];

// ─── POST /api/reports — надіслати скаргу ─────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
    const { reviewId, reason } = req.body;
    const reporterId = req.profile.id;

    if (!reviewId) return res.status(400).json({ error: 'reviewId is required' });
    if (!VALID_REASONS.includes(reason)) {
        return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
    }

    try {
        // Перевіряємо що відгук існує
        const { data: review } = await supabaseAdmin
            .from('reviews')
            .select('id, user_id')
            .eq('id', reviewId)
            .maybeSingle();

        if (!review) return res.status(404).json({ error: 'Review not found' });

        // Не можна скаржитись на власний відгук
        if (review.user_id === reporterId) {
            return res.status(400).json({ error: 'Cannot report your own review' });
        }

        const { error } = await supabaseAdmin
            .from('review_reports')
            .insert({ review_id: reviewId, reporter_id: reporterId, reason });

        if (error) {
            // Unique constraint — вже скаржились
            if (error.code === '23505') {
                return res.status(409).json({ error: 'You already reported this review' });
            }
            throw error;
        }

        res.status(201).json({ success: true, message: 'Report submitted successfully' });
    } catch (err) {
        console.error('[reports/POST]', err.message);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// ─── GET /api/reports/admin — всі скарги згруповані (адмін) ──────────────────
router.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        // Отримуємо всі скарги з даними відгуків
        const { data: reports, error } = await supabaseAdmin
            .from('review_reports')
            .select('review_id, reason, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Отримуємо унікальні review_id
        const reviewIds = [...new Set(reports.map(r => r.review_id))];

        if (reviewIds.length === 0) {
            return res.json({ reportedReviews: [] });
        }

        // Дані відгуків
        const { data: reviews } = await supabaseAdmin
            .from('reviews')
            .select('id, rating, comment, is_spoiler, status, user_id, book_id')
            .in('id', reviewIds);

        // Групуємо скарги по review_id
        const grouped = reviewIds.map(reviewId => {
            const reviewReports = reports.filter(r => r.review_id === reviewId);
            const review = reviews?.find(r => r.id === reviewId);

            // Підраховуємо причини
            const reasonCounts = {};
            reviewReports.forEach(r => {
                reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
            });

            return {
                reviewId,
                review,
                reportCount:  reviewReports.length,
                reasonCounts,
                latestReport: reviewReports[0]?.created_at,
            };
        }).sort((a, b) => b.reportCount - a.reportCount); // найбільше скарг — першими

        res.json({ reportedReviews: grouped, total: grouped.length });
    } catch (err) {
        console.error('[reports/admin GET]', err.message);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// ─── DELETE /api/reports/:reviewId/dismiss — відхилити скарги ────────────────
router.delete('/:reviewId/dismiss', requireAuth, requireRole('admin'), async (req, res) => {
    const { reviewId } = req.params;
    try {
        const { error } = await supabaseAdmin
            .from('review_reports')
            .delete()
            .eq('review_id', reviewId);

        if (error) throw error;
        res.json({ success: true, message: 'Reports dismissed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to dismiss reports' });
    }
});

// ─── DELETE /api/reports/:reviewId/remove-review — видалити відгук + скарги ──
router.delete('/:reviewId/remove-review', requireAuth, requireRole('admin'), async (req, res) => {
    const { reviewId } = req.params;
    try {
        // Cascade видалить і скарги автоматично (on delete cascade)
        const { error } = await supabaseAdmin
            .from('reviews')
            .delete()
            .eq('id', reviewId);

        if (error) throw error;
        res.json({ success: true, message: 'Review and reports deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

export default router;