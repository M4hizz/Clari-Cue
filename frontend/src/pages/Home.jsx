import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import Header from "../components/Header";
import LargeButton from "../components/LargeButton";
import "./Home.css";

function Home({ onOpenSettings }) {
  // Emotion Recognition State
  const webcamRef = useRef(null);
  const [emotionPaused, setEmotionPaused] = useState(false);
  const [emotionData, setEmotionData] = useState({
    emotion: "Neutral",
    explanation: "Waiting for analysis...",
    details: {
      eyes: "relaxed",
      mouth: "neutral",
      posture: "neutral",
    },
  });

  // Voice Tone State
  const [voicePaused, setVoicePaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [toneData, setToneData] = useState({
    tone: "Neutral",
    volume: "Medium",
    pace: "Normal",
    explanation: "Click 'Start Listening' to analyze your voice tone.",
  });
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Emotion Analysis
  const analyzeEmotion = useCallback(async () => {
    if (emotionPaused) return;

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
  }, [emotionPaused]);

  // Voice Analysis
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      visualize();

      mediaRecorderRef.current = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        await analyzeVoice(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsListening(true);

      const interval = setInterval(() => {
        if (!voicePaused && mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          setTimeout(() => {
            if (mediaRecorderRef.current) {
              mediaRecorderRef.current.start();
            }
          }, 100);
        }
      }, 3000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const visualize = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const update = () => {
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(Math.min(100, (average / 255) * 100));
      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();
  };

  const analyzeVoice = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob);

      const response = await fetch("http://localhost:8000/api/tone", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setToneData(data);
    } catch (error) {
      console.error("Error analyzing voice:", error);
    }
  };

  const stopListening = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div className="home">
      <Header title="Emotion Helper" />

      <div className="home-content">
        {/* Emotion Recognition Section */}
        <div className="analysis-section">
          <h2 className="section-title">Emotion Recognition</h2>
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
                <h3>Detected: {emotionData.emotion}</h3>
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

              <div className="controls">
                <LargeButton
                  onClick={() => setEmotionPaused(!emotionPaused)}
                  variant="primary"
                >
                  {emotionPaused ? "Resume" : "Pause"}
                </LargeButton>
                <LargeButton onClick={analyzeEmotion} variant="secondary">
                  Analyze Now
                </LargeButton>
              </div>
            </div>
          </div>
        </div>

        {/* Voice Tone Section */}
        <div className="analysis-section">
          <h2 className="section-title">Voice Tone Analysis</h2>
          <div className="voice-content">
            <div className="visualizer-section">
              <div className="volume-bar-container">
                <div className="volume-label">Voice Level</div>
                <div className="volume-bar">
                  <div
                    className="volume-fill"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="tone-interpretation">
              <div className="tone-label">
                <h3>Tone: {toneData.tone}</h3>
              </div>

              <div className="tone-metrics">
                <p>
                  <strong>Volume:</strong> {toneData.volume}
                </p>
                <p>
                  <strong>Pace:</strong> {toneData.pace}
                </p>
              </div>

              <div className="tone-explanation">
                <p>{toneData.explanation}</p>
              </div>

              <div className="controls">
                {!isListening ? (
                  <LargeButton onClick={startListening} variant="primary">
                    Start Listening
                  </LargeButton>
                ) : (
                  <>
                    <LargeButton
                      onClick={() => setVoicePaused(!voicePaused)}
                      variant="primary"
                    >
                      {voicePaused ? "Resume" : "Pause"}
                    </LargeButton>
                    <LargeButton onClick={stopListening} variant="secondary">
                      Stop
                    </LargeButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Button */}
        <div className="settings-corner">
          <LargeButton onClick={onOpenSettings} variant="settings">
            Settings
          </LargeButton>
        </div>
      </div>
    </div>
  );
}

export default Home;
