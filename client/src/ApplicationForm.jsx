import { useState } from 'react';

import { STATUSES, label } from './constants.js';
// Local date, not toISOString(), which is UTC and can be a day behind in India.
const today = () => new Date().toLocaleDateString('en-CA');
const empty = { company: '', role: '', status: 'applied', applied_on: today(), link: '', notes: '' };

export default function ApplicationForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...empty, ...initial, link: initial.link || '', notes: initial.notes || '' } : empty);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const { company, role, status, applied_on, link, notes } = form;
    try {
      await onSave({ company, role, status, applied_on, link: link.trim() || null, notes: notes.trim() || null });
      if (!initial) setForm({ ...empty, applied_on: today() });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid-form">
      <input placeholder="Company" value={form.company} onChange={set('company')} required />
      <input placeholder="Role" value={form.role} onChange={set('role')} required />
      <select value={form.status} onChange={set('status')}>
        {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </select>
      <input type="date" value={form.applied_on} onChange={set('applied_on')} required />
      <input placeholder="Job link (optional)" type="url" value={form.link} onChange={set('link')} />
      <input placeholder="Notes (optional)" value={form.notes} onChange={set('notes')} />
      <div className="actions">
        <button>{initial ? 'Save' : 'Add application'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
