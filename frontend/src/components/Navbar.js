import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/'); };
  const isAdmin = user?.is_staff || user?.role === 'admin';

  const nav = [
    { to: '/dashboard',   label: 'Dashboard' },
    { to: '/disclaimer',  label: 'Practice' },
    { to: '/checkpoints', label: 'Map' },
    { to: '/history',     label: 'History' },
  ];

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="nav-logo">
        <span className="nav-logo-bars"><span /><span /></span>
        <span className="nav-logo-text">ZCheck</span>
      </Link>

      <div className="nav-links">
        {nav.map(n => (
          <Link key={n.to} to={n.to}
            className={`nav-link ${location.pathname === n.to ? 'active' : ''}`}>
            {n.label}
          </Link>
        ))}
        {isAdmin && (
          <Link to="/admin"
            className={`nav-link nav-link-admin ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>
            Admin
          </Link>
        )}
      </div>

      <div className="nav-user">
        <span className="nav-username mono">{user?.username}</span>
        <div className="nav-xp mono">
          <span className="text-teal">Lv.{user?.level}</span>
          <span className="text-muted">{user?.total_xp} XP</span>
        </div>
        <button className="btn btn-ghost nav-logout" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
