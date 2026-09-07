import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (newPassword === currentPassword) {
      setMessage({ type: 'error', text: 'New password must be different from the current password.' });
      return;
    }

    setBusy(true);
    try {
      await api.request('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword }
      });
      // The password change succeeds server-side, then force a fresh login.
      logout();
      setMessage({ type: 'success', text: 'Password changed successfully. Please log in again.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      window.setTimeout(() => navigate('/login', { replace: true }), 900);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="section-heading">
        <h2 style={{ margin: 0 }}>Change Password</h2>
      </div>
      <div className="card password-card">
        <p className="muted">Change the password for your own account. Your current password is required.</p>
        {message && <div className={`alert ${message.type}`}>{message.text}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid password-form-grid">
            <div>
              <label htmlFor="current-password">Current password *</label>
              <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="new-password">New password * (min 8 chars)</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="confirm-password">Confirm new password *</label>
              <input id="confirm-password" type="password" autoComplete="new-password" minLength="8" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
