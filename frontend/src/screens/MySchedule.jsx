import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

export default function MySchedule() {
  const [showSwap, setShowSwap] = useState(false);

  return (
    <div>
      {/* Stats */}
      <div className="stat-row stat-row-3">
        <div className="stat-card">
          <div className="stat-label">This week</div>
          <div className="stat-val">32h</div>
          <div className="stat-sub">3 shifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Next shift</div>
          <div className="stat-val">Mon</div>
          <div className="stat-sub">07:00 – 15:00</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Leave balance</div>
          <div className="stat-val">8d</div>
          <Badge cls="b-green">Annual leave</Badge>
        </div>
      </div>

      <div className="two-col">
        {/* Upcoming shifts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming shifts</span>
          </div>

          <div className="shift-row">
            <div className="shift-dot" style={{ background: '#378ADD' }} />
            <div className="shift-info">
              <div className="shift-name">Mon 10 Jun · Morning</div>
              <div className="shift-meta">07:00–15:00 · Cashier role</div>
            </div>
            <Badge cls="b-blue">Acknowledged</Badge>
          </div>

          <div className="shift-row">
            <div className="shift-dot" style={{ background: '#639922' }} />
            <div className="shift-info">
              <div className="shift-name">Wed 12 Jun · Afternoon</div>
              <div className="shift-meta">13:00–21:00 · Floor Service</div>
            </div>
            <Badge cls="b-blue">Acknowledged</Badge>
          </div>

          <div className="shift-row">
            <div className="shift-dot" style={{ background: '#7F77DD' }} />
            <div className="shift-info">
              <div className="shift-name">Fri 14 Jun · Evening</div>
              <div className="shift-meta">18:00–23:00 · Cashier role</div>
            </div>
            <Badge cls="b-amber">Pending ack.</Badge>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              className="btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setShowSwap((p) => !p)}
            >
              Request swap
            </Button>
            <Button
              variant="secondary"
              className="btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Request replacement
            </Button>
          </div>

          {/* Swap form */}
          {showSwap && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: 'var(--bg)',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
                Request shift swap
              </div>
              <div className="form-group">
                <label className="form-label">My shift</label>
                <select className="form-select">
                  <option>Fri 14 Jun · Evening</option>
                  <option>Mon 10 Jun · Morning</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Swap with</label>
                <select className="form-select">
                  <option>Sarah Ng</option>
                  <option>Amy Hassan</option>
                  <option>Yusuf Kim</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  className="btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowSwap(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Send request
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Requests */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Requests</span>
            <Button variant="primary" className="btn-sm">
              <i className="ti ti-plus" aria-hidden="true" /> New
            </Button>
          </div>

          <div className="shift-row">
            <div className="shift-info">
              <div className="shift-name">Leave — 20–22 Jun</div>
              <div className="shift-meta">Annual leave · 3 days</div>
            </div>
            <Badge cls="b-amber">Pending</Badge>
          </div>

          {/* Leave form */}
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: 'var(--bg)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>
              Submit off-day / leave
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select">
                <option>Annual leave</option>
                <option>Off-day request</option>
                <option>Medical leave</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">From</label>
                <input className="form-input" type="date" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">To</label>
                <input className="form-input" type="date" />
              </div>
            </div>
            <Button
              variant="primary"
              className="btn-sm"
              style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
