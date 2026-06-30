"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import {  ArrowUp } from "lucide-react";

const THREAD_ID_KEY = "exeat_thread_id";

// ─── Shared input ─────────────────────────────────────────────────────────────
// Extracted to avoid duplicating the textarea across pre-chat and active-chat.

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

function ChatInput({ value, onChange, onSend, disabled = false }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  // Reset height when value is cleared from outside (e.g. after send)
  useEffect(() => {
    if (!value && ref.current) ref.current.style.height = "auto";
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <footer className="mb-10">
      <div className="max-w-150 mx-auto  w-full h-42.5 bg-white flex flex-col textbox_shadow px-5 py-4">
        <textarea
          ref={ref}
          className="w-full h-full font-instrument  outline-none flex-1 resize-none"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Waiting for your reply..."
          rows={1}
          disabled={disabled}
          aria-label="Message input"
          maxLength={2000}
        />
        <button
          className="text-white bg-primary rounded-full w-fit p-0.5 self-end"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
        >
          <ArrowUp className=""  size={24}/>
        </button>
      </div>
    </footer>
  );
}

// ─── Active chat ──────────────────────────────────────────────────────────────
// Only ever mounts with a real, stable threadId — so useChat never sees a
// changing `id` prop and never silently re-initialises mid-conversation.

interface ActiveChatProps {
  threadId: string;       // guaranteed non-null at this point
  firstMessage: string | null; // queued message from the pre-chat input
  onReset: () => void;
}

function ActiveChat({ threadId, firstMessage, onReset }: ActiveChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const didSendFirst = useRef(false); // guard against StrictMode double-fire

  const { messages, sendMessage, status, error, stop, clearError } = useChat({
    id: threadId, // stable for the entire lifetime of this component
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages: msgs }) => ({
        body: { id, messages: msgs },
      }),
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // ── Send the queued first message exactly once on mount ───────────────────
  useEffect(() => {
    if (firstMessage && !didSendFirst.current) {
      didSendFirst.current = true;
      sendMessage({ text: firstMessage });
    }
    // Intentional empty deps: we only want this to fire once on mount.
    // `firstMessage` and `sendMessage` are stable at this point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop any in-flight stream on unmount (prevents zombie requests) ───────
  useEffect(() => () => { stop(); }, [stop]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handleReset = () => {
    stop(); // cancel any in-flight request before unmounting
    try { sessionStorage.removeItem(THREAD_ID_KEY); } catch {}
    onReset(); // parent sets threadId → null → this component unmounts
  };

  return (
    <>
      {/* <div className="header-actions">
        <button
          className="reset-btn"
          onClick={handleReset}
          title="Start new conversation"
          aria-label="Start new conversation"
        >
          <RotateCcw size={15} />
        </button>
      </div> */}

      <main
        className="max-w-[600px] mx-auto w-full  flex-1 overflow-y-auto p-4 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => {
          const hasText = msg.parts?.some(
            (p) => p.type === "text" && p.text.length > 0
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

        {/*
          Show the typing indicator only while waiting for the first token.
          Once streaming begins the live text is visible, so we hide it.
        */}
      {status === "submitted" && (
  <div className=" px-4 py-3">
    <div className="flex justify-start">
      <p className="text-gray-400 font-script  animate-pulse">Alex is thinking...</p>
    </div>
  </div>
)}

        {error && (
          <div className="font-script" role="alert">
            {error.message || "Something went wrong."}
            <button onClick={clearError} className="underline ml-2">
Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading}
      />
    </>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
// Owns the session lifecycle. A threadId only exists (and is persisted) once
// the user sends their first message — not on page load.

export default function ChatInterface() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Restore an existing session on mount. Wrapped in try/catch for safety in
  // SSR edge runtimes that may not have sessionStorage at all.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(THREAD_ID_KEY);
      if (stored) setThreadId(stored);
    } catch {}
    setHydrated(true);
  }, []);

  // Called when the user sends their very first message in a new session.
  const startSession = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const id = uuidv4();
    try { sessionStorage.setItem(THREAD_ID_KEY, id); } catch {}

    // Batch these so ActiveChat receives both on the same render.
    setFirstMessage(trimmed);
    setThreadId(id);
    setInput("");
  };

  // Called by ActiveChat after the user clicks the reset button.
  const handleReset = () => {
    setThreadId(null);
    setFirstMessage(null);
    setInput("");
    // No requestAnimationFrame hack — React naturally re-renders the
    // pre-chat input, so focus can be added via autoFocus if desired.
  };

  // Avoid a hydration mismatch: don't render anything until sessionStorage
  // has been checked on the client.
  if (!hydrated) return null;

  return (
    <div className="chat-shell flex flex-col justify-center  h-screen w-full">
      {threadId ? (
        // ── Active session ──────────────────────────────────────────────────
        <ActiveChat
          threadId={threadId}
          firstMessage={firstMessage}
          onReset={handleReset}
        />
      ) : (
        // ── No session yet — show welcome + pre-chat input ──────────────────
        <>
          <main className="mx-auto w-full max-w-[600px] font-script mb-2 text-text-primary">
          <h1 className="text-4xl inline-flex gap-2">Hello Dear <img src="/logo.svg" alt="logo"/> </h1>
          <p  className="text-4xl">Need Help in creating your exeat request?</p>
          </main>

          <ChatInput value={input} onChange={setInput} onSend={startSession} />
        </>
      )}
    </div>
  );
}
