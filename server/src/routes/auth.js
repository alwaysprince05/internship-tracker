import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'password must be at least 8 characters').max(72),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'too many login attempts, try again later' },
});

const REFRESH_COOKIE = 'refresh_token';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function signAccess(userId) {
  return jwt.sign({ sub: String(userId) }, config.accessSecret, { expiresIn: config.accessTtl });
}

// Refresh tokens are random strings; only their hash is stored so a DB leak can't be replayed.
async function issueRefresh(res, userId) {
  const token = crypto.randomBytes(48).toString('base64url');
  const expires = new Date(Date.now() + config.refreshTtlDays * 24 * 60 * 60 * 1000);
  // Expired tokens (used or not) would otherwise stay in the table forever.
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < now()', [userId]);
  await pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, sha256(token), expires]);
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    // The client is served from the same site as the API, so the cookie never needs to go cross-site.
    sameSite: 'strict',
    path: '/api/auth',
    expires,
  });
}

router.post('/register', validate(credentials), async (req, res) => {
  const { email, password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, hash]);
    await issueRefresh(res, rows[0].id);
    res.status(201).json({ user: rows[0], accessToken: signAccess(rows[0].id) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email already registered' });
    }
    throw err;
  }
});

router.post('/login', loginLimiter, validate(credentials), async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
  const user = rows[0];
  // Same message for unknown email and wrong password so emails can't be enumerated.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  await issueRefresh(res, user.id);
  res.json({ user: { id: user.id, email: user.email }, accessToken: signAccess(user.id) });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'no refresh token' });
  }
  const hash = sha256(token);
  // Rotate: mark the token as used. Only one request can win this UPDATE.
  const rotated = await pool.query(
    'UPDATE refresh_tokens SET rotated_at = now() WHERE token_hash = $1 AND rotated_at IS NULL AND expires_at > now() RETURNING user_id',
    [hash],
  );
  let userId = rotated.rows[0]?.user_id;

  if (!userId) {
    const { rows } = await pool.query(
      `SELECT user_id, expires_at > now() AS live, rotated_at > now() - make_interval(secs => $2) AS in_grace
       FROM refresh_tokens WHERE token_hash = $1`,
      [hash, config.refreshReuseGraceSeconds],
    );
    const old = rows[0];
    if (old?.live && old.in_grace) {
      // Rotated a moment ago by a parallel request (another tab, a double reload): not an attack.
      userId = old.user_id;
    } else {
      if (old?.live) {
        // Used again long after rotation: someone else may have a copy. End every session of this user.
        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [old.user_id]);
      }
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      return res.status(401).json({ error: 'refresh token invalid or expired' });
    }
  }

  const user = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
  await issueRefresh(res, userId);
  res.json({ user: user.rows[0], accessToken: signAccess(userId) });
});

router.post('/logout', async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE];
  if (token) {
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [sha256(token)]);
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
});

export default router;
