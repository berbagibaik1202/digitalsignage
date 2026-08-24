import { useState, useEffect } from 'react';
import { ListMusic, Plus, Search, Edit2, Trash2, X, Play } from 'lucide-react';
import api from '../lib/api';

interface Playlist {
  id: number;
  name: string;
  description: string | null;
  loop_playback: boolean;
  item_count?: number;
  created_at: string;
}

interface PlaylistItem {
  id: number;
  media_id: number;
  sort_order: number;
  duration_seconds: number | null;
  transition: string;
  transition_duration_ms: number | null;
  original_name?: string;
  mime_type?: string;
}

interface MediaItem {
  id: number;
  original_name: string;
  mime_type: string;
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [form, setForm] = useState({ name: '', description: '', loop_playback: true });

  // Detail view
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<MediaItem[]>([]);
  const [pendingMedia, setPendingMedia] = useState<MediaItem | null>(null);
  const [pendingDuration, setPendingDuration] = useState(10);
  const [pendingTransition, setPendingTransition] = useState('fade');
  const [pendingTransitionDuration, setPendingTransitionDuration] = useState(700);

  useEffect(() => { loadPlaylists(); }, [page, search]);

  async function loadPlaylists() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      const res = await api.get(`/playlists?${params}`);
      setPlaylists(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylistDetail(playlist: Playlist) {
    setSelectedPlaylist(playlist);
    try {
      const res = await api.get(`/playlists/${playlist.id}`);
      setPlaylistItems(res.data.items);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAvailableMedia() {
    try {
      const res = await api.get('/media?limit=100');
      setAvailableMedia(res.data.data);
    } catch (err) {
      console.error(err);
    }
  }

  function openCreate() {
    setEditingPlaylist(null);
    setForm({ name: '', description: '', loop_playback: true });
    setShowModal(true);
  }

  function openEdit(playlist: Playlist) {
    setEditingPlaylist(playlist);
    setForm({ name: playlist.name, description: playlist.description || '', loop_playback: playlist.loop_playback });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingPlaylist) {
        await api.put(`/playlists/${editingPlaylist.id}`, form);
      } else {
        await api.post('/playlists', form);
      }
      setShowModal(false);
      loadPlaylists();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this playlist and all its items?')) return;
    try {
      await api.delete(`/playlists/${id}`);
      if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
      loadPlaylists();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function addItemToPlaylist(mediaId: number) {
    if (!selectedPlaylist) return;
    try {
      await api.post(`/playlists/${selectedPlaylist.id}/items`, {
        media_id: mediaId,
        duration_seconds: pendingDuration,
        transition: pendingTransition,
        transition_duration_ms: pendingTransitionDuration,
      });
      await loadPlaylistDetail(selectedPlaylist);
      setShowAddItem(false);
      setPendingMedia(null);
      setPendingDuration(10);
      setPendingTransition('fade');
      setPendingTransitionDuration(700);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function removeItem(itemId: number) {
    if (!selectedPlaylist) return;
    if (!confirm('Remove this item?')) return;
    try {
      await api.delete(`/playlists/${selectedPlaylist.id}/items/${itemId}`);
      await loadPlaylistDetail(selectedPlaylist);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  // Detail view
  if (selectedPlaylist) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedPlaylist(null); loadPlaylists(); }} className="text-gray-400 hover:text-white">&larr; Back</button>
          <div>
            <h1 className="text-2xl font-bold text-white">{selectedPlaylist.name}</h1>
            <p className="text-gray-400 mt-1">{playlistItems.length} item(s)</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => {
              loadAvailableMedia();
              setPendingMedia(null);
              setPendingDuration(10);
              setPendingTransition('fade');
              setPendingTransitionDuration(700);
              setShowAddItem(true);
            }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Media
            </button>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400 w-10">#</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Media</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Duration</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {playlistItems.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">No items. Click "Add Media" to add content.</td></tr>
              ) : (
                playlistItems.map((item, idx) => (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 text-white">{item.original_name || `Media #${item.media_id}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{item.mime_type || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      <div>{item.duration_seconds ? `${item.duration_seconds}s` : '-'}</div>
                      <div className="text-xs text-gray-500">
                        {item.transition || 'none'}
                        {item.transition_duration_ms ? ` / ${item.transition_duration_ms}ms` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removeItem(item.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Item Modal */}
        {showAddItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[620px] max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {pendingMedia ? 'Configure Playlist Item' : 'Add Media to Playlist'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddItem(false);
                    setPendingMedia(null);
                    setPendingDuration(10);
                    setPendingTransition('fade');
                    setPendingTransitionDuration(700);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!pendingMedia ? (
                <div className="space-y-2">
                  {availableMedia.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700">
                      <div>
                        <p className="text-white text-sm">{m.original_name}</p>
                        <p className="text-xs text-gray-400">{m.mime_type}</p>
                      </div>
                      <button
                        onClick={() => {
                          setPendingMedia(m);
                          setPendingDuration(10);
                          setPendingTransition('fade');
                          setPendingTransitionDuration(700);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                  {availableMedia.length === 0 && <p className="text-gray-500 text-center py-4">No media files available. Upload some first.</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-white text-sm font-medium">{pendingMedia.original_name}</p>
                    <p className="text-xs text-gray-400 mt-1">{pendingMedia.mime_type}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Display Duration (seconds)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={pendingDuration}
                        onChange={(e) => setPendingDuration(Number(e.target.value))}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Transition Effect</label>
                      <select
                        value={pendingTransition}
                        onChange={(e) => setPendingTransition(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="fade">Fade</option>
                        <option value="zoom">Zoom</option>
                        <option value="slide-left">Slide Left</option>
                        <option value="slide-right">Slide Right</option>
                        <option value="slide-up">Slide Up</option>
                        <option value="slide-down">Slide Down</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Transition Duration (ms)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={pendingTransitionDuration}
                      onChange={(e) => setPendingTransitionDuration(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Durasi ini menentukan berapa lama image tampil sebelum pindah ke item berikutnya. Transisi dipakai saat masuk dan keluar.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setPendingMedia(null);
                        setPendingDuration(10);
                        setPendingTransition('fade');
                        setPendingTransitionDuration(700);
                      }}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => addItemToPlaylist(pendingMedia.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                      Save Item
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Playlists</h1>
          <p className="text-gray-400 mt-1">{total} playlist(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Create Playlist
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" placeholder="Search playlists..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
        ) : playlists.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500"><ListMusic className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No playlists found</p></div>
        ) : (
          playlists.map((pl) => (
            <div key={pl.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors cursor-pointer" onClick={() => loadPlaylistDetail(pl)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Play className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(pl)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(pl.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-white font-medium">{pl.name}</h3>
              <p className="text-sm text-gray-400 mt-1">{pl.description || 'No description'}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>{pl.item_count || 0} items</span>
                <span>{pl.loop_playback ? 'Loop' : 'No loop'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{editingPlaylist ? 'Edit Playlist' : 'Create Playlist'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.loop_playback} onChange={(e) => setForm({ ...form, loop_playback: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-700" />
                <label className="text-sm text-gray-400">Loop playback</label>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
                {editingPlaylist ? 'Update' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
