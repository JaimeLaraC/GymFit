"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  userId: string;
}

interface StreamChunk {
  text?: string;
  error?: string;
}

const QUICK_ACTIONS = [
  {
    label: "¿Qué entreno hoy?",
    message: "¿Qué debería entrenar hoy basándote en mi historial y recuperación?",
  },
  {
    label: "Analiza mi semana",
    message: "Analiza mi última semana de entrenamiento: volumen, intensidad y recuperación.",
  },
  {
    label: "Genera rutina",
    message: "Genera una rutina PPL de 4 días adaptada a mi nivel y objetivos.",
  },
];

const WELCOME_MESSAGE = `¡Hola! Soy tu asistente de entrenamiento. Puedo:

• Analizar tu progreso y darte recomendaciones
• Responder dudas sobre ejercicios o técnica
• Sugerir ajustes a tu rutina
• Generar nuevas rutinas personalizadas

¿En qué te puedo ayudar?`;

function parseServerSentEvents(chunk: string): string[] {
  return chunk
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.replace("data: ", "").trim());
}

export function ChatInterface({ userId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  async function sendMessage(messageOverride?: string) {
    const outgoingMessage = (messageOverride ?? input).trim();
    if (!outgoingMessage || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: outgoingMessage },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: outgoingMessage, userId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Error al conectar con la IA.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo iniciar el streaming de respuesta.");

      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const events = pending.split("\n\n");
        pending = events.pop() ?? "";

        for (const event of events) {
          const payloads = parseServerSentEvents(event);
          for (const payload of payloads) {
            if (payload === "[DONE]") continue;
            const data = JSON.parse(payload) as StreamChunk;
            if (data.error) throw new Error(data.error);
            if (!data.text) continue;

            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                role: "assistant",
                content: `${last.content}${data.text}`,
              };
              return next;
            });
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error al conectar con la IA. Verifica tu API key en .env.local.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: errorMessage,
        };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Card className="min-h-0 flex-1">
        <CardContent className="h-full p-0">
          <ScrollArea className="h-full px-3 py-3 sm:px-4">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border/80"
                    )}
                  >
                    {message.content || (isStreaming && index === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={isStreaming}
              onClick={() => sendMessage(action.message)}
            >
              {action.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Escribe tu mensaje..."
            className="h-11"
            disabled={isStreaming}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <Button
            type="button"
            className="h-11"
            disabled={isStreaming || input.trim().length === 0}
            onClick={() => sendMessage()}
          >
            {isStreaming ? "..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
