import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import SearchableSelect from "./SearchableSelect";
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, X } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Mon=0…Sun=6 — same convention as branch_settings.operating_days and casual_availability.day_of_week.
const TODAY_DOW = (new Date().getDay() + 6) % 7;

const EMPTY_DRAFT = { title: "", skill_id: "", start_time: "", end_time: "", required_workers: 1, period_id: "" };

// Shared by business-owner BranchDetail and manager Settings — both roles can edit a branch's
// task templates (OWNER_OR_MGR on the backend), so the editor itself doesn't distinguish them.
export default function TaskTemplatesEditor({ branchId, skills = [] }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [warning, setWarning]     = useState(""); // Round 6, Task 2 — advisory, never blocks
  const [activeDay, setActiveDay] = useState(TODAY_DOW);
  const [draft, setDraft]         = useState(null); // row being added/edited: { template_id?, ...EMPTY_DRAFT }
  const [saving, setSaving]       = useState(false);
  const [copyOpen, setCopyOpen]   = useState(false);
  const [copyTargets, setCopyTargets] = useState([]);
  const [copying, setCopying]     = useState(false);

  // Round 6, Task 2 — shift periods for this branch, so a template row can be assigned one.
  const [periods, setPeriods]     = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodDraft, setPeriodDraft] = useState(null); // { period_id?, name, start_time, end_time, active_days }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/api/business/branches/${branchId}/task-templates`);
      setTemplates(data.templates || []);
    } catch (e) {
      setError(e.message || "Failed to load task templates.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const loadPeriods = useCallback(async () => {
    setPeriodsLoading(true);
    try {
      const data = await api.get(`/api/business/branches/${branchId}/shift-periods`);
      setPeriods(data.periods || []);
    } catch { /* non-fatal — templates editor still works without periods loaded */ }
    finally { setPeriodsLoading(false); }
  }, [branchId]);

  useEffect(() => { if (branchId) { load(); loadPeriods(); } }, [branchId, load, loadPeriods]);

  const activePeriods = periods.filter(p => p.is_active);
  const periodById = Object.fromEntries(periods.map(p => [p.period_id, p]));

  async function savePeriodDraft() {
    if (!periodDraft.name.trim()) { setError("Period name is required."); return; }
    if (!periodDraft.start_time || !periodDraft.end_time) { setError("Period start and end time are required."); return; }
    setSaving(true); setError("");
    try {
      const body = { name: periodDraft.name.trim(), start_time: periodDraft.start_time, end_time: periodDraft.end_time, active_days: periodDraft.active_days };
      if (periodDraft.period_id) {
        await api.patch(`/api/business/branches/${branchId}/shift-periods/${periodDraft.period_id}`, body);
      } else {
        await api.post(`/api/business/branches/${branchId}/shift-periods`, body);
      }
      setPeriodDraft(null);
      await loadPeriods();
    } catch (e) { setError(e.message || "Failed to save period."); }
    finally { setSaving(false); }
  }

  async function togglePeriodActive(period) {
    try {
      await api.patch(`/api/business/branches/${branchId}/shift-periods/${period.period_id}`, { is_active: !period.is_active });
      await loadPeriods();
    } catch (e) { setError(e.message || "Failed to update period."); }
  }

  async function deletePeriod(period) {
    if (!window.confirm(`Delete "${period.name}"? Tasks assigned to it will fall back to "no period" — they still generate, just outside any named period.`)) return;
    try {
      await api.delete(`/api/business/branches/${branchId}/shift-periods/${period.period_id}`);
      await loadPeriods();
      await load();
    } catch (e) { setError(e.message || "Failed to delete period."); }
  }

  const dayRows = templates
    .filter(t => t.day_of_week === activeDay)
    .sort((a, b) => a.sort_order - b.sort_order);

  function startAdd() {
    setDraft({ ...EMPTY_DRAFT });
  }
  function startEdit(row) {
    setDraft({
      template_id: row.template_id,
      title: row.title,
      skill_id: row.skill_id || "",
      start_time: row.start_time ? row.start_time.slice(0, 5) : "",
      end_time: row.end_time ? row.end_time.slice(0, 5) : "",
      required_workers: row.required_workers,
      period_id: row.period_id || "",
    });
  }

  async function saveDraft() {
    if (!draft.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const body = {
        day_of_week: activeDay,
        title: draft.title.trim(),
        skill_id: draft.skill_id || null,
        start_time: draft.start_time || null,
        end_time: draft.end_time || null,
        required_workers: Number(draft.required_workers) || 1,
        period_id: draft.period_id || null,
      };
      let res;
      if (draft.template_id) {
        res = await api.patch(`/api/business/branches/${branchId}/task-templates/${draft.template_id}`, body);
      } else {
        res = await api.post(`/api/business/branches/${branchId}/task-templates`, body);
      }
      if (res?.warning) setWarning(res.warning); // advisory only — save already succeeded
      setDraft(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(templateId) {
    if (!window.confirm("Delete this task template? Already-generated shifts are not affected.")) return;
    try {
      await api.delete(`/api/business/branches/${branchId}/task-templates/${templateId}`);
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete.");
    }
  }

  async function moveRow(row, direction) {
    const idx = dayRows.findIndex(r => r.template_id === row.template_id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= dayRows.length) return;
    const reordered = [...dayRows];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    try {
      await api.put(`/api/business/branches/${branchId}/task-templates/reorder`, {
        day_of_week: activeDay,
        ordered_ids: reordered.map(r => r.template_id),
      });
      await load();
    } catch (e) {
      setError(e.message || "Failed to reorder.");
    }
  }

  async function doCopy() {
    if (copyTargets.length === 0) return;
    setCopying(true);
    setError("");
    try {
      await api.post(`/api/business/branches/${branchId}/task-templates/copy`, {
        source_day: activeDay,
        target_days: copyTargets,
      });
      setCopyOpen(false);
      setCopyTargets([]);
      await load();
    } catch (e) {
      setError(e.message || "Failed to copy.");
    } finally {
      setCopying(false);
    }
  }

  const rowStyle = { display: "grid", gridTemplateColumns: "1fr 140px 100px 80px", gap: "8px", alignItems: "center", padding: "10px 12px" };

  return (
    <div>
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", marginBottom: "12px" }}>
          {error}
        </div>
      )}
      {warning && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", marginBottom: "12px", display: "flex", justifyContent: "space-between", gap: "10px" }}>
          <span>{warning}</span>
          <button onClick={() => setWarning("")} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", flexShrink: 0 }}><X size={13} /></button>
        </div>
      )}

      {/* Round 6, Task 2 — Shift Periods */}
      <div style={{ background: "#FAFBFE", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>Shift Periods</p>
          {!periodDraft && (
            <button onClick={() => setPeriodDraft({ name: "", start_time: "", end_time: "", active_days: "1111111" })}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "none", border: "1.5px dashed #CBD5E1", borderRadius: "8px", padding: "5px 11px", fontSize: "12px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
              <Plus size={12} /> Add period
            </button>
          )}
        </div>

        {periodsLoading ? (
          <p style={{ fontSize: "12px", color: "#94A3B8" }}>Loading…</p>
        ) : periods.length === 0 && !periodDraft ? (
          <p style={{ fontSize: "12px", color: "#94A3B8" }}>No named periods — this branch generates one shift per operating day, covering its full operating hours.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {periods.map(p => (
              <div key={p.period_id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", background: "#FFF", border: "1px solid #F1F5F9", borderRadius: "8px", opacity: p.is_active ? 1 : 0.5 }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", minWidth: "90px" }}>{p.name}</span>
                <span style={{ fontSize: "12px", color: "#64748B" }}>{p.start_time?.slice(0,5)}–{p.end_time?.slice(0,5)}</span>
                <span style={{ fontSize: "11px", color: "#94A3B8", display: "flex", gap: "2px" }}>
                  {DAYS.map((d, i) => <span key={d} style={{ opacity: p.active_days?.[i] === "1" ? 1 : 0.25 }}>{d[0]}</span>)}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: "2px" }}>
                  <button onClick={() => setPeriodDraft({ period_id: p.period_id, name: p.name, start_time: p.start_time?.slice(0,5) || "", end_time: p.end_time?.slice(0,5) || "", active_days: p.active_days })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#2563EB", fontSize: "11px", fontWeight: "700" }}>Edit</button>
                  <button onClick={() => togglePeriodActive(p)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#64748B", fontSize: "11px", fontWeight: "600" }}>{p.is_active ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => deletePeriod(p)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#EF4444" }}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {periodDraft && (
          <div style={{ marginTop: "10px", padding: "10px", background: "#FFF", border: "1.5px solid #BFDBFE", borderRadius: "8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <input placeholder="e.g. Morning" style={{ padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" }}
                value={periodDraft.name} onChange={e => setPeriodDraft(d => ({ ...d, name: e.target.value }))} />
              <input type="time" style={{ padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" }}
                value={periodDraft.start_time} onChange={e => setPeriodDraft(d => ({ ...d, start_time: e.target.value }))} />
              <input type="time" style={{ padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" }}
                value={periodDraft.end_time} onChange={e => setPeriodDraft(d => ({ ...d, end_time: e.target.value }))} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "700" }}>DAYS</span>
              <div style={{ display: "flex", gap: "3px" }}>
                {DAYS.map((d, i) => {
                  const on = periodDraft.active_days?.[i] === "1";
                  return (
                    <button key={d} type="button"
                      onClick={() => setPeriodDraft(dr => ({ ...dr, active_days: dr.active_days.slice(0, i) + (on ? "0" : "1") + dr.active_days.slice(i + 1) }))}
                      style={{ width: "24px", height: "24px", borderRadius: "6px", border: `1.5px solid ${on ? "#2563EB" : "#E2E8F0"}`, background: on ? "#EFF6FF" : "#FFF", color: on ? "#2563EB" : "#94A3B8", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>
                      {d[0]}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                <button onClick={savePeriodDraft} disabled={saving} style={{ background: "#2563EB", border: "none", borderRadius: "7px", padding: "6px 14px", fontSize: "12px", fontWeight: "700", color: "#FFF", cursor: "pointer" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setPeriodDraft(null)} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "6px 10px", cursor: "pointer", color: "#64748B" }}>
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weekday tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px", flexWrap: "wrap" }}>
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => { setActiveDay(i); setDraft(null); }}
            style={{
              padding: "7px 14px", borderRadius: "100px", border: `1.5px solid ${activeDay === i ? "#2563EB" : "#E2E8F0"}`,
              background: activeDay === i ? "#EFF6FF" : "#FFF", color: activeDay === i ? "#2563EB" : "#64748B",
              fontSize: "13px", fontWeight: "700", cursor: "pointer",
            }}>
            {d}
          </button>
        ))}
        <button onClick={() => { setCopyOpen(o => !o); setCopyTargets([]); }}
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "100px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
          <Copy size={13} /> Copy {DAYS[activeDay]} to…
        </button>
      </div>

      {copyOpen && (
        <div style={{ background: "#F8FAFC", border: "1.5px dashed #CBD5E1", borderRadius: "10px", padding: "12px", marginBottom: "14px" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
            Replace these days' tasks with {DAYS[activeDay]}'s
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            {DAYS.map((d, i) => i === activeDay ? null : (
              <button key={d} onClick={() => setCopyTargets(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
                style={{ padding: "6px 12px", borderRadius: "100px", border: `1.5px solid ${copyTargets.includes(i) ? "#2563EB" : "#E2E8F0"}`, background: copyTargets.includes(i) ? "#2563EB" : "#FFF", color: copyTargets.includes(i) ? "#FFF" : "#64748B", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={doCopy} disabled={copying || copyTargets.length === 0}
              style={{ background: "#2563EB", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: copyTargets.length === 0 ? "default" : "pointer", opacity: copyTargets.length === 0 ? 0.5 : 1 }}>
              {copying ? "Copying…" : `Copy to ${copyTargets.length || ""} day${copyTargets.length !== 1 ? "s" : ""}`}
            </button>
            <button onClick={() => setCopyOpen(false)} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: "13px", color: "#94A3B8" }}>Loading…</p>
      ) : (
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
          {dayRows.length === 0 && !draft && (
            <div style={{ textAlign: "center", padding: "28px" }}>
              <p style={{ fontSize: "13px", color: "#94A3B8" }}>No tasks set for {DAYS[activeDay]}.</p>
            </div>
          )}
          {dayRows.length > 0 && (
            <div style={{ ...rowStyle, background: "#F8FAFC", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <span>Task</span><span>Window</span><span>Workers</span><span />
            </div>
          )}
          {dayRows.map((row, i) => (
            draft?.template_id === row.template_id ? (
              <TemplateDraftRow key={row.template_id} draft={draft} setDraft={setDraft} skills={skills} activePeriods={activePeriods} onSave={saveDraft} onCancel={() => setDraft(null)} saving={saving} />
            ) : (
              <div key={row.template_id} style={{ ...rowStyle, borderTop: i > 0 ? "1px solid #F1F5F9" : "none" }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>
                  {row.title}
                  {row.skills && <span style={{ marginLeft: "8px", background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600" }}>{row.skills.name}</span>}
                  {row.period_id && periodById[row.period_id] && <span style={{ marginLeft: "6px", background: "#F5F3FF", color: "#7C3AED", padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600" }}>{periodById[row.period_id].name}</span>}
                </span>
                <span style={{ fontSize: "13px", color: "#64748B" }}>
                  {row.start_time && row.end_time ? `${row.start_time.slice(0,5)}–${row.end_time.slice(0,5)}` : "—"}
                </span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>{row.required_workers}</span>
                <div style={{ display: "flex", gap: "2px", justifyContent: "flex-end" }}>
                  <button onClick={() => moveRow(row, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, padding: "4px", color: "#64748B" }}><ChevronUp size={14} /></button>
                  <button onClick={() => moveRow(row, 1)} disabled={i === dayRows.length - 1} style={{ background: "none", border: "none", cursor: i === dayRows.length - 1 ? "default" : "pointer", opacity: i === dayRows.length - 1 ? 0.3 : 1, padding: "4px", color: "#64748B" }}><ChevronDown size={14} /></button>
                  <button onClick={() => startEdit(row)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#2563EB", fontSize: "12px", fontWeight: "700" }}>Edit</button>
                  <button onClick={() => removeRow(row.template_id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#EF4444" }}><Trash2 size={14} /></button>
                </div>
              </div>
            )
          ))}
          {draft && !draft.template_id && (
            <TemplateDraftRow draft={draft} setDraft={setDraft} skills={skills} activePeriods={activePeriods} onSave={saveDraft} onCancel={() => setDraft(null)} saving={saving} isNew />
          )}
        </div>
      )}

      {!draft && (
        <button onClick={startAdd} style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "1.5px dashed #CBD5E1", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
          <Plus size={14} /> Add task for {DAYS[activeDay]}
        </button>
      )}
    </div>
  );
}

function TemplateDraftRow({ draft, setDraft, skills, activePeriods = [], onSave, onCancel, saving, isNew }) {
  const inputStyle = { width: "100%", padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" };

  // Round 6, Task 2: picking a period defaults this task's own start/end to the period's window,
  // but only when they're not already set — stays editable afterwards, never auto-overwrites a
  // time the user already typed (e.g. a prep task inside the morning shift running 08:00-10:00,
  // not the full 08:00-16:00).
  function onPickPeriod(periodId) {
    const period = activePeriods.find(p => String(p.period_id) === String(periodId));
    setDraft(d => ({
      ...d,
      period_id: periodId,
      start_time: d.start_time || period?.start_time?.slice(0, 5) || d.start_time,
      end_time: d.end_time || period?.end_time?.slice(0, 5) || d.end_time,
    }));
  }

  return (
    <div style={{ padding: "12px", borderTop: isNew ? "1px solid #F1F5F9" : "none", background: "#FAFBFE" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px", gap: "8px", marginBottom: "8px" }}>
        <input placeholder="Task title" style={inputStyle} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
        <input type="time" style={inputStyle} value={draft.start_time} onChange={e => setDraft(d => ({ ...d, start_time: e.target.value }))} />
        <input type="time" style={inputStyle} value={draft.end_time} onChange={e => setDraft(d => ({ ...d, end_time: e.target.value }))} />
        <input type="number" min="1" max="99" style={{ ...inputStyle, textAlign: "center" }} value={draft.required_workers} onChange={e => setDraft(d => ({ ...d, required_workers: e.target.value }))} />
      </div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <SearchableSelect
            options={skills.map(sk => ({ value: sk.skill_id, label: sk.name }))}
            value={draft.skill_id}
            onChange={val => setDraft(d => ({ ...d, skill_id: val }))}
            placeholder="No skill required"
          />
        </div>
        {activePeriods.length > 0 && (
          <div style={{ flex: 1 }}>
            <SearchableSelect
              options={activePeriods.map(p => ({ value: p.period_id, label: p.name }))}
              value={draft.period_id}
              onChange={onPickPeriod}
              placeholder="No period"
            />
          </div>
        )}
        <button onClick={onSave} disabled={saving} style={{ background: "#2563EB", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer" }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px", cursor: "pointer", color: "#64748B", display: "flex" }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
