import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
  TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import Toast from "../../components/Toast";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function getWeekStart(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function weekLabel(ws) {
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  return `${ws.toLocaleDateString("en-SG",{day:"numeric",month:"short"})} – ${we.toLocaleDateString("en-SG",{day:"numeric",month:"short",year:"numeric"})}`;
}

function initDays() {
  return Object.fromEntries(DAYS.map(d => [d, { available: false, start_time: "09:00", end_time: "18:00" }]));
}

export default function CasualWeeklyAvailability() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [avail, setAvail]           = useState(initDays());
  const [staffId, setStaffId]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);

  function showToast(msg, type = "success") { setToast({ msg, type }); }

  const weekStart = getWeekStart(weekOffset);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const load = useCallback(async () => {
    setLoading(true);
    const u = await getUser();
    if (!u) return;
    const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", u.user_id).limit(1);
    const sid = myStaff?.[0]?.staff_id;
    setStaffId(sid);

    const fresh = initDays();
    if (sid) {
      const { data } = await supabase.from("staff_availability")
        .select("*").eq("staff_id", sid).eq("week_start", weekStartStr);
      (data || []).forEach(row => {
        if (fresh[row.day_of_week]) {
          fresh[row.day_of_week] = { available: true, start_time: row.start_time || "09:00", end_time: row.end_time || "18:00" };
        }
      });
    }
    setAvail(fresh);
    setLoading(false);
  }, [weekStartStr]);

  useEffect(() => { load(); }, [load]);

  function toggle(day) {
    setAvail(p => ({ ...p, [day]: { ...p[day], available: !p[day].available } }));
  }
  function setTime(day, field, val) {
    setAvail(p => ({ ...p, [day]: { ...p[day], [field]: val } }));
  }

  async function save() {
    if (!staffId) return;
    setSaving(true);
    try {
      await supabase.from("staff_availability").delete().eq("staff_id", staffId).eq("week_start", weekStartStr);
      const rows = DAYS.filter(d => avail[d].available).map(d => ({
        staff_id: staffId, week_start: weekStartStr, day_of_week: d,
        start_time: avail[d].start_time, end_time: avail[d].end_time,
      }));
      if (rows.length > 0) await supabase.from("staff_availability").insert(rows);
      showToast("Availability saved!");
    } catch { showToast("Failed to save.", "error"); }
    finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.heading}>Weekly Availability</Text>
        <View style={s.weekNav}>
          <TouchableOpacity style={s.navBtn} onPress={() => setWeekOffset(p => p - 1)}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.weekLabel}>{weekLabel(weekStart)}</Text>
          <TouchableOpacity style={s.navBtn} onPress={() => setWeekOffset(p => p + 1)}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator color="#2563EB" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          {DAYS.map(day => (
            <View key={day} style={[s.dayCard, avail[day].available && s.dayCardActive]}>
              <View style={s.dayTop}>
                <Text style={[s.dayName, avail[day].available && s.dayNameActive]}>{day}</Text>
                <Switch
                  value={avail[day].available}
                  onValueChange={() => toggle(day)}
                  trackColor={{ false: "#E2E8F0", true: "#2563EB" }}
                  thumbColor="#fff"
                />
              </View>
              {avail[day].available && (
                <View style={s.timeRow}>
                  <View style={s.timeField}>
                    <Text style={s.timeLabel}>From</Text>
                    <TextInput
                      style={s.timeInput}
                      value={avail[day].start_time}
                      onChangeText={v => setTime(day, "start_time", v)}
                      placeholder="09:00"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <Text style={s.timeDash}>–</Text>
                  <View style={s.timeField}>
                    <Text style={s.timeLabel}>Until</Text>
                    <TextInput
                      style={s.timeInput}
                      value={avail[day].end_time}
                      onChangeText={v => setTime(day, "end_time", v)}
                      placeholder="18:00"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Availability</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onHide={() => setToast(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { backgroundColor: "#fff", padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  heading: { fontSize: 20, fontWeight: "800", color: "#1E293B", marginBottom: 12 },
  weekNav: { flexDirection: "row", alignItems: "center", gap: 10 },
  navBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  navArrow: { fontSize: 20, color: "#1E293B", fontWeight: "600" },
  weekLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: "#1E293B", textAlign: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 10, paddingBottom: 40 },
  dayCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0" },
  dayCardActive: { borderColor: "#2563EB", backgroundColor: "#F0F9FF" },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayName: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  dayNameActive: { color: "#1E293B" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginBottom: 4 },
  timeInput: { borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 10, padding: 10, fontSize: 15, fontWeight: "700", color: "#1E293B", textAlign: "center" },
  timeDash: { fontSize: 18, color: "#94A3B8", marginTop: 14 },
  saveBtn: { backgroundColor: "#2563EB", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 6, shadowColor: "#2563EB", shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
