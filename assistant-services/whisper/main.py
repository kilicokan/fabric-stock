import io
import os
from contextlib import asynccontextmanager
from typing import Annotated

from faster_whisper import WhisperModel
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

MAX_AUDIO_BYTES = 20 * 1024 * 1024
MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
MODEL_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
MODEL_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
CPU_THREADS = max(1, int(os.getenv("WHISPER_CPU_THREADS", "4")))
model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    model = WhisperModel(
        MODEL_NAME,
        device=MODEL_DEVICE,
        compute_type=MODEL_COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
        download_root="/models",
    )
    yield
    model = None


app = FastAPI(title="Fabric Stock Whisper", lifespan=lifespan)


class HealthResponse(BaseModel):
    available: bool
    model: str
    device: str


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        available=model is not None,
        model=MODEL_NAME,
        device=MODEL_DEVICE,
    )


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: Annotated[UploadFile, File()],
    language: Annotated[str | None, Form()] = None,
    model_name: Annotated[str | None, Form(alias="model")] = None,
) -> dict[str, str]:
    if model is None:
        raise HTTPException(status_code=503, detail="Whisper model is not loaded.")
    if language and len(language) > 12:
        raise HTTPException(status_code=400, detail="Invalid language code.")
    if model_name and len(model_name) > 100:
        raise HTTPException(status_code=400, detail="Invalid model name.")

    audio = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio:
        raise HTTPException(status_code=400, detail="Audio upload is empty.")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio upload exceeds the 20 MB limit.")

    try:
        segments, _ = model.transcribe(
            io.BytesIO(audio),
            language=language or "tr",
            beam_size=3,
            vad_filter=True,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
    except Exception as error:
        raise HTTPException(status_code=422, detail="Could not decode or transcribe the audio.") from error
    finally:
        await file.close()

    if not text:
        raise HTTPException(status_code=422, detail="No speech was detected.")
    return {"text": text}
