import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import SearchableSelect from "../../components/SearchableSelect";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, ChevronRight, Search, X } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sa-biz-kf")) {
  const st = document.createElement("style");
  st.id = "sa-biz-kf";
  st.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .biz-card{transition:box-shadow 0.18s,transform 0.18s,border-color 0.15s}
    .biz-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(37,99,235,0.1)!important;border-color:#BFDBFE!important}
    .filter-chip{transition:background 0.12s,border-color 0.12s,color 0.12s}
  `;
  document.head.appendChild(st);
}

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const PLAN_META = {
  free:       { label: "Free",       bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
  premium:    { label: "Premium",    bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  enterprise: { label: "Enterprise", bg: "#FDF4FF", color: "#9333EA", border: "#E9D5FF" },
};

const SORT_OPTIONS = [
  { value: "name_asc",     label: "Name (A → Z)" },
  { value: "name_desc",    label: "Name (Z → A)" },
  { value: "date_newest",  label: "Newest first" },
  { value: "date_oldest",  label: "Oldest first" },
  { value: "branch_most",  label: "Most branches" },
  { value: "branch_least", label: "Fewest branches" },
];

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [sort, setSort]             = useState("name_asc");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("businesses")
      .select("business_id, name, description, plan, created_at, branches(branch_id)");
    setBusinesses(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = businesses.filter(b => {
      const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.description || "").toLowerCase().includes(search.toLowerCase());
      const matchPlan = planFilter === "all" || (b.plan || "free") === planFilter;
      return matchSearch && matchPlan;
    });

    list = [...list].sort((a, b) => {
      const aC = a.branches?.length ?? 0;
      const bC = b.branches?.length ?? 0;
      if (sort === "name_asc")     return a.name.localeCompare(b.name);
      if (sort === "name_desc")    return b.name.localeCompare(a.name);
      if (sort === "date_newest")  return new Date(b.created_at) - new Date(a.created_at);
      if (sort === "date_oldest")  return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "branch_most")  return bC - aC;
      if (sort === "branch_least") return aC - bC;
      return 0;
    });

    return list;
  }, [businesses, search, planFilter, sort]);

  const planCounts = useMemo(() => {
    const counts = { all: businesses.length, free: 0, premium: 0, enterprise: 0 };
    businesses.forEach(b => { const p = b.plan || "free"; if (counts[p] !== undefined) counts[p]++; });
    return counts;
  }, [businesses]);

  const hasActiveFilters = search || planFilter !== "all" || sort !== "name_asc";

  function clearFilters() {
    setSearch("");
    setPlanFilter("all");
    setSort("name_asc");
  }

  return (
    <AdminLayout title="Businesses">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.3px" }}>Businesses</h2>
              <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
                {loading ? "Loading…" : `${businesses.length} business${businesses.length !== 1 ? "es" : ""} registered`}
              </p>
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters}
                style={{ display: "flex", alignItems: "center", gap: "5px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "6px 12px", fontSize: "19px", fontWeight: "600", color: "#EF4444", cursor: "pointer" }}>
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Search + Sort bar */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <Search size={14} color="#94A3B8" style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or description…"
              style={{ width: "100%", boxSizing: "border-box", paddingLeft: "36px", paddingRight: search ? "32px" : "14px", paddingTop: "10px", paddingBottom: "10px", border: "1.5px solid #E2E8F0", borderRadius: "11px", fontSize: "20px", color: "#1E293B", background: "#FFFFFF", outline: "none" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#94A3B8", display: "flex" }}>
                <X size={13} />
              </button>
            )}
          </div>
          <SearchableSelect
            options={SORT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
            value={sort}
            onChange={setSort}
            clearable={false}
            searchable={false}
            style={{ minWidth: "170px" }}
          />
        </div>

        {/* Plan filter chips */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "22px", flexWrap: "wrap" }}>
          {[
            { key: "all",        label: "All plans" },
            { key: "free",       label: "Free" },
            { key: "premium",    label: "Premium" },
            { key: "enterprise", label: "Enterprise" },
          ].map(({ key, label }) => {
            const active = planFilter === key;
            const pm = PLAN_META[key];
            return (
              <button key={key} className="filter-chip" onClick={() => setPlanFilter(key)}
                style={{
                  padding: "6px 14px", borderRadius: "100px", fontSize: "19px", fontWeight: "700", cursor: "pointer",
                  background: active ? (pm?.bg ?? "#0F172A") : "#F8FAFC",
                  color:      active ? (pm?.color ?? "#FFFFFF") : "#64748B",
                  border:     `1.5px solid ${active ? (pm?.border ?? "#0F172A") : "#E2E8F0"}`,
                }}>
                {label}
                <span style={{ marginLeft: "5px", opacity: 0.6, fontWeight: "500" }}>
                  {planCounts[key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                  <Shimmer w="52px" h="52px" r="12px" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="60%" h="16px" r="6px" />
                    <div style={{ marginTop: "8px" }}><Shimmer w="80%" h="12px" r="5px" /></div>
                  </div>
                </div>
                <Shimmer w="110px" h="28px" r="8px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "80px", textAlign: "center" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Building2 size={28} color="#3B82F6" />
            </div>
            <p style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
              {search || planFilter !== "all" ? "No results found" : "No businesses yet"}
            </p>
            <p style={{ fontSize: "20px", color: "#94A3B8" }}>
              {search || planFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Register a business to start creating branches for managers."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px" }}>
            {filtered.map((biz, i) => {
              const branchCount = biz.branches?.length ?? 0;
              const color = avatarColor(biz.name);
              const plan = biz.plan || "free";
              const pm = PLAN_META[plan] ?? PLAN_META.free;
              return (
                <div key={biz.business_id} className="biz-card"
                  onClick={() => navigate(`/system-admin/businesses/${biz.business_id}`)}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.03}s both`, cursor: "pointer", display: "flex", flexDirection: "column", gap: "14px" }}>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "13px" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: color, color: "#FFF", fontSize: "23px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {biz.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "22px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>{biz.name}</p>
                        <span style={{ padding: "2px 8px", borderRadius: "100px", fontSize: "17px", fontWeight: "700", background: pm.bg, color: pm.color, border: `1px solid ${pm.border}`, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {pm.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "19px", color: "#94A3B8", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {biz.description || <span style={{ fontStyle: "italic" }}>No description</span>}
                      </p>
                    </div>
                    <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0, marginTop: "3px" }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 12px", background: branchCount > 0 ? "#EFF6FF" : "#F8FAFC", borderRadius: "10px", border: `1px solid ${branchCount > 0 ? "#BFDBFE" : "#E2E8F0"}`, flex: 1 }}>
                      <MapPin size={12} color={branchCount > 0 ? "#2563EB" : "#CBD5E1"} />
                      <span style={{ fontSize: "19px", fontWeight: "700", color: branchCount > 0 ? "#2563EB" : "#94A3B8" }}>
                        {branchCount} {branchCount === 1 ? "branch" : "branches"}
                      </span>
                    </div>
                    {biz.created_at && (
                      <span style={{ fontSize: "18px", color: "#CBD5E1", marginLeft: "10px", flexShrink: 0, fontWeight: "500" }}>
                        {new Date(biz.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
