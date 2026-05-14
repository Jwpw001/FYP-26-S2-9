import React from 'react';

export function Card({ children, style, className = '' }) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, actionLabel }) {
  return (
    <div className="card-header">
      <span className="card-title">{title}</span>
      {action && (
        <span className="card-action" onClick={action}>
          {actionLabel}
        </span>
      )}
    </div>
  );
}
