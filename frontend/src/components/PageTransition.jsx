import { createContext, useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ── Inject keyframes at module load ── */
if (typeof document !== "undefined" && !document.getElementById("pt-styles")) {
  const tag = document.createElement("style");
  tag.id = "pt-styles";
  tag.textContent = `
    @keyframes curtainIn  { from{transform:translateX(-100%)} to{transform:translateX(0%)} }
    @keyframes curtainOut { from{transform:translateX(0%)}    to{transform:translateX(100%)} }
    @keyframes ptLogoIn   { from{opacity:0;transform:scale(0.6) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes ptLogoOut  { from{opacity:1;transform:scale(1)}  to{opacity:0;transform:scale(1.15)} }
    @keyframes dotPulse   { 0%,80%,100%{opacity:0.2;transform:scale(0.75)} 40%{opacity:1;transform:scale(1.25)} }
  `;
  document.head.appendChild(tag);
}

const TransitionCtx = createContext(null);

export function useGoTo() {
  return useContext(TransitionCtx);
}

export function PageTransitionProvider({ children }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("idle"); // idle | covering | uncovering
  const pending = useRef(null);

  function goTo(path, opts) {
    if (phase !== "idle") return;
    pending.current = { path, opts };
    setPhase("covering");
  }

  function handleAnimationEnd() {
    if (phase === "covering") {
      navigate(pending.current.path, pending.current.opts);
      setTimeout(() => setPhase("uncovering"), 100);
    } else if (phase === "uncovering") {
      setPhase("idle");
    }
  }

  return (
    <TransitionCtx.Provider value={goTo}>
      {children}

      {phase !== "idle" && (
        <div
          onAnimationEnd={handleAnimationEnd}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: `${phase === "covering" ? "curtainIn" : "curtainOut"} 0.32s cubic-bezier(.7,0,.3,1) forwards`,
          }}
        >
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "18px",
            animation: phase === "uncovering" ? "ptLogoOut 0.18s ease forwards" : "ptLogoIn 0.25s cubic-bezier(.34,1.56,.64,1) 0.12s both",
          }}>
            {/* Logo mark */}
            <div style={{
              width: "60px", height: "60px", borderRadius: "16px",
              background: "#3B82F6", color: "#fff",
              fontSize: "26px", fontWeight: "800",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 10px rgba(59,130,246,0.12), 0 0 0 20px rgba(59,130,246,0.06)",
              letterSpacing: "-0.02em",
            }}>
              K
            </div>

            {/* Loading dots */}
            <div style={{ display: "flex", gap: "7px" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: "#60A5FA",
                  animation: `dotPulse 1s ease-in-out ${i * 0.18}s infinite`,
                }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </TransitionCtx.Provider>
  );
}
