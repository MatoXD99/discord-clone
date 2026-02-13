import { useMemo, useState } from "react";
import ChatArea from "./ChatArea";
import Login from "./Login";
import MembersSidebar from "./MembersSidebar";
import Register from "./Register";
import SidebarChannels from "./SidebarChannels";
import SidebarServers from "./SidebarServers";
import type { ChannelItem, MemberItem, MessageItem, ServerItem } from "./types";

const SERVERS: ServerItem[] = [
  { id: "chat-hub", name: "Chat Hub", label: "CH" },
  { id: "dev-team", name: "Dev Team", label: "DT" },
  { id: "ops", name: "Operations", label: "OP" },
  { id: "design", name: "Design", label: "DS" },
];

const CHANNELS: ChannelItem[] = [
  { id: "general", name: "general", serverId: "chat-hub" },
  { id: "random", name: "random", serverId: "chat-hub" },
  { id: "announcements", name: "announcements", serverId: "chat-hub" },
  { id: "frontend", name: "frontend", serverId: "dev-team" },
  { id: "backend", name: "backend", serverId: "dev-team" },
  { id: "infra", name: "infra", serverId: "ops" },
  { id: "on-call", name: "on-call", serverId: "ops" },
  { id: "reviews", name: "reviews", serverId: "design" },
];

const MEMBERS: MemberItem[] = [
  { id: "1", name: "Noah" },
  { id: "2", name: "Avery" },
  { id: "3", name: "Mia" },
  { id: "4", name: "Liam" },
  { id: "5", name: "Emma" },
];

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: "m-1",
    channelId: "general",
    author: "Noah",
    text: "Welcome to the new dark mode chat layout.",
    time: "09:30",
  },
  {
    id: "m-2",
    channelId: "general",
    author: "Avery",
    text: "Everything stays grayscale for a clean Discord-style look.",
    time: "09:34",
  },
  {
    id: "m-3",
    channelId: "random",
    author: "Mia",
    text: "Type into the input and press Enter to post a message.",
    time: "09:35",
  },
];

const currentTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export default function Layout() {
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [activeServerId, setActiveServerId] = useState(SERVERS[0].id);
  const [activeChannelId, setActiveChannelId] = useState("general");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  const channelsForServer = useMemo(
    () => CHANNELS.filter((channel) => channel.serverId === activeServerId),
    [activeServerId],
  );

  const activeChannel =
    channelsForServer.find((channel) => channel.id === activeChannelId) ||
    channelsForServer[0];

  const channelMessages = useMemo(
    () => messages.filter((message) => message.channelId === activeChannel?.id),
    [messages, activeChannel],
  );

  const handleServerSelect = (serverId: string) => {
    setActiveServerId(serverId);
    const firstChannel = CHANNELS.find((channel) => channel.serverId === serverId);
    if (firstChannel) setActiveChannelId(firstChannel.id);
  };

  const handleSendMessage = (text: string) => {
    if (!activeChannel || !authUser) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        channelId: activeChannel.id,
        author: authUser,
        text,
        time: currentTime(),
      },
    ]);
  };

  const handleAuth = (username: string) => {
    setAuthUser(username);
  };

  if (!authUser) {
    if (showRegister) {
      return (
        <Register
          onSubmit={handleAuth}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }

    return (
      <Login
        onSubmit={handleAuth}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#1e1f22] text-zinc-100">
      <SidebarServers
        servers={SERVERS}
        activeServerId={activeServerId}
        onSelectServer={handleServerSelect}
      />

      <SidebarChannels
        channels={channelsForServer}
        activeChannelId={activeChannel?.id || ""}
        onSelectChannel={setActiveChannelId}
      />

      <ChatArea
        channelName={activeChannel?.name || "general"}
        messages={channelMessages}
        onSendMessage={handleSendMessage}
      />

      <MembersSidebar members={MEMBERS} />
    </div>
  );
}
