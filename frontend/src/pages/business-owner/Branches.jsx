import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Plus, Building2, MapPin, Clock, Check, Calendar, Search, Users, Pencil } from "lucide-react";
import { UpgradePlanModal } from "../../components/UpgradePlanModal";
import { SG_HOLIDAYS } from "../../data/sgHolidays";

if (typeof document !== "undefined" && !document.getElementById("bo-branch-styles")) {
  const style = document.createElement("style");
  style.id = "bo-branch-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .bo-branch-card { transition: transform 0.18s ease, box-shadow 0.18s ease; position: relative; overflow: hidden; }
    .bo-branch-card:hover { transform: translateY(-3px); box-shadow: 0 16px 32px rgba(0,0,0,0.10) !important; }
    .bo-edit-btn:hover { background: #E2E8F0 !important; color: #1E293B !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_FORM = {
  name: "", address: "",
  open_time: "08:00", close_time: "22:00",
  operating_days: [1,1,1,1,1,0,0],
  holidays: SG_HOLIDAYS.map(h => ({ ...h })),
  work_hours_day: 8,
  max_work_hours_day: 12,
  max_consecutive_days: 6,
  allow_overtime: false,
  min_workers_per_assignment: 1,
};

export default function BOBranches() {
  const goTo = useGoTo();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [upgradeModal, setUpgradeModal] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");

  const load = () => {
    setLoading(true);
    api.get("/api/business/branches")
      .then(d => setBranches(d.branches || []))
      .catch(err => console.error("Failed to load branches:", err))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  function openWizard() {
    setForm(EMPTY_FORM);
    setStep(1);
    setError("");
    setShowWizard(true);
  }

  function closeWizard() {
    setShowWizard(false);
    setError("");
  }

  function nextStep() {
    if (step === 1 && !form.name.trim()) { setError("Branch name is required."); return; }
    setError("");
    setStep(s => s + 1);
  }

  const handleCreate = async () => {
    setSubmitting(true); setError("");
    try {
      await api.post("/api/business/branches", {
        name: form.name.trim(),
        address: form.address.trim() || null,
        open_time: form.open_time + ":00",
        close_time: form.close_time + ":00",
        operating_days: form.operating_days.join(""),
        holidays: form.holidays,
        work_hours_day: form.work_hours_day,
        max_work_hours_day: form.max_work_hours_day,
        max_consecutive_days: form.max_consecutive_days,
        allow_overtime: form.allow_overtime,
        min_workers_per_assignment: form.min_workers_per_assignment,
      });
      closeWizard();
      load();
    } catch (err) {
      if (err.limitReached) {
        closeWizard();
        setUpgradeModal({ limitType: err.limitType, plan: err.plan, message: err.message });
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = ["Basic Info", "Operating Hours"];

  const q = search.trim().toLowerCase();
  const hasStaffData = branches.some(b => b.staff_count != null);
  const totalStaff = branches.reduce((sum, b) => sum + (b.staff_count || 0), 0);
  const busiestBranch = hasStaffData && branches.length
    ? branches.reduce((a, b) => (b.staff_count || 0) > (a.staff_count || 0) ? b : a)
    : null;

  const filtered = branches
    .filter(b => !q || b.name.toLowerCase().includes(q) || (b.address || "").toLowerCase().includes(q))
    .sort((a, b) =>
      sortKey === "staff"
        ? (b.staff_count || 0) - (a.staff_count || 0)
        : a.name.localeCompare(b.name)
    );

  return (
    <BusinessOwnerLayout title="Branches">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", letterSpacing: "-0.02em", margin: 0 }}>Branches</h2>
            <p style={{ fontSize: "21px", color: "#64748B", marginTop: "6px" }}>
              {loading ? "Loading…" : `${branches.length} branch${branches.length !== 1 ? "es" : ""} across your business`}
            </p>
          </div>
          <button onClick={openWizard} style={s.btnPrimary}>
            <Plus size={16} /> Add Branch
          </button>
        </div>

        {/* Stats Row */}
        {!loading && branches.length > 0 && (
          <div style={{ display: "flex", gap: "16px", marginBottom: "28px", flexWrap: "wrap" }}>
            <div style={s.statCard}>
              <div style={{ ...s.statIcon, background: "#FFFBEB" }}>
                <Building2 size={20} color="#D97706" />
              </div>
              <div>
                <div style={s.statNum}>{branches.length}</div>
                <div style={s.statLabel}>Total branches</div>
              </div>
            </div>
            {hasStaffData && (
              <div style={s.statCard}>
                <div style={{ ...s.statIcon, background: "#EFF6FF" }}>
                  <Users size={20} color="#2563EB" />
                </div>
                <div>
                  <div style={s.statNum}>{totalStaff}</div>
                  <div style={s.statLabel}>Total staff</div>
                </div>
              </div>
            )}
            {busiestBranch && (
              <div style={s.statCard}>
                <div style={{ ...s.statIcon, background: "#F0F9FF" }}>
                  <MapPin size={20} color="#0284C7" />
                </div>
                <div>
                  <div style={{ ...s.statNum, fontSize: "21px" }}>{busiestBranch.name}</div>
                  <div style={s.statLabel}>Busiest branch</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "220px", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: "16px", color: "#94A3B8", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search branches by name or address…"
              style={{ width: "100%", padding: "12px 16px 12px 44px", borderRadius: "999px", border: "1px solid #E2E8F0", fontSize: "21px", outline: "none", background: "#fff", color: "#1E293B", boxSizing: "border-box" }}
            />
          </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            style={{ padding: "12px 18px", borderRadius: "999px", border: "1px solid #E2E8F0", fontSize: "21px", color: "#475569", background: "#fff", outline: "none", cursor: "pointer" }}
          >
            <option value="name">Sort: Name (A–Z)</option>
            {hasStaffData && <option value="staff">Sort: Most staff</option>}
          </select>
        </div>

        {/* Wizard Modal */}
        {showWizard && createPortal(
          <div style={s.overlay}>
            <div style={s.modal}>
              {/* Step indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "28px" }}>
                {STEPS.map((label, i) => {
                  const num = i + 1;
                  const active = num === step;
                  const done = num < step;
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "20px", fontWeight: "700",
                          background: done ? "#F59E0B" : active ? "#1E293B" : "#F1F5F9",
                          color: done ? "#1C1917" : active ? "#FFFFFF" : "#94A3B8",
                          transition: "all 0.2s",
                        }}>
                          {done ? <Check size={14} /> : num}
                        </div>
                        <span style={{ fontSize: "18px", fontWeight: active ? "700" : "500", color: active ? "#1E293B" : "#94A3B8", whiteSpace: "nowrap" }}>{label}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div style={{ flex: 1, height: "2px", background: done ? "#F59E0B" : "#E2E8F0", margin: "0 8px", marginBottom: "18px", transition: "background 0.2s" }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step 1 — Basic Info */}
              {step === 1 && (
                <div style={{ animation: "fadeSlideUp 0.25s ease both" }}>
                  <h3 style={s.stepTitle}>Basic Information</h3>
                  <p style={s.stepSub}>Give your branch a name and location.</p>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Branch Name <span style={{ color: "#EF4444" }}>*</span></label>
                    <input style={s.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Downtown Branch" />
                  </div>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Address</label>
                    <input style={s.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. 123 Main St, City" />
                  </div>
                </div>
              )}

              {/* Step 2 — Operating Hours */}
              {step === 2 && (
                <div style={{ animation: "fadeSlideUp 0.25s ease both" }}>
                  <h3 style={s.stepTitle}>Operating Hours</h3>
                  <p style={s.stepSub}>Set operating days, hours, work rules, and public holidays for this branch.</p>

                  <p style={s.sectionLabel}>Operating days</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
                    {DAYS.map((day, i) => {
                      const on = form.operating_days[i] === 1;
                      return (
                        <button key={day} type="button"
                          onClick={() => setForm(p => { const d = [...p.operating_days]; d[i] = d[i] ? 0 : 1; return { ...p, operating_days: d }; })}
                          style={{ padding: "7px 14px", borderRadius: "100px", border: `1.5px solid ${on ? "#F59E0B" : "#E2E8F0"}`, background: on ? "#FEF3C7" : "#F8FAFC", color: on ? "#92400E" : "#94A3B8", fontSize: "19px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s" }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  <p style={s.sectionLabel}>Opening hours</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                    <div style={s.fieldGroup}>
                      <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Open time</label>
                      <input type="time" style={s.input} value={form.open_time} onChange={e => setForm(p => ({ ...p, open_time: e.target.value }))} />
                    </div>
                    <div style={s.fieldGroup}>
                      <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Close time</label>
                      <input type="time" style={s.input} value={form.close_time} onChange={e => setForm(p => ({ ...p, close_time: e.target.value }))} />
                    </div>
                  </div>

                  <p style={s.sectionLabel}>Work rules</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                    {[
                      { label: "Std hours / day", key: "work_hours_day", min: 1, max: 24 },
                      { label: "Max hours / day", key: "max_work_hours_day", min: 1, max: 24 },
                      { label: "Max consecutive days", key: "max_consecutive_days", min: 1, max: 14 },
                      { label: "Min workers / shift", key: "min_workers_per_assignment", min: 1, max: 50 },
                    ].map(({ label, key, min, max }) => (
                      <div key={key} style={s.fieldGroup}>
                        <label style={s.label}>{label}</label>
                        <input type="number" min={min} max={max} style={s.input}
                          value={form[key]}
                          onChange={e => setForm(p => ({ ...p, [key]: Number(e.target.value) }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", marginBottom: "20px" }}>
                    <div>
                      <p style={{ fontSize: "20px", fontWeight: "600", color: "#1E293B" }}>Allow overtime</p>
                      <p style={{ fontSize: "18px", color: "#94A3B8" }}>Workers can be scheduled beyond standard hours</p>
                    </div>
                    <button type="button" onClick={() => setForm(p => ({ ...p, allow_overtime: !p.allow_overtime }))}
                      style={{ width: "40px", height: "22px", borderRadius: "11px", border: "none", background: form.allow_overtime ? "#F59E0B" : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: form.allow_overtime ? "21px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                    <Calendar size={13} color="#64748B" />
                    <p style={s.sectionLabel}>Public holidays</p>
                    <span style={{ fontSize: "17px", fontWeight: "700", padding: "2px 7px", borderRadius: "100px", background: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE", marginLeft: "4px" }}>SG 2026</span>
                  </div>
                  <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", maxHeight: "180px", overflowY: "auto" }}>
                    {form.holidays.map((h, i) => (
                      <div key={h.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderBottom: i < form.holidays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                        <div>
                          <p style={{ fontSize: "19px", fontWeight: "600", color: "#1E293B" }}>{h.name}</p>
                          <p style={{ fontSize: "17px", color: "#94A3B8" }}>{h.date}</p>
                        </div>
                        <button type="button"
                          onClick={() => setForm(p => { const hols = [...p.holidays]; hols[i] = { ...hols[i], enabled: !hols[i].enabled }; return { ...p, holidays: hols }; })}
                          style={{ width: "34px", height: "19px", borderRadius: "10px", border: "none", background: h.enabled ? "#22C55E" : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ width: "13px", height: "13px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: h.enabled ? "18px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p style={{ color: "#EF4444", fontSize: "20px", marginTop: "14px" }}>{error}</p>}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "28px" }}>
                <button onClick={step === 1 ? closeWizard : () => setStep(s => s - 1)} style={s.btnSecondary}>
                  {step === 1 ? "Cancel" : "← Back"}
                </button>
                {step < 2 ? (
                  <button onClick={nextStep} style={s.btnPrimary}>Next →</button>
                ) : (
                  <button onClick={handleCreate} disabled={submitting} style={s.btnPrimary}>
                    {submitting ? "Creating…" : "Create Branch"}
                  </button>
                )}
              </div>
            </div>
          </div>
        , document.body)}

        {/* Branch grid */}
        {loading ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ flex: "1 1 340px", maxWidth: "560px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "24px", padding: "28px", display: "flex", gap: "18px" }}>
                <Shimmer w="58px" h="58px" r="16px" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="55%" h="18px" r="6px" />
                  <div style={{ marginTop: "12px" }}><Shimmer w="70%" h="13px" r="5px" /></div>
                  <div style={{ marginTop: "8px" }}><Shimmer w="50%" h="13px" r="5px" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div style={s.empty}>
            <Building2 size={40} color="#CBD5E1" />
            <p style={{ fontSize: "21px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>No branches yet</p>
            <p style={{ fontSize: "20px", color: "#94A3B8", marginTop: "4px" }}>Create your first branch to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            <Search size={36} color="#CBD5E1" />
            <p style={{ fontSize: "22px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>No branches match your search.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
            {filtered.map((branch, i) => (
              <div
                key={branch.branch_id}
                className="bo-branch-card"
                style={{ ...s.card, animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}
                onClick={() => goTo(`/business-owner/branches/${branch.branch_id}`)}
              >
                {/* Top-right actions */}
                <div style={{ position: "absolute", top: "22px", right: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {branch.staff_count != null && (
                    <div style={s.staffBadge}>
                      <Users size={12} />
                      {branch.staff_count}
                    </div>
                  )}
                  <button
                    className="bo-edit-btn"
                    onClick={e => { e.stopPropagation(); goTo(`/business-owner/branches/${branch.branch_id}`); }}
                    style={s.btnEdit}
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                {/* Card body */}
                <div style={{ display: "flex", gap: "18px" }}>
                  <div style={s.cardIcon}>
                    <Building2 size={27} color="#D97706" />
                  </div>
                  <div style={{ minWidth: 0, paddingRight: "60px", paddingTop: "2px" }}>
                    <p style={s.cardName}>{branch.name}</p>
                    {branch.address && (
                      <div style={s.cardLine}>
                        <MapPin size={14} style={{ flexShrink: 0 }} />
                        {branch.address}
                      </div>
                    )}
                    {(branch.open_time || branch.close_time) && (
                      <div style={s.cardLine}>
                        <Clock size={14} style={{ flexShrink: 0 }} />
                        {fmtTime(branch.open_time)} – {fmtTime(branch.close_time)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {upgradeModal && (
        <UpgradePlanModal
          currentPlan={upgradeModal.plan}
          onClose={() => setUpgradeModal(null)}
          onUpgraded={() => { setUpgradeModal(null); load(); }}
        />
      )}
    </BusinessOwnerLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

const s = {
  btnPrimary: {
    display: "inline-flex", alignItems: "center", gap: "8px",
    background: "linear-gradient(135deg, #F59E0B, #D97706)",
    color: "#1C1917", border: "none", padding: "13px 22px",
    borderRadius: "999px", fontSize: "21px", fontWeight: "700",
    cursor: "pointer", boxShadow: "0 6px 16px rgba(217,119,6,0.4)",
    transition: "transform 0.15s",
  },
  btnSecondary: {
    background: "#F1F5F9", color: "#475569", border: "none",
    borderRadius: "999px", padding: "13px 22px", fontSize: "21px",
    fontWeight: "600", cursor: "pointer",
  },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "20px", padding: "32px", width: "560px", maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" },
  stepTitle: { fontSize: "22px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" },
  stepSub: { fontSize: "20px", color: "#64748B", marginBottom: "20px" },
  sectionLabel: { fontSize: "18px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" },
  fieldGroup: { marginBottom: "14px" },
  label: { display: "flex", alignItems: "center", fontSize: "19px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  input: { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "21px", outline: "none", boxSizing: "border-box", color: "#1E293B", background: "#FFFFFF" },
  statCard: {
    flex: 1, minWidth: "160px",
    background: "#fff", border: "1px solid #E2E8F0", borderRadius: "18px",
    padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px",
  },
  statIcon: {
    width: "44px", height: "44px", flexShrink: 0,
    borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center",
  },
  statNum: { fontSize: "25px", fontWeight: "800", color: "#1E293B", letterSpacing: "-0.01em" },
  statLabel: { fontSize: "20px", color: "#64748B", marginTop: "1px" },
  card: {
    background: "#fff", border: "1px solid #E2E8F0", borderRadius: "24px",
    padding: "28px", flex: "1 1 340px", maxWidth: "560px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer",
  },
  cardIcon: {
    width: "58px", height: "58px", flexShrink: 0, borderRadius: "16px",
    background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  cardName: { fontSize: "24px", fontWeight: "700", color: "#1E293B", letterSpacing: "-0.01em", marginBottom: "8px" },
  cardLine: { display: "flex", alignItems: "center", gap: "6px", fontSize: "21px", color: "#64748B", marginBottom: "5px" },
  staffBadge: {
    display: "flex", alignItems: "center", gap: "5px",
    background: "#FFFBEB", color: "#D97706",
    borderRadius: "999px", padding: "5px 11px",
    fontSize: "19px", fontWeight: "700",
  },
  btnEdit: {
    width: "32px", height: "32px", borderRadius: "999px", border: "none",
    background: "#F1F5F9", color: "#64748B",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s, color 0.15s",
  },
  empty: { textAlign: "center", padding: "60px 20px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "24px" },
};
