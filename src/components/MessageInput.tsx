import { useState } from "react";
import type { KeyboardEvent } from "react";

type MessageInputProps = {
  activeChannelName: string;
  onSendMessage: (text: string) => void;
};

export default function MessageInput({
  activeChannelName,
  onSendMessage,
}: MessageInputProps) {
  const [value, setValue] = useState("");

  const send = () => {
    const next = value.trim();
    if (!next) return;
    onSendMessage(next);
    setValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur">
      {/* Sticky composer */}
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition hover:border-zinc-600 focus:border-zinc-500"
        placeholder={`Message #${activeChannelName}`}
      />
    </div>
  );
}
