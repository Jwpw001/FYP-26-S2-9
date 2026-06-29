import { useState, useEffect } from "react";
import StaffLayout from "../../components/layout/StaffLayout";
import { api } from "../../lib/api";

const toLocalISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day===0?6:day-1) + offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}

const STATUS = {
  pending:  { bg:"#FEF3C7", color:"#92400E", label:"Pending" },
  approved: { bg:"#DCFCE7", color:"#166534", label:"Approved" },
  rejected: { bg:"#FEE2E2", color:"#991B1B", label:"Rejected" },
};

export default function MyTimesheets() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [timesheets, setTimesheets] = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [logForm,    setLogForm]    = useState({ date: toLocalISO(new Date()), hours:"", project_id:"", description:"" });
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState("");
  const [error,      setError]      = useState("");

  const weekDates = getWeekDates(weekOffset);
  const weekStart = toLocalISO(weekDates[0]);
  const weekEnd   = toLocalISO(weekDates[6]);

  useEffect(() => { load(); loadProjects(); }, [weekOffset]);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`/api/timesheets/my?weekStart=${weekStart}&weekEnd=${weekEnd}`);
      setTimesheets(r.timesheets || []);
    } catch { } finally { setLoading(false); }
  }

  async function loadProjects() {
    try {
      const r = await api.get("/api/projects");
      setProjects(r.projects || []);
    } catch { }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!logForm.hours || Number(logForm.hours) <= 0) { setError("Enter valid hours."); return; }
    setSubmitting(true); setError(""); setSuccess("");
    try {
      await api.post("/api/timesheets", {
        log_date: logForm.date,
        hours_worked: Number(logForm.hours),
        project_id: logForm.project_id ? Number(logForm.project_id) : null,
        description: logForm.description,
      });
      setSuccess("Hours submitted!");
      setLogForm(p => ({ ...p, hours:"", description:"" }));
      await load();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  const totalHours = timesheets.reduce((s,t)=>s+Number(t.hours_worked),0);
  const approvedHours = timesheets.filter(t=>t.status==="approved").reduce((s,t)=>s+Number(t.hours_worked),0);

  const INP = { padding:"9px 12px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", color:"#1E293B", outline:"none", background:"#fff", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };

  return (
    <StaffLayout title="My Timesheets">
      <div style={{ display:"flex", gap:"24px", padding:"24px", maxWidth:"1000px", flexWrap:"wrap", animation:"pageSlideUp 0.25s ease both" }}>

        {/* Left: log hours form */}
        <div style={{ flex:"0 0 300px" }}>
          <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid #E8EDF5", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ padding:"16px 18px", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff" }}>
              <div style={{ fontSize:"14px", fontWeight:"800" }}>Log Hours</div>
              <div style={{ fontSize:"11px", opacity:0.7, marginTop:"2px" }}>Submit your daily work hours</div>
            </div>
            <form onSubmit={handleSubmit} style={{ padding:"16px 18px" }}>
              {error   && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"8px", padding:"8px 12px", fontSize:"12px", color:"#DC2626", marginBottom:"12px" }}>{error}</div>}
              {success && <div style={{ background:"#DCFCE7", border:"1px solid #BBF7D0", borderRadius:"8px", padding:"8px 12px", fontSize:"12px", color:"#166534", marginBottom:"12px" }}>{success}</div>}

              <div style={{ marginBottom:"12px" }}>
                <label style={{ fontSize:"11px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>Date</label>
                <input type="date" style={INP} value={logForm.date} onChange={e=>setLogForm(p=>({...p,date:e.target.value}))} required/>
              </div>
              <div style={{ marginBottom:"12px" }}>
                <label style={{ fontSize:"11px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>Hours Worked</label>
                <input type="number" min="0.5" max="24" step="0.5" style={INP} value={logForm.hours} onChange={e=>setLogForm(p=>({...p,hours:e.target.value}))} placeholder="e.g. 8" required/>
              </div>
              <div style={{ marginBottom:"12px" }}>
                <label style={{ fontSize:"11px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>Project (optional)</label>
                <select style={INP} value={logForm.project_id} onChange={e=>setLogForm(p=>({...p,project_id:e.target.value}))}>
                  <option value="">— General / No project —</option>
                  {projects.filter(p=>p.status==="active").map(p=>(
                    <option key={p.project_id} value={p.project_id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom:"16px" }}>
                <label style={{ fontSize:"11px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>Notes (optional)</label>
                <textarea style={{...INP, resize:"vertical"}} rows={2} value={logForm.description} onChange={e=>setLogForm(p=>({...p,description:e.target.value}))} placeholder="What did you work on?"/>
              </div>
              <button type="submit" disabled={submitting}
                style={{ width:"100%", padding:"10px", borderRadius:"9px", border:"none", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>
                {submitting ? "Submitting…" : "Submit Hours"}
              </button>
            </form>
          </div>

          {/* Weekly summary */}
          <div style={{ marginTop:"12px", background:"#fff", borderRadius:"12px", border:"1px solid #E8EDF5", padding:"14px 16px" }}>
            <div style={{ fontSize:"12px", fontWeight:"700", color:"#1E293B", marginBottom:"10px" }}>This Week Summary</div>
            <div style={{ display:"flex", gap:"8px" }}>
              {[{label:"Total",val:`${totalHours}h`,color:"#4F46E5"},{label:"Approved",val:`${approvedHours}h`,color:"#10B981"},{label:"Target",val:"40h",color:"#94A3B8"}].map(s=>(
                <div key={s.label} style={{ flex:1, textAlign:"center", padding:"8px", borderRadius:"8px", background:"#F8FAFC" }}>
                  <div style={{ fontSize:"16px", fontWeight:"900", color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:"9px", color:"#94A3B8", marginTop:"1px" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:"10px", height:"6px", borderRadius:"6px", background:"#F1F5F9", overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:"6px", background:"#4F46E5", width:`${Math.min(100,Math.round((totalHours/40)*100))}%` }}/>
            </div>
            <div style={{ fontSize:"10px", color:"#94A3B8", marginTop:"3px", textAlign:"right" }}>{Math.min(100,Math.round((totalHours/40)*100))}% of target</div>
          </div>
        </div>

        {/* Right: timesheet history */}
        <div style={{ flex:1, minWidth:"280px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
            <h3 style={{ fontSize:"15px", fontWeight:"800", color:"#1E293B" }}>
              {weekDates[0].toLocaleDateString("en-SG",{day:"numeric",month:"short"})} – {weekDates[6].toLocaleDateString("en-SG",{day:"numeric",month:"short"})}
            </h3>
            <div style={{ display:"flex", gap:"6px" }}>
              <button onClick={()=>setWeekOffset(p=>p-1)} style={{ width:"28px",height:"28px",borderRadius:"7px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"12px" }}>←</button>
              <button onClick={()=>setWeekOffset(0)} style={{ padding:"4px 10px",borderRadius:"7px",border:"1px solid #E2E8F0",background:"#fff",fontSize:"11px",color:"#64748B",cursor:"pointer" }}>Now</button>
              <button onClick={()=>setWeekOffset(p=>p+1)} style={{ width:"28px",height:"28px",borderRadius:"7px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"12px" }}>→</button>
            </div>
          </div>

          {loading ? <div style={{ textAlign:"center", padding:"40px", color:"#94A3B8" }}>Loading…</div> : (
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {timesheets.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px", color:"#94A3B8", fontSize:"13px" }}>No hours logged this week.</div>
              ) : timesheets.map(t => {
                const st = STATUS[t.status] || STATUS.pending;
                return (
                  <div key={t.timesheet_id} style={{ background:"#fff", borderRadius:"10px", border:"1px solid #E8EDF5", padding:"12px 14px", display:"flex", alignItems:"center", gap:"12px" }}>
                    <div style={{ flex:"0 0 80px" }}>
                      <div style={{ fontSize:"11px", fontWeight:"600", color:"#1E293B" }}>{new Date(t.log_date).toLocaleDateString("en-SG",{weekday:"short",day:"numeric",month:"short"})}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {t.projects && <div style={{ fontSize:"10px", fontWeight:"700", color:t.projects.color||"#6366F1", marginBottom:"1px" }}>{t.projects.name}</div>}
                      {t.description && <div style={{ fontSize:"11px", color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.description}</div>}
                    </div>
                    <div style={{ fontSize:"15px", fontWeight:"800", color:"#1E293B", flexShrink:0 }}>{Number(t.hours_worked)}h</div>
                    <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", background:st.bg, color:st.color, flexShrink:0 }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
}
