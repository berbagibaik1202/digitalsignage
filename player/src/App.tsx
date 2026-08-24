import { useState, useEffect, useCallback } from 'react';
import SetupScreen from './components/SetupScreen';
import PlayerView from './components/PlayerView';
import StatusOverlay from './components/StatusOverlay';
import CommandHandler from './components/CommandHandler';
import { useHeartbeat } from './hooks/useHeartbeat';
import {
  isRegistered,
  registerDevice,
  authenticateDevice,
  setApiBase,
  getApiBase,
  getDeviceUUID,
} from './services/player';

type AppPhase = 'setup' | 'registering' | 'authenticating' | 'playing' | 'error';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('setup');
  const [error, setError] = useState<string | null>(null);
  const { connected, lastHeartbeat } = useHeartbeat({
    intervalMs: 30000,
  });

  // Check if already registered on mount
  useEffect(() => {
    if (!isRegistered()) return;

    // Enter playback immediately so PlayerView can restore cached content offline.
    setPhase('playing');
    void authenticateDevice();
  }, []);

  // Handle setup completion
  const handleSetupComplete = useCallback(async (apiBase: string, registrationToken: string, deviceName?: string) => {
    setApiBase(apiBase);
    setPhase('registering');
    setError(null);

    try {
      // Register device
      const registered = await registerDevice(registrationToken, deviceName);
      if (!registered) {
        throw new Error('Registrasi device gagal');
      }

      // Authenticate
      setPhase('authenticating');
      const authenticated = await authenticateDevice();
      if (!authenticated) {
        throw new Error('Autentikasi device gagal');
      }

      // Start playing
      setPhase('playing');
    } catch (err: any) {
      setError(err.message);
      setPhase('error');
    }
  }, []);

  // Retry after error
  const handleRetry = useCallback(() => {
    setError(null);
    if (isRegistered()) {
      setPhase('playing');
      void authenticateDevice();
    } else {
      setPhase('setup');
    }
  }, []);

  // ─── Setup Phase ───────────────────────────────────────────
  if (phase === 'setup') {
    return <SetupScreen onComplete={handleSetupComplete} apiBase={getApiBase()} />;
  }

  // ─── Registering Phase ─────────────────────────────────────
  if (phase === 'registering') {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Mendaftarkan device...</p>
          <p className="text-gray-500 text-sm mt-2">Device ID: {getDeviceUUID().slice(0, 16)}...</p>
        </div>
      </div>
    );
  }

  // ─── Authenticating Phase ──────────────────────────────────
  if (phase === 'authenticating') {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Mengautentikasi device...</p>
        </div>
      </div>
    );
  }

  // ─── Error Phase ───────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-400 text-xl mb-2">Error</p>
          <p className="text-gray-400">{error}</p>
          <div className="flex gap-3 mt-6 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                setPhase('setup');
              }}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Playing Phase ─────────────────────────────────────────
  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {/* Main player */}
      <PlayerView onError={(err) => setError(err)} />

      {/* Status overlay */}
      <StatusOverlay connected={connected} lastHeartbeat={lastHeartbeat} />

      {/* Command handler (invisible) */}
      <CommandHandler />
    </div>
  );
}
