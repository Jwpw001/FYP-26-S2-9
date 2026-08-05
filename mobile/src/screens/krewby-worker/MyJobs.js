import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import Shimmer from "../../components/Shimmer";
import Badge from "../../components/Badge";

const FILTERS = ["all","assigned","approved","completed","cancelled"];
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-SG", { weekday:"short", day:"numeric", month:"short", year:"numeric" }) : ""; }
function fmtTime(t) { return t?.slice(0,5) || ""; }

export default function WorkerMyJobs() {
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState("all");

  const load = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", u.user_id).limit(1);
    const staffId = myStaff?.[0]?.staff_id;
    if (!staffId) { setLoading(false); setRefreshing(false); return; }

    const { data } = await supabase.from("task_assignments")
      .select(`assignment_id, status,
        shifts ( shift_id, title, shift_date, start_time, end_time, status, branches ( name ) )`)
      .eq("staff_id", staffId)
      .order("assignment_id", { ascending: false });

    let arr = data || [];
    if (filter !== "all") arr = arr.filter(j => j.status === filter);
    setJobs(arr);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function renderItem({ item }) {
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.jobTitle}>{item.shifts?.title || "Job"}</Text>
            <Text style={s.jobDate}>{fmtDate(item.shifts?.shift_date)}</Text>
            <Text style={s.jobTime}>{fmtTime(item.shifts?.start_time)} – {fmtTime(item.shifts?.end_time)}</Text>
            {item.shifts?.branches?.name && <Text style={s.outlet}>📍 {item.shifts.branches.name}</Text>}
          </View>
          <Badge label={item.status} variant={item.status} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.heading}>My Jobs</Text>
      </View>
      <View style={s.filterWrap}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={f => f}
          contentContainerStyle={s.filterRow}
          renderItem={({ item: f }) => (
            <TouchableOpacity style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f.charAt(0).toUpperCase()+f.slice(1)}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0,1,2,3].map(i => <Shimmer key={i} height={88} borderRadius={14} />)}
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={i => String(i.assignment_id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💼</Text>
              <Text style={s.emptyText}>No {filter === "all" ? "" : filter} jobs found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { backgroundColor: "#fff", padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  heading: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  filterWrap: { backgroundColor: "#fff", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: "#F1F5F9" },
  filterActive: { backgroundColor: "#0F172A" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  jobTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
  jobDate: { fontSize: 12, color: "#64748B" },
  jobTime: { fontSize: 12, color: "#64748B", marginTop: 2 },
  outlet: { fontSize: 11, color: "#64748B", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#64748B" },
});
