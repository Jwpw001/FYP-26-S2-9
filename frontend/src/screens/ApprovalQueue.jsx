import React, { useState, useEffect } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { LoadingCard } from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import EmptyState from '../components/EmptyState';
import { APPROVAL_ITEMS } from '../data/mockData';
// import { apiGetRequests, apiUpdateRequest } from '../services/api'; // ← uncomment when ready

export default function ApprovalQueue() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [actionLoading, setActionLoading] = useState({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      // const data = await apiGetRequests('pending'); // ← real API
      // setItems(data.requests.map(r => ({ ...r, status: 'pending' })));
      await new Promise(r => setTimeout(r, 400)); // simulate load
      setItems(APPROVAL_ITEMS.map(i => ({ ...i, status: 'pending' })));
    } catch (e) {
      setError('Could not load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      // await apiUpdateRequest(id, action); // ← real API
      await new Promise(r => setTimeout(r, 300));
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: action } : i));
    } catch (e) {
      setError('Failed to update request. Please try again.');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const pending  = items.filter(i => i.status === 'pending').length;
  const approved = items.filter(i => i.status === 'approved').length;
  const denied   = items.filter(i => i.status === 'denied').length;

  if (loading) return <LoadingCard message="Loading requests…" />;

  return (
    <div>
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {pending} pending · {approved} approved · {denied} denied
        </div>
        {pending > 0 && <Badge cls="b-amber">{pending} needs action</Badge>}
      </div>

      {items.length === 0 && (
        <div className="card">
          <EmptyState icon="ti-check-circle" title="All caught up" subtitle="No pending requests right now." />
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className={`approval-card${item.status !== 'pending' ? ' resolved' : ''}`}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div style={{ display:'flex', gap: 10, alignItems:'flex-start' }}>
              <div className="notif-icon" style={{ background: item.iconBg + '33', flexShrink: 0 }}>
                <i className={`ti ${item.icon}`} style={{ color: item.iconColor }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.detail}</div>
              </div>
            </div>
            <Badge cls={
              item.status === 'approved' ? 'b-green'
              : item.status === 'denied'  ? 'b-red'
              : item.urgency === 'urgent' ? 'b-red'
              : 'b-amber'
            }>
              {item.status === 'approved' ? 'Approved'
               : item.status === 'denied'  ? 'Denied'
               : item.urgency === 'urgent' ? 'Urgent'
               : 'Pending'}
            </Badge>
          </div>

          {item.status === 'pending' && (
            <div style={{ display:'flex', gap: 6, marginTop: 10 }}>
              <button
                className="btn-approve"
                disabled={actionLoading[item.id]}
                onClick={() => act(item.id, 'approved')}
              >
                {actionLoading[item.id] ? '…' : <><i className="ti ti-check" /> Approve</>}
              </button>
              <button
                className="btn-deny"
                disabled={actionLoading[item.id]}
                onClick={() => act(item.id, 'denied')}
              >
                {actionLoading[item.id] ? '…' : <><i className="ti ti-x" /> Deny</>}
              </button>
              <Button variant="secondary" className="btn-sm">View details</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
