import React, { useState } from 'react';
import Button from '../components/Button';
import ScoreBar from '../components/ScoreBar';
import { RECOMMENDATIONS } from '../data/mockData';

export default function SmartAssign({ onNavigate }) {
  const [assigned, setAssigned] = useState(null);

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Button variant="secondary" className="btn-sm" onClick={() => onNavigate('schedule')}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </Button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Schedule → Smart Assign</span>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left: shift details + filter ── */}
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <span className="card-title">Shift details</span>
              <span className="annot">Sun 16 Jun · Evening</span>
            </div>
            {[
              ['Time',               '18:00 – 23:00'],
              ['Roles needed',       'Floor (1) · Cashier (1)'],
              ['Currently assigned', 'Amy Hassan'],
              ['Unfilled',           'Floor Crew ×1'],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={k === 'Unfilled' ? { color: 'var(--red-t)', fontWeight: 500 } : {}}>
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Assign role</span>
            </div>
            <div className="form-group">
              <label className="form-label">Role to fill</label>
              <select className="form-select">
                <option>Floor Crew</option>
                <option>Cashier</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Filter by skill</label>
              <select className="form-select">
                <option>Any skill</option>
                <option>Floor Service</option>
                <option>Cashier</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Ranking: Availability → Skill match → Rest gap → Workload fairness
            </div>
          </div>
        </div>

        {/* ── Right: recommendations ── */}
        <div>
          <div className="section-label">Smart recommendations</div>

          {assigned && (
            <div
              style={{
                background: 'var(--green)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10,
                fontSize: 13,
                color: 'var(--green-t)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <i className="ti ti-circle-check" />
              {assigned} assigned to Floor Crew · Sun 16 Evening
            </div>
          )}

          {RECOMMENDATIONS.map((rec) => (
            <div className={`rec-card${rec.top ? ' top' : ''}`} key={rec.name}>
              <div className="rec-rank">{rec.rank}</div>
              <div className="rec-info">
                <div className="rec-name">{rec.name}</div>
                <div className="skill-tags" style={{ marginTop: 4 }}>
                  {rec.skills.map((s) => (
                    <span className="skill-tag" key={s}>{s}</span>
                  ))}
                </div>
                <div className="rec-reason">{rec.reason}</div>
                <div className="rec-scores">
                  {Object.entries(rec.scores).map(([label, pct]) => (
                    <ScoreBar
                      key={label}
                      label={label.charAt(0).toUpperCase() + label.slice(1)}
                      pct={pct}
                    />
                  ))}
                </div>
              </div>
              <button className="assign-btn" onClick={() => setAssigned(rec.name)}>
                Assign
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
