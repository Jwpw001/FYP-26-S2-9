import React from 'react';

/**
 * MiniAvatar — small circular avatar with initials
 * @param {string} id - initials text
 * @param {string} cls - color class: ma-blue | ma-green | ma-purple | ma-amber | ma-red
 * @param {number} size - pixel size (default 22)
 */
export default function MiniAvatar({ id, cls = 'ma-blue', size = 22 }) {
  return (
    <div
      className={`ma ${cls}`}
      style={
        size !== 22
          ? { width: size, height: size, fontSize: size * 0.45 }
          : undefined
      }
    >
      {id}
    </div>
  );
}
