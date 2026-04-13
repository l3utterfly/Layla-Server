import React, { useState } from "react";

// Adjust these imports to match your project structure
import UserSettingsService, {
  UserSettingKey,
} from "../services/user-settings-service";

interface ModelInfo {
  category: string;
  name: string;
  size: string;
  image: string;
  author: string;
  downloadLink: string;
}

const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    category: "General",
    name: "GPT OSS 20B",
    size: "11.6 GB",
    image: "./images/gpt.jpg",
    author: "OpenAI",
    downloadLink:
      "https://huggingface.co/unsloth/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-Q4_K_M.gguf?download=true",
  },
  {
    category: "Assistant",
    name: "Gemma 4 26B A4B",
    size: "16.9 GB",
    image: "./images/gemma4.png",
    author: "Google",
    downloadLink:
      "https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF/resolve/main/gemma-4-26B-A4B-it-UD-Q4_K_M.gguf?download=true",
  },
  {
    category: "Friend",
    name: "Impish Bloodmoon 12B",
    size: "7.48 GB",
    image: "./images/Impish_Bloodmoon_12B.jpeg",
    author: "SicariusSicariiStuff",
    downloadLink:
      "https://huggingface.co/SicariusSicariiStuff/Impish_Bloodmoon_12B_GGUF/resolve/main/Impish_Bloodmoon-Q4_K_M.gguf?download=true",
  },
  {
    category: "Roleplay",
    name: "Cydonia-24B-v4.3",
    size: "25.1 GB",
    image: "./images/cydonia.png",
    author: "TheDrummer",
    downloadLink:
      "https://huggingface.co/TheDrummer/Cydonia-24B-v4.3-GGUF/resolve/main/Cydonia-24B-v4zg-Q8_0.gguf?download=true",
  },
];

interface WelcomeModalProps {
  visible: boolean;
  onClose: (filePath: string) => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  visible,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleDownload = (url: string) => {
    try {
        window.electronBridge.openExternal(url);
    } catch (error) {
        console.error("Failed to open external link:", error);
    }
  };

  const handlePickFile = async () => {
    const filePath = await window.electronBridge.openFileDialog();
    if (!filePath) return;

    setSelectedFile(filePath);
    console.log("Selected model file:", filePath);

    UserSettingsService.saveSetting(UserSettingKey.MODEL_PATH, filePath).catch(
      (error) => console.error("Failed to save model path:", error),
    );
  };

  const handleInitialize = () => {
    if (selectedFile) {
      onClose(selectedFile);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="wm-overlay">
        <div className="wm-modal-container">
          {/* Header */}
          <div className="wm-header">
            <div className="wm-header-title">SERVER INITIALIZATION</div>
            <div className="wm-header-subtitle">CONFIGURE YOUR LLM ENGINE</div>
          </div>

          <div className="wm-content">
            {/* STEP 1: DOWNLOAD */}
            <div className="wm-step-container">
              <div className="wm-step-header">
                <span className="wm-step-number">01</span>
                <span className="wm-step-title">DOWNLOAD MODEL</span>
              </div>
              <div className="wm-step-description">Recommended GGUFs</div>

              <div className="wm-grid">
                {RECOMMENDED_MODELS.map((model, i) => (
                  <div key={i} className="wm-card">
                    <div className="wm-card-overlay">
                      <div className="wm-card-overlay-top">
                        <img
                          src={model.image}
                          alt={model.name}
                          className="wm-card-img"
                        />
                        <div>
                          <div className="wm-model-category">
                            {model.category}
                          </div>
                          <div className="wm-model-size">By {model.author}</div>
                          <div className="wm-model-size">
                            Size: {model.size}
                          </div>
                        </div>
                      </div>
                      <div className="wm-model-name" title={model.name}>
                        {model.name}
                      </div>
                      <button
                        className="wm-download-btn"
                        onClick={() => handleDownload(model.downloadLink)}
                      >
                        DOWNLOAD
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STEP 2: SELECT */}
            <div className="wm-step-container">
              <div className="wm-step-header">
                <span className="wm-step-number">02</span>
                <span className="wm-step-title">SELECT MODEL</span>
              </div>
              <div className="wm-step-description">
                Locate your downloaded model and select it here.
              </div>

              <button
                className={`wm-file-picker ${selectedFile ? "wm-file-picker-success" : ""}`}
                onClick={handlePickFile}
              >
                <div className="wm-file-picker-inner">
                  <span className="wm-file-picker-icon">
                    {selectedFile ? "✓" : "+"}
                  </span>
                  <span className="wm-file-picker-text">
                    {selectedFile ? "MODEL SELECTED" : "BROWSE LOCAL FILES"}
                  </span>
                  {selectedFile && (
                    <span className="wm-file-path">{selectedFile}</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Footer Action */}
          <div className="wm-footer">
            <button
              className={`wm-initialize-btn ${!selectedFile ? "wm-initialize-btn-disabled" : ""}`}
              onClick={handleInitialize}
              disabled={!selectedFile}
            >
              {selectedFile ? "Start" : "Waiting for model selection..."}
            </button>
          </div>
        </div>
      </div>
      <style>{cssStyles}</style>
    </>
  );
};

const cssStyles = `
:root {
  --wm-primary: #47a6ff;
  --wm-background: #1c1c1c;
  --wm-text: #e0e0e0;
  --wm-secondary-text: #aaaaaa;
  --wm-border: #333333;
  --wm-success: #34d399;
  --wm-warning: #fbbf24;
  --wm-surface: #282828;
  --wm-surface-hover: #2e2e2e;
  --wm-card-bg: #252525;
  --wm-log-bg: #1a1a1a;
  --wm-dim-text: #888888;
  --wm-accent-glow: rgba(71, 166, 255, 0.25);
  --wm-danger-glow: rgba(255, 99, 71, 0.25);
  --wm-success-glow: rgba(52, 211, 153, 0.2);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ── Overlay ── */
.wm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0 40px;
  z-index: 9999;
  animation: wm-fade-in 0.2s ease-out;
}

@keyframes wm-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Modal container ── */
.wm-modal-container {
  width: 600px;
  max-width: 1000px;
  max-height: 90vh;
  background-color: var(--wm-background);
  border: 1px solid var(--wm-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px var(--wm-accent-glow);
}

/* ── Header ── */
.wm-header {
  padding: 24px;
  border-bottom: 1px solid var(--wm-border);
  background-color: var(--wm-log-bg);
  text-align: center;
}

.wm-header-title {
  color: var(--wm-primary);
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 4px;
  text-shadow: 0 0 10px var(--wm-accent-glow);
}

.wm-header-subtitle {
  color: var(--wm-dim-text);
  font-size: 12px;
  letter-spacing: 2px;
  margin-top: 4px;
}

/* ── Scrollable content ── */
.wm-content {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* Hide scrollbar but keep scrollable */
.wm-content::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* ── Step blocks ── */
.wm-step-container {
  margin-bottom: 40px;
}

.wm-step-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
}

.wm-step-number {
  color: var(--wm-background);
  background-color: var(--wm-primary);
  font-size: 16px;
  font-weight: 900;
  padding: 2px 8px;
  margin-right: 12px;
  border-radius: 4px;
}

.wm-step-title {
  color: var(--wm-text);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1.5px;
}

.wm-step-description {
  color: var(--wm-secondary-text);
  font-size: 14px;
  margin-bottom: 16px;
}

/* ── Model grid ── */
.wm-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
}

/* ── Model card ── */
.wm-card {
  width: 48%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--wm-border);
  margin-bottom: 16px;
  box-sizing: border-box;
}

.wm-card-overlay {
  background-color: rgba(28, 28, 28, 0.75);
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  box-sizing: border-box;
}

.wm-card-overlay-top {
  display: flex;
  flex-direction: row;
  gap: 12px;
  margin-bottom: 10px;
}

.wm-card-img {
  width: 80px;
  height: 120px;
  border: 1px solid white;
  object-fit: cover;
  flex-shrink: 0;
}

.wm-model-category {
  color: white;
  font-weight: bold;
  font-size: 12px;
}

.wm-model-name {
  color: var(--wm-text);
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wm-model-size {
  color: var(--wm-dim-text);
  font-size: 12px;
}

/* ── Download button ── */
.wm-download-btn {
  background-color: var(--wm-primary);
  padding: 8px 0;
  border-radius: 4px;
  border: none;
  text-align: center;
  color: var(--wm-background);
  font-weight: bold;
  font-size: 12px;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 0 5px var(--wm-primary);
  transition: opacity 0.15s;
  width: 100%;
}

.wm-download-btn:hover {
  opacity: 0.85;
}

.wm-download-btn:active {
  opacity: 0.7;
}

/* ── File picker ── */
.wm-file-picker {
  border: 2px dashed var(--wm-border);
  background-color: var(--wm-surface);
  border-radius: 8px;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.wm-file-picker:hover {
  border-color: var(--wm-primary);
}

.wm-file-picker:active {
  opacity: 0.7;
}

.wm-file-picker-success {
  border-color: var(--wm-success);
  background-color: var(--wm-success-glow);
  border-style: solid;
}

.wm-file-picker-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wm-file-picker-icon {
  color: var(--wm-primary);
  font-size: 32px;
  font-weight: 300;
  margin-bottom: 8px;
}

.wm-file-picker-text {
  color: var(--wm-text);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
}

.wm-file-path {
  color: var(--wm-success);
  font-size: 12px;
  margin-top: 8px;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ── Footer ── */
.wm-footer {
  padding: 24px;
  border-top: 1px solid var(--wm-border);
  background-color: var(--wm-log-bg);
}

.wm-initialize-btn {
  background-color: var(--wm-success);
  padding: 16px 0;
  border-radius: 6px;
  border: none;
  text-align: center;
  width: 100%;
  color: var(--wm-background);
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
  transition: opacity 0.15s;
}

.wm-initialize-btn:hover:not(.wm-initialize-btn-disabled) {
  opacity: 0.85;
}

.wm-initialize-btn-disabled {
  background-color: var(--wm-surface-hover);
  box-shadow: none;
  cursor: not-allowed;
  color: var(--wm-dim-text);
}
`;
