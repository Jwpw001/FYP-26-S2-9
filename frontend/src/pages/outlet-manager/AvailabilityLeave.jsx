import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function AvailabilityLeave() {
  const user = getUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/api/availability");
        if (!cancelled) setRequests(res.availability || res.data || []);
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAction(requestId, action) {
    setProcessing(requestId);
    try {
      await api.patch(`/api/availability/${requestId}`, { status: action });
      setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: action } : r));
    } catch (err) { console.error(err); }
    finally { setProcessing(null); }
  }

  const filtered = requests.filter(r => filter === "all" ? true : r.status === filter);
  const pending = requests.filter(r => r.status === "pending").length;

  function getName(req) {
    return req.staff?.users?.full_name || req.staff?.users?.email || "Unknown";
  }
  function getEmail(req) { return req.staff?.users?.email || ""; }
  function getInitial(req) { return getName(req)?.[0]?.toUpperCase() || "?"; }

  return (
    <ManagerLayout title="Availability & Leave">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Leave Requests</h2>
          <p style={s.sub}>{pending} pending approval</p>
        </div>
      </div>
      <div style={s.tabs}>
        {["pending","approved","rejected","all"].map(f => (
          <button key={f} style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && pending > 0 && <span style={s.badge}>{pending}</span>}
          </button>
        ))}
      </div>
      {loading ? <div style={s.empty}>Loading requests…</div>
      : filtered.length === 0 ? (
        <div style={s.emptyCard}><p style={s.emptyIcon}>📋</p><p style={s.emptyTitle}>No {filter} requests</p></div>
      ) : (
        <div style={s.list}>
          {filtered.map(req => (
            <div key={req.request_id} style={s.card}>
              <div style={s.cardTop}>
                <div style={s.staffInfo}>
                  <div style={s.avatar}>{getInitial(req)}</div>
                  <div>
                    <p style={s.staffName}>{getName(req)}</p>
                    <p style={s.staffEmail}>{getEmail(req)}</p>
                  </div>
                </div>
                <span style={{ ...s.statusBadge, ...statusStyle(req.status) }}>
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </span>
              </div>
              <div style={s.cardBody}>
                <div style={s.infoItem}>
                  <span style={s.infoLabel}>Type</span>
                  <span style={s.infoVal}>{req.leave_type.charAt(0).toUpperCase() + req.leave_type.slice(1)} Leave</span>
                </div>
                <div style={s.infoItem}>
                  <span style={s.infoLabel}>Dates</span>
                  <span style={s.infoVal}>{fmtDate(req.start_date)} → {fmtDate(req.end_date)}</span>
                </div>
                <div style={s.infoItem}>
                  <span style={s.infoLabel}>Duration</span>
                  <span style={s.infoVal}>{getDays(req.start_date, req.end_date)} day(s)</span>
                </div>
              </div>
              {req.reason && <p style={s.reason}>"{req.reason}"</p>}
              {req.status === "pending" && (
                <div style={s.actions}>
                  <button style={s.rejectBtn} onClick={() => handleAction(req.request_id, "rejected")} disabled={processing === req.request_id}>
                    {processing === req.request_id ? "…" : "Reject"}
                  </button>
                  <button style={s.approveBtn} onClick={() => handleAction(req.request_id, "approved")} disabled={processing === req.request_id}>
                    {processing === req.request_id ? "…" : "Approve"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric", year:"numeric" });
}
function getDays(start, end) {
  if (!start || !end) return 0;
  return Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1;
}
function statusStyle(status) {
  const map = { pending:{ background:"#FFFBEB", color:"#D97706" }, approved:{ background:"#DCFCE7", color:"#166534" }, rejected:{ background:"#FEE2E2", color:"#991B1B" } };
  return map[status] || map.pending;
}
const s = {
  headerRow:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" },
  heading:{ fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub:{ fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  tabs:{ display:"flex", gap:"4px", background:"#F0EDE8", padding:"4px", borderRadius:"10px", marginBottom:"16px", width:"fit-content" },
  tab:{ padding:"6px 14px", background:"transparent", border:"none", borderRadius:"7px", fontSize:"13px", fontWeight:"500", color:"#7A7870", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" },
  tabActive:{ background:"#FFFFFF", color:"#1C1B18", fontWeight:"600", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" },
  badge:{ background:"#EF4444", color:"#FFFFFF", fontSize:"10px", fontWeight:"700", padding:"1px 5px", borderRadius:"100px" },
  empty:{ textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  emptyCard:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"60px", textAlign:"center" },
  emptyIcon:{ fontSize:"32px", marginBottom:"10px" },
  emptyTitle:{ fontSize:"16px", fontWeight:"600", color:"#7A7870" },
  list:{ display:"flex", flexDirection:"column", gap:"12px" },
  card:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px" },
  cardTop:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" },
  staffInfo:{ display:"flex", alignItems:"center", gap:"10px" },
  avatar:{ width:"36px", height:"36px", borderRadius:"50%", background:"#E5E2DC", color:"#55524A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", fontWeight:"700", flexShrink:0 },
  staffName:{ fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  staffEmail:{ fontSize:"12px", color:"#7A7870", marginTop:"1px" },
  statusBadge:{ padding:"4px 10px", borderRadius:"100px", fontSize:"12px", fontWeight:"600" },
  cardBody:{ display:"flex", gap:"24px", flexWrap:"wrap", padding:"12px 0", borderTop:"1px solid #F0EDE8", borderBottom:"1px solid #F0EDE8", marginBottom:"12px" },
  infoItem:{ display:"flex", flexDirection:"column", gap:"2px" },
  infoLabel:{ fontSize:"11px", fontWeight:"600", color:"#A09D97", textTransform:"uppercase" },
  infoVal:{ fontSize:"13px", fontWeight:"500", color:"#1C1B18" },
  reason:{ fontSize:"13px", color:"#7A7870", fontStyle:"italic", marginBottom:"12px" },
  actions:{ display:"flex", justifyContent:"flex-end", gap:"8px" },
  rejectBtn:{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"600", color:"#991B1B", cursor:"pointer" },
  approveBtn:{ background:"#1C1B18", border:"none", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
};
