import { useState, useEffect } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { api } from "../../lib/api";
import { Copy, RefreshCw, CheckCircle, XCircle, Users } from "lucide-react";

const TABS = ["pending", "approved", "rejected"];
const TAB_LABEL = { pending: "Pending Approval", approved: "Approved", rejected: "Rejected" };

export default function CasualPool() {
  const [workers, setWorkers]   = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab]           = useState("pending");
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(null);
  const [copied, setCopied]     = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { loadPool(); }, []);

  function loadPool() {
    setLoading(true);
    api.get("/api/casual/pool")
      .then(d => { setWorkers(d.workers || []); setJoinCode(d.join_code || ""); })
      .finally(() => setLoading(false));
  }

  async function approve(id) {
    setActing(id);
    try { await api.post(`/api/casual/pool/${id}/approve`, {}); loadPool(); }
    catch (err) { alert(err.message); }
    finally { setActing(null); }
  }

  async function reject(id) {
    if (!confirm("Reject this applicant?")) return;
    setActing(id);
    try { await api.post(`/api/casual/pool/${id}/reject`, {}); loadPool(); }
    catch (err) { alert(err.message); }
    finally { setActing(null); }
  }

  async function regenerateCode() {
    setRegenerating(true);
    try {
      const d = await api.post("/api/casual/join-code/regenerate", {});
      setJoinCode(d.join_code);
    } catch (err) { alert(err.message); }
    finally { setRegenerating(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const byTab = workers.filter(w => w.status === tab);
  const pendingCount = workers.filter(w => w.status === "pending").length;

  return (
    <BusinessOwnerLayout title="Casual Pool">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1C1B18" }}>Casual Worker Pool</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>Manage casual workers who have applied to join your business.</p>
        </div>

        {/* Join Code */}
        <div style={s.codeCard}>
          <p style={s.codeLabel}>Business Join Code</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={s.code}>{joinCode || "—"}</span>
            <button onClick={copyCode} title="Copy code" style={s.iconBtn}>
              {copied ? <CheckCircle size={15} color="#059669" /> : <Copy size={15} color="#64748B" />}
            </button>
            <button onClick={regenerateCode} disabled={regenerating} title="Generate new code" style={s.iconBtn}>
              <RefreshCw size={15} color="#64748B" style={{ animation: regenerating ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "#A09D97", marginTop: "4px" }}>Share this with casual workers so they can self-register.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", borderRadius: "99px", fontSize: "12px", fontWeight: "700", cursor: "pointer",
            border: `1.5px solid ${tab === t ? "#1C1B18" : "#E5E2DC"}`,
            background: tab === t ? "#1C1B18" : "#FFF",
            color: tab === t ? "#FFF" : "#64748B",
          }}>
            {TAB_LABEL[t]} {t === "pending" && pendingCount > 0 && `(${pendingCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3].map(i => <div key={i} style={{ height: "90px", background: "#F1F5F9", borderRadius: "14px" }} />)}
        </div>
      ) : byTab.length === 0 ? (
        <div style={s.empty}>
          <Users size={32} color="#CBD5E1" style={{ marginBottom: "10px" }} />
          <p style={{ fontSize: "15px", fontWeight: "700", color: "#1C1B18", marginBottom: "6px" }}>
            {tab === "pending" ? "No pending applications" : tab === "approved" ? "No approved workers yet" : "No rejected applications"}
          </p>
          <p style={{ fontSize: "13px", color: "#64748B" }}>
            {tab === "pending" ? "Share your join code with casual workers to get applications." : ""}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {byTab.map(w => (
            <WorkerCard
              key={w.id}
              worker={w}
              tab={tab}
              acting={acting === w.id}
              onApprove={() => approve(w.id)}
              onReject={() => reject(w.id)}
            />
          ))}
        </div>
      )}
    </BusinessOwnerLayout>
  );
}

function WorkerCard({ worker, tab, acting, onApprove, onReject }) {
  return (
    <div style={s.card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div style={s.avatar}>{worker.full_name?.[0]?.toUpperCase() || "?"}</div>
            <div>
              <p style={{ fontWeight: "700", color: "#1C1B18", fontSize: "15px" }}>{worker.full_name || "Unknown"}</p>
              <p style={{ fontSize: "12px", color: "#64748B" }}>{worker.email}</p>
            </div>
          </div>
          {worker.bio && <p style={{ fontSize: "13px", color: "#475569", marginTop: "8px", marginLeft: "42px", fontStyle: "italic" }}>"{worker.bio}"</p>}
          {worker.skills?.length > 0 && (
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px", marginLeft: "42px" }}>
              {worker.skills.map(sk => (
                <span key={sk} style={{ fontSize: "11px", background: "#F1F5F9", color: "#475569", borderRadius: "99px", padding: "2px 8px" }}>{sk}</span>
              ))}
            </div>
          )}
          <p style={{ fontSize: "11px", color: "#A09D97", marginTop: "8px", marginLeft: "42px" }}>
            Applied {new Date(worker.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        {tab === "pending" && (
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button onClick={onReject} disabled={acting} style={s.rejectBtn}>
              <XCircle size={14} /> {acting ? "…" : "Reject"}
            </button>
            <button onClick={onApprove} disabled={acting} style={s.approveBtn}>
              <CheckCircle size={14} /> {acting ? "…" : "Approve"}
            </button>
          </div>
        )}

        {tab === "approved" && (
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "99px", padding: "4px 10px", flexShrink: 0 }}>
            Approved
          </span>
        )}

        {tab === "rejected" && (
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "99px", padding: "4px 10px", flexShrink: 0 }}>
            Rejected
          </span>
        )}
      </div>
    </div>
  );
}

const s = {
  codeCard: { background: "#FFF", border: "1.5px solid #E5E2DC", borderRadius: "14px", padding: "16px 20px", minWidth: "220px" },
  codeLabel: { fontSize: "11px", fontWeight: "700", color: "#7A7870", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" },
  code: { fontFamily: "monospace", fontSize: "20px", fontWeight: "800", color: "#1C1B18", letterSpacing: "0.15em" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" },
  empty: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "60px 40px", textAlign: "center" },
  card: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "16px 20px" },
  avatar: { width: "34px", height: "34px", borderRadius: "50%", background: "#F1F5F9", color: "#475569", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  approveBtn: { display: "flex", alignItems: "center", gap: "5px", background: "#059669", color: "#FFF", border: "none", borderRadius: "9px", padding: "8px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer" },
  rejectBtn: { display: "flex", alignItems: "center", gap: "5px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "9px", padding: "8px 14px", fontSize: "12px", fontWeight: "700", cursor: "pointer" },
};
