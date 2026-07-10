import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { Plus, Trash2, Clock, Calendar, Tag, Users, Search, ChevronDown, X } from "lucide-react";

export default function CreateShift() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId]       = useState(null);
  const [outletHours, setOutletHours] = useState({ open: null, close: null });
  const [skills, setSkills]           = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const [form, setForm] = useState({ title: "", shift_date: "", start_time: "", end_time: "", deadline: "" });
  const [roles, setRoles] = useState([{ role_name: "", skill_id: "", headcount: 1 }]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: myStaff }, skillsRes] = await Promise.all([
        supabase.from("staff").select("outlet_id").eq("user_id", userId).eq("is_active", true).limit(1),
        api.get("/api/business/skills/assignable").catch(() => ({ skills: [] })),
      ]);
      const oid = myStaff?.[0]?.outlet_id || null;
      if (!cancelled) { setOutletId(oid); setSkills(skillsRes.skills || []); }
      if (oid) {
        const { data: od } = await supabase.from("outlets").select("open_time, close_time").eq("outlet_id", oid).single();
        if (!cancelled && od) setOutletHours({ open: od.open_time?.slice(0,5) || null, close: od.close_time?.slice(0,5) || null });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function addRole() { setRoles(p => [...p, { role_name: "", skill_id: "", headcount: 1 }]); }
  function removeRole(i) { setRoles(p => p.filter((_, j) => j !== i)); }
  function updateRole(i, f, v) { setRoles(p => p.map((r, j) => j === i ? { ...r, [f]: v } : r)); }

  async function handleSave(publish = false) {
    if (!form.shift_date)                  { setError("Date is required."); return; }
    if (!form.start_time)                  { setError("Start time is required."); return; }
    if (!form.end_time)                    { setError("End time is required."); return; }
    if (form.end_time <= form.start_time)  { setError("End time must be after start time."); return; }
    if (outletHours.open  && form.start_time < outletHours.open)  { setError(`Start time cannot be before opening (${fmtTime(outletHours.open)}).`); return; }
    if (outletHours.close && form.end_time   > outletHours.close) { setError(`End time cannot be after closing (${fmtTime(outletHours.close)}).`); return; }
    if (!outletId) { setError("No outlet found for your account."); return; }
    setSaving(true); setError("");
    try {
      const { data: shift, error: shiftErr } = await supabase.from("shifts").insert({
        outlet_id: outletId, title: form.title.trim() || null,
        shift_date: form.shift_date, start_time: form.start_time, end_time: form.end_time,
        deadline: form.deadline || null,
        status: publish ? "published" : "draft", created_by: userId,
      }).select().single();
      if (shiftErr) throw new Error(shiftErr.message || JSON.stringify(shiftErr));
      if (!shift?.shift_id) throw new Error("Shift was created but no ID returned.");
      if (roles.length > 0) {
        const { error: roleErr } = await supabase.from("shift_roles").insert(
          roles.map(r => ({ shift_id: shift.shift_id, role_name: "", skill_id: r.skill_id ? Number(r.skill_id) : null, headcount: Number(r.headcount) || 1 }))
        );
        if (roleErr) throw new Error(roleErr.message || JSON.stringify(roleErr));
      }
      navigate(`/outlet-manager/shifts/${shift.shift_id}`);
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
      console.error(err);
    } finally { setSaving(false); }
  }

  const duration = form.start_time && form.end_time && form.end_time > form.start_time
    ? (() => { const [sh, sm] = form.start_time.split(":").map(Number); const [eh, em] = form.end_time.split(":").map(Number); const mins = (eh*60+em)-(sh*60+sm); return `${Math.floor(mins/60)}h ${mins%60 > 0 ? `${mins%60}m` : ""}`.trim(); })()
    : null;

  return (
    <ManagerLayout title="Create Task">
      {/* Back */}
      <button style={s.back} onClick={() => navigate("/outlet-manager/shifts")}>
        ← Back to Tasks
      </button>

      <div style={s.layout}>
        {/* ── Left: Shift Details ── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <div style={s.cardIcon}><Calendar size={16} color="#3B82F6" /></div>
            <h3 style={s.cardTitle}>Task Details</h3>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span style={{ fontSize: "15px" }}>⚠️</span> {error}
            </div>
          )}

          <div style={s.fields}>
            <Field label="Title (optional)" icon={null}>
              <input style={s.input} placeholder="e.g. Morning Shift"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </Field>

            <Field label="Date" required icon={<Calendar size={13} color="#94A3B8" />}>
              <input style={s.input} type="date"
                value={form.shift_date} onChange={e => {
                  const d = e.target.value;
                  setForm(p => ({ ...p, shift_date: d, deadline: p.deadline || d }));
                }} />
            </Field>

            <Field label="Deadline" icon={<Calendar size={13} color="#94A3B8" />}>
              <input style={s.input} type="date"
                min={form.shift_date || undefined}
                value={form.deadline}
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
              {form.deadline && form.shift_date && form.deadline === form.shift_date && (
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>
                  Same as task date — change if needed
                </p>
              )}
            </Field>

            <div style={s.row2}>
              <Field label="Start Time" required icon={<Clock size={13} color="#94A3B8" />}>
                <input style={s.input} type="time" value={form.start_time}
                  min={outletHours.open || undefined} max={outletHours.close || undefined}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </Field>
              <Field label="End Time" required icon={<Clock size={13} color="#94A3B8" />}>
                <input style={s.input} type="time" value={form.end_time}
                  min={form.start_time || outletHours.open || undefined} max={outletHours.close || undefined}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </Field>
            </div>

            {/* Duration + operating hours */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {duration && (
                <span style={s.pill}>
                  <Clock size={11} /> {duration}
                </span>
              )}
              {(outletHours.open || outletHours.close) && (
                <span style={{ ...s.pill, background: "#F0F9FF", color: "#0369A1", borderColor: "#BAE6FD" }}>
                  Operating: {fmtTime(outletHours.open)} – {fmtTime(outletHours.close)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Roles ── */}
        <div style={s.card}>
          <div style={{ ...s.cardHead, marginBottom: "16px" }}>
            <div style={{ ...s.cardIcon, background: "#FEF3C7" }}><Users size={16} color="#D97706" /></div>
            <h3 style={s.cardTitle}>Task Roles</h3>
            <button style={s.addRoleBtn} onClick={addRole}>
              <Plus size={13} strokeWidth={2.5} /> Add Role
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {roles.map((role, idx) => (
              <div key={idx} style={s.roleCard}>
                {/* Role header */}
                <div style={s.roleHead}>
                  <div style={s.roleBadge}>Role {idx + 1}</div>
                  {roles.length > 1 && (
                    <button style={s.removeBtn} onClick={() => removeRole(idx)} title="Remove role">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Skill + Headcount */}
                <div style={s.row2}>
                  <div>
                    <label style={s.label}>
                      <Tag size={11} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                      Required Skill
                    </label>
                    <SkillSelect
                      skills={skills}
                      value={role.skill_id}
                      onChange={v => updateRole(idx, "skill_id", v)}
                    />
                  </div>
                  <div>
                    <label style={s.label}>
                      <Users size={11} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                      Headcount
                    </label>
                    <div style={s.counter}>
                      <button style={s.counterBtn}
                        onClick={() => updateRole(idx, "headcount", Math.max(1, Number(role.headcount) - 1))}
                        disabled={Number(role.headcount) <= 1}>−</button>
                      <span style={s.counterVal}>{role.headcount}</span>
                      <button style={s.counterBtn}
                        onClick={() => updateRole(idx, "headcount", Math.min(20, Number(role.headcount) + 1))}
                        disabled={Number(role.headcount) >= 20}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {skills.length === 0 && (
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "12px", textAlign: "center" }}>
              No skills configured yet.{" "}
              <span style={{ color: "#3B82F6", cursor: "pointer", fontWeight: "600" }}
                onClick={() => navigate("/outlet-manager/skills")}>
                Add skills →
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={s.actions}>
        <button style={s.cancelBtn} onClick={() => navigate("/outlet-manager/shifts")} disabled={saving}>
          Cancel
        </button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={s.draftBtn} onClick={() => handleSave(false)} disabled={saving}>
            {saving ? "Saving…" : "Save as Draft"}
          </button>
          <button style={s.publishBtn} onClick={() => handleSave(true)} disabled={saving}>
            {saving ? "Publishing…" : "Save & Publish"}
          </button>
        </div>
      </div>
    </ManagerLayout>
  );
}

function SkillSelect({ skills, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = skills.find(sk => String(sk.skill_id) === String(value));

  // Clear stale value if it no longer exists in the skills list
  useEffect(() => {
    if (value && skills.length > 0 && !selected) onChange("");
  }, [skills]);

  const filtered = query.trim()
    ? skills.filter(sk => sk.name.toLowerCase().includes(query.toLowerCase()))
    : skills;

  useEffect(() => {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  function pick(skillId) { onChange(skillId); setOpen(false); setQuery(""); }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...s.input, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left", gap: "6px" }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "#1C1B18" : "#94A3B8" }}>
          {selected ? selected.name : "Any skill"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {value && (
            <span onMouseDown={e => { e.stopPropagation(); pick(""); }}
              style={{ color: "#94A3B8", display: "flex", alignItems: "center", padding: "2px", borderRadius: "3px" }}>
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} color="#94A3B8" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={s.dropdown}>
          {/* Search */}
          <div style={s.searchWrap}>
            <Search size={13} color="#94A3B8" style={{ flexShrink: 0 }} />
            <input ref={inputRef} style={s.searchInput}
              placeholder="Search skills…"
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          {/* Options */}
          <div style={s.optionList}>
            <div style={{ ...s.option, color: !value ? "#3B82F6" : "#64748B", fontStyle: "italic" }}
              onMouseDown={() => pick("")}>
              Any skill
              {!value && <span style={s.checkmark}>✓</span>}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: "12px", color: "#94A3B8", textAlign: "center" }}>
                No matches
              </div>
            )}
            {filtered.map(sk => {
              const active = String(sk.skill_id) === String(value);
              return (
                <div key={sk.skill_id}
                  style={{ ...s.option, color: active ? "#3B82F6" : "#1C1B18", background: active ? "#EFF6FF" : "transparent", fontWeight: active ? "700" : "500" }}
                  onMouseDown={() => pick(String(sk.skill_id))}>
                  {sk.name}
                  {active && <span style={s.checkmark}>✓</span>}
                </div>
              );
            })}
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

function fmtTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "20px", padding: 0, display: "flex", alignItems: "center", gap: "4px" },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px", alignItems: "start" },

  card: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "16px", padding: "24px" },
  cardHead: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" },
  cardIcon: { width: "32px", height: "32px", borderRadius: "9px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18", flex: 1 },

  errorBox: { display: "flex", alignItems: "center", gap: "8px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px" },

  fields: { display: "flex", flexDirection: "column", gap: "14px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "5px" },
  input: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", background: "#FAFAFA", color: "#1C1B18", boxSizing: "border-box", outline: "none", fontFamily: "inherit" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },

  pill: { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", color: "#475569", background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "99px", padding: "3px 10px" },

  /* Roles */
  addRoleBtn: { display: "flex", alignItems: "center", gap: "5px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "700", color: "#3B82F6", cursor: "pointer" },
  roleCard: { background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "12px", padding: "14px" },
  roleHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  roleBadge: { fontSize: "11px", fontWeight: "700", color: "#3B82F6", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "99px", padding: "2px 10px", textTransform: "uppercase", letterSpacing: "0.04em" },
  removeBtn: { background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px" },

  selectedSkill: { display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", color: "#3B82F6", marginTop: "5px" },

  /* Skill search dropdown */
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: "11px", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 100, overflow: "hidden" },
  searchWrap: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid #F1F5F9" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: "13px", color: "#1C1B18", background: "transparent", fontFamily: "inherit" },
  optionList: { maxHeight: "180px", overflowY: "auto" },
  option: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", fontSize: "13px", cursor: "pointer" },
  checkmark: { fontSize: "11px", color: "#3B82F6" },

  counter: { display: "flex", alignItems: "center", border: "1.5px solid #E2E8F0", borderRadius: "9px", overflow: "hidden", background: "#FAFAFA", height: "38px" },
  counterBtn: { width: "36px", height: "100%", border: "none", background: "none", fontSize: "16px", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "500" },
  counterVal: { flex: 1, textAlign: "center", fontSize: "14px", fontWeight: "700", color: "#1C1B18" },

  /* Actions */
  actions: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "14px 20px" },
  cancelBtn: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#94A3B8", cursor: "pointer", padding: "8px 12px" },
  draftBtn: { background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", padding: "10px 20px", fontSize: "13px", fontWeight: "700", color: "#1C1B18", cursor: "pointer" },
  publishBtn: { background: "#1C1B18", border: "none", borderRadius: "10px", padding: "10px 22px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer" },
};
