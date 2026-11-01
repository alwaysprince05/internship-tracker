const BASE = import.meta.env.VITE_API_URL || '';

// Access token lives only in memory; the refresh token is an httpOnly cookie JS can't read.
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };

async function raw(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(BASE + path, { ...options, headers, credentials: 'include' });
}

// Refresh tokens are single-use, so parallel callers must share one in-flight refresh.
let pendingRefresh = null;

export function refresh() {
  pendingRefresh ??= (async () => {
    const res = await raw('/api/auth/refresh', { method: 'POST' });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    return data.user;
  })().finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

export async function api(path, { body, ...options } = {}) {
  const init = { ...options, body: body === undefined ? undefined : JSON.stringify(body) };
  let res = await raw(path, init);
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    if (await refresh()) res = await raw(path, init);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.details?.map((d) => `${d.path}: ${d.message}`).join(', ');
    throw new Error(detail || data.error || `request failed (${res.status})`);
  }
  return data;
}
