import React from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import MiniAvatar from '../components/MiniAvatar';

const ATTENDANCE = [
  { id: 'RL', cls: 'ma-blue',   name: 'Rachel Lim', time: 'In 06:58', badge: 'b-green', status: 'On time' },
  { id: 'DT', cls: 'ma-green',  name: 'David Tan',  time: 'In 07:03', badge: 'b-green', status: 'On time' },
  { id: 'MP', cls: 'ma-amber',  name: 'Maya Patel', time: 'In 07:22', badge: 'b-amber', status: 'Late' },
  { id: 'YK', cls: 'ma-purple', name: 'Yusuf Kim',  time: '—',         badge: 'b-red',   status: 'Absent' },
];

const USAGE_STATS = [
  { label: 'Total requests',      value: '9',    color: null },
  { label: 'Confirmed workers',   value: '7',    color: null },
  { label: 'Cancellations',       value: '1',    color: 'var(--amber-t)' },
  { label: 'No-shows',            value: '1',    color: 'var(--red-t)' },
  { label: 'Avg worker rating',   value: '★ 4.6', color: null },
];

export default function Reports() {
  return (
    <div>
      {/* KPI Stats */}
      <div className="stat-row stat-row-3">
        <div className="stat-card">
          <div className="stat-label">Avg hours / staff</div>
          <div className="stat-val">35.8h</div>
          <Badge cls="b-green">Within target</Badge>
        </div>
        <div className="stat-card">
          <div className="stat-label">Shift fill rate</div>
          <div className="stat-val">94%</div>
          <Badge cls="b-blue">This month</Badge>
        </div>
        <div className="stat-card">
          <div className="stat-label">Krewby workers used</div>
          <div className="stat-val">7</div>
          <Badge cls="b-purple">June</Badge>
        </div>
      </div>

      <div className="two-col">
        {/* Attendance */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Attendance — today</span>
            <span className="annot">10 Jun 2025</span>
          </div>
          {ATTENDANCE.map((a) => (
            <div className="attend-row" key={a.id}>
              <MiniAvatar id={a.id} cls={a.cls} size={26} />
              <div className="attend-name">{a.name}</div>
              <div className="attend-time">{a.time}</div>
              <div className="attend-status">
                <Badge cls={a.badge}>{a.status}</Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Krewby usage */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Krewby usage — June</span>
          </div>
          <div>
            {USAGE_STATS.map((s, i) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  padding: '6px 0',
                  borderBottom:
                    i < USAGE_STATS.length - 1
                      ? '0.5px solid var(--border-light)'
                      : 'none',
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{s.label}</span>
                <span style={s.color ? { color: s.color } : {}}>{s.value}</span>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            className="btn-sm"
            style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
          >
            <i className="ti ti-download" aria-hidden="true" /> Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
