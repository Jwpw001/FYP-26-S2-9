import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";

const toLocalISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day===0?6:day-1) + offset*7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { weekStart: toLocalISO(mon), weekEnd: toLocalISO(sun) };
}

const STATUS = {
  pending:  { bg:"#FEF3C7", color:"#92400E", label:"Pending" },
  approved: { bg:"#DCFCE7", color:"#166534", label:"Approved" },
  rejected: { bg:"#FEE2E2", color:"#991B1B", label:"Rejected" },
};

export default function Timesheets() {
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [timesheets,  setTimesheets]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(new Set()); // pending ids for bulk approve
  const [reviewing,   setReviewing]   = useState(false);
  const [filterStatus,setFilterStatus]= useState("all");

  const { weekStart, weekEnd } = getWeekRange(weekOffset);

  useEffect(() => { load(); }, [weekOffset, filterStatus]);

  async function load() {
    setLoading(true); setSelected(new Set());
    try {
      const params = new URLSearchParams({ weekStart, weekEnd });
      if (filterStatus !== "all") params.set("status", filterStatus);
      const r = await api.get(`/api/timesheets?${params}`);
      setTimesheets(r.timesheets || []);
    } catch { } finally { setLoading(false); }
  }

  async function review(id, status) {
    await api.patch(`/api/timesheets/${id}/review`, { status });
    await load();
  }

  async function bulkApprove() {
    if (!selected.size) return;
    setReviewing(true);
    try {
      await api.post("/api/timesheets/bulk-approve", { ids: [...selected] });
      await load();
    } finally { setReviewing(false); }
  }

  function toggleSelect(id) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  const pending = timesheets.filter(t => t.status === "pending");
  const totalHours = timesheets.filter(t=>t.status==="approved").reduce((s,t)=>s+Number(t.hours_worked),0);

  // Group by staff
  const byStaff = {};
  timesheets.forEach(t => {
    const name = t.staff?.users?.full_name || "Unknown";
    if (!byStaff[name]) byStaff[name] = [];
    byStaff[name].push(t);
  });

  return (
    <ManagerLayout title="Timesheets">
      <div style={{ padding:"24px", maxWidth:"1100px", animation:"pageSlideUp 0.25s ease both" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>Timesheets</h2>
            <p style={{ fontSize:"12px", color:"#94A3B8" }}>
              {new Date(weekStart).toLocaleDateString("en-SG",{day:"numeric",month:"short"})} – {new Date(weekEnd).toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}
              {" · "}{totalHours}h approved this week
            </p>
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            {/* Status filter */}
            {["all","pending","approved","rejected"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding:"6px 12px", borderRadius:"8px", border:`1.5px solid ${filterStatus===s?"#4F46E5":"#E2E8F0"}`, background:filterStatus===s?"#EEF2FF":"#fff", color:filterStatus===s?"#4F46E5":"#64748B", fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
            <div style={{ width:"1px", height:"24px", background:"#E2E8F0" }}/>
            {/* Week nav */}
            <button onClick={() => setWeekOffset(p=>p-1)} style={{ width:"32px", height:"32px", borderRadius:"8px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", fontSize:"14px" }}>←</button>
            <button onClick={() => setWeekOffset(0)} style={{ padding:"6px 12px", borderRadius:"8px", border:"1px solid #E2E8F0", background:"#fff", fontSize:"12px", fontWeight:"600", color:"#64748B", cursor:"pointer" }}>Today</button>
            <button onClick={() => setWeekOffset(p=>p+1)} style={{ width:"32px", height:"32px", borderRadius:"8px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", fontSize:"14px" }}>→</button>
          </div>
        </div>

        {/* Bulk approve bar */}
        {pending.length > 0 && (
          <div style={{ background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:"10px", padding:"10px 16px", marginBottom:"16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <input type="checkbox" checked={selected.size === pending.length} onChange={e => setSelected(e.target.checked ? new Set(pending.map(t=>t.timesheet_id)) : new Set())} style={{ width:"15px", height:"15px", accentColor:"#4F46E5" }}/>
              <span style={{ fontSize:"13px", color:"#4F46E5", fontWeight:"600" }}>{pending.length} pending timesheet{pending.length!==1?"s":""}</span>
            </div>
            <button onClick={bulkApprove} disabled={!selected.size || reviewing}
              style={{ padding:"7px 16px", borderRadius:"8px", border:"none", background:selected.size?"#4F46E5":"#C7D2FE", color:"#fff", fontSize:"12px", fontWeight:"700", cursor:selected.size?"pointer":"not-allowed" }}>
              {reviewing ? "Approving…" : `Approve ${selected.size > 0 ? selected.size : "All"} →`}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#94A3B8" }}>Loading…</div>
        ) : Object.keys(byStaff).length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:"36px", marginBottom:"12px" }}>📝</div>
            <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B", marginBottom:"6px" }}>No timesheets this week</p>
            <p style={{ fontSize:"13px", color:"#64748B" }}>Staff haven't submitted any hours yet for this period.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {Object.entries(byStaff).map(([name, entries]) => {
              const total = entries.reduce((s,t)=>s+Number(t.hours_worked),0);
              const pct   = Math.min(100, Math.round((total/40)*100));
              return (
                <div key={name} style={{ background:"#fff", borderRadius:"12px", border:"1px solid #E8EDF5", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                  {/* Staff header */}
                  <div style={{ padding:"12px 16px", background:"#F8FAFC", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                      <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:"#EEF2FF", border:"1.5px solid #C7D2FE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"800", color:"#4F46E5" }}>
                        {name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B" }}>{name}</div>
                        <div style={{ fontSize:"10px", color:"#94A3B8" }}>{total}h / 40h target this week</div>
                      </div>
                    </div>
                    <div style={{ width:"80px" }}>
                      <div style={{ height:"5px", borderRadius:"5px", background:"#F1F5F9", overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:"5px", background: pct>=100?"#10B981":pct>=75?"#4F46E5":"#94A3B8", width:`${pct}%` }}/>
                      </div>
                      <div style={{ fontSize:"9px", color:"#94A3B8", textAlign:"right", marginTop:"2px" }}>{pct}%</div>
                    </div>
                  </div>
                  {/* Entries */}
                  {entries.map(t => {
                    const st = STATUS[t.status] || STATUS.pending;
                    const isPending = t.status === "pending";
                    return (
                      <div key={t.timesheet_id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 16px", borderBottom:"1px solid #F8FAFC" }}>
                        {isPending && (
                          <input type="checkbox" checked={selected.has(t.timesheet_id)} onChange={() => toggleSelect(t.timesheet_id)} style={{ width:"14px", height:"14px", accentColor:"#4F46E5", flexShrink:0 }}/>
                        )}
                        {!isPending && <div style={{ width:"14px", flexShrink:0 }}/>}
                        <div style={{ flex:"0 0 90px" }}>
                          <div style={{ fontSize:"12px", fontWeight:"600", color:"#1E293B" }}>{new Date(t.log_date).toLocaleDateString("en-SG",{weekday:"short",day:"numeric",month:"short"})}</div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          {t.projects && <span style={{ fontSize:"10px", fontWeight:"700", padding:"1px 7px", borderRadius:"100px", background:`${t.projects.color||"#6366F1"}20`, color:t.projects.color||"#6366F1", marginRight:"6px" }}>{t.projects.name}</span>}
                          {t.description && <span style={{ fontSize:"11px", color:"#64748B" }}>{t.description}</span>}
                        </div>
                        <div style={{ fontSize:"14px", fontWeight:"800", color:"#1E293B", flexShrink:0, width:"40px", textAlign:"right" }}>{Number(t.hours_worked)}h</div>
                        <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", background:st.bg, color:st.color, flexShrink:0 }}>{st.label}</span>
                        {isPending && (
                          <div style={{ display:"flex", gap:"4px", flexShrink:0 }}>
                            <button onClick={() => review(t.timesheet_id,"approved")} style={{ padding:"4px 10px", borderRadius:"7px", border:"1px solid #BBF7D0", background:"#DCFCE7", color:"#166534", fontSize:"11px", fontWeight:"700", cursor:"pointer" }}>✓</button>
                            <button onClick={() => review(t.timesheet_id,"rejected")} style={{ padding:"4px 10px", borderRadius:"7px", border:"1px solid #FECACA", background:"#FEE2E2", color:"#991B1B", fontSize:"11px", fontWeight:"700", cursor:"pointer" }}>✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
