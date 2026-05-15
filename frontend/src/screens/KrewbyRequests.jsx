import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

export default function KrewbyRequests({ onNavigate }) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>
          External casual workers via Krewby pool — coordinator-reviewed
        </div>
        <Button variant="primary" className="btn-sm">
          <i className="ti ti-plus" aria-hidden="true" /> New request
        </Button>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left: active requests ── */}
        <div>
          <div className="section-label">Active requests</div>

          {/* AI-matched request */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Floor Crew · 1 worker</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Sun 16 Jun · 18:00–23:00
                </div>
              </div>
              <Badge cls="b-amber">AI matched</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Skill: Floor Service · Pending coordinator review
            </div>
            <div style={{ borderTop: '0.5px solid var(--border-light)', paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                AI match suggestion
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  className="ma ma-blue"
                  style={{ width: 30, height: 30, fontSize: 11 }}
                >
                  JR
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Jamie Reyes</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    ★ 4.8 · 2.1km · Floor Service
                  </div>
                </div>
                <Badge cls="b-purple" style={{cursor:"pointer"}} onClick={()=>onNavigate("workerprofile")}>View profile →</Badge>
              </div>
            </div>
          </div>

          {/* Confirmed request */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Barista · 2 workers</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Fri 14 Jun · 07:00–15:00
                </div>
              </div>
              <Badge cls="b-green">Confirmed</Badge>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Workers confirmed · Awaiting clock-in
            </div>
          </div>
        </div>

        {/* ── Right: new request form ── */}
        <div>
          <div className="section-label">New Krewby request</div>
          <div className="card">
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  Request submitted
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                  AI will match and coordinator will review within 2 hours.
                </div>
                <Button
                  variant="secondary"
                  className="btn-sm"
                  onClick={() => setSubmitted(false)}
                >
                  Submit another
                </Button>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Skill required</label>
                  <select className="form-select">
                    <option>Floor Service</option>
                    <option>Barista</option>
                    <option>Cashier</option>
                    <option>Kitchen Crew</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" defaultValue="2025-06-16" />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Start time</label>
                    <input className="form-input" defaultValue="18:00" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">End time</label>
                    <input className="form-input" defaultValue="23:00" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Headcount needed</label>
                  <input className="form-input" type="number" defaultValue="1" />
                </div>
                <div className="form-group">
                  <label className="form-label">Outlet address</label>
                  <input className="form-input" defaultValue="313 Orchard Rd, #02-01" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setSubmitted(true)}
                  >
                    Submit request
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
