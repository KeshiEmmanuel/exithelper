"use client";

import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";
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

  if (!textContent && !isToolRunning) return null;

  return (
    /* Outer row: full-width dashed border container */
    <div className="max-w-[600px] mx-auto  px-4 py-3 font-instrument">

      {/* Inner: flex row that pushes bubble left (assistant) or right (user) */}
      <div
        className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
      >
        {/* Bubble */}
        <div
          className={`
            max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
            ${
              isAssistant
                ? "bg-white text-gray-800 rounded-tl-sm textbox_shadow"
                : "bg-primary text-white rounded-tr-sm"
            }
          `}
        >
          {textContent &&
            (isAssistant ? (
              <ReactMarkdown
                components={{
                  code: ({ children }) => (
                    <code className="bg-gray-100 rounded px-1 text-xs font-mono">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-gray-100 rounded p-2 text-xs overflow-x-auto my-1">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 hover:text-blue-800"
                    >
                      {children}
                    </a>
                  ),
                  p: ({ children }) => (
                    <p className="mb-1 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside my-1 space-y-0.5">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside my-1 space-y-0.5">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                }}
              >
                {textContent}
              </ReactMarkdown>
            ) : (
              <p>{textContent}</p>
            ))}

          {isToolRunning && (
            <div
              className={`flex items-center gap-1.5 text-xs italic ${
                textContent ? "mt-2 pt-2 border-t border-gray-200/30 opacity-80" : ""
              }`}
            >
              <Loader2 size={12} className="animate-spin" />
              <span>{toolLoadingMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
