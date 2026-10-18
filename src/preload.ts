import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronBridge", {
    generateCryptoSecret: (): Promise<string> => ipcRenderer.invoke("secret:generate-crypto"),
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
     * Subscribe to the llama.cpp server process exiting (crash or clean stop).
     * Returns a cleanup function, same as onServerStdout / onServerStderr.
     */
    onServerExit: (
        callback: (info: { code: number | null; signal: string | null }) => void,
    ) => {
        const listener = (
            _event: Electron.IpcRendererEvent,
            info: { code: number | null; signal: string | null },
        ) => callback(info);
        ipcRenderer.on("server:exit", listener);
        return () => ipcRenderer.removeListener("server:exit", listener);
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

    /**
     * Check whether an OpenAI-compatible server (LM Studio, Ollama, a manually
     * launched llama-server, …) is reachable at `baseUrl`, and list the models
     * it is serving. Runs in the main process so no CORS policy applies.
     */
    probeBackend: (
        baseUrl: string,
    ): Promise<{ ok: boolean; models: string[]; error?: string }> => {
        return ipcRenderer.invoke("backend:probe", baseUrl);
    },

    /**
     * Show an alert dialog with a message and optional title.
     */
    showAlert: (title: string, message: string) => ipcRenderer.invoke('dialog:alert', title, message),
});
