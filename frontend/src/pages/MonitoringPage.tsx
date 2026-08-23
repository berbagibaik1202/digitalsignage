import { useState, useEffect } from 'react';
import { Activity, Camera, RefreshCw, Download, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface PlaybackLog {
  id: number;
  device_id: number;
  device_name: string;
  playlist_id: number | null;
  playlist_name: string | null;
  media_id: number | null;
  media_name: string | null;
  log_action: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface Screenshot {
  id: number;
  device_id: number;
  device_name: string;
  storage_key: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  created_at: string;
}

interface DeviceStats {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  avg_heartbeat_age_minutes: number | null;
}

export default function MonitoringPage() {
  const [tab, setTab] = useState<'logs' | 'screenshots' | 'stats'>('logs');
  const [logs, setLogs] = useState<PlaybackLog[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');


  useEffect(() => { loadData(); }, [tab, page, actionFilter]);

  async function loadData() {
    try {
      setLoading(true);
      if (tab === 'logs') {
        const params = new URLSearchParams({ page: String(page), limit: '50' });
        if (actionFilter) params.set('action', actionFilter);
        const res = await api.get(`/monitoring/playback-logs?${params}`);
        setLogs(res.data.data || []);
        setTotal(res.data.total);
      } else if (tab === 'screenshots') {
        const params = new URLSearchParams({ page: String(page) });

        const res = await api.get(`/monitoring/screenshots?${params}`);
        setScreenshots(res.data.data || []);
        setTotal(res.data.total);
      } else {
        const res = await api.get('/monitoring/device-stats');
        setDeviceStats(res.data.stats);
      }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }

  function getActionBadge(action: string) {
    switch (action) {
      case 'START': return 'bg-green-400/10 text-green-400';
      case 'END': return 'bg-blue-400/10 text-blue-400';
      case 'SKIP': return 'bg-yellow-400/10 text-yellow-400';
      case 'ERROR': return 'bg-red-400/10 text-red-400';
      default: return 'bg-gray-400/10 text-gray-400';
    }
  }

  function formatDuration(ms: number | null) {
    if (!ms) return '—';
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    return min > 0 ? `${min}m ${sec % 60}s` : `${sec}s`;
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitoring</h1>
          <p className="text-gray-400 mt-1">Playback logs, screenshots, and device health</p>
        </div>
        <button onClick={loadData} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => { setTab('logs'); setPage(1); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Activity className="w-4 h-4 inline mr-1" />Playback Logs
        </button>
        <button onClick={() => { setTab('screenshots'); setPage(1); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'screenshots' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Camera className="w-4 h-4 inline mr-1" />Screenshots
        </button>
        <button onClick={() => { setTab('stats'); setPage(1); }} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'stats' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          Device Stats
        </button>
      </div>

      {/* Filters */}
      {tab !== 'stats' && (
        <div className="flex items-center gap-3">
          {tab === 'logs' && (
            <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Actions</option>
              <option value="START">START</option>
              <option value="END">END</option>
              <option value="SKIP">SKIP</option>
              <option value="ERROR">ERROR</option>
            </select>
          )}
        </div>
      )}

      {/* Device Stats Tab */}
      {tab === 'stats' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {deviceStats ? (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400">Total Devices</p>
                <p className="text-3xl font-bold text-white mt-1">{deviceStats.total}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400">Online</p>
                <p className="text-3xl font-bold text-green-400 mt-1">{deviceStats.online}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400">Degraded</p>
                <p className="text-3xl font-bold text-yellow-400 mt-1">{deviceStats.degraded}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm text-gray-400">Offline</p>
                <p className="text-3xl font-bold text-red-400 mt-1">{deviceStats.offline}</p>
              </div>
              {deviceStats.avg_heartbeat_age_minutes !== null && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:col-span-2 lg:col-span-4">
                  <p className="text-sm text-gray-400">Avg. Heartbeat Age</p>
                  <p className="text-3xl font-bold text-white mt-1">{deviceStats.avg_heartbeat_age_minutes} min</p>
                  <p className="text-xs text-gray-500 mt-1">How long since devices last reported in, on average</p>
                </div>
              )}
            </>
          ) : loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
          ) : (
            <div className="col-span-full text-center py-12 text-gray-500">No data available</div>
          )}
        </div>
      )}

      {/* Playback Logs Table */}
      {tab === 'logs' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Time</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Device</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Action</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Playlist</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Media</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Duration</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No playback logs yet</p>
                  <p className="text-sm text-gray-600 mt-1">Logs will appear when devices start playing content</p>
                </td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-white">{log.device_name || `Device #${log.device_id}`}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getActionBadge(log.log_action)}`}>{log.log_action}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{log.playlist_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{log.media_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatDuration(log.duration_ms)}</td>
                  <td className="px-4 py-3 text-sm text-red-400 max-w-[200px] truncate">{log.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Screenshots Tab */}
      {tab === 'screenshots' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Time</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Device</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Resolution</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Size</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : screenshots.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">
                  <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No screenshots yet</p>
                  <p className="text-sm text-gray-600 mt-1">Screenshots are captured via device commands</p>
                </td></tr>
              ) : screenshots.map(s => (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-white">{s.device_name || `Device #${s.device_id}`}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{s.width && s.height ? `${s.width}×${s.height}` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatFileSize(s.file_size)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white" title="Download"><Download className="w-4 h-4" /></button>
                    <button onClick={async () => { if (confirm('Delete this screenshot?')) { await api.delete(`/monitoring/screenshots/${s.id}`); loadData(); } }} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && tab !== 'stats' && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Previous</button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 20 && screenshots.length < 20} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Next</button>
        </div>
      )}
    </div>
  );
}
