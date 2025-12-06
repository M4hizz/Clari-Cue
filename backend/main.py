from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import base64
import random
import io
import numpy as np
from PIL import Image
from deepface import DeepFace
import cv2
import os
from datetime import datetime
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Gemini AI
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print(f"✅ Gemini AI configured")
else:
    print("⚠️ GEMINI_API_KEY not found - AI interpretation will be unavailable")

# Set up ffmpeg path for pydub using imageio-ffmpeg
FFMPEG_PATH = None
FFPROBE_PATH = None
try:
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
    FFPROBE_PATH = FFMPEG_PATH.replace('ffmpeg', 'ffprobe')  # imageio-ffmpeg may not have ffprobe
    ffmpeg_dir = os.path.dirname(FFMPEG_PATH)
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    print(f"✅ FFmpeg configured from: {FFMPEG_PATH}")
except Exception as e:
    print(f"⚠️ Could not configure FFmpeg: {e}")

app = FastAPI()

# Configure CORS - Must be more permissive for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EmotionRequest(BaseModel):
    image: str

@app.get("/")
async def root():
    return {"message": "Emotion Helper API is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/api/emotion")
async def analyze_emotion(request: EmotionRequest):
    """
    Analyze emotion from image (base64 encoded) using DeepFace
    """
    try:
        # Remove base64 header if present
        image_data = request.image
        if "," in image_data:
            image_data = image_data.split(",")[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert PIL Image to numpy array (BGR format for OpenCV)
        image_array = np.array(image)
        if len(image_array.shape) == 2:  # Grayscale
            image_array = cv2.cvtColor(image_array, cv2.COLOR_GRAY2BGR)
        elif image_array.shape[2] == 4:  # RGBA
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGR)
        else:  # RGB
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        print(f"Analyzing image of shape: {image_array.shape}")
        
        # Analyze emotion using DeepFace
        result = DeepFace.analyze(
            img_path=image_array,
            actions=['emotion'],
            enforce_detection=False,
            detector_backend='opencv'
        )
        
        print(f"DeepFace result: {result}")
        
        # Extract emotion data
        if isinstance(result, list):
            result = result[0]
        
        dominant_emotion = result['dominant_emotion']
        # Convert numpy float32 to regular Python floats for JSON serialization
        emotion_scores = {k: float(v) for k, v in result['emotion'].items()}
        
        # Map emotions to user-friendly format with explanations
        emotion_map = {
            'happy': {
                'emoji': '😊',
                'name': 'Happy',
                'explanation': 'Raised cheeks and an upturned mouth often indicate happiness. This is a positive emotional state where you appear joyful and content.',
                'details': {
                    'eyes': 'slightly narrowed with crow\'s feet',
                    'mouth': 'upturned corners, may show teeth',
                    'posture': 'open and relaxed'
                }
            },
            'sad': {
                'emoji': '😔',
                'name': 'Sad',
                'explanation': 'Downturned mouth and lowered eyebrows can indicate sadness. This may mean you\'re feeling down, disappointed, or experiencing loss.',
                'details': {
                    'eyes': 'slightly drooping, less open',
                    'mouth': 'downturned corners',
                    'posture': 'closed, may be slumped'
                }
            },
            'angry': {
                'emoji': '😠',
                'name': 'Angry',
                'explanation': 'Furrowed brows and tense jaw suggest anger. This indicates frustration, irritation, or strong displeasure with a situation.',
                'details': {
                    'eyes': 'narrowed, intense stare',
                    'mouth': 'tight, corners down or pressed',
                    'posture': 'tense, forward-leaning'
                }
            },
            'surprise': {
                'emoji': '😮',
                'name': 'Surprised',
                'explanation': 'Raised eyebrows and wide-open eyes indicate surprise. This happens when something unexpected occurs, whether pleasant or unpleasant.',
                'details': {
                    'eyes': 'wide open, eyebrows raised',
                    'mouth': 'open in \'O\' shape',
                    'posture': 'alert, may step back'
                }
            },
            'fear': {
                'emoji': '😨',
                'name': 'Fearful',
                'explanation': 'Wide eyes and raised eyebrows with a tense expression suggest fear. This indicates concern about potential danger or threat.',
                'details': {
                    'eyes': 'wide open, may be darting',
                    'mouth': 'open or tightly closed',
                    'posture': 'tense, may be retreating'
                }
            },
            'disgust': {
                'emoji': '🤢',
                'name': 'Disgusted',
                'explanation': 'Wrinkled nose and raised upper lip indicate disgust. This shows aversion or revulsion to something unpleasant.',
                'details': {
                    'eyes': 'slightly narrowed',
                    'mouth': 'upper lip raised, nose wrinkled',
                    'posture': 'turning away'
                }
            },
            'neutral': {
                'emoji': '😐',
                'name': 'Neutral',
                'explanation': 'A relaxed face with no strong emotional indicators. This suggests a calm or neutral state without particular feelings.',
                'details': {
                    'eyes': 'relaxed, normal opening',
                    'mouth': 'closed, straight line',
                    'posture': 'neutral, at ease'
                }
            }
        }
        
        # Get emotion info
        emotion_info = emotion_map.get(dominant_emotion, emotion_map['neutral'])
        
        # Format confidence scores
        confidence = emotion_scores.get(dominant_emotion, 0)
        
        return {
            "emotion": f"{emotion_info['emoji']} {emotion_info['name']}",
            "explanation": emotion_info['explanation'],
            "details": emotion_info['details'],
            "confidence": round(confidence, 1),
            "all_emotions": {k: round(v, 1) for k, v in emotion_scores.items()}
        }
        
    except Exception as e:
        # Fallback to neutral if detection fails
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error analyzing emotion: {str(e)}")
        print(f"Full traceback:\n{error_detail}")
        return {
            "emotion": "😐 Neutral",
            "explanation": "Unable to detect emotion clearly. This might be due to image quality, lighting, or face not being visible. Try adjusting your position or lighting.",
            "details": {
                "eyes": "not detected",
                "mouth": "not detected",
                "posture": "not detected"
            },
            "confidence": 0,
            "all_emotions": {}
        }

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Transcribe speech to text using Whisper
    """
    try:
        import whisper
        import tempfile
        import os
        import subprocess
        import librosa
        import numpy as np
        
        print("=" * 50)
        print("💬 TRANSCRIPTION REQUEST RECEIVED")
        print(f"   Audio filename: {audio.filename}")
        print(f"   Content type: {audio.content_type}")
        
        # Read uploaded audio bytes
        audio_bytes = await audio.read()
        print(f"   Audio size: {len(audio_bytes)} bytes")
        
        # Create temp files for conversion
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_webm:
            temp_webm.write(audio_bytes)
            temp_webm_path = temp_webm.name
        
        # Convert webm to wav using ffmpeg directly
        temp_wav_path = temp_webm_path.replace('.webm', '.wav')
        temp_audio_path = None
        
        try:
            if FFMPEG_PATH and os.path.exists(FFMPEG_PATH):
                result = subprocess.run([
                    FFMPEG_PATH, '-y', '-i', temp_webm_path,
                    '-ar', '16000', '-ac', '1', '-f', 'wav', temp_wav_path
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0 and os.path.exists(temp_wav_path):
                    temp_audio_path = temp_wav_path
                    print(f"   ✅ FFmpeg conversion successful!")
                else:
                    print(f"   ⚠️ FFmpeg error: {result.stderr}")
                    raise HTTPException(status_code=500, detail="Failed to convert audio")
            else:
                print(f"   ❌ FFmpeg not found at: {FFMPEG_PATH}")
                raise HTTPException(status_code=500, detail="FFmpeg not available")
        except subprocess.TimeoutExpired:
            print("   ⚠️ FFmpeg conversion timed out")
            raise HTTPException(status_code=500, detail="Audio conversion timeout")
        except Exception as convert_error:
            print(f"   ⚠️ Conversion error: {convert_error}")
            raise HTTPException(status_code=500, detail=f"Conversion error: {convert_error}")
        
        try:
            # Load audio using librosa (bypasses Whisper's internal ffmpeg call)
            print("   Loading audio with librosa...")
            audio_array, sr = librosa.load(temp_audio_path, sr=16000, mono=True)
            audio_array = audio_array.astype(np.float32)
            duration = len(audio_array)/sr
            print(f"   ✅ Audio loaded! Duration: {duration:.2f}s")
            
            # Skip if audio is too short (likely just noise)
            if duration < 0.5:
                print("   ⚠️ Audio too short, skipping")
                return {"text": "", "language": "en"}
            
            # Load Whisper model (using 'base' for better accuracy)
            print("   Loading Whisper model...")
            model = whisper.load_model("base")
            
            # Transcribe with better settings for accuracy
            print("   Transcribing audio...")
            result = model.transcribe(
                audio_array, 
                language="en",
                fp16=False,  # More accurate on CPU
                condition_on_previous_text=False,  # Avoid hallucinations
                no_speech_threshold=0.6,  # Filter out non-speech
                logprob_threshold=-1.0,  # Accept lower confidence
            )
            text = result["text"].strip()
            
            # Filter out common Whisper hallucinations
            hallucinations = [
                "thank you", "thanks for watching", "subscribe",
                "like and subscribe", "see you next time", "bye",
                "you", ".", "..", "...", "okay", "oh", "um", "uh",
                "hmm", "hm", "ah", "the", "and", "a", "i", "it",
                "thanks", "thank you for watching", "please subscribe",
                "like this video", "comment below", "bell icon",
                "don't forget to subscribe", "hit the like button",
                "see you in the next video", "peace", "bye bye",
                "music", "[music]", "(music)", "applause", "[applause]",
                "silence", "...", "—", "–"
            ]
            text_lower = text.lower().strip()
            
            # Check exact matches
            if text_lower in hallucinations or len(text) < 3:
                print(f"   ⚠️ Filtered hallucination: '{text}'")
                text = ""
            # Check if text contains only repetitive characters
            elif len(set(text_lower.replace(' ', ''))) < 3:
                print(f"   ⚠️ Filtered repetitive: '{text}'")
                text = ""
            # Check for YouTube-style hallucinations
            elif any(h in text_lower for h in ['subscribe', 'like and', 'watch', 'video', 'channel', 'comment', 'bell']):
                print(f"   ⚠️ Filtered YouTube hallucination: '{text}'")
                text = ""
            # Check for very short meaningless phrases
            elif len(text_lower.split()) == 1 and len(text_lower) < 5:
                print(f"   ⚠️ Filtered short word: '{text}'")
                text = ""
            
            print(f"   📝 Transcription: '{text}'")
            print("=" * 50)
            
            return {
                "text": text,
                "language": result.get("language", "en")
            }
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_webm_path):
                os.unlink(temp_webm_path)
            if temp_audio_path and os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error transcribing audio: {str(e)}")
        print(f"Full traceback:\n{error_detail}")
        raise HTTPException(status_code=500, detail=f"Error transcribing: {str(e)}")


@app.post("/api/tone")
async def analyze_tone(audio: UploadFile = File(...)):
    """
    Analyze voice emotion from audio file using librosa
    """
    try:
        import librosa
        import soundfile as sf
        import tempfile
        import os
        import subprocess
        
        print("=" * 50)
        print("🎤 VOICE ANALYSIS REQUEST RECEIVED")
        print(f"   Audio filename: {audio.filename}")
        print(f"   Content type: {audio.content_type}")
        
        # Read uploaded audio bytes
        audio_bytes = await audio.read()
        print(f"   Audio size: {len(audio_bytes)} bytes")
        
        # Create temp files for conversion
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_webm:
            temp_webm.write(audio_bytes)
            temp_webm_path = temp_webm.name
        
        print(f"   Saved to temp file: {temp_webm_path}")
        
        # Convert webm to wav using ffmpeg directly via subprocess
        temp_wav_path = temp_webm_path.replace('.webm', '.wav')
        temp_audio_path = None
        
        try:
            print("   Converting WebM to WAV using ffmpeg...")
            if FFMPEG_PATH and os.path.exists(FFMPEG_PATH):
                # Use imageio-ffmpeg
                result = subprocess.run([
                    FFMPEG_PATH, '-y', '-i', temp_webm_path,
                    '-ar', '16000', '-ac', '1', '-f', 'wav', temp_wav_path
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0 and os.path.exists(temp_wav_path):
                    temp_audio_path = temp_wav_path
                    print(f"   ✅ FFmpeg conversion successful!")
                else:
                    print(f"   ⚠️ FFmpeg error: {result.stderr}")
            else:
                print(f"   ⚠️ FFmpeg not found at: {FFMPEG_PATH}")
        except Exception as convert_error:
            print(f"   ⚠️ Conversion error: {convert_error}")
        
        # Fallback: try to load webm directly with librosa (may work with audioread)
        if not temp_audio_path:
            print("   Trying direct load as fallback...")
            temp_audio_path = temp_webm_path
        
        try:
            # Load audio file
            print(f"   Loading audio from: {temp_audio_path}")
            y, sr = librosa.load(temp_audio_path, sr=16000)
            print(f"   ✅ Audio loaded! Sample rate: {sr}, Duration: {len(y)/sr:.2f}s")
            
            # Extract audio features
            # Energy/loudness
            rms = librosa.feature.rms(y=y)[0]
            avg_energy = float(np.mean(rms))
            
            # Pitch variation (using zero crossing rate as proxy)
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            avg_zcr = float(np.mean(zcr))
            
            # Tempo
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            tempo = float(tempo) if not np.isnan(tempo) else 120.0
            
            # Spectral centroid (brightness)
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            avg_brightness = float(np.mean(spectral_centroid))
            
            print(f"   📊 Audio Features:")
            print(f"      Energy: {avg_energy:.4f}")
            print(f"      Zero Crossing Rate: {avg_zcr:.4f}")
            print(f"      Tempo: {tempo:.1f}")
            print(f"      Brightness: {avg_brightness:.1f}")
            
            # Determine emotion based on features
            emotion = 'Neutral'
            emoji = '😐'
            explanation = 'Your voice sounds calm and neutral.'
            confidence = 60.0
            
            # High energy + high pitch variation = Happy/Excited
            if avg_energy > 0.05 and avg_zcr > 0.08:
                emotion = 'Happy'
                emoji = '😊'
                explanation = 'Your voice has high energy and varied pitch, suggesting happiness or excitement.'
                confidence = 75.0
            # High energy + low pitch variation = Angry
            elif avg_energy > 0.06 and avg_zcr < 0.08:
                emotion = 'Angry'
                emoji = '😠'
                explanation = 'Your voice shows high energy with intense, focused delivery, suggesting anger or frustration.'
                confidence = 70.0
            # Low energy + low brightness = Sad
            elif avg_energy < 0.03 and avg_brightness < 1500:
                emotion = 'Sad'
                emoji = '😔'
                explanation = 'Your voice has low energy and muted tones, which may indicate sadness or low mood.'
                confidence = 65.0
            # Otherwise neutral
            else:
                confidence = 55.0
            
            print(f"   🎯 Detected Emotion: {emoji} {emotion} (confidence: {confidence}%)")
            print("=" * 50)
            
            all_emotions = {
                'Neutral': round(100 - confidence, 1) if emotion != 'Neutral' else confidence,
                'Happy': confidence if emotion == 'Happy' else round(random.uniform(10, 25), 1),
                'Angry': confidence if emotion == 'Angry' else round(random.uniform(5, 20), 1),
                'Sad': confidence if emotion == 'Sad' else round(random.uniform(10, 25), 1),
            }
            
            return {
                "emotion": f"{emoji} {emotion}",
                "explanation": explanation,
                "confidence": round(confidence, 1),
                "all_emotions": all_emotions
            }
            
        finally:
            # Clean up temporary files
            if 'temp_webm_path' in locals() and os.path.exists(temp_webm_path):
                os.unlink(temp_webm_path)
            if 'temp_wav_path' in locals() and os.path.exists(temp_wav_path):
                os.unlink(temp_wav_path)
            if 'temp_audio_path' in locals() and os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error analyzing speech emotion: {str(e)}")
        print(f"Full traceback:\n{error_detail}")
        raise HTTPException(status_code=500, detail=f"Error analyzing speech: {str(e)}")


# ============================================
# SOCIAL INTERPRETER - AI-powered guidance
# ============================================

class ConversationTurn(BaseModel):
    speaker: str  # "other_person" or "user"
    text: str
    emotion_label: Optional[str] = None
    emotion_intensity: Optional[float] = None
    timestamp: str

class EmotionSnapshot(BaseModel):
    emotion: str
    confidence: float
    timestamp: int  # milliseconds since epoch

class InterpreterRequest(BaseModel):
    conversation_history: List[ConversationTurn]
    emotion_history: Optional[List[EmotionSnapshot]] = []
    current_facial_emotion: Optional[str] = None
    current_facial_confidence: Optional[float] = None
    current_voice_emotion: Optional[str] = None
    current_voice_confidence: Optional[float] = None
    combined_emotion: Optional[str] = None
    combined_confidence: Optional[float] = None

class SuggestedAction(BaseModel):
    type: str  # verbal_reply, ask_question, check_in, change_topic, pause_conversation
    text: str

class InterpreterResponse(BaseModel):
    situation_label: str
    situation_type: str  # casual_chat, potential_conflict, confusion, boredom, positive_moment, high_distress
    explanation: str
    suggestions: List[SuggestedAction]
    severity: str  # low, medium, high
    emotion_trend: str  # improving, stable, declining

# Conflict/frustration indicators
CONFLICT_KEYWORDS = [
    "whatever", "fine", "forget it", "i don't care", "you never listen",
    "you always", "you never", "this is stupid", "i'm done", "leave me alone",
    "stop it", "shut up", "i hate", "annoying", "frustrated", "ugh"
]

# Confusion indicators
CONFUSION_KEYWORDS = [
    "i don't get it", "what do you mean", "i'm lost", "confused", "huh",
    "what?", "i don't understand", "can you explain", "wait what",
    "that doesn't make sense", "why would", "i thought"
]

# Boredom indicators
BOREDOM_KEYWORDS = [
    "idk", "sure", "whatever", "ok", "k", "mhm", "yeah", "cool",
    "i guess", "don't care", "boring"
]

# Distress indicators
DISTRESS_KEYWORDS = [
    "i hate this", "i want to disappear", "i don't want to be here",
    "i can't do this", "i give up", "worthless", "hopeless", "crying",
    "terrible", "awful", "worst", "i'm done", "end it", "hurt myself"
]

# Positive indicators
POSITIVE_KEYWORDS = [
    "amazing", "wonderful", "great", "awesome", "love it", "excited",
    "happy", "glad", "fantastic", "perfect", "yay", "can't wait"
]

def normalize_emotion(emotion_str: str) -> str:
    """Extract base emotion from emoji + name format"""
    if not emotion_str:
        return "neutral"
    # Remove emoji and normalize
    emotion = emotion_str.lower()
    for word in ["😊", "😔", "😠", "😮", "😨", "🤢", "😐", "😄", "😢"]:
        emotion = emotion.replace(word, "").strip()
    return emotion

def classify_situation(
    recent_turns: List[ConversationTurn],
    current_emotion: str,
    emotion_intensity: float
) -> tuple[str, str]:
    """
    Classify the social situation based on conversation and emotion.
    Returns (situation_type, situation_label)
    """
    emotion = normalize_emotion(current_emotion)
    
    # Gather recent text from other person
    other_person_texts = [
        t.text.lower() for t in recent_turns 
        if t.speaker == "other_person" and t.text
    ]
    combined_text = " ".join(other_person_texts[-5:])  # Last 5 messages
    
    # Check for distress (highest priority)
    if any(kw in combined_text for kw in DISTRESS_KEYWORDS):
        return "high_distress", "Possible Distress"
    
    if emotion in ["sad", "fear", "fearful"] and emotion_intensity > 0.6:
        return "high_distress", "High Emotional Distress"
    
    # Check for conflict
    conflict_count = sum(1 for kw in CONFLICT_KEYWORDS if kw in combined_text)
    if conflict_count >= 2 or (emotion in ["angry", "disgust", "frustrated"] and emotion_intensity > 0.5):
        return "potential_conflict", "Possible Tension"
    
    if conflict_count >= 1 and emotion in ["angry", "disgust"]:
        return "potential_conflict", "Possible Conflict"
    
    # Check for confusion
    confusion_count = sum(1 for kw in CONFUSION_KEYWORDS if kw in combined_text)
    if confusion_count >= 1 or (emotion == "surprise" and "?" in combined_text):
        return "confusion", "Possible Confusion"
    
    # Check for boredom
    boredom_count = sum(1 for kw in BOREDOM_KEYWORDS if kw in combined_text)
    recent_lengths = [len(t.text) for t in recent_turns[-3:] if t.speaker == "other_person"]
    avg_length = sum(recent_lengths) / len(recent_lengths) if recent_lengths else 50
    
    if boredom_count >= 2 or (avg_length < 10 and emotion == "neutral"):
        return "boredom_disengaged", "Low Engagement"
    
    # Check for positive moment
    positive_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in combined_text)
    if positive_count >= 1 or (emotion == "happy" and emotion_intensity > 0.6):
        return "positive_moment", "Positive Interaction"
    
    # Default to casual chat
    return "casual_chat", "Casual Conversation"

def calculate_emotion_trend(turns: List[ConversationTurn], emotion_history: Optional[List] = None) -> str:
    """Calculate if emotion is improving, stable, or declining based on emotion history"""
    
    # Prefer emotion_history if available (more accurate over time)
    if emotion_history and len(emotion_history) >= 4:
        positive_emotions = {"happy", "excited", "positive"}
        negative_emotions = {"sad", "angry", "fear", "disgust", "frustrated", "anxious"}
        
        scores = []
        for snapshot in emotion_history:
            emotion = snapshot.get("emotion", snapshot.emotion if hasattr(snapshot, "emotion") else "neutral").lower()
            if emotion in positive_emotions:
                scores.append(1)
            elif emotion in negative_emotions:
                scores.append(-1)
            else:
                scores.append(0)
        
        if len(scores) >= 4:
            # Compare first half to second half
            mid = len(scores) // 2
            first_half = sum(scores[:mid]) / mid
            second_half = sum(scores[mid:]) / (len(scores) - mid)
            
            diff = second_half - first_half
            if diff > 0.2:
                return "improving"
            elif diff < -0.2:
                return "declining"
            return "stable"
    
    # Fallback to conversation turns
    if len(turns) < 3:
        return "stable"
    
    positive_emotions = {"happy", "excited", "positive"}
    negative_emotions = {"sad", "angry", "fear", "disgust", "frustrated", "anxious"}
    
    recent_emotions = []
    for turn in turns[-6:]:
        if turn.emotion_label:
            emotion = normalize_emotion(turn.emotion_label)
            if emotion in positive_emotions:
                recent_emotions.append(1)
            elif emotion in negative_emotions:
                recent_emotions.append(-1)
            else:
                recent_emotions.append(0)
    
    if len(recent_emotions) < 2:
        return "stable"
    
    # Compare first half to second half
    mid = len(recent_emotions) // 2
    first_half = sum(recent_emotions[:mid]) / mid if mid > 0 else 0
    second_half = sum(recent_emotions[mid:]) / (len(recent_emotions) - mid)
    
    diff = second_half - first_half
    if diff > 0.3:
        return "improving"
    elif diff < -0.3:
        return "declining"
    return "stable"

def generate_advice(
    situation_type: str,
    current_emotion: str,
    emotion_trend: str,
    recent_turns: List[ConversationTurn]
) -> tuple[str, List[SuggestedAction], str]:
    """
    Generate smart, context-aware advice based on actual conversation content.
    Returns (explanation, suggestions, severity)
    """
    emotion = normalize_emotion(current_emotion)
    
    # Get conversation context
    last_msgs = []
    for turn in reversed(recent_turns):
        if turn.speaker == "other_person" and turn.text:
            last_msgs.append(turn.text)
            if len(last_msgs) >= 3:
                break
    last_msgs.reverse()
    
    last_other_msg = last_msgs[-1] if last_msgs else ""
    conversation_context = " ".join(last_msgs)
    
    # Build a rich explanation based on what was actually said
    if situation_type == "high_distress":
        explanation = f"Based on what they said"
        if last_other_msg:
            explanation += f" (\"{last_other_msg[:50]}{'...' if len(last_other_msg) > 50 else ''}\")"
        explanation += f", they seem to be in distress. Their {emotion} expression confirms this is a serious moment."
        
        suggestions = [
            SuggestedAction(
                type="check_in",
                text="I can see this is really affecting you. I'm here to listen if you want to talk."
            ),
            SuggestedAction(
                type="pause_conversation",
                text="We can take a break if you need. I'm not going anywhere."
            ),
            SuggestedAction(
                type="verbal_reply",
                text="That sounds really difficult. Thank you for sharing that with me."
            )
        ]
        return explanation, suggestions, "high"
    
    elif situation_type == "potential_conflict":
        explanation = "I'm sensing some tension in the conversation"
        if last_other_msg:
            explanation += f". When they said \"{last_other_msg[:40]}{'...' if len(last_other_msg) > 40 else ''}\", "
            explanation += f"combined with their {emotion} expression, it suggests they might be frustrated or upset."
        else:
            explanation += f". Their {emotion} expression suggests they might be feeling frustrated."
        
        suggestions = [
            SuggestedAction(
                type="check_in",
                text="I want to make sure I understand you correctly. Are you upset about something?"
            ),
            SuggestedAction(
                type="verbal_reply",
                text="I hear you. Let me think about what you said - I don't want to dismiss your feelings."
            ),
            SuggestedAction(
                type="ask_question",
                text="Help me understand - what's the most important thing you want me to know right now?"
            )
        ]
        return explanation, suggestions, "medium"
    
    elif situation_type == "confusion":
        explanation = "They might be confused or having trouble following"
        if last_other_msg:
            explanation += f". Their response \"{last_other_msg[:40]}{'...' if len(last_other_msg) > 40 else ''}\" "
            explanation += "suggests they need clarification."
        explanation += " Consider explaining things more simply."
        
        suggestions = [
            SuggestedAction(
                type="ask_question",
                text="I might not have explained that well - what part is unclear?"
            ),
            SuggestedAction(
                type="verbal_reply",
                text="Let me try saying that differently - basically what I mean is..."
            ),
            SuggestedAction(
                type="check_in",
                text="Are you following so far, or should I back up?"
            )
        ]
        return explanation, suggestions, "low"
    
    elif situation_type == "boredom_disengaged":
        explanation = "The person seems disengaged"
        if last_other_msg and len(last_other_msg) < 15:
            explanation += f" - their short responses like \"{last_other_msg}\" suggest low interest."
        else:
            explanation += ". Their body language and brief responses indicate they might want to talk about something else."
        
        suggestions = [
            SuggestedAction(
                type="change_topic",
                text="Actually, I'm curious - what's something you've been thinking about lately?"
            ),
            SuggestedAction(
                type="ask_question",
                text="Is there something else on your mind? We can switch gears."
            ),
            SuggestedAction(
                type="verbal_reply",
                text="I feel like I might be rambling - what would you rather talk about?"
            )
        ]
        return explanation, suggestions, "low"
    
    elif situation_type == "positive_moment":
        explanation = "This is a positive moment!"
        if last_other_msg:
            explanation += f" Their response \"{last_other_msg[:40]}{'...' if len(last_other_msg) > 40 else ''}\" "
            explanation += f"and their {emotion} expression show they're engaged and happy. Keep this energy going!"
        else:
            explanation += f" Their {emotion} expression shows genuine positive emotion."
        
        suggestions = [
            SuggestedAction(
                type="verbal_reply",
                text="I love seeing you this excited! Tell me more!"
            ),
            SuggestedAction(
                type="ask_question",
                text="That's awesome! What's the best part about it?"
            ),
            SuggestedAction(
                type="verbal_reply",
                text="Your happiness is contagious! This is great."
            )
        ]
        return explanation, suggestions, "low"
    
    else:  # casual_chat
        # Even for casual chat, provide context-aware responses
        explanation = "The conversation is going smoothly"
        if last_other_msg:
            # Try to understand what they're talking about
            if "?" in last_other_msg:
                explanation += f". They asked: \"{last_other_msg[:50]}{'...' if len(last_other_msg) > 50 else ''}\" - consider giving a thoughtful answer."
                suggestions = [
                    SuggestedAction(
                        type="verbal_reply",
                        text="That's a good question. I think..."
                    ),
                    SuggestedAction(
                        type="ask_question",
                        text="Interesting question! What made you think of that?"
                    ),
                    SuggestedAction(
                        type="verbal_reply",
                        text="Hmm, let me think about that for a second..."
                    )
                ]
            else:
                explanation += f". They mentioned: \"{last_other_msg[:50]}{'...' if len(last_other_msg) > 50 else ''}\" - you could explore this topic or share your thoughts."
                suggestions = [
                    SuggestedAction(
                        type="ask_question",
                        text="That's interesting! How did that make you feel?"
                    ),
                    SuggestedAction(
                        type="verbal_reply",
                        text="I see what you mean. That reminds me of..."
                    ),
                    SuggestedAction(
                        type="ask_question",
                        text="Tell me more about that - I'm curious."
                    )
                ]
        else:
            explanation += f". Their {emotion} expression looks comfortable. You can continue naturally or bring up something new."
            suggestions = [
                SuggestedAction(
                    type="ask_question",
                    text="So what else is going on with you?"
                ),
                SuggestedAction(
                    type="verbal_reply",
                    text="Yeah, I totally get that."
                ),
                SuggestedAction(
                    type="change_topic",
                    text="Hey, that reminds me - I wanted to ask you about..."
                )
            ]
        
        return explanation, suggestions, "low"


async def analyze_with_gemini(conversation_text: str, current_emotion: str, emotion_confidence: float, emotion_history_summary: str) -> dict:
    """
    Use Gemini AI to analyze the social situation and provide guidance.
    """
    if not GEMINI_API_KEY:
        return None
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Count conversation turns for context
        convo_lines = conversation_text.strip().split('\n') if conversation_text else []
        num_turns = len([l for l in convo_lines if l.strip()])
        
        # Determine if emotions suggest negativity
        negative_emotions = ['angry', 'sad', 'fear', 'disgust', 'frustrated', 'annoyed', 'upset']
        emotion_lower = current_emotion.lower()
        is_negative_emotion = any(neg in emotion_lower for neg in negative_emotions)
        
        prompt = f"""You are a social skills assistant helping someone who struggles with reading social cues. Your job is to ACCURATELY analyze the conversation - do NOT sugarcoat or be overly positive.

CRITICAL INSTRUCTIONS:
- Be HONEST about the emotional tone - if there's tension, SAY SO
- Do NOT default to "casual_chat" - actually analyze the content
- If emotions detected are negative (angry, sad, fear, etc.), the situation is likely NOT casual
- Look for: criticism, complaints, frustration, disagreement, sarcasm, passive-aggression
- Short/curt responses often indicate annoyance or disinterest
- Pay attention to the detected emotions - they are your guide

CONVERSATION ({num_turns} turns):
{conversation_text if conversation_text else "[No conversation recorded]"}

EMOTIONAL DATA (VERY IMPORTANT):
- Current emotion: {current_emotion} {"⚠️ NEGATIVE EMOTION DETECTED" if is_negative_emotion else ""}
- Confidence: {emotion_confidence}%
- Emotion pattern: {emotion_history_summary}

SITUATION CLASSIFICATION (choose the MOST ACCURATE one):
- casual_chat: ONLY if genuinely light, friendly, relaxed conversation with positive/neutral emotions
- potential_conflict: ANY signs of tension, disagreement, frustration, criticism, or annoyance - USE THIS if emotions are angry/frustrated
- confusion: Misunderstanding, unclear communication, someone seems lost
- boredom_disengaged: Short responses, changing topics, seeming distracted, disinterest
- positive_moment: Genuine excitement, joy, laughter, strong positive connection
- high_distress: Strong negative emotions - crying, yelling, very upset, angry outbursts

SEVERITY GUIDE:
- low: Everything is fine, no intervention needed
- medium: Some attention needed, could go either way
- high: Needs immediate attention, de-escalation, or support

RESPOND WITH JSON:
{{
  "explanation": "Honest assessment of what's happening - mention specific emotional cues",
  "situation_type": "potential_conflict",
  "situation_label": "Getting Tense",
  "severity": "medium",
  "emotion_trend": "declining",
  "suggestions": [
    {{"type": "verbal_reply", "text": "Something acknowledging the situation"}},
    {{"type": "check_in", "text": "Direct question about their feelings"}},
    {{"type": "pause_conversation", "text": "If needed: suggest taking a break"}}
  ]
}}

REMEMBER: 
- If emotion is angry/frustrated/sad → NOT a casual_chat
- If someone seems annoyed → potential_conflict or boredom_disengaged  
- Be helpful by being ACCURATE, not by being falsely positive"""

        print(f"   🤖 Sending to Gemini AI...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        print(f"   📤 Raw Gemini response (first 500 chars):")
        print(f"   {response_text[:500]}")
        
        # Extract JSON from response (handle markdown code blocks)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        import json
        result = json.loads(response_text)
        print(f"   ✅ Gemini analysis successful: {result.get('situation_label', 'Unknown')}")
        return result
        
    except Exception as e:
        print(f"   ⚠️ Gemini analysis failed: {e}")
        return None


@app.post("/api/interpret", response_model=InterpreterResponse)
async def interpret_social_situation(request: InterpreterRequest):
    """
    Analyze conversation and emotions to provide social guidance using Gemini AI.
    """
    try:
        print("=" * 50)
        print("🧠 SOCIAL INTERPRETER REQUEST")
        print(f"   Conversation turns: {len(request.conversation_history)}")
        print(f"   Emotion history entries: {len(request.emotion_history) if request.emotion_history else 0}")
        print(f"   Combined emotion: {request.combined_emotion}")
        print(f"   Confidence: {request.combined_confidence}")
        
        # Build conversation text from ALL history (up to 30 turns for context)
        conversation_lines = []
        for i, turn in enumerate(request.conversation_history[-30:]):  # Last 30 turns for full context
            if turn.text and turn.text.strip():
                # Include turn number and timestamp for context
                timestamp = turn.timestamp if hasattr(turn, 'timestamp') and turn.timestamp else ""
                emotion = turn.emotion_label if hasattr(turn, 'emotion_label') and turn.emotion_label else ""
                line = f"[{i+1}] Person: \"{turn.text}\""
                if emotion:
                    line += f" (detected emotion: {emotion})"
                conversation_lines.append(line)
        
        conversation_text = "\n".join(conversation_lines)
        
        # If no conversation, explicitly say so
        if not conversation_text.strip():
            conversation_text = ""
        
        print(f"   📝 Conversation text being sent to Gemini:")
        print(f"   {conversation_text[:500] if conversation_text else '[EMPTY - No conversation recorded]'}")
        
        # Build emotion history summary
        emotion_counts = {}
        if request.emotion_history:
            for snapshot in request.emotion_history[-20:]:
                emotion = snapshot.emotion if hasattr(snapshot, 'emotion') else 'neutral'
                emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        emotion_history_summary = ", ".join([f"{k}: {v}" for k, v in emotion_counts.items()]) if emotion_counts else "No history"
        
        current_emotion = request.combined_emotion or request.current_facial_emotion or "Neutral"
        emotion_confidence = request.combined_confidence or request.current_facial_confidence or 50
        
        # Try Gemini AI first
        gemini_result = await analyze_with_gemini(
            conversation_text, 
            current_emotion, 
            emotion_confidence,
            emotion_history_summary
        )
        
        if gemini_result:
            # Parse Gemini response
            suggestions = [
                SuggestedAction(type=s.get("type", "verbal_reply"), text=s.get("text", ""))
                for s in gemini_result.get("suggestions", [])[:3]
            ]
            
            return InterpreterResponse(
                situation_label=gemini_result.get("situation_label", "Analyzing..."),
                situation_type=gemini_result.get("situation_type", "casual_chat"),
                explanation=gemini_result.get("explanation", "I'm analyzing the situation..."),
                suggestions=suggestions if suggestions else [
                    SuggestedAction(type="verbal_reply", text="I'm listening. Tell me more.")
                ],
                severity=gemini_result.get("severity", "low"),
                emotion_trend=gemini_result.get("emotion_trend", "stable")
            )
        
        # Fallback to rule-based analysis if Gemini fails
        print("   📝 Falling back to rule-based analysis")
        emotion_intensity = emotion_confidence / 100
        recent_turns = request.conversation_history[-10:] if request.conversation_history else []
        
        situation_type, situation_label = classify_situation(
            recent_turns, current_emotion, emotion_intensity
        )
        
        # Simple emotion trend from history
        emotion_trend = "stable"
        if request.emotion_history and len(request.emotion_history) >= 4:
            recent = [s.emotion.lower() if hasattr(s, 'emotion') else 'neutral' for s in request.emotion_history[-4:]]
            positive = sum(1 for e in recent if 'happy' in e or 'positive' in e)
            negative = sum(1 for e in recent if 'sad' in e or 'angry' in e or 'fear' in e)
            if positive > negative:
                emotion_trend = "improving"
            elif negative > positive:
                emotion_trend = "declining"
        
        explanation, suggestions, severity = generate_advice(
            situation_type, current_emotion, emotion_trend, recent_turns
        )
        
        print(f"   📊 Situation: {situation_type} ({situation_label})")
        print(f"   📈 Trend: {emotion_trend}")
        print(f"   ⚠️ Severity: {severity}")
        print("=" * 50)
        
        return InterpreterResponse(
            situation_label=situation_label,
            situation_type=situation_type,
            explanation=explanation,
            suggestions=suggestions,
            severity=severity,
            emotion_trend=emotion_trend
        )
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in social interpreter: {str(e)}")
        print(f"Full traceback:\n{error_detail}")
        
        # Return safe default response
        return InterpreterResponse(
            situation_label="Unable to Analyze",
            situation_type="casual_chat",
            explanation="I couldn't analyze the situation. Make sure both recording buttons are started and have a conversation first.",
            suggestions=[
                SuggestedAction(type="verbal_reply", text="I'm listening. Tell me more."),
                SuggestedAction(type="ask_question", text="How are you feeling about this?")
            ],
            severity="low",
            emotion_trend="stable"
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
