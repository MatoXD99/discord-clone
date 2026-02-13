import type { DmConversation, FriendshipState, ServerItem, UserSummary } from "./Layout";
import { resolveMediaUrl } from "../apiClient";

type SidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    servers: ServerItem[];
    activeServerId: number | null;
    onServerSelect: (id: number) => void;
    activeChannelId: number | null;
    onChannelSelect: (id: number) => void;
    users: UserSummary[];
    friendships: FriendshipState;
    dmList: DmConversation[];
    activeView: "channel" | "friends" | "dm";
    activeDmId: number | null;
    onSelectFriends: () => void;
    onSelectDm: (conversationId: number) => void;
    onAddFriend: (userId: number) => void;
    onRespondFriendRequest: (requestId: number, accept: boolean) => void;
    onStartDm: (userId: number) => void;
};

export default function Sidebar(props: SidebarProps) {
    const {
        isOpen, onClose, servers, activeServerId, onServerSelect, activeChannelId, onChannelSelect,
        users, friendships, dmList, activeView, activeDmId, onSelectFriends, onSelectDm, onAddFriend, onRespondFriendRequest, onStartDm,
    } = props;

    const activeServer = servers.find((server) => server.id === activeServerId) || servers[0];

    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />}
            <aside className={`fixed md:static top-16 left-0 h-[calc(100vh-4rem)] md:h-full w-[340px] bg-[#111418] z-40 border-r border-white/10 flex transition-transform ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
                <div className="w-18 bg-[#0b0d10] border-r border-white/10 p-3 space-y-2">
                    {servers.map((server) => (
                        <button key={server.id} onClick={() => onServerSelect(server.id)} className={`w-12 h-12 rounded-2xl font-bold text-sm transition ${activeServerId === server.id ? "bg-indigo-500 text-white rounded-xl" : "bg-[#1a1f25] text-slate-200 hover:bg-[#222a33]"}`}>
                            {server.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-white/10">
                        <h2 className="font-semibold text-slate-100">{activeServer?.name || "Server"}</h2>
                    </div>

                    <div className="p-3 border-b border-white/10 space-y-1">
                        <button onClick={onSelectFriends} className={`w-full text-left px-3 py-2 rounded-md ${activeView === "friends" ? "bg-[#2e333a]" : "hover:bg-[#252a31] text-slate-300"}`}>Friends</button>
                        <div className="text-xs uppercase tracking-wider text-slate-500 mt-2 mb-1">Direct messages</div>
                        {dmList.map((dm) => (
                            <button key={dm.id} onClick={() => onSelectDm(dm.id)} className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 ${activeView === "dm" && activeDmId === dm.id ? "bg-[#2e333a]" : "hover:bg-[#252a31] text-slate-300"}`}>
                                {dm.user.avatarUrl ? <img src={resolveMediaUrl(dm.user.avatarUrl)} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-slate-600" />}
                                <span>{dm.user.displayName}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Channels</div>
                        <div className="space-y-1 mb-4">
                            {activeServer?.channels.map((channel) => (
                                <button key={channel.id} onClick={() => onChannelSelect(channel.id)} className={`w-full text-left px-3 py-2 rounded-md ${activeView === "channel" && activeChannelId === channel.id ? "bg-[#2e333a] text-white" : "text-slate-300 hover:bg-[#252a31]"}`}>
                                    # {channel.name}
                                </button>
                            ))}
                        </div>

                        <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Server users</div>
                        <div className="space-y-2">
                            {users.map((serverUser) => (
                                <div key={serverUser.id} className="bg-[#181c22] rounded-md p-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm text-slate-200 truncate">{serverUser.displayName}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => onAddFriend(serverUser.id)} className="text-xs px-2 py-1 bg-slate-700 rounded">+ Friend</button>
                                            <button onClick={() => onStartDm(serverUser.id)} className="text-xs px-2 py-1 bg-slate-600 rounded">DM</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {activeView === "friends" && (
                            <>
                                <div className="text-xs uppercase tracking-wider text-slate-500 mt-6 mb-2">Pending requests</div>
                                {friendships.pendingIncoming.map((item) => (
                                    <div key={item.id} className="bg-[#181c22] rounded-md p-2 mb-2 flex items-center justify-between">
                                        <span>{item.user.displayName}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => onRespondFriendRequest(item.id, true)} className="text-xs px-2 py-1 bg-emerald-700 rounded">Accept</button>
                                            <button onClick={() => onRespondFriendRequest(item.id, false)} className="text-xs px-2 py-1 bg-rose-700 rounded">Decline</button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
