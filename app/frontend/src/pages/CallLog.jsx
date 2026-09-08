import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useSearchParams } from 'react-router-dom';
import { formatIstDateTime, currentIstDateTimeInput, istDateTimeInputToUtcParts } from '../utils/timezone';
import { useAuth } from '../context/AuthContext.jsx';
import { GlobalSearch } from '../components/GlobalSearch.jsx';

function createEmptyForm() {
  return { name: '', place: '', phone: '', reason: '', callDateTime: currentIstDateTimeInput() };
}

function newIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function CallLog() {
  const { isSuperAdmin } = useAuth();
  const [form, setForm] = useState(createEmptyForm);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadRecent = useCallback(async (filter = { mode: 'all' }) => {
    const params = new URLSearchParams({ ...filter, limit: '500', offset: '0' });
    const data = await api.request(`/calllog?${params.toString()}`);
    setRecent(data.records);
  }, []);

  useEffect(() => { loadRecent().catch(() => {}); }, [loadRecent]);

  useEffect(() => {
    const id = searchParams.get('record');
    if (!id) { setSelectedRecord(null); return; }
    api.request(`/calllog/${id}`).then((data) => setSelectedRecord(data.record)).catch((err) => setMessage({ type: 'error', text: err.message }));
  }, [searchParams]);

  async function deleteRecord(id) {
    if (!window.confirm('Permanently delete this record? This cannot be undone.')) return;
    try { await api.request(`${'/calllog'}/${id}`, { method: 'DELETE' }); await loadRecent(); if (selectedRecord?.id === id) closeSelected(); setMessage({ type: 'success', text: 'Record permanently deleted.' }); } catch (err) { setMessage({ type: 'error', text: err.message }); }
  }

  function closeSelected() { setSelectedRecord(null); setSearchParams({}); }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function resetForm() {
    setForm(createEmptyForm());
    setIdempotencyKey(newIdempotencyKey());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const { date: callDate, time: callTime } = istDateTimeInputToUtcParts(form.callDateTime);
      const data = await api.request('/calllog', { method: 'POST', body: { ...form, callDate, callTime, idempotencyKey } });
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
      <h2>CALL LOG</h2>
      <GlobalSearch />
      {selectedRecord && (
        <div className="card selected-record">
          <div className="section-heading"><h3 style={{ margin: 0 }}>Call Log Record #{selectedRecord.id}</h3><button className="secondary" onClick={closeSelected}>Close</button></div>
          <div className="record-grid">
            <div><strong>Date &amp; Time (IST)</strong><span>{formatIstDateTime(selectedRecord.call_date, selectedRecord.call_time)}</span></div>
            <div><strong>Name</strong><span>{selectedRecord.name}</span></div>
            <div><strong>Place</strong><span>{selectedRecord.place || '—'}</span></div>
            <div><strong>Phone</strong><span>{selectedRecord.phone || '—'}</span></div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Reason</strong><span>{selectedRecord.reason}</span></div>
          </div>
        </div>
      )}
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor="callDateTime">Entry Date &amp; Time (IST) *</label>
              <input
                id="callDateTime"
                type="datetime-local"
                value={form.callDateTime}
                onChange={(e) => update('callDateTime', e.target.value)}
                step="1"
                required
              />
              <small className="field-help">Use this to enter the actual call date/time when recording the entry later.</small>
            </div>
            <div>
              <label htmlFor="name">Name *</label>
              <input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required autoFocus />
            </div>
            <div>
              <label htmlFor="place">Place *</label>
              <input id="place" value={form.place} onChange={(e) => update('place', e.target.value)} required />
            </div>
            <div>
              <label htmlFor="phone">Phone *</label>
              <input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} required pattern="[+()\- \d]{6,20}" title="Enter a valid phone number." />
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
        <div className="section-heading"><h3 style={{ marginTop: 0, marginBottom: 0 }}>Recent entries</h3><span className="muted">{recent.length} record{recent.length === 1 ? '' : 's'}</span></div>
        <table className="mobile-cards">
          <thead><tr><th>S.No.</th><th>Date</th><th>Time</th><th>Name</th><th>Place</th><th>Phone</th><th>Reason</th>{isSuperAdmin && <th>Actions</th>}</tr></thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id}>
                <td data-label="S.No.">{r.id}</td>
                <td data-label="Date">{formatIstDateTime(r.call_date, r.call_time).slice(0, 10)}</td>
                <td data-label="Time">{formatIstDateTime(r.call_date, r.call_time).slice(-8)}</td>
                <td data-label="Name">{r.name}</td>
                <td data-label="Place">{r.place || "—"}</td>
                <td data-label="Phone">{r.phone || "—"}</td>
                <td data-label="Reason">{r.reason}</td>{isSuperAdmin && <td data-label="Actions"><button className="danger" onClick={() => deleteRecord(r.id)}>Delete</button></td>}
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={isSuperAdmin ? 8 : 7} style={{ color: '#6b7280' }}>No entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
