"use client";

import { GraduationCap } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div
      className="message-row message-row--assistant"
      role="status"
      aria-label="ALEX is typing"
    >
      <div className="bubble-wrapper">
        <div className="bubble bubble--assistant flex gap-1 bg-white p-4 rounded-full card-2 w-fit">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400  animate-bounce [animation-delay:0ms]" />
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400  animate-bounce [animation-delay:100ms]" />
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400  animate-bounce [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
