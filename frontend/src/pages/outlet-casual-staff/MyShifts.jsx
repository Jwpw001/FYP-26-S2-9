import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

export default function CasualMyShifts() {
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
              shift_roles ( role_name )
            )
          `)
          .eq("staff_id", userId)
          .order("shifts.shift_date", { ascending: true });

        if (filter === "upcoming") query = query.gte("shifts.shift_date", today);
        else if (filter === "past") query = query.lt("shifts.shift_date", today);

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

  function shiftBadge(status) {
    const map = {
      draft:     { background:"#F3F4F6", color:"#6B7280" },
      published: { background:"#DCFCE7", color:"#166534" },
      completed: { background:"#DBEAFE", color:"#1E40AF" },
      cancelled: { background:"#FEE2E2", color:"#991B1B" },
    };
    return map[status] || map.draft;
  }

  return (
    <CasualLayout title="My Shifts">
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
        <div style={s.emptyCard}>
          <p style={s.emptyIcon}>📅</p>
          <p style={s.emptyTitle}>No {filter} shifts</p>
          <p style={s.emptySub}>
            {filter === "upcoming"
              ? "Submit your availability so the manager can assign you shifts."
              : "No shifts found for this period."}
          </p>
        </div>
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
                    <p style={s.shiftOutlet}>{shift?.outlets?.name}</p>
                  </div>
                  <span style={{ ...s.badge, ...shiftBadge(shift?.status) }}>
                    {shift?.status}
                  </span>
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
                  {a.acknowledged && (
                    <div style={s.infoItem}>
                      <span style={s.ackTag}>✓ Acknowledged</span>
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
    </CasualLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", {
    weekday:"long", month:"short", day:"numeric",
  });
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
  emptyCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"60px", textAlign:"center" },
  emptyIcon: { fontSize:"36px", marginBottom:"12px" },
  emptyTitle: { fontSize:"17px", fontWeight:"700", color:"#1C1B18", marginBottom:"8px" },
  emptySub: { fontSize:"13px", color:"#7A7870" },
  list: { display:"flex", flexDirection:"column", gap:"12px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px" },
  cardTop: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"14px" },
  shiftTitle: { fontSize:"16px", fontWeight:"700", color:"#1C1B18" },
  shiftOutlet: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  badge: { display:"inline-block", padding:"3px 8px", borderRadius:"100px",
    fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  cardBody: { display:"flex", gap:"24px", flexWrap:"wrap",
    padding:"14px 0", borderTop:"1px solid #F0EDE8" },
  infoItem: { display:"flex", flexDirection:"column", gap:"2px" },
  infoLabel: { fontSize:"11px", fontWeight:"600", color:"#A09D97",
    textTransform:"uppercase" },
  infoVal: { fontSize:"14px", fontWeight:"500", color:"#1C1B18" },
  ackTag: { fontSize:"12px", color:"#059669", fontWeight:"600", marginTop:"4px" },
  ackBtn: { marginTop:"14px", width:"100%", padding:"10px",
    background:"#F0FDF4", border:"1.5px solid #86EFAC",
    borderRadius:"10px", fontSize:"14px", fontWeight:"600",
    color:"#166534", cursor:"pointer" },
};
