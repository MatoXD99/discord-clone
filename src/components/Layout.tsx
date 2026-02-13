import { useState, useEffect, useCallback, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import Login from "./Login";
import Register from "./Register";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Chat from "./Chat";
import { fetchJson, getSocketBaseUrl } from "../apiClient";

type Channel = {
    id: string;
    name: string;
};

export type UserProfile = {
    id: number;
    username: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
};

const DEFAULT_CHANNELS: Channel[] = [
    { id: "general", name: "# General" },
    { id: "random", name: "# Random" },
    { id: "announcements", name: "# Announcements" },
    { id: "help", name: "# Help" },
    { id: "offtopic", name: "# Off-Topic" },
];

const readStoredToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
};

export default function Layout() {
    const [authToken, setAuthToken] = useState<string | null>(() => readStoredToken());
    const [isAuthenticated, setIsAuthenticated] = useState(Boolean(readStoredToken()));
    const [user, setUser] = useState<UserProfile | null>(null);
    const [showRegister, setShowRegister] = useState(false);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [channels] = useState<Channel[]>(DEFAULT_CHANNELS);
    const [activeChannel, setActiveChannel] = useState(DEFAULT_CHANNELS[0].id);
    const [isConnected, setIsConnected] = useState(false);

    const handleLogout = useCallback(() => {
        localStorage.removeItem("authToken");
        setAuthToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setIsConnected(false);
    }, []);

    useEffect(() => {
        if (!authToken || !isAuthenticated) return;

        fetchJson<{ user: UserProfile }>("/api/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        }, "Failed to load profile")
            .then((response) => setUser(response.user))
            .catch((error) => {
                console.error("Profile fetch failed:", error);
                handleLogout();
            });
    }, [authToken, isAuthenticated, handleLogout]);

    const socket: Socket | null = useMemo(() => {
        if (!isAuthenticated || !authToken) return null;

        return io(getSocketBaseUrl(), {
            auth: { token: authToken },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });
    }, [isAuthenticated, authToken]);

    useEffect(() => {
        if (!socket) return;

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        const onError = (error: Error) => {
            console.error("❌ Socket error:", error);
            setIsConnected(false);
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onError);
        socket.on("error", onError);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onError);
            socket.off("error", onError);
            socket.close();
        };
    }, [socket]);

    useEffect(() => {
        if (!socket) return;

        const joinActiveChannel = () => {
            socket.emit("join_channel", activeChannel);
        };

        if (socket.connected) {
            joinActiveChannel();
        }

        socket.on("connect", joinActiveChannel);

        return () => {
            socket.off("connect", joinActiveChannel);
        };
    }, [socket, activeChannel]);

    const handleLoginSuccess = (token: string, profile: UserProfile) => {
        setAuthToken(token);
        setUser(profile);
        setIsAuthenticated(true);
        setShowRegister(false);
    };

    const handleChannelSelect = (channelId: string) => {
        setActiveChannel(channelId);
    };

    if (!isAuthenticated) {
        if (showRegister) {
            return (
                <Register
                    onRegisterSuccess={handleLoginSuccess}
                    onSwitchToLogin={() => setShowRegister(false)}
                />
            );
        }
        return (
            <Login
                onLoginSuccess={handleLoginSuccess}
                onSwitchToRegister={() => setShowRegister(true)}
            />
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0d0f12] text-white">
            <Navbar
                onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                user={user}
                authToken={authToken}
                onUserUpdate={setUser}
                onLogout={handleLogout}
            />
            <div className="flex-1 min-h-0 px-0 md:px-3 pb-0 md:pb-3">
                {!isConnected || !user ? (
                    <div className="h-full flex items-center justify-center text-center">
                        <div className="rounded-xl bg-[#15181c] border border-white/10 px-8 py-10">
                            <div className="mb-4 text-5xl">🔌</div>
                            <h2 className="text-2xl font-bold mb-2">Connecting to server...</h2>
                            <p className="text-slate-400">Make sure your backend API/socket server is reachable</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full overflow-hidden md:rounded-xl md:border md:border-white/10 md:bg-[#121418] md:shadow-2xl">
                        <Sidebar
                            isOpen={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                            channels={channels}
                            activeChannel={activeChannel}
                            onChannelSelect={handleChannelSelect}
                        />
                        {socket && (
                            <Chat
                                socket={socket}
                                activeChannel={activeChannel}
                                channels={channels}
                                currentUser={user}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
