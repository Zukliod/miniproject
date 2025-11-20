# Sign Translator Demo

Prototype web application that:
1. Accepts an uploaded video or audio file.
2. Extracts audio via `ffmpeg` and performs a stub transcription (FastAPI backend).
3. Displays the media, generated caption text, and a simple SVG mascot hand.
4. Animates basic hand poses synced roughly to the timing of words.

> IMPORTANT: This is **NOT** real sign language translation. True sign language rendering requires linguistic + motion model expertise. This demo only highlights different fingers for words as an illustrative placeholder.

## Features
- FastAPI endpoint `/api/transcribe` handling media upload.
- Audio extraction to 16k mono WAV (requires `ffmpeg` installed and on PATH).
- Optional use of OpenAI Whisper if `OPENAI_API_KEY` is set (attempts available model names, else falls back to stub text).
- Frontend: three main zones (media player, captions, mascot) with simple timing sync.

## Prerequisites
- Python 3.10+ recommended.
- `ffmpeg` installed (Windows: download from https://www.gyan.dev/ffmpeg/builds/ and add `bin` folder to PATH).
- (Optional) OpenAI API key exported as `OPENAI_API_KEY` environment variable.

## Setup (Windows PowerShell)
```powershell
cd "c:\Users\RARCH\OneDrive\Documents\miniproject\sign_translator"
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run Backend
```powershell
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Browse to: http://localhost:8000/frontend/index.html (FastAPI will not serve static files by default).

### Serving Frontend
Simplest: use Python's static server in `frontend` directory on a different port.
```powershell
cd frontend
python -m http.server 5173
```
Then open: http://localhost:5173
The frontend will call backend at `http://localhost:8000/api/transcribe`. If you host differently, adjust fetch URL in `frontend/app.js`.

Alternatively you can add a small static mount in FastAPI (future enhancement).

## Environment Variable Example
```powershell
$env:OPENAI_API_KEY = "sk-your-key"
```

## Limitations & Next Steps
- Gesture mapping is trivial; replace with real sign language generation pipeline.
- Timing sync is approximate: evenly distributes words over media duration when exact word-level timestamps are absent.
- No error UI for missing `ffmpeg` besides status message.
- No caching or progress bar for large uploads.

## Improving Further
- Integrate whisper locally (e.g., faster-whisper) for offline transcription.
- Provide true sign language dictionary mapping and model-based avatar animation (e.g., WebGL or rigged 3D hand).
- Add timestamps per word using detailed ASR output then align poses precisely.
- Serve frontend via FastAPI static files for single-port deployment.

## License
No license header intentionally; treat as internal prototype.
