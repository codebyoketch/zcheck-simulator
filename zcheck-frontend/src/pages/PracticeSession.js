import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import Navbar from '../components/Navbar';
import { getRandomExercise, submitCode, startSession, endSession, createSubmissionSocket } from '../api/client';
import './PracticeSession.css';

const MONACO_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',  foreground: '4a4a5a', fontStyle: 'italic' },
    { token: 'keyword',  foreground: '7c3aed' },
    { token: 'string',   foreground: '00e5a0' },
    { token: 'number',   foreground: 'fbbf24' },
    { token: 'type',     foreground: '60a5fa' },
  ],
  colors: {
    'editor.background':           '#0d0d0f',
    'editor.foreground':           '#e8e8f0',
    'editor.lineHighlightBackground': '#141418',
    'editorLineNumber.foreground': '#2a2a35',
    'editorLineNumber.activeForeground': '#4a4a5a',
    'editor.selectionBackground':  '#7c3aed33',
    'editorCursor.foreground':     '#00e5a0',
    'editor.inactiveSelectionBackground': '#7c3aed1a',
  },
};

function DifficultyBadge({ pct }) {
  const color = pct <= 20 ? 'var(--pass)' : pct <= 50 ? 'var(--info)' : pct <= 75 ? 'var(--warn)' : 'var(--fail)';
  return <span className="diff-badge mono" style={{ color, borderColor: color }}>{pct}%</span>;
}

export default function PracticeSession() {
  const [exercise,   setExercise]   = useState(null);
  const [code,       setCode]       = useState('');
  const [session,    setSession]    = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [terminal,   setTerminal]   = useState('// Terminal output will appear here after submission.');
  const [termStatus, setTermStatus] = useState(null); // 'pass' | 'fail' | null
  const [loading,    setLoading]    = useState(true);
  const [excluded,   setExcluded]   = useState([]);
  const termRef = useRef(null);

  // Start session and load first exercise
  useEffect(() => {
    startSession({})
      .then(r => { setSession(r.data); return loadExercise([], r.data.id); })
      .catch(console.error);
    return () => {
      // Cleanup — session stays in DB, user can continue later
    };
  }, []);

  const loadExercise = useCallback(async (excludeIds = [], sessionId = session?.id) => {
    setLoading(true);
    setTerminal('// Terminal output will appear here after submission.');
    setTermStatus(null);
    try {
      const { data } = await getRandomExercise({ exclude: excludeIds });
      setExercise(data);
      setCode(data.starter_code || '');
    } catch {
      setTerminal('// No more exercises available. Great work!');
      setExercise(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminal]);

  const handleSubmit = async () => {
    if (!exercise || submitting) return;
    setSubmitting(true);
    setTermStatus(null);
    setTerminal('// Submitting...\n// Running test cases...');

    try {
      const { data: sub } = await submitCode({
        exercise_slug: exercise.slug,
        code,
        session_id: session?.id || null,
      });

      // Open WebSocket to get real-time result
      const ws = createSubmissionSocket(sub.id);

      ws.onmessage = (event) => {
        const result = JSON.parse(event.data);
        const output = result.compile_output || '';
        setTerminal(output || '// No output.');
        setTermStatus(result.status === 'accepted' ? 'pass' : 'fail');

        if (result.status === 'accepted') {
          // Auto-advance after 1.5s
          setTimeout(() => {
            const newExcluded = [...excluded, exercise.id];
            setExcluded(newExcluded);
            loadExercise(newExcluded);
          }, 1500);
        }
        setSubmitting(false);
      };

      ws.onerror = () => {
        setTerminal('// Connection error. Please try again.');
        setSubmitting(false);
      };

      ws.onclose = (e) => {
        if (e.code === 4001) {
          setTerminal('// Authentication error. Please refresh.');
          setSubmitting(false);
        }
      };

    } catch (err) {
      setTerminal(`// Submission failed: ${err.response?.data?.detail || err.message}`);
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (!exercise) return;
    const newExcluded = [...excluded, exercise.id];
    setExcluded(newExcluded);
    loadExercise(newExcluded);
  };

  const handleEditorMount = (_, monaco) => {
    monaco.editor.defineTheme('zcheck', MONACO_THEME);
    monaco.editor.setTheme('zcheck');
  };

  const termClass = termStatus === 'pass' ? 'terminal pass'
                  : termStatus === 'fail' ? 'terminal fail'
                  : 'terminal';

  return (
    <div className="session-page">
      <Navbar />

      <div className="session-layout">
        {/* ── LEFT: Instructions ───────────────────────────────────────── */}
        <div className="session-left">
          <div className="session-left-header">
            {exercise && (
              <>
                <span className="exercise-name mono">{exercise.name}</span>
                <DifficultyBadge pct={exercise.difficulty_pct} />
                {exercise.checkpoint && (
                  <span className="checkpoint-name text-muted mono">{exercise.checkpoint.name}</span>
                )}
              </>
            )}
          </div>

          <div className="instructions-body">
            {loading
              ? <div className="text-muted mono loading-text">Loading exercise...</div>
              : exercise
                ? <ReactMarkdown className="markdown">{exercise.description}</ReactMarkdown>
                : <div className="text-muted mono loading-text">No more exercises. You're done! 🎉</div>
            }
          </div>

          {/* Test case info */}
          {exercise && (
            <div className="test-info">
              <span className="mono text-muted" style={{ fontSize: 11 }}>
                {exercise.public_test_cases} public · {exercise.hidden_test_cases} hidden test cases
              </span>
              <span className="mono text-teal" style={{ fontSize: 11 }}>
                +{exercise.xp_reward} XP on pass
              </span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Editor + Terminal ──────────────────────────────────── */}
        <div className="session-right">
          {/* Editor toolbar */}
          <div className="editor-toolbar">
            <span className="editor-lang mono text-muted">
              {exercise?.language?.name || 'Go'}
            </span>
            <div className="editor-actions">
              <button className="btn btn-ghost btn-sm" onClick={handleSkip} disabled={loading || submitting}>
                Skip →
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={loading || submitting || !exercise}
              >
                {submitting
                  ? <><span className="spinner" /> Running...</>
                  : 'Submit'
                }
              </button>
            </div>
          </div>

          {/* Monaco editor */}
          <div className="editor-wrapper">
            <Editor
              height="100%"
              language={exercise?.language?.slug || 'go'}
              value={code}
              onChange={v => setCode(v || '')}
              onMount={handleEditorMount}
              theme="zcheck"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                fontLigatures: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                padding: { top: 16, bottom: 16 },
                tabSize: 4,
                insertSpaces: false,
                wordWrap: 'on',
              }}
            />
          </div>

          {/* Terminal */}
          <div className={termClass} ref={termRef}>
            <div className="terminal-header">
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                TERMINAL
              </span>
              {termStatus === 'pass' && <span className="mono" style={{ color: 'var(--pass)', fontSize: 11 }}>✓ ALL TESTS PASSED</span>}
              {termStatus === 'fail' && <span className="mono" style={{ color: 'var(--fail)', fontSize: 11 }}>✗ SOME TESTS FAILED</span>}
            </div>
            <pre className="terminal-output">{terminal}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
