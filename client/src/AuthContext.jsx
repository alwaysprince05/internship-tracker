import { createContext, useContext, useEffect, useState } from 'react';
import { api, refresh, setAccessToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load, try the refresh cookie so a reload doesn't log you out.
  useEffect(() => {
    refresh().then(setUser).finally(() => setLoading(false));
  }, []);

  async function login(mode, email, password) {
    const data = await api(`/api/auth/${mode}`, { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
