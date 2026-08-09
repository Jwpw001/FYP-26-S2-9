import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";
import { registerForPushNotificationsAsync } from "../../lib/push";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const TYPE_ICON = {
  shift_assigned:   "📅",
  shift_reminder:   "⏰",
  leave_approved:   "✅",
  leave_rejected:   "❌",
  swap_approved:    "✅",
  swap_rejected:    "❌",
  general:          "🔔",
};

export default function NotificationsScreen() {
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState(null);
  const [pushOn, setPushOn]   = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    getUser().then((u) => {
      if (u?.user_id) { setUserId(u.user_id); load(u.user_id); }
    });
    Notifications.getPermissionsAsync().then(({ status }) => setPushOn(status === "granted"));
  }, []);

  async function togglePush() {
    if (pushBusy || pushOn) return;
    setPushBusy(true);
    setPushError("");
    try {
      await registerForPushNotificationsAsync();
      setPushOn(true);
    } catch (err) {
      setPushError(err.message || "Couldn't enable push notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  async function load(uid) {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifs(data || []);
    setLoading(false);
    // Mark all as read
    await supabase.from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", uid)
      .eq("is_read", false);
  }

  function renderItem({ item }) {
    return (
      <View style={[s.item, !item.is_read && s.unread]}>
        <Text style={s.icon}>{TYPE_ICON[item.type] || "🔔"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{item.title || "Notification"}</Text>
          {!!item.message && <Text style={s.msg}>{item.message}</Text>}
          <Text style={s.time}>{fmtDate(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={s.dot} />}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={s.heading}>Notifications</Text>
          <TouchableOpacity
            onPress={togglePush}
            disabled={pushBusy || pushOn}
            style={[s.pushBtn, pushOn && s.pushBtnOn]}
          >
            <Feather name={pushOn ? "bell" : "bell-off"} size={14} color={pushOn ? "#1D4ED8" : "#64748B"} />
            <Text style={[s.pushBtnText, pushOn && s.pushBtnTextOn]}>
              {pushBusy ? "Enabling…" : pushOn ? "Push on" : "Enable push"}
            </Text>
          </TouchableOpacity>
        </View>
        {!!pushError && <Text style={s.pushError}>{pushError}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#2563EB" />
      ) : notifs.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(i) => String(i.notification_id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10 }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: "#F8FAFC" },
  header: { padding: 20, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  heading:{ fontSize: 20, fontWeight: "800", color: "#1E293B" },
  pushBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0",
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12,
  },
  pushBtnOn: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  pushBtnText: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  pushBtnTextOn: { color: "#1D4ED8" },
  pushError: { fontSize: 12, color: "#DC2626", marginTop: 8 },
  item: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#E2E8F0",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  unread: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },
  icon:   { fontSize: 22, marginTop: 1 },
  title:  { fontSize: 14, fontWeight: "700", color: "#1E293B", marginBottom: 2 },
  msg:    { fontSize: 13, color: "#475569", marginBottom: 4 },
  time:   { fontSize: 11, color: "#94A3B8" },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2563EB", marginTop: 6 },
  empty:  { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#64748B" },
});
