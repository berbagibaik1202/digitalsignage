import { useState, useEffect, useRef } from 'react';
import { Image, Upload, Search, Trash2, Eye, FileVideo, FileAudio, File, X, Loader, RefreshCw } from 'lucide-react';
import api from '../lib/api';

interface MediaItem {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  status: string;
  width: number | null;
  height: number | null;
  created_at: string;
  thumbnail_key: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
}

export default function MediaPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMedia(); }, [page, search]);

  async function loadMedia() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      const res = await api.get(`/media?${params}`);
      setMedia(res.data.data || []);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      loadMedia();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this media file?')) return;
    try {
      await api.delete(`/media/${id}`);
      loadMedia();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Delete failed');
    }
  }

  async function handleReprocess(id: number) {
    try {
      await api.post(`/media/${id}/reprocess`);
      loadMedia();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to regenerate thumbnail');
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  function getFileIcon(mimeType: string) {
    if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-purple-400" />;
    if (mimeType.startsWith('video/')) return <FileVideo className="w-8 h-8 text-blue-400" />;
    if (mimeType.startsWith('audio/')) return <FileAudio className="w-8 h-8 text-green-400" />;
    return <File className="w-8 h-8 text-gray-400" />;
  }

  function renderMediaPreview(item: MediaItem, size: 'thumb' | 'full' = 'thumb') {
    const url = size === 'thumb' ? (item.thumbnail_url || item.file_url) : item.file_url;

    if (!url) {
      // No URL available — show placeholder
      return (
        <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
          {item.status === 'PROCESSING' ? (
            <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
          ) : (
            <div className="text-center">
              {getFileIcon(item.mime_type)}
              <p className="text-xs text-gray-500 mt-1">No preview</p>
            </div>
          )}
        </div>
      );
    }

    // Show actual image/video
    if (item.mime_type.startsWith('image/')) {
      return (
        <img
          src={url}
          alt={item.original_name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      );
    }

    if (item.mime_type.startsWith('video/')) {
      return (
        <video
          src={url}
          poster={item.thumbnail_url || undefined}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          controls={size === 'full'}
          onError={(e) => {
            (e.target as HTMLVideoElement).style.display = 'none';
          }}
        />
      );
    }

    return (
      <div className="w-full h-full flex items-center justify-center">
        {getFileIcon(item.mime_type)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Media Library</h1>
          <p className="text-gray-400 mt-1">{total} file(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,video/*,audio/*,.pdf" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search media..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
        ) : media.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No media files</p>
          </div>
        ) : (
          media.map((item) => (
            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden group hover:border-gray-600 transition-colors">
              <div className="aspect-square bg-gray-800 flex items-center justify-center relative overflow-hidden">
                {renderMediaPreview(item, 'thumb')}

                {/* Status badge for processing */}
                {item.status === 'PROCESSING' && (
                  <div className="absolute top-2 left-2 bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Loader className="w-3 h-3 animate-spin" /> Processing
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                  <button onClick={() => setPreviewItem(item)} className="p-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700">
                    <Eye className="w-4 h-4" />
                  </button>
                  {(item.mime_type.startsWith('image/') || item.mime_type.startsWith('video/')) && (
                    <button onClick={() => handleReprocess(item.id)} className="p-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700" title="Regenerate thumbnail">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(item.id)} className="p-2 bg-gray-800 rounded-lg text-red-400 hover:bg-gray-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm text-white truncate" title={item.original_name}>{item.original_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatFileSize(item.file_size)}
                  {item.width && item.height && <span> · {item.width}×{item.height}</span>}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {total > 24 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Previous</button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={media.length < 24} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Next</button>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setPreviewItem(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white truncate">{previewItem.original_name}</h3>
              <button onClick={() => setPreviewItem(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
              {renderMediaPreview(previewItem, 'full')}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-400">Type:</span> <span className="text-white">{previewItem.mime_type}</span></div>
              <div><span className="text-gray-400">Size:</span> <span className="text-white">{formatFileSize(previewItem.file_size)}</span></div>
              {previewItem.width && previewItem.height && (
                <div><span className="text-gray-400">Resolution:</span> <span className="text-white">{previewItem.width}×{previewItem.height}</span></div>
              )}
              <div><span className="text-gray-400">Status:</span> <span className="text-white">{previewItem.status}</span></div>
              <div><span className="text-gray-400">Created:</span> <span className="text-white">{new Date(previewItem.created_at).toLocaleDateString()}</span></div>
            </div>

            {previewItem.file_url && (
              <div className="mt-4">
                <a
                  href={previewItem.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  ↗ Open full file in new tab
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
