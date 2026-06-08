import { useNavigate } from "react-router-dom";
import { getUser } from "../utils/auth";

const ROLE_ROUTES = {
  system_admin: "/system-admin/dashboard",
  outlet_manager: "/outlet-manager/dashboard",
  regular_staff: "/regular-staff/dashboard",
  outlet_casual_staff: "/outlet-casual-staff/dashboard",
  krewby_coordinator: "/krewby-coordinator/dashboard",
  krewby_casual_worker: "/krewby-worker/dashboard",
};

export default function Home() {
  const navigate = useNavigate();
  const user = getUser();

  function handleCTA() {
    if (user && ROLE_ROUTES[user.role]) {
      navigate(ROLE_ROUTES[user.role]);
    } else {
      navigate("/login");
    }
  }

  return (
    <main style={styles.page}>
      {/* ── Navbar ───────────────────────────────────────── */}
      <nav style={styles.navbar}>
        <span style={styles.logo}>Krewby</span>

        <div style={styles.navLinks}>
          <a href="#features" style={styles.link}>Features</a>
          <a href="#about" style={styles.link}>About</a>
          <a href="#contact" style={styles.link}>Contact</a>
        </div>

        <button style={styles.loginButton} onClick={handleCTA}>
          {user ? "Go to dashboard" : "Log in"}
        </button>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Smart Workforce Scheduling</div>

          <h1 style={styles.title}>
            Simplify staffing.
            <br />
            Empower your team.
          </h1>

          <p style={styles.description}>
            Krewby helps F&amp;B businesses manage shifts, staff availability,
            attendance, and workforce requests — all in one platform.
          </p>

          <div style={styles.ctaRow}>
            <button style={styles.primaryButton} onClick={handleCTA}>
              Get started
            </button>
            <a href="#features" style={styles.secondaryButton}>
              See features
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" style={styles.features}>
        <h2 style={styles.sectionTitle}>Everything you need to run your team</h2>
        <p style={styles.sectionSub}>
          Built for the real pace of F&amp;B operations.
        </p>
        <div style={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} style={styles.featureCard}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer id="contact" style={styles.footer}>
        <span style={styles.footerLogo}>Krewby</span>
        <span style={styles.footerText}>
          © {new Date().getFullYear()} Krewby · CSIT321 FYP-26-S2-9
        </span>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: "📅",
    title: "Smart Scheduling",
    desc: "Build and publish shift schedules with conflict detection and smart staff recommendations.",
  },
  {
    icon: "👥",
    title: "Role-Based Access",
    desc: "Separate dashboards and permissions for managers, staff, coordinators, and admins.",
  },
  {
    icon: "✅",
    title: "Attendance Tracking",
    desc: "Mark attendance, handle replacements, and keep a full audit trail of every shift.",
  },
  {
    icon: "🔔",
    title: "Real-Time Alerts",
    desc: "Instant notifications for shift changes, leave approvals, and swap requests.",
  },
  {
    icon: "🤝",
    title: "Krewby Workers",
    desc: "Request vetted external casual workers when your internal roster falls short.",
  },
  {
    icon: "📊",
    title: "Reports & Insights",
    desc: "Attendance, workload, and understaffed shift reports exportable in one click.",
  },
];

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#F7F6F3",
    color: "#1C1B18",
    overflowX: "hidden",
  },

  /* Navbar */
  navbar: {
    width: "100%",
    height: "64px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E2DC",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 64px",
    boxSizing: "border-box",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "-0.02em",
    color: "#1C1B18",
  },
  navLinks: {
    display: "flex",
    gap: "32px",
  },
  link: {
    color: "#55524A",
    fontSize: "15px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "color 0.15s",
  },
  loginButton: {
    background: "#1C1B18",
    color: "#FFFFFF",
    border: "none",
    padding: "9px 20px",
    borderRadius: "10px",
    fontWeight: "600",
    fontSize: "14px",
  },

  /* Hero */
  hero: {
    width: "100%",
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "80px 24px",
    boxSizing: "border-box",
  },
  heroContent: {
    maxWidth: "760px",
  },
  eyebrow: {
    display: "inline-block",
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#7A7870",
    background: "#EDEBE6",
    padding: "5px 14px",
    borderRadius: "100px",
    marginBottom: "28px",
  },
  title: {
    fontSize: "clamp(48px, 8vw, 80px)",
    lineHeight: "1.06",
    fontWeight: "800",
    letterSpacing: "-0.03em",
    color: "#1C1B18",
    marginBottom: "24px",
  },
  description: {
    fontSize: "18px",
    lineHeight: "1.7",
    color: "#5C5A55",
    marginBottom: "40px",
    maxWidth: "560px",
    margin: "0 auto 40px",
  },
  ctaRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryButton: {
    background: "#1C1B18",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 30px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "700",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    background: "transparent",
    color: "#1C1B18",
    border: "1.5px solid #D0CEC8",
    padding: "14px 30px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "600",
  },

  /* Features */
  features: {
    padding: "96px 64px",
    boxSizing: "border-box",
    background: "#FFFFFF",
    borderTop: "1px solid #E5E2DC",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: "clamp(24px, 4vw, 36px)",
    fontWeight: "800",
    letterSpacing: "-0.02em",
    color: "#1C1B18",
    marginBottom: "12px",
  },
  sectionSub: {
    fontSize: "17px",
    color: "#7A7870",
    marginBottom: "56px",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "24px",
    maxWidth: "1000px",
    margin: "0 auto",
    textAlign: "left",
  },
  featureCard: {
    background: "#F7F6F3",
    border: "1px solid #E5E2DC",
    borderRadius: "14px",
    padding: "24px",
    boxSizing: "border-box",
  },
  featureIcon: {
    fontSize: "24px",
    marginBottom: "14px",
    lineHeight: 1,
  },
  featureTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1C1B18",
    marginBottom: "8px",
  },
  featureDesc: {
    fontSize: "13px",
    color: "#7A7870",
    lineHeight: "1.6",
  },

  /* Footer */
  footer: {
    borderTop: "1px solid #E5E2DC",
    padding: "28px 64px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#FFFFFF",
    flexWrap: "wrap",
    gap: "12px",
  },
  footerLogo: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#1C1B18",
  },
  footerText: {
    fontSize: "13px",
    color: "#A09D97",
  },
};
