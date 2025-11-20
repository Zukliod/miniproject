# Technology Stack Overview

## Summary
A lightweight prototype translating uploaded media (video/audio) into a stub text transcription and illustrating words via a simple SVG hand mascot. Backend in Python (FastAPI) and a minimal vanilla HTML/CSS/JS frontend.

## Backend
- Language: Python 3.11 (works with 3.10+)
- Framework: FastAPI (`fastapi`) for REST endpoints
- ASGI Server: `uvicorn` (reload in dev)
- File Uploads: `python-multipart`
- Audio Extraction: External tool `ffmpeg` (invoked via `subprocess`)
- Optional Transcription: OpenAI API (`openai` SDK) if `OPENAI_API_KEY` is set; otherwise returns stub text
- Configuration:
  - Environment variables:
    - `OPENAI_API_KEY` (optional) – enables real transcription attempts
    - `FFMPEG_PATH` (optional) – absolute path to ffmpeg executable if not on PATH
  - Endpoints:
    - `POST /api/transcribe` – accepts video/audio, extracts audio, transcribes
    - `GET /api/health` – health probe
    - `GET /api/config` – reports ffmpeg resolution and availability

## Frontend
- Assets: `frontend/index.html`, `style.css`, `app.js`
- Stack: Vanilla HTML5, CSS3, ES6 JavaScript (no framework)
- Layout: Three panels – Media player, captions list, mascot SVG
- Mascot: Inline SVG with fingers/thumb; word-to-pose mapping highlights segments
- API Calls: Fetch to `${API_BASE}/api/transcribe` (default `http://localhost:8000`)

## Transcription Flow
1. Upload file (video or audio) from frontend.
2. Backend saves to temp dir, calls ffmpeg to produce 16 kHz mono WAV.
3. If OpenAI key present, attempts model names (`gpt-4o-transcribe`, `whisper-1` fallback) else stub text.
4. Tokenization splits text into words; returns JSON with list.
5. Frontend renders words and schedules pose highlights across media duration (approximate uniform timing).

## Dependencies (Python)
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
openai==1.47.0
```
Additional transient libs pulled by these packages (e.g., `httpx`, `anyio`, `pydantic`).

## Tooling & Operations
- Virtual Environment: `python -m venv .venv`
- Local Dev Commands:
  - Install: `pip install -r requirements.txt`
  - Run server: `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`
  - Serve frontend (alternate): `python -m http.server 5173` from `frontend/`
- ffmpeg Install Options:
  - Manual: Download build -> `C:\ffmpeg\bin\ffmpeg.exe` then add to PATH or set `FFMPEG_PATH`.
  - Chocolatey: `choco install ffmpeg -y` (if choco installed).

## Security & Privacy (Prototype Considerations)
- No auth; all endpoints public.
- Files processed transiently in temp directories; not stored.
- For real deployment: add authentication, rate limiting, secure logging, and PII handling for transcripts.

## Performance Notes
- Transcription latency dominated by external OpenAI call and ffmpeg extraction.
- Uniform word timing distribution (placeholder) – no forced alignment.

## Extensibility Roadmap
| Area | Enhancement |
|------|-------------|
| Transcription | Integrate local Whisper (faster-whisper) for offline mode |
| Sign Language | Replace SVG with 3D rigged hand + real sign mapping dictionary |
| Timing | Use word-level timestamps for precise pose scheduling |
| Frontend | Add progress indicators, error toasts, accessibility improvements |
| Deployment | Containerize (Docker) and add CI pipeline, single-port serving |
| Static Serving | Mount `frontend/` in FastAPI (`StaticFiles`) & add root route |
| Observability | Add logging middleware, request IDs, structured logs |

## Potential Static Mount (Future)
Example (not yet in code):
```python
from fastapi.staticfiles import StaticFiles
app.mount('/static', StaticFiles(directory='frontend'), name='static')
@app.get('/')
async def root():
    return FileResponse('frontend/index.html')
```

## Known Limitations
- Not real sign language translation.
- Fallback transcription text always same without key.
- No concurrency limits or file size constraints.
- Missing favicon until added.

## Licensing & Attribution
Internal prototype; no explicit license header added.

## Quick Test Script
```powershell
Push-Location "c:\Users\RARCH\OneDrive\Documents\miniproject\sign_translator"
. .venv\Scripts\Activate.ps1
$env:FFMPEG_PATH = "C:\ffmpeg\bin\ffmpeg.exe"  # if needed
uvicorn backend.main:app --reload --port 8000
```
Open the frontend and upload a short MP4 or WAV.

---
Generated automatically to document current architecture and guide future enhancements.
