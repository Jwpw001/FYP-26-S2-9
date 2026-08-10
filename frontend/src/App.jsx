import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PageTransitionProvider } from "./components/PageTransition";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Every route below used to be a top-level import, which meant Vite bundled all of them —
// every business-owner, manager, system-admin, regular-staff, and casual-staff page — into one
// ~2.1MB (550KB gzipped) chunk that even a casual worker's browser had to download and parse
// just to see their own 5 pages. lazy() + Suspense splits each into its own chunk, fetched only
// when that route is actually visited. Home/Login stay eager — they're the first thing almost
// everyone sees, so there's no benefit to adding a network round-trip before they can render.
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const GetStarted = lazy(() => import("./pages/GetStarted"));
const RegisterBusiness = lazy(() => import("./pages/RegisterBusiness"));
const CreateAccount = lazy(() => import("./pages/CreateAccount"));
const NotificationsPage = lazy(() => import("./components/NotificationsPage"));

// Manager
const ManagerDashboard   = lazy(() => import("./pages/manager/Dashboard"));
const StaffList          = lazy(() => import("./pages/manager/StaffList"));
const StaffProfile       = lazy(() => import("./pages/manager/StaffProfile"));
const AddStaff           = lazy(() => import("./pages/manager/AddStaff"));
const ShiftsList         = lazy(() => import("./pages/manager/ShiftsList"));
const Gaps               = lazy(() => import("./pages/manager/Gaps"));
const CreateShift        = lazy(() => import("./pages/manager/CreateShift"));
const ShiftDetail        = lazy(() => import("./pages/manager/ShiftDetail"));
const AvailabilityLeave  = lazy(() => import("./pages/manager/AvailabilityLeave"));
const Attendance         = lazy(() => import("./pages/manager/Attendance"));
const Reports            = lazy(() => import("./pages/manager/Reports"));
const ReportHistory      = lazy(() => import("./pages/manager/ReportHistory"));
const ManagerNotifications = lazy(() => import("./pages/manager/Notifications"));
const SkillSettings       = lazy(() => import("./pages/manager/SkillSettings"));
const ManagerSettings     = lazy(() => import("./pages/manager/Settings"));
const ManagerCasualPool   = lazy(() => import("./pages/manager/CasualPool"));
const OMInvitations       = lazy(() => import("./pages/manager/Invitations"));

// System Admin
const AdminDashboard      = lazy(() => import("./pages/system-admin/Dashboard"));
const SkillTags           = lazy(() => import("./pages/system-admin/SkillTags"));
const Businesses          = lazy(() => import("./pages/system-admin/Businesses"));
const BusinessDetail      = lazy(() => import("./pages/system-admin/BusinessDetail"));
const BranchDetail        = lazy(() => import("./pages/system-admin/BranchDetail"));
const AdminStaff          = lazy(() => import("./pages/system-admin/Staff"));
const AdminStaffDetail    = lazy(() => import("./pages/system-admin/StaffDetail"));
const AdminReports        = lazy(() => import("./pages/system-admin/Reports"));
const AdminReportHistory  = lazy(() => import("./pages/system-admin/ReportHistory"));

// Regular Staff
const StaffDashboard = lazy(() => import("./pages/regular-staff/Dashboard"));
const MyShifts       = lazy(() => import("./pages/regular-staff/MyShifts"));
const LeaveRequests  = lazy(() => import("./pages/regular-staff/LeaveRequests"));
const SwapRequests   = lazy(() => import("./pages/regular-staff/SwapRequests"));

// Casual Staff
const CasualDashboard    = lazy(() => import("./pages/casual-staff/Dashboard"));
const CasualBranches      = lazy(() => import("./pages/casual-staff/Branches"));
const CasualAvailability  = lazy(() => import("./pages/casual-staff/Availability"));
const CasualMyShifts      = lazy(() => import("./pages/casual-staff/MyShifts"));
const CasualSwapRequests  = lazy(() => import("./pages/casual-staff/SwapRequests"));
const RegisterCasual     = lazy(() => import("./pages/RegisterCasual"));

// Business Owner
const BODashboard   = lazy(() => import("./pages/business-owner/Dashboard"));
const BOBranches     = lazy(() => import("./pages/business-owner/Branches"));
const BOStaff       = lazy(() => import("./pages/business-owner/Staff"));
const BOBranchDetail = lazy(() => import("./pages/business-owner/BranchDetail"));
const BOStaffDetail  = lazy(() => import("./pages/business-owner/StaffDetail"));
const BOManagerDetail = lazy(() => import("./pages/business-owner/ManagerDetail"));
const BOInvitations = lazy(() => import("./pages/business-owner/Invitations"));
const BOSkills      = lazy(() => import("./pages/business-owner/Skills"));
const BOReports        = lazy(() => import("./pages/business-owner/Reports"));
const BOReportHistory  = lazy(() => import("./pages/business-owner/ReportHistory"));
const BOSettings    = lazy(() => import("./pages/business-owner/Settings"));
const BOCasualPool  = lazy(() => import("./pages/business-owner/CasualPool"));
const AcceptInvite  = lazy(() => import("./pages/AcceptInvite"));
const JoinByCode    = lazy(() => import("./pages/JoinByCode"));

// Layouts — kept eager: small, and every logged-in user's first lazy page needs one immediately,
// so lazy-loading these would just add a second waterfall step on top of the page chunk itself.
import BusinessOwnerLayout from "./components/layout/BusinessOwnerLayout";
import StaffLayout   from "./components/layout/StaffLayout";
import CasualLayout  from "./components/layout/CasualLayout";
import AdminLayout   from "./components/layout/AdminLayout";

function PR({ roles, children }) {
  return <ProtectedRoute allowedRoles={roles}>{children}</ProtectedRoute>;
}

// Matches PageTransitionProvider's own curtain styling so a lazy chunk loading mid-navigation
// doesn't flash an unstyled blank screen — reads as part of the same transition, not a stall.
function RouteFallback() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99998,
      background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
        <div style={{
          width: "60px", height: "60px", borderRadius: "16px",
          background: "#3B82F6", color: "#fff",
          fontSize: "26px", fontWeight: "800",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 10px rgba(59,130,246,0.12), 0 0 0 20px rgba(59,130,246,0.06)",
          letterSpacing: "-0.02em",
        }}>
          K
        </div>
        <div style={{ display: "flex", gap: "7px" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: "#60A5FA",
              animation: `dotPulse 1s ease-in-out ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <PageTransitionProvider>
      <Suspense fallback={<RouteFallback />}>
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
        <Route path="/business-owner/casual"       element={<PR roles={["business_owner"]}><BOCasualPool /></PR>} />
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
        <Route path="/manager/gaps"         element={<PR roles={["manager"]}><Gaps /></PR>} />
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
      </Suspense>
      </PageTransitionProvider>
    </BrowserRouter>
  );
}

export default App;
