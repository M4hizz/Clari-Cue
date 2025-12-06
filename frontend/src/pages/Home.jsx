import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import Header from "../components/Header";
import LargeButton from "../components/LargeButton";
import "./Home.css";

function Home({ onOpenSettings }) {
  // Emotion Recognition State
  const webcamRef = useRef(null);
  const [emotionPaused, setEmotionPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [emotionData, setEmotionData] = useState({
    emotion: "Neutral",
    explanation: "Waiting for analysis...",
    details: {
      eyes: "relaxed",
      mouth: "neutral",
      posture: "neutral",
    },
    confidence: 0,
    all_emotions: {},
  });

  // Voice Tone State
  const [voicePaused, setVoicePaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [toneData, setToneData] = useState({
    emotion: "Neutral",
    explanation: "Click 'Start Listening' to analyze your voice emotion.",
    confidence: 0,
    all_emotions: {},
  });
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const voiceIntervalRef = useRef(null);

  // Emotion Analysis
  const analyzeEmotion = useCallback(async () => {
    if (emotionPaused || isAnalyzing) return;

    try {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) {
        return;
      }

      setIsAnalyzing(true);
      const response = await fetch("http://localhost:8000/api/emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSrc }),
      });

      if (!response.ok) {
        console.error("Backend error:", response.status);
        setIsAnalyzing(false);
        return;
      }

      const data = await response.json();
      setEmotionData(data);
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Error analyzing emotion:", error);
      setIsAnalyzing(false);
      setEmotionData({
        emotion: "😐 Error",
        explanation:
          "Failed to connect to the backend. Make sure the server is running.",
        details: {
          eyes: "not detected",
          mouth: "not detected",
          posture: "not detected",
        },
      });
    }
  }, [emotionPaused, isAnalyzing]);

  // Voice Analysis - Record and analyze in chunks
  const recordAndAnalyze = useCallback(async () => {
    if (!streamRef.current || voicePaused) return;

    console.log("🎤 Starting voice recording chunk...");

    return new Promise((resolve) => {
      const chunks = [];
      const recorder = new MediaRecorder(streamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: "audio/webm" });
          console.log(`🎤 Recording complete: ${audioBlob.size} bytes`);
          await analyzeVoice(audioBlob);
        }
        resolve();
      };

      recorder.start();

      // Record for 2 seconds
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 2000);
    });
  }, [voicePaused]);

  // Continuous voice analysis effect
  useEffect(() => {
    if (!isListening || voicePaused) {
      if (voiceIntervalRef.current) {
        clearInterval(voiceIntervalRef.current);
        voiceIntervalRef.current = null;
      }
      return;
    }

    console.log("🎙️ Starting continuous voice analysis...");

    // Start immediately
    recordAndAnalyze();

    // Then repeat every 2.5 seconds (2s record + 0.5s gap)
    voiceIntervalRef.current = setInterval(() => {
      recordAndAnalyze();
    }, 2500);

    return () => {
      if (voiceIntervalRef.current) {
        clearInterval(voiceIntervalRef.current);
        voiceIntervalRef.current = null;
      }
    };
  }, [isListening, voicePaused, recordAndAnalyze]);

  const startListening = async () => {
    try {
      console.log("🎤 Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log("✅ Microphone access granted!");

      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      visualize();
      setIsListening(true);
      console.log("🎙️ Voice analysis started!");
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
      console.log(`📤 Sending audio to backend: ${audioBlob.size} bytes`);
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("http://localhost:8000/api/tone", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("❌ Backend error:", response.status);
        return;
      }

      const data = await response.json();
      console.log(`✅ Voice emotion detected: ${data.emotion}`);
      setToneData(data);
    } catch (error) {
      console.error("❌ Error analyzing voice:", error);
      setToneData({
        emotion: "😐 Error",
        explanation:
          "Failed to analyze voice. Make sure the backend is running.",
        confidence: 0,
        all_emotions: {},
      });
    }
  };

  const stopListening = () => {
    console.log("🛑 Stopping voice analysis...");

    // Clear the interval
    if (voiceIntervalRef.current) {
      clearInterval(voiceIntervalRef.current);
      voiceIntervalRef.current = null;
    }

    // Stop the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setAudioLevel(0);
    console.log("✅ Voice analysis stopped");
  };

  // Auto-analyze emotion every 1.5 seconds when not paused
  useEffect(() => {
    if (emotionPaused) return;

    const interval = setInterval(() => {
      analyzeEmotion();
    }, 1500);

    // Initial analysis
    analyzeEmotion();

    return () => clearInterval(interval);
  }, [emotionPaused, analyzeEmotion]);

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
                {isAnalyzing && (
                  <div className="analyzing-indicator">
                    <span className="pulse-dot"></span> Analyzing...
                  </div>
                )}
              </div>
            </div>

            <div className="interpretation-section">
              <div className={`emotion-label ${isAnalyzing ? "updating" : ""}`}>
                <h3>Detected: {emotionData.emotion}</h3>
              </div>

              <div className="emotion-explanation">
                <p>{emotionData.explanation}</p>
              </div>

              {emotionData.confidence > 0 && (
                <div className="confidence-section">
                  <p>
                    <strong>Confidence:</strong>{" "}
                    {emotionData.confidence.toFixed(1)}%
                  </p>
                </div>
              )}

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
                <h3>Detected: {toneData.emotion}</h3>
              </div>

              <div className="tone-explanation">
                <p>{toneData.explanation}</p>
              </div>

              {toneData.confidence > 0 && (
                <div className="confidence-section">
                  <p>
                    <strong>Confidence:</strong>{" "}
                    {toneData.confidence.toFixed(1)}%
                  </p>
                </div>
              )}

              {Object.keys(toneData.all_emotions).length > 0 && (
                <div className="emotion-details">
                  <p>
                    <strong>All Emotions:</strong>
                  </p>
                  {Object.entries(toneData.all_emotions).map(
                    ([emotion, score]) => (
                      <p key={emotion}>
                        {emotion}: {score}%
                      </p>
                    )
                  )}
                </div>
              )}

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
