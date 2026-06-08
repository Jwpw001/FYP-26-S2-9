import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

function PlaceholderDashboard({ title }) {
  return (
    <div style={placeholderStyles.page}>
      <div style={placeholderStyles.card}>
        <div style={placeholderStyles.logoMark}>K</div>
        <h1 style={placeholderStyles.title}>{title}</h1>
        <p style={placeholderStyles.sub}>This dashboard is under construction.</p>
      </div>
    </div>
  );
}

const placeholderStyles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F7F6F3",
  },
  card: {
    textAlign: "center",
    padding: "48px 40px",
    background: "#FFFFFF",
    border: "1px solid #E5E2DC",
    borderRadius: "18px",
    maxWidth: "360px",
    width: "100%",
  },
  logoMark: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#1C1B18",
    color: "#FFFFFF",
    fontSize: "22px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
  },
  title: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#1C1B18",
    marginBottom: "8px",
  },
  sub: {
    fontSize: "14px",
    color: "#7A7870",
  },
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected dashboard routes */}
        <Route
          path="/system-admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["system_admin"]}>
              <PlaceholderDashboard title="System Admin Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlet-manager/dashboard"
          element={
            <ProtectedRoute allowedRoles={["outlet_manager"]}>
              <PlaceholderDashboard title="Outlet Manager Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/regular-staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={["regular_staff"]}>
              <PlaceholderDashboard title="Regular Staff Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outlet-casual-staff/dashboard"
          element={
            <ProtectedRoute allowedRoles={["outlet_casual_staff"]}>
              <PlaceholderDashboard title="Outlet Casual Staff Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/krewby-coordinator/dashboard"
          element={
            <ProtectedRoute allowedRoles={["krewby_coordinator"]}>
              <PlaceholderDashboard title="Krewby Coordinator Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/krewby-worker/dashboard"
          element={
            <ProtectedRoute allowedRoles={["krewby_casual_worker"]}>
              <PlaceholderDashboard title="Krewby Worker Dashboard" />
            </ProtectedRoute>
          }
        />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
