import { useState, useEffect } from 'react';
import { Tv, Search, Wifi, WifiOff, Trash2, RefreshCw, MonitorPlay } from 'lucide-react';
import api from '../lib/api';

interface Device {
  id: number;
  device_uuid: string;
  name: string;
  location: string | null;
  orientation: string;
  status: string;
  last_seen_at: string | null;
  player_version: string | null;
  group_name?: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showCommandModal, setShowCommandModal] = useState(false);

  useEffect(() => {
    loadDevices();
  }, [page, search, statusFilter]);

  async function loadDevices() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`/devices?${params}`);
      setDevices(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }

  async function sendCommand(deviceId: number, commandType: string) {
    try {
      await api.post(`/devices/${deviceId}/command`, { command_type: commandType });
      alert(`Command ${commandType} sent!`);
      setShowCommandModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send command');
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ONLINE': return 'text-green-400 bg-green-400/10';
      case 'DEGRADED': return 'text-yellow-400 bg-yellow-400/10';
      case 'OFFLINE': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-gray-400 mt-1">{total} device(s) registered</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="ONLINE">Online</option>
          <option value="DEGRADED">Degraded</option>
          <option value="OFFLINE">Offline</option>
        </select>
        <button
          onClick={loadDevices}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Devices Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Device</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">UUID</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Group</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Location</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Last Seen</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No devices found</p>
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MonitorPlay className="w-4 h-4 text-gray-500" />
                      <span className="text-white font-medium">{device.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">{device.device_uuid.slice(0, 12)}...</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(device.status)}`}>
                      {device.status === 'ONLINE' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {device.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{device.group_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{device.location || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatDate(device.last_seen_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setSelectedDevice(device); setShowCommandModal(true); }}
                      className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="Send Command"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Delete this device?')) {
                          await api.delete(`/devices/${device.id}`);
                          loadDevices();
                        }
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={devices.length < 20}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white"
          >
            Next
          </button>
        </div>
      )}

      {/* Command Modal */}
      {showCommandModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">
              Send Command to {selectedDevice.name}
            </h3>
            <div className="space-y-2">
              {['RELOAD', 'SCREENSHOT', 'REBOOT', 'SHUTDOWN'].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => sendCommand(selectedDevice.id, cmd)}
                  className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm font-medium text-left transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCommandModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
