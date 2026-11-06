import jwt from 'jsonwebtoken';
import { app, pool, request, resetDb, registerUser } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

describe('register', () => {
  test('creates a user, returns an access token and sets an httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'New@Example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers['set-cookie'][0]).toMatch(/refresh_token=.*HttpOnly/);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect(res.headers['set-cookie'][0]).toMatch(/Path=\/api\/auth/);
  });

  test('stores a bcrypt hash, not the password', async () => {
    await registerUser('a@example.com', 'password123');
    const { rows } = await pool.query('SELECT password_hash FROM users');
    expect(rows[0].password_hash).not.toContain('password123');
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
  });

  test('rejects duplicate email with 409', async () => {
    await registerUser();
    const res = await request(app).post('/api/auth/register').send({ email: 'a@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('rejects short password and bad email with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.path).sort()).toEqual(['email', 'password']);
  });
});

describe('login', () => {
  test('works with correct credentials', async () => {
    await registerUser();
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test('gives the same 401 for wrong password and unknown email', async () => {
    await registerUser();
    const wrong = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'wrongpass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
});

describe('protected routes', () => {
  test('reject missing token', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  test('reject expired token', async () => {
    const { user } = await registerUser();
    const expired = jwt.sign({ sub: String(user.id) }, process.env.JWT_ACCESS_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/applications').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('reject token signed with another secret', async () => {
    const { user } = await registerUser();
    const forged = jwt.sign({ sub: String(user.id) }, 'not-the-secret');
    const res = await request(app).get('/api/applications').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('refresh and logout', () => {
  test('refresh issues a new access token and rotates the cookie', async () => {
    const { cookie } = await registerUser();
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers['set-cookie'][0]).not.toBe(cookie[0]);
  });

  test('two requests refreshing with the same token at once both succeed', async () => {
    // Two tabs, or a quick double reload: neither may log the user out.
    const { cookie } = await registerUser();
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', cookie),
      request(app).post('/api/auth/refresh').set('Cookie', cookie),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    for (const res of [a, b]) {
      const next = await request(app).post('/api/auth/refresh').set('Cookie', res.headers['set-cookie']);
      expect(next.status).toBe(200);
    }
  });

  test('reusing a rotated token after the grace period logs out every session', async () => {
    const { cookie, user } = await registerUser();
    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    await pool.query("UPDATE refresh_tokens SET rotated_at = now() - interval '1 hour' WHERE rotated_at IS NOT NULL");

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(reuse.status).toBe(401);
    expect(reuse.headers['set-cookie'][0]).toMatch(/refresh_token=;/);
    // The legitimate newer token is revoked too, since we can't tell who is who.
    const newer = await request(app).post('/api/auth/refresh').set('Cookie', first.headers['set-cookie']);
    expect(newer.status).toBe(401);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM refresh_tokens WHERE user_id = $1', [user.id]);
    expect(rows[0].n).toBe(0);
  });

  test('an unknown or expired refresh token is rejected', async () => {
    const unknown = await request(app).post('/api/auth/refresh').set('Cookie', 'refresh_token=nope');
    expect(unknown.status).toBe(401);
    const { cookie } = await registerUser();
    await pool.query("UPDATE refresh_tokens SET expires_at = now() - interval '1 minute'");
    const expired = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(expired.status).toBe(401);
  });

  test('login deletes the user\'s expired refresh tokens', async () => {
    const { user } = await registerUser();
    await pool.query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'old', now() - interval '1 day')", [user.id]);
    await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'password123' });
    const { rows } = await pool.query('SELECT token_hash FROM refresh_tokens WHERE user_id = $1', [user.id]);
    expect(rows.map((r) => r.token_hash)).not.toContain('old');
    expect(rows).toHaveLength(2);
  });

  test('logout revokes the refresh token', async () => {
    const { cookie } = await registerUser();
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});
