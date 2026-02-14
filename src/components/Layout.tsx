import { useState, useEffect, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import Login from "./Login";
import Register from "./Register";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Chat from "./Chat";
import { fetchJson, getSocketBaseUrl } from "../apiClient";

export type Channel = { id: number; name: string };
export type ServerItem = { id: number; name: string; channels: Channel[] };
export type UserProfile = {
    id: number;
    username: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
};
export type UserSummary = { id: number; username: string; displayName: string; avatarUrl: string | null };
export type DmConversation = { id: number; user: UserSummary; lastMessage?: { text?: string; type: string } | null };
export type FriendshipEntry = { id: number; user: UserSummary; status: string };
export type FriendshipState = {
    friends: FriendshipEntry[];
    pendingIncoming: FriendshipEntry[];
    pendingOutgoing: FriendshipEntry[];
};

const readStoredToken = () => (typeof window === "undefined" ? null : localStorage.getItem("authToken"));

export default function Layout() {
    const [authToken, setAuthToken] = useState<string | null>(() => readStoredToken());
    const [isAuthenticated, setIsAuthenticated] = useState(Boolean(readStoredToken()));
    const [user, setUser] = useState<UserProfile | null>(null);
    const [showRegister, setShowRegister] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [servers, setServers] = useState<ServerItem[]>([]);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [activeServerId, setActiveServerId] = useState<number | null>(null);
    const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
    const [activeDmId, setActiveDmId] = useState<number | null>(null);
    const [activeView, setActiveView] = useState<"channel" | "friends" | "dm">("channel");

    const [isConnected, setIsConnected] = useState(false);
    const [dmList, setDmList] = useState<DmConversation[]>([]);
    const [friendshipState, setFriendshipState] = useState<FriendshipState>({ friends: [], pendingIncoming: [], pendingOutgoing: [] });

    const handleLogout = useCallback(() => {
        localStorage.removeItem("authToken");
        setAuthToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setIsConnected(false);
        setActiveDmId(null);
        setActiveView("channel");
    }, []);

    useEffect(() => {
        if (!authToken || !isAuthenticated) return;

        const authHeaders = { Authorization: `Bearer ${authToken}` };

        Promise.all([
            fetchJson<{ user: UserProfile }>("/api/me", { method: "GET", headers: authHeaders }, "Failed to load profile"),
            fetchJson<{ servers: ServerItem[] }>("/api/servers", { method: "GET", headers: authHeaders }, "Failed to load servers"),
            fetchJson<{ users: UserSummary[] }>("/api/users", { method: "GET", headers: authHeaders }, "Failed to load users"),
        ])
            .then(([meResponse, serverResponse, usersResponse]) => {
                setUser(meResponse.user);
                setServers(serverResponse.servers);
                setUsers(usersResponse.users);

                const firstServer = serverResponse.servers[0];
                if (firstServer) {
                    setActiveServerId((prev) => prev ?? firstServer.id);
                    setActiveChannelId((prev) => prev ?? firstServer.channels[0]?.id ?? null);
                }
            })
            .catch((error) => {
                console.error("Startup fetch failed:", error);
                handleLogout();
            });
    }, [authToken, isAuthenticated, handleLogout]);

    const socket: Socket | null = useMemo(() => {
        if (!isAuthenticated || !authToken || !user) return null;
        return io(getSocketBaseUrl(), {
            auth: { token: authToken },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 20,
        });
    }, [isAuthenticated, authToken, user]);

    useEffect(() => {
        if (!socket) return;

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onError = (error: Error) => {
            console.error("Socket error:", error.message);
            setIsConnected(false);
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onError);
        socket.on("error", onError);
        socket.on("dm_list", setDmList);
        socket.on("friends_state", setFriendshipState);
        socket.on("dm_started", (conversation: DmConversation) => {
            setActiveView("dm");
            setActiveDmId(conversation.id);
        });

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onError);
            socket.off("error", onError);
            socket.off("dm_list", setDmList);
            socket.off("friends_state", setFriendshipState);
            socket.off("dm_started");
            socket.close();
        };
    }, [socket]);

    useEffect(() => {
        if (!socket || activeView !== "channel" || !activeServerId || !activeChannelId) return;
        const join = () => socket.emit("join_channel", { serverId: activeServerId, channelId: activeChannelId });
        if (socket.connected) join();
        socket.on("connect", join);
        return () => { socket.off("connect", join); };
    }, [socket, activeServerId, activeChannelId, activeView]);

    useEffect(() => {
        if (!socket || activeView !== "dm" || !activeDmId) return;
        const joinDm = () => socket.emit("join_dm", activeDmId);
        if (socket.connected) joinDm();
        socket.on("connect", joinDm);
        return () => { socket.off("connect", joinDm); };
    }, [socket, activeDmId, activeView]);

    const handleLoginSuccess = (token: string, profile: UserProfile) => {
        setAuthToken(token);
        setUser(profile);
        setIsAuthenticated(true);
        setShowRegister(false);
    };

    if (!isAuthenticated) {
        return showRegister
            ? <Register onRegisterSuccess={handleLoginSuccess} onSwitchToLogin={() => setShowRegister(false)} />
            : <Login onLoginSuccess={handleLoginSuccess} onSwitchToRegister={() => setShowRegister(true)} />;
    }

    const activeServer = servers.find((server) => server.id === activeServerId) || servers[0] || null;
    const activeChannel = activeServer?.channels.find((channel) => channel.id === activeChannelId) || activeServer?.channels[0] || null;
    const activeDm = dmList.find((dm) => dm.id === activeDmId) || null;

    return (
        <div className="flex flex-col h-screen bg-[#0d0f12] text-white">
            <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} user={user} authToken={authToken} onUserUpdate={setUser} onLogout={handleLogout} />
            <div className="flex-1 min-h-0">
                {!isConnected || !user ? (
                    <div className="h-full flex items-center justify-center text-center">
                        <div className="rounded-xl bg-[#15181c] border border-white/10 px-8 py-10">
                            <div className="mb-4 text-5xl">🔌</div>
                            <h2 className="text-2xl font-bold mb-2">Connecting to server...</h2>
                            <p className="text-slate-400">Make sure your backend API/socket server is reachable</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full overflow-hidden border-t border-white/10">
                        <Sidebar
                            isOpen={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                            servers={servers}
                            activeServerId={activeServer?.id || null}
                            onServerSelect={(serverId) => {
                                const selected = servers.find((server) => server.id === serverId);
                                setActiveServerId(serverId);
                                setActiveView("channel");
                                setActiveDmId(null);
                                setActiveChannelId(selected?.channels[0]?.id ?? null);
                            }}
                            activeChannelId={activeChannel?.id || null}
                            onChannelSelect={(channelId) => {
                                setActiveChannelId(channelId);
                                setActiveDmId(null);
                                setActiveView("channel");
                            }}
                            users={users}
                            friendships={friendshipState}
                            dmList={dmList}
                            activeView={activeView}
                            activeDmId={activeDmId}
                            onSelectFriends={() => {
                                setActiveView("friends");
                                setActiveDmId(null);
                            }}
                            onSelectDm={(conversationId) => {
                                setActiveView("dm");
                                setActiveDmId(conversationId);
                            }}
                            onAddFriend={(targetUserId) => socket?.emit("send_friend_request", targetUserId)}
                            onRespondFriendRequest={(requestId, accept) => socket?.emit("respond_friend_request", { requestId, accept })}
                            onStartDm={(targetUserId) => socket?.emit("start_dm", targetUserId)}
                            socket={socket}
                        />
                        {socket && user && (
                            <Chat
                                socket={socket}
                                activeView={activeView}
                                activeChannel={activeChannel ? { id: activeChannel.id, name: activeChannel.name, serverName: activeServer?.name || "" } : null}
                                activeDm={activeDm}
                                friendshipState={friendshipState}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
