import type { ServerItem } from "./types";

type SidebarServersProps = {
  servers: ServerItem[];
  activeServerId: string;
  onSelectServer: (serverId: string) => void;
};

export default function SidebarServers({
  servers,
  activeServerId,
  onSelectServer,
}: SidebarServersProps) {
  return (
    <aside className="w-18 shrink-0 border-r border-zinc-800 bg-zinc-950 p-3">
      {/* Server icon rail */}
      <ul className="flex h-full flex-col items-center gap-3 overflow-y-auto">
        {servers.map((server) => {
          const isActive = server.id === activeServerId;

          return (
            <li key={server.id}>
              <button
                onClick={() => onSelectServer(server.id)}
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold transition ${
                  isActive
                    ? "border-zinc-500 bg-zinc-700 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"
                }`}
                aria-label={`Switch to ${server.name}`}
              >
                {server.label}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
