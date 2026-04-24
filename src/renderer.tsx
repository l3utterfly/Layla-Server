import React from "react";
import { createRoot } from "react-dom/client";
import LlmServerPanel from "./screens/LLMServerPanel";
import SettingsPage from "./screens/SettingsPage";

function App() {
  const [showSettings, setShowSettings] = React.useState(false);
  
  // Increment settingsRefreshCounter to trigger a refresh in LlmServerPanel when coming back from settings page
  const [settingsRefreshCounter, setSettingsRefreshCounter] = React.useState(0);

  return (
    <>
      <LlmServerPanel
        goToSettings={() => setShowSettings(true)}
        settingsRefreshCounter={settingsRefreshCounter}
      />
      {showSettings && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
          }}
        >
          <SettingsPage
            onBack={() => {
              setShowSettings(false);
              setSettingsRefreshCounter((prev) => prev + 1);
            }}
          />
        </div>
      )}
    </>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
