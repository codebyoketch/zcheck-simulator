import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import WaveBg from '../components/WaveBg';
import { getProgress, getHistory, getCheckpoints } from '../api/client';
import './Dashboard.css';

const DIFFICULTY_LEVELS = [5,10,20,35,50,65,75,85,95,100];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card card">
      <div className="stat-value mono" style={{ color: accent || 'var(--teal)' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub mono">{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct, label }) {
  return (
    <div className="prog-row">
      <span className="prog-label mono">{label}</span>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="prog-pct mono">{pct}%</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState([]);
  const [history,  setHistory]  = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProgress(), getHistory(), getCheckpoints()])
      .then(([p, h, c]) => {
        setProgress(p.data);
        setHistory(h.data.slice(0, 8));
        setCheckpoints(c.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalExercises = progress.length;
  const passed         = progress.filter(p => p.passed).length;
  const overallPct     = totalExercises ? Math.round((passed / totalExercises) * 100) : 0;

  // Group progress by difficulty
  const byLevel = DIFFICULTY_LEVELS.map(lvl => {
    const exercises = progress.filter(p => p.exercise.difficulty_pct === lvl);
    const done      = exercises.filter(p => p.passed).length;
    return { lvl, total: exercises.length, done };
  }).filter(l => l.total > 0);

  const statusColor = s => ({
    accepted: 'var(--pass)',
    wrong_answer: 'var(--fail)',
    compile_error: 'var(--fail)',
    illegal_import: 'var(--warn)',
    time_limit: 'var(--warn)',
  }[s] || 'var(--text-muted)');

  const statusLabel = s => ({
    accepted: 'PASS',
    wrong_answer: 'FAIL',
    compile_error: 'COMPILE ERR',
    illegal_import: 'ILLEGAL IMPORT',
    time_limit: 'TLE',
    pending: 'PENDING',
    running: 'RUNNING',
  }[s] || s.toUpperCase());

  return (
    <div className="page">
      <WaveBg />
      <Navbar />

      <main className="dashboard-main">
        {/* Welcome */}
        <div className="dash-welcome">
          <div>
            <h1 className="dash-title">
              Welcome, <span className="text-teal">{user?.first_name || user?.username}</span>
            </h1>
            <p className="dash-sub text-muted">Track your checkpoint preparation progress.</p>
          </div>
          <button className="btn btn-primary dash-cta" onClick={() => navigate('/disclaimer')}>
            Start Practice →
          </button>
        </div>

        {/* Stats row */}
        <div className="dash-stats">
          <StatCard label="Level"      value={user?.level}     sub={`${user?.total_xp} XP total`} />
          <StatCard label="Exercises passed" value={`${passed}/${totalExercises}`} sub={`${overallPct}% complete`} />
          <StatCard label="Total attempts"
            value={progress.reduce((s, p) => s + p.attempts, 0)}
            accent="var(--purple)" />
          <StatCard label="Checkpoints"
            value={checkpoints.length}
            sub="available"
            accent="var(--info)" />
        </div>

        <div className="dash-grid">
          {/* Progress by difficulty */}
          <div className="card dash-section">
            <h2 className="section-title">Progress by level</h2>
            {loading
              ? <div className="text-muted mono">Loading...</div>
              : byLevel.length === 0
                ? <div className="text-muted mono">No exercises attempted yet. Start practicing!</div>
                : byLevel.map(l => (
                  <ProgressBar
                    key={l.lvl}
                    label={`${l.lvl}%`}
                    pct={l.total ? Math.round((l.done / l.total) * 100) : 0}
                  />
                ))
            }
          </div>

          {/* Recent submissions */}
          <div className="card dash-section">
            <h2 className="section-title">Recent submissions</h2>
            {loading
              ? <div className="text-muted mono">Loading...</div>
              : history.length === 0
                ? <div className="text-muted mono">No submissions yet.</div>
                : <div className="history-list">
                    {history.map(s => (
                      <div key={s.id} className="history-row">
                        <span className="history-name mono">{s.exercise_name}</span>
                        <span className="history-time text-muted mono">
                          {new Date(s.submitted_at).toLocaleDateString()}
                        </span>
                        <span className="history-status mono"
                          style={{ color: statusColor(s.status) }}>
                          {statusLabel(s.status)}
                        </span>
                      </div>
                    ))}
                  </div>
            }
          </div>
        </div>
      </main>
    </div>
  );
}
