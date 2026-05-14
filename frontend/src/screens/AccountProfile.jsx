import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

// [HARDCODED] Replace with GET /api/auth/me
const ME = {
  id: 'RL',
  name: 'Rachel Lim',
  email: 'rachel.lim@krewby.com',
  phone: '+65 9876 5432',
  role: 'Outlet Manager',
  outlet: 'Orchard Road Outlet',
  joinDate: '05 Jan 2022',
  color: 'ma-blue',
  language: 'English',
  timezone: 'Asia/Singapore (GMT+8)',
};

export default function AccountProfile() {
  const [name, setName]       = useState(ME.name);
  const [email, setEmail]     = useState(ME.email);
  const [phone, setPhone]     = useState(ME.phone);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved]     = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaved, setPwSaved]     = useState(false);
  const [pwError, setPwError]     = useState('');

  const saveProfile = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const changePassword = () => {
    if (!currentPw) { setPwError('Enter your current password.'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwError('');
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setPwSaved(true);
    setTimeout(() => setPwSaved(false), 2500);
  };

  return (
    <div>
      {saved && (
        <div style={{ background: 'var(--green)', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: 'var(--green-t)', display: 'flex', gap: 6 }}>
          <i className="ti ti-circle-check" /> Profile updated successfully
        </div>
      )}

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left: identity ── */}
        <div>
          <div className="card">
            {/* Avatar + name */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
              <div className={`ma ${ME.color}`} style={{ width: 56, height: 56, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                {ME.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{ME.outlet}</div>
                <div style={{ marginTop: 6 }}><Badge cls="b-blue">{ME.role}</Badge></div>
              </div>
              {!editing ? (
                <Button variant="secondary" className="btn-sm" onClick={() => setEditing(true)}>
                  <i className="ti ti-edit" aria-hidden="true" /> Edit
                </Button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" className="btn-sm" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button variant="primary" className="btn-sm" onClick={saveProfile}>Save</Button>
                </div>
              )}
            </div>

            {/* Fields */}
            <div style={{ borderTop: '0.5px solid var(--border-light)', paddingTop: 14 }}>
              {[
                { label: 'Full name',  value: name,  setter: setName,  type: 'text' },
                { label: 'Email',      value: email, setter: setEmail, type: 'email' },
                { label: 'Phone',      value: phone, setter: setPhone, type: 'tel' },
              ].map(({ label, value, setter, type }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)', width: 100, flexShrink: 0 }}>{label}</span>
                  {editing
                    ? <input className="form-input" type={type} value={value} onChange={(e) => setter(e.target.value)} style={{ maxWidth: 220 }} />
                    : <span style={{ fontSize: 13, fontWeight: 500 }}>{value}</span>}
                </div>
              ))}
              {[
                ['Role',     ME.role],
                ['Outlet',   ME.outlet],
                ['Joined',   ME.joinDate],
                ['Timezone', ME.timezone],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                  <span style={{ fontSize: 13 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preferences */}
          <div className="card">
            <div className="card-header"><span className="card-title">Preferences</span></div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="form-select">
                <option>English</option>
                <option>中文</option>
                <option>Bahasa Melayu</option>
                <option>Tamil</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Default schedule view</label>
              <select className="form-select">
                <option>Week view</option>
                <option>Day view</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Right: security ── */}
        <div>
          {/* Change password */}
          <div className="card">
            <div className="card-header"><span className="card-title">Change password</span></div>
            {pwSaved && (
              <div style={{ background: 'var(--green)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--green-t)', display: 'flex', gap: 6 }}>
                <i className="ti ti-circle-check" /> Password changed
              </div>
            )}
            {pwError && (
              <div style={{ background: 'var(--red)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--red-t)' }}>
                {pwError}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Current password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input className="form-input" type="password" placeholder="Min. 8 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <Button variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={changePassword}>
              Update password
            </Button>
          </div>

          {/* Session / security */}
          <div className="card">
            <div className="card-header"><span className="card-title">Active sessions</span></div>
            {[
              { device: 'Chrome · Windows 11', location: 'Singapore', time: 'Now', current: true },
              { device: 'Safari · iPhone 15',  location: 'Singapore', time: '2 days ago', current: false },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                <i className={`ti ${s.device.includes('iPhone') ? 'ti-device-mobile' : 'ti-device-laptop'}`} style={{ fontSize: 18, color: 'var(--muted)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.device}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{s.location} · {s.time}</div>
                </div>
                {s.current
                  ? <Badge cls="b-green">Current</Badge>
                  : <Button variant="secondary" className="btn-sm" style={{ color: 'var(--red-t)' }}>Sign out</Button>}
              </div>
            ))}
          </div>

          {/* Sign out */}
          <Button variant="secondary" style={{ width: '100%', justifyContent: 'center', color: 'var(--red-t)', borderColor: 'var(--red-b)' }}>
            <i className="ti ti-logout" aria-hidden="true" /> Sign out of all devices
          </Button>
        </div>
      </div>
    </div>
  );
}
