import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Monitor,
  LayoutDashboard,
  Tv,
  Image,
  ListMusic,
  Calendar,
  LayoutGrid,
  CreditCard,
  Activity,
  Users,
  Settings,
  Terminal,
  Shield,
  LogOut,
  Menu,
  X,
  Key,
} from 'lucide-react';
import { cn } from '../lib/utils';
import api from '../lib/api';

// Super admin navigation
const superAdminNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/devices', label: 'Devices', icon: Tv },
  { to: '/dashboard/media', label: 'Media', icon: Image },
  { to: '/dashboard/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/dashboard/layouts', label: 'Layouts', icon: LayoutGrid },
  { to: '/dashboard/schedules', label: 'Schedules', icon: Calendar },
  { to: '/dashboard/monitoring', label: 'Monitoring', icon: Activity },
  { to: '/dashboard/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/dashboard/commands', label: 'Commands', icon: Terminal },
  { to: '/dashboard/users', label: 'Users', icon: Users },
  { to: '/dashboard/admin', label: 'Admin', icon: Shield },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Tenant admin navigation
const tenantAdminNav = [
  { to: '/dashboard/tenant', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/tenant', label: 'Users', icon: Users, tab: 'users' },
  { to: '/dashboard/tenant', label: 'Devices', icon: Tv, tab: 'devices' },
  { to: '/dashboard/tenant', label: 'Token', icon: Key, tab: 'token' },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

// Regular user navigation (editor/viewer)
const userNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/devices', label: 'Devices', icon: Tv },
  { to: '/dashboard/media', label: 'Media', icon: Image },
  { to: '/dashboard/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/dashboard/schedules', label: 'Schedules', icon: Calendar },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userRole, setUserRole] = useState<string>('viewer');

  useEffect(() => {
    api.get('/auth/me').then(res => {
      setUserRole(res.data.user?.role || 'viewer');
    }).catch(() => {});
  }, []);

  // Get nav items based on role
  const navItems = userRole === 'super_admin' ? superAdminNav
    : userRole === 'admin' ? tenantAdminNav
    : userNav;

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Monitor className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">Digital Signage</span>
                {userRole !== 'super_admin' && (
                  <p className="text-xs text-gray-500 capitalize">{userRole.replace('_', ' ')}</p>
                )}
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white p-1"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.to);

            return (
              <Link
                key={`${item.to}-${index}`}
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 w-full transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
