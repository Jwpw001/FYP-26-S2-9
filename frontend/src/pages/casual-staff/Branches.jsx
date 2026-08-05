import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { Building2, MapPin, Check, Clock, Search } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("casual-branches-styles")) {
  const style = document.createElement("style");
  style.id = "casual-branches-styles";
  style.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .cs-branch-row { transition: background 0.15s, border-color 0.15s; cursor: pointer; }
    .cs-branch-row:hover { background: #F8FAFC !important; }
    .cs-branch-row.selected:hover { background: #EFF6FF !important; }
  `;
  document.head.appendChild(style);
}

export default function CasualBranches() {
  const [branches, setBranches]     = useState([]);
  const [selected, setSelected]     = useState(new Set());
  const [approvalStatus, setApproval] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [search, setSearch]         = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/api/casual/my-branches"),
      api.get("/api/casual/preferences"),
    ]).then(([myBranches, prefs]) => {
      setBranches(myBranches?.branches || []);
      setApproval(myBranches?.approval_status || null);
      setSelected(new Set(prefs?.preferred_branch_ids || []));
    }).finally(() => setLoading(false));
  }, []);

  function toggle(branchId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/casual/preferences", { branch_ids: [...selected] });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const isPending = approvalStatus === "pending";
  const q = search.trim().toLowerCase();
  const filtered = branches.filter(b =>
    !q || b.name.toLowerCase().includes(q) || (b.address || "").toLowerCase().includes(q)
  );

  return (
    <CasualLayout title="Branches">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", letterSpacing: "-0.02em", margin: 0 }}>Preferred Branches</h2>
            <p style={{ fontSize: "21px", color: "#64748B", marginTop: "6px", maxWidth: "480px" }}>
              Select the branches you're available to work at. Managers will use this to assign you shifts.
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: saved
                ? "linear-gradient(135deg, #22C55E, #16A34A)"
                : "linear-gradient(135deg, #3B82F6, #2563EB)",
              color: "#fff", border: "none", padding: "13px 24px",
              borderRadius: "999px", fontSize: "21px", fontWeight: "700",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              boxShadow: saved
                ? "0 6px 16px rgba(34,197,94,0.4)"
                : "0 6px 16px rgba(37,99,235,0.4)",
              transition: "background 0.2s, box-shadow 0.2s",
            }}
          >
            {saved ? <><Check size={15} strokeWidth={3} /> Saved!</> : saving ? "Saving…" : "Save Preferences"}
          </button>
        </div>

        {/* Pending banner */}
        {isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px" }}>
            <Clock size={18} color="#D97706" />
            <p style={{ fontSize: "20px", color: "#92400E" }}>
              Your account is pending approval. You can still set your branch preferences now.
            </p>
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", margin: "24px 0 20px", maxWidth: "400px" }}>
          <Search size={16} style={{ position: "absolute", left: "16px", color: "#94A3B8", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search branches…"
            style={{ width: "100%", padding: "11px 16px 11px 44px", borderRadius: "999px", border: "1px solid #E2E8F0", fontSize: "21px", outline: "none", background: "#fff", color: "#1E293B", boxSizing: "border-box" }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: "80px", borderRadius: "18px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8" }}>
            <Building2 size={40} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "22px", fontWeight: "600" }}>No branches available yet.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {filtered.map(branch => {
                const isSelected = selected.has(branch.branch_id);
                return (
                  <div
                    key={branch.branch_id}
                    className={`cs-branch-row${isSelected ? " selected" : ""}`}
                    onClick={() => toggle(branch.branch_id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "20px",
                      padding: "22px 26px",
                      borderRadius: "18px",
                      border: `1.5px solid ${isSelected ? "#3B82F6" : "#E2E8F0"}`,
                      background: isSelected ? "#EFF6FF" : "#fff",
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: "52px", height: "52px", borderRadius: "15px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isSelected
                        ? "linear-gradient(135deg, #3B82F6, #2563EB)"
                        : "#F1F5F9",
                      transition: "background 0.15s",
                    }}>
                      <Building2 size={23} color={isSelected ? "#fff" : "#94A3B8"} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "22px", fontWeight: "700", color: isSelected ? "#1D4ED8" : "#1E293B", letterSpacing: "-0.01em" }}>
                        {branch.name}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "5px", flexWrap: "wrap" }}>
                        {branch.address && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "21px", color: "#64748B" }}>
                            <MapPin size={12} /> {branch.address}
                          </span>
                        )}
                        {(branch.open_time || branch.close_time) && (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "21px", color: "#64748B" }}>
                            <Clock size={12} /> {fmtTime(branch.open_time)} – {fmtTime(branch.close_time)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <div
                      style={{
                        width: "46px", height: "26px", flexShrink: 0,
                        borderRadius: "999px", position: "relative",
                        background: isSelected ? "#3B82F6" : "#D1D5DB",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: "#fff", position: "absolute",
                        top: "3px", left: isSelected ? "23px" : "3px",
                        transition: "left 0.15s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <p style={{ fontSize: "20px", color: "#64748B" }}>
              {selected.size === 0
                ? "No branches selected"
                : `${selected.size} of ${branches.length} branch${branches.length > 1 ? "es" : ""} selected`}
            </p>
          </>
        )}
      </div>
    </CasualLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}
