import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

// [HARDCODED] Replace with GET /api/staff/:id
const PROFILE = {
  id: 'DT',
  name: 'David Tan',
  email: 'david.tan@krewby.com',
  phone: '+65 9123 4567',
  role: 'Regular Staff · Full-time',
  employmentType: 'Full-time',
  joinDate: '12 Mar 2023',
  outletAssigned: 'Orchard Road Outlet',
  skills: ['Floor Service', 'Cashier'],
  status: 'active',
  color: 'ma-green',
  hoursThisWeek: 32,
  hoursTarget: 40,
  shiftsThisMonth: 14,
  lateCount: 1,
  absentCount: 0,
  leaveBalance: { annual: 10, medical: 14 },
  recentShifts: [
    { date: 'Mon 10 Jun', period: 'Morning',   time: '07:00–15:00', role: 'Floor Service', status: 'on_time' },
    { date: 'Wed 12 Jun', period: 'Afternoon', time: '13:00–21:00', role: 'Cashier',       status: 'on_time' },
    { date: 'Fri 07 Jun', period: 'Evening',   time: '18:00–23:00', role: 'Floor Service', status: 'late' },
    { date: 'Mon 03 Jun', period: 'Morning',   time: '07:00–15:00', role: 'Cashier',       status: 'on_time' },
  ],
};

const ALL_SKILLS = ['Cashier', 'Floor Service', 'Barista', 'Kitchen', 'Supervisor'];

export default function StaffProfile({ onBack }) {
  const [editing, setEditing]   = useState(false);
  const [skills, setSkills]     = useState(PROFILE.skills);
  const [name, setName]         = useState(PROFILE.name);
  const [phone, setPhone]       = useState(PROFILE.phone);
  const [empType, setEmpType]   = useState(PROFILE.employmentType);
  const [saved, setSaved]       = useState(false);

  const toggleSkill = (skill) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const statusBadge = (s) =>
    s === 'on_time' ? <Badge cls="b-green">On time</Badge>
    : s === 'late'  ? <Badge cls="b-amber">Late</Badge>
    :                 <Badge cls="b-red">Absent</Badge>;

  return (
    <div>
      {/* Back nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Button variant="secondary" className="btn-sm" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </Button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Staff → {PROFILE.name}</span>
      </div>

      {saved && (
        <div style={{ background: 'var(--green)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: 'var(--green-t)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-circle-check" /> Changes saved successfully
        </div>
      )}

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left: identity + stats ── */}
        <div>
          {/* Profile card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div className={`ma ${PROFILE.color}`} style={{ width: 52, height: 52, fontSize: 16, fontWeight: 600, flexShrink: 0 }}>
                {PROFILE.id}
              </div>
              <div style={{ flex: 1 }}>
                {editing ? (
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 6 }} />
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{PROFILE.outletAssigned}</div>
                <div style={{ marginTop: 6 }}>
                  <Badge cls={PROFILE.status === 'active' ? 'b-green' : 'b-amber'}>
                    {PROFILE.status === 'active' ? 'Active' : 'On leave'}
                  </Badge>
                </div>
              </div>
              {!editing ? (
                <Button variant="secondary" className="btn-sm" onClick={() => setEditing(true)}>
                  <i className="ti ti-edit" aria-hidden="true" /> Edit
                </Button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" className="btn-sm" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button variant="primary" className="btn-sm" onClick={handleSave}>Save</Button>
                </div>
              )}
            </div>

            {/* Contact + employment details */}
            <div style={{ borderTop: '0.5px solid var(--border-light)', paddingTop: 14 }}>
              {[
                ['Email',            PROFILE.email,    null],
                ['Phone',            phone,            editing ? <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ maxWidth: 180 }} /> : null],
                ['Employment type',  empType,          editing ? (
                  <select className="form-select" value={empType} onChange={(e) => setEmpType(e.target.value)} style={{ maxWidth: 180 }}>
                    <option>Full-time</option><option>Part-time</option><option>Casual</option>
                  </select>
                ) : null],
                ['Joined',           PROFILE.joinDate, null],
              ].map(([label, val, editEl]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '7px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  {editing && editEl ? editEl : <span style={{ fontWeight: 500 }}>{val}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Skills card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Skills</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_SKILLS.map((sk) => {
                const active = skills.includes(sk);
                return (
                  <div
                    key={sk}
                    onClick={() => editing && toggleSkill(sk)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: editing ? 'pointer' : 'default',
                      border: `0.5px solid ${active ? 'var(--green-b)' : 'var(--border)'}`,
                      background: active ? 'var(--green)' : 'var(--tag)',
                      color: active ? 'var(--green-t)' : 'var(--muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {active && <i className="ti ti-check" style={{ fontSize: 11, marginRight: 4 }} />}
                    {sk}
                  </div>
                );
              })}
            </div>
            {editing && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>Click skills to toggle on/off</div>}
          </div>

          {/* Leave balance */}
          <div className="card">
            <div className="card-header"><span className="card-title">Leave balance</span></div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[['Annual leave', PROFILE.leaveBalance.annual, 'b-green'], ['Medical leave', PROFILE.leaveBalance.medical, 'b-blue']].map(([label, days, cls]) => (
                <div key={label} style={{ flex: 1, background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 500 }}>{days}d</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: performance + history ── */}
        <div>
          {/* Stats */}
          <div className="stat-row stat-row-3" style={{ marginBottom: 12 }}>
            <div className="stat-card">
              <div className="stat-label">Hours this week</div>
              <div className="stat-val">{PROFILE.hoursThisWeek}h</div>
              <div className="stat-sub">of {PROFILE.hoursTarget}h target</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Shifts this month</div>
              <div className="stat-val">{PROFILE.shiftsThisMonth}</div>
              <Badge cls="b-blue">June</Badge>
            </div>
            <div className="stat-card">
              <div className="stat-label">Late / Absent</div>
              <div className="stat-val">{PROFILE.lateCount} / {PROFILE.absentCount}</div>
              <Badge cls={PROFILE.lateCount > 2 ? 'b-amber' : 'b-green'}>This month</Badge>
            </div>
          </div>

          {/* Recent shifts */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent shifts</span>
              <span className="card-action">View all</span>
            </div>
            {PROFILE.recentShifts.map((s, i) => (
              <div key={i} className="shift-row">
                <div className="shift-dot" style={{ background: s.period === 'Morning' ? '#378ADD' : s.period === 'Afternoon' ? '#639922' : '#7F77DD' }} />
                <div className="shift-info">
                  <div className="shift-name">{s.date} · {s.period}</div>
                  <div className="shift-meta">{s.time} · {s.role}</div>
                </div>
                {statusBadge(s.status)}
              </div>
            ))}
          </div>

          {/* Danger zone */}
          <div className="card" style={{ borderColor: 'var(--red-b)' }}>
            <div className="card-header"><span className="card-title" style={{ color: 'var(--red-t)' }}>Account actions</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" className="btn-sm"><i className="ti ti-calendar-off" aria-hidden="true" /> Put on leave</Button>
              <Button variant="secondary" className="btn-sm" style={{ color: 'var(--red-t)', borderColor: 'var(--red-b)' }}>
                <i className="ti ti-user-off" aria-hidden="true" /> Deactivate
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
