export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => void;
  openFileDialog: () => Promise<string | null>;
  startServer: (serverPath: string, modelPath: string, additionalArgs: string) => Promise<void>;
  stopServer: () => Promise<void>;
  getDeviceName: () => Promise<string>;
  onServerStdout: (callback: (data: string) => void) => () => void; // returns a cleanup function
  onServerStderr: (callback: (data: string) => void) => () => void; // returns a cleanup function
}

declare global {
  interface Window {
    electronBridge: ElectronAPI;
  }
}