import React, { useEffect, useState, useCallback } from 'react';
import Modal from '../../components/admin/Modal';
import { adminGetLanguages, adminCreateLanguage, adminUpdateLanguage, adminDeleteLanguage } from '../../api/admin';

const EMPTY = {
  name: '', slug: '', file_extension: '', docker_image: '',
  timeout_seconds: 10, memory_limit: '64m',
  default_forbidden_imports: '', is_active: true,
};

function LanguageModal({ lang, onSave, onClose }) {
  const [form, setForm]   = useState(lang || EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  const handleName = e => {
    const name = e.target.value;
    setForm(f => ({ ...f, name, slug: f.slug || name.toLowerCase() }));
  };

  const submit = async () => {
    setError(''); setSaving(true);
    try {
      lang ? await adminUpdateLanguage(lang.id, form) : await adminCreateLanguage(form);
      onSave();
    } catch (e) {
      setError(JSON.stringify(e.response?.data || 'Error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      title={lang ? `Edit — ${lang.name}` : 'New Language'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : lang ? 'Save changes' : 'Create language'}
          </button>
        </>
      }
    >
      {error && <div className="admin-error">{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Name</label>
          <input className="input" value={form.name} onChange={handleName} placeholder="Go" />
        </div>
        <div className="field">
          <label>Slug</label>
          <input className="input" value={form.slug} onChange={set('slug')} placeholder="go" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>File extension</label>
          <input className="input" value={form.file_extension} onChange={set('file_extension')} placeholder=".go" />
        </div>
        <div className="field">
          <label>Docker image</label>
          <input className="input" value={form.docker_image} onChange={set('docker_image')} placeholder="zcheck-go-runner:latest" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Timeout (seconds)</label>
          <input className="input" type="number" value={form.timeout_seconds} onChange={set('timeout_seconds')} />
        </div>
        <div className="field">
          <label>Memory limit</label>
          <input className="input" value={form.memory_limit} onChange={set('memory_limit')} placeholder="64m" />
        </div>
      </div>

      <div className="field">
        <label>Default forbidden imports (comma-separated)</label>
        <input className="input" value={form.default_forbidden_imports}
          onChange={set('default_forbidden_imports')} placeholder="fmt,os,net/http" />
      </div>

      <label className="check-field">
        <input type="checkbox" checked={form.is_active} onChange={setCheck('is_active')} />
        <span>Active</span>
      </label>
    </Modal>
  );
}

export default function AdminLanguages() {
  const [languages, setLanguages] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    adminGetLanguages().then(r => setLanguages(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete language "${name}"? All exercises using it will lose their language.`)) return;
    await adminDeleteLanguage(id);
    load();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Languages</h1>
          <p className="admin-page-sub">Configure language runtimes and Docker images</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>+ New language</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading
          ? <div className="admin-loading">Loading...</div>
          : languages.length === 0
            ? <div className="admin-empty">No languages configured yet.</div>
            : <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Extension</th>
                    <th>Docker image</th>
                    <th>Timeout</th>
                    <th>Memory</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {languages.map(l => (
                    <tr key={l.id}>
                      <td className="mono">{l.name}</td>
                      <td className="mono text-muted">{l.slug}</td>
                      <td className="mono text-muted">{l.file_extension}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{l.docker_image}</td>
                      <td className="mono text-muted">{l.timeout_seconds}s</td>
                      <td className="mono text-muted">{l.memory_limit}</td>
                      <td>
                        <span className={`pill ${l.is_active ? 'pill-on' : 'pill-off'}`}>
                          {l.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" onClick={() => setModal(l)}>Edit</button>
                          <button className="btn-icon danger" onClick={() => handleDelete(l.id, l.name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
      </div>

      {modal && (
        <LanguageModal
          lang={modal === 'create' ? null : modal}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
