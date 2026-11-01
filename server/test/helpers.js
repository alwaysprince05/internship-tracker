import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool, migrate } from '../src/db.js';

export const app = createApp();

export async function resetDb() {
  await migrate();
  await pool.query('TRUNCATE users, refresh_tokens, applications RESTART IDENTITY CASCADE');
}

export async function registerUser(email = 'a@example.com', password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  return { token: res.body.accessToken, cookie: res.headers['set-cookie'], user: res.body.user };
}

export { pool, request };
