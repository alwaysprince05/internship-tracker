import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth-context.js';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(mode, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-intro">
        <div className="brand"><img src="/favicon.svg" alt="" width="28" height="28" />Internship Tracker</div>
        <h1>Keep every application in one place.</h1>
        <ul>
          <li>Track each company from wishlist to offer</li>
          <li>See how many are at each stage at a glance</li>
          <li>Keep links and notes next to each application</li>
        </ul>
      </section>

      <form onSubmit={onSubmit} className="card auth-form">
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'register' && <p className="muted small-text">At least 8 characters.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  );
}
