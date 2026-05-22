import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";

function OutletManagerDashboard() {
  return <h1>Outlet Manager Dashboard</h1>;
}

function RegularStaffDashboard() {
  return <h1>Regular Staff Dashboard</h1>;
}

function CasualStaffDashboard() {
  return <h1>Outlet Casual Staff Dashboard</h1>;
}

function CoordinatorDashboard() {
  return <h1>Krewby Coordinator Dashboard</h1>;
}

function WorkerDashboard() {
  return <h1>Krewby Worker Dashboard</h1>;
}

function AdminDashboard() {
  return <h1>System Admin Dashboard</h1>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route path="/system-admin/dashboard" element={<AdminDashboard />} />
        <Route path="/outlet-manager/dashboard" element={<OutletManagerDashboard />} />
        <Route path="/regular-staff/dashboard" element={<RegularStaffDashboard />} />
        <Route path="/outlet-casual-staff/dashboard" element={<CasualStaffDashboard />} />
        <Route path="/krewby-coordinator/dashboard" element={<CoordinatorDashboard />} />
        <Route path="/krewby-worker/dashboard" element={<WorkerDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;