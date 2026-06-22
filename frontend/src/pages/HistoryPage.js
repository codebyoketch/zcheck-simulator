import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import WaveBg from '../components/WaveBg';
import { getHistory, getProgress } from '../api/client';
import './HistoryPage.css';

const STATUS_META = {
  accepted:       { label: 'PASS',           color: 'var(--pass)' },
  wrong_answer:   { label: 'WRONG ANSWER',   color: 'var(--fail)' },
  compile_error:  { label: 'COMPILE ERROR',  color: 'var(--fail)' },
  runtime_error:  { label: 'RUNTIME ERROR',  color: 'var(--fail)' },
  time_limit:     { label: 'TIME LIMIT',     color: 'var(--warn)' },
  illegal_import: { label: 'ILLEGAL IMPORT', color: 'var(--warn)' },
  pending:        { label: 'PENDING',         color: 'var(--text-muted)' },
  running:        { label: 'RUNNING',         color: 'var(--info)' },
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage() {
  const [history,  setHistory]  = useState([]);
  const [progress, setProgress] = useState([]);
  const [filter,   setFilter]   = useState('all'); // 'all' | 'accepted' | 'failed'
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    Promise.all([getHistory(), getProgress()])
      .then(([h, p]) => { setHistory(h.data); setProgress(p.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = history.filter(s =>
    filter === 'all'      ? true :
    filter === 'accepted' ? s.status === 'accepted' :
                            s.status !== 'accepted'
  );

  const passed  = progress.filter(p => p.passed).length;
  const total   = progress.length;

  return (
    <div className="page">
      <WaveBg />
      <Navbar />

      <main className="history-main">
        <div className="history-header">
          <div>
            <h1 className="history-title mono">Submission History</h1>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {passed} of {total} exercises passed
            </p>
          </div>
          <div className="history-filters">
            {['all', 'accepted', 'failed'].map(f => (
              <button
                key={f}
                className={`filter-btn mono ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading
          ? <div className="text-muted mono">Loading...</div>
          : filtered.length === 0
            ? <div className="empty-state card">
                <span className="mono text-muted">No submissions yet. Start practicing!</span>
              </div>
            : <div className="submissions-list">
                {filtered.map(s => {
                  const meta = STATUS_META[s.status] || { label: s.status, color: 'var(--text-muted)' };
                  const isOpen = expanded === s.id;
                  return (
                    <div key={s.id} className={`sub-card card ${isOpen ? 'open' : ''}`}>
                      <div className="sub-row" onClick={() => setExpanded(isOpen ? null : s.id)}>
                        <span className="sub-status mono" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="sub-name mono">{s.exercise_name}</span>
                        <span className="sub-date text-muted mono">{formatDate(s.submitted_at)}</span>
                        <span className="sub-toggle text-muted">{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {isOpen && (
                        <div className="sub-detail">
                          {/* Test results */}
                          {s.test_results?.length > 0 && (
                            <div className="test-results">
                              {s.test_results.map((r, i) => (
                                <div key={i} className={`test-result-row ${r.passed ? 'pass' : 'fail'}`}>
                                  <span className="mono" style={{ color: r.passed ? 'var(--pass)' : 'var(--fail)' }}>
                                    {r.passed ? '✅' : '❌'}
                                  </span>
                                  {r.stdin !== null
                                    ? <>
                                        <span className="tr-label text-muted mono">in:</span>
                                        <code className="tr-val">{r.stdin || '(empty)'}</code>
                                        <span className="tr-label text-muted mono">expected:</span>
                                        <code className="tr-val text-teal">{r.expected_output}</code>
                                        {!r.passed && (
                                          <>
                                            <span className="tr-label text-muted mono">got:</span>
                                            <code className="tr-val text-fail">{r.actual_output || r.error_output || '(no output)'}</code>
                                          </>
                                        )}
                                      </>
                                    : <span className="text-muted mono" style={{ fontSize: 12 }}>
                                        Hidden test — {r.passed ? 'PASSED' : 'FAILED'}
                                      </span>
                                  }
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Compile output */}
                          {s.compile_output && (
                            <pre className="sub-output">{s.compile_output}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
        }
      </main>
    </div>
  );
}
