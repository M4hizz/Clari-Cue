# Quick Start Guide

## Both Servers Are Running! 🎉

### URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## What's Built

### Frontend (React + Vite)

✅ Home screen with 2 main options
✅ Emotion Recognition page (camera-based)
✅ Voice Tone Analysis page (microphone-based)
✅ Settings modal (theme, text size, reduce animation, TTS)
✅ Fully responsive, neurodivergent-friendly UI
✅ Sensory-friendly design (minimal animations, clear spacing)

### Backend (FastAPI)

✅ `/api/emotion` - Emotion analysis endpoint (POST)
✅ `/api/tone` - Voice tone analysis endpoint (POST)
✅ `/api/health` - Health check endpoint
✅ Mock data responses (ready for ML integration)

## How to Use

1. **Open the app**: Visit http://localhost:5173
2. **Try Settings**: Click "Settings" button to customize theme & text size
3. **Test Emotion Recognition**:
   - Click "Start Emotion Recognition"
   - Allow camera access
   - See mock emotion analysis (currently returns random emotions)
4. **Test Voice Analysis**:
   - Click "Start Voice Tone Analysis"
   - Allow microphone access
   - Click "Start Listening" and speak
   - See mock tone analysis

## Managing the Servers

### Frontend (Vite)

Currently running in terminal. To restart:

```powershell
cd C:\1Hack\frontend
npm run dev
```

### Backend (FastAPI)

Running as PowerShell Job1. To manage:

```powershell
# Check status
Get-Job

# View logs
Receive-Job -Id 1 -Keep

# Stop backend
Stop-Job -Id 1; Remove-Job -Id 1

# Restart backend
cd C:\1Hack\backend
Start-Job -ScriptBlock { Set-Location C:\1Hack\backend; python -m uvicorn main:app --reload --port 8000 }
```

## Next Steps for Hackathon

### MVP Complete ✅

All core screens and functionality are implemented!

### Easy Enhancements (if time permits):

1. **Integrate real ML models**:

   - OpenCV or MediaPipe for face detection
   - Cloud APIs (Azure Cognitive Services, Google Vision)
   - Pre-trained models (FER2013, AffectNet)

2. **Improve voice analysis**:

   - Add pitch detection
   - Analyze speech rate
   - Detect pauses/hesitations

3. **Add polish**:

   - Loading states
   - Error messages
   - Success animations (respecting reduce-motion setting)

4. **Implement TTS**:
   - Use Web Speech API
   - Read emotion explanations aloud

## Design Principles Applied

✨ **Neurodivergent-Friendly**:

- No sudden animations
- Clear, literal language
- High spacing between elements
- Only 1 primary action per screen
- Customizable sensory settings

🎯 **Accessibility First**:

- Keyboard navigable
- Screen reader compatible
- Color contrast compliant
- Adjustable text sizes
- Theme switching

## Troubleshooting

**Frontend not loading?**

```powershell
cd C:\1Hack\frontend
npm run dev
```

**Backend not responding?**

```powershell
cd C:\1Hack\backend
Stop-Job -Id 1; Remove-Job -Id 1
Start-Job -ScriptBlock { Set-Location C:\1Hack\backend; python -m uvicorn main:app --reload --port 8000 }
```

**Camera/Mic not working?**

- Make sure browser has permissions
- Check browser console for errors
- Try in Chrome/Edge (best WebRTC support)

---

Built with ❤️ for neurodivergent users
