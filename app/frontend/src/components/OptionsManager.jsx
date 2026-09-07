import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

export function OptionsManager({ title, endpoint }) {
  const [options, setOptions] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const data = await api.request(endpoint);
    setOptions(data.options);
  }, [endpoint]);

  useEffect(() => { load().catch((err) => setMessage({ type: 'error', text: err.message })); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    try {
      await api.request(endpoint, { method: 'POST', body: { label: newLabel.trim() } });
      setNewLabel('');
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleToggle(opt) {
    try {
      await api.request(`${endpoint}/${opt.id}`, { method: 'PUT', body: { isEnabled: !opt.is_enabled } });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function handleDelete(opt) {
    if (!window.confirm(`Delete "${opt.label}"? This cannot be undone.`)) return;
    try {
      await api.request(`${endpoint}/${opt.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  function startEdit(opt) {
    setEditingId(opt.id);
    setEditingLabel(opt.label);
  }

  async function saveEdit(id) {
    try {
      await api.request(`${endpoint}/${id}`, { method: 'PUT', body: { label: editingLabel } });
      setEditingId(null);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  async function move(index, direction) {
    const next = [...options];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setOptions(next);
    try {
      await api.request(`${endpoint}/reorder`, { method: 'POST', body: { orderedIds: next.map((o) => o.id) } });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      load();
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      <table>
        <thead><tr><th style={{ width: 40 }}>#</th><th>Label</th><th>Status</th><th style={{ width: 220 }}>Actions</th></tr></thead>
        <tbody>
          {options.map((opt, idx) => (
            <tr key={opt.id}>
              <td>{idx + 1}</td>
              <td>
                {editingId === opt.id ? (
                  <input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} />
                ) : opt.label}
              </td>
              <td><span className={`badge ${opt.is_enabled ? 'enabled' : 'disabled'}`}>{opt.is_enabled ? 'Enabled' : 'Disabled'}</span></td>
              <td>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button className="secondary" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
                  <button className="secondary" onClick={() => move(idx, 1)} disabled={idx === options.length - 1}>↓</button>
                  {editingId === opt.id ? (
                    <button className="secondary" onClick={() => saveEdit(opt.id)}>Save</button>
                  ) : (
                    <button className="secondary" onClick={() => startEdit(opt)}>Edit</button>
                  )}
                  <button className="secondary" onClick={() => handleToggle(opt)}>{opt.is_enabled ? 'Disable' : 'Enable'}</button>
                  <button className="danger" onClick={() => handleDelete(opt)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem' }}>
        <input placeholder="New option label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <button type="submit" className="primary">Add</button>
      </form>
    </div>
  );
}
