import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import Shimmer from "../../components/Shimmer";
import Badge from "../../components/Badge";

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(t) { return t?.slice(0, 5) || ""; }

const FILTERS = ["upcoming", "past", "all"];

export default function MyShifts() {
  const [shifts, setShifts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState("upcoming");

  const load = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    const today = new Date().toISOString().split("T")[0];

    const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", u.user_id).limit(1);
    const staffId = myStaff?.[0]?.staff_id;
    if (!staffId) { setLoading(false); setRefreshing(false); return; }

    const query = supabase.from("task_assignments")
      .select(`assignment_id, status, acknowledged,
        shifts ( shift_id, title, shift_date, start_time, end_time, status, branches ( name ) ),
        attendance ( attendance_id, status, clock_in, clock_out )`)
      .eq("staff_id", staffId);

    const { data } = await query;
    const all = data || [];
    let filtered;
    if (filter === "upcoming") filtered = all.filter(a => a.shifts?.shift_date >= today).sort((a,b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date));
    else if (filter === "past") filtered = all.filter(a => a.shifts?.shift_date < today).sort((a,b) => b.shifts.shift_date.localeCompare(a.shifts.shift_date));
    else filtered = all.sort((a,b) => b.shifts?.shift_date.localeCompare(a.shifts?.shift_date));

    setShifts(filtered);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function renderItem({ item }) {
    const attend = item.attendance?.[0];
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.dateBox}>
            <Text style={s.dateDay}>{new Date(item.shifts?.shift_date).toLocaleDateString("en-SG", { weekday: "short" })}</Text>
            <Text style={s.dateNum}>{new Date(item.shifts?.shift_date).toLocaleDateString("en-SG", { day: "numeric" })}</Text>
            <Text style={s.dateMon}>{new Date(item.shifts?.shift_date).toLocaleDateString("en-SG", { month: "short" })}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.shiftTitle}>{item.shifts?.title || "Shift"}</Text>
            <Text style={s.shiftSub}>{fmtTime(item.shifts?.start_time)} – {fmtTime(item.shifts?.end_time)}</Text>
            {item.shifts?.branches?.name && <Text style={s.outlet}>📍 {item.shifts.branches.name}</Text>}
          </View>
          <Badge label={item.shifts?.status} variant={item.shifts?.status} />
        </View>
        {(attend?.clock_in || attend?.clock_out) && (
          <View style={s.attendRow}>
            {attend.clock_in  && <Text style={s.attendText}>🟢 In: {attend.clock_in?.slice(11,16)}</Text>}
            {attend.clock_out && <Text style={s.attendText}>🔴 Out: {attend.clock_out?.slice(11,16)}</Text>}
          </View>
        )}
        {!item.acknowledged && item.shifts?.status === "published" && (
          <View style={s.ackBanner}>
            <Text style={s.ackText}>Needs acknowledgement</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.heading}>My Shifts</Text>
        <View style={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0,1,2,3].map(i => <Shimmer key={i} height={80} borderRadius={14} />)}
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={i => String(i.assignment_id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyText}>No {filter} shifts found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },
  header:  { backgroundColor: "#fff", padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  heading: { fontSize: 20, fontWeight: "800", color: "#1E293B", marginBottom: 12 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: "#F1F5F9" },
  filterActive: { backgroundColor: "#2563EB" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  dateBox: { width: 48, backgroundColor: "#EFF6FF", borderRadius: 10, alignItems: "center", paddingVertical: 8 },
  dateDay: { fontSize: 10, fontWeight: "700", color: "#2563EB", textTransform: "uppercase" },
  dateNum: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  dateMon: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  shiftTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  shiftSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  outlet: { fontSize: 11, color: "#64748B", marginTop: 3 },
  attendRow: { flexDirection: "row", gap: 14, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  attendText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  ackBanner: { backgroundColor: "#FFFBEB", borderRadius: 8, padding: 6, marginTop: 8 },
  ackText: { fontSize: 11, color: "#92400E", fontWeight: "700", textAlign: "center" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#64748B" },
});
