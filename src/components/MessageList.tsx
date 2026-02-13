import type { MessageItem } from "./types";

type MessageListProps = {
  messages: MessageItem[];
};

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
      {/* Message blocks */}
      {messages.map((message, index) => (
        <article
          key={message.id}
          className={`rounded-md border border-zinc-800 p-3 ${
            index % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/80"
          }`}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-zinc-100">{message.author}</span>
            <time className="text-xs text-zinc-500">{message.time}</time>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{message.text}</p>
        </article>
      ))}
    </div>
  );
}
