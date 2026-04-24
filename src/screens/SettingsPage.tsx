import React, { useCallback, useEffect, useRef, useState } from "react";
import UserSettingsService, {
  UserSettingKey,
  USER_SETTING_DEFAULTS,
} from "../services/user-settings-service";

// ─── Theme ──────────────────────────────────────────────────────────────────────
const C = {
  primary: "#47a6ff",
  primaryDim: "rgba(71,166,255,0.12)",
  primaryBorder: "rgba(71,166,255,0.30)",
  bg: "#1c1c1c",
  cardBg: "#222222",
  cardBgHover: "#272727",
  danger: "#ff6347",
  dangerDim: "rgba(255,99,71,0.12)",
  border: "#343434",
  borderLight: "#3e3e3e",
  text: "#e8e8e8",
  secondaryText: "#999999",
  dimText: "#888888",
  inputBg: "#2a2a2a",
  tagBg: "rgba(71,166,255,0.08)",
};

// ─── Setting metadata ───────────────────────────────────────────────────────────
interface SettingMeta {
  key: UserSettingKey;
  label: string;
  description: string;
  type: "text" | "file";
  placeholder?: string;
  tag?: string;
}

const SETTING_SECTIONS: {
  title: string;
  subtitle?: string;
  items: SettingMeta[];
}[] = [
  {
    title: "Server",
    subtitle: "Configure how the app connects to the inference backend",
    items: [
      {
        key: UserSettingKey.LOCAL_SERVER_URL,
        label: "Server URL",
        description: "Full endpoint URL for the local inference server.",
        type: "text",
        placeholder: "http://127.0.0.1:8080/v1/chat/completions",
        tag: "ENDPOINT",
      },
      {
        key: UserSettingKey.LOCAL_SERVER_PATH,
        label: "Server Executable",
        description: "Path to the server binary (e.g. llama-server.exe).",
        type: "file",
        tag: "PATH",
      },
      {
        key: UserSettingKey.ADDITIONAL_SERVER_CMD_ARGS,
        label: "Extra Launch Arguments",
        description:
          "Additional command-line flags passed when starting the server.",
        type: "text",
        placeholder: "--threads 8 --ctx-size 4096",
        tag: "CLI",
      },
      {
        key: UserSettingKey.SERVER_SECRET_KEY,
        label: "Server Secret Key",
        description: "Secret key used to authenticate with the server.",
        type: "text",
        placeholder: "Enter your server secret key",
        tag: "SECRET",
      },
    ],
  },
  {
    title: "Model",
    subtitle: "Select the GGUF model file used for inference",
    items: [
      {
        key: UserSettingKey.MODEL_PATH,
        label: "Model File",
        description: "Path to the GGUF model file on disk.",
        type: "file",
        tag: "GGUF",
      },
      {
        key: UserSettingKey.VISION_MODEL_PATH,
        label: "Vision Model File",
        description: "Path to the vision model file on disk.",
        type: "file",
        tag: "GGUF",
      },
    ],
  },
];

// ─── CSS ────────────────────────────────────────────────────────────────────────
const styles = `
  .sp-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${C.bg};
    color: ${C.text};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
  }

  /* Header */
  .sp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 36px 32px 20px;
    flex-shrink: 0;
  }
  .sp-header-left {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sp-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: ${C.primary};
    font-size: 13px;
    font-weight: 600;
  }
  .sp-back-btn:hover {
    opacity: 0.8;
  }
  .sp-chevron {
    width: 10px;
    height: 16px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  .sp-chevron-bar {
    width: 9px;
    height: 1.5px;
    background: ${C.primary};
    border-radius: 1px;
    position: absolute;
  }
  .sp-chevron-bar-top {
    transform: rotate(-45deg) translateY(-2px);
  }
  .sp-chevron-bar-bottom {
    transform: rotate(45deg) translateY(2px);
  }
  .sp-heading {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin: 0;
    color: ${C.text};
  }
  .sp-heading-sub {
    font-size: 13px;
    color: ${C.dimText};
    margin-top: 4px;
  }
  .sp-header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .sp-divider {
    height: 1px;
    background: ${C.border};
    margin: 0 32px;
    flex-shrink: 0;
  }

  /* Body */
  .sp-body {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px 0;
  }
  .sp-body::-webkit-scrollbar {
    width: 6px;
  }
  .sp-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .sp-body::-webkit-scrollbar-thumb {
    background: ${C.border};
    border-radius: 3px;
  }
  .sp-body::-webkit-scrollbar-thumb:hover {
    background: ${C.borderLight};
  }

  /* Section */
  .sp-section {
    margin-bottom: 28px;
  }
  .sp-section-header {
    margin-bottom: 12px;
  }
  .sp-section-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sp-section-accent {
    width: 3px;
    height: 18px;
    border-radius: 2px;
    background: ${C.primary};
  }
  .sp-section-title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: ${C.text};
  }
  .sp-section-subtitle {
    font-size: 12px;
    color: ${C.dimText};
    margin-top: 4px;
    margin-left: 13px;
  }

  /* Card */
  .sp-card {
    background: ${C.cardBg};
    border-radius: 12px;
    border: 1px solid ${C.border};
    overflow: hidden;
  }
  .sp-card--danger {
    border-color: rgba(255, 99, 71, 0.25);
  }

  /* Setting row */
  .sp-setting-row {
    padding: 18px;
    transition: background 0.15s ease;
  }
  .sp-setting-row--focused {
    background: ${C.cardBgHover};
  }
  .sp-row-divider {
    height: 1px;
    background: ${C.border};
    margin: 0 18px;
  }
  .sp-setting-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .sp-setting-label-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .sp-setting-label {
    font-size: 14px;
    font-weight: 600;
    color: ${C.text};
  }
  .sp-setting-desc {
    font-size: 12px;
    color: ${C.secondaryText};
    margin-bottom: 12px;
    line-height: 17px;
  }

  /* Tag */
  .sp-tag {
    background: ${C.tagBg};
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 9px;
    font-weight: 700;
    color: ${C.primary};
    letter-spacing: 1px;
    user-select: none;
  }

  /* Modified dot */
  .sp-modified-dot {
    width: 6px;
    height: 6px;
    border-radius: 3px;
    background: ${C.primary};
  }

  /* Reset link */
  .sp-reset-text {
    font-size: 11px;
    color: ${C.primary};
    font-weight: 600;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }
  .sp-reset-text:hover {
    opacity: 0.8;
  }

  /* Input */
  .sp-input {
    background: ${C.inputBg};
    border-radius: 8px;
    border: 1px solid ${C.border};
    padding: 10px 14px;
    font-size: 13px;
    color: ${C.text};
    font-family: Consolas, "Courier New", monospace;
    width: 100%;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .sp-input::placeholder {
    color: ${C.dimText};
  }
  .sp-input:focus {
    border-color: ${C.primary};
    background: rgba(71, 166, 255, 0.04);
  }

  /* File row */
  .sp-file-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .sp-file-display {
    background: ${C.inputBg};
    border-radius: 8px;
    border: 1px solid ${C.border};
    padding: 10px 14px;
    font-size: 13px;
    font-family: Consolas, "Courier New", monospace;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-height: 18px;
    display: flex;
    align-items: center;
  }
  .sp-file-display--empty {
    color: ${C.dimText};
  }
  .sp-file-display--filled {
    color: ${C.text};
  }

  /* Button */
  .sp-btn {
    border-radius: 8px;
    padding: 9px 18px;
    border: 1px solid transparent;
    font-size: 13px;
    letter-spacing: 0.2px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s ease, opacity 0.15s ease;
    user-select: none;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .sp-btn:active {
    transform: scale(0.96);
  }
  .sp-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .sp-btn--primary {
    background: ${C.primary};
    color: #000;
    font-weight: 700;
  }
  .sp-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }
  .sp-btn--outline {
    background: transparent;
    border-color: ${C.primaryBorder};
    color: ${C.primary};
    font-weight: 600;
  }
  .sp-btn--outline:hover:not(:disabled) {
    background: ${C.primaryDim};
  }
  .sp-btn--danger {
    background: ${C.danger};
    color: #000;
    font-weight: 700;
  }
  .sp-btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }
  .sp-btn--ghost {
    background: transparent;
    color: ${C.primary};
    font-weight: 600;
  }
  .sp-btn--ghost:hover:not(:disabled) {
    background: ${C.primaryDim};
  }

  /* Danger zone */
  .sp-danger-row {
    display: flex;
    align-items: center;
    padding: 18px;
    gap: 20px;
  }
  .sp-danger-row > div {
    flex: 1;
  }

  /* Toast */
  .sp-toast {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: ${C.primary};
    border-radius: 8px;
    padding: 10px 20px;
    color: #000;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    z-index: 100;
  }

  /* Toast animation */
  @keyframes sp-toast-in {
    0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes sp-toast-out {
    0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(8px); }
  }
  .sp-toast--entering {
    animation: sp-toast-in 0.2s ease forwards;
  }
  .sp-toast--exiting {
    animation: sp-toast-out 0.4s ease forwards;
  }

  /* Loading */
  .sp-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
  @keyframes sp-spin {
    to { transform: rotate(360deg); }
  }
  .sp-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid ${C.border};
    border-top-color: ${C.primary};
    border-radius: 50%;
    animation: sp-spin 0.8s linear infinite;
  }
  .sp-bottom-spacer {
    height: 48px;
  }
`;

// ─── Small UI pieces ────────────────────────────────────────────────────────────
const Tag: React.FC<{ label: string }> = ({ label }) => (
  <span className="sp-tag">{label}</span>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
  <div className="sp-section-header">
    <div className="sp-section-title-row">
      <div className="sp-section-accent" />
      <span className="sp-section-title">{title}</span>
    </div>
    {subtitle && <div className="sp-section-subtitle">{subtitle}</div>}
  </div>
);

const BackChevron: React.FC = () => (
  <span className="sp-chevron">
    <span className="sp-chevron-bar sp-chevron-bar-top" />
    <span className="sp-chevron-bar sp-chevron-bar-bottom" />
  </span>
);

// ─── Button ─────────────────────────────────────────────────────────────────────
interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger" | "ghost";
  disabled?: boolean;
}

const Btn: React.FC<BtnProps> = ({
  label,
  onPress,
  variant = "primary",
  disabled,
}) => (
  <button
    className={`sp-btn sp-btn--${variant}`}
    onClick={onPress}
    disabled={disabled}
  >
    {label}
  </button>
);

// ─── Setting row ────────────────────────────────────────────────────────────────
interface SettingRowProps {
  meta: SettingMeta;
  value: string;
  onChange: (key: UserSettingKey, value: string) => void;
  onClear: (key: UserSettingKey) => void;
}

const SettingRow: React.FC<SettingRowProps> = ({
  meta,
  value,
  onChange,
  onClear,
}) => {
  const [focused, setFocused] = useState(false);
  const defaultValue = USER_SETTING_DEFAULTS[meta.key];
  const isModified = value !== (defaultValue ?? "");

  const pickFile = useCallback(async () => {
    try {
      const filePath = await window.electronBridge.openFileDialog();
      if (!filePath) return;
      onChange(meta.key, filePath);
    } catch {
      // user cancelled or error
    }
  }, [meta.key, onChange]);

  const rowClass = `sp-setting-row${focused ? " sp-setting-row--focused" : ""}`;

  return (
    <div className={rowClass}>
      <div className="sp-setting-label-row">
        <div className="sp-setting-label-group">
          <span className="sp-setting-label">{meta.label}</span>
          {meta.tag && <Tag label={meta.tag} />}
          {isModified && <span className="sp-modified-dot" />}
        </div>
        {isModified && (
          <button className="sp-reset-text" onClick={() => onClear(meta.key)}>
            Reset
          </button>
        )}
      </div>

      <div className="sp-setting-desc">{meta.description}</div>

      {meta.type === "text" ? (
        <input
          className="sp-input"
          value={value}
          onChange={(e) => onChange(meta.key, e.target.value)}
          placeholder={meta.placeholder ?? ""}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      ) : (
        <div className="sp-file-row">
          <input
            className={`sp-file-display ${value ? "sp-file-display--filled" : "sp-file-display--empty"}`}
            value={value}
            onChange={(e) => onChange(meta.key, e.target.value)}
            placeholder={meta.placeholder ?? ""}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Btn label="Browse" onPress={pickFile} variant="outline" />
        </div>
      )}
    </div>
  );
};

// ─── Toast ──────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ message: string }> = ({ message }) => {
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">(
    "entering",
  );

  useEffect(() => {
    const showTimer = setTimeout(() => setPhase("visible"), 200);
    const exitTimer = setTimeout(() => setPhase("exiting"), 2400);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  const animClass =
    phase === "entering"
      ? "sp-toast--entering"
      : phase === "exiting"
        ? "sp-toast--exiting"
        : "";

  return <div className={`sp-toast ${animClass}`}>{message}</div>;
};

// ─── Main page ──────────────────────────────────────────────────────────────────
interface SettingsPageProps {
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const [version, setVersion] = useState<string>("1.0.0");
  const [settings, setSettings] = useState<Record<
    UserSettingKey,
    string
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styleInjected = useRef(false);

  // Inject scoped styles once
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const el = document.createElement("style");
    el.textContent = styles;
    document.head.appendChild(el);
    return () => {
      document.head.removeChild(el);
      styleInjected.current = false;
    };
  }, []);

  // get app version
  useEffect(() => {
    window.electronBridge.getAppVersion().then(setVersion);
  }, []);

  // Load settings on mount
  useEffect(() => {
    (async () => {
      const loaded = await UserSettingsService.getMultipleSettings(
        Object.values(UserSettingKey),
      );
      const mapped: Record<string, string> = {};
      for (const k of Object.values(UserSettingKey)) {
        mapped[k] = (loaded as any)[k] ?? "";
      }
      setSettings(mapped as Record<UserSettingKey, string>);
    })();
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const handleChange = useCallback((key: UserSettingKey, value: string) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }, []);

  const handleClear = useCallback(
    (key: UserSettingKey) => {
      const def = (USER_SETTING_DEFAULTS[key] as string) ?? "";
      handleChange(key, def);
    },
    [handleChange],
  );

  const handleSave = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      for (const k of Object.values(UserSettingKey)) {
        const val = settings[k];
        if (val == null) {
          await UserSettingsService.removeSetting(k);
        } else {
          await UserSettingsService.saveSetting(k, val as any);
        }
      }
      setDirty(false);
      showToast("Settings saved");
    } catch {
      showToast("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [settings, showToast]);

  const handleResetAll = useCallback(() => {
    const defaults: Record<string, string> = {};
    for (const k of Object.values(UserSettingKey)) {
      defaults[k] = (USER_SETTING_DEFAULTS[k] as string) ?? "";
    }
    setSettings(defaults as Record<UserSettingKey, string>);
    setDirty(true);
  }, []);

  // Loading
  if (!settings) {
    return (
      <div className="sp-root">
        <div className="sp-loading">
          <div className="sp-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-left">
          <button className="sp-back-btn" onClick={onBack}>
            <BackChevron />
            Back
          </button>
          <div>
            <h1 className="sp-heading">
              Settings&nbsp;<span style={{ fontSize: 12 }}>(v{version})</span>
            </h1>
            <div className="sp-heading-sub">
              Manage server configuration and model preferences
            </div>
          </div>
        </div>
        <div className="sp-header-actions">
          <Btn label="Reset All" variant="ghost" onPress={handleResetAll} />
          <Btn
            label={saving ? "Saving…" : "Save"}
            variant="primary"
            onPress={handleSave}
            disabled={!dirty || saving}
          />
        </div>
      </div>

      <div className="sp-divider" />

      {/* Body */}
      <div className="sp-body">
        {SETTING_SECTIONS.map((section) => (
          <div key={section.title} className="sp-section">
            <SectionHeader title={section.title} subtitle={section.subtitle} />
            <div className="sp-card">
              {section.items.map((item, idx) => (
                <React.Fragment key={item.key}>
                  {idx > 0 && <div className="sp-row-divider" />}
                  <SettingRow
                    meta={item}
                    value={settings[item.key] ?? ""}
                    onChange={handleChange}
                    onClear={handleClear}
                  />
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}

        {/* Danger zone */}
        <div className="sp-section">
          <SectionHeader title="Danger Zone" />
          <div className="sp-card sp-card--danger">
            <div className="sp-danger-row">
              <div>
                <span className="sp-setting-label">
                  Reset to Factory Defaults
                </span>
                <div className="sp-setting-desc" style={{ marginBottom: 0 }}>
                  Erase all custom settings and restore the original defaults.
                  This cannot be undone.
                </div>
              </div>
              <Btn
                label="Reset Everything"
                variant="danger"
                onPress={handleResetAll}
              />
            </div>
          </div>
        </div>

        <div className="sp-bottom-spacer" />
      </div>

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} />}
    </div>
  );
};

export default SettingsPage;
