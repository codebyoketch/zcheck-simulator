import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WaveBg from '../components/WaveBg';
import { getCheckpoints, getProgress } from '../api/client';
import './CheckpointMap.css';

function CheckpointNode({ checkpoint, progress, index, onClick, isActive }) {
  const exercises  = progress.filter(p => p.exercise.checkpoint?.slug === checkpoint.slug);
  const total      = checkpoint.exercise_count || exercises.length;
  const passed     = exercises.filter(p => p.passed).length;
  const pct        = total ? Math.round((passed / total) * 100) : 0;
  const isComplete = pct === 100;
  const isStarted  = pct > 0;

  return (
    <div
      className={`cp-node ${isComplete ? 'complete' : isStarted ? 'started' : 'locked'} ${isActive ? 'active' : ''}`}
      onClick={() => onClick(checkpoint)}
    >
      {/* Pulse ring for active/started */}
      {(isStarted && !isComplete) && <div className="cp-pulse" />}

      {/* Node circle */}
      <div className="cp-circle">
        {isComplete
          ? <span className="cp-icon">✓</span>
          : <span className="cp-icon">{index + 1}</span>
        }
      </div>

      {/* Label */}
      <div className="cp-label">
        <span className="cp-name mono">{checkpoint.name}</span>
        <span className="cp-lang mono">{checkpoint.language?.name}</span>
      </div>

      {/* Progress arc */}
      <svg className="cp-progress-ring" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="24" cy="24" r="20"
          fill="none"
          stroke={isComplete ? 'var(--teal)' : 'var(--purple)'}
          strokeWidth="2"
          strokeDasharray={`${2 * Math.PI * 20}`}
          strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>

      {/* Pct badge */}
      <div className="cp-pct mono">{pct}%</div>
    </div>
  );
}

function ConnectorLine({ from, to }) {
  return <div className="cp-connector" />;
}

function CheckpointDetail({ checkpoint, progress, onPractice }) {
  const exercises = progress.filter(p => p.exercise.checkpoint?.slug === checkpoint.slug);
  const total     = checkpoint.exercise_count || exercises.length;
  const passed    = exercises.filter(p => p.passed).length;

  const byDiff = exercises.reduce((acc, p) => {
    const d = p.exercise.difficulty_pct;
    if (!acc[d]) acc[d] = { total: 0, passed: 0 };
    acc[d].total++;
    if (p.passed) acc[d].passed++;
    return acc;
  }, {});

  return (
    <div className="cp-detail card">
      <div className="cp-detail-header">
        <div>
          <h2 className="cp-detail-title mono">{checkpoint.name}</h2>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            {checkpoint.description || `${checkpoint.language?.name} exercises`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => onPractice(checkpoint)}>
          Practice →
        </button>
      </div>

      <div className="cp-detail-stats">
        <div className="cp-stat">
          <span className="mono text-teal" style={{ fontSize: 24, fontWeight: 700 }}>{passed}/{total}</span>
          <span className="text-muted" style={{ fontSize: 12 }}>exercises passed</span>
        </div>
        <div className="cp-stat">
          <span className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple)' }}>
            {total ? Math.round((passed / total) * 100) : 0}%
          </span>
          <span className="text-muted" style={{ fontSize: 12 }}>complete</span>
        </div>
      </div>

      {/* Breakdown by difficulty */}
      {Object.keys(byDiff).length > 0 && (
        <div className="cp-breakdown">
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            By difficulty
          </div>
          {Object.entries(byDiff).sort(([a], [b]) => a - b).map(([diff, data]) => (
            <div key={diff} className="cp-diff-row">
              <span className="mono" style={{ width: 36, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>{diff}%</span>
              <div className="cp-diff-track">
                <div className="cp-diff-fill"
                  style={{ width: `${Math.round((data.passed / data.total) * 100)}%` }} />
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 40 }}>
                {data.passed}/{data.total}
              </span>
            </div>
          ))}
        </div>
      )}

      {exercises.length === 0 && (
        <p className="text-muted mono" style={{ fontSize: 13 }}>
          No attempts yet. Start practicing to see your progress here.
        </p>
      )}
    </div>
  );
}

export default function CheckpointMap() {
  const [checkpoints, setCheckpoints] = useState([]);
  const [progress,    setProgress]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getCheckpoints(), getProgress()])
      .then(([c, p]) => {
        setCheckpoints(c.data);
        setProgress(p.data);
        if (c.data.length > 0) setSelected(c.data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePractice = (checkpoint) => {
    navigate(`/disclaimer?checkpoint=${checkpoint.slug}`);
  };

  return (
    <div className="page">
      <WaveBg />
      <Navbar />

      <main className="map-main">
        <div className="map-header">
          <h1 className="map-title mono">Checkpoint Map</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Your progression through the zone01 curriculum
          </p>
        </div>

        {loading
          ? <div className="text-muted mono" style={{ padding: 40 }}>Loading...</div>
          : <div className="map-layout">
              {/* Visual map */}
              <div className="map-track">
                {checkpoints.length === 0
                  ? <div className="text-muted mono" style={{ padding: 40, textAlign: 'center' }}>
                      No checkpoints configured yet.
                    </div>
                  : checkpoints.map((cp, i) => (
                      <React.Fragment key={cp.id}>
                        <CheckpointNode
                          checkpoint={cp}
                          progress={progress}
                          index={i}
                          onClick={setSelected}
                          isActive={selected?.id === cp.id}
                        />
                        {i < checkpoints.length - 1 && <ConnectorLine />}
                      </React.Fragment>
                    ))
                }
              </div>

              {/* Detail panel */}
              {selected && (
                <CheckpointDetail
                  checkpoint={selected}
                  progress={progress}
                  onPractice={handlePractice}
                />
              )}
            </div>
        }
      </main>
    </div>
  );
}
