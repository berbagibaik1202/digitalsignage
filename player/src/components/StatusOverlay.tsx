import { useState, useEffect } from 'react';
import { getDeviceUUID } from '../services/player';

interface StatusOverlayProps {
  connected: boolean;
  lastHeartbeat?: Date | null;
}

export default function StatusOverlay({ connected, lastHeartbeat }: StatusOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const deviceUuid = getDeviceUUID();

  // Show overlay on mouse move (if mouse is connected)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const handleMouseMove = () => {
      setVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  // Keyboard shortcut: press 'i' for info
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'i' || e.key === 'I') {
        setShowInfo(!showInfo);
      }
      if (e.key === 'Escape') {
        setShowInfo(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInfo]);

  return (
    <>
      {/* Status indicator (top-right corner) */}
      <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
        <span className="text-sm text-gray-400 bg-black/50 px-2 py-1 rounded">
          {connected ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Device info panel (press 'I' to toggle) */}
      {showInfo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Device Info</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Device ID:</span>
                <span className="text-white font-mono">{deviceUuid.slice(0, 16)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={connected ? 'text-green-400' : 'text-red-400'}>
                  {connected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Resolution:</span>
                <span className="text-white">{screen.width}×{screen.height}</span>
              </div>
              {lastHeartbeat && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Heartbeat:</span>
                  <span className="text-white">{lastHeartbeat.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
              >
                Reset & Re-pair
              </button>
              <button
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">I</kbd> to toggle this panel
            </p>
          </div>
        </div>
      )}
    </>
  );
}
