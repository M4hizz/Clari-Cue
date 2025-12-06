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

  // Transcription State
  const [transcriptPaused, setTranscriptPaused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const transcriptStreamRef = useRef(null);
  const transcriptIntervalRef = useRef(null);

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

      // Record for 0.5 seconds
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 500);
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

    // Then repeat every 0.6 seconds (0.5s record + 0.1s gap)
    voiceIntervalRef.current = setInterval(() => {
      recordAndAnalyze();
    }, 600);

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

  // Transcription - Record and transcribe in chunks
  const recordAndTranscribe = useCallback(async () => {
    if (!transcriptStreamRef.current || transcriptPaused) return;

    console.log("💬 Starting transcription recording chunk...");

    return new Promise((resolve) => {
      const chunks = [];
      const recorder = new MediaRecorder(transcriptStreamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: "audio/webm" });
          console.log(`💬 Recording complete: ${audioBlob.size} bytes`);
          await transcribeAudio(audioBlob);
        }
        resolve();
      };

      recorder.start();

      // Record for 1.5 seconds for real-time transcription
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 1500);
    });
  }, [transcriptPaused]);

  // Continuous transcription effect
  useEffect(() => {
    if (!isTranscribing || transcriptPaused) {
      if (transcriptIntervalRef.current) {
        clearInterval(transcriptIntervalRef.current);
        transcriptIntervalRef.current = null;
      }
      return;
    }

    console.log("💬 Starting continuous transcription...");

    // Start immediately
    recordAndTranscribe();

    // Then repeat every 1.7 seconds (1.5s record + 0.2s gap)
    transcriptIntervalRef.current = setInterval(() => {
      recordAndTranscribe();
    }, 1700);

    return () => {
      if (transcriptIntervalRef.current) {
        clearInterval(transcriptIntervalRef.current);
        transcriptIntervalRef.current = null;
      }
    };
  }, [isTranscribing, transcriptPaused, recordAndTranscribe]);

  const startTranscribing = async () => {
    try {
      console.log("💬 Requesting microphone access for transcription...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      transcriptStreamRef.current = stream;
      console.log("✅ Microphone access granted for transcription!");

      setIsTranscribing(true);
      console.log("💬 Transcription started!");
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      console.log(
        `📤 Sending audio for transcription: ${audioBlob.size} bytes`
      );
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("http://localhost:8000/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("❌ Backend error:", response.status);
        return;
      }

      const data = await response.json();
      const text = data.text?.trim();

      // Update current transcript (shows what's being said right now)
      setCurrentTranscript(text || "");

      if (text && text.length > 0) {
        console.log(`✅ Transcription: "${text}"`);
        setConversationHistory((prev) => {
          const newEntry = {
            id: Date.now(),
            text: text,
            timestamp: new Date().toLocaleTimeString(),
          };
          // Keep last 20 entries
          const updated = [...prev, newEntry].slice(-20);
          return updated;
        });
      }
    } catch (error) {
      console.error("❌ Error transcribing:", error);
    }
  };

  const stopTranscribing = () => {
    console.log("🛑 Stopping transcription...");

    // Clear the interval
    if (transcriptIntervalRef.current) {
      clearInterval(transcriptIntervalRef.current);
      transcriptIntervalRef.current = null;
    }

    // Stop the stream
    if (transcriptStreamRef.current) {
      transcriptStreamRef.current.getTracks().forEach((track) => track.stop());
      transcriptStreamRef.current = null;
    }

    setIsTranscribing(false);
    console.log("✅ Transcription stopped");
  };

  // Auto-analyze emotion every 0.5 seconds when not paused
  useEffect(() => {
    if (emotionPaused) return;

    const interval = setInterval(() => {
      analyzeEmotion();
    }, 500);

    // Initial analysis
    analyzeEmotion();

    return () => clearInterval(interval);
  }, [emotionPaused, analyzeEmotion]);

  useEffect(() => {
    return () => {
      stopListening();
      stopTranscribing();
    };
  }, []);

  return (
    <div className="home">
      <Header title="Clari-Cue" />

      <div className="home-content">
        {/* Left Side - Camera */}
        <div className="camera-panel">
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
          <div className="camera-controls">
            <LargeButton onClick={onOpenSettings} variant="settings">
              Settings
            </LargeButton>
          </div>
        </div>

        {/* Right Side - Interpreters */}
        <div className="interpreters-panel">
          {/* Face Emotion Interpreter */}
          <div className="interpreter-card">
            <div className="interpreter-header">
              <h3>😊 Facial Expression</h3>
              <div className="interpreter-controls">
                <button
                  className={`control-btn ${emotionPaused ? "paused" : ""}`}
                  onClick={() => setEmotionPaused(!emotionPaused)}
                >
                  {emotionPaused ? "▶" : "⏸"}
                </button>
              </div>
            </div>
            <div className="interpreter-content">
              <div className="emotion-result">
                <span className="emotion-name">{emotionData.emotion}</span>
                {emotionData.confidence > 0 && (
                  <span className="emotion-confidence">
                    {emotionData.confidence.toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="emotion-explanation">{emotionData.explanation}</p>
            </div>
          </div>

          {/* Voice Emotion Interpreter */}
          <div className="interpreter-card">
            <div className="interpreter-header">
              <h3>🎤 Voice Tone</h3>
              <div className="interpreter-controls">
                {!isListening ? (
                  <button
                    className="control-btn start"
                    onClick={startListening}
                  >
                    ▶
                  </button>
                ) : (
                  <>
                    <button
                      className={`control-btn ${voicePaused ? "paused" : ""}`}
                      onClick={() => setVoicePaused(!voicePaused)}
                    >
                      {voicePaused ? "▶" : "⏸"}
                    </button>
                    <button
                      className="control-btn stop"
                      onClick={stopListening}
                    >
                      ⏹
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="interpreter-content">
              <div className="volume-bar">
                <div
                  className="volume-fill"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <div className="emotion-result">
                <span className="emotion-name">{toneData.emotion}</span>
                {toneData.confidence > 0 && (
                  <span className="emotion-confidence">
                    {toneData.confidence.toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="emotion-explanation">{toneData.explanation}</p>
            </div>
          </div>

          {/* Conversation History Interpreter */}
          <div className="interpreter-card">
            <div className="interpreter-header">
              <h3>💬 Conversation History</h3>
              <div className="interpreter-controls">
                {!isTranscribing ? (
                  <button
                    className="control-btn start"
                    onClick={startTranscribing}
                  >
                    ▶
                  </button>
                ) : (
                  <>
                    <button
                      className={`control-btn ${
                        transcriptPaused ? "paused" : ""
                      }`}
                      onClick={() => setTranscriptPaused(!transcriptPaused)}
                    >
                      {transcriptPaused ? "▶" : "⏸"}
                    </button>
                    <button
                      className="control-btn stop"
                      onClick={stopTranscribing}
                    >
                      ⏹
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="interpreter-content conversation-content">
              {/* Current live transcript */}
              {isTranscribing && (
                <div className="live-transcript">
                  <span className="live-indicator">●</span>
                  <span className="live-text">
                    {currentTranscript || "Listening..."}
                  </span>
                </div>
              )}

              {/* Conversation history */}
              {!isTranscribing && conversationHistory.length === 0 ? (
                <p className="placeholder-text">
                  Press ▶ to start conversation tracking
                </p>
              ) : (
                <div className="conversation-list">
                  {conversationHistory.map((entry) => (
                    <div key={entry.id} className="conversation-entry">
                      <span className="conversation-time">
                        {entry.timestamp}
                      </span>
                      <span className="conversation-text">{entry.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
