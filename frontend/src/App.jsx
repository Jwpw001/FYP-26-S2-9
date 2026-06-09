import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// Outlet Manager
import ManagerDashboard from "./pages/outlet-manager/Dashboard";
import StaffList        from "./pages/outlet-manager/StaffList";
import StaffProfile     from "./pages/outlet-manager/StaffProfile";

// System Admin
import AdminDashboard from "./pages/system-admin/Dashboard";
import SkillTags      from "./pages/system-admin/SkillTags";
import Businesses     from "./pages/system-admin/Businesses";
import Managers       from "./pages/system-admin/Managers";

// Regular Staff
import StaffDashboard from "./pages/regular-staff/Dashboard";
import MyShifts       from "./pages/regular-staff/MyShifts";
import LeaveRequests  from "./pages/regular-staff/LeaveRequests";

// Outlet Casual Staff
import CasualDashboard    from "./pages/outlet-casual-staff/Dashboard";
import WeeklyAvailability from "./pages/outlet-casual-staff/WeeklyAvailability";

import AdminLayout  from "./components/layout/AdminLayout";
import StaffLayout  from "./components/layout/StaffLayout";
import CasualLayout from "./components/layout/CasualLayout";

function ComingSoon({ title, layout: Layout }) {
  return (
    <Layout title={title}>
      <div style={{ textAlign:"center", padding:"60px 20px" }}>
        <p style={{ fontSize:"32px", marginBottom:"16px" }}>🚧</p>
        <h2 style={{ fontSize:"18px", fontWeight:"700", color:"#1C1B18", marginBottom:"8px" }}>
          {title}
        </h2>
        <p style={{ fontSize:"14px", color:"#7A7870" }}>This page is under construction.</p>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ── System Admin ─────────────────────────────────── */}
        <Route path="/system-admin/dashboard" element={
          <ProtectedRoute allowedRoles={["system_admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/system-admin/businesses" element={
          <ProtectedRoute allowedRoles={["system_admin"]}><Businesses /></ProtectedRoute>} />
        <Route path="/system-admin/managers" element={
          <ProtectedRoute allowedRoles={["system_admin"]}><Managers /></ProtectedRoute>} />
        <Route path="/system-admin/skills" element={
          <ProtectedRoute allowedRoles={["system_admin"]}><SkillTags /></ProtectedRoute>} />
        <Route path="/system-admin/krewby-workers" element={
          <ProtectedRoute allowedRoles={["system_admin"]}>
            <ComingSoon title="Krewby Workers" layout={AdminLayout} />
          </ProtectedRoute>} />

        {/* ── Outlet Manager ────────────────────────────────── */}
        <Route path="/outlet-manager/dashboard" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}><ManagerDashboard /></ProtectedRoute>} />
        <Route path="/outlet-manager/staff" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}><StaffList /></ProtectedRoute>} />
        <Route path="/outlet-manager/staff/new" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Add New Staff" layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />
        <Route path="/outlet-manager/staff/:id" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}><StaffProfile /></ProtectedRoute>} />
        <Route path="/outlet-manager/shifts" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Shifts" layout={props => <ManagerDashboard {...props} />} />
          </ProtectedRoute>} />
        <Route path="/outlet-manager/shifts/new" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Create Shift" layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />
        <Route path="/outlet-manager/shifts/:id" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Shift Detail" layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />
        <Route path="/outlet-manager/availability" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Availability & Leave" layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />
        <Route path="/outlet-manager/attendance" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Attendance" layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />
        <Route path="/outlet-manager/reports" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ComingSoon title="Reports" layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />

        {/* ── Regular Staff ─────────────────────────────────── */}
        <Route path="/regular-staff/dashboard" element={
          <ProtectedRoute allowedRoles={["regular_staff"]}><StaffDashboard /></ProtectedRoute>} />
        <Route path="/regular-staff/shifts" element={
          <ProtectedRoute allowedRoles={["regular_staff"]}><MyShifts /></ProtectedRoute>} />
        <Route path="/regular-staff/leave" element={
          <ProtectedRoute allowedRoles={["regular_staff"]}><LeaveRequests /></ProtectedRoute>} />
        <Route path="/regular-staff/swaps" element={
          <ProtectedRoute allowedRoles={["regular_staff"]}>
            <ComingSoon title="Swap Requests" layout={StaffLayout} />
          </ProtectedRoute>} />
        <Route path="/regular-staff/notifications" element={
          <ProtectedRoute allowedRoles={["regular_staff"]}>
            <ComingSoon title="Notifications" layout={StaffLayout} />
          </ProtectedRoute>} />

        {/* ── Outlet Casual Staff ───────────────────────────── */}
        <Route path="/outlet-casual-staff/dashboard" element={
          <ProtectedRoute allowedRoles={["outlet_casual_staff"]}><CasualDashboard /></ProtectedRoute>} />
        <Route path="/outlet-casual-staff/shifts" element={
          <ProtectedRoute allowedRoles={["outlet_casual_staff"]}>
            <ComingSoon title="My Shifts" layout={CasualLayout} />
          </ProtectedRoute>} />
        <Route path="/outlet-casual-staff/availability" element={
          <ProtectedRoute allowedRoles={["outlet_casual_staff"]}><WeeklyAvailability /></ProtectedRoute>} />
        <Route path="/outlet-casual-staff/notifications" element={
          <ProtectedRoute allowedRoles={["outlet_casual_staff"]}>
            <ComingSoon title="Notifications" layout={CasualLayout} />
          </ProtectedRoute>} />

        {/* ── Other roles ───────────────────────────────────── */}
        <Route path="/krewby-coordinator/dashboard" element={
          <ProtectedRoute allowedRoles={["krewby_coordinator"]}>
            <ComingSoon title="Krewby Coordinator Dashboard"
              layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />
        <Route path="/krewby-worker/dashboard" element={
          <ProtectedRoute allowedRoles={["krewby_casual_worker"]}>
            <ComingSoon title="Krewby Worker Dashboard"
              layout={props => <div style={{padding:40}}>{props.children}</div>} />
          </ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
