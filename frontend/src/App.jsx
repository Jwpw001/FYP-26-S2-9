import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageTransitionProvider } from "./components/PageTransition";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import GetStarted from "./pages/GetStarted";
import RegisterBusiness from "./pages/RegisterBusiness";
import CreateAccount from "./pages/CreateAccount";
import JoinWorker   from "./pages/JoinWorker";
import ApplyWorker  from "./pages/ApplyWorker";
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
import ManpowerRequests    from "./pages/outlet-manager/ManpowerRequests";

// System Admin
import AdminDashboard      from "./pages/system-admin/Dashboard";
import SkillTags           from "./pages/system-admin/SkillTags";
import Businesses          from "./pages/system-admin/Businesses";
import BusinessDetail      from "./pages/system-admin/BusinessDetail";
import OutletDetail        from "./pages/system-admin/OutletDetail";
import KrewbyWorkers       from "./pages/system-admin/KrewbyWorkers";
import KrewbyWorkerDetail  from "./pages/system-admin/KrewbyWorkerDetail";
import AdminStaff          from "./pages/system-admin/Staff";
import AdminStaffDetail    from "./pages/system-admin/StaffDetail";
import AdminReports        from "./pages/system-admin/Reports";

// Regular Staff
import StaffDashboard from "./pages/regular-staff/Dashboard";
import MyShifts       from "./pages/regular-staff/MyShifts";
import LeaveRequests  from "./pages/regular-staff/LeaveRequests";
import SwapRequests   from "./pages/regular-staff/SwapRequests";

// Outlet Casual Staff
import CasualDashboard    from "./pages/outlet-casual-staff/Dashboard";
import CasualMyShifts     from "./pages/outlet-casual-staff/MyShifts";
import WeeklyAvailability from "./pages/outlet-casual-staff/WeeklyAvailability";

// Business Owner
import BODashboard   from "./pages/business-owner/Dashboard";
import BOOutlets     from "./pages/business-owner/Outlets";
import BOStaff       from "./pages/business-owner/Staff";
import BOOutletDetail from "./pages/business-owner/OutletDetail";
import BOStaffDetail  from "./pages/business-owner/StaffDetail";
import BOManagerDetail from "./pages/business-owner/ManagerDetail";
import BOInvitations from "./pages/business-owner/Invitations";
import BOSkills      from "./pages/business-owner/Skills";
import BOReports     from "./pages/business-owner/Reports";
import BusinessOwnerLayout from "./components/layout/BusinessOwnerLayout";
import AcceptInvite  from "./pages/AcceptInvite";
import JoinByCode    from "./pages/JoinByCode";
import OMInvitations from "./pages/outlet-manager/Invitations";

// System Admin — Krewby operations
import AdminApplications  from "./pages/system-admin/Applications";
import AdminRequests      from "./pages/system-admin/Requests";

// Krewby Worker
import WorkerDashboard    from "./pages/krewby-worker/Dashboard";
import WorkerMyJobs       from "./pages/krewby-worker/MyJobs";
import WorkerAvailability from "./pages/krewby-worker/Availability";
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
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/register/business" element={<RegisterBusiness />} />
        <Route path="/register/account" element={<CreateAccount />} />
        <Route path="/join" element={<JoinWorker />} />
        <Route path="/join/apply" element={<ApplyWorker />} />

        {/* Public: Accept Invite / Join by code */}
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/join-invite"   element={<JoinByCode />} />

        {/* ── Business Owner ───────────────────────────── */}
        <Route path="/business-owner/dashboard"   element={<PR roles={["business_owner"]}><BODashboard /></PR>} />
        <Route path="/business-owner/outlets"     element={<PR roles={["business_owner"]}><BOOutlets /></PR>} />
        <Route path="/business-owner/staff"       element={<PR roles={["business_owner"]}><BOStaff /></PR>} />
        <Route path="/business-owner/outlets/:id" element={<PR roles={["business_owner"]}><BOOutletDetail /></PR>} />
        <Route path="/business-owner/staff/:id"   element={<PR roles={["business_owner"]}><BOStaffDetail /></PR>} />
        <Route path="/business-owner/managers/:id" element={<PR roles={["business_owner"]}><BOManagerDetail /></PR>} />
        <Route path="/business-owner/invitations" element={<PR roles={["business_owner"]}><BOInvitations /></PR>} />
        <Route path="/business-owner/skills"      element={<PR roles={["business_owner"]}><BOSkills /></PR>} />
        <Route path="/business-owner/reports"     element={<PR roles={["business_owner"]}><BOReports /></PR>} />
        <Route path="/business-owner/notifications" element={<PR roles={["business_owner"]}>
          <NotificationsPage Layout={BusinessOwnerLayout} />
        </PR>} />

        {/* ── System Admin ─────────────────────────────── */}
        <Route path="/system-admin/dashboard"              element={<PR roles={["system_admin"]}><AdminDashboard /></PR>} />
        <Route path="/system-admin/businesses"            element={<PR roles={["system_admin"]}><Businesses /></PR>} />
        <Route path="/system-admin/businesses/:id"        element={<PR roles={["system_admin"]}><BusinessDetail /></PR>} />
        <Route path="/system-admin/outlets/:id"           element={<PR roles={["system_admin"]}><OutletDetail /></PR>} />
        <Route path="/system-admin/skills"                element={<PR roles={["system_admin"]}><SkillTags /></PR>} />
        <Route path="/system-admin/krewby-workers"        element={<PR roles={["system_admin"]}><KrewbyWorkers /></PR>} />
        <Route path="/system-admin/krewby-workers/:id"    element={<PR roles={["system_admin"]}><KrewbyWorkerDetail /></PR>} />
        <Route path="/system-admin/staff"                 element={<PR roles={["system_admin"]}><AdminStaff /></PR>} />
        <Route path="/system-admin/staff/:id"             element={<PR roles={["system_admin"]}><AdminStaffDetail /></PR>} />
        <Route path="/system-admin/reports"              element={<PR roles={["system_admin"]}><AdminReports /></PR>} />
        <Route path="/system-admin/applications"          element={<PR roles={["system_admin"]}><AdminApplications /></PR>} />
        <Route path="/system-admin/requests"              element={<PR roles={["system_admin"]}><AdminRequests /></PR>} />

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
        <Route path="/outlet-manager/manpower"       element={<PR roles={["outlet_manager"]}><ManpowerRequests /></PR>} />
        <Route path="/outlet-manager/invitations"   element={<PR roles={["outlet_manager"]}><OMInvitations /></PR>} />

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


        {/* ── Krewby Worker ────────────────────────────── */}
        <Route path="/krewby-worker/dashboard"     element={<PR roles={["krewby_casual_worker"]}><WorkerDashboard /></PR>} />
        <Route path="/krewby-worker/jobs"          element={<PR roles={["krewby_casual_worker"]}><WorkerMyJobs /></PR>} />
        <Route path="/krewby-worker/availability"  element={<PR roles={["krewby_casual_worker"]}><WorkerAvailability /></PR>} />
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
