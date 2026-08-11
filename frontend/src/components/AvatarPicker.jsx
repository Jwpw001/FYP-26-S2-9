import { useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "../lib/api";
import { getUser, setUser } from "../utils/auth";

// Just the avatar-picking piece of the old ProfileModal — name/email editing was removed
// entirely, but picking a preset picture is a separate, lighter interaction worth keeping.
const AVATAR_OPTIONS = [
  "/avatars/default.png",
  "/avatars/avatar1.png",
  "/avatars/avatar2.png",
  "/avatars/avatar3.png",
  "/avatars/avatar4.png",
  "/avatars/avatar5.png",
  "/avatars/avatar6.png",
  "/avatars/avatar7.png",
  "/avatars/avatar8.png",
  "/avatars/avatar9.png",
];

export default function AvatarPicker({ currentAvatar, onClose }) {
  const [pending, setPending] = useState(currentAvatar || "/avatars/default.png");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function save() {
    if (pending === currentAvatar) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      const r = await api.patch("/api/account", { avatar_url: pending });
      const cached = getUser();
      setUser({ ...cached, avatar_url: r.user.avatar_url });
      onClose();
    } catch {
      setError("Failed to save avatar. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "18px", padding: "22px", width: "100%", maxWidth: "340px", boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B", margin: 0 }}>Choose your avatar</h3>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", display: "flex" }}>
            <X size={15} color="#64748B" />
          </button>
        </div>

        {error && <p style={{ fontSize: "16px", color: "#DC2626", fontWeight: "600", marginBottom: "10px" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "18px" }}>
          {AVATAR_OPTIONS.map(src => {
            const selected = pending === src;
            return (
              <button key={src} type="button" onClick={() => setPending(src)}
                style={{
                  position: "relative", padding: 0, borderRadius: "50%", cursor: "pointer",
                  border: `2.5px solid ${selected ? "#2563EB" : "transparent"}`,
                  background: "none", lineHeight: 0,
                }}>
                <img src={src} alt="avatar option" style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", objectFit: "cover", display: "block" }} />
                {selected && (
                  <span style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "16px", height: "16px", borderRadius: "50%", background: "#2563EB", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={9} color="#fff" strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: saving ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: saving ? "default" : "pointer" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
