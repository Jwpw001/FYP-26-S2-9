import React from 'react';

export default function EmptyState({ icon = 'ti-inbox', title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px', gap: 8, textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--tag)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 22, color: 'var(--muted)' }} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280 }}>{subtitle}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
