import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing access token' });
  }
  try {
    const payload = jwt.verify(token, config.accessSecret);
    req.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired access token' });
  }
}
