import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getRandomExercise, getAvailableLevels,
  submitCode, getSubmission, startSession, endSession,
  createSubmissionSocket,
} from '../api/client';
import './PracticeSession.css';

const DIFFICULTY_LABELS = {
  5: 'L1', 10: 'L2', 20: 'L3', 35: 'L4',
  50: 'L5', 65: 'L6', 75: 'L7', 85: 'L8',
  95: 'L9', 100: 'L10',
};

const MONACO_THEME = {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: 'comment',  foreground: '4a4a5a', fontStyle: 'italic' },
    { token: 'keyword',  foreground: '7c3aed' },
    { token: 'string',   foreground: '00e5a0' },
    { token: 'number',   foreground: 'fbbf24' },
    { token: 'type',     foreground: '60a5fa' },
  ],
  colors: {
    'editor.background':              '#0d0d0f',
    'editor.foreground':              '#e8e8f0',
    'editor.lineHighlightBackground': '#141418',
    'editorLineNumber.foreground':    '#2a2a35',
    'editorLineNumber.activeForeground': '#4a4a5a',
    'editor.selectionBackground':     '#7c3aed33',
    'editorCursor.foreground':        '#00e5a0',
  },
};

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function SessionSummary({ results, reason, onClose }) {
  const passed = results.filter(r => r.status === 'accepted').length;
  const total  = results.length;
  return (
    <div className="summary-overlay">
      <div className="summary-card card">
        <div className="summary-header">
          <div className="summary-icon">
            {reason === 'complete' ? '🏆' : reason === 'timeout' ? '⏱' : '📋'}
          </div>
          <div>
            <h2 className="summary-title mono">
              {reason === 'complete' ? 'Session Complete!' : reason === 'timeout' ? 'Time Up!' : 'Session Ended'}
            </h2>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {reason === 'complete'   ? 'You passed all available levels.' :
               reason === 'timeout'   ? 'Your timer ran out.' :
               'You terminated the session.'}
            </p>
          </div>
        </div>
        <div className="summary-stats">
          <div className="summary-stat">
            <span className="mono text-teal" style={{ fontSize: 28, fontWeight: 700 }}>{passed}/{total}</span>
            <span className="text-muted" style={{ fontSize: 12 }}>levels passed</span>
          </div>
          <div className="summary-stat">
            <span className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--purple)' }}>
              {total ? Math.round((passed / total) * 100) : 0}%
            </span>
            <span className="text-muted" style={{ fontSize: 12 }}>completion</span>
          </div>
        </div>
        <div className="summary-levels">
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Level breakdown
          </div>
          {results.map((r, i) => (
            <div key={i} className="summary-level-row">
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', width: 32 }}>
                {DIFFICULTY_LABELS[r.difficulty_pct] || r.difficulty_pct + '%'}
              </span>
              <span className="mono" style={{ flex: 1, fontSize: 13 }}>{r.exercise_name}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 12 }}>
                {r.attempts} attempt{r.attempts !== 1 ? 's' : ''}
              </span>
              <span className="mono" style={{
                fontSize: 11, fontWeight: 700,
                color: r.status === 'accepted' ? 'var(--pass)' : 'var(--fail)',
              }}>
                {r.status === 'accepted' ? 'PASS' : 'FAIL'}
              </span>
            </div>
          ))}
        </div>
        <div className="summary-actions">
          <button className="btn btn-ghost" onClick={onClose}>← Dashboard</button>
          <button className="btn btn-primary" onClick={() => { window.location.href = '/disclaimer'; }}>
            Try again →
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelBar({ levels, currentLevelIndex, levelResults }) {
  return (
    <div className="level-bar">
      {levels.map((lvl, i) => {
        const result    = levelResults[i];
        const isCurrent = i === currentLevelIndex;
        const isPassed  = result?.status === 'accepted';
        const isFailed  = result && result.status !== 'accepted';
        const isLocked  = i > currentLevelIndex;
        return (
          <div key={lvl}
            className={`level-pip${isCurrent ? ' current' : ''}${isPassed ? ' passed' : ''}${isFailed ? ' failed' : ''}${isLocked ? ' locked' : ''}`}
            title={`${lvl}%`}>
            <span className="mono">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PracticeSession() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const checkpointSlug = searchParams.get('checkpoint');
  const languageSlug   = searchParams.get('language');
  const timerSeconds   = parseInt(searchParams.get('timer') || '0');

  const [levels,          setLevels]         = useState([]);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [exercise,        setExercise]        = useState(null);
  const [code,            setCode]            = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [terminal,        setTerminal]        = useState('// Terminal output will appear here after submission.');
  const [termStatus,      setTermStatus]      = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [timeLeft,        setTimeLeft]        = useState(timerSeconds || null);
  const [levelResults,    setLevelResults]    = useState([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [showSummary,     setShowSummary]     = useState(false);
  const [summaryReason,   setSummaryReason]   = useState('');
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [activeTab,       setActiveTab]       = useState('student');

  const termRef         = useRef(null);
  const sessionRef      = useRef(null);
  const timerRef        = useRef(null);
  const levelsRef       = useRef([]);
  const levelResultsRef = useRef([]);

  // Keep refs in sync
  useEffect(() => { levelsRef.current = levels; }, [levels]);
  useEffect(() => { levelResultsRef.current = levelResults; }, [levelResults]);

  // Reset tab when exercise changes
  useEffect(() => { setActiveTab('student'); }, [exercise?.slug]);

  // Timer
  useEffect(() => {
    if (!timerSeconds) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSessionEnd('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleSessionEnd = useCallback(async (reason, results) => {
    clearInterval(timerRef.current);
    const finalResults = results ?? levelResultsRef.current;
    if (sessionRef.current) {
      try { await endSession(sessionRef.current.id, { status: reason === 'complete' ? 'completed' : 'abandoned' }); }
      catch {}
    }
    setSummaryReason(reason);
    setLevelResults(finalResults);
    setShowSummary(true);
  }, []);

  const loadExerciseForLevel = useCallback(async (difficulty, lvls) => {
    setLoading(true);
    setTerminal('// Terminal output will appear here after submission.');
    setTermStatus(null);
    setCurrentAttempts(0);
    try {
      const params = { difficulty_pct: difficulty };
      if (checkpointSlug) params.checkpoint     = checkpointSlug;
      if (languageSlug)   params.language__slug = languageSlug;
      const { data } = await getRandomExercise(params);
      setExercise(data);
      setCode(data.starter_code || '');
    } catch {
      setTerminal(`// No exercises available for ${difficulty}%. Skipping...`);
    } finally {
      setLoading(false);
    }
  }, [checkpointSlug, languageSlug]);

  // Init
  useEffect(() => {
    const init = async () => {
      try {
        const params = {};
        if (checkpointSlug) params.checkpoint = checkpointSlug;
        if (languageSlug)   params.language   = languageSlug;
        const { data } = await getAvailableLevels(params);
        const lvls = data.levels;
        setLevels(lvls);
        levelsRef.current = lvls;
        const sessionPayload = checkpointSlug ? { checkpoint_slug: checkpointSlug } : {};
        const { data: sess } = await startSession(sessionPayload);
        sessionRef.current = sess;
        await loadExerciseForLevel(lvls[0], lvls);
      } catch {
        setTerminal('// Failed to start session.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSubmit = async () => {
    if (!exercise || submitting) return;
    setSubmitting(true);
    setTermStatus(null);
    setTerminal('// Submitting...\n// Running test cases...');

    try {
      const { data: sub } = await submitCode({
        exercise_slug: exercise.slug, code,
        session_id: sessionRef.current?.id || null,
      });

      let resultReceived = false;

      const handleResult = (result) => {
        if (resultReceived) return;
        resultReceived = true;
        setTerminal(result.compile_output || '// No output.');
        setTermStatus(result.status === 'accepted' ? 'pass' : 'fail');
        const attempts = currentAttempts + 1;
        setCurrentAttempts(attempts);
        if (result.status === 'accepted') {
          const levelResult = {
            difficulty_pct: exercise.difficulty_pct,
            exercise_name: exercise.name,
            status: 'accepted',
            attempts,
          };
          const newResults = [...levelResultsRef.current, levelResult];
          levelResultsRef.current = newResults;
          setLevelResults(newResults);
          const nextIdx = levelsRef.current.indexOf(exercise.difficulty_pct) + 1;
          if (nextIdx >= levelsRef.current.length) {
            setTimeout(() => handleSessionEnd('complete', newResults), 1500);
          } else {
            setTimeout(() => {
              setCurrentLevelIdx(nextIdx);
              loadExerciseForLevel(levelsRef.current[nextIdx], levelsRef.current);
            }, 1500);
          }
        }
        setSubmitting(false);
      };

      // WebSocket — primary delivery
      const ws = createSubmissionSocket(sub.id);
      ws.onmessage = (event) => {
        handleResult(JSON.parse(event.data));
        ws.close();
      };
      ws.onerror = () => { ws.close(); };

      // Polling fallback — kicks in if WebSocket doesn't deliver
      const pollInterval = setInterval(async () => {
        if (resultReceived) { clearInterval(pollInterval); return; }
        try {
          const { data } = await getSubmission(sub.id);
          if (data.status !== 'pending' && data.status !== 'running') {
            clearInterval(pollInterval);
            handleResult(data);
          }
        } catch {}
      }, 3000);

      // Clear poll after 2 minutes max
      setTimeout(() => {
        if (!resultReceived) {
          clearInterval(pollInterval);
          setTerminal('// Timed out waiting for result.');
          setSubmitting(false);
        }
      }, 120000);

    } catch (err) {
      setTerminal(`// Submission failed: ${err.response?.data?.detail || err.message}`);
      setSubmitting(false);
    }
  };

  const confirmTerminate = async () => {
    setShowConfirm(false);
    const failResult = exercise ? {
      difficulty_pct: exercise.difficulty_pct,
      exercise_name: exercise.name,
      status: 'terminated',
      attempts: currentAttempts,
    } : null;
    const finalResults = failResult ? [...levelResultsRef.current, failResult] : levelResultsRef.current;
    handleSessionEnd('terminated', finalResults);
  };

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminal]);

  const handleEditorMount = (_, monaco) => {
    monaco.editor.defineTheme('zcheck', MONACO_THEME);
    monaco.editor.setTheme('zcheck');
  };

  const termClass = `terminal${termStatus === 'pass' ? ' pass' : termStatus === 'fail' ? ' fail' : ''}`;

  return (
    <div className="session-page">
      {showSummary && (
        <SessionSummary results={levelResults} reason={summaryReason}
          onClose={() => navigate('/dashboard')} />
      )}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Terminate Session?</span>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text)' }}>
                This will end your session. Your progress will be shown in the summary.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                Come back when you're better prepared.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Keep going</button>
              <button className="btn" style={{ background: 'var(--fail)', color: '#fff' }}
                onClick={confirmTerminate}>Terminate</button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="session-topbar">
        <div className="session-brand mono">ZCheck</div>
        <div className="session-center">
          <LevelBar levels={levels} currentLevelIndex={currentLevelIdx} levelResults={levelResults} />
          {levels[currentLevelIdx] && (
            <span className="session-level-label mono">
              Level {currentLevelIdx + 1} of {levels.length} — {levels[currentLevelIdx]}%
            </span>
          )}
        </div>
        <div className="session-topbar-right">
          {timeLeft !== null && (
            <div className={`session-timer mono${timeLeft < 300 ? ' warning' : ''}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
          <button className="btn btn-ghost session-terminate" onClick={() => setShowConfirm(true)}>
            Terminate
          </button>
        </div>
      </div>

      <div className="session-layout">
        <div className="session-left">
          <div className="session-left-header">
            {exercise && (
              <>
                <span className="exercise-name mono">{exercise.name}</span>
                <span className="diff-badge mono">
                  {exercise.difficulty_pct}%
                </span>
              </>
            )}
          </div>
          <div className="instructions-body">
            {loading
              ? <div className="text-muted mono loading-text">Loading exercise...</div>
              : exercise
                ? <ReactMarkdown className="markdown">{exercise.description}</ReactMarkdown>
                : <div className="text-muted mono loading-text">All levels complete! 🎉</div>
            }
          </div>
          {exercise && (
            <div className="test-info">
              <span className="mono text-muted" style={{ fontSize: 11 }}>
                {exercise.public_test_cases} public · {exercise.hidden_test_cases} hidden
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--warn)' }}>
                Attempt #{currentAttempts + 1}
              </span>
            </div>
          )}
        </div>

        <div className="session-right">
          <div className="editor-toolbar">
            {/* Tabs */}
            <div className="editor-tabs">
              {exercise?.main_file && (
                <button
                  className={`editor-tab mono${activeTab === 'main' ? ' active' : ''}`}
                  onClick={() => setActiveTab('main')}
                >
                  main.go <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>read-only</span>
                </button>
              )}
              <button
                className={`editor-tab mono${activeTab === 'student' ? ' active' : ''}`}
                onClick={() => setActiveTab('student')}
              >
                {exercise?.student_filename || 'solution.go'}
              </button>
            </div>
            <div className="editor-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSubmit}
                disabled={loading || submitting || !exercise}>
                {submitting ? <><span className="spinner" /> Running...</> : 'Submit'}
              </button>
            </div>
          </div>
          <div className="editor-wrapper">
            {/* main.go tab — read only */}
            {activeTab === 'main' && exercise?.main_file && (
              <Editor
                height="100%"
                language="go"
                value={exercise.main_file}
                onMount={handleEditorMount}
                theme="zcheck"
                options={{
                  fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
                  fontLigatures: true, minimap: { enabled: false },
                  scrollBeyondLastLine: false, lineNumbers: 'on',
                  renderLineHighlight: 'line', padding: { top: 16, bottom: 16 },
                  tabSize: 4, insertSpaces: false, wordWrap: 'on',
                  readOnly: true,
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnEnter: 'off',
                  tabCompletion: 'off',
                  wordBasedSuggestions: false,
                  parameterHints: { enabled: false },
                }}
              />
            )}
            {/* Student tab — editable */}
            {activeTab === 'student' && (
              <Editor
                height="100%"
                language={exercise?.language?.slug || 'go'}
                value={code}
                onChange={v => setCode(v || '')}
                onMount={handleEditorMount}
                theme="zcheck"
                options={{
                  fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
                  fontLigatures: true, minimap: { enabled: false },
                  scrollBeyondLastLine: false, lineNumbers: 'on',
                  renderLineHighlight: 'line', padding: { top: 16, bottom: 16 },
                  tabSize: 4, insertSpaces: false, wordWrap: 'on',
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnEnter: 'off',
                  tabCompletion: 'off',
                  wordBasedSuggestions: false,
                  parameterHints: { enabled: false },
                }}
              />
            )}
          </div>
          <div className={termClass} ref={termRef}>
            <div className="terminal-header">
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>TERMINAL</span>
              {termStatus === 'pass' && (
                <span className="mono" style={{ color: 'var(--pass)', fontSize: 11 }}>✓ PASSED — advancing...</span>
              )}
              {termStatus === 'fail' && (
                <span className="mono" style={{ color: 'var(--fail)', fontSize: 11 }}>✗ FAILED — fix and resubmit</span>
              )}
            </div>
            <pre className="terminal-output">{terminal}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}