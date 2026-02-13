import type { ChannelItem } from "./types";

type SidebarChannelsProps = {
  channels: ChannelItem[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
};

export default function SidebarChannels({
  channels,
  activeChannelId,
  onSelectChannel,
}: SidebarChannelsProps) {
  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900 p-4">
      {/* Channel list panel */}
      <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Channels
      </h2>
      <ul className="mt-3 space-y-1 overflow-y-auto">
        {channels.map((channel) => {
          const isActive = channel.id === activeChannelId;

          return (
            <li key={channel.id}>
              <button
                onClick={() => onSelectChannel(channel.id)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition ${
                  isActive
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                <span className="mr-1 text-zinc-500">#</span>
                {channel.name}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
