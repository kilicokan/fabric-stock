# ERP Assistant

The assistant uses the Ollama server from the Next.js API, not directly from the browser. Its protected proxy endpoint is `/api/assistant/chat`; ERP tools and spreadsheet generation also require the user's bearer token.

Configure the server environment in `.env.local`:

```env
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
WHISPER_URL=http://127.0.0.1:8000/v1/audio/transcriptions
WHISPER_HEALTH_URL=http://127.0.0.1:8000/health
PIPER_URL=http://127.0.0.1:5000/api/tts
```

If Ollama is already installed on the host, pull the model there and start only Whisper from the project root:

```powershell
ollama pull qwen2.5:7b
docker compose --profile assistant up -d --build whisper
```

The Whisper image downloads the configured `small` model the first time it starts and caches it in the `whisper_models` volume; this needs an internet connection and several gigabytes of free storage. Set `WHISPER_MODEL=base` in the shell environment before starting Compose if the machine has less memory or storage. The Whisper port is published only on loopback. The Next.js server can use the default URLs above when it runs on the host.

Alternatively, if the host does not run Ollama, start its Compose service with `docker compose --profile assistant up -d ollama`, then run `docker compose exec ollama ollama pull qwen2.5:7b`. Do not start both host Ollama and the Compose Ollama on port 11434 at the same time. Ollama stores its model in `ollama_data`, and pulling `qwen2.5:7b` requires several gigabytes of free storage.

When Next.js also runs in Docker, configure service URLs on the Next.js container to use `http://ollama:11434` and `http://whisper:8000` instead of `localhost`. The assistant checks server connectivity and model availability when it loads. It streams generated text, supports tool calls, and limits chat and synthesis proxy requests to 30 per minute per server-side client address. Conversation history is stored in the browser's local storage; spreadsheet download links are session-only and are not persisted.

Voice services are optional HTTP services accessible to the Next.js server. `WHISPER_URL` must accept an OpenAI-compatible multipart transcription request (`file`, `model`, and `language`) and return JSON with a `text` property; its health endpoint can be set separately with `WHISPER_HEALTH_URL`. `PIPER_URL` must accept `POST {"text":"..."}` and return audio bytes with an `audio/*` content type. The assistant proxies both services through authenticated API routes; audio uploads are capped at 20 MB and transcription requests at 10 per minute per client address.

When Whisper is healthy, microphone audio is recorded in the browser and transcribed locally through the configured service. Browser speech recognition is also started when available so it can be used if the Whisper request fails. When Whisper is unavailable, the assistant uses browser speech recognition directly. Piper is preferred for spoken replies, with browser speech synthesis as fallback. Browsers without speech recognition can still use the local Whisper recording control or text chat.

No Piper service or voice model is bundled. The available Piper voice catalogue currently has no Turkish voice, so configure a Turkish-capable Piper-compatible service only if you provide a suitable voice model; otherwise the browser's Turkish speech synthesis is used.
