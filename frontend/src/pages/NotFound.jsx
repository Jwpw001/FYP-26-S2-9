import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoMark}>K</div>
        <p style={styles.code}>404</p>
        <h1 style={styles.title}>Page not found</h1>
        <p style={styles.sub}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button style={styles.button} onClick={() => navigate("/")}>
          Back to home
        </button>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F7F6F3",
    padding: "24px",
  },
  card: {
    textAlign: "center",
    padding: "52px 40px",
    background: "#FFFFFF",
    border: "1px solid #E5E2DC",
    borderRadius: "18px",
    maxWidth: "380px",
    width: "100%",
  },
  logoMark: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#1C1B18",
    color: "#FFFFFF",
    fontSize: "22px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  code: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#A09D97",
    letterSpacing: "0.08em",
    marginBottom: "10px",
    textTransform: "uppercase",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#1C1B18",
    marginBottom: "10px",
  },
  sub: {
    fontSize: "14px",
    color: "#7A7870",
    lineHeight: "1.6",
    marginBottom: "28px",
  },
  button: {
    background: "#1C1B18",
    color: "#FFFFFF",
    border: "none",
    padding: "11px 24px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
};
