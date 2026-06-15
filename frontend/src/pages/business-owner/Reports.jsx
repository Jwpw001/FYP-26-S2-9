import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { BarChart2 } from "lucide-react";

export default function BOReports() {
  return (
    <BusinessOwnerLayout title="Reports">
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <BarChart2 size={48} color="#CBD5E1" />
        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#334155", marginTop: "16px" }}>Reports Coming Soon</h3>
        <p style={{ color: "#94A3B8", marginTop: "8px" }}>Consolidated reports across all outlets will appear here.</p>
      </div>
    </BusinessOwnerLayout>
  );
}
