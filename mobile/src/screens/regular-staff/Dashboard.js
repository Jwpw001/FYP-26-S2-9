import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import { useAuth } from "../../context/AuthContext";
import Shimmer from "../../components/Shimmer";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";

function fmtTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}
function fmtDay(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short" });
}
function fmtDayNum(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { day: "numeric" });
}
function canClockIn(startTime) {
  if (!startTime) return false;
  const [h, m] = startTime.split(":").map(Number);
  const t = new Date();
  t.setHours(h, m, 0, 0);
  return new Date() >= new Date(t.getTime() - 5 * 60 * 1000);
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function StaffDashboard({ navigation }) {
  const { signOut } = useAuth();
  const [user, setUserState]          = useState(null);
  const [upcomingShifts, setUpcoming] = useState([]);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [pendingSwaps, setPendingSwaps] = useState(0);
  const [todayShift, setTodayShift]   = useState(null);
  const [todayAttend, setTodayAttend] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [clockSaving, setClockSaving] = useState(false);
  const [toast, setToast]             = useState(null);

  function showToast(msg, type = "success") { setToast({ msg, type }); }

  const load = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    setUserState(u);
    const userId = u.user_id;
    try {
      const today = new Date().toISOString().split("T")[0];
      const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

      const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", userId).limit(1);
      const staffId = myStaff?.[0]?.staff_id;
      if (!staffId) { setLoading(false); setRefreshing(false); return; }

      const [{ data: assignments }, { data: leave }, { data: swaps }] = await Promise.all([
        supabase.from("shift_assignments")
          .select(`assignment_id, status, acknowledged,
            shifts ( shift_id, title, shift_date, start_time, end_time, status, outlets ( name ) ),
            attendance ( attendance_id, status, clock_in, clock_out )`)
          .eq("staff_id", staffId),
        supabase.from("availability").select("request_id").eq("staff_id", staffId).eq("status", "pending"),
        supabase.from("swap_requests").select("swap_id").eq("requester_id", staffId).eq("status", "pending"),
      ]);

      const all = assignments || [];
      const todayA = all.find(a => a.shifts?.shift_date === today && a.shifts?.status === "published");
      setTodayShift(todayA || false);
      setTodayAttend(todayA?.attendance?.[0] || null);

      const upcoming = all
        .filter(a => a.shifts?.shift_date > today && a.shifts?.shift_date <= in14)
        .sort((a, b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date))
        .slice(0, 5);
      setUpcoming(upcoming);
      setPendingLeave((leave || []).length);
      setPendingSwaps((swaps || []).length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClockIn() {
    if (!todayShift) return;
    setClockSaving(true);
    try {
      const now = new Date().toISOString();
      if (todayAttend?.attendance_id) {
        await supabase.from("attendance").update({ clock_in: now, status: "present" }).eq("attendance_id", todayAttend.attendance_id);
        setTodayAttend(p => ({ ...p, clock_in: now, status: "present" }));
      } else {
        const { data } = await supabase.from("attendance").insert({
          assignment_id: todayShift.assignment_id, status: "present",
          marked_by: user?.user_id, clock_in: now,
        }).select("attendance_id,status,clock_in,clock_out").single();
        setTodayAttend(data);
      }
      showToast("Clocked in successfully!");
    } catch { showToast("Failed to clock in.", "error"); }
    finally { setClockSaving(false); }
  }

  async function handleClockOut() {
    if (!todayAttend?.attendance_id) return;
    setClockSaving(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("attendance").update({ clock_out: now }).eq("attendance_id", todayAttend.attendance_id);
      setTodayAttend(p => ({ ...p, clock_out: now }));
      showToast("Clocked out successfully!");
    } catch { showToast("Failed to clock out.", "error"); }
    finally { setClockSaving(false); }
  }

  const clockInAllowed = todayShift && canClockIn(todayShift.shifts?.start_time);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋</Text>
          <Text style={s.sub}>Here's your schedule today.</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Stat cards */}
        <View style={s.statsRow}>
          {[
            { label: "Upcoming", value: upcomingShifts.length, emoji: "📅", color: "#2563EB", bg: "#EFF6FF" },
            { label: "Pending Leave", value: pendingLeave, emoji: "🏖", color: "#D97706", bg: "#FFFBEB" },
            { label: "Pending Swaps", value: pendingSwaps, emoji: "🔄", color: "#7C3AED", bg: "#F5F3FF" },
          ].map((c) => (
            <View key={c.label} style={[s.statCard, { flex: 1 }]}>
              {loading ? <Shimmer height={36} borderRadius={8} /> : (
                <>
                  <View style={[s.statIcon, { backgroundColor: c.bg }]}>
                    <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                  </View>
                  <Text style={[s.statVal, { color: c.color }]}>{c.value}</Text>
                  <Text style={s.statLabel}>{c.label}</Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Today's shift */}
        <View style={[s.section, todayShift && { borderColor: "#BFDBFE", backgroundColor: "#F0F9FF" }]}>
          <Text style={s.sectionTitle}>Today's Shift</Text>
          {loading ? <Shimmer height={60} borderRadius={10} style={{ marginTop: 12 }} /> :
           todayShift === false ? (
            <View style={s.emptyCenter}>
              <Text style={{ fontSize: 28 }}>😌</Text>
              <Text style={s.emptyTitle}>No shift today</Text>
              <Text style={s.emptyDesc}>Enjoy your day off!</Text>
            </View>
          ) : (
            <View>
              <View style={s.shiftRow}>
                <View style={s.dateBox}>
                  <Text style={s.dateBoxDay}>{fmtDay(todayShift.shifts?.shift_date)}</Text>
                  <Text style={s.dateBoxNum}>{fmtDayNum(todayShift.shifts?.shift_date)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.shiftTitle}>{todayShift.shifts?.title || "Shift"}</Text>
                  <Text style={s.shiftSub}>
                    {fmtTime(todayShift.shifts?.start_time)} – {fmtTime(todayShift.shifts?.end_time)}
                    {todayShift.shifts?.outlets?.name ? ` · ${todayShift.shifts.outlets.name}` : ""}
                  </Text>
                </View>
              </View>
              <View style={s.clockRow}>
                {todayAttend?.clock_in ? (
                  <View style={s.clockedIn}>
                    <Text>✅</Text>
                    <View>
                      <Text style={s.clockLabel}>Clocked In</Text>
                      <Text style={s.clockTime}>{fmtTime(todayAttend.clock_in?.slice(11, 16))}</Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.clockBtn, { backgroundColor: clockInAllowed ? "#16A34A" : "#D1FAE5" }]}
                    onPress={handleClockIn}
                    disabled={clockSaving || !clockInAllowed}
                  >
                    <Text style={[s.clockBtnText, !clockInAllowed && { color: "#6EE7B7" }]}>
                      {clockSaving ? "Clocking in…" : "Clock In"}
                    </Text>
                  </TouchableOpacity>
                )}
                {todayAttend?.clock_out ? (
                  <View style={s.clockedOut}>
                    <Text>🏁</Text>
                    <View>
                      <Text style={[s.clockLabel, { color: "#9F1239" }]}>Clocked Out</Text>
                      <Text style={[s.clockTime, { color: "#9F1239" }]}>{fmtTime(todayAttend.clock_out?.slice(11, 16))}</Text>
                    </View>
                  </View>
                ) : todayAttend?.clock_in ? (
                  <TouchableOpacity
                    style={[s.clockBtn, { backgroundColor: "#DC2626" }]}
                    onPress={handleClockOut}
                    disabled={clockSaving}
                  >
                    <Text style={s.clockBtnText}>{clockSaving ? "Clocking out…" : "Clock Out"}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* Upcoming shifts */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Upcoming Shifts</Text>
          {loading ? (
            [0,1,2].map(i => <Shimmer key={i} height={52} borderRadius={10} style={{ marginTop: 10 }} />)
          ) : upcomingShifts.length === 0 ? (
            <View style={s.emptyCenter}>
              <Text style={s.emptyDesc}>No upcoming shifts in the next 14 days.</Text>
            </View>
          ) : upcomingShifts.map((a) => (
            <View key={a.assignment_id} style={s.shiftItem}>
              <View style={s.smallDateBox}>
                <Text style={s.smallDay}>{fmtDay(a.shifts?.shift_date)}</Text>
                <Text style={s.smallNum}>{fmtDayNum(a.shifts?.shift_date)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{a.shifts?.title || "Shift"}</Text>
                <Text style={s.itemSub}>{fmtTime(a.shifts?.start_time)} – {fmtTime(a.shifts?.end_time)}{a.shifts?.outlets?.name ? ` · ${a.shifts.outlets.name}` : ""}</Text>
              </View>
              <Badge label={a.shifts?.status} variant={a.shifts?.status} />
            </View>
          ))}
        </View>
      </ScrollView>

      {toast && <Toast message={toast.msg} type={toast.type} onHide={() => setToast(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },
  header:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  greeting:{ fontSize: 18, fontWeight: "800", color: "#1E293B" },
  sub:     { fontSize: 13, color: "#64748B", marginTop: 2 },
  signOutBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#FEF2F2", borderRadius: 8 },
  signOutText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },
  scroll:  { padding: 16, gap: 14 },
  statsRow:{ flexDirection: "row", gap: 10 },
  statCard:{ backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "flex-start" },
  statIcon:{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statVal: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  statLabel:{ fontSize: 11, color: "#64748B", fontWeight: "600" },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1E293B", marginBottom: 12 },
  emptyCenter: { alignItems: "center", paddingVertical: 20 },
  emptyTitle:  { fontSize: 15, fontWeight: "700", color: "#1E293B", marginTop: 8 },
  emptyDesc:   { fontSize: 13, color: "#64748B", marginTop: 4 },
  shiftRow:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  dateBox:     { width: 52, backgroundColor: "#2563EB", borderRadius: 10, alignItems: "center", paddingVertical: 8 },
  dateBoxDay:  { fontSize: 10, fontWeight: "800", color: "#BFDBFE", textTransform: "uppercase" },
  dateBoxNum:  { fontSize: 20, fontWeight: "900", color: "#fff" },
  shiftTitle:  { fontSize: 15, fontWeight: "700", color: "#1E293B" },
  shiftSub:    { fontSize: 12, color: "#64748B", marginTop: 2 },
  clockRow:    { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  clockBtn:    { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  clockBtnText:{ fontSize: 14, fontWeight: "700", color: "#fff" },
  clockedIn:   { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#DCFCE7", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  clockedOut:  { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#FFF1F2", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  clockLabel:  { fontSize: 11, fontWeight: "600", color: "#166534" },
  clockTime:   { fontSize: 15, fontWeight: "800", color: "#166534" },
  shiftItem:   { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  smallDateBox:{ width: 44, backgroundColor: "#EFF6FF", borderRadius: 10, alignItems: "center", paddingVertical: 6 },
  smallDay:    { fontSize: 10, fontWeight: "700", color: "#2563EB", textTransform: "uppercase" },
  smallNum:    { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  itemTitle:   { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  itemSub:     { fontSize: 11, color: "#64748B", marginTop: 1 },
});
