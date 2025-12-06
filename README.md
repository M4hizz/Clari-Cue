# Emotion Helper 🌈

A neurodivergent-friendly emotion recognition and voice tone analysis application designed for autistic and neurodivergent users.

## Features

### 🎯 Core Principles

- **Minimize sensory load** - No animations by default, soft colors, clean layout
- **Maximize clarity** - Literal language, clear explanations
- **Explain everything** - Shows WHY an emotion is detected, not just WHAT

### 📱 Four Screens

1. **Home Dashboard** - Simple two-button interface
2. **Emotion Recognition** - Camera-based emotion analysis with clear interpretations
3. **Voice Tone Analysis** - Microphone-based voice analysis
4. **Settings Modal** - Customizable for different sensory needs

### ⚙️ Accessibility Features

- Light/Dark theme toggle
- Adjustable text size (Small/Medium/Large)
- Animation reduction option
- Text-to-speech support (coming soon)
- High contrast, readable fonts (Inter)
- Large, well-spaced buttons

## Tech Stack

**Frontend:**

- React 19+ with Vite
- React Router for navigation
- react-webcam for camera access
- Web Audio API for voice analysis

**Backend:**

- FastAPI (Python)
- CORS-enabled for local development
- Mock emotion/tone analysis (ready for ML integration)

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+

### Frontend Setup

```powershell
cd C:\1Hack\frontend

# Install dependencies
npm install

# Start dev server (runs on http://localhost:5173)
npm run dev
```

### Backend Setup

```powershell
cd C:\1Hack\backend

# Install dependencies
python -m pip install -r requirements.txt

# Start server (runs on http://localhost:8000)
python -m uvicorn main:app --reload --port 8000
```

Or use PowerShell background job:

```powershell
cd C:\1Hack\backend
Start-Job -ScriptBlock { Set-Location C:\1Hack\backend; python -m uvicorn main:app --reload --port 8000 }
```

## Usage

1. Start both backend and frontend servers
2. Open http://localhost:5173 in your browser
3. Click "Settings" to customize your experience (theme, text size, etc.)
4. Choose an analysis mode:
   - **Emotion Recognition** - Allow camera access and see real-time emotion analysis
   - **Voice Tone Analysis** - Allow microphone access and speak to analyze your voice

## API Endpoints

### Backend (http://localhost:8000)

- `GET /` - Root endpoint
- `GET /api/health` - Health check
- `POST /api/emotion` - Analyze emotion from base64 image
  ```json
  {
    "image": "data:image/jpeg;base64,..."
  }
  ```
- `POST /api/tone` - Analyze voice tone from audio file
  ```
  Content-Type: multipart/form-data
  audio: <audio blob>
  ```

## MVP Scope

### ✅ Implemented

- ✅ Home screen with navigation
- ✅ Emotion recognition screen with camera
- ✅ Voice tone analysis screen with microphone
- ✅ Settings modal with customization
- ✅ Routing between pages
- ✅ Theme switching (light/dark)
- ✅ Text size adjustment
- ✅ Backend API with mock analysis
- ✅ Clean, sensory-friendly UI

### 🚧 Future Enhancements

- Real emotion detection using ML (OpenCV, MediaPipe, or cloud APIs)
- Real voice tone analysis (prosody, pitch, speed detection)
- Text-to-speech functionality
- History/logging of analysis results
- Export analysis data
- Additional emotion categories
- Customizable emotion descriptions

## Design Philosophy

This app is built with **neurodivergent users** in mind:

1. **Predictable Layout** - Same structure on every screen
2. **No Surprises** - Smooth transitions, no sudden changes
3. **Literal Communication** - Clear, direct language
4. **One Task At A Time** - Each screen has one primary purpose
5. **Sensory Considerations** - Adjustable to individual needs

## License

MIT

## Credits

Built for autistic and neurodivergent users who want to understand social and emotional cues more clearly.
