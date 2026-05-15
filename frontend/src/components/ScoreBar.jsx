import React from 'react';

/**
 * ScoreBar — small labeled score bar used in Smart Assign recommendations
 */
export default function ScoreBar({ label, pct }) {
  return (
    <div className="sc-item">
      <div className="sc-bar-wrap">
        <div className="sc-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="sc-lbl">{label}</div>
    </div>
  );
}
