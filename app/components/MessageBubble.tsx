"use client";

import ReactMarkdown from "react-markdown";
import { useMemo } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface MessageBubbleProps {
  message: Message;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  const timeLabel = useMemo(
    () => formatTime(message.createdAt),
    [message.createdAt],
  );

  return (
    <div
      className={`message-row ${isAssistant ? "message-row--assistant" : "message-row--user"}`}
      aria-label={`${isAssistant ? "Assistant" : "You"} said`}
    >
      {/* Avatar */}
      {/* {isAssistant && (
        <div className="avatar avatar--assistant" aria-hidden="true"></div>
      )} */}

      {/* Bubble */}
      <div className="bubble-wrapper">
        <div
          className={`bubble ${isAssistant ? "bubble--assistant" : "bubble--user"}`}
        >
          {isAssistant ? (
            /* Render markdown for assistant messages */
            <ReactMarkdown
              components={{
                // Inline code
                code: ({ children }) => (
                  <code className="inline-code">{children}</code>
                ),
                // Code blocks
                pre: ({ children }) => (
                  <pre className="code-block">{children}</pre>
                ),
                // Links — open in new tab, no opener
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bubble-link"
                  >
                    {children}
                  </a>
                ),
                // Paragraphs with tight spacing
                p: ({ children }) => <p className="text-sm">{children}</p>,
                // Lists
                ul: ({ children }) => (
                  <ul className="bubble-list">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="bubble-list bubble-list--ordered">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="bubble-list-item">{children}</li>
                ),
                // Strong/bold
                strong: ({ children }) => (
                  <strong className="bubble-strong">{children}</strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            /* Plain text for user messages */
            <p className="text-sm">{message.content}</p>
          )}
        </div>

        {/* Timestamp */}
        <span
          className={`bubble-time ${isAssistant ? "bubble-time--left" : "bubble-time--right"} text-xs text-gray-700`}
          aria-label={`Sent at ${timeLabel}`}
        >
          {timeLabel}
        </span>
      </div>
    </div>
  );
}
