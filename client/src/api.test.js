import { beforeEach, describe, expect, test } from 'vitest';
import { api, setAccessToken } from './api.js';
import { json, mockFetch } from './test/fetch-mock.js';

beforeEach(() => setAccessToken('old'));

describe('api', () => {
  test('sends the access token and parses JSON', async () => {
    const fetch = mockFetch({ 'GET /api/applications': () => json(200, [{ id: 1 }]) });
    expect(await api('/api/applications')).toEqual([{ id: 1 }]);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer old');
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
  });

  test('on 401 it refreshes once and retries with the new token', async () => {
    let refreshes = 0;
    const fetch = mockFetch({
      'POST /api/auth/refresh': async () => {
        refreshes++;
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { accessToken: 'new', user: { id: 1 } });
      },
      'GET /api/applications': (init) => (init.headers.Authorization === 'Bearer new' ? json(200, []) : json(401, {})),
      'GET /api/applications/stats': (init) => (init.headers.Authorization === 'Bearer new' ? json(200, {}) : json(401, {})),
    });
    // Two calls fail at the same time; refresh tokens are single-use, so only one refresh may happen.
    await Promise.all([api('/api/applications'), api('/api/applications/stats')]);
    expect(refreshes).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  test('throws the server message, with validation details when present', async () => {
    mockFetch({
      'POST /api/applications': () => json(400, { error: 'validation failed', details: [{ path: 'link', message: 'Invalid URL' }] }),
      'DELETE /api/applications/9': () => json(404, { error: 'not found' }),
    });
    await expect(api('/api/applications', { method: 'POST', body: {} })).rejects.toThrow('link: Invalid URL');
    await expect(api('/api/applications/9', { method: 'DELETE' })).rejects.toThrow('not found');
  });

  test('does not try to refresh when an auth call itself returns 401', async () => {
    const fetch = mockFetch({ 'POST /api/auth/login': () => json(401, { error: 'invalid email or password' }) });
    await expect(api('/api/auth/login', { method: 'POST', body: {} })).rejects.toThrow('invalid email or password');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
