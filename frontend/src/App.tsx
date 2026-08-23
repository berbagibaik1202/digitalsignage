import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DevicesPage from './pages/DevicesPage';
import UsersPage from './pages/UsersPage';
import MediaPage from './pages/MediaPage';
import PlaylistsPage from './pages/PlaylistsPage';
import SchedulesPage from './pages/SchedulesPage';
import LayoutsPage from './pages/LayoutsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import MonitoringPage from './pages/MonitoringPage';
import SettingsPage from './pages/SettingsPage';
import CommandsPage from './pages/CommandsPage';
import AdminPage from './pages/AdminPage';
import DashboardLayout from './components/DashboardLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><DashboardPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/devices" element={<ProtectedRoute><DashboardLayout><DevicesPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/media" element={<ProtectedRoute><DashboardLayout><MediaPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/playlists" element={<ProtectedRoute><DashboardLayout><PlaylistsPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/schedules" element={<ProtectedRoute><DashboardLayout><SchedulesPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/layouts" element={<ProtectedRoute><DashboardLayout><LayoutsPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/subscriptions" element={<ProtectedRoute><DashboardLayout><SubscriptionsPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/monitoring" element={<ProtectedRoute><DashboardLayout><MonitoringPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/users" element={<ProtectedRoute><DashboardLayout><UsersPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/commands" element={<ProtectedRoute><DashboardLayout><CommandsPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/admin" element={<ProtectedRoute><DashboardLayout><AdminPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardLayout><SettingsPage /></DashboardLayout></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
