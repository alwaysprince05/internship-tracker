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
  expect(screen.getByRole('button', { name: /^2\s*all$/ })).toBeInTheDocument();
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
