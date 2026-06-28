import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../../components/admin/Modal';
import {
  adminGetExercises, adminCreateExercise, adminUpdateExercise, adminDeleteExercise,
  adminGetTestCases, adminCreateTestCase, adminUpdateTestCase, adminDeleteTestCase,
} from '../../api/admin';
import { adminGetLanguages, adminGetCheckpoints } from '../../api/admin';
import '../../components/admin/AdminLayout.css';

const DIFFICULTIES = [5, 10, 20, 35, 50, 65, 75, 85, 95, 100];

const EMPTY_EXERCISE = {
  name: '', slug: '', description: '', difficulty_pct: 10,
  language: '', checkpoint: '', forbidden_imports: '',
  allowed_imports: '', starter_code: '', xp_reward: 100,
  use_language_forbidden_defaults: true, is_active: true,
  main_file: '', submit_main_file: '', student_filename: 'solution.go',
};

const EMPTY_TC = { stdin: '', expected_output: '', is_hidden: false, order: 1 };

function TestCaseRow({ tc, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(tc);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    await onSave(tc.id, form);
    setEditing(false);
  };

  if (!editing) return (
    <div className="tc-row">
      <span className="tc-vis mono">{tc.is_hidden ? '🔒 hidden' : '👁 public'}</span>
      <span className="tc-val mono" title={tc.stdin}>{tc.stdin || '(empty)'}</span>
      <span className="tc-arrow text-muted">→</span>
      <span className="tc-val mono text-teal" title={tc.expected_output}>{tc.expected_output}</span>
      <div className="row-actions">
        <button className="btn-icon" onClick={() => setEditing(true)}>Edit</button>
        <button className="btn-icon danger" onClick={() => onDelete(tc.id)}>Del</button>
      </div>
    </div>
  );

  return (
    <div className="tc-edit-row">
      <div className="field-row">
        <div className="field">
          <label>stdin (input)</label>
          <textarea value={form.stdin} onChange={set('stdin')} rows={2} placeholder="(empty for no input)" />
        </div>
        <div className="field">
          <label>expected output</label>
          <textarea value={form.expected_output} onChange={set('expected_output')} rows={2} placeholder="exact expected stdout" />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <label className="check-field">
          <input type="checkbox" checked={form.is_hidden}
            onChange={e => setForm(f => ({ ...f, is_hidden: e.target.checked }))} />
          <span>Hidden (only pass/fail shown to student)</span>
        </label>
        <div className="field" style={{ maxWidth: 80 }}>
          <label>Order</label>
          <input className="input" type="number" value={form.order} onChange={set('order')} />
        </div>
      </div>
      <div className="row-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={save}>Save</button>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

function TestCasePanel({ exerciseSlug, onClose }) {
  const [testCases, setTestCases] = useState([]);
  const [adding, setAdding]       = useState(false);
  const [newTc, setNewTc]         = useState(EMPTY_TC);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminGetTestCases(exerciseSlug)
      .then(r => setTestCases(r.data))
      .finally(() => setLoading(false));
  }, [exerciseSlug]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (id, data) => {
    await adminUpdateTestCase(id, data);
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this test case?')) return;
    await adminDeleteTestCase(id);
    load();
  };

  const handleAdd = async () => {
    setError('');
    try {
      await adminCreateTestCase(exerciseSlug, newTc);
      setNewTc(EMPTY_TC);
      setAdding(false);
      load();
    } catch (e) {
      setError(JSON.stringify(e.response?.data || 'Error'));
    }
  };

  return (
    <Modal
      title={`Test cases — ${exerciseSlug}`}
      onClose={onClose}
      footer={
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      }
    >
      {loading
        ? <div className="text-muted mono">Loading...</div>
        : <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {testCases.length} test case{testCases.length !== 1 ? 's' : ''} —&nbsp;
                {testCases.filter(t => t.is_hidden).length} hidden
              </span>
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                onClick={() => setAdding(true)}>
                + Add test case
              </button>
            </div>

            {error && <div className="admin-error">{error}</div>}

            <div className="tc-list">
              {testCases.map(tc => (
                <TestCaseRow key={tc.id} tc={tc} onSave={handleSave} onDelete={handleDelete} />
              ))}
              {testCases.length === 0 && (
                <div className="text-muted mono" style={{ fontSize: 12, textAlign: 'center', padding: 24 }}>
                  No test cases yet. Add one above.
                </div>
              )}
            </div>

            {adding && (
              <div className="tc-edit-row" style={{ marginTop: 8 }}>
                <div className="field-row">
                  <div className="field">
                    <label>stdin (input)</label>
                    <textarea value={newTc.stdin}
                      onChange={e => setNewTc(f => ({ ...f, stdin: e.target.value }))}
                      rows={2} placeholder="(empty for no input)" />
                  </div>
                  <div className="field">
                    <label>expected output</label>
                    <textarea value={newTc.expected_output}
                      onChange={e => setNewTc(f => ({ ...f, expected_output: e.target.value }))}
                      rows={2} placeholder="exact expected stdout" />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <label className="check-field">
                    <input type="checkbox" checked={newTc.is_hidden}
                      onChange={e => setNewTc(f => ({ ...f, is_hidden: e.target.checked }))} />
                    <span>Hidden</span>
                  </label>
                  <div className="field" style={{ maxWidth: 80 }}>
                    <label>Order</label>
                    <input className="input" type="number" value={newTc.order}
                      onChange={e => setNewTc(f => ({ ...f, order: e.target.value }))} />
                  </div>
                </div>
                <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleAdd}>Save</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setAdding(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
      }
    </Modal>
  );
}

function ExerciseModal({ exercise, languages, checkpoints, onSave, onClose }) {
  const [form, setForm] = useState(exercise || EMPTY_EXERCISE);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  // Auto-generate slug from name
  const handleName = e => {
    const name = e.target.value;
    setForm(f => ({ ...f, name, slug: f.slug || name.toLowerCase().replace(/\s+/g, '-') }));
  };

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      if (exercise) {
        await adminUpdateExercise(exercise.slug, form);
      } else {
        await adminCreateExercise(form);
      }
      onSave();
    } catch (e) {
      setError(JSON.stringify(e.response?.data || 'Error saving exercise.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={exercise ? `Edit — ${exercise.name}` : 'New Exercise'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : exercise ? 'Save changes' : 'Create exercise'}
          </button>
        </>
      }
    >
      {error && <div className="admin-error">{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Name</label>
          <input className="input" value={form.name} onChange={handleName} placeholder="countalpha" />
        </div>
        <div className="field">
          <label>Slug</label>
          <input className="input" value={form.slug} onChange={set('slug')} placeholder="countalpha" />
        </div>
      </div>

      <div className="field-row-3">
        <div className="field">
          <label>Difficulty %</label>
          <select value={form.difficulty_pct} onChange={set('difficulty_pct')}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}%</option>)}
          </select>
        </div>
        <div className="field">
          <label>Language</label>
          <select value={form.language} onChange={set('language')}>
            <option value="">— select —</option>
            {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>XP reward</label>
          <input className="input" type="number" value={form.xp_reward} onChange={set('xp_reward')} />
        </div>
      </div>

      <div className="field">
        <label>Checkpoint (optional)</label>
        <select value={form.checkpoint || ''} onChange={set('checkpoint')}>
          <option value="">— none —</option>
          {checkpoints.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Description (Markdown)</label>
        <textarea value={form.description} onChange={set('description')} rows={6}
          placeholder="## exercise name&#10;&#10;Write a function that..." />
      </div>

      <div className="field">
        <label>Starter code</label>
        <textarea value={form.starter_code} onChange={set('starter_code')} rows={5}
          placeholder="package main&#10;&#10;func MyFunc() {&#10;&#9;// your code here&#10;}" />
      </div>

      <div className="field">
        <label>Student filename (e.g. countalpha.go)</label>
        <input className="input" value={form.student_filename} onChange={set('student_filename')}
          placeholder="solution.go" />
      </div>

      <div className="field">
        <label>main.go (read-only tab shown to student)</label>
        <textarea value={form.main_file} onChange={set('main_file')} rows={8}
          placeholder={'package main\n\nimport (\n\t"fmt"\n)\n\nfunc main() {\n\tfmt.Println(MyFunc())\n}'}
        />
      </div>

      <div className="field">
        <label>submit main.go (hidden — used during grading, reads from stdin)</label>
        <textarea value={form.submit_main_file} onChange={set('submit_main_file')} rows={8}
          placeholder={'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\tfmt.Println(MyFunc(scanner.Text()))\n}'}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Forbidden imports (comma-separated)</label>
          <input className="input" value={form.forbidden_imports} onChange={set('forbidden_imports')}
            placeholder="fmt,os,net/http" />
        </div>
        <div className="field">
          <label>Allowed imports (comma-separated)</label>
          <input className="input" value={form.allowed_imports} onChange={set('allowed_imports')}
            placeholder="z01" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <label className="check-field">
          <input type="checkbox" checked={form.use_language_forbidden_defaults} onChange={setCheck('use_language_forbidden_defaults')} />
          <span>Use language default forbidden imports</span>
        </label>
        <label className="check-field">
          <input type="checkbox" checked={form.is_active} onChange={setCheck('is_active')} />
          <span>Active (visible to students)</span>
        </label>
      </div>
    </Modal>
  );
}

export default function AdminExercises() {
  const [exercises,    setExercises]    = useState([]);
  const [languages,    setLanguages]    = useState([]);
  const [checkpoints,  setCheckpoints]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [modal,        setModal]        = useState(null); // null | 'create' | exercise obj
  const [tcModal,      setTcModal]      = useState(null); // exercise slug

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminGetExercises({ search }),
      adminGetLanguages(),
      adminGetCheckpoints(),
    ]).then(([ex, la, ch]) => {
      setExercises(ex.data.results || ex.data);
      setLanguages(la.data);
      setCheckpoints(ch.data);
    }).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (slug) => {
    if (!window.confirm(`Delete exercise "${slug}"? This cannot be undone.`)) return;
    await adminDeleteExercise(slug);
    load();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Exercises</h1>
          <p className="admin-page-sub">{exercises.length} exercises in the question bank</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New exercise</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search exercises..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="admin-loading">Loading...</div>
          : exercises.length === 0
            ? <div className="admin-empty">No exercises found.</div>
            : <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Difficulty</th>
                    <th>Language</th>
                    <th>Checkpoint</th>
                    <th>Test cases</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map(ex => (
                    <tr key={ex.id}>
                      <td className="mono">{ex.name}</td>
                      <td className="mono" style={{ color: 'var(--teal)' }}>{ex.difficulty_pct}%</td>
                      <td className="mono text-muted">{ex.language?.name || ex.language}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{ex.checkpoint?.name || '—'}</td>
                      <td>
                        <button className="btn-icon" onClick={() => setTcModal(ex.slug)}>
                          Manage test cases
                        </button>
                      </td>
                      <td>
                        <span className={`pill ${ex.is_active ? 'pill-on' : 'pill-off'}`}>
                          {ex.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" onClick={() => setModal(ex)}>Edit</button>
                          <button className="btn-icon danger" onClick={() => handleDelete(ex.slug)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>

      {/* Exercise create/edit modal */}
      {modal && (
        <ExerciseModal
          exercise={modal === 'create' ? null : modal}
          languages={languages}
          checkpoints={checkpoints}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}

      {/* Test case modal */}
      {tcModal && (
        <TestCasePanel exerciseSlug={tcModal} onClose={() => setTcModal(null)} />
      )}
    </div>
  );
}
