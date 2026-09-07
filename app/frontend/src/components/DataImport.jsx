import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function encode(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DataImport() {
  const [type, setType] = useState('visitors');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [batches, setBatches] = useState([]);

  const loadBatches = useCallback(async () => {
    const data = await api.request('/import/batches?limit=20');
    setBatches(data.batches || []);
  }, []);

  useEffect(() => { loadBatches().catch(() => {}); }, [loadBatches]);

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setMessage(null);
  }

  async function previewFile() {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ type: 'error', text: 'Excel file is too large. Maximum size is 8 MB.' });
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const fileBase64 = await encode(file);
      const result = await api.uploadJson('/import/preview', { type, filename: file.name, fileBase64 });
      setPreview(result);
      setMessage({
        type: result.invalidRows ? 'error' : 'success',
        text: result.invalidRows
          ? `${result.invalidRows} row(s) failed validation. Correct the workbook before importing.`
          : `Validation passed: ${result.validRows} row(s) ready to import.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setPreview(null);
    } finally { setBusy(false); }
  }

  async function commit() {
    if (!file || !preview || preview.invalidRows > 0) return;
    if (!window.confirm(`Import ${preview.totalRows} ${type === 'visitors' ? 'Visitor Register' : 'Call Log'} record(s) from "${file.name}"? This will add the records to the database.`)) return;
    setBusy(true); setMessage(null);
    try {
      const fileBase64 = await encode(file);
      const result = await api.uploadJson('/import/commit', { type, filename: file.name, fileBase64 });
      setMessage({
        type: 'success',
        text: result.alreadyImported
          ? `This exact workbook was already imported (batch #${result.batch.id}). No duplicate records were added.`
          : `Import complete: ${result.imported} record(s) imported successfully (batch #${result.batch.id}).`,
      });
      setPreview(null);
      setFile(null);
      const input = document.getElementById('historical-import-file');
      if (input) input.value = '';
      await loadBatches();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Historical Excel Import</h3>
      <p className="muted">
        Super Administrator only. Import the historical <strong>VISITORS</strong> or <strong>CALL LOG</strong> workbook.
        Only the first worksheet is read. Source dates and times are treated as <strong>Asia/Kolkata (IST)</strong> and
        converted to the application's existing storage representation. The original S.No. and raw source row are retained.
      </p>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="form-grid">
        <div>
          <label htmlFor="historical-import-type">Import type</label>
          <select id="historical-import-type" value={type} onChange={(e) => { setType(e.target.value); setPreview(null); setMessage(null); }}>
            <option value="visitors">VISITOR REGISTER</option>
            <option value="calllog">CALL LOG</option>
          </select>
        </div>
        <div>
          <label htmlFor="historical-import-file">Excel file (.xlsx) — maximum 8 MB</label>
          <input id="historical-import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} />
          {file && <div className="muted" style={{ marginTop: '0.3rem' }}>{file.name} · {formatBytes(file.size)}</div>}
        </div>
      </div>

      <div className="actions">
        <button className="primary" disabled={!file || busy} onClick={previewFile}>{busy ? 'Processing…' : 'Preview & Validate'}</button>
      </div>

      {preview && (
        <div className="report-preview">
          <div className="section-heading">
            <div><strong>{preview.sheet}</strong> · {preview.totalRows} data row(s)</div>
            <div className="muted">Valid: {preview.validRows} · Invalid: {preview.invalidRows}</div>
          </div>
          <table>
            <thead><tr><th>Excel Row</th><th>Status</th><th>Name</th><th>Date</th><th>Time</th><th>Details</th></tr></thead>
            <tbody>
              {preview.preview.map((r) => {
                const d = r.data;
                const date = type === 'visitors' ? d.visitDate : d.callDate;
                const time = type === 'visitors' ? d.visitTime : d.callTime;
                const details = r.errors.length ? r.errors.join('; ') : (type === 'visitors' ? d.purpose : d.reason);
                return (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{r.errors.length ? <span className="badge disabled">ERROR</span> : <span className="badge enabled">OK</span>}</td>
                    <td>{d.name || '—'}</td><td>{date || '—'}</td><td>{time || '—'}</td><td>{details || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {preview.totalRows > preview.preview.length && <p className="muted">Showing the first {preview.preview.length} rows only. All rows are validated before import.</p>}
          <div className="actions">
            <button className="primary" disabled={busy || preview.invalidRows > 0} onClick={commit}>
              {busy ? 'Importing…' : `Confirm Import (${preview.validRows})`}
            </button>
          </div>
        </div>
      )}

      <div className="subcard">
        <div className="section-heading"><h4 style={{ margin: 0 }}>Import History</h4><span className="muted">Latest 20 batches</span></div>
        {batches.length === 0 ? <p className="muted">No historical imports have been completed.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Batch</th><th>Module</th><th>File</th><th>Rows</th><th>Imported</th><th>Created By</th><th>Created</th></tr></thead>
              <tbody>{batches.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>{b.record_type === 'visitors' ? 'Visitor Register' : 'Call Log'}</td>
                  <td>{b.source_filename}</td>
                  <td>{b.total_rows}</td>
                  <td>{b.imported_rows}</td>
                  <td>{b.created_by_username || '—'}</td>
                  <td>{new Date(b.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
