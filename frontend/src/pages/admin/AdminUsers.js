import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../../components/admin/Modal';
import { adminGetUsers, adminUpdateUser } from '../../api/admin';

function UserModal({ user, onSave, onClose }) {
  const [form, setForm]   = useState({ is_active: user.is_active, is_staff: user.is_staff, role: user.role });
  const [saving, setSaving] = useState(false);
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try { await adminUpdateUser(user.id, form); onSave(); }
    catch { /* errors handled silently for now */ }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={`Edit user — ${user.username}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="card" style={{ background: 'var(--bg-panel)', gap: 8, display: 'flex', flexDirection: 'column' }}>
        <div className="mono" style={{ fontSize: 13 }}>{user.username}</div>
        <div className="text-muted" style={{ fontSize: 12 }}>{user.email}</div>
        <div className="mono text-muted" style={{ fontSize: 11 }}>
          Lv.{user.level} · {user.total_xp} XP · joined {new Date(user.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="field">
        <label>Role</label>
        <select value={form.role} onChange={set('role')}>
          <option value="student">Student</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="check-field">
          <input type="checkbox" checked={form.is_active} onChange={setCheck('is_active')} />
          <span>Active account (can log in)</span>
        </label>
        <label className="check-field">
          <input type="checkbox" checked={form.is_staff} onChange={setCheck('is_staff')} />
          <span>Staff / Admin access</span>
        </label>
      </div>
    </Modal>
  );
}

export default function AdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminGetUsers({ search }).then(r => setUsers(r.data.results || r.data)).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-sub">{users.length} registered students</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search by username or email..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="admin-loading">Loading...</div>
          : users.length === 0
            ? <div className="admin-empty">No users found.</div>
            : <table className="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
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
                      <td className="text-muted" style={{ fontSize: 12 }}>{u.email}</td>
                      <td className="mono text-teal">{u.level}</td>
                      <td className="mono text-muted">{u.total_xp}</td>
                      <td>
                        <span className={`pill ${u.is_staff ? 'badge-purple' : 'badge-teal'}`}
                          style={{ fontSize: 10 }}>
                          {u.is_staff ? 'admin' : u.role}
                        </span>
                      </td>
                      <td className="mono text-muted" style={{ fontSize: 11 }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`pill ${u.is_active ? 'pill-on' : 'pill-off'}`}>
                          {u.is_active ? 'active' : 'disabled'}
                        </span>
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
        }
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
