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
      fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
      padding: '2px 6px', borderRadius: 3,
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

// ── Code viewer modal ─────────────────────────────────────────────────────────
function CodeViewerModal({ submission, onClose }) {
  return (
    <Modal
      title={`${submission.exercise_name} — submission #${submission.id}`}
      onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>Close</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={submission.status} />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {fmtDate(submission.submitted_at)}
          </span>
          {submission.duration_seconds != null && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {fmtDuration(submission.duration_seconds)}
            </span>
          )}
          {submission.checkpoint_name && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {submission.checkpoint_name}
            </span>
          )}
        </div>

        {submission.compile_output && (
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--fail)',
            borderRadius: 4, padding: '8px 12px',
          }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fail)', marginBottom: 4 }}>COMPILE OUTPUT</div>
            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {submission.compile_output}
            </pre>
          </div>
        )}

        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '8px 12px',
        }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>CODE</div>
          <pre style={{
            margin: 0, fontFamily: 'monospace', fontSize: 12, color: 'var(--text)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 480, overflowY: 'auto',
          }}>
            {submission.code || '— no code recorded —'}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

// ── History panel (submissions + sessions) ────────────────────────────────────
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
  const [tab,         setTab]         = useState('submissions');
  const [submissions, setSubmissions] = useState([]);
  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [viewingSub,  setViewingSub]  = useState(null);
  const [filters,     setFilters]     = useState({
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
      {/* Tab bar + filters */}
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

      {/* Table */}
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
                  <th className="mono"></th>
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
                    <td>
                      <button className="btn-icon" onClick={() => setViewingSub(s)} title="View code">
                        {'</>'}
                      </button>
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

      {viewingSub && (
        <CodeViewerModal submission={viewingSub} onClose={() => setViewingSub(null)} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [modal,       setModal]       = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);

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

  useEffect(() => {
    adminGetCheckpoints().then(r => setCheckpoints(r.data || [])).catch(() => {});
  }, []);

  const toggleExpand = (userId) => setExpanded(prev => prev === userId ? null : userId);

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
                <th></th>
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
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={() => setModal(u)}>Edit</button>
                      </div>
                    </td>
                  </tr>

                  {expanded === u.id && (
                    <tr className="user-history-row">
                      <td colSpan={10} style={{ padding: 0 }}>
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