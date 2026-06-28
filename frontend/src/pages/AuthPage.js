import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import WaveBg from '../components/WaveBg';
import './AuthPage.css';

export default function AuthPage() {
  const [mode, setMode]         = useState('login'); // 'login' | 'register'
  const [form, setForm]         = useState({ username: '', email: '', password: '', password2: '', first_name: '', last_name: '' });
  const [error, setError]       = useState('');
  const [blockMsg, setBlockMsg] = useState('');
  const [loading, setLoading]   = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setBlockMsg('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        if (form.password !== form.password2) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        await register(form);
      }
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      // Surface block_reason as a distinct banner
      const blocked = data?.block_reason || (err.response?.status === 403 ? data?.detail : null);
      if (blocked) {
        setBlockMsg(blocked);
      } else if (data) {
        const msgs = Object.values(data).flat().join(' ');
        setError(msgs || 'Something went wrong.');
      } else {
        setError('Cannot connect to server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError('');
    setBlockMsg('');
  };

  return (
    <div className="auth-page page">
      <WaveBg />

      <div className="auth-center">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-bars">
            <span /><span />
          </span>
          <span className="auth-logo-text">ZCheck</span>
          <span className="auth-logo-sub">Simulator</span>
        </div>

        <div className="auth-card card">
          {/* Tab toggle */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setBlockMsg(''); }}
            >
              Login
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); setBlockMsg(''); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {/* Register-only fields */}
            {mode === 'register' && (
              <div className="auth-row">
                <div className="auth-field">
                  <label className="auth-label">First name</label>
                  <input className="input" value={form.first_name} onChange={set('first_name')} placeholder="Dishon" />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Last name</label>
                  <input className="input" value={form.last_name} onChange={set('last_name')} placeholder="Ngisa" />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Username</label>
              <input
                className="input"
                value={form.username}
                onChange={set('username')}
                placeholder="dngisa"
                required
                autoFocus
              />
            </div>

            {mode === 'register' && (
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@zone01.com" required />
              </div>
            )}

            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
            </div>

            {mode === 'register' && (
              <div className="auth-field">
                <label className="auth-label">Confirm password</label>
                <input className="input" type="password" value={form.password2} onChange={set('password2')} placeholder="••••••••" required />
              </div>
            )}

            {/* Block message banner — distinct from generic errors */}
            {blockMsg && (
              <div className="auth-block-banner">
                <div className="auth-block-banner-title mono">ACCOUNT BLOCKED</div>
                <div className="auth-block-banner-body">{blockMsg}</div>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading
                ? <><span className="spinner" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
                : mode === 'login' ? 'Sign in →' : 'Create account →'
              }
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <button className="auth-link" onClick={toggle}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="auth-footer mono">
          zone01 checkpoint revision platform
        </p>
      </div>
    </div>
  );
}
