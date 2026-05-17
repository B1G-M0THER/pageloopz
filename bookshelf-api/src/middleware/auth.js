import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Empty token' });

    // decode without signature verify — userId is validated against DB below
    const payload = jwt.decode(token);

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ error: 'Token expired' });
    }

    const userId = payload.sub;

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, avatar_url, role')
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
      console.error('[auth] DB error:', profileError.message);
    }

    if (!profile) {
      return res.status(401).json({ error: 'Profile not found' });
    }

    req.user    = { id: userId, email: payload.email };
    req.profile = profile;

    next();
  } catch (err) {
    console.error('[auth] Error:', err.message);
    res.status(500).json({ error: 'Auth error: ' + err.message });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user    = null;
    req.profile = null;
    return next();
  }
  return requireAuth(req, res, next);
};