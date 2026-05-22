import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import MiniAvatar from '../components/MiniAvatar';
import { LoadingCard } from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import { WORKLOAD } from '../data/mockData';
// import { apiGetDashboardSummary } from '../services/api'; // ← uncomment when backend ready

// [HARDCODED] Replace with apiGetDashboardSummary()
const MOCK_SUMMARY = {
  shiftsToday: 3,
  shiftsAllFilled: false,
  staffOnDuty: 12,
  staffScheduled: 15,
  pendingRequests: 4,
  unfilledRoles: 2,
  conflictsFound: 2,
};

const MOCK_SHIFTS = [
  { period: 'Morning',   color: '#378ADD', roles: 'Cashier · Floor',  time: '07:00 – 15:00', staff: [{id:'RL',cls:'ma-blue'},{id:'DT',cls:'ma-green'},{id:'SN',cls:'ma-purple'},{id:'+2',cls:'ma-amber'}], unfilledCount: 0 },
  { period: 'Afternoon', color: '#639922', roles: 'Kitchen · Bar',    time: '13:00 – 21:00', staff: [{id:'MP',cls:'ma-green'},{id:'YK',cls:'ma-blue'},{id:'AH',cls:'ma-amber'}], unfilledCount: 0 },
  { period: 'Evening',   color: '#D85A30', roles: 'Floor · Cashier',  time: '18:00 – 23:00', staff: [{id:'RL',cls:'ma-amber'}], unfilledCount: 1 },
];

const MOCK_REQUESTS = [
  { id:1, icon:'ti-exchange',    iconBg:'var(--amber)',  iconColor:'var(--amber-t)',  title:'Shift swap — David ↔ Sarah', sub:'Sat 15 Jun, Evening shift', badge:'b-amber', badgeLabel:'Pending' },
  { id:2, icon:'ti-calendar-off', iconBg:'var(--blue)', iconColor:'var(--blue-t)',   title:'Leave request — Maya Patel', sub:'20–22 Jun · Annual leave',   badge:'b-amber', badgeLabel:'Pending' },
  { id:3, icon:'ti-user-plus',   iconBg:'var(--purple)',iconColor:'var(--purple-t)', title:'Replacement needed — Sun 16', sub:'Yusuf called out sick',      badge:'b-red',   badgeLabel:'Urgent' },
];

export default function Dashboard({ onNavigate }) {
  const [summary, setSummary]   = useState(MOCK_SUMMARY);
  const [shifts, setShifts]     = useState(MOCK_SHIFTS);
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  const [workload, setWorkload] = useState(WORKLOAD);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    // Swap this block in when backend is ready:
    // const load = async () => {
    //   setLoading(true);
    //   try {
    //     const data = await apiGetDashboardSummary();
    //     setSummary(data.summary);
    //     setShifts(data.shifts);
    //     setRequests(data.requests);
    //     setWorkload(data.workload);
    //   } catch (e) {
    //     setError('Could not load dashboard. Showing cached data.');
    //   } finally { setLoading(false); }
    // };
    // load();
  }, []);

  if (loading) return <LoadingCard message="Loading dashboard…" />;

  return (
    <div>
      {error && <ErrorBanner message={error} onRetry={() => setError('')} />}

      {/* ── Stat cards ── */}
      <div className="stat-row stat-row-4">
        <div className="stat-card">
          <div className="stat-label">Today's shifts</div>
          <div className="stat-val">{summary.shiftsToday}</div>
          {summary.shiftsAllFilled
            ? <Badge cls="b-green"><i className="ti ti-check" /> All filled</Badge>
            : <Badge cls="b-amber"><i className="ti ti-alert-triangle" /> {summary.unfilledRoles} unfilled</Badge>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Staff on duty</div>
          <div className="stat-val">{summary.staffOnDuty}</div>
          <div className="stat-sub">of {summary.staffScheduled} scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending requests</div>
          <div className="stat-val">{summary.pendingRequests}</div>
          {summary.pendingRequests > 0
            ? <Badge cls="b-amber"><i className="ti ti-clock" /> Needs action</Badge>
            : <Badge cls="b-green">All clear</Badge>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Conflicts</div>
          <div className="stat-val">{summary.conflictsFound}</div>
          {summary.conflictsFound > 0
            ? <Badge cls="b-red"><i className="ti ti-alert-triangle" /> Resolve</Badge>
            : <Badge cls="b-green">None</Badge>}
        </div>
      </div>

      <div className="two-col">
        {/* ── Left ── */}
        <div>
          {/* Today's shifts */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Today's shifts</span>
              <span className="card-action" onClick={() => onNavigate('schedule')}>View schedule →</span>
            </div>
            {shifts.map((s) => (
              <div className="shift-row" key={s.period}>
                <div className="shift-dot" style={{ background: s.color }} />
                <div className="shift-info">
                  <div className="shift-name">{s.period} — {s.roles}</div>
                  <div className="shift-meta">
                    {s.time} ·{' '}
                    {s.unfilledCount > 0
                      ? <span style={{ color: 'var(--red-t)' }}>{s.unfilledCount} unfilled</span>
                      : `${s.staff.length} staff`}
                  </div>
                </div>
                <div className="mini-avs">
                  {s.staff.map((av) => <MiniAvatar key={av.id} id={av.id} cls={av.cls} />)}
                  {s.unfilledCount > 0 && <div className="ma ma-red">?</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Pending requests */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pending requests</span>
              <span className="card-action" onClick={() => onNavigate('approval')}>Review all</span>
            </div>
            {requests.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', padding: '12px 0' }}>No pending requests.</div>
            ) : requests.map((r) => (
              <div className="notif-item" key={r.id}>
                <div className="notif-icon" style={{ background: r.iconBg }}>
                  <i className={`ti ${r.icon}`} style={{ color: r.iconColor }} />
                </div>
                <div className="notif-body">
                  <div className="notif-title">{r.title}</div>
                  <div className="notif-sub">{r.sub}</div>
                </div>
                <Badge cls={r.badge}>{r.badgeLabel}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right ── */}
        <div>
          {/* Workload balance */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Workload balance — this week</span>
              <span className="annot">Smart flag</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
              Team avg: 38 hrs · Flag threshold: ±20%
            </div>
            {workload.map((w) => (
              <div className="wl-row" key={w.id}>
                <MiniAvatar id={w.id} cls={w.cls} size={26} />
                <div className="wl-bar-wrap">
                  <div className="wl-bar" style={{ width: `${w.pct}%`, background: w.warn ? 'var(--amber-t)' : 'var(--accent)' }} />
                </div>
                <div className="wl-val" style={{ color: w.warn ? 'var(--amber-t)' : 'var(--text)' }}>{w.hours}</div>
              </div>
            ))}
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Notifications</span>
              <span className="card-action" onClick={() => onNavigate('notifications')}>View all</span>
            </div>
            <div className="notif-item">
              <div className="notif-icon" style={{ background: 'var(--green)' }}>
                <i className="ti ti-circle-check" style={{ color: 'var(--green-t)' }} />
              </div>
              <div className="notif-body">
                <div className="notif-title">Schedule published — Week 25</div>
                <div className="notif-sub">All staff notified</div>
              </div>
              <div className="notif-time">2h ago</div>
            </div>
            <div className="notif-item">
              <div className="notif-icon" style={{ background: 'var(--red)' }}>
                <i className="ti ti-alert-circle" style={{ color: 'var(--red-t)' }} />
              </div>
              <div className="notif-body">
                <div className="notif-title">Conflict detected — Tue 18</div>
                <div className="notif-sub">Rest gap violation · Sarah Ng</div>
              </div>
              <div className="notif-time">5h ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
