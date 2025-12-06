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
    emotion: "😐 Neutral",
    explanation: "Click the play button to start analyzing your voice emotion.",
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

  // Social Interpreter State
  const [interpreterData, setInterpreterData] = useState(null); // null = no analysis yet
  const [isInterpreterLoading, setIsInterpreterLoading] = useState(false);
  const [collectedDataCount, setCollectedDataCount] = useState(0);
  const [emotionReadingsCount, setEmotionReadingsCount] = useState(0);
  const conversationTurnsRef = useRef([]);
  const emotionHistoryRef = useRef([]); // Track emotion changes over time
  const lastProcessedConversationId = useRef(null); // Track which conversation entry we last processed

  // Combined Emotion State (60% face, 40% voice)
  const [combinedEmotion, setCombinedEmotion] = useState({
    emotion: "Neutral",
    emoji: "😐",
    confidence: 0,
    faceWeight: 60,
    voiceWeight: 40,
  });

  // Recording state (controls both face and voice)
  const [isRecording, setIsRecording] = useState(false);
  const [faceAvailable, setFaceAvailable] = useState(true);
  const [voiceAvailable, setVoiceAvailable] = useState(true);

  // Calculate combined emotion whenever face or voice data changes
  useEffect(() => {
    const emotionScores = {
      happy: 0,
      sad: 0,
      angry: 0,
      neutral: 0,
      surprise: 0,
      fear: 0,
      disgust: 0,
    };

    // Extract face emotion (normalize the name)
    const faceEmotionRaw = emotionData.emotion?.toLowerCase() || "neutral";
    const faceEmotion = faceEmotionRaw
      .replace(/[😊😔😠😮😨🤢😐\s]/g, "")
      .toLowerCase();
    const faceConfidence = emotionData.confidence || 0;

    // Extract voice emotion (normalize the name)
    const voiceEmotionRaw = toneData.emotion?.toLowerCase() || "neutral";
    const voiceEmotion = voiceEmotionRaw
      .replace(/[😊😔😠😮😨🤢😐\s]/g, "")
      .toLowerCase();
    const voiceConfidence = toneData.confidence || 0;

    // Map emotions to scores (60% face, 40% voice)
    const faceWeight = 0.6;
    const voiceWeight = 0.4;

    // Add face contribution
    if (faceEmotion && emotionScores.hasOwnProperty(faceEmotion)) {
      emotionScores[faceEmotion] += faceConfidence * faceWeight;
    } else {
      emotionScores.neutral += faceConfidence * faceWeight;
    }

    // Add voice contribution
    if (voiceEmotion && emotionScores.hasOwnProperty(voiceEmotion)) {
      emotionScores[voiceEmotion] += voiceConfidence * voiceWeight;
    } else {
      emotionScores.neutral += voiceConfidence * voiceWeight;
    }

    // Find dominant emotion
    let maxEmotion = "neutral";
    let maxScore = 0;
    for (const [emotion, score] of Object.entries(emotionScores)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion;
      }
    }

    // Emoji mapping
    const emojiMap = {
      happy: "😊",
      sad: "😔",
      angry: "😠",
      neutral: "😐",
      surprise: "😮",
      fear: "😨",
      disgust: "🤢",
    };

    setCombinedEmotion({
      emotion: maxEmotion.charAt(0).toUpperCase() + maxEmotion.slice(1),
      emoji: emojiMap[maxEmotion] || "😐",
      confidence: Math.round(maxScore),
      faceContribution: Math.round(faceConfidence * faceWeight),
      voiceContribution: Math.round(voiceConfidence * voiceWeight),
    });
  }, [emotionData, toneData]);

  // Track conversation turns for interpreter
  useEffect(() => {
    if (conversationHistory.length > 0) {
      const latestEntry = conversationHistory[conversationHistory.length - 1];

      // Only add if this is a new entry we haven't processed yet
      if (latestEntry.id !== lastProcessedConversationId.current) {
        lastProcessedConversationId.current = latestEntry.id;

        // Add as "other_person" since we're tracking what they say
        const newTurn = {
          speaker: "other_person",
          text: latestEntry.text,
          emotion_label: combinedEmotion.emotion,
          emotion_intensity: combinedEmotion.confidence / 100,
          timestamp: latestEntry.timestamp,
        };
        conversationTurnsRef.current = [
          ...conversationTurnsRef.current.slice(-19), // Keep last 19
          newTurn,
        ];
        setCollectedDataCount((prev) => prev + 1);
        console.log("📝 Added conversation turn:", newTurn.text);
      }
    }
  }, [conversationHistory, combinedEmotion]);

  // Track emotion changes over time (every 3 seconds)
  useEffect(() => {
    if (combinedEmotion.confidence > 0) {
      emotionHistoryRef.current = [
        ...emotionHistoryRef.current.slice(-29), // Keep last 30
        {
          emotion: combinedEmotion.emotion,
          confidence: combinedEmotion.confidence,
          timestamp: Date.now(),
        },
      ];
      setEmotionReadingsCount(emotionHistoryRef.current.length);
    }
  }, [combinedEmotion]);

  // Analyze social situation with AI interpreter - called on demand
  const askForHelp = useCallback(async () => {
    console.log("🆘 Ask for Help pressed!");
    console.log(
      "   conversationTurnsRef.current:",
      conversationTurnsRef.current
    );
    console.log(
      "   emotionHistoryRef.current length:",
      emotionHistoryRef.current.length
    );
    console.log("   combinedEmotion:", combinedEmotion);

    // Need at least some data to analyze
    if (
      conversationTurnsRef.current.length === 0 &&
      emotionHistoryRef.current.length === 0 &&
      combinedEmotion.confidence === 0
    ) {
      setInterpreterData({
        situation_label: "Need More Data",
        situation_type: "casual_chat",
        explanation:
          "To help you, I need: 1) Press ▶ on Overall Emotion to start face/voice analysis, 2) Press ▶ on Conversation History to transcribe speech, 3) Have a conversation so I can hear what's being said!",
        suggestions: [
          {
            type: "verbal_reply",
            text: "Start the recording buttons above first!",
          },
        ],
        severity: "low",
        emotion_trend: "stable",
      });
      return;
    }

    // Give a hint if we only have emotion but no conversation
    if (
      conversationTurnsRef.current.length === 0 &&
      emotionHistoryRef.current.length > 0
    ) {
      setInterpreterData({
        situation_label: "Limited Context",
        situation_type: "casual_chat",
        explanation: `I can see ${emotionHistoryRef.current.length} emotion readings (currently ${combinedEmotion.emoji} ${combinedEmotion.emotion}), but I haven't heard any conversation yet. Press ▶ on Conversation History and talk so I can understand what's being discussed!`,
        suggestions: [
          {
            type: "check_in",
            text: "Based on emotions alone: How are you feeling right now?",
          },
          {
            type: "verbal_reply",
            text: "Start the conversation transcription for better guidance!",
          },
        ],
        severity: "low",
        emotion_trend: "stable",
      });
      return;
    }

    setIsInterpreterLoading(true);

    try {
      console.log("📡 Calling /api/interpret with:", {
        conversation_history: conversationTurnsRef.current,
        emotion_history_length: emotionHistoryRef.current.length,
        combined_emotion: `${combinedEmotion.emoji} ${combinedEmotion.emotion}`,
      });

      const response = await fetch("http://localhost:8000/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_history: conversationTurnsRef.current,
          emotion_history: emotionHistoryRef.current,
          current_facial_emotion: emotionData.emotion,
          current_facial_confidence: emotionData.confidence,
          current_voice_emotion: toneData.emotion,
          current_voice_confidence: toneData.confidence,
          combined_emotion: `${combinedEmotion.emoji} ${combinedEmotion.emotion}`,
          combined_confidence: combinedEmotion.confidence,
        }),
      });

      if (!response.ok) {
        console.error("Interpreter backend error:", response.status);
        setIsInterpreterLoading(false);
        return;
      }

      const data = await response.json();
      setInterpreterData(data);
    } catch (error) {
      console.error("Error getting interpretation:", error);
      setInterpreterData({
        situation_label: "Error",
        situation_type: "casual_chat",
        explanation:
          "Failed to connect to the backend. Make sure the server is running.",
        suggestions: [],
        severity: "low",
        emotion_trend: "stable",
      });
    } finally {
      setIsInterpreterLoading(false);
    }
  }, [emotionData, toneData, combinedEmotion]);

  // Clear interpreter data when starting fresh
  const clearInterpreterData = useCallback(() => {
    setInterpreterData(null);
    setCollectedDataCount(0);
    setEmotionReadingsCount(0);
    conversationTurnsRef.current = [];
    emotionHistoryRef.current = [];
    lastProcessedConversationId.current = null;
  }, []);

  // Emotion Analysis
  const analyzeEmotion = useCallback(async () => {
    if (emotionPaused || isAnalyzing || !isRecording) return;

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
        setFaceAvailable(false);
        return;
      }

      const data = await response.json();
      setEmotionData(data);
      // Check if face was detected (confidence > 0 means face detected)
      setFaceAvailable(data.confidence > 0);
      setIsAnalyzing(false);
    } catch (error) {
      console.error("Error analyzing emotion:", error);
      setIsAnalyzing(false);
      setFaceAvailable(false);
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
  }, [emotionPaused, isAnalyzing, isRecording]);

  // Voice Analysis - Record and analyze in chunks
  const recordAndAnalyze = useCallback(async () => {
    console.log(
      `🎤 recordAndAnalyze called: hasStream=${!!streamRef.current}, voicePaused=${voicePaused}`
    );

    if (!streamRef.current || voicePaused) {
      console.log("⚠️ recordAndAnalyze skipped - no stream or paused");
      return;
    }

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
    console.log(
      `🔍 Voice useEffect triggered: isListening=${isListening}, voicePaused=${voicePaused}, hasStream=${!!streamRef.current}`
    );

    if (!isListening || voicePaused) {
      console.log("⏸️ Voice analysis stopped or paused");
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
      console.log("🔄 Voice interval tick");
      recordAndAnalyze();
    }, 600);

    return () => {
      console.log("🧹 Cleaning up voice interval");
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
      console.log(`✅ Voice emotion detected: ${data.emotion}`, data);
      setToneData(data);
      // Check if voice was detected (confidence > 0 means voice detected)
      setVoiceAvailable(data.confidence > 0);
      console.log(`📊 toneData updated to:`, data.emotion);
    } catch (error) {
      console.error("❌ Error analyzing voice:", error);
      setVoiceAvailable(false);
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

    // Clear conversation history
    setConversationHistory([]);
    setCurrentTranscript("");
    // Also clear collected data for interpreter
    conversationTurnsRef.current = [];
    lastProcessedConversationId.current = null;
    setCollectedDataCount(0);

    setIsTranscribing(false);
    console.log("✅ Transcription stopped and history cleared");
  };

  // Start/stop all recording (face + voice)
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setFaceAvailable(true);
    setVoiceAvailable(true);
    if (!isListening) {
      startListening();
    }
    setEmotionPaused(false);
    setVoicePaused(false);
  }, [isListening]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setEmotionPaused(true);
    setVoicePaused(true);
  }, []);

  // Auto-analyze emotion every 0.5 seconds when recording and not paused
  useEffect(() => {
    if (emotionPaused || !isRecording) return;

    const interval = setInterval(() => {
      analyzeEmotion();
    }, 500);

    // Initial analysis
    analyzeEmotion();

    return () => clearInterval(interval);
  }, [emotionPaused, analyzeEmotion, isRecording]);

  // Initialize voice stream on mount (but don't start recording)
  useEffect(() => {
    startListening();
    // Start paused
    setVoicePaused(true);
    setEmotionPaused(true);
  }, []);

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
          {/* AI Social Interpreter - Main Guidance */}
          <div
            className={`interpreter-card interpreter-card-ai ${
              interpreterData?.severity === "high"
                ? "severity-high"
                : interpreterData?.severity === "medium"
                ? "severity-medium"
                : ""
            }`}
          >
            <div className="interpreter-header">
              <h3>🧠 Social Interpreter</h3>
              <div className="interpreter-controls">
                {interpreterData && (
                  <span
                    className={`situation-badge ${interpreterData.situation_type}`}
                  >
                    {interpreterData.situation_label}
                  </span>
                )}
                {interpreterData && (
                  <button
                    className="control-btn clear-btn"
                    onClick={clearInterpreterData}
                    title="Clear & start fresh"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
            <div className="interpreter-content ai-content">
              {/* No analysis yet - show collection state */}
              {!interpreterData && !isInterpreterLoading && (
                <div className="collecting-state">
                  <div className="collecting-info">
                    <span className="collecting-icon">📊</span>
                    <span className="collecting-text">Collecting data...</span>
                  </div>
                  <div className="data-stats">
                    <span className="stat-item">
                      💬 {collectedDataCount} phrases
                    </span>
                    <span className="stat-item">
                      😊 {emotionReadingsCount} emotion readings
                    </span>
                  </div>
                  <button
                    className="ask-help-btn"
                    onClick={askForHelp}
                    disabled={
                      collectedDataCount === 0 &&
                      emotionReadingsCount === 0 &&
                      combinedEmotion.confidence === 0
                    }
                  >
                    🆘 Ask for Help
                  </button>
                  <p className="help-hint">
                    Let me listen to your conversation and watch emotions, then
                    press the button when you need guidance.
                  </p>
                </div>
              )}

              {/* Loading state */}
              {isInterpreterLoading && (
                <div className="loading-state">
                  <span className="loading-spinner">🔄</span>
                  <span className="loading-text">Analyzing situation...</span>
                </div>
              )}

              {/* Analysis results */}
              {interpreterData && !isInterpreterLoading && (
                <>
                  <div className="ai-explanation">
                    <span
                      className={`trend-indicator ${interpreterData.emotion_trend}`}
                    >
                      {interpreterData.emotion_trend === "improving"
                        ? "📈"
                        : interpreterData.emotion_trend === "declining"
                        ? "📉"
                        : "➡️"}
                    </span>
                    <p>{interpreterData.explanation}</p>
                  </div>
                  {interpreterData.suggestions &&
                    interpreterData.suggestions.length > 0 && (
                      <div className="ai-suggestions">
                        <span className="suggestions-label">
                          What you could say:
                        </span>
                        {interpreterData.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            className={`suggestion-btn suggestion-${suggestion.type}`}
                            onClick={() => {
                              navigator.clipboard.writeText(suggestion.text);
                            }}
                            title="Click to copy"
                          >
                            <span className="suggestion-icon">
                              {suggestion.type === "verbal_reply"
                                ? "💬"
                                : suggestion.type === "ask_question"
                                ? "❓"
                                : suggestion.type === "check_in"
                                ? "💚"
                                : suggestion.type === "change_topic"
                                ? "🔄"
                                : suggestion.type === "pause_conversation"
                                ? "⏸️"
                                : "💡"}
                            </span>
                            <span className="suggestion-text">
                              {suggestion.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  <button className="ask-again-btn" onClick={askForHelp}>
                    🔄 Ask Again
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Combined Overall Emotion */}
          <div className="interpreter-card combined-card">
            <div className="interpreter-header">
              <h3>🎯 Overall Emotion</h3>
              <div className="interpreter-controls">
                <span className="weight-badge">60% Face • 40% Voice</span>
                <button
                  className={`control-btn ${isRecording ? "" : "start"}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isRecording ? "⏹" : "▶"}
                </button>
              </div>
            </div>
            <div className="interpreter-content combined-content">
              {!isRecording ? (
                <div className="not-recording-state">
                  <span className="not-recording-icon">⏸️</span>
                  <span className="not-recording-text">
                    Press ▶ to start analyzing
                  </span>
                </div>
              ) : (
                <>
                  <div className="combined-emotion">
                    <span className="combined-emoji">
                      {combinedEmotion.emoji}
                    </span>
                    <div className="combined-details">
                      <span className="combined-name">
                        {combinedEmotion.emotion}
                      </span>
                      {combinedEmotion.confidence > 0 && (
                        <span className="combined-confidence">
                          {combinedEmotion.confidence}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="contribution-bars">
                    <div className="contribution">
                      <span className="contribution-label">😊 Face</span>
                      {faceAvailable ? (
                        <>
                          <div className="contribution-bar">
                            <div
                              className="contribution-fill face-fill"
                              style={{
                                width: `${
                                  combinedEmotion.faceContribution || 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="contribution-value">
                            {combinedEmotion.faceContribution || 0}%
                          </span>
                        </>
                      ) : (
                        <span className="not-available">Not available</span>
                      )}
                    </div>
                    <div className="contribution">
                      <span className="contribution-label">🎤 Voice</span>
                      {voiceAvailable ? (
                        <>
                          <div className="contribution-bar">
                            <div
                              className="contribution-fill voice-fill"
                              style={{
                                width: `${
                                  (combinedEmotion.voiceContribution || 0) * 2.5
                                }%`,
                              }}
                            />
                          </div>
                          <span className="contribution-value">
                            {combinedEmotion.voiceContribution || 0}%
                          </span>
                        </>
                      ) : (
                        <span className="not-available">Not available</span>
                      )}
                    </div>
                  </div>
                </>
              )}
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
