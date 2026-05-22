import React from 'react';

export function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 0', gap: 12,
    }}>
      <div style={{
        width: 28, height: 28, border: '2.5px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{message}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function LoadingCard({ message }) {
  return (
    <div className="card">
      <LoadingSpinner message={message} />
    </div>
  );
}
