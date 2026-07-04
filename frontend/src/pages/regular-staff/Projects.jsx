import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StaffLayout from "../../components/layout/StaffLayout";
import { api } from "../../lib/api";
import { Kanban, ArrowUpRight, Users, ClipboardList } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-proj-styles")) {
  const style = document.createElement("style");
  style.id = "staff-proj-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .staff-proj-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
    .staff-proj-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.1) !important; border-color: #C7D2FE !important; }
    .staff-proj-card:hover .staff-proj-cta { color: #4F46E5 !important; gap: 6px !important; }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLE = {
  active:    { bg: "#DCFCE7", color: "#166534", label: "Active" },
  completed: { bg: "#DBEAFE", color: "#1E40AF", label: "Completed" },
  on_hold:   { bg: "#FEF3C7", color: "#92400E", label: "On Hold" },
  cancelled: { bg: "#FEE2E2", color: "#991B1B", label: "Cancelled" },
};

export default function StaffProjects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/projects").then(r => setProjects(r.projects || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activeCount = projects.filter(p => p.status === "active").length;

  return (
    <StaffLayout title="Projects">
      <div style={{ padding: "28px 32px", animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", marginBottom: "4px", letterSpacing: "-0.01em" }}>Projects</h2>
            <p style={{ fontSize: "13px", color: "#64748B" }}>Browse every project's board and see how work is progressing.</p>
          </div>
          {!loading && projects.length > 0 && (
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 18px", textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>{projects.length}</div>
                <div style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total</div>
              </div>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "12px", padding: "10px 18px", textAlign: "center" }}>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#166534" }}>{activeCount}</div>
                <div style={{ fontSize: "10px", fontWeight: "600", color: "#16A34A", textTransform: "uppercase", letterSpacing: "0.04em" }}>Active</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: "160px", borderRadius: "16px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E8EDF5", borderRadius: "16px", padding: "72px", textAlign: "center" }}>
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><ClipboardList size={40} color="#94A3B8" /></div>
            <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>No projects yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {projects.map((p, i) => {
              const ss = STATUS_STYLE[p.status] || STATUS_STYLE.active;
              const color = p.color || "#6366F1";
              const members = p.project_assignments || [];
              return (
                <div key={p.project_id} className="staff-proj-card" onClick={() => navigate(`/regular-staff/projects/${p.project_id}/board`)}
                  style={{ background: "#fff", border: "1px solid #E8EDF5", borderRadius: "16px", overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.35s ease ${i * 0.06}s both`, display: "flex", flexDirection: "column" }}>

                  {/* Colored top accent */}
                  <div style={{ height: "5px", background: `linear-gradient(90deg, ${color}, ${color}99)` }} />

                  <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Kanban size={18} color={color} />
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", background: ss.bg, color: ss.color, flexShrink: 0 }}>{ss.label}</span>
                    </div>

                    <p style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A", marginBottom: "6px", lineHeight: 1.3 }}>{p.name}</p>
                    {p.description && (
                      <p style={{ fontSize: "12.5px", color: "#64748B", lineHeight: 1.55, marginBottom: "16px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.description}</p>
                    )}

                    <div style={{ flex: 1 }} />

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                        {members.length > 0 ? (
                          <div style={{ display: "flex" }}>
                            {members.slice(0, 4).map((a, mi) => (
                              <div key={mi} title={a.staff?.users?.full_name}
                                style={{ marginLeft: mi === 0 ? 0 : -7, width: "24px", height: "24px", borderRadius: "50%", background: `${color}20`, border: `2px solid #fff`, boxShadow: `0 0 0 1px ${color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800", color, flexShrink: 0 }}>
                                {a.staff?.users?.full_name?.[0]?.toUpperCase()}
                              </div>
                            ))}
                            {members.length > 4 && (
                              <div style={{ marginLeft: -7, width: "24px", height: "24px", borderRadius: "50%", background: "#F1F5F9", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "#64748B" }}>
                                +{members.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#CBD5E1", fontStyle: "italic" }}>
                            <Users size={12} /> No staff assigned
                          </span>
                        )}
                      </div>
                      <span className="staff-proj-cta" style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px", fontWeight: "700", color: "#94A3B8", transition: "all 0.18s ease", flexShrink: 0 }}>
                        Open board <ArrowUpRight size={13} />
                      </span>
                    </div>
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
