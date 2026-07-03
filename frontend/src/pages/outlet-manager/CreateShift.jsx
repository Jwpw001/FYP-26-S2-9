import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function CreateShift() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId]   = useState(null);
  const [outletHours, setOutletHours] = useState({ open: null, close: null });
  const [skills, setSkills]       = useState([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const [form, setForm] = useState({
    title: "",
    shift_date: "",
    start_time: "",
    end_time: "",
  });

  const [roles, setRoles] = useState([
    { role_name: "", skill_id: "", headcount: 1 }
  ]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: myStaff }, libRes] = await Promise.all([
        supabase.from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1),
        api.get("/api/business/skills").catch(() => ({ skills: [] })),
      ]);
      const oid = myStaff?.[0]?.outlet_id || null;
      if (!cancelled) {
        setOutletId(oid);
        setSkills(libRes.skills || []);
      }
      if (oid) {
        const { data: outletData } = await supabase
          .from("outlets").select("open_time, close_time").eq("outlet_id", oid).single();
        if (!cancelled && outletData) {
          setOutletHours({
            open:  outletData.open_time  ? String(outletData.open_time).slice(0, 5)  : null,
            close: outletData.close_time ? String(outletData.close_time).slice(0, 5) : null,
          });
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function addRole() {
    setRoles(prev => [...prev, { role_name: "", skill_id: "", headcount: 1 }]);
  }

  function removeRole(idx) {
    setRoles(prev => prev.filter((_, i) => i !== idx));
  }

  function updateRole(idx, field, val) {
    setRoles(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  async function handleSave(publish = false) {
    if (!form.shift_date) { setError("Date is required."); return; }
    if (!form.start_time) { setError("Start time is required."); return; }
    if (!form.end_time)   { setError("End time is required."); return; }
    if (form.end_time <= form.start_time) {
      setError("End time must be after start time."); return;
    }
    if (outletHours.open && form.start_time < outletHours.open) {
      setError(`Start time cannot be before outlet opening time (${fmtTime(outletHours.open)}).`); return;
    }
    if (outletHours.close && form.end_time > outletHours.close) {
      setError(`End time cannot be after outlet closing time (${fmtTime(outletHours.close)}).`); return;
    }
    if (roles.some(r => !r.role_name.trim())) {
      setError("All roles must have a name."); return;
    }
    if (!outletId) { setError("No outlet found for your account."); return; }

    setSaving(true); setError("");

    try {
      // Create shift
      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .insert({
          outlet_id: outletId,
          title: form.title.trim() || null,
          shift_date: form.shift_date,
          start_time: form.start_time,
          end_time: form.end_time,
          status: publish ? "published" : "draft",
          created_by: userId,
        })
        .select().single();

      if (shiftErr) throw shiftErr;

      // Create roles
      if (roles.length > 0) {
        const roleRows = roles.map(r => ({
          shift_id: shift.shift_id,
          role_name: r.role_name.trim(),
          skill_id: r.skill_id ? Number(r.skill_id) : null,
          headcount: Number(r.headcount) || 1,
        }));
        const { error: roleErr } = await supabase
          .from("shift_roles").insert(roleRows);
        if (roleErr) throw roleErr;
      }

      navigate(`/outlet-manager/shifts/${shift.shift_id}`);
    } catch (err) {
      setError("Failed to save shift. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManagerLayout title="Create Shift">
      <button style={s.back} onClick={() => navigate("/outlet-manager/shifts")}>
        ← Back to Shifts
      </button>

      <div style={s.layout}>
        {/* Left — shift details */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Shift Details</h3>

          {error && <div style={s.error}>{error}</div>}

          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Shift Title (optional)</label>
              <input style={s.input} placeholder="e.g. Morning Shift"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Date *</label>
              <input style={s.input} type="date"
                value={form.shift_date}
                onChange={e => setForm(p => ({ ...p, shift_date: e.target.value }))} />
            </div>

            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Start Time *</label>
                <input style={s.input} type="time"
                  value={form.start_time}
                  min={outletHours.open || undefined}
                  max={outletHours.close || undefined}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>End Time *</label>
                <input style={s.input} type="time"
                  value={form.end_time}
                  min={form.start_time || outletHours.open || undefined}
                  max={outletHours.close || undefined}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            {(outletHours.open || outletHours.close) && (
              <p style={s.hoursHint}>
                Operating hours: {fmtTime(outletHours.open)} – {fmtTime(outletHours.close)}
              </p>
            )}
          </div>
        </div>

        {/* Right — roles */}
        <div style={s.section}>
          <div style={s.roleHeader}>
            <h3 style={s.sectionTitle}>Shift Roles</h3>
            <button style={s.addRoleBtn} onClick={addRole}>+ Add Role</button>
          </div>

          {roles.map((role, idx) => (
            <div key={idx} style={s.roleCard}>
              <div style={s.roleCardHeader}>
                <span style={s.roleNum}>Role {idx + 1}</span>
                {roles.length > 1 && (
                  <button style={s.removeBtn} onClick={() => removeRole(idx)}>
                    Remove
                  </button>
                )}
              </div>
              <div style={s.roleFields}>
                <div style={s.field}>
                  <label style={s.label}>Role Name *</label>
                  <input style={s.input} placeholder="e.g. Cashier"
                    value={role.role_name}
                    onChange={e => updateRole(idx, "role_name", e.target.value)} />
                </div>
                <div style={s.row2}>
                  <div style={s.field}>
                    <label style={s.label}>Required Skill</label>
                    <select style={s.input} value={role.skill_id}
                      onChange={e => updateRole(idx, "skill_id", e.target.value)}>
                      <option value="">Any skill</option>
                      {skills.map(sk => (
                        <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Headcount</label>
                    <input style={s.input} type="number" min="1" max="20"
                      value={role.headcount}
                      onChange={e => updateRole(idx, "headcount", e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={s.actions}>
        <button style={s.cancelBtn}
          onClick={() => navigate("/outlet-manager/shifts")}>
          Cancel
        </button>
        <button style={s.draftBtn} onClick={() => handleSave(false)} disabled={saving}>
          {saving ? "Saving…" : "Save as Draft"}
        </button>
        <button style={s.publishBtn} onClick={() => handleSave(true)} disabled={saving}>
          {saving ? "Publishing…" : "Save & Publish"}
        </button>
      </div>
    </ManagerLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const s = {
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600",
    color:"#7A7870", cursor:"pointer", marginBottom:"20px", padding:0 },
  layout: { display:"grid", gridTemplateColumns:"1fr 1fr",
    gap:"20px", marginBottom:"20px" },
  section: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"24px" },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"14px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600",
    color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  row2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" },

  /* Roles */
  roleHeader: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"16px" },
  addRoleBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"8px", padding:"6px 12px", fontSize:"13px",
    fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  roleCard: { background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"10px", padding:"14px", marginBottom:"10px" },
  roleCardHeader: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"10px" },
  roleNum: { fontSize:"12px", fontWeight:"700", color:"#7A7870",
    textTransform:"uppercase", letterSpacing:"0.05em" },
  removeBtn: { background:"none", border:"none", fontSize:"12px",
    color:"#991B1B", cursor:"pointer", fontWeight:"600" },
  roleFields: { display:"flex", flexDirection:"column", gap:"10px" },

  /* Actions */
  actions: { display:"flex", justifyContent:"flex-end", gap:"10px",
    flexWrap:"wrap" },
  cancelBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"10px", padding:"10px 20px", fontSize:"14px",
    fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  draftBtn: { background:"#F7F6F3", border:"1.5px solid #1C1B18",
    borderRadius:"10px", padding:"10px 20px", fontSize:"14px",
    fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  publishBtn: { background:"#1C1B18", border:"none",
    borderRadius:"10px", padding:"10px 20px", fontSize:"14px",
    fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
  hoursHint: { fontSize:"12px", color:"#7A7870", marginTop:"6px",
    background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"7px",
    padding:"6px 10px" },
};
