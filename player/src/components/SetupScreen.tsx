import { useState } from 'react';

interface SetupScreenProps {
  onComplete: (apiBase: string, registrationToken: string) => void;
  apiBase: string;
}

export default function SetupScreen({ onComplete, apiBase }: SetupScreenProps) {
  const [serverUrl, setServerUrl] = useState(apiBase);
  const [registrationToken, setRegistrationToken] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!serverUrl || !registrationToken) {
      setError('Server URL dan Registration Token wajib diisi');
      return;
    }

    setLoading(true);

    try {
      // Test connection first
      const res = await fetch(`${serverUrl}/api/v1/health`);
      if (!res.ok) throw new Error('Server tidak dapat diakses');

      // Store values and proceed
      onComplete(serverUrl.replace(/\/$/, ''), registrationToken);
    } catch (err: any) {
      setError(err.message || 'Gagal koneksi ke server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Digital Signage Player</h1>
          <p className="text-gray-400 mt-2">Masukkan informasi untuk menghubungkan ke server</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Server URL *</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://your-server.com"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Registration Token *</label>
            <input
              type="text"
              value={registrationToken}
              onChange={(e) => setRegistrationToken(e.target.value)}
              placeholder="Masukkan token dari dashboard"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Dapat dilihat di Dashboard → Devices → Registration Token</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Nama Device (opsional)</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Contoh: TV Lobby Lantai 1"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? 'Menghubungkan...' : 'Hubungkan ke Server'}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Device ID: {localStorage.getItem('device_uuid')?.slice(0, 8) || ' Generating...'}</p>
        </div>
      </div>
    </div>
  );
}
