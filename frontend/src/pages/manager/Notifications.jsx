import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { Bell, ClipboardList, Calendar, CheckCircle, RefreshCw, FileText, CalendarClock, UserCheck, CalendarX } from "lucide-react";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-notif-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-notif-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .notif-row:hover {
      background: #F0F7FF !important;
    }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24)  return `${diffHr}h ago`;
  if (diffDay < 7)  return `${diffDay}d ago`;
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function getNotifRoute(type, relatedEntity) {
  if (relatedEntity === "availability" || type?.includes("leave") || type?.includes("off_day")) return "/manager/availability";
  if (relatedEntity === "swap_requests" || type?.includes("swap")) return "/manager/availability";
  if (relatedEntity === "shifts" || type?.includes("shift") || type === "assignment" || type?.includes("assign")) return "/manager/shifts";
  if (relatedEntity === "reports" || type?.includes("report")) return "/manager/reports";
  return null;
}

export default function Notifications() {
  const user     = getUser();
  const userId   = user?.user_id;
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState("all"); // "all" | "unread"
  const [toast, setToast]                 = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("notification_id, type, title, message, related_entity, related_id, is_read, created_at")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false });
        if (error) console.error("notifications fetch error:", error);
        if (!cancelled) setNotifications(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function markRead(notifId, type, relatedEntity) {
    setNotifications(prev => prev.map(n =>
      n.notification_id === notifId ? { ...n, is_read: true } : n
    ));
    await supabase.from("notifications")
      .update({ is_read: true })
      .eq("notification_id", notifId);
    const route = getNotifRoute(type, relatedEntity);
    if (route) navigate(route);
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.notification_id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from("notifications")
      .update({ is_read: true })
      .in("notification_id", unreadIds);
    showToast("All notifications marked as read.");
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayed   = tab === "unread" ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <ManagerLayout title="Notifications">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Notifications</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: "#EFF6FF", border: "1px solid #BFDBFE",
                borderRadius: "9px", padding: "8px 16px",
                fontSize: "13px", fontWeight: "600", color: "#1D4ED8",
                cursor: "pointer",
              }}
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
          {[
            { value: "all",    label: "All" },
            { value: "unread", label: "Unread", badge: unreadCount || null },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              style={{
                padding: "7px 16px",
                background: tab === t.value ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: "7px", fontSize: "13px",
                fontWeight: tab === t.value ? "600" : "500",
                color: tab === t.value ? "#1E293B" : "#64748B",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
                boxShadow: tab === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {t.label}
              {t.badge && (
                <span style={{ background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "18px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <Shimmer w="10px" h="10px" r="50%" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="60%" h="15px" r="6px" />
                  <div style={{ marginTop: "8px" }}><Shimmer w="90%" h="12px" r="6px" /></div>
                  <div style={{ marginTop: "6px" }}><Shimmer w="80px" h="11px" r="6px" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ marginBottom: "10px", display: "flex", justifyContent: "center" }}><Bell size={36} color="#CBD5E1" /></div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>
              {tab === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {displayed.map((n, idx) => (
              <NotifRow
                key={n.notification_id}
                notif={n}
                onRead={() => markRead(n.notification_id, n.type, n.related_entity)}
                idx={idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "success" ? "#22C55E" : "#EF4444",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "toastIn 0.3s ease both",
        }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

function NotifRow({ notif, onRead, idx }) {
  const typeIconMap = {
    leave_decision:   <ClipboardList size={20} color="#64748B" />,
    leave_request:    <ClipboardList size={20} color="#64748B" />,
    off_day_request:  <CalendarClock size={20} color="#64748B" />,
    shift_published:  <Calendar size={20} color="#64748B" />,
    assignment:       <CheckCircle size={20} color="#64748B" />,
    swap_decision:    <RefreshCw size={20} color="#64748B" />,
    swap_request:     <RefreshCw size={20} color="#64748B" />,
    report_submitted: <FileText size={20} color="#64748B" />,
    casual_availability: <CalendarClock size={20} color="#64748B" />,
    shift_acknowledged: <UserCheck size={20} color="#64748B" />,
    shift_cancelled:  <CalendarX size={20} color="#64748B" />,
  };
  const icon = typeIconMap[notif.type] || <Bell size={20} color="#64748B" />;

  return (
    <div
      className="notif-row"
      onClick={onRead}
      style={{
        background: notif.is_read ? "#FFFFFF" : "#EFF6FF",
        border: `1px solid ${notif.is_read ? "#E2E8F0" : "#BFDBFE"}`,
        borderRadius: "12px",
        padding: "16px 18px",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "background 0.15s",
        animation: `fadeSlideUp 0.3s ease ${idx * 0.04}s both`,
      }}
    >
      {/* Unread dot */}
      <div style={{ paddingTop: "4px", flexShrink: 0 }}>
        {notif.is_read
          ? <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "transparent" }} />
          : <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563EB" }} />
        }
      </div>

      {/* Icon */}
      <div style={{ flexShrink: 0, lineHeight: 1, marginTop: "1px", display: "flex", alignItems: "center" }}>{icon}</div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <p style={{
            fontSize: "14px",
            fontWeight: notif.is_read ? "500" : "700",
            color: "#1E293B",
            margin: 0,
          }}>
            {notif.title}
          </p>
          <span style={{ fontSize: "11px", color: "#94A3B8", whiteSpace: "nowrap", flexShrink: 0 }}>
            {fmtTime(notif.created_at)}
          </span>
        </div>
        {notif.message && (
          <p style={{
            fontSize: "13px",
            color: "#64748B",
            marginTop: "3px",
            lineHeight: "1.45",
          }}>
            {notif.message}
          </p>
        )}
      </div>
    </div>
  );
}
