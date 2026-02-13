import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import type { MessageItem } from "./types";

type ChatAreaProps = {
  channelName: string;
  messages: MessageItem[];
  onSendMessage: (text: string) => void;
};

export default function ChatArea({
  channelName,
  messages,
  onSendMessage,
}: ChatAreaProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-[#1e1f22]">
      {/* Channel header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 px-4 flex items-center">
        <h1 className="text-base font-semibold text-zinc-100">
          <span className="mr-1 text-zinc-500">#</span>
          {channelName}
        </h1>
      </header>

      <MessageList messages={messages} />
      <MessageInput activeChannelName={channelName} onSendMessage={onSendMessage} />
    </section>
  );
}
