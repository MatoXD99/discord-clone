import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import Login from "./Login";
import Register from "./Register";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Chat from "./Chat";

type Channel = {
    id: string;
    name: string;
};

const DEFAULT_CHANNELS: Channel[] = [
    { id: "general", name: "# General" },
    { id: "random", name: "# Random" },
    { id: "announcements", name: "# Announcements" },
    { id: "help", name: "# Help" },
    { id: "offtopic", name: "# Off-Topic" },
];

export default function Layout() {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [username, setUsername] = useState("");
    const [showRegister, setShowRegister] = useState(false);

    // Chat state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
    const [activeChannel, setActiveChannel] = useState(DEFAULT_CHANNELS[0].id);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Check for existing token on mount
    useEffect(() => {
        const savedToken = localStorage.getItem("authToken");
        if (savedToken) {
            setAuthToken(savedToken);
            setIsAuthenticated(true);
        }
    }, []);

    // Initialize Socket.IO when authenticated
    useEffect(() => {
        if (!isAuthenticated || !authToken) return;

        console.log("🔄 Attempting Socket.IO connection with token:", authToken.substring(0, 20) + "...");

        const newSocket = io("http://localhost:3001", {
            auth: {
                token: authToken,
            },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        newSocket.on("connect", () => {
            console.log("✅ Connected to Socket.IO server");
            setIsConnected(true);
        });

        newSocket.on("connect_error", (error: any) => {
            console.error("❌ Socket connection error:", error.message || error);
            setIsConnected(false);
        });

        newSocket.on("error", (error: any) => {
            console.error("❌ Socket error:", error);
        });

        newSocket.on("disconnect", (reason) => {
            console.log("❌ Disconnected from Socket.IO server:", reason);
            setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [isAuthenticated, authToken]);

    // Join channel when socket is ready and activeChannel changes
    useEffect(() => {
        if (socket && socket.connected) {
            socket.emit("join_channel", activeChannel);
        }
    }, [socket, activeChannel]);

    // Handle login
    const handleLoginSuccess = (token: string, user: string) => {
        setAuthToken(token);
        setUsername(user);
        setIsAuthenticated(true);
        setShowRegister(false);
    };

    // Handle logout
    const handleLogout = () => {
        localStorage.removeItem("authToken");
        setAuthToken(null);
        setUsername("");
        setIsAuthenticated(false);
        if (socket) socket.close();
    };

    // Handle channel switch
    const handleChannelSelect = (channelId: string) => {
        setActiveChannel(channelId);
        if (socket) {
            socket.emit("join_channel", channelId);
        }
    };

    // Show login/register screens if not authenticated
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
        <div className="flex flex-col h-screen bg-gray-900 text-white">
            <Navbar
                onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                username={username}
                onLogout={handleLogout}
            />
            <div className="flex-1 flex items-center justify-center">
                {!isConnected ? (
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🔌</div>
                        <h2 className="text-2xl font-bold mb-2">Connecting to server...</h2>
                        <p className="text-gray-400">
                            Make sure the backend server is running on port 3001
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-1 overflow-hidden w-full">
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
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
