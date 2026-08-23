import { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Trash2, Send, Filter } from 'lucide-react';
import api from '../lib/api';

interface Command {
  id: number;
  device_id: number;
  device_name: string;
  device_uuid: string;
  command_type: string;
  status: string;
  result: string | null;
  issued_by_email: string | null;
  created_at: string;
  executed_at: string | null;
}

interface CommandStats {
  total: number;
  pending: number;
  sent: number;
  acknowledged: number;
  completed: number;
  failed: number;
}

export default function CommandsPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [stats, setStats] = useState<CommandStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [devices, setDevices] = useState<{ id: number; name: string }[]>([]);

  // Send form
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedCommandType, setSelectedCommandType] = useState('RELOAD');

  useEffect(() => { loadData(); }, [page, statusFilter, typeFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('command_type', typeFilter);

      const [cmdRes, statsRes] = await Promise.all([
        api.get(`/commands?${params}`),
        api.get('/commands/stats'),
      ]);
      setCommands(cmdRes.data.data || []);
      setTotal(cmdRes.data.total);
      setStats(statsRes.data.stats);
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }

  async function loadDevicesForModal() {
    try {
      const res = await api.get('/devices?limit=100');
      setDevices(res.data.data || []);
    } catch (err) { console.error('Load devices error:', err); }
  }

  async function handleSendCommand() {
    if (!selectedDeviceId) { alert('Select a device'); return; }
    try {
      await api.post('/commands', { device_id: Number(selectedDeviceId), command_type: selectedCommandType });
      setShowSendModal(false);
      setSelectedDeviceId('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to send command');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this pending command?')) return;
    try {
      await api.delete(`/commands/${id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'PENDING': return 'bg-yellow-400/10 text-yellow-400';
      case 'SENT': return 'bg-blue-400/10 text-blue-400';
      case 'ACKNOWLEDGED': return 'bg-purple-400/10 text-purple-400';
      case 'COMPLETED': return 'bg-green-400/10 text-green-400';
      case 'FAILED': return 'bg-red-400/10 text-red-400';
      default: return 'bg-gray-400/10 text-gray-400';
    }
  }

  function getCommandIcon(type: string) {
    switch (type) {
      case 'REBOOT': return '🔄';
      case 'SHUTDOWN': return '⏻';
      case 'UPDATE': return '📦';
      case 'RELOAD': return '🔃';
      case 'SCREENSHOT': return '📷';
      default: return '⚡';
    }
  }

  const commandTypes = ['RELOAD', 'SCREENSHOT', 'REBOOT', 'SHUTDOWN', 'UPDATE', 'CUSTOM'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Commands</h1>
          <p className="text-gray-400 mt-1">Send commands to devices and track execution</p>
        </div>
        <button onClick={() => { loadDevicesForModal(); setShowSendModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium">
          <Send className="w-4 h-4" /> Send Command
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-400' },
            { label: 'Sent', value: stats.sent, color: 'text-blue-400' },
            { label: 'Acknowledged', value: stats.acknowledged, color: 'text-purple-400' },
            { label: 'Completed', value: stats.completed, color: 'text-green-400' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-500" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="">All Types</option>
          {commandTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={loadData} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Commands Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Time</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Device</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Command</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Issued By</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Executed</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : commands.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">
                <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No commands sent yet</p>
              </td></tr>
            ) : commands.map(cmd => (
              <tr key={cmd.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3 text-sm text-gray-400">{new Date(cmd.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="text-white text-sm font-medium">{cmd.device_name || 'Unknown'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span>{getCommandIcon(cmd.command_type)}</span>
                    <span className="text-gray-300">{cmd.command_type}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(cmd.status)}`}>{cmd.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{cmd.issued_by_email || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{cmd.executed_at ? new Date(cmd.executed_at).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {cmd.status === 'PENDING' && (
                    <button onClick={() => handleDelete(cmd.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400" title="Cancel">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Previous</button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={commands.length < 50} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Next</button>
        </div>
      )}

      {/* Send Command Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Send Command</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Device *</label>
                <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Select device...</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Command Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {commandTypes.map(type => (
                    <button key={type} onClick={() => setSelectedCommandType(type)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCommandType === type ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                      {getCommandIcon(type)} {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSendCommand} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Send</button>
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
