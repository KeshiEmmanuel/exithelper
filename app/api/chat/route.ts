import { NextRequest, NextResponse } from "next/server";
import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "@ai-sdk/react";
import { exeatAgentGraph } from "@/langgraph/graph";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- 1. In-Memory Rate Limiter (with Garbage Collection) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

// Prevent memory leaks by sweeping expired IPs
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now > data.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_WINDOW_MS);

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

// --- 2. Stream Interceptor (Gemini Bug Fix) ---
async function* sanitizeGeminiStream(stream: AsyncIterable<any>) {
  for await (const event of stream) {
    // LangGraph often emits [chunk, metadata] tuples. We handle both tuple and raw chunk.
    const isTuple = Array.isArray(event);
    const chunk = isTuple ? event[0] : event;

    // Mutate the chunk by reference to fix Gemini's null tool-call content bug
    if (chunk && typeof chunk === "object") {
      if (chunk.content === null || chunk.content === undefined) {
        chunk.content = "";
      } else if (Array.isArray(chunk.content)) {
        chunk.content = chunk.content.filter((part: any) => part !== null);
      }
    }

    // Yield the exact same structure back to Vercel (mutated by reference)
    yield chunk;
  }
}

// --- 3. Route Handler ---
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
        { error: "thread ID is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array cannot be empty." },
        { status: 400 },
      );
    }

    // Convert only the last UIMessage to LangChain format
    const lastUIMessage = messages[messages.length - 1];
    const langchainMessages = await toBaseMessages([lastUIMessage]);

    // Stream the graph with messages mode for token-by-token streaming
    const graphStream = await exeatAgentGraph.stream(
      { messages: langchainMessages },
      {
        configurable: { thread_id: id },
        streamMode: "messages",
      },
    );

    // Pipe through the sanitizer into Vercel's adapter
    return createUIMessageStreamResponse({
      stream: toUIMessageStream(sanitizeGeminiStream(graphStream)),
    });
  } catch (error) {
    console.error("[API /chat] error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred. Please try again." },
      { status: 500 },
    );
  }
}
