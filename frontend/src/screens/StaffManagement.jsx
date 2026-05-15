import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { STAFF } from '../data/mockData';

export default function StaffManagement({ onNavigate }) {
  const [search, setSearch]   = useState('');
  const [roleFilter, setRole] = useState('All roles');

  const filtered = STAFF.filter((s) => {
    const matchName = s.name.toLowerCase().includes(search.toLowerCase());
    const matchRole =
      roleFilter === 'All roles' ||
      (roleFilter === 'Regular Staff' && s.role.startsWith('Regular')) ||
      (roleFilter === 'Outlet Casual' && s.role.startsWith('Outlet'));
    return matchName && matchRole;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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
        <Button variant="primary" className="btn-sm" style={{ marginLeft: 'auto' }}>
          <i className="ti ti-user-plus" aria-hidden="true" /> Add staff
        </Button>
      </div>

      <div className="card">
        {filtered.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No staff match your search.
          </div>
        )}
        {filtered.map((s) => (
          <div
            className="staff-row"
            key={s.id}
            style={{ cursor: 'pointer' }}
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
            <div style={{ textAlign: 'right' }}>
              <Badge cls={s.status === 'leave' ? 'b-amber' : 'b-green'}>
                {s.status === 'leave' ? 'On leave' : 'Active'}
              </Badge>
              <div style={{ fontSize: 11, color: s.warning ? 'var(--red-t)' : 'var(--muted)', marginTop: 4 }}>
                {s.hours}
              </div>
            </div>
            <div style={{ color: 'var(--muted)' }}>
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
