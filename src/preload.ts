import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronBridge", {
    getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
    openExternal: (url: string) => ipcRenderer.send("open-external", url),

    /**
     * Start the llama.cpp server process.
     */
    startServer: (
        serverPath: string,
        modelPath: string,
        visionModelPath: string,
        additionalArgs: string,
    ): Promise<void> => {
        return ipcRenderer.invoke('server:start', serverPath, modelPath, visionModelPath, additionalArgs);
    },

    onServerStdout: (callback: (data: string) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
        ipcRenderer.on("server:stdout", listener);
        // Return a cleanup function
        return () => ipcRenderer.removeListener("server:stdout", listener);
    },
    onServerStderr: (callback: (data: string) => void) => {
        const listener = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
        ipcRenderer.on("server:stderr", listener);
        return () => ipcRenderer.removeListener("server:stderr", listener);
    },

    /**
     * Stop the llama.cpp server process.
     */
    stopServer: (): Promise<void> => {
        return ipcRenderer.invoke('server:stop');
    },

    /**
     * Get the machine's device / host name.
     */
    getDeviceName: (): Promise<string> => {
        return ipcRenderer.invoke('device:name');
    },

    /**
     * Open a file dialog to select a model file, returning the selected file path.
     * @returns the path of the selected model file, or null if the dialog was cancelled
     */
    openFileDialog: () => ipcRenderer.invoke("dialog:openFile"),
});