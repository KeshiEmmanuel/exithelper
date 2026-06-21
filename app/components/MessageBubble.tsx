"use client";

import ReactMarkdown from "react-markdown";
import { GraduationCap, User, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { getToolName, isToolActive, isToolPart } from "@/types";

interface MessageBubbleProps {
  message: UIMessage;
  isProcessingTool?: boolean;
}

function getFriendlyToolMessage(toolName: string): string {
  const toolDictionary: Record<string, string> = {
    verify_student: "Verifying student ID...",
    check_dates: "Checking campus calendar...",
    get_guardian_contact: "Retrieving guardian details...",
    submit_exeat_request: "Submitting exeat application...",
    check_disciplinary_record: "Reviewing student clearance...",
  };
  return (
    toolDictionary[toolName] || `Running ${toolName.replace(/_/g, " ")}...`
  );
}

export default function MessageBubble({
  message,
  isProcessingTool,
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const textContent = useMemo(() => {
    return (
      message.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") ?? ""
    );
  }, [message.parts]);

  const activeTool = message.parts?.find(
    (p): p is ReturnType<typeof Array.prototype.find> =>
      isToolPart(p) && isToolActive(p),
  );

  const isToolRunning = !!activeTool || isProcessingTool;

  const toolLoadingMessage =
    activeTool && isToolPart(activeTool)
      ? getFriendlyToolMessage(getToolName(activeTool))
      : "Checking system...";

  // Hide completely ONLY if there is no text AND no tool is running
  if (!textContent && !isToolRunning) return null;

  return (
    <div
      className={`message-row ${isAssistant ? "message-row--assistant" : "message-row--user"}`}
    >
      {isAssistant && (
        <div className="avatar avatar--assistant" aria-hidden="true">
          <GraduationCap size={16} strokeWidth={1.8} />
        </div>
      )}

      <div className="bubble-wrapper">
        <div
          className={`bubble ${isAssistant ? "bubble--assistant" : "bubble--user"}`}
        >
          {textContent &&
            (isAssistant ? (
              <ReactMarkdown
                components={{
                  code: ({ children }) => (
                    <code className="inline-code">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="code-block">{children}</pre>
                  ),
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
                  p: ({ children }) => (
                    <p className="bubble-paragraph">{children}</p>
                  ),
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
                  strong: ({ children }) => (
                    <strong className="bubble-strong">{children}</strong>
                  ),
                }}
              >
                {textContent}
              </ReactMarkdown>
            ) : (
              <p className="bubble-paragraph">{textContent}</p>
            ))}

          {isToolRunning && (
            <div
              className={`tool-indicator flex items-center gap-2 text-sm ${textContent ? "mt-2 pt-2 border-t border-gray-200/20 opacity-80" : ""}`}
            >
              <Loader2 size={14} className="animate-spin" />
              <span className="italic">{toolLoadingMessage}</span>
            </div>
          )}
        </div>
      </div>

      {!isAssistant && (
        <div className="avatar avatar--user" aria-hidden="true">
          <User size={16} strokeWidth={1.8} />
        </div>
      )}
    </div>
  );
}
