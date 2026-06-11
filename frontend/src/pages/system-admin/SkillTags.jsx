import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import AdminLayout from "../../components/layout/AdminLayout";

/* ─── Keyframes ─────────────────────────────────────────────────────────── */
const injectKeyframes = () => {
  if (document.getElementById("sa-skill-kf")) return;
  const style = document.createElement("style");
  style.id = "sa-skill-kf";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.92); }
      60%  { transform: scale(1.03); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(60px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
};

/* ─── Shimmer skeleton ───────────────────────────────────────────────────── */
const SHIMMER_BG = "linear-gradient(90deg,#f0f4f8 25%,#e2e8f0 50%,#f0f4f8 75%)";

function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 160px", gap: 12, padding: "14px 20px", borderTop: "1px solid #E2E8F0", alignItems: "center" }}>
      <div style={{ height: 14, width: 100, borderRadius: 7, background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
      <div style={{ height: 13, width: 200, borderRadius: 6, background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ height: 28, width: 50, borderRadius: 8, background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
        <div style={{ height: 28, width: 58, borderRadius: 8, background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
      </div>
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const bg     = type === "error" ? "#FEF2F2" : "#F0FDF4";
  const border = type === "error" ? "#FECACA" : "#BBF7D0";
  const color  = type === "error" ? "#991B1B" : "#166534";

  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 1000,
      background: bg, border: `1px solid ${border}`, color,
      padding: "12px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600,
      boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
      animation: "toastSlideIn 0.3s ease both",
      maxWidth: 340,
    }}>
      {message}
    </div>
  );
}

/* ─── FocusInput ─────────────────────────────────────────────────────────── */
function FocusInput({ style: extraStyle = {}, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        display: "block", width: "100%", padding: "10px 14px",
        border: `1.5px solid ${focused ? "#3B82F6" : "#E2E8F0"}`,
        borderRadius: 10, fontSize: 14,
        background: "#FFFFFF", color: "#0F172A",
        boxSizing: "border-box", outline: "none",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...extraStyle,
      }}
    />
  );
}

/* ─── HoverRow ───────────────────────────────────────────────────────────── */
function HoverRow({ children, style: extraStyle = {} }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? "#F8FAFC" : "#FFFFFF", transition: "background 0.12s", ...extraStyle }}
    >
      {children}
    </div>
  );
}

/* ─── SmallButton ────────────────────────────────────────────────────────── */
function SmallButton({ children, onClick, variant = "default", style: extra = {} }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);

  const variants = {
    default: { background: "#F1F5F9", color: "#0F172A", border: "1px solid #E2E8F0" },
    danger:  { background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" },
    primary: { background: "#3B82F6", color: "#FFFFFF", border: "none" },
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        ...variants[variant],
        padding: "5px 13px", borderRadius: 8,
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        transform: press ? "scale(0.97)" : hov ? "scale(1.02)" : "scale(1)",
        boxShadow: hov && !press ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
        transition: "transform 0.12s, box-shadow 0.12s",
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

/* ─── ActionButton ───────────────────────────────────────────────────────── */
function ActionButton({ children, onClick, disabled, style: extra = {} }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        background: "#3B82F6", color: "#FFFFFF",
        border: "none", padding: "10px 20px", borderRadius: 10,
        fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        transform: press ? "scale(0.97)" : hov ? "scale(1.02)" : "scale(1)",
        boxShadow: hov && !press ? "0 4px 14px rgba(59,130,246,0.25)" : "none",
        transition: "transform 0.12s, box-shadow 0.12s",
        opacity: disabled ? 0.6 : 1,
        ...extra,
      }}
    >
      {children}
    </button>
  );
}

/* ─── Tag chip ───────────────────────────────────────────────────────────── */
const TAG_COLORS = ["#EFF6FF","#F5F3FF","#FFF7ED","#F0FDF4","#FFF1F2","#ECFEFF"];
const TAG_TEXT   = ["#1D4ED8","#6D28D9","#C2410C","#15803D","#BE123C","#0E7490"];
function SkillChip({ name }) {
  const idx = (name?.charCodeAt(0) || 0) % TAG_COLORS.length;
  return (
    <span style={{
      display: "inline-block",
      background: TAG_COLORS[idx],
      color: TAG_TEXT[idx],
      padding: "3px 10px",
      borderRadius: 100,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {name}
    </span>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", animation: "popIn 0.4s ease both" }}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: "0 auto 16px" }}>
        <rect x="10" y="16" width="52" height="44" rx="8" fill="#E2E8F0" />
        <rect x="18" y="26" width="20" height="4" rx="2" fill="#94A3B8" />
        <rect x="18" y="34" width="36" height="4" rx="2" fill="#CBD5E1" />
        <rect x="18" y="42" width="28" height="4" rx="2" fill="#CBD5E1" />
        <circle cx="56" cy="16" r="10" fill="#DBEAFE" />
        <line x1="56" y1="11" x2="56" y2="21" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="51" y1="16" x2="61" y2="16" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>No skill tags yet.</p>
      <p style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>Use the form above to add your first skill tag.</p>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function SkillTags() {
  injectKeyframes();

  const user = getUser();
  const [skills, setSkills]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState("");
  const [newDesc, setNewDesc]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState("");
  const [toast, setToast]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // skill row pending delete confirmation

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("skills")
        .select("skill_id, name, description, created_by")
        .order("name");
      if (!cancelled) {
        if (error) showToast(error.message, "error");
        setSkills(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  async function handleAdd() {
    if (!newName.trim()) { showToast("Skill name is required.", "error"); return; }
    setAdding(true);
    const { data, error } = await supabase
      .from("skills")
      .insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        created_by: user?.user_id ?? null,
      })
      .select()
      .single();
    setAdding(false);
    if (error) {
      showToast(
        error.message.includes("unique") ? "A skill with that name already exists." : error.message,
        "error"
      );
      return;
    }
    setSkills(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewDesc("");
    showToast("Skill tag added.");
  }

  async function handleUpdate(id) {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("skills")
      .update({ name: editName.trim() })
      .eq("skill_id", id);
    if (error) { showToast(error.message, "error"); return; }
    setSkills(prev =>
      prev.map(s => s.skill_id === id ? { ...s, name: editName.trim() } : s)
    );
    setEditId(null);
    showToast("Skill tag updated.");
  }

  function handleDelete(id) {
    setDeleteTarget(skills.find(s => s.skill_id === id) || { skill_id: id });
  }

  async function confirmDelete() {
    const id = deleteTarget.skill_id;
    const { error } = await supabase.from("skills").delete().eq("skill_id", id);
    setDeleteTarget(null);
    if (error) { showToast("Cannot delete — skill may be in use.", "error"); return; }
    setSkills(prev => prev.filter(s => s.skill_id !== id));
    showToast("Skill tag deleted.");
  }

  return (
    <AdminLayout title="Skill Tags">
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: "#FFF", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", marginBottom: 8 }}>Delete skill tag?</h3>
            <p style={{ fontSize: 13.5, color: "#64748B", lineHeight: 1.6, marginBottom: 22 }}>
              <strong>{deleteTarget.name || "This skill"}</strong> will be removed from all assigned staff. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                style={{ background: "#F1F5F9", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#64748B", cursor: "pointer" }}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                style={{ background: "#EF4444", border: "none", borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer" }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Skill Tags
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{
                background: "#EFF6FF", color: "#3B82F6",
                padding: "2px 10px", borderRadius: 100,
                fontSize: 12, fontWeight: 600,
              }}>
                {skills.length} tag{skills.length !== 1 ? "s" : ""}
              </span>
              <span style={{ color: "#94A3B8", fontSize: 12 }}>used for staff and shift role matching</span>
            </div>
          </div>
        </div>

        {/* Add Form */}
        <div style={{
          background: "#FFFFFF", border: "1px solid #E2E8F0",
          borderRadius: 16, padding: 24, marginBottom: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          animation: "fadeSlideUp 0.3s 0.05s ease both",
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
            Add New Skill Tag
          </h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 160px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                Skill Name *
              </label>
              <FocusInput
                placeholder="e.g. Barista"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div style={{ flex: "2 1 220px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                Description (optional)
              </label>
              <FocusInput
                placeholder="Brief description of this skill…"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
            <ActionButton onClick={handleAdd} disabled={adding} style={{ flexShrink: 0 }}>
              {adding ? "Adding…" : "+ Add Tag"}
            </ActionButton>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 160px", gap: 12, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Skill Name", "Description", "Actions"].map(h => (
                <span key={h} style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{h}</span>
              ))}
            </div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : skills.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16 }}>
            <EmptyState />
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 160px", gap: 12, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Skill Name", "Description", "Actions"].map(h => (
                <span key={h} style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{h}</span>
              ))}
            </div>
            {skills.map(sk => (
              <HoverRow
                key={sk.skill_id}
                style={{ display: "grid", gridTemplateColumns: "2fr 3fr 160px", gap: 12, padding: "13px 20px", borderTop: "1px solid #E2E8F0", alignItems: "center", fontSize: 13 }}
              >
                {editId === sk.skill_id ? (
                  <>
                    <FocusInput
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleUpdate(sk.skill_id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      style={{ margin: 0 }}
                      autoFocus
                    />
                    <span style={{ color: "#64748B" }}>{sk.description || "—"}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <SmallButton variant="primary" onClick={() => handleUpdate(sk.skill_id)}>Save</SmallButton>
                      <SmallButton onClick={() => setEditId(null)}>Cancel</SmallButton>
                    </div>
                  </>
                ) : (
                  <>
                    <SkillChip name={sk.name} />
                    <span style={{ color: "#64748B" }}>{sk.description || <span style={{ color: "#CBD5E1" }}>—</span>}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <SmallButton onClick={() => { setEditId(sk.skill_id); setEditName(sk.name); }}>Edit</SmallButton>
                      <SmallButton variant="danger" onClick={() => handleDelete(sk.skill_id)}>Delete</SmallButton>
                    </div>
                  </>
                )}
              </HoverRow>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
