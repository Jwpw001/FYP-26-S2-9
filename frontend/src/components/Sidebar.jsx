import React from 'react';
import { ROLES } from '../data/mockData';

const MANAGER_NAV = [
  { id: 'dashboard',  icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { id: 'schedule',   icon: 'ti-calendar-week',    label: 'Schedule' },
  { id: 'staff',      icon: 'ti-users',             label: 'Staff' },
  { id: 'clockin',    icon: 'ti-login',             label: 'Clock In' },
  { id: 'approval',   icon: 'ti-check-circle',      label: 'Approval Queue' },
  { id: 'krewby',     icon: 'ti-briefcase',         label: 'Krewby Requests' },
  null,
  { id: 'ai',         icon: 'ti-message-bolt',      label: 'AI Assistant' },
  { id: 'reports',    icon: 'ti-chart-bar',         label: 'Reports' },
  null,
  { id: 'settings',   icon: 'ti-settings',          label: 'Settings' },
];

const STAFF_NAV = [
  { id: 'myshift',      icon: 'ti-calendar-user', label: 'My Schedule' },
  { id: 'availability', icon: 'ti-clock-check',   label: 'My Availability' },
  null,
  { id: 'account',      icon: 'ti-user-circle',   label: 'My Account' },
];

const COORD_NAV = [
  { id: 'krewby',  icon: 'ti-briefcase',    label: 'Krewby Requests' },
  null,
  { id: 'ai',      icon: 'ti-message-bolt', label: 'AI Assistant' },
  { id: 'reports', icon: 'ti-chart-bar',    label: 'Reports' },
  null,
  { id: 'account', icon: 'ti-user-circle',  label: 'My Account' },
];

// Screens that belong to a parent nav item (for active highlighting)
const SCREEN_PARENT = {
  staffprofile:  'staff',
  shiftdetail:   'schedule',
  recommend:     'schedule',
  workerprofile: 'krewby',
  notifications: null,
  account:       'account',
};

export default function Sidebar({ role, screen, onNavigate }) {
  const user = ROLES[role];
  const nav  = role === 'manager' ? MANAGER_NAV : role === 'staff' ? STAFF_NAV : COORD_NAV;

  const isActive = (itemId) => {
    if (screen === itemId) return true;
    return SCREEN_PARENT[screen] === itemId;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <i className="ti ti-calendar-event" aria-hidden="true" />
        </div>
        <span className="sidebar-logo-text">Krewby</span>
      </div>

      <div className="sidebar-role-label">{user.label}</div>

      {nav.map((item, i) =>
        item === null ? (
          <div className="nav-divider" key={`div-${i}`} />
        ) : (
          <div
            key={item.id}
            className={`nav-item${isActive(item.id) ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <i className={`ti ${item.icon}`} aria-hidden="true" />
            {item.label}
          </div>
        )
      )}

      <div className="sidebar-bottom">
        <div className="sidebar-user" style={{ cursor: 'pointer' }} onClick={() => onNavigate('account')}>
          <div className="sidebar-avatar">{user.initials}</div>
          <div>
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-sub">{user.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
