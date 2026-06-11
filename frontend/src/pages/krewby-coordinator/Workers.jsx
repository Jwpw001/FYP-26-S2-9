import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

if (typeof document !== "undefined" && !document.getElementById("coord-workers-styles")) {
  const style = document.createElement("style");
  style.id = "coord-workers-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .worker-card:hover { border-color: #BAE6FD !important; box-shadow: 0 4px 14px rgba(14,165,233,0.1) !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
  );
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function CoordinatorWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all"); // all | active | inactive
  const [toast, setToast]     = useState(null);
  const [toggling, setToggling] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: workerRows, error } = await supabase
          .from("krewby_workers")
          .select("krewby_worker_id, user_id, preferred_location, rating, total_jobs, is_active")
          .order("krewby_worker_id");

        if (error) { console.error(error); return; }

        const userIds = [...new Set((workerRows || []).map(w => w.user_id))];
        let usersMap = {};
        if (userIds.length > 0) {
          const { data: userRows } = await supabase
            .from("users")
            .select("user_id, full_name, email, phone")
            .in("user_id", userIds);
          (userRows || []).forEach(u => { usersMap[u.user_id] = u; });
        }

        if (!cancelled) {
          setWorkers((workerRows || []).map(w => ({ ...w, user: usersMap[w.user_id] || null })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function toggleActive(workerId, current) {
    setToggling(workerId);
    const { error } = await supabase
      .from("krewby_workers")
      .update({ is_active: !current })
      .eq("krewby_worker_id", workerId);
    if (error) { showToast(error.message, "error"); }
    else {
      setWorkers(prev => prev.map(w => w.krewby_worker_id === workerId ? { ...w, is_active: !current } : w));
      showToast(!current ? "Worker activated." : "Worker deactivated.");
    }
    setToggling(null);
  }

  const filtered = workers.filter(w => {
    const name  = w.user?.full_name || w.user?.email || "";
    const email = w.user?.email || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "active" && w.is_active) || (filter === "inactive" && !w.is_active);
    return matchSearch && matchFilter;
  });

  const activeCount   = workers.filter(w => w.is_active).length;
  const inactiveCount = workers.length - activeCount;

  return (
    <CoordinatorLayout title="Workers">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Krewby Workers</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
            {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${workers.length} total`}
          </p>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
          {[
            { value: "all",      label: `All (${workers.length})` },
            { value: "active",   label: `Active (${activeCount})` },
            { value: "inactive", label: `Inactive (${inactiveCount})` },
          ].map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFFFFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ width: "100%", maxWidth: "360px", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", color: "#1E293B", background: "#FFF", outline: "none", marginBottom: "20px", boxSizing: "border-box" }}
        />

        {/* Workers grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "14px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="65%" h="14px" r="6px" />
                    <div style={{ marginTop: "7px" }}><Shimmer w="80%" h="11px" r="5px" /></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Shimmer w="60px" h="22px" r="100px" />
                  <Shimmer w="80px" h="22px" r="100px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>👷</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No workers found</p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "14px" }}>
            {filtered.map((w, i) => {
              const name  = w.user?.full_name || w.user?.email || "Unknown";
              const email = w.user?.email || "";
              const phone = w.user?.phone || "";
              const color = avatarColor(name);
              return (
                <div key={w.krewby_worker_id}
                  className="worker-card"
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", transition: "all 0.18s", animation: `fadeSlideUp 0.3s ease ${Math.min(i, 12) * 0.04}s both` }}>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: "700", flexShrink: 0 }}>
                      {name[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      <p style={{ fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: "16px", marginBottom: "14px", padding: "10px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <p style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B" }}>{w.total_jobs ?? 0}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Jobs</p>
                    </div>
                    <div style={{ width: "1px", background: "#F1F5F9" }} />
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <p style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B" }}>{w.rating ? Number(w.rating).toFixed(1) : "—"}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Rating</p>
                    </div>
                    {w.preferred_location && (
                      <>
                        <div style={{ width: "1px", background: "#F1F5F9" }} />
                        <div style={{ textAlign: "center", flex: 2 }}>
                          <p style={{ fontSize: "12px", fontWeight: "600", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.preferred_location}</p>
                          <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>Preferred area</p>
                        </div>
                      </>
                    )}
                  </div>

                  {phone && (
                    <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "12px" }}>📞 {phone}</p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: w.is_active ? "#DCFCE7" : "#F1F5F9", color: w.is_active ? "#166534" : "#64748B" }}>
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => toggleActive(w.krewby_worker_id, w.is_active)}
                      disabled={toggling === w.krewby_worker_id}
                      style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", cursor: "pointer", opacity: toggling === w.krewby_worker_id ? 0.5 : 1, transition: "all 0.15s" }}>
                      {toggling === w.krewby_worker_id ? "…" : w.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "20px" }}>
            Showing {filtered.length} of {workers.length} workers
          </p>
        )}

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </CoordinatorLayout>
  );
}
