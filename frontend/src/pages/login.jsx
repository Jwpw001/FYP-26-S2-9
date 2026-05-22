import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const roleRoutes = {
  system_admin: "/system-admin/dashboard",
  outlet_manager: "/outlet-manager/dashboard",
  regular_staff: "/regular-staff/dashboard",
  outlet_casual_staff: "/outlet-casual-staff/dashboard",
  krewby_coordinator: "/krewby-coordinator/dashboard",
  krewby_casual_worker: "/krewby-worker/dashboard",
};

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });

      if (authError) {
        setError(authError.message || "Invalid email or password");
        return;
      }

      const email = authData.user.email?.toLowerCase().trim();

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .ilike("email", email)
        .single();

      if (profileError || !profile) {
        console.log("Auth email:", email);
        console.log("Profile error:", profileError);
        setError(profileError?.message || "User profile not found in users table.");
        return;
}

      localStorage.setItem("user", JSON.stringify(profile));

      const route = roleRoutes[profile.role];

      if (!route) {
        setError(`No dashboard found for role: ${profile.role}`);
        return;
      }

      navigate(route);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.left}>
        <div>
          <div style={styles.logoBox}>K</div>
          <h1 style={styles.title}>Welcome to Krewby</h1>
          <p style={styles.description}>
            Manage shifts, staff availability, attendance, and workforce requests
            in one simple platform.
          </p>
        </div>
      </section>

      <section style={styles.right}>
        <form style={styles.card} onSubmit={handleLogin}>
          <h3 style={styles.cardTitle}>Log in</h3>
          <p style={styles.cardSub}>Enter your account details to continue.</p>

          {error && <div style={styles.error}>{error}</div>}

          <label style={styles.label}>Email address</label>
          <input
            style={styles.input}
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="example@krewby.com"
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />

          <button style={styles.button} disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "#F7F6F3",
    color: "#1C1B18",
  },
  left: {
    background: "#2C2C2A",
    color: "#FFFFFF",
    padding: "80px",
    display: "flex",
    alignItems: "center",
  },
  logoBox: {
    width: "54px",
    height: "54px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "700",
    marginBottom: "24px",
  },
  title: {
    fontSize: "42px",
    marginBottom: "14px",
  },
  description: {
    fontSize: "16px",
    lineHeight: "1.7",
    color: "rgba(255,255,255,0.72)",
    maxWidth: "420px",
  },
  right: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
  },
  card: {
    width: "420px",
    background: "#FFFFFF",
    border: "1px solid #D8D5CE",
    borderRadius: "18px",
    padding: "34px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    fontSize: "28px",
    marginBottom: "8px",
  },
  cardSub: {
    fontSize: "14px",
    color: "#7A7870",
    marginBottom: "24px",
  },
  label: {
    display: "block",
    fontSize: "13px",
    color: "#55524A",
    marginBottom: "7px",
    marginTop: "14px",
  },
  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #D8D5CE",
    borderRadius: "10px",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "#1C1B18",
  },
  button: {
    width: "100%",
    padding: "12px",
    marginTop: "24px",
    background: "#2C2C2A",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  error: {
    background: "#FCEBEB",
    color: "#A32D2D",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "14px",
  },
};