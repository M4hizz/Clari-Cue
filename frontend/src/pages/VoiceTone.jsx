import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LargeButton from "../components/LargeButton";
import "./VoiceTone.css";

function VoiceTone() {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [toneData, setToneData] = useState({
    tone: "Neutral",
    volume: "Medium",
    pace: "Normal",
    explanation: "Speak to analyze your voice tone.",
  });
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio visualization
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Start visualization
      visualize();

      // Setup recorder for analysis
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

      // Auto-analyze every 3 seconds
      const interval = setInterval(() => {
        if (!isPaused && mediaRecorderRef.current?.state === "recording") {
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
      // For MVP, send to backend for analysis
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

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div className="voice-screen">
      <Header title="Voice Tone Analysis" />

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
            <h2>Tone: {toneData.tone}</h2>
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
        </div>
      </div>

      <div className="controls">
        {!isListening ? (
          <LargeButton onClick={startListening} variant="primary">
            Start Listening
          </LargeButton>
        ) : (
          <>
            <LargeButton onClick={togglePause} variant="primary">
              {isPaused ? "Resume Analysis" : "Pause Analysis"}
            </LargeButton>
            <LargeButton onClick={stopListening} variant="secondary">
              Stop Listening
            </LargeButton>
          </>
        )}
        <LargeButton onClick={() => navigate("/")} variant="settings">
          Back to Home
        </LargeButton>
      </div>
    </div>
  );
}

export default VoiceTone;
