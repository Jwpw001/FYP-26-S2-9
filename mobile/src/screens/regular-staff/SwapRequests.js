import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal,
  ScrollView, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import Badge from "../../components/Badge";
import Shimmer from "../../components/Shimmer";
import Toast from "../../components/Toast";

const FILTERS = ["all", "pending", "approved", "rejected"];

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(t) { return t?.slice(0, 5) || ""; }

export default function SwapRequests() {
  const [requests, setRequests] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState("all");
  const [staffId, setStaffId]   = useState(null);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [reason, setReason]     = useState("");

  function showToast(msg, type = "success") { setToast({ msg, type }); }

  const load = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", u.user_id).limit(1);
    const sid = myStaff?.[0]?.staff_id;
    setStaffId(sid);
    if (!sid) { setLoading(false); setRefreshing(false); return; }

    const today = new Date().toISOString().split("T")[0];
    const [{ data: reqs }, { data: shifts }] = await Promise.all([
      supabase.from("swap_requests")
        .select(`swap_id, status, request_type, reason, created_at,
          requester_shift:shifts!swap_requests_requester_shift_id_fkey ( shift_id, title, shift_date, start_time, end_time )`)
        .eq("requester_id", sid)
        .order("created_at", { ascending: false }),
      supabase.from("shift_assignments")
        .select(`assignment_id, shifts ( shift_id, title, shift_date, start_time, end_time )`)
        .eq("staff_id", sid),
    ]);

    let arr = reqs || [];
    if (filter !== "all") arr = arr.filter(r => r.status === filter);
    setRequests(arr);
    setMyShifts((shifts || []).filter(s => s.shifts?.shift_date >= today));
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function submitSwap() {
    if (!selectedShift) { showToast("Please select a shift.", "error"); return; }
    setSaving(true);
    try {
      await supabase.from("swap_requests").insert({
        requester_id: staffId, requester_shift_id: selectedShift,
        request_type: "swap", reason, status: "pending",
      });
      showToast("Swap request submitted!");
      setModal(false);
      setSelectedShift(null);
      setReason("");
      load();
    } catch { showToast("Failed to submit.", "error"); }
    finally { setSaving(false); }
  }

  function renderItem({ item }) {
    const shift = item.requester_shift;
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.swapTitle}>{item.request_type === "swap" ? "Shift Swap" : "Drop Request"}</Text>
            {shift && (
              <Text style={s.shiftInfo}>
                {fmtDate(shift.shift_date)} · {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
              </Text>
            )}
            {item.reason ? <Text style={s.reason}>{item.reason}</Text> : null}
          </View>
          <Badge label={item.status} variant={item.status} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.heading}>Swap Requests</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModal(true)}>
          <Text style={s.addText}>+ Request</Text>
        </TouchableOpacity>
      </View>

      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f.charAt(0).toUpperCase()+f.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0,1,2].map(i => <Shimmer key={i} height={80} borderRadius={14} />)}
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={i => String(i.swap_id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔄</Text>
              <Text style={s.emptyText}>No swap requests</Text>
            </View>
          }
        />
      )}

      <Modal visible={modal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Request Shift Swap</Text>

            <Text style={s.label}>Select Your Shift</Text>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {myShifts.length === 0
                ? <Text style={{ color: "#94A3B8", fontSize: 13 }}>No upcoming shifts available.</Text>
                : myShifts.map(a => (
                  <TouchableOpacity
                    key={a.assignment_id}
                    style={[s.shiftOption, selectedShift === a.shifts?.shift_id && s.shiftOptionActive]}
                    onPress={() => setSelectedShift(a.shifts?.shift_id)}
                  >
                    <Text style={[s.shiftOptionText, selectedShift === a.shifts?.shift_id && { color: "#fff" }]}>
                      {fmtDate(a.shifts?.shift_date)} · {fmtTime(a.shifts?.start_time)} – {fmtTime(a.shifts?.end_time)}
                    </Text>
                    <Text style={[s.shiftOptionTitle, selectedShift === a.shifts?.shift_id && { color: "rgba(255,255,255,0.8)" }]}>
                      {a.shifts?.title}
                    </Text>
                  </TouchableOpacity>
                ))
              }
            </ScrollView>

            <Text style={[s.label, { marginTop: 14 }]}>Reason (optional)</Text>
            <View style={[s.input, { height: 70 }]}>
              <Text style={{ color: reason ? "#1E293B" : "#94A3B8", fontSize: 14 }} onPress={() => {}}>
                {reason || "Briefly describe your reason..."}
              </Text>
            </View>

            <View style={s.sheetBtns}>
              <TouchableOpacity style={s.cancelSheetBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelSheetText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.7 }]} onPress={submitSwap} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toast && <Toast message={toast.msg} type={toast.type} onHide={() => setToast(null)} />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#F8FAFC" },
  header:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  heading: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  addBtn:  { backgroundColor: "#7C3AED", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterWrap: { backgroundColor: "#fff", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: "#F1F5F9" },
  filterActive: { backgroundColor: "#7C3AED" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  swapTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  shiftInfo: { fontSize: 12, color: "#64748B", marginTop: 2 },
  reason: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#64748B" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, padding: 13, backgroundColor: "#F8FAFC", marginBottom: 14, justifyContent: "center" },
  shiftOption: { borderRadius: 10, borderWidth: 1.5, borderColor: "#E2E8F0", padding: 12, marginBottom: 8 },
  shiftOptionActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  shiftOptionText: { fontSize: 12, color: "#64748B", marginBottom: 2 },
  shiftOptionTitle: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelSheetBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelSheetText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  submitBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center" },
  submitText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
