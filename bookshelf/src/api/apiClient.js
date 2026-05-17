import axios from 'axios';
import { supabase } from '../lib/supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let currentToken = null;

supabase.auth.getSession().then(({ data: { session } }) => {
    currentToken = session?.access_token ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
    currentToken = session?.access_token ?? null;
});

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res.data,
    (err) => {
        const message = err.response?.data?.error || err.message || 'Unknown error';
        const status  = err.response?.status;
        const error   = new Error(message);
        error.status  = status;
        error.details = err.response?.data?.details;
        throw error;
    }
);

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const getBookReviews    = (bookId)                       => api.get(`/api/reviews/${encodeURIComponent(bookId)}`);
export const createReview      = ({ bookId, rating, comment, isSpoiler }) => api.post('/api/reviews', { bookId, rating, comment, isSpoiler });
export const updateReview      = (reviewId, { rating, comment, isSpoiler }) => api.put(`/api/reviews/${reviewId}`, { rating, comment, isSpoiler });
export const deleteReview      = (reviewId)                     => api.delete(`/api/reviews/${reviewId}`);

// ─── Custom Books ─────────────────────────────────────────────────────────────
export const getCustomBooks        = (page = 1)    => api.get('/api/custom-books', { params: { page } });
export const searchCustomBooks     = (q)           => api.get('/api/custom-books/search', { params: { q } });
export const submitCustomBook      = (bookData)    => api.post('/api/custom-books', bookData);
export const getMySubmissions      = (status)      => api.get('/api/custom-books/my', { params: status ? { status } : {} });
export const getPendingCustomBooks = ()            => api.get('/api/custom-books/pending');
export const approveCustomBook     = (id)          => api.patch(`/api/custom-books/${id}/approve`);
export const rejectCustomBook      = (id, reason)  => api.patch(`/api/custom-books/${id}/reject`, { reason });

// ─── Admin ────────────────────────────────────────────────────────────────────
export const getAdminStats     = ()               => api.get('/api/admin/stats');
export const getAdminUsers     = (page = 1, role) => api.get('/api/admin/users', { params: { page, role } });
export const updateUserRole    = (userId, role)   => api.patch(`/api/admin/users/${userId}/role`, { role });
export const getPendingReviews = ()               => api.get('/api/admin/reviews/pending');
export const approveReview     = (reviewId)       => api.patch(`/api/admin/reviews/${reviewId}/approve`);
export const rejectReview      = (reviewId)       => api.patch(`/api/admin/reviews/${reviewId}/reject`);
export const adminDeleteReview = (reviewId)       => api.delete(`/api/admin/reviews/${reviewId}`);

// ─── Translate ────────────────────────────────────────────────────────────────
export const translateText = (bookId, text, targetLang) =>
  api.post('/api/translate', { bookId, text, targetLang });

// ─── Reports ──────────────────────────────────────────────────────────────────
export const submitReport      = (reviewId, reason) => api.post('/api/reports', { reviewId, reason });
export const getAdminReports   = ()                 => api.get('/api/reports/admin');
export const dismissReports    = (reviewId)         => api.delete(`/api/reports/${reviewId}/dismiss`);
export const removeReportedReview = (reviewId)      => api.delete(`/api/reports/${reviewId}/remove-review`);