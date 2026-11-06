import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

let dir;
let app;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'tracker-static-'));
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><title>Internship Tracker</title>');
  await writeFile(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
  app = createApp({ staticDir: dir });
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  await pool.end();
});

test('serves the app at / and for client-side routes like /login', async () => {
  for (const url of ['/', '/login']) {
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Internship Tracker</title>');
    expect(res.headers['cache-control']).toBe('no-cache');
  }
});

test('serves hashed assets with a long cache lifetime', async () => {
  const res = await request(app).get('/assets/index-abc123.js');
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toContain('immutable');
});

test('unknown API routes still get a JSON 404, not the app', async () => {
  const res = await request(app).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'not found' });
});

test('without a static dir only the API is served', async () => {
  const res = await request(createApp({ staticDir: null })).get('/login');
  expect(res.status).toBe(404);
});
