import { useState, useEffect } from 'react';
import { Tv, Search, Wifi, WifiOff, Trash2, RefreshCw, MonitorPlay, Key, Copy, Check, Pencil } from 'lucide-react';
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
  group_id?: number | null;
}

interface DeviceGroup { id: number; name: string; }

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [registrationToken, setRegistrationToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceGroupId, setDeviceGroupId] = useState('');

  useEffect(() => {
    loadDevices();
  }, [page, search, statusFilter]);

  useEffect(() => {
    api.get('/device-groups').then((res) => setDeviceGroups(res.data.groups || [])).catch((err) => console.error('Failed to load groups:', err));
  }, []);

  async function loadDevices() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`/devices?${params}`);
      setDevices(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRegistrationToken() {
    setLoadingToken(true);
    try {
      // Get current user's tenant registration token directly
      const res = await api.get('/tenants/me/token');
      const token = res.data.tenant?.registration_token;

      if (token) {
        setRegistrationToken(token);
        setShowTokenModal(true);
      } else {
        alert('Registration token belum tersedia. Silakan hubungi super admin.');
      }
    } catch (err: any) {
      console.error('Failed to load token:', err);
      if (err.response?.status === 404) {
        alert('User tidak memiliki tenant. Silakan hubungi super admin untuk assign tenant.');
      } else if (err.response?.status === 403) {
        alert('Anda tidak memiliki akses.');
      } else {
        alert('Gagal memuat registration token: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoadingToken(false);
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(registrationToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  function openDeviceEditor(device: Device) {
    setEditingDevice(device);
    setDeviceName(device.name);
    setDeviceGroupId(device.group_id ? String(device.group_id) : '');
  }

  async function saveDevice() {
    if (!editingDevice) return;
    try {
      await api.put(`/devices/${editingDevice.id}`, { name: deviceName, group_id: deviceGroupId ? Number(deviceGroupId) : null });
      setEditingDevice(null);
      loadDevices();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to update device'); }
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
        <div className="flex gap-2">
          <button
            onClick={loadRegistrationToken}
            disabled={loadingToken}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium"
          >
            <Key className="w-4 h-4" />
            {loadingToken ? 'Loading...' : 'Registration Token'}
          </button>
        </div>
      </div>

      {/* Instructions Card */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <h3 className="text-blue-400 font-medium mb-2">📱 Cara Menambahkan Device Baru</h3>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>Klik tombol <strong>"Registration Token"</strong> di atas</li>
          <li>Copy token yang muncul</li>
          <li>Buka Electron Player di TV/Monitor</li>
          <li>Masukkan <strong>Server URL</strong> dan <strong>Registration Token</strong></li>
          <li>Device akan otomatis terdaftar</li>
        </ol>
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
                  <p>Belum ada device terdaftar</p>
                  <p className="text-sm mt-2">Gunakan Registration Token untuk menambah device baru</p>
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
                    <button onClick={() => openDeviceEditor(device)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors" title="Edit device and group">
                      <Pencil className="w-4 h-4" />
                    </button>
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

      {/* Registration Token Modal */}
      {editingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Device Settings</h3>
            <div className="space-y-4">
              <div><label className="mb-1 block text-sm text-gray-400">Name</label><input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white" /></div>
              <div><label className="mb-1 block text-sm text-gray-400">Group</label><select value={deviceGroupId} onChange={(event) => setDeviceGroupId(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white"><option value="">Independent device</option>{deviceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
            </div>
            <div className="mt-6 flex gap-3"><button onClick={saveDevice} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white">Save</button><button onClick={() => setEditingDevice(null)} className="rounded-lg bg-gray-800 px-4 py-2 text-gray-300">Cancel</button></div>
          </div>
        </div>
      )}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-white mb-4">🔑 Registration Token</h3>

            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Token ini digunakan untuk mendaftarkan device baru:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-green-400 text-sm font-mono break-all">{registrationToken}</code>
                <button
                  onClick={copyToken}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <h4 className="text-white font-medium">Cara Pakai:</h4>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-gray-300">1. Buka Electron Player di TV/Monitor</p>
                <p className="text-gray-300">2. Masukkan Server URL:</p>
                <code className="block bg-gray-900 px-3 py-1 rounded text-blue-400 text-xs">
                  {window.location.origin}
                </code>
                <p className="text-gray-300">3. Masukkan Registration Token di atas</p>
                <p className="text-gray-300">4. Klik "Hubungkan"</p>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-gray-300">Atau akses langsung di browser:</p>
                <code className="block bg-gray-900 px-3 py-1 rounded text-blue-400 text-xs mt-1">
                  {window.location.origin}/player?token={registrationToken}
                </code>
              </div>
            </div>

            <button
              onClick={() => setShowTokenModal(false)}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
            >
              Tutup
            </button>
          </div>
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
