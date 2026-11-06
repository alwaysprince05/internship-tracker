import { vi } from 'vitest';

export const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

// routes: { 'GET /api/x': (req) => Response | Promise<Response> }
export function mockFetch(routes) {
  const fn = vi.fn(async (url, init = {}) => {
    const key = `${init.method || 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`unexpected request: ${key}`);
    return handler(init);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
