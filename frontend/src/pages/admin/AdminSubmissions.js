import React, { useState, useEffect, useCallback, useMemo } from 'react'; // useMemo used in view components
import Modal from '../../components/admin/Modal';
import './AdminSubmissions.css';
import {
  adminGetUsersList,
  adminGetUserSubmissions,
  adminGetUserSessions,
  adminGetLanguages,
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

// Period helper — returns [start, end] Date objects or null
function periodBounds(period) {
  const now = new Date();
  if (period === 'today') {
    const s = new Date(now); s.setHours(0,0,0,0);
    return [s, now];
  }
  if (period === 'week') {
    const s = new Date(now); s.setDate(now.getDate() - 7);
    return [s, now];
  }
  if (period === 'month') {
    const s = new Date(now); s.setMonth(now.getMonth() - 1);
    return [s, now];
  }
  if (period === '3months') {
    const s = new Date(now); s.setMonth(now.getMonth() - 3);
    return [s, now];
  }
  return null;
}

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

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, languages, showLanguage = true, showStatus = true }) {
  return (
    <div className="admin-sub-filters">
      {/* Period preset */}
      <select
        className="admin-sub-filter-select mono"
        value={filters.period}
        onChange={e => onChange({ ...filters, period: e.target.value, dateFrom: '', dateTo: '' })}
      >
        <option value="">All time</option>
        <option value="today">Today</option>
        <option value="week">Last 7 days</option>
        <option value="month">Last 30 days</option>
        <option value="3months">Last 3 months</option>
        <option value="custom">Custom range…</option>
      </select>

      {/* Custom date range */}
      {filters.period === 'custom' && (
        <>
          <input
            type="date"
            className="admin-sub-filter-input mono"
            value={filters.dateFrom}
            onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            title="From"
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
          <input
            type="date"
            className="admin-sub-filter-input mono"
            value={filters.dateTo}
            onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            title="To"
          />
        </>
      )}

      {/* Language */}
      {showLanguage && (
        <select
          className="admin-sub-filter-select mono"
          value={filters.language}
          onChange={e => onChange({ ...filters, language: e.target.value })}
        >
          <option value="">All languages</option>
          {languages.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
        </select>
      )}

      {/* Status */}
      {showStatus && (
        <select
          className="admin-sub-filter-select mono"
          value={filters.status}
          onChange={e => onChange({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="accepted">Accepted</option>
          <option value="wrong_answer">Wrong Answer</option>
          <option value="compile_error">Compile Error</option>
          <option value="runtime_error">Runtime Error</option>
          <option value="time_limit">Time Limit</option>
          <option value="illegal_import">Illegal Import</option>
          <option value="pending">Pending</option>
        </select>
      )}

      {/* Clear */}
      {(filters.period || filters.language || filters.status) && (
        <button
          className="btn btn-ghost btn-sm mono"
          onClick={() => onChange({ period: '', dateFrom: '', dateTo: '', language: '', status: '' })}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function applyDateFilter(items, dateField, filters) {
  let list = items;

  if (filters.period && filters.period !== 'custom') {
    const bounds = periodBounds(filters.period);
    if (bounds) {
      const [s, e] = bounds;
      list = list.filter(i => {
        const d = new Date(i[dateField]);
        return d >= s && d <= e;
      });
    }
  } else if (filters.period === 'custom') {
    if (filters.dateFrom) {
      const s = new Date(filters.dateFrom);
      list = list.filter(i => new Date(i[dateField]) >= s);
    }
    if (filters.dateTo) {
      const e = new Date(filters.dateTo);
      e.setHours(23,59,59,999);
      list = list.filter(i => new Date(i[dateField]) <= e);
    }
  }

  return list;
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
          {submission.language && (
            <span className="admin-status-badge mono" style={{ color: 'var(--purple)', borderColor: 'var(--purple)' }}>
              {submission.language.toUpperCase()}
            </span>
          )}
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {fmtDate(submission.submitted_at)}
          </span>
          {submission.duration_seconds != null && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {fmtDuration(submission.duration_seconds)}
            </span>
          )}
        </div>

        {submission.compile_output && (
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--fail)',
            borderRadius: 4, padding: '8px 12px',
          }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fail)', marginBottom: 4 }}>
              COMPILE OUTPUT
            </div>
            <pre style={{
              margin: 0, fontFamily: 'monospace', fontSize: 11,
              color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
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

// ── Shared: exercise rows inside an expanded card ─────────────────────────────
const STATUS_RANK = {
  accepted: 0, time_limit: 1, illegal_import: 1,
  wrong_answer: 2, compile_error: 2, runtime_error: 2,
};

function ExerciseTable({ exercises, onViewCode }) {
  return (
    <table className="admin-table cp-exercises-table">
      <thead>
        <tr>
          <th className="mono">Exercise</th>
          <th className="mono">Result</th>
          <th className="mono">Attempts</th>
          <th className="mono">Best status</th>
          <th className="mono">Last submitted</th>
          <th className="mono">Language</th>
          <th className="mono">Difficulty</th>
          <th className="mono"></th>
        </tr>
      </thead>
      <tbody>
        {exercises.map(ex => {
          const sorted = [...ex.subs].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
          const latest = sorted[0];
          const best   = ex.subs.reduce((b, s) =>
            (STATUS_RANK[s.status] ?? 99) < (STATUS_RANK[b.status] ?? 99) ? s : b
          );
          return (
            <tr key={ex.name}>
              <td className="mono" style={{ fontSize: 12 }}>{ex.name}</td>
              <td>
                {ex.passed
                  ? <span className="mono" style={{ color: 'var(--pass)', fontSize: 11, fontWeight: 700 }}>✓ PASSED</span>
                  : <span className="mono" style={{ color: 'var(--fail)', fontSize: 11 }}>✗ NOT PASSED</span>
                }
              </td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ex.attempts}</td>
              <td><StatusBadge status={best.status} /></td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(latest.submitted_at)}</td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--purple)' }}>{latest.language || '—'}</td>
              <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{latest.difficulty_pct ?? '—'}%</td>
              <td>
                <button className="btn-icon" title="View latest code" onClick={() => onViewCode(latest)}>
                  {'</>'}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function buildExerciseMap(subs) {
  const map = {};
  subs.forEach(s => {
    const key = s.exercise_name || `exercise-${s.exercise_id}`;
    if (!map[key]) map[key] = { name: key, attempts: 0, passed: false, subs: [] };
    map[key].attempts += 1;
    map[key].subs.push(s);
    if (s.status === 'accepted') map[key].passed = true;
  });
  return Object.values(map);
}

// ── Checkpoint view ───────────────────────────────────────────────────────────
function CheckpointView({ submissions, sessions, languages }) {
  const [openId,     setOpenId]     = useState(null);
  const [viewingSub, setViewingSub] = useState(null);
  const [filters, setFilters] = useState({ period: '', dateFrom: '', dateTo: '', language: '', status: '' });

  // All subs by session — controls which cards render
  const allSubsBySession = useMemo(() => {
    const map = {};
    submissions.forEach(s => {
      const key = s.session_id ?? '__sandbox__';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [submissions]);

  // Filtered subs by session — controls what's shown inside each card
  const filteredSubsBySession = useMemo(() => {
    let list = applyDateFilter(submissions, 'submitted_at', filters);
    if (filters.language) list = list.filter(s => s.language === filters.language);
    if (filters.status)   list = list.filter(s => s.status === filters.status);
    const map = {};
    list.forEach(s => {
      const key = s.session_id ?? '__sandbox__';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [submissions, filters]);

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.started_at) - new Date(a.started_at)
  );

  const renderCard = (id, title, subtitle, status) => {
    const allSubs      = allSubsBySession[id] || [];
    const filteredSubs = filteredSubsBySession[id] || [];
    if (!allSubs.length) return null;
    const exercises   = buildExerciseMap(filteredSubs);
    const passedCount = exercises.filter(e => e.passed).length;
    const isOpen      = openId === id;

    return (
      <div key={id} className={`cp-card${isOpen ? ' cp-card--open' : ''}`}>
        <button className="cp-card-header" onClick={() => setOpenId(p => p === id ? null : id)}>
          <div className="cp-card-title">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
              {subtitle && (
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{subtitle}</span>
              )}
            </div>
          </div>
          <div className="cp-card-meta">
            {status && <StatusBadge status={status} />}
            <div className="cp-pass-bar" title={`${passedCount}/${exercises.length} exercises passed`}>
              <div
                className="cp-pass-bar-fill"
                style={{ width: exercises.length > 0 ? `${(passedCount / exercises.length) * 100}%` : '0%' }}
              />
            </div>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {passedCount}/{exercises.length} passed
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filteredSubs.length}/{allSubs.length} sub{allSubs.length !== 1 ? 's' : ''}
            </span>
            <span className="cp-chevron mono">{isOpen ? '▾' : '▸'}</span>
          </div>
        </button>

        {isOpen && (
          <div className="cp-card-body">
            <ExerciseTable exercises={exercises} onViewCode={setViewingSub} />
          </div>
        )}
      </div>
    );
  };

  const sessionCards = sortedSessions.map(sess => {
    const subtitle = [
      `Started ${fmtDate(sess.started_at)}`,
      sess.duration_seconds != null ? fmtDuration(sess.duration_seconds) : null,
    ].filter(Boolean).join(' · ');
    return renderCard(sess.id, sess.checkpoint_name || 'Unknown Checkpoint', subtitle, sess.status);
  }).filter(Boolean);

  const sandboxCard = renderCard('__sandbox__', 'Sandbox', 'Practice outside sessions', null);
  const hasAnything = sessionCards.length > 0 || !!sandboxCard;

  return (
    <div className="admin-sub-content-col">
      <FilterBar filters={filters} onChange={setFilters} languages={languages} />
      <div className="cp-drilldown">
        {!hasAnything ? (
          <div className="admin-sub-empty mono">No checkpoint sessions match the current filters.</div>
        ) : (
          <>
            {sessionCards}
            {sandboxCard}
          </>
        )}
      </div>
      {viewingSub && <CodeViewerModal submission={viewingSub} onClose={() => setViewingSub(null)} />}
    </div>
  );
}

// ── All submissions flat table ────────────────────────────────────────────────
function AllSubmissionsView({ submissions, languages }) {
  const [viewingSub, setViewingSub] = useState(null);
  const [filters, setFilters] = useState({ period: '', dateFrom: '', dateTo: '', language: '', status: '' });

  const filtered = useMemo(() => {
    let list = applyDateFilter(submissions, 'submitted_at', filters);
    if (filters.language) list = list.filter(s => s.language === filters.language);
    if (filters.status)   list = list.filter(s => s.status === filters.status);
    return [...list].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  }, [submissions, filters]);

  return (
    <div className="admin-sub-content-col">
      <FilterBar filters={filters} onChange={setFilters} languages={languages} />
      {!filtered.length ? (
        <div className="admin-sub-empty mono">No submissions match the current filters.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="mono">#</th>
                <th className="mono">Exercise</th>
                <th className="mono">Checkpoint</th>
                <th className="mono">Language</th>
                <th className="mono">Difficulty</th>
                <th className="mono">Status</th>
                <th className="mono">Submitted</th>
                <th className="mono">Duration</th>
                <th className="mono">Session</th>
                <th className="mono"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.id}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{s.exercise_name}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.checkpoint_name || '—'}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--purple)' }}>{s.language || '—'}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{s.difficulty_pct ?? '—'}%</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(s.submitted_at)}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{fmtDuration(s.duration_seconds)}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {s.session_id ? `#${s.session_id}` : 'Sandbox'}
                  </td>
                  <td>
                    <button className="btn-icon" title="View code" onClick={() => setViewingSub(s)}>
                      {'</>'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewingSub && <CodeViewerModal submission={viewingSub} onClose={() => setViewingSub(null)} />}
    </div>
  );
}

// ── Sessions flat table ───────────────────────────────────────────────────────
function SessionsView({ sessions }) {
  const [filters, setFilters] = useState({ period: '', dateFrom: '', dateTo: '', language: '', status: '' });

  const filtered = useMemo(() => {
    let list = applyDateFilter(sessions, 'started_at', filters);
    if (filters.status) list = list.filter(s => s.status === filters.status);
    return [...list].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  }, [sessions, filters]);

  return (
    <div className="admin-sub-content-col">
      <FilterBar filters={filters} onChange={setFilters} languages={[]} showLanguage={false} />
      {!filtered.length ? (
        <div className="admin-sub-empty mono">No sessions match the current filters.</div>
      ) : (
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
              {filtered.map(s => (
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
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminSubmissions() {
  const [users,        setUsers]        = useState([]);
  const [userSearch,   setUserSearch]   = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);

  const [view, setView] = useState('checkpoints');

  const [submissions, setSubmissions] = useState([]);
  const [sessions,    setSessions]    = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [userData,    setUserData]    = useState(null);

  useEffect(() => {
    adminGetUsersList()
      .then(r => setUsers(r.data || []))
      .finally(() => setUsersLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedUser) return;
    setDataLoading(true);
    try {
      const [subRes, sessRes] = await Promise.all([
        adminGetUserSubmissions(selectedUser.id, {}),
        adminGetUserSessions(selectedUser.id, {}),
      ]);
      setUserData(subRes.data.user);
      setSubmissions(subRes.data.submissions || []);
      setSessions(sessRes.data.sessions || []);
    } catch {}
    finally { setDataLoading(false); }
  }, [selectedUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Fetch full language list from API (same source as AdminLanguages page)
  const [languages, setLanguages] = useState([]);
  useEffect(() => {
    adminGetLanguages()
      .then(r => setLanguages(
        (r.data || [])
          .filter(l => l.is_active)
          .map(l => ({ slug: l.slug, name: l.name }))
      ))
      .catch(() => {});
  }, []);

  const totalPassed = submissions.filter(s => s.status === 'accepted').length;

  return (
    <div className="admin-submissions-page">

      {/* ── User sidebar ──────────────────────────────────────────────── */}
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

      {/* ── Main pane ─────────────────────────────────────────────────── */}
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
                  {!dataLoading && (
                    <span style={{ marginLeft: 12 }}>
                      {totalPassed}/{submissions.length} accepted · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* View toggle */}
              <div className="admin-sub-view-toggle">
                {[
                  { key: 'checkpoints', label: 'Checkpoints' },
                  { key: 'submissions', label: 'All Submissions' },
                  { key: 'sessions',    label: 'Sessions' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    className={`btn btn-sm${view === key ? ' btn-primary' : ' btn-ghost'} mono`}
                    onClick={() => setView(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {dataLoading ? (
              <div className="admin-sub-empty mono" style={{ padding: '32px 20px' }}>Loading...</div>
            ) : view === 'checkpoints' ? (
              <CheckpointView submissions={submissions} sessions={sessions} languages={languages} />
            ) : view === 'submissions' ? (
              <AllSubmissionsView submissions={submissions} languages={languages} />
            ) : (
              <SessionsView sessions={sessions} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
