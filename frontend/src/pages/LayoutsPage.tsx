import { useState, useEffect } from 'react';
import { LayoutGrid, Plus, Trash2, Search, Edit, X, GripVertical } from 'lucide-react';
import api from '../lib/api';
import LayoutCanvasEditor from '../components/LayoutCanvasEditor';

interface Layout {
  id: number;
  name: string;
  description: string | null;
  width: number;
  height: number;
  background_color: string;
  zone_count: number;
  created_at: string;
}

interface LayoutZone {
  id: number;
  layout_id: number;
  name: string;
  zone_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  config: any;
}

interface Playlist { id: number; name: string; }

const CLOCK_FORMAT_OPTIONS = [
  { value: 'HH:MM:SS', label: 'HH:MM:SS' },
  { value: 'HH:MM', label: 'HH:MM' },
  { value: 'HH:MM:SS + DATE', label: 'HH:MM:SS + Date' },
];

const CLOCK_FONT_OPTIONS = [
  { value: 'ui-sans-serif, system-ui, sans-serif', label: 'System Sans' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: '"Roboto Mono", monospace', label: 'Roboto Mono' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
];

const DEFAULT_CLOCK_FORMAT = 'HH:MM:SS';
const DEFAULT_CLOCK_FONT_FAMILY = 'ui-sans-serif, system-ui, sans-serif';
const DEFAULT_CLOCK_FONT_SIZE = 72;
const DEFAULT_CLOCK_FONT_WEIGHT = 700;

function readZoneConfig(config: unknown): Record<string, unknown> {
  if (typeof config === 'string') {
    try {
      const parsed = JSON.parse(config);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  return config && typeof config === 'object' ? config as Record<string, unknown> : {};
}

export default function LayoutsPage() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingLayout, setEditingLayout] = useState<Layout | null>(null);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<Layout | null>(null);
  const [zones, setZones] = useState<LayoutZone[]>([]);
  const [editingZone, setEditingZone] = useState<LayoutZone | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formWidth, setFormWidth] = useState(1920);
  const [formHeight, setFormHeight] = useState(1080);
  const [formBgColor, setFormBgColor] = useState('#000000');

  // Zone form
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState('MEDIA');
  const [zoneX, setZoneX] = useState(0);
  const [zoneY, setZoneY] = useState(0);
  const [zoneW, setZoneW] = useState(1920);
  const [zoneH, setZoneH] = useState(1080);
  const [zoneZ, setZoneZ] = useState(0);
  const [zonePlaylistId, setZonePlaylistId] = useState('');
  const [zoneClockFormat, setZoneClockFormat] = useState(DEFAULT_CLOCK_FORMAT);
  const [zoneClockFontFamily, setZoneClockFontFamily] = useState(DEFAULT_CLOCK_FONT_FAMILY);
  const [zoneClockFontSize, setZoneClockFontSize] = useState(DEFAULT_CLOCK_FONT_SIZE);
  const [zoneClockFontWeight, setZoneClockFontWeight] = useState(DEFAULT_CLOCK_FONT_WEIGHT);

  useEffect(() => { loadLayouts(); }, [page, search]);
  useEffect(() => { loadPlaylists(); }, []);

  async function loadPlaylists() {
    try {
      const res = await api.get('/playlists?limit=100');
      setPlaylists(res.data.data || []);
    } catch (err) { console.error('Failed to load playlists:', err); }
  }

  async function loadLayouts() {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      const res = await api.get(`/layouts?${params}`);
      setLayouts(res.data.data);
      setTotal(res.data.total);
    } catch (err) { console.error('Failed to load layouts:', err); }
    finally { setLoading(false); }
  }

  async function loadZones(layoutId: number) {
    try {
      const res = await api.get(`/layouts/${layoutId}`);
      setZones(res.data.zones || []);
      setSelectedLayout(res.data.layout);
    } catch (err) { console.error('Failed to load zones:', err); }
  }

  async function handleSaveLayout() {
    try {
      const data = { name: formName, description: formDesc, width: formWidth, height: formHeight, background_color: formBgColor };
      if (editingLayout) {
        await api.put(`/layouts/${editingLayout.id}`, data);
      } else {
        await api.post('/layouts', data);
      }
      setShowModal(false);
      setEditingLayout(null);
      resetForm();
      loadLayouts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save layout');
    }
  }

  async function handleDeleteLayout(id: number) {
    if (!confirm('Delete this layout?')) return;
    try {
      await api.delete(`/layouts/${id}`);
      loadLayouts();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to delete'); }
  }

  async function handleSaveZone() {
    if (!selectedLayout) return;
    try {
      const normalizedZoneType = zoneType === 'HTML' ? 'WEB' : zoneType;
      const config = normalizedZoneType === 'MEDIA'
        ? (zonePlaylistId ? { playlist_id: Number(zonePlaylistId) } : {})
        : normalizedZoneType === 'CLOCK'
          ? {
              format: zoneClockFormat,
              font_family: zoneClockFontFamily,
              font_size: zoneClockFontSize,
              font_weight: zoneClockFontWeight,
            }
          : {};
      const data = {
        name: zoneName, zone_type: normalizedZoneType, x: zoneX, y: zoneY, width: zoneW, height: zoneH, z_index: zoneZ,
        config,
      };
      if (editingZone) {
        await api.put(`/layouts/${selectedLayout.id}/zones/${editingZone.id}`, data);
      } else {
        await api.post(`/layouts/${selectedLayout.id}/zones`, data);
      }
      setShowZoneModal(false);
      setEditingZone(null);
      resetZoneForm();
      loadZones(selectedLayout.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save zone');
    }
  }

  async function handleDeleteZone(zoneId: number) {
    if (!selectedLayout || !confirm('Delete this zone?')) return;
    try {
      await api.delete(`/layouts/${selectedLayout.id}/zones/${zoneId}`);
      loadZones(selectedLayout.id);
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to delete zone'); }
  }

  function openEditLayout(layout: Layout) {
    setEditingLayout(layout);
    setFormName(layout.name);
    setFormDesc(layout.description || '');
    setFormWidth(layout.width);
    setFormHeight(layout.height);
    setFormBgColor(layout.background_color);
    setShowModal(true);
  }

  function openEditZone(zone: LayoutZone) {
    const config = readZoneConfig(zone.config);
    setEditingZone(zone);
    setZoneName(zone.name);
    setZoneType(zone.zone_type === 'HTML' ? 'WEB' : zone.zone_type);
    setZoneX(zone.x);
    setZoneY(zone.y);
    setZoneW(zone.width);
    setZoneH(zone.height);
    setZoneZ(zone.z_index);
    setZonePlaylistId(config.playlist_id ? String(config.playlist_id) : '');
    setZoneClockFormat(typeof config.format === 'string' ? config.format : DEFAULT_CLOCK_FORMAT);
    setZoneClockFontFamily(typeof config.font_family === 'string' ? config.font_family : DEFAULT_CLOCK_FONT_FAMILY);
    setZoneClockFontSize(Number(config.font_size) || DEFAULT_CLOCK_FONT_SIZE);
    setZoneClockFontWeight(Number(config.font_weight) || DEFAULT_CLOCK_FONT_WEIGHT);
    setShowZoneModal(true);
  }

  function resetForm() { setFormName(''); setFormDesc(''); setFormWidth(1920); setFormHeight(1080); setFormBgColor('#000000'); }

  function resetZoneForm(layout = selectedLayout) {
    const defaults = layout
      ? {
          x: Math.max(0, Math.round((layout.width - Math.max(240, Math.round(layout.width * 0.35))) / 2)),
          y: Math.max(0, Math.round((layout.height - Math.max(160, Math.round(layout.height * 0.25))) / 2)),
          width: Math.max(240, Math.round(layout.width * 0.35)),
          height: Math.max(160, Math.round(layout.height * 0.25)),
        }
      : { x: 0, y: 0, width: 640, height: 360 };

    setZoneName('');
    setZoneType('MEDIA');
    setZoneX(defaults.x);
    setZoneY(defaults.y);
    setZoneW(defaults.width);
    setZoneH(defaults.height);
    setZoneZ(0);
    setZonePlaylistId('');
    setZoneClockFormat(DEFAULT_CLOCK_FORMAT);
    setZoneClockFontFamily(DEFAULT_CLOCK_FONT_FAMILY);
    setZoneClockFontSize(DEFAULT_CLOCK_FONT_SIZE);
    setZoneClockFontWeight(DEFAULT_CLOCK_FONT_WEIGHT);
  }

  const zoneTypes = ['MEDIA', 'TEXT', 'CLOCK', 'WEATHER', 'RSS', 'WEB'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Layouts</h1>
          <p className="text-gray-400 mt-1">{total} layout(s)</p>
        </div>
        <button onClick={() => { resetForm(); setEditingLayout(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium">
          <Plus className="w-4 h-4" /> New Layout
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search layouts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Layouts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
        ) : layouts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <LayoutGrid className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No layouts found</p>
          </div>
        ) : layouts.map(layout => (
          <div key={layout.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold">{layout.name}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEditLayout(layout)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteLayout(layout.id)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {layout.description && <p className="text-sm text-gray-400 mb-3">{layout.description}</p>}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{layout.width}×{layout.height}</span>
              <span>{layout.zone_count} zone(s)</span>
              <span className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: layout.background_color }} />
            </div>
            <button onClick={() => { loadZones(layout.id); }} className="w-full mt-4 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">
              Manage Zones
            </button>
          </div>
        ))}
      </div>

      {/* Zones Panel (shown when a layout is selected) */}
      {selectedLayout && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Zones — {selectedLayout.name}</h2>
            <span className="text-xs text-gray-500">({zones.length} zones)</span>
          </div>
          <div className="flex gap-2">
              <button onClick={() => { resetZoneForm(); setEditingZone(null); setShowZoneModal(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs">
                <Plus className="w-3 h-3" /> Add Zone
              </button>
              <button onClick={() => setSelectedLayout(null)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {zones.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">No zones configured. Click "Add Zone" to start.</p>
          ) : (
            <div className="space-y-2">
              {zones.map(zone => (
                <div key={zone.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                  <GripVertical className="w-4 h-4 text-gray-600" />
                  <div className="flex-1">
                    <span className="text-white font-medium text-sm">{zone.name}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-400">{zone.zone_type}</span>
                  </div>
                  <span className="text-xs text-gray-500">{zone.x},{zone.y} {zone.width}×{zone.height}</span>
                  <span className="text-xs text-gray-600">z:{zone.z_index}</span>
                  <button onClick={() => openEditZone(zone)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"><Edit className="w-3 h-3" /></button>
                  <button onClick={() => handleDeleteZone(zone.id)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Previous</button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={layouts.length < 12} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Next</button>
        </div>
      )}

      {/* Layout Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">{editingLayout ? 'Edit Layout' : 'New Layout'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Width</label>
                  <input type="number" value={formWidth} onChange={e => setFormWidth(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Height</label>
                  <input type="number" value={formHeight} onChange={e => setFormHeight(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={formBgColor} onChange={e => setFormBgColor(e.target.value)} className="w-10 h-10 rounded border border-gray-700 bg-transparent" />
                  <input type="text" value={formBgColor} onChange={e => setFormBgColor(e.target.value)} className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveLayout} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save</button>
              <button onClick={() => { setShowModal(false); setEditingLayout(null); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">{editingZone ? 'Edit Zone' : 'New Zone'}</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input type="text" value={zoneName} onChange={e => setZoneName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  value={zoneType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setZoneType(nextType);
                    if (nextType !== 'MEDIA') {
                      setZonePlaylistId('');
                    }
                    if (nextType === 'CLOCK') {
                      setZoneClockFormat(DEFAULT_CLOCK_FORMAT);
                      setZoneClockFontFamily(DEFAULT_CLOCK_FONT_FAMILY);
                      setZoneClockFontSize(DEFAULT_CLOCK_FONT_SIZE);
                      setZoneClockFontWeight(DEFAULT_CLOCK_FONT_WEIGHT);
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {zoneTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {zoneType === 'MEDIA' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Playlist</label>
                  <select value={zonePlaylistId} onChange={e => setZonePlaylistId(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="">Use schedule playlist</option>
                    {playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
                  </select>
                </div>
              )}

              {zoneType === 'CLOCK' && (
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-white">Clock Settings</h4>
                      <p className="text-xs text-gray-500">Digit yang berubah akan dianimasikan per angka.</p>
                    </div>
                    <span className="text-xs text-gray-500">Preview below</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Clock Format</label>
                      <select
                        value={zoneClockFormat}
                        onChange={(e) => setZoneClockFormat(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {CLOCK_FORMAT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Font Family</label>
                      <select
                        value={zoneClockFontFamily}
                        onChange={(e) => setZoneClockFontFamily(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {CLOCK_FONT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Font Size (px)</label>
                      <input
                        type="number"
                        min="16"
                        max="240"
                        value={zoneClockFontSize}
                        onChange={(e) => setZoneClockFontSize(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Font Weight</label>
                      <select
                        value={zoneClockFontWeight}
                        onChange={(e) => setZoneClockFontWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value={400}>Regular</option>
                        <option value={500}>Medium</option>
                        <option value={600}>Semi Bold</option>
                        <option value={700}>Bold</option>
                        <option value={800}>Extra Bold</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {selectedLayout && (
                <LayoutCanvasEditor
                  layoutWidth={selectedLayout.width}
                  layoutHeight={selectedLayout.height}
                  backgroundColor={selectedLayout.background_color}
                  value={{ x: zoneX, y: zoneY, width: zoneW, height: zoneH }}
                  onChange={({ x, y, width, height }) => {
                    setZoneX(Math.round(x));
                    setZoneY(Math.round(y));
                    setZoneW(Math.round(width));
                    setZoneH(Math.round(height));
                  }}
                  backgroundZones={zones
                    .filter(zone => !editingZone || zone.id !== editingZone.id)
                    .map(zone => ({
                      id: zone.id,
                      name: zone.name,
                      zone_type: zone.zone_type,
                      x: zone.x,
                      y: zone.y,
                      width: zone.width,
                      height: zone.height,
                      z_index: zone.z_index,
                    }))}
                  label={zoneName || 'Zone'}
                  minWidth={80}
                  minHeight={60}
                  snap={10}
                />
              )}

              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Precise values</h4>
                    <p className="text-xs text-gray-500">Use these only for exact adjustments.</p>
                  </div>
                  <span className="text-xs text-gray-500">Drag-drop is the primary editor</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm text-gray-400 mb-1">X</label><input type="number" value={zoneX} onChange={e => setZoneX(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Y</label><input type="number" value={zoneY} onChange={e => setZoneY(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Width</label><input type="number" value={zoneW} onChange={e => setZoneW(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                  <div><label className="block text-sm text-gray-400 mb-1">Height</label><input type="number" value={zoneH} onChange={e => setZoneH(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Z-Index</label>
                <input type="number" value={zoneZ} onChange={e => setZoneZ(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveZone} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save</button>
              <button onClick={() => { setShowZoneModal(false); setEditingZone(null); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
