import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { Building2, CalendarClock, CheckCircle, Clock, ChevronRight, Calendar } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("casual-dash-styles")) {
  const style = document.createElement("style");
  style.id = "casual-dash-styles";
  style.textContent = `
    @keyframes pageIn  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0}          to{background-position:600px 0} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function CasualDashboard() {
  const user     = getUser();
  const userId   = user?.user_id;
  const navigate = useNavigate();

  const [staffRecord,    setStaffRecord]    = useState(null);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [avail,          setAvail]          = useState([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const today = new Date().toISOString().slice(0, 10);

      // Query staff table directly — same approach as regular-staff dashboard
      const [{ data: staffData }, availRes] = await Promise.all([
        supabase.from("staff")
          .select("staff_id, is_active, outlet_id, outlets(name, address)")
          .eq("user_id", userId)
          .maybeSingle(),
        api.get("/api/casual/availability").catch(() => ({ availability: [] })),
      ]);

      if (cancelled) return;

      setStaffRecord(staffData || null);
      setAvail(availRes?.availability || []);

      // Fetch upcoming shifts once we have staff_id
      if (staffData?.staff_id) {
        const { data: shifts } = await supabase
          .from("shift_assignments")
          .select(`
            assignment_id, acknowledged,
            shifts!inner ( shift_id, title, shift_date, start_time, end_time,
              outlets ( name )
            )
          `)
          .eq("staff_id", staffData.staff_id)
          .gte("shifts.shift_date", today)
          .order("shifts.shift_date", { referencedTable: "shifts", ascending: true })
          .limit(5);

        if (!cancelled) setUpcomingShifts((shifts || []).filter(a => a.shifts));
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  const isActive   = staffRecord?.is_active === true;
  const outletName = staffRecord?.outlets?.name || null;
  const availDone  = avail.length > 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <CasualLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>
            {greeting()}, {user?.full_name?.split(" ")[0] || "there"}
          </h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
            {loading ? "Loading your profile…" : outletName ? `Casual worker · ${outletName}` : "Casual worker"}
          </p>
        </div>

        {/* KPI Cards — repeat(4, 1fr) so all 4 fill the row evenly on any screen width */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <Shimmer w="38px" h="38px" r="10px" />
                <div><Shimmer w="60px" h="26px" r="6px" /><div style={{ marginTop: "6px" }}><Shimmer w="110px" h="13px" r="4px" /></div></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>

            {/* Status */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: isActive ? "#DCFCE7" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={18} color={isActive ? "#16A34A" : "#EF4444"} />
              </div>
              <div>
                <p style={{ fontSize: "22px", fontWeight: "800", color: isActive ? "#16A34A" : "#EF4444", lineHeight: 1 }}>
                  {isActive ? "Active" : "Inactive"}
                </p>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", marginTop: "5px" }}>Account Status</p>
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>
                  {isActive ? "Ready to receive shifts" : "Contact your manager"}
                </p>
              </div>
            </div>

            {/* Outlet */}
            <StatCard
              icon={<Building2 size={18} color="#2563EB" />} bg="#DBEAFE"
              label="My Outlet"
              value={outletName || "—"}
              sub={outletName ? "Primary location" : "Not assigned yet"}
              large={false}
            />

            {/* Availability days */}
            <StatCard
              icon={<CalendarClock size={18} color="#059669" />} bg="#D1FAE5"
              label="Available Days"
              value={avail.length}
              sub={avail.length === 0 ? "Not set up yet" : `day${avail.length !== 1 ? "s" : ""} per week`}
              large={true}
            />

            {/* Upcoming shifts */}
            <StatCard
              icon={<Calendar size={18} color="#7C3AED" />} bg="#EDE9FE"
              label="Upcoming Shifts"
              value={upcomingShifts.length}
              sub={upcomingShifts.length === 0 ? "None scheduled" : `in the next days`}
              large={true}
            />
          </div>
        )}

        {/* Main 2-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "18px" }}>

          {/* Upcoming Shifts */}
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>Upcoming Shifts</p>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="56px" r="10px" />)}
              </div>
            ) : upcomingShifts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Calendar size={34} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: "13px", color: "#94A3B8" }}>No upcoming shifts yet.</p>
                <p style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "4px" }}>Your manager will assign you shifts soon.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {upcomingShifts.map((a, i) => {
                  const sh = a.shifts;
                  return (
                    <div key={a.assignment_id}
                      style={{ display: "flex", alignItems: "center", gap: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "11px 14px", animation: `fadeUp 0.3s ease ${i * 0.05}s both` }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "9px", background: "#EFF6FF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#2563EB", lineHeight: 1 }}>
                          {new Date(sh.shift_date).toLocaleDateString("en-SG", { month: "short" }).toUpperCase()}
                        </span>
                        <span style={{ fontSize: "16px", fontWeight: "800", color: "#1E40AF", lineHeight: 1 }}>
                          {new Date(sh.shift_date).getDate()}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.title || "Shift"}</p>
                        <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>
                          {sh.start_time?.slice(0, 5)} – {sh.end_time?.slice(0, 5)}
                        </p>
                      </div>
                      {!a.acknowledged && (
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "#D97706", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "5px", padding: "2px 6px", flexShrink: 0 }}>
                          NEW
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Availability */}
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>Weekly Availability</p>
              <button onClick={() => navigate("/outlet-casual-staff/availability")}
                style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "13px", fontWeight: "600", color: "#2563EB", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {availDone ? "Edit" : "Set up"} <ChevronRight size={14} />
              </button>
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Array.from({ length: 7 }).map((_, i) => <Shimmer key={i} h="32px" r="8px" />)}
              </div>
            ) : avail.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <CalendarClock size={34} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "16px" }}>No availability set yet.</p>
                <button onClick={() => navigate("/outlet-casual-staff/availability")}
                  style={{ background: "#2563EB", color: "#FFF", border: "none", borderRadius: "9px", padding: "9px 22px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                  Set Availability
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {DAYS.map((label, i) => {
                  const entry = avail.find(a => a.day_of_week === i);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "9px", background: entry ? "#EFF6FF" : "#FAFAFA", border: `1px solid ${entry ? "#BFDBFE" : "#F1F5F9"}` }}>
                      <span style={{ width: "32px", fontSize: "12px", fontWeight: "700", color: entry ? "#1E40AF" : i >= 5 ? "#CBD5E1" : "#94A3B8" }}>{label}</span>
                      {entry ? (
                        <span style={{ fontSize: "13px", fontWeight: "500", color: "#1E293B" }}>{entry.available_from?.slice(0,5)} – {entry.available_to?.slice(0,5)}</span>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#CBD5E1" }}>Not available</span>
                      )}
                      {entry && <span style={{ marginLeft: "auto", width: "7px", height: "7px", borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Set availability prompt — only when not set */}
        {!loading && !availDone && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "14px", padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Clock size={18} color="#2563EB" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E40AF" }}>Set your weekly availability</p>
                <p style={{ fontSize: "12px", color: "#3B82F6", marginTop: "2px" }}>Tell your manager which days and times you can work so they can assign you shifts.</p>
              </div>
            </div>
            <button onClick={() => navigate("/outlet-casual-staff/availability")}
              style={{ background: "#2563EB", color: "#FFF", border: "none", borderRadius: "9px", padding: "9px 20px", fontSize: "13px", fontWeight: "600", cursor: "pointer", flexShrink: 0 }}>
              Set Availability
            </button>
          </div>
        )}

      </div>
    </CasualLayout>
  );
}

function StatCard({ icon, bg, label, value, sub, large }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: large ? "26px" : "16px", fontWeight: "800", color: "#0F172A", lineHeight: 1, overflow: "hidden", textOverflow: large ? "unset" : "ellipsis", whiteSpace: large ? "normal" : "nowrap" }}>{value}</p>
        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", marginTop: "5px" }}>{label}</p>
        {sub && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{sub}</p>}
      </div>
    </div>
  );
}
