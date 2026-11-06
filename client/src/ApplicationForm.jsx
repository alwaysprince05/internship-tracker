import { useState } from 'react';
import { STATUSES, label } from './constants.js';

// Local date, not toISOString(), which is UTC and can be a day behind in India.
const today = () => new Date().toLocaleDateString('en-CA');
const empty = { company: '', role: '', status: 'applied', applied_on: today(), link: '', notes: '' };

export default function ApplicationForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...empty, ...initial, link: initial.link || '', notes: initial.notes || '' } : empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { company, role, status, applied_on, link, notes } = form;
    try {
      await onSave({ company, role, status, applied_on, link: link.trim() || null, notes: notes.trim() || null });
      if (!initial) setForm({ ...empty, applied_on: today() });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="app-form">
      <label>Company<input placeholder="Company" value={form.company} onChange={set('company')} required maxLength={120} /></label>
      <label>Role<input placeholder="Role" value={form.role} onChange={set('role')} required maxLength={120} /></label>
      <label>Status
        <select value={form.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </label>
      <label>Applied on<input type="date" value={form.applied_on} onChange={set('applied_on')} required /></label>
      <label className="wide">Job link<input placeholder="Job link (optional)" type="url" value={form.link} onChange={set('link')} /></label>
      <label className="wide">Notes<textarea placeholder="Notes (optional)" rows={3} value={form.notes} onChange={set('notes')} maxLength={2000} /></label>
      {error && <p className="error wide" role="alert">{error}</p>}
      <div className="actions wide">
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
        <button disabled={busy}>{initial ? 'Save' : 'Add application'}</button>
      </div>
    </form>
  );
}
