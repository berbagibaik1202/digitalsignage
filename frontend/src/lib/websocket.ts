import { useEffect, useRef, useCallback, useState } from 'react';

interface DeviceStatus {
  device_uuid: string;
  status: string;
  timestamp: string;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
}

interface PlaybackLog {
  tenant_id: number;
  device_id: number;
  media_id: number;
  log_action: string;
  timestamp: string;
}

interface UseWebSocketOptions {
  onDeviceStatus?: (status: DeviceStatus) => void;
  onPlaybackLog?: (log: PlaybackLog) => void;
  onCommand?: (command: Record<string, unknown>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [connected, setConnected] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In development, the WebSocket proxy goes through Vite
    const wsUrl = `${protocol}//${window.location.host}/ws/?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setConnected(true);
        optionsRef.current.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'device:status':
              optionsRef.current.onDeviceStatus?.(data.payload);
              break;
            case 'playback:log':
              optionsRef.current.onPlaybackLog?.(data.payload);
              break;
            case 'command:received':
              optionsRef.current.onCommand?.(data.payload);
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setConnected(false);
        optionsRef.current.onDisconnect?.();
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        ws.close();
      };
    } catch {
      // Reconnect on failure
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((type: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, send, disconnect };
}

// Simple hook for getting device status without WebSocket
// Falls back to polling if WebSocket is not available
export function useDevicePolling(intervalMs = 10000) {
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date().toISOString());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return lastUpdate;
}
