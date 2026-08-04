import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import UserAvatar from "../../components/UserAvatar";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("mgr-dash-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-dash-styles";
  style.textContent = `
    @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer  { from{background-position:-600px 0}          to{background-position:600px 0} }
    @keyframes toastIn  { from{opacity:0;transform:translateY(20px)}  to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EC4899","#8B5CF6","#14B8A6","#F97316","#2563EB"];
function avatarColor(name = "") {
  let h = 0; for (const c of name) h = name.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// Gantt constants — 8am to 10pm = 14 hours
const GANTT_START = 8;
const GANTT_END   = 22;
const GANTT_HOURS = GANTT_END - GANTT_START;
const TIME_LABELS = ["8am","10am","12pm","2pm","4pm","6pm","8pm","10pm"];

function timeToLeft(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return Math.max(0, Math.min(100, ((h + m / 60 - GANTT_START) / GANTT_HOURS) * 100));
}
function timeToPct(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const dur = (eh + em / 60) - (sh + sm / 60);
  return Math.max(2, (dur / GANTT_HOURS) * 100);
}

const SHIFT_COLORS = [
  { bg:"#DBEAFE", color:"#1D4ED8", border:"#BFDBFE" },
  { bg:"#FEF3C7", color:"#92400E", border:"#FDE68A" },
  { bg:"#D1FAE5", color:"#065F46", border:"#A7F3D0" },
  { bg:"#FCE7F3", color:"#9D174D", border:"#FBCFE8" },
  { bg:"#E9D5FF", color:"#6B21A8", border:"#D8B4FE" },
  { bg:"#FFEDD5", color:"#9A3412", border:"#FED7AA" },
];

const DAYS_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function ManagerDashboard() {
  const goTo  = useGoTo();
  const user  = getUser();
  const userId = user?.user_id;

  const [loading,        setLoading]        = useState(true);
  const [branchId,       setBranchId]       = useState(null);
  const [branchName,     setBranchName]     = useState(null);
  const [unackedShifts,  setUnackedShifts]  = useState([]);
  const [alertOpen,      setAlertOpen]      = useState(false);
  const [rosterRows,     setRosterRows]      = useState([]);
  const [weekCounts,     setWeekCounts]      = useState([0,0,0,0,0,0,0]);
  const [leaveItems,     setLeaveItems]      = useState([]);
  const [swapItems,      setSwapItems]       = useState([]);
  const [approvalTab,    setApprovalTab]     = useState("leave");
  const [toast,          setToast]           = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const todayDow = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: myMgr } = await supabase
          .from("branch_managers").select("branch_id, branches(name)")
          .eq("user_id", userId).limit(1);
        let bid = myMgr?.[0]?.branch_id;
        let bname = myMgr?.[0]?.branches?.name || null;

        if (!bid) {
          const { data: myStaff } = await supabase
            .from("staff").select("branch_id, branches(name)")
            .eq("user_id", userId).eq("is_active", true).limit(1);
          bid   = myStaff?.[0]?.branch_id;
          bname = myStaff?.[0]?.branches?.name || null;
        }
        if (cancelled || !bid) return;
        setBranchId(bid);
        setBranchName(bname);

        const now = new Date();
        const future = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];

        // Today's published shifts with assignments (for roster gantt)
        const [
          { data: todayShifts },
          { data: weekShifts },
          { data: pubShifts },
          branchStaffRes,
        ] = await Promise.all([
          supabase.from("shifts").select("shift_id,title,start_time,end_time")
            .eq("branch_id", bid).eq("shift_date", today).eq("status","published"),
          supabase.from("shifts").select("shift_id,shift_date")
            .eq("branch_id", bid).gte("shift_date", today).lte("shift_date", future),
          supabase.from("shifts").select("shift_id,title,shift_date")
            .eq("branch_id", bid).eq("status","published").gte("shift_date", today),
          api.get("/api/staff").catch(() => ({ staff: [] })),
        ]);
        if (cancelled) return;

        // Weekly counts
        const counts = [0,0,0,0,0,0,0];
        (weekShifts || []).forEach(sh => {
          const dow = (new Date(sh.shift_date + "T12:00:00Z").getUTCDay() + 6) % 7;
          counts[dow]++;
        });
        setWeekCounts(counts);

        // Roster rows — staff assigned to today's published shifts
        const allStaff = (branchStaffRes.staff || []).filter(s => s.is_active);
        if (todayShifts?.length > 0) {
          const todayShiftIds = todayShifts.map(s => s.shift_id);
          const { data: assigns } = await supabase
            .from("task_assignments")
            .select("shift_id, staff:staff_id(staff_id, users:user_id(full_name, avatar_url))")
            .in("shift_id", todayShiftIds);
          if (!cancelled) {
            const rows = (assigns || []).map((a, i) => {
              const sh = todayShifts.find(s => s.shift_id === a.shift_id);
              const name = a.staff?.users?.full_name || "Staff";
              const clr = SHIFT_COLORS[i % SHIFT_COLORS.length];
              return {
                name,
                avatar_url: a.staff?.users?.avatar_url || null,
                left: timeToLeft(sh?.start_time?.slice(0,5)),
                width: timeToPct(sh?.start_time?.slice(0,5), sh?.end_time?.slice(0,5)),
                label: sh?.title || "Shift",
                ...clr,
              };
            });
            setRosterRows(rows);
          }
        }

        // Unacked assignments
        if (pubShifts?.length > 0) {
          const { data: unackedRows } = await supabase
            .from("task_assignments")
            .select("shift_id, staff:staff_id(users:user_id(full_name))")
            .in("shift_id", pubShifts.map(s => s.shift_id))
            .eq("acknowledged", false);
          if (!cancelled) {
            const byShift = {};
            (unackedRows || []).forEach(row => {
              if (!byShift[row.shift_id]) {
                const sh = pubShifts.find(s => s.shift_id === row.shift_id);
                byShift[row.shift_id] = { ...sh, staffNames: [] };
              }
              const n = row.staff?.users?.full_name;
              if (n) byShift[row.shift_id].staffNames.push(n);
            });
            setUnackedShifts(Object.values(byShift));
          }
        }

        // Leave requests
        const staffIds = allStaff.map(s => s.staff_id);
        if (staffIds.length > 0) {
          const [{ data: leaves }, { data: swaps }] = await Promise.all([
            supabase.from("availability").select("request_id, staff:staff_id(users:user_id(full_name)), start_date, end_date")
              .eq("status","pending").in("staff_id", staffIds).limit(5),
            supabase.from("swap_requests").select("swap_id, requester:requester_id(users:user_id(full_name)), shift_date")
              .eq("status","pending").in("requester_id", staffIds).limit(5),
          ]);
          if (!cancelled) {
            setLeaveItems((leaves || []).map(l => ({
              id: l.request_id,
              name: l.staff?.users?.full_name || "Staff",
              range: fmtRange(l.start_date, l.end_date),
            })));
            setSwapItems((swaps || []).map(s => ({
              id: s.swap_id,
              name: s.requester?.users?.full_name || "Staff",
              range: s.shift_date ? `Shift on ${fmtDate(s.shift_date)}` : "Swap request",
            })));
          }
        }
      } catch (err) {
        console.error(err);
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

  const maxCount = Math.max(...weekCounts, 1);
  const onLeave  = approvalTab === "leave";

  return (
    <ManagerLayout title="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeUp .4s ease both" }}>

        {/* Greeting */}
        <div>
          <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Manager"}
          </h2>
          <p style={{ fontSize: "21px", color: "#64748B", margin: 0 }}>
            Here's what's happening at your branch today.
            {branchName && (
              <span style={{ marginLeft: "10px", fontSize: "20px", fontWeight: "600", color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "99px", padding: "2px 10px" }}>
                {branchName}
              </span>
            )}
          </p>
        </div>

        {/* Unacked alert */}
        {!loading && unackedShifts.length > 0 && (
          <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: "14px", overflow: "hidden" }}>
            <button onClick={() => setAlertOpen(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" fill="none" stroke="#D97706" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: "21px", fontWeight: "700", color: "#92400E", margin: 0 }}>
                    {unackedShifts.length} Published Shift{unackedShifts.length !== 1 ? "s" : ""} with Unacknowledged Assignments
                  </p>
                  <p style={{ fontSize: "19px", color: "#B45309", margin: "2px 0 0" }}>Click to see which staff haven't confirmed</p>
                </div>
              </div>
              <svg width="16" height="16" fill="none" stroke="#D97706" strokeWidth="2" viewBox="0 0 24 24"
                style={{ transform: alertOpen ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {alertOpen && (
              <div style={{ padding: "0 20px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {unackedShifts.map(sh => (
                  <div key={sh.shift_id} style={{ display: "flex", justifyContent: "space-between", fontSize: "19.5px", padding: "6px 0", borderTop: "1px solid #FEF3C7" }}>
                    <span style={{ fontWeight: "600", color: "#1E293B" }}>{sh.title || "Shift"}</span>
                    <span style={{ color: "#64748B" }}>{fmtDate(sh.shift_date)} · {sh.staffNames.join(", ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Today's Roster — gantt */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: 0 }}>Today's Roster</h3>
            <span style={{ fontSize: "18px", color: "#64748B", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "3px 9px", fontWeight: "500" }}>8AM – 10PM</span>
          </div>
          {/* Time labels */}
          <div style={{ paddingLeft: "130px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "17.5px", color: "#94A3B8", fontWeight: "600" }}>
              {TIME_LABELS.map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: "flex", gap: "12px", padding: "9px 0", borderTop: "1px solid #F1F5F9" }}>
                  <Shimmer w="118px" h="26px" r="13px" />
                  <Shimmer h="28px" r="6px" />
                </div>
              ))}
            </div>
          ) : rosterRows.length === 0 ? (
            <p style={{ fontSize: "20px", color: "#94A3B8", textAlign: "center", padding: "20px 0", margin: 0 }}>No published shifts assigned today.</p>
          ) : (
            rosterRows.map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "9px 0", borderTop: "1px solid #F1F5F9" }}>
                <div style={{ width: "118px", flexShrink: 0, display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <UserAvatar name={row.name} avatar_url={row.avatar_url} size={26} fontSize={11} />
                  <span style={{ fontSize: "19.5px", fontWeight: "600", color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                </div>
                <div style={{ flex: 1, position: "relative", height: "28px", background: "#FAFBFC", borderRadius: "6px" }}>
                  <div style={{ position: "absolute", top: "2px", height: "24px", left: `${row.left}%`, width: `${row.width}%`, background: row.bg, color: row.color, border: `1px solid ${row.border}`, borderRadius: "6px", display: "flex", alignItems: "center", padding: "0 8px", fontSize: "18px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden" }}>
                    {row.label}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Workload + Leave/Swap */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Weekly Workload */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: "0 0 4px" }}>Weekly Workload</h3>
            <p style={{ fontSize: "19px", color: "#94A3B8", margin: "0 0 18px" }}>Shifts scheduled per day</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
              {DAYS_SHORT.map((day, i) => {
                const count  = weekCounts[i];
                const pct    = loading ? 40 : Math.max(count > 0 ? 10 : 0, Math.round((count / maxCount) * 100));
                const isToday = i === todayDow;
                return (
                  <div key={day} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ width: "34px", fontSize: "19px", fontWeight: "600", color: isToday ? "#0D9488" : "#94A3B8", flexShrink: 0 }}>{day}</span>
                    <div style={{ flex: 1, height: "20px", background: "#F1F5F9", borderRadius: "6px", overflow: "hidden" }}>
                      {loading ? (
                        <div style={{ height: "100%", width: "40%", background: "#E2E8F0", borderRadius: "6px", animation: "shimmer 1.4s infinite linear" }} />
                      ) : (
                        <div style={{ height: "100%", width: `${pct}%`, background: isToday ? "#0D9488" : "#5EEAD4", borderRadius: "6px", transition: "width .5s ease" }} />
                      )}
                    </div>
                    <span style={{ width: "18px", fontSize: "19px", fontWeight: "700", color: "#0D9488", textAlign: "right", flexShrink: 0 }}>
                      {loading ? "" : count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave / Swap tabs */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              {[["leave","Leave"], ["swap","Swaps"]].map(([key, label]) => {
                const count = key === "leave" ? leaveItems.length : swapItems.length;
                const active = approvalTab === key;
                return (
                  <button key={key} onClick={() => setApprovalTab(key)}
                    style={{ flex: 1, padding: "8px", borderRadius: "9px", border: `1px solid ${active ? "#BFDBFE" : "#E2E8F0"}`, background: active ? "#EFF6FF" : "transparent", color: active ? "#2563EB" : "#94A3B8", fontSize: "19.5px", fontWeight: "700", cursor: "pointer" }}>
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2].map(i => <Shimmer key={i} h="52px" r="10px" />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(onLeave ? leaveItems : swapItems).length === 0 ? (
                  <p style={{ fontSize: "19.5px", color: "#94A3B8", textAlign: "center", padding: "16px 0", margin: 0 }}>All caught up.</p>
                ) : (
                  (onLeave ? leaveItems : swapItems).map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "19.5px", fontWeight: "600", color: "#1E293B", margin: 0 }}>{item.name}</p>
                        <p style={{ fontSize: "18px", color: "#94A3B8", margin: "1px 0 0" }}>{item.range}</p>
                      </div>
                      <button onClick={() => {
                        if (onLeave) setLeaveItems(p => p.filter(x => x.id !== item.id));
                        else setSwapItems(p => p.filter(x => x.id !== item.id));
                        showToast("Approved");
                      }} style={{ width: "26px", height: "26px", borderRadius: "7px", border: "none", background: "#DCFCE7", color: "#16A34A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                      <button onClick={() => {
                        if (onLeave) setLeaveItems(p => p.filter(x => x.id !== item.id));
                        else setSwapItems(p => p.filter(x => x.id !== item.id));
                        showToast("Declined", "error");
                      }} style={{ width: "26px", height: "26px", borderRadius: "7px", border: "none", background: "#FEE2E2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "18px 22px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "Create Shift",  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>, link: "/manager/shifts/new" },
            { label: "View Staff",    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>, link: "/manager/staff" },
            { label: "Approve Leave", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>, link: "/manager/availability" },
            { label: "View Reports",  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 4-6"/></svg>, link: "/manager/reports" },
          ].map(a => <QuickBtn key={a.label} {...a} onClick={() => goTo(a.link)} />)}
        </div>

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "error" ? "#EF4444" : "#22C55E", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "21px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,.15)", animation: "toastIn .3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

function QuickBtn({ label, icon, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ flex: 1, minWidth: "150px", display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: hov ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${hov ? "#BFDBFE" : "#E2E8F0"}`, borderRadius: "10px", fontSize: "20px", fontWeight: "600", color: hov ? "#2563EB" : "#1E293B", cursor: "pointer", transition: "all .15s" }}>
      {icon}{label}
    </button>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-SG", { day:"numeric", month:"short" });
}
function fmtRange(start, end) {
  if (!start) return "—";
  const s = fmtDate(start);
  const e = end && end !== start ? fmtDate(end) : null;
  return e ? `${s} – ${e}` : s;
}
