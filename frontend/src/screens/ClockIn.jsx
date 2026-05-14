import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';

// [HARDCODED] Replace with GET /api/attendance/today + POST /api/attendance/clockin|clockout
const TODAY_SHIFTS = [
  {
    id: 'shift_mon_morning',
    period: 'Morning',
    time: '07:00–15:00',
    role: 'Cashier',
    outlet: 'Orchard Road Outlet',
    staffList: [
      { id: 'RL', name: 'Rachel Lim',  color: 'ma-blue',   clockIn: '06:58', clockOut: null,    status: 'clocked_in' },
      { id: 'DT', name: 'David Tan',   color: 'ma-green',  clockIn: '07:03', clockOut: null,    status: 'clocked_in' },
      { id: 'MP', name: 'Maya Patel',  color: 'ma-amber',  clockIn: '07:22', clockOut: null,    status: 'late' },
      { id: 'YK', name: 'Yusuf Kim',   color: 'ma-purple', clockIn: null,    clockOut: null,    status: 'absent' },
    ],
  },
  {
    id: 'shift_mon_afternoon',
    period: 'Afternoon',
    time: '13:00–21:00',
    role: 'Floor Service',
    outlet: 'Orchard Road Outlet',
    staffList: [
      { id: 'SN', name: 'Sarah Ng',    color: 'ma-purple', clockIn: null, clockOut: null, status: 'scheduled' },
      { id: 'AH', name: 'Amy Hassan',  color: 'ma-blue',   clockIn: null, clockOut: null, status: 'scheduled' },
    ],
  },
];

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function ClockIn() {
  const [shifts, setShifts]     = useState(TODAY_SHIFTS);
  const [time, setTime]         = useState(now());
  const [markedAbsent, setMarkedAbsent] = useState({});

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(now()), 30000);
    return () => clearInterval(t);
  }, []);

  const clockIn = (shiftIdx, staffId) => {
    setShifts((prev) =>
      prev.map((sh, si) =>
        si !== shiftIdx ? sh : {
          ...sh,
          staffList: sh.staffList.map((s) =>
            s.id !== staffId ? s : { ...s, clockIn: now(), status: 'clocked_in' }
          ),
        }
      )
    );
  };

  const clockOut = (shiftIdx, staffId) => {
    setShifts((prev) =>
      prev.map((sh, si) =>
        si !== shiftIdx ? sh : {
          ...sh,
          staffList: sh.staffList.map((s) =>
            s.id !== staffId ? s : { ...s, clockOut: now(), status: 'completed' }
          ),
        }
      )
    );
  };

  const markAbsent = (shiftIdx, staffId) => {
    setMarkedAbsent((prev) => ({ ...prev, [`${shiftIdx}-${staffId}`]: true }));
    setShifts((prev) =>
      prev.map((sh, si) =>
        si !== shiftIdx ? sh : {
          ...sh,
          staffList: sh.staffList.map((s) =>
            s.id !== staffId ? s : { ...s, status: 'absent' }
          ),
        }
      )
    );
  };

  const statusBadge = (s) => {
    if (s.status === 'clocked_in') return <Badge cls="b-green">Clocked in {s.clockIn}</Badge>;
    if (s.status === 'late')       return <Badge cls="b-amber">Late · {s.clockIn}</Badge>;
    if (s.status === 'completed')  return <Badge cls="b-blue">Done · out {s.clockOut}</Badge>;
    if (s.status === 'absent')     return <Badge cls="b-red">Absent</Badge>;
    return <Badge cls="b-gray">Scheduled</Badge>;
  };

  const totalToday = shifts.flatMap((s) => s.staffList);
  const presentCount = totalToday.filter((s) => ['clocked_in','late','completed'].includes(s.status)).length;
  const absentCount  = totalToday.filter((s) => s.status === 'absent').length;

  return (
    <div>
      {/* Live time banner */}
      <div style={{ background: 'var(--accent)', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Current time</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{time}</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{presentCount}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Present</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{absentCount}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Absent</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{totalToday.length - presentCount - absentCount}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Pending</div>
          </div>
        </div>
      </div>

      {/* Shift blocks */}
      {shifts.map((shift, si) => (
        <div className="card" key={shift.id}>
          <div className="card-header">
            <div>
              <span className="card-title">{shift.period} shift</span>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {shift.time} · {shift.role} · {shift.outlet}
              </div>
            </div>
            <span className="annot">
              {shift.staffList.filter(s => ['clocked_in','late','completed'].includes(s.status)).length}/{shift.staffList.length} present
            </span>
          </div>

          {shift.staffList.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--border-light)' }}>
              <div className={`ma ${s.color}`} style={{ width: 30, height: 30, fontSize: 11 }}>{s.id}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                {s.clockIn && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>In {s.clockIn}{s.clockOut ? ` · Out ${s.clockOut}` : ''}</div>}
              </div>
              {statusBadge(s)}
              <div style={{ display: 'flex', gap: 6 }}>
                {s.status === 'scheduled' && (
                  <>
                    <Button variant="primary" className="btn-sm" onClick={() => clockIn(si, s.id)}>
                      <i className="ti ti-login" aria-hidden="true" /> Clock in
                    </Button>
                    <Button variant="secondary" className="btn-sm" style={{ color: 'var(--red-t)' }} onClick={() => markAbsent(si, s.id)}>
                      Absent
                    </Button>
                  </>
                )}
                {(s.status === 'clocked_in' || s.status === 'late') && (
                  <Button variant="secondary" className="btn-sm" onClick={() => clockOut(si, s.id)}>
                    <i className="ti ti-logout" aria-hidden="true" /> Clock out
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
