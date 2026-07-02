import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { Plus, X, AlertCircle, Bug, Zap, HelpCircle, Search, Filter, Save, Trash2 } from "lucide-react";

const TYPE_META = {
  bug:         { label: "Bug",         color: "#DC2626", bg: "#FEE2E2", Icon: Bug },
  improvement: { label: "Improvement", color: "#7C3AED", bg: "#F5F3FF", Icon: Zap },
  question:    { label: "Question",    color: "#0284C7", bg: "#E0F2FE", Icon: HelpCircle },
  feature:     { label: "Feature",     color: "#059669", bg: "#D1FAE5", Icon: AlertCircle },
};

const PRIORITY_META = {
  low:    { label: "Low",    color: "#64748B", bg: "#F1F5F9" },
  medium: { label: "Medium", color: "#D97706", bg: "#FEF3C7" },
  high:   { label: "High",   color: "#DC2626", bg: "#FEE2E2" },
  urgent: { label: "Urgent", color: "#7C3AED", bg: "#F5F3FF" },
};

const STATUS_META = {
  open:        { label: "Open",        color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "In Progress", color: "#2563EB", bg: "#DBEAFE" },
  resolved:    { label: "Resolved",    color: "#059669", bg: "#D1FAE5" },
  closed:      { label: "Closed",      color: "#64748B", bg: "#F1F5F9" },
};

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899"];
function avatarColor(name = "") {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const inp = { width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const sel = { ...inp, cursor: "pointer", background: "#FFF" };
const btnBase = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" };

function IssueModal({ issue, projects, members, onClose, onSave, onDelete }) {
  const isNew = !issue?.issue_id;
  const [form, setForm] = useState({
    title: issue?.title || "", description: issue?.description || "",
    type: issue?.type || "bug", priority: issue?.priority || "medium",
    status: issue?.status || "open", assigned_to: issue?.assigned_to || "",
    project_id: issue?.project_id || "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, assigned_to: form.assigned_to || null, project_id: form.project_id || null };
      let res;
      if (isNew) res = await api.post("/api/flex/issues", body);
      else res = await api.patch(`/api/flex/issues/${issue.issue_id}`, body);
      onSave(res.issue);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function del() {
    if (!issue?.issue_id || !confirm("Delete this issue?")) return;
    await api.delete(`/api/flex/issues/${issue.issue_id}`);
    onDelete(issue.issue_id);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "500px", maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "800" }}>{isNew ? "New Issue" : "Edit Issue"}</h3>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={13} /></button>
        </div>
        <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Issue title *" style={inp} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue…" rows={3} style={{ ...inp, resize: "vertical" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div><p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "5px" }}>Type</p>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={sel}>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "5px" }}>Priority</p>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={sel}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {!isNew && (
              <div><p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "5px" }}>Status</p>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={sel}>
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}
            <div><p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "5px" }}>Assign To</p>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={sel}>
                <option value="">— Unassigned —</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
              </select>
            </div>
            <div><p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "5px" }}>Project</p>
              <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} style={sel}>
                <option value="">— No Project —</option>
                {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
          {!isNew ? <button onClick={del} style={{ ...btnBase, background: "#FEE2E2", color: "#DC2626", border: "none" }}><Trash2 size={13} /> Delete</button> : <div />}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onClose} style={{ ...btnBase, background: "#F1F5F9", color: "#64748B", border: "none" }}>Cancel</button>
            <button onClick={save} disabled={saving || !form.title.trim()} style={{ ...btnBase, background: saving ? "#E2E8F0" : "linear-gradient(135deg,#DC2626,#EF4444)", color: "#FFF", border: "none" }}>{saving ? "Saving…" : isNew ? "Report Issue" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IssueTracker() {
  const [searchParams] = useSearchParams();
  const presetProject = searchParams.get("project");

  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterProject, setFilterProject] = useState(presetProject || "");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [issuesRes, projRes] = await Promise.all([
        api.get("/api/flex/issues"),
        api.get("/api/projects"),
      ]);
      setIssues(issuesRes.issues || []);
      setProjects(projRes.projects || []);
      // collect all unique members across projects
      const memberMap = {};
      for (const p of projRes.projects || []) {
        for (const a of p.project_assignments || []) {
          const u = a.staff?.users;
          if (u?.user_id) memberMap[u.user_id] = u;
        }
      }
      setMembers(Object.values(memberMap));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function handleSave(issue) {
    setIssues(prev => {
      const i = prev.findIndex(x => x.issue_id === issue.issue_id);
      if (i >= 0) { const n = [...prev]; n[i] = issue; return n; }
      return [issue, ...prev];
    });
    setModal(null);
  }

  function handleDelete(issue_id) {
    setIssues(prev => prev.filter(x => x.issue_id !== issue_id));
    setModal(null);
  }

  const filtered = issues.filter(i => {
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && i.type !== filterType) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterPriority && i.priority !== filterPriority) return false;
    if (filterProject && String(i.project_id) !== filterProject) return false;
    return true;
  });

  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const i of issues) counts[i.status] = (counts[i.status] || 0) + 1;

  return (
    <ManagerLayout title="Issue Tracker">
      <div style={{ animation: "fadeUp 0.3s ease" }}>
        {/* Summary pills */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <div key={k} onClick={() => setFilterStatus(filterStatus === k ? "" : k)} style={{ display: "flex", alignItems: "center", gap: "7px", background: filterStatus === k ? v.bg : "#FFF", border: `1.5px solid ${filterStatus === k ? v.color : "#E2E8F0"}`, borderRadius: "10px", padding: "8px 14px", cursor: "pointer" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: "12px", fontWeight: "600", color: v.color }}>{v.label}</span>
              <strong style={{ fontSize: "14px", color: "#1E293B" }}>{counts[k] || 0}</strong>
            </div>
          ))}
          <button onClick={() => setModal({})} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", background: "linear-gradient(135deg,#DC2626,#EF4444)", color: "#FFF", border: "none", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
            <Plus size={14} /> Report Issue
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px 16px" }}>
          <div style={{ flex: 1, minWidth: "180px", display: "flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "6px 10px" }}>
            <Search size={13} color="#94A3B8" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issues…" style={{ border: "none", outline: "none", background: "transparent", fontSize: "13px", color: "#1E293B", flex: 1 }} />
          </div>
          {[["Type", filterType, setFilterType, Object.entries(TYPE_META).map(([k,v]) => [k, v.label])],
            ["Priority", filterPriority, setFilterPriority, Object.entries(PRIORITY_META).map(([k,v]) => [k, v.label])],
            ["Project", filterProject, setFilterProject, projects.map(p => [String(p.project_id), p.name])]
          ].map(([label, val, setter, opts]) => (
            <select key={label} value={val} onChange={e => setter(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: val ? "#1E293B" : "#94A3B8", background: "#FFF", cursor: "pointer" }}>
              <option value="">All {label}s</option>
              {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          ))}
        </div>

        {/* Issue list */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "40px", height: "16px", borderRadius: "8px", background: "#F1F5F9" }} />
                <div style={{ flex: 1, height: "16px", borderRadius: "8px", background: "#F1F5F9" }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <Bug size={32} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: "14px", color: "#94A3B8", fontWeight: "600" }}>No issues found</p>
            </div>
          ) : filtered.map((issue, idx) => {
            const tm = TYPE_META[issue.type] || TYPE_META.bug;
            const pm = PRIORITY_META[issue.priority] || PRIORITY_META.medium;
            const sm = STATUS_META[issue.status] || STATUS_META.open;
            const TIcon = tm.Icon;
            return (
              <div key={issue.issue_id} onClick={() => setModal(issue)}
                style={{ padding: "14px 20px", borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{ width: 32, height: 32, borderRadius: "8px", background: tm.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <TIcon size={15} color={tm.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.title}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {issue.projects?.name && <span style={{ fontSize: "11px", color: "#94A3B8" }}>{issue.projects.name}</span>}
                    <span style={{ fontSize: "11px", color: "#CBD5E1" }}>·</span>
                    <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                      {new Date(issue.created_at).toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
                    </span>
                    {issue.reporter?.full_name && (
                      <>
                        <span style={{ fontSize: "11px", color: "#CBD5E1" }}>·</span>
                        <span style={{ fontSize: "11px", color: "#94A3B8" }}>by {issue.reporter.full_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: pm.color, background: pm.bg, padding: "2px 8px", borderRadius: "99px" }}>{pm.label}</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: sm.color, background: sm.bg, padding: "2px 8px", borderRadius: "99px" }}>{sm.label}</span>
                  {issue.assignee && (
                    <div title={issue.assignee.full_name} style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(issue.assignee.full_name), color: "#fff", fontSize: 11, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {issue.assignee.full_name?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal !== null && (
        <IssueModal issue={modal?.issue_id ? modal : null} projects={projects} members={members}
          onClose={() => setModal(null)} onSave={handleSave} onDelete={handleDelete} />
      )}
    </ManagerLayout>
  );
}
