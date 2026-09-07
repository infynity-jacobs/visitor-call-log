import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import VisitorRegister from './pages/VisitorRegister.jsx';
import CallLog from './pages/CallLog.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import ChangePassword from './pages/ChangePassword.jsx';

export default function App() {
  return (
    <div className="app-shell">
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
