import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// Minimal Switch built with inline styles
function Switch({ checked, onChange, switchRef }) {
  return (
    <button
      ref={switchRef}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: "44px", height: "24px", borderRadius: "100px",
        background: checked ? "#2563EB" : "#CBD5E1",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s", flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: "2px",
        left: checked ? "22px" : "2px",
        width: "20px", height: "20px", borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

export function Pricing({ plans, onSelect, selectedKey }) {
  const [isMonthly, setIsMonthly] = useState(true);
  const isDesktop = useIsDesktop();
  const switchRef = useRef(null);

  function handleToggle(checked) {
    setIsMonthly(!checked);
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight },
        colors: ["#2563EB", "#7C3AED", "#06B6D4", "#F59E0B"],
        ticks: 200, gravity: 1.2, decay: 0.94, startVelocity: 30, shapes: ["circle"],
      });
    }
  }

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "28px" }}>
        <span style={{ fontSize: "21px", fontWeight: "600", color: isMonthly ? "#0F172A" : "#94A3B8" }}>Monthly</span>
        <Switch checked={!isMonthly} onChange={handleToggle} switchRef={switchRef} />
        <span style={{ fontSize: "21px", fontWeight: "600", color: !isMonthly ? "#0F172A" : "#94A3B8" }}>
          Annual <span style={{ color: "#2563EB" }}>(Save 20%)</span>
        </span>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", alignItems: "start" }}>
        {plans.map((plan, index) => {
          const active = selectedKey === plan.key;
          const isPopular = plan.isPopular;
          const numPrice = isMonthly ? Number(plan.price) : Number(plan.yearlyPrice);

          return (
            <motion.div
              key={plan.key}
              initial={{ y: 30, opacity: 0 }}
              animate={{ opacity: 1, y: isDesktop ? (active ? -18 : 8) : 0, scale: active ? 1.02 : 0.97 }}
              transition={{ duration: 0.4, type: "spring", stiffness: 180, damping: 22 }}
              onClick={() => onSelect(plan.key)}
              style={{
                borderRadius: "18px",
                border: `2px solid ${active ? plan.accent : isPopular ? plan.accent + "66" : "#E2E8F0"}`,
                background: active ? plan.accentLight : "#fff",
                padding: "24px 20px",
                cursor: "pointer",
                position: "relative",
                boxShadow: active
                  ? `0 0 0 4px ${plan.accent}20, 0 8px 24px ${plan.accent}18`
                  : isPopular ? "0 4px 20px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
                transition: "border-color 0.2s, background 0.2s, box-shadow 0.2s",
                display: "flex", flexDirection: "column",
                marginTop: "20px",
              }}
            >
              {/* Popular badge */}
              {isPopular && (
                <div style={{ position: "absolute", top: "0", right: "0", background: plan.accent, color: "#fff", fontSize: "18px", fontWeight: "700", padding: "5px 12px", borderRadius: "0 16px 0 12px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Star size={11} fill="#fff" /> Popular
                </div>
              )}

              {/* Radio indicator */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <span style={{ fontSize: "18px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em", color: active ? plan.accent : "#94A3B8" }}>{plan.name}</span>
                <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${active ? plan.accent : "#CBD5E1"}`, background: active ? plan.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {active && <Check size={10} color="#fff" strokeWidth={3.5} />}
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: "4px", display: "flex", alignItems: "flex-end", gap: "2px" }}>
                <span style={{ fontSize: "20px", fontWeight: "700", color: active ? plan.accent : "#64748B", marginBottom: "6px" }}>S$</span>
                <span style={{ fontSize: "38px", fontWeight: "800", letterSpacing: "-0.04em", color: active ? plan.accent : "#0F172A", lineHeight: 1 }}>
                  <NumberFlow
                    value={numPrice}
                    transformTiming={{ duration: 450, easing: "ease-out" }}
                    willChange
                  />
                </span>
                <span style={{ fontSize: "19px", color: "#94A3B8", fontWeight: "500", marginBottom: "6px", marginLeft: "3px" }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: "18px", color: "#94A3B8", marginBottom: "6px" }}>{isMonthly ? "billed monthly" : "billed annually"}</p>

              <p style={{ fontSize: "19px", color: active ? plan.accent : "#64748B", fontWeight: "500", marginBottom: "16px" }}>{plan.tagline}</p>

              {/* Divider */}
              <div style={{ height: "1px", background: active ? `${plan.accent}28` : "#F1F5F9", marginBottom: "14px" }} />

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ width: "15px", height: "15px", borderRadius: "50%", background: active ? plan.accent : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                      <Check size={8} color={active ? "#fff" : "#94A3B8"} strokeWidth={3} />
                    </div>
                    <span style={{ fontSize: "19px", color: active ? "#1E293B" : "#64748B", lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(plan.key); }}
                style={{
                  marginTop: "20px", width: "100%", padding: "11px",
                  background: active ? plan.accent : isPopular ? plan.accent + "14" : "#F1F5F9",
                  color: active ? "#fff" : isPopular ? plan.accent : "#64748B",
                  border: `1.5px solid ${active ? plan.accent : isPopular ? plan.accent + "44" : "#E2E8F0"}`,
                  borderRadius: "10px", fontSize: "20px", fontWeight: "700", cursor: "pointer",
                  transition: "all 0.18s",
                }}
              >
                {plan.buttonText}
              </button>

              <p style={{ fontSize: "18px", color: "#94A3B8", textAlign: "center", marginTop: "10px", lineHeight: 1.5 }}>{plan.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
