"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "./MessageBubble";
import { Send, RotateCcw } from "lucide-react";
import TypingIndicator from "./TypingIndicator";

const THREAD_ID_KEY = "exeat_thread_id";

function getOrCreateThreadId(): string {
  let tid = sessionStorage.getItem(THREAD_ID_KEY);
  if (!tid) {
    tid = uuidv4();
    sessionStorage.setItem(THREAD_ID_KEY, tid);
  }
  return tid;
}

function extractText(parts: unknown[]): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" &&
        p !== null &&
        (p as any).type === "text" &&
        typeof (p as any).text === "string",
    )
    .map((p) => p.text)
    .join("");
}

const WELCOME_TEXT =
  "Hey it is Alex here, Would you like to start an exeat application?";

export default function ChatInterface() {
  const [threadId, setThreadId] = useState<string>("");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // sessionStorage is client-only — initialise on mount
  useEffect(() => {
    setThreadId(getOrCreateThreadId());
  }, []);

  // Keep a ref so the transport closure always sees the latest threadId
  // without needing to recreate the transport on every render
  const threadIdRef = useRef(threadId);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    regenerate,
    clearError,
  } = useChat({
    onError: (err) => console.error("useChat error:", err),
    // v5: api / body / headers move into DefaultChatTransport (imported from "ai")
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Shape the exact JSON body our API route expects
      prepareSendMessagesRequest({ messages: msgs }) {
        const lastMsg = msgs[msgs.length - 1];
        const text = extractText((lastMsg?.parts as unknown[]) ?? []);
        console.log(">>> sending:", {
          text,
          threadId: threadIdRef.current,
          parts: lastMsg?.parts,
        });
        return {
          headers: { "Content-Type": "application/json" },
          body: {
            message: text,
            threadId: threadIdRef.current,
          },
        };
      },
    }),
    // v5: "initialMessages" renamed to "messages"
    messages: [
      {
        id: "welcome",
        role: "assistant",
        parts: [{ type: "text", text: WELCOME_TEXT }],
      },
    ],
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading || !threadId) return;
    // v5: sendMessage({ text }) replaces handleSubmit
    sendMessage({ text });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
  }, [input, isLoading, threadId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const resetConversation = () => {
    const newId = uuidv4();
    sessionStorage.setItem(THREAD_ID_KEY, newId);
    setThreadId(newId);
    threadIdRef.current = newId;
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Hi! its me Alex,.\n\nWould you like to start an exeat application?",
          },
        ],
      },
    ]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="chat-shell max-w-[600px] py-2  h-screen w-full  mx-auto flex flex-col  justify-between">
      {/* Header */}
      <header className="chat-header relative z-10 flex items-center w-full justify-between bg-[#f5f5f5] py-2">
        <div className="header-brand">
          <div className="header-title font-semibold">ALEX</div>
        </div>
        <div className="header-actions">
          <button
            className="reset-btn text-white p-2 rounded-full"
            onClick={resetConversation}
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <main
        className="chat-messages w-full flex flex-col gap-5 flex-1 overflow-y-auto p-2 [&::-webkit-scrollbar]:hidden"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((msg) => {
          const text = extractText((msg.parts as unknown[]) ?? []);
          return (
            <div key={msg.id} className={`msg-row ${msg.role}`}>
              {/* <div className={`msg-avatar ${msg.role}`}>
                {msg.role === "assistant" ? "AI" : "You"}
              </div> */}
              <div
                className={`msg-bubble ${msg.role === "assistant" ? "bg-gray-200  p-2 card-2 rounded-lg mr-20" : "user_message p-2 text-black rounded-lg w-full ml-14  self-end"} ${msg.role}`}
              >
                <MessageBubble
                  message={{
                    id: msg.id,
                    role: msg.role as "user" | "assistant",
                    content: text,
                    createdAt: new Date(),
                  }}
                />
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="typing-row">
            <TypingIndicator />
          </div>
        )}

        {error && (
          <div className="error-banner" role="alert">
            Something went wrong.{" "}
            <button
              onClick={() => {
                clearError();
                regenerate();
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="chat-footer relative z-10 w-full">
        <div className="bg-gray-200 p-2 card-2 rounded-lg">
          <div className="input-row bg-white flex flex-col max-w-150 rounded-lg p-4 w-full border-gray-300 border">
            <textarea
              ref={inputRef}
              className="chat-input outline-none w-full resize-none  h-25"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
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
              className="send-btn self-end p-2 rounded-full text-black"
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !threadId}
              aria-label="Send message"
            >
              <Send size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
        <p className="text-xs text-center py-4 text-gray-600">
          Your information is handled securely and only used for your exeat
          application.
        </p>
      </footer>
    </div>
  );
}
