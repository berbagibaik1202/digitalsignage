import { useState, useEffect } from 'react';
import { Calendar, Plus, Search, Edit2, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../lib/api';

interface Schedule {
  id: number;
  name: string;
  description: string | null;
  playlist_id: number | null;
  layout_id: number | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: string | null;
  priority: number;
  is_active: boolean;
  playlist_name?: string;
  layout_name?: string;
}

interface Playlist { id: number; name: string; }
interface Layout { id: number; name: string; }
interface Device { id: number; name: string; status: string; }
interface DeviceGroup { id: number; name: string; }

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Related data
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);

  const [form, setForm] = useState({
    name: '', description: '', playlist_id: '', layout_id: '',
    start_date: '', end_date: '', start_time: '', end_time: '',
    days_of_week: [] as string[], priority: 0, is_active: true,
    targets: [] as { target_type: string; target_id: number }[],
  });

  useEffect(() => { loadSchedules(); loadRelated(); }, [page, search]);

  async function loadSchedules() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      const res = await api.get(`/schedules?${params}`);
      setSchedules(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRelated() {
    try {
      const [plRes, layoutRes, devRes, grpRes] = await Promise.all([
        api.get('/playlists?limit=100'),
        api.get('/layouts?limit=100'),
        api.get('/devices?limit=100'),
        api.get('/device-groups'),
      ]);
      setPlaylists(plRes.data.data);
      setLayouts(layoutRes.data.data);
      setDevices(devRes.data.data);
      setDeviceGroups(grpRes.data.groups);
    } catch (err) {
      console.error(err);
    }
  }

  function openCreate() {
    setEditingSchedule(null);
    setForm({
      name: '', description: '', playlist_id: '', layout_id: '',
      start_date: new Date().toISOString().split('T')[0], end_date: '',
      start_time: '', end_time: '', days_of_week: [], priority: 0,
      is_active: true, targets: [],
    });
    setShowModal(true);
  }

  async function openEdit(s: Schedule) {
    setEditingSchedule(s);
    setForm({
      name: s.name, description: s.description || '',
      playlist_id: s.playlist_id ? String(s.playlist_id) : '',
      layout_id: s.layout_id ? String(s.layout_id) : '',
      start_date: s.start_date, end_date: s.end_date || '',
      start_time: s.start_time || '', end_time: s.end_time || '',
      days_of_week: s.days_of_week ? s.days_of_week.split(',') : [],
      priority: s.priority, is_active: s.is_active, targets: [],
    });
    setShowModal(true);
    try {
      const res = await api.get(`/schedules/${s.id}`);
      setForm((previous) => ({ ...previous, targets: res.data.targets || [] }));
    } catch (err) { console.error('Failed to load schedule targets:', err); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.start_date) {
      alert('Start Date is required');
      return;
    }
    try {
      const payload = {
        ...form,
        playlist_id: form.playlist_id ? Number(form.playlist_id) : null,
        layout_id: form.layout_id ? Number(form.layout_id) : null,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        days_of_week: form.days_of_week.length > 0 ? form.days_of_week.join(',') : null,
      };

      if (editingSchedule) {
        await api.put(`/schedules/${editingSchedule.id}`, payload);
      } else {
        await api.post('/schedules', payload);
      }
      setShowModal(false);
      loadSchedules();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this schedule?')) return;
    try {
      await api.delete(`/schedules/${id}`);
      loadSchedules();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  function toggleDay(day: string) {
    setForm((prev) => {
      const days = prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day];
      return { ...prev, days_of_week: days };
    });
  }

  function toggleTarget(targetType: string, targetId: number) {
    setForm((previous) => {
      const exists = previous.targets.some((target) => target.target_type === targetType && target.target_id === targetId);
      return {
        ...previous,
        targets: exists
          ? previous.targets.filter((target) => target.target_type !== targetType || target.target_id !== targetId)
          : [...previous.targets, { target_type: targetType, target_id: targetId }],
      };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Schedules</h1>
          <p className="text-gray-400 mt-1">{total} schedule(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Create Schedule
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" placeholder="Search schedules..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Schedule</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Content</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Date Range</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Time</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Days</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-500"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No schedules</p></td></tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{s.name}</p>
                    <p className="text-xs text-gray-500">Priority: {s.priority}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{s.playlist_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {s.start_date}{s.end_date ? ` → ${s.end_date}` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : 'All day'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {s.days_of_week || 'Every day'}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_active ? (
                      <span className="text-green-400 text-sm flex items-center gap-1"><ToggleRight className="w-4 h-4" /> Active</span>
                    ) : (
                      <span className="text-gray-500 text-sm flex items-center gap-1"><ToggleLeft className="w-4 h-4" /> Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[550px] my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Playlist</label>
                  <select value={form.playlist_id} onChange={(e) => setForm({ ...form, playlist_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">None</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Layout</label>
                  <select value={form.layout_id} onChange={(e) => setForm({ ...form, layout_id: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Fullscreen playlist</option>
                    {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">End Date</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Days of Week</label>
                <div className="flex gap-2">
                  {DAYS.map((day) => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.days_of_week.includes(day) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Target Devices and Groups</label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800 p-2 space-y-1">
                  {deviceGroups.map((group) => (
                    <label key={`group-${group.id}`} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300">
                      <input type="checkbox" checked={form.targets.some((target) => target.target_type === 'GROUP' && target.target_id === group.id)} onChange={() => toggleTarget('GROUP', group.id)} />
                      Group: {group.name}
                    </label>
                  ))}
                  {devices.map((device) => (
                    <label key={`device-${device.id}`} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-300">
                      <input type="checkbox" checked={form.targets.some((target) => target.target_type === 'DEVICE' && target.target_id === device.id)} onChange={() => toggleTarget('DEVICE', device.id)} />
                      Device: {device.name}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">Choose a device for independent content, or a group for shared content.</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-700" />
                <label className="text-sm text-gray-400">Active</label>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
                {editingSchedule ? 'Update' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
