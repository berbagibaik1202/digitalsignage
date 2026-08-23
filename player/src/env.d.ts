interface ElectronAPI {
  getDeviceInfo: () => Promise<{
    platform: string;
    arch: string;
    hostname: string;
  }>;
  exitApp: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  takeScreenshot: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
