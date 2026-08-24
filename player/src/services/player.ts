// Player Service — handles all communication with Digital Signage backend

const DEFAULT_API_BASE = 'https://display.rizki-tech.com';
const REQUEST_TIMEOUT_MS = 10_000;

interface DeviceInfo {
  device_uuid: string;
  name: string;
  registration_token?: string;
  device_token?: string;
  session_token?: string;
}

interface ManifestItem {
  item_id: number;
  media_id: number;
  media_url: string;
  mime_type: string;
  duration_seconds: number;
  transition?: string;
}

interface Manifest {
  manifest_version: number;
  playlist_id?: number;
  loop: boolean;
  items: ManifestItem[];
  message?: string;
}

interface Command {
  command_id: number;
  command_type: string;
  payload?: string;
}

// Generate unique device UUID (persistent)
function getDeviceUUID(): string {
  let uuid = localStorage.getItem('device_uuid');
  if (!uuid) {
    uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem('device_uuid', uuid);
  }
  return uuid;
}

function getDeviceToken(): string | null {
  return localStorage.getItem('device_token');
}

function setDeviceToken(token: string) {
  localStorage.setItem('device_token', token);
}

function getSessionToken(): string | null {
  return localStorage.getItem('session_token');
}

function setSessionToken(token: string) {
  localStorage.setItem('session_token', token);
}

function getApiBase(): string {
  return localStorage.getItem('api_base') || DEFAULT_API_BASE;
}

function setApiBase(url: string) {
  localStorage.setItem('api_base', url.replace(/\/$/, ''));
}

async function apiRequest(method: string, path: string, body?: unknown, useSession = true, allowReauthentication = true): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (useSession) {
    const token = getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;

  try {
    res = await fetch(`${getApiBase()}/api/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 && useSession && allowReauthentication && await authenticateDevice()) {
    return apiRequest(method, path, body, true, false);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ─── Device Registration ─────────────────────────────────────
export async function registerDevice(registrationToken: string, deviceName?: string): Promise<boolean> {
  const uuid = getDeviceUUID();
  const deviceInfo = await window.electronAPI?.getDeviceInfo();

  try {
    const res = await apiRequest('POST', '/player/register', {
      device_uuid: uuid,
      name: deviceName || `Player ${uuid.slice(0, 8)}`,
      registration_token: registrationToken,
      os: deviceInfo?.platform || 'unknown',
      player_version: '1.0.0',
      resolution_width: screen.width,
      resolution_height: screen.height,
      orientation: screen.width > screen.height ? 'LANDSCAPE' : 'PORTRAIT',
    }, false);

    if (res.device_token) {
      setDeviceToken(res.device_token);
    }

    return true;
  } catch (err) {
    console.error('Registration failed:', err);
    return false;
  }
}

// ─── Device Authentication ───────────────────────────────────
export async function authenticateDevice(): Promise<boolean> {
  const uuid = getDeviceUUID();
  const deviceToken = getDeviceToken();

  if (!deviceToken) return false;

  try {
    const res = await apiRequest('POST', '/player/auth', {
      device_uuid: uuid,
      device_token: deviceToken,
    }, false);

    if (res.session_token) {
      setSessionToken(res.session_token);
      return true;
    }

    return false;
  } catch (err) {
    console.error('Auth failed:', err);
    return false;
  }
}

// ─── Heartbeat ───────────────────────────────────────────────
export async function sendHeartbeat(data?: {
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  current_playlist_id?: number;
  current_media_id?: number;
}): Promise<boolean> {
  try {
    await apiRequest('POST', '/player/heartbeat', {
      player_version: '1.0.0',
      screen_width: screen.width,
      screen_height: screen.height,
      ...data,
    });
    return true;
  } catch (err) {
    console.error('Heartbeat failed:', err);
    return false;
  }
}

// ─── Get Manifest (Content to Play) ──────────────────────────
export async function getManifest(): Promise<Manifest | null> {
  try {
    const res = await apiRequest('POST', '/player/manifest', {});
    return res;
  } catch (err) {
    console.error('Manifest fetch failed:', err);
    return null;
  }
}

// ─── Report Playback Event ───────────────────────────────────
export async function reportPlayback(data: {
  playlist_id?: number;
  media_id?: number;
  action: 'START' | 'END' | 'SKIP' | 'ERROR';
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  error_message?: string;
}): Promise<void> {
  try {
    await apiRequest('POST', '/player/playback', data);
  } catch (err) {
    console.error('Playback report failed:', err);
  }
}

// ─── Poll Commands ───────────────────────────────────────────
export async function pollCommands(): Promise<Command[]> {
  try {
    const res = await apiRequest('GET', '/player/commands');
    return res.commands || [];
  } catch (err) {
    console.error('Command poll failed:', err);
    return [];
  }
}

// ─── Report Command Result ───────────────────────────────────
export async function reportCommandResult(commandId: number, status: string, result?: string): Promise<void> {
  try {
    await apiRequest('POST', '/player/command-result', {
      command_id: commandId,
      status,
      result,
    });
  } catch (err) {
    console.error('Command result report failed:', err);
  }
}

// ─── Report Screenshot ───────────────────────────────────────
export async function reportScreenshot(data: {
  storage_key?: string;
  width?: number;
  height?: number;
  file_size?: number;
}): Promise<void> {
  try {
    await apiRequest('POST', '/player/screenshot', data);
  } catch (err) {
    console.error('Screenshot report failed:', err);
  }
}

// ─── Check if Registered ─────────────────────────────────────
export function isRegistered(): boolean {
  return !!getDeviceToken();
}

// ─── Check if Authenticated ──────────────────────────────────
export function isAuthenticated(): boolean {
  return !!getSessionToken();
}

export function getPlayerSessionToken(): string | null {
  return getSessionToken();
}

// ─── Clear Auth ──────────────────────────────────────────────
export function clearAuth() {
  localStorage.removeItem('device_token');
  localStorage.removeItem('session_token');
}

// ─── Get Media URL ───────────────────────────────────────────
export function getMediaUrl(mediaUrl: string): string {
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return mediaUrl;
  }

  return `${getApiBase()}${mediaUrl}`;
}

export { getDeviceUUID, getApiBase, setApiBase };
