import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth-context.js';
import ApplicationForm from './ApplicationForm.jsx';
import Modal from './Modal.jsx';
import { ACTIVE, STATUSES, label } from './constants.js';
import { daysAgo, formatDate } from './dates.js';

const SORTS = {
  newest: (a, b) => b.applied_on.localeCompare(a.applied_on) || b.id - a.id,
  oldest: (a, b) => a.applied_on.localeCompare(b.applied_on) || a.id - b.id,
  company: (a, b) => a.company.localeCompare(b.company),
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [apps, setApps] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [modal, setModal] = useState(null); // null | 'new' | application being edited
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  // Bumped after every change so the list and counts are fetched again.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    // If the filter changes while a request is in flight, the older response
    // must not overwrite the newer one.
    let stale = false;
    const query = filter ? `?status=${filter}` : '';
    Promise.all([api(`/api/applications${query}`), api('/api/applications/stats')])
      .then(([list, s]) => {
        if (stale) return;
        setApps(list);
        setStats(s);
        setError('');
        setLoaded(true);
      })
      .catch((err) => { if (!stale) setError(err.message); });
    return () => { stale = true; };
  }, [filter, version]);

  async function create(data) {
    await api('/api/applications', { method: 'POST', body: data });
    setModal(null);
    reload();
  }

  async function update(id, data) {
    await api(`/api/applications/${id}`, { method: 'PATCH', body: data });
    setModal(null);
    reload();
  }

  async function changeStatus(app, status) {
    try {
      await api(`/api/applications/${app.id}`, { method: 'PATCH', body: { status } });
      reload();
    } catch (err) {
      setError(`Could not update ${app.company}: ${err.message}`);
    }
  }

  async function remove(app) {
    if (!confirm(`Delete ${app.company} – ${app.role}?`)) return;
    try {
      await api(`/api/applications/${app.id}`, { method: 'DELETE' });
    } catch (err) {
      setError(`Could not delete: ${err.message}`);
      return;
    }
    reload();
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const active = ACTIVE.reduce((n, s) => n + (stats[s] ?? 0), 0);
  const q = search.trim().toLowerCase();
  const shown = apps
    .filter((a) => !q || a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q))
    .sort(SORTS[sort]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand"><img src="/favicon.svg" alt="" width="24" height="24" />Internship Tracker</div>
        <div className="account">
          <span className="email">{user.email}</span>
          <button className="secondary small" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="dashboard">
        <div className="page-head">
          <div>
            <h1>Applications</h1>
            <p className="muted">{total} total · {active} in progress · {stats.offer ?? 0} {stats.offer === 1 ? 'offer' : 'offers'}</p>
          </div>
          <button onClick={() => setModal('new')}>+ Add application</button>
        </div>

        <nav className="stats" aria-label="Filter by status">
          <button className={!filter ? 'stat active' : 'stat'} aria-pressed={!filter} onClick={() => setFilter('')}>
            <b>{total}</b><span>All</span>
          </button>
          {STATUSES.map((s) => (
            <button key={s} className={`stat s-${s}${filter === s ? ' active' : ''}`} aria-pressed={filter === s} onClick={() => setFilter(s)}>
              <b>{stats[s] ?? 0}</b><span>{label(s)}</span>
            </button>
          ))}
        </nav>

        <div className="toolbar">
          <input type="search" placeholder="Search company or role" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="company">Company A–Z</option>
          </select>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        {loaded && shown.length === 0 ? (
          <div className="empty card">
            {total === 0 ? (
              <>
                <h2>No applications yet</h2>
                <p className="muted">Add the first place you applied to and track it from wishlist to offer.</p>
                <button onClick={() => setModal('new')}>+ Add application</button>
              </>
            ) : (
              <p className="muted">Nothing matches {q ? `"${search.trim()}"` : 'this filter'}.</p>
            )}
          </div>
        ) : (
          <table className="apps">
            <thead>
              <tr><th>Company</th><th>Status</th><th>Applied</th><th>Notes</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {shown.map((app) => (
                <tr key={app.id}>
                  <td data-label="Company">
                    <div className="company">
                      {app.link ? <a href={app.link} target="_blank" rel="noreferrer">{app.company}</a> : app.company}
                    </div>
                    <div className="muted">{app.role}</div>
                  </td>
                  <td data-label="Status">
                    <select
                      className={`status s-${app.status}`}
                      aria-label={`Status for ${app.company}`}
                      value={app.status}
                      onChange={(e) => changeStatus(app, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </td>
                  <td data-label="Applied">
                    <div>{formatDate(app.applied_on)}</div>
                    <div className="muted small-text">{daysAgo(app.applied_on)}</div>
                  </td>
                  <td data-label="Notes" className="notes">{app.notes}</td>
                  <td className="row-actions">
                    <button className="ghost small" onClick={() => setModal(app)}>Edit</button>
                    <button className="ghost small danger" onClick={() => remove(app)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {modal && (
        <Modal title={modal === 'new' ? 'Add application' : `Edit ${modal.company}`} onClose={() => setModal(null)}>
          <ApplicationForm
            initial={modal === 'new' ? undefined : modal}
            onSave={modal === 'new' ? create : (d) => update(modal.id, d)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
