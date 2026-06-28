import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AdminLayout.css';

const NAV = [
  { to: '/admin',             label: 'Overview',    icon: '▦', end: true },
  { to: '/admin/exercises',   label: 'Exercises',   icon: '⌨' },
  { to: '/admin/checkpoints', label: 'Checkpoints', icon: '⬡' },
  { to: '/admin/languages',   label: 'Languages',   icon: '◈' },
  { to: '/admin/users',       label: 'Users',       icon: '◉' },
  { to: '/admin/submissions', label: 'Submissions', icon: '◎' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-bars"><span /><span /></span>
          <div>
            <span className="admin-brand-name mono">ZCheck</span>
            <span className="admin-brand-tag mono">Admin</span>
          </div>
        </div>

        <nav className="admin-nav">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">{n.icon}</span>
              <span className="admin-nav-label">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user">
            <span className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{user?.username}</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Administrator</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => navigate('/dashboard')}>
              ← App
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
