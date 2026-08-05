import { useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2 } from "lucide-react";
import { Pricing } from "./Pricing";
import { api } from "../lib/api";

const PLANS = [
  {
    key: "free",
    name: "FREE",
    label: "Free",
    price: "0",
    yearlyPrice: "0",
    period: "/ month",
    tagline: "Get started at no cost",
    accent: "#64748B",
    accentLight: "#F8FAFC",
    isPopular: false,
    buttonText: "Current plan",
    description: "No credit card required",
    features: [
      "1 branch",
      "Up to 20 staff",
      "Shift scheduling",
      "Leave & swap requests",
      "Basic reports",
    ],
  },
  {
    key: "premium",
    name: "PREMIUM",
    label: "Premium",
    price: "60",
    yearlyPrice: "48",
    period: "/ month",
    tagline: "For growing businesses",
    accent: "#2563EB",
    accentLight: "#EFF6FF",
    isPopular: true,
    buttonText: "Upgrade to Premium",
    description: "Billed monthly, cancel anytime",
    features: [
      "1 branch",
      "Unlimited staff",
      "Everything in Free",
      "Advanced reports",
      "AI scheduling assistant",
      "Priority email support",
    ],
  },
  {
    key: "enterprise",
    name: "ENTERPRISE",
    label: "Enterprise",
    price: "120",
    yearlyPrice: "96",
    period: "/ month",
    tagline: "For multi-branch operations",
    accent: "#7C3AED",
    accentLight: "#F5F3FF",
    isPopular: false,
    buttonText: "Upgrade to Enterprise",
    description: "Custom onboarding included",
    features: [
      "Up to 2 businesses",
      "Unlimited branches",
      "Unlimited staff",
      "Everything in Premium",
      "Dedicated account manager",
      "Custom onboarding",
      "SLA & priority support",
    ],
  },
];

export function UpgradePlanModal({ currentPlan, onClose, onUpgraded }) {
  const [selected, setSelected] = useState(currentPlan || "free");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleUpgrade() {
    if (selected === currentPlan) { onClose(); return; }
    setSaving(true);
    try {
      await api.patch("/api/business/plan", { plan: selected });
      setDone(true);
      setTimeout(() => {
        onUpgraded?.(selected);
        onClose();
      }, 1200);
    } catch (err) {
      console.error("Plan upgrade failed:", err);
    } finally {
      setSaving(false);
    }
  }

  const selectedPlan = PLANS.find(p => p.key === selected);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#F8FAFC", borderRadius: "24px", width: "100%", maxWidth: "920px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", position: "relative" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 28px 20px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
          <div>
            <h2 style={{ fontSize: "23px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Upgrade your plan</h2>
            <p style={{ fontSize: "20px", color: "#64748B", margin: "2px 0 0" }}>
              Current plan: <strong style={{ textTransform: "capitalize", color: "#0F172A" }}>{currentPlan}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "10px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* Pricing */}
        <div style={{ padding: "28px 28px 8px" }}>
          <Pricing plans={PLANS} onSelect={setSelected} selectedKey={selected} />
        </div>

        {/* Footer CTA */}
        <div style={{ padding: "20px 28px 28px", background: "#fff", borderTop: "1px solid #F1F5F9", borderRadius: "0 0 24px 24px", position: "sticky", bottom: 0 }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "12px", fontSize: "22px", fontWeight: "700", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <CheckCircle2 size={18} color="#10B981" /> Plan updated to {selectedPlan?.label}!
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button onClick={onClose} style={{ padding: "12px 20px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#fff", fontSize: "21px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleUpgrade} disabled={saving || selected === currentPlan}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: selected === currentPlan ? "#E2E8F0" : selectedPlan?.accent || "#2563EB", color: selected === currentPlan ? "#94A3B8" : "#fff", fontSize: "22px", fontWeight: "700", cursor: selected === currentPlan ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
                {saving ? "Saving…" : selected === currentPlan ? "Already on this plan" : `Upgrade to ${selectedPlan?.label} →`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
