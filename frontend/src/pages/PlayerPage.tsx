import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = window.location.origin;

interface ManifestItem {
  item_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
}

interface Manifest {
  manifest_version: number;
  playlist_id?: number;
  loop: boolean;
  items: ManifestItem[];
}

// ─── Get or create device UUID ───────────────────────────────
function getDeviceUUID(): string {
  let uuid = localStorage.getItem('player_device_uuid');
  if (!uuid) {
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem('player_device_uuid', uuid);
  }
  return uuid;
}

function getPlayerToken(): string | null {
  return localStorage.getItem('player_device_token');
}

function setPlayerToken(token: string) {
  localStorage.setItem('player_device_token', token);
}

function getPlayerSession(): string | null {
  return localStorage.getItem('player_session_token');
}

function setPlayerSession(token: string) {
  localStorage.setItem('player_session_token', token);
}

// ─── API calls ───────────────────────────────────────────────
async function apiPost(path: string, body: unknown, useSession = true): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useSession) {
    const token = getPlayerSession();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/api/v1${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

async function registerDevice(token: string): Promise<boolean> {
  const uuid = getDeviceUUID();
  const res = await apiPost('/player/register', {
    device_uuid: uuid,
    name: `Player ${uuid.slice(0, 8)}`,
    registration_token: token,
    os: 'web-kiosk',
    player_version: '1.0.0',
    resolution_width: screen.width,
    resolution_height: screen.height,
    orientation: screen.width > screen.height ? 'LANDSCAPE' : 'PORTRAIT',
  }, false);
  if (res.device_token) setPlayerToken(res.device_token);
  return true;
}

async function authenticateDevice(): Promise<boolean> {
  const uuid = getDeviceUUID();
  const token = getPlayerToken();
  if (!token) return false;
  const res = await apiPost('/player/auth', { device_uuid: uuid, device_token: token }, false);
  if (res.session_token) { setPlayerSession(res.session_token); return true; }
  return false;
}

async function getManifest(): Promise<Manifest | null> {
  try { const res = await apiPost('/player/manifest', {}); return res; } catch { return null; }
}

async function sendHeartbeat() {
  try { await apiPost('/player/heartbeat', { player_version: '1.0.0', screen_width: screen.width, screen_height: screen.height }); } catch {}
}

async function reportPlayback(data: { playlist_id?: number; media_id?: number; action: string; started_at?: string; ended_at?: string; duration_ms?: number }) {
  try { await apiPost('/player/playback', data); } catch {}
}

async function pollCommands() {
  try { const res = await fetch(`${API_BASE}/api/v1/player/commands`, { headers: { Authorization: `Bearer ${getPlayerSession()}` } }); const data = await res.json(); return data.commands || []; } catch { return []; }
}

export default function PlayerPage() {
  const [phase, setPhase] = useState<'setup' | 'loading' | 'playing' | 'error' | 'no-content'>('setup');
  const [error, setError] = useState('');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [setupToken, setSetupToken] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Check URL params for auto-setup ───────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const deviceUuid = params.get('device');

    if (token && deviceUuid) {
      // Auto-setup from URL params
      localStorage.setItem('player_device_uuid', deviceUuid);
      handleSetup(token);
    } else if (getPlayerToken() && getPlayerSession()) {
      // Already authenticated
      setPhase('loading');
      loadManifest();
    }
  }, []);

  // ─── Heartbeat ─────────────────────────────────────────────
  useEffect(() => {
    heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, []);

  // ─── Command polling ───────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const commands = await pollCommands();
      for (const cmd of commands) {
        if (cmd.command_type === 'RELOAD') window.location.reload();
        if (cmd.command_type === 'REBOOT') window.location.reload();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── Setup handler ─────────────────────────────────────────
  async function handleSetup(token: string) {
    if (!token) { setError('Masukkan Registration Token'); return; }
    setPhase('loading');
    try {
      await registerDevice(token);
      await authenticateDevice();
      loadManifest();
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungkan ke server');
      setPhase('error');
    }
  }

  // ─── Load manifest ─────────────────────────────────────────
  const loadManifest = useCallback(async () => {
    try {
      const m = await getManifest();
      if (m && m.items.length > 0) {
        setManifest(m);
        setCurrentIndex(0);
        setPhase('playing');
      } else {
        setPhase('no-content');
      }
    } catch {
      setError('Gagal memuat konten');
      setPhase('error');
    }
  }, []);

  // Refetch manifest every 60s
  useEffect(() => {
    if (phase === 'playing') {
      const interval = setInterval(loadManifest, 60000);
      return () => clearInterval(interval);
    }
  }, [phase, loadManifest]);

  // ─── Playback timer ────────────────────────────────────────
  useEffect(() => {
    if (!manifest || manifest.items.length === 0 || phase !== 'playing') return;

    const item = manifest.items[currentIndex];
    startTimeRef.current = Date.now();

    reportPlayback({ playlist_id: manifest.playlist_id, media_id: item.item_id, action: 'START', started_at: new Date().toISOString() });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      reportPlayback({ playlist_id: manifest.playlist_id, media_id: item.item_id, action: 'END', ended_at: new Date().toISOString(), duration_ms: Date.now() - startTimeRef.current });

      if (currentIndex < manifest.items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (manifest.loop) {
        setCurrentIndex(0);
      }
    }, item.duration_seconds * 1000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, manifest, phase]);

  // ─── RENDER ────────────────────────────────────────────────

  // Setup screen
  if (phase === 'setup') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '24rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '4rem', height: '4rem', background: '#2563eb', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <span style={{ fontSize: '2rem' }}>📺</span>
            </div>
            <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700 }}>Digital Signage Player</h1>
            <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>Masukkan Registration Token</p>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Registration Token *</label>
            <input
              type="text"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Masukkan token dari dashboard"
              style={{ width: '100%', padding: '0.75rem 1rem', background: '#1f2937', border: '1px solid #374151', borderRadius: '0.5rem', color: '#fff', fontSize: '1rem', fontFamily: 'monospace', outline: 'none' }}
              onKeyDown={(e) => e.key === 'Enter' && handleSetup(setupToken)}
            />
            <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>Dashboard → Devices → Registration Token</p>
            {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginTop: '0.75rem' }}>{error}</p>}
            <button
              onClick={() => handleSetup(setupToken)}
              style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: 500, cursor: 'pointer', marginTop: '1rem' }}
            >
              Hubungkan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading screen
  if (phase === 'loading') {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '3rem', height: '3rem', border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>Memuat konten...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error screen
  if (phase === 'error') {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</p>
          <p style={{ color: '#f87171', fontSize: '1.25rem' }}>Error</p>
          <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>{error}</p>
          <button onClick={() => { localStorage.clear(); setPhase('setup'); }} style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Reset</button>
        </div>
      </div>
    );
  }

  // No content screen
  if (phase === 'no-content' || !manifest || manifest.items.length === 0) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📺</p>
          <p style={{ color: '#9ca3af', fontSize: '1.125rem' }}>Tidak ada konten yang tersedia</p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>Buat playlist dan schedule di dashboard</p>
          <button onClick={loadManifest} style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#374151', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Muat Ulang</button>
        </div>
      </div>
    );
  }

  // ─── PLAYING ───────────────────────────────────────────────
  const currentItem = manifest.items[currentIndex];

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
      {currentItem.mime_type.startsWith('image/') ? (
        <img
          key={currentItem.item_id}
          src={`${API_BASE}${currentItem.media_url}`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : currentItem.mime_type.startsWith('video/') ? (
        <video
          key={currentItem.item_id}
          src={`${API_BASE}${currentItem.media_url}`}
          autoPlay
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onEnded={() => {
            reportPlayback({ playlist_id: manifest.playlist_id, media_id: currentItem.item_id, action: 'END', ended_at: new Date().toISOString(), duration_ms: Date.now() - startTimeRef.current });
            if (currentIndex < manifest.items.length - 1) setCurrentIndex(currentIndex + 1);
            else if (manifest.loop) setCurrentIndex(0);
          }}
        />
      ) : currentItem.mime_type.startsWith('audio/') ? (
        <>
          <audio
            key={currentItem.item_id}
            src={`${API_BASE}${currentItem.media_url}`}
            autoPlay
            onEnded={() => {
              if (currentIndex < manifest.items.length - 1) setCurrentIndex(currentIndex + 1);
              else if (manifest.loop) setCurrentIndex(0);
            }}
          />
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '4rem' }}>🎵</p>
          </div>
        </>
      ) : (
        <img
          key={currentItem.item_id}
          src={`${API_BASE}${currentItem.media_url}`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)' }}>
        <div style={{ height: '100%', background: '#3b82f6', animation: `progress ${currentItem.duration_seconds}s linear` }} />
      </div>
      <style>{`@keyframes progress { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
}
