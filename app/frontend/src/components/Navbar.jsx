import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="topbar">
      <div className="brand">Visitor Register &amp; Call Log</div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Visitor Register</NavLink>
        <NavLink to="/calllog" className={({ isActive }) => (isActive ? 'active' : '')}>Call Log</NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? 'active' : '')}>Reports</NavLink>
        {isAdmin && <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>}
        <span style={{ padding: '0.4rem 0.7rem', opacity: 0.8 }}>{user.fullName || user.username}</span>
        <button onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}
