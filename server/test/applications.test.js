import { app, pool, request, resetDb, registerUser } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('create, list, update and delete an application', async () => {
  const { token } = await registerUser();
  const created = await request(app).post('/api/applications').set(auth(token))
    .send({ company: 'Acme', role: 'SWE Intern', link: 'https://acme.dev/jobs/1' });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ company: 'Acme', status: 'applied' });
  expect(created.body.applied_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const list = await request(app).get('/api/applications').set(auth(token));
  expect(list.body).toHaveLength(1);

  const updated = await request(app).patch(`/api/applications/${created.body.id}`).set(auth(token)).send({ status: 'interview', notes: 'round 1 on Friday' });
  expect(updated.status).toBe(200);
  expect(updated.body.status).toBe('interview');

  const del = await request(app).delete(`/api/applications/${created.body.id}`).set(auth(token));
  expect(del.status).toBe(204);
  const after = await request(app).get('/api/applications').set(auth(token));
  expect(after.body).toHaveLength(0);
});

test('users cannot see, edit or delete each other\'s applications', async () => {
  const alice = await registerUser('alice@example.com');
  const bob = await registerUser('bob@example.com');
  const { body: app1 } = await request(app).post('/api/applications').set(auth(alice.token)).send({ company: 'Acme', role: 'Intern' });

  const list = await request(app).get('/api/applications').set(auth(bob.token));
  expect(list.body).toHaveLength(0);
  const patch = await request(app).patch(`/api/applications/${app1.id}`).set(auth(bob.token)).send({ status: 'offer' });
  expect(patch.status).toBe(404);
  const del = await request(app).delete(`/api/applications/${app1.id}`).set(auth(bob.token));
  expect(del.status).toBe(404);

  const still = await request(app).get('/api/applications').set(auth(alice.token));
  expect(still.body[0].status).toBe('applied');
});

test('validates input', async () => {
  const { token } = await registerUser();
  const cases = [
    { role: 'Intern' },
    { company: 'Acme', role: 'Intern', status: 'hired' },
    { company: 'Acme', role: 'Intern', link: 'not a url' },
    { company: 'Acme', role: 'Intern', applied_on: '02/11/2026' },
  ];
  for (const body of cases) {
    const res = await request(app).post('/api/applications').set(auth(token)).send(body);
    expect(res.status).toBe(400);
  }
  const empty = await request(app).patch('/api/applications/1').set(auth(token)).send({});
  expect(empty.status).toBe(400);
});

test('ignores unknown fields instead of writing them', async () => {
  const { token, user } = await registerUser();
  const other = await registerUser('other@example.com');
  const res = await request(app).post('/api/applications').set(auth(token)).send({ company: 'Acme', role: 'Intern', user_id: other.user.id });
  expect(res.status).toBe(201);
  const { rows } = await pool.query('SELECT user_id FROM applications WHERE id = $1', [res.body.id]);
  expect(rows[0].user_id).toBe(user.id);
});

test('filters by status and reports stats', async () => {
  const { token } = await registerUser();
  for (const status of ['applied', 'applied', 'interview', 'rejected']) {
    await request(app).post('/api/applications').set(auth(token)).send({ company: 'C', role: 'R', status });
  }
  const filtered = await request(app).get('/api/applications?status=applied').set(auth(token));
  expect(filtered.body).toHaveLength(2);
  const bad = await request(app).get('/api/applications?status=nope').set(auth(token));
  expect(bad.status).toBe(400);
  const stats = await request(app).get('/api/applications/stats').set(auth(token));
  expect(stats.body).toMatchObject({ applied: 2, interview: 1, rejected: 1, offer: 0 });
});

test('returns 400 for malformed JSON and 404 for unknown routes', async () => {
  const { token } = await registerUser();
  const bad = await request(app).post('/api/applications').set(auth(token)).set('Content-Type', 'application/json').send('{"company":');
  expect(bad.status).toBe(400);
  const missing = await request(app).get('/api/nope');
  expect(missing.status).toBe(404);
});
