import React, { useEffect, useState } from 'react';
import { adminGetExercises, adminGetUsers, adminGetLanguages, adminGetCheckpoints } from '../../api/admin';
import '../../components/admin/AdminLayout.css';

function OverviewCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: color || 'var(--teal)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sub}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminGetExercises({ page_size: 1 }),
      adminGetUsers(),
      adminGetLanguages(),
      adminGetCheckpoints(),
    ]).then(([ex, us, la, ch]) => {
      setStats({
        exercises:   ex.data.count ?? ex.data.length,
        users:       us.data.count ?? us.data.length,
        languages:   la.data.length,
        checkpoints: ch.data.length,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Overview</h1>
          <p className="admin-page-sub">Platform at a glance</p>
        </div>
      </div>

      {loading
        ? <div className="admin-loading">Loading...</div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <OverviewCard label="Exercises"   value={stats.exercises}   sub="in question bank" />
            <OverviewCard label="Students"    value={stats.users}       sub="registered" color="var(--purple)" />
            <OverviewCard label="Languages"   value={stats.languages}   sub="configured" color="var(--info)" />
            <OverviewCard label="Checkpoints" value={stats.checkpoints} sub="available" color="var(--warn)" />
          </div>
      }

      <div style={{ marginTop: 40 }}>
        <h2 className="mono" style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Quick links
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { label: 'Add exercise',   href: '/admin/exercises' },
            { label: 'Add checkpoint', href: '/admin/checkpoints' },
            { label: 'Add language',   href: '/admin/languages' },
            { label: 'Manage users',   href: '/admin/users' },
          ].map(l => (
            <a key={l.href} href={l.href}
              className="card mono"
              style={{ fontSize: 13, color: 'var(--teal)', textDecoration: 'none', padding: '14px 18px', display: 'block' }}>
              {l.label} →
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
