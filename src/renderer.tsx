import React from 'react';
import { createRoot } from 'react-dom/client';
import LlmServerPanel from './screens/LLMServerPanel';
import SettingsPage from './screens/SettingsPage';

function App() {
  const [page, setPage] = React.useState<"main" | "settings">("main");
 
  const goToSettings = () => setPage("settings");
  const goBack = () => setPage("main");
 
  if (page === "settings") {
    return <SettingsPage onBack={goBack} />;
  }
 
  return <LlmServerPanel goToSettings={goToSettings} />;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}