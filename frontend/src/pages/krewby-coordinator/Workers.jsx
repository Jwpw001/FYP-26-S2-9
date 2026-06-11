import { useState, useEffect, useRef, forwardRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

if (typeof document !== "undefined" && !document.getElementById("coord-workers-styles")) {
  const style = document.createElement("style");
  style.id = "coord-workers-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .worker-card:hover { border-color: #BAE6FD !important; box-shadow: 0 4px 14px rgba(59,130,246,0.1) !important; }
    @keyframes panelIn {
      from { opacity: 0; transform: translateX(40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
  );
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const EMPTY_FORM = { full_name: "", email: "", username: "", password: "", preferred_location: "" };

export default function CoordinatorWorkers() {
  const [workers, setWorkers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all");
  const [toast, setToast]       = useState(null);
  const [toggling, setToggling] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const firstFieldRef             = useRef(null);

  useEffect(() => {
    if (showPanel) {
      setForm(EMPTY_FORM);
      setTimeout(() => firstFieldRef.current?.focus(), 80);
    }
  }, [showPanel]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const result = await api.get("/api/auth/krewby-workers");
        if (!cancelled) setWorkers(result.workers || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function toggleActive(workerId, current) {
    setToggling(workerId);
    const { error } = await supabase
      .from("krewby_workers")
      .update({ is_active: !current })
      .eq("krewby_worker_id", workerId);
    if (error) { showToast(error.message, "error"); }
    else {
      setWorkers(prev => prev.map(w => w.krewby_worker_id === workerId ? { ...w, is_active: !current } : w));
      showToast(!current ? "Worker activated." : "Worker deactivated.");
    }
    setToggling(null);
  }

  async function handleAdd() {
    if (!form.full_name.trim()) { showToast("Full name is required.", "error"); return; }
    if (!form.email.trim())     { showToast("Email is required.", "error"); return; }
    if (!form.username.trim())  { showToast("Username is required.", "error"); return; }
    if (!form.password.trim())  { showToast("Password is required.", "error"); return; }
    if (form.password.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }
    setSaving(true);
    try {
      const result = await api.post("/api/auth/create-worker", {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        password: form.password,
        preferred_location: form.preferred_location.trim() || null,
      });
      setWorkers(prev => [...prev, result.worker]);
      setForm(EMPTY_FORM);
      setShowPanel(false);
      showToast("Worker added successfully.");
    } catch (err) {
      showToast(err.message || "Failed to add worker.", "error");
    } finally {
      setSaving(false);
    }
  }

  const filtered = workers.filter(w => {
    const name  = w.user?.full_name || w.user?.email || "";
    const email = w.user?.email || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "active" && w.is_active) || (filter === "inactive" && !w.is_active);
    return matchSearch && matchFilter;
  });

  const activeCount   = workers.filter(w => w.is_active).length;
  const inactiveCount = workers.length - activeCount;

  return (
    <CoordinatorLayout title="Workers">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Krewby Workers</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${workers.length} total`}
            </p>
          </div>
          <button onClick={() => { setShowPanel(true); setForm(EMPTY_FORM); setSearch(""); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", background: "#3B82F6", color: "#FFF", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            + Add Worker
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
          {[
            { value: "all",      label: `All (${workers.length})` },
            { value: "active",   label: `Active (${activeCount})` },
            { value: "inactive", label: `Inactive (${inactiveCount})` },
          ].map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFFFFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", color: "#1E293B", background: "#FFF", outline: "none", marginBottom: "20px", boxSizing: "border-box" }}
        />

        {/* Workers grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "14px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="65%" h="14px" r="6px" />
                    <div style={{ marginTop: "7px" }}><Shimmer w="80%" h="11px" r="5px" /></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Shimmer w="60px" h="22px" r="100px" />
                  <Shimmer w="80px" h="22px" r="100px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>👷</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No workers found</p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "14px" }}>
            {filtered.map((w, i) => {
              const name  = w.user?.full_name || w.user?.email || "Unknown";
              const email = w.user?.email || "";
              const color = avatarColor(name);
              return (
                <div key={w.krewby_worker_id}
                  className="worker-card"
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.18s", animation: `fadeSlideUp 0.3s ease ${Math.min(i, 12) * 0.04}s both` }}>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "700", flexShrink: 0 }}>
                      {name[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      <p style={{ fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: "16px", marginBottom: "14px", padding: "10px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <p style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B" }}>{w.total_jobs ?? 0}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Jobs</p>
                    </div>
                    <div style={{ width: "1px", background: "#F1F5F9" }} />
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <p style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B" }}>{w.rating ? Number(w.rating).toFixed(1) : "—"}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Rating</p>
                    </div>
                    {w.preferred_location && (
                      <>
                        <div style={{ width: "1px", background: "#F1F5F9" }} />
                        <div style={{ textAlign: "center", flex: 2 }}>
                          <p style={{ fontSize: "12px", fontWeight: "600", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.preferred_location}</p>
                          <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Preferred area</p>
                        </div>
                      </>
                    )}
                  </div>


                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: w.is_active ? "#DCFCE7" : "#F1F5F9", color: w.is_active ? "#166534" : "#64748B" }}>
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => toggleActive(w.krewby_worker_id, w.is_active)}
                      disabled={toggling === w.krewby_worker_id}
                      style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", cursor: "pointer", opacity: toggling === w.krewby_worker_id ? 0.5 : 1, transition: "all 0.15s" }}>
                      {toggling === w.krewby_worker_id ? "…" : w.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "20px" }}>
            Showing {filtered.length} of {workers.length} workers
          </p>
        )}

      </div>

      {/* Add Worker panel — rendered via portal so it escapes layout stacking contexts */}
      {showPanel && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", justifyContent: "flex-end" }}>
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          {/* Panel */}
          <div style={{ position: "relative", width: "400px", maxWidth: "95vw", height: "100vh", background: "#FFF", boxShadow: "-4px 0 32px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column", animation: "panelIn 0.25s ease both" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>Add Krewby Worker</h3>
              <button onClick={() => setShowPanel(false)}
                style={{ background: "none", border: "none", fontSize: "22px", color: "#94A3B8", cursor: "pointer", lineHeight: 1, width: "32px", height: "32px" }}>×</button>
            </div>
            <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: "18px", overflowY: "auto" }}>
              <PortalField ref={firstFieldRef} label="Full Name *" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="e.g. John Doe" />
              <PortalField label="Email *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="e.g. john@email.com" />
              <PortalField label="Username *" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="e.g. johndoe" />
              <PortalPasswordField label="Password *" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Min. 6 characters" />
              <PortalField label="Preferred Location" value={form.preferred_location} onChange={v => setForm(f => ({ ...f, preferred_location: v }))} placeholder="e.g. Central Singapore" />
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "-6px" }}>
                Default rating: 5.0 · Default jobs: 0 · Status: Active
              </p>
            </div>
            <div style={{ padding: "20px 24px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "10px" }}>
              <button onClick={() => setShowPanel(false)} disabled={saving}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving}
                style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: saving ? "#93C5FD" : "#3B82F6", color: "#FFF", fontSize: "14px", fontWeight: "600", cursor: saving ? "default" : "pointer" }}>
                {saving ? "Adding…" : "Add Worker"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </CoordinatorLayout>
  );
}

const PortalField = forwardRef(function PortalField({ label, value, onChange, placeholder, type = "text", autoComplete = "off" }, ref) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{label}</label>
      <input
        ref={ref} type={type} value={value} placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={e => onChange(e.target.value)}
        style={{ padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FAFAFA", width: "100%", boxSizing: "border-box" }}
      />
    </div>
  );
});

function PortalPasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"} value={value} placeholder={placeholder}
          autoComplete="new-password"
          onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "10px 52px 10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FAFAFA", boxSizing: "border-box" }}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748B", fontSize: "12px", fontWeight: "600" }}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", autoFocus }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        style={{ padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FAFAFA" }}
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "10px 40px 10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FAFAFA", boxSizing: "border-box" }}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "13px", padding: "2px" }}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
