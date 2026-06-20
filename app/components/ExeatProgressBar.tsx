"use client";

import { Check, Loader2 } from "lucide-react";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  type ExeatStage,
} from "@/hooks/useExeatStage";

export default function ExeatProgressBar({ stage }: { stage: ExeatStage }) {
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-white/60 backdrop-blur-sm">
      {STAGE_ORDER.map((s, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        const isPending = i > currentIndex;

        return (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 transition-opacity ${isPending ? "opacity-30" : "opacity-100"}`}
            >
              <span
                className={`
                  w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                  text-[10px] font-bold transition-all duration-300
                  ${isDone ? "bg-green-500 text-white" : ""}
                  ${isActive ? "bg-blue-600 text-white ring-2 ring-blue-100" : ""}
                  ${isPending ? "bg-gray-100 text-gray-400 border border-gray-200" : ""}
                `}
              >
                {isDone && <Check size={10} strokeWidth={3} />}
                {isActive && <Loader2 size={10} className="animate-spin" />}
                {isPending && <span>{i + 1}</span>}
              </span>

              <span
                className={`
                  hidden sm:inline text-[11px] font-medium transition-colors
                  ${isActive ? "text-blue-600" : ""}
                  ${isDone ? "text-green-600" : ""}
                  ${isPending ? "text-gray-400" : ""}
                `}
              >
                {STAGE_LABELS[s]}
              </span>
            </div>

            {i < STAGE_ORDER.length - 1 && (
              <div
                className={`
                  w-3 sm:w-5 h-px mx-1 transition-colors duration-500
                  ${i < currentIndex ? "bg-green-400" : "bg-gray-200"}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
