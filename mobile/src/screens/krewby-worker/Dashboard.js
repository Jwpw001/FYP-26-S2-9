import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import { useAuth } from "../../context/AuthContext";
import Shimmer from "../../components/Shimmer";
import Badge from "../../components/Badge";

function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-SG", { weekday:"short", day:"numeric", month:"short" }) : ""; }
function fmtTime(t) { return t?.slice(0,5) || ""; }
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export default function WorkerDashboard() {
  const { signOut } = useAuth();
  const [user, setUserState]    = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [totalJobs, setTotal]   = useState(0);
  const [rating, setRating]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    setUserState(u);
    const today = new Date().toISOString().split("T")[0];
    const in7   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", u.user_id).limit(1);
    const staffId = myStaff?.[0]?.staff_id;

    if (staffId) {
      const { data: assignments, count } = await supabase.from("task_assignments")
        .select(`assignment_id, status,
          shifts ( shift_id, title, shift_date, start_time, end_time, status, branches ( name ) )`,
          { count: "exact" })
        .eq("staff_id", staffId);
      const all = assignments || [];
      setTotal(count || 0);
      const up = all.filter(a => a.shifts?.shift_date >= today && a.shifts?.shift_date <= in7)
        .sort((a,b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date));
      setUpcoming(up);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋</Text>
          <Text style={s.sub}>Krewby Worker</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Stats */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { flex: 1 }]}>
            {loading ? <Shimmer height={40} borderRadius={8} /> : (
              <>
                <Text style={s.statEmoji}>💼</Text>
                <Text style={s.statVal}>{totalJobs}</Text>
                <Text style={s.statLabel}>Total Jobs</Text>
              </>
            )}
          </View>
          <View style={[s.statCard, { flex: 1 }]}>
            {loading ? <Shimmer height={40} borderRadius={8} /> : (
              <>
                <Text style={s.statEmoji}>⭐</Text>
                <Text style={[s.statVal, { color: "#D97706" }]}>{rating ? rating.toFixed(1) : "—"}</Text>
                <Text style={s.statLabel}>Rating</Text>
              </>
            )}
          </View>
          <View style={[s.statCard, { flex: 1 }]}>
            {loading ? <Shimmer height={40} borderRadius={8} /> : (
              <>
                <Text style={s.statEmoji}>📅</Text>
                <Text style={[s.statVal, { color: "#2563EB" }]}>{upcoming.length}</Text>
                <Text style={s.statLabel}>This Week</Text>
              </>
            )}
          </View>
        </View>

        {/* Upcoming */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Upcoming Jobs (Next 7 Days)</Text>
          {loading ? (
            [0,1,2].map(i => <Shimmer key={i} height={64} borderRadius={10} style={{ marginTop: 10 }} />)
          ) : upcoming.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💼</Text>
              <Text style={s.emptyText}>No jobs this week</Text>
            </View>
          ) : upcoming.map(a => (
            <View key={a.assignment_id} style={s.jobItem}>
              <View style={{ flex: 1 }}>
                <Text style={s.jobTitle}>{a.shifts?.title || "Job"}</Text>
                <Text style={s.jobSub}>{fmtDate(a.shifts?.shift_date)} · {fmtTime(a.shifts?.start_time)} – {fmtTime(a.shifts?.end_time)}</Text>
                {a.shifts?.branches?.name && <Text style={s.outlet}>📍 {a.shifts.branches.name}</Text>}
              </View>
              <Badge label={a.status} variant={a.status} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  greeting: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#FEF2F2", borderRadius: 8 },
  signOutText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },
  scroll: { padding: 16, gap: 14 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "flex-start" },
  statEmoji: { fontSize: 20, marginBottom: 8 },
  statVal: { fontSize: 22, fontWeight: "800", color: "#1E293B", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  jobItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  jobTitle: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  jobSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  outlet: { fontSize: 11, color: "#64748B", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 24 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#64748B" },
});
