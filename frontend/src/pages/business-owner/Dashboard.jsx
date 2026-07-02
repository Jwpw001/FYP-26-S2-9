import { useEffect, useState, useRef } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { useBusinessContext } from "../../context/BusinessContext";
import {
  Building2, Users, CalendarDays, AlertTriangle,
  FolderKanban, Clock, BookOpen, CheckCircle2, XCircle,
  TrendingUp, ChevronRight, Zap,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────
const INDUSTRY_META = {
  "f&b":         { emoji:"🍽️", label:"F&B",         welcome:"Here's how your outlets are running today." },
  "retail":      { emoji:"🛍️", label:"Retail",       welcome:"Here's your store coverage for today." },
  "healthcare":  { emoji:"🏥", label:"Healthcare",   welcome:"Here's your clinic coverage for today." },
  "tech":        { emoji:"💻", label:"Technology",   welcome:"Here's your team's current workload." },
  "logistics":   { emoji:"📦", label:"Logistics",    welcome:"Here's your warehouse coverage for today." },
  "beauty":      { emoji:"✨", label:"Beauty",       welcome:"Here's your booking status for today." },
  "education":   { emoji:"📚", label:"Education",    welcome:"Here's your schedule for today." },
  "hospitality": { emoji:"🏨", label:"Hospitality",  welcome:"Here's your department coverage today." },
  "other":       { emoji:"🏢", label:"Business",     welcome:"Here's your workforce overview." },
};

const PLAN_STYLES = {
  free:       { label:"Free",       bg:"#F1F5F9", color:"#64748B" },
  premium:    { label:"Premium",    bg:"#EFF6FF", color:"#2563EB" },
  enterprise: { label:"Enterprise", bg:"#FDF4FF", color:"#9333EA" },
};

function fmtTime(t) {
  if (!t) return "—";
  const d = new Date(t);
  return d.toLocaleTimeString("en-SG", { hour:"2-digit", minute:"2-digit", hour12:true });
}

// ── Count-up animation ────────────────────────────────────
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ── Stat card ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, sub, value, color, bg, delay, onClick }) {
  const displayed = useCountUp(typeof value === "number" ? value : 0);
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px",
        padding:"20px 22px", display:"flex", gap:"14px", alignItems:"flex-start",
        cursor: onClick ? "pointer" : "default",
        animation:`popIn 0.4s ease ${delay}ms both`,
        boxShadow: hov ? `0 6px 20px ${color}22` : "0 1px 3px rgba(0,0,0,0.04)",
        transform: hov ? "translateY(-2px)" : "none",
        transition:"box-shadow 0.18s, transform 0.18s",
      }}>
      <div style={{ width:42, height:42, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:bg, color }}>
        <Icon size={19} />
      </div>
      <div>
        <p style={{ fontSize:26, fontWeight:800, color:"#1E293B", lineHeight:1 }}>{displayed}</p>
        <p style={{ fontSize:13, fontWeight:600, color:"#1E293B", marginTop:3 }}>{label}</p>
        <p style={{ fontSize:11, color:"#94A3B8", marginTop:1 }}>{sub}</p>
      </div>
    </div>
  );
}

// ── Alert strip ───────────────────────────────────────────
function AlertBanner({ alert, onNav }) {
  const [hov, setHov] = useState(false);
  const isWarn = alert.type === "warning";
  return (
    <div
      onClick={() => onNav(alert.link)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 16px", borderRadius:10, cursor:"pointer",
        background: hov ? (isWarn ? "#FEF9C3" : "#EFF6FF") : (isWarn ? "#FFFBEB" : "#F0F9FF"),
        border:`1px solid ${isWarn ? "#FDE68A" : "#BAE6FD"}`,
        transition:"background 0.15s",
        marginBottom:8,
      }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <AlertTriangle size={16} color={isWarn ? "#D97706" : "#0284C7"} />
        <span style={{ fontSize:13, fontWeight:600, color: isWarn ? "#92400E" : "#0C4A6E" }}>{alert.message}</span>
        {alert.items?.length > 0 && (
          <span style={{ fontSize:11, color:"#94A3B8" }}>
            — {alert.items.slice(0,2).map(i => i.label).join(", ")}{alert.items.length > 2 ? ` +${alert.items.length - 2} more` : ""}
          </span>
        )}
      </div>
      <ChevronRight size={15} color="#94A3B8" />
    </div>
  );
}

// ── Quick action button ───────────────────────────────────
function QuickAction({ label, sub, icon: Icon, color, bg, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:"#fff", border:"1px solid #E2E8F0", borderRadius:12,
        padding:"14px 16px", textAlign:"left", cursor:"pointer",
        boxShadow: hov ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
        transform: hov ? "translateY(-1px)" : "none",
        transition:"all 0.15s",
        display:"flex", gap:12, alignItems:"center",
      }}>
      <div style={{ width:34, height:34, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", background: bg || "#F1F5F9", color: color || "#64748B", flexShrink:0 }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:700, color:"#1E293B" }}>{label}</div>
        <div style={{ fontSize:11, color:"#94A3B8", marginTop:1 }}>{sub}</div>
      </div>
    </button>
  );
}

// ── Section header ────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
      <h3 style={{ fontSize:14, fontWeight:700, color:"#1E293B" }}>{title}</h3>
      {action && (
        <button onClick={onAction} style={{ fontSize:12, color:"#6366F1", fontWeight:600, background:"none", border:"none", cursor:"pointer" }}>
          {action} →
        </button>
      )}
    </div>
  );
}

// ── SHIFT: today's outlet coverage rows ───────────────────
function ShiftOverview({ rows, locationLabel, goTo }) {
  if (!rows?.length) return (
    <div style={{ textAlign:"center", padding:"24px 0", color:"#94A3B8", fontSize:13 }}>No {locationLabel.toLowerCase()}s yet.</div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {rows.map((r, i) => {
        const pct = r.required > 0 ? Math.min(r.assigned / r.required, 1) : 0;
        const covered = r.assigned >= r.required;
        const barColor = covered ? "#22C55E" : pct >= 0.5 ? "#F59E0B" : "#EF4444";
        return (
          <div key={i} style={{ background:"#F8FAFC", borderRadius:10, padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#1E293B" }}>{r.name}</span>
              <span style={{ fontSize:12, color: covered ? "#16A34A" : "#DC2626", fontWeight:600 }}>
                {r.assigned}/{r.required} staff
              </span>
            </div>
            <div style={{ height:5, borderRadius:99, background:"#E2E8F0", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct * 100}%`, background:barColor, borderRadius:99, transition:"width 0.6s ease" }} />
            </div>
            {r.total_shifts === 0 && (
              <p style={{ fontSize:11, color:"#94A3B8", marginTop:4 }}>No shifts scheduled today</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FLEXIBLE: project overview ────────────────────────────
function ProjectOverview({ projects, goTo }) {
  if (!projects?.length) return (
    <div style={{ textAlign:"center", padding:"24px 0", color:"#94A3B8", fontSize:13 }}>No projects yet.</div>
  );
  const STATUS = {
    active:    { label:"Active",    color:"#16A34A", bg:"#DCFCE7" },
    completed: { label:"Done",      color:"#2563EB", bg:"#DBEAFE" },
    on_hold:   { label:"On Hold",   color:"#D97706", bg:"#FEF3C7" },
    cancelled: { label:"Cancelled", color:"#DC2626", bg:"#FEE2E2" },
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {projects.map(p => {
        const st = STATUS[p.status] || STATUS.active;
        const overdue = p.end_date && new Date(p.end_date) < new Date() && p.status === "active";
        return (
          <div key={p.project_id} style={{ background:"#F8FAFC", borderRadius:10, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <span style={{ fontSize:13, fontWeight:600, color:"#1E293B" }}>{p.name}</span>
              {p.end_date && (
                <p style={{ fontSize:11, color: overdue ? "#DC2626" : "#94A3B8", marginTop:2 }}>
                  {overdue ? "⚠ Overdue · " : "Due "}
                  {new Date(p.end_date).toLocaleDateString("en-SG", { day:"numeric", month:"short" })}
                </p>
              )}
            </div>
            <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:99, background:st.bg, color:st.color }}>{st.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── APPOINTMENT: today's bookings list ────────────────────
function BookingOverview({ bookings }) {
  if (!bookings?.length) return (
    <div style={{ textAlign:"center", padding:"24px 0", color:"#94A3B8", fontSize:13 }}>No bookings today.</div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {bookings.map(b => (
        <div key={b.booking_id} style={{ background:"#F8FAFC", borderRadius:10, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <span style={{ fontSize:13, fontWeight:600, color:"#1E293B" }}>{b.customer_name}</span>
            {b.services?.name && <span style={{ fontSize:11, color:"#94A3B8", marginLeft:6 }}>· {b.services.name}</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"#64748B" }}>{fmtTime(b.start_time)}</span>
            {b.assigned_staff_id
              ? <CheckCircle2 size={14} color="#22C55E" />
              : <XCircle size={14} color="#EF4444" />}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────
export default function BODashboard() {
  const goTo = useGoTo();
  const { locationLabel, staffLabel, schedulingMode, industry, plan } = useBusinessContext();
  const [stats, setStats] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/business/info"),
      api.get("/api/business/stats"),
    ]).then(([biz, st]) => {
      setBusiness(biz.business);
      setStats(st);
    }).finally(() => setLoading(false));
  }, []);

  const meta    = INDUSTRY_META[industry] || INDUSTRY_META["other"];
  const planSt  = PLAN_STYLES[plan] || PLAN_STYLES.free;
  const mode    = stats?.mode || schedulingMode || "shift";

  // ── Stat cards per mode ──────────────────────────────────
  const statCards = mode === "flexible" ? [
    { icon:Building2,    label:`${locationLabel}s`,     sub:"Across your business",   value:stats?.outlets_count    ?? 0, color:"#D97706", bg:"#FEF3C7", link:"/business-owner/outlets" },
    { icon:Users,        label:`All ${staffLabel}`,     sub:"Active members",          value:stats?.staff_count      ?? 0, color:"#3B82F6", bg:"#EFF6FF", link:"/business-owner/staff" },
    { icon:FolderKanban, label:"Active Projects",       sub:"Currently in progress",   value:stats?.active_projects  ?? 0, color:"#6366F1", bg:"#EEF2FF", link:"/business-owner/projects" },
    { icon:Clock,        label:"Pending Timesheets",    sub:"Awaiting your approval",  value:stats?.pending_timesheets ?? 0, color:"#EC4899", bg:"#FDF2F8", link:"/business-owner/timesheets" },
  ] : mode === "appointment" ? [
    { icon:Building2,    label:`${locationLabel}s`,     sub:"Across your business",   value:stats?.outlets_count      ?? 0, color:"#D97706", bg:"#FEF3C7", link:"/business-owner/outlets" },
    { icon:Users,        label:`All ${staffLabel}`,     sub:"Active members",          value:stats?.staff_count        ?? 0, color:"#3B82F6", bg:"#EFF6FF", link:"/business-owner/staff" },
    { icon:BookOpen,     label:"Today's Bookings",      sub:"Scheduled for today",     value:stats?.today_bookings     ?? 0, color:"#6366F1", bg:"#EEF2FF", link:"/business-owner/bookings" },
    { icon:AlertTriangle,label:"Unassigned Bookings",  sub:"Need staff assigned",      value:stats?.unassigned_bookings ?? 0, color:"#EF4444", bg:"#FEF2F2", link:"/business-owner/bookings" },
  ] : [
    { icon:Building2,    label:`${locationLabel}s`,     sub:"Across your business",   value:stats?.outlets_count     ?? 0, color:"#D97706", bg:"#FEF3C7", link:"/business-owner/outlets" },
    { icon:Users,        label:`All ${staffLabel}`,     sub:"Active members",          value:stats?.staff_count       ?? 0, color:"#3B82F6", bg:"#EFF6FF", link:"/business-owner/staff" },
    { icon:CalendarDays, label:"Today's Shifts",        sub:"Across all locations",    value:stats?.today_shifts      ?? 0, color:"#6366F1", bg:"#EEF2FF", link:"/outlet-manager/schedule" },
    { icon:AlertTriangle,label:"Understaffed",          sub:"Shifts below headcount",  value:stats?.understaffed_count ?? 0, color:"#EF4444", bg:"#FEF2F2", link:"/outlet-manager/schedule" },
  ];

  // ── Quick actions per mode + industry ────────────────────
  const quickActions = mode === "flexible" ? [
    { icon:FolderKanban, label:"Create Project",         sub:"Start a new project",          color:"#6366F1", bg:"#EEF2FF", path:"/business-owner/projects" },
    { icon:Users,        label:`Invite ${staffLabel}`,   sub:"Send join links",              color:"#3B82F6", bg:"#EFF6FF", path:"/business-owner/invitations" },
    { icon:Clock,        label:"Review Timesheets",      sub:"Approve pending hours",        color:"#EC4899", bg:"#FDF2F8", path:"/business-owner/timesheets" },
  ] : mode === "appointment" ? [
    { icon:BookOpen,     label:"View Bookings",          sub:"Today's appointments",         color:"#6366F1", bg:"#EEF2FF", path:"/business-owner/bookings" },
    { icon:Users,        label:`Invite ${staffLabel}`,   sub:"Add providers/therapists",     color:"#3B82F6", bg:"#EFF6FF", path:"/business-owner/invitations" },
    { icon:Building2,    label:`Add ${locationLabel}`,   sub:"New branch or location",       color:"#D97706", bg:"#FEF3C7", path:"/business-owner/outlets" },
  ] : [
    { icon:CalendarDays, label:"View Schedule",          sub:"See this week's shifts",       color:"#6366F1", bg:"#EEF2FF", path:"/outlet-manager/schedule" },
    { icon:Users,        label:`Invite ${staffLabel}`,   sub:"Send join links",              color:"#3B82F6", bg:"#EFF6FF", path:"/business-owner/invitations" },
    { icon:Building2,    label:`Add ${locationLabel}`,   sub:"Set up a new location",        color:"#D97706", bg:"#FEF3C7", path:"/business-owner/outlets" },
  ];

  // ── Today's overview label ───────────────────────────────
  const overviewTitle = mode === "flexible"
    ? "Project Status"
    : mode === "appointment"
    ? "Today's Appointments"
    : `Today's Coverage by ${locationLabel}`;

  const overviewAction = mode === "flexible"
    ? { label:"All Projects", path:"/business-owner/projects" }
    : mode === "appointment"
    ? { label:"All Bookings", path:"/business-owner/bookings" }
    : { label:"Full Schedule", path:"/outlet-manager/schedule" };

  return (
    <BusinessOwnerLayout title="Dashboard">
      <style>{`
        @keyframes popIn {
          0%   { opacity:0; transform:scale(0.92); }
          60%  { transform:scale(1.03); }
          100% { opacity:1; transform:scale(1); }
        }
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
      <div style={{ animation:"pageSlideUp 0.3s ease both" }}>

        {/* ── Welcome header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:24 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
              <h2 style={{ fontSize:22, fontWeight:800, color:"#1E293B", margin:0 }}>Welcome back 👋</h2>
              <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:99, background:planSt.bg, color:planSt.color }}>{planSt.label}</span>
            </div>
            <p style={{ fontSize:14, color:"#64748B", margin:0 }}>
              <strong style={{ color:"#1E293B" }}>{business?.name || "Your Business"}</strong>
              {" · "}{meta.welcome}
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderRadius:10, background:"#F8FAFC", border:"1px solid #E2E8F0" }}>
            <span style={{ fontSize:20 }}>{meta.emoji}</span>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#1E293B" }}>{meta.label}</div>
              <div style={{ fontSize:11, color:"#94A3B8", textTransform:"capitalize" }}>{mode} mode</div>
            </div>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:24 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:14, padding:22, height:88, animation:`popIn 0.3s ease ${i*60}ms both` }} />
              ))
            : statCards.map((c, i) => (
                <StatCard key={c.label} {...c} delay={i * 70} onClick={c.link ? () => goTo(c.link) : undefined} />
              ))
          }
        </div>

        {/* ── Alerts ── */}
        {!loading && stats?.alerts?.length > 0 && (
          <div style={{ marginBottom:24 }}>
            <SectionHeader title="Needs Attention" />
            {stats.alerts.map((a, i) => (
              <AlertBanner key={i} alert={a} onNav={goTo} />
            ))}
          </div>
        )}

        {/* ── Today's overview + Quick actions (two-col) ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:16, alignItems:"start" }}>

          {/* Today's overview */}
          <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:14, padding:20 }}>
            <SectionHeader
              title={overviewTitle}
              action={overviewAction.label}
              onAction={() => goTo(overviewAction.path)}
            />
            {loading
              ? <div style={{ height:120, borderRadius:10, background:"#F8FAFC" }} />
              : mode === "flexible"
              ? <ProjectOverview projects={stats?.project_overview} goTo={goTo} />
              : mode === "appointment"
              ? <BookingOverview bookings={stats?.booking_overview} />
              : <ShiftOverview rows={stats?.today_overview} locationLabel={locationLabel} goTo={goTo} />
            }
          </div>

          {/* Quick actions */}
          <div>
            <SectionHeader title="Quick Actions" />
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {quickActions.map((a, i) => (
                <QuickAction key={i} {...a} onClick={() => goTo(a.path)} />
              ))}
            </div>

            {/* Business mini-card */}
            {business && (
              <div style={{ marginTop:16, background:"#F8FAFC", borderRadius:12, padding:"14px 16px", border:"1px solid #E2E8F0" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Zap size={13} color="#6366F1" />
                  <span style={{ fontSize:12, fontWeight:700, color:"#6366F1" }}>Business Info</span>
                </div>
                {[
                  ["Name",     business.name],
                  ["Email",    business.contact_email || "—"],
                  ["Address",  business.address || "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:"flex", gap:6, marginBottom:4 }}>
                    <span style={{ fontSize:11, color:"#94A3B8", minWidth:48 }}>{k}</span>
                    <span style={{ fontSize:11, color:"#1E293B", fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </BusinessOwnerLayout>
  );
}
