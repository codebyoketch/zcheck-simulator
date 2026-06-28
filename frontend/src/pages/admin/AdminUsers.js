import React, { useEffect, useState, useCallback, useRef } from 'react';
import Modal from '../../components/admin/Modal';
import './AdminUsersHistory.css';
import {
  adminGetUsers, adminUpdateUser, adminResetPassword,
  adminGetCheckpoints,
  adminGetUserSubmissions, adminGetUserSessions,
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

function fmtDuration(s) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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

function StatusBadge({ status }) {
  const label = status?.replace(/_/g, ' ').toUpperCase() || '—';
  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 6px',
      borderRadius: 3,
      border: `1px solid ${STATUS_COLORS[status] || 'var(--border)'}`,
      color: STATUS_COLORS[status] || 'var(--text-muted)',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Edit user modal ───────────────────────────────────────────────────────────
function UserModal({ user, onSave, onClose }) {
  const [form,    setForm]    = useState({ is_active: user.is_active, is_staff: user.is_staff, role: user.role });
  const [saving,  setSaving]  = useState(false);
  const [pwMode,  setPwMode]  = useState(false);
  const [pw,      setPw]      = useState('');
  const [pw2,     setPw2]     = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError,  setPwError]  = useState('');
  const [pwOk,     setPwOk]     = useState('');

  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));
  const set      = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try { await adminUpdateUser(user.id, form); onSave(); }
    catch { }
    finally { setSaving(false); }
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
    } finally {
      setPwSaving(false);
    }
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
            <button className="btn btn-ghost" style={{ color: '#f97316', borderColor: '#f97316' }}
              onClick={() => setPwMode(true)}>
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
        <>
          <div className="card" style={{ background: 'var(--bg-panel)', gap: 8, display: 'flex', flexDirection: 'column' }}>
            <div className="mono" style={{ fontSize: 13 }}>{user.username}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>{user.email}</div>
            <div className="mono text-muted" style={{ fontSize: 11 }}>
              Lv.{user.level} · {user.total_xp} XP · joined {fmtDateShort(user.created_at)}
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
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Setting new password for <strong style={{ color: 'var(--text)' }}>{user.username}</strong>
          </div>
          <div className="field">
            <label>New password</label>
            <input
              type="password"
              className="input"
              placeholder="Enter new password"
              value={pw}
              onChange={e => setPw(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <input
              type="password"
              className="input"
              placeholder="Repeat new password"
              value={pw2}
              onChange={e => setPw2(e.target.value)}
            />
          </div>
          {pwError && <div style={{ color: 'var(--fail)', fontSize: 12 }}>{pwError}</div>}
          {pwOk    && <div style={{ color: 'var(--pass)', fontSize: 12 }}>{pwOk}</div>}
        </div>
      )}
    </Modal>
  );
}

// ── Submission history panel ──────────────────────────────────────────────────
const SUBMISSION_STATUSES = ['accepted','wrong_answer','compile_error','runtime_error','time_limit','illegal_import'];
const SESSION_STATUSES    = ['active','completed','abandoned'];
const SUB_SORTS = [
  { value: '-submitted_at', label: 'Newest first' },
  { value: 'submitted_at',  label: 'Oldest first' },
  { value: 'exercise',      label: 'Exercise A→Z' },
  { value: '-exercise',     label: 'Exercise Z→A' },
  { value: 'difficulty',    label: 'Difficulty ↑' },
  { value: '-difficulty',   label: 'Difficulty ↓' },
];

function UserHistoryPanel({ user, checkpoints }) {
  const [tab,        setTab]        = useState('submissions');
  const [submissions,setSubmissions] = useState([]);
  const [sessions,   setSessions]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [filters,    setFilters]    = useState({
    checkpoint: '', exercise: '', date_from: '', date_to: '', status: '', sort: '-submitted_at',
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (tab === 'submissions') {
        const params = {};
        if (filters.checkpoint) params.checkpoint = filters.checkpoint;
        if (filters.exercise)   params.exercise   = filters.exercise;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        if (filters.status)     params.status     = filters.status;
        if (filters.sort)       params.sort       = filters.sort;
        const { data } = await adminGetUserSubmissions(user.id, params);
        setSubmissions(data.submissions || []);
      } else {
        const params = {};
        if (filters.checkpoint) params.checkpoint = filters.checkpoint;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        if (filters.status)     params.status     = filters.status;
        const { data } = await adminGetUserSessions(user.id, params);
        setSessions(data.sessions || []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [user, tab, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetFilters = () => setFilters({
    checkpoint: '', exercise: '', date_from: '', date_to: '', status: '', sort: '-submitted_at',
  });

  return (
    <div className="user-history-panel">
      {/* Tab bar */}
      <div className="user-history-tabbar">
        <button
          className={`user-history-tab${tab === 'submissions' ? ' active' : ''}`}
          onClick={() => setTab('submissions')}
        >
          Submissions {tab === 'submissions' && !loading && `(${submissions.length})`}
        </button>
        <button
          className={`user-history-tab${tab === 'sessions' ? ' active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          Sessions {tab === 'sessions' && !loading && `(${sessions.length})`}
        </button>

        {/* Filters inline */}
        <div className="user-history-filters">
          <select className="uhf-select mono" value={filters.checkpoint}
            onChange={e => setFilter('checkpoint', e.target.value)}>
            <option value="">All checkpoints</option>
            {checkpoints.map(cp => (
              <option key={cp.slug} value={cp.slug}>{cp.name}</option>
            ))}
          </select>

          {tab === 'submissions' && (
            <input className="uhf-input mono" placeholder="Exercise slug..."
              value={filters.exercise} onChange={e => setFilter('exercise', e.target.value)} />
          )}

          <input type="date" className="uhf-input mono" value={filters.date_from}
            onChange={e => setFilter('date_from', e.target.value)} title="From" />
          <input type="date" className="uhf-input mono" value={filters.date_to}
            onChange={e => setFilter('date_to', e.target.value)} title="To" />

          <select className="uhf-select mono" value={filters.status}
            onChange={e => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {(tab === 'submissions' ? SUBMISSION_STATUSES : SESSION_STATUSES).map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {tab === 'submissions' && (
            <select className="uhf-select mono" value={filters.sort}
              onChange={e => setFilter('sort', e.target.value)}>
              {SUB_SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}

          <button className="btn btn-ghost btn-sm mono" onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {/* Content */}
      <div className="user-history-body">
        {loading ? (
          <div className="admin-loading mono">Loading...</div>
        ) : tab === 'submissions' ? (
          submissions.length === 0 ? (
            <div className="admin-empty mono">No submissions match the current filters.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="mono">#</th>
                  <th className="mono">Exercise</th>
                  <th className="mono">Checkpoint</th>
                  <th className="mono">Diff</th>
                  <th className="mono">Status</th>
                  <th className="mono">Submitted</th>
                  <th className="mono">Duration</th>
                  <th className="mono">Session</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.id}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{s.exercise_name}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.checkpoint_name || '—'}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{s.difficulty_pct ?? '—'}%</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(s.submitted_at)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{fmtDuration(s.duration_seconds)}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {s.session_id ? `#${s.session_id}` : 'Sandbox'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          sessions.length === 0 ? (
            <div className="admin-empty mono">No sessions match the current filters.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="mono">#</th>
                  <th className="mono">Checkpoint</th>
                  <th className="mono">Status</th>
                  <th className="mono">Started</th>
                  <th className="mono">Ended</th>
                  <th className="mono">Duration</th>
                  <th className="mono">Submissions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.id}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{s.checkpoint_name || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(s.started_at)}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(s.ended_at)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{fmtDuration(s.duration_seconds)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{s.submission_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [modal,       setModal]       = useState(null);
  const [expanded,    setExpanded]    = useState(null); // user id of expanded row
  const [checkpoints, setCheckpoints] = useState([]);
  const searchRef = useRef();

  const load = useCallback(() => {
    setLoading(true);
    adminGetUsers({ search }).then(r => setUsers(r.data.results || r.data)).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminGetCheckpoints().then(r => setCheckpoints(r.data || [])).catch(() => {});
  }, []);

  const toggleExpand = (userId) => {
    setExpanded(prev => prev === userId ? null : userId);
  };

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
          ref={searchRef}
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
                <th></th>
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
                <React.Fragment key={u.id}>
                  <tr
                    className={`user-row${expanded === u.id ? ' expanded' : ''}`}
                    onClick={() => toggleExpand(u.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ width: 28, textAlign: 'center' }}>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {expanded === u.id ? '▾' : '▸'}
                      </span>
                    </td>
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
                      {fmtDateShort(u.created_at)}
                    </td>
                    <td>
                      <span className={`pill ${u.is_active ? 'pill-on' : 'pill-off'}`}>
                        {u.is_active ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => setModal(u)}>Edit</button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded history panel */}
                  {expanded === u.id && (
                    <tr className="user-history-row">
                      <td colSpan={9} style={{ padding: 0 }}>
                        <UserHistoryPanel user={u} checkpoints={checkpoints} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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