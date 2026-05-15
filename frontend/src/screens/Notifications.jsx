import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

// [HARDCODED] Replace with GET /api/notifications?outletId=<id>
const NOTIF_DATA = [
  {
    id: 1, read: false, time: '2 min ago',
    type: 'urgent',
    icon: 'ti-user-plus', iconBg: 'var(--red)', iconColor: 'var(--red-t)',
    title: 'Replacement needed — Sun 16 Morning',
    body: 'Yusuf Kim called out sick. The Morning shift on Sun 16 Jun has 1 unfilled Floor Service role.',
    action: 'approval',
  },
  {
    id: 2, read: false, time: '18 min ago',
    type: 'warning',
    icon: 'ti-exchange', iconBg: 'var(--amber)', iconColor: 'var(--amber-t)',
    title: 'Shift swap request — David Tan & Sarah Ng',
    body: 'David Tan has requested to swap his Sat 15 Jun Evening shift with Sarah Ng. Both parties have agreed.',
    action: 'approval',
  },
  {
    id: 3, read: false, time: '1h ago',
    type: 'warning',
    icon: 'ti-alert-triangle', iconBg: 'var(--amber)', iconColor: 'var(--amber-t)',
    title: 'Conflict detected — Tue 18 Jun',
    body: 'Sarah Ng has a rest gap violation on Tue 18 Jun. Her Evening shift ends at 23:00 and the next Morning shift starts at 07:00 — only 8h gap (minimum is 10h).',
    action: 'schedule',
  },
  {
    id: 4, read: true, time: '2h ago',
    type: 'info',
    icon: 'ti-circle-check', iconBg: 'var(--green)', iconColor: 'var(--green-t)',
    title: 'Schedule published — Week 25',
    body: 'Week 25 (10–16 Jun) schedule has been published. All 15 staff members have been notified via the app.',
    action: null,
  },
  {
    id: 5, read: true, time: '3h ago',
    type: 'info',
    icon: 'ti-briefcase', iconBg: 'var(--purple)', iconColor: 'var(--purple-t)',
    title: 'Krewby worker confirmed — Jamie Reyes',
    body: 'Jamie Reyes has accepted the Floor Service role for Sun 16 Jun Evening shift (18:00–23:00). Rating: ★ 4.8.',
    action: null,
  },
  {
    id: 6, read: true, time: '5h ago',
    type: 'info',
    icon: 'ti-calendar-off', iconBg: 'var(--blue)', iconColor: 'var(--blue-t)',
    title: 'Leave request — Maya Patel',
    body: 'Maya Patel has submitted an annual leave request for 20–22 Jun (3 days). Pending your approval.',
    action: 'approval',
  },
  {
    id: 7, read: true, time: 'Yesterday',
    type: 'info',
    icon: 'ti-chart-bar', iconBg: 'var(--blue)', iconColor: 'var(--blue-t)',
    title: 'Weekly report ready — Week 24',
    body: 'Your Week 24 summary is ready. Shift fill rate: 96%, avg hours per staff: 36.2h, 0 no-shows.',
    action: 'reports',
  },
];

const FILTERS = ['All', 'Unread', 'Urgent', 'Requests', 'Schedule'];

export default function Notifications({ onNavigate }) {
  const [items, setItems]       = useState(NOTIF_DATA);
  const [filter, setFilter]     = useState('All');

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead    = (id) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const dismiss     = (id) => setItems((prev) => prev.filter((n) => n.id !== id));

  const filtered = items.filter((n) => {
    if (filter === 'All')      return true;
    if (filter === 'Unread')   return !n.read;
    if (filter === 'Urgent')   return n.type === 'urgent';
    if (filter === 'Requests') return ['ti-exchange','ti-calendar-off','ti-user-plus'].includes(n.icon);
    if (filter === 'Schedule') return ['ti-alert-triangle','ti-circle-check'].includes(n.icon);
    return true;
  });

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{unreadCount} unread</span>
        </div>
        <Button variant="secondary" className="btn-sm" onClick={markAllRead}>
          <i className="ti ti-checks" aria-hidden="true" /> Mark all read
        </Button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <div
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: filter === f ? 500 : 400,
              background: filter === f ? 'var(--accent)' : 'var(--surface)',
              color: filter === f ? '#fff' : 'var(--muted)',
              border: `0.5px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}
          >
            {f}
            {f === 'Unread' && unreadCount > 0 && (
              <span style={{ marginLeft: 5, background: '#E24B4A', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10 }}>
                {unreadCount}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
          <i className="ti ti-bell-off" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>No notifications</div>
        </div>
      )}

      {filtered.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{
            borderLeft: !n.read ? '3px solid var(--accent)' : '0.5px solid var(--border)',
            borderRadius: !n.read ? '0 10px 10px 0' : 10,
            opacity: 1,
            transition: 'opacity 0.2s',
          }}
          onClick={() => markRead(n.id)}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div className="notif-icon" style={{ background: n.iconBg + '33', flexShrink: 0 }}>
              <i className={`ti ${n.icon}`} style={{ color: n.iconColor }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)' }}>{n.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{n.time}</span>
                  {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E24B4A' }} />}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>{n.body}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {n.action && (
                  <Button
                    variant="secondary"
                    className="btn-sm"
                    onClick={(e) => { e.stopPropagation(); onNavigate(n.action); }}
                  >
                    {n.action === 'approval' ? 'Review request' : n.action === 'schedule' ? 'View schedule' : 'View report'}
                    <i className="ti ti-arrow-right" style={{ fontSize: 12 }} />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="btn-sm"
                  style={{ color: 'var(--muted)' }}
                  onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
