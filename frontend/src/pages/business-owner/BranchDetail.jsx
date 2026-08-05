import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import SearchableSelect from "../../components/SearchableSelect";
import { useGoTo } from "../../components/PageTransition";
import { Building2, MapPin, Users, ShieldCheck, Clock, Plus, Briefcase, Trash2, Star, Settings2, Calendar, Zap, Pencil, X, Save, Loader2, Check, Minus, Scale, Award, TrendingUp, BarChart3, RotateCcw } from "lucide-react";
import { SG_HOLIDAYS } from "../../data/sgHolidays";
import UserAvatar from "../../components/UserAvatar";

if (typeof document !== "undefined" && !document.getElementById("bo-branchdetail-styles")) {
  const style = document.createElement("style");
  style.id = "bo-branchdetail-styles";
  style.textContent = `
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    .bo-staff-card { transition: box-shadow 0.18s, transform 0.18s; }
    .bo-staff-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
    .bo-manager-row { transition: background 0.15s; border-radius: 8px; padding: 4px 6px; margin-left: -6px; margin-right: -6px; }
    .bo-manager-row:hover { background: #FFFBEB; }
  `;
  document.head.appendChild(style);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WEIGHTS = [
  { key: "weight_availability", label: "Availability", icon: Users, color: "#2563EB" },
  { key: "weight_skills", label: "Skills match", icon: Award, color: "#7C3AED" },
  { key: "weight_attendance", label: "Attendance", icon: TrendingUp, color: "#059669" },
  { key: "weight_performance", label: "Performance", icon: BarChart3, color: "#EA580C" },
  { key: "weight_workload", label: "Workload", icon: Scale, color: "#0891B2" },
];

const ALLOC_DEFAULTS = { weight_availability: 40, weight_skills: 30, weight_attendance: 15, weight_performance: 10, weight_workload: 5 };

const DEFAULT_BRANCH_SETTINGS = {
  operating_days: [1,1,1,1,1,0,0],
  holidays: SG_HOLIDAYS.map(h => ({ ...h })),
  work_hours_day: 8, max_work_hours_day: 12,
  max_consecutive_days: 6, allow_overtime: false, min_workers_per_assignment: 1,
  off_days_per_week: 1,
};

function parseBranchSettings(s) {
  return {
    operating_days: s.operating_days ? s.operating_days.split("").map(Number) : [1,1,1,1,1,0,0],
    holidays: s.holidays?.length ? s.holidays : SG_HOLIDAYS.map(h => ({ ...h })),
    work_hours_day: s.work_hours_day ?? 8,
    max_work_hours_day: s.max_work_hours_day ?? 12,
    max_consecutive_days: s.max_consecutive_days ?? 6,
    allow_overtime: s.allow_overtime ?? false,
    min_workers_per_assignment: s.min_workers_per_assignment ?? 1,
    off_days_per_week: s.off_days_per_week ?? 1,
  };
}

function DonutChart({ weights, size = 140 }) {
  const total = weights.reduce((s, w) => s + w.value, 0);
  if (total === 0) return null;
  const strokeW = 20;
  const r = (size - strokeW) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const gap = 0.008;
  const arcs = weights.filter(w => w.value > 0).map(w => {
    const pct = w.value / total;
    const offset = cumulative;
    cumulative += pct;
    return { ...w, pct, offset };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.06))" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeW} />
      {arcs.map((arc, i) => {
        const dashLen = Math.max(0, (arc.pct - gap) * circumference);
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={arc.color} strokeWidth={strokeW}
            strokeDasharray={`${dashLen} ${circumference}`}
            strokeDashoffset={`${-(arc.offset + gap / 2) * circumference}`}
            strokeLinecap="round"
            style={{ transition: "all 0.5s cubic-bezier(.4,0,.2,1)" }} />
        );
      })}
    </svg>
  );
}

function NumFieldInline({ label, value, onChange, min, max, disabled }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "#64748B", marginBottom: "5px" }}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max} disabled={disabled}
        style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#1E293B", background: disabled ? "#F8FAFC" : "#FFF", boxSizing: "border-box", cursor: disabled ? "default" : "text" }} />
    </div>
  );
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function BranchDetail() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [branch, setBranch]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [staff, setStaff]               = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [managers, setManagers]               = useState([]);
  const [managersLoading, setManagersLoading] = useState(true);

  const [roleTemplates, setRoleTemplates] = useState([]);
  const [roleTemplatesLoading, setRoleTemplatesLoading] = useState(true);
  const [editingRoles, setEditingRoles] = useState(false);
  const [rolesDraft, setRolesDraft] = useState([]);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [rolesSaveError, setRolesSaveError] = useState("");
  const [skills, setSkills] = useState([]);

  // Per-branch business setup settings
  const [bizSettings, setBizSettings] = useState(null);
  const [savedBizSettings, setSavedBizSettings] = useState(null);
  const [bizAlloc, setBizAlloc] = useState(null);
  const [savedBizAlloc, setSavedBizAlloc] = useState(null);
  const [bizSettingsLoading, setBizSettingsLoading] = useState(true);
  const [editingBizSetup, setEditingBizSetup] = useState(false);
  const [editingBizAlloc, setEditingBizAlloc] = useState(false);
  const [bizSaving, setBizSaving] = useState(null);
  const [bizError, setBizError] = useState("");
  const [bizSuccess, setBizSuccess] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [modalAllowOffDay, setModalAllowOffDay] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalAddress, setModalAddress] = useState("");
  const [modalOpenTime, setModalOpenTime] = useState("");
  const [modalCloseTime, setModalCloseTime] = useState("");

  useEffect(() => { fetchBranch(); fetchStaff(); fetchManagers(); fetchRoleTemplates(); fetchBizSettings(); }, [id]);
  useEffect(() => { api.get(`/api/business/branches/${id}/skills`).then(r => setSkills((r.skills || []).map(sk => ({ skill_id: sk.skill_id, name: sk.name })))).catch(() => {}); }, [id]);

  async function fetchBranch() {
    setLoading(true);
    try {
      const data = await api.get("/api/business/branches");
      const found = (data.branches || []).find(o => String(o.branch_id) === String(id));
      if (!found) { goTo("/business-owner/branches"); return; }
      setBranch(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaff() {
    setStaffLoading(true);
    try {
      const data = await api.get(`/api/business/branches/${id}/staff`);
      setStaff(data.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStaffLoading(false);
    }
  }

  async function fetchManagers() {
    setManagersLoading(true);
    try {
      const data = await api.get(`/api/business/branches/${id}/managers`);
      setManagers(data.managers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setManagersLoading(false);
    }
  }

  async function fetchBizSettings() {
    setBizSettingsLoading(true);
    try {
      const data = await api.get(`/api/business/branches/${id}/settings`);
      const s = data.settings ? parseBranchSettings(data.settings) : { ...DEFAULT_BRANCH_SETTINGS };
      const a = data.allocation ? { ...ALLOC_DEFAULTS, ...data.allocation } : { ...ALLOC_DEFAULTS };
      setBizSettings(s);
      setSavedBizSettings(JSON.parse(JSON.stringify(s)));
      setBizAlloc(a);
      setSavedBizAlloc({ ...a });
    } catch {}
    finally { setBizSettingsLoading(false); }
  }

  async function fetchRoleTemplates() {
    setRoleTemplatesLoading(true);
    try {
      const data = await api.get(`/api/business/branches/${id}/role-templates`);
      setRoleTemplates(data.templates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRoleTemplatesLoading(false);
    }
  }

  function startEditRoles() {
    setRolesDraft(roleTemplates.map(t => ({ role_name: t.role_name, skill_id: t.skill_id || "", headcount: t.headcount })));
    setRolesSaveError("");
    setEditingRoles(true);
  }

  function updateRoleDraft(i, field, val) {
    setRolesDraft(prev => { const r = [...prev]; r[i] = { ...r[i], [field]: val }; return r; });
  }

  async function saveRoles() {
    setRolesSaveError("");
    setRolesSaving(true);
    try {
      const valid = rolesDraft.filter(r => r.role_name?.trim());
      await api.put(`/api/business/branches/${id}/role-templates`, {
        role_templates: valid.map(r => ({
          role_name: r.role_name.trim(),
          skill_id: r.skill_id ? Number(r.skill_id) : null,
          headcount: Number(r.headcount) || 1,
        })),
      });
      await fetchRoleTemplates();
      setEditingRoles(false);
    } catch (err) {
      setRolesSaveError(err.message || "Failed to save. Please try again.");
    } finally {
      setRolesSaving(false);
    }
  }

  function setBiz(key, val) { setBizSettings(p => ({ ...p, [key]: val })); }
  function setA(key, val) { setBizAlloc(p => ({ ...p, [key]: val })); }

  function toggleBizDay(i) {
    if (!editingBizSetup) return;
    const days = [...bizSettings.operating_days];
    days[i] = days[i] === 1 ? 0 : 1;
    setBiz("operating_days", days);
  }

  function toggleBizHoliday(i) {
    if (!editingBizSetup) return;
    const holidays = [...bizSettings.holidays];
    holidays[i] = { ...holidays[i], enabled: !holidays[i].enabled };
    setBiz("holidays", holidays);
  }

  function cancelBizSetup() {
    setBizSettings(JSON.parse(JSON.stringify(savedBizSettings)));
    setEditingBizSetup(false);
    setBizError("");
  }

  function cancelBizAlloc() {
    setBizAlloc({ ...savedBizAlloc });
    setEditingBizAlloc(false);
    setBizError("");
  }

  function adjustWeight(key, delta) {
    if (!editingBizAlloc) return;
    const current = bizAlloc[key] || 0;
    const newVal = Math.max(0, Math.min(100, current + delta));
    if (newVal === current) return;
    const others = WEIGHTS.filter(w => w.key !== key);
    const othersTotal = others.reduce((s, w) => s + bizAlloc[w.key], 0);
    setA(key, newVal);
    if (othersTotal === 0) return;
    const remaining = 100 - newVal;
    let distributed = 0;
    others.forEach((w, i) => {
      if (i === others.length - 1) {
        setA(w.key, Math.max(0, remaining - distributed));
      } else {
        const share = Math.round((bizAlloc[w.key] / othersTotal) * remaining);
        setA(w.key, Math.max(0, share));
        distributed += Math.max(0, share);
      }
    });
  }

  async function saveBizSettings() {
    if (!modalName.trim()) { setBizError("Branch name is required."); return; }
    setBizSaving("settings"); setBizError(""); setBizSuccess("");
    try {
      const patchBody = {
        working_days: modalAllowOffDay ? 7 : 5,
        name: modalName.trim(),
        address: modalAddress.trim(),
        open_time: modalOpenTime ? modalOpenTime + ":00" : undefined,
        close_time: modalCloseTime ? modalCloseTime + ":00" : undefined,
      };
      const [patchRes] = await Promise.all([
        api.patch(`/api/business/branches/${id}`, patchBody),
        api.put(`/api/business/branches/${id}/settings`, {
          ...bizSettings,
          operating_days: bizSettings.operating_days.join(""),
        }),
      ]);
      if (patchRes.branch) {
        setBranch(patchRes.branch);
      } else {
        setBranch(prev => ({ ...prev, ...patchBody }));
      }
      setSavedBizSettings(JSON.parse(JSON.stringify(bizSettings)));
      setEditingBizSetup(false);
      setBizSuccess("Branch settings saved.");
      setTimeout(() => setBizSuccess(""), 3000);
    } catch (err) { setBizError(err.message); }
    finally { setBizSaving(null); }
  }

  function openSettings() {
    setModalAllowOffDay((branch?.working_days ?? 5) >= 6);
    setModalName(branch?.name || "");
    setModalAddress(branch?.address || "");
    setModalOpenTime(fmtTimeInput(branch?.open_time));
    setModalCloseTime(fmtTimeInput(branch?.close_time));
    setBizSettings(JSON.parse(JSON.stringify(savedBizSettings)));
    setBizAlloc({ ...savedBizAlloc });
    setEditingBizSetup(false);
    setEditingBizAlloc(false);
    setBizError("");
    setBizSuccess("");
    setShowSettings(true);
  }

  function closeSettings() {
    setShowSettings(false);
    setEditingBizSetup(false);
    setEditingBizAlloc(false);
    setBizError("");
  }

  async function saveBizAlloc() {
    setBizSaving("alloc"); setBizError(""); setBizSuccess("");
    const total = WEIGHTS.reduce((s, w) => s + (bizAlloc[w.key] || 0), 0);
    if (total !== 100) { setBizError("Weights must sum to 100%."); setBizSaving(null); return; }
    try {
      await api.put(`/api/business/branches/${id}/settings/allocation`, bizAlloc);
      setSavedBizAlloc({ ...bizAlloc });
      setEditingBizAlloc(false);
      setBizSuccess("Allocation preferences saved.");
      setTimeout(() => setBizSuccess(""), 3000);
    } catch (err) { setBizError(err.message); }
    finally { setBizSaving(null); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/business/branches/${id}`);
      goTo("/business-owner/branches");
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <BusinessOwnerLayout title="Branch Details">
        <div style={{ textAlign: "center", padding: "60px", color: "#64748B", fontSize: "14px" }}>
          Loading branch…
        </div>
      </BusinessOwnerLayout>
    );
  }

  return (
    <BusinessOwnerLayout title="Branch Details">
      <button style={s.back} onClick={() => goTo("/business-owner/branches")}>← Back to Branches</button>

      <div style={s.layout}>
        {/* ── Left: branch card ── */}
        <div style={s.profileCard}>
          <div style={s.avatarLg}><Building2 size={28} color="#F59E0B" /></div>
          <h2 style={s.profileName}>{branch.name}</h2>
          {branch.address ? (
            <p style={s.profileMeta}><MapPin size={12} /> {branch.address}</p>
          ) : (
            <p style={s.profileMetaMuted}>No address set</p>
          )}

          <div style={s.managerSection}>
            <p style={s.managerLabel}><ShieldCheck size={12} /> Branch Manager</p>
            {managersLoading ? (
              <Shimmer w="100%" h="34px" r="9px" />
            ) : managers.length === 0 ? (
              <p style={s.managerEmpty}>No manager assigned yet.</p>
            ) : (
              managers.map(m => (
                <div key={m.user_id} className="bo-manager-row" style={{ ...s.managerRow, cursor: "pointer" }} onClick={() => goTo(`/business-owner/managers/${m.user_id}`)}>
                  <UserAvatar name={m.full_name || "?"} avatar_url={m.avatar_url} size={34} />
                  <div style={{ minWidth: 0, textAlign: "left" }}>
                    <p style={s.managerName}>{m.full_name}</p>
                    <p style={s.managerEmail}>{m.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={s.cardActions}>
            <button
              style={{ ...s.actionBtn, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} /> Delete Branch
            </button>
            <p style={{ fontSize: "11px", color: "#94A3B8", textAlign: "center", marginTop: "6px", lineHeight: 1.4 }}>
              Deleting also removes this branch's staff, shifts, and reports.
            </p>
          </div>
        </div>

        {/* ── Right: branch details (read-only) ── */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Branch Details</h3>
            <button onClick={openSettings} title="Branch Settings"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#475569", cursor: "pointer" }}>
              <Settings2 size={15} />
            </button>
          </div>

          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Branch Name</label>
              <p style={s.value}>{branch.name}</p>
            </div>

            <div style={s.field}>
              <label style={s.label}>Address</label>
              <p style={s.value}>{branch.address || "—"}</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={s.field}>
                <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Opening Time</label>
                <p style={s.value}>{fmtTimeDisplay(branch.open_time) || "—"}</p>
              </div>
              <div style={s.field}>
                <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Closing Time</label>
                <p style={s.value}>{fmtTimeDisplay(branch.close_time) || "—"}</p>
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Operating Days</label>
              {bizSettingsLoading ? (
                <p style={s.value}>Loading…</p>
              ) : (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
                  {DAYS.map((day, i) => {
                    const active = savedBizSettings?.operating_days?.[i] === 1;
                    return (
                      <span key={day} style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", border: `1.5px solid ${active ? "#2563EB" : "#E2E8F0"}`, background: active ? "#EFF6FF" : "#F8FAFC", color: active ? "#2563EB" : "#CBD5E1" }}>
                        {day}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Off Day Requests</label>
              <p style={s.value}>
                {(branch.working_days ?? 5) >= 6
                  ? `Allowed — ${savedBizSettings?.off_days_per_week ?? 1} day${(savedBizSettings?.off_days_per_week ?? 1) !== 1 ? "s" : ""}/week`
                  : "Not allowed"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Role Templates ── */}
      <div style={{ ...s.staffSection, marginTop: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <h3 style={s.formTitle}>Daily Role Requirements</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Roles and headcount needed every operating day</p>
          </div>
          {!editingRoles ? (
            <button style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" }} onClick={startEditRoles}>
              Edit Roles
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" }} onClick={() => setEditingRoles(false)}>Cancel</button>
              <button style={{ background: "#F59E0B", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "700", color: "#1C1917", cursor: "pointer" }} onClick={saveRoles} disabled={rolesSaving}>
                {rolesSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {roleTemplatesLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="42px" r="10px" />)}
          </div>
        ) : !editingRoles ? (
          roleTemplates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px", background: "#FFF", border: "1.5px dashed #E2E8F0", borderRadius: "16px" }}>
              <Briefcase size={28} color="#CBD5E1" />
              <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "8px" }}>No role requirements set. Click "Edit Roles" to add some.</p>
            </div>
          ) : (
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 80px", padding: "10px 16px", background: "#F8FAFC", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em", gap: "8px" }}>
                <span>Role</span><span>Required Skill</span><span>Headcount</span>
              </div>
              {roleTemplates.map((t, i) => (
                <div key={t.template_id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 80px", padding: "12px 16px", gap: "8px", alignItems: "center", borderTop: i > 0 ? "1px solid #F1F5F9" : "none" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{t.role_name}</span>
                  <span style={{ fontSize: "13px", color: t.skills ? "#1E293B" : "#94A3B8" }}>
                    {t.skills ? (
                      <span style={{ background: "#EFF6FF", color: "#1D4ED8", padding: "2px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "600" }}>{t.skills.name}</span>
                    ) : "Any / None"}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>{t.headcount}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px" }}>
            {rolesSaveError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", marginBottom: "12px" }}>
                {rolesSaveError}
              </div>
            )}
            {rolesDraft.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 32px", gap: "8px", padding: "0 4px", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Skill / Role</span>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Count</span>
                <span />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {rolesDraft.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 32px", gap: "8px", alignItems: "center" }}>
                  <SearchableSelect
                    options={skills.map(sk => ({ value: sk.skill_id, label: sk.name }))}
                    value={row.skill_id || ""}
                    onChange={val => {
                      const sk = skills.find(s => s.skill_id === Number(val));
                      setRolesDraft(prev => {
                        const r = [...prev];
                        r[i] = { ...r[i], skill_id: val, role_name: sk?.name || "" };
                        return r;
                      });
                    }}
                    placeholder="— Select skill —"
                  />
                  <input type="number" min="1" max="99" style={{ ...s.input, textAlign: "center" }} value={row.headcount} onChange={e => updateRoleDraft(i, "headcount", e.target.value)} />
                  <button onClick={() => setRolesDraft(p => p.filter((_, idx) => idx !== i))} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "7px", color: "#EF4444", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => { setRolesSaveError(""); setRolesDraft(p => [...p, { role_name: "", skill_id: "", headcount: 1 }]); }} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "1.5px dashed #CBD5E1", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
              <Plus size={14} /> Add Role
            </button>
          </div>
        )}
      </div>

      {/* ── Staff at this branch ── */}
      <div style={s.staffSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h3 style={s.formTitle}>Staff at this Branch</h3>
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>
            {staffLoading ? "Loading…" : `${staff.length} member${staff.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {staffLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="120px" h="14px" r="6px" />
                    <div style={{ marginTop: "6px" }}><Shimmer w="150px" h="12px" r="5px" /></div>
                  </div>
                </div>
                <Shimmer w="70px" h="22px" r="100px" />
              </div>
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div style={s.staffEmpty}>
            <Users size={36} color="#CBD5E1" />
            <p style={{ fontSize: "14px", color: "#94A3B8", marginTop: "10px" }}>No staff assigned to this branch yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {staff.filter(m => m.users?.role !== "manager").map((m, i) => {
              const name = m.users?.full_name || "—";
              return (
                <div key={m.staff_id} className="bo-staff-card" style={{ ...s.staffCard, animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`, cursor: "pointer" }} onClick={() => goTo(`/business-owner/staff/${m.staff_id}`)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <UserAvatar name={name} avatar_url={m.users?.avatar_url} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.users?.email || "—"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: m.staff_type === "casual" ? "#F3E8FF" : "#DBEAFE", color: m.staff_type === "casual" ? "#6B21A8" : "#1E40AF" }}>
                      {m.staff_type === "casual" ? "Casual" : "Regular"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "600", color: m.is_active ? "#16A34A" : "#94A3B8" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#D1D5DB", display: "inline-block" }} />
                      {m.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalIcon}><Trash2 size={36} color="#EF4444" /></div>
            <h3 style={s.modalTitle}>Delete Branch?</h3>
            <p style={s.modalBody}>
              This will permanently remove <strong>{branch.name}</strong> along with its staff, shifts, and reports.
              This cannot be undone.
            </p>
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                style={{ ...s.actionBtn, background: "#EF4444", color: "#FFF", border: "none", padding: "9px 20px", width: "auto" }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && bizSettings && createPortal(
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(2px)" }}
        onClick={e => { if (e.target === e.currentTarget) closeSettings(); }}>
        <div style={{ background: "#FFF", borderRadius: "20px", width: "100%", maxWidth: "860px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Settings2 size={18} color="#2563EB" />
              </div>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>Branch Settings</h3>
                <p style={{ fontSize: "12px", color: "#94A3B8" }}>{branch.name}</p>
              </div>
            </div>
            <button onClick={closeSettings} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}>
              <X size={16} />
            </button>
          </div>

          {(bizError || bizSuccess) && (
            <div style={{ background: bizError ? "#FEF2F2" : "#F0FDF4", borderBottom: `1px solid ${bizError ? "#FECACA" : "#BBF7D0"}`, padding: "10px 24px", fontSize: "13px", color: bizError ? "#DC2626" : "#16A34A", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              {bizSuccess && (<Check size={14} strokeWidth={2.5} />)}
              {bizError || bizSuccess}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", overflow: "hidden", flex: 1, minHeight: 0 }}>
            <div style={{ overflowY: "auto", padding: "24px 28px", borderRight: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Branch Name</label>
                  <input value={modalName} onChange={e => setModalName(e.target.value)} disabled={!editingBizSetup} placeholder="e.g. Main Branch"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#1E293B", background: editingBizSetup ? "#FFF" : "#F8FAFC", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Address</label>
                  <input value={modalAddress} onChange={e => setModalAddress(e.target.value)} disabled={!editingBizSetup} placeholder="e.g. 123 Main St, City"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#1E293B", background: editingBizSetup ? "#FFF" : "#F8FAFC", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Opening Time</label>
                    <input type="time" value={modalOpenTime} onChange={e => setModalOpenTime(e.target.value)} disabled={!editingBizSetup}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#1E293B", background: editingBizSetup ? "#FFF" : "#F8FAFC", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Closing Time</label>
                    <input type="time" value={modalCloseTime} onChange={e => setModalCloseTime(e.target.value)} disabled={!editingBizSetup}
                      style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#1E293B", background: editingBizSetup ? "#FFF" : "#F8FAFC", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>Allow off day requests</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Staff can submit requests for days off</p>
                    </div>
                    <button type="button" onClick={() => editingBizSetup && setModalAllowOffDay(v => !v)} disabled={!editingBizSetup}
                      style={{ width: "42px", height: "22px", borderRadius: "11px", border: "none", background: modalAllowOffDay ? "#2563EB" : "#D1D5DB", cursor: editingBizSetup ? "pointer" : "default", position: "relative", transition: "background 0.2s", opacity: editingBizSetup ? 1 : 0.7, flexShrink: 0 }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#FFF", position: "absolute", top: "3px", left: modalAllowOffDay ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    </button>
                  </div>
                  {modalAllowOffDay && (
                    <div style={{ borderTop: "1px solid #E2E8F0", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>Off days per week</p>
                        <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Max days off a staff member can request</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button type="button" onClick={() => editingBizSetup && setBiz("off_days_per_week", Math.max(1, (bizSettings.off_days_per_week || 1) - 1))} disabled={!editingBizSetup || (bizSettings.off_days_per_week || 1) <= 1}
                          style={{ width: "28px", height: "28px", borderRadius: "7px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#475569", cursor: editingBizSetup && (bizSettings.off_days_per_week || 1) > 1 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", opacity: !editingBizSetup || (bizSettings.off_days_per_week || 1) <= 1 ? 0.4 : 1 }}>
                          −
                        </button>
                        <span style={{ width: "32px", textAlign: "center", fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{bizSettings.off_days_per_week || 1}</span>
                        <button type="button" onClick={() => editingBizSetup && setBiz("off_days_per_week", Math.min(7, (bizSettings.off_days_per_week || 1) + 1))} disabled={!editingBizSetup || (bizSettings.off_days_per_week || 1) >= 7}
                          style={{ width: "28px", height: "28px", borderRadius: "7px", border: "1.5px solid #2563EB40", background: "#EFF6FF", color: "#2563EB", cursor: editingBizSetup && (bizSettings.off_days_per_week || 1) < 7 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", opacity: !editingBizSetup || (bizSettings.off_days_per_week || 1) >= 7 ? 0.4 : 1 }}>
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Operating days</p>
                {!editingBizSetup ? (
                  <button onClick={() => setEditingBizSetup(true)} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#475569", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <Pencil size={12} /> Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={cancelBizSetup} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                      <X size={12} /> Cancel
                    </button>
                    <button onClick={saveBizSettings} disabled={bizSaving === "settings"} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 16px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "12px", fontWeight: "700", cursor: "pointer", opacity: bizSaving === "settings" ? 0.7 : 1 }}>
                      {bizSaving === "settings" ? (<Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />) : (<Save size={12} />)}
                      {bizSaving === "settings" ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "7px", marginBottom: "24px", flexWrap: "wrap" }}>
                {DAYS.map((day, i) => (
                  <button key={day} type="button" onClick={() => toggleBizDay(i)} disabled={!editingBizSetup}
                    style={{ padding: "7px 16px", borderRadius: "100px", border: `1.5px solid ${bizSettings.operating_days[i] ? "#2563EB" : "#E2E8F0"}`, background: bizSettings.operating_days[i] ? "#EFF6FF" : "#FFF", color: bizSettings.operating_days[i] ? "#2563EB" : "#94A3B8", fontSize: "13px", fontWeight: "600", cursor: editingBizSetup ? "pointer" : "default", transition: "all 0.15s", opacity: !editingBizSetup && !bizSettings.operating_days[i] ? 0.45 : 1 }}>
                    {day}
                  </button>
                ))}
              </div>

              <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Work rules</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <NumFieldInline label="Standard hours/day" value={bizSettings.work_hours_day} onChange={v => setBiz("work_hours_day", v)} min={1} max={24} disabled={!editingBizSetup} />
                <NumFieldInline label="Max hours/day" value={bizSettings.max_work_hours_day} onChange={v => setBiz("max_work_hours_day", v)} min={1} max={24} disabled={!editingBizSetup} />
                <NumFieldInline label="Max consecutive days" value={bizSettings.max_consecutive_days} onChange={v => setBiz("max_consecutive_days", v)} min={1} max={14} disabled={!editingBizSetup} />
                <NumFieldInline label="Min workers/assignment" value={bizSettings.min_workers_per_assignment} onChange={v => setBiz("min_workers_per_assignment", v)} min={1} max={50} disabled={!editingBizSetup} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", marginBottom: "24px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>Allow overtime</p>
                  <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Workers can be scheduled beyond standard hours</p>
                </div>
                <button type="button" onClick={() => editingBizSetup && setBiz("allow_overtime", !bizSettings.allow_overtime)} disabled={!editingBizSetup}
                  style={{ width: "42px", height: "22px", borderRadius: "11px", border: "none", background: bizSettings.allow_overtime ? "#2563EB" : "#D1D5DB", cursor: editingBizSetup ? "pointer" : "default", position: "relative", transition: "background 0.2s", opacity: editingBizSetup ? 1 : 0.7, flexShrink: 0 }}>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#FFF", position: "absolute", top: "3px", left: bizSettings.allow_overtime ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </button>
              </div>

              <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Public holidays</p>
              <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", maxHeight: "200px", overflowY: "auto" }}>
                {bizSettings.holidays.map((h, i) => (
                  <div key={h.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: i < bizSettings.holidays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: "#1E293B" }}>{h.name}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8" }}>{h.date}</p>
                    </div>
                    <button type="button" onClick={() => toggleBizHoliday(i)} disabled={!editingBizSetup}
                      style={{ width: "34px", height: "18px", borderRadius: "9px", border: "none", background: h.enabled ? "#22C55E" : "#D1D5DB", cursor: editingBizSetup ? "pointer" : "default", position: "relative", transition: "background 0.2s", flexShrink: 0, opacity: editingBizSetup ? 1 : 0.7 }}>
                      <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#FFF", position: "absolute", top: "3px", left: h.enabled ? "19px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ overflowY: "auto", padding: "24px 20px", background: "#FAFBFE" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Zap size={15} color="#F59E0B" />
                  <h4 style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>Smart allocation</h4>
                </div>
                {!editingBizAlloc ? (
                  <button onClick={() => setEditingBizAlloc(true)} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#475569", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                    <Pencil size={12} /> Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={cancelBizAlloc} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 10px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                      <X size={12} /> Cancel
                    </button>
                    <button onClick={saveBizAlloc} disabled={bizSaving === "alloc" || WEIGHTS.reduce((sum, w) => sum + (bizAlloc[w.key] || 0), 0) !== 100}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "12px", fontWeight: "700", cursor: "pointer", opacity: (bizSaving === "alloc" || WEIGHTS.reduce((sum, w) => sum + (bizAlloc[w.key] || 0), 0) !== 100) ? 0.6 : 1 }}>
                      {bizSaving === "alloc" ? (<Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />) : (<Save size={12} />)}
                      Save
                    </button>
                  </div>
                )}
              </div>

              {(() => {
                const allocTotal = WEIGHTS.reduce((sum, w) => sum + (bizAlloc[w.key] || 0), 0);
                const allocValid = allocTotal === 100;
                const donutData = WEIGHTS.map(w => ({ color: w.color, value: bizAlloc[w.key] || 0 }));
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                      <div style={{ position: "relative", width: "140px", height: "140px" }}>
                        <DonutChart weights={donutData} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "24px", fontWeight: "800", color: allocValid ? "#0F172A" : "#DC2626", lineHeight: 1 }}>{allocTotal}</span>
                          <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: "600", marginTop: "2px" }}>of 100%</span>
                          {allocValid && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: "700", color: "#16A34A", marginTop: "4px" }}>
                              <Check size={10} strokeWidth={3} /> Balanced
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {WEIGHTS.map(w => {
                        const Icon = w.icon;
                        const val = bizAlloc[w.key] || 0;
                        return (
                          <div key={w.key} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px", borderRadius: "9px" }}>
                            <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: w.color + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Icon size={12} color={w.color} strokeWidth={2.2} />
                            </div>
                            <span style={{ flex: 1, fontSize: "12px", fontWeight: "600", color: "#1E293B" }}>{w.label}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              {editingBizAlloc && (
                                <button type="button" onClick={() => adjustWeight(w.key, -5)} disabled={val <= 0}
                                  style={{ width: "24px", height: "24px", borderRadius: "6px", border: "1.5px solid #E2E8F0", background: val > 0 ? "#FFF" : "#F8FAFC", color: val > 0 ? "#475569" : "#CBD5E1", cursor: val > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Minus size={11} strokeWidth={2.5} />
                                </button>
                              )}
                              <div style={{ width: "44px", textAlign: "center", background: w.color + "10", borderRadius: "6px", padding: "2px 0" }}>
                                <span style={{ fontSize: "13px", fontWeight: "800", color: w.color }}>{val}%</span>
                              </div>
                              {editingBizAlloc && (
                                <button type="button" onClick={() => adjustWeight(w.key, 5)} disabled={val >= 100}
                                  style={{ width: "24px", height: "24px", borderRadius: "6px", border: `1.5px solid ${w.color}40`, background: w.color + "10", color: w.color, cursor: val < 100 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Plus size={11} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {editingBizAlloc && (
                      <div style={{ textAlign: "center", marginTop: "10px" }}>
                        <button type="button" onClick={() => setBizAlloc({ ...ALLOC_DEFAULTS })}
                          style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}>
                          <RotateCcw size={11} /> Reset to defaults
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </BusinessOwnerLayout>
  );
}

function fmtTimeInput(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

function fmtTimeDisplay(t) {
  if (!t) return null;
  const parts = String(t).split(":");
  if (parts.length < 2) return t;
  const hour = Number(parts[0]);
  const m = parts[1];
  if (isNaN(hour)) return t;
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "20px", padding: 0 },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" },

  profileCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", textAlign: "center" },
  avatarLg: { width: "72px", height: "72px", borderRadius: "16px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" },
  profileName: { fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "6px" },
  profileMeta: { display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "13px", color: "#64748B", marginBottom: "12px" },
  profileMetaMuted: { fontSize: "13px", color: "#94A3B8", marginBottom: "12px" },
  cardActions: { marginTop: "16px", display: "flex", flexDirection: "column", gap: "4px" },
  actionBtn: { width: "100%", padding: "9px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },

  managerSection: { marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #F1F5F9", textAlign: "left" },
  managerLabel: { display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" },
  managerEmpty: { fontSize: "13px", color: "#94A3B8" },
  managerRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
  managerAvatar: { width: "32px", height: "32px", borderRadius: "50%", background: "#F59E0B", color: "#1C1917", fontSize: "13px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  managerName: { fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  managerEmail: { fontSize: "11px", color: "#64748B", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  formCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px" },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  formTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  editBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  cancelBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  saveBtn: { background: "#F59E0B", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "700", color: "#1C1917", cursor: "pointer" },

  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },

  fields: { display: "flex", flexDirection: "column", gap: "16px" },
  field: {},
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "6px" },
  value: { fontSize: "14px", color: "#1E293B", fontWeight: "500" },
  input: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFFFFF", boxSizing: "border-box" },

  staffSection: { marginTop: "20px" },
  staffEmpty: { textAlign: "center", padding: "40px 20px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px" },
  staffCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  staffAvatar: { width: "44px", height: "44px", borderRadius: "50%", color: "#FFFFFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "16px", padding: "32px 28px", width: "360px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalIcon: { fontSize: "36px", marginBottom: "12px" },
  modalTitle: { fontSize: "18px", fontWeight: "800", color: "#1E293B", marginBottom: "10px" },
  modalBody: { fontSize: "14px", color: "#64748B", lineHeight: 1.6, marginBottom: "24px" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "center" },
};
