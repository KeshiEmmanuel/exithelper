"use client";
import ExeatProgressBar from "./ExeatProgressBar";
import { useExeatStage } from "@/hooks/useExeatStage";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { GraduationCap, Send, RotateCcw, ShieldCheck } from "lucide-react";
import type { UIMessage } from "@ai-sdk/react";

const THREAD_ID_KEY = "exeat_thread_id";

function buildWelcome(id = "welcome"): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Hello! I'm **ALEX**, your University Exeat Assistant. 👋\n\nI'm here to help you apply for an **exeat** — a formal permission to temporarily leave campus.\n\nWould you like to start an exeat application?",
      },
    ],
    // createdAt: new Date(),
  };
}

export default function ChatInterface() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Thread ID on mount safely (Hydration-friendly)
  useEffect(() => {
    const existingId = sessionStorage.getItem(THREAD_ID_KEY);
    const idToUse = existingId || uuidv4();
    if (!existingId) sessionStorage.setItem(THREAD_ID_KEY, idToUse);
    setThreadId(idToUse);
  }, []);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    stop,
    clearError,
  } = useChat({
    id: threadId || "pending-id", // Fallback while mounting
    messages: [buildWelcome()],
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { id, messages: msgs },
      }),
    }),
  });
  const stage = useExeatStage(messages);

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom cleanly
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Auto-resize textarea logic
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading || !threadId) return;

    sendMessage({ text: trimmed });
    setInputValue("");

    // Reset textarea height instantly
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetConversation = () => {
    stop();
    const newId = uuidv4();
    sessionStorage.setItem(THREAD_ID_KEY, newId);
    setThreadId(newId);
    setInputValue("");
    setMessages([buildWelcome(`welcome-${newId}`)]);

    // Safely refocus after React reconciles
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Wait for client mount to avoid hydration mismatch
  if (!threadId) return null;

  return (
    <div className="chat-shell flex flex-col h-full w-full">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="header-icon">
            <GraduationCap size={22} strokeWidth={1.8} />
          </div>
          <div>
            <span className="header-title">ALEX</span>
            <span className="header-sub">Exeat Assistant</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="status-pill">
            <ShieldCheck size={12} />
            <span>Secure</span>
          </div>
          <button
            className="reset-btn"
            onClick={resetConversation}
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </header>
      {/* <ExeatProgressBar stage={stage} /> */}
      {/* Messages */}
      <main
        className="chat-messages flex-1 overflow-y-auto p-4"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => {
          // Check if there are any text parts
          const hasText = msg.parts?.some(
            (p) => p.type === "text" && p.text.length > 0,
          );

          const isProcessingTool =
            !hasText && msg.parts?.some((p) => p.type === "tool-invocation");
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isProcessingTool={isProcessingTool}
            />
          );
        })}
        {isLoading && status !== "streaming" && <TypingIndicator />}

        {error && (
          <div className="error-banner" role="alert">
            {error.message || "Something went wrong."}
            <button onClick={() => clearError()} className="underline ml-2">
              Dismiss
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="chat-footer p-4 border-t">
        <div className="input-row relative flex items-center">
          <textarea
            ref={inputRef}
            className="chat-input flex-1 resize-none pr-12"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message… (Enter to send)"
            rows={1}
            disabled={isLoading || !threadId}
            aria-label="Message input"
            maxLength={2000}
          />
          <button
            className="send-btn absolute right-2"
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim() || !threadId}
            aria-label="Send message"
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
        <p className="footer-note text-xs text-center mt-2 text-gray-500">
          Your information is handled securely and only used for your exeat
          application.
        </p>
      </footer>
    </div>
  );
}
