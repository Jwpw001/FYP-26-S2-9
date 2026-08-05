import { useState, useEffect } from "react";
import { X, Mail, Calendar, Pencil, Sparkles, ChevronLeft, Star, Award, Camera } from "lucide-react";
import { api } from "../lib/api";
import { getUser, setUser } from "../utils/auth";

if (typeof document !== "undefined" && !document.getElementById("profile-modal-styles")) {
  const s = document.createElement("style");
  s.id = "profile-modal-styles";
  s.textContent = `
    @keyframes pm-backdrop-in  { from { opacity:0 } to { opacity:1 } }
    @keyframes pm-card-in      { from { opacity:0; transform:scale(0.94) translateY(12px) } to { opacity:1; transform:scale(1) translateY(0) } }
    @keyframes pm-slide-right  { from { opacity:0; transform:translateX(28px) } to { opacity:1; transform:translateX(0) } }
    @keyframes pm-slide-left   { from { opacity:0; transform:translateX(-28px) } to { opacity:1; transform:translateX(0) } }
    @keyframes pm-fade-up      { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
    @keyframes pm-shimmer      { from { background-position:-400px 0 } to { background-position:400px 0 } }
    @keyframes pm-spin         { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }

    .pm-backdrop { animation: pm-backdrop-in 0.2s ease both }
    .pm-card     { animation: pm-card-in 0.28s cubic-bezier(0.34,1.2,0.64,1) both }
    .pm-view-profile { animation: pm-slide-left  0.26s cubic-bezier(0.25,1,0.5,1) both }
    .pm-view-skills  { animation: pm-slide-right 0.26s cubic-bezier(0.25,1,0.5,1) both }

    .pm-btn {
      transition: transform 0.13s ease, box-shadow 0.13s ease, background 0.15s ease, opacity 0.15s ease;
    }
    .pm-btn:hover  { transform: translateY(-1px); }
    .pm-btn:active { transform: translateY(0) scale(0.97); }

    .pm-close-btn {
      transition: background 0.15s ease, transform 0.13s ease;
    }
    .pm-close-btn:hover  { background: rgba(255,255,255,0.4) !important; transform: rotate(90deg); }

    .pm-back-btn {
      transition: background 0.15s ease, transform 0.13s ease;
    }
    .pm-back-btn:hover  { background: #E2E8F0 !important; transform: translateX(-2px); }

    .pm-skills-nav {
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.13s ease, box-shadow 0.13s ease;
    }
    .pm-skills-nav:hover {
      background: #E0E7FF !important;
      border-color: #A5B4FC !important;
      transform: translateX(2px);
      box-shadow: 0 2px 8px rgba(99,102,241,0.15);
    }
    .pm-skills-nav:active { transform: translateX(0) scale(0.98); }

    .pm-skill-card {
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .pm-skill-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(0,0,0,0.08);
    }

    .pm-edit-btn {
      transition: background 0.15s ease, transform 0.13s ease, box-shadow 0.15s ease;
    }
    .pm-edit-btn:hover {
      background: #1D4ED8 !important;
      box-shadow: 0 4px 16px rgba(37,99,235,0.35);
      transform: translateY(-1px);
    }
    .pm-edit-btn:active { transform: scale(0.97); }

    .pm-save-btn {
      transition: background 0.15s ease, transform 0.13s ease, box-shadow 0.15s ease;
    }
    .pm-save-btn:not(:disabled):hover {
      background: #1D4ED8 !important;
      box-shadow: 0 4px 16px rgba(37,99,235,0.35);
      transform: translateY(-1px);
    }
    .pm-save-btn:not(:disabled):active { transform: scale(0.97); }

    .pm-input:focus {
      border-color: #6366F1 !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
    }

    .pm-shimmer {
      background: linear-gradient(90deg,#F1F5F9 25%,#E8EDF4 50%,#F1F5F9 75%);
      background-size: 400px 100%;
      animation: pm-shimmer 1.3s infinite linear;
      border-radius: 6px;
    }

    .pm-fade-item { animation: pm-fade-up 0.22s ease both; }

    .pm-avatar-opt {
      border: 2.5px solid transparent;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .pm-avatar-opt:hover {
      transform: scale(1.08);
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    }
    .pm-avatar-opt.selected {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.25);
    }

    .pm-cam-btn {
      transition: background 0.15s ease, transform 0.13s ease;
    }
    .pm-cam-btn:hover { background: rgba(0,0,0,0.6) !important; transform: scale(1.05); }
  `;
  document.head.appendChild(s);
}

const AVATARS = [
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

function roleLabel(role) {
  if (!role) return "—";
  return role.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

const EXP = {
  junior:       { bar: "#3B82F6", badge: "#DBEAFE", badgeText: "#1D4ED8", label: "Junior" },
  intermediate: { bar: "#F59E0B", badge: "#FEF3C7", badgeText: "#92400E", label: "Intermediate" },
  senior:       { bar: "#22C55E", badge: "#DCFCE7", badgeText: "#15803D", label: "Senior" },
  lead:         { bar: "#8B5CF6", badge: "#EDE9FE", badgeText: "#6D28D9", label: "Lead" },
};
const EXP_DEFAULT = { bar: "#CBD5E1", badge: "#F1F5F9", badgeText: "#94A3B8", label: "No level set" };

function SkillsPanel({ onBack }) {
  const [skills, setSkills]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/account/skills")
      .then(r => setSkills(r.skills || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pm-view-skills" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 20px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #F1F5F9", background: "linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%)" }}>
        <button onClick={onBack} className="pm-back-btn" style={{ background: "rgba(255,255,255,0.8)", border: "1.5px solid #E0E7FF", borderRadius: "9px", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <ChevronLeft size={16} color="#6366F1" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
            <Sparkles size={13} color="#fff" />
          </div>
          <span style={{ fontSize: "15px", fontWeight: "800", color: "#1E1B4B", letterSpacing: "-0.2px" }}>My Skills</span>
        </div>
        {!loading && skills.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "700", color: "#6366F1", background: "#EEF2FF", border: "1px solid #C7D2FE", padding: "2px 8px", borderRadius: "99px" }}>{skills.length} assigned</span>
        )}
      </div>
      <div style={{ padding: "16px 20px 22px", overflowY: "auto", maxHeight: "380px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1,2,3].map(i => <div key={i} className="pm-shimmer" style={{ height: "58px", borderRadius: "12px", animationDelay: `${i*0.07}s` }} />)}
          </div>
        ) : skills.length === 0 ? (
          <div style={{ textAlign: "center", padding: "44px 0 30px" }} className="pm-fade-item">
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F8FAFC", border: "2px dashed #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Star size={22} color="#CBD5E1" />
            </div>
            <p style={{ fontSize: "14px", fontWeight: "700", color: "#94A3B8", marginBottom: "5px" }}>No skills yet</p>
            <p style={{ fontSize: "12px", color: "#CBD5E1", lineHeight: 1.5, maxWidth: "200px", margin: "0 auto" }}>Your manager will assign skills to your profile.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {skills.map((s, i) => {
              const cfg = EXP[s.experience_level?.toLowerCase()] || EXP_DEFAULT;
              return (
                <div key={i} className="pm-skill-card pm-fade-item" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", background: "#FFFFFF", border: "1.5px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", animationDelay: `${i * 0.05}s`, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: cfg.bar, borderRadius: "0 2px 2px 0" }} />
                  <div style={{ width: 34, height: 34, borderRadius: "9px", flexShrink: 0, background: cfg.badge, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Award size={15} color={cfg.bar} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                    {s.years_of_experience != null && (
                      <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "500" }}>{s.years_of_experience} yr{s.years_of_experience !== 1 ? "s" : ""} experience</p>
                    )}
                  </div>
                  {s.experience_level && (
                    <span style={{ fontSize: "10px", fontWeight: "700", color: cfg.badgeText, background: cfg.badge, padding: "3px 9px", borderRadius: "99px", textTransform: "capitalize", whiteSpace: "nowrap", flexShrink: 0 }}>{cfg.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfileModal({ onClose }) {
  const cached  = getUser();
  const [account,       setAccount]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [editing,       setEditing]       = useState(false);
  const [showSkills,    setShowSkills]    = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [form,          setForm]          = useState({ full_name: "", email: "" });
  const [saving,        setSaving]        = useState(false);
  const [savingAvatar,  setSavingAvatar]  = useState(false);
  const [error,         setError]         = useState("");
  const [avatarError,   setAvatarError]   = useState("");
  const [pendingAvatar, setPendingAvatar] = useState(null);

  useEffect(() => {
    api.get("/api/account").then(r => {
      setAccount(r.user);
      setForm({ full_name: r.user.full_name || "", email: r.user.email || "" });
    }).catch(err => {
      console.error("[ProfileModal] /api/account failed:", err?.message || err);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Name is required."); return; }
    if (!form.email.trim())     { setError("Email is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await api.patch("/api/account", { full_name: form.full_name.trim(), email: form.email.trim() });
      setAccount(r.user);
      setUser({ ...cached, full_name: r.user.full_name, email: r.user.email });
      setEditing(false);
    } catch (e) { setError(e.message || "Failed to update account."); }
    finally { setSaving(false); }
  }

  async function handleAvatarSave() {
    if (!pendingAvatar || pendingAvatar === account?.avatar_url) {
      setShowAvatarPicker(false);
      setPendingAvatar(null);
      return;
    }
    setSavingAvatar(true);
    try {
      const r = await api.patch("/api/account", { avatar_url: pendingAvatar });
      setAccount(r.user);
      setUser({ ...cached, avatar_url: r.user.avatar_url });
      setShowAvatarPicker(false);
      setPendingAvatar(null);
    } catch (e) {
      setAvatarError("Failed to save avatar. Please try again.");
    } finally {
      setSavingAvatar(false);
    }
  }

  const name      = account?.full_name || cached?.full_name || "";
  const avatarSrc = account?.avatar_url || "/avatars/default.png";
  const isStaff   = ["regular_staff", "casual_staff", "krewby_casual_worker"].includes(account?.role);

  return (
    <div
      className="pm-backdrop"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(2,6,23,0.55)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <div
        className="pm-card"
        onClick={e => e.stopPropagation()}
        style={{ background: "#FFF", borderRadius: "22px", width: "400px", maxWidth: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.04)", overflow: "hidden" }}
      >
        {showSkills ? (
          <SkillsPanel onBack={() => setShowSkills(false)} />
        ) : (
          <div className="pm-view-profile">

            {/* ── Hero header ── */}
            <div style={{ background: "linear-gradient(145deg,#1E3A8A 0%,#2563EB 100%)", padding: "24px 20px 0", position: "relative" }}>
              <div style={{ position: "absolute", top: "-24px", right: "-24px", width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: "-30px", left: "20%", width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
                <button onClick={onClose} className="pm-close-btn" style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={13} color="#fff" />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "20px", gap: "8px" }}>
                {/* Avatar with camera overlay */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={showAvatarPicker && pendingAvatar ? pendingAvatar : avatarSrc}
                    alt="Profile avatar"
                    style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.22), 0 0 0 3px rgba(255,255,255,0.5)", display: "block" }}
                    onError={e => { e.currentTarget.src = "/avatars/default.png"; }}
                  />
                  <button
                    onClick={() => { setShowAvatarPicker(v => !v); setPendingAvatar(account?.avatar_url || "/avatars/default.png"); setAvatarError(""); }}
                    className="pm-cam-btn"
                    style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <Camera size={11} color="#fff" />
                  </button>
                </div>

                {!editing && !showAvatarPicker && (
                  <p style={{ fontSize: "17px", fontWeight: "800", color: "#fff", letterSpacing: "-0.3px", textShadow: "0 1px 4px rgba(0,0,0,0.2)", marginTop: "2px" }}>{name}</p>
                )}
                <span style={{ fontSize: "10px", fontWeight: "800", letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)", padding: "3px 11px", borderRadius: "99px", backdropFilter: "blur(4px)" }}>
                  {roleLabel(account?.role)}
                </span>
              </div>
            </div>

            {/* ── Avatar Picker ── */}
            {showAvatarPicker && (
              <div style={{ padding: "18px 22px 16px", borderBottom: "1px solid #F1F5F9" }}>
                <p style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>Choose your avatar</p>
                {avatarError && <p style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600", marginBottom: "10px" }}>{avatarError}</p>}
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
                  {AVATARS.map(src => (
                    <button
                      key={src}
                      onClick={() => setPendingAvatar(src)}
                      className={`pm-avatar-opt${pendingAvatar === src ? " selected" : ""}`}
                      style={{ padding: 0, background: "none", border: "2.5px solid transparent", borderRadius: "50%" }}
                    >
                      <img src={src} alt="avatar option" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="pm-btn"
                    onClick={() => { setShowAvatarPicker(false); setPendingAvatar(null); }}
                    style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    className="pm-save-btn"
                    onClick={handleAvatarSave}
                    disabled={savingAvatar || pendingAvatar === account?.avatar_url}
                    style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", background: savingAvatar ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: savingAvatar ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: pendingAvatar === account?.avatar_url ? 0.5 : 1 }}>
                    {savingAvatar ? (
                      <><span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", display: "inline-block", animation: "pm-spin 0.7s linear infinite" }} /> Saving…</>
                    ) : "Save Avatar"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Info section ── */}
            {loading ? (
              <div style={{ padding: "24px 22px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="pm-shimmer" style={{ height: "38px" }} />
                <div className="pm-shimmer" style={{ height: "38px" }} />
                <div className="pm-shimmer" style={{ height: "42px" }} />
              </div>
            ) : editing ? (
              <div style={{ padding: "22px 22px 20px", display: "flex", flexDirection: "column", gap: "13px" }}>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Full Name</p>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className="pm-input"
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s" }}
                  />
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Email</p>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="pm-input"
                    style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s, box-shadow 0.15s" }}
                  />
                </div>
                {error && <p style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600", margin: 0 }}>{error}</p>}
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    className="pm-btn"
                    onClick={() => { setEditing(false); setForm({ full_name: account.full_name, email: account.email }); setError(""); }}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    className="pm-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: saving ? "#93C5FD" : "#2563EB", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    {saving ? (
                      <><span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", display: "inline-block", animation: "pm-spin 0.7s linear infinite" }} /> Saving…</>
                    ) : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: "0" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", marginBottom: "14px" }}>
                  {[
                    { icon: <Mail size={14} color="#6366F1" />, label: "Email", value: account?.email },
                    { icon: <Calendar size={14} color="#6366F1" />, label: "Member since", value: account?.created_at ? new Date(account.created_at).toLocaleDateString("en-SG", { month: "long", year: "numeric" }) : "—" },
                  ].map((row, i) => (
                    <div key={i} className="pm-fade-item" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 12px", borderRadius: "10px", background: i % 2 === 0 ? "#FAFBFE" : "transparent", animationDelay: `${i * 0.06}s` }}>
                      <div style={{ width: 30, height: 30, borderRadius: "8px", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.icon}</div>
                      <div>
                        <p style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{row.label}</p>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{row.value || "—"}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {isStaff && (
                  <button
                    className="pm-skills-nav pm-fade-item"
                    onClick={() => setShowSkills(true)}
                    style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 12px", borderRadius: "10px", border: "1.5px solid #E0E7FF", background: "#EEF2FF", cursor: "pointer", width: "100%", marginBottom: "14px", animationDelay: "0.12s" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "8px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(99,102,241,0.3)" }}>
                      <Sparkles size={13} color="#fff" />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: "13px", fontWeight: "700", color: "#4F46E5", marginBottom: "1px" }}>My Skills</p>
                      <p style={{ fontSize: "11px", color: "#A5B4FC", fontWeight: "500" }}>View your assigned skill set</p>
                    </div>
                    <span style={{ fontSize: "18px", color: "#C7D2FE", lineHeight: 1 }}>›</span>
                  </button>
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
