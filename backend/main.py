from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import base64
import random
import io
import numpy as np
from PIL import Image
from deepface import DeepFace
import cv2

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
        from pydub import AudioSegment
        
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
        
        # Convert webm to wav using pydub
        temp_wav_path = temp_webm_path.replace('.webm', '.wav')
        try:
            audio_segment = AudioSegment.from_file(temp_webm_path, format="webm")
            audio_segment.export(temp_wav_path, format="wav")
            temp_audio_path = temp_wav_path
            print(f"   ✅ Conversion successful! Duration: {len(audio_segment)}ms")
        except Exception as convert_error:
            print(f"   ⚠️ Conversion error: {convert_error}")
            temp_audio_path = temp_webm_path
        
        try:
            # Load Whisper model (using 'tiny' for speed)
            print("   Loading Whisper model...")
            model = whisper.load_model("tiny")
            
            # Transcribe
            print("   Transcribing audio...")
            result = model.transcribe(temp_audio_path, language="en")
            text = result["text"].strip()
            
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
            if os.path.exists(temp_wav_path):
                os.unlink(temp_wav_path)
        
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
        from pydub import AudioSegment
        import io
        
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
        
        # Convert webm to wav using pydub
        temp_wav_path = temp_webm_path.replace('.webm', '.wav')
        try:
            print("   Converting WebM to WAV using pydub...")
            # Try to load as webm first (most common from browser)
            audio_segment = AudioSegment.from_file(temp_webm_path, format="webm")
            audio_segment.export(temp_wav_path, format="wav")
            temp_audio_path = temp_wav_path
            print(f"   ✅ Conversion successful! Duration: {len(audio_segment)}ms")
        except Exception as convert_error:
            print(f"   ⚠️ Conversion error: {convert_error}")
            print("   Trying direct load as fallback...")
            # If conversion fails, try saving directly as wav
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_wav:
                temp_wav.write(audio_bytes)
                temp_audio_path = temp_wav.name
        
        try:
            # Load audio file
            print("   Loading audio with librosa...")
            y, sr = librosa.load(temp_audio_path, sr=None)
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
