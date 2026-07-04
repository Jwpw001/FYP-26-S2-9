import { useState, useEffect } from "react";
import StaffLayout from "../../components/layout/StaffLayout";
import { api } from "../../lib/api";
import { FolderKanban, ListChecks, CalendarDays } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-ts-styles")) {
  const style = document.createElement("style");
  style.id = "staff-ts-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .staff-ts-row { transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
    .staff-ts-row:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15,23,42,0.08); border-color: #C7D2FE !important; }
    .staff-ts-input:focus, .staff-ts-select:focus, .staff-ts-textarea:focus { outline: none; border-color: #818CF8 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
    .staff-ts-submit:hover { box-shadow: 0 6px 18px rgba(79,70,229,0.35); }
  `;
  document.head.appendChild(style);
}

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
  const [tasks,      setTasks]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [logForm,    setLogForm]    = useState({ date: toLocalISO(new Date()), hours:"", project_id:"", task_id:"", description:"" });
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState("");
  const [error,      setError]      = useState("");

  const weekDates = getWeekDates(weekOffset);
  const weekStart = toLocalISO(weekDates[0]);
  const weekEnd   = toLocalISO(weekDates[6]);

  useEffect(() => { load(); }, [weekOffset]);
  useEffect(() => { loadProjects(); loadTasks(); }, []);

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

  async function loadTasks() {
    try {
      const r = await api.get("/api/flex/my-tasks");
      setTasks(r.tasks || []);
    } catch { }
  }

  const tasksForProject = logForm.project_id
    ? tasks.filter(t => String(t.project_id) === String(logForm.project_id))
    : [];

  function handleProjectChange(project_id) {
    setLogForm(p => ({ ...p, project_id, task_id: "" }));
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
        task_id: logForm.task_id ? Number(logForm.task_id) : null,
        description: logForm.description,
      });
      setSuccess("Hours submitted!");
      setLogForm(p => ({ ...p, hours:"", task_id:"", description:"" }));
      await load();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  const totalHours = timesheets.reduce((s,t)=>s+Number(t.hours_worked),0);
  const approvedHours = timesheets.filter(t=>t.status==="approved").reduce((s,t)=>s+Number(t.hours_worked),0);

  const INP = { padding:"9px 12px", borderRadius:"9px", border:"1.5px solid #E2E8F0", fontSize:"13px", color:"#1E293B", outline:"none", background:"#fff", width:"100%", boxSizing:"border-box", fontFamily:"inherit", transition:"border-color 0.15s, box-shadow 0.15s" };
  const LABEL = { fontSize:"11px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"5px", textTransform:"uppercase", letterSpacing:"0.03em" };

  return (
    <StaffLayout title="My Timesheets">
      <div style={{ display:"flex", gap:"24px", padding:"28px 32px", flexWrap:"wrap", animation:"pageIn 0.4s ease both" }}>

        {/* Left: log hours form */}
        <div style={{ flex:"0 0 320px" }}>
          <div style={{ background:"#fff", borderRadius:"16px", border:"1px solid #E8EDF5", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ padding:"18px 20px", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff" }}>
              <div style={{ fontSize:"15px", fontWeight:"800" }}>Log Hours</div>
              <div style={{ fontSize:"11.5px", opacity:0.75, marginTop:"2px" }}>Submit your daily work hours</div>
            </div>
            <form onSubmit={handleSubmit} style={{ padding:"18px 20px" }}>
              {error   && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"9px", padding:"9px 12px", fontSize:"12px", color:"#DC2626", marginBottom:"14px" }}>{error}</div>}
              {success && <div style={{ background:"#DCFCE7", border:"1px solid #BBF7D0", borderRadius:"9px", padding:"9px 12px", fontSize:"12px", color:"#166534", marginBottom:"14px" }}>{success}</div>}

              <div style={{ marginBottom:"14px" }}>
                <label style={LABEL}>Date</label>
                <input className="staff-ts-input" type="date" style={INP} value={logForm.date} onChange={e=>setLogForm(p=>({...p,date:e.target.value}))} required/>
              </div>
              <div style={{ marginBottom:"14px" }}>
                <label style={LABEL}>Hours Worked</label>
                <input className="staff-ts-input" type="number" min="0.5" max="24" step="0.5" style={INP} value={logForm.hours} onChange={e=>setLogForm(p=>({...p,hours:e.target.value}))} placeholder="e.g. 8" required/>
              </div>
              <div style={{ marginBottom:"14px" }}>
                <label style={LABEL}>Project (optional)</label>
                <select className="staff-ts-select" style={{...INP, cursor:"pointer"}} value={logForm.project_id} onChange={e=>handleProjectChange(e.target.value)}>
                  <option value="">— General / No project —</option>
                  {projects.filter(p=>p.status==="active").map(p=>(
                    <option key={p.project_id} value={p.project_id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom:"16px" }}>
                <label style={LABEL}>Task (optional)</label>
                <select className="staff-ts-select" style={{...INP, cursor: logForm.project_id ? "pointer" : "not-allowed", opacity: logForm.project_id ? 1 : 0.6}} value={logForm.task_id} onChange={e=>setLogForm(p=>({...p,task_id:e.target.value}))} disabled={!logForm.project_id}>
                  <option value="">
                    {logForm.project_id ? "— No specific task —" : "Select a project first"}
                  </option>
                  {tasksForProject.map(t=>(
                    <option key={t.task_id} value={t.task_id}>{t.title}</option>
                  ))}
                </select>
                {logForm.project_id && tasksForProject.length === 0 && (
                  <p style={{ fontSize:"10.5px", color:"#94A3B8", marginTop:"4px" }}>No tasks assigned to you on this project.</p>
                )}
              </div>
              <div style={{ marginBottom:"18px" }}>
                <label style={LABEL}>Notes (optional)</label>
                <textarea className="staff-ts-textarea" style={{...INP, resize:"vertical"}} rows={2} value={logForm.description} onChange={e=>setLogForm(p=>({...p,description:e.target.value}))} placeholder="What did you work on?"/>
              </div>
              <button type="submit" disabled={submitting} className="staff-ts-submit"
                style={{ width:"100%", padding:"11px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff", fontSize:"13.5px", fontWeight:"700", cursor:"pointer", transition:"box-shadow 0.15s" }}>
                {submitting ? "Submitting…" : "Submit Hours"}
              </button>
            </form>
          </div>

          {/* Weekly summary */}
          <div style={{ marginTop:"14px", background:"#fff", borderRadius:"14px", border:"1px solid #E8EDF5", padding:"16px 18px" }}>
            <div style={{ fontSize:"12.5px", fontWeight:"700", color:"#1E293B", marginBottom:"12px" }}>This Week Summary</div>
            <div style={{ display:"flex", gap:"8px" }}>
              {[{label:"Total",val:`${totalHours}h`,color:"#4F46E5"},{label:"Approved",val:`${approvedHours}h`,color:"#10B981"},{label:"Target",val:"40h",color:"#94A3B8"}].map(s=>(
                <div key={s.label} style={{ flex:1, textAlign:"center", padding:"10px 8px", borderRadius:"10px", background:"#F8FAFC" }}>
                  <div style={{ fontSize:"17px", fontWeight:"900", color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:"9.5px", color:"#94A3B8", marginTop:"2px", fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.03em" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:"12px", height:"7px", borderRadius:"7px", background:"#F1F5F9", overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:"7px", background:"linear-gradient(90deg,#4F46E5,#7C3AED)", width:`${Math.min(100,Math.round((totalHours/40)*100))}%`, transition:"width 0.4s ease" }}/>
            </div>
            <div style={{ fontSize:"10.5px", color:"#94A3B8", marginTop:"5px", textAlign:"right" }}>{Math.min(100,Math.round((totalHours/40)*100))}% of target</div>
          </div>
        </div>

        {/* Right: timesheet history */}
        <div style={{ flex:1, minWidth:"320px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"16px" }}>
            <h3 style={{ fontSize:"16px", fontWeight:"800", color:"#1E293B" }}>
              {weekDates[0].toLocaleDateString("en-SG",{day:"numeric",month:"short"})} – {weekDates[6].toLocaleDateString("en-SG",{day:"numeric",month:"short"})}
            </h3>
            <div style={{ display:"flex", gap:"6px" }}>
              <button onClick={()=>setWeekOffset(p=>p-1)} style={{ width:"30px",height:"30px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"13px" }}>←</button>
              <button onClick={()=>setWeekOffset(0)} style={{ padding:"5px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",fontSize:"12px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>Now</button>
              <button onClick={()=>setWeekOffset(p=>p+1)} style={{ width:"30px",height:"30px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"13px" }}>→</button>
            </div>
          </div>

          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {Array.from({length:3}).map((_,i)=>(
                <div key={i} style={{ height:"64px", borderRadius:"12px", background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }}/>
              ))}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {timesheets.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 20px", background:"#fff", borderRadius:"16px", border:"1px solid #E8EDF5" }}>
                  <p style={{ fontSize:"32px", marginBottom:"10px", display:"flex", justifyContent:"center" }}><CalendarDays size={32} color="#94A3B8" /></p>
                  <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>No hours logged this week.</p>
                </div>
              ) : timesheets.map((t, i) => {
                const st = STATUS[t.status] || STATUS.pending;
                const color = t.projects?.color || "#6366F1";
                return (
                  <div key={t.timesheet_id} className="staff-ts-row"
                    style={{ background:"#fff", borderRadius:"14px", border:"1px solid #E8EDF5", padding:"14px 16px", display:"flex", alignItems:"center", gap:"14px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.05}s both` }}>
                    <div style={{ flex:"0 0 70px", textAlign:"center", background:"#F8FAFC", borderRadius:"10px", padding:"6px 4px" }}>
                      <div style={{ fontSize:"10px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase" }}>{new Date(t.log_date).toLocaleDateString("en-SG",{weekday:"short"})}</div>
                      <div style={{ fontSize:"15px", fontWeight:"800", color:"#1E293B" }}>{new Date(t.log_date).toLocaleDateString("en-SG",{day:"numeric"})}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {t.projects && (
                        <div style={{ display:"flex", alignItems:"center", gap:"4px", marginBottom:"3px" }}>
                          <FolderKanban size={11} color={color} />
                          <span style={{ fontSize:"10.5px", fontWeight:"700", color }}>{t.projects.name}</span>
                        </div>
                      )}
                      {t.tasks && (
                        <div style={{ display:"flex", alignItems:"center", gap:"4px", marginBottom:"3px" }}>
                          <ListChecks size={11} color="#64748B" />
                          <span style={{ fontSize:"11.5px", fontWeight:"600", color:"#334155" }}>{t.tasks.title}</span>
                        </div>
                      )}
                      {t.description && <div style={{ fontSize:"11px", color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.description}</div>}
                    </div>
                    <div style={{ fontSize:"16px", fontWeight:"800", color:"#1E293B", flexShrink:0 }}>{Number(t.hours_worked)}h</div>
                    <span style={{ fontSize:"10.5px", fontWeight:"700", padding:"3px 10px", borderRadius:"100px", background:st.bg, color:st.color, flexShrink:0 }}>{st.label}</span>
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
