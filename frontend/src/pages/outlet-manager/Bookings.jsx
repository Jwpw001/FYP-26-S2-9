import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { AlertTriangle, CheckCircle2, CalendarDays, Zap, X } from "lucide-react";

const toLocalISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const STATUS_STYLE = {
  confirmed: { bg:"#DCFCE7", color:"#166534", label:"Confirmed" },
  completed: { bg:"#DBEAFE", color:"#1E40AF", label:"Completed" },
  cancelled: { bg:"#F3F4F6", color:"#6B7280", label:"Cancelled" },
  no_show:   { bg:"#FEE2E2", color:"#991B1B", label:"No Show" },
};

export default function Bookings() {
  const [date,      setDate]      = useState(toLocalISO(new Date()));
  const [bookings,  setBookings]  = useState([]);
  const [services,  setServices]  = useState([]);
  const [staff,     setStaff]     = useState([]);
  const [gaps,      setGaps]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [form, setForm] = useState({ customer_name:"", customer_phone:"", service_id:"", start_time:"09:00", assigned_staff_id:"", notes:"" });
  const [svcForm, setSvcForm] = useState({ name:"", duration_mins:60, requires_skill:"", color:"#6366F1" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => { loadServices(); loadStaff(); }, []);
  useEffect(() => { load(); }, [date]);

  async function load() {
    setLoading(true);
    try {
      const [bRes, gRes] = await Promise.all([
        api.get(`/api/bookings?date=${date}`),
        api.get(`/api/bookings/gaps?date=${date}`),
      ]);
      setBookings(bRes.bookings || []);
      setGaps(gRes.gaps || []);
    } catch { } finally { setLoading(false); }
  }

  async function loadServices() {
    try { const r = await api.get("/api/bookings/services"); setServices(r.services||[]); } catch {}
  }

  async function loadStaff() {
    const { data } = await supabase.from("staff").select("staff_id, experience_level, users(full_name, role)").eq("is_active", true);
    setStaff((data||[]).filter(s => s.users?.role !== "outlet_manager"));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await api.post("/api/bookings", { ...form, booking_date: date });
      setShowForm(false);
      setForm({ customer_name:"", customer_phone:"", service_id:"", start_time:"09:00", assigned_staff_id:"", notes:"" });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleCreateService(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await api.post("/api/bookings/services", svcForm);
      setShowSvcForm(false);
      setSvcForm({ name:"", duration_mins:60, requires_skill:"", color:"#6366F1" });
      await loadServices();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(id, status) {
    await api.patch(`/api/bookings/${id}`, { status });
    await load();
    if (selected?.booking_id === id) setSelected(prev => ({ ...prev, status }));
  }

  async function handleAutoAssign(bookingId) {
    setAssigning(bookingId);
    try {
      const r = await api.post("/api/bookings/auto-assign", { booking_id: bookingId });
      if (r.success) { await load(); alert(`Assigned to ${r.assigned.name}`); }
      else alert(r.message);
    } catch (err) { alert(err.message); }
    finally { setAssigning(null); }
  }

  const INP = { padding:"9px 12px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", color:"#1E293B", outline:"none", background:"#fff", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };
  const COLORS = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444","#14B8A6"];

  const fmtTime = t => t ? String(t).slice(11,16) : "—";
  const confirmed = bookings.filter(b => b.status === "confirmed");
  const unassigned = confirmed.filter(b => !b.assigned_staff_id);

  return (
    <ManagerLayout title="Appointments">
      <div style={{ display:"flex", height:"calc(100vh - 60px)", overflow:"hidden", animation:"pageSlideUp 0.25s ease both" }}>

        {/* ── Left: day view ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"24px", borderRight:"1px solid #E8EDF5" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"10px" }}>
            <div>
              <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>
                {new Date(date+"T00:00:00").toLocaleDateString("en-SG",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              </h2>
              <p style={{ fontSize:"12px", color:"#94A3B8", display:"flex", alignItems:"center", gap:"4px" }}>
                {confirmed.length} booking{confirmed.length!==1?"s":""} · {unassigned.length > 0
                  ? <span style={{ display:"inline-flex", alignItems:"center", gap:"4px" }}><AlertTriangle size={12} color="#D97706" /> {unassigned.length} unassigned</span>
                  : <span style={{ display:"inline-flex", alignItems:"center", gap:"4px" }}><CheckCircle2 size={12} color="#16A34A" /> all assigned</span>}
              </p>
            </div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)}
                style={{ ...INP, width:"150px" }}/>
              <button onClick={() => setShowSvcForm(true)} style={{ padding:"9px 14px", borderRadius:"9px", border:"1.5px solid #E2E8F0", background:"#fff", fontSize:"12px", fontWeight:"700", color:"#475569", cursor:"pointer" }}>
                + Service
              </button>
              <button onClick={() => setShowForm(true)} style={{ padding:"9px 16px", borderRadius:"9px", border:"none", background:"linear-gradient(135deg,#4F46E5,#7C3AED)", color:"#fff", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>
                + Booking
              </button>
            </div>
          </div>

          {/* Gap alerts */}
          {gaps.length > 0 && (
            <div style={{ background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:"10px", padding:"10px 14px", marginBottom:"14px" }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#92400E", marginBottom:"4px", display:"flex", alignItems:"center", gap:"4px" }}><AlertTriangle size={14} color="#92400E" /> {gaps.length} gap{gaps.length!==1?"s":""} in your schedule today</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {gaps.map((g,i) => (
                  <span key={i} style={{ fontSize:"11px", color:"#B45309", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"100px", padding:"2px 10px", fontWeight:"600" }}>
                    {g.from} – {g.to} ({g.duration_mins}min)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {loading ? (
            <div style={{ textAlign:"center", padding:"60px", color:"#94A3B8" }}>Loading…</div>
          ) : bookings.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ marginBottom:"12px", display:"flex", justifyContent:"center" }}><CalendarDays size={40} color="#94A3B8" /></div>
              <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B", marginBottom:"6px" }}>No bookings today</p>
              <p style={{ fontSize:"13px", color:"#64748B" }}>Add your first booking for this day.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
              {bookings.map(b => {
                const ss = STATUS_STYLE[b.status] || STATUS_STYLE.confirmed;
                const color = b.services?.color || "#6366F1";
                const isActive = selected?.booking_id === b.booking_id;
                return (
                  <div key={b.booking_id} onClick={() => setSelected(b)} className="card-hover"
                    style={{ borderRadius:"12px", border:`1.5px solid ${isActive?color:"#E8EDF5"}`, background:isActive?"#FAFBFE":"#fff", padding:"14px 16px", cursor:"pointer", boxShadow:isActive?`0 0 0 2px ${color}30`:"0 1px 4px rgba(0,0,0,0.04)", display:"flex", alignItems:"center", gap:"12px" }}>
                    {/* Time */}
                    <div style={{ flexShrink:0, textAlign:"center", width:"64px" }}>
                      <div style={{ fontSize:"12px", fontWeight:"800", color }}>
                        {fmtTime(b.start_time)}
                      </div>
                      <div style={{ fontSize:"10px", color:"#94A3B8" }}>–{fmtTime(b.end_time)}</div>
                    </div>
                    {/* Left bar */}
                    <div style={{ width:"4px", height:"40px", borderRadius:"4px", background:color, flexShrink:0 }}/>
                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"14px", fontWeight:"700", color:"#0F172A", marginBottom:"2px" }}>{b.customer_name}</div>
                      <div style={{ fontSize:"11px", color:"#64748B" }}>
                        {b.services?.name || "—"}
                        {b.services?.duration_mins && ` · ${b.services.duration_mins}min`}
                      </div>
                    </div>
                    {/* Staff */}
                    <div style={{ flexShrink:0, textAlign:"right" }}>
                      {b.staff ? (
                        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                          <div style={{ width:"26px", height:"26px", borderRadius:"50%", background:`${color}20`, border:`1.5px solid ${color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"800", color }}>
                            {b.staff.users?.full_name?.[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize:"11px", fontWeight:"600", color:"#475569" }}>{b.staff.users?.full_name}</span>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); handleAutoAssign(b.booking_id); }}
                          style={{ padding:"4px 10px", borderRadius:"7px", border:"1px solid #FDE68A", background:"#FFFBEB", color:"#B45309", fontSize:"11px", fontWeight:"700", cursor:"pointer" }}>
                          {assigning===b.booking_id ? "…" : <span style={{ display:"inline-flex", alignItems:"center", gap:"4px" }}><Zap size={11} /> Auto-assign</span>}
                        </button>
                      )}
                    </div>
                    {/* Status */}
                    <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", background:ss.bg, color:ss.color, flexShrink:0 }}>{ss.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: detail panel ── */}
        <div style={{ width:"320px", flexShrink:0, overflowY:"auto", padding:"20px", background:"#FAFBFE" }}>
          {/* Services list */}
          {!selected && (
            <div>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"10px" }}>Services Menu</div>
              {services.length === 0 ? (
                <div style={{ fontSize:"12px", color:"#CBD5E1", textAlign:"center", padding:"20px" }}>No services yet. Add one with + Service.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  {services.map(s => (
                    <div key={s.service_id} style={{ background:"#fff", borderRadius:"9px", border:"1px solid #E8EDF5", padding:"10px 12px", display:"flex", alignItems:"center", gap:"10px" }}>
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:s.color||"#6366F1", flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:"12px", fontWeight:"700", color:"#1E293B" }}>{s.name}</div>
                        <div style={{ fontSize:"10px", color:"#94A3B8" }}>
                          {s.duration_mins}min{s.requires_skill ? ` · ${s.requires_skill}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop:"20px", fontSize:"12px", color:"#CBD5E1", textAlign:"center" }}>
                Select a booking to view details
              </div>
            </div>
          )}

          {/* Booking detail */}
          {selected && (() => {
            const ss = STATUS_STYLE[selected.status] || STATUS_STYLE.confirmed;
            const color = selected.services?.color || "#6366F1";
            return (
              <div>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"14px" }}>
                  <div>
                    <div style={{ fontSize:"15px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>{selected.customer_name}</div>
                    {selected.customer_phone && <div style={{ fontSize:"11px", color:"#64748B" }}>{selected.customer_phone}</div>}
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:"#94A3B8", fontSize:"16px", cursor:"pointer" }}><X size={16} /></button>
                </div>

                {/* Service & time */}
                <div style={{ background:"#fff", borderRadius:"10px", padding:"12px 14px", border:"1px solid #E2E8F0", marginBottom:"12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:color }}/>
                    <span style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B" }}>{selected.services?.name || "No service"}</span>
                  </div>
                  <div style={{ fontSize:"12px", color:"#64748B" }}>
                    {fmtTime(selected.start_time)} – {fmtTime(selected.end_time)} · {selected.services?.duration_mins}min
                  </div>
                </div>

                {/* Assigned staff */}
                <div style={{ marginBottom:"12px" }}>
                  <div style={{ fontSize:"10px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>Assigned Staff</div>
                  {selected.staff ? (
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 10px", background:"#fff", borderRadius:"8px", border:"1px solid #E2E8F0" }}>
                      <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:`${color}20`, border:`1.5px solid ${color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"800", color }}>
                        {selected.staff.users?.full_name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontSize:"12px", fontWeight:"700", color:"#1E293B" }}>{selected.staff.users?.full_name}</span>
                    </div>
                  ) : (
                    <button onClick={() => handleAutoAssign(selected.booking_id)}
                      style={{ width:"100%", padding:"9px", borderRadius:"9px", border:"1.5px dashed #FDE68A", background:"#FFFBEB", color:"#B45309", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                      {assigning===selected.booking_id ? "Assigning…" : <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", justifyContent:"center" }}><Zap size={12} /> Auto-assign Staff</span>}
                    </button>
                  )}
                </div>

                {/* Status */}
                <div style={{ marginBottom:"12px" }}>
                  <div style={{ fontSize:"10px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>Status</div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {Object.entries(STATUS_STYLE).map(([key,s]) => (
                      <button key={key} onClick={() => handleStatusChange(selected.booking_id, key)}
                        style={{ padding:"4px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"700", cursor:"pointer", border:`1.5px solid ${selected.status===key?s.color:"#E2E8F0"}`, background:selected.status===key?s.bg:"#fff", color:selected.status===key?s.color:"#64748B" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selected.notes && (
                  <div style={{ background:"#F8FAFC", borderRadius:"8px", padding:"10px 12px", border:"1px solid #E2E8F0" }}>
                    <div style={{ fontSize:"10px", fontWeight:"700", color:"#94A3B8", marginBottom:"4px" }}>NOTES</div>
                    <div style={{ fontSize:"12px", color:"#475569", lineHeight:1.5 }}>{selected.notes}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Create Booking Modal ── */}
      {showForm && (
        <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(2,6,23,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }} onClick={()=>setShowForm(false)}>
          <div style={{ background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"460px",overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"18px 22px",borderBottom:"1px solid #F1F5F9",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff" }}>
              <div style={{ fontSize:"15px",fontWeight:"800" }}>New Booking</div>
              <div style={{ fontSize:"11px",opacity:0.7,marginTop:"1px" }}>{new Date(date+"T00:00:00").toLocaleDateString("en-SG",{weekday:"long",day:"numeric",month:"long"})}</div>
            </div>
            <form onSubmit={handleCreate} style={{ padding:"18px 22px" }}>
              {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"8px 12px",fontSize:"12px",color:"#DC2626",marginBottom:"12px" }}>{error}</div>}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px" }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Customer Name *</label>
                  <input style={INP} value={form.customer_name} onChange={e=>setForm(p=>({...p,customer_name:e.target.value}))} placeholder="e.g. Sarah Tan" required/>
                </div>
                <div>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Phone</label>
                  <input style={INP} value={form.customer_phone} onChange={e=>setForm(p=>({...p,customer_phone:e.target.value}))} placeholder="+65 9123 4567"/>
                </div>
                <div>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Start Time *</label>
                  <input type="time" style={INP} value={form.start_time} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))} required/>
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Service</label>
                  <select style={INP} value={form.service_id} onChange={e=>setForm(p=>({...p,service_id:e.target.value}))}>
                    <option value="">— Select service —</option>
                    {services.map(s=><option key={s.service_id} value={s.service_id}>{s.name} ({s.duration_mins}min)</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Assign Staff (optional)</label>
                  <select style={INP} value={form.assigned_staff_id} onChange={e=>setForm(p=>({...p,assigned_staff_id:e.target.value}))}>
                    <option value="">— Auto-assign later —</option>
                    {staff.map(s=><option key={s.staff_id} value={s.staff_id}>{s.users?.full_name}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Notes</label>
                  <textarea style={{...INP,resize:"vertical"}} rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Allergies, preferences…"/>
                </div>
              </div>
              <div style={{ display:"flex",gap:"10px" }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1,padding:"10px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2,padding:"10px",borderRadius:"9px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"13px",fontWeight:"700",cursor:"pointer" }}>
                  {saving ? "Saving…" : "Create Booking →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Service Modal ── */}
      {showSvcForm && (
        <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(2,6,23,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }} onClick={()=>setShowSvcForm(false)}>
          <div style={{ background:"#fff",borderRadius:"16px",width:"100%",maxWidth:"400px",overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"18px 22px",borderBottom:"1px solid #F1F5F9",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff" }}>
              <div style={{ fontSize:"15px",fontWeight:"800" }}>New Service</div>
              <div style={{ fontSize:"11px",opacity:0.7,marginTop:"1px" }}>Add to your services menu</div>
            </div>
            <form onSubmit={handleCreateService} style={{ padding:"18px 22px" }}>
              {error && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",padding:"8px 12px",fontSize:"12px",color:"#DC2626",marginBottom:"12px" }}>{error}</div>}
              <div style={{ display:"flex",flexDirection:"column",gap:"10px",marginBottom:"16px" }}>
                <div>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Service Name *</label>
                  <input style={INP} value={svcForm.name} onChange={e=>setSvcForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Swedish Massage" required/>
                </div>
                <div>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Duration (minutes)</label>
                  <input type="number" min="15" step="15" style={INP} value={svcForm.duration_mins} onChange={e=>setSvcForm(p=>({...p,duration_mins:Number(e.target.value)}))}/>
                </div>
                <div>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"4px" }}>Required Skill / Specialisation</label>
                  <input style={INP} value={svcForm.requires_skill} onChange={e=>setSvcForm(p=>({...p,requires_skill:e.target.value}))} placeholder="e.g. Massage Therapy, Facial"/>
                </div>
                <div>
                  <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"6px" }}>Colour</label>
                  <div style={{ display:"flex",gap:"8px" }}>
                    {COLORS.map(c=>(
                      <div key={c} onClick={()=>setSvcForm(p=>({...p,color:c}))}
                        style={{ width:"22px",height:"22px",borderRadius:"50%",background:c,cursor:"pointer",border:svcForm.color===c?"3px solid #1E293B":"2px solid transparent",boxSizing:"border-box" }}/>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display:"flex",gap:"10px" }}>
                <button type="button" onClick={()=>setShowSvcForm(false)} style={{ flex:1,padding:"10px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex:2,padding:"10px",borderRadius:"9px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"13px",fontWeight:"700",cursor:"pointer" }}>
                  {saving ? "Saving…" : "Add Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}
