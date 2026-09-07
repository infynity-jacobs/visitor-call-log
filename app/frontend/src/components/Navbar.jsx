import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client';

export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.request('/settings/branding')
      .then((data) => setBranding(data.branding))
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  function handleLogout() {
    setAccountOpen(false);
    logout();
    navigate('/login');
  }

  function openChangePassword() {
    setAccountOpen(false);
    navigate('/change-password');
  }

  const logo = branding?.logo_path;
  const orgName = branding?.org_name || '';

  return (
    <header className="topbar">
      <div className="topbar-branding">
        {logo && (
          <img
            src={logo}
            alt="Organization logo"
            className="topbar-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div className="topbar-brand-text">
          <div className="brand">VISITOR REGISTER &amp; CALL LOG</div>
          {orgName && <div className="topbar-org">{orgName}</div>}
        </div>
      </div>

      <nav className="nav-links" aria-label="Primary navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `module-nav visitor-nav${isActive ? ' active' : ''}`}
        >
          <span aria-hidden="true">👥</span> VISITOR REGISTER
        </NavLink>
        <NavLink
          to="/calllog"
          className={({ isActive }) => `module-nav call-nav${isActive ? ' active' : ''}`}
        >
          <span aria-hidden="true">☎</span> CALL LOG
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? 'active' : '')}>Reports</NavLink>
        {isAdmin && <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>}
        <div className="account-menu">
          <button
            type="button"
            className="account-trigger"
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((open) => !open)}
          >
            {user.fullName || user.username} ▾
          </button>
          {accountOpen && (
            <div className="account-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={openChangePassword}>Change Password</button>
              <button type="button" role="menuitem" onClick={handleLogout}>Log out</button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
