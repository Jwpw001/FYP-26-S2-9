import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";

const STATUS_STYLE = {
  active:    { bg:"#DCFCE7", color:"#166534", label:"Active" },
  completed: { bg:"#DBEAFE", color:"#1E40AF", label:"Completed" },
  on_hold:   { bg:"#FEF3C7", color:"#92400E", label:"On Hold" },
  cancelled: { bg:"#FEE2E2", color:"#991B1B", label:"Cancelled" },
};

const COLORS = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444","#14B8A6"];

export default function Projects() {
  const user = getUser();
  const [projects, setProjects] = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null); // project for detail panel
  const [form, setForm] = useState({ name:"", description:"", start_date:"", end_date:"", color:COLORS[0], staff_ids:[] });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => { load(); loadStaff(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/api/projects");
      setProjects(r.projects || []);
    } catch { } finally { setLoading(false); }
  }

  async function loadStaff() {
    const { data: s } = await supabase.from("staff")
      .select("staff_id, experience_level, users(full_name, role)")
      .eq("is_active", true);
    setStaff(s || []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Project name is required."); return; }
    setSaving(true); setError("");
    try {
      await api.post("/api/projects", form);
      setShowForm(false);
      setForm({ name:"", description:"", start_date:"", end_date:"", color:COLORS[0], staff_ids:[] });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function changeStatus(projectId, status) {
    await api.patch(`/api/projects/${projectId}`, { status });
    await load();
    if (selected?.project_id === projectId) setSelected(prev => ({ ...prev, status }));
  }

  const INP = { padding:"9px 12px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", color:"#1E293B", outline:"none", background:"#fff", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };

  return (
    <ManagerLayout title="Projects">
      <div style={{ display:"flex", height:"calc(100vh - 60px)", overflow:"hidden", animation:"pageSlideUp 0.25s ease both" }}>

        {/* ── Left: project list ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px", borderRight:"1px solid #E8EDF5" }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
            <div>
              <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>Projects</h2>
              <p style={{ fontSize:"12px", color:"#94A3B8" }}>{projects.length} total · {projects.filter(p=>p.status==="active").length} active</p>
            </div>
            <button onClick={() => setShowForm(true)}
              style={{ padding:"9px 18px", borderRadius:"9px", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", border:"none", color:"#fff", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>
              + New Project
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#94A3B8" }}>Loading…</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ fontSize:"40px", marginBottom:"12px" }}>📋</div>
              <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B", marginBottom:"6px" }}>No projects yet</p>
              <p style={{ fontSize:"13px", color:"#64748B" }}>Create your first project to start assigning staff and tracking hours.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {projects.map(p => {
                const ss = STATUS_STYLE[p.status] || STATUS_STYLE.active;
                const pct = p.total_estimated_hours > 0 ? Math.min(100, Math.round((p.total_logged_hours / p.total_estimated_hours) * 100)) : 0;
                const isActive = selected?.project_id === p.project_id;
                return (
                  <div key={p.project_id} onClick={() => setSelected(p)} className="card-hover"
                    style={{ borderRadius:"12px", border:`1.5px solid ${isActive ? p.color || "#6366F1" : "#E8EDF5"}`, background: isActive ? "#FAFBFE" : "#fff", padding:"14px 16px", cursor:"pointer", boxShadow: isActive ? `0 0 0 2px ${p.color || "#6366F1"}30` : "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"8px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <div style={{ width:"10px", height:"10px", borderRadius:"50%", background: p.color || "#6366F1", flexShrink:0, marginTop:"2px" }} />
                        <div>
                          <div style={{ fontSize:"14px", fontWeight:"700", color:"#0F172A" }}>{p.name}</div>
                          {p.description && <div style={{ fontSize:"11px", color:"#64748B", marginTop:"2px", maxWidth:"280px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description}</div>}
                        </div>
                      </div>
                      <span style={{ fontSize:"11px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", background:ss.bg, color:ss.color, flexShrink:0 }}>{ss.label}</span>
                    </div>
                    {/* Progress bar */}
                    {p.total_estimated_hours > 0 && (
                      <div style={{ marginBottom:"8px" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10px", color:"#94A3B8", marginBottom:"3px" }}>
                          <span>{p.total_logged_hours}h logged</span>
                          <span>{p.total_estimated_hours}h estimated</span>
                        </div>
                        <div style={{ height:"4px", borderRadius:"4px", background:"#F1F5F9", overflow:"hidden" }}>
                          <div style={{ height:"100%", borderRadius:"4px", background: p.color || "#6366F1", width:`${pct}%`, transition:"width 0.3s" }} />
                        </div>
                      </div>
                    )}
                    {/* Staff avatars */}
                    <div style={{ display:"flex", alignItems:"center", gap:"4px" }}>
                      {(p.project_assignments || []).slice(0,5).map((a,i) => (
                        <div key={i} title={a.staff?.users?.full_name}
                          style={{ width:"22px", height:"22px", borderRadius:"50%", background:`${p.color||"#6366F1"}20`, border:`1.5px solid ${p.color||"#6366F1"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"8px", fontWeight:"800", color: p.color||"#6366F1" }}>
                          {a.staff?.users?.full_name?.[0]?.toUpperCase()}
                        </div>
                      ))}
                      {p.project_assignments?.length > 5 && <span style={{ fontSize:"10px", color:"#94A3B8" }}>+{p.project_assignments.length-5}</span>}
                      {p.project_assignments?.length === 0 && <span style={{ fontSize:"10px", color:"#CBD5E1", fontStyle:"italic" }}>No staff assigned</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: detail panel ── */}
        <div style={{ width:"360px", flexShrink:0, overflowY:"auto", padding:"24px", background:"#FAFBFE" }}>
          {!selected ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:"12px", color:"#94A3B8", textAlign:"center" }}>
              <div style={{ fontSize:"36px" }}>👈</div>
              <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>Select a project</p>
              <p style={{ fontSize:"12px" }}>Click any project to view details, manage staff, and track progress.</p>
            </div>
          ) : (() => {
            const ss = STATUS_STYLE[selected.status] || STATUS_STYLE.active;
            const pct = selected.total_estimated_hours > 0 ? Math.min(100, Math.round((selected.total_logged_hours / selected.total_estimated_hours)*100)) : 0;
            return (
              <div>
                {/* Header */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <div style={{ width:"14px", height:"14px", borderRadius:"50%", background: selected.color||"#6366F1", flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:"16px", fontWeight:"800", color:"#0F172A" }}>{selected.name}</div>
                      <span style={{ fontSize:"11px", fontWeight:"700", padding:"1px 7px", borderRadius:"100px", background:ss.bg, color:ss.color }}>{ss.label}</span>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:"#94A3B8", fontSize:"16px", cursor:"pointer" }}>✕</button>
                </div>

                {selected.description && <p style={{ fontSize:"13px", color:"#64748B", marginBottom:"16px", lineHeight:1.6 }}>{selected.description}</p>}

                {/* Dates */}
                {(selected.start_date || selected.end_date) && (
                  <div style={{ display:"flex", gap:"12px", marginBottom:"16px" }}>
                    {selected.start_date && <div style={{ flex:1, background:"#fff", borderRadius:"8px", padding:"8px 12px", border:"1px solid #E2E8F0" }}>
                      <div style={{ fontSize:"9px", color:"#94A3B8", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.5px" }}>Start</div>
                      <div style={{ fontSize:"12px", fontWeight:"600", color:"#1E293B", marginTop:"2px" }}>{new Date(selected.start_date).toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}</div>
                    </div>}
                    {selected.end_date && <div style={{ flex:1, background:"#fff", borderRadius:"8px", padding:"8px 12px", border:"1px solid #E2E8F0" }}>
                      <div style={{ fontSize:"9px", color:"#94A3B8", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.5px" }}>Deadline</div>
                      <div style={{ fontSize:"12px", fontWeight:"600", color:"#1E293B", marginTop:"2px" }}>{new Date(selected.end_date).toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}</div>
                    </div>}
                  </div>
                )}

                {/* Progress */}
                <div style={{ background:"#fff", borderRadius:"10px", padding:"12px 14px", border:"1px solid #E2E8F0", marginBottom:"16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                    <span style={{ fontSize:"11px", fontWeight:"700", color:"#1E293B" }}>Hours Progress</span>
                    <span style={{ fontSize:"11px", color:"#64748B" }}>{selected.total_logged_hours}h / {selected.total_estimated_hours}h</span>
                  </div>
                  <div style={{ height:"6px", borderRadius:"6px", background:"#F1F5F9", overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:"6px", background: selected.color||"#6366F1", width:`${pct}%` }} />
                  </div>
                  <div style={{ fontSize:"10px", color:"#94A3B8", marginTop:"4px", textAlign:"right" }}>{pct}% complete</div>
                </div>

                {/* Status change */}
                <div style={{ marginBottom:"16px" }}>
                  <div style={{ fontSize:"10px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>Change Status</div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {Object.entries(STATUS_STYLE).map(([key,s]) => (
                      <button key={key} onClick={() => changeStatus(selected.project_id, key)}
                        style={{ padding:"4px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"700", cursor:"pointer", border:`1.5px solid ${selected.status===key?s.color:"#E2E8F0"}`, background:selected.status===key?s.bg:"#fff", color:selected.status===key?s.color:"#64748B" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Staff */}
                <div>
                  <div style={{ fontSize:"10px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>
                    Assigned Staff ({selected.project_assignments?.length || 0})
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {(selected.project_assignments||[]).map((a,i) => {
                      const EXP = { beginner:"🌱", intermediate:"⭐", expert:"🏆" };
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 10px", background:"#fff", borderRadius:"8px", border:"1px solid #E8EDF5" }}>
                          <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:`${selected.color||"#6366F1"}20`, border:`1.5px solid ${selected.color||"#6366F1"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"800", color:selected.color||"#6366F1", flexShrink:0 }}>
                            {a.staff?.users?.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"12px", fontWeight:"700", color:"#1E293B" }}>{a.staff?.users?.full_name}</div>
                            {a.role_on_project && <div style={{ fontSize:"10px", color:"#64748B" }}>{a.role_on_project}</div>}
                          </div>
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:"11px", fontWeight:"700", color:"#1E293B" }}>{Number(a.estimated_hours)}h</div>
                            <div style={{ fontSize:"9px", color:"#94A3B8" }}>estimated</div>
                          </div>
                          <span style={{ fontSize:"12px" }}>{EXP[a.staff?.experience_level] || "⭐"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Create project modal ── */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(2,6,23,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
          onClick={() => setShowForm(false)}>
          <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"500px", overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #F1F5F9", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff" }}>
              <div style={{ fontSize:"16px", fontWeight:"800" }}>New Project</div>
              <div style={{ fontSize:"12px", opacity:0.7, marginTop:"2px" }}>Create a project and assign your team</div>
            </div>
            <form onSubmit={handleCreate} style={{ padding:"20px 24px" }}>
              {error && <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"8px", padding:"10px 14px", fontSize:"13px", color:"#DC2626", marginBottom:"14px" }}>{error}</div>}

              <div style={{ marginBottom:"14px" }}>
                <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"5px" }}>Project Name *</label>
                <input style={INP} value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Website Redesign" required/>
              </div>
              <div style={{ marginBottom:"14px" }}>
                <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"5px" }}>Description</label>
                <textarea style={{...INP, resize:"vertical"}} rows={2} value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} placeholder="Brief overview of the project"/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
                <div>
                  <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"5px" }}>Start Date</label>
                  <input type="date" style={INP} value={form.start_date} onChange={e => setForm(p=>({...p,start_date:e.target.value}))}/>
                </div>
                <div>
                  <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"5px" }}>Deadline</label>
                  <input type="date" style={INP} value={form.end_date} onChange={e => setForm(p=>({...p,end_date:e.target.value}))}/>
                </div>
              </div>
              {/* Colour picker */}
              <div style={{ marginBottom:"14px" }}>
                <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"6px" }}>Colour</label>
                <div style={{ display:"flex", gap:"8px" }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(p=>({...p,color:c}))}
                      style={{ width:"24px", height:"24px", borderRadius:"50%", background:c, cursor:"pointer", border: form.color===c ? "3px solid #1E293B" : "2px solid transparent", boxSizing:"border-box" }}/>
                  ))}
                </div>
              </div>
              {/* Staff selection */}
              <div style={{ marginBottom:"20px" }}>
                <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"6px" }}>Assign Staff</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                  {staff.filter(s => ["regular_staff","outlet_manager"].includes(s.users?.role)).map(s => {
                    const on = form.staff_ids.includes(s.staff_id);
                    return (
                      <button key={s.staff_id} type="button" onClick={() => setForm(p => ({ ...p, staff_ids: on ? p.staff_ids.filter(id=>id!==s.staff_id) : [...p.staff_ids, s.staff_id] }))}
                        style={{ padding:"4px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", cursor:"pointer", border:`1.5px solid ${on?form.color:"#E2E8F0"}`, background:on?`${form.color}15`:"#fff", color:on?form.color:"#475569" }}>
                        {s.users?.full_name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex:1, padding:"10px", borderRadius:"9px", border:"1.5px solid #E2E8F0", background:"#fff", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2, padding:"10px", borderRadius:"9px", border:"none", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff", fontSize:"13px", fontWeight:"700", cursor:"pointer", boxShadow:"0 4px 12px rgba(99,102,241,0.35)" }}>
                  {saving ? "Creating…" : "Create Project →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
