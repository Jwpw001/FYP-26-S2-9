import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

// [HARDCODED] Replace with GET /api/krewby/workers/:id
const WORKER = {
  id: 'JR',
  name: 'Jamie Reyes',
  color: 'ma-blue',
  rating: 4.8,
  totalJobs: 34,
  distance: '2.1km away',
  skills: ['Floor Service', 'Cashier', 'Barista'],
  bio: 'Experienced F&B worker with 3+ years in retail and cafe environments. Punctual, customer-focused, available on short notice.',
  completionRate: 97,
  lateRate: 3,
  noShowRate: 0,
  badges: ['Top Rated', 'Reliable', 'Fast Accept'],
  recentJobs: [
    { outlet: 'Bugis Junction Outlet', date: '08 Jun 2025', role: 'Floor Service', rating: 5, review: 'Excellent — showed up early and was proactive.' },
    { outlet: 'Marina Bay Outlet',     date: '01 Jun 2025', role: 'Cashier',       rating: 5, review: 'Very efficient on the till.' },
    { outlet: 'Orchard Rd Outlet',     date: '22 May 2025', role: 'Barista',       rating: 4, review: 'Good work, a bit slow during peak.' },
  ],
  availability: ['Mon','Wed','Thu','Sat','Sun'],
};

export default function KrewbyWorkerProfile({ onBack }) {
  const [accepted, setAccepted] = useState(false);

  const stars = (n) =>
    Array.from({ length: 5 }).map((_, i) => (
      <i key={i} className={`ti ti-star${i < Math.round(n) ? '-filled' : ''}`}
        style={{ color: i < Math.round(n) ? '#F5A623' : 'var(--border)', fontSize: 13 }} />
    ));

  return (
    <div>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Button variant="secondary" className="btn-sm" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </Button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Krewby Requests → Worker Profile</span>
      </div>

      {accepted && (
        <div style={{ background: 'var(--green)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--green-t)', display: 'flex', gap: 8 }}>
          <i className="ti ti-circle-check" />
          Jamie Reyes has been assigned to Floor Crew · Sun 16 Jun · Evening. They will be notified shortly.
        </div>
      )}

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left column ── */}
        <div>
          {/* Identity card */}
          <div className="card">
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              <div className={`ma ${WORKER.color}`} style={{ width: 54, height: 54, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                {WORKER.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{WORKER.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  {stars(WORKER.rating)}
                  <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>{WORKER.rating}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>({WORKER.totalJobs} jobs)</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  <i className="ti ti-map-pin" style={{ marginRight: 3 }} />{WORKER.distance}
                </div>
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {WORKER.badges.map((b) => (
                <Badge key={b} cls="b-purple"><i className="ti ti-award" /> {b}</Badge>
              ))}
            </div>

            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, borderTop: '0.5px solid var(--border-light)', paddingTop: 12 }}>
              {WORKER.bio}
            </div>
          </div>

          {/* Skills */}
          <div className="card">
            <div className="card-header"><span className="card-title">Skills</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WORKER.skills.map((sk) => (
                <span key={sk} className="skill-tag" style={{ fontSize: 12, padding: '4px 10px' }}>{sk}</span>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="card">
            <div className="card-header"><span className="card-title">Typical availability</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => {
                const avail = WORKER.availability.includes(d);
                return (
                  <div key={d} style={{
                    flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                    background: avail ? 'var(--green)' : 'var(--tag)',
                    color: avail ? 'var(--green-t)' : 'var(--muted)',
                  }}>{d}</div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div>
          {/* Performance stats */}
          <div className="stat-row stat-row-3" style={{ marginBottom: 12 }}>
            <div className="stat-card">
              <div className="stat-label">Completion rate</div>
              <div className="stat-val">{WORKER.completionRate}%</div>
              <Badge cls="b-green">Excellent</Badge>
            </div>
            <div className="stat-card">
              <div className="stat-label">Late rate</div>
              <div className="stat-val">{WORKER.lateRate}%</div>
              <Badge cls="b-green">Low</Badge>
            </div>
            <div className="stat-card">
              <div className="stat-label">No-show rate</div>
              <div className="stat-val">{WORKER.noShowRate}%</div>
              <Badge cls="b-green">0</Badge>
            </div>
          </div>

          {/* Recent jobs */}
          <div className="card">
            <div className="card-header"><span className="card-title">Recent jobs</span></div>
            {WORKER.recentJobs.map((j, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < WORKER.recentJobs.length - 1 ? '0.5px solid var(--border-light)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{j.outlet}</div>
                  <div style={{ display: 'flex', gap: 2 }}>{stars(j.rating)}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{j.date} · {j.role}</div>
                <div style={{ fontSize: 12, color: 'var(--text)', fontStyle: 'italic' }}>"{j.review}"</div>
              </div>
            ))}
          </div>

          {/* Assign action */}
          <div className="card">
            <div className="card-header"><span className="card-title">Assign to shift</span></div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>Sun 16 Jun · Evening</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>18:00–23:00 · Floor Service role</div>
            </div>
            {!accepted ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onBack}>
                  Cancel
                </Button>
                <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAccepted(true)}>
                  <i className="ti ti-circle-check" aria-hidden="true" /> Accept worker
                </Button>
              </div>
            ) : (
              <Badge cls="b-green" style={{ fontSize: 13, padding: '6px 12px' }}>
                <i className="ti ti-circle-check" /> Assigned successfully
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
