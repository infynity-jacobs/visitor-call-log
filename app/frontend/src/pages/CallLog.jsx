import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const EMPTY_FORM = { name: '', place: '', phone: '', reason: '' };

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CallLog() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState([]);

  const loadRecent = useCallback(async () => {
    const data = await api.request('/calllog?mode=all&limit=8');
    setRecent(data.records);
  }, []);

  useEffect(() => { loadRecent().catch(() => {}); }, [loadRecent]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setIdempotencyKey(newIdempotencyKey());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const data = await api.request('/calllog', { method: 'POST', body: { ...form, idempotencyKey } });
      setMessage({
        type: 'success',
        text: data.duplicate ? 'This entry was already saved.' : 'Call log entry saved successfully.'
      });
      resetForm();
      loadRecent().catch(() => {});
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Call Log</h2>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor="name">Name *</label>
              <input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required autoFocus />
            </div>
            <div>
              <label htmlFor="place">Place</label>
              <input id="place" value={form.place} onChange={(e) => update('place', e.target.value)} />
            </div>
            <div>
              <label htmlFor="phone">Phone</label>
              <input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: '0.9rem' }}>
            <label htmlFor="reason">Reason *</label>
            <textarea id="reason" value={form.reason} onChange={(e) => update('reason', e.target.value)} required />
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="secondary" onClick={resetForm} disabled={submitting}>Clear</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent entries</h3>
        <table>
          <thead><tr><th>S.No.</th><th>Date</th><th>Time</th><th>Name</th><th>Place</th><th>Phone</th><th>Reason</th></tr></thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{String(r.call_date).slice(0, 10)}</td>
                <td>{String(r.call_time).slice(0, 8)}</td>
                <td>{r.name}</td>
                <td>{r.place}</td>
                <td>{r.phone}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={7} style={{ color: '#6b7280' }}>No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
