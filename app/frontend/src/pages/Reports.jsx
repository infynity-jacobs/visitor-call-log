import { useState } from 'react';
import { api } from '../api/client';

export default function Reports() {
  const [type, setType] = useState('visitors');
  const [mode, setMode] = useState('all');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

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

  async function handleDownload(format) {
    setBusy(true);
    setMessage(null);
    try {
      await api.downloadReport(type, format, filterParams());
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSend(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = await api.request(`/reports/${type}/email`, {
        method: 'POST',
        body: { ...filterParams(), format: emailFormat, to, subject, message: emailMessage }
      });
      setMessage({ type: 'success', text: data.message });
      setEmailOpen(false);
      setTo(''); setSubject(''); setEmailMessage('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Reports</h2>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="card">
        <div className="tabs">
          <button className={type === 'visitors' ? 'active' : ''} onClick={() => setType('visitors')}>Visitors Register</button>
          <button className={type === 'calllog' ? 'active' : ''} onClick={() => setType('calllog')}>Call Log</button>
        </div>

        <div className="tabs">
          <button className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>All records</button>
          <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Specific date</button>
          <button className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}>Date range</button>
        </div>

        {mode === 'single' && (
          <div style={{ maxWidth: 240, marginBottom: '1rem' }}>
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        {mode === 'range' && (
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div>
              <label htmlFor="startDate">Start date</label>
              <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="endDate">End date</label>
              <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="actions">
          <button className="primary" disabled={busy} onClick={() => handleDownload('xlsx')}>Download Excel</button>
          <button className="primary" disabled={busy} onClick={() => handleDownload('pdf')}>Download PDF</button>
          <button className="secondary" disabled={busy} onClick={() => setEmailOpen((o) => !o)}>
            {emailOpen ? 'Cancel email' : 'Email report'}
          </button>
        </div>

        {emailOpen && (
          <form onSubmit={handleEmailSend} style={{ marginTop: '1rem', borderTop: '1px solid #dbe1ea', paddingTop: '1rem' }}>
            <div className="form-grid">
              <div>
                <label htmlFor="to">Recipient email *</label>
                <input id="to" type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="format">Format</label>
                <select id="format" value={emailFormat} onChange={(e) => setEmailFormat(e.target.value)}>
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                </select>
              </div>
              <div>
                <label htmlFor="subject">Subject</label>
                <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Report subject" />
              </div>
            </div>
            <div style={{ marginTop: '0.9rem' }}>
              <label htmlFor="emailMessage">Message</label>
              <textarea id="emailMessage" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Optional message body" />
            </div>
            <div className="actions">
              <button type="submit" className="primary" disabled={busy}>{busy ? 'Sending…' : 'Send email'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
