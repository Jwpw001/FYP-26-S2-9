import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { useBusinessContext } from "../../context/BusinessContext";

const toLocalISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day===0?6:day-1) + offset*7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { weekStart: toLocalISO(mon), weekEnd: toLocalISO(sun), mon };
}

const EXP_ICON = { beginner:"🌱", intermediate:"⭐", expert:"🏆" };

const CAPACITY_ENDPOINT = {
  flexible:    { url: "/api/projects/capacity", source: "hours logged via timesheets" },
  shift:       { url: "/api/shifts/capacity",   source: "hours scheduled via shifts" },
  appointment: { url: "/api/bookings/capacity", source: "hours scheduled via appointments" },
};

export default function Capacity() {
  const { schedulingMode } = useBusinessContext();
  const [weekOffset, setWeekOffset] = useState(0);
  const [capacity,   setCapacity]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  const { weekStart, weekEnd } = getWeekRange(weekOffset);
  const { url: endpoint, source } = CAPACITY_ENDPOINT[schedulingMode] || CAPACITY_ENDPOINT.shift;

  useEffect(() => { load(); }, [weekOffset, endpoint]);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`${endpoint}?weekStart=${weekStart}&weekEnd=${weekEnd}`);
      setCapacity(r.capacity || []);
    } catch { } finally { setLoading(false); }
  }

  const totalLogged = capacity.reduce((s,c)=>s+c.hours_logged, 0);
  const overCapacity = capacity.filter(c => c.hours_logged > 40 && !c.on_leave);
  const underUtilised = capacity.filter(c => c.hours_logged < 20 && !c.on_leave);

  return (
    <ManagerLayout title="Capacity">
      <div style={{ padding:"24px", maxWidth:"900px", animation:"pageSlideUp 0.25s ease both" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>Capacity Planner</h2>
            <p style={{ fontSize:"12px", color:"#94A3B8" }}>
              {new Date(weekStart).toLocaleDateString("en-SG",{day:"numeric",month:"short"})} – {new Date(weekEnd).toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}
              {" · "}{capacity.length} staff · {totalLogged}h total logged ({source})
            </p>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button onClick={() => setWeekOffset(p=>p-1)} style={{ width:"32px",height:"32px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"14px" }}>←</button>
            <button onClick={() => setWeekOffset(0)} style={{ padding:"6px 12px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",fontSize:"12px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>This Week</button>
            <button onClick={() => setWeekOffset(p=>p+1)} style={{ width:"32px",height:"32px",borderRadius:"8px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"14px" }}>→</button>
          </div>
        </div>

        {/* Alert banners */}
        {overCapacity.length > 0 && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"10px", padding:"10px 16px", marginBottom:"12px", fontSize:"13px", color:"#991B1B", fontWeight:"600" }}>
            ⚠ {overCapacity.length} staff member{overCapacity.length!==1?"s are":" is"} over 40h this week: {overCapacity.map(c=>c.name).join(", ")}
          </div>
        )}
        {underUtilised.length > 0 && (
          <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"10px", padding:"10px 16px", marginBottom:"16px", fontSize:"13px", color:"#92400E", fontWeight:"600" }}>
            💡 {underUtilised.length} staff member{underUtilised.length!==1?"s are":" is"} under 20h — consider assigning more work
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#94A3B8" }}>Loading…</div>
        ) : capacity.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px" }}>
            <div style={{ fontSize:"36px", marginBottom:"12px" }}>📊</div>
            <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B" }}>No staff data found</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {/* Legend */}
            <div style={{ display:"flex", gap:"16px", marginBottom:"8px", fontSize:"11px", color:"#64748B" }}>
              <span style={{ display:"flex", alignItems:"center", gap:"5px" }}><span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#10B981",display:"inline-block" }}/> 40h+ (full)</span>
              <span style={{ display:"flex", alignItems:"center", gap:"5px" }}><span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#4F46E5",display:"inline-block" }}/> 20-40h (good)</span>
              <span style={{ display:"flex", alignItems:"center", gap:"5px" }}><span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#E2E8F0",display:"inline-block" }}/> Under 20h</span>
            </div>

            {capacity.map((c,i) => {
              const pct     = Math.min(100, Math.round((c.hours_logged / 40) * 100));
              const barColor = c.hours_logged >= 40 ? "#10B981" : c.hours_logged >= 20 ? "#4F46E5" : "#94A3B8";
              const isOver  = c.hours_logged > 40;
              return (
                <div key={i} style={{ background:"#fff", borderRadius:"12px", border:`1px solid ${isOver?"#FECACA":"#E8EDF5"}`, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                    {/* Avatar */}
                    <div style={{ width:"36px",height:"36px",borderRadius:"50%",background:"#EEF2FF",border:"1.5px solid #C7D2FE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:"800",color:"#4F46E5",flexShrink:0 }}>
                      {c.name?.[0]?.toUpperCase()}
                    </div>
                    {/* Name + exp */}
                    <div style={{ flex:"0 0 160px" }}>
                      <div style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B" }}>{c.name}</div>
                      <div style={{ fontSize:"10px", color:"#94A3B8" }}>
                        {EXP_ICON[c.experience] || "⭐"} {c.experience}
                        {c.on_leave && <span style={{ marginLeft:"6px", color:"#F59E0B", fontWeight:"600" }}>· On Leave</span>}
                      </div>
                    </div>
                    {/* Bar */}
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"10px", color:"#94A3B8", marginBottom:"4px" }}>
                        <span>{c.hours_logged}h logged</span>
                        <span style={{ color: isOver?"#DC2626":"#94A3B8", fontWeight: isOver?"700":"400" }}>
                          {isOver ? `⚠ ${c.hours_logged-40}h over` : `${40-c.hours_logged}h remaining`}
                        </span>
                      </div>
                      <div style={{ height:"8px", borderRadius:"8px", background:"#F1F5F9", overflow:"hidden", position:"relative" }}>
                        <div style={{ height:"100%", borderRadius:"8px", background:isOver?"#EF4444":barColor, width:`${Math.min(100,pct)}%`, transition:"width 0.4s" }}/>
                        {/* 40h marker */}
                        <div style={{ position:"absolute", top:0, left:"100%", width:"2px", height:"100%", background:"#CBD5E1", transform:"translateX(-50%)" }}/>
                      </div>
                    </div>
                    {/* Hours */}
                    <div style={{ textAlign:"right", flexShrink:0, minWidth:"50px" }}>
                      <div style={{ fontSize:"16px", fontWeight:"900", color: isOver?"#DC2626":"#1E293B" }}>{c.hours_logged}h</div>
                      <div style={{ fontSize:"9px", color:"#94A3B8" }}>of 40h</div>
                    </div>
                    {/* Utilisation badge */}
                    <div style={{ width:"44px", height:"44px", borderRadius:"50%", border:`3px solid ${isOver?"#EF4444":barColor}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:"10px", fontWeight:"800", color:isOver?"#DC2626":barColor }}>{pct}%</span>
                    </div>
                  </div>

                  {/* Project breakdown */}
                  {c.logs?.length > 0 && (
                    <div style={{ marginTop:"10px", display:"flex", flexWrap:"wrap", gap:"4px", paddingLeft:"48px" }}>
                      {Object.entries(c.logs.reduce((acc,l)=>{ const k=l.project||"General"; acc[k]=(acc[k]||0)+l.hours; return acc; },{})).map(([proj,hrs])=>(
                        <span key={proj} style={{ fontSize:"10px", fontWeight:"600", padding:"2px 8px", borderRadius:"100px", background:"#F1F5F9", color:"#475569" }}>{proj}: {hrs}h</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
