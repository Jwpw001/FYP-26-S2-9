import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("gws-styles")) {
  const s = document.createElement("style");
  s.id = "gws-styles";
  s.textContent = `
    @keyframes gwsSpin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes gwsFade    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes gwsExpand  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes gwsBar     { 0%{width:5%} 70%{width:85%} 100%{width:100%} }
    .gws-shift:hover .gws-shift-hover { opacity:1 !important; }
  `;
  document.head.appendChild(s);
}

const COLORS = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444"];

const toLocalISO = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export default function GenerateWeeklySchedule() {
  const [params]  = useSearchParams();
  const goTo      = useGoTo();
  const weekStart = params.get("weekStart");
  const weekEnd   = params.get("weekEnd");

  const [step,      setStep]      = useState("generating");
  const [schedule,  setSchedule]  = useState([]);
  const [accepted,  setAccepted]  = useState(new Set());
  const [errorMsg,  setErrorMsg]  = useState("");
  const [created,   setCreated]   = useState(0);
  const [expanded,  setExpanded]  = useState(null);
  const [editMode,  setEditMode]  = useState(false);
  const [draft,     setDraft]     = useState(null);
  const [avail,       setAvail]       = useState(null);
  const [availOpen,   setAvailOpen]   = useState(true);
  const [casualNames, setCasualNames] = useState(new Set()); // definitive list from backend

  useEffect(() => {
    if (!weekStart || !weekEnd) { goTo("/outlet-manager/shifts"); return; }
    // Fetch casual availability alongside generation
    api.get(`/api/shifts/casual-availability?weekStart=${weekStart}&weekEnd=${weekEnd}`)
      .then(r => setAvail(r))
      .catch(() => {});
    run();
  }, []);

  async function run() {
    setStep("generating"); setErrorMsg(""); setExpanded(null);
    try {
      const r = await api.post("/api/shifts/generate-week", { weekStart, weekEnd });
      setSchedule(r.schedule);
      setAccepted(new Set(r.schedule.map((_, i) => i)));
      setCasualNames(new Set((r.casualNames || []).map(n => n.trim().toLowerCase())));
      setStep("preview");
    } catch (e) { setErrorMsg(e.message); setStep("error"); }
  }

  async function confirm() {
    const toCreate = schedule.filter((_, i) => accepted.has(i));
    setStep("creating");
    try {
      const r = await api.post("/api/shifts/confirm-week", { shifts: toCreate });
      setCreated(r.created ?? toCreate.length);
      setStep("done");
    } catch (e) { setErrorMsg(e.message); setStep("error"); }
  }

  function toggle(i, e) {
    e?.stopPropagation();
    setAccepted(p => { const a = new Set(p); a.has(i) ? a.delete(i) : a.add(i); return a; });
  }

  function openShift(di, si) {
    if (expanded?.dayIdx === di && expanded?.shiftIdx === si) {
      setExpanded(null); setEditMode(false); setDraft(null);
    } else {
      setExpanded({ dayIdx: di, shiftIdx: si }); setEditMode(false); setDraft(null);
    }
  }

  function startEdit(shift) { setDraft(JSON.parse(JSON.stringify(shift))); setEditMode(true); }
  function cancelEdit()      { setEditMode(false); setDraft(null); }
  function saveEdit(globalIdx) {
    const s = [...schedule]; s[globalIdx] = draft; setSchedule(s);
    setEditMode(false); setDraft(null);
  }

  const setDF = (f, v) => setDraft(d => ({...d, [f]: v}));
  const setRF = (j, f, v) => setDraft(d => { const r=[...d.roles]; r[j]={...r[j],[f]:v}; return {...d,roles:r}; });

  // Build days
  const days = weekStart ? Array.from({length:7}, (_, i) => {
    const d = new Date(weekStart+"T00:00:00"); d.setDate(d.getDate()+i);
    return { dateKey: toLocalISO(d), d, color: COLORS[i] };
  }) : [];

  const byDate = {};
  schedule.forEach((s, i) => { if (!byDate[s.date]) byDate[s.date]=[]; byDate[s.date].push({ s, i }); });

  const totalStaff = new Set(schedule.flatMap(s => s.roles?.flatMap(r => r.assigned_staff||[])||[])).size;

  const isCasual = (name) => casualNames.has(name?.trim().toLowerCase());

  const INP = { padding:"7px 10px", borderRadius:"7px", border:"1.5px solid #E2E8F0", fontSize:"12px", color:"#1E293B", outline:"none", background:"#fff", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };

  const fmtRange = (ws, we) => {
    const a = new Date(ws+"T00:00:00").toLocaleDateString("en-SG",{day:"numeric",month:"short"});
    const b = new Date(we+"T00:00:00").toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"});
    return `${a} – ${b}`;
  };

  return (
    <ManagerLayout>
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#F8FAFC" }}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div style={{ background:"#fff", borderBottom:"1px solid #E2E8F0", padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"58px", flexShrink:0, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
            <button onClick={() => goTo("/outlet-manager/shifts")}
              style={{ width:"32px",height:"32px",borderRadius:"8px",background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#475569",fontSize:"15px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>←</button>
            <div style={{ width:"1px",height:"22px",background:"#E2E8F0" }}/>
            <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
              <div style={{ width:"28px",height:"28px",borderRadius:"7px",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",color:"#fff" }}>✦</div>
              <div>
                <div style={{ fontSize:"13px",fontWeight:"800",color:"#0F172A",lineHeight:1 }}>AI Weekly Schedule</div>
                {weekStart && weekEnd && <div style={{ fontSize:"10px",color:"#94A3B8",marginTop:"1px" }}>{fmtRange(weekStart, weekEnd)}</div>}
              </div>
            </div>
          </div>

          {(step==="preview"||step==="creating") && (
            <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
              {/* Mini stats */}
              <div style={{ display:"flex",gap:"6px" }}>
                {[{n:schedule.length,l:"Shifts"},{n:accepted.size,l:"Selected"},{n:totalStaff,l:"Staff"}].map(({n,l})=>(
                  <div key={l} style={{ background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:"8px",padding:"5px 14px",textAlign:"center" }}>
                    <div style={{ fontSize:"14px",fontWeight:"900",color:"#1E293B",lineHeight:1 }}>{n}</div>
                    <div style={{ fontSize:"9px",color:"#94A3B8",marginTop:"1px",textTransform:"uppercase",letterSpacing:"0.5px" }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ width:"1px",height:"28px",background:"#E2E8F0" }}/>
              <button onClick={() => goTo("/outlet-manager/shifts")}
                style={{ padding:"8px 16px",borderRadius:"8px",border:"1.5px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:"12px",fontWeight:"600",cursor:"pointer" }}>
                Discard
              </button>
              <button onClick={confirm} disabled={step==="creating"||!accepted.size}
                style={{ padding:"8px 20px",borderRadius:"8px",border:"none",fontSize:"12px",fontWeight:"700",cursor:!accepted.size?"not-allowed":"pointer",
                  background:!accepted.size?"#E2E8F0":"linear-gradient(135deg,#4F46E5,#7C3AED)",
                  color:!accepted.size?"#94A3B8":"#fff",
                  boxShadow:!accepted.size?"none":"0 3px 10px rgba(99,102,241,0.35)",
                }}>
                {step==="creating"
                  ? <span style={{display:"flex",alignItems:"center",gap:"6px"}}><span style={{width:"11px",height:"11px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"gwsSpin 0.7s linear infinite",display:"inline-block"}}/>Saving…</span>
                  : `Save ${accepted.size} as Draft →`}
              </button>
            </div>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div style={{ flex:1, overflowY:"auto" }}>

          {/* Generating */}
          {step==="generating" && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"20px",animation:"gwsFade 0.3s ease" }}>
              <div style={{ position:"relative",width:"68px",height:"68px" }}>
                <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #E2E8F0" }}/>
                <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#6366F1",animation:"gwsSpin 0.85s linear infinite" }}/>
                <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px" }}>✦</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <p style={{ fontSize:"17px",fontWeight:"800",color:"#1E293B",marginBottom:"6px" }}>Building your week…</p>
                <p style={{ fontSize:"13px",color:"#64748B",lineHeight:1.7 }}>Analysing staff, hours, and role templates.</p>
              </div>
              <div style={{ width:"220px",height:"4px",borderRadius:"4px",background:"#E2E8F0",overflow:"hidden" }}>
                <div style={{ height:"100%",borderRadius:"4px",background:"linear-gradient(90deg,#6366F1,#8B5CF6)",animation:"gwsBar 2s ease-in-out forwards" }}/>
              </div>
            </div>
          )}

          {/* Error */}
          {step==="error" && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"14px",animation:"gwsFade 0.3s ease" }}>
              <div style={{ width:"60px",height:"60px",borderRadius:"50%",background:"#FEF2F2",border:"2px solid #FCA5A5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px" }}>⚠️</div>
              <p style={{ fontSize:"16px",fontWeight:"800",color:"#DC2626" }}>Generation failed</p>
              <p style={{ fontSize:"13px",color:"#64748B",maxWidth:"340px",textAlign:"center",lineHeight:1.6 }}>{errorMsg}</p>
              <button onClick={run} style={{ padding:"9px 22px",borderRadius:"9px",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",border:"none",color:"#fff",fontSize:"13px",fontWeight:"700",cursor:"pointer" }}>↺ Try Again</button>
            </div>
          )}

          {/* Done */}
          {step==="done" && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"14px",animation:"gwsFade 0.3s ease" }}>
              <div style={{ width:"68px",height:"68px",borderRadius:"50%",background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)",border:"2px solid #6EE7B7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"30px",boxShadow:"0 8px 24px rgba(16,185,129,0.2)" }}>✓</div>
              <p style={{ fontSize:"18px",fontWeight:"800",color:"#059669" }}>{created} shift{created!==1?"s":""} saved as draft!</p>
              <p style={{ fontSize:"13px",color:"#64748B" }}>Review and publish them from the calendar.</p>
              <button onClick={() => goTo("/outlet-manager/shifts")} style={{ padding:"9px 22px",borderRadius:"9px",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",border:"none",color:"#fff",fontSize:"13px",fontWeight:"700",cursor:"pointer" }}>← Back to Shifts</button>
            </div>
          )}

          {/* Preview — day rows */}
          {(step==="preview"||step==="creating") && (
            <div style={{ padding:"20px 28px", display:"flex", flexDirection:"column", gap:"0", animation:"gwsFade 0.25s ease" }}>

              {/* ── Casual Availability Panel ── */}
              {avail && (
                <div style={{ marginBottom:"16px",borderRadius:"12px",border:"1px solid #E0E7FF",background:"#fff",overflow:"hidden" }}>
                  {/* Panel header */}
                  <button onClick={() => setAvailOpen(o => !o)}
                    style={{ width:"100%",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#F5F3FF",border:"none",cursor:"pointer",textAlign:"left" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                      <div style={{ width:"28px",height:"28px",borderRadius:"7px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px" }}>👥</div>
                      <div>
                        <span style={{ fontSize:"13px",fontWeight:"800",color:"#1E293B" }}>Casual Staff Availability</span>
                        <span style={{ fontSize:"11px",color:"#64748B",marginLeft:"8px" }}>
                          {avail.availability.length > 0
                            ? `${avail.availability.length} of ${avail.totalCasual} submitted for this week`
                            : avail.totalCasual > 0
                            ? `${avail.totalCasual} casual staff — none submitted yet`
                            : "No casual staff in this outlet"}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize:"11px",color:"#6366F1",fontWeight:"700",transition:"transform 0.2s",transform:availOpen?"rotate(0)":"rotate(-90deg)",display:"inline-block" }}>▾</span>
                  </button>

                  {availOpen && (
                    <div style={{ padding:"14px 16px" }}>
                      {avail.availability.length === 0 ? (
                        <div style={{ textAlign:"center",padding:"20px",color:"#94A3B8",fontSize:"12px" }}>
                          No casual staff have submitted availability for this week.<br/>
                          <span style={{ color:"#6366F1",fontWeight:"600" }}>The schedule will be built using regular staff only.</span>
                        </div>
                      ) : (
                        <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                          {avail.availability.map((person, pi) => {
                            const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                            // Map day_of_week (0=Sun) to column index
                            const dayMap = {};
                            person.days.forEach(d => { dayMap[d.day_of_week] = d; });
                            // Show Mon-Sun (1-6, 0)
                            const orderedDays = [1,2,3,4,5,6,0];
                            return (
                              <div key={pi} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"9px",border:"1px solid #E8EDF5",background:"#FAFBFE" }}>
                                {/* Avatar */}
                                <div style={{ width:"32px",height:"32px",borderRadius:"50%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"800",color:"#fff",flexShrink:0 }}>
                                  {person.name?.trim()[0]?.toUpperCase()}
                                </div>
                                <div style={{ fontSize:"12px",fontWeight:"700",color:"#1E293B",width:"120px",flexShrink:0 }}>{person.name}</div>
                                {/* Day availability chips */}
                                <div style={{ display:"flex",gap:"4px",flexWrap:"wrap",flex:1 }}>
                                  {orderedDays.map(dow => {
                                    const d = dayMap[dow];
                                    return d ? (
                                      <div key={dow} style={{ display:"flex",flexDirection:"column",alignItems:"center",background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:"7px",padding:"3px 8px",minWidth:"46px" }}>
                                        <span style={{ fontSize:"9px",fontWeight:"700",color:"#6366F1",textTransform:"uppercase",letterSpacing:"0.4px" }}>{dayNames[dow]}</span>
                                        <span style={{ fontSize:"9px",color:"#4338CA",fontWeight:"600",whiteSpace:"nowrap" }}>{d.available_from}–{d.available_to}</span>
                                      </div>
                                    ) : (
                                      <div key={dow} style={{ display:"flex",flexDirection:"column",alignItems:"center",background:"#F8FAFC",border:"1px solid #E8EDF5",borderRadius:"7px",padding:"3px 8px",minWidth:"46px",opacity:0.4 }}>
                                        <span style={{ fontSize:"9px",fontWeight:"600",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px" }}>{dayNames[dow]}</span>
                                        <span style={{ fontSize:"9px",color:"#CBD5E1" }}>—</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Legend + instruction bar */}
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",gap:"12px",flexWrap:"wrap" }}>
                <p style={{ fontSize:"12px",color:"#94A3B8",margin:0 }}>
                  Click a shift to view staff · toggle checkbox to include/exclude · <strong style={{color:"#4F46E5"}}>Edit</strong> to adjust
                </p>
                <div style={{ display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap" }}>
                  {/* Shift status */}
                  <div style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"8px",background:"#F8FAFC",border:"1px solid #E2E8F0" }}>
                    <span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#4F46E5",display:"inline-block",flexShrink:0 }}/>
                    <span style={{ fontSize:"11px",color:"#374151",fontWeight:"600" }}>Included</span>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"8px",background:"#F8FAFC",border:"1px solid #E2E8F0" }}>
                    <span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#E2E8F0",border:"1px solid #CBD5E1",display:"inline-block",flexShrink:0 }}/>
                    <span style={{ fontSize:"11px",color:"#374151",fontWeight:"600" }}>Excluded</span>
                  </div>
                  {/* Divider */}
                  <div style={{ width:"1px",height:"20px",background:"#E2E8F0" }}/>
                  {/* Staff type */}
                  <div style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"8px",background:"#F8FAFC",border:"1px solid #E2E8F0" }}>
                    <div style={{ width:"18px",height:"18px",borderRadius:"50%",background:"#EEF2FF",border:"1.5px solid #6366F1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",fontWeight:"800",color:"#4F46E5",flexShrink:0 }}>R</div>
                    <span style={{ fontSize:"11px",color:"#374151",fontWeight:"600" }}>Regular Staff</span>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"8px",background:"#FFFBEB",border:"1px solid #FCD34D" }}>
                    <div style={{ width:"18px",height:"18px",borderRadius:"50%",background:"#FDE68A",border:"2px solid #F59E0B",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",fontWeight:"800",color:"#92400E",flexShrink:0 }}>C</div>
                    <span style={{ fontSize:"11px",color:"#92400E",fontWeight:"700" }}>Casual Staff</span>
                    <span style={{ fontSize:"9px",fontWeight:"700",color:"#D97706",background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:"100px",padding:"0px 6px" }}>★</span>
                  </div>
                </div>
              </div>

              {days.map(({ dateKey, d, color }, di) => {
                const entries   = byDate[dateKey] || [];
                const isToday   = toLocalISO(new Date()) === dateKey;
                const dayLabel  = d.toLocaleDateString("en-SG", { weekday:"long" });
                const dayShort  = d.toLocaleDateString("en-SG", { day:"numeric", month:"short" });
                const hasExpanded = expanded?.dayIdx === di;

                return (
                  <div key={dateKey}>
                    {/* Day row */}
                    <div style={{ display:"flex", alignItems:"stretch", borderRadius:"12px", background:"#fff", border:"1px solid #E8EDF5", marginBottom: hasExpanded ? "0" : "8px", borderBottomLeftRadius: hasExpanded?"0":"12px", borderBottomRightRadius: hasExpanded?"0":"12px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>

                      {/* Day label */}
                      <div style={{ width:"130px", flexShrink:0, borderRight:"1px solid #F1F5F9", padding:"16px 16px", display:"flex", flexDirection:"column", justifyContent:"center", background: isToday ? "#FAFBFF" : "#FAFBFE" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:"6px",marginBottom:"2px" }}>
                          <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:color,flexShrink:0 }}/>
                          <span style={{ fontSize:"12px",fontWeight:"800",color:"#1E293B" }}>{dayLabel}</span>
                        </div>
                        <span style={{ fontSize:"11px",color:"#94A3B8",paddingLeft:"14px" }}>{dayShort}</span>
                        {isToday && <span style={{ marginTop:"4px",paddingLeft:"14px",fontSize:"9px",fontWeight:"700",color:"#4F46E5",textTransform:"uppercase",letterSpacing:"0.5px" }}>Today</span>}
                      </div>

                      {/* Shifts */}
                      <div style={{ flex:1, display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px", flexWrap:"wrap" }}>
                        {entries.length === 0 && (
                          <span style={{ fontSize:"12px",color:"#CBD5E1",fontStyle:"italic" }}>No shifts generated</span>
                        )}
                        {entries.map(({ s, i }, si) => {
                          const on      = accepted.has(i);
                          const active  = expanded?.dayIdx===di && expanded?.shiftIdx===si;
                          const allStaff = (s.roles||[]).flatMap(r=>r.assigned_staff||[]);

                          return (
                            <div key={i} className="gws-shift"
                              onClick={() => openShift(di, si)}
                              style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px", cursor:"pointer", transition:"all 0.15s", position:"relative",
                                border:`1.5px solid ${active?color:on?"#E2E8F0":"#F1F5F9"}`,
                                background: active ? `${color}0D` : on ? "#fff" : "#FAFBFE",
                                boxShadow: active ? `0 0 0 2px ${color}30` : "none",
                                opacity: on ? 1 : 0.5,
                                minWidth:"200px", flex:"0 0 auto",
                              }}>
                              {/* Color dot */}
                              <div style={{ width:"4px", height:"36px", borderRadius:"4px", background: on?color:"#D1D5DB", flexShrink:0 }}/>

                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:"10px",fontWeight:"800",color:on?color:"#94A3B8",marginBottom:"2px" }}>{s.start_time} – {s.end_time}</div>
                                <div style={{ fontSize:"13px",fontWeight:"700",color:"#0F172A",lineHeight:1.2,marginBottom:"4px" }}>{s.title}</div>
                                {/* Staff pills */}
                                <div style={{ display:"flex",flexWrap:"wrap",gap:"3px" }}>
                                  {allStaff.slice(0,3).map((name,k) => (
                                    <span key={k} style={{ fontSize:"9px",fontWeight:"700",borderRadius:"100px",padding:"2px 8px",display:"inline-flex",alignItems:"center",gap:"3px",
                                      background: isCasual(name) ? "#FEF3C7" : "#F1F5F9",
                                      color:      isCasual(name) ? "#92400E" : "#475569",
                                      border:     isCasual(name) ? "1px solid #FCD34D" : "1px solid transparent",
                                    }}>
                                      {isCasual(name) && <span style={{ fontSize:"8px",fontWeight:"900",color:"#D97706" }}>★</span>}
                                      {name}
                                    </span>
                                  ))}
                                  {allStaff.length > 3 && <span style={{ fontSize:"9px",fontWeight:"600",color:"#94A3B8",background:"#F1F5F9",borderRadius:"100px",padding:"1px 7px" }}>+{allStaff.length-3}</span>}
                                  {allStaff.length === 0 && <span style={{ fontSize:"9px",color:"#F59E0B",fontWeight:"600" }}>⚠ No staff</span>}
                                </div>
                              </div>

                              {/* Chevron */}
                              <span style={{ fontSize:"11px",color:active?color:"#CBD5E1",transition:"transform 0.2s",transform:active?"rotate(180deg)":"rotate(0deg)",flexShrink:0 }}>▾</span>

                              {/* Include checkbox */}
                              <div onClick={e=>toggle(i,e)}
                                style={{ width:"18px",height:"18px",borderRadius:"5px",border:`1.5px solid ${on?color:"#D1D5DB"}`,background:on?color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s",cursor:"pointer" }}>
                                {on && <span style={{color:"#fff",fontSize:"10px",fontWeight:"900",lineHeight:1}}>✓</span>}
                              </div>
                            </div>
                          );
                        })}

                        {/* ＋ Add shift button */}
                        <button
                          onClick={() => {
                            const newShift = { title:"New Shift", date:dateKey, start_time:"09:00", end_time:"17:00", roles:[] };
                            const newIdx = schedule.length;
                            setSchedule(prev => [...prev, newShift]);
                            setAccepted(prev => { const a=new Set(prev); a.add(newIdx); return a; });
                            // open it immediately for editing
                            setTimeout(() => {
                              setExpanded({ dayIdx:di, shiftIdx:(byDate[dateKey]||[]).length });
                              setDraft({...newShift});
                              setEditMode(true);
                            }, 0);
                          }}
                          style={{ width:"40px",height:"40px",borderRadius:"10px",border:`1.5px dashed ${color}`,background:`${color}08`,color,fontSize:"20px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:"300",transition:"all 0.15s",lineHeight:1 }}>
                          +
                        </button>
                      </div>
                    </div>

                    {/* Expanded drawer */}
                    {hasExpanded && (() => {
                      const entry = (byDate[dateKey]||[])[expanded.shiftIdx];
                      if (!entry) return null;
                      const { s: shift, i: globalIdx } = entry;
                      const displayShift = editMode && draft ? draft : shift;

                      return (
                        <div style={{ background:"#fff",border:"1px solid #E8EDF5",borderTop:"1px solid #F1F5F9",borderBottomLeftRadius:"12px",borderBottomRightRadius:"12px",padding:"20px 24px",marginBottom:"8px",animation:"gwsExpand 0.18s ease",boxShadow:"0 4px 16px rgba(0,0,0,0.05)" }}>
                          <div style={{ display:"flex",gap:"24px" }}>

                            {/* Left: shift info / edit */}
                            <div style={{ width:"240px",flexShrink:0 }}>
                              <div style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>Shift Details</div>

                              {editMode ? (
                                <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                                  <div>
                                    <div style={{ fontSize:"10px",fontWeight:"600",color:"#64748B",marginBottom:"3px" }}>Title</div>
                                    <input value={draft.title} onChange={e=>setDF("title",e.target.value)} style={INP}/>
                                  </div>
                                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px" }}>
                                    <div>
                                      <div style={{ fontSize:"10px",fontWeight:"600",color:"#64748B",marginBottom:"3px" }}>Start</div>
                                      <input type="time" value={draft.start_time} onChange={e=>setDF("start_time",e.target.value)} style={INP}/>
                                    </div>
                                    <div>
                                      <div style={{ fontSize:"10px",fontWeight:"600",color:"#64748B",marginBottom:"3px" }}>End</div>
                                      <input type="time" value={draft.end_time} onChange={e=>setDF("end_time",e.target.value)} style={INP}/>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ background:"#F8FAFC",borderRadius:"10px",padding:"12px 14px",border:"1px solid #F1F5F9" }}>
                                  <div style={{ fontSize:"16px",fontWeight:"800",color:"#0F172A",marginBottom:"4px" }}>{displayShift.title}</div>
                                  <div style={{ display:"inline-flex",alignItems:"center",gap:"5px",background:`${color}15`,borderRadius:"100px",padding:"3px 10px" }}>
                                    <span style={{ fontSize:"12px",fontWeight:"700",color }}>{displayShift.start_time} – {displayShift.end_time}</span>
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div style={{ display:"flex",gap:"8px",marginTop:"14px" }}>
                                {editMode ? (
                                  <>
                                    <button onClick={cancelEdit} style={{ flex:1,padding:"8px",borderRadius:"8px",border:"1.5px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:"11px",fontWeight:"700",cursor:"pointer" }}>Cancel</button>
                                    <button onClick={()=>saveEdit(globalIdx)} style={{ flex:2,padding:"8px",borderRadius:"8px",border:"none",background:`linear-gradient(135deg,${color},#7C3AED)`,color:"#fff",fontSize:"11px",fontWeight:"700",cursor:"pointer",boxShadow:`0 3px 8px ${color}40` }}>✓ Save</button>
                                  </>
                                ) : (
                                  <button onClick={()=>startEdit(shift)} style={{ flex:1,padding:"8px",borderRadius:"8px",border:`1.5px solid ${color}`,background:`${color}0D`,color,fontSize:"11px",fontWeight:"700",cursor:"pointer" }}>✎ Edit Shift</button>
                                )}
                              </div>
                            </div>

                            {/* Divider */}
                            <div style={{ width:"1px",background:"#F1F5F9",flexShrink:0 }}/>

                            {/* Right: roles & staff */}
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>Roles & Staff</div>

                              <div style={{ display:"flex",gap:"10px",flexWrap:"wrap" }}>
                                {(displayShift.roles||[]).map((r,j)=>(
                                  <div key={j} style={{ minWidth:"160px",flex:"1 1 160px",borderRadius:"10px",border:"1.5px solid #E8EDF5",overflow:"hidden" }}>
                                    {/* Role header */}
                                    <div style={{ background:`${color}0E`,borderBottom:"1px solid #E8EDF5",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                                      {editMode ? (
                                        <div style={{ display:"flex",alignItems:"center",gap:"6px",flex:1 }}>
                                          <input value={r.role_name} onChange={e=>setRF(j,"role_name",e.target.value)} style={{...INP,padding:"3px 7px",fontSize:"11px",fontWeight:"700",flex:1}}/>
                                          <span style={{ fontSize:"10px",color:"#94A3B8" }}>×</span>
                                          <input type="number" min="1" value={r.headcount} onChange={e=>setRF(j,"headcount",Number(e.target.value))} style={{...INP,padding:"3px 6px",fontSize:"11px",width:"36px",textAlign:"center"}}/>
                                          <button onClick={()=>setDraft(d=>({...d,roles:d.roles.filter((_,k)=>k!==j)}))} style={{ background:"#FEF2F2",border:"none",borderRadius:"5px",color:"#DC2626",width:"20px",height:"20px",cursor:"pointer",fontSize:"12px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>×</button>
                                        </div>
                                      ) : (
                                        <>
                                          <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                                            <div style={{ width:"7px",height:"7px",borderRadius:"50%",background:color }}/>
                                            <span style={{ fontSize:"11px",fontWeight:"700",color:"#1E293B" }}>{r.role_name}</span>
                                          </div>
                                          <span style={{ fontSize:"10px",color:"#94A3B8",fontWeight:"600" }}>{(r.assigned_staff||[]).length}/{r.headcount}</span>
                                        </>
                                      )}
                                    </div>
                                    {/* Staff */}
                                    <div style={{ padding:"8px 12px",display:"flex",flexDirection:"column",gap:"5px",background:"#fff" }}>
                                      {editMode ? (
                                        <textarea rows={Math.max(2,(r.assigned_staff||[]).length+1)}
                                          value={(r.assigned_staff||[]).join("\n")}
                                          onChange={e=>setRF(j,"assigned_staff",e.target.value.split("\n").map(x=>x.trim()).filter(Boolean))}
                                          style={{...INP,padding:"5px 8px",fontSize:"11px",resize:"vertical",lineHeight:1.7}}
                                          placeholder="One name per line"/>
                                      ) : (r.assigned_staff||[]).length > 0 ? (
                                        <div style={{ display:"flex",flexDirection:"column",gap:"3px" }}>
                                          {(r.assigned_staff||[]).map((name,k) => (
                                            <div key={k} style={{ display:"flex",alignItems:"center",gap:"8px",padding:"4px 6px",borderRadius:"7px",background:isCasual(name)?"#FFFBEB":"transparent" }}>
                                              <div style={{ width:"26px",height:"26px",borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:"800",
                                                background: isCasual(name) ? "#FDE68A" : `${color}20`,
                                                border:     isCasual(name) ? "2px solid #F59E0B" : `1.5px solid ${color}40`,
                                                color:      isCasual(name) ? "#92400E" : color,
                                              }}>
                                                {name.trim()[0]?.toUpperCase()}
                                              </div>
                                              <span style={{ fontSize:"12px",fontWeight:"600",color:isCasual(name)?"#78350F":"#1E293B",flex:1 }}>{name}</span>
                                              {isCasual(name) && (
                                                <span style={{ fontSize:"9px",fontWeight:"700",color:"#D97706",background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:"100px",padding:"1px 8px",flexShrink:0 }}>Casual</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize:"10px",color:"#F59E0B",fontWeight:"600",display:"flex",alignItems:"center",gap:"4px" }}>⚠ Unassigned</div>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {/* Add role (edit mode) */}
                                {editMode && (
                                  <button onClick={()=>setDraft(d=>({...d,roles:[...d.roles,{role_name:"",headcount:1,assigned_staff:[]}]}))}
                                    style={{ minWidth:"120px",flex:"0 0 auto",borderRadius:"10px",border:`1.5px dashed ${color}`,background:`${color}08`,color,fontSize:"11px",fontWeight:"700",cursor:"pointer",padding:"12px 0",alignSelf:"stretch" }}>
                                    + Add Role
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {/* ── Staff Statistics ── */}
              {(() => {
                // Build per-staff stats from accepted shifts only
                const statsMap = {};
                schedule.forEach((s, i) => {
                  if (!accepted.has(i)) return;
                  const [sh, sm] = s.start_time.split(":").map(Number);
                  const [eh, em] = s.end_time.split(":").map(Number);
                  const hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                  (s.roles||[]).forEach(r => {
                    (r.assigned_staff||[]).forEach(name => {
                      if (!statsMap[name]) statsMap[name] = { shifts: 0, hours: 0, days: new Set() };
                      statsMap[name].shifts++;
                      statsMap[name].hours += hrs;
                      statsMap[name].days.add(s.date);
                    });
                  });
                });
                const stats = Object.entries(statsMap)
                  .map(([name, d]) => ({ name, shifts: d.shifts, hours: d.hours, daysWorking: d.days.size, daysOff: 7 - d.days.size }))
                  .sort((a, b) => b.hours - a.hours);

                if (!stats.length) return null;
                return (
                  <div style={{ marginTop:"24px",borderRadius:"14px",border:"1px solid #E8EDF5",background:"#fff",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                    {/* Header */}
                    <div style={{ padding:"14px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:"10px",background:"#F8FAFC" }}>
                      <div style={{ width:"28px",height:"28px",borderRadius:"7px",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px" }}>📊</div>
                      <div>
                        <div style={{ fontSize:"13px",fontWeight:"800",color:"#1E293B" }}>Staff Statistics</div>
                        <div style={{ fontSize:"11px",color:"#94A3B8" }}>Based on {accepted.size} selected shifts</div>
                      </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%",borderCollapse:"collapse" }}>
                        <thead>
                          <tr style={{ background:"#FAFBFC" }}>
                            {["Staff Member","Type","Shifts","Hours","Days Working","Days Off"].map(h => (
                              <th key={h} style={{ padding:"10px 16px",fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",textAlign:"left",borderBottom:"1px solid #F1F5F9",whiteSpace:"nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.map((st, idx) => {
                            const casual = isCasual(st.name);
                            const pct = Math.round((st.daysWorking / 7) * 100);
                            return (
                              <tr key={idx} style={{ borderBottom:"1px solid #F8FAFC",background:idx%2===0?"#fff":"#FAFBFE" }}>
                                {/* Name */}
                                <td style={{ padding:"12px 16px" }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                                    <div style={{ width:"30px",height:"30px",borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"800",
                                      background: casual?"#FDE68A":"#EEF2FF",
                                      border:     casual?"2px solid #F59E0B":"1.5px solid #C7D2FE",
                                      color:      casual?"#92400E":"#4F46E5",
                                    }}>
                                      {st.name.trim()[0]?.toUpperCase()}
                                    </div>
                                    <span style={{ fontSize:"13px",fontWeight:"600",color:"#1E293B" }}>{st.name}</span>
                                  </div>
                                </td>
                                {/* Type */}
                                <td style={{ padding:"12px 16px" }}>
                                  {casual
                                    ? <span style={{ fontSize:"10px",fontWeight:"700",color:"#D97706",background:"#FEF3C7",border:"1px solid #FCD34D",borderRadius:"100px",padding:"2px 8px" }}>★ Casual</span>
                                    : <span style={{ fontSize:"10px",fontWeight:"700",color:"#4F46E5",background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:"100px",padding:"2px 8px" }}>Regular</span>
                                  }
                                </td>
                                {/* Shifts */}
                                <td style={{ padding:"12px 16px" }}>
                                  <span style={{ fontSize:"13px",fontWeight:"700",color:"#1E293B" }}>{st.shifts}</span>
                                  <span style={{ fontSize:"11px",color:"#94A3B8",marginLeft:"3px" }}>shifts</span>
                                </td>
                                {/* Hours */}
                                <td style={{ padding:"12px 16px" }}>
                                  <span style={{ fontSize:"13px",fontWeight:"700",color:"#1E293B" }}>{st.hours.toFixed(1)}</span>
                                  <span style={{ fontSize:"11px",color:"#94A3B8",marginLeft:"3px" }}>hrs</span>
                                </td>
                                {/* Days working — with mini bar */}
                                <td style={{ padding:"12px 16px" }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                                    <span style={{ fontSize:"13px",fontWeight:"700",color:"#1E293B" }}>{st.daysWorking}</span>
                                    <div style={{ width:"60px",height:"5px",borderRadius:"5px",background:"#F1F5F9",overflow:"hidden" }}>
                                      <div style={{ height:"100%",borderRadius:"5px",background:casual?"#F59E0B":"#6366F1",width:`${pct}%` }}/>
                                    </div>
                                  </div>
                                </td>
                                {/* Days off */}
                                <td style={{ padding:"12px 16px" }}>
                                  <span style={{ fontSize:"13px",fontWeight:"700",color: st.daysOff>=2?"#10B981":"#F59E0B" }}>{st.daysOff}</span>
                                  <span style={{ fontSize:"11px",color:"#94A3B8",marginLeft:"3px" }}>days</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}
