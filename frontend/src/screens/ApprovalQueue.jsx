import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { APPROVAL_ITEMS } from '../data/mockData';

export default function ApprovalQueue() {
  const [items, setItems] = useState(
    APPROVAL_ITEMS.map((item) => ({ ...item, status: 'pending' }))
  );

  const act = (id, action) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: action } : item))
    );
  };

  const pending  = items.filter((i) => i.status === 'pending').length;
  const approved = items.filter((i) => i.status === 'approved').length;
  const denied   = items.filter((i) => i.status === 'denied').length;

  return (
    <div>
      {/* Summary */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {pending} pending · {approved} approved · {denied} denied
        </div>
        <Badge cls="b-amber">{pending} needs action</Badge>
      </div>

      {/* Request cards */}
      {items.map((item) => (
        <div
          key={item.id}
          className={`approval-card${item.status !== 'pending' ? ' resolved' : ''}`}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div
                className="notif-icon"
                style={{ background: item.iconBg + '33', flexShrink: 0 }}
              >
                <i className={`ti ${item.icon}`} style={{ color: item.iconColor }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {item.detail}
                </div>
              </div>
            </div>

            <Badge
              cls={
                item.status === 'approved' ? 'b-green'
                : item.status === 'denied'  ? 'b-red'
                : item.urgency === 'urgent' ? 'b-red'
                : 'b-amber'
              }
            >
              {item.status === 'approved' ? 'Approved'
               : item.status === 'denied'  ? 'Denied'
               : item.urgency === 'urgent' ? 'Urgent'
               : 'Pending'}
            </Badge>
          </div>

          {item.status === 'pending' && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button className="btn-approve" onClick={() => act(item.id, 'approved')}>
                <i className="ti ti-check" /> Approve
              </button>
              <button className="btn-deny" onClick={() => act(item.id, 'denied')}>
                <i className="ti ti-x" /> Deny
              </button>
              <Button variant="secondary" className="btn-sm">
                View details
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
