import { GraduationCap } from "lucide-react";
import ChatInterface from "./ChatInterface";

export default function HomePage() {
  return (
    <main className="font-sans-sm  max-w-[800px] mx-auto w-full">
      {/* The AI chatbot */}
      <ChatInterface />
    </main>
  );
}
