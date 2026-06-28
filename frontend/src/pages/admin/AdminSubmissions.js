import React, { useState, useEffect, useCallback } from 'react';
import './AdminSubmissions.css';
import {
  adminGetUsersList,
  adminGetUserSubmissions,
  adminGetUserSessions,
  adminGetCheckpoints,
} from '../../api/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(s) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
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
    <span className="admin-status-badge mono" style={{
      color: STATUS_COLORS[status] || 'var(--text-muted)',
      borderColor: STATUS_COLORS[status] || 'var(--border)',
    }}>
      {label}
    </span>
  );
}

// ── Submission table ──────────────────────────────────────────────────────────
function SubmissionsTable({ submissions }) {
  if (!submissions.length) return (
    <div className="admin-sub-empty mono">No submissions match the current filters.</div>
  );
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th className="mono">#</th>
            <th className="mono">Exercise</th>
            <th className="mono">Checkpoint</th>
            <th className="mono">Difficulty</th>
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
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {s.checkpoint_name || '—'}
              </td>
              <td className="mono" style={{ fontSize: 11 }}>{s.difficulty_pct ?? '—'}%</td>
              <td><StatusBadge status={s.status} /></td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {fmtDate(s.submitted_at)}
              </td>
              <td className="mono" style={{ fontSize: 11 }}>{fmtDuration(s.duration_seconds)}</td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {s.session_id ? `#${s.session_id}` : 'Sandbox'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sessions table ────────────────────────────────────────────────────────────
function SessionsTable({ sessions }) {
  if (!sessions.length) return (
    <div className="admin-sub-empty mono">No sessions match the current filters.</div>
  );
  return (
    <div className="admin-table-wrap">
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
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {fmtDate(s.started_at)}
              </td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {fmtDate(s.ended_at)}
              </td>
              <td className="mono" style={{ fontSize: 11 }}>{fmtDuration(s.duration_seconds)}</td>
              <td className="mono" style={{ fontSize: 11 }}>{s.submission_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminSubmissions() {
  // Users
  const [users,       setUsers]       = useState([]);
  const [userSearch,  setUserSearch]  = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);

  // Checkpoints for filter dropdown
  const [checkpoints, setCheckpoints] = useState([]);

  // View mode
  const [view, setView] = useState('submissions'); // 'submissions' | 'sessions'

  // Filters
  const [filters, setFilters] = useState({
    checkpoint: '',
    exercise:   '',
    date_from:  '',
    date_to:    '',
    status:     '',
    sort:       '-submitted_at',
  });

  // Data
  const [submissions, setSubmissions] = useState([]);
  const [sessions,    setSessions]    = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [userData,    setUserData]    = useState(null);

  // ── Load users + checkpoints on mount ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [uRes, cpRes] = await Promise.all([
          adminGetUsersList(),
          adminGetCheckpoints(),
        ]);
        setUsers(uRes.data || []);
        setCheckpoints(cpRes.data || []);
      } catch {}
      finally { setUsersLoading(false); }
    };
    load();
  }, []);

  // ── Fetch data when user or filters/view change ───────────────────────────
  const fetchData = useCallback(async () => {
    if (!selectedUser) return;
    setDataLoading(true);
    try {
      if (view === 'submissions') {
        const params = {};
        if (filters.checkpoint) params.checkpoint = filters.checkpoint;
        if (filters.exercise)   params.exercise   = filters.exercise;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        if (filters.status)     params.status     = filters.status;
        if (filters.sort)       params.sort       = filters.sort;
        const { data } = await adminGetUserSubmissions(selectedUser.id, params);
        setUserData(data.user);
        setSubmissions(data.submissions || []);
      } else {
        const params = {};
        if (filters.checkpoint) params.checkpoint = filters.checkpoint;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        if (filters.status)     params.status     = filters.status;
        const { data } = await adminGetUserSessions(selectedUser.id, params);
        setUserData(data.user);
        setSessions(data.sessions || []);
      }
    } catch {}
    finally { setDataLoading(false); }
  }, [selectedUser, view, filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const SUBMISSION_STATUSES = [
    'accepted', 'wrong_answer', 'compile_error',
    'runtime_error', 'time_limit', 'illegal_import',
  ];
  const SESSION_STATUSES = ['active', 'completed', 'abandoned'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="admin-submissions-page">

      {/* ── User selector panel ─────────────────────────────────────── */}
      <div className="admin-sub-sidebar">
        <div className="admin-sub-sidebar-header mono">Users</div>
        <div className="admin-sub-user-search-wrap">
          <input
            className="admin-sub-user-search mono"
            placeholder="Search users..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
          />
        </div>
        <div className="admin-sub-user-list">
          {usersLoading ? (
            <div className="admin-sub-empty mono">Loading...</div>
          ) : filteredUsers.map(u => (
            <button
              key={u.id}
              className={`admin-sub-user-item${selectedUser?.id === u.id ? ' selected' : ''}`}
              onClick={() => setSelectedUser(u)}
            >
              <span className="mono" style={{ fontSize: 12 }}>{u.username}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{u.email}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="admin-sub-main">

        {!selectedUser ? (
          <div className="admin-sub-placeholder">
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              ← Select a user to view their history
            </span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="admin-sub-main-header">
              <div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                  {userData?.username || selectedUser.username}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {userData?.email || selectedUser.email}
                </div>
              </div>

              {/* View toggle */}
              <div className="admin-sub-view-toggle">
                <button
                  className={`btn btn-sm${view === 'submissions' ? ' btn-primary' : ' btn-ghost'} mono`}
                  onClick={() => setView('submissions')}
                >
                  Submissions
                </button>
                <button
                  className={`btn btn-sm${view === 'sessions' ? ' btn-primary' : ' btn-ghost'} mono`}
                  onClick={() => setView('sessions')}
                >
                  Sessions
                </button>
              </div>
            </div>

            {/* Filters bar */}
            <div className="admin-sub-filters">
              {/* Checkpoint filter */}
              <select
                className="admin-sub-filter-select mono"
                value={filters.checkpoint}
                onChange={e => setFilter('checkpoint', e.target.value)}
              >
                <option value="">All checkpoints</option>
                {checkpoints.map(cp => (
                  <option key={cp.slug} value={cp.slug}>{cp.name}</option>
                ))}
              </select>

              {/* Exercise filter (submissions only) */}
              {view === 'submissions' && (
                <input
                  className="admin-sub-filter-input mono"
                  placeholder="Exercise slug..."
                  value={filters.exercise}
                  onChange={e => setFilter('exercise', e.target.value)}
                />
              )}

              {/* Date range */}
              <input
                type="date"
                className="admin-sub-filter-input mono"
                value={filters.date_from}
                onChange={e => setFilter('date_from', e.target.value)}
                title="From date"
              />
              <input
                type="date"
                className="admin-sub-filter-input mono"
                value={filters.date_to}
                onChange={e => setFilter('date_to', e.target.value)}
                title="To date"
              />

              {/* Status filter */}
              <select
                className="admin-sub-filter-select mono"
                value={filters.status}
                onChange={e => setFilter('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {(view === 'submissions' ? SUBMISSION_STATUSES : SESSION_STATUSES).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>

              {/* Sort (submissions only) */}
              {view === 'submissions' && (
                <select
                  className="admin-sub-filter-select mono"
                  value={filters.sort}
                  onChange={e => setFilter('sort', e.target.value)}
                >
                  <option value="-submitted_at">Newest first</option>
                  <option value="submitted_at">Oldest first</option>
                  <option value="exercise">Exercise A→Z</option>
                  <option value="-exercise">Exercise Z→A</option>
                  <option value="difficulty">Difficulty ↑</option>
                  <option value="-difficulty">Difficulty ↓</option>
                </select>
              )}

              {/* Reset */}
              <button
                className="btn btn-ghost btn-sm mono"
                onClick={() => setFilters({
                  checkpoint: '', exercise: '', date_from: '',
                  date_to: '', status: '', sort: '-submitted_at',
                })}
              >
                Reset
              </button>
            </div>

            {/* Count */}
            <div className="admin-sub-count mono">
              {dataLoading ? 'Loading...' : (
                view === 'submissions'
                  ? `${submissions.length} submission${submissions.length !== 1 ? 's' : ''}`
                  : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`
              )}
            </div>

            {/* Table */}
            {dataLoading ? (
              <div className="admin-sub-empty mono">Loading...</div>
            ) : view === 'submissions' ? (
              <SubmissionsTable submissions={submissions} />
            ) : (
              <SessionsTable sessions={sessions} />
            )}
          </>
        )}
      </div>
    </div>
  );
}