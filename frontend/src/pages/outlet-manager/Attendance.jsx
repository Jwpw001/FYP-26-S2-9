import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

if (typeof document !== "undefined" && !document.getElementById("mgr-attend-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-attend-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />;
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}
function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day:"numeric", month:"short" });
}
function fmtHours(h) {
  if (!h || h <= 0) return "0h";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const TS_STYLE = {
  pending:  { bg:"#FEF3C7", color:"#92400E", label:"Pending"  },
  approved: { bg:"#DCFCE7", color:"#166534", label:"Approved" },
  rejected: { bg:"#FEE2E2", color:"#991B1B", label:"Rejected" },
};

export default function Attendance() {
  const user   = getUser();
  const userId = user?.user_id;
  const [outletId,   setOutletId]   = useState(null);
  const [activeTab,  setActiveTab]  = useState("submissions");
  const [toast,      setToast]      = useState(null);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!userId) return;
    supabase.from("staff").select("branch_id").eq("user_id", userId).eq("is_active", true).limit(1)
      .then(async ({ data }) => {
        if (data?.[0]) { setOutletId(data[0].branch_id); return; }
        const { data: omRow } = await supabase.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1);
        if (omRow?.[0]) setOutletId(omRow[0].branch_id);
      });
  }, [userId]);

  return (
    <ManagerLayout title="Timesheet">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#1E293B" }}>Timesheet</h2>
            <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
              {activeTab === "submissions" ? "Review staff timesheet submissions" : "Track approved working hours per staff"}
            </p>
          </div>
          <div style={{ display:"flex", gap:"3px", background:"#F1F5F9", borderRadius:"10px", padding:"3px" }}>
            {[["submissions","Submissions"],["hours","Working Hours"]].map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{ padding:"7px 18px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:"600", transition:"all 0.15s",
                  background: activeTab===id ? "#FFF" : "transparent",
                  color:      activeTab===id ? "#1E293B" : "#64748B",
                  boxShadow:  activeTab===id ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "submissions"
          ? <Submissions outletId={outletId} managerId={userId} showToast={showToast} />
          : <WorkingHours outletId={outletId} />
        }
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", zIndex:9999,
          background: toast.ok ? "#22C55E" : "#EF4444",
          color:"#FFF", padding:"12px 20px", borderRadius:"10px",
          fontSize:"14px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.15)",
          animation:"toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

// ── Submissions ──────────────────────────────────────────────────────────────

function Submissions({ outletId, managerId, showToast }) {
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("pending");
  const [detail,      setDetail]      = useState(null);   // card clicked for detail panel
  const [acting,      setActing]      = useState(null);   // single-card acting id
  const [bulkActing,  setBulkActing]  = useState(false);
  const [checked,     setChecked]     = useState(new Set()); // selected timesheet_ids

  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: staffRows } = await supabase
          .from("staff").select("staff_id, users(full_name)")
          .eq("branch_id", outletId).eq("is_active", true);
        if (!staffRows?.length || cancelled) { setRows([]); setLoading(false); return; }

        const staffIds = staffRows.map(s => s.staff_id);
        const staffMap = Object.fromEntries(staffRows.map(s => [s.staff_id, s.users?.full_name || "Staff"]));

        const { data: ts } = await supabase
          .from("timesheets")
          .select("timesheet_id, staff_id, log_date, hours_worked, description, status, reviewed_at")
          .in("staff_id", staffIds).is("task_id", null)
          .order("log_date", { ascending: false });
        if (cancelled) return;

        const { data: assignments } = await supabase
          .from("task_assignments")
          .select("staff_id, shifts(title, shift_date)")
          .in("staff_id", staffIds);

        const shiftTitleMap = {};
        for (const a of (assignments || [])) {
          const d = a.shifts?.shift_date;
          if (!d) continue;
          const k = `${a.staff_id}_${d}`;
          if (!shiftTitleMap[k]) shiftTitleMap[k] = a.shifts?.title || "Shift";
        }

        if (!cancelled) {
          setRows((ts || []).map(t => ({
            ...t,
            staffName:  staffMap[t.staff_id] || "Staff",
            shiftTitle: shiftTitleMap[`${t.staff_id}_${t.log_date}`] || "Shift",
          })));
        }
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [outletId]);

  // Clear selection when filter changes
  useEffect(() => { setChecked(new Set()); }, [filter]);

  async function decide(tsId, status) {
    setActing(tsId);
    try {
      const { error } = await supabase.from("timesheets")
        .update({ status, reviewed_by: managerId, reviewed_at: new Date().toISOString() })
        .eq("timesheet_id", tsId);
      if (error) throw error;
      const now = new Date().toISOString();
      setRows(prev => prev.map(r => r.timesheet_id === tsId ? { ...r, status, reviewed_at: now } : r));
      if (detail?.timesheet_id === tsId) setDetail(prev => ({ ...prev, status, reviewed_at: now }));
      setChecked(prev => { const n = new Set(prev); n.delete(tsId); return n; });
      showToast(status === "approved" ? "Approved!" : "Rejected.");
    } catch { showToast("Failed to update.", false); }
    finally { setActing(null); }
  }

  async function bulkDecideList(ids, status) {
    if (!ids.length) return;
    setBulkActing(true);
    try {
      const now = new Date().toISOString();
      const idSet = new Set(ids);
      const { error } = await supabase.from("timesheets")
        .update({ status, reviewed_by: managerId, reviewed_at: now })
        .in("timesheet_id", ids);
      if (error) throw error;
      setRows(prev => prev.map(r => idSet.has(r.timesheet_id) ? { ...r, status, reviewed_at: now } : r));
      if (detail && idSet.has(detail.timesheet_id)) setDetail(prev => ({ ...prev, status, reviewed_at: now }));
      setChecked(new Set());
      showToast(`${ids.length} submission${ids.length > 1 ? "s" : ""} ${status}.`);
    } catch { showToast("Bulk action failed.", false); }
    finally { setBulkActing(false); }
  }

  async function bulkDecide(status) {
    bulkDecideList([...checked].filter(id => {
      const row = rows.find(r => r.timesheet_id === id);
      return row?.status === "pending";
    }), status);
  }

  const filtered     = rows.filter(r => filter === "all" || r.status === filter);
  const pendingCount = rows.filter(r => r.status === "pending").length;
  const filteredIds  = filtered.map(r => r.timesheet_id);
  const allChecked   = filteredIds.length > 0 && filteredIds.every(id => checked.has(id));
  const someChecked  = checked.size > 0;
  // Only show bulk approve/reject for pending items (or mixed when "all" filter)
  const checkedPending = filtered.filter(r => checked.has(r.timesheet_id) && r.status === "pending");

  function toggleAll() {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(filteredIds));
  }
  function toggleOne(id) {
    setChecked(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns: detail ? "1fr 380px" : "1fr", gap:"20px", alignItems:"start" }}>

      {/* Card list */}
      <div>
        {/* Filter bar */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:"3px", background:"#F1F5F9", borderRadius:"10px", padding:"3px" }}>
            {[["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["all","All"]].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding:"6px 14px", borderRadius:"7px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"600", transition:"all 0.15s",
                  background: filter===f ? "#FFF" : "transparent",
                  color:      filter===f ? "#1E293B" : "#64748B",
                  boxShadow:  filter===f ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {label}
                {f === "pending" && pendingCount > 0 && (
                  <span style={{ marginLeft:"5px", background:"#EF4444", color:"#FFF", fontSize:"10px", fontWeight:"700", padding:"1px 5px", borderRadius:"100px" }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          <span style={{ fontSize:"12px", color:"#94A3B8" }}>{filtered.length} submission{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Bulk action bar */}
        {!loading && filtered.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px", padding:"10px 14px",
            background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"10px", flexWrap:"wrap" }}>
            {/* Select-all checkbox */}
            <label style={{ display:"flex", alignItems:"center", gap:"7px", cursor:"pointer", userSelect:"none" }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll}
                style={{ width:"15px", height:"15px", accentColor:"#2563EB", cursor:"pointer" }} />
              <span style={{ fontSize:"12px", fontWeight:"600", color:"#475569" }}>
                {someChecked ? `${checked.size} selected` : "Select all"}
              </span>
            </label>

            <div style={{ flex:1 }} />

            {/* Approve/Reject All (acts on all filtered pending) */}
            {!someChecked && (
              <>
                <button onClick={() => bulkDecideList(filtered.filter(r => r.status === "pending").map(r => r.timesheet_id), "approved")}
                  disabled={bulkActing || filtered.filter(r => r.status === "pending").length === 0}
                  style={{ padding:"6px 14px", borderRadius:"8px", border:"none", background:"#22C55E", color:"#FFF",
                    fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: (bulkActing || !filtered.some(r => r.status==="pending")) ? 0.5 : 1, transition:"opacity 0.15s" }}>
                  Approve All
                </button>
                <button onClick={() => bulkDecideList(filtered.filter(r => r.status === "pending").map(r => r.timesheet_id), "rejected")}
                  disabled={bulkActing || filtered.filter(r => r.status === "pending").length === 0}
                  style={{ padding:"6px 14px", borderRadius:"8px", border:"1.5px solid #FECACA", background:"#FFF5F5", color:"#EF4444",
                    fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: (bulkActing || !filtered.some(r => r.status==="pending")) ? 0.5 : 1, transition:"opacity 0.15s" }}>
                  Reject All
                </button>
              </>
            )}

            {/* Bulk action on selection */}
            {someChecked && (
              <>
                {checkedPending.length > 0 && (
                  <>
                    <button onClick={() => bulkDecide("approved")} disabled={bulkActing}
                      style={{ padding:"6px 14px", borderRadius:"8px", border:"none", background:"#22C55E", color:"#FFF",
                        fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: bulkActing ? 0.6:1 }}>
                      {bulkActing ? "…" : `Approve (${checkedPending.length})`}
                    </button>
                    <button onClick={() => bulkDecide("rejected")} disabled={bulkActing}
                      style={{ padding:"6px 14px", borderRadius:"8px", border:"1.5px solid #FECACA", background:"#FFF5F5", color:"#EF4444",
                        fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: bulkActing ? 0.6:1 }}>
                      {bulkActing ? "…" : `Reject (${checkedPending.length})`}
                    </button>
                  </>
                )}
                <button onClick={() => setChecked(new Set())}
                  style={{ padding:"6px 12px", borderRadius:"8px", border:"1px solid #E2E8F0", background:"#FFF", color:"#64748B",
                    fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {Array.from({length:5}).map((_,i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"16px 20px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex:1 }}>
                    <Shimmer w="140px" h="14px" r="6px" />
                    <div style={{ marginTop:"8px" }}><Shimmer w="200px" h="11px" r="5px" /></div>
                  </div>
                  <Shimmer w="64px" h="22px" r="100px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"60px", textAlign:"center" }}>
            <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B", marginBottom:"6px" }}>No {filter === "all" ? "" : filter} submissions</p>
            <p style={{ fontSize:"13px", color:"#94A3B8" }}>Staff submissions will appear here once they report their shifts.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {filtered.map((r, i) => {
              const st        = TS_STYLE[r.status] || TS_STYLE.pending;
              const isDetail  = detail?.timesheet_id === r.timesheet_id;
              const isChecked = checked.has(r.timesheet_id);
              const initial   = r.staffName?.[0]?.toUpperCase() || "?";
              return (
                <div key={r.timesheet_id}
                  style={{ display:"flex", alignItems:"center", gap:"10px",
                    background: isDetail ? "#EFF6FF" : isChecked ? "#F0FDF4" : "#FFF",
                    border: `${isDetail ? "2px" : "1px"} solid ${isDetail ? "#BFDBFE" : isChecked ? "#BBF7D0" : "#E2E8F0"}`,
                    borderRadius:"14px", padding:"13px 16px 13px 14px",
                    transition:"all 0.15s", animation:`fadeSlideUp 0.25s ease ${i*0.03}s both` }}>

                  {/* Checkbox */}
                  <input type="checkbox" checked={isChecked}
                    onChange={e => { e.stopPropagation(); toggleOne(r.timesheet_id); }}
                    style={{ width:"15px", height:"15px", accentColor:"#2563EB", cursor:"pointer", flexShrink:0 }} />

                  {/* Clickable card body */}
                  <button onClick={() => setDetail(isDetail ? null : r)}
                    style={{ flex:1, textAlign:"left", background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:"12px" }}>
                    {/* Avatar */}
                    <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:avatarColor(r.staffName), color:"#FFF",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", fontWeight:"800", flexShrink:0 }}>
                      {initial}
                    </div>

                    {/* Main info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                        <span style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>{r.staffName}</span>
                        <span style={{ padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"700", background:st.bg, color:st.color }}>{st.label}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"3px", flexWrap:"wrap" }}>
                        <span style={{ fontSize:"12px", fontWeight:"600", color:"#475569" }}>{r.shiftTitle}</span>
                        <span style={{ color:"#CBD5E1", fontSize:"11px" }}>·</span>
                        <span style={{ fontSize:"12px", color:"#64748B" }}>{fmtDate(r.log_date)}</span>
                      </div>
                    </div>

                    {/* Hours */}
                    <span style={{ fontSize:"16px", fontWeight:"800", color:"#1E293B", flexShrink:0 }}>{fmtHours(parseFloat(r.hours_worked || 0))}</span>

                    {/* Chevron */}
                    <svg width="15" height="15" fill="none" stroke="#CBD5E1" strokeWidth="2" viewBox="0 0 24 24"
                      style={{ flexShrink:0, transform: isDetail ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {detail && (
        <DetailPanel
          ts={detail}
          acting={acting}
          onDecide={decide}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function DetailPanel({ ts, acting, onDecide, onClose }) {
  const st      = TS_STYLE[ts.status] || TS_STYLE.pending;
  const initial = ts.staffName?.[0]?.toUpperCase() || "?";
  const isPending = ts.status === "pending";

  return (
    <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", overflow:"hidden",
      position:"sticky", top:"24px", animation:"slideIn 0.25s ease both" }}>

      {/* Panel header */}
      <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>Submission Report</span>
        <button onClick={onClose}
          style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:"4px", borderRadius:"6px" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div style={{ padding:"22px" }}>
        {/* Staff */}
        <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"22px" }}>
          <div style={{ width:"52px", height:"52px", borderRadius:"50%", background:avatarColor(ts.staffName), color:"#FFF",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", fontWeight:"800", flexShrink:0 }}>
            {initial}
          </div>
          <div>
            <p style={{ fontSize:"17px", fontWeight:"800", color:"#1E293B" }}>{ts.staffName}</p>
            <span style={{ padding:"3px 9px", borderRadius:"100px", fontSize:"11px", fontWeight:"700", background:st.bg, color:st.color }}>{st.label}</span>
          </div>
        </div>

        {/* Metadata rows */}
        <div style={{ display:"flex", flexDirection:"column", gap:"12px", marginBottom:"22px" }}>
          <MetaRow icon="📋" label="Shift" value={ts.shiftTitle} />
          <MetaRow icon="📅" label="Date"  value={fmtDate(ts.log_date)} />
          <MetaRow icon="⏱️" label="Hours Logged" value={<span style={{ fontSize:"18px", fontWeight:"800", color:"#059669" }}>{fmtHours(parseFloat(ts.hours_worked || 0))}</span>} />
        </div>

        {/* Description */}
        <div style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"16px", marginBottom:"22px" }}>
          <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", letterSpacing:"0.05em", marginBottom:"8px" }}>DESCRIPTION</p>
          <p style={{ fontSize:"14px", color:"#334155", lineHeight:1.65 }}>{ts.description || "No description provided."}</p>
        </div>

        {/* Reviewed info */}
        {ts.reviewed_at && !isPending && (
          <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"16px" }}>
            {ts.status === "approved" ? "Approved" : "Rejected"} on{" "}
            {new Date(ts.reviewed_at).toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" })}
          </p>
        )}

        {/* Action buttons */}
        {isPending && (
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={() => onDecide(ts.timesheet_id, "approved")} disabled={!!acting}
              style={{ flex:1, padding:"11px", borderRadius:"10px", border:"none", background:"#22C55E", color:"#FFF",
                fontSize:"14px", fontWeight:"700", cursor: acting ? "not-allowed":"pointer", opacity: acting ? 0.6:1, transition:"opacity 0.15s" }}>
              {acting === ts.timesheet_id ? "…" : "Approve"}
            </button>
            <button onClick={() => onDecide(ts.timesheet_id, "rejected")} disabled={!!acting}
              style={{ flex:1, padding:"11px", borderRadius:"10px", border:"1.5px solid #FECACA", background:"#FFF5F5", color:"#EF4444",
                fontSize:"14px", fontWeight:"700", cursor: acting ? "not-allowed":"pointer", opacity: acting ? 0.6:1, transition:"opacity 0.15s" }}>
              {acting === ts.timesheet_id ? "…" : "Reject"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaRow({ icon, label, value }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <span style={{ fontSize:"15px", width:"20px", textAlign:"center", flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:"12px", fontWeight:"700", color:"#94A3B8", minWidth:"80px" }}>{label}</span>
      <span style={{ fontSize:"13px", color:"#334155", fontWeight:"600" }}>{value}</span>
    </div>
  );
}

// ── Working Hours ────────────────────────────────────────────────────────────

function WorkingHours({ outletId }) {
  const [period,      setPeriod]      = useState("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [staffData,   setStaffData]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [expanded,    setExpanded]    = useState({});

  function getRange(p) {
    const today = new Date();
    if (p === "week") {
      const dow  = today.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const start = new Date(today); start.setDate(today.getDate() + diff);
      const end   = new Date(start);  end.setDate(start.getDate() + 6);
      return [toLocalDateStr(start), toLocalDateStr(end)];
    }
    if (p === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return [toLocalDateStr(start), toLocalDateStr(end)];
    }
    return [customStart, customEnd];
  }

  useEffect(() => {
    if (!outletId) return;
    if (period === "custom" && (!customStart || !customEnd)) return;
    const [startDate, endDate] = getRange(period);
    if (!startDate || !endDate) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Get staff in outlet
        const { data: staffRows } = await supabase
          .from("staff")
          .select("staff_id, users(full_name)")
          .eq("branch_id", outletId)
          .eq("is_active", true);

        if (!staffRows?.length || cancelled) { setStaffData([]); setLoading(false); return; }

        const staffIds = staffRows.map(s => s.staff_id);
        const staffMap = Object.fromEntries(staffRows.map(s => [s.staff_id, s.users?.full_name || "Staff"]));

        // Get approved timesheets for this period
        const { data: ts } = await supabase
          .from("timesheets")
          .select("timesheet_id, staff_id, log_date, hours_worked, description")
          .in("staff_id", staffIds)
          .eq("status", "approved")
          .is("task_id", null)
          .gte("log_date", startDate)
          .lte("log_date", endDate)
          .order("log_date", { ascending: false });

        if (cancelled) return;

        // Fetch shift titles for context
        const { data: assignments } = await supabase
          .from("task_assignments")
          .select("staff_id, shifts(title, shift_date)")
          .in("staff_id", staffIds);

        const shiftTitleMap = {};
        for (const a of (assignments || [])) {
          const d = a.shifts?.shift_date;
          if (!d) continue;
          const k = `${a.staff_id}_${d}`;
          if (!shiftTitleMap[k]) shiftTitleMap[k] = a.shifts?.title || "Shift";
        }

        // Group by staff
        const grouped = {};
        for (const t of (ts || [])) {
          if (!grouped[t.staff_id]) grouped[t.staff_id] = { staffId:t.staff_id, name:staffMap[t.staff_id], totalHours:0, records:[] };
          const hours = parseFloat(t.hours_worked || 0);
          grouped[t.staff_id].totalHours += hours;
          grouped[t.staff_id].records.push({
            ...t,
            hours,
            shiftTitle: shiftTitleMap[`${t.staff_id}_${t.log_date}`] || "Shift",
          });
        }

        if (!cancelled) {
          setStaffData(Object.values(grouped).sort((a,b) => b.totalHours - a.totalHours));
        }
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [outletId, period, customStart, customEnd]);

  if (!outletId) return <div style={{ textAlign:"center", padding:"64px", color:"#94A3B8", fontSize:"14px" }}>Loading…</div>;

  const [startDate, endDate] = getRange(period);
  const totalHours = staffData.reduce((s, x) => s + x.totalHours, 0);

  return (
    <div>
      {/* Period selector */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:"3px", background:"#F1F5F9", borderRadius:"10px", padding:"3px" }}>
          {[["week","This Week"],["month","This Month"],["custom","Custom"]].map(([id,label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              style={{ padding:"6px 14px", borderRadius:"7px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:"600", transition:"all 0.15s",
                background: period===id ? "#FFF" : "transparent",
                color:      period===id ? "#1E293B" : "#64748B",
                boxShadow:  period===id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
              {label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ padding:"6px 10px", border:"1.5px solid #E2E8F0", borderRadius:"8px", fontSize:"13px", color:"#1E293B", outline:"none" }} />
            <span style={{ color:"#94A3B8", fontSize:"13px" }}>to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ padding:"6px 10px", border:"1.5px solid #E2E8F0", borderRadius:"8px", fontSize:"13px", color:"#1E293B", outline:"none" }} />
          </>
        )}
        {period !== "custom" && startDate && (
          <span style={{ fontSize:"12px", color:"#94A3B8" }}>{fmtDateShort(startDate)} – {fmtDateShort(endDate)}</span>
        )}
      </div>

      {/* KPIs */}
      {!loading && staffData.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px", marginBottom:"20px" }}>
          {[
            { label:"Staff with Approved Hours", value: staffData.length, color:"#2563EB" },
            { label:"Total Approved Hours",       value: fmtHours(totalHours), color:"#059669" },
            { label:"Avg per Staff",              value: fmtHours(staffData.length ? totalHours/staffData.length : 0), color:"#7C3AED" },
          ].map(k => (
            <div key={k.label} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"16px 20px" }}>
              <p style={{ fontSize:"22px", fontWeight:"800", color:k.color }}>{k.value}</p>
              <p style={{ fontSize:"12px", fontWeight:"600", color:"#64748B", marginTop:"4px" }}>{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {Array.from({length:4}).map((_,i) => <Shimmer key={i} h="72px" r="12px" />)}
        </div>
      ) : staffData.length === 0 ? (
        <div style={{ textAlign:"center", padding:"64px", color:"#64748B", fontSize:"14px", background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px" }}>
          No approved timesheets found for this period.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {staffData.map((s, i) => {
            const isOpen = !!expanded[s.staffId];
            const initials = s.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <div key={s.staffId} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"12px", overflow:"hidden" }}>
                <div onClick={() => setExpanded(p => ({ ...p, [s.staffId]: !isOpen }))}
                  style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 18px", cursor:"pointer" }}>
                  <span style={{ fontSize:"11px", fontWeight:"700", color:"#CBD5E1", minWidth:"20px" }}>#{i+1}</span>
                  <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:avatarColor(s.name), color:"#FFF",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", fontWeight:"700", flexShrink:0 }}>
                    {initials}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>{s.name}</p>
                    <p style={{ fontSize:"12px", color:"#64748B", marginTop:"1px" }}>{s.records.length} approved submission{s.records.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div style={{ textAlign:"right", minWidth:"80px" }}>
                    <p style={{ fontSize:"20px", fontWeight:"800", color:"#059669" }}>{fmtHours(s.totalHours)}</p>
                    <p style={{ fontSize:"11px", color:"#94A3B8" }}>approved</p>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition:"transform 0.2s", flexShrink:0 }}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                {isOpen && s.records.length > 0 && (
                  <div style={{ borderTop:"1px solid #F1F5F9", padding:"0 18px 14px" }}>
                    {[...s.records].sort((a,b) => b.log_date.localeCompare(a.log_date)).map((r, j, arr) => (
                      <div key={r.timesheet_id} style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"10px 0",
                        borderBottom: j < arr.length-1 ? "1px solid #F8FAFC" : "none" }}>
                        {/* Date block */}
                        <div style={{ width:"38px", height:"42px", borderRadius:"9px", background:"#F1F5F9",
                          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:"9px", fontWeight:"700", color:"#94A3B8", lineHeight:1 }}>
                            {new Date(r.log_date+"T00:00:00").toLocaleDateString("en-SG",{month:"short"}).toUpperCase()}
                          </span>
                          <span style={{ fontSize:"14px", fontWeight:"800", color:"#475569", lineHeight:1 }}>
                            {new Date(r.log_date+"T00:00:00").getDate()}
                          </span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:"12px", fontWeight:"600", color:"#1E293B" }}>{r.shiftTitle}</p>
                          {r.description && (
                            <p style={{ fontSize:"11px", color:"#94A3B8", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.description}</p>
                          )}
                        </div>
                        <span style={{ fontSize:"13px", fontWeight:"800", color:"#059669", flexShrink:0 }}>{fmtHours(r.hours)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
