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

// Placeholders for roles not yet built
function Placeholder({ title }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#F7F6F3" }}>
      <div style={{ textAlign:"center", padding:"48px 40px", background:"#FFFFFF",
        border:"1px solid #E5E2DC", borderRadius:"18px", maxWidth:"360px", width:"100%" }}>
        <div style={{ width:"48px", height:"48px", borderRadius:"12px", background:"#1C1B18",
          color:"#FFFFFF", fontSize:"22px", fontWeight:"700", display:"flex",
          alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>K</div>
        <h1 style={{ fontSize:"20px", fontWeight:"700", color:"#1C1B18", marginBottom:"8px" }}>
          {title}
        </h1>
        <p style={{ fontSize:"14px", color:"#7A7870" }}>Under construction.</p>
      </div>
    </div>
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

        {/* ── Outlet Manager ─────────────────────────────── */}
        <Route path="/outlet-manager/dashboard" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/staff" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <StaffList />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/staff/new" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Add New Staff" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/staff/:id" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <StaffProfile />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/shifts" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Shifts" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/shifts/new" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Create Shift" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/shifts/:id" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Shift Detail" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/availability" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Availability & Leave" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/attendance" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Attendance" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-manager/reports" element={
          <ProtectedRoute allowedRoles={["outlet_manager"]}>
            <Placeholder title="Reports" />
          </ProtectedRoute>
        } />

        {/* ── Other roles (placeholders for now) ─────────── */}
        <Route path="/system-admin/dashboard" element={
          <ProtectedRoute allowedRoles={["system_admin"]}>
            <Placeholder title="System Admin Dashboard" />
          </ProtectedRoute>
        } />
        <Route path="/regular-staff/dashboard" element={
          <ProtectedRoute allowedRoles={["regular_staff"]}>
            <Placeholder title="Staff Dashboard" />
          </ProtectedRoute>
        } />
        <Route path="/outlet-casual-staff/dashboard" element={
          <ProtectedRoute allowedRoles={["outlet_casual_staff"]}>
            <Placeholder title="Casual Staff Dashboard" />
          </ProtectedRoute>
        } />
        <Route path="/krewby-coordinator/dashboard" element={
          <ProtectedRoute allowedRoles={["krewby_coordinator"]}>
            <Placeholder title="Krewby Coordinator Dashboard" />
          </ProtectedRoute>
        } />
        <Route path="/krewby-worker/dashboard" element={
          <ProtectedRoute allowedRoles={["krewby_casual_worker"]}>
            <Placeholder title="Krewby Worker Dashboard" />
          </ProtectedRoute>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
