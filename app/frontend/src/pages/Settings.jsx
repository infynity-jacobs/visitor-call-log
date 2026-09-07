import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { OptionsManager } from '../components/OptionsManager.jsx';

function BrandingSection() {
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await api.request('/settings/branding');
    setForm(data.branding);
  }, []);

  useEffect(() => { load().catch((err) => setMessage({ type: 'error', text: err.message })); }, [load]);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const data = await api.request('/settings/branding', {
        method: 'PUT',
        body: {
          orgName: form.org_name, logoPath: form.logo_path, address: form.address, phone: form.phone,
          email: form.email, website: form.website, reportHeader: form.report_header, reportFooter: form.report_footer
        }
      });
      setForm(data.branding);
      setMessage({ type: 'success', text: 'Branding settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <div className="card">Loading branding…</div>;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Branding</h3>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      <form onSubmit={handleSave}>
        <div className="form-grid">
          <div><label>Organization Name *</label><input value={form.org_name || ''} onChange={(e) => update('org_name', e.target.value)} required /></div>
          <div><label>Logo path/URL</label><input value={form.logo_path || ''} onChange={(e) => update('logo_path', e.target.value)} /></div>
          <div><label>Phone</label><input value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} /></div>
          <div><label>Email</label><input value={form.email || ''} onChange={(e) => update('email', e.target.value)} /></div>
          <div><label>Website</label><input value={form.website || ''} onChange={(e) => update('website', e.target.value)} /></div>
        </div>
        <div style={{ marginTop: '0.9rem' }}><label>Address</label><textarea value={form.address || ''} onChange={(e) => update('address', e.target.value)} /></div>
        <div style={{ marginTop: '0.9rem' }}><label>Report Header</label><input value={form.report_header || ''} onChange={(e) => update('report_header', e.target.value)} /></div>
        <div style={{ marginTop: '0.9rem' }}><label>Report Footer</label><input value={form.report_footer || ''} onChange={(e) => update('report_footer', e.target.value)} /></div>
        <div className="actions"><button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save branding'}</button></div>
      </form>
    </div>
  );
}

function SmtpSection() {
  const [form, setForm] = useState(null);
  const [password, setPassword] = useState('');
  const [testTo, setTestTo] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const data = await api.request('/settings/smtp');
    setForm(data.smtp);
  }, []);

  useEffect(() => { load().catch((err) => setMessage({ type: 'error', text: err.message })); }, [load]);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const data = await api.request('/settings/smtp', {
        method: 'PUT',
        body: {
          smtpHost: form.smtp_host, smtpPort: form.smtp_port, security: form.security,
          smtpUsername: form.smtp_username, fromEmail: form.from_email, fromName: form.from_name,
          ...(password ? { smtpPassword: password } : {})
        }
      });
      setForm(data.smtp);
      setPassword('');
      setMessage({ type: 'success', text: 'SMTP settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testTo) return;
    setTesting(true);
    setMessage(null);
    try {
      const data = await api.request('/settings/smtp/test', { method: 'POST', body: { to: testTo } });
      setMessage({ type: 'success', text: data.message });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  }

  if (!form) return <div className="card">Loading SMTP settings…</div>;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>SMTP</h3>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      <form onSubmit={handleSave}>
        <div className="form-grid">
          <div><label>SMTP Server</label><input value={form.smtp_host || ''} onChange={(e) => update('smtp_host', e.target.value)} /></div>
          <div><label>Port</label><input type="number" value={form.smtp_port || ''} onChange={(e) => update('smtp_port', e.target.value)} /></div>
          <div>
            <label>Security</label>
            <select value={form.security} onChange={(e) => update('security', e.target.value)}>
              <option value="none">None</option>
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
            </select>
          </div>
          <div><label>Username</label><input value={form.smtp_username || ''} onChange={(e) => update('smtp_username', e.target.value)} /></div>
          <div>
            <label>Password</label>
            <input type="password" placeholder="Leave blank to keep current" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div><label>From Email</label><input value={form.from_email || ''} onChange={(e) => update('from_email', e.target.value)} /></div>
          <div><label>From Name</label><input value={form.from_name || ''} onChange={(e) => update('from_name', e.target.value)} /></div>
        </div>
        <div className="actions"><button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save SMTP settings'}</button></div>
      </form>
      <div style={{ marginTop: '1rem', borderTop: '1px solid #dbe1ea', paddingTop: '1rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label>Send test email to</label>
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
        </div>
        <button className="secondary" onClick={handleTest} disabled={testing || !testTo}>{testing ? 'Sending…' : 'Send test email'}</button>
      </div>
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState([]);
  const emptyAdd = { username: '', password: '', fullName: '', role: 'user' };
  const [form, setForm] = useState(emptyAdd);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', fullName: '', password: '', role: 'user', isActive: true });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api.request('/settings/users');
    setUsers(data.users);
  }, []);

  useEffect(() => { load().catch((err) => setMessage({ type: 'error', text: err.message })); }, [load]);

  async function handleCreate(e) {
    e.preventDefault(); setBusy(true); setMessage(null);
    try {
      await api.request('/settings/users', { method: 'POST', body: form });
      setForm(emptyAdd);
      setMessage({ type: 'success', text: 'User created.' });
      await load();
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  function beginEdit(u) {
    setEditing(u.id);
    setEditForm({ username: u.username, fullName: u.full_name || '', password: '', role: u.role, isActive: u.is_active });
    setMessage(null);
  }

  function cancelEdit() { setEditing(null); }

  async function handleEdit(e) {
    e.preventDefault(); setBusy(true); setMessage(null);
    try {
      const body = { username: editForm.username, fullName: editForm.fullName, role: editForm.role, isActive: editForm.isActive };
      if (editForm.password) body.password = editForm.password;
      await api.request(`/settings/users/${editing}`, { method: 'PUT', body });
      setEditing(null);
      setMessage({ type: 'success', text: 'User updated.' });
      await load();
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function handleToggleActive(u) {
    setBusy(true); setMessage(null);
    try {
      await api.request(`/settings/users/${u.id}`, { method: 'PUT', body: { isActive: !u.is_active } });
      await load();
      setMessage({ type: 'success', text: `User ${u.is_active ? 'disabled' : 'enabled'}.` });
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function handleDelete(u) {
    if (!window.confirm(`Permanently delete user "${u.username}"? Historical Visitor Register and Call Log records will be retained.`)) return;
    setBusy(true); setMessage(null);
    try {
      await api.request(`/settings/users/${u.id}`, { method: 'DELETE' });
      await load();
      setMessage({ type: 'success', text: `User ${u.username} deleted.` });
    } catch (err) { setMessage({ type: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Users</h3>
      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td><td>{u.full_name || '—'}</td><td>{u.role === 'admin' ? 'Administrator' : 'Normal user'}</td>
                <td><span className={`badge ${u.is_active ? 'enabled' : 'disabled'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td><div className="inline-actions">
                  <button className="secondary" onClick={() => beginEdit(u)} disabled={busy}>Edit</button>
                  <button className="secondary" onClick={() => handleToggleActive(u)} disabled={busy}>{u.is_active ? 'Disable' : 'Enable'}</button>
                  <button className="danger" onClick={() => handleDelete(u)} disabled={busy}>Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <form onSubmit={handleEdit} className="subcard">
          <div className="section-heading"><h4 style={{ margin: 0 }}>Edit User</h4><button type="button" className="secondary" onClick={cancelEdit}>Cancel</button></div>
          <div className="form-grid">
            <div><label>Username *</label><input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required /></div>
            <div><label>Full name *</label><input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} required /></div>
            <div><label>New password</label><input type="password" minLength="8" placeholder="Leave blank to keep current" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} /></div>
            <div><label>Role</label><select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}><option value="user">Normal user</option><option value="admin">Administrator</option></select></div>
            <div><label>Status</label><select value={editForm.isActive ? 'active' : 'disabled'} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
          </div>
          <div className="actions"><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" className="secondary" onClick={cancelEdit}>Cancel</button></div>
        </form>
      )}

      <form onSubmit={handleCreate} className="subcard">
        <h4 style={{ marginTop: 0 }}>Add User</h4>
        <div className="form-grid">
          <div><label>Username *</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
          <div><label>Full name *</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></div>
          <div><label>Password * (min 8 chars)</label><input type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div><label>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="user">Normal user</option><option value="admin">Administrator</option></select></div>
        </div>
        <div className="actions"><button type="submit" className="primary" disabled={busy}>{busy ? 'Adding…' : 'Add user'}</button></div>
      </form>
    </div>
  );
}

export default function Settings() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.request('/settings/version').then((d) => setVersion(d.version)).catch(() => {});
  }, []);

  return (
    <div>
      <h2>Settings</h2>
      <OptionsManager title="Purpose Options" endpoint="/settings/purpose-options" />
      <OptionsManager title="Enquiry Type Options" endpoint="/settings/enquiry-type-options" />
      <OptionsManager title="Meeting Person Options" endpoint="/settings/meeting-person-options" />
      <BrandingSection />
      <SmtpSection />
      <UsersSection />
      <div className="card" style={{ color: '#6b7280', fontSize: '0.85rem' }}>Application version: {version}</div>
    </div>
  );
}
