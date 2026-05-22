import React from 'react';

export default function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      background: 'var(--red)', border: '0.5px solid var(--red-b)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <i className="ti ti-alert-circle" style={{ color: 'var(--red-t)', fontSize: 16, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13, color: 'var(--red-t)' }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'none', border: '0.5px solid var(--red-t)', borderRadius: 6,
            padding: '3px 10px', fontSize: 12, color: 'var(--red-t)', cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
