import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { FolderKanban, Clock, Users, TrendingUp, AlertTriangle, CheckCircle2, Calendar, Zap, ChevronRight, BarChart2 } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("fp-styles")) {
  const s = document.createElement("style");
  s.id = "fp-styles";
  s.textContent = `
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .fp-card { transition:box-shadow 0.15s,transform 0.15s; }
    .fp-card:hover { box-shadow:0 8px 28px rgba(0,0,0,0.1) !important; transform:translateY(-2px); }
  `;
  document.head.appendChild(s);
}

const STATUS_META = {
  active:    { label: "Active",    color: "#16A34A", bg: "#DCFCE7", dot: "#22C55E" },
  completed: { label: "Completed", color: "#2563EB", bg: "#DBEAFE", dot: "#3B82F6" },
  on_hold:   { label: "On Hold",   color: "#D97706", bg: "#FEF3C7", dot: "#F59E0B" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2", dot: "#EF4444" },
};

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ h = "80px", r = "14px" }) {
  return <div style={{ height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function SummaryCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px 20px", display: "flex", gap: "14px", alignItems: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: "12px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <p style={{ fontSize: "26px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "3px", fontWeight: "600" }}>{label}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const sm = STATUS_META[project.status] || STATUS_META.active;
  const taskPct = project.tasks.total > 0 ? Math.round((project.tasks.done / project.tasks.total) * 100) : 0;
  const epicPct = project.epics.total > 0 ? Math.round((project.epics.closed / project.epics.total) * 100) : 0;
  const overdue = project.overdue;

  return (
    <div className="fp-card" style={{ background: "#FFF", border: `1.5px solid ${overdue ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: "16px", padding: "20px", boxShadow: overdue ? "0 2px 12px rgba(239,68,68,0.1)" : "0 1px 4px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: project.color || "#6366F1", flexShrink: 0 }} />
          <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {overdue && (
            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: "700", color: "#DC2626", background: "#FEE2E2", padding: "2px 8px", borderRadius: "99px" }}>
              <AlertTriangle size={10} /> Overdue
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "700", color: sm.color, background: sm.bg, padding: "3px 10px", borderRadius: "99px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sm.dot }} />{sm.label}
          </span>
        </div>
      </div>

      {/* Active sprint badge */}
      {project.active_sprint && (
        <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "8px", padding: "6px 10px" }}>
          <Zap size={12} color="#6366F1" />
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#4338CA" }}>Sprint: {project.active_sprint.name}</span>
          {project.active_sprint.end_date && (
            <span style={{ fontSize: "11px", color: "#818CF8" }}>· ends {new Date(project.active_sprint.end_date + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}</span>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        <StatBox label="Tasks" value={`${project.tasks.done}/${project.tasks.total}`} pct={taskPct} color="#6366F1" />
        <StatBox label="Epics" value={`${project.epics.closed}/${project.epics.total}`} pct={epicPct} color="#F59E0B" />
        <StatBox label="Hours Logged" value={`${project.logged_hours}h`} pct={null} color="#10B981" />
      </div>

      {/* Due date */}
      {project.end_date && (
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <Calendar size={12} color="#94A3B8" />
          <span style={{ fontSize: "11px", color: overdue ? "#DC2626" : "#94A3B8", fontWeight: "600" }}>
            {overdue ? "Was due" : "Due"} {new Date(project.end_date + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      )}

      {/* Members */}
      {project.members.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ display: "flex" }}>
            {project.members.slice(0, 5).map((m, i) => (
              <div key={m.user_id} title={m.full_name} style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColor(m.full_name), color: "#fff", fontSize: 10, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #FFF", marginLeft: i > 0 ? "-6px" : 0, zIndex: 5 - i }}>
                {m.full_name?.[0]?.toUpperCase()}
              </div>
            ))}
            {project.members.length > 5 && (
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F1F5F9", color: "#64748B", fontSize: 9, fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #FFF", marginLeft: "-6px" }}>
                +{project.members.length - 5}
              </div>
            )}
          </div>
          <span style={{ fontSize: "11px", color: "#94A3B8" }}>{project.members.length} member{project.members.length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, pct, color }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "10px 12px" }}>
      <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", marginBottom: pct !== null ? "6px" : 0 }}>{value}</p>
      {pct !== null && (
        <div style={{ height: "4px", background: "#E2E8F0", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.6s" }} />
        </div>
      )}
    </div>
  );
}

export default function FlexiblePortfolio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/api/flex/portfolio")
      .then(r => setData(r))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const projects = data?.projects || [];
  const summary  = data?.summary  || {};

  const filtered = filter === "all" ? projects : projects.filter(p =>
    filter === "overdue" ? p.overdue : p.status === filter
  );

  const tasksDone = summary.done_tasks || 0;
  const tasksTotal = summary.total_tasks || 0;
  const overallPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return (
    <BusinessOwnerLayout title="Portfolio">
      <div style={{ animation: "fadeUp 0.3s ease" }}>
        {/* Read-only notice */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "10px 16px", marginBottom: "20px" }}>
          <BarChart2 size={15} color="#3B82F6" />
          <p style={{ fontSize: "13px", color: "#1D4ED8", fontWeight: "500" }}>
            Portfolio view — you can see all projects and their progress. Only managers can create or edit projects.
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px", marginBottom: "24px" }}>
          {loading ? Array.from({length:4}).map((_,i) => <Shimmer key={i} h="84px" />) : <>
            <SummaryCard icon={FolderKanban} label="Total Projects"   value={summary.total || 0}   color="#6366F1" bg="#EEF2FF" />
            <SummaryCard icon={TrendingUp}   label="Active"           value={summary.active || 0}  color="#16A34A" bg="#DCFCE7" />
            <SummaryCard icon={AlertTriangle}label="Overdue"          value={summary.overdue || 0} color="#DC2626" bg="#FEE2E2" />
            <SummaryCard icon={CheckCircle2} label="Tasks Complete"   value={`${overallPct}%`}     color="#0284C7" bg="#E0F2FE" />
          </>}
        </div>

        {/* Overall progress bar */}
        {!loading && tasksTotal > 0 && (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>Overall Progress</span>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#6366F1" }}>{tasksDone}/{tasksTotal} tasks done</span>
            </div>
            <div style={{ height: "10px", background: "#F1F5F9", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${overallPct}%`, background: "linear-gradient(90deg,#6366F1,#8B5CF6)", borderRadius: "5px", transition: "width 0.8s" }} />
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {[["all","All Projects"],["active","Active"],["overdue","Overdue"],["completed","Completed"],["on_hold","On Hold"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: "6px 16px", borderRadius: "99px", border: `1.5px solid ${filter === k ? "#6366F1" : "#E2E8F0"}`, background: filter === k ? "#EEF2FF" : "#FFF", color: filter === k ? "#4338CA" : "#64748B", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
              {l} {k !== "all" && `(${k === "overdue" ? projects.filter(p => p.overdue).length : projects.filter(p => p.status === k).length})`}
            </button>
          ))}
        </div>

        {/* Project grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "14px" }}>
            {Array.from({length:4}).map((_,i) => <Shimmer key={i} h="200px" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px" }}>
            <FolderKanban size={40} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "15px", color: "#94A3B8", fontWeight: "600" }}>No projects found</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "14px" }}>
            {filtered.map(p => <ProjectCard key={p.project_id} project={p} />)}
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}
