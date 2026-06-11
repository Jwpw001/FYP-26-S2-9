import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

/* ─── Keyframes ─────────────────────────────────────────────────────────── */
const injectKeyframes = () => {
  if (document.getElementById("sa-biz-kf")) return;
  const style = document.createElement("style");
  style.id = "sa-biz-kf";
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
const SHIMMER_BG =
  "linear-gradient(90deg,#f0f4f8 25%,#e2e8f0 50%,#f0f4f8 75%)";

function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12, padding: "14px 20px", borderTop: "1px solid #E2E8F0" }}>
      {[180, 260].map((w, i) => (
        <div key={i} style={{
          height: 14, borderRadius: 7, width: w,
          background: SHIMMER_BG,
          backgroundSize: "600px 100%",
          animation: "shimmer 1.4s infinite linear",
        }} />
      ))}
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

/* ─── ActionButton ───────────────────────────────────────────────────────── */
function ActionButton({ children, onClick, disabled, variant = "primary", style: extra = {} }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);

  const base = variant === "primary"
    ? { background: "#3B82F6", color: "#FFFFFF" }
    : { background: "#F1F5F9", color: "#0F172A", border: "1px solid #E2E8F0" };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        ...base,
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

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function Avatar({ letter }) {
  const idx = (letter?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: AVATAR_COLORS[idx], color: "#FFFFFF",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {letter?.toUpperCase() || "?"}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", animation: "popIn 0.4s ease both" }}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: "0 auto 16px" }}>
        <rect x="8" y="20" width="56" height="40" rx="6" fill="#E2E8F0" />
        <rect x="16" y="28" width="24" height="4" rx="2" fill="#94A3B8" />
        <rect x="16" y="36" width="40" height="4" rx="2" fill="#CBD5E1" />
        <rect x="16" y="44" width="32" height="4" rx="2" fill="#CBD5E1" />
        <rect x="20" y="8" width="32" height="16" rx="4" fill="#CBD5E1" />
        <rect x="28" y="12" width="16" height="4" rx="2" fill="#94A3B8" />
      </svg>
      <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>No businesses registered yet.</p>
      <p style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>Click "Register Business" to get started.</p>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function Businesses() {
  injectKeyframes();

  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showing, setShowing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  const [form, setForm]       = useState({ name: "", address: "" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("outlets")
        .select("outlet_id, name, address")
        .order("name");
      if (!cancelled) {
        if (error) showToast(error.message, "error");
        setOutlets(data || []);
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
    if (!form.name.trim()) { showToast("Business name is required.", "error"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("outlets")
      .insert({ name: form.name.trim(), address: form.address.trim() || null })
      .select()
      .single();
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setOutlets(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm({ name: "", address: "" });
    setShowing(false);
    showToast("Business registered successfully.");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <AdminLayout title="Businesses">
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}

      <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Registered Businesses
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{
                background: "#EFF6FF", color: "#3B82F6",
                padding: "2px 10px", borderRadius: 100,
                fontSize: 12, fontWeight: 600,
              }}>
                {outlets.length} outlet{outlets.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <ActionButton onClick={() => setShowing(s => !s)}>
            {showing ? "Cancel" : "+ Register Business"}
          </ActionButton>
        </div>

        {/* Add Form */}
        {showing && (
          <div style={{
            background: "#FFFFFF", border: "1px solid #E2E8F0",
            borderRadius: 16, padding: 24, marginBottom: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            animation: "fadeSlideUp 0.3s ease both",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>
              Register New Business
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
              <div style={{ animation: "fadeSlideUp 0.3s 0.05s ease both" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                  Business / Outlet Name *
                </label>
                <FocusInput
                  placeholder="e.g. The Coffee Club Orchard"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              </div>
              <div style={{ animation: "fadeSlideUp 0.3s 0.10s ease both" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                  Address
                </label>
                <FocusInput
                  placeholder="e.g. 176 Orchard Road, Singapore 238843"
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
            <ActionButton onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Register Business"}
            </ActionButton>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Business Name", "Address"].map(h => (
                <span key={h} style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{h}</span>
              ))}
            </div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : outlets.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16 }}>
            <EmptyState />
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Business Name", "Address"].map(h => (
                <span key={h} style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{h}</span>
              ))}
            </div>
            {outlets.map(o => (
              <HoverRow
                key={o.outlet_id}
                style={{ display: "grid", gridTemplateColumns: "2fr 3fr", gap: 12, padding: "13px 20px", borderTop: "1px solid #E2E8F0", alignItems: "center", fontSize: 13 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar letter={o.name?.[0]} />
                  <span style={{ fontWeight: 600, color: "#0F172A" }}>{o.name}</span>
                </div>
                <span style={{ color: "#64748B" }}>{o.address || <span style={{ color: "#CBD5E1" }}>Not set</span>}</span>
              </HoverRow>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
