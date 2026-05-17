import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import booksRouter      from './src/routes/books.js';
import reviewsRouter    from './src/routes/reviews.js';
import customBooksRouter from './src/routes/customBooks.js';
import adminRouter      from './src/routes/admin.js';
import reportsRouter    from './src/routes/reports.js';
import translateRouter  from './src/routes/translate.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security ─────────────────────────────────────────────────────────────────

app.use(helmet());

const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// stricter limit for Open Library proxy
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Search rate limit exceeded. Please wait a moment.' },
});

app.use('/api', apiLimiter);
app.use('/api/books/search', searchLimiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/books',        booksRouter);
app.use('/api/reviews',      reviewsRouter);
app.use('/api/custom-books', customBooksRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/reports',      reportsRouter);
app.use('/api/translate',    translateRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Global Error]', err.message);

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Pageloopz API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
});