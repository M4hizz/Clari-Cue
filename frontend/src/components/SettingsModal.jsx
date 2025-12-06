import { useEffect } from "react";
import "./SettingsModal.css";

function SettingsModal({ isOpen, onClose, settings, onSettingsChange }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="setting-group">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            value={settings.theme}
            onChange={(e) => onSettingsChange("theme", e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="setting-group">
          <label htmlFor="textSize">Text Size</label>
          <select
            id="textSize"
            value={settings.textSize}
            onChange={(e) => onSettingsChange("textSize", e.target.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div className="setting-group">
          <label htmlFor="reduceAnimation">
            <input
              type="checkbox"
              id="reduceAnimation"
              checked={settings.reduceAnimation}
              onChange={(e) =>
                onSettingsChange("reduceAnimation", e.target.checked)
              }
            />
            Reduce Animation
          </label>
        </div>

        <div className="setting-group">
          <label htmlFor="textToSpeech">
            <input
              type="checkbox"
              id="textToSpeech"
              checked={settings.textToSpeech}
              onChange={(e) =>
                onSettingsChange("textToSpeech", e.target.checked)
              }
            />
            Text-to-Speech
          </label>
        </div>

        <button className="close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default SettingsModal;
