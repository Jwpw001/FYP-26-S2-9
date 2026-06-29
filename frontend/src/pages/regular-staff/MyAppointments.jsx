import { useState, useEffect } from "react";
import StaffLayout from "../../components/layout/StaffLayout";
import { api } from "../../lib/api";

const toLocalISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fmtTime = t => t ? String(t).slice(11,16) : "—";

const STATUS_STYLE = {
  confirmed: { bg:"#DCFCE7", color:"#166534", dot:"#22C55E" },
  completed: { bg:"#DBEAFE", color:"#1E40AF", dot:"#3B82F6" },
  cancelled: { bg:"#F3F4F6", color:"#6B7280", dot:"#9CA3AF" },
  no_show:   { bg:"#FEE2E2", color:"#991B1B", dot:"#EF4444" },
};

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day===0?6:day-1) + offset*7);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
}

export default function MyAppointments() {
  const [weekOffset,    setWeekOffset]    = useState(0);
  const [selectedDate,  setSelectedDate]  = useState(toLocalISO(new Date()));
  const [appointments,  setAppointments]  = useState([]);
  const [weekAppts,     setWeekAppts]     = useState([]);
  const [loading,       setLoading]       = useState(true);

  const weekDates = getWeekDates(weekOffset);
  const weekStart = toLocalISO(weekDates[0]);
  const weekEnd   = toLocalISO(weekDates[6]);

  useEffect(() => { loadWeek(); }, [weekOffset]);
  useEffect(() => { loadDay(); }, [selectedDate]);

  async function loadWeek() {
    try {
      const r = await api.get(`/api/bookings/my?date=`);
      // Filter client-side for the week
      const all = r.appointments || [];
      setWeekAppts(all.filter(a => a.booking_date >= weekStart && a.booking_date <= weekEnd));
    } catch {}
  }

  async function loadDay() {
    setLoading(true);
    try {
      const r = await api.get(`/api/bookings/my?date=${selectedDate}`);
      setAppointments(r.appointments || []);
    } catch {} finally { setLoading(false); }
  }

  // Count per day for dot indicators
  const countByDate = {};
  weekAppts.forEach(a => { const d = a.booking_date?.split("T")[0]; countByDate[d] = (countByDate[d]||0)+1; });

  return (
    <StaffLayout title="My Appointments">
      <div style={{ padding:"24px", maxWidth:"680px", animation:"pageSlideUp 0.25s ease both" }}>
        <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#0F172A", marginBottom:"4px" }}>My Appointments</h2>
        <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"20px" }}>Your daily appointment schedule</p>

        {/* Week strip */}
        <div style={{ background:"#fff", borderRadius:"14px", border:"1px solid #E8EDF5", padding:"14px 16px", marginBottom:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
            <button onClick={()=>setWeekOffset(p=>p-1)} style={{ width:"28px",height:"28px",borderRadius:"7px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"12px" }}>←</button>
            <span style={{ fontSize:"12px",fontWeight:"700",color:"#1E293B" }}>
              {weekDates[0].toLocaleDateString("en-SG",{day:"numeric",month:"short"})} – {weekDates[6].toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}
            </span>
            <button onClick={()=>setWeekOffset(p=>p+1)} style={{ width:"28px",height:"28px",borderRadius:"7px",border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:"12px" }}>→</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"4px" }}>
            {weekDates.map((d,i) => {
              const iso   = toLocalISO(d);
              const isSelected = iso === selectedDate;
              const isToday    = iso === toLocalISO(new Date());
              const count      = countByDate[iso] || 0;
              return (
                <button key={i} onClick={() => setSelectedDate(iso)}
                  style={{ padding:"8px 4px", borderRadius:"10px", border:`1.5px solid ${isSelected?"#4F46E5":"transparent"}`, background:isSelected?"#EEF2FF":isToday?"#F8FAFC":"transparent", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
                  <div style={{ fontSize:"9px", fontWeight:"700", color:isSelected?"#4F46E5":"#94A3B8", textTransform:"uppercase", marginBottom:"2px" }}>
                    {d.toLocaleDateString("en-SG",{weekday:"short"}).slice(0,2)}
                  </div>
                  <div style={{ fontSize:"16px", fontWeight:"900", color:isSelected?"#4F46E5":isToday?"#1E293B":"#374151", lineHeight:1 }}>
                    {d.getDate()}
                  </div>
                  {count > 0 ? (
                    <div style={{ marginTop:"4px", width:"18px", height:"18px", borderRadius:"50%", background:"#4F46E5", display:"flex", alignItems:"center", justifyContent:"center", margin:"4px auto 0", fontSize:"9px", fontWeight:"800", color:"#fff" }}>{count}</div>
                  ) : (
                    <div style={{ height:"18px", marginTop:"4px" }}/>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day appointments */}
        <div style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", marginBottom:"12px" }}>
          {new Date(selectedDate+"T00:00:00").toLocaleDateString("en-SG",{weekday:"long",day:"numeric",month:"long"})}
          <span style={{ fontSize:"12px", fontWeight:"500", color:"#94A3B8", marginLeft:"8px" }}>
            {appointments.filter(a=>a.status==="confirmed").length} appointment{appointments.filter(a=>a.status==="confirmed").length!==1?"s":""}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign:"center",padding:"40px",color:"#94A3B8" }}>Loading…</div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign:"center",padding:"40px 20px",background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF5" }}>
            <div style={{ fontSize:"32px",marginBottom:"10px" }}>✨</div>
            <p style={{ fontSize:"14px",fontWeight:"700",color:"#1E293B",marginBottom:"4px" }}>No appointments</p>
            <p style={{ fontSize:"12px",color:"#94A3B8" }}>You have no bookings on this day.</p>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
            {appointments.map(a => {
              const ss    = STATUS_STYLE[a.status] || STATUS_STYLE.confirmed;
              const color = a.services?.color || "#6366F1";
              return (
                <div key={a.booking_id} style={{ background:"#fff",borderRadius:"12px",border:"1px solid #E8EDF5",padding:"14px 16px",display:"flex",alignItems:"center",gap:"12px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
                  {/* Left bar */}
                  <div style={{ width:"4px",height:"52px",borderRadius:"4px",background:color,flexShrink:0 }}/>
                  {/* Time */}
                  <div style={{ flexShrink:0,textAlign:"center",width:"56px" }}>
                    <div style={{ fontSize:"12px",fontWeight:"800",color }}>{fmtTime(a.start_time)}</div>
                    <div style={{ fontSize:"10px",color:"#94A3B8" }}>–{fmtTime(a.end_time)}</div>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:"14px",fontWeight:"700",color:"#0F172A",marginBottom:"2px" }}>{a.customer_name}</div>
                    <div style={{ fontSize:"11px",color:"#64748B" }}>
                      {a.services?.name || "—"}
                      {a.services?.duration_mins ? ` · ${a.services.duration_mins}min` : ""}
                    </div>
                    {a.notes && <div style={{ fontSize:"10px",color:"#94A3B8",marginTop:"2px",fontStyle:"italic" }}>{a.notes}</div>}
                  </div>
                  {/* Status dot */}
                  <div style={{ display:"flex",alignItems:"center",gap:"5px",flexShrink:0 }}>
                    <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:ss.dot }}/>
                    <span style={{ fontSize:"11px",fontWeight:"700",color:ss.color }}>{a.status.charAt(0).toUpperCase()+a.status.slice(1).replace("_"," ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
