import React from 'react';

/**
 * Button component
 * @param {'primary'|'secondary'|'approve'|'deny'} variant
 * @param {string} className - additional class names
 */
export default function Button({
  variant = 'primary',
  className = '',
  onClick,
  style,
  children,
  type = 'button',
}) {
  const base =
    variant === 'approve' ? 'btn-approve'
    : variant === 'deny'  ? 'btn-deny'
    : `btn-${variant}`;

  return (
    <button
      type={type}
      className={`${base} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}
