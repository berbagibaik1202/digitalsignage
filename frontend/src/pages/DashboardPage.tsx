import { useState, useEffect } from 'react';
import { Tv, Image, ListMusic, Calendar, Users, CheckCircle, XCircle } from 'lucide-react';
import api from '../lib/api';

interface ServerStatus {
  backend: string;
  database: string;
}

interface Stats {
  devices: { total: number; online: number };
  media: { total: number; total_size: number };
  playlists: { total: number };
  schedules: { total: number };
  users: { total: number };
}

export default function DashboardPage() {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ backend: 'checking', database: 'checking' });
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    checkServerStatus();
    loadStats();
  }, []);

  async function checkServerStatus() {
    try {
      const res = await api.get('/health');
      setServerStatus({
        backend: 'ok',
        database: res.data.database === 'connected' ? 'ok' : 'error',
      });
    } catch {
      setServerStatus({ backend: 'error', database: 'error' });
    }
  }

  async function loadStats() {
    try {
      const res = await api.get('/monitoring/dashboard-stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  const statCards = [
    { label: 'Devices', value: stats?.devices?.total ?? 0, subtext: stats?.devices?.online ? `${stats.devices.online} online` : '', icon: Tv, color: 'text-blue-400' },
    { label: 'Media', value: stats?.media?.total ?? 0, subtext: formatBytes(stats?.media?.total_size ?? 0), icon: Image, color: 'text-purple-400' },
    { label: 'Playlists', value: stats?.playlists?.total ?? 0, subtext: '', icon: ListMusic, color: 'text-green-400' },
    { label: 'Schedules', value: stats?.schedules?.total ?? 0, subtext: '', icon: Calendar, color: 'text-yellow-400' },
    { label: 'Users', value: stats?.users?.total ?? 0, subtext: '', icon: Users, color: 'text-pink-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of your digital signage platform</p>
      </div>

      {/* Server Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Server Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg">
            {serverStatus.backend === 'ok' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : serverStatus.backend === 'error' ? (
              <XCircle className="w-5 h-5 text-red-400" />
            ) : (
              <div className="w-5 h-5 border-2 border-gray-500 rounded-full animate-spin" />
            )}
            <div>
              <p className="text-sm text-gray-400">Backend API</p>
              <p className="text-sm font-medium text-white">
                {serverStatus.backend === 'ok' ? 'Connected' : serverStatus.backend === 'error' ? 'Disconnected' : 'Checking...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg">
            {serverStatus.database === 'ok' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : serverStatus.database === 'error' ? (
              <XCircle className="w-5 h-5 text-red-400" />
            ) : (
              <div className="w-5 h-5 border-2 border-gray-500 rounded-full animate-spin" />
            )}
            <div>
              <p className="text-sm text-gray-400">Database</p>
              <p className="text-sm font-medium text-white">
                {serverStatus.database === 'ok' ? 'Connected' : serverStatus.database === 'error' ? 'Disconnected' : 'Checking...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.label}</p>
              {card.subtext && <p className="text-xs text-gray-500 mt-0.5">{card.subtext}</p>}
            </div>
          );
        })}
      </div>

      {/* Quick Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Getting Started</h2>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">1.</span>
            <p>Create a tenant via API or database</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">2.</span>
            <p>Register a super admin user</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">3.</span>
            <p>Upload media files (images, videos)</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">4.</span>
            <p>Create playlists and schedules</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-blue-400 font-bold">5.</span>
            <p>Register devices and start displaying!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
