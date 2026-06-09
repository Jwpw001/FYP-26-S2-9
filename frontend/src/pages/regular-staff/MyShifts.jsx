import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";

export default function MyShifts() {
  const user = getUser();
  const userId = user?.user_id;

  const [shifts, setShifts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("upcoming");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        let query = supabase.from("shift_assignments")
          .select(`
            assignment_id, status, acknowledged,
            shifts ( shift_id, title, shift_date, start_time, end_time, status,
              outlets ( name ),
              shift_roles ( role_name, skills ( name ) )
            )
          `)
          .eq("staff_id", userId)
          .order("shifts.shift_date", { ascending: true });

        if (filter === "upcoming") {
          query = query.gte("shifts.shift_date", today);
        } else if (filter === "past") {
          query = query.lt("shifts.shift_date", today);
        }

        const { data } = await query;
        if (!cancelled) setShifts((data || []).filter(a => a.shifts));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, filter]);

  async function acknowledge(assignmentId) {
    await supabase.from("shift_assignments")
      .update({ acknowledged: true }).eq("assignment_id", assignmentId);
    setShifts(prev => prev.map(a =>
      a.assignment_id === assignmentId ? { ...a, acknowledged: true } : a
    ));
  }

  return (
    <StaffLayout title="My Shifts">
      <div style={s.headerRow}>
        <h2 style={s.heading}>My Shifts</h2>
        <div style={s.tabs}>
          {["upcoming", "past", "all"].map(f => (
            <button key={f} style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.empty}>Loading shifts…</div>
      ) : shifts.length === 0 ? (
        <div style={s.empty}>No {filter} shifts found.</div>
      ) : (
        <div style={s.list}>
          {shifts.map(a => {
            const shift = a.shifts;
            const needsAck = shift?.status === "published" && !a.acknowledged;
            return (
              <div key={a.assignment_id} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <p style={s.shiftTitle}>{shift?.title || "Shift"}</p>
                    <p style={s.shiftOutlet}>{shift?.outlets?.name || "—"}</p>
                  </div>
                  <div style={s.cardTopRight}>
                    <span style={{ ...s.badge, ...shiftBadge(shift?.status) }}>
                      {shift?.status}
                    </span>
                    {a.acknowledged && (
                      <span style={s.ackBadge}>✓ Acknowledged</span>
                    )}
                  </div>
                </div>
                <div style={s.cardBody}>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Date</span>
                    <span style={s.infoVal}>{fmtDate(shift?.shift_date)}</span>
                  </div>
                  <div style={s.infoItem}>
                    <span style={s.infoLabel}>Time</span>
                    <span style={s.infoVal}>
                      {shift?.start_time?.slice(0,5)} – {shift?.end_time?.slice(0,5)}
                    </span>
                  </div>
                  {shift?.shift_roles?.[0] && (
                    <div style={s.infoItem}>
                      <span style={s.infoLabel}>Role</span>
                      <span style={s.infoVal}>{shift.shift_roles[0].role_name}</span>
                    </div>
                  )}
                </div>
                {needsAck && (
                  <button style={s.ackBtn} onClick={() => acknowledge(a.assignment_id)}>
                    ✓ Acknowledge Shift
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </StaffLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", {
    weekday:"long", year:"numeric", month:"short", day:"numeric",
  });
}

function shiftBadge(status) {
  const map = {
    draft:     { background:"#F3F4F6", color:"#6B7280" },
    published: { background:"#DCFCE7", color:"#166534" },
    completed: { background:"#DBEAFE", color:"#1E40AF" },
    cancelled: { background:"#FEE2E2", color:"#991B1B" },
  };
  return map[status] || map.draft;
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  tabs: { display:"flex", gap:"4px", background:"#F0EDE8",
    padding:"4px", borderRadius:"10px" },
  tab: { padding:"6px 14px", background:"transparent", border:"none",
    borderRadius:"7px", fontSize:"13px", fontWeight:"500",
    color:"#7A7870", cursor:"pointer" },
  tabActive: { background:"#FFFFFF", color:"#1C1B18", fontWeight:"600",
    boxShadow:"0 1px 3px rgba(0,0,0,0.08)" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  list: { display:"flex", flexDirection:"column", gap:"12px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px" },
  cardTop: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"14px" },
  shiftTitle: { fontSize:"16px", fontWeight:"700", color:"#1C1B18" },
  shiftOutlet: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  cardTopRight: { display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" },
  badge: { display:"inline-block", padding:"3px 8px", borderRadius:"100px",
    fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  ackBadge: { fontSize:"11px", color:"#059669", fontWeight:"600" },
  cardBody: { display:"flex", gap:"24px", flexWrap:"wrap",
    padding:"14px 0", borderTop:"1px solid #F0EDE8" },
  infoItem: { display:"flex", flexDirection:"column", gap:"2px" },
  infoLabel: { fontSize:"11px", fontWeight:"600", color:"#A09D97", textTransform:"uppercase" },
  infoVal: { fontSize:"14px", fontWeight:"500", color:"#1C1B18" },
  ackBtn: { marginTop:"14px", width:"100%", padding:"10px",
    background:"#F0FDF4", border:"1.5px solid #86EFAC",
    borderRadius:"10px", fontSize:"14px", fontWeight:"600",
    color:"#166534", cursor:"pointer" },
};
