import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Plus, Building2, MapPin, ArrowRight, Clock, Check, Calendar } from "lucide-react";
import { UpgradePlanModal } from "../../components/UpgradePlanModal";
import { SG_HOLIDAYS } from "../../data/sgHolidays";

if (typeof document !== "undefined" && !document.getElementById("bo-branch-styles")) {
  const style = document.createElement("style");
  style.id = "bo-branch-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .bo-branch-card { transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s; position: relative; overflow: hidden; }
    .bo-branch-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(217,119,6,0.14) !important; border-color: #FDE9C2 !important; }
    .bo-branch-card:hover .bo-branch-arrow { opacity: 1; transform: translateX(0); }
    .bo-branch-card:hover .bo-branch-icon { background: #F59E0B !important; }
    .bo-branch-card:hover .bo-branch-icon svg { stroke: #fff !important; }
    .bo-branch-arrow { opacity: 0; transform: translateX(-6px); transition: opacity 0.2s, transform 0.2s; }
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

  return (
    <BusinessOwnerLayout title="Branches">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Branches</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${branches.length} branch${branches.length !== 1 ? "es" : ""} across your business`}
            </p>
          </div>
          <button onClick={openWizard} style={s.btnPrimary}>
            <Plus size={15} /> Add Branch
          </button>
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
                          fontSize: "13px", fontWeight: "700",
                          background: done ? "#F59E0B" : active ? "#1E293B" : "#F1F5F9",
                          color: done ? "#1C1917" : active ? "#FFFFFF" : "#94A3B8",
                          transition: "all 0.2s",
                        }}>
                          {done ? <Check size={14} /> : num}
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: active ? "700" : "500", color: active ? "#1E293B" : "#94A3B8", whiteSpace: "nowrap" }}>{label}</span>
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

                  {/* Operating Days */}
                  <p style={s.sectionLabel}>Operating days</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" }}>
                    {DAYS.map((day, i) => {
                      const on = form.operating_days[i] === 1;
                      return (
                        <button key={day} type="button"
                          onClick={() => setForm(p => { const d = [...p.operating_days]; d[i] = d[i] ? 0 : 1; return { ...p, operating_days: d }; })}
                          style={{ padding: "7px 14px", borderRadius: "100px", border: `1.5px solid ${on ? "#F59E0B" : "#E2E8F0"}`, background: on ? "#FEF3C7" : "#F8FAFC", color: on ? "#92400E" : "#94A3B8", fontSize: "12px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s" }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Open / Close times */}
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

                  {/* Work Rules */}
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
                      <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>Allow overtime</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8" }}>Workers can be scheduled beyond standard hours</p>
                    </div>
                    <button type="button" onClick={() => setForm(p => ({ ...p, allow_overtime: !p.allow_overtime }))}
                      style={{ width: "40px", height: "22px", borderRadius: "11px", border: "none", background: form.allow_overtime ? "#F59E0B" : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: form.allow_overtime ? "21px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    </button>
                  </div>

                  {/* Public Holidays */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                    <Calendar size={13} color="#64748B" />
                    <p style={s.sectionLabel}>Public holidays</p>
                    <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "100px", background: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE", marginLeft: "4px" }}>SG 2026</span>
                  </div>
                  <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", maxHeight: "180px", overflowY: "auto" }}>
                    {form.holidays.map((h, i) => (
                      <div key={h.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderBottom: i < form.holidays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                        <div>
                          <p style={{ fontSize: "12px", fontWeight: "600", color: "#1E293B" }}>{h.name}</p>
                          <p style={{ fontSize: "10px", color: "#94A3B8" }}>{h.date}</p>
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

              {error && <p style={{ color: "#EF4444", fontSize: "13px", marginTop: "14px" }}>{error}</p>}

              {/* Footer actions */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "28px" }}>
                <button onClick={step === 1 ? closeWizard : () => setStep(s => s - 1)} style={s.btnSecondary}>
                  {step === 1 ? "Cancel" : "← Back"}
                </button>
                {step < 2 ? (
                  <button onClick={nextStep} style={s.btnPrimary}>
                    Next →
                  </button>
                ) : (
                  <button onClick={handleCreate} disabled={submitting} style={s.btnPrimary}>
                    {submitting ? "Creating…" : "Create Branch"}
                  </button>
                )}
              </div>
            </div>
          </div>
        , document.body)}

        {/* Branch list */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px" }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", display: "flex", gap: "16px" }}>
                <Shimmer w="52px" h="52px" r="12px" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="50%" h="17px" r="6px" />
                  <div style={{ marginTop: "10px" }}><Shimmer w="70%" h="13px" r="5px" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div style={s.empty}>
            <Building2 size={40} color="#CBD5E1" />
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>No branches yet</p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Create your first branch to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px" }}>
            {branches.map((o, i) => (
              <div key={o.branch_id} className="bo-branch-card" style={{ ...s.card, animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }} onClick={() => goTo(`/business-owner/branches/${o.branch_id}`)}>
                <div className="bo-branch-icon" style={s.cardIcon}><Building2 size={22} color="#D97706" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.cardName}>{o.name}</p>
                  {o.address
                    ? <p style={s.cardMeta}><MapPin size={13} /> {o.address}</p>
                    : <p style={s.cardMetaMuted}>No address set</p>}
                  {(o.open_time || o.close_time) && (
                    <p style={{ ...s.cardMeta, marginTop: "4px" }}>
                      <Clock size={12} /> {fmtTime(o.open_time)} – {fmtTime(o.close_time)}
                    </p>
                  )}
                </div>
                <ArrowRight className="bo-branch-arrow" size={18} color="#D97706" style={{ flexShrink: 0 }} />
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
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "20px", padding: "32px", width: "560px", maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" },
  stepTitle: { fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" },
  stepSub: { fontSize: "13px", color: "#64748B", marginBottom: "20px" },
  sectionLabel: { fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" },
  fieldGroup: { marginBottom: "14px" },
  label: { display: "flex", alignItems: "center", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  colLabel: { fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "#1E293B", background: "#FFFFFF" },
  card: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", display: "flex", gap: "16px", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer" },
  cardIcon: { width: "52px", height: "52px", borderRadius: "12px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" },
  cardName: { fontSize: "17px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardMeta: { display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#64748B", marginTop: "5px" },
  cardMetaMuted: { fontSize: "13px", color: "#94A3B8", marginTop: "5px" },
  empty: { textAlign: "center", padding: "60px 20px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px" },
};
