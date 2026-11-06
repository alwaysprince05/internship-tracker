import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import Dashboard from './Dashboard.jsx';
import { AuthContext } from './auth-context.js';
import { json, mockFetch } from './test/fetch-mock.js';

const acme = { id: 1, company: 'Acme', role: 'Intern', status: 'applied', applied_on: '2026-11-01', link: null, notes: null };
const globex = { id: 2, company: 'Globex', role: 'SWE', status: 'oa', applied_on: '2026-11-02', link: null, notes: null };
const stats = { wishlist: 0, applied: 1, oa: 1, interview: 0, offer: 0, rejected: 0, ghosted: 0 };

function renderDashboard() {
  return render(
    <AuthContext.Provider value={{ user: { email: 'a@example.com' }, logout: vi.fn() }}>
      <Dashboard />
    </AuthContext.Provider>,
  );
}

test('lists applications and shows counts', async () => {
  mockFetch({
    'GET /api/applications': () => json(200, [globex, acme]),
    'GET /api/applications/stats': () => json(200, stats),
  });
  renderDashboard();
  expect(await screen.findByText('Globex')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2All' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/2 total · 2 in progress · 0 offers/)).toBeInTheDocument();
});

test('search narrows the list by company or role', async () => {
  mockFetch({
    'GET /api/applications': () => json(200, [globex, acme]),
    'GET /api/applications/stats': () => json(200, stats),
  });
  renderDashboard();
  await screen.findByText('Globex');
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'swe');
  expect(screen.getByText('Globex')).toBeInTheDocument();
  expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  await userEvent.clear(screen.getByRole('searchbox', { name: 'Search' }));
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'nothing');
  expect(screen.getByText('Nothing matches "nothing".')).toBeInTheDocument();
});

test('changing the status in the table saves it', async () => {
  let patched;
  mockFetch({
    'GET /api/applications': () => json(200, [acme]),
    'GET /api/applications/stats': () => json(200, stats),
    'PATCH /api/applications/1': (init) => { patched = JSON.parse(init.body); return json(200, { ...acme, ...patched }); },
  });
  renderDashboard();
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Status for Acme' }), 'interview');
  expect(patched).toEqual({ status: 'interview' });
});

test('adds an application from the dialog and closes it', async () => {
  let created;
  mockFetch({
    'GET /api/applications': () => json(200, []),
    'GET /api/applications/stats': () => json(200, { ...stats, applied: 0, oa: 0 }),
    'POST /api/applications': (init) => { created = JSON.parse(init.body); return json(201, { id: 3, ...created }); },
  });
  renderDashboard();
  expect(await screen.findByText('No applications yet')).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: '+ Add application' })[0]);
  const dialog = screen.getByRole('dialog', { name: 'Add application' });
  await userEvent.type(within(dialog).getByLabelText('Company'), 'Initech');
  await userEvent.type(within(dialog).getByLabelText('Role'), 'Backend Intern');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add application' }));
  expect(created).toMatchObject({ company: 'Initech', role: 'Backend Intern', status: 'applied' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('Escape closes the dialog', async () => {
  mockFetch({
    'GET /api/applications': () => json(200, [acme]),
    'GET /api/applications/stats': () => json(200, stats),
  });
  renderDashboard();
  const row = (await screen.findByText('Acme')).closest('tr');
  await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  expect(screen.getByRole('dialog', { name: 'Edit Acme' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a slow response for an old filter does not replace the current one', async () => {
  let releaseAll;
  mockFetch({
    'GET /api/applications': () => new Promise((r) => { releaseAll = () => r(json(200, [globex, acme])); }),
    'GET /api/applications?status=oa': () => json(200, [globex]),
    'GET /api/applications/stats': () => json(200, stats),
  });
  renderDashboard();
  await userEvent.click(await screen.findByRole('button', { name: /OA$/ }));
  expect(await screen.findByText('Globex')).toBeInTheDocument();
  releaseAll();
  await new Promise((r) => setTimeout(r, 20));
  expect(screen.queryByText('Acme')).not.toBeInTheDocument();
});

test('shows an error when delete fails', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mockFetch({
    'GET /api/applications': () => json(200, [acme]),
    'GET /api/applications/stats': () => json(200, stats),
    'DELETE /api/applications/1': () => json(500, { error: 'internal server error' }),
  });
  renderDashboard();
  const row = (await screen.findByText('Acme')).closest('tr');
  await userEvent.click(within(row).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('Could not delete: internal server error')).toBeInTheDocument();
});
