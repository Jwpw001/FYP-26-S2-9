import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import WorkerLayout from "../../components/layout/WorkerLayout";
import { Briefcase, CheckCircle2, Star, Bell, Hand, MapPin, SmilePlus, Flag, CalendarDays, Check } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("worker-dash-styles")) {
  const style = document.createElement("style");
  style.id = "worker-dash-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .worker-stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.1) !important; }
    .worker-action-btn:hover { background:#EFF6FF !important; border-color:#BFDBFE !important; color:#1D4ED8 !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}
function fmtDay(d)    { return d ? new Date(d).toLocaleDateString("en-SG", { weekday: "short" }) : ""; }
function fmtDayNum(d) { return d ? new Date(d).toLocaleDateString("en-SG", { day: "numeric" }) : ""; }

function fmtTime(iso) {
  if (!iso) return null;
  const u = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(u).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
}

function canClockIn(startTime) {
  if (!startTime) return false;
  const [h, m] = startTime.split(":").map(Number);
  const shiftStart = new Date();
  shiftStart.setHours(h, m, 0, 0);
  return new Date() >= new Date(shiftStart.getTime() - 5 * 60 * 1000);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [profile, setProfile]           = useState(null);
  const [upcomingJobs, setUpcomingJobs] = useState([]);
  const [unread, setUnread]             = useState(0);
  const [loading, setLoading]           = useState(true);

  // Today's job & clock state
  const [todayJob, setTodayJob]         = useState(null);  // null=loading, false=none, obj=job
  const [clockSaving, setClockSaving]   = useState(false);
  const [toast, setToast]               = useState(null);
  const [nowTick, setNowTick]           = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

        // Step 1: get krewby_worker profile
        const { data: worker } = await supabase
          .from("krewby_workers")
          .select("krewby_worker_id, rating, total_jobs, preferred_location, is_active")
          .eq("user_id", userId)
          .single();

        if (!worker || cancelled) { setTodayJob(false); setLoading(false); return; }
        if (!cancelled) setProfile(worker);

        const wid = worker.krewby_worker_id;

        // Step 2: fetch all data in parallel using correct worker id
        const [assignRes, reqRes, { count: unreadCount }] = await Promise.all([
          supabase
            .from("shift_assignments")
            .select(`assignment_id, status, acknowledged, assigned_at,
              shifts ( shift_id, title, shift_date, start_time, end_time, status,
                outlets ( name, address ) ),
              attendance ( attendance_id, clock_in, clock_out, status )`)
            .eq("krewby_worker_id", wid)
            .order("assignment_id", { ascending: false }),
          supabase
            .from("krewby_requests")
            .select(`request_id, role_name, shift_date, start_time, end_time, status,
              clock_in, clock_out, override_note, outlets ( name, address )`)
            .eq("assigned_worker_id", wid)
            .in("status", ["assigned", "approved", "completed"])
            .order("shift_date", { ascending: false }),
          supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", userId)
            .eq("is_read", false),
        ]);

        if (cancelled) return;

        setUnread(unreadCount || 0);

        // Regular shift assignments (upcoming, next 14 days, not completed/cancelled)
        const regularUpcoming = (assignRes.data || [])
          .filter(j => j.shifts && j.shifts.shift_date >= today && j.shifts.shift_date <= in14 && !["completed", "cancelled"].includes(j.status))
          .sort((a, b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date))
          .map(j => ({ ...j, _type: "shift" }));

        // Krewby request jobs (upcoming, next 14 days, not completed/cancelled)
        const krewbyUpcoming = (reqRes.data || [])
          .filter(r => r.shift_date >= today && r.shift_date <= in14 && !["completed", "cancelled"].includes(r.status) && !r.clock_out)
          .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
          .map(r => ({
            _type: "krewby_request",
            assignment_id: `kr-${r.request_id}`,
            request_id: r.request_id,
            status: r.status,
            acknowledged: true,
            clock_in: r.clock_in,
            clock_out: r.clock_out,
            shifts: {
              title: r.role_name,
              shift_date: r.shift_date,
              start_time: r.start_time,
              end_time: r.end_time,
              outlets: r.outlets,
            },
          }));

        // Merge and de-dupe by date, cap at 5
        const allUpcoming = [...regularUpcoming, ...krewbyUpcoming]
          .sort((a, b) => (a.shifts?.shift_date || "").localeCompare(b.shifts?.shift_date || ""))
          .slice(0, 5);

        setUpcomingJobs(allUpcoming);

        // Today's job: prefer shift_assignments, fall back to krewby_request
        const todayRegular = (assignRes.data || []).find(
          j => j.shifts?.shift_date === today && j.shifts?.status === "published"
        );
        if (todayRegular) {
          setTodayJob({ _type: "shift", ...todayRegular });
        } else {
          const todayKrewby = (reqRes.data || []).find(r => r.shift_date === today);
          setTodayJob(todayKrewby ? { _type: "krewby_request", ...todayKrewby } : false);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Clock In ──────────────────────────────────────────────────────────────
  async function handleClockIn() {
    if (!todayJob) return;
    setClockSaving(true);
    try {
      const now = new Date().toISOString();
      if (todayJob._type === "shift") {
        const attend = todayJob.attendance?.[0];
        if (attend?.attendance_id) {
          await supabase.from("attendance")
            .update({ clock_in: now, status: "present" })
            .eq("attendance_id", attend.attendance_id);
        } else {
          const { data } = await supabase.from("attendance").insert({
            assignment_id: todayJob.assignment_id, status: "present",
            marked_by: userId, clock_in: now,
          }).select("attendance_id, status, clock_in, clock_out").single();
          setTodayJob(prev => ({ ...prev, attendance: [data] }));
        }
        setTodayJob(prev => ({
          ...prev,
          attendance: [{ ...(prev.attendance?.[0] || {}), clock_in: now, status: "present" }],
        }));
      } else {
        // krewby_request
        await supabase.from("krewby_requests")
          .update({ clock_in: now })
          .eq("request_id", todayJob.request_id);
        setTodayJob(prev => ({ ...prev, clock_in: now }));
      }
      showToast("Clocked in successfully!");
    } catch (err) {
      console.error(err);
      showToast("Failed to clock in.", "error");
    } finally {
      setClockSaving(false);
    }
  }

  // ── Clock Out ─────────────────────────────────────────────────────────────
  async function handleClockOut() {
    if (!todayJob) return;
    setClockSaving(true);
    try {
      const now = new Date().toISOString();
      if (todayJob._type === "shift") {
        const attend = todayJob.attendance?.[0];
        if (!attend?.attendance_id) return;
        await supabase.from("attendance")
          .update({ clock_out: now })
          .eq("attendance_id", attend.attendance_id);
        await supabase.from("shift_assignments")
          .update({ status: "completed" })
          .eq("assignment_id", todayJob.assignment_id);
        setTodayJob(prev => ({
          ...prev,
          status: "completed",
          attendance: [{ ...(prev.attendance?.[0] || {}), clock_out: now }],
        }));
      } else {
        await supabase.from("krewby_requests")
          .update({ clock_out: now, status: "completed" })
          .eq("request_id", todayJob.request_id);
        setTodayJob(prev => ({ ...prev, clock_out: now, status: "completed" }));
      }
      // Increment total_jobs atomically via DB function
      await supabase.rpc("increment_worker_total_jobs", { p_worker_id: profile.krewby_worker_id });
      setProfile(prev => ({ ...prev, total_jobs: (prev?.total_jobs ?? 0) + 1 }));

      // Remove completed job from the upcoming list immediately
      setUpcomingJobs(prev => prev.filter(j =>
        j._type === "krewby_request"
          ? j.request_id !== todayJob.request_id
          : j.assignment_id !== todayJob.assignment_id
      ));
      showToast("Clocked out successfully! Shift marked as done.");
    } catch (err) {
      console.error(err);
      showToast("Failed to clock out.", "error");
    } finally {
      setClockSaving(false);
    }
  }

  // Helper accessors that work for both job types
  function getClockIn(job)  { return job?._type === "shift" ? job.attendance?.[0]?.clock_in  : job?.clock_in; }
  function getClockOut(job) { return job?._type === "shift" ? job.attendance?.[0]?.clock_out : job?.clock_out; }

  void nowTick; // trigger re-render every 30s for canClockIn

  const clockInAllowed = todayJob && canClockIn(todayJob.shifts?.start_time || todayJob.start_time);
  const clockedIn  = getClockIn(todayJob);
  const clockedOut = getClockOut(todayJob);

  const statCards = [
    { label: "Upcoming Jobs",  value: upcomingJobs.length,                        Icon: Briefcase,    iconColor: "#2563EB", bg: "#EFF6FF", link: "/krewby-worker/jobs", state: { filter: "upcoming" } },
    { label: "Jobs Completed", value: profile?.total_jobs ?? 0,                   Icon: CheckCircle2, iconColor: "#059669", bg: "#ECFDF5", link: "/krewby-worker/jobs", state: { filter: "past" } },
    { label: "My Rating",      value: profile ? `${Number(profile.rating || 0).toFixed(1)}` : "—", Icon: Star, iconColor: "#D97706", bg: "#FFFBEB", link: "/krewby-worker/jobs", state: { filter: "past" }, isRating: true },
    { label: "Notifications",  value: unread,                                      Icon: Bell,         iconColor: "#7C3AED", bg: "#F5F3FF", link: "/krewby-worker/notifications" },
  ];

  return (
    <WorkerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} <Hand size={20} style={{ display: "inline", verticalAlign: "middle" }} />
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Here's an overview of your upcoming jobs.</p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <Shimmer w="44px" h="44px" r="10px" />
                <div style={{ marginTop: "14px" }}><Shimmer w="50px" h="28px" r="6px" /></div>
                <div style={{ marginTop: "8px" }}><Shimmer w="100px" h="13px" r="5px" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {statCards.map((card, i) => (
              <div key={card.label}
                className="worker-stat-card"
                onClick={() => card.link && navigate(card.link, { state: card.state })}
                style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", cursor: card.link ? "pointer" : "default", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "transform 0.18s, box-shadow 0.18s", animation: `fadeSlideUp 0.35s ease ${i * 0.07}s both` }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                  <card.Icon size={20} color={card.iconColor} strokeWidth={1.8} />
                </div>
                <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  {card.isRating && <Star size={20} fill="#F59E0B" stroke="none" style={{ flexShrink: 0 }} />}
                  {card.value}
                </p>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#64748B", marginTop: "6px" }}>{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Preferred location banner */}
        {!loading && profile?.preferred_location && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <MapPin size={18} color="#1D4ED8" />
            <p style={{ fontSize: "13px", color: "#1D4ED8", fontWeight: "500" }}>
              Preferred area: <strong>{profile.preferred_location}</strong>
            </p>
          </div>
        )}

        {/* ── Today's Job & Clock In/Out ─────────────────────────── */}
        <div style={{
          ...sec,
          background: todayJob ? "linear-gradient(135deg,#EFF6FF 0%,#F0FDF4 100%)" : "#FAFAFA",
          border: todayJob ? "1.5px solid #BFDBFE" : "1px solid #E2E8F0",
        }}>
          <h3 style={{ ...secTitle, marginBottom: "16px" }}>Today's Job</h3>

          {loading ? (
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <Shimmer w="60px" h="60px" r="12px" />
              <div style={{ flex: 1 }}>
                <Shimmer w="45%" h="15px" r="5px" />
                <div style={{ marginTop: "8px" }}><Shimmer w="60%" h="12px" r="5px" /></div>
              </div>
              <Shimmer w="100px" h="38px" r="10px" />
            </div>
          ) : !todayJob ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ marginBottom: "10px" }}><SmilePlus size={32} color="#94A3B8" /></p>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>No job today — enjoy your day!</p>
              <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Check back when you have an upcoming assignment.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                <div style={{ minWidth: "56px", textAlign: "center", background: "#2563EB", borderRadius: "12px", padding: "10px 6px" }}>
                  <p style={{ fontSize: "10px", fontWeight: "800", color: "#BFDBFE", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {fmtDay(todayJob.shifts?.shift_date || todayJob.shift_date)}
                  </p>
                  <p style={{ fontSize: "20px", fontWeight: "900", color: "#FFF", lineHeight: 1.1 }}>
                    {fmtDayNum(todayJob.shifts?.shift_date || todayJob.shift_date)}
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>
                      {todayJob.shifts?.title || todayJob.role_name || "Job"}
                    </p>
                    {todayJob._type === "krewby_request" && (
                      <span style={{ fontSize: "10px", fontWeight: "700", background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA", padding: "2px 7px", borderRadius: "100px" }}>
                        KREWBY REQUEST
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
                    {(todayJob.shifts?.start_time || todayJob.start_time)?.slice(0, 5)} – {(todayJob.shifts?.end_time || todayJob.end_time)?.slice(0, 5)}
                    {todayJob.shifts?.outlets?.name && ` · ${todayJob.shifts.outlets.name}`}
                  </p>
                  {!clockInAllowed && !clockedIn && (
                    <p style={{ fontSize: "11px", color: "#D97706", marginTop: "4px", fontWeight: "600" }}>
                      Clock-in opens 5 min before shift starts
                    </p>
                  )}
                </div>
              </div>

              {/* Clock buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {clockedIn ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#DCFCE7", border: "1.5px solid #BBF7D0", borderRadius: "10px", padding: "10px 16px" }}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <div>
                      <p style={{ fontSize: "11px", color: "#166534", fontWeight: "600" }}>Clocked In</p>
                      <p style={{ fontSize: "15px", color: "#166534", fontWeight: "800" }}>{fmtTime(clockedIn)}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleClockIn}
                    disabled={clockSaving || !clockInAllowed}
                    style={{
                      padding: "11px 24px", borderRadius: "10px", border: "none",
                      background: clockInAllowed ? "#16A34A" : "#D1FAE5",
                      color: clockInAllowed ? "#FFF" : "#6EE7B7",
                      fontSize: "14px", fontWeight: "700",
                      cursor: (clockSaving || !clockInAllowed) ? "not-allowed" : "pointer",
                      opacity: clockSaving ? 0.7 : 1, transition: "all 0.15s",
                    }}>
                    {clockSaving ? "Clocking in…" : "Clock In"}
                  </button>
                )}

                {(clockedIn || clockInAllowed) && (
                  <span style={{ color: "#CBD5E1", fontSize: "18px" }}>→</span>
                )}

                {clockedOut ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFF1F2", border: "1.5px solid #FECACA", borderRadius: "10px", padding: "10px 16px" }}>
                    <Flag size={16} color="#DC2626" />
                    <div>
                      <p style={{ fontSize: "11px", color: "#9F1239", fontWeight: "600" }}>Clocked Out</p>
                      <p style={{ fontSize: "15px", color: "#9F1239", fontWeight: "800" }}>{fmtTime(clockedOut)}</p>
                    </div>
                  </div>
                ) : clockedIn ? (
                  <button
                    onClick={handleClockOut}
                    disabled={clockSaving}
                    style={{
                      padding: "11px 24px", borderRadius: "10px", border: "none",
                      background: "#DC2626", color: "#FFF",
                      fontSize: "14px", fontWeight: "700",
                      cursor: clockSaving ? "not-allowed" : "pointer",
                      opacity: clockSaving ? 0.7 : 1, transition: "all 0.15s",
                    }}>
                    {clockSaving ? "Clocking out…" : "Clock Out"}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming jobs */}
        <div style={sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={secTitle}>Upcoming Jobs</h3>
            <button style={viewAllBtn} onClick={() => navigate("/krewby-worker/jobs")}>View all →</button>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <Shimmer w="44px" h="44px" r="10px" />
                  <div style={{ flex: 1 }}><Shimmer w="55%" h="14px" r="5px" /><div style={{ marginTop: "7px" }}><Shimmer w="40%" h="12px" r="4px" /></div></div>
                </div>
              ))}
            </div>
          ) : upcomingJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "#94A3B8", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              No upcoming jobs — you're all clear! <Check size={14} color="#94A3B8" />
            </div>
          ) : (
            upcomingJobs.map((j, i) => (
              <div key={j.assignment_id}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderBottom: "1px solid #F1F5F9", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: j._type === "krewby_request" ? "#FFF7ED" : "#EFF6FF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: j._type === "krewby_request" ? "#C2410C" : "#3B82F6", textTransform: "uppercase" }}>
                    {new Date(j.shifts.shift_date).toLocaleDateString("en-SG", { month: "short" })}
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>
                    {new Date(j.shifts.shift_date).getDate()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{j.shifts.title || "Job"}</p>
                  <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                    {j.shifts.start_time?.slice(0,5)} – {j.shifts.end_time?.slice(0,5)}
                    {j.shifts.outlets?.name && ` · ${j.shifts.outlets.name}`}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  {j._type === "krewby_request" && (
                    <span style={{ fontSize: "10px", fontWeight: "700", background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA", padding: "2px 7px", borderRadius: "100px" }}>
                      Request
                    </span>
                  )}
                  {!j.acknowledged && (
                    <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706" }}>
                      Needs ack
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div style={sec}>
          <h3 style={{ ...secTitle, marginBottom: "14px" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {[
              { label: "My Jobs",       Icon: Briefcase, link: "/krewby-worker/jobs" },
              { label: "Availability",  Icon: CalendarDays, link: "/krewby-worker/availability" },
              { label: "Notifications", Icon: Bell, link: "/krewby-worker/notifications" },
            ].map(a => (
              <button key={a.label}
                className="worker-action-btn"
                onClick={() => navigate(a.link)}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer", transition: "all 0.15s" }}>
                <a.Icon size={18} />{a.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "error" ? "#EF4444" : "#22C55E", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}
    </WorkerLayout>
  );
}

const sec      = { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const secTitle = { fontSize: "15px", fontWeight: "700", color: "#1E293B" };
const viewAllBtn = { background: "none", border: "none", fontSize: "13px", color: "#3B82F6", fontWeight: "600", cursor: "pointer" };
