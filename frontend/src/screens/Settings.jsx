import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

export default function Settings() {
  // [HARDCODED] Replace with GET /api/settings + PATCH /api/settings
  const [outletName, setOutletName]     = useState('Orchard Road Outlet');
  const [address, setAddress]           = useState('313 Orchard Rd, #02-01, Singapore 238895');
  const [openTime, setOpenTime]         = useState('07:00');
  const [closeTime, setCloseTime]       = useState('23:00');
  const [minRestGap, setMinRestGap]     = useState('10');
  const [maxHours, setMaxHours]         = useState('44');
  const [warnThreshold, setWarnThreshold] = useState('20');
  const [krewbyEnabled, setKrewbyEnabled] = useState(true);
  const [autoMatch, setAutoMatch]       = useState(true);
  const [notifShift, setNotifShift]     = useState(true);
  const [notifRequest, setNotifRequest] = useState(true);
  const [notifConflict, setNotifConflict] = useState(true);
  const [saved, setSaved]               = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Toggle = ({ value, onChange }) => (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', position: 'relative',
        background: value ? 'var(--accent)' : 'var(--border)',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );

  const Row = ({ label, sub, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid var(--border-light)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );

  return (
    <div>
      {saved && (
        <div style={{ background: 'var(--green)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: 'var(--green-t)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-circle-check" /> Settings saved
        </div>
      )}

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left ── */}
        <div>
          {/* Outlet details */}
          <div className="card">
            <div className="card-header"><span className="card-title">Outlet details</span></div>
            <div className="form-group">
              <label className="form-label">Outlet name</label>
              <input className="form-input" value={outletName} onChange={(e) => setOutletName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Opening time</label>
                <input className="form-input" type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Closing time</label>
                <input className="form-input" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Scheduling rules */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Scheduling rules</span>
              <span className="annot">Applied on conflict check</span>
            </div>
            <div className="form-group">
              <label className="form-label">Minimum rest gap between shifts (hours)</label>
              <input className="form-input" type="number" value={minRestGap} onChange={(e) => setMinRestGap(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Maximum hours per week</label>
              <input className="form-input" type="number" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Workload warning threshold (% deviation from avg)</label>
              <input className="form-input" type="number" value={warnThreshold} onChange={(e) => setWarnThreshold(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Right ── */}
        <div>
          {/* Krewby integration */}
          <div className="card">
            <div className="card-header"><span className="card-title">Krewby integration</span></div>
            <Row label="Enable Krewby pool" sub="Allow requesting external casual workers">
              <Toggle value={krewbyEnabled} onChange={setKrewbyEnabled} />
            </Row>
            <Row label="AI auto-match" sub="Automatically suggest top-matched workers">
              <Toggle value={autoMatch} onChange={setAutoMatch} />
            </Row>
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
              <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
              Coordinator approval is always required before a worker is confirmed, regardless of auto-match setting.
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="card-header"><span className="card-title">Notifications</span></div>
            <Row label="Shift reminders" sub="Notify staff 24h before their shift">
              <Toggle value={notifShift} onChange={setNotifShift} />
            </Row>
            <Row label="Request alerts" sub="Notify manager on leave / swap requests">
              <Toggle value={notifRequest} onChange={setNotifRequest} />
            </Row>
            <Row label="Conflict alerts" sub="Alert when schedule conflicts are detected">
              <Toggle value={notifConflict} onChange={setNotifConflict} />
            </Row>
          </div>

          {/* Danger zone */}
          <div className="card" style={{ borderColor: 'var(--red-b)' }}>
            <div className="card-header"><span className="card-title" style={{ color: 'var(--red-t)' }}>Danger zone</span></div>
            <Button variant="secondary" style={{ width: '100%', justifyContent: 'center', color: 'var(--red-t)', borderColor: 'var(--red-b)', marginBottom: 8 }}>
              <i className="ti ti-rotate-clockwise" aria-hidden="true" /> Reset all schedules for this outlet
            </Button>
            <Button variant="secondary" style={{ width: '100%', justifyContent: 'center', color: 'var(--red-t)', borderColor: 'var(--red-b)' }}>
              <i className="ti ti-trash" aria-hidden="true" /> Delete outlet
            </Button>
          </div>

          <Button variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>
            <i className="ti ti-device-floppy" aria-hidden="true" /> Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
