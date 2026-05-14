import React, { useState } from 'react';
import Badge from '../components/Badge';
import Button from '../components/Button';
import { AVAIL_INIT, AVAIL_DAYS, AVAIL_PERIODS } from '../data/mockData';

export default function Availability() {
  // Deep-clone initial state so toggles are independent
  const [cells, setCells] = useState(() => AVAIL_INIT.map((row) => [...row]));

  const cycleCell = (ri, ci) => {
    setCells((prev) => {
      const next = prev.map((row) => [...row]);
      const cur  = next[ri][ci];
      next[ri][ci] = cur === 'yes' ? 'maybe' : cur === 'maybe' ? 'no' : 'yes';
      return next;
    });
  };

  const renderCellContent = (val) => {
    if (val === 'yes')   return <i className="ti ti-check" style={{ fontSize: 12 }} aria-hidden="true" />;
    if (val === 'maybe') return '~';
    return null;
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Submit availability — Week 26 (17–23 Jun)</span>
        <span className="annot">Casual staff only</span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        Tap cells to toggle availability. Unfilled = unavailable by default.
      </div>

      {/* Grid */}
      <div className="avail-grid">
        {/* Header row */}
        <div />
        {AVAIL_DAYS.map((d) => (
          <div className="avail-day" key={d}>{d}</div>
        ))}

        {/* Data rows */}
        {AVAIL_PERIODS.map((period, ri) => (
          <React.Fragment key={period}>
            <div className="avail-label">{period}</div>
            {AVAIL_DAYS.map((_, ci) => {
              const val = cells[ri][ci];
              return (
                <div
                  key={ci}
                  className={`avail-cell av-${val}`}
                  onClick={() => cycleCell(ri, ci)}
                  role="button"
                  aria-label={`${period} ${AVAIL_DAYS[ci]}: ${val}`}
                >
                  {renderCellContent(val)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend + submit */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Badge cls="b-green">
          <i className="ti ti-check" /> Available
        </Badge>
        <Badge cls="b-amber">~ Maybe</Badge>
        <Badge cls="b-gray">Unavailable</Badge>
        <Button variant="primary" className="btn-sm" style={{ marginLeft: 'auto' }}>
          Submit availability
        </Button>
      </div>
    </div>
  );
}
