import React, { useState, useRef, useEffect, useCallback } from "react";
import UserSettingsService, {
  USER_SETTING_DEFAULTS,
  UserSettingKey,
} from "../services/user-settings-service";
import { WelcomeModal } from "../components/WelcomeModal";

// ─── Constants ──────────────────────────────────────────────────────────────────

const C = {
  background: "#1a1a1a",
  text: "#ffffff",
  secondaryText: "#aaaaaa",
  primary: "#47a6ff",
  danger: "#ff6347",
  border: "#333333",
  success: "#34d399",
  warning: "#fbbf24",
  surface: "#282828",
  surfaceHover: "#2e2e2e",
  cardBg: "#252525",
  logBg: "#1a1a1a",
  dimText: "#888888",
  accentGlow: "rgba(71, 166, 255, 0.25)",
  dangerGlow: "rgba(255, 99, 71, 0.25)",
  successGlow: "rgba(52, 211, 153, 0.20)",
};

const LAYLA_SIGNALLING_URL =
  "https://layla-signalling-production.up.railway.app";
const WEBRTC_DATA_CHANNEL_LABEL = "layla-datachannel";
const CHUNK_SIZE = 16_000;
const MAX_SERVER_LOGS_TO_DISPLAY = 500;

// ─── Types ──────────────────────────────────────────────────────────────────────

type LogType = "INFO" | "WARN" | "ERROR" | "RTC" | "SSE" | "SERVER";

interface LaylaServerTransportMessage {
  sessionId: string;
  type: "start" | "chunk" | "end";
  payload: string;
}

interface LogEntry {
  ts: string;
  type: LogType;
  msg: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const generateTimestamp = (offsetMs = 0): string => {
  const d = new Date(Date.now() - offsetMs);
  return d.toLocaleTimeString("en-GB", { hour12: false });
};

function wrapMessages(
  sessionId: string,
  fullPayload: string,
): LaylaServerTransportMessage[] {
  const messages: LaylaServerTransportMessage[] = [
    { sessionId, type: "start", payload: "" },
  ];
  for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
    messages.push({
      sessionId,
      type: "chunk",
      payload: fullPayload.slice(i, i + CHUNK_SIZE),
    });
  }
  messages.push({ sessionId, type: "end", payload: "" });
  return messages;
}

function getFilenameFromPath(path: string): string {
  let filename = path.split("/").pop();
  filename = (filename ?? path).split("\\").pop();
  if (!filename) return path;
  filename = filename.split(".").slice(0, -1).join(".");
  return filename;
}

function extractTags(name: string): string[] {
  const tags = new Set<string>();
  const sizeMatch = name.match(/(?:^|[\W_])(\d+(?:\.\d+)?[Bb])(?:[\W_]|$)/);
  if (sizeMatch?.[1]) tags.add(sizeMatch[1].toUpperCase());
  const quantMatch = name.match(/(Q\d[A-Z0-9_]*)/i);
  if (quantMatch?.[1]) tags.add(quantMatch[1].toUpperCase());
  return Array.from(tags);
}

// ─── QR Code Generation (pure JS, no dependencies) ─────────────────────────────
// Minimal QR encoder — uses the same qrcodegen algorithm approach.
// For production, install `qrcode` from npm. Here we use dynamic import fallback.

const QrCodeSvg: React.FC<{ text: string; size?: number }> = ({
  text,
  size = 200,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Use the 'qrcode' npm package: npm install qrcode @types/qrcode
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    import("qrcode").then((QRCode) => {
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, text, {
          width: size,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
      }
    });
  }, [text, size]);

  return <canvas ref={canvasRef} style={{ borderRadius: 8 }} />;
};

// ─── Subcomponents ──────────────────────────────────────────────────────────────

const StatusDot: React.FC<{ running: boolean }> = ({ running }) => {
  const colour = running ? C.success : C.danger;
  return (
    <div className="status-dot-wrapper">
      {running && (
        <div className="status-dot-pulse" style={{ backgroundColor: colour }} />
      )}
      <div className="status-dot" style={{ backgroundColor: colour }} />
    </div>
  );
};

const Header: React.FC<{
  running: boolean;
  status: string;
  onSettings: () => void;
}> = ({ running, status, onSettings }) => (
  <div className="header">
    <div className="header-left">
      <StatusDot running={running} />
      <div style={{ marginLeft: 10 }}>
        <div className="header-title">Layla Server</div>
        <div
          className="header-sub"
          style={{ color: running ? C.success : C.danger }}
        >
          {running ? "Online" : "Offline"}
          {status ? ` · ${status}` : ""}
        </div>
      </div>
    </div>
    <button className="settings-btn" onClick={onSettings} aria-label="Settings">
      ⚙
    </button>
  </div>
);

const PowerButton: React.FC<{ running: boolean; onToggle: () => void }> = ({
  running,
  onToggle,
}) => {
  const [pressed, setPressed] = useState(false);

  return (
    <div className={`power-outer ${pressed ? "power-pressed" : ""}`}>
      <div className={`power-glow ${running ? "power-glow-active" : ""}`} />
      <button
        className={`power-btn ${running ? "power-btn-running" : ""}`}
        onClick={onToggle}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        aria-label={running ? "Stop server" : "Start server"}
      >
        <span
          className="power-icon"
          style={{ color: running ? C.primary : C.dimText }}
        >
          ⏻
        </span>
        <span
          className="power-label"
          style={{ color: running ? C.primary : C.secondaryText }}
        >
          {running ? "STOP SERVER" : "START SERVER"}
        </span>
      </button>
    </div>
  );
};

const Chip: React.FC<{ label: string }> = ({ label }) => (
  <span className="chip">{label}</span>
);

const ModelCard: React.FC<{
  name: string;
  path: string;
  tags: string[];
}> = ({ name, path, tags }) => (
  <div className="card">
    <div className="card-header">
      <span className="section-label">ACTIVE MODEL</span>
    </div>
    <div className="card-body">
      <div className="model-image-container">
        <img src="./images/model.png" alt={name} className="model-image" />
      </div>
      <div className="model-info">
        <div className="model-name">{name}</div>
        <div className="model-desc">{path}</div>
        <div className="chip-row">
          {tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const LogViewer: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
  }, [logs, expanded]);

  const levelColor = (l: LogType) => {
    switch (l) {
      case "ERROR":
        return C.danger;
      case "WARN":
        return C.warning;
      default:
        return C.dimText;
    }
  };

  return (
    <div className="log-container">
      <button className="log-header" onClick={toggle}>
        <span className="section-label">SERVER LOGS</span>
        <div className="log-header-right">
          <span className="log-count-badge">{logs.length}</span>
          <span className={`chevron ${expanded ? "chevron-open" : ""}`}>▼</span>
        </div>
      </button>

      {expanded && (
        <div className="log-scroll" ref={scrollRef}>
          {logs.map((entry, i) => (
            <div key={`${entry.ts}-${i}`} className="log-row">
              <span className="log-ts">{entry.ts}</span>
              <span
                className="log-level"
                style={{ color: levelColor(entry.type) }}
              >
                {entry.type.padEnd(5)}
              </span>
              <span className="log-msg">{entry.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── QR Modal ───────────────────────────────────────────────────────────────────

const QrModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  deepLink: string;
  serverSecret: string;
}> = ({ visible, onClose, deepLink, serverSecret }) => {
  if (!visible) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <QrCodeSvg text={deepLink} size={220} />
        <div className="modal-text-group">
          <span className="modal-label">Your Server Secret</span>
          <span className="modal-secret">{serverSecret}</span>
          <span className="modal-hint">
            Scan the QR code with Layla to connect.
          </span>
        </div>
        <button className="modal-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

const LlmServerPanel: React.FC<{
  goToSettings: () => void;
  settingsRefreshCounter: number; // used to trigger settings reload when coming back from settings page
}> = ({ goToSettings, settingsRefreshCounter }) => {
  // ── State ──
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      type: "INFO",
      ts: generateTimestamp(),
      msg: 'Welcome to Layla Server! Click "START SERVER" to launch your local LLM server.',
    },
  ]);
  const serverTransitioningRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const runningRef = useRef(running);

  // ── Settings refs ──
  const modelPathRef = useRef<string | null>(null);
  const visionModelPathRef = useRef<string | null>(null);
  const additionalArgsRef = useRef<string | null>(null);
  const localServerPathRef = useRef<string | null>(null);
  const localServerUrlRef = useRef<string | null>(null);
  const [serverSecret, setServerSecret] = useState("");
  const serverSecretRef = useRef("");

  // ── WebRTC refs ──
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const lastAnswerRef = useRef<string | null>(null);
  const creatingRtcOfferGuardRef = useRef(false); // to prevent concurrent offer creations

  // ── Buffered request ──
  const bufferedRequestRef = useRef("");

  // ── Model info ──
  const [modelName, setModelName] = useState("No model loaded");
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [modelTags, setModelTags] = useState<string[]>([]);

  // ── QR code ──
  const [showQrCode, setShowQrCode] = useState(false);
  const [deepLink, setDeepLink] = useState("");

  // ── Helpers ──

  const addLog = (level: LogType, msg: string) => {
    const ts = generateTimestamp();
    setLogs((prev) => [
      ...prev.slice(-(MAX_SERVER_LOGS_TO_DISPLAY - 1)),
      { ts, type: level, msg },
    ]);
  };

  // ── SSE streaming via browser fetch ──
  const streamToLocalServer = useCallback(async (requestBody: string) => {
    try {
      addLog("SSE", `Streaming request to local server…`);

      const response = await fetch(
        localServerUrlRef.current || USER_SETTING_DEFAULTS[UserSettingKey.LOCAL_SERVER_URL],
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        },
      );

      addLog("SSE", `Stream opened: ${response.status} ${response.statusText}`);

      if (!response.body) {
        addLog("ERROR", "Response body is null");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        addLog("SSE", `Stream chunk:\n${chunkText}`);

        // Forward chunk to peer via data channel
        const sid = sessionIdRef.current ?? "unknown";
        const messages = wrapMessages(sid, chunkText);
        for (const msg of messages) {
          if (
            dataChannelRef.current &&
            dataChannelRef.current.readyState === "open"
          ) {
            try {
              dataChannelRef.current.send(JSON.stringify(msg));
            } catch (e: any) {
              addLog("ERROR", `Failed to send over DataChannel: ${e.message}`);
            }
          }
        }
      }

      addLog("SSE", "Stream completed");
    } catch (e: any) {
      addLog("SSE", `Stream error: ${e.message}`);
    }
  }, []);

  // ── WebRTC (browser native) ──
  const createRtcOffer = async () => {
    if (creatingRtcOfferGuardRef.current) return;
    creatingRtcOfferGuardRef.current = true;

    try {
      // Close existing connection if any
      if (peerConnectionRef.current) {
        addLog("WARN", "Existing RTC peer connection found, closing…");
        try {
          dataChannelRef.current?.close();
          peerConnectionRef.current.close();
        } catch (e: any) {
          addLog("ERROR", `Failed to close existing peer: ${e.message}`);
        }
        peerConnectionRef.current = null;
        dataChannelRef.current = null;
      }

      addLog("RTC", "Creating peer connection…");
      setStatus("Waiting for remote connection...");

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;
      addLog("RTC", "Peer created");

      // Create data channel
      addLog("RTC", `Creating data channel "${WEBRTC_DATA_CHANNEL_LABEL}"…`);
      const dc = pc.createDataChannel(WEBRTC_DATA_CHANNEL_LABEL);
      dataChannelRef.current = dc;
      addLog("RTC", "DataChannel created");

      // DataChannel events
      dc.onopen = () => {
        addLog("RTC", `DataChannel OPEN (${dc.label})`);
        addLog("RTC", "DataChannel connected!");

        setStatus("Device connected, ready to stream requests");
      };

      dc.onclose = () => {
        addLog("RTC", "DataChannel CLOSED");

        // re-create offer if server is still running
        if (runningRef.current) createRtcOffer();
      };

      dc.onmessage = (event) => {
        const data = typeof event.data === "string" ? event.data : "";
        addLog("RTC", `Received: ${data.substring(0, 80)}`);

        if (data.length > 0) {
          try {
            const chunk = JSON.parse(data) as LaylaServerTransportMessage;

            if (chunk.type === "start") {
              bufferedRequestRef.current = "";
              sessionIdRef.current = chunk.sessionId;
            } else if (chunk.type === "chunk") {
              bufferedRequestRef.current += chunk.payload;
            } else if (chunk.type === "end") {
              // Stream the request to local llama.cpp via SSE (fetch streaming)
              streamToLocalServer(bufferedRequestRef.current);
            }
          } catch (e: any) {
            addLog("ERROR", `Failed to handle RTC message: ${e.message}`);
          }
        }
      };

      // ICE candidate logging
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addLog(
            "RTC",
            `ICE candidate gathered: ${event.candidate.candidate.substring(0, 60)}…`,
          );
        }
      };

      // Connection state
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        addLog("RTC", `RTC state → ${state}`);

        if (state === "connected") {
          setStatus("Connected to peer");
        } else if (state === "failed" || state === "disconnected") {
          if (runningRef.current) createRtcOffer();
        }
      };

      pc.oniceconnectionstatechange = () => {
        addLog("RTC", `ICE connection state → ${pc.iceConnectionState}`);
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          }
        };
        // Timeout safety net — 10s
        setTimeout(resolve, 10_000);
      });

      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) {
        addLog("ERROR", "Failed to create RTC offer: SDP is null");
        return;
      }

      addLog("RTC", `Local description ready (type: offer)\n\n${localSdp}`);

      // start polling for answer
      let answerReceived = false;
      do {
        const response = await fetch(`${LAYLA_SIGNALLING_URL}/rtc/get-answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: serverSecretRef.current,
            offer: localSdp,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          addLog(
            "INFO",
            `No answer yet; status: ${response.status}, response: ${text}`,
          );

          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const data = await response.json();

        if (data.secret !== serverSecretRef.current) {
          addLog(
            "WARN",
            `RTC answer secret mismatch: ${data.secret}, IGNORING`,
          );

          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        const payload = data.payload as string | undefined;
        if (!payload) {
          addLog("WARN", "RTC answer with empty payload, IGNORING");

          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        if (!peerConnectionRef.current) {
          addLog("WARN", "RTC answer but no peer connection, IGNORING");

          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        if (lastAnswerRef.current === payload) {
          addLog("INFO", "Duplicate RTC answer, IGNORING");

          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: payload }),
        );
        addLog("RTC", "Remote answer received:\n\n" + payload);
        lastAnswerRef.current = payload;
        answerReceived = true;
      } while (!answerReceived && runningRef.current);
    } catch (e: any) {
      addLog("ERROR", e.message);
    } finally {
      creatingRtcOfferGuardRef.current = false;
    }
  };

  // ── Server lifecycle ──

  const shutdownServer = async () => {
    addLog("INFO", "Shutting down llama.cpp server…");

    try {
      dataChannelRef.current?.close();
      peerConnectionRef.current?.close();
    } catch {
      /* ignore */
    }
    peerConnectionRef.current = null;
    dataChannelRef.current = null;

    // it is important to update the running state immediately to avoid async function calls trying to use the old RTC connection after we've initiated shutdown
    runningRef.current = false;

    await window.electronBridge.stopServer();
  };

  const startServer = async () => {
    if (modelPathRef.current && localServerPathRef.current) {
      setStatus("Starting llama.cpp server...");
      addLog("INFO", "Starting llama.cpp server…");

      await window.electronBridge.startServer(
        localServerPathRef.current,
        modelPathRef.current,
        visionModelPathRef.current || "",
        additionalArgsRef.current || "",
      );
    } else {
      addLog(
        "WARN",
        "Model or server path is not set. Skipping LLM server start (assume another server is running).",
      );
    }

    runningRef.current = true;
  };

  const handleToggle = async () => {
    if (serverTransitioningRef.current) return;
    serverTransitioningRef.current = true;

    // start llm server
    try {
      if (running) {
        await shutdownServer();
      } else {
        await startServer();

        setTimeout(() => {
          setShowQrCode(true);
        }, 1000);
      }
    } catch (err: any) {
      addLog(
        "ERROR",
        `Failed to ${running ? "stop" : "start"} server: ${err.message}`,
      );
    } finally {
      serverTransitioningRef.current = false;
      setStatus("");
    }

    // start polling for RTC connections
    createRtcOffer();
  };

  // ── Load settings ──

  const loadSettings = async () => {
    const computerName = await window.electronBridge.getDeviceName();

    const settings = await UserSettingsService.getMultipleSettings([
      UserSettingKey.MODEL_PATH,
      UserSettingKey.ADDITIONAL_SERVER_CMD_ARGS,
      UserSettingKey.LOCAL_SERVER_PATH,
      UserSettingKey.SERVER_SECRET_KEY,
      UserSettingKey.VISION_MODEL_PATH,
      UserSettingKey.LOCAL_SERVER_URL,
    ]);

    const mp = settings[UserSettingKey.MODEL_PATH];
    const aa = settings[UserSettingKey.ADDITIONAL_SERVER_CMD_ARGS];
    const lsp = settings[UserSettingKey.LOCAL_SERVER_PATH];
    const vmp = settings[UserSettingKey.VISION_MODEL_PATH];
    const ssk = settings[UserSettingKey.SERVER_SECRET_KEY];
    const lsu = settings[UserSettingKey.LOCAL_SERVER_URL];

    setServerSecret(ssk);
    serverSecretRef.current = ssk;
    modelPathRef.current = mp;
    visionModelPathRef.current = vmp;
    additionalArgsRef.current = aa;
    localServerPathRef.current = lsp;
    localServerUrlRef.current = lsu;

    if (!mp) {
      setWelcomeVisible(true);
    } else {
      setModelPath(mp);
      const filename = getFilenameFromPath(mp);
      setModelName(filename);
      setModelTags(extractTags(filename));
    }

    const params = new URLSearchParams({ name: computerName, secret: ssk });
    const dl = `layla://server?${params.toString()}`;
    setDeepLink(dl);
  };

  // ── Effects ──
  useEffect(() => {
    setRunning(runningRef.current);
  }, [runningRef.current]);

  useEffect(() => {
    const removeStdout = window.electronBridge.onServerStdout((data) => {
      addLog("INFO", `[stdout] ${data}`);
    });

    const removeStderr = window.electronBridge.onServerStderr((data) => {
      addLog("INFO", `[stderr] ${data}`);
    });

    return () => {
      removeStdout();
      removeStderr();
    };
  }, []);

  useEffect(() => {
    // this logic skips the initial load when app starts
    if (settingsRefreshCounter > 0) {
      // reload settings (they won't be applied if the server is already running, but will be picked up on restart)
      loadSettings()
        .then(() => {
          window.electronBridge.showAlert(
            "Settings updated",
            "Your changes have been saved. If the server is currently running, please restart it to apply the new settings.",
          );
        })
        .catch((e) => addLog("ERROR", `Failed to load settings: ${e.message}`));
    }
  }, [settingsRefreshCounter]);

  // ── Init ──

  useEffect(() => {
    loadSettings().catch((e) =>
      addLog("ERROR", `Failed to load settings: ${e.message}`),
    );

    return () => {
      try {
        dataChannelRef.current?.close();
        peerConnectionRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ── Render ──

  return (
    <>
      <div className="llm-root">
        <div className="llm-content">
          <Header running={running} status={status} onSettings={goToSettings} />
          <PowerButton running={running} onToggle={handleToggle} />
          <ModelCard name={modelName} path={modelPath || ""} tags={modelTags} />
          <LogViewer logs={logs} />
        </div>
      </div>

      <QrModal
        visible={showQrCode}
        onClose={() => setShowQrCode(false)}
        deepLink={deepLink}
        serverSecret={serverSecret}
      />

      <WelcomeModal
        visible={welcomeVisible}
        onClose={() => {
          setWelcomeVisible(false);
          loadSettings();
        }}
      />

      <style>{cssStyles}</style>
    </>
  );
};

export default LlmServerPanel;

// ─── CSS (injected via <style> tag) ─────────────────────────────────────────────
// Mirrors the original React Native styles as closely as possible.

const cssStyles = `
/* ── Reset & Root ── */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.llm-root {
  flex: 1;
  background-color: ${C.background};
  min-height: 100vh;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: ${C.text};
}

.llm-content {
  padding: 24px;
  padding-bottom: 48px;
  max-width: 800px;
  margin: 0 auto;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}
.header-left {
  display: flex;
  align-items: center;
}
.header-title {
  color: ${C.text};
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.4px;
}
.header-sub {
  font-size: 12px;
  font-weight: 600;
  margin-top: 2px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

/* ── Status Dot ── */
.status-dot-wrapper {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: absolute;
}
.status-dot-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  position: absolute;
  opacity: 0.35;
  animation: dotPulse 1.8s ease-in-out infinite;
}
@keyframes dotPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.6); }
}

/* ── Settings Button ── */
.settings-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: ${C.surface};
  border: 1px solid ${C.border};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  color: ${C.secondaryText};
  transition: background-color 0.15s;
}
.settings-btn:hover {
  background-color: ${C.surfaceHover};
}

/* ── Power Button ── */
.power-outer {
  align-self: center;
  margin: 0 auto 32px;
  position: relative;
  transition: transform 0.15s;
  width: fit-content;
}
.power-outer.power-pressed {
  transform: scale(0.93);
}
.power-glow {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 1px solid ${C.border};
  pointer-events: none;
  transition: box-shadow 0.5s ease-out, border-color 0.5s;
}
.power-glow-active {
  box-shadow: 0 0 32px rgba(71, 166, 255, 0.55);
  border-color: ${C.primary};
}
.power-btn {
  width: 260px;
  height: 120px;
  border-radius: 12px;
  border: 1.5px solid ${C.border};
  background-color: ${C.surface};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.3s;
  position: relative;
}
.power-btn-running {
  border-color: ${C.primary};
}
.power-icon {
  font-size: 38px;
  margin-bottom: 6px;
  line-height: 1;
}
.power-label {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2.5px;
}

/* ── Section Label ── */
.section-label {
  color: ${C.dimText};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.6px;
  text-transform: uppercase;
}

/* ── Model Card ── */
.card {
  background-color: ${C.cardBg};
  border-radius: 12px;
  border: 1px solid ${C.border};
  margin-bottom: 20px;
  overflow: hidden;
}
.card-header {
  padding: 14px 16px 8px;
}
.card-body {
  display: flex;
  padding: 4px 16px 16px;
  align-items: center;
}
.model-image-container {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background-color: ${C.surface};
  margin-right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.model-image {
  width: 56px;
  height: 56px;
}
.model-info {
  flex: 1;
  min-width: 0;
}
.model-name {
  color: ${C.text};
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.model-desc {
  color: ${C.secondaryText};
  font-size: 12.5px;
  line-height: 18px;
  margin-bottom: 10px;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  background-color: ${C.surface};
  border-radius: 6px;
  padding: 3px 8px;
  border: 1px solid ${C.border};
  color: ${C.primary};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

/* ── Log Viewer ── */
.log-container {
  background-color: ${C.cardBg};
  border-radius: 12px;
  border: 1px solid ${C.border};
  overflow: hidden;
}
.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
}
.log-header:hover {
  background-color: ${C.surfaceHover};
}
.log-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.log-count-badge {
  background-color: ${C.surface};
  border-radius: 10px;
  padding: 2px 8px;
  border: 1px solid ${C.border};
  color: ${C.secondaryText};
  font-size: 11px;
  font-weight: 700;
}
.chevron {
  color: ${C.dimText};
  font-size: 12px;
  transition: transform 0.25s;
  display: inline-block;
}
.chevron-open {
  transform: rotate(180deg);
}
.log-scroll {
  max-height: 340px;
  overflow-y: auto;
  background-color: ${C.logBg};
  border-top: 1px solid ${C.border};
  padding: 8px 12px 12px;
}
.log-scroll::-webkit-scrollbar {
  width: 6px;
}
.log-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.log-scroll::-webkit-scrollbar-thumb {
  background: ${C.border};
  border-radius: 3px;
}
.log-row {
  display: flex;
  align-items: flex-start;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid ${C.border};
}
.log-ts {
  color: ${C.dimText};
  font-size: 11px;
  font-family: 'Cascadia Mono', 'Fira Code', 'Consolas', monospace;
  line-height: 16px;
  width: 72px;
  flex-shrink: 0;
  margin-right: 6px;
  user-select: text;
}
.log-level {
  font-size: 11px;
  font-weight: 700;
  font-family: 'Cascadia Mono', 'Fira Code', 'Consolas', monospace;
  line-height: 16px;
  width: 48px;
  flex-shrink: 0;
  margin-right: 6px;
  user-select: text;
}
.log-msg {
  flex: 1;
  color: ${C.secondaryText};
  font-size: 11px;
  font-family: 'Cascadia Mono', 'Fira Code', 'Consolas', monospace;
  line-height: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal-content {
  background-color: ${C.background};
  border: 1px solid ${C.border};
  border-radius: 16px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 360px;
  width: 100%;
}
.modal-text-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 16px;
}
.modal-label {
  color: ${C.text};
  font-size: 14px;
}
.modal-secret {
  color: ${C.text};
  padding: 10px;
  font-size: 20px;
  text-align: center;
  margin-bottom: 10px;
  user-select: text;
  font-family: 'Cascadia Mono', 'Fira Code', monospace;
  letter-spacing: 1px;
}
.modal-hint {
  color: ${C.secondaryText};
  font-size: 13px;
}
.modal-close-btn {
  margin-top: 20px;
  padding: 10px 32px;
  border-radius: 8px;
  border: 1px solid ${C.border};
  background-color: ${C.surface};
  color: ${C.text};
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}
.modal-close-btn:hover {
  background-color: ${C.surfaceHover};
}
`;
