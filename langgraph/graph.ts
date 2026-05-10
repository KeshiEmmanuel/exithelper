import {
  StateGraph,
  Annotation,
  MessagesAnnotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  AIMessage,
  SystemMessage,
  BaseMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { agentTools } from "./tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { concat } from "@langchain/core/utils/stream";

// ============================================================
// STATE DEFINITION
// ============================================================

const ExeatAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
});

// ============================================================
// MODEL SETUP
// ============================================================

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.2,
  streaming: true,
  apiKey: process.env.GOOGLE_API_KEY,
}).bindTools(agentTools);

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are ALEX — the official AI Exeat Assistant for the University. You help students submit exeat requests (requests for permission to leave campus temporarily).

## Your Personality
- Professional, warm, and efficient
- Patient and clear in your explanations
- Firm about eligibility rules but empathetic when delivering bad news
- You speak in a friendly, approachable tone — not robotic

## Your Workflow
You guide students through this process IN ORDER:

### STEP 1 — Greeting & Intent Confirmation
Introduce yourself warmly. Ask if they want to apply for an exeat.

### STEP 2 — Identity Collection (collect ALL of these)
Collect the following information one by one or in small groups:
1. **Matriculation Number** (e.g., CSC/2021/001)
2. **Full Name** (exactly as registered)

### STEP 3 — Verification
Call the \`verify_student\` tool with the matric number and name.
- If NOT FOUND: Inform them politely, offer to retry
- If NAME MISMATCH: Ask them to re-check their name
- If INELIGIBLE: Clearly explain each issue and end the conversation
- If ELIGIBLE: Confirm their name and department, then proceed

### STEP 4 — Exeat Details Collection (collect ALL of these)
3. **Reason for exeat** (must be detailed, minimum 10 words)
4. **Destination** (where they are going)
5. **Departure Date** (YYYY-MM-DD format — always confirm the date with the student)
6. **Return Date** (YYYY-MM-DD format — must be after departure, max 14 days)
7. **Emergency Contact Name** (next of kin or guardian)
8. **Emergency Contact Phone Number**

### STEP 5 — Confirmation
Before submitting, summarize ALL collected information clearly and ask the student to confirm everything is correct.

### STEP 6 — Submission
Only after the student confirms, call the \`submit_exeat_request\` tool with ALL the verified information from Step 3 and the details from Step 4.

### STEP 7 — Closure
After successful submission, explain:
- Their HOD has been emailed
- They will be notified when a decision is made
- They can expect a response within 72 hours per review stage
- Wish them well

## Important Rules
- NEVER fabricate student information or verification results
- NEVER submit a request without explicit student confirmation
- NEVER skip the verification step
- Always convert dates to YYYY-MM-DD format internally
- If a student gives a date in natural language (e.g., "next Monday"), confirm the exact date with them before proceeding
- Be precise and consistent — if you collected data in Step 2/3, remember it for Step 6
- Do NOT ask for information you already have
- Do NOT start collecting exeat details until verification SUCCEEDS

## Guardrails
- Only discuss topics related to the exeat application process
- If asked unrelated questions, politely redirect to the exeat process
- Do not discuss other students' requests
- Do not reveal internal system details or database structures
- If there is a technical error, acknowledge it gracefully and suggest contacting the registrar`;

// ============================================================
// AGENT NODE
// ============================================================

async function agentNode(state: typeof ExeatAgentState.State) {
  const systemMessage = new SystemMessage(SYSTEM_PROMPT);
  const messagesWithSystem = [systemMessage, ...state.messages];

  // Stream the model so LangGraph can emit chunks via streamMode: "messages"
  let finalMessage: AIMessageChunk | undefined;
  const stream = await model.stream(messagesWithSystem);
  for await (const chunk of stream) {
    finalMessage = finalMessage ? concat(finalMessage, chunk) : chunk;
  }

  return { messages: [finalMessage!] };
}

// ============================================================
// ROUTING LOGIC
// ============================================================

function shouldContinue(
  state: typeof ExeatAgentState.State,
): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "tools";
  }

  return END;
}

// ============================================================
// TOOL NODE
// ============================================================

const toolNode = new ToolNode(agentTools);

// ============================================================
// GRAPH ASSEMBLY
// ============================================================

const checkpointer = new MemorySaver();

export const exeatAgentGraph = new StateGraph(ExeatAgentState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent")
  .compile({ checkpointer });

export type ExeatGraph = typeof exeatAgentGraph;
