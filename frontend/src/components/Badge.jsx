import React from 'react';

/**
 * Badge — colored status pill
 * @param {string} cls - color class: b-green | b-red | b-amber | b-blue | b-purple | b-gray
 */
export default function Badge({ cls, children }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}
