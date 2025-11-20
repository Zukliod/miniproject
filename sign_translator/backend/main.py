import os
import tempfile
import subprocess
from pathlib import Path
from typing import List
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.responses import JSONResponse

app = FastAPI(title="Sign Translator Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend static assets (index served by root route)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

@app.get("/")
async def root_page():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    return {"message": "frontend not found"}

ALLOWED_EXTENSIONS = {"mp4", "mov", "mkv", "webm", "mp3", "wav", "m4a"}


def get_ffmpeg_executable() -> str:
    """Return ffmpeg executable path.

    Checks environment variable FFMPEG_PATH first; falls back to 'ffmpeg'.
    """
    custom = os.getenv("FFMPEG_PATH")
    return custom.strip() if custom else "ffmpeg"


def _has_ffmpeg() -> bool:
    exe = get_ffmpeg_executable()
    try:
        subprocess.run([exe, "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return True
    except FileNotFoundError:
        return False


def extract_audio(input_path: Path, output_path: Path) -> None:
    """Extract audio track as WAV using ffmpeg (configurable via FFMPEG_PATH)."""
    exe = get_ffmpeg_executable()
    if not _has_ffmpeg():
        raise RuntimeError(
            "ffmpeg not found. Install it or set FFMPEG_PATH to full executable path (e.g. C:/ffmpeg/bin/ffmpeg.exe)."
        )
    cmd = [
        exe,
        "-y",  # overwrite
        "-i", str(input_path),
        "-vn",  # no video
        "-acodec", "pcm_s16le",
        "-ar", "16000",  # sample rate suitable for STT
        "-ac", "1",  # mono
        str(output_path),
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed (cmd: {exe}): {result.stderr[:500]}")


def transcribe_audio(audio_path: Path) -> str:
    """Stub transcription; optionally uses OpenAI if key is set.

    NOTE: Real transcription requires external model. This function attempts
    OpenAI Whisper if OPENAI_API_KEY is set; otherwise returns placeholder text.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            # Lazy import to avoid dependency if not used
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            # Try a couple of model names for compatibility.
            # Adjust model name based on available OpenAI endpoints.
            for model_name in ["gpt-4o-transcribe", "whisper-1"]:
                try:
                    with open(audio_path, "rb") as f:
                        transcription = client.audio.transcriptions.create(model=model_name, file=f)
                    # Response shape may differ; attempt to extract text
                    text = getattr(transcription, "text", None)
                    if not text and isinstance(transcription, dict):
                        text = transcription.get("text")
                    if text:
                        return text
                except Exception:
                    continue
            return "transcription unavailable (OpenAI models not reachable)"
        except Exception as e:
            return f"transcription error: {e}"[:500]
    # Fallback stub text
    return "hello world this is a sample transcription for sign translation demo"


def tokenize(text: str) -> List[str]:
    cleaned = ''.join(ch if ch.isalnum() or ch.isspace() else ' ' for ch in text.lower())
    return [w for w in cleaned.split() if w]


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    suffix = filename.split('.')[-1].lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    with tempfile.TemporaryDirectory() as td:
        temp_in = Path(td) / f"input.{suffix}"
        with open(temp_in, "wb") as f:
            f.write(await file.read())
        audio_out = Path(td) / "audio.wav"
        try:
            extract_audio(temp_in, audio_out)
            text = transcribe_audio(audio_out)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    words = tokenize(text)
    return JSONResponse({
        "text": text,
        "words": [{"w": w, "i": i} for i, w in enumerate(words)]
    })


@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.get("/api/config")
async def api_config():
    exe = get_ffmpeg_executable()
    resolved = shutil.which(exe) if exe else None
    return {
        "ffmpeg": {
            "configured": exe,
            "resolved": resolved,
            "available": _has_ffmpeg(),
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
