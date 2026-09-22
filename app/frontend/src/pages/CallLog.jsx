import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { GlobalSearch } from '../components/GlobalSearch.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatIstDateTime } from '../utils/timezone';

function pad(n) { return String(n).padStart(2, '0'); }
function currentIstInput(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function formatS50Time(value) {
  if (!value) return '';
  const d = new Date(`${String(value).slice(0, 19).replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 19);
  return new Intl.DateTimeFormat('en-IN', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(d).replace(',', '');
}
function duration(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${pad(Math.floor(n / 3600))}:${pad(Math.floor((n % 3600) / 60))}:${pad(n % 60)}`;
}

function formatEndpoint(number, name) {
  const value = String(number || '').trim();
  const label = String(name || '').trim();

  if (!value) return '—';
  if (!label) return value;

  return `${label} (${value})`;
}

function S50CdrView() {
  const { user } = useAuth();
  const isNormalUser = user?.role === 'user';

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState(() => ({ startDateTime: currentIstInput(-24 * 60), endDateTime: currentIstInput(), direction: 'all', status: 'all', extension: '', search: '' }));
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [audioUrls, setAudioUrls] = useState({});
  const pageSize = 100;

  const load = useCallback(async (nextOffset = offset, filterOverride = null) => {
    setBusy(true); setMessage(null);
    try {
      const activeFilters = filterOverride || filters;
      const q = new URLSearchParams({ ...activeFilters, limit: String(pageSize), offset: String(nextOffset) });
      const data = await api.request(`/s50?${q.toString()}`);
      setRecords(data.records); setTotal(data.total); setOffset(nextOffset);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }, [filters, offset]);

  useEffect(() => { load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sync() {
    setSyncing(true); setMessage(null);
    try {
      const data = await api.request('/s50/sync', { method: 'POST', body: { starttime: filters.startDateTime, endtime: filters.endDateTime } });
      setMessage({ type: 'success', text: `PBX sync complete: ${data.result.fetched} fetched, ${data.result.inserted} new, ${data.result.updated} updated.` });
      await load(0);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setSyncing(false); }
  }

  function update(k, v) { setFilters((f) => ({ ...f, [k]: v })); }

  async function play(id) {
    if (playing === id) { setPlaying(null); return; }
    setMessage(null);
    try {
      let url = audioUrls[id];
      if (!url) {
        const res = await api.request(`/s50/${id}/recording`, { raw: true });
        if (!res.ok) throw new Error('Unable to load recording.');
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setAudioUrls((v) => ({ ...v, [id]: url }));
      }
      setPlaying(id);
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
  }

  const directionLabel = (r) => String(r.direction || '').toLowerCase() === 'inbound' ? 'Inbound' : String(r.direction || '').toLowerCase() === 'outbound' ? 'Outbound' : (r.direction || '—');
  const page = Math.floor(offset / pageSize) + 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return <>
    <GlobalSearch />
    <div className="card s50-filter-card">
      <div className="section-heading"><div><h3 style={{ margin: 0 }}>PBX CDR</h3><div className="muted">PBX call records and recordings. Inspection only — no calling or PBX control.</div></div><button className="primary" onClick={sync} disabled={syncing}>{syncing ? 'Syncing…' : '↻ Sync PBX'}</button></div>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      <div className="form-grid s50-filters">
        <div><label>From (IST)</label><input type="datetime-local" value={filters.startDateTime} onChange={(e) => update('startDateTime', e.target.value)} /></div>
        <div><label>To (IST)</label><input type="datetime-local" value={filters.endDateTime} onChange={(e) => update('endDateTime', e.target.value)} /></div>
        <div><label>Direction</label><select value={filters.direction} onChange={(e) => update('direction', e.target.value)}><option value="all">All</option><option value="Inbound">Inbound</option><option value="Outbound">Outbound</option><option value="Transfer">Transfer</option>{!isNormalUser && <option value="Internal">Internal</option>}</select></div>
        <div><label>Status</label><select value={filters.status} onChange={(e) => update('status', e.target.value)}><option value="all">All</option><option value="Answered">Answered</option><option value="Missed">Missed</option><option value="Busy">Busy</option><option value="Failed">Failed</option></select></div>
        <div><label>Extension</label><input value={filters.extension} onChange={(e) => update('extension', e.target.value)} placeholder="Extension number or name" /></div>
        <div><label>Search</label><input value={filters.search} onChange={(e) => update('search', e.target.value)} placeholder="Phone, extension name, trunk, DID..." onKeyDown={(e) => { if (e.key === 'Enter') load(0); }} /></div>
      </div>
      <div className="actions"><button className="secondary" onClick={() => load(0)} disabled={busy}>{busy ? 'Loading…' : 'Search'}</button><button className="secondary" onClick={() => {
        const defaults = { startDateTime: currentIstInput(-24*60), endDateTime: currentIstInput(), direction:'all', status:'all', extension:'', search:'' };
        setFilters(defaults);
        load(0, defaults);
      }} disabled={busy}>Reset Filters</button></div>
    </div>

    <div className="card">
      <div className="section-heading"><h3 style={{ margin: 0 }}>Call Records</h3><span className="muted">{total} record{total === 1 ? '' : 's'} · Page {page} of {pages}</span></div>
      <div className="table-wrap">
        <table className="mobile-cards s50-cdr-table">
          <thead><tr><th>Date &amp; Time</th><th>Type</th><th>From</th><th>To</th><th>Trunk</th><th>Call Duration</th><th>Talk Duration</th><th>Status</th><th>Recording</th></tr></thead>
          <tbody>{records.map((r) => <tr key={r.id}>
            <td data-label="Date & Time (IST)">{formatS50Time(r.start_at)}</td>
            <td data-label="Type"><span className={`cdr-direction ${String(r.direction||'').toLowerCase()}`}>{directionLabel(r)}</span></td>
            <td data-label="From">{formatEndpoint(r.call_from, r.from_name)}</td>
            <td data-label="To">{formatEndpoint(r.call_to, r.to_name)}</td>
            <td data-label="Trunk">{r.trunk || '—'}</td>
            <td data-label="Call Duration">{duration(r.duration_seconds)}</td>
            <td data-label="Talk Duration">{duration(r.talk_duration_seconds)}</td>
            <td data-label="Status"><span className={`badge cdr-status-${String(r.status||'').toLowerCase().replace(/\s+/g,'-')}`}>{r.status || '—'}</span></td>
            <td data-label="Recording">{r.recording ? <div className="cdr-recording-cell"><button className="secondary play-recording" onClick={() => play(r.id)}>{playing === r.id ? '■ Stop' : '▶ Play'}</button>{playing === r.id && audioUrls[r.id] && <audio controls autoPlay src={audioUrls[r.id]} />}</div> : <span className="muted">—</span>}</td>
          </tr>)}{!records.length && <tr><td colSpan="9" style={{ color:'#6b7280' }}>{busy ? 'Loading…' : 'No PBX CDR records found. Use Sync PBX after configuring the PBX.'}</td></tr>}</tbody>
        </table>
      </div>
      <div className="pagination"><button className="secondary" disabled={offset === 0 || busy} onClick={() => load(Math.max(0, offset-pageSize))}>Previous</button><span>Page {page} / {pages}</span><button className="secondary" disabled={offset+pageSize >= total || busy} onClick={() => load(offset+pageSize)}>Next</button></div>
    </div>
  </>;
}

function ArchiveView() {
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState(null);
  const load = useCallback(async () => { setBusy(true); try { const d=await api.request('/calllog/archive?mode=all&limit=1000&offset=0'); setRecords(d.records); } catch(e){setMessage({type:'error',text:e.message});} finally{setBusy(false);} }, []);
  useEffect(()=>{load();},[load]);
  return <div className="card"><div className="section-heading"><div><h3 style={{margin:0}}>Archived Call Log</h3><div className="muted">Historical manual Call Log records preserved from before PBX CDR integration. Read-only.</div></div><span className="muted">{records.length} record{records.length===1?'':'s'}</span></div>{message&&<div className={`alert ${message.type}`}>{message.text}</div>}<div className="table-wrap"><table className="mobile-cards"><thead><tr><th>S.No.</th><th>Date</th><th>Time</th><th>Name</th><th>Place</th><th>Phone</th><th>Reason</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td data-label="S.No.">{r.id}</td><td data-label="Date">{formatIstDateTime(r.call_date,r.call_time).slice(0,10)}</td><td data-label="Time">{formatIstDateTime(r.call_date,r.call_time).slice(-8)}</td><td data-label="Name">{r.name}</td><td data-label="Place">{r.place||'—'}</td><td data-label="Phone">{r.phone||'—'}</td><td data-label="Reason">{r.reason}</td></tr>)}{!records.length&&<tr><td colSpan="7">{busy?'Loading…':'No archived records.'}</td></tr>}</tbody></table></div></div>;
}

export default function CallLog() {
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(params.get('tab') === 'archive' ? 'archive' : 's50');
  return <div><h2>CALL LOG</h2><div className="calllog-tabs" role="tablist"><button className={tab==='s50'?'active':''} onClick={()=>setTab('s50')}>PBX CDR</button><button className={tab==='archive'?'active':''} onClick={()=>setTab('archive')}>Archived Call Log</button></div>{tab==='s50'?<S50CdrView/>:<ArchiveView/>}</div>;
}
