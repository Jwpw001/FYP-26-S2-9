import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { useBusinessContext } from "../../context/BusinessContext";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-dash-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-dash-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.92); }
      60%  { transform: scale(1.03); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastOut {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(20px); }
    }
  `;
  document.head.appendChild(style);
}

// ── useCountUp hook ───────────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// ── Avatar colors ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

// ── Shimmer block ─────────────────────────────────────────────────────────────
function Shimmer({ w = "100%", h = "18px", r = "8px", style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
      ...extra,
    }} />
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const Icons = {
  calendar: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  ),
  users: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="4"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87"/>
    </svg>
  ),
  clipboard: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1z"/>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M8 11h8M8 15h5"/>
    </svg>
  ),
  refresh: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M1 4v6h6"/>
      <path d="M23 20v-6h-6"/>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
    </svg>
  ),
  plus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  chart: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 4-6"/>
    </svg>
  ),
  check: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
};

export default function ManagerDashboard() {
  const { schedulingMode } = useBusinessContext();
  if (schedulingMode === "flexible") return <FlexibleManagerDashboard />;
  return <ShiftManagerDashboard />;
}

function ShiftManagerDashboard() {
  const goTo = useGoTo();
  const user = getUser();

  const [stats, setStats] = useState({ upcomingShifts: 0, pendingLeave: 0, pendingSwaps: 0, totalStaff: 0 });
  const [recentShifts, setRecentShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [unackedShifts, setUnackedShifts] = useState([]);
  const [showUnackedPanel, setShowUnackedPanel] = useState(false);
  const userId = user?.user_id;

  // Bar chart data — shift counts by day of week
  const [weekBarData, setWeekBarData] = useState([0,0,0,0,0,0,0]);
  const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const now = new Date();
        const today = now.toISOString().split("T")[0];
        const future = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

        const { data: myStaff } = await supabase
          .from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);

        const outletId = myStaff?.[0]?.outlet_id;
        if (!outletId || cancelled) return;

        // Get outlet staff IDs (excluding managers) for leave/swap/count scoping
        const { data: outletStaffRows } = await supabase
          .from("staff").select("staff_id, users(role)").eq("outlet_id", outletId).eq("is_active", true);
        const outletStaffIds = (outletStaffRows || [])
          .filter(s => s.users?.role !== "outlet_manager")
          .map(s => s.staff_id);

        const [{ data: shifts }, { count: leaveCount }, { count: swapCount }] =
          await Promise.all([
            supabase.from("shifts")
              .select("shift_id,title,shift_date,start_time,end_time,status")
              .eq("outlet_id", outletId).gte("shift_date", today).lte("shift_date", future)
              .order("shift_date", { ascending: true }),
            outletStaffIds.length > 0
              ? supabase.from("availability").select("*", { count: "exact", head: true })
                  .eq("status", "pending").in("staff_id", outletStaffIds)
              : Promise.resolve({ count: 0 }),
            outletStaffIds.length > 0
              ? supabase.from("swap_requests").select("*", { count: "exact", head: true })
                  .eq("status", "pending").in("requester_id", outletStaffIds)
              : Promise.resolve({ count: 0 }),
          ]);

        if (cancelled) return;
        setStats({ upcomingShifts: shifts?.length || 0, pendingLeave: leaveCount || 0, pendingSwaps: swapCount || 0, totalStaff: outletStaffIds.length });
        setRecentShifts(shifts?.slice(0, 5) || []);

        // Compute bar chart: count shifts per weekday (0=Mon..6=Sun)
        const counts = [0,0,0,0,0,0,0];
        (shifts || []).forEach(sh => {
          const d = new Date(sh.shift_date);
          const dow = (d.getDay() + 6) % 7; // Mon=0
          counts[dow]++;
        });
        setWeekBarData(counts);

        // Unacknowledged assignments on published shifts (today or future only)
        const { data: pubShifts } = await supabase
          .from("shifts")
          .select("shift_id, title, shift_date")
          .eq("outlet_id", outletId)
          .eq("status", "published")
          .gte("shift_date", today);

        if (!cancelled && pubShifts?.length) {
          const shiftIds = pubShifts.map(s => s.shift_id);
          const { data: unackedRows } = await supabase
            .from("shift_assignments")
            .select("shift_id, staff:staff_id(user_id, users:user_id(full_name))")
            .in("shift_id", shiftIds)
            .eq("acknowledged", false);

          if (!cancelled) {
            const byShift = {};
            (unackedRows || []).forEach(row => {
              if (!byShift[row.shift_id]) {
                const sh = pubShifts.find(s => s.shift_id === row.shift_id);
                byShift[row.shift_id] = { ...sh, staffNames: [] };
              }
              const name = row.staff?.users?.full_name;
              if (name) byShift[row.shift_id].staffNames.push(name);
            });
            setUnackedShifts(Object.values(byShift).sort((a, b) => a.shift_date.localeCompare(b.shift_date)));
          }
        }
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  const cardDefs = [
    { label: "Upcoming Shifts", key: "upcomingShifts", sub: "Next 7 days",      icon: Icons.calendar,  color: "#2563EB", bg: "#EFF6FF", link: "/outlet-manager/shifts" },
    { label: "Total Staff",     key: "totalStaff",     sub: "Active members",   icon: Icons.users,     color: "#059669", bg: "#ECFDF5", link: "/outlet-manager/staff" },
    { label: "Pending Leave",   key: "pendingLeave",   sub: "Awaiting approval",icon: Icons.clipboard, color: "#D97706", bg: "#FFFBEB", link: "/outlet-manager/availability" },
    { label: "Swap Requests",   key: "pendingSwaps",   sub: "Needs review",     icon: Icons.refresh,   color: "#7C3AED", bg: "#F5F3FF", link: "/outlet-manager/availability" },
  ];

  const quickActions = [
    { label: "Create Shift",  icon: Icons.plus,      link: "/outlet-manager/shifts/new" },
    { label: "View Staff",    icon: Icons.users,     link: "/outlet-manager/staff" },
    { label: "Approve Leave", icon: Icons.check,     link: "/outlet-manager/availability" },
    { label: "View Reports",  icon: Icons.chart,     link: "/outlet-manager/reports" },
  ];

  const maxBar = Math.max(...weekBarData, 1);

  return (
    <ManagerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome header */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Manager"}
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Here's what needs your attention today.</p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "16px", marginBottom: "24px" }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", display: "flex", gap: "14px" }}>
                  <Shimmer w="44px" h="44px" r="10px" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    <Shimmer w="50%" h="28px" r="6px" />
                    <Shimmer w="70%" h="14px" r="6px" />
                    <Shimmer w="50%" h="12px" r="6px" />
                  </div>
                </div>
              ))
            : cardDefs.map((card, idx) => (
                <StatCard key={card.label} card={card} value={stats[card.key]} delay={idx * 80} onNav={() => goTo(card.link)} />
              ))
          }
        </div>

        {/* Unacknowledged shifts alert */}
        {!loading && unackedShifts.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setShowUnackedPanel(v => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: "14px",
                padding: "16px 20px", cursor: "pointer", textAlign: "left",
                transition: "box-shadow 0.15s",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" fill="none" stroke="#D97706" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M12 9v4M12 17h.01"/>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: "700", color: "#92400E" }}>
                    {unackedShifts.length} Published Shift{unackedShifts.length !== 1 ? "s" : ""} with Unacknowledged Assignments
                  </p>
                  <p style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>
                    Click to see which staff haven't confirmed their schedule
                  </p>
                </div>
              </div>
              <svg width="18" height="18" fill="none" stroke="#D97706" strokeWidth="2" viewBox="0 0 24 24"
                style={{ transform: showUnackedPanel ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {showUnackedPanel && (
              <div style={{ background: "#FFFFFF", border: "1.5px solid #FCD34D", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
                <div style={{ padding: "0 20px 4px", background: "#FFFDF0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", padding: "8px 0", borderBottom: "1px solid #FEF3C7", fontSize: "11px", fontWeight: "700", color: "#B45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    <span>Shift</span><span>Date</span><span>Pending Staff</span>
                  </div>
                </div>
                {unackedShifts.map((sh, i) => (
                  <div key={sh.shift_id} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 2fr",
                    padding: "12px 20px", alignItems: "flex-start",
                    borderBottom: i < unackedShifts.length - 1 ? "1px solid #FEF9C3" : "none",
                    background: i % 2 === 0 ? "#FFFFFF" : "#FFFDF0",
                    fontSize: "13px", gap: "8px",
                  }}>
                    <span style={{ fontWeight: "600", color: "#1E293B" }}>{sh.title || "Untitled"}</span>
                    <span style={{ color: "#64748B" }}>{fmtDate(sh.shift_date)}</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {sh.staffNames.map(name => (
                        <span key={name} style={{ background: "#FEF3C7", color: "#92400E", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px" }}>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bar chart + Quick actions row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", marginBottom: "20px" }}>
          {/* Bar chart */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "20px" }}>
              Shifts This Week by Day
            </h3>
            {loading ? (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", height: "100px" }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <Shimmer key={i} w="100%" h={`${40 + i * 8}px`} r="6px" style={{ flex: 1 }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "110px" }}>
                {weekBarData.map((count, i) => {
                  const pct = count === 0 ? 6 : Math.max(10, (count / maxBar) * 100);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: count > 0 ? "#2563EB" : "#CBD5E1" }}>
                        {count > 0 ? count : ""}
                      </span>
                      <div style={{
                        width: "100%", height: `${pct}%`, borderRadius: "6px 6px 3px 3px",
                        background: count > 0 ? "linear-gradient(180deg,#3B82F6,#2563EB)" : "#F1F5F9",
                        transition: "height 0.6s ease",
                        minHeight: "6px",
                      }} />
                      <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "500" }}>{DAYS_SHORT[i]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {quickActions.map((a) => (
                <QuickActionBtn key={a.label} label={a.label} icon={a.icon} onClick={() => goTo(a.link)} />
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming shifts table */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>Upcoming Shifts</h3>
            <button style={{ background: "none", border: "none", fontSize: "13px", color: "#2563EB", fontWeight: "600", cursor: "pointer" }}
              onClick={() => goTo("/outlet-manager/shifts")}>
              View all →
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "12px", padding: "10px 0" }}>
                  <Shimmer h="16px" r="6px" />
                  <Shimmer h="16px" r="6px" />
                  <Shimmer h="16px" r="6px" />
                  <Shimmer w="60px" h="22px" r="100px" />
                </div>
              ))}
            </div>
          ) : recentShifts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B", fontSize: "14px" }}>
              No shifts in the next 7 days.
            </div>
          ) : (
            <div style={{ width: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr", padding: "8px 14px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", marginBottom: "4px" }}>
                <span>Date</span><span>Title</span><span>Time</span><span>Status</span>
              </div>
              {recentShifts.map((shift) => (
                <ShiftRow key={shift.shift_id} shift={shift} onNav={() => goTo(`/outlet-manager/shifts/${shift.shift_id}`)} />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "success" ? "#22C55E" : "#EF4444",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "toastIn 0.3s ease both",
        }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

// ── Flexible (project/task) mode dashboard ──────────────────────────────────────
function FlexibleManagerDashboard() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [portfolio, setPortfolio] = useState(null);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaff } = await supabase
          .from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);
        const outletId = myStaff?.[0]?.outlet_id;

        const [portRes, staffRowsRes] = await Promise.all([
          api.get("/api/flex/portfolio"),
          outletId
            ? supabase.from("staff").select("staff_id, users(role)").eq("outlet_id", outletId).eq("is_active", true)
            : Promise.resolve({ data: [] }),
        ]);

        if (cancelled) return;
        setPortfolio(portRes);
        setStaffCount((staffRowsRes.data || []).filter(s => s.users?.role !== "outlet_manager").length);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  const summary = portfolio?.summary || { total: 0, active: 0, overdue: 0, total_tasks: 0, done_tasks: 0 };
  const openTasks = Math.max(summary.total_tasks - summary.done_tasks, 0);
  const activeProjects = (portfolio?.projects || []).filter(p => p.status === "active").slice(0, 5);
  const upcomingDeadlines = (portfolio?.projects || [])
    .filter(p => p.status === "active" && p.end_date)
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
    .slice(0, 5);

  const cardDefs = [
    { label: "Active Projects", key: "active",  sub: `${summary.total} total`,     icon: Icons.clipboard, color: "#6366F1", bg: "#EEF2FF", link: "/outlet-manager/projects" },
    { label: "Total Staff",     key: "staff",   sub: "Active members",             icon: Icons.users,     color: "#059669", bg: "#ECFDF5", link: "/outlet-manager/staff" },
    { label: "Open Tasks",      key: "tasks",   sub: `${summary.done_tasks} done`, icon: Icons.check,     color: "#2563EB", bg: "#EFF6FF", link: "/outlet-manager/projects" },
    { label: "Overdue",         key: "overdue", sub: "Past deadline",              icon: Icons.calendar,  color: "#DC2626", bg: "#FEF2F2", link: "/outlet-manager/projects" },
  ];
  const cardValues = { active: summary.active, staff: staffCount, tasks: openTasks, overdue: summary.overdue };

  const quickActions = [
    { label: "New Project",  icon: Icons.plus,      link: "/outlet-manager/projects" },
    { label: "View Staff",   icon: Icons.users,     link: "/outlet-manager/staff" },
    { label: "View Reports", icon: Icons.chart,     link: "/outlet-manager/reports" },
  ];

  return (
    <ManagerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome header */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Manager"}
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Here's what needs your attention today.</p>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "16px", marginBottom: "24px" }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", display: "flex", gap: "14px" }}>
                  <Shimmer w="44px" h="44px" r="10px" />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    <Shimmer w="50%" h="28px" r="6px" />
                    <Shimmer w="70%" h="14px" r="6px" />
                    <Shimmer w="50%" h="12px" r="6px" />
                  </div>
                </div>
              ))
            : cardDefs.map((card, idx) => (
                <StatCard key={card.label} card={card} value={cardValues[card.key]} delay={idx * 80} onNav={() => goTo(card.link)} />
              ))
          }
        </div>

        {/* Overdue projects alert */}
        {!loading && summary.overdue > 0 && (
          <div style={{ marginBottom: "20px", background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: "14px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" fill="none" stroke="#D97706" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M12 9v4M12 17h.01"/>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#92400E" }}>
                {summary.overdue} project{summary.overdue !== 1 ? "s" : ""} past deadline
              </p>
              <p style={{ fontSize: "12px", color: "#B45309", marginTop: "2px" }}>Review timelines and reassign work if needed</p>
            </div>
          </div>
        )}

        {/* Project progress + Quick actions row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", marginBottom: "20px" }}>
          {/* Project progress */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>Active Projects</h3>
              <button style={{ background: "none", border: "none", fontSize: "13px", color: "#2563EB", fontWeight: "600", cursor: "pointer" }}
                onClick={() => goTo("/outlet-manager/projects")}>
                View all →
              </button>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="52px" r="10px" />)}
              </div>
            ) : activeProjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748B", fontSize: "14px" }}>
                No active projects yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeProjects.map(p => (
                  <ProjectProgressRow key={p.project_id} project={p} onNav={() => goTo(`/outlet-manager/projects/${p.project_id}/board`)} />
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {quickActions.map((a) => (
                <QuickActionBtn key={a.label} label={a.label} icon={a.icon} onClick={() => goTo(a.link)} />
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>Upcoming Deadlines</h3>
            <button style={{ background: "none", border: "none", fontSize: "13px", color: "#2563EB", fontWeight: "600", cursor: "pointer" }}
              onClick={() => goTo("/outlet-manager/projects")}>
              View all →
            </button>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px", padding: "10px 0" }}>
                  <Shimmer h="16px" r="6px" />
                  <Shimmer h="16px" r="6px" />
                  <Shimmer h="16px" r="6px" />
                  <Shimmer w="80px" h="22px" r="100px" />
                </div>
              ))}
            </div>
          ) : upcomingDeadlines.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748B", fontSize: "14px" }}>
              No upcoming deadlines.
            </div>
          ) : (
            <div style={{ width: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "8px 14px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", marginBottom: "4px" }}>
                <span>Project</span><span>Team</span><span>Progress</span><span>Deadline</span>
              </div>
              {upcomingDeadlines.map(p => (
                <DeadlineRow key={p.project_id} project={p} onNav={() => goTo(`/outlet-manager/projects/${p.project_id}/board`)} />
              ))}
            </div>
          )}
        </div>

      </div>
    </ManagerLayout>
  );
}

function ProjectProgressRow({ project, onNav }) {
  const [hovered, setHovered] = useState(false);
  const total = project.tasks?.total || 0;
  const done = project.tasks?.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      onClick={onNav}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "12px 14px", borderRadius: "10px", cursor: "pointer", border: "1px solid #F1F5F9", background: hovered ? "#F8FAFC" : "transparent", transition: "background 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: project.color || "#6366F1", flexShrink: 0 }} />
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
          {project.overdue && (
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#DC2626", background: "#FEF2F2", padding: "1px 7px", borderRadius: "99px", flexShrink: 0 }}>Overdue</span>
          )}
        </div>
        <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "600", flexShrink: 0 }}>{done}/{total} tasks</span>
      </div>
      <div style={{ height: "6px", borderRadius: "99px", background: "#F1F5F9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "99px", background: project.color || "#6366F1", transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function DeadlineRow({ project, onNav }) {
  const [hovered, setHovered] = useState(false);
  const total = project.tasks?.total || 0;
  const done = project.tasks?.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const dl = deadlineLabel(daysUntil(project.end_date));
  return (
    <div
      onClick={onNav}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
        padding: "11px 14px", borderRadius: "8px", cursor: "pointer",
        fontSize: "13px", gap: "8px", alignItems: "center",
        borderBottom: "1px solid #F1F5F9", color: "#1E293B",
        background: hovered ? "#F8FAFC" : "transparent",
        transition: "background 0.15s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: project.color || "#6366F1", flexShrink: 0 }} />
        <span style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
      </div>
      <MemberAvatars members={project.members} />
      <span style={{ color: "#64748B" }}>{done}/{total} tasks ({pct}%)</span>
      <span>
        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: `${dl.color}18`, color: dl.color }}>
          {dl.text}
        </span>
      </span>
    </div>
  );
}

function MemberAvatars({ members = [] }) {
  if (!members.length) return <span style={{ fontSize: "12px", color: "#CBD1D9" }}>—</span>;
  return (
    <div style={{ display: "flex" }}>
      {members.slice(0, 3).map((m, i) => (
        <div key={m.user_id} title={m.full_name} style={{ marginLeft: i === 0 ? 0 : -7, border: "2px solid #FFF", borderRadius: "50%" }}>
          <MiniAvatar name={m.full_name} />
        </div>
      ))}
      {members.length > 3 && (
        <div style={{ marginLeft: -7, width: 22, height: 22, borderRadius: "50%", border: "2px solid #FFF", background: "#EEF1F5", color: "#64748B", fontSize: "9px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
          +{members.length - 3}
        </div>
      )}
    </div>
  );
}

function MiniAvatar({ name = "", size = 22 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: avatarColor(name), color: "#fff", fontSize: size * 0.4, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function daysUntil(dateStr) {
  const end = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / 86400000);
}

function deadlineLabel(days) {
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "#DC2626" };
  if (days === 0) return { text: "Due today", color: "#D97706" };
  if (days === 1) return { text: "Due tomorrow", color: "#D97706" };
  if (days <= 7) return { text: `Due in ${days}d`, color: "#D97706" };
  return { text: `Due in ${days}d`, color: "#64748B" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ card, value, delay, onNav }) {
  const displayed = useCountUp(value);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onNav}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px",
        padding: "22px", display: "flex", gap: "14px", alignItems: "flex-start",
        cursor: "pointer", animation: `popIn 0.4s ease ${delay}ms both`,
        boxShadow: hovered ? "0 8px 24px rgba(37,99,235,0.10)" : "none",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: card.bg, color: card.color }}>
        {card.icon}
      </div>
      <div>
        <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{displayed}</p>
        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", marginTop: "4px" }}>{card.label}</p>
        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{card.sub}</p>
      </div>
    </div>
  );
}

function QuickActionBtn({ label, icon, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 14px", background: hovered ? "#EFF6FF" : "#F8FAFC",
        border: hovered ? "1px solid #BFDBFE" : "1px solid #E2E8F0",
        borderRadius: "10px", fontSize: "13px", fontWeight: "600",
        color: hovered ? "#2563EB" : "#1E293B", cursor: "pointer",
        width: "100%", textAlign: "left", transition: "all 0.15s",
      }}>
      <span style={{ color: hovered ? "#2563EB" : "#64748B" }}>{icon}</span>
      {label}
    </button>
  );
}

function ShiftRow({ shift, onNav }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      key={shift.shift_id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNav}
      style={{
        display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr",
        padding: "11px 14px", borderRadius: "8px", cursor: "pointer",
        fontSize: "13px", gap: "8px", alignItems: "center",
        borderBottom: "1px solid #F1F5F9", color: "#1E293B",
        background: hovered ? "#F8FAFC" : "transparent",
        transition: "background 0.15s",
      }}>
      <span style={{ fontWeight: "600" }}>{fmtDate(shift.shift_date)}</span>
      <span>{shift.title || "Untitled"}</span>
      <span style={{ color: "#64748B" }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</span>
      <span>
        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", ...badgeStyle(shift.status) }}>
          {shift.status}
        </span>
      </span>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

function badgeStyle(status) {
  const map = {
    draft:     { background: "#F3F4F6", color: "#6B7280" },
    published: { background: "#DCFCE7", color: "#166534" },
    completed: { background: "#DBEAFE", color: "#1E40AF" },
    cancelled: { background: "#FEE2E2", color: "#991B1B" },
  };
  return map[status] || map.draft;
}
