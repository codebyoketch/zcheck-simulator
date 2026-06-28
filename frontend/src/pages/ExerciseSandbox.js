import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import {
  getExercises, getExercise, getCheckpoints,
  submitCode, getSubmission,
  createSubmissionSocket,
} from '../api/client';
import { getExerciseHistory } from '../api/client';
import './ExerciseSandbox.css';

// ── Reuse same Monaco config as PracticeSession ───────────────────────────────
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
    'editor.background':                 '#0d0d0f',
    'editor.foreground':                 '#e8e8f0',
    'editor.lineHighlightBackground':    '#141418',
    'editorLineNumber.foreground':       '#2a2a35',
    'editorLineNumber.activeForeground': '#4a4a5a',
    'editor.selectionBackground':        '#7c3aed33',
    'editorCursor.foreground':           '#00e5a0',
  },
};

const EDITOR_OPTIONS = {
  fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
  fontLigatures: true, minimap: { enabled: false },
  scrollBeyondLastLine: false, lineNumbers: 'on',
  renderLineHighlight: 'line', padding: { top: 16, bottom: 16 },
  tabSize: 4, insertSpaces: false, wordWrap: 'on',
  quickSuggestions: false, suggestOnTriggerCharacters: false,
  acceptSuggestionOnEnter: 'off', tabCompletion: 'off',
  wordBasedSuggestions: false, parameterHints: { enabled: false },
};

// ── Sort options ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'name_asc',        label: 'A → Z' },
  { value: 'name_desc',       label: 'Z → A' },
  { value: 'diff_asc',        label: 'Difficulty ↑' },
  { value: 'diff_desc',       label: 'Difficulty ↓' },
  { value: 'checkpoint_asc',  label: 'Checkpoint ↑' },
  { value: 'checkpoint_desc', label: 'Checkpoint ↓' },
];

function sortExercises(exercises, sort) {
  const list = [...exercises];
  switch (sort) {
    case 'name_asc':        return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':       return list.sort((a, b) => b.name.localeCompare(a.name));
    case 'diff_asc':        return list.sort((a, b) => a.difficulty_pct - b.difficulty_pct);
    case 'diff_desc':       return list.sort((a, b) => b.difficulty_pct - a.difficulty_pct);
    case 'checkpoint_asc':  return list.sort((a, b) => (a.checkpoint?.order ?? 999) - (b.checkpoint?.order ?? 999));
    case 'checkpoint_desc': return list.sort((a, b) => (b.checkpoint?.order ?? 999) - (a.checkpoint?.order ?? 999));
    default:                return list;
  }
}

// ── Difficulty colour helper ──────────────────────────────────────────────────
function diffColor(pct) {
  if (pct <= 20)  return '#00e5a0';
  if (pct <= 50)  return '#fbbf24';
  if (pct <= 75)  return '#f97316';
  return '#ef4444';
}

// ── Format seconds → "1m 23s" ─────────────────────────────────────────────────
function fmtDuration(s) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Format ISO date → readable ────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    accepted:       { label: 'PASS',    color: 'var(--pass)' },
    wrong_answer:   { label: 'WRONG',   color: 'var(--fail)' },
    compile_error:  { label: 'COMPILE', color: 'var(--fail)' },
    runtime_error:  { label: 'RUNTIME', color: 'var(--fail)' },
    time_limit:     { label: 'TLE',     color: '#f97316' },
    illegal_import: { label: 'ILLEGAL', color: '#f97316' },
    pending:        { label: 'PENDING', color: 'var(--text-muted)' },
    running:        { label: 'RUNNING', color: 'var(--purple)' },
  };
  const { label, color } = map[status] || { label: status?.toUpperCase(), color: 'var(--text-muted)' };
  return (
    <span className="sandbox-status-badge mono" style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}

// ── Exercise list item ────────────────────────────────────────────────────────
function ExerciseItem({ ex, isSelected, userPassed, onClick }) {
  return (
    <button
      className={`sandbox-exercise-item${isSelected ? ' selected' : ''}`}
      onClick={() => onClick(ex)}
    >
      <div className="sandbox-ex-top">
        <span className="sandbox-ex-name mono">{ex.name}</span>
        {userPassed != null && (
          <span className="sandbox-ex-pass mono" style={{ color: userPassed ? 'var(--pass)' : 'var(--fail)' }}>
            {userPassed ? '✓' : '✗'}
          </span>
        )}
      </div>
      <div className="sandbox-ex-meta">
        <span className="mono" style={{ fontSize: 11, color: diffColor(ex.difficulty_pct) }}>
          {ex.difficulty_pct}%
        </span>
        {ex.checkpoint && (
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {ex.checkpoint.name}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Submission history panel ──────────────────────────────────────────────────
function HistoryPanel({ history, loading }) {
  if (loading) return (
    <div className="sandbox-history-empty mono">Loading history...</div>
  );
  if (!history.length) return (
    <div className="sandbox-history-empty mono">No submissions yet for this exercise.</div>
  );
  return (
    <div className="sandbox-history-list">
      {history.map(h => (
        <div key={h.id} className="sandbox-history-row">
          <StatusBadge status={h.status} />
          <span className="mono sandbox-history-date">{fmtDate(h.submitted_at)}</span>
          <span className="mono sandbox-history-dur" title="Time spent on exercise">
            {fmtDuration(h.duration_seconds)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExerciseSandbox() {
  const navigate = useNavigate();

  // Exercise list state
  const [exercises,   setExercises]   = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [progress,    setProgress]    = useState({});   // slug → { passed }
  const [search,      setSearch]      = useState('');
  const [sort,        setSort]        = useState('diff_asc');
  const [listLoading, setListLoading] = useState(true);

  // Selected exercise state
  const [selected,    setSelected]    = useState(null);  // full exercise object
  const [loadingEx,   setLoadingEx]   = useState(false);

  // Editor state
  const [code,        setCode]        = useState('');
  const [mainCode,    setMainCode]    = useState('');
  const [activeTab,   setActiveTab]   = useState('student');

  // Submission state
  const [submitting,  setSubmitting]  = useState(false);
  const [terminal,    setTerminal]    = useState('// Terminal output will appear here after submission.');
  const [termStatus,  setTermStatus]  = useState(null);

  // History state
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Resizable split (sidebar | editor)
  const [splitPct,    setSplitPct]    = useState(28);
  const dragging   = useRef(false);
  const layoutRef  = useRef(null);
  const termRef    = useRef(null);

  // Track when exercise was opened (for exercise_started_at)
  const exerciseOpenedAt = useRef(null);

  // ── Load exercise list + progress on mount ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setListLoading(true);
      try {
        const [exRes, cpRes, progRes] = await Promise.all([
          getExercises({ page_size: 500 }),
          getCheckpoints(),
          import('../api/client').then(m => m.getProgress()),
        ]);
        setExercises(exRes.data || []);
        setCheckpoints(cpRes.data || []);

        // Build slug → passed map from progress
        const map = {};
        (progRes.data || []).forEach(p => {
          map[p.exercise.slug] = { passed: p.passed };
        });
        setProgress(map);
      } catch {
        // list stays empty
      } finally {
        setListLoading(false);
      }
    };
    load();
  }, []);

  // ── Scroll terminal on new output ─────────────────────────────────────────
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminal]);

  // ── Reset editor when exercise changes ────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    setActiveTab('student');
    setMainCode(selected.main_file || '');
    setTerminal('// Terminal output will appear here after submission.');
    setTermStatus(null);
  }, [selected?.slug]);

  // ── Select exercise: fetch full detail + history ──────────────────────────
  const handleSelectExercise = useCallback(async (ex) => {
    if (selected?.slug === ex.slug) return;
    setLoadingEx(true);
    setHistory([]);
    setHistLoading(true);
    exerciseOpenedAt.current = new Date().toISOString();

    try {
      const { data } = await getExercise(ex.slug);
      setSelected(data);
      setCode(data.starter_code || '');
    } catch {
      setSelected(null);
    } finally {
      setLoadingEx(false);
    }

    try {
      const { data: hist } = await getExerciseHistory(ex.slug);
      setHistory(hist || []);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [selected?.slug]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setTermStatus(null);
    setTerminal('// Submitting...\n// Running test cases...');

    try {
      const { data: sub } = await submitCode({
        exercise_slug: selected.slug,
        code,
        session_id: null,
        exercise_started_at: exerciseOpenedAt.current,
      });

      let resultReceived = false;

      const handleResult = async (result) => {
        if (resultReceived) return;
        resultReceived = true;
        setTerminal(result.compile_output || '// No output.');
        setTermStatus(result.status === 'accepted' ? 'pass' : 'fail');

        // Update pass badge in the list
        if (result.status === 'accepted') {
          setProgress(prev => ({ ...prev, [selected.slug]: { passed: true } }));
        }

        // Prepend to history panel
        setHistory(prev => [{
          id: result.id,
          status: result.status,
          submitted_at: result.submitted_at,
          completed_at: result.completed_at,
          exercise_started_at: exerciseOpenedAt.current,
          duration_seconds: result.completed_at && exerciseOpenedAt.current
            ? Math.round((new Date(result.completed_at) - new Date(exerciseOpenedAt.current)) / 1000)
            : null,
        }, ...prev]);

        setSubmitting(false);
      };

      const ws = createSubmissionSocket(sub.id);
      ws.onmessage = (e) => { handleResult(JSON.parse(e.data)); ws.close(); };
      ws.onerror   = () => { ws.close(); };

      const poll = setInterval(async () => {
        if (resultReceived) { clearInterval(poll); return; }
        try {
          const { data } = await getSubmission(sub.id);
          if (data.status !== 'pending' && data.status !== 'running') {
            clearInterval(poll);
            handleResult(data);
          }
        } catch {}
      }, 3000);

      setTimeout(() => {
        if (!resultReceived) {
          clearInterval(poll);
          setTerminal('// Timed out waiting for result.');
          setSubmitting(false);
        }
      }, 120000);

    } catch (err) {
      setTerminal(`// Submission failed: ${err.response?.data?.detail || err.message}`);
      setSubmitting(false);
    }
  };

  // ── Resizable divider ─────────────────────────────────────────────────────
  const onDividerMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (e) => {
      if (!dragging.current || !layoutRef.current) return;
      const rect = layoutRef.current.getBoundingClientRect();
      const pct  = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(Math.max(pct, 16), 45));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  };

  // ── Monaco mount ─────────────────────────────────────────────────────────
  const handleEditorMount = (_, monaco) => {
    monaco.editor.defineTheme('zcheck', MONACO_THEME);
    monaco.editor.setTheme('zcheck');
  };

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = sortExercises(
    exercises.filter(ex =>
      ex.name.toLowerCase().includes(search.toLowerCase())
    ),
    sort,
  );

  const termClass = `terminal${termStatus === 'pass' ? ' pass' : termStatus === 'fail' ? ' fail' : ''}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="sandbox-page">

      {/* Top bar */}
      <div className="session-topbar">
        <button className="btn btn-ghost sandbox-back" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <div className="session-brand mono">Sandbox</div>
        <div style={{ width: 120 }} />  {/* spacer */}
      </div>

      {/* Main layout */}
      <div className="sandbox-layout" ref={layoutRef}>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="sandbox-sidebar" style={{ width: `${splitPct}%` }}>

          {/* Search + Sort */}
          <div className="sandbox-sidebar-controls">
            <input
              className="sandbox-search mono"
              placeholder="Search exercises..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="sandbox-sort mono"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Exercise list */}
          <div className="sandbox-exercise-list">
            {listLoading ? (
              <div className="sandbox-list-loading mono">Loading exercises...</div>
            ) : filtered.length === 0 ? (
              <div className="sandbox-list-loading mono">No exercises match.</div>
            ) : (
              filtered.map(ex => (
                <ExerciseItem
                  key={ex.slug}
                  ex={ex}
                  isSelected={selected?.slug === ex.slug}
                  userPassed={progress[ex.slug]?.passed ?? null}
                  onClick={handleSelectExercise}
                />
              ))
            )}
          </div>
        </div>

        {/* Resizable divider */}
        <div className="session-divider" onMouseDown={onDividerMouseDown} />

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <div className="sandbox-right" style={{ width: `${100 - splitPct}%` }}>

          {!selected && !loadingEx ? (
            <div className="sandbox-empty">
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                ← Select an exercise to begin
              </span>
            </div>
          ) : loadingEx ? (
            <div className="sandbox-empty">
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Loading...
              </span>
            </div>
          ) : (
            <>
              {/* Exercise header */}
              <div className="sandbox-ex-header">
                <div className="sandbox-ex-header-left">
                  <span className="exercise-name mono">{selected.name}</span>
                  <span
                    className="diff-badge mono"
                    style={{ color: diffColor(selected.difficulty_pct), borderColor: diffColor(selected.difficulty_pct) }}
                  >
                    {selected.difficulty_pct}%
                  </span>
                  {selected.checkpoint && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {selected.checkpoint.name}
                    </span>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selected.public_test_cases} public · {selected.hidden_test_cases} hidden
                </div>
              </div>

              {/* Description + editor split */}
              <div className="sandbox-right-body">

                {/* Instructions panel */}
                <div className="sandbox-instructions">
                  <ReactMarkdown className="markdown">{selected.description}</ReactMarkdown>
                </div>

                {/* Editor + terminal column */}
                <div className="sandbox-editor-col">

                  {/* Editor toolbar */}
                  <div className="editor-toolbar">
                    <div className="editor-tabs">
                      {selected.main_file && (
                        <button
                          className={`editor-tab mono${activeTab === 'main' ? ' active' : ''}`}
                          onClick={() => setActiveTab('main')}
                        >
                          main.go
                        </button>
                      )}
                      <button
                        className={`editor-tab mono${activeTab === 'student' ? ' active' : ''}`}
                        onClick={() => setActiveTab('student')}
                      >
                        {selected.student_filename || 'solution.go'}
                      </button>
                    </div>
                    <div className="editor-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSubmit}
                        disabled={submitting}
                      >
                        {submitting ? <><span className="spinner" /> Running...</> : 'Submit'}
                      </button>
                    </div>
                  </div>

                  {/* Monaco editor */}
                  <div className="editor-wrapper sandbox-editor-wrapper">
                    {activeTab === 'main' && selected.main_file && (
                      <Editor
                        height="100%"
                        language="go"
                        value={mainCode}
                        onChange={v => setMainCode(v || '')}
                        onMount={handleEditorMount}
                        theme="zcheck"
                        options={EDITOR_OPTIONS}
                      />
                    )}
                    {activeTab === 'student' && (
                      <Editor
                        height="100%"
                        language={selected.language?.slug || 'go'}
                        value={code}
                        onChange={v => setCode(v || '')}
                        onMount={handleEditorMount}
                        theme="zcheck"
                        options={EDITOR_OPTIONS}
                      />
                    )}
                  </div>

                  {/* Terminal */}
                  <div className={termClass} ref={termRef}>
                    <div className="terminal-header">
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>TERMINAL</span>
                      {termStatus === 'pass' && (
                        <span className="mono" style={{ color: 'var(--pass)', fontSize: 11 }}>✓ PASSED</span>
                      )}
                      {termStatus === 'fail' && (
                        <span className="mono" style={{ color: 'var(--fail)', fontSize: 11 }}>✗ FAILED — fix and resubmit</span>
                      )}
                    </div>
                    <pre className="terminal-output">{terminal}</pre>
                  </div>

                  {/* Submission history */}
                  <div className="sandbox-history">
                    <div className="sandbox-history-header mono">
                      Submission History
                    </div>
                    <HistoryPanel history={history} loading={histLoading} />
                  </div>

                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}