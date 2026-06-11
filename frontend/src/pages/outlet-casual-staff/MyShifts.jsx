import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

if (typeof document !== "undefined" && !document.getElementById("casual-shifts-styles")) {
  const style = document.createElement("style");
  style.id = "casual-shifts-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

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

        const { data: myStaff } = await supabase
          .from("staff").select("staff_id")
          .eq("user_id", userId).limit(1);
        const staffId = myStaff?.[0]?.staff_id;
        if (!staffId) { if (!cancelled) setShifts([]); return; }

        const { data } = await supabase.from("shift_assignments")
          .select(`
            assignment_id, status, acknowledged,
            shifts ( shift_id, title, shift_date, start_time, end_time, status,
              outlets ( name ),
              shift_roles ( role_name )
            )
          `)
          .eq("staff_id", staffId);

        let rows = (data || []).filter(a => a.shifts);
        if (filter === "upcoming") rows = rows.filter(a => a.shifts.shift_date >= today);
        else if (filter === "past") rows = rows.filter(a => a.shifts.shift_date < today);
        rows.sort((a, b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date));

        if (!cancelled) setShifts(rows);
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

  const FILTER_TABS = ["upcoming", "past", "all"];

  return (
    <CasualLayout title="My Shifts">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>My Shifts</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${shifts.length} ${filter} shift${shifts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
            {FILTER_TABS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: "7px 16px",
                  background: filter === f ? "#FFFFFF" : "transparent",
                  border: "none", borderRadius: "7px", fontSize: "13px",
                  fontWeight: filter === f ? "600" : "500",
                  color: filter === f ? "#1E293B" : "#64748B",
                  cursor: "pointer",
                  boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div><Shimmer w="160px" h="16px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="100px" h="12px" r="5px" /></div></div>
                  <Shimmer w="72px" h="24px" r="100px" />
                </div>
                <div style={{ display: "flex", gap: "24px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
                  <Shimmer w="80px" h="36px" r="8px" />
                  <Shimmer w="80px" h="36px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : shifts.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📅</div>
            <p style={{ fontSize: "17px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No {filter} shifts</p>
            <p style={{ fontSize: "13px", color: "#64748B" }}>
              {filter === "upcoming"
                ? "Submit your availability so the manager can assign you shifts."
                : "No shifts found for this period."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {shifts.map((a, i) => {
              const shift = a.shifts;
              const needsAck = shift?.status === "published" && !a.acknowledged;
              return (
                <div key={a.assignment_id}
                  style={{
                    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    animation: `fadeSlideUp 0.3s ease ${i * 0.06}s both`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>{shift?.title || "Shift"}</p>
                      <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{shift?.outlets?.name || "—"}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px" }}>
                      <span style={{ ...badge, ...shiftBadge(shift?.status) }}>{shift?.status}</span>
                      {a.acknowledged && (
                        <span style={{ fontSize: "11px", color: "#059669", fontWeight: "600", background: "#ECFDF5", padding: "2px 8px", borderRadius: "100px" }}>✓ Acknowledged</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: needsAck ? "1px solid #F1F5F9" : "none" }}>
                    <InfoItem label="Date" value={fmtDate(shift?.shift_date)} />
                    <InfoItem label="Time" value={`${shift?.start_time?.slice(0,5)} – ${shift?.end_time?.slice(0,5)}`} />
                    {shift?.shift_roles?.[0] && (
                      <InfoItem label="Role" value={shift.shift_roles[0].role_name} />
                    )}
                  </div>

                  {needsAck && (
                    <button onClick={() => acknowledge(a.assignment_id)}
                      style={{ marginTop: "14px", width: "100%", padding: "11px", background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: "10px", fontSize: "14px", fontWeight: "600", color: "#166534", cursor: "pointer" }}>
                      ✓ Acknowledge Shift
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CasualLayout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function shiftBadge(status) {
  const map = {
    draft:     { background: "#F3F4F6", color: "#6B7280" },
    published: { background: "#DCFCE7", color: "#166534" },
    completed: { background: "#DBEAFE", color: "#1E40AF" },
    cancelled: { background: "#FEE2E2", color: "#991B1B" },
  };
  return map[status] || map.draft;
}

const badge = { display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize" };
