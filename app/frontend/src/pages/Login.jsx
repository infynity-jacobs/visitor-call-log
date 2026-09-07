import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    api.request('/auth/public-branding')
      .then((data) => setBranding(data.branding))
      .catch(() => setBranding({ org_name: '', logo_path: null }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      const dest = location.state?.from?.pathname || '/';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-branding">
          {branding?.logo_path && (
            <img
              src={branding.logo_path}
              alt="Organization logo"
              className="login-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          {branding?.org_name && <div className="login-org-name">{branding.org_name}</div>}
          <div className="login-app-name">VISITOR REGISTER &amp; CALL LOG</div>
        </div>
        <h2 className="login-title">Sign in</h2>
        {error && <div className="alert error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          <div style={{ height: '0.8rem' }} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div style={{ height: '1.2rem' }} />
          <button type="submit" className="primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
