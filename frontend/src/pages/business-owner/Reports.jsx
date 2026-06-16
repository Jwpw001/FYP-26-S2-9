import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { BarChart2 } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-reports-styles")) {
  const style = document.createElement("style");
  style.id = "bo-reports-styles";
  style.textContent = `@keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`;
  document.head.appendChild(style);
}

export default function BOReports() {
  return (
    <BusinessOwnerLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Reports</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Consolidated reports across all outlets.</p>
        </div>
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "80px 20px", textAlign: "center" }}>
          <BarChart2 size={48} color="#CBD5E1" />
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#334155", marginTop: "16px" }}>Reports Coming Soon</h3>
          <p style={{ color: "#94A3B8", marginTop: "8px" }}>Staffing and shift coverage reports across all outlets will appear here.</p>
        </div>
      </div>
    </BusinessOwnerLayout>
  );
}
