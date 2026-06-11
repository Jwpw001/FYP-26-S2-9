import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageTransitionProvider } from "./components/PageTransition";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import NotificationsPage from "./components/NotificationsPage";

// Outlet Manager
import ManagerDashboard   from "./pages/outlet-manager/Dashboard";
import StaffList          from "./pages/outlet-manager/StaffList";
import StaffProfile       from "./pages/outlet-manager/StaffProfile";
import AddStaff           from "./pages/outlet-manager/AddStaff";
import ShiftsList         from "./pages/outlet-manager/ShiftsList";
import CreateShift        from "./pages/outlet-manager/CreateShift";
import ShiftDetail        from "./pages/outlet-manager/ShiftDetail";
import AvailabilityLeave  from "./pages/outlet-manager/AvailabilityLeave";
import Attendance         from "./pages/outlet-manager/Attendance";
import Reports            from "./pages/outlet-manager/Reports";
import ManagerNotifications from "./pages/outlet-manager/Notifications";

// System Admin
import AdminDashboard from "./pages/system-admin/Dashboard";
import SkillTags      from "./pages/system-admin/SkillTags";
import Businesses     from "./pages/system-admin/Businesses";
import Managers       from "./pages/system-admin/Managers";
import KrewbyWorkers  from "./pages/system-admin/KrewbyWorkers";

// Regular Staff
import StaffDashboard from "./pages/regular-staff/Dashboard";
import MyShifts       from "./pages/regular-staff/MyShifts";
import LeaveRequests  from "./pages/regular-staff/LeaveRequests";
import SwapRequests   from "./pages/regular-staff/SwapRequests";

// Outlet Casual Staff
import CasualDashboard    from "./pages/outlet-casual-staff/Dashboard";
import CasualMyShifts     from "./pages/outlet-casual-staff/MyShifts";
import WeeklyAvailability from "./pages/outlet-casual-staff/WeeklyAvailability";

// Krewby Coordinator
import CoordinatorDashboard from "./pages/krewby-coordinator/Dashboard";
import CoordinatorRequests  from "./pages/krewby-coordinator/Requests";
import CoordinatorWorkers   from "./pages/krewby-coordinator/Workers";
import CoordinatorLayout    from "./components/layout/CoordinatorLayout";

// Krewby Worker
import WorkerDashboard from "./pages/krewby-worker/Dashboard";
import WorkerLayout    from "./components/layout/WorkerLayout";

// Layouts
import StaffLayout   from "./components/layout/StaffLayout";
import CasualLayout  from "./components/layout/CasualLayout";

function PR({ roles, children }) {
  return <ProtectedRoute allowedRoles={roles}>{children}</ProtectedRoute>;
}

function App() {
  return (
    <BrowserRouter>
      <PageTransitionProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ── System Admin ─────────────────────────────── */}
        <Route path="/system-admin/dashboard"    element={<PR roles={["system_admin"]}><AdminDashboard /></PR>} />
        <Route path="/system-admin/businesses"   element={<PR roles={["system_admin"]}><Businesses /></PR>} />
        <Route path="/system-admin/managers"     element={<PR roles={["system_admin"]}><Managers /></PR>} />
        <Route path="/system-admin/skills"       element={<PR roles={["system_admin"]}><SkillTags /></PR>} />
        <Route path="/system-admin/krewby-workers" element={<PR roles={["system_admin"]}><KrewbyWorkers /></PR>} />

        {/* ── Outlet Manager ───────────────────────────── */}
        <Route path="/outlet-manager/dashboard"    element={<PR roles={["outlet_manager"]}><ManagerDashboard /></PR>} />
        <Route path="/outlet-manager/staff"        element={<PR roles={["outlet_manager"]}><StaffList /></PR>} />
        <Route path="/outlet-manager/staff/new"    element={<PR roles={["outlet_manager"]}><AddStaff /></PR>} />
        <Route path="/outlet-manager/staff/:id"    element={<PR roles={["outlet_manager"]}><StaffProfile /></PR>} />
        <Route path="/outlet-manager/shifts"       element={<PR roles={["outlet_manager"]}><ShiftsList /></PR>} />
        <Route path="/outlet-manager/shifts/new"   element={<PR roles={["outlet_manager"]}><CreateShift /></PR>} />
        <Route path="/outlet-manager/shifts/:id"   element={<PR roles={["outlet_manager"]}><ShiftDetail /></PR>} />
        <Route path="/outlet-manager/availability" element={<PR roles={["outlet_manager"]}><AvailabilityLeave /></PR>} />
        <Route path="/outlet-manager/attendance"   element={<PR roles={["outlet_manager"]}><Attendance /></PR>} />
        <Route path="/outlet-manager/reports"        element={<PR roles={["outlet_manager"]}><Reports /></PR>} />
        <Route path="/outlet-manager/notifications" element={<PR roles={["outlet_manager"]}><ManagerNotifications /></PR>} />

        {/* ── Regular Staff ────────────────────────────── */}
        <Route path="/regular-staff/dashboard"     element={<PR roles={["regular_staff"]}><StaffDashboard /></PR>} />
        <Route path="/regular-staff/shifts"        element={<PR roles={["regular_staff"]}><MyShifts /></PR>} />
        <Route path="/regular-staff/leave"         element={<PR roles={["regular_staff"]}><LeaveRequests /></PR>} />
        <Route path="/regular-staff/swaps"         element={<PR roles={["regular_staff"]}><SwapRequests /></PR>} />
        <Route path="/regular-staff/notifications" element={<PR roles={["regular_staff"]}>
          <NotificationsPage Layout={StaffLayout} />
        </PR>} />

        {/* ── Outlet Casual Staff ──────────────────────── */}
        <Route path="/outlet-casual-staff/dashboard"    element={<PR roles={["outlet_casual_staff"]}><CasualDashboard /></PR>} />
        <Route path="/outlet-casual-staff/shifts"       element={<PR roles={["outlet_casual_staff"]}><CasualMyShifts /></PR>} />
        <Route path="/outlet-casual-staff/availability" element={<PR roles={["outlet_casual_staff"]}><WeeklyAvailability /></PR>} />
        <Route path="/outlet-casual-staff/notifications" element={<PR roles={["outlet_casual_staff"]}>
          <NotificationsPage Layout={CasualLayout} />
        </PR>} />

        {/* ── Krewby Coordinator ───────────────────────── */}
        <Route path="/krewby-coordinator/dashboard"     element={<PR roles={["krewby_coordinator"]}><CoordinatorDashboard /></PR>} />
        <Route path="/krewby-coordinator/requests"      element={<PR roles={["krewby_coordinator"]}><CoordinatorRequests /></PR>} />
        <Route path="/krewby-coordinator/workers"       element={<PR roles={["krewby_coordinator"]}><CoordinatorWorkers  /></PR>} />
        <Route path="/krewby-coordinator/notifications" element={<PR roles={["krewby_coordinator"]}>
          <NotificationsPage Layout={CoordinatorLayout} />
        </PR>} />

        {/* ── Krewby Worker ────────────────────────────── */}
        <Route path="/krewby-worker/dashboard"     element={<PR roles={["krewby_casual_worker"]}><WorkerDashboard /></PR>} />
        <Route path="/krewby-worker/jobs"          element={<PR roles={["krewby_casual_worker"]}>
          <WorkerLayout title="My Jobs"><div style={{padding:"40px",textAlign:"center",color:"#7A7870"}}>Jobs coming soon</div></WorkerLayout>
        </PR>} />
        <Route path="/krewby-worker/availability"  element={<PR roles={["krewby_casual_worker"]}>
          <WorkerLayout title="Availability"><div style={{padding:"40px",textAlign:"center",color:"#7A7870"}}>Availability coming soon</div></WorkerLayout>
        </PR>} />
        <Route path="/krewby-worker/notifications" element={<PR roles={["krewby_casual_worker"]}>
          <NotificationsPage Layout={WorkerLayout} />
        </PR>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </PageTransitionProvider>
    </BrowserRouter>
  );
}

export default App;
