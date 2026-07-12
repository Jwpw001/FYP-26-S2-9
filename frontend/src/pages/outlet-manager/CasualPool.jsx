import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { Users, Building2, Tag } from "lucide-react";

export default function CasualPool() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  useEffect(() => {
    api.get("/api/casual/manager/pool")
      .then(res => setWorkers(res.workers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = workers.filter(w =>
    !search || w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    w.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ManagerLayout title="Casual Pool">
      <div style={{ maxWidth: "860px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A" }}>Casual Pool</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
              Casual workers who have set this branch as a preferred location.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 14px" }}>
            <svg width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search workers…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "#1E293B", width: "180px" }} />
          </div>
        </div>

        {/* Count badge */}
        {!loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "99px", padding: "4px 12px" }}>
              {filtered.length} worker{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: "72px", borderRadius: "14px", background: "#F1F5F9", animation: "shimmer 1.4s infinite linear" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px" }}>
            <Users size={36} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "15px", fontWeight: "600", color: "#94A3B8" }}>
              {search ? "No workers match your search" : "No casual workers for this branch yet"}
            </p>
            <p style={{ fontSize: "13px", color: "#CBD5E1", marginTop: "6px" }}>
              Workers will appear here once they select this branch as preferred.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map(w => (
              <WorkerCard key={w.id} worker={w} />
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

function WorkerCard({ worker }) {
  const initials = worker.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div style={{
      background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px",
      padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {/* Avatar */}
      <div style={{
        width: "44px", height: "44px", borderRadius: "12px",
        background: "#EFF6FF", color: "#2563EB",
        fontSize: "15px", fontWeight: "700",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>{worker.full_name}</p>
        <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {worker.email}
        </p>
      </div>

      {/* Skills */}
      {worker.skills?.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "240px" }}>
          {worker.skills.slice(0, 3).map(skill => (
            <span key={skill} style={{
              fontSize: "11px", fontWeight: "600", color: "#7C3AED",
              background: "#F5F3FF", border: "1px solid #EDE9FE",
              borderRadius: "99px", padding: "3px 9px",
              display: "flex", alignItems: "center", gap: "4px",
            }}>
              <Tag size={10} /> {skill}
            </span>
          ))}
          {worker.skills.length > 3 && (
            <span style={{ fontSize: "11px", color: "#94A3B8", padding: "3px 6px" }}>+{worker.skills.length - 3}</span>
          )}
        </div>
      )}

      {/* Branch count */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
        <Building2 size={13} color="#94A3B8" />
        <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "500" }}>
          {worker.branch_count} branch{worker.branch_count !== 1 ? "es" : ""}
        </span>
      </div>
    </div>
  );
}
