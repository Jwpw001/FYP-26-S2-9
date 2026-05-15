import React from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { WEEK_DAYS, SCHEDULE_ROWS } from '../data/mockData';

export default function Schedule({ onNavigate }) {
  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="secondary" className="btn-sm">
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </Button>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Week 25 · 10–16 Jun 2025</span>
          <Button variant="secondary" className="btn-sm">
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" className="btn-sm">
            <i className="ti ti-filter" aria-hidden="true" /> Filter
          </Button>
          <Button variant="primary" className="btn-sm" onClick={() => onNavigate('recommend')}>
            <i className="ti ti-wand" aria-hidden="true" /> Smart Assign
          </Button>
        </div>
      </div>

      {/* Week grid */}
      <div className="week-grid">
        {/* Header row */}
        <div className="wg-hd" />
        {WEEK_DAYS.map((d, i) => (
          <div className={`wg-hd${i === 0 ? ' today' : ''}`} key={d}>{d}</div>
        ))}

        {/* Shift rows */}
        {SCHEDULE_ROWS.map((row) => (
          <React.Fragment key={row.label}>
            <div className="wg-label">{row.label}</div>
            {row.cells.map((cell, ci) => (
              <div
                className="wg-cell"
                key={ci}
                style={row.cellStyles?.[ci] || undefined}
              >
                {cell.map((block, bi) => (
                  <div className={`sb ${block.cls}`} key={bi}>{block.text}</div>
                ))}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="annot">Conflict detection auto-runs on publish</span>
        <Badge cls="b-red">
          <i className="ti ti-alert-triangle" /> 3 conflicts found — resolve before publishing
        </Badge>
        <Button variant="primary" className="btn-sm" style={{ marginLeft: 'auto' }}>
          Publish schedule
        </Button>
      </div>
    </div>
  );
}
