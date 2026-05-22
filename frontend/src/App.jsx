import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import Sidebar from './components/Sidebar';
import Topbar  from './components/Topbar';

// Screens
import Login           from './screens/Login';
import Dashboard       from './screens/Dashboard';
import Schedule        from './screens/Schedule';
import SmartAssign     from './screens/SmartAssign';
import StaffManagement from './screens/StaffManagement';
import ApprovalQueue   from './screens/ApprovalQueue';
import KrewbyRequests  from './screens/KrewbyRequests';
import AIAssistant     from './screens/AIAssistant';
import Reports         from './screens/Reports';
import MySchedule      from './screens/MySchedule';
import Availability    from './screens/Availability';
import StaffProfile        from './screens/StaffProfile';
import ShiftDetail         from './screens/ShiftDetail';
import ClockIn             from './screens/ClockIn';
import Notifications       from './screens/Notifications';
import KrewbyWorkerProfile from './screens/KrewbyWorkerProfile';
import Settings            from './screens/Settings';
import AccountProfile      from './screens/AccountProfile';

const ROLE_DEFAULT = {
  manager:     'dashboard',
  staff:       'myshift',
  coordinator: 'krewby',
};

function AppShell() {
  const { user, logout } = useAuth();
  const [loggedIn, setLoggedIn] = useState(false);
  const [role,     setRole]     = useState('manager');
  const [screen,   setScreen]   = useState('dashboard');

  const handleLogin = (userRole) => {
    setRole(userRole || 'manager');
    setScreen(ROLE_DEFAULT[userRole] || 'dashboard');
    setLoggedIn(true);
  };

  const handleRoleSwitch = (newRole) => {
    setRole(newRole);
    setScreen(ROLE_DEFAULT[newRole]);
  };

  const handleNavigate = (screenId) => setScreen(screenId);

  if (!loggedIn) return <Login onLogin={handleLogin} />;

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':     return <Dashboard       onNavigate={handleNavigate} />;
      case 'schedule':      return <Schedule        onNavigate={handleNavigate} />;
      case 'recommend':     return <SmartAssign     onNavigate={handleNavigate} />;
      case 'staff':         return <StaffManagement onNavigate={handleNavigate} />;
      case 'approval':      return <ApprovalQueue />;
      case 'krewby':        return <KrewbyRequests  onNavigate={handleNavigate} />;
      case 'ai':            return <AIAssistant />;
      case 'reports':       return <Reports />;
      case 'myshift':       return <MySchedule />;
      case 'availability':  return <Availability />;
      case 'staffprofile':  return <StaffProfile      onBack={() => handleNavigate('staff')} />;
      case 'shiftdetail':   return <ShiftDetail        onBack={() => handleNavigate('schedule')} onSmartAssign={() => handleNavigate('recommend')} />;
      case 'clockin':       return <ClockIn />;
      case 'notifications': return <Notifications      onNavigate={handleNavigate} />;
      case 'workerprofile': return <KrewbyWorkerProfile onBack={() => handleNavigate('krewby')} />;
      case 'settings':      return <Settings />;
      case 'account':       return <AccountProfile onLogout={() => { logout(); setLoggedIn(false); }} />;
      default:              return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app">
      <Sidebar role={role} screen={screen} onNavigate={handleNavigate} />
      <div className="main">
        <Topbar
          role={role}
          screen={screen}
          onRoleSwitch={handleRoleSwitch}
          onNotifications={() => handleNavigate('notifications')}
          onAccount={() => handleNavigate('account')}
        />
        <div className="content">{renderScreen()}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
