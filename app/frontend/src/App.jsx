import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { api } from './api/client';
import Login from './pages/Login.jsx';
import VisitorRegister from './pages/VisitorRegister.jsx';
import CallLog from './pages/CallLog.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import ChangePassword from './pages/ChangePassword.jsx';

function FaviconLoader() {
  useEffect(() => {
    api.request('/auth/public-branding').then(({ branding }) => {
      if (!branding?.favicon_path) return;
      let link = document.querySelector('link[data-vcl-favicon]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; link.dataset.vclFavicon = 'true'; document.head.appendChild(link); }
      link.href = branding.favicon_path;
    }).catch(() => {});
  }, []);
  return null;
}

export default function App() {
  return (
    <div className="app-shell">
      <FaviconLoader />
      <Navbar />
      <div className="content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><VisitorRegister /></ProtectedRoute>} />
          <Route path="/calllog" element={<ProtectedRoute><CallLog /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        </Routes>
      </div>
    </div>
  );
}
