import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getUser } from "../utils/auth";

export default function NotificationsPage({ Layout }) {
  const user = getUser();
  const userId = user?.user_id;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("notification_id, type, title, message, is_read, created_at, related_entity, related_id")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false });
      if (!cancelled) { setNotifications(data || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function markRead(id) {
    await supabase.from("notifications").update({ is_read: true }).eq("notification_id", id);
    setNotifications(prev => prev.map(n =>
      n.notification_id === id ? { ...n, is_read: true } : n
    ));
  }

  async function markAllRead() {
    await supabase.from("notifications")
      .update({ is_read: true }).eq("recipient_id", userId).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  function getTypeIcon(type) {
    const map = {
      shift_assigned:   "📅",
      shift_published:  "📢",
      leave_approved:   "✅",
      leave_rejected:   "❌",
      swap_request:     "🔄",
      swap_approved:    "✅",
      swap_rejected:    "❌",
      attendance:       "📋",
      general:          "🔔",
    };
    return map[type] || "🔔";
  }

  function fmtTime(d) {
    if (!d) return "";
    const date = new Date(d);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString("en-SG", { month:"short", day:"numeric" });
  }

  return (
    <Layout title="Notifications">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Notifications</h2>
          <p style={s.sub}>{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button style={s.markAllBtn} onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      <div style={s.tabs}>
        {["all", "unread"].map(f => (
          <button key={f} style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "unread" && unreadCount > 0 && (
              <span style={s.badge}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Loading notifications…</div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyCard}>
          <p style={s.emptyIcon}>🔔</p>
          <p style={s.emptyTitle}>No {filter === "unread" ? "unread " : ""}notifications</p>
        </div>
      ) : (
        <div style={s.list}>
          {filtered.map(n => (
            <div key={n.notification_id}
              style={{ ...s.card, ...(n.is_read ? {} : s.cardUnread) }}
              onClick={() => !n.is_read && markRead(n.notification_id)}>
              <div style={s.icon}>{getTypeIcon(n.type)}</div>
              <div style={s.content}>
                <div style={s.contentTop}>
                  <p style={s.title}>{n.title}</p>
                  <span style={s.time}>{fmtTime(n.created_at)}</span>
                </div>
                {n.message && <p style={s.message}>{n.message}</p>}
              </div>
              {!n.is_read && <div style={s.unreadDot} />}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  markAllBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"8px", padding:"8px 14px", fontSize:"13px",
    fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  tabs: { display:"flex", gap:"4px", background:"#F0EDE8",
    padding:"4px", borderRadius:"10px", marginBottom:"16px", width:"fit-content" },
  tab: { padding:"6px 14px", background:"transparent", border:"none",
    borderRadius:"7px", fontSize:"13px", fontWeight:"500",
    color:"#7A7870", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" },
  tabActive: { background:"#FFFFFF", color:"#1C1B18", fontWeight:"600",
    boxShadow:"0 1px 3px rgba(0,0,0,0.08)" },
  badge: { background:"#EF4444", color:"#FFFFFF", fontSize:"10px",
    fontWeight:"700", padding:"1px 5px", borderRadius:"100px" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  emptyCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"60px", textAlign:"center" },
  emptyIcon: { fontSize:"32px", marginBottom:"10px" },
  emptyTitle: { fontSize:"16px", fontWeight:"600", color:"#7A7870" },
  list: { display:"flex", flexDirection:"column", gap:"8px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"12px",
    padding:"16px", display:"flex", alignItems:"flex-start", gap:"12px",
    cursor:"pointer", position:"relative" },
  cardUnread: { borderLeft:"3px solid #1C1B18" },
  icon: { fontSize:"20px", flexShrink:0, marginTop:"2px" },
  content: { flex:1 },
  contentTop: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", gap:"8px", marginBottom:"4px" },
  title: { fontSize:"14px", fontWeight:"600", color:"#1C1B18" },
  time: { fontSize:"11px", color:"#A09D97", flexShrink:0 },
  message: { fontSize:"13px", color:"#55524A", lineHeight:"1.5" },
  unreadDot: { width:"8px", height:"8px", borderRadius:"50%",
    background:"#1C1B18", flexShrink:0, marginTop:"6px" },
};
