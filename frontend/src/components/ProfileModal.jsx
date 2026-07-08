import { useState, useEffect } from "react";
import { X, Mail, Calendar, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { getUser, setUser } from "../utils/auth";

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function roleLabel(role) {
  if (!role) return "—";
  return role.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const inputStyle = { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

function Field({ label, children }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{label}</p>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <div style={{ marginTop: 1 }}>{icon}</div>
      <div>
        <p style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ProfileModal({ onClose }) {
  const cached = getUser();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/account").then(r => {
      setAccount(r.user);
      setForm({ full_name: r.user.full_name || "", email: r.user.email || "" });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Name is required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await api.patch("/api/account", { full_name: form.full_name.trim(), email: form.email.trim() });
      setAccount(r.user);
      setUser({ ...cached, full_name: r.user.full_name, email: r.user.email });
      setEditing(false);
    } catch (e) { setError(e.message || "Failed to update account."); }
    finally { setSaving(false); }
  }

  const name = account?.full_name || cached?.full_name || "";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "400px", maxWidth: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A" }}>My Profile</h3>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
        </div>

        {loading ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>Loading…</div>
        ) : (
          <>
            <div style={{ padding: "16px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: avatarColor(name), color: "#fff", fontSize: 24, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {name[0]?.toUpperCase() || "?"}
              </div>
              {!editing && <p style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A" }}>{name}</p>}
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6", background: "#EFF6FF", padding: "3px 10px", borderRadius: "99px" }}>{roleLabel(account?.role)}</span>
            </div>

            <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {editing ? (
                <>
                  <Field label="Full Name">
                    <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                  </Field>
                  {error && <p style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600", margin: 0 }}>{error}</p>}
                </>
              ) : (
                <>
                  <InfoRow icon={<Mail size={15} color="#64748B" />} label="Email" value={account?.email} />
                  <InfoRow icon={<Calendar size={15} color="#64748B" />} label="Member Since" value={account?.created_at ? new Date(account.created_at).toLocaleDateString("en-SG", { month: "long", year: "numeric" }) : "—"} />
                </>
              )}
            </div>

            <div style={{ padding: "0 24px 24px", display: "flex", gap: "8px" }}>
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setForm({ full_name: account.full_name, email: account.email }); setError(""); }}
                    style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: saving ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px", borderRadius: "10px", border: "none", background: "#2563EB", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>
                  <Pencil size={14} /> Edit Profile
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
