import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, RefreshControl, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import Badge from "../../components/Badge";
import Shimmer from "../../components/Shimmer";
import Toast from "../../components/Toast";

const LEAVE_TYPES = ["annual", "medical", "emergency"];
const FILTERS     = ["all", "pending", "approved", "rejected"];

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export default function LeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState("all");
  const [staffId, setStaffId]   = useState(null);
  const [userId, setUserId]     = useState(null);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [form, setForm]         = useState({ leave_type: "annual", start_date: "", end_date: "", reason: "" });

  function showToast(msg, type = "success") { setToast({ msg, type }); }

  const load = useCallback(async () => {
    const u = await getUser();
    if (!u) return;
    setUserId(u.user_id);
    const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", u.user_id).limit(1);
    const sid = myStaff?.[0]?.staff_id;
    setStaffId(sid);
    if (!sid) { setLoading(false); setRefreshing(false); return; }

    const query = supabase.from("availability")
      .select("*").eq("staff_id", sid).order("created_at", { ascending: false });
    const { data } = await query;
    let arr = data || [];
    if (filter !== "all") arr = arr.filter(r => r.status === filter);
    setRequests(arr);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function submitLeave() {
    if (!form.start_date || !form.end_date) { showToast("Please fill all fields.", "error"); return; }
    setSaving(true);
    try {
      await supabase.from("availability").insert({
        staff_id: staffId, leave_type: form.leave_type,
        start_date: form.start_date, end_date: form.end_date,
        reason: form.reason, status: "pending",
      });
      showToast("Leave request submitted!");
      setModal(false);
      setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
      load();
    } catch { showToast("Failed to submit.", "error"); }
    finally { setSaving(false); }
  }

  async function cancelRequest(id) {
    await supabase.from("availability").delete().eq("request_id", id);
    showToast("Request cancelled.");
    load();
  }

  function renderItem({ item }) {
    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.leaveType}>{item.leave_type?.charAt(0).toUpperCase() + item.leave_type?.slice(1)} Leave</Text>
            <Text style={s.dates}>{fmtDate(item.start_date)} → {fmtDate(item.end_date)}</Text>
            {item.reason ? <Text style={s.reason}>{item.reason}</Text> : null}
          </View>
          <Badge label={item.status} variant={item.status} />
        </View>
        {item.status === "pending" && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => cancelRequest(item.request_id)}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.heading}>Leave Requests</Text>
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
          keyExtractor={i => String(i.request_id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏖</Text>
              <Text style={s.emptyText}>No leave requests</Text>
            </View>
          }
        />
      )}

      {/* Submit modal */}
      <Modal visible={modal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Request Leave</Text>

            <Text style={s.label}>Leave Type</Text>
            <View style={s.typeRow}>
              {LEAVE_TYPES.map(t => (
                <TouchableOpacity key={t} style={[s.typeBtn, form.leave_type === t && s.typeBtnActive]} onPress={() => setForm(p => ({ ...p, leave_type: t }))}>
                  <Text style={[s.typeBtnText, form.leave_type === t && { color: "#fff" }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={form.start_date} onChangeText={v => setForm(p => ({ ...p, start_date: v }))} placeholder="2025-07-01" placeholderTextColor="#94A3B8" />

            <Text style={s.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={form.end_date} onChangeText={v => setForm(p => ({ ...p, end_date: v }))} placeholder="2025-07-03" placeholderTextColor="#94A3B8" />

            <Text style={s.label}>Reason (optional)</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]} value={form.reason} onChangeText={v => setForm(p => ({ ...p, reason: v }))} placeholder="Briefly describe your reason..." placeholderTextColor="#94A3B8" multiline />

            <View style={s.sheetBtns}>
              <TouchableOpacity style={s.cancelSheetBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelSheetText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.7 }]} onPress={submitLeave} disabled={saving}>
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
  addBtn:  { backgroundColor: "#2563EB", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  filterWrap: { backgroundColor: "#fff", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: "#F1F5F9" },
  filterActive: { backgroundColor: "#2563EB" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  filterTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  leaveType: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  dates: { fontSize: 12, color: "#64748B", marginTop: 2 },
  reason: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  cancelBtn: { marginTop: 10, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#FEF2F2", borderRadius: 8 },
  cancelText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: "#64748B" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, padding: 13, fontSize: 14, color: "#1E293B", backgroundColor: "#F8FAFC", marginBottom: 14 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeBtn: { flex: 1, padding: 9, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center" },
  typeBtnActive: { backgroundColor: "#2563EB" },
  typeBtnText: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "capitalize" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 6 },
  cancelSheetBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelSheetText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  submitBtn: { flex: 1, padding: 13, borderRadius: 12, backgroundColor: "#2563EB", alignItems: "center" },
  submitText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
