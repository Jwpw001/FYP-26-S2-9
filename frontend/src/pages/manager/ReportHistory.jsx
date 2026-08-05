import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useGoTo } from "../../components/PageTransition";
import { ArrowLeft, History } from "lucide-react";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function ReportHistory() {
  const goTo = useGoTo();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/reports")
      .then(r => setRows(r.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <ManagerLayout title="Report History">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <button onClick={() => goTo("/manager/reports")}
            style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A" }}>Report History</h2>
            <p style={{ fontSize: "20px", color: "#64748B", marginTop: "2px" }}>All reports you have exported</p>
          </div>
        </div>

        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {loading ? (
            <p style={{ color: "#94A3B8", fontSize: "20px", textAlign: "center", padding: "32px 0" }}>Loading...</p>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <History size={36} color="#CBD5E1" style={{ marginBottom: "12px" }} />
              <p style={{ fontSize: "21px", fontWeight: "600", color: "#94A3B8" }}>No exports yet</p>
              <p style={{ fontSize: "20px", color: "#CBD5E1", marginTop: "4px" }}>Download a CSV or PDF from the Reports page to see history here.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "20px", minWidth: "500px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                    {["Title", "Format", "Period", "Downloaded"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: h === "Format" || h === "Downloaded" ? "center" : "left", fontSize: "18px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.report_id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                      <td style={{ padding: "12px", fontWeight: "600", color: "#1E293B" }}>{r.title || "Report"}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <span style={{ fontSize: "18px", fontWeight: "700", padding: "2px 10px", borderRadius: "100px", background: r.format === "pdf" ? "#FEF2F2" : "#F0FDF4", color: r.format === "pdf" ? "#DC2626" : "#16A34A", textTransform: "uppercase" }}>{r.format}</span>
                      </td>
                      <td style={{ padding: "12px", color: "#64748B", fontSize: "19px" }}>
                        {r.period_start?.slice(0, 10)} → {r.period_end?.slice(0, 10)}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center", color: "#94A3B8", fontSize: "19px", whiteSpace: "nowrap" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </ManagerLayout>
  );
}
