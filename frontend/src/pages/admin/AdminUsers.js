import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../../components/admin/Modal';
import './AdminUsersHistory.css';
import {
  adminGetUsers, adminUpdateUser, adminResetPassword,
} from '../../api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

const STATUS_COLORS = {
  accepted:       'var(--pass)',
  wrong_answer:   'var(--fail)',
  compile_error:  'var(--fail)',
  runtime_error:  'var(--fail)',
  time_limit:     '#f97316',
  illegal_import: '#f97316',
  pending:        'var(--text-muted)',
  running:        'var(--purple)',
  completed:      'var(--pass)',
  abandoned:      'var(--fail)',
  active:         '#fbbf24',
};

// ── Edit user modal ───────────────────────────────────────────────────────────
function UserModal({ user, onSave, onClose }) {
  const [form, setForm] = useState({
    username:     user.username     || '',
    first_name:   user.first_name   || '',
    last_name:    user.last_name    || '',
    email:        user.email        || '',
    is_active:    user.is_active,
    is_staff:     user.is_staff,
    role:         user.role         || 'student',
    block_reason: user.block_reason || '',
  });
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');
  const [pwMode,   setPwMode]   = useState(false);
  const [pw,       setPw]       = useState('');
  const [pw2,      setPw2]      = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError,  setPwError]  = useState('');
  const [pwOk,     setPwOk]     = useState('');

  const set      = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  const submit = async () => {
    setSaving(true); setSaveErr('');
    try {
      await adminUpdateUser(user.id, form);
      onSave();
    } catch (err) {
      const d = err.response?.data;
      setSaveErr(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Failed to save.');
    } finally { setSaving(false); }
  };

  const submitPw = async () => {
    setPwError(''); setPwOk('');
    if (!pw) return setPwError('Enter a new password.');
    if (pw !== pw2) return setPwError('Passwords do not match.');
    setPwSaving(true);
    try {
      await adminResetPassword(user.id, { password: pw });
      setPwOk('Password updated.');
      setPw(''); setPw2('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPwError(Array.isArray(detail) ? detail.join(' ') : (detail || 'Failed to update password.'));
    } finally { setPwSaving(false); }
  };

  return (
    <Modal
      title={`Edit user — ${user.username}`}
      onClose={onClose}
      footer={
        pwMode ? (
          <>
            <button className="btn btn-ghost" onClick={() => { setPwMode(false); setPwError(''); setPwOk(''); }}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={submitPw} disabled={pwSaving}>
              {pwSaving ? 'Saving...' : 'Set password'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-ghost"
              style={{ color: '#f97316', borderColor: '#f97316' }}
              onClick={() => setPwMode(true)}
            >
              Reset password
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </>
        )
      }
    >
      {!pwMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Identity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>First name</label>
              <input className="input" value={form.first_name} onChange={set('first_name')} placeholder="First name" />
            </div>
            <div className="field">
              <label>Last name</label>
              <input className="input" value={form.last_name} onChange={set('last_name')} placeholder="Last name" />
            </div>
          </div>
          <div className="field">
            <label>Username</label>
            <input className="input" value={form.username} onChange={set('username')} placeholder="Username" />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="Email" />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />

          {/* Role & access */}
          <div className="field">
            <label>Role</label>
            <select value={form.role} onChange={set('role')}>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="check-field">
              <input type="checkbox" checked={form.is_active} onChange={setCheck('is_active')} />
              <span>Active account (can log in)</span>
            </label>
            <label className="check-field">
              <input type="checkbox" checked={form.is_staff} onChange={setCheck('is_staff')} />
              <span>Staff / Admin access</span>
            </label>
          </div>

          {/* Block reason — only shown when account is disabled */}
          {!form.is_active && (
            <div className="field">
              <label style={{ color: '#f97316' }}>
                Block message
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6, fontSize: 11 }}>
                  shown to user on login
                </span>
              </label>
              <textarea
                className="input"
                rows={3}
                value={form.block_reason}
                onChange={set('block_reason')}
                placeholder="e.g. Your account has been suspended for academic dishonesty. Contact your instructor."
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
          )}

          {saveErr && <div style={{ color: 'var(--fail)', fontSize: 12 }}>{saveErr}</div>}

          {/* Account info (read-only) */}
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Lv.{user.level} · {user.total_xp} XP · joined {fmtDateShort(user.created_at)}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Setting new password for <strong style={{ color: 'var(--text)' }}>{user.username}</strong>
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" className="input" placeholder="Enter new password"
              value={pw} onChange={e => setPw(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input type="password" className="input" placeholder="Repeat new password"
              value={pw2} onChange={e => setPw2(e.target.value)} />
          </div>
          {pwError && <div style={{ color: 'var(--fail)', fontSize: 12 }}>{pwError}</div>}
          {pwOk    && <div style={{ color: 'var(--pass)', fontSize: 12 }}>{pwOk}</div>}
        </div>
      )}
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminGetUsers({ search })
      .then(r => setUsers(r.data.results || r.data))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-sub">{users.length} registered students</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Search by username or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">No users found.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Level</th>
                <th>XP</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="mono">{u.username}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{u.email}</td>
                  <td className="mono text-teal">{u.level}</td>
                  <td className="mono text-muted">{u.total_xp}</td>
                  <td>
                    <span className={`pill ${u.is_staff ? 'badge-purple' : 'badge-teal'}`} style={{ fontSize: 10 }}>
                      {u.is_staff ? 'admin' : u.role}
                    </span>
                  </td>
                  <td className="mono text-muted" style={{ fontSize: 11 }}>{fmtDateShort(u.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`pill ${u.is_active ? 'pill-on' : 'pill-off'}`}>
                        {u.is_active ? 'active' : 'blocked'}
                      </span>
                      {!u.is_active && u.block_reason && (
                        <span title={u.block_reason} style={{ cursor: 'help', fontSize: 13 }}>⚠️</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-icon" onClick={() => setModal(u)}>Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}