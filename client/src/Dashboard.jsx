import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';
import ApplicationForm from './ApplicationForm.jsx';
import { STATUSES, label } from './constants.js';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [apps, setApps] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const query = filter ? `?status=${filter}` : '';
      const [list, s] = await Promise.all([api(`/api/applications${query}`), api('/api/applications/stats')]);
      setApps(list);
      setStats(s);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function create(data) {
    await api('/api/applications', { method: 'POST', body: data });
    load();
  }

  async function update(id, data) {
    await api(`/api/applications/${id}`, { method: 'PATCH', body: data });
    setEditing(null);
    load();
  }

  async function remove(app) {
    if (!confirm(`Delete ${app.company} – ${app.role}?`)) return;
    await api(`/api/applications/${app.id}`, { method: 'DELETE' });
    load();
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <main className="dashboard">
      <header>
        <h1>Internship Tracker</h1>
        <span>{user.email} <button className="secondary" onClick={logout}>Log out</button></span>
      </header>

      <section className="stats">
        <button className={!filter ? 'stat active' : 'stat'} onClick={() => setFilter('')}><b>{total}</b>all</button>
        {STATUSES.map((s) => (
          <button key={s} className={filter === s ? 'stat active' : 'stat'} onClick={() => setFilter(s)}><b>{stats[s] ?? 0}</b>{label(s)}</button>
        ))}
      </section>

      <ApplicationForm onSave={create} />
      {error && <p className="error">{error}</p>}

      <table>
        <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Applied</th><th>Notes</th><th></th></tr></thead>
        <tbody>
          {apps.map((app) => editing === app.id ? (
            <tr key={app.id}><td colSpan={6}><ApplicationForm initial={app} onSave={(d) => update(app.id, d)} onCancel={() => setEditing(null)} /></td></tr>
          ) : (
            <tr key={app.id}>
              <td>{app.link ? <a href={app.link} target="_blank" rel="noreferrer">{app.company}</a> : app.company}</td>
              <td>{app.role}</td>
              <td><span className={`badge ${app.status}`}>{label(app.status)}</span></td>
              <td>{app.applied_on}</td>
              <td className="notes">{app.notes}</td>
              <td className="row-actions">
                <button className="secondary" onClick={() => setEditing(app.id)}>Edit</button>
                <button className="danger" onClick={() => remove(app)}>Delete</button>
              </td>
            </tr>
          ))}
          {apps.length === 0 && <tr><td colSpan={6} className="empty">No applications yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
