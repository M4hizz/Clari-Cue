import { useState, useEffect } from "react";
import Home from "./pages/Home";
import SettingsModal from "./components/SettingsModal";
import "./App.css";

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    theme: "light",
    textSize: "medium",
    reduceAnimation: false,
    textToSpeech: false,
  });

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("emotionHelperSettings");
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("emotionHelperSettings", JSON.stringify(settings));

    // Apply theme
    document.body.className = `theme-${settings.theme} text-${settings.textSize}`;

    // Apply animation preference
    if (settings.reduceAnimation) {
      document.body.style.setProperty("--transition-speed", "0ms");
    } else {
      document.body.style.setProperty("--transition-speed", "150ms");
    }
  }, [settings]);

  const handleSettingsChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="app">
      <Home onOpenSettings={() => setIsSettingsOpen(true)} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
    </div>
  );
}

export default App;
