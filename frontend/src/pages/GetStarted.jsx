import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoTo } from "../components/PageTransition";
import { Check, Building2, User } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("gs-styles")) {
  const tag = document.createElement("style");
  tag.id = "gs-styles";
  tag.textContent = `
    @keyframes fadeInUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(tag);
}

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

function OptionCard({ icon: Icon, title, tagline, desc, bullets, accentColor, accentBg, onClick, delay }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff",
        border: `2px solid ${hov ? accentColor : "#E2E8F0"}`,
        borderRadius: "20px",
        padding: "36px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? `0 16px 48px rgba(0,0,0,0.1)` : "0 1px 6px rgba(0,0,0,0.05)",
        animation: `fadeInUp 0.55s ease ${delay}ms both`,
        flex: "1 1 300px",
        maxWidth: "420px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top accent stripe */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: accentColor, borderRadius: "20px 20px 0 0" }} />

      <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
        <Icon size={26} color={accentColor} />
      </div>

      <p style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: accentColor, marginBottom: "8px" }}>
        {tagline}
      </p>
      <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", marginBottom: "12px", letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <p style={{ fontSize: "21px", color: "#64748B", lineHeight: 1.7, marginBottom: "20px" }}>
        {desc}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {bullets.map(b => (
          <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "20px", color: "#475569" }}>
            <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: accentBg, color: accentColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}><Check size={11} strokeWidth={3} /></span>
            {b}
          </li>
        ))}
      </ul>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: accentColor, fontWeight: "700", fontSize: "21px" }}>
        Get started <ArrowIcon />
      </div>
    </button>
  );
}

export default function GetStarted() {
  const goTo = useGoTo();

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#F0F7FF 0%,#F8FAFC 60%,#EFF6FF 100%)", display: "flex", flexDirection: "column" }}>

      {/* Navbar */}
      <nav style={{ height: "64px", background: "rgba(255,255,255,0.93)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 60px", boxSizing: "border-box", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer" }}>
          <img src="/logo_noText.png" alt="Krewby" style={{ height: "30px", objectFit: "contain" }} />
        </button>
        <button onClick={() => goTo("/login")} style={{ background: "none", border: "1.5px solid #E2E8F0", color: "#64748B", padding: "8px 18px", borderRadius: "9px", fontWeight: "600", fontSize: "21px", cursor: "pointer" }}>
          Already have an account? Log in
        </button>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 40px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "52px", animation: "fadeInUp 0.5s ease both" }}>
          <span style={{ display: "inline-block", fontSize: "18px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#3B82F6", background: "#EFF6FF", padding: "5px 14px", borderRadius: "100px", marginBottom: "20px", border: "1px solid #BFDBFE" }}>
            Join Krewby
          </span>
          <h1 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.03em", marginBottom: "14px" }}>
            How would you like to get started?
          </h1>
          <p style={{ fontSize: "21px", color: "#64748B", maxWidth: "480px", lineHeight: 1.7, margin: "0 auto" }}>
            Choose the option that best describes you. We'll set up the right experience from the start.
          </p>
        </div>

        {/* Option cards */}
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "center", maxWidth: "880px", width: "100%" }}>
          <OptionCard
            icon={Building2}
            tagline="For business owners"
            title="Register a Business"
            desc="You own or manage a business and want to use Krewby to handle your workforce — scheduling, attendance, worker management, and more."
            bullets={[
              "Set up your branches and team structure",
              "Manage schedules, attendance & leave",
              "Match workers to shifts by skills",
              "Access analytics and reports",
            ]}
            accentColor="#2563EB"
            accentBg="#EFF6FF"
            onClick={() => goTo("/register/business")}
            delay={100}
          />
          <OptionCard
            icon={User}
            tagline="For individuals"
            title="Create an Account"
            desc="You're a worker who has been invited by your manager to join Krewby. Create your personal account to access your shifts and schedule."
            bullets={[
              "View and manage your assigned shifts",
              "Submit leave and swap requests",
              "Receive real-time notifications",
              "Track your attendance history",
            ]}
            accentColor="#059669"
            accentBg="#ECFDF5"
            onClick={() => goTo("/register/account")}
            delay={180}
          />
        </div>

      </div>
    </div>
  );
}
