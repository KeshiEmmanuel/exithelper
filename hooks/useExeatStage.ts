import { useMemo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { isToolPart } from "@/types";

export type ExeatStage =
  | "greeting"
  | "identity"
  | "verifying"
  | "details"
  | "confirming"
  | "submitting"
  | "complete";

export const STAGE_ORDER: ExeatStage[] = [
  "greeting",
  "identity",
  "verifying",
  "details",
  "confirming",
  "submitting",
  "complete",
];

export const STAGE_LABELS: Record<ExeatStage, string> = {
  greeting: "Start",
  identity: "Identity",
  verifying: "Verify",
  details: "Details",
  confirming: "Confirm",
  submitting: "Submit",
  complete: "Done ✓",
};

function getAllText(messages: UIMessage[]): string {
  return messages
    .flatMap(
      (m) =>
        m.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text",
          )
          .map((p) => p.text) ?? [],
    )
    .join(" ")
    .toLowerCase();
}
function hasToolInState(
  messages: UIMessage[],
  toolName: string,
  states: string[],
): boolean {
  return messages.some((m) =>
    m.parts?.some(
      (p) =>
        isToolPart(p) &&
        p.type === `tool-${toolName}` &&
        states.includes(p.state),
    ),
  );
}

export function useExeatStage(messages: UIMessage[]): ExeatStage {
  return useMemo(() => {
    const text = getAllText(messages);

    const verifyingNow = hasToolInState(messages, "verify_student", [
      "call",
      "partial-call",
    ]);
    const submittingNow = hasToolInState(messages, "submit_exeat_request", [
      "call",
      "partial-call",
    ]);
    const verifyDone = hasToolInState(messages, "verify_student", ["result"]);
    const submitDone = hasToolInState(messages, "submit_exeat_request", [
      "result",
    ]);

    if (submittingNow) return "submitting";
    if (submitDone || text.includes("reference id")) return "complete";
    if (
      text.includes("please confirm") ||
      text.includes("is everything correct")
    )
      return "confirming";
    if (verifyDone && (text.includes("reason") || text.includes("destination")))
      return "details";
    if (verifyingNow || verifyDone) return "verifying";
    if (
      text.includes("matric") ||
      text.includes("full name") ||
      messages.length > 2
    )
      return "identity";

    return "greeting";
  }, [messages]);
}
