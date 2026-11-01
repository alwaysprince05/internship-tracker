import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);

export const STATUSES = ['wishlist', 'applied', 'oa', 'interview', 'offer', 'rejected', 'ghosted'];

const base = {
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  status: z.enum(STATUSES),
  applied_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD'),
  link: z.string().trim().url().max(500).nullable(),
  notes: z.string().max(2000).nullable(),
};
const createSchema = z.object({ ...base, status: base.status.default('applied'), applied_on: base.applied_on.optional(), link: base.link.optional(), notes: base.notes.optional() });
const updateSchema = z.object(base).partial().refine((o) => Object.keys(o).length > 0, 'nothing to update');

const COLUMNS = 'id, company, role, status, to_char(applied_on, \'YYYY-MM-DD\') AS applied_on, link, notes, created_at, updated_at';

router.get('/', async (req, res) => {
  const params = [req.userId];
  let where = 'user_id = $1';
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) {
      return res.status(400).json({ error: 'unknown status' });
    }
    params.push(req.query.status);
    where += ` AND status = $${params.length}`;
  }
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM applications WHERE ${where} ORDER BY applied_on DESC, id DESC`, params);
  res.json(rows);
});

router.get('/stats', async (req, res) => {
  const { rows } = await pool.query('SELECT status, count(*)::int AS count FROM applications WHERE user_id = $1 GROUP BY status', [req.userId]);
  const stats = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) stats[r.status] = r.count;
  res.json(stats);
});

router.post('/', validate(createSchema), async (req, res) => {
  const { company, role, status, applied_on, link, notes } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO applications (user_id, company, role, status, applied_on, link, notes)
     VALUES ($1, $2, $3, $4, COALESCE($5::date, (now() AT TIME ZONE $8)::date), $6, $7) RETURNING ${COLUMNS}`,
    [req.userId, company, role, status, applied_on ?? null, link ?? null, notes ?? null, config.timezone],
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });
  const fields = Object.keys(req.body);
  // Field names come from the zod schema, never from raw user input.
  const sets = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE applications SET ${sets}, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING ${COLUMNS}`,
    [id, req.userId, ...fields.map((f) => req.body[f])],
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'not found' });
  const { rowCount } = await pool.query('DELETE FROM applications WHERE id = $1 AND user_id = $2', [id, req.userId]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

export default router;
