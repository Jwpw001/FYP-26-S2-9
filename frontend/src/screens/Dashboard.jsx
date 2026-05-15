import React from 'react';
import Badge from '../components/Badge';
import MiniAvatar from '../components/MiniAvatar';
import { WORKLOAD } from '../data/mockData';

export default function Dashboard({ onNavigate }) {
  return (
    <div>
      {/* ── Stat cards ── */}
      <div className="stat-row stat-row-4">
        <div className="stat-card">
          <div className="stat-label">Today's shifts</div>
          <div className="stat-val">3</div>
          <Badge cls="b-green"><i className="ti ti-check" /> All filled</Badge>
        </div>
        <div className="stat-card">
          <div className="stat-label">Staff on duty</div>
          <div className="stat-val">12</div>
          <div className="stat-sub">of 15 scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending requests</div>
          <div className="stat-val">4</div>
          <Badge cls="b-amber"><i className="ti ti-clock" /> Needs action</Badge>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unfilled roles</div>
          <div className="stat-val">2</div>
          <Badge cls="b-red"><i className="ti ti-alert-triangle" /> Conflicts</Badge>
        </div>
      </div>

      <div className="two-col">
        {/* ── Left column ── */}
        <div>
          {/* Today's shifts */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Today's shifts</span>
              <span className="card-action" onClick={() => onNavigate('schedule')}>
                View schedule →
              </span>
            </div>

            <div className="shift-row">
              <div className="shift-dot" style={{ background: '#378ADD' }} />
              <div className="shift-info">
                <div className="shift-name">Morning — Cashier · Floor</div>
                <div className="shift-meta">07:00 – 15:00 · 5 staff</div>
              </div>
              <div className="mini-avs">
                <MiniAvatar id="RL" cls="ma-blue" />
                <MiniAvatar id="DT" cls="ma-green" />
                <MiniAvatar id="SN" cls="ma-purple" />
                <MiniAvatar id="+2" cls="ma-amber" />
              </div>
            </div>

            <div className="shift-row">
              <div className="shift-dot" style={{ background: '#639922' }} />
              <div className="shift-info">
                <div className="shift-name">Afternoon — Kitchen · Bar</div>
                <div className="shift-meta">13:00 – 21:00 · 4 staff</div>
              </div>
              <div className="mini-avs">
                <MiniAvatar id="MP" cls="ma-green" />
                <MiniAvatar id="YK" cls="ma-blue" />
                <MiniAvatar id="AH" cls="ma-amber" />
              </div>
            </div>

            <div className="shift-row">
              <div className="shift-dot" style={{ background: '#D85A30' }} />
              <div className="shift-info">
                <div className="shift-name">Evening — Floor · Cashier</div>
                <div className="shift-meta">
                  18:00 – 23:00 ·{' '}
                  <span style={{ color: 'var(--red-t)' }}>1 unfilled</span>
                </div>
              </div>
              <div className="mini-avs">
                <MiniAvatar id="RL" cls="ma-amber" />
                <div className="ma ma-red">?</div>
              </div>
            </div>
          </div>

          {/* Pending requests */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Pending requests</span>
              <span className="card-action" onClick={() => onNavigate('approval')}>
                Review all
              </span>
            </div>

            <div className="notif-item">
              <div className="notif-icon" style={{ background: 'var(--amber)' }}>
                <i className="ti ti-exchange" style={{ color: 'var(--amber-t)' }} />
              </div>
              <div className="notif-body">
                <div className="notif-title">Shift swap — David ↔ Sarah</div>
                <div className="notif-sub">Sat 15 Jun, Evening shift</div>
              </div>
              <Badge cls="b-amber">Pending</Badge>
            </div>

            <div className="notif-item">
              <div className="notif-icon" style={{ background: 'var(--blue)' }}>
                <i className="ti ti-calendar-off" style={{ color: 'var(--blue-t)' }} />
              </div>
              <div className="notif-body">
                <div className="notif-title">Leave request — Maya Patel</div>
                <div className="notif-sub">20–22 Jun · Annual leave</div>
              </div>
              <Badge cls="b-amber">Pending</Badge>
            </div>

            <div className="notif-item">
              <div className="notif-icon" style={{ background: 'var(--purple)' }}>
                <i className="ti ti-user-plus" style={{ color: 'var(--purple-t)' }} />
              </div>
              <div className="notif-body">
                <div className="notif-title">Replacement needed — Sun 16</div>
                <div className="notif-sub">Yusuf called out sick · Morning</div>
              </div>
              <Badge cls="b-red">Urgent</Badge>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
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
            {WORKLOAD.map((w) => (
              <div className="wl-row" key={w.id}>
                <MiniAvatar id={w.id} cls={w.cls} size={26} />
                <div className="wl-bar-wrap">
                  <div
                    className="wl-bar"
                    style={{
                      width: `${w.pct}%`,
                      background: w.warn ? 'var(--amber-t)' : 'var(--accent)',
                    }}
                  />
                </div>
                <div className="wl-val" style={{ color: w.warn ? 'var(--amber-t)' : 'var(--text)' }}>
                  {w.hours}
                </div>
              </div>
            ))}
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Notifications</span>
              <span className="card-action">Mark all read</span>
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
