import { ChatInterface } from "./chat-interface";

export default function AIPage() {
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <div className="flex items-center justify-between px-1 py-2">
        <h1 className="text-lg font-bold tracking-tight">Asistente IA</h1>
      </div>
      <ChatInterface userId="default-user" />
    </div>
  );
}
