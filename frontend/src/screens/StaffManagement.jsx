import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { LoadingCard } from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import { STAFF } from '../data/mockData';
// import { apiGetStaff } from '../services/api'; // ← uncomment when ready

export default function StaffManagement({ onNavigate }) {
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [roleFilter, setRole] = useState('All roles');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // const data = await apiGetStaff(); // ← real API
      // setStaff(data.staff);
      await new Promise(r => setTimeout(r, 400));
      setStaff(STAFF);
    } catch (e) {
      setError('Could not load staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = staff.filter((s) => {
    const matchName = s.name.toLowerCase().includes(search.toLowerCase());
    const matchRole =
      roleFilter === 'All roles' ||
      (roleFilter === 'Regular Staff' && s.role.startsWith('Regular')) ||
      (roleFilter === 'Outlet Casual' && s.role.startsWith('Outlet'));
    return matchName && matchRole;
  });

  if (loading) return <LoadingCard message="Loading staff…" />;

  return (
    <div>
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div style={{ display:'flex', gap: 8, marginBottom: 14, flexWrap:'wrap' }}>
        <input
          className="form-input"
          placeholder="Search staff..."
          style={{ maxWidth: 220, padding: '7px 10px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-select" style={{ maxWidth: 140 }} value={roleFilter} onChange={(e) => setRole(e.target.value)}>
          <option>All roles</option>
          <option>Regular Staff</option>
          <option>Outlet Casual</option>
        </select>
        <select className="form-select" style={{ maxWidth: 140 }}>
          <option>All skills</option>
          <option>Barista</option>
          <option>Cashier</option>
          <option>Floor Service</option>
          <option>Kitchen</option>
        </select>
        <Button variant="primary" className="btn-sm" style={{ marginLeft:'auto' }}>
          <i className="ti ti-user-plus" aria-hidden="true" /> Add staff
        </Button>
      </div>

      <div className="card">
        {filtered.length === 0 && (
          <EmptyState
            icon="ti-users"
            title={search ? 'No staff match your search' : 'No staff yet'}
            subtitle={search ? 'Try a different name or filter.' : 'Add your first staff member to get started.'}
            action={!search && <Button variant="primary" className="btn-sm"><i className="ti ti-user-plus" /> Add staff</Button>}
          />
        )}
        {filtered.map((s) => (
          <div
            className="staff-row"
            key={s.id}
            style={{ cursor:'pointer' }}
            onClick={() => onNavigate('staffprofile')}
          >
            <div className={`staff-av ma ${s.color}`}>{s.id}</div>
            <div className="staff-det">
              <div className="staff-nm">{s.name}</div>
              <div className="staff-rl">{s.role}</div>
              <div className="skill-tags">
                {s.skills.map((sk) => <span className="skill-tag" key={sk}>{sk}</span>)}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <Badge cls={s.status === 'leave' ? 'b-amber' : 'b-green'}>
                {s.status === 'leave' ? 'On leave' : 'Active'}
              </Badge>
              <div style={{ fontSize: 11, color: s.warning ? 'var(--red-t)' : 'var(--muted)', marginTop: 4 }}>
                {s.hours}
              </div>
            </div>
            <div style={{ color:'var(--muted)' }}>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
