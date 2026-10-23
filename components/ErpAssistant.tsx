import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Download, MessageCircle, Mic, MicOff, Send, X, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  suggestions?: string[];
  actions?: Array<{
    type: string;
    url?: string;
    label: string;
  }>;
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
  toolDurationMs?: number;
  assistantToolCalls?: ToolCall[];
}

interface ToolCall {
  id: string;
  type?: "function";
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Merhaba! Ben Gork, hoş geldiniz. Size nasıl yardımcı olabilirim?",
  suggestions: ["Stok sorgula", "Sipariş ara", "İş emri listele", "Kesim emirleri", "Üretim durumu"],
};

const TOOL_LABELS: Record<string, string> = {
  get_stock: "Stok bilgileri getiriliyor",
  get_orders: "Siparişler getiriliyor",
  get_work_orders: "İş emirleri getiriliyor",
  get_cutting_orders: "Kesim emirleri getiriliyor",
  get_production_status: "Üretim durumu getiriliyor",
  create_spreadsheet: "Excel dosyası hazırlanıyor",
};

function getAuthHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function requestJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...getAuthHeaders(init.method === "POST"), ...init.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : `İstek başarısız (HTTP ${response.status})`);
  }
  return result;
}

async function readOllamaStream(
  response: Response,
  onContent: (content: string) => void
): Promise<{ content: string; toolCalls: ToolCall[] }> {
  if (!response.body) throw new Error("Asistan yanıt akışı başlatılamadı.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const calls = new Map<number, ToolCall>();

  const processLine = (line: string) => {
    if (!line.trim()) return;
    const chunk = JSON.parse(line) as {
      error?: string;
      message?: { content?: string; tool_calls?: Array<ToolCall & { index?: number }> };
    };
    if (chunk.error) throw new Error(chunk.error);
    const message = chunk.message;
    if (!message) return;
    if (message.content) {
      content += message.content;
      onContent(content);
    }
    message.tool_calls?.forEach((incoming, position) => {
      const index = incoming.index ?? position;
      const existing = calls.get(index);
      if (!existing) {
        calls.set(index, {
          id: incoming.id || `tool-${index}`,
          type: "function",
          function: { name: incoming.function.name || "", arguments: incoming.function.arguments ?? "" },
        });
        return;
      }
      if (incoming.id) existing.id = incoming.id;
      if (incoming.function.name) existing.function.name = incoming.function.name;
      const nextArguments = incoming.function.arguments;
      if (typeof nextArguments === "string" && typeof existing.function.arguments === "string") {
        existing.function.arguments += nextArguments;
      } else if (nextArguments && typeof nextArguments === "object") {
        existing.function.arguments = nextArguments;
      }
    });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(processLine);
      if (done) break;
    }
    if (buffer.trim()) processLine(buffer);
  } finally {
    reader.releaseLock();
  }
  return { content, toolCalls: [...calls.values()] };
}

const ERP_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_stock",
      description: "Stok miktarını sorgular. Ürün kodu veya adı ile arama yapar.",
      parameters: {
        type: "object",
        properties: {
          product_code: { type: "string", description: "Ürün kodu" },
          product_name: { type: "string", description: "Ürün adı" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders",
      description: "Siparişleri listeler. Tarih aralığı ve duruma göre filtreleme yapar.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
          status: { type: "string", description: "Sipariş durumu (bekliyor, onaylandı, iptal, tamamlandı)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_work_orders",
      description: "İş emirlerini listeler.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
          status: { type: "string", description: "İş emri durumu" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cutting_orders",
      description: "Kesim emirlerini listeler.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_production_status",
      description: "Üretim durumunu getirir.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "Sipariş ID" },
          work_order_id: { type: "string", description: "İş emri ID" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_spreadsheet",
      description: "Verilerden Excel (.xlsx) dosyası oluşturur ve indirme linki döner.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Dosya adı (uzantısız)" },
          headers: { type: "array", items: { type: "string" }, description: "Sütun başlıkları" },
          rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "Veri satırları" },
        },
        required: ["filename", "headers", "rows"],
      },
    },
  },
];

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  get_stock: async (args) => {
    const params = new URLSearchParams();
    if (typeof args.product_code === "string") params.append("product_code", args.product_code.slice(0, 100));
    if (typeof args.product_name === "string") params.append("product_name", args.product_name.slice(0, 100));
    return requestJson(`/api/erp/stock?${params}`);
  },
  get_orders: async (args) => {
    const params = new URLSearchParams();
    if (typeof args.start_date === "string") params.append("start_date", args.start_date);
    if (typeof args.end_date === "string") params.append("end_date", args.end_date);
    if (typeof args.status === "string") params.append("status", args.status.slice(0, 40));
    return requestJson(`/api/erp/orders?${params}`);
  },
  get_work_orders: async (args) => {
    const params = new URLSearchParams();
    if (typeof args.start_date === "string") params.append("start_date", args.start_date);
    if (typeof args.end_date === "string") params.append("end_date", args.end_date);
    if (typeof args.status === "string") params.append("status", args.status.slice(0, 40));
    return requestJson(`/api/erp/work-orders?${params}`);
  },
  get_cutting_orders: async (args) => {
    const params = new URLSearchParams();
    if (typeof args.start_date === "string") params.append("start_date", args.start_date);
    if (typeof args.end_date === "string") params.append("end_date", args.end_date);
    return requestJson(`/api/erp/cutting-orders?${params}`);
  },
  get_production_status: async (args) => {
    const params = new URLSearchParams();
    if (typeof args.order_id === "string") params.append("order_id", args.order_id.slice(0, 100));
    if (typeof args.work_order_id === "string") params.append("work_order_id", args.work_order_id.slice(0, 20));
    return requestJson(`/api/erp/production-status?${params}`);
  },
  create_spreadsheet: async (args) => {
    const response = await fetch("/api/erp/create-spreadsheet", {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ ...args, return_base64: false }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(typeof result.error === "string" ? result.error : `Excel oluşturulamadı (HTTP ${response.status})`);
    }
    const disposition = response.headers.get("Content-Disposition");
    const filename = disposition?.match(/filename="([^"]+)"/i)?.[1] || "rapor.xlsx";
    const downloadUrl = URL.createObjectURL(await response.blob());
    return { data: { filename, downloadUrl } };
  },
};

export default function ErpAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState("");
  const [serviceStatus, setServiceStatus] = useState<{ state: "checking" | "ok" | "error"; message: string }>({
    state: "checking",
    message: "Asistan bağlantısı denetleniyor",
  });
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechBusy, setSpeechBusy] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [whisperAvailable, setWhisperAvailable] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Ses servisi denetleniyor");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const speechFallbackTranscriptRef = useRef("");
  const whisperRecordingRef = useRef(false);
  const downloadUrlsRef = useRef(new Set<string>());
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const router = useRouter();

  useEffect(() => () => {
    downloadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    downloadUrlsRef.current.clear();
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("erp-assistant-messages");
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.every((message) =>
          message && typeof message.id === "string"
          && ["user", "assistant", "tool"].includes(message.role)
          && typeof message.text === "string"
        )) {
          setMessages(parsed.slice(-100));
        }
      }
    } catch (error) {
      console.error("Assistant conversation history could not be loaded:", error);
    }
    setHistoryLoaded(true);
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;
    try {
      const persistentMessages = messages.slice(-100).map((message) => {
        if (message.toolName === "create_spreadsheet") {
          return { ...message, actions: undefined, toolResult: { message: "Dosya indirme bağlantısı oturumla sınırlıdır." } };
        }
        return { ...message, actions: undefined };
      });
      window.localStorage.setItem("erp-assistant-messages", JSON.stringify(persistentMessages));
    } catch (error) {
      console.error("Assistant conversation history could not be saved:", error);
    }
  }, [historyLoaded, messages]);

  useEffect(() => {
    let active = true;
    requestJson("/api/assistant/chat")
      .then((result) => {
        if (active) setServiceStatus({ state: "ok", message: `Bağlı · ${result.model}` });
      })
      .catch((error: unknown) => {
        if (active) {
          setServiceStatus({
            state: "error",
            message: error instanceof Error ? error.message : "Asistan servisine bağlanılamadı.",
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    requestJson("/api/assistant/transcribe")
      .then(() => {
        if (active) {
          setWhisperAvailable(true);
          setVoiceStatus("Yerel Whisper hazır");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setWhisperAvailable(false);
          setVoiceStatus("Whisper kullanılamıyor · tarayıcı ses tanıma yedeği");
          console.info("Local Whisper unavailable; using browser speech recognition when supported:", error);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === "undefined") return;
    void (async () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      audioRef.current?.pause();
      setTtsSpeaking(true);
      const fallbackToBrowserSpeech = () => {
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = "tr-TR";
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.onstart = () => setTtsSpeaking(true);
          utterance.onend = () => setTtsSpeaking(false);
          utterance.onerror = () => setTtsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setTtsSpeaking(false);
        }
      };
      try {
        const response = await fetch("/api/assistant/synthesize", {
          method: "POST",
          headers: getAuthHeaders(true),
          body: JSON.stringify({ text: text.slice(0, 2_000) }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(typeof error.error === "string" ? error.error : `Piper isteği başarısız (HTTP ${response.status})`);
        }

        const audioUrl = URL.createObjectURL(await response.blob());
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        const cleanup = () => {
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          if (audioUrlRef.current === audioUrl) audioUrlRef.current = null;
          if (audioRef.current === audio) audioRef.current = null;
          setTtsSpeaking(false);
        };
        audio.onended = cleanup;
        audio.onerror = () => {
          cleanup();
          console.info("Piper audio playback failed; falling back to browser speech synthesis.");
          fallbackToBrowserSpeech();
        };
        await audio.play();
        return;
      } catch (error) {
        console.info("Local Piper unavailable; falling back to browser speech synthesis:", error);
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
        audioRef.current = null;
      }

      fallbackToBrowserSpeech();
    })();
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setTtsSpeaking(false);
  }, []);

  const executeToolCall = useCallback(async (toolCall: ToolCall) => {
    const handler = TOOL_HANDLERS[toolCall.function.name];
    if (!handler) {
      return { error: `Unknown tool: ${toolCall.function.name}` };
    }
    try {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        return { error: "Araç parametreleri geçersiz." };
      }
      const result = await handler(args);
      return result;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Araç çalıştırılamadı." };
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
    if (!text.trim() || loading) return;
    if (listening) {
      const activeRecording = mediaRecorderRef.current;
      if (activeRecording?.recorder.state === "recording") {
        activeRecording.recorder.stop();
      } else {
        try {
          recognitionRef.current?.stop();
        } catch (error) {
          console.info("Speech recognition could not stop while sending a message:", error);
        }
      }
      setListening(false);
    }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: text.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setLoading(true);

      try {
        type OllamaMessage = {
          role: "system" | "user" | "assistant" | "tool";
          content: string | null;
          tool_calls?: ToolCall[];
          tool_call_id?: string;
          name?: string;
        };
        const messageHistory: OllamaMessage[] = [];
        const previousMessages = messagesRef.current;
        let historyStartIndex = Math.max(0, previousMessages.length - 19);
        while (
          previousMessages[historyStartIndex]?.role === "tool"
          && !previousMessages[historyStartIndex]?.assistantToolCalls
        ) {
          historyStartIndex += 1;
        }
        for (const previous of previousMessages.slice(historyStartIndex)) {
          if (previous.role === "tool") {
            if (previous.assistantToolCalls) {
              messageHistory.push({ role: "assistant", content: null, tool_calls: previous.assistantToolCalls });
            }
            messageHistory.push({
              role: "tool",
              content: JSON.stringify(previous.toolResult ?? { text: previous.text }),
              tool_call_id: previous.toolCallId || "",
              name: previous.toolName || "",
            });
          } else {
            messageHistory.push({ role: previous.role, content: previous.text });
          }
        }
        messageHistory.push({ role: "user", content: text.trim() });

        let finalResponse = "";
        const assistantActions: ChatMessage["actions"] = [];
        let completed = false;
        const streamingId = `assistant-stream-${Date.now()}`;

        for (let iteration = 0; iteration < 5; iteration++) {
          const res = await fetch("/api/assistant/chat", {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
              messages: messageHistory,
              tools: ERP_TOOLS,
            }),
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(typeof errorData.error === "string" ? errorData.error : `Asistan isteği başarısız (HTTP ${res.status})`);
          }

          const result = await readOllamaStream(res, (content) => {
            setMessages((previous) => {
              const existingIndex = previous.findIndex((message) => message.id === streamingId);
              if (existingIndex === -1) {
                return [...previous, { id: streamingId, role: "assistant", text: content }];
              }
              return previous.map((message) => message.id === streamingId ? { ...message, text: content } : message);
            });
          });

          if (result.toolCalls.length > 0) {
            setMessages((previous) => previous.filter((message) => message.id !== streamingId));
            messageHistory.push({ role: "assistant", content: null, tool_calls: result.toolCalls });

            for (const [index, toolCall] of result.toolCalls.entries()) {
              const toolMessageId = `tool-${Date.now()}-${toolCall.id}-${index}`;
              const label = TOOL_LABELS[toolCall.function.name] || `${toolCall.function.name} çalıştırılıyor`;
              setToolStatus(label);
              setMessages((previous) => [...previous, {
                id: toolMessageId,
                role: "tool",
                text: `${label}…`,
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                assistantToolCalls: index === 0 ? result.toolCalls : undefined,
              }]);

              const startedAt = Date.now();
              const timer = window.setInterval(() => {
                setToolStatus(`${label} · ${Math.floor((Date.now() - startedAt) / 1000)} sn`);
              }, 1000);
              const toolResult = await executeToolCall(toolCall);
              window.clearInterval(timer);
              const duration = Date.now() - startedAt;
              const toolError = toolResult && typeof toolResult === "object" && "error" in toolResult
                ? String(toolResult.error)
                : null;
              if (toolCall.function.name === "create_spreadsheet" && !toolError) {
                const responseData = toolResult as { data?: { downloadUrl?: string } };
                if (responseData.data?.downloadUrl) downloadUrlsRef.current.add(responseData.data.downloadUrl);
              }
              const resultForModel = toolCall.function.name === "create_spreadsheet" && !toolError
                ? {
                    data: { filename: (toolResult as { data?: { filename?: string } }).data?.filename },
                    message: "Excel dosyası hazırlandı ve indirme bağlantısı kullanıcıya gösterildi.",
                  }
                : toolResult;
              const serializedResult = JSON.stringify(resultForModel);
              messageHistory.push({
                role: "tool",
                content: serializedResult.length > 20_000 ? `${serializedResult.slice(0, 20_000)}…` : serializedResult,
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
              });
              setMessages((previous) => previous.map((message) => message.id === toolMessageId
                ? {
                    ...message,
                    text: toolError ? `Hata: ${toolError}` : `Tamamlandı · ${(duration / 1000).toFixed(1)} sn`,
                    toolResult,
                    toolDurationMs: duration,
                  }
                : message));

              if (toolCall.function.name === "create_spreadsheet" && !toolError) {
                const responseData = toolResult as { data?: { downloadUrl?: string; filename?: string } };
                if (responseData.data?.downloadUrl) {
                assistantActions.push({
                  type: "download",
                    url: responseData.data.downloadUrl,
                    label: responseData.data.filename || "Excel İndir",
                });
                }
              }
            }
            continue;
          }

          completed = true;
          finalResponse = result.content || "Yanıt alınamadı.";
          break;
        }

        if (!completed) {
          console.warn("ERP assistant reached the maximum tool-call iteration limit.");
          finalResponse = "İstek çok fazla araç adımı gerektirdi. Lütfen daha dar kapsamlı bir soru sorun.";
        }
        setToolStatus("");
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: finalResponse,
          actions: assistantActions.length > 0 ? assistantActions : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        speak(finalResponse);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bilinmeyen bir bağlantı hatası oluştu.";
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", text: `Asistan yanıt veremedi: ${message}` },
        ]);
      } finally {
        setToolStatus("");
        setLoading(false);
      }
    },
    [loading, listening, executeToolCall, speak]
  );

  const startListening = useCallback(async () => {
    if (listening || loading || speechBusy) return;
    setInput("");
    speechFallbackTranscriptRef.current = "";

    const startBrowserRecognition = () => {
      if (!recognitionRef.current) {
        setVoiceStatus("Tarayıcıda ses tanıma desteklenmiyor; metin girişi kullanılabilir");
        return;
      }
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (error) {
        console.error("Browser speech recognition could not start:", error);
        setListening(false);
      }
    };

    if (whisperAvailable && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
      let microphoneStream: MediaStream | null = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStream = stream;
        const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
          .find((type) => MediaRecorder.isTypeSupported(type));
        const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);
        const chunks: Blob[] = [];
        mediaRecorderRef.current = { recorder, stream, chunks };
        whisperRecordingRef.current = true;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = (event) => {
          console.error("Microphone recording failed:", event);
          setListening(false);
          setSpeechBusy(false);
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          whisperRecordingRef.current = false;
          setMessages((previous) => [...previous, {
            id: `speech-error-${Date.now()}`,
            role: "assistant",
            text: "Mikrofon kaydı başarısız oldu. Mikrofon izinlerini denetleyip tekrar deneyin.",
          }]);
        };
        recorder.onstop = () => {
          if (mediaRecorderRef.current?.recorder !== recorder) return;
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          setListening(false);
          setSpeechBusy(true);
          setVoiceStatus("Ses Whisper ile çözümleniyor…");

          const audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
          const formData = new FormData();
          formData.append("file", audioBlob, `recording.${extension}`);
          formData.append("model", "whisper-1");
          formData.append("language", "tr");

          void (async () => {
            try {
              const response = await fetch("/api/assistant/transcribe", {
                method: "POST",
                headers: getAuthHeaders(),
                body: formData,
              });
              const result = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(typeof result.error === "string" ? result.error : `Transkripsiyon başarısız (HTTP ${response.status})`);
              }
              if (typeof result.text !== "string" || !result.text.trim()) {
                throw new Error("Transkripsiyon metni boş.");
              }
              setVoiceStatus("Yerel Whisper hazır");
              sendMessageRef.current(result.text.trim());
            } catch (error) {
              await new Promise((resolve) => window.setTimeout(resolve, 500));
              const fallbackTranscript = speechFallbackTranscriptRef.current.trim();
              if (fallbackTranscript) {
                setVoiceStatus("Whisper kullanılamıyor · tarayıcı ses tanıma yedeği kullanıldı");
                sendMessageRef.current(fallbackTranscript);
              } else {
                const reason = error instanceof Error ? error.message : "Bilinmeyen ses işleme hatası.";
                setVoiceStatus("Whisper kullanılamıyor · tarayıcı ses tanıma yedeği");
                setMessages((previous) => [...previous, {
                  id: `speech-error-${Date.now()}`,
                  role: "assistant",
                  text: `Ses çözümlenemedi: ${reason}. Tarayıcı ses tanıma destekleniyorsa tekrar deneyin; değilse sorunuzu yazın.`,
                }]);
              }
            } finally {
              whisperRecordingRef.current = false;
              setSpeechBusy(false);
            }
          })();
        };
        recorder.start();
        setListening(true);
        setVoiceStatus("Kaydediliyor · bitirmek için mikrofona dokunun");
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.info("Browser speech fallback could not start:", error);
          }
        }
      } catch (error) {
        microphoneStream?.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        whisperRecordingRef.current = false;
        console.error("Microphone permission failed:", error);
        setVoiceStatus("Mikrofon erişimi yok · tarayıcı ses tanıma yedeği");
        startBrowserRecognition();
      }
      return;
    }

    if (recognitionRef.current) {
      setVoiceStatus("Tarayıcı ses tanıma kullanılıyor");
      startBrowserRecognition();
    } else {
      setVoiceStatus("Ses tanıma kullanılamıyor; sorunuzu yazarak iletin");
    }
  }, [listening, loading, speechBusy, whisperAvailable]);

  const stopListening = useCallback(() => {
    const activeRecording = mediaRecorderRef.current;
    if (activeRecording?.recorder.state === "recording") {
      activeRecording.recorder.stop();
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        console.info("Browser speech fallback could not stop cleanly:", error);
      }
      return;
    }
    if (recognitionRef.current) {
      setListening(false);
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.info("Browser speech recognition could not stop cleanly:", error);
      }
    }
  }, []);

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const browserWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "tr-TR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (whisperRecordingRef.current) {
          speechFallbackTranscriptRef.current = transcript;
          return;
        }
        setInput(transcript);
        setListening(false);
        setTimeout(() => {
          sendMessageRef.current(transcript);
        }, 300);
      };

      recognition.onerror = () => {
        if (!whisperRecordingRef.current) setListening(false);
      };

      recognition.onend = () => {
        if (!whisperRecordingRef.current) setListening(false);
      };

      recognitionRef.current = recognition;
      setSpeechSupported(true);
    } else {
      setSpeechSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!listening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, [listening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="rounded-full shadow-lg h-12 w-12 p-0"
          aria-label="Gork'u Ac"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[380px] flex-col rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-secondary-200 dark:border-secondary-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <div>
            <span className="font-semibold text-sm text-secondary-900 dark:text-secondary-100">Gork</span>
            <div className={`text-[10px] ${serviceStatus.state === "error" ? "text-red-500" : "text-secondary-500"}`}>
              {serviceStatus.message}
            </div>
            <div className="text-[10px] text-secondary-500">{voiceStatus}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${ttsEnabled ? "text-primary-600" : "text-secondary-400"}`}
            onClick={() => setTtsEnabled(!ttsEnabled)}
            aria-label={ttsEnabled ? "Sesli yanıtı kapat" : "Sesli yanıtı aç"}
            disabled={ttsSpeaking}
          >
            {ttsSpeaking ? (
              <VolumeX className="h-4 w-4 animate-pulse" />
            ) : ttsEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          {ttsSpeaking && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-500"
              onClick={stopSpeaking}
              aria-label="Sesli yanıtı durdur"
            >
              <VolumeX className="h-4 w-4" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-300"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary-600 text-white"
                  : msg.role === "tool"
                  ? "bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700"
                  : "bg-secondary-100 dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100"
              }`}
            >
              {msg.text}
              {msg.role === "tool" && msg.toolName && (
                <div className="mt-1 text-xs opacity-70">Araç: {msg.toolName}</div>
              )}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.actions.map((action) =>
                    action.type === "navigate" ? (
                      <Button
                        key={action.label}
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (action.url) {
                            router.push(action.url);
                          }
                        }}
                      >
                        {action.label}
                      </Button>
                    ) : (
                      <Button
                        key={action.label}
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (action.url) {
                            const link = document.createElement("a");
                            link.href = action.url;
                            link.download = action.label;
                            link.click();
                            link.remove();
                          }
                        }}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        {action.label}
                      </Button>
                    )
                  )}
                </div>
              )}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                      className="rounded-full border border-secondary-300 dark:border-secondary-600 px-2 py-0.5 text-xs text-secondary-700 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {(loading || speechBusy) && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-secondary-100 dark:bg-secondary-800 px-3 py-2 text-xs text-secondary-600 dark:text-secondary-300">
              {speechBusy ? "Ses metne dönüştürülüyor…" : toolStatus || "Düşünüyor…"}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-secondary-200 dark:border-secondary-700 p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={listening ? "Dinliyorum..." : "Sorunuzu yazın..."}
            disabled={listening || speechBusy}
            className={`flex-1 rounded-lg border bg-white dark:bg-secondary-800 px-3 py-2 text-sm text-secondary-900 dark:text-secondary-100 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              listening
                ? "border-red-400 focus:ring-red-400"
                : "border-secondary-300 dark:border-secondary-600"
            }`}
          />
          {(speechSupported || whisperAvailable) && (
            <Button
              type="button"
              variant="secondary"
              className={`h-10 w-10 p-0 ${listening ? "animate-pulse text-red-500 border-red-400" : ""}`}
              onClick={listening ? stopListening : startListening}
              disabled={loading || speechBusy}
              aria-label={listening ? "Dinlemeyi Durdur" : "Sesle Sor"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button
            className="h-10 w-10 p-0"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading || listening || speechBusy}
            aria-label="Gönder"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
