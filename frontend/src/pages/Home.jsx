import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <main style={styles.page}>
      <nav style={styles.navbar}>
        <h1 style={styles.logo}>Krewby</h1>

        <div style={styles.navLinks}>
          <a style={styles.link}>Home</a>
          <a style={styles.link}>Features</a>
          <a style={styles.link}>About</a>
          <a style={styles.link}>Contact</a>
        </div>

        <button
          style={styles.loginButton}
          onClick={() => navigate("/login")}
        >
          Log in
        </button>
      </nav>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h2 style={styles.title}>
            Simplify staffing.
            <br />
            Empower your team.
          </h2>

          <p style={styles.description}>
            Krewby helps businesses manage shifts, staff availability,
            attendance, and workforce requests in one simple platform.
          </p>

          <button
            style={styles.primaryButton}
            onClick={() => navigate("/login")}
          >
            Get Started
          </button>
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background: "#F7F6F3",
    color: "#1C1B18",
    margin: 0,
    padding: 0,
    overflowX: "hidden",
  },

  navbar: {
    width: "100%",
    height: "80px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E2DC",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 80px",
    boxSizing: "border-box",
  },

  logo: {
    fontSize: "38px",
    fontWeight: "800",
    margin: 0,
  },

  navLinks: {
    display: "flex",
    gap: "40px",
  },

  link: {
    textDecoration: "none",
    color: "#1C1B18",
    fontSize: "16px",
    cursor: "pointer",
  },

  loginButton: {
    background: "#242424",
    color: "#FFFFFF",
    border: "none",
    padding: "14px 28px",
    borderRadius: "12px",
    fontWeight: "600",
    fontSize: "15px",
    cursor: "pointer",
  },

  hero: {
    width: "100%",
    minHeight: "calc(100vh - 80px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "0 30px",
    boxSizing: "border-box",
  },

  heroContent: {
    maxWidth: "900px",
  },

  title: {
    fontSize: "88px",
    lineHeight: "1.05",
    fontWeight: "800",
    marginBottom: "28px",
  },

  description: {
    fontSize: "24px",
    lineHeight: "1.7",
    color: "#5C5A55",
    marginBottom: "42px",
  },

  primaryButton: {
    background: "#242424",
    color: "#FFFFFF",
    border: "none",
    padding: "18px 38px",
    borderRadius: "14px",
    fontSize: "18px",
    fontWeight: "700",
    cursor: "pointer",
  },
};