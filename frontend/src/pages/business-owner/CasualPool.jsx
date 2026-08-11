import { useState, useEffect } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { api } from "../../lib/api";
import { Users, Copy, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import UserAvatar from "../../components/UserAvatar";

const STATUS_STYLE = {
  pending:  { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  approved: { bg: "#DCFCE7", color: "#166534", border: "#86EFAC" },
  rejected: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
};

export default function BOCasualPool() {
  const [workers,   setWorkers]   = useState([]);
  const [joinCode,  setJoinCode]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("pending");
  const [search,    setSearch]    = useState("");
  const [acting,    setActing]    = useState(null); // worker_id being acted on
  const [toast,     setToast]     = useState(null);
  const [regen,     setRegen]     = useState(false);
  const [copied,    setCopied]    = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [poolRes, codeRes] = await Promise.all([
          api.get("/api/casual/pool"),
          api.get("/api/casual/join-code").catch(() => ({ join_code: null })),
        ]);
        if (!cancelled) {
          setWorkers(poolRes.workers || []);
          setJoinCode(codeRes.join_code || null);
        }
      } catch { /* silently fail */ }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleApprove(workerId) {
    setActing(workerId);
    try {
      await api.post(`/api/casual/pool/${workerId}/approve`);
      setWorkers(prev => prev.map(w => w.casual_worker_id === workerId ? { ...w, status: "approved" } : w));
      showToast("Worker approved.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to approve.", "error");
    } finally { setActing(null); }
  }

  async function handleReject(workerId) {
    setActing(workerId);
    try {
      await api.post(`/api/casual/pool/${workerId}/reject`);
      setWorkers(prev => prev.map(w => w.casual_worker_id === workerId ? { ...w, status: "rejected" } : w));
      showToast("Worker rejected.");
    } catch (e) {
      showToast(e?.response?.data?.message || "Failed to reject.", "error");
    } finally { setActing(null); }
  }

  async function handleRegen() {
    setRegen(true);
    try {
      const res = await api.post("/api/casual/join-code/regenerate");
      setJoinCode(res.join_code);
      showToast("Join code regenerated.");
    } catch { showToast("Failed to regenerate.", "error"); }
    finally { setRegen(false); }
  }

  function copyCode() {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const filtered = workers
    .filter(w => tab === "all" || w.status === tab)
    .filter(w => !search ||
      w.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      w.email?.toLowerCase().includes(search.toLowerCase())
    );

  const pendingCount = workers.filter(w => w.status === "pending").length;

  return (
    <BusinessOwnerLayout title="Casual Pool">
      <div style={{ maxWidth: "860px", animation: "fadeIn 0.3s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A" }}>Casual Worker Pool</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
              Manage casual workers who want to join your business.
            </p>
          </div>

          {/* Join code card */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>Join Code</p>
              <p style={{ fontSize: "18px", fontWeight: "800", color: "#1E293B", letterSpacing: "0.1em", fontFamily: "monospace" }}>
                {joinCode || "—"}
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={copyCode} title="Copy code"
                style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #E2E8F0", background: copied ? "#DCFCE7" : "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {copied ? <CheckCircle2 size={15} color="#16A34A" /> : <Copy size={15} color="#64748B" />}
              </button>
              <button onClick={handleRegen} disabled={regen} title="Regenerate code"
                style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF", cursor: regen ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={15} color={regen ? "#CBD5E1" : "#64748B"} style={{ animation: regen ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs + search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            {[
              { key: "pending",  label: "Pending",  count: pendingCount },
              { key: "approved", label: "Approved" },
              { key: "rejected", label: "Rejected" },
              { key: "all",      label: "All" },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                  borderColor: tab === t.key ? "#6366F1" : "#E2E8F0",
                  background: tab === t.key ? "#EEF2FF" : "#FFF",
                  color: tab === t.key ? "#4F46E5" : "#64748B" }}>
                {t.label}{t.count > 0 ? ` (${t.count})` : ""}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search workers…"
            style={{ padding: "7px 12px", borderRadius: "9px", border: "1px solid #E2E8F0", fontSize: "13px", outline: "none", width: "180px" }} />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[0,1,2].map(i => <div key={i} style={{ height: "72px", borderRadius: "12px", background: "#F1F5F9" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center" }}>
            <Users size={36} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: "15px", fontWeight: "600", color: "#94A3B8" }}>No {tab !== "all" ? tab : ""} workers</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map(w => {
              const st = STATUS_STYLE[w.status] || STATUS_STYLE.pending;
              const isBusy = acting === w.casual_worker_id;
              return (
                <div key={w.casual_worker_id}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                  <UserAvatar name={w.full_name} url={w.avatar_url} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", margin: 0 }}>{w.full_name || "—"}</p>
                    <p style={{ fontSize: "12px", color: "#64748B", margin: "1px 0 0" }}>{w.email || ""}</p>
                  </div>
                  <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                    {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                  </span>
                  {w.status === "pending" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => handleApprove(w.casual_worker_id)} disabled={isBusy}
                        style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: isBusy ? "#BBF7D0" : "#22C55E", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: isBusy ? "default" : "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button onClick={() => handleReject(w.casual_worker_id)} disabled={isBusy}
                        style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: isBusy ? "#FECACA" : "#EF4444", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: isBusy ? "default" : "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "100px", right: "28px", zIndex: 9999, background: toast.type === "error" ? "#EF4444" : "#22C55E", color: "#FFF", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}
    </BusinessOwnerLayout>
  );
}
