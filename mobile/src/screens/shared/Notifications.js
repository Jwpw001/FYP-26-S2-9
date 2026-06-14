import React, { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUser } from "../../utils/auth";

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

  useEffect(() => {
    getUser().then((u) => {
      if (u?.user_id) { setUserId(u.user_id); load(u.user_id); }
    });
  }, []);

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
        <Text style={s.heading}>Notifications</Text>
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
