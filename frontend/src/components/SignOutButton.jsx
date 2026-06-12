import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { clearUser } from "../utils/auth";
import { useNavigate } from "react-router-dom";

export default function SignOutButton({ style: extraStyle = {} }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function doLogout() {
    await supabase.auth.signOut();
    clearUser();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setConfirm(true)}
        style={{
          width: "100%", padding: "8px", borderRadius: "8px", border: "none",
          fontSize: "13px", fontWeight: "600", cursor: "pointer",
          transition: "background 0.18s, color 0.18s",
          background: hovered ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
          color: hovered ? "#FCA5A5" : "rgba(255,255,255,0.55)",
          ...extraStyle,
        }}>
        Sign out
      </button>

      {confirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={() => setConfirm(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#FFF", borderRadius: "16px", padding: "32px 28px",
              width: "320px", textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>👋</div>
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "8px" }}>Sign out?</h3>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "24px" }}>You'll need to log in again to access your account.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setConfirm(false)}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px",
                  border: "1.5px solid #E2E8F0", background: "#F8FAFC",
                  fontSize: "14px", fontWeight: "600", color: "#64748B", cursor: "pointer",
                }}>
                Cancel
              </button>
              <button
                onClick={doLogout}
                style={{
                  flex: 1, padding: "10px", borderRadius: "10px",
                  border: "none", background: "#EF4444",
                  fontSize: "14px", fontWeight: "600", color: "#FFF", cursor: "pointer",
                }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
