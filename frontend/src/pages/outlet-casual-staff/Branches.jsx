import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { Building2, MapPin, Check, Clock } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("casual-branches-styles")) {
  const style = document.createElement("style");
  style.id = "casual-branches-styles";
  style.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
  `;
  document.head.appendChild(style);
}

export default function CasualBranches() {
  const [outlets, setOutlets]         = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [approvalStatus, setApproval] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/api/casual/my-outlets"),
      api.get("/api/casual/preferences"),
    ]).then(([myOutlets, prefs]) => {
      setOutlets(myOutlets?.outlets || []);
      setApproval(myOutlets?.approval_status || null);
      setSelected(new Set(prefs?.preferred_outlet_ids || []));
    }).finally(() => setLoading(false));
  }, []);

  function toggle(outletId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(outletId)) next.delete(outletId);
      else next.add(outletId);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/casual/preferences", { outlet_ids: [...selected] });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const isPending = approvalStatus === "pending";

  return (
    <CasualLayout title="Branches">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Preferred Branches</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
              Select the branches you're available to work at. Managers will use this to assign you shifts.
            </p>
          </div>
          <button onClick={save} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: saved ? "#22C55E" : "#2563EB", color: "#FFF", border: "none", borderRadius: "10px", padding: "10px 22px", fontSize: "14px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "background 0.2s" }}>
            {saved ? <><Check size={15} strokeWidth={3} /> Saved!</> : saving ? "Saving…" : "Save Preferences"}
          </button>
        </div>

        {isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px" }}>
            <Clock size={18} color="#D97706" />
            <p style={{ fontSize: "13px", color: "#92400E" }}>
              Your account is pending approval. You can still set your branch preferences now.
            </p>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: "64px", borderRadius: "12px", background: "#F1F5F9", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94A3B8" }}>
            <Building2 size={36} style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px" }}>No branches available yet.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {outlets.map(outlet => {
                const isSelected = selected.has(outlet.branch_id);
                return (
                  <button key={outlet.branch_id} onClick={() => toggle(outlet.branch_id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      background: isSelected ? "#EFF6FF" : "#FFF",
                      border: `2px solid ${isSelected ? "#2563EB" : "#E2E8F0"}`,
                      borderRadius: "14px", padding: "16px 18px",
                      cursor: "pointer", textAlign: "left", width: "100%",
                      transition: "all 0.15s",
                    }}>
                    {/* Icon */}
                    <div style={{
                      width: "42px", height: "42px", borderRadius: "11px", flexShrink: 0,
                      background: isSelected ? "#DBEAFE" : "#F8FAFC",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.15s",
                    }}>
                      <Building2 size={18} color={isSelected ? "#2563EB" : "#94A3B8"} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: isSelected ? "#1E40AF" : "#1E293B" }}>
                        {outlet.name}
                      </p>
                      {outlet.address && (
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                          <MapPin size={11} color="#94A3B8" />
                          <p style={{ fontSize: "12px", color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {outlet.address}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Checkmark */}
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? "#2563EB" : "#F1F5F9",
                      border: `2px solid ${isSelected ? "#2563EB" : "#E2E8F0"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s",
                    }}>
                      {isSelected && <Check size={13} color="#FFF" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
              <p style={{ fontSize: "13px", color: "#64748B" }}>
                {selected.size === 0 ? "No branches selected" : `${selected.size} of ${outlets.length} branch${outlets.length > 1 ? "es" : ""} selected`}
              </p>
            </div>
          </>
        )}
      </div>
    </CasualLayout>
  );
}
