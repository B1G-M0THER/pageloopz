import { Router } from 'express';
import axios from 'axios';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';

const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many translation requests. Please wait a moment.' },
});

router.post('/', translateLimiter, async (req, res) => {
  try {
    const { bookId, text, targetLang } = req.body;

    if (!bookId || !text || !targetLang) {
      return res.status(400).json({ error: 'bookId, text, and targetLang are required' });
    }
    if (typeof text !== 'string' || text.length > 5000) {
      return res.status(400).json({ error: 'text must be a string up to 5000 characters' });
    }

    const lang = String(targetLang).toUpperCase();

    // 1. Check Supabase cache
    try {
      const { data: cached } = await supabaseAdmin
        .from('book_translations')
        .select('translated_text')
        .eq('book_id', bookId)
        .eq('target_lang', lang)
        .eq('field', 'description')
        .maybeSingle();

      if (cached) {
        return res.json({ translatedText: cached.translated_text, cached: true });
      }
    } catch (cacheErr) {
      console.warn('[translate] cache read failed:', cacheErr.message);
      // proceed without cache
    }

    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Translation service not configured' });
    }

    // 2. Call DeepL
    let deeplData;
    try {
      const response = await axios.post(
        DEEPL_URL,
        { text: [text], target_lang: lang },
        {
          headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      deeplData = response.data;
    } catch (err) {
      const status = err.response?.status;
      const body   = err.response?.data;
      console.error('[translate] DeepL error:', status, JSON.stringify(body), err.message);

      if (status === 403) return res.status(503).json({ error: 'Invalid DeepL API key' });
      if (status === 429) return res.status(429).json({ error: 'DeepL rate limit reached. Try again shortly.' });
      if (status === 456) return res.status(503).json({ error: 'DeepL translation quota exceeded for this month' });
      if (status === 400) return res.status(400).json({ error: `DeepL rejected the request: ${body?.message || 'bad request'}` });

      return res.status(502).json({
        error: 'Translation service temporarily unavailable',
        detail: err.message,
      });
    }

    const translatedText = deeplData?.translations?.[0]?.text;
    if (!translatedText) {
      return res.status(502).json({ error: 'Unexpected response from translation service' });
    }

    // 3. Cache in Supabase (fire-and-forget)
    supabaseAdmin
      .from('book_translations')
      .upsert({
        book_id:         bookId,
        target_lang:     lang,
        field:           'description',
        original_text:   text,
        translated_text: translatedText,
      })
      .then(({ error }) => { if (error) console.warn('[translate] cache write:', error.message); });

    return res.json({ translatedText, cached: false });
  } catch (err) {
    console.error('[translate] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
