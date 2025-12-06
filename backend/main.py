from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import base64
import random

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
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
    Analyze emotion from image (base64 encoded)
    MVP: Returns mock data with realistic variations
    """
    # Mock emotions for MVP - in production, integrate actual CV model
    emotions = [
        {
            "emotion": "😊 Happy",
            "explanation": "Raised cheeks and an upturned mouth often indicate happiness. This is a positive emotional state.",
            "details": {
                "eyes": "slightly narrowed with crow's feet",
                "mouth": "upturned corners, showing teeth",
                "posture": "open and relaxed"
            }
        },
        {
            "emotion": "😐 Neutral",
            "explanation": "A relaxed face with no strong emotional indicators. This suggests a calm or neutral state.",
            "details": {
                "eyes": "relaxed, normal opening",
                "mouth": "closed, straight line",
                "posture": "neutral"
            }
        },
        {
            "emotion": "😔 Sad",
            "explanation": "Downturned mouth and lowered eyebrows can indicate sadness. This may mean someone is feeling down or disappointed.",
            "details": {
                "eyes": "slightly drooping, less open",
                "mouth": "downturned corners",
                "posture": "closed, slumped"
            }
        },
        {
            "emotion": "😮 Surprised",
            "explanation": "Raised eyebrows and wide-open eyes indicate surprise. This happens when something unexpected occurs.",
            "details": {
                "eyes": "wide open, eyebrows raised",
                "mouth": "open in 'O' shape",
                "posture": "tense, alert"
            }
        },
        {
            "emotion": "😰 Anxious",
            "explanation": "Tense facial muscles and worried expression can indicate anxiety. This suggests stress or nervousness.",
            "details": {
                "eyes": "wide, darting movements",
                "mouth": "tight, possibly trembling",
                "posture": "tense, closed"
            }
        }
    ]
    
    # For MVP, return a random emotion (in production, use actual analysis)
    return random.choice(emotions)

@app.post("/api/tone")
async def analyze_tone(audio: UploadFile = File(...)):
    """
    Analyze voice tone from audio file
    MVP: Returns mock data with realistic variations
    """
    # Mock tone analysis for MVP - in production, integrate actual audio analysis
    tones = [
        {
            "tone": "Calm",
            "volume": "Low",
            "pace": "Slow",
            "explanation": "A slow speaking pace with low volume often indicates a calm and relaxed state. The person is speaking deliberately and without urgency."
        },
        {
            "tone": "Neutral",
            "volume": "Medium",
            "pace": "Normal",
            "explanation": "A normal speaking pace and medium volume suggest a neutral emotional state. This is typical conversational speech."
        },
        {
            "tone": "Excited",
            "volume": "High",
            "pace": "Fast",
            "explanation": "A fast speaking pace with high volume can indicate excitement or enthusiasm. The person may be energized or eager."
        },
        {
            "tone": "Stressed",
            "volume": "Medium",
            "pace": "Fast",
            "explanation": "A fast speaking pace can indicate stress or anxiety. When combined with medium volume, it suggests internal tension or nervousness."
        },
        {
            "tone": "Upset",
            "volume": "High",
            "pace": "Normal",
            "explanation": "High volume with a normal pace can indicate frustration or anger. The person may be expressing strong negative emotions."
        }
    ]
    
    # For MVP, return a random tone (in production, use actual analysis)
    return random.choice(tones)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
