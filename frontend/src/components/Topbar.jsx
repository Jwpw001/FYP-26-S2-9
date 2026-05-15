import React from 'react';

const SCREEN_TITLES = {
  dashboard:     'Dashboard',
  schedule:      'Shift Schedule',
  recommend:     'Smart Assign',
  shiftdetail:   'Shift Detail',
  staff:         'Staff Management',
  staffprofile:  'Staff Profile',
  clockin:       'Clock In / Out',
  approval:      'Approval Queue',
  krewby:        'Krewby Requests',
  workerprofile: 'Worker Profile',
  ai:            'AI Workforce Assistant',
  reports:       'Reports & Attendance',
  myshift:       'My Schedule',
  availability:  'My Availability',
  notifications: 'Notifications',
  settings:      'Settings',
  account:       'My Account',
};

const ROLE_TABS = [
  { id: 'manager',     label: 'Outlet Manager' },
  { id: 'staff',       label: 'Staff View' },
  { id: 'coordinator', label: 'Krewby Coordinator' },
];

export default function Topbar({ role, screen, onRoleSwitch, onNotifications, onAccount }) {
  return (
    <div className="topbar">
      <div className="role-tabs">
        {ROLE_TABS.map((tab) => (
          <div
            key={tab.id}
            className={`role-tab${role === tab.id ? ' active' : ''}`}
            onClick={() => onRoleSwitch(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div className="page-header">
        <div className="page-title">{SCREEN_TITLES[screen] || screen}</div>
        <div className="header-actions">
          <div className="icon-btn" onClick={onNotifications} title="Notifications">
            <i className="ti ti-bell" style={{ fontSize: 16 }} aria-hidden="true" />
            <div className="notif-dot" />
          </div>
          <div className="icon-btn" onClick={onAccount} title="My Account">
            <i className="ti ti-user-circle" style={{ fontSize: 16 }} aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
