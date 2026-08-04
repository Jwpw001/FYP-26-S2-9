import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageTransitionProvider } from "./components/PageTransition";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import GetStarted from "./pages/GetStarted";
import RegisterBusiness from "./pages/RegisterBusiness";
import CreateAccount from "./pages/CreateAccount";
import ProtectedRoute from "./components/ProtectedRoute";
import NotificationsPage from "./components/NotificationsPage";

// Manager
import ManagerDashboard   from "./pages/manager/Dashboard";
import StaffList          from "./pages/manager/StaffList";
import StaffProfile       from "./pages/manager/StaffProfile";
import AddStaff           from "./pages/manager/AddStaff";
import ShiftsList         from "./pages/manager/ShiftsList";
import CreateShift        from "./pages/manager/CreateShift";
import ShiftDetail        from "./pages/manager/ShiftDetail";
import AvailabilityLeave  from "./pages/manager/AvailabilityLeave";
import Attendance         from "./pages/manager/Attendance";
import Reports            from "./pages/manager/Reports";
import ReportHistory      from "./pages/manager/ReportHistory";
import ManagerNotifications from "./pages/manager/Notifications";
import SkillSettings       from "./pages/manager/SkillSettings";
import ManagerSettings     from "./pages/manager/Settings";
import ManagerCasualPool   from "./pages/manager/CasualPool";

// System Admin
import AdminDashboard      from "./pages/system-admin/Dashboard";
import SkillTags           from "./pages/system-admin/SkillTags";
import Businesses          from "./pages/system-admin/Businesses";
import BusinessDetail      from "./pages/system-admin/BusinessDetail";
import BranchDetail        from "./pages/system-admin/BranchDetail";
import AdminStaff          from "./pages/system-admin/Staff";
import AdminStaffDetail    from "./pages/system-admin/StaffDetail";
import AdminReports        from "./pages/system-admin/Reports";
import AdminReportHistory  from "./pages/system-admin/ReportHistory";

// Regular Staff
import StaffDashboard from "./pages/regular-staff/Dashboard";
import MyShifts       from "./pages/regular-staff/MyShifts";
import LeaveRequests  from "./pages/regular-staff/LeaveRequests";
import SwapRequests   from "./pages/regular-staff/SwapRequests";

// Casual Staff
import CasualDashboard    from "./pages/casual-staff/Dashboard";
import CasualBranches      from "./pages/casual-staff/Branches";
import CasualAvailability  from "./pages/casual-staff/Availability";
import CasualMyShifts      from "./pages/casual-staff/MyShifts";
import CasualSwapRequests  from "./pages/casual-staff/SwapRequests";
import RegisterCasual     from "./pages/RegisterCasual";

// Business Owner
import BODashboard   from "./pages/business-owner/Dashboard";
import BOBranches     from "./pages/business-owner/Branches";
import BOStaff       from "./pages/business-owner/Staff";
import BOBranchDetail from "./pages/business-owner/BranchDetail";
import BOStaffDetail  from "./pages/business-owner/StaffDetail";
import BOManagerDetail from "./pages/business-owner/ManagerDetail";
import BOInvitations from "./pages/business-owner/Invitations";
import BOSkills      from "./pages/business-owner/Skills";
import BOReports        from "./pages/business-owner/Reports";
import BOReportHistory  from "./pages/business-owner/ReportHistory";
import BOSettings    from "./pages/business-owner/Settings";
import BusinessOwnerLayout from "./components/layout/BusinessOwnerLayout";
import AcceptInvite  from "./pages/AcceptInvite";
import JoinByCode    from "./pages/JoinByCode";
import OMInvitations      from "./pages/manager/Invitations";

// Layouts
import StaffLayout   from "./components/layout/StaffLayout";
import CasualLayout  from "./components/layout/CasualLayout";
import AdminLayout   from "./components/layout/AdminLayout";

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
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/register/business" element={<RegisterBusiness />} />
        <Route path="/register/account" element={<CreateAccount />} />

        {/* Public: Accept Invite / Join by code / Casual registration */}
        <Route path="/invite/:token"    element={<AcceptInvite />} />
        <Route path="/join-invite"      element={<JoinByCode />} />
        <Route path="/register/casual"  element={<RegisterCasual />} />

        {/* ── Business Owner ───────────────────────────── */}
        <Route path="/business-owner/dashboard"   element={<PR roles={["business_owner"]}><BODashboard /></PR>} />
        <Route path="/business-owner/branches"     element={<PR roles={["business_owner"]}><BOBranches /></PR>} />
        <Route path="/business-owner/staff"       element={<PR roles={["business_owner"]}><BOStaff /></PR>} />
        <Route path="/business-owner/branches/:id" element={<PR roles={["business_owner"]}><BOBranchDetail /></PR>} />
        <Route path="/business-owner/staff/:id"   element={<PR roles={["business_owner"]}><BOStaffDetail /></PR>} />
        <Route path="/business-owner/managers/:id" element={<PR roles={["business_owner"]}><BOManagerDetail /></PR>} />
        <Route path="/business-owner/invitations" element={<PR roles={["business_owner"]}><BOInvitations /></PR>} />
        <Route path="/business-owner/skills"      element={<PR roles={["business_owner"]}><BOSkills /></PR>} />
        <Route path="/business-owner/reports"        element={<PR roles={["business_owner"]}><BOReports /></PR>} />
        <Route path="/business-owner/report-history" element={<PR roles={["business_owner"]}><BOReportHistory /></PR>} />
        <Route path="/business-owner/settings"     element={<PR roles={["business_owner"]}><BOSettings /></PR>} />
        <Route path="/business-owner/notifications" element={<PR roles={["business_owner"]}>
          <NotificationsPage Layout={BusinessOwnerLayout} />
        </PR>} />

        {/* ── System Admin ─────────────────────────────── */}
        <Route path="/system-admin/dashboard"              element={<PR roles={["system_admin"]}><AdminDashboard /></PR>} />
        <Route path="/system-admin/businesses"            element={<PR roles={["system_admin"]}><Businesses /></PR>} />
        <Route path="/system-admin/businesses/:id"        element={<PR roles={["system_admin"]}><BusinessDetail /></PR>} />
        <Route path="/system-admin/branches/:id"           element={<PR roles={["system_admin"]}><BranchDetail /></PR>} />
        <Route path="/system-admin/skills"                element={<PR roles={["system_admin"]}><SkillTags /></PR>} />
        <Route path="/system-admin/staff"                 element={<PR roles={["system_admin"]}><AdminStaff /></PR>} />
        <Route path="/system-admin/staff/:id"             element={<PR roles={["system_admin"]}><AdminStaffDetail /></PR>} />
        <Route path="/system-admin/reports"               element={<PR roles={["system_admin"]}><AdminReports /></PR>} />
        <Route path="/system-admin/report-history"        element={<PR roles={["system_admin"]}><AdminReportHistory /></PR>} />
        <Route path="/system-admin/notifications" element={<PR roles={["system_admin"]}>
          <NotificationsPage Layout={AdminLayout} />
        </PR>} />

        {/* ── Manager ───────────────────────────── */}
        <Route path="/manager/dashboard"    element={<PR roles={["manager"]}><ManagerDashboard /></PR>} />
        <Route path="/manager/staff"        element={<PR roles={["manager"]}><StaffList /></PR>} />
        <Route path="/manager/staff/new"    element={<PR roles={["manager"]}><AddStaff /></PR>} />
        <Route path="/manager/staff/:id"    element={<PR roles={["manager"]}><StaffProfile /></PR>} />
        <Route path="/manager/shifts"       element={<PR roles={["manager"]}><ShiftsList /></PR>} />
        <Route path="/manager/shifts/new"   element={<PR roles={["manager"]}><CreateShift /></PR>} />
        <Route path="/manager/shifts/:id"   element={<PR roles={["manager"]}><ShiftDetail /></PR>} />
        <Route path="/manager/availability" element={<PR roles={["manager"]}><AvailabilityLeave /></PR>} />
        <Route path="/manager/attendance"   element={<PR roles={["manager"]}><Attendance /></PR>} />
        <Route path="/manager/reports"         element={<PR roles={["manager"]}><Reports /></PR>} />
        <Route path="/manager/report-history"  element={<PR roles={["manager"]}><ReportHistory /></PR>} />
        <Route path="/manager/notifications" element={<PR roles={["manager"]}><ManagerNotifications /></PR>} />
        <Route path="/manager/skills"        element={<PR roles={["manager"]}><SkillSettings /></PR>} />
        <Route path="/manager/invitations"           element={<PR roles={["manager"]}><OMInvitations /></PR>} />
        <Route path="/manager/settings"            element={<PR roles={["manager"]}><ManagerSettings /></PR>} />
        <Route path="/manager/casual"              element={<PR roles={["manager"]}><ManagerCasualPool /></PR>} />

        {/* ── Regular Staff ────────────────────────────── */}
        <Route path="/regular-staff/dashboard"     element={<PR roles={["regular_staff"]}><StaffDashboard /></PR>} />
        <Route path="/regular-staff/shifts"        element={<PR roles={["regular_staff"]}><MyShifts /></PR>} />
        <Route path="/regular-staff/leave"         element={<PR roles={["regular_staff"]}><LeaveRequests /></PR>} />
        <Route path="/regular-staff/swaps"         element={<PR roles={["regular_staff"]}><SwapRequests /></PR>} />
        <Route path="/regular-staff/notifications" element={<PR roles={["regular_staff"]}>
          <NotificationsPage Layout={StaffLayout} />
        </PR>} />

        {/* ── Casual Staff ──────────────────────── */}
        <Route path="/casual-staff/dashboard"        element={<PR roles={["casual_staff"]}><CasualDashboard /></PR>} />
        <Route path="/casual-staff/shifts"           element={<PR roles={["casual_staff"]}><CasualMyShifts /></PR>} />
        <Route path="/casual-staff/availability"      element={<PR roles={["casual_staff"]}><CasualAvailability /></PR>} />
        <Route path="/casual-staff/branches"          element={<PR roles={["casual_staff"]}><CasualBranches /></PR>} />
        <Route path="/casual-staff/swap-requests"    element={<PR roles={["casual_staff"]}><CasualSwapRequests /></PR>} />
        <Route path="/casual-staff/notifications"    element={<PR roles={["casual_staff"]}>
          <NotificationsPage Layout={CasualLayout} />
        </PR>} />



        <Route path="*" element={<NotFound />} />
      </Routes>
      </PageTransitionProvider>
    </BrowserRouter>
  );
}

export default App;
