import { readdir } from 'node:fs/promises';
import { pool, migrate } from '../src/db.js';

afterAll(() => pool.end());

test('applies every migration file once and is safe to run again', async () => {
  await migrate();
  await migrate();
  const files = (await readdir(new URL('../migrations/', import.meta.url))).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  expect(rows.map((r) => r.version)).toEqual(files);
});

test('two servers starting at once do not run migrations twice', async () => {
  await Promise.all([migrate(), migrate(), migrate()]);
  const { rows } = await pool.query('SELECT count(*)::int AS n, count(DISTINCT version)::int AS d FROM schema_migrations');
  expect(rows[0].n).toBe(rows[0].d);
});
