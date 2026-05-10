import { NextRequest, NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { exeatAgentGraph } from "@/langgraph/graph";
import { toUIMessageStream } from "@ai-sdk/langchain";
import { createUIMessageStreamResponse } from "ai";

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
    const { message, threadId } = body as {
      message: string;
      threadId: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid request: message is required." },
        { status: 400 },
      );
    }

    if (!threadId || typeof threadId !== "string") {
      return NextResponse.json(
        { error: "Invalid request: threadId is required." },
        { status: 400 },
      );
    }

    const sanitizedMessage = message.slice(0, 2000).trim();
    if (!sanitizedMessage) {
      return NextResponse.json(
        { error: "Message cannot be empty." },
        { status: 400 },
      );
    }

    const langGraphStream = await exeatAgentGraph.stream(
      { messages: [new HumanMessage(sanitizedMessage)] },
      {
        configurable: { thread_id: threadId },
        streamMode: ["values", "messages"], // ← array, not a string
      },
    );

    const uiStream = toUIMessageStream(langGraphStream);

    // Tee the stream — one for logging, one for the response
    const [debugStream, responseStream] = uiStream.tee();
    (async () => {
      const reader = debugStream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          console.log("[stream chunk]:", value);
        }
      } finally {
        reader.releaseLock();
      }
    })();

    return createUIMessageStreamResponse({ stream: responseStream });
  } catch (error) {
    console.error("[API /chat] Unhandled error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred. Please try again." },
      { status: 500 },
    );
  }
}
