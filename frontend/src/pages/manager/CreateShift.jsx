import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { Plus, Trash2, Clock, Calendar, Tag, Search, ChevronDown, X, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DIFF_LEVELS = [
  { value: "junior", label: "Junior",  color: "#166534", bg: "#DCFCE7" },
  { value: "mid",    label: "Mid",     color: "#1D4ED8", bg: "#DBEAFE" },
  { value: "senior", label: "Senior",  color: "#92400E", bg: "#FEF3C7" },
  { value: "expert", label: "Expert",  color: "#5B21B6", bg: "#EDE9FE" },
];

function parseOperatingDays(str) {
  if (!str || str.length !== 7) return [1,1,1,1,1,0,0];
  return str.split("").map(Number);
}
function jsDayToMonBased(jsDay) { return (jsDay + 6) % 7; }

function toHHMM(t) {
  if (!t) return "";
  const s = String(t);
  if (s.includes("T")) return s.slice(11, 16); // ISO: "1970-01-01T08:00:00.000Z"
  return s.slice(0, 5);                         // already "HH:MM"
}

function fmtTime(t) {
  if (!t) return "—";
  const hhmm = toHHMM(t);
  const [h, m] = hhmm.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function CreateShift() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = getUser();
  const userId = user?.user_id;

  const [step, setStep]               = useState(1);
  const [createdShift, setCreatedShift] = useState(null);

  // Step 1 state
  const [branchId, setBranchId]         = useState(null);
  const [branchHours, setBranchHours]   = useState({ open: null, close: null });
  const [branchSettings, setBranchSettings] = useState(null);
  const [skills, setSkills]             = useState([]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [dateWarning, setDateWarning]   = useState("");

  const [form, setForm] = useState({
    title: "", shift_date: searchParams.get("date") || "",
    start_time: "", end_time: "", deadline: "",
  });

  // Step 2 state
  const [tasks, setTasks]       = useState([{ title: "", skill_id: "", difficulty: "", start_time: "", end_time: "" }]);
  const [savingTasks, setSavingTasks] = useState(false);
  const [taskError, setTaskError]     = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: myStaff }, skillsRes] = await Promise.all([
        supabase.from("staff").select("branch_id").eq("user_id", userId).eq("is_active", true).limit(1),
        api.get("/api/business/skills/assignable").catch(() => ({ skills: [] })),
      ]);
      let oid = myStaff?.[0]?.branch_id || null;
      if (!oid) {
        const { data: omRow } = await supabase.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1);
        oid = omRow?.[0]?.branch_id || null;
      }
      if (!oid || cancelled) return;
      if (!cancelled) { setBranchId(oid); setSkills(skillsRes.skills || []); }

      const [{ data: od }, settingsRes] = await Promise.all([
        supabase.from("branches").select("open_time, close_time").eq("branch_id", oid).single(),
        api.get(`/api/business/branches/${oid}/settings`).catch(() => ({ settings: null })),
      ]);
      if (cancelled) return;
      if (od) setBranchHours({ open: od.open_time?.slice(0,5) || null, close: od.close_time?.slice(0,5) || null });
      if (settingsRes?.settings) setBranchSettings(settingsRes.settings);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const operatingDays = parseOperatingDays(branchSettings?.operating_days);
  const allowOvertime = branchSettings?.allow_overtime ?? false;
  const maxHoursDay   = branchSettings?.max_work_hours_day ?? null;
  const timeMin       = !allowOvertime ? (branchHours.open  || undefined) : undefined;
  const timeMax       = !allowOvertime ? (branchHours.close || undefined) : undefined;

  function checkDateOperating(dateStr) {
    if (!dateStr || !branchSettings) { setDateWarning(""); return; }
    const dow = jsDayToMonBased(new Date(dateStr + "T00:00:00").getDay());
    setDateWarning(!operatingDays[dow] ? `${DAY_FULL[dow]} is not an operating day.` : "");
  }

  function handleDateChange(dateStr) {
    setForm(p => ({ ...p, shift_date: dateStr, deadline: p.deadline || dateStr }));
    checkDateOperating(dateStr);
  }

  function getShiftMinutes() {
    if (!form.start_time || !form.end_time || form.end_time <= form.start_time) return 0;
    const [sh, sm] = form.start_time.split(":").map(Number);
    const [eh, em] = form.end_time.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  async function handleCreateShift(publish = false) {
    if (!form.shift_date)                 { setError("Date is required."); return; }
    if (!form.start_time)                 { setError("Start time is required."); return; }
    if (!form.end_time)                   { setError("End time is required."); return; }
    if (form.end_time <= form.start_time) { setError("End time must be after start time."); return; }

    if (branchSettings) {
      const dow = jsDayToMonBased(new Date(form.shift_date + "T00:00:00").getDay());
      if (!operatingDays[dow]) {
        setError(`Cannot create a shift on ${DAY_FULL[dow]} — not an operating day.`); return;
      }
    }
    if (!allowOvertime) {
      if (branchHours.open  && form.start_time < branchHours.open)  { setError(`Start time before opening (${fmtTime(branchHours.open)}).`); return; }
      if (branchHours.close && form.end_time   > branchHours.close) { setError(`End time after closing (${fmtTime(branchHours.close)}).`); return; }
    }
    if (maxHoursDay && getShiftMinutes() > maxHoursDay * 60) {
      setError(`Shift duration exceeds the maximum of ${maxHoursDay}h per day.`); return;
    }
    if (!branchId) { setError("No branch found for your account."); return; }

    setSaving(true); setError("");
    try {
      const res = await api.post("/api/shifts", {
        branch_id: branchId,
        title: form.title.trim() || null,
        shift_date: form.shift_date,
        start_time: form.start_time,
        end_time: form.end_time,
        deadline: form.deadline || null,
        status: publish ? "published" : "draft",
      });
      if (!res.success) throw new Error(res.message || "Failed to create shift.");
      setCreatedShift(res.shift);
      setTasks([{ title: "", skill_id: "", difficulty: "", start_time: form.start_time, end_time: form.end_time }]);
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally { setSaving(false); }
  }

  // ── Step 2: task builder ───────────────────────────────────────────────────

  function addTask()            { setTasks(p => [...p, { title: "", skill_id: "", difficulty: "", start_time: form.start_time, end_time: form.end_time }]); }
  function removeTask(i)        { setTasks(p => p.filter((_, j) => j !== i)); }
  function updateTask(i, f, v)  { setTasks(p => p.map((t, j) => j === i ? { ...t, [f]: v } : t)); }

  async function handleSaveTasks() {
    const validTasks = tasks.filter(t => t.title.trim());
    if (validTasks.length === 0) {
      // Skip — no tasks to save
      navigate(`/manager/shifts/${createdShift.shift_id}`);
      return;
    }
    setSavingTasks(true); setTaskError("");
    try {
      for (const t of validTasks) {
        await api.post(`/api/shifts/${createdShift.shift_id}/tasks`, {
          title: t.title.trim(),
          skill_id: t.skill_id ? Number(t.skill_id) : null,
          difficulty: t.difficulty || null,
          start_time: t.start_time || null,
          end_time: t.end_time || null,
        });
      }
      navigate(`/manager/shifts/${createdShift.shift_id}`);
    } catch (err) {
      setTaskError(err.message || "Failed to save tasks. Please try again.");
    } finally { setSavingTasks(false); }
  }

  const shiftMins = getShiftMinutes();
  const duration  = shiftMins > 0 ? `${Math.floor(shiftMins / 60)}h${shiftMins % 60 > 0 ? ` ${shiftMins % 60}m` : ""}` : null;
  const maxMins   = maxHoursDay ? maxHoursDay * 60 : null;
  const overMax   = maxMins && shiftMins > maxMins;

  // ── Step indicator ─────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: "Shift Details" },
    { n: 2, label: "Add Tasks" },
  ];

  return (
    <ManagerLayout title={step === 1 ? "Create Shift" : "Add Tasks"}>
      <button style={s.back} onClick={() => step === 2 ? setStep(1) : navigate("/manager/shifts")}>
        ← {step === 2 ? "Back to Shift Details" : "Back to Shifts"}
      </button>

      {/* Step indicator */}
      <div style={s.stepRow}>
        {steps.map((st, i) => (
          <div key={st.n} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              ...s.stepBubble,
              background: step === st.n ? "#1C1B18" : step > st.n ? "#22C55E" : "#E2E8F0",
              color: step >= st.n ? "#FFF" : "#94A3B8",
            }}>
              {step > st.n ? <CheckCircle2 size={13} /> : st.n}
            </div>
            <span style={{ fontSize: "13px", fontWeight: step === st.n ? "700" : "500", color: step === st.n ? "#1C1B18" : "#94A3B8" }}>
              {st.label}
            </span>
            {i < steps.length - 1 && <ArrowRight size={14} color="#CBD5E1" style={{ marginLeft: "4px" }} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Shift Details ─────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <div style={s.card}>
            <div style={s.cardHead}>
              <div style={s.cardIcon}><Calendar size={16} color="#3B82F6" /></div>
              <h3 style={s.cardTitle}>Shift Details</h3>
            </div>

            {error && (
              <div style={s.errorBox}><AlertTriangle size={14} strokeWidth={2} /> {error}</div>
            )}

            <div style={s.fields}>
              <Field label="Title (optional)">
                <input style={s.input} placeholder="e.g. Morning Shift"
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </Field>

              <Field label="Date" required>
                <input style={{ ...s.input, borderColor: dateWarning ? "#FCD34D" : undefined }}
                  type="date" value={form.shift_date} onChange={e => handleDateChange(e.target.value)} />
                {dateWarning && (
                  <p style={s.warningText}><AlertTriangle size={11} /> {dateWarning}</p>
                )}
                {branchSettings && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                    {DAY_NAMES.map((d, i) => (
                      <span key={d} style={{
                        fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "99px",
                        border: `1.5px solid ${operatingDays[i] ? "#2563EB" : "#E2E8F0"}`,
                        background: operatingDays[i] ? "#EFF6FF" : "#F8FAFC",
                        color: operatingDays[i] ? "#2563EB" : "#CBD5E1",
                      }}>{d}</span>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Deadline">
                <input style={s.input} type="date" min={form.shift_date || undefined}
                  value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              </Field>

              <div style={s.row2}>
                <Field label="Start Time" required>
                  <input style={s.input} type="time" value={form.start_time}
                    min={timeMin} max={timeMax}
                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
                </Field>
                <Field label="End Time" required>
                  <input style={{ ...s.input, borderColor: overMax ? "#FCA5A5" : undefined }}
                    type="time" value={form.end_time}
                    min={form.start_time || timeMin} max={timeMax}
                    onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
                </Field>
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {duration && (
                  <span style={{ ...s.pill, ...(overMax ? { background: "#FEF2F2", color: "#DC2626", borderColor: "#FCA5A5" } : {}) }}>
                    <Clock size={11} /> {duration}{overMax ? ` — exceeds ${maxHoursDay}h max` : ""}
                  </span>
                )}
                {(branchHours.open || branchHours.close) && (
                  <span style={{ ...s.pill, background: "#F0F9FF", color: "#0369A1", borderColor: "#BAE6FD" }}>
                    Hours: {fmtTime(branchHours.open)} – {fmtTime(branchHours.close)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={s.actions}>
            <button style={s.cancelBtn} onClick={() => navigate("/manager/shifts")} disabled={saving}>Cancel</button>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={s.draftBtn} onClick={() => handleCreateShift(false)} disabled={saving}>
                {saving ? "Saving…" : "Save as Draft"}
              </button>
              <button style={s.publishBtn} onClick={() => handleCreateShift(true)} disabled={saving}>
                {saving ? "Saving…" : "Save & Publish"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── STEP 2: Task Builder ──────────────────────────────────────────── */}
      {step === 2 && createdShift && (
        <>
          {/* Shift summary pill */}
          <div style={s.shiftSummary}>
            <Calendar size={13} color="#2563EB" />
            <span style={{ fontWeight: "700", color: "#1C1B18" }}>{createdShift.title || "Untitled Shift"}</span>
            <span style={s.summaryDot} />
            <span style={{ color: "#64748B" }}>
              {new Date(createdShift.shift_date).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <span style={s.summaryDot} />
            <span style={{ color: "#64748B" }}>
              {toHHMM(createdShift.start_time)} – {toHHMM(createdShift.end_time)}
            </span>
          </div>

          <div style={s.card}>
            <div style={{ ...s.cardHead, marginBottom: "6px" }}>
              <div style={{ ...s.cardIcon, background: "#FEF3C7" }}><Tag size={16} color="#D97706" /></div>
              <h3 style={s.cardTitle}>Define Tasks</h3>
              <span style={s.taskHint}>Each task will be assigned to one staff member</span>
            </div>

            <p style={s.taskSubtitle}>Add the work tasks for this shift. You can assign staff on the next screen.</p>

            {taskError && (
              <div style={s.errorBox}><AlertTriangle size={14} strokeWidth={2} /> {taskError}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
              {tasks.map((task, idx) => (
                <div key={idx} style={s.taskRow}>
                  <div style={s.taskNum}>{idx + 1}</div>
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 150px 130px 95px 95px", gap: "10px", alignItems: "center" }}>
                    <div>
                      <label style={s.miniLabel}>Task Name *</label>
                      <input style={s.input} placeholder="e.g. Cashier, Barista, Kitchen…"
                        value={task.title}
                        onChange={e => updateTask(idx, "title", e.target.value)} />
                    </div>
                    <div>
                      <label style={s.miniLabel}>Required Skill</label>
                      <SkillSelect skills={skills} value={task.skill_id}
                        onChange={v => updateTask(idx, "skill_id", v)} />
                    </div>
                    <div>
                      <label style={s.miniLabel}>Difficulty</label>
                      <select style={{ ...s.input, color: task.difficulty ? DIFF_LEVELS.find(d => d.value === task.difficulty)?.color : "#94A3B8", fontWeight: task.difficulty ? "700" : "400" }}
                        value={task.difficulty}
                        onChange={e => updateTask(idx, "difficulty", e.target.value)}>
                        <option value="">Any level</option>
                        {DIFF_LEVELS.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={s.miniLabel}>Start (opt.)</label>
                      <input style={s.input} type="time" value={task.start_time}
                        onChange={e => updateTask(idx, "start_time", e.target.value)} />
                    </div>
                    <div>
                      <label style={s.miniLabel}>End (opt.)</label>
                      <input style={s.input} type="time" value={task.end_time}
                        onChange={e => updateTask(idx, "end_time", e.target.value)} />
                    </div>
                  </div>
                  {tasks.length > 1 && (
                    <button style={s.removeTaskBtn} onClick={() => removeTask(idx)} title="Remove task">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button style={s.addTaskBtn} onClick={addTask}>
              <Plus size={13} strokeWidth={2.5} /> Add Another Task
            </button>
          </div>

          <div style={s.actions}>
            <button style={s.cancelBtn} onClick={() => navigate(`/manager/shifts/${createdShift.shift_id}`)} disabled={savingTasks}>
              Skip — assign later
            </button>
            <button style={s.publishBtn} onClick={handleSaveTasks} disabled={savingTasks}>
              {savingTasks ? "Saving…" : `Save ${tasks.filter(t => t.title.trim()).length || ""} Tasks & Continue →`}
            </button>
          </div>
        </>
      )}
    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SkillSelect({ skills, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  const selected = skills.find(sk => String(sk.skill_id) === String(value));
  const filtered = query.trim()
    ? skills.filter(sk => sk.name.toLowerCase().includes(query.toLowerCase()))
    : skills;

  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => { if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);

  function pick(skillId) { onChange(skillId); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...s.input, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: "6px" }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#1C1B18" : "#94A3B8", fontSize: "13px" }}>
          {selected ? selected.name : "Any skill"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {value && (
            <span onMouseDown={e => { e.stopPropagation(); pick(""); }}
              style={{ color: "#94A3B8", display: "flex", alignItems: "center" }}>
              <X size={11} />
            </span>
          )}
          <ChevronDown size={12} color="#94A3B8" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>
      {open && (
        <div style={s.dropdown}>
          <div style={s.searchWrap}>
            <Search size={12} color="#94A3B8" />
            <input ref={inputRef} style={s.searchInput} placeholder="Search…"
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={s.optionList}>
            <div style={{ ...s.option, color: !value ? "#3B82F6" : "#64748B", fontStyle: "italic" }}
              onMouseDown={() => pick("")}>Any skill{!value && <span style={{ fontSize: "10px", color: "#3B82F6" }}>✓</span>}</div>
            {filtered.map(sk => {
              const active = String(sk.skill_id) === String(value);
              return (
                <div key={sk.skill_id}
                  style={{ ...s.option, color: active ? "#3B82F6" : "#1C1B18", background: active ? "#EFF6FF" : "transparent", fontWeight: active ? "700" : "500" }}
                  onMouseDown={() => pick(String(sk.skill_id))}>
                  {sk.name}{active && <span style={{ fontSize: "10px", color: "#3B82F6" }}>✓</span>}
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: "12px", color: "#94A3B8", textAlign: "center" }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label style={s.label}>{label}{required && <span style={{ color: "#EF4444", marginLeft: "2px" }}>*</span>}</label>
      {children}
    </div>
  );
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "16px", padding: 0, display: "flex", alignItems: "center", gap: "4px" },
  stepRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px", flexWrap: "wrap" },
  stepBubble: { width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", flexShrink: 0 },
  card: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "16px", padding: "24px", marginBottom: "20px" },
  cardHead: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" },
  cardIcon: { width: "32px", height: "32px", borderRadius: "9px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18", flex: 1 },
  taskHint: { fontSize: "11px", color: "#94A3B8", fontWeight: "500" },
  taskSubtitle: { fontSize: "13px", color: "#64748B", marginBottom: "4px" },
  errorBox: { display: "flex", alignItems: "center", gap: "8px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px" },
  warningText: { fontSize: "11px", color: "#D97706", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" },
  fields: { display: "flex", flexDirection: "column", gap: "14px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "5px" },
  miniLabel: { display: "block", fontSize: "11px", fontWeight: "600", color: "#94A3B8", marginBottom: "4px" },
  input: { display: "block", width: "100%", padding: "8px 11px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", background: "#FAFAFA", color: "#1C1B18", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  pill: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", color: "#475569", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "99px", padding: "3px 10px" },
  shiftSummary: { display: "flex", alignItems: "center", gap: "8px", background: "#F0F7FF", border: "1.5px solid #BFDBFE", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", flexWrap: "wrap", fontSize: "13px" },
  summaryDot: { width: "3px", height: "3px", borderRadius: "50%", background: "#94A3B8" },
  taskRow: { display: "flex", alignItems: "flex-end", gap: "10px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "12px", padding: "14px" },
  taskNum: { width: "24px", height: "24px", borderRadius: "50%", background: "#E2E8F0", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", flexShrink: 0, marginBottom: "2px" },
  removeTaskBtn: { background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", padding: "6px", borderRadius: "6px", flexShrink: 0, marginBottom: "2px" },
  addTaskBtn: { display: "flex", alignItems: "center", gap: "5px", background: "none", border: "1.5px dashed #CBD5E1", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", width: "100%", justifyContent: "center", marginTop: "12px" },
  actions: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "14px 20px" },
  cancelBtn: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#94A3B8", cursor: "pointer", padding: "8px 12px" },
  draftBtn: { background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", padding: "10px 20px", fontSize: "13px", fontWeight: "700", color: "#1C1B18", cursor: "pointer" },
  publishBtn: { background: "#1C1B18", border: "none", borderRadius: "10px", padding: "10px 22px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: "11px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" },
  searchWrap: { display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderBottom: "1px solid #F1F5F9" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: "12px", color: "#1C1B18", background: "transparent", fontFamily: "inherit" },
  optionList: { maxHeight: "160px", overflowY: "auto" },
  option: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", fontSize: "12px", cursor: "pointer" },
};
