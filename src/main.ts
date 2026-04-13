import { app, BrowserWindow, ipcMain, dialog } from "electron";
import * as path from "path";
import os from 'os';
import { spawn, exec, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
const isWindows = process.platform === "win32";

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle('device:name', () => {
  return os.hostname();
});

ipcMain.handle("dialog:openFile", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      // { name: "Model Files", extensions: ["gguf", "bin", "onnx"] }, // adjust as needed
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

let serverProcess: ChildProcess | null = null;

function killProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isWindows) {
      // SIGTERM is a no-op on Windows — use taskkill to kill the process tree
      exec(`taskkill /pid ${child.pid} /T /F`, (error) => {
        if (error) reject(`taskkill failed: ${error.message}`);
        else resolve();
      });
    } else {
      const forceKillTimeout = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.on("exit", () => clearTimeout(forceKillTimeout));
      const killed = child.kill("SIGTERM");
      if (!killed) reject("Failed to send SIGTERM");
      else resolve();
    }
  });
}

ipcMain.handle(
  "server:start",
  async (_event, serverPath: string, modelPath: string, additionalArgs: string): Promise<string> => {
    if (serverProcess) {
      return "Server is already running";
    }

    return new Promise((resolve, reject) => {
      const args = ["--model", modelPath, ...additionalArgs.split(" ").filter(Boolean)];

      serverProcess = spawn(serverPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        // Ensures child processes are grouped so taskkill /T can kill the whole tree
        ...(isWindows && { detached: false }),
      });

      serverProcess.stdout?.on("data", (data) => {
        mainWindow?.webContents.send("server:stdout", data.toString());
      });

      serverProcess.stderr?.on("data", (data) => {
        mainWindow?.webContents.send("server:stderr", data.toString());
      });

      serverProcess.on("spawn", () => {
        resolve(`Server started with PID ${serverProcess?.pid}`);
      });

      serverProcess.on("error", (err) => {
        serverProcess = null;
        reject(`Failed to start server: ${err.message}`);
      });

      serverProcess.on("exit", (code, signal) => {
        console.log(`Server exited with code ${code}, signal ${signal}`);
        serverProcess = null;
      });
    });
  }
);

ipcMain.handle("server:stop", async (): Promise<string> => {
  if (!serverProcess) {
    return "No server is running";
  }

  try {
    await killProcess(serverProcess);
    return "Server stopped";
  } catch (err) {
    return `Failed to stop server: ${err}`;
  }
});