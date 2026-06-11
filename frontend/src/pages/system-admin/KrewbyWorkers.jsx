import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

/* ─── Keyframes ─────────────────────────────────────────────────────────── */
const injectKeyframes = () => {
  if (document.getElementById("sa-kw-kf")) return;
  const style = document.createElement("style");
  style.id = "sa-kw-kf";
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
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 2fr 0.8fr 0.6fr 1.5fr 1fr 100px",
      gap: 8, padding: "14px 20px", borderTop: "1px solid #E2E8F0", alignItems: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />
        <div style={{ height: 13, width: 100, borderRadius: 6, background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
      </div>
      {[140, 50, 30, 90, 50, 70].map((w, i) => (
        <div key={i} style={{ height: 13, width: w, borderRadius: 6, background: SHIMMER_BG, backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
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

/* ─── ToggleButton ───────────────────────────────────────────────────────── */
function ToggleButton({ active, onClick }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        background: active ? "#FEF2F2" : "#F0FDF4",
        color: active ? "#991B1B" : "#166534",
        border: `1px solid ${active ? "#FECACA" : "#BBF7D0"}`,
        padding: "5px 10px", borderRadius: 8,
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        transform: press ? "scale(0.97)" : hov ? "scale(1.02)" : "scale(1)",
        boxShadow: hov && !press ? "0 2px 8px rgba(0,0,0,0.10)" : "none",
        transition: "transform 0.12s, box-shadow 0.12s",
      }}
    >
      {active ? "Deactivate" : "Activate"}
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

/* ─── StarRating ─────────────────────────────────────────────────────────── */
function StarRating({ value }) {
  const rating = Number(value || 5);
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = i <= full || (i === full + 1 && half);
        return (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "none"} stroke={filled ? "#F59E0B" : "#CBD5E1"} strokeWidth="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
        );
      })}
      <span style={{ color: "#64748B", fontSize: 11, marginLeft: 3 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyState({ search }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", animation: "popIn 0.4s ease both" }}>
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ margin: "0 auto 16px" }}>
        <circle cx="36" cy="28" r="16" fill="#E2E8F0" />
        <circle cx="36" cy="24" r="9" fill="#CBD5E1" />
        <path d="M12 60c0-13.25 10.75-24 24-24s24 10.75 24 24" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" fill="none" />
        {search && (
          <>
            <circle cx="56" cy="14" r="9" fill="#FEF2F2" stroke="#FECACA" strokeWidth="1.5" />
            <line x1="53" y1="14" x2="59" y2="14" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </>
        )}
      </svg>
      <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>
        {search ? `No workers match "${search}".` : "No Krewby Workers yet."}
      </p>
      <p style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
        {search ? "Try a different search term." : "Click \"Add Krewby Worker\" to get started."}
      </p>
    </div>
  );
}

/* ─── Merge workers with users using flat data ───────────────────────────── */
function mergeWorkersWithUsers(workers, usersMap) {
  return workers.map(w => ({
    ...w,
    user: usersMap[w.user_id] || null,
  }));
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function KrewbyWorkers() {
  injectKeyframes();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [showing, setShowing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  const [form, setForm]       = useState({
    full_name: "", email: "", username: "", preferred_location: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Flat queries — no nested joins
      const { data: workerRows, error: workerErr } = await supabase
        .from("krewby_workers")
        .select("krewby_worker_id, user_id, preferred_location, rating, total_jobs, is_active")
        .order("krewby_worker_id");

      if (workerErr) {
        if (!cancelled) { showToast(workerErr.message, "error"); setLoading(false); }
        return;
      }

      const userIds = [...new Set((workerRows || []).map(w => w.user_id))];
      let usersMap = {};

      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        (userRows || []).forEach(u => { usersMap[u.user_id] = u; });
      }

      if (!cancelled) {
        setWorkers(mergeWorkersWithUsers(workerRows || [], usersMap));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  async function toggleActive(workerId, current) {
    const { error } = await supabase
      .from("krewby_workers")
      .update({ is_active: !current })
      .eq("krewby_worker_id", workerId);
    if (error) { showToast(error.message, "error"); return; }
    setWorkers(prev => prev.map(w =>
      w.krewby_worker_id === workerId ? { ...w, is_active: !current } : w
    ));
  }

  async function handleAdd() {
    if (!form.full_name.trim()) { showToast("Full name is required.", "error"); return; }
    if (!form.email.trim())     { showToast("Email is required.", "error"); return; }
    if (!form.username.trim())  { showToast("Username is required.", "error"); return; }

    setSaving(true);
    try {
      // Step 1: Insert into users table
      const { data: userData, error: userErr } = await supabase
        .from("users")
        .insert({
          full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(),
          username: form.username.trim(),
          role: "krewby_casual_worker",
        })
        .select("user_id, full_name, email")
        .single();

      if (userErr) {
        showToast(
          userErr.message.includes("unique") ? "Email or username already exists." : userErr.message,
          "error"
        );
        return;
      }

      // Step 2: Insert into krewby_workers table
      const { data: workerData, error: workerErr } = await supabase
        .from("krewby_workers")
        .insert({
          user_id: userData.user_id,
          preferred_location: form.preferred_location.trim() || null,
          rating: 5.0,
          total_jobs: 0,
          is_active: true,
        })
        .select("krewby_worker_id, user_id, preferred_location, rating, total_jobs, is_active")
        .single();

      if (workerErr) { showToast(workerErr.message, "error"); return; }

      setWorkers(prev => [...prev, { ...workerData, user: userData }]);
      setForm({ full_name: "", email: "", username: "", preferred_location: "" });
      setShowing(false);
      showToast("Krewby Worker added successfully.");
    } catch {
      showToast("Failed to add worker.", "error");
    } finally {
      setSaving(false);
    }
  }

  const filtered = workers.filter(w => {
    const q = search.toLowerCase();
    return (w.user?.full_name?.toLowerCase() || "").includes(q) ||
           (w.user?.email?.toLowerCase() || "").includes(q);
  });

  const activeCount = workers.filter(w => w.is_active).length;

  return (
    <AdminLayout title="Krewby Workers">
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}

      <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Krewby Workers
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{
                background: "#F0FDF4", color: "#166534",
                padding: "2px 10px", borderRadius: 100,
                fontSize: 12, fontWeight: 600,
              }}>
                {activeCount} active
              </span>
              <span style={{
                background: "#F8FAFC", color: "#64748B",
                padding: "2px 10px", borderRadius: 100,
                fontSize: 12, fontWeight: 600,
              }}>
                {workers.length} total
              </span>
            </div>
          </div>
          <ActionButton onClick={() => setShowing(s => !s)}>
            {showing ? "Cancel" : "+ Add Krewby Worker"}
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
              Add New Krewby Worker
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, animation: "fadeSlideUp 0.3s 0.05s ease both" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Full Name *</label>
                  <FocusInput
                    placeholder="e.g. John Tan"
                    value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Username *</label>
                  <FocusInput
                    placeholder="e.g. john_worker"
                    value={form.username}
                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, animation: "fadeSlideUp 0.3s 0.10s ease both" }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Email *</label>
                  <FocusInput
                    type="email"
                    placeholder="e.g. john@gmail.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>Preferred Location</label>
                  <FocusInput
                    placeholder="e.g. Central Singapore"
                    value={form.preferred_location}
                    onChange={e => setForm(p => ({ ...p, preferred_location: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <ActionButton onClick={handleAdd} disabled={saving}>
              {saving ? "Adding…" : "Add Worker"}
            </ActionButton>
          </div>
        )}

        {/* Search bar */}
        <div style={{ position: "relative", maxWidth: 360, marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <FocusInput
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 0.8fr 0.6fr 1.5fr 1fr 100px", gap: 8, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Name", "Email", "Rating", "Jobs", "Location", "Status", ""].map((h, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{h}</span>
              ))}
            </div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16 }}>
            <EmptyState search={search} />
          </div>
        ) : (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 0.8fr 0.6fr 1.5fr 1fr 100px", gap: 8, padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Name", "Email", "Rating", "Jobs", "Location", "Status", ""].map((h, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{h}</span>
              ))}
            </div>
            {filtered.map(w => (
              <HoverRow
                key={w.krewby_worker_id}
                style={{ display: "grid", gridTemplateColumns: "2fr 2fr 0.8fr 0.6fr 1.5fr 1fr 100px", gap: 8, padding: "13px 20px", borderTop: "1px solid #E2E8F0", alignItems: "center", fontSize: 13 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                  <Avatar letter={w.user?.full_name?.[0]} />
                  <span style={{ fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.user?.full_name || "—"}
                  </span>
                </div>
                <span style={{ color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.user?.email || "—"}
                </span>
                <StarRating value={w.rating} />
                <span style={{ color: "#64748B", fontWeight: 600 }}>{w.total_jobs || 0}</span>
                <span style={{ color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.preferred_location || <span style={{ color: "#CBD5E1" }}>—</span>}
                </span>
                <span style={{
                  display: "inline-block",
                  background: w.is_active ? "#DCFCE7" : "#F1F5F9",
                  color: w.is_active ? "#166534" : "#64748B",
                  padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                }}>
                  {w.is_active ? "Active" : "Inactive"}
                </span>
                <ToggleButton active={w.is_active} onClick={() => toggleActive(w.krewby_worker_id, w.is_active)} />
              </HoverRow>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
