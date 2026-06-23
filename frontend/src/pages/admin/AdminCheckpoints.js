import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../../components/admin/Modal';
import { adminGetCheckpoints, adminCreateCheckpoint, adminUpdateCheckpoint, adminDeleteCheckpoint, adminGetLanguages } from '../../api/admin';

const EMPTY = { name: '', slug: '', description: '', language: '', order: 0, is_active: true };

function CheckpointModal({ checkpoint, languages, onSave, onClose }) {
  const [form, setForm]   = useState(checkpoint || EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  const handleName = e => {
    const name = e.target.value;
    setForm(f => ({ ...f, name, slug: f.slug || name.toLowerCase().replace(/\s+/g, '-') }));
  };

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      checkpoint
        ? await adminUpdateCheckpoint(checkpoint.slug, form)
        : await adminCreateCheckpoint(form);
      onSave();
    } catch (e) {
      setError(JSON.stringify(e.response?.data || 'Error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      title={checkpoint ? `Edit — ${checkpoint.name}` : 'New Checkpoint'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : checkpoint ? 'Save changes' : 'Create checkpoint'}
          </button>
        </>
      }
    >
      {error && <div className="admin-error">{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Name</label>
          <input className="input" value={form.name} onChange={handleName} placeholder="Checkpoint 01" />
        </div>
        <div className="field">
          <label>Slug</label>
          <input className="input" value={form.slug} onChange={set('slug')} placeholder="checkpoint-01" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Language</label>
          <select value={form.language} onChange={set('language')}>
            <option value="">— select —</option>
            {languages.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Order</label>
          <input className="input" type="number" value={form.order} onChange={set('order')} />
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <textarea value={form.description} onChange={set('description')} rows={3}
          placeholder="Zone01 Go Piscine — Elementary Programming checkpoint." />
      </div>

      <label className="check-field">
        <input type="checkbox" checked={form.is_active} onChange={setCheck('is_active')} />
        <span>Active (visible to students)</span>
      </label>
    </Modal>
  );
}

export default function AdminCheckpoints() {
  const [checkpoints, setCheckpoints] = useState([]);
  const [languages,   setLanguages]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adminGetCheckpoints(), adminGetLanguages()])
      .then(([c, l]) => { setCheckpoints(c.data); setLanguages(l.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (slug, name) => {
    if (!window.confirm(`Delete checkpoint "${name}"?`)) return;
    await adminDeleteCheckpoint(slug);
    load();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Checkpoints</h1>
          <p className="admin-page-sub">Manage checkpoint events and their exercise pools</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New checkpoint</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="admin-loading">Loading...</div>
          : checkpoints.length === 0
            ? <div className="admin-empty">No checkpoints yet.</div>
            : <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Language</th>
                    <th>Exercises</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map(c => (
                    <tr key={c.id}>
                      <td className="mono">{c.name}</td>
                      <td className="mono text-muted">{c.slug}</td>
                      <td className="mono text-muted">{c.language?.name || '—'}</td>
                      <td className="mono text-teal">{c.exercise_count ?? '—'}</td>
                      <td className="mono text-muted">{c.order}</td>
                      <td>
                        <span className={`pill ${c.is_active ? 'pill-on' : 'pill-off'}`}>
                          {c.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" onClick={() => setModal(c)}>Edit</button>
                          <button className="btn-icon danger" onClick={() => handleDelete(c.slug, c.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>

      {modal && (
        <CheckpointModal
          checkpoint={modal === 'create' ? null : modal}
          languages={languages}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
