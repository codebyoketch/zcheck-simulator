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

// ── Monaco config ─────────────────────────────────────────────────────────────
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

function diffColor(pct) {
  if (pct <= 20) return '#00e5a0';
  if (pct <= 50) return '#fbbf24';
  if (pct <= 75) return '#f97316';
  return '#ef4444';
}

function fmtDuration(s) {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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

function HistoryPanel({ history, loading }) {
  if (loading) return <div className="sandbox-history-empty mono">Loading history...</div>;
  if (!history.length) return <div className="sandbox-history-empty mono">No submissions yet for this exercise.</div>;
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

// ── Robust drag divider — uses refs so callbacks never go stale ───────────────
function useDivider(onMove) {
  const onMoveRef = useRef(onMove);
  useEffect(() => { onMoveRef.current = onMove; });

  return useCallback((e) => {
    e.preventDefault();
    const move = (ev) => onMoveRef.current(ev);
    const up   = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, []); // stable — never re-created
}

// ── Scratch-pad IDE tab ───────────────────────────────────────────────────────
let scratchCounter = 1;

function ScratchTab({ label, onClose, isActive, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button
        className={`editor-tab mono${isActive ? ' active' : ''}`}
        onClick={onClick}
      >
        {label}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 12, padding: '0 3px 0 0',
          lineHeight: 1,
        }}
        title="Close scratch tab"
      >×</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExerciseSandbox() {
  const navigate = useNavigate();

  // Exercise list
  const [exercises,   setExercises]   = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [progress,    setProgress]    = useState({});
  const [search,      setSearch]      = useState('');
  const [sort,        setSort]        = useState('diff_asc');
  const [listLoading, setListLoading] = useState(true);

  // Selected exercise
  const [selected,    setSelected]    = useState(null);
  const [loadingEx,   setLoadingEx]   = useState(false);

  // Code state for main tabs
  const [code,        setCode]        = useState('');
  const [mainCode,    setMainCode]    = useState('');

  // Submission
  const [submitting,  setSubmitting]  = useState(false);
  const [terminal,    setTerminal]    = useState('// Terminal output will appear here after submission.');
  const [termStatus,  setTermStatus]  = useState(null);

  // History
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Bottom panel tab: 'terminal' | 'history'
  const [bottomTab, setBottomTab] = useState('terminal');

  // IDE tabs: built-in file tabs + scratch tabs
  // activeIdeTab: 'student' | 'main' | scratch id
  const [activeIdeTab,  setActiveIdeTab]  = useState('student');
  const [scratchTabs,   setScratchTabs]   = useState([]);  // [{id, label, code}]

  // Split state — stored as px-independent percentages
  const sidebarPctRef  = useRef(20);
  const instrPctRef    = useRef(48);
  const editorPctRef   = useRef(62);
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  // Container refs for divider calculations
  const layoutRef    = useRef(null);
  const editorColRef = useRef(null);
  const termRef      = useRef(null);
  const exerciseOpenedAt = useRef(null);

  // ── Load list ─────────────────────────────────────────────────────────────
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
        const map = {};
        (progRes.data || []).forEach(p => { map[p.exercise.slug] = { passed: p.passed }; });
        setProgress(map);
      } catch {}
      finally { setListLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminal]);

  useEffect(() => {
    if (!selected) return;
    setActiveIdeTab('student');
    setMainCode(selected.main_file || '');
    setTerminal('// Terminal output will appear here after submission.');
    setTermStatus(null);
  }, [selected?.slug]);

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
    } catch { setSelected(null); }
    finally { setLoadingEx(false); }
    try {
      const { data: hist } = await getExerciseHistory(ex.slug);
      setHistory(hist || []);
    } catch { setHistory([]); }
    finally { setHistLoading(false); }
  }, [selected?.slug]);

  // ── Scratch tabs ──────────────────────────────────────────────────────────
  const addScratchTab = () => {
    const id = `scratch-${scratchCounter++}`;
    const label = `scratch${scratchCounter - 1}.go`;
    setScratchTabs(prev => [...prev, { id, label, code: '// Scratch pad\n' }]);
    setActiveIdeTab(id);
  };

  const closeScratchTab = (id) => {
    setScratchTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeIdeTab === id) {
        setActiveIdeTab(next.length ? next[next.length - 1].id : 'student');
      }
      return next;
    });
  };

  const updateScratchCode = (id, value) => {
    setScratchTabs(prev => prev.map(t => t.id === id ? { ...t, code: value } : t));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setTermStatus(null);
    setTerminal('// Submitting...\n// Running test cases...');
    setBottomTab('terminal');

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
        if (result.status === 'accepted') {
          setProgress(prev => ({ ...prev, [selected.slug]: { passed: true } }));
        }
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
            clearInterval(poll); handleResult(data);
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

  // ── Dividers — all use refs so they never capture stale state ────────────
  const onSidebarDivider = useDivider((e) => {
    if (!layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    const pct  = ((e.clientX - rect.left) / rect.width) * 100;
    sidebarPctRef.current = Math.min(Math.max(pct, 10), instrPctRef.current - 10);
    rerender();
  });

  const onInstrDivider = useDivider((e) => {
    if (!layoutRef.current) return;
    const rect = layoutRef.current.getBoundingClientRect();
    const pct  = ((e.clientX - rect.left) / rect.width) * 100;
    instrPctRef.current = Math.min(Math.max(pct, sidebarPctRef.current + 10), 85);
    rerender();
  });

  const onEditorTermDivider = useDivider((e) => {
    if (!editorColRef.current) return;
    const rect = editorColRef.current.getBoundingClientRect();
    const pct  = ((e.clientY - rect.top) / rect.height) * 100;
    editorPctRef.current = Math.min(Math.max(pct, 15), 85);
    rerender();
  });

  const handleEditorMount = (_, monaco) => {
    monaco.editor.defineTheme('zcheck', MONACO_THEME);
    monaco.editor.setTheme('zcheck');
  };

  const filtered = sortExercises(
    exercises.filter(ex => ex.name.toLowerCase().includes(search.toLowerCase())),
    sort,
  );

  const termClass = `terminal${termStatus === 'pass' ? ' pass' : termStatus === 'fail' ? ' fail' : ''}`;

  const sidebarPct = sidebarPctRef.current;
  const instrPct   = instrPctRef.current;
  const editorPct  = editorPctRef.current;


  const tabBtn = (active) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 14px', fontSize: 11, fontFamily: 'inherit',
    color: active ? 'var(--teal)' : 'var(--text-muted)',
    borderBottom: active ? '2px solid var(--teal)' : '2px solid transparent',
  });

  // Which code/editor to show
  const activeScratch = scratchTabs.find(t => t.id === activeIdeTab);

  return (
    <div className="sandbox-page">
      {/* Top bar */}
      <div className="session-topbar">
        <button className="btn btn-ghost sandbox-back" onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <div className="session-brand mono">Sandbox</div>
        <div style={{ width: 120 }} />
      </div>

      {/* Main layout */}
      <div className="sandbox-layout" ref={layoutRef}>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="sandbox-sidebar" style={{ flex: `0 0 ${sidebarPct}%`, minWidth: 0, overflow: "hidden" }}>
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
          <div className="sandbox-exercise-list">
            {listLoading ? (
              <div className="sandbox-list-loading mono">Loading exercises...</div>
            ) : filtered.length === 0 ? (
              <div className="sandbox-list-loading mono">No exercises match.</div>
            ) : filtered.map(ex => (
              <ExerciseItem
                key={ex.slug}
                ex={ex}
                isSelected={selected?.slug === ex.slug}
                userPassed={progress[ex.slug]?.passed ?? null}
                onClick={handleSelectExercise}
              />
            ))}
          </div>
        </div>

        {/* Divider 1: sidebar ↔ instructions */}
        <div className="session-divider" onMouseDown={onSidebarDivider} style={{ flexShrink: 0, width: 5, cursor: "col-resize", background: "var(--border, #1e1e2a)", zIndex: 10 }} />

        {/* ── Instructions ─────────────────────────────────────────────── */}
        <div className="sandbox-instructions" style={{ flex: `0 0 ${instrPct - sidebarPct}%`, minWidth: 0, overflowY: "auto" }}>
          {selected
            ? <ReactMarkdown className="markdown">{selected.description}</ReactMarkdown>
            : <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>← Select an exercise</span>
          }
        </div>

        {/* Divider 2: instructions ↔ right panel */}
        <div className="session-divider" onMouseDown={onInstrDivider} style={{ flexShrink: 0, width: 5, cursor: "col-resize", background: "var(--border, #1e1e2a)", zIndex: 10 }} />

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <div className="sandbox-right" style={{ flex: `0 0 ${100 - instrPct}%`, minWidth: 0, overflow: "hidden" }}>
          {!selected && !loadingEx ? (
            <div className="sandbox-empty">
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                ← Select an exercise to begin
              </span>
            </div>
          ) : loadingEx ? (
            <div className="sandbox-empty">
              <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

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

              {/* Editor + bottom column */}
              <div
                ref={editorColRef}
                style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
              >
                {/* ── IDE tab bar ───────────────────────────────────────── */}
                <div className="editor-toolbar" style={{ alignItems: 'stretch' }}>
                  <div className="editor-tabs" style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0 }}>
                    {/* Built-in: main.go */}
                    {selected.main_file && (
                      <button
                        className={`editor-tab mono${activeIdeTab === 'main' ? ' active' : ''}`}
                        onClick={() => setActiveIdeTab('main')}
                      >
                        main.go
                      </button>
                    )}
                    {/* Built-in: solution file */}
                    <button
                      className={`editor-tab mono${activeIdeTab === 'student' ? ' active' : ''}`}
                      onClick={() => setActiveIdeTab('student')}
                    >
                      {selected.student_filename || 'solution.go'}
                    </button>
                    {/* Scratch tabs */}
                    {scratchTabs.map(t => (
                      <ScratchTab
                        key={t.id}
                        label={t.label}
                        isActive={activeIdeTab === t.id}
                        onClick={() => setActiveIdeTab(t.id)}
                        onClose={() => closeScratchTab(t.id)}
                      />
                    ))}
                    {/* Add scratch tab */}
                    <button
                      onClick={addScratchTab}
                      title="New scratch tab"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: 16, padding: '0 8px',
                        lineHeight: 1, alignSelf: 'center',
                      }}
                    >+</button>
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
                <div
                  className="editor-wrapper sandbox-editor-wrapper"
                  style={{ height: `${editorPct}%`, minHeight: 0, flexShrink: 0 }}
                >
                  {activeIdeTab === 'main' && selected.main_file && (
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
                  {activeIdeTab === 'student' && (
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
                  {activeScratch && (
                    <Editor
                      height="100%"
                      language="go"
                      value={activeScratch.code}
                      onChange={v => updateScratchCode(activeScratch.id, v || '')}
                      onMount={handleEditorMount}
                      theme="zcheck"
                      options={EDITOR_OPTIONS}
                    />
                  )}
                </div>

                {/* Divider 3: editor ↔ bottom panel */}
                <div
                  onMouseDown={onEditorTermDivider}
                  style={{
                    height: 5, flexShrink: 0, cursor: 'row-resize',
                    background: 'var(--border, #1e1e2a)',
                  }}
                />

                {/* ── Bottom panel ─────────────────────────────────────── */}
                <div style={{ height: `${100 - editorPct}%`, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

                  {/* Bottom tab bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                    borderBottom: '1px solid var(--border, #1e1e2a)',
                    background: 'var(--bg-2, #0d0d0f)',
                  }}>
                    <button className="mono" style={tabBtn(bottomTab === 'terminal')} onClick={() => setBottomTab('terminal')}>
                      Terminal
                      {termStatus === 'pass' && <span style={{ marginLeft: 5, color: 'var(--pass)' }}>✓</span>}
                      {termStatus === 'fail' && <span style={{ marginLeft: 5, color: 'var(--fail)' }}>✗</span>}
                    </button>
                    <button className="mono" style={tabBtn(bottomTab === 'history')} onClick={() => setBottomTab('history')}>
                      History
                      {history.length > 0 && (
                        <span style={{ marginLeft: 5, color: 'var(--text-muted)', fontSize: 10 }}>({history.length})</span>
                      )}
                    </button>
                  </div>

                  {/* Terminal tab */}
                  {bottomTab === 'terminal' && (
                    <div className={termClass} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <div className="terminal-header">
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>TERMINAL</span>
                        {termStatus === 'pass' && <span className="mono" style={{ color: 'var(--pass)', fontSize: 11 }}>✓ PASSED</span>}
                        {termStatus === 'fail' && <span className="mono" style={{ color: 'var(--fail)', fontSize: 11 }}>✗ FAILED — fix and resubmit</span>}
                      </div>
                      <pre className="terminal-output" ref={termRef} style={{ flex: 1, overflow: 'auto', margin: 0 }}>{terminal}</pre>
                    </div>
                  )}

                  {/* History tab */}
                  {bottomTab === 'history' && (
                    <div className="sandbox-history" style={{ flex: 1, overflow: 'auto' }}>
                      <HistoryPanel history={history} loading={histLoading} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}