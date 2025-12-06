import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import Header from "../components/Header";
import LargeButton from "../components/LargeButton";
import "./EmotionRecognition.css";

function EmotionRecognition() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  const [emotionData, setEmotionData] = useState({
    emotion: "Neutral",
    explanation: "Waiting for analysis...",
    details: {
      eyes: "relaxed",
      mouth: "neutral",
      posture: "neutral",
    },
  });

  const analyzeEmotion = useCallback(async () => {
    if (isPaused) return;

    try {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) return;

      const response = await fetch("http://localhost:8000/api/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSrc }),
      });

      const data = await response.json();
      setEmotionData(data);
    } catch (error) {
      console.error("Error analyzing emotion:", error);
    }
  }, [isPaused]);

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="emotion-screen">
      <Header title="Emotion Recognition" />

      <div className="emotion-content">
        <div className="camera-section">
          <div className="camera-feed">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                width: 640,
                height: 480,
                facingMode: "user",
              }}
            />
          </div>
        </div>

        <div className="interpretation-section">
          <div className="emotion-label">
            <h2>Detected Emotion: {emotionData.emotion}</h2>
          </div>

          <div className="emotion-explanation">
            <p>{emotionData.explanation}</p>
          </div>

          <div className="emotion-details">
            <p>
              <strong>Eyes:</strong> {emotionData.details.eyes}
            </p>
            <p>
              <strong>Mouth:</strong> {emotionData.details.mouth}
            </p>
            <p>
              <strong>Posture:</strong> {emotionData.details.posture}
            </p>
          </div>
        </div>
      </div>

      <div className="controls">
        <LargeButton onClick={togglePause} variant="primary">
          {isPaused ? "Resume Analysis" : "Pause Analysis"}
        </LargeButton>
        <LargeButton onClick={() => navigate("/")} variant="settings">
          Back to Home
        </LargeButton>
      </div>
    </div>
  );
}

export default EmotionRecognition;
