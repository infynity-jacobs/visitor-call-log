import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { formatIstDateTime } from '../utils/timezone';

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function search(e) {
    e.preventDefault();
    const term = q.trim();
    if (!term) { setResults([]); setMessage(null); return; }
    setBusy(true); setMessage(null);
    try {
      const data = await api.request(`/search?q=${encodeURIComponent(term)}&limit=100`);
      setResults(data.results);
      if (!data.results.length) setMessage({ type: 'error', text: 'No matching records found.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setResults([]);
    } finally { setBusy(false); }
  }

  function openRecord(r) {
    navigate(r.type === 'visitor' ? `/?record=${r.id}` : `/calllog?record=${r.id}`);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Global Search</h3>
      <p className="muted">Search all Visitor Register and Call Log history by name, place, phone, purpose, enquiry type, person, reason, or date.</p>
      <form onSubmit={search} className="global-search-form">
        <div className="global-search-field">
          <span className="global-search-icon" aria-hidden="true">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search all records..."
            aria-label="Search all records"
            autoComplete="off"
          />
          {q && (
            <button
              type="button"
              className="global-search-clear"
              onClick={() => { setQ(''); setResults([]); setMessage(null); }}
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          )}
          <button type="submit" className="global-search-submit" disabled={busy} aria-label="Search" title={busy ? 'Searching' : 'Search'}>
            {busy ? '…' : 'Search'}
          </button>
        </div>
      </form>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      {results.length > 0 && (
        <div className="search-results">
          <div className="muted" style={{ marginBottom: '0.5rem' }}>Found {results.length} result{results.length === 1 ? '' : 's'}.</div>
          <table>
            <thead><tr><th>Module</th><th>Date &amp; Time (IST)</th><th>Name</th><th>Place</th><th>Phone</th><th>Details</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="clickable-row" onClick={() => openRecord(r)} title="Open record">
                  <td><span className="badge">{r.type === 'visitor' ? 'Visitor' : 'Call Log'}</span></td>
                  <td>{formatIstDateTime(r.record_date, r.record_time)}</td>
                  <td>{r.name}</td>
                  <td>{r.place || '—'}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.type === 'visitor' ? [r.category, r.enquiry_type, r.person_to_visit].filter(Boolean).join(' / ') : r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
