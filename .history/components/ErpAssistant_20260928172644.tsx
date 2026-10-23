import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Download, MessageCircle, Mic, MicOff, Send, X, Volume2, VolumeX, FileSpreadsheet } from "lucide-react";
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
}

interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
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

const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  get_stock: async (args) => {
    const params = new URLSearchParams();
    if (args.product_code) params.append("product_code", args.product_code);
    if (args.product_name) params.append("product_name", args.product_name);
    const res = await fetch(`/api/erp/stock?${params}`);
    return res.json();
  },
  get_orders: async (args) => {
    const params = new URLSearchParams();
    if (args.start_date) params.append("start_date", args.start_date);
    if (args.end_date) params.append("end_date", args.end_date);
    if (args.status) params.append("status", args.status);
    const res = await fetch(`/api/erp/orders?${params}`);
    return res.json();
  },
  get_work_orders: async (args) => {
    const params = new URLSearchParams();
    if (args.start_date) params.append("start_date", args.start_date);
    if (args.end_date) params.append("end_date", args.end_date);
    if (args.status) params.append("status", args.status);
    const res = await fetch(`/api/erp/work-orders?${params}`);
    return res.json();
  },
  get_cutting_orders: async (args) => {
    const params = new URLSearchParams();
    if (args.start_date) params.append("start_date", args.start_date);
    if (args.end_date) params.append("end_date", args.end_date);
    const res = await fetch(`/api/erp/cutting-orders?${params}`);
    return res.json();
  },
  get_production_status: async (args) => {
    const params = new URLSearchParams();
    if (args.order_id) params.append("order_id", args.order_id);
    if (args.work_order_id) params.append("work_order_id", args.work_order_id);
    const res = await fetch(`/api/erp/production-status?${params}`);
    return res.json();
  },
  create_spreadsheet: async (args) => {
    const res = await fetch("/api/erp/create-spreadsheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...args, return_base64: true }),
    });
    return res.json();
  },
};

export default function ErpAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Merhaba! Ben Gork, hoş geldiniz. Size nasil yardimci olabilirim?",
      suggestions: ["Stok sorgula", "Siparis ara", "Is emru listele", "Kesim emirleri", "Uretim durumu"],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  const router = useRouter();

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setTtsSpeaking(true);
    utterance.onend = () => setTtsSpeaking(false);
    utterance.onerror = () => setTtsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setTtsSpeaking(false);
    }
  }, []);

  const executeToolCall = useCallback(async (toolCall: any) => {
    const handler = TOOL_HANDLERS[toolCall.function.name];
    if (!handler) {
      return { error: `Unknown tool: ${toolCall.function.name}` };
    }
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await handler(args);
      return result;
    } catch (error) {
      return { error: `Tool execution failed: ${error}` };
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;
      if (listening) {
        try {
          recognitionRef.current?.stop();
        } catch {
          // ignore
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
        const messageHistory = messages.map((m) => ({
          role: m.role === "tool" ? "tool" : m.role,
          content: m.text,
          ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
          ...(m.toolName ? { name: m.toolName } : {}),
        }));

        messageHistory.push({ role: "user", content: text.trim() });

        let finalResponse = "";
        let toolCalls: any[] = [];
        let assistantActions: ChatMessage["actions"] = [];

        for (let iteration = 0; iteration < 5; iteration++) {
          const res = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "RefinedNeuro/RN_TR_R2",
              messages: [
                {
                  role: "system",
                  content:
                    "Sen Gork adinda bir ERP asistanisin. Kullanicilara stok, siparis, uretim gibi konularda yardimci olursun. Gerektiğinde araçları (tools) kullanarak veri getir veya Excel oluştur. Yanıtları Türkçe ver.",
                },
                ...messageHistory,
              ],
              tools: ERP_TOOLS,
              stream: false,
            }),
          });

          const data = await res.json();
          const message = data.message;

          if (message.tool_calls && message.tool_calls.length > 0) {
            toolCalls = message.tool_calls;

            for (const toolCall of toolCalls) {
              const toolResult = await executeToolCall(toolCall);

              messageHistory.push({
                role: "assistant",
                content: null,
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
              });

              messageHistory.push({
                role: "tool",
                content: JSON.stringify(toolResult),
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
              });

              if (toolCall.function.name === "create_spreadsheet" && toolResult.data?.downloadUrl) {
                assistantActions.push({
                  type: "download",
                  url: toolResult.data.downloadUrl,
                  label: toolResult.data.filename || "Excel İndir",
                });
              }

              setMessages((prev) => [
                ...prev,
                {
                  id: `tool-${Date.now()}-${toolCall.id}`,
                  role: "tool",
                  text: `🔧 ${toolCall.function.name} çalıştırıldı`,
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                },
              ]);
            }
            continue;
          }

          finalResponse = message.content || "Yanıt alınamadı.";
          break;
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: finalResponse,
          actions: assistantActions.length > 0 ? assistantActions : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        speak(finalResponse);
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", text: "Baglanti hatasi olustu. Lutfen tekrar deneyin." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, listening, messages, executeToolCall, speak]
  );

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening || loading) return;
    setInput("");
    setListening(true);
    try {
      recognitionRef.current.start();
    } catch {
      setListening(false);
    }
  }, [listening, loading]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    setListening(false);
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
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (typeof window !== "undefined" && SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "tr-TR";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setListening(false);
        setTimeout(() => {
          sendMessageRef.current(transcript);
        }, 300);
      };

      recognition.onerror = () => {
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
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
          <span className="font-semibold text-sm text-secondary-900 dark:text-secondary-100">Gork</span>
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
                          if (action.url) window.open(action.url, "_blank");
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

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-secondary-100 dark:bg-secondary-800 px-3 py-2 text-xs text-secondary-600 dark:text-secondary-300">
              Dusunuyor...
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
            placeholder={listening ? "Dinliyorum..." : "Sorunuzu yazin..."}
            disabled={listening}
            className={`flex-1 rounded-lg border bg-white dark:bg-secondary-800 px-3 py-2 text-sm text-secondary-900 dark:text-secondary-100 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              listening
                ? "border-red-400 focus:ring-red-400"
                : "border-secondary-300 dark:border-secondary-600"
            }`}
          />
          {speechSupported && (
            <Button
              type="button"
              variant="secondary"
              className={`h-10 w-10 p-0 ${listening ? "animate-pulse text-red-500 border-red-400" : ""}`}
              onClick={listening ? stopListening : startListening}
              disabled={loading}
              aria-label={listening ? "Dinlemeyi Durdur" : "Sesle Sor"}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Button
            className="h-10 w-10 p-0"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading || listening}
            aria-label="Gonder"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
