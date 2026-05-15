import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

// [HARDCODED] Replace with GET /api/shifts/:id
const SHIFT = {
  id: 'shift_sun16_eve',
  date: 'Sun 16 Jun 2025',
  period: 'Evening',
  timeStart: '18:00',
  timeEnd: '23:00',
  outlet: 'Orchard Road Outlet',
  status: 'draft',           // 'draft' | 'published' | 'completed'
  roles: [
    { role: 'Floor Service', required: 2, assigned: ['Amy Hassan'], unfilled: 1 },
    { role: 'Cashier',       required: 1, assigned: ['Rachel Lim'], unfilled: 0 },
  ],
  conflicts: [
    { type: 'rest_gap', message: 'Amy Hassan — only 8h rest gap from previous shift (min 10h)' },
  ],
  notes: 'Peak evening — ensure floor is fully staffed before 18:30.',
};

const AVAILABLE_STAFF = ['David Tan', 'Maya Patel', 'Yusuf Kim', 'Sarah Ng'];

export default function ShiftDetail({ onBack, onSmartAssign }) {
  const [roles, setRoles]     = useState(SHIFT.roles);
  const [notes, setNotes]     = useState(SHIFT.notes);
  const [editing, setEditing] = useState(false);
  const [timeStart, setStart] = useState(SHIFT.timeStart);
  const [timeEnd, setEnd]     = useState(SHIFT.timeEnd);
  const [published, setPublished] = useState(SHIFT.status === 'published');

  const removeStaff = (roleIdx, staffName) => {
    setRoles((prev) =>
      prev.map((r, i) =>
        i === roleIdx
          ? { ...r, assigned: r.assigned.filter((s) => s !== staffName), unfilled: r.unfilled + 1 }
          : r
      )
    );
  };

  const totalRequired = roles.reduce((a, r) => a + r.required, 0);
  const totalFilled   = roles.reduce((a, r) => a + r.assigned.length, 0);
  const totalUnfilled = roles.reduce((a, r) => a + r.unfilled, 0);

  return (
    <div>
      {/* Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Button variant="secondary" className="btn-sm" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </Button>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Schedule → Shift Detail</span>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{SHIFT.date} · {SHIFT.period}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{SHIFT.outlet}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge cls={published ? 'b-green' : totalUnfilled > 0 ? 'b-red' : 'b-amber'}>
              {published ? 'Published' : totalUnfilled > 0 ? `${totalUnfilled} unfilled` : 'Draft'}
            </Badge>
            {!editing ? (
              <Button variant="secondary" className="btn-sm" onClick={() => setEditing(true)}>
                <i className="ti ti-edit" aria-hidden="true" /> Edit
              </Button>
            ) : (
              <Button variant="primary" className="btn-sm" onClick={() => setEditing(false)}>
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Time + stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Start time</div>
            {editing
              ? <input className="form-input" value={timeStart} onChange={(e) => setStart(e.target.value)} style={{ padding: '4px 8px' }} />
              : <div style={{ fontSize: 15, fontWeight: 500 }}>{timeStart}</div>}
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>End time</div>
            {editing
              ? <input className="form-input" value={timeEnd} onChange={(e) => setEnd(e.target.value)} style={{ padding: '4px 8px' }} />
              : <div style={{ fontSize: 15, fontWeight: 500 }}>{timeEnd}</div>}
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Headcount</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{totalFilled} / {totalRequired}</div>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>5h</div>
          </div>
        </div>
      </div>

      <div className="two-col" style={{ alignItems: 'start' }}>
        {/* ── Left: role slots ── */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Role assignments</span>
              <Button variant="primary" className="btn-sm" onClick={onSmartAssign}>
                <i className="ti ti-wand" aria-hidden="true" /> Smart Assign
              </Button>
            </div>

            {roles.map((r, ri) => (
              <div key={r.role} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: ri < roles.length - 1 ? '0.5px solid var(--border-light)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.role}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.assigned.length}/{r.required} filled</div>
                </div>

                {/* Assigned staff */}
                {r.assigned.map((staffName) => (
                  <div key={staffName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                    <div className="ma ma-blue" style={{ width: 26, height: 26, fontSize: 10 }}>
                      {staffName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1, fontSize: 13 }}>{staffName}</div>
                    <Badge cls="b-green">Assigned</Badge>
                    {editing && (
                      <div style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => removeStaff(ri, staffName)}>
                        <i className="ti ti-x" style={{ fontSize: 14 }} />
                      </div>
                    )}
                  </div>
                ))}

                {/* Unfilled slots */}
                {Array.from({ length: r.unfilled }).map((_, ui) => (
                  <div key={ui} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                    <div className="ma" style={{ width: 26, height: 26, fontSize: 14, background: 'var(--red)', color: 'var(--red-t)', border: '1px dashed var(--red-b)' }}>?</div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>Unfilled slot</div>
                    <Badge cls="b-red">Unfilled</Badge>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header"><span className="card-title">Shift notes</span></div>
            {editing
              ? <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
              : <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{notes || '—'}</div>}
          </div>
        </div>

        {/* ── Right: conflicts + actions ── */}
        <div>
          {/* Conflicts */}
          {SHIFT.conflicts.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--amber-b)' }}>
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--amber-t)' }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
                  Conflicts detected
                </span>
                <span className="annot">{SHIFT.conflicts.length} issue{SHIFT.conflicts.length > 1 ? 's' : ''}</span>
              </div>
              {SHIFT.conflicts.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < SHIFT.conflicts.length - 1 ? '0.5px solid var(--border-light)' : 'none' }}>
                  <i className="ti ti-alert-circle" style={{ color: 'var(--amber-t)', fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{c.message}</div>
                </div>
              ))}
            </div>
          )}

          {/* Publish actions */}
          <div className="card">
            <div className="card-header"><span className="card-title">Shift actions</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="primary"
                style={{ justifyContent: 'center' }}
                onClick={() => setPublished(true)}
              >
                <i className="ti ti-send" aria-hidden="true" />
                {published ? 'Re-publish shift' : 'Publish shift'}
              </Button>
              <Button variant="secondary" style={{ justifyContent: 'center' }}>
                <i className="ti ti-copy" aria-hidden="true" /> Duplicate shift
              </Button>
              <Button variant="secondary" style={{ justifyContent: 'center', color: 'var(--red-t)', borderColor: 'var(--red-b)' }}>
                <i className="ti ti-trash" aria-hidden="true" /> Delete shift
              </Button>
            </div>
          </div>

          {/* Attendance (if published) */}
          {published && (
            <div className="card">
              <div className="card-header"><span className="card-title">Attendance</span><span className="annot">Live</span></div>
              {['Amy Hassan', 'Rachel Lim'].map((name) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--border-light)' }}>
                  <div className="ma ma-blue" style={{ width: 26, height: 26, fontSize: 10 }}>
                    {name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div style={{ flex: 1, fontSize: 13 }}>{name}</div>
                  <Badge cls="b-green">Clocked in</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
