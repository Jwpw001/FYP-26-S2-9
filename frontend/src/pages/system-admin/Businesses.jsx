import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, ChevronRight, Search, Users, X, SlidersHorizontal } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sa-biz-kf")) {
  const st = document.createElement("style");
  st.id = "sa-biz-kf";
  st.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .biz-card{transition:box-shadow 0.18s,transform 0.18s,border-color 0.15s}
    .biz-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,0.09)!important;border-color:#BFDBFE!important}
    .biz-card:hover .biz-card-accent{opacity:1}
    .biz-search:focus{border-color:#93C5FD!important;box-shadow:0 0 0 3px rgba(59,130,246,0.12)}
    .biz-filter-select:focus{border-color:#93C5FD!important;box-shadow:0 0 0 3px rgba(59,130,246,0.12)}
    .biz-clear:hover{background:#F1F5F9!important;color:#334155!important}
  `;
  document.head.appendChild(st);
}

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [industry, setIndustry]     = useState("all");
  const [sortBy, setSortBy]         = useState("name");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("businesses")
      .select("business_id, name, description, industry, created_at, outlets(outlet_id, staff(staff_id))")
      .order("name");
    setBusinesses(data || []);
    setLoading(false);
  }

  const industries = useMemo(() => {
    const set = new Set(businesses.map(b => b.industry).filter(Boolean));
    return Array.from(set).sort();
  }, [businesses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = businesses.filter(b => {
      const matchesQ = !q || b.name.toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q);
      const matchesIndustry = industry === "all" || b.industry === industry;
      return matchesQ && matchesIndustry;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "outlets") return (b.outlets?.length ?? 0) - (a.outlets?.length ?? 0);
      if (sortBy === "staff") {
        const sa = a.outlets?.reduce((s, o) => s + (o.staff?.length ?? 0), 0) ?? 0;
        const sb = b.outlets?.reduce((s, o) => s + (o.staff?.length ?? 0), 0) ?? 0;
        return sb - sa;
      }
      if (sortBy === "recent") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [businesses, search, industry, sortBy]);

  const totalOutlets = businesses.reduce((s, b) => s + (b.outlets?.length ?? 0), 0);
  const totalStaff = businesses.reduce((s, b) => s + (b.outlets?.reduce((os, o) => os + (o.staff?.length ?? 0), 0) ?? 0), 0);

  const hasFilters = search.trim() !== "" || industry !== "all";

  return (
    <AdminLayout title="Businesses">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Businesses</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
              {loading ? "Loading…" : `${businesses.length} business${businesses.length !== 1 ? "es" : ""} registered`}
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px", marginBottom: "20px" }}>
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={18} /></div>
            <div>
              <p style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>{loading ? "—" : businesses.length}</p>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", marginTop: "4px" }}>Businesses</p>
            </div>
          </div>
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#ECFDF5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MapPin size={18} /></div>
            <div>
              <p style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>{loading ? "—" : totalOutlets}</p>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", marginTop: "4px" }}>Outlets</p>
            </div>
          </div>
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px 18px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#FDF2F8", color: "#DB2777", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Users size={18} /></div>
            <div>
              <p style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>{loading ? "—" : totalStaff}</p>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", marginTop: "4px" }}>Staff</p>
            </div>
          </div>
        </div>

        {/* Search + filter bar */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={15} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search businesses by name or description…"
              className="biz-search"
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 36px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "13px", color: "#1E293B", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <SlidersHorizontal size={13} color="#94A3B8" style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <select value={industry} onChange={e => setIndustry(e.target.value)} className="biz-filter-select"
              style={{ appearance: "none", padding: "9px 30px 9px 32px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "13px", fontWeight: "600", color: "#374151", background: "#FFF", outline: "none", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}>
              <option value="all">All industries</option>
              {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "13px", fontWeight: "600", color: "#374151", background: "#FFF", outline: "none", cursor: "pointer" }}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="outlets">Sort: Most outlets</option>
            <option value="staff">Sort: Most staff</option>
            <option value="recent">Sort: Recently added</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setIndustry("all"); }} className="biz-clear"
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "9px 12px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s, color 0.15s" }}>
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                  <Shimmer w="52px" h="52px" r="12px" />
                  <div style={{ flex: 1 }}><Shimmer w="60%" h="16px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="80%" h="12px" r="5px" /></div></div>
                </div>
                <Shimmer w="100px" h="24px" r="8px" />
              </div>
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "80px", textAlign: "center" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Building2 size={28} color="#3B82F6" />
            </div>
            <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No businesses yet</p>
            <p style={{ fontSize: "13px", color: "#94A3B8" }}>Register a business to start creating outlets for managers.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "70px", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Search size={24} color="#CBD5E1" />
            </div>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No matches found</p>
            <p style={{ fontSize: "13px", color: "#94A3B8" }}>Try a different search term or clear the filters.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px" }}>
            {filtered.map((biz, i) => {
              const outletCount = biz.outlets?.length ?? 0;
              const staffCount = biz.outlets?.reduce((s, o) => s + (o.staff?.length ?? 0), 0) ?? 0;
              const color = avatarColor(biz.name);
              return (
                <div key={biz.business_id} className="biz-card"
                  onClick={() => navigate(`/system-admin/businesses/${biz.business_id}`)}
                  style={{ position: "relative", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 20px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${Math.min(i, 12) * 0.04}s both`, cursor: "pointer", overflow: "hidden" }}>

                  <div className="biz-card-accent" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: color, opacity: 0.85, transition: "opacity 0.18s" }} />

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "14px" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: color, color: "#FFF", fontSize: "18px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {biz.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{biz.name}</p>
                      {biz.industry && (
                        <span style={{ display: "inline-block", marginTop: "4px", fontSize: "10.5px", fontWeight: "700", color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: "100px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {biz.industry}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0, marginTop: "2px" }} />
                  </div>

                  {biz.description && (
                    <p style={{ fontSize: "12.5px", color: "#64748B", lineHeight: 1.5, marginBottom: "16px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "34px" }}>
                      {biz.description}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", padding: "9px 10px", background: outletCount > 0 ? "#EFF6FF" : "#F8FAFC", borderRadius: "9px", border: `1px solid ${outletCount > 0 ? "#BFDBFE" : "#E2E8F0"}` }}>
                      <MapPin size={13} color={outletCount > 0 ? "#2563EB" : "#94A3B8"} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: outletCount > 0 ? "#2563EB" : "#94A3B8" }}>
                        {outletCount} outlet{outletCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", padding: "9px 10px", background: staffCount > 0 ? "#F0FDF4" : "#F8FAFC", borderRadius: "9px", border: `1px solid ${staffCount > 0 ? "#BBF7D0" : "#E2E8F0"}` }}>
                      <Users size={13} color={staffCount > 0 ? "#16A34A" : "#94A3B8"} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: staffCount > 0 ? "#16A34A" : "#94A3B8" }}>
                        {staffCount} staff
                      </span>
                    </div>
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
