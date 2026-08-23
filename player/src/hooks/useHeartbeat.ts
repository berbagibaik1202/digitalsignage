import { useEffect, useRef, useCallback, useState } from 'react';
import { sendHeartbeat, isAuthenticated } from '../services/player';

interface UseHeartbeatOptions {
  intervalMs?: number;
  onStatusChange?: (connected: boolean) => void;
}

export function useHeartbeat(options: UseHeartbeatOptions = {}) {
  const { intervalMs = 30000, onStatusChange } = options;
  const [connected, setConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doHeartbeat = useCallback(async () => {
    if (!isAuthenticated()) return;

    try {
      const success = await sendHeartbeat();
      setConnected(success);
      if (success) {
        setLastHeartbeat(new Date());
      }
      onStatusChange?.(success);
    } catch {
      setConnected(false);
      onStatusChange?.(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    // Send heartbeat immediately
    doHeartbeat();

    // Then every intervalMs
    intervalRef.current = setInterval(doHeartbeat, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [doHeartbeat, intervalMs]);

  return { connected, lastHeartbeat };
}
