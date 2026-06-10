import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

export default function CasualMyShifts() {
  const user = getUser();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.get("/api/shifts").then(res => {
      const today = new Date().toISOString().split("T")[0];
      const upcoming = (res.shifts || [])
        .filter(s => s.shift_date >= today)
        .sort((a, b) => a.shift_date.localeCompare(b.shift_date));
      setShifts(upcoming);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function acknowledge(assignmentId) {
    setAcknowledging(assignmentId);
    try {
      await api.patch(`/api/shifts/assignments/${assignmentId}/acknowledge`, {});
      setShifts(prev => prev.map(s => ({
        ...s,
        shift_roles: (s.shift_roles || []).map(r => ({
          ...r,
          shift_assignments: (r.shift_assignments || []).map(a =>
            a.assignment_id === assignmentId ? { ...a, acknowledged: true } : a
          )
        }))
      })));
      setSuccess("Shift acknowledged!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) { console.error(err); }
    finally { setAcknowledging(null); }
  }

  // Match by nested user_id — NOT staff_id (which isn't in the JWT)
  const myAssignments = shifts.flatMap(shift =>
    (shift.shift_roles || []).flatMap(role =>
      (role.shift_assignments || [])
        .filter(a => a.staff?.users?.user_id === user?.user_id)
        .map(a => ({ ...a, shift, role_name: role.role_name }))
    )
  );

  function shiftBadge(status) {
    const map = { draft: { background: "#F3F4F6", color: "#6B7280" }, published: { background: "#DCFCE7", color: "#166534" } };
    return map[status] || map.draft;
  }

  return (
    <CasualLayout title="My Shifts">
      <h2 style={s.heading}>My Shifts</h2>
      {success && <div style={s.successMsg}>{success}</div>}
      {loading ? <div style={s.empty}>Loading shifts…</div>
        : myAssignments.length === 0 ? (
          <div style={s.emptyCard}><p style={s.emptyIcon}>📅</p><p style={s.emptyTitle}>No upcoming shifts</p></div>
        ) : myAssignments.map(a => (
          <div key={a.assignment_id} style={s.card}>
            <div style={s.cardTop}>
              <div>
                <div style={s.titleRow}>
                  <p style={s.shiftTitle}>{a.shift.title || "Shift"}</p>
                  <span style={{ ...s.badge, ...shiftBadge(a.shift.status) }}>{a.shift.status}</span>
                </div>
                <p style={s.shiftMeta}>{fmtDate(a.shift.shift_date)} · {fmtTime(a.shift.start_time)} – {fmtTime(a.shift.end_time)}</p>
                <p style={s.roleName}>Role: {a.role_name}</p>
              </div>
              <div style={s.right}>
                {a.acknowledged ? (
                  <span style={s.ackBadge}>✓ Acknowledged</span>
                ) : (
                  <button style={s.ackBtn} onClick={() => acknowledge(a.assignment_id)} disabled={acknowledging === a.assignment_id}>
                    {acknowledging === a.assignment_id ? "…" : "Acknowledge"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
    </CasualLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  return new Date(`1970-01-01T${t.includes("T") ? t.split("T")[1] : t}Z`).toISOString().slice(11, 16);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
const s = {
  heading: { fontSize: "20px", fontWeight: "800", color: "#1C1B18", marginBottom: "16px" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  empty: { textAlign: "center", padding: "60px", color: "#7A7870" },
  emptyCard: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "60px", textAlign: "center" },
  emptyIcon: { fontSize: "32px", marginBottom: "10px" },
  emptyTitle: { fontSize: "16px", fontWeight: "600", color: "#7A7870" },
  card: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "20px", marginBottom: "12px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" },
  titleRow: { display: "flex", alignItems: "center", gap: "8px" },
  shiftTitle: { fontSize: "16px", fontWeight: "700", color: "#1C1B18" },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600" },
  shiftMeta: { fontSize: "13px", color: "#7A7870", marginTop: "4px" },
  roleName: { fontSize: "13px", color: "#55524A", marginTop: "4px", fontWeight: "500" },
  right: { flexShrink: 0 },
  ackBadge: { fontSize: "13px", color: "#059669", fontWeight: "600" },
  ackBtn: { background: "#1C1B18", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", cursor: "pointer" },
};
