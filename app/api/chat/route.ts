import { NextRequest, NextResponse } from "next/server";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "@ai-sdk/react";
import { exeatAgentGraph } from "@/langgraph/graph";

export const runtime = "nodejs";
export const maxDuration = 60;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const body = await req.json();
    const { id, messages } = body as { id: string; messages: UIMessage[] };

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id (thread ID) is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required and cannot be empty." },
        { status: 400 },
      );
    }

    // Only the newest UIMessage needs converting — prior turns are already
    // persisted in LangGraph's MemorySaver checkpoint for this thread_id.
    const lastUIMessage = messages[messages.length - 1];
    const langchainMessages = await toBaseMessages([lastUIMessage]);

    // Official pattern from ai-sdk.dev/providers/adapters/langchain
    // ("Example: LangChain Agent with Tools" / "Example: LangGraph"):
    //
    //   const stream = await graph.stream(
    //     { messages: langchainMessages },
    //     { streamMode: ['values', 'messages', 'tools'] },
    //   );
    //   return createUIMessageStreamResponse({
    //     stream: toUIMessageStream(stream),
    //   });
    //
    // toUIMessageStream "automatically detects the stream type" for this
    // exact multi-mode array shape. It already knows how to:
    //   - stream assistant text token-by-token (from "messages" mode)
    //   - surface tool calls/results as structured tool UI parts, NOT as
    //     visible text (from "tools" mode) — this is what keeps our tools'
    //     JSON.stringify(...) output from ever leaking into the chat
    //   - reconcile everything against full state snapshots ("values" mode)
    //
    // No custom stream transformation is needed or supported — passing a
    // hand-rolled AsyncIterable strips the [modeName, payload] discriminator
    // tuples the parser depends on, which is what broke the stream entirely
    // in the previous version of this file.
    const graphStream = await exeatAgentGraph.stream(
      { messages: langchainMessages },
      {
        configurable: { thread_id: id },
        streamMode: ["values", "messages", "tools"],
      },
    );

    return createUIMessageStreamResponse({
      stream: toUIMessageStream(graphStream),
    });
  } catch (error) {
    console.error("[API /chat] error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred. Please try again." },
      { status: 500 },
    );
  }
}
