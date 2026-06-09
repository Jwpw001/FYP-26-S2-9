import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function StaffList() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const { data: currentUser, error: userError } = await supabase
          .from("users")
          .select("outlet_id")
          .eq("user_id", userId)
          .single();

        if (userError || !currentUser?.outlet_id) {
          console.error("Cannot find manager outlet:", userError);
          if (!cancelled) setStaff([]);
          return;
        }

        const outletId = currentUser.outlet_id;

        const { data: staffRows, error: staffError } = await supabase
          .from("users")
          .select("user_id, username, email, role, is_active, outlet_id")
          .eq("outlet_id", outletId)
          .in("role", ["regular_staff", "outlet_casual_staff"])
          .order("user_id", { ascending: true });

        if (staffError) {
          console.error("Staff loading error:", staffError);
          if (!cancelled) setStaff([]);
          return;
        }

        const mappedStaff = (staffRows || []).map((u) => ({
          staff_id: u.user_id,
          staff_type: u.role === "regular_staff" ? "regular" : "casual",
          is_active: u.is_active,
          users: {
            user_id: u.user_id,
            full_name: u.username,
            email: u.email,
          },
        }));

        if (!cancelled) setStaff(mappedStaff);
      } catch (err) {
        console.error("Unexpected staff loading error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (userId) {
      load();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filtered = staff.filter((s) => {
    const q = search.toLowerCase();

    const matchSearch =
      (s.users?.full_name?.toLowerCase() || "").includes(q) ||
      (s.users?.email?.toLowerCase() || "").includes(q);

    const matchType = filterType === "all" || s.staff_type === filterType;

    return matchSearch && matchType;
  });

  return (
    <ManagerLayout title="Staff">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Staff Members</h2>
          <p style={s.sub}>
            {staff.length} total · {staff.filter((m) => m.is_active).length} active
          </p>
        </div>

        <button
          style={s.addBtn}
          onClick={() => navigate("/outlet-manager/staff/new")}
        >
          + Add Staff
        </button>
      </div>

      <div style={s.filters}>
        <input
          style={s.search}
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          style={s.select}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="regular">Regular Staff</option>
          <option value="casual">Outlet Casual</option>
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Loading staff…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No staff found.</div>
      ) : (
        <div style={s.card}>
          <div style={s.tableHead}>
            <span>Name</span>
            <span>Email</span>
            <span>Type</span>
            <span>Status</span>
            <span></span>
          </div>

          {filtered.map((m) => (
            <div key={m.staff_id} style={s.row}>
              <div style={s.nameCell}>
                <div style={s.avatar}>
                  {m.users?.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <span style={s.name}>{m.users?.full_name || "—"}</span>
              </div>

              <span style={s.cell}>{m.users?.email || "—"}</span>

              <span>
                <span
                  style={{
                    ...s.tag,
                    background:
                      m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF",
                    color:
                      m.staff_type === "regular" ? "#1E40AF" : "#6B21A8",
                  }}
                >
                  {m.staff_type === "regular" ? "Regular" : "Casual"}
                </span>
              </span>

              <div style={s.statusCell}>
                <span
                  style={{
                    ...s.dot,
                    background: m.is_active ? "#22C55E" : "#D1D5DB",
                  }}
                />
                {m.is_active ? "Active" : "Inactive"}
              </div>

              <button
                style={s.viewBtn}
                onClick={() => navigate(`/outlet-manager/staff/${m.staff_id}`)}
              >
                View →
              </button>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

const s = {
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "12px",
  },
  heading: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#1C1B18",
  },
  sub: {
    fontSize: "13px",
    color: "#7A7870",
    marginTop: "2px",
  },
  addBtn: {
    background: "#1C1B18",
    color: "#FFFFFF",
    border: "none",
    padding: "10px 18px",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  search: {
    flex: 1,
    minWidth: "200px",
    padding: "9px 13px",
    border: "1.5px solid #D8D5CE",
    borderRadius: "9px",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "#1C1B18",
    boxSizing: "border-box",
  },
  select: {
    padding: "9px 13px",
    border: "1.5px solid #D8D5CE",
    borderRadius: "9px",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "#1C1B18",
    cursor: "pointer",
  },
  empty: {
    textAlign: "center",
    padding: "60px",
    color: "#7A7870",
    fontSize: "14px",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E5E2DC",
    borderRadius: "14px",
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
    padding: "10px 16px",
    background: "#F7F6F3",
    fontSize: "12px",
    fontWeight: "600",
    color: "#7A7870",
    gap: "8px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "2fr 2fr 1fr 1fr 80px",
    padding: "12px 16px",
    borderTop: "1px solid #F0EDE8",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "#1C1B18",
  },
  nameCell: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#E5E2DC",
    color: "#55524A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    flexShrink: 0,
  },
  name: {
    fontWeight: "600",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cell: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tag: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "100px",
    fontSize: "11px",
    fontWeight: "600",
  },
  statusCell: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "13px",
  },
  dot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  viewBtn: {
    background: "none",
    border: "1px solid #E5E2DC",
    borderRadius: "7px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: "600",
    color: "#1C1B18",
    cursor: "pointer",
  },
};