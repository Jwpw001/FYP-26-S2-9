import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { useGoTo } from "../../components/PageTransition";
import { Plus, Users, CheckCircle, XCircle } from "lucide-react";

const STATUS_STYLE = {
  open:      { bg: "#ECFDF5", color: "#059669", label: "Open" },
  filled:    { bg: "#DBEAFE", color: "#1E40AF", label: "Filled" },
  cancelled: { bg: "#FEF2F2", color: "#DC2626", label: "Cancelled" },
};

export default function CasualRequests() {
  const goTo = useGoTo();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadRequests(); }, []);

  function loadRequests() {
    setLoading(true);
    api.get("/api/casual/manager/requests")
      .then(d => setRequests(d.requests || []))
      .finally(() => setLoading(false));
  }

  return (
    <ManagerLayout title="Casual Requests">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Casual Requests</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Post requests for casual workers and review applicants.</p>
        </div>
        <button onClick={() => setShowForm(true)} style={s.createBtn}>
          <Plus size={15} /> Post Request
        </button>
      </div>

      {showForm && (
        <CreateRequestForm
          onCreated={() => { setShowForm(false); loadRequests(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3].map(i => <div key={i} style={{ height: "80px", background: "#F1F5F9", borderRadius: "14px" }} />)}
        </div>
      ) : requests.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: "28px", marginBottom: "10px" }}>📋</p>
          <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No requests yet</p>
          <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>Post your first casual request to find available workers.</p>
          <button onClick={() => setShowForm(true)} style={s.createBtn}><Plus size={15} /> Post Request</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {requests.map(req => (
            <RequestRow key={req.request_id} req={req} onClick={() => goTo(`/outlet-manager/casual-requests/${req.request_id}`)} />
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

function RequestRow({ req, onClick }) {
  const st = STATUS_STYLE[req.status] || STATUS_STYLE.open;
  return (
    <div onClick={onClick} style={s.row}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: "700", color: "#1E293B", fontSize: "15px" }}>{req.role_name}</p>
        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>
          {req.work_date} · {req.start_time?.slice(0,5)}–{req.end_time?.slice(0,5)} · {req.headcount} worker{req.headcount !== 1 ? "s" : ""}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#64748B" }}>
          <Users size={13} /> {req.applicant_count} applied
          {req.confirmed_count > 0 && <span style={{ color: "#059669", fontWeight: "700" }}> · {req.confirmed_count} confirmed</span>}
        </div>
        <span style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color }}>
          {st.label}
        </span>
        <span style={{ color: "#CBD5E1", fontSize: "18px" }}>›</span>
      </div>
    </div>
  );
}

function CreateRequestForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ role_name: "", work_date: "", start_time: "", end_time: "", headcount: 1, notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.post("/api/casual/manager/requests", form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.formCard}>
      <p style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", marginBottom: "18px" }}>Post a Casual Request</p>
      {error && <div style={s.errorBox}>{error}</div>}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <FormField label="Role / Job Title" required>
          <input style={s.input} value={form.role_name} onChange={e => set("role_name", e.target.value)} placeholder="e.g. Barista, Cashier" required />
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
          <FormField label="Date" required>
            <input style={s.input} type="date" value={form.work_date} onChange={e => set("work_date", e.target.value)} required />
          </FormField>
          <FormField label="Start Time" required>
            <input style={s.input} type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} required />
          </FormField>
          <FormField label="End Time" required>
            <input style={s.input} type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} required />
          </FormField>
        </div>
        <FormField label="Workers Needed">
          <input style={s.input} type="number" min={1} max={20} value={form.headcount} onChange={e => set("headcount", Number(e.target.value))} />
        </FormField>
        <FormField label="Notes (optional)">
          <textarea style={{ ...s.input, resize: "vertical", minHeight: "64px" }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any specific requirements or instructions…" />
        </FormField>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={s.cancelBtn}>Cancel</button>
          <button type="submit" disabled={loading} style={s.submitBtn}>{loading ? "Posting…" : "Post Request"}</button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, children, required }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "11px", fontWeight: "700", color: "#7A7870", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}

const s = {
  createBtn: { display: "flex", alignItems: "center", gap: "6px", background: "#2563EB", color: "#FFF", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  empty: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px 40px", textAlign: "center" },
  row: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", transition: "border-color 0.15s" },
  formCard: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", marginBottom: "24px" },
  errorBox: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "10px 14px", fontSize: "13px", color: "#DC2626", marginBottom: "12px" },
  input: { border: "1.5px solid #E5E2DC", borderRadius: "10px", padding: "9px 12px", fontSize: "14px", color: "#1C1B18", background: "#FAFAF8", outline: "none", width: "100%", boxSizing: "border-box" },
  cancelBtn: { background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer" },
  submitBtn: { background: "#2563EB", border: "none", borderRadius: "9px", padding: "9px 20px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer" },
};
