import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getUser } from "../utils/auth";
import { ClipboardList, CheckCircle2, XCircle, Bell, BellOff, CalendarDays, RefreshCw, Megaphone, FileText, Building2, ClipboardCheck, UserCheck, UserX, CalendarX, CalendarClock } from "lucide-react";
import { isPushSupported, isSubscribed, subscribeToPush, unsubscribeFromPush } from "../lib/push";

if (typeof document !== "undefined" && !document.getElementById("shared-notif-styles")) {
  const style = document.createElement("style");
  style.id = "shared-notif-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position: 600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .shared-notif-row:hover { background: #F0F7FF !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24)  return `${diffHr}h ago`;
  if (diffDay < 7)  return `${diffDay}d ago`;
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

const TYPE_ICONS = {
  leave_decision:       ClipboardList,
  leave_approved:       CheckCircle2,
  leave_rejected:       XCircle,
  leave_request:        ClipboardList,
  off_day_request:      CalendarClock,
  off_day_decision:     CalendarClock,
  shift_published:      Megaphone,
  assignment:           CalendarDays,
  shift_assigned:       CalendarDays,
  shift_unassigned:     CalendarX,
  shift_updated:        CalendarClock,
  shift_cancelled:      CalendarX,
  shift_acknowledged:   UserCheck,
  swap_decision:        RefreshCw,
  swap_request:         RefreshCw,
  swap_approved:        CheckCircle2,
  swap_rejected:        XCircle,
  attendance:           ClipboardList,
  report_submitted:     FileText,
  report_decision:      ClipboardCheck,
  report_reminder:      FileText,
  casual_availability:  CalendarClock,
  availability_reminder: CalendarClock,
  casual_approved:      UserCheck,
  casual_rejected:      UserX,
  casual_assigned:      CalendarDays,
  business_registered:  Building2,
  general:              Bell,
};

function getNotifRoute(type, relatedEntity, role) {
  const isManager      = role === "manager";
  const isRegular      = role === "regular_staff";
  const isCasual       = role === "casual_staff";
  const isOwner        = role === "business_owner";

  if (relatedEntity === "availability" || type?.includes("leave") || type?.includes("off_day")) {
    if (isManager) return "/manager/availability";
    if (isRegular) return "/regular-staff/leave";
    return null;
  }
  if (relatedEntity === "swap_requests" || type?.includes("swap")) {
    if (isManager)  return "/manager/availability";
    if (isRegular)  return "/regular-staff/swaps";
    if (isCasual)   return "/casual-staff/swap-requests";
    return null;
  }
  if (relatedEntity === "shifts" || type?.includes("shift") || type === "assignment" || type?.includes("assign")) {
    if (isManager) return "/manager/shifts";
    if (isRegular) return "/regular-staff/shifts";
    if (isCasual)  return "/casual-staff/shifts";
    return null;
  }
  if (relatedEntity === "reports" || type?.includes("report")) {
    if (isManager) return "/manager/reports";
    if (isOwner)   return "/business-owner/reports";
    return null;
  }
  if (relatedEntity === "businesses" || type === "business_registered") {
    return "/admin/businesses";
  }
  return null;
}

export default function NotificationsPage({ Layout }) {
  const user     = getUser();
  const userId   = user?.user_id;
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState("all");
  const [toast, setToast]                 = useState(null);
  const [pushOn, setPushOn]               = useState(false);
  const [pushBusy, setPushBusy]           = useState(false);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!isPushSupported()) return;
    isSubscribed().then(setPushOn);
  }, []);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        showToast("Push notifications turned off.");
      } else {
        await subscribeToPush();
        setPushOn(true);
        showToast("Push notifications turned on.");
      }
    } catch (err) {
      showToast(err.message || "Couldn't update push notifications.");
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select("notification_id, type, title, message, related_entity, related_id, is_read, created_at")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      if (!cancelled) { setNotifications(data || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function markRead(notifId, type, relatedEntity) {
    setNotifications(prev => prev.map(n =>
      n.notification_id === notifId ? { ...n, is_read: true } : n
    ));
    await supabase.from("notifications")
      .update({ is_read: true }).eq("notification_id", notifId);
    const route = getNotifRoute(type, relatedEntity, user?.role);
    if (route) navigate(route);
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.notification_id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from("notifications")
      .update({ is_read: true }).in("notification_id", unreadIds);
    showToast("All notifications marked as read.");
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const displayed   = tab === "unread" ? notifications.filter(n => !n.is_read) : notifications;

  return (
    <Layout title="Notifications">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Notifications</h2>
            <p style={{ fontSize: "20px", color: "#64748B", marginTop: "2px" }}>
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {isPushSupported() && (
              <button onClick={togglePush} disabled={pushBusy}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: pushOn ? "#EFF6FF" : "#F8FAFC",
                  border: `1px solid ${pushOn ? "#BFDBFE" : "#E2E8F0"}`,
                  borderRadius: "9px", padding: "8px 16px", fontSize: "20px", fontWeight: "600",
                  color: pushOn ? "#1D4ED8" : "#64748B", cursor: pushBusy ? "default" : "pointer",
                  opacity: pushBusy ? 0.6 : 1,
                }}>
                {pushOn ? <Bell size={16} /> : <BellOff size={16} />}
                {pushOn ? "Push on" : "Enable push"}
              </button>
            )}
            {unreadCount > 0 && (
              <button onClick={markAllRead}
                style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "9px", padding: "8px 16px", fontSize: "20px", fontWeight: "600", color: "#1D4ED8", cursor: "pointer" }}>
                Mark all as read
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "20px", width: "fit-content" }}>
          {[
            { value: "all",    label: "All" },
            { value: "unread", label: "Unread", badge: unreadCount || null },
          ].map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              style={{
                padding: "7px 16px", background: tab === t.value ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: "7px", fontSize: "20px",
                fontWeight: tab === t.value ? "600" : "500",
                color: tab === t.value ? "#1E293B" : "#64748B",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                boxShadow: tab === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>
              {t.label}
              {t.badge && (
                <span style={{ background: "#EF4444", color: "#FFF", fontSize: "17px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "18px", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <Shimmer w="10px" h="10px" r="50%" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="60%" h="15px" r="6px" />
                  <div style={{ marginTop: "8px" }}><Shimmer w="90%" h="12px" r="6px" /></div>
                  <div style={{ marginTop: "6px" }}><Shimmer w="80px" h="11px" r="5px" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><Bell size={36} color="#94A3B8" /></div>
            <p style={{ fontSize: "21px", fontWeight: "600", color: "#64748B" }}>
              {tab === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {displayed.map((n, idx) => (
              <div
                key={n.notification_id}
                className="shared-notif-row"
                onClick={() => markRead(n.notification_id, n.type, n.related_entity)}
                style={{
                  background: n.is_read ? "#FFFFFF" : "#EFF6FF",
                  border: `1px solid ${n.is_read ? "#E2E8F0" : "#BFDBFE"}`,
                  borderRadius: "12px", padding: "16px 18px",
                  display: "flex", gap: "14px", alignItems: "flex-start",
                  cursor: "pointer", transition: "background 0.15s",
                  animation: `fadeSlideUp 0.3s ease ${idx * 0.04}s both`,
                }}>
                <div style={{ paddingTop: "4px", flexShrink: 0 }}>
                  {n.is_read
                    ? <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "transparent" }} />
                    : <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563EB" }} />
                  }
                </div>
                <div style={{ flexShrink: 0, lineHeight: 1, marginTop: "1px" }}>
                  {(() => {
                    const Icon = TYPE_ICONS[n.type] || Bell;
                    return <Icon size={20} color="#475569" />;
                  })()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <p style={{ fontSize: "21px", fontWeight: n.is_read ? "500" : "700", color: "#1E293B", margin: 0 }}>
                      {n.title}
                    </p>
                    <span style={{ fontSize: "18px", color: "#94A3B8", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {fmtTime(n.created_at)}
                    </span>
                  </div>
                  {n.message && (
                    <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px", lineHeight: "1.45" }}>
                      {n.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: "#22C55E", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "21px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast}
        </div>
      )}
    </Layout>
  );
}
