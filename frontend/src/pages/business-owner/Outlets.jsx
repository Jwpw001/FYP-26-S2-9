import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Plus, Building2, MapPin, ArrowRight, Clock } from "lucide-react";
import { UpgradePlanModal } from "../../components/UpgradePlanModal";
import { useBusinessContext } from "../../context/BusinessContext";

if (typeof document !== "undefined" && !document.getElementById("bo-outlet-styles")) {
  const style = document.createElement("style");
  style.id = "bo-outlet-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .bo-outlet-card { transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s; position: relative; overflow: hidden; }
    .bo-outlet-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(217,119,6,0.14) !important; border-color: #FDE9C2 !important; }
    .bo-outlet-card:hover .bo-outlet-arrow { opacity: 1; transform: translateX(0); }
    .bo-outlet-card:hover .bo-outlet-icon { background: #F59E0B !important; }
    .bo-outlet-card:hover .bo-outlet-icon svg { stroke: #fff !important; }
    .bo-outlet-arrow { opacity: 0; transform: translateX(-6px); transition: opacity 0.2s, transform 0.2s; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const EMPTY_FORM = { name: "", address: "", open_time: "08:00", close_time: "22:00", role_templates: [] };

export default function BOOutlets() {
  const { locationLabel } = useBusinessContext();
  const goTo = useGoTo();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [skills, setSkills] = useState([]);
  const [upgradeModal, setUpgradeModal] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/api/business/outlets")
      .then(d => setOutlets(d.outlets || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    api.get("/api/business/skills").then(r => setSkills(r.skills || []));
  }, []);

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
    if (step === 1 && !form.name.trim()) { setError("Outlet name is required."); return; }
    setError("");
    setStep(s => s + 1);
  }

  function toggleSkill(sk) {
    setForm(p => {
      const exists = p.role_templates.find(r => String(r.skill_id) === String(sk.skill_id));
      if (exists) {
        return { ...p, role_templates: p.role_templates.filter(r => String(r.skill_id) !== String(sk.skill_id)) };
      }
      return { ...p, role_templates: [...p.role_templates, { role_name: sk.name, skill_id: sk.skill_id, headcount: 1 }] };
    });
  }

  function updateHeadcount(skill_id, val) {
    setForm(p => ({
      ...p,
      role_templates: p.role_templates.map(r => String(r.skill_id) === String(skill_id) ? { ...r, headcount: val } : r),
    }));
  }

  const handleCreate = async () => {
    setSubmitting(true); setError("");
    try {
      await api.post("/api/business/outlets", {
        name: form.name.trim(),
        address: form.address.trim() || null,
        open_time: form.open_time + ":00",
        close_time: form.close_time + ":00",
        role_templates: form.role_templates.filter(r => r.role_name.trim()).map(r => ({
          role_name: r.role_name.trim(),
          skill_id: r.skill_id ? Number(r.skill_id) : null,
          headcount: Number(r.headcount) || 1,
        })),
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

  const STEPS = ["Basic Info", "Operating Hours", "Role Requirements"];

  return (
    <BusinessOwnerLayout title={`${locationLabel}s`}>
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>{locationLabel}s</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${outlets.length} outlet${outlets.length !== 1 ? "s" : ""} across your business`}
            </p>
          </div>
          <button onClick={openWizard} style={s.btnPrimary}>
            <Plus size={15} /> Add Outlet
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
                          {done ? "✓" : num}
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
                  <p style={s.stepSub}>Give your outlet a name and location.</p>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Outlet Name <span style={{ color: "#EF4444" }}>*</span></label>
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
                  <p style={s.stepSub}>Set the daily opening and closing times for this outlet.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div style={s.fieldGroup}>
                      <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Opening Time</label>
                      <input type="time" style={s.input} value={form.open_time} onChange={e => setForm(p => ({ ...p, open_time: e.target.value }))} />
                    </div>
                    <div style={s.fieldGroup}>
                      <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Closing Time</label>
                      <input type="time" style={s.input} value={form.close_time} onChange={e => setForm(p => ({ ...p, close_time: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "12px 14px", marginTop: "16px", fontSize: "13px", color: "#92400E" }}>
                    These hours are used by the smart scheduler to generate shift slots for your staff.
                  </div>
                </div>
              )}

              {/* Step 3 — Role Requirements */}
              {step === 3 && (
                <div style={{ animation: "fadeSlideUp 0.25s ease both" }}>
                  <h3 style={s.stepTitle}>Daily Role Requirements</h3>
                  <p style={s.stepSub}>Select the skills needed every day. Set headcount for each selected role.</p>

                  {/* Tag picker */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px", background: "#F8FAFC", borderRadius: "14px", padding: "16px", border: "1px solid #E2E8F0", minHeight: "80px" }}>
                    {skills.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "#94A3B8" }}>No skill tags available. Ask your system admin to create some.</p>
                    ) : skills.map(sk => {
                      const selected = form.role_templates.some(r => String(r.skill_id) === String(sk.skill_id));
                      return (
                        <button key={sk.skill_id} onClick={() => toggleSkill(sk)} style={{
                          padding: "6px 16px", borderRadius: "100px", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                          border: selected ? "2px solid #F59E0B" : "2px solid transparent",
                          background: selected ? "#FEF3C7" : "#E2E8F0",
                          color: selected ? "#92400E" : "#475569",
                          transition: "all 0.15s",
                        }}>
                          {selected && <span style={{ marginRight: "5px" }}>✓</span>}{sk.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Headcount for selected skills */}
                  {form.role_templates.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Set Headcount</p>
                      {form.role_templates.map(row => (
                        <div key={row.skill_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{row.role_name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button onClick={() => updateHeadcount(row.skill_id, Math.max(1, Number(row.headcount) - 1))} style={s.counterBtn}>−</button>
                            <span style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", minWidth: "24px", textAlign: "center" }}>{row.headcount}</span>
                            <button onClick={() => updateHeadcount(row.skill_id, Number(row.headcount) + 1)} style={s.counterBtn}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && <p style={{ color: "#EF4444", fontSize: "13px", marginTop: "14px" }}>{error}</p>}

              {/* Footer actions */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "28px" }}>
                <button onClick={step === 1 ? closeWizard : () => setStep(s => s - 1)} style={s.btnSecondary}>
                  {step === 1 ? "Cancel" : "← Back"}
                </button>
                {step < 3 ? (
                  <button onClick={nextStep} style={s.btnPrimary}>
                    Next →
                  </button>
                ) : (
                  <button onClick={handleCreate} disabled={submitting} style={s.btnPrimary}>
                    {submitting ? "Creating…" : "Create Outlet"}
                  </button>
                )}
              </div>
            </div>
          </div>
        , document.body)}

        {/* Outlet list */}
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
        ) : outlets.length === 0 ? (
          <div style={s.empty}>
            <Building2 size={40} color="#CBD5E1" />
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>No outlets yet</p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Create your first outlet to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px" }}>
            {outlets.map((o, i) => (
              <div key={o.outlet_id} className="bo-outlet-card" style={{ ...s.card, animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }} onClick={() => goTo(`/business-owner/outlets/${o.outlet_id}`)}>
                <div className="bo-outlet-icon" style={s.cardIcon}><Building2 size={22} color="#D97706" /></div>
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
                <ArrowRight className="bo-outlet-arrow" size={18} color="#D97706" style={{ flexShrink: 0 }} />
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
  counterBtn: { width: "28px", height: "28px", borderRadius: "7px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#1E293B", fontSize: "16px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "20px", padding: "32px", width: "560px", maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" },
  stepTitle: { fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" },
  stepSub: { fontSize: "13px", color: "#64748B", marginBottom: "20px" },
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
