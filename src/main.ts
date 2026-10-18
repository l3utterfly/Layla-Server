import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from "electron";
import * as path from "path";
import os from 'os';
import { randomBytes } from "node:crypto";
import { spawn, exec, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
ipcMain.handle("secret:generate-crypto", () => randomBytes(32).toString("hex"));
const isWindows = process.platform === "win32";


function createWindow(): void {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets/icon.png'),
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

ipcMain.on("open-external", (_event, url: string) => {
  shell.openExternal(url);
});

// ── External backend discovery ─────────────────────────────────────────────────
// Probing runs in the main process rather than the renderer on purpose: the
// renderer is a file:// page, so its Origin is "null" and third-party runtimes
// (Ollama in particular) reject that at the CORS layer. Node has no CORS, so a
// probe from here reports what is genuinely reachable.

const PROBE_TIMEOUT_MS = 3_000;

/** Strip any trailing slash / known endpoint path so we can append our own. */
function normaliseBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  base = base.replace(/\/v1\/chat\/completions$/, "");
  base = base.replace(/\/v1$/, "");
  return base;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Check whether an OpenAI-compatible server is listening at `baseUrl` and, if
 * so, which models it is serving.
 *
 * Tries the OpenAI route first (llama-server, LM Studio and Ollama all expose
 * `/v1/models`), then falls back to Ollama's native `/api/tags` for older
 * builds that predate the compatibility layer.
 */
ipcMain.handle(
  "backend:probe",
  async (
    _event,
    baseUrl: string,
  ): Promise<{ ok: boolean; models: string[]; error?: string }> => {
    const base = normaliseBaseUrl(baseUrl);
    if (!base) return { ok: false, models: [], error: "No URL provided" };

    let firstError = "";

    try {
      const json = await fetchJson(`${base}/v1/models`);
      const models: string[] = Array.isArray(json?.data)
        ? json.data.map((m: any) => String(m?.id ?? "")).filter(Boolean)
        : [];
      return { ok: true, models };
    } catch (err: any) {
      firstError = err?.message ?? String(err);
    }

    try {
      const json = await fetchJson(`${base}/api/tags`);
      const models: string[] = Array.isArray(json?.models)
        ? json.models.map((m: any) => String(m?.name ?? "")).filter(Boolean)
        : [];
      return { ok: true, models };
    } catch {
      /* fall through and report the OpenAI-route failure, which is the useful one */
    }

    return { ok: false, models: [], error: firstError };
  },
);

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
  async (_event, serverPath: string, modelPath: string, visionModelPath: string, additionalArgs: string): Promise<string> => {
    if (serverProcess) {
      return "Server is already running";
    }

    return new Promise((resolve, reject) => {
      if (!serverPath || !modelPath || serverPath.trim() === "" || modelPath.trim() === "") {
        reject("Server path and model path are required");
        return;
      }

      let args = ["--model", modelPath];

      if (visionModelPath && visionModelPath.trim() !== "") {
        args.push("--mmproj", visionModelPath);
      }

      args = args.concat(additionalArgs.split(" ").filter(Boolean));

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
        // Notify the renderer so the UI can reflect that the backend is gone.
        // Uses the same one-way IPC pattern as server:stdout / server:stderr.
        mainWindow?.webContents.send("server:exit", { code, signal });
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

ipcMain.handle('dialog:alert', (_event, title: string, message: string) => {
  return dialog.showMessageBox({
    type: 'info',
    title: title,
    message,
    buttons: ['OK'],
  });
});
