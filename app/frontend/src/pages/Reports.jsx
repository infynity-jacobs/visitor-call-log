import { useState } from 'react';
import { api } from '../api/client';
import { formatIstDateTime } from '../utils/timezone';

export default function Reports() {
  const [type, setType] = useState('visitors');
  const [mode, setMode] = useState('all');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailFormat, setEmailFormat] = useState('pdf');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  function filterParams() {
    if (mode === 'single') return { mode, date };
    if (mode === 'range') return { mode, startDate, endDate };
    return { mode: 'all' };
  }

  async function loadFiltered() {
    setBusy(true); setMessage(null);
    try {
      const params = new URLSearchParams({ ...filterParams(), limit: '500', offset: '0' });
      const endpoint = type === 'visitors' ? '/visitors' : '/calllog';
      const data = await api.request(`${endpoint}?${params.toString()}`);
      setRecords(data.records || []);
      setMessage({ type: 'success', text: `${data.records?.length || 0} record(s) found.` });
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  function clearFilter() {
    setMode('all'); setDate(''); setStartDate(''); setEndDate(''); setRecords([]); setMessage(null);
  }

  async function handleDownload(format) {
    setBusy(true); setMessage(null);
    try { await api.downloadReport(type, format, filterParams()); }
    catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function handleEmailSend(e) {
    e.preventDefault(); setBusy(true); setMessage(null);
    try {
      const data = await api.request(`/reports/${type}/email`, { method: 'POST', body: { ...filterParams(), format: emailFormat, to, subject, message: emailMessage } });
      setMessage({ type: 'success', text: data.message }); setEmailOpen(false); setTo(''); setSubject(''); setEmailMessage('');
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  const isVisitor = type === 'visitors';
  return (
    <div>
      <h2>REPORTS</h2>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      <div className="card reports-filter">
        <h3 style={{ marginTop: 0 }}>Filter Records</h3>
        <div className="tabs">
          <button className={isVisitor ? 'active' : ''} onClick={() => { setType('visitors'); setRecords([]); }}>Visitors Register</button>
          <button className={!isVisitor ? 'active' : ''} onClick={() => { setType('calllog'); setRecords([]); }}>Call Log</button>
        </div>
        <div className="tabs">
          <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>All records</button>
          <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Specific date</button>
          <button className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}>Date range</button>
        </div>
        {mode === 'single' && <div style={{ maxWidth: 240, marginBottom: '1rem' }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>}
        {mode === 'range' && <div className="form-grid" style={{ marginBottom: '1rem' }}><div><label>From date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label>To date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div>}
        <div className="actions">
          <button className="primary" disabled={busy} onClick={loadFiltered}>View filtered records</button>
          <button className="secondary" disabled={busy} onClick={clearFilter}>Clear filter</button>
          <button className="primary" disabled={busy} onClick={() => handleDownload('xlsx')}>Download Excel</button>
          <button className="primary" disabled={busy} onClick={() => handleDownload('pdf')}>Download PDF</button>
          <button className="secondary" disabled={busy} onClick={() => setEmailOpen((o) => !o)}>{emailOpen ? 'Cancel email' : 'Email report'}</button>
        </div>
      </div>

      {records.length > 0 && <div className="card report-preview">
        <div className="section-heading"><h3 style={{ margin: 0 }}>{isVisitor ? 'Visitors Register' : 'Call Log'} — Filtered Records</h3><span className="muted">{records.length} record{records.length === 1 ? '' : 's'}</span></div>
        <table className="mobile-cards report-table"><thead><tr>{isVisitor ? <><th>S.No.</th><th>Date</th><th>Time</th><th>Name</th><th>Place</th><th>Phone</th><th>Purpose</th></> : <><th>S.No.</th><th>Date</th><th>Time</th><th>Name</th><th>Place</th><th>Phone</th><th>Reason</th></>}</tr></thead>
          <tbody>{records.map((r, i) => { const dt = formatIstDateTime(isVisitor ? r.visit_date : r.call_date, isVisitor ? r.visit_time : r.call_time); return <tr key={r.id}>
            <td data-label="S.No.">{i + 1}</td>
            <td data-label="Date">{dt.slice(0,10)}</td>
            <td data-label="Time">{dt.slice(11,19)}</td>
            <td data-label="Name">{r.name}</td>
            <td data-label="Place">{r.place || '—'}</td>
            <td data-label="Phone">{r.phone || '—'}</td>
            <td data-label={isVisitor ? 'Purpose' : 'Reason'}>{isVisitor ? r.purpose : r.reason}</td>
          </tr>; })}</tbody>
        </table>
      </div>}

      {emailOpen && <div className="card"><form onSubmit={handleEmailSend}><div className="form-grid"><div><label>Recipient email *</label><input type="email" value={to} onChange={(e) => setTo(e.target.value)} required /></div><div><label>Format</label><select value={emailFormat} onChange={(e) => setEmailFormat(e.target.value)}><option value="pdf">PDF</option><option value="xlsx">Excel (.xlsx)</option></select></div><div><label>Subject</label><input value={subject} onChange={(e) => setSubject(e.target.value)} /></div></div><div style={{ marginTop: '.9rem' }}><label>Message</label><textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} /></div><div className="actions"><button type="submit" className="primary" disabled={busy}>{busy ? 'Sending…' : 'Send email'}</button></div></form></div>}
    </div>
  );
}
