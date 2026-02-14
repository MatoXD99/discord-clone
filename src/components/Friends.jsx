import { useCallback, useEffect, useState } from "react";

export default function Friends({ socket, currentUser }) {
    const [allUsers, setAllUsers] = useState([]);
    const [friends, setFriends] = useState([]);
    const [pinnedFriends, setPinnedFriends] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [activeTab, setActiveTab] = useState("friends"); // friends | requests | all
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [messages, setMessages] = useState({});
    const [messageInput, setMessageInput] = useState("");
    const [error, setError] = useState(null);

    // Fetch all users on mount
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch("/api/users", {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                });
                if (!res.ok) throw new Error("Failed to fetch users");
                const data = await res.json();
                setAllUsers(data.users || []);
            } catch (err) {
                console.error("Error fetching users:", err);
                setError("Failed to load users");
            }
        };

        const fetchFriends = async () => {
            try {
                const res = await fetch("/api/friends", {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                });
                if (!res.ok) throw new Error("Failed to fetch friends");
                const data = await res.json();
                setFriends(data.friends || []);
                setPinnedFriends(data.pinnedFriends || []);
            } catch (err) {
                console.debug("Friends endpoint not available yet:", err);
            }
        };

        const fetchPendingRequests = async () => {
            try {
                const res = await fetch("/api/friend-requests", {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                });
                if (!res.ok) throw new Error("Failed to fetch requests");
                const data = await res.json();
                setFriendRequests(data.requests || []);
            } catch (err) {
                console.debug("Friend requests endpoint not available yet:", err);
            }
        };

        if (socket) {
            fetchUsers();
            fetchFriends();
            fetchPendingRequests();
        }
    }, [socket]);

    // Socket listeners for friend requests and messages
    useEffect(() => {
        if (!socket) return;

        const handleFriendRequest = ({ fromUserId, fromUserName }) => {
            setFriendRequests((prev) => [
                ...prev,
                { id: fromUserId, displayName: fromUserName, userId: fromUserId },
            ]);
        };

        const handleNewMessage = ({ fromUserId, fromUserName, message, timestamp }) => {
            setMessages((prev) => ({
                ...prev,
                [fromUserId]: [
                    ...(prev[fromUserId] || []),
                    { from: fromUserName, text: message, timestamp },
                ],
            }));
        };

        socket.on("friend_request_received", handleFriendRequest);
        socket.on("friend_message", handleNewMessage);

        return () => {
            socket.off("friend_request_received", handleFriendRequest);
            socket.off("friend_message", handleNewMessage);
        };
    }, [socket]);

    const sendFriendRequest = useCallback(
        async (userId) => {
            try {
                const res = await fetch("/api/friend-requests", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({ targetUserId: userId }),
                });
                if (!res.ok) throw new Error("Failed to send request");
                socket?.emit("send_friend_request", { targetUserId: userId });
            } catch (err) {
                console.error("Error sending friend request:", err);
                setError("Failed to send request");
            }
        },
        [socket]
    );

    const acceptFriendRequest = useCallback(
        async (userId) => {
            try {
                const res = await fetch(`/api/friend-requests/${userId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({ accepted: true }),
                });
                if (!res.ok) throw new Error("Failed to accept request");
                setFriendRequests((prev) =>
                    prev.filter((req) => req.userId !== userId)
                );
                const friend = allUsers.find((u) => u.id === userId);
                if (friend) {
                    setFriends((prev) => [...prev, friend]);
                }
            } catch (err) {
                console.error("Error accepting request:", err);
                setError("Failed to accept request");
            }
        },
        [allUsers]
    );

    const pinFriend = useCallback(
        async (userId) => {
            try {
                const res = await fetch(`/api/friends/${userId}/pin`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                });
                if (!res.ok) throw new Error("Failed to pin friend");
                setPinnedFriends((prev) =>
                    prev.some((f) => f.id === userId)
                        ? prev
                        : [...prev, friends.find((f) => f.id === userId)]
                );
            } catch (err) {
                console.error("Error pinning friend:", err);
                setError("Failed to pin friend");
            }
        },
        [friends]
    );

    const unpinFriend = useCallback(async (userId) => {
        try {
            const res = await fetch(`/api/friends/${userId}/unpin`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            if (!res.ok) throw new Error("Failed to unpin friend");
            setPinnedFriends((prev) => prev.filter((f) => f.id !== userId));
        } catch (err) {
            console.error("Error unpinning friend:", err);
            setError("Failed to unpin friend");
        }
    }, []);

    const sendMessage = useCallback(() => {
        if (!selectedFriend || !messageInput.trim()) return;

        socket?.emit("send_friend_message", {
            targetUserId: selectedFriend.id,
            message: messageInput,
        });

        setMessages((prev) => ({
            ...prev,
            [selectedFriend.id]: [
                ...(prev[selectedFriend.id] || []),
                { from: currentUser?.displayName || "You", text: messageInput, timestamp: new Date() },
            ],
        }));

        setMessageInput("");
    }, [selectedFriend, messageInput, socket, currentUser]);

    const isPinnedFriend = (userId) => pinnedFriends.some((f) => f.id === userId);
    const isFriend = (userId) => friends.some((f) => f.id === userId);
    const hasPendingRequest = (userId) =>
        friendRequests.some((req) => req.userId === userId);

    return (
        <div className="flex flex-col h-full bg-[#1e1f22] text-white">
            {/* Header */}
            <div className="border-b border-[#2a2a2f] p-3">
                <h2 className="text-sm font-semibold">Friends</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-3 py-2 border-b border-[#2a2a2f] text-xs">
                <button
                    onClick={() => setActiveTab("friends")}
                    className={`px-3 py-1 rounded ${activeTab === "friends"
                            ? "bg-blue-600"
                            : "bg-[#2a2a2f] hover:bg-[#35353b]"
                        }`}
                >
                    Friends
                </button>
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`px-3 py-1 rounded relative ${activeTab === "requests"
                            ? "bg-blue-600"
                            : "bg-[#2a2a2f] hover:bg-[#35353b]"
                        }`}
                >
                    Requests
                    {friendRequests.length > 0 && (
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 rounded-full text-xs flex items-center justify-center">
                            {friendRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("all")}
                    className={`px-3 py-1 rounded ${activeTab === "all"
                            ? "bg-blue-600"
                            : "bg-[#2a2a2f] hover:bg-[#35353b]"
                        }`}
                >
                    All Users
                </button>
            </div>

            {error && <div className="text-xs text-red-400 px-3 py-1">{error}</div>}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex">
                {/* User List */}
                <div className="w-48 border-r border-[#2a2a2f] overflow-y-auto">
                    {activeTab === "friends" && (
                        <>
                            {/* Pinned Friends */}
                            {pinnedFriends.length > 0 && (
                                <>
                                    <div className="text-xs font-semibold text-slate-400 px-3 py-2 bg-[#2a2a2f]">
                                        PINNED
                                    </div>
                                    {pinnedFriends.map((friend) => (
                                        <div
                                            key={friend.id}
                                            onClick={() => setSelectedFriend(friend)}
                                            className={`px-3 py-2 cursor-pointer border-l-2 ${selectedFriend?.id === friend.id
                                                    ? "border-blue-600 bg-[#35353b]"
                                                    : "border-transparent hover:bg-[#2a2a2f]"
                                                }`}
                                        >
                                            <div className="text-xs font-medium truncate">
                                                {friend.displayName}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    unpinFriend(friend.id);
                                                }}
                                                className="text-xs text-slate-400 hover:text-white"
                                            >
                                                📌
                                            </button>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Regular Friends */}
                            <div className="text-xs font-semibold text-slate-400 px-3 py-2 bg-[#2a2a2f]">
                                FRIENDS
                            </div>
                            {friends
                                .filter(
                                    (f) =>
                                        !pinnedFriends.some((pf) => pf.id === f.id)
                                )
                                .map((friend) => (
                                    <div
                                        key={friend.id}
                                        onClick={() => setSelectedFriend(friend)}
                                        className={`px-3 py-2 cursor-pointer border-l-2 group flex items-center justify-between ${selectedFriend?.id === friend.id
                                                ? "border-blue-600 bg-[#35353b]"
                                                : "border-transparent hover:bg-[#2a2a2f]"
                                            }`}
                                    >
                                        <div className="text-xs font-medium truncate">
                                            {friend.displayName}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                pinFriend(friend.id);
                                            }}
                                            className="text-xs text-slate-400 hover:text-white opacity-0 group-hover:opacity-100"
                                        >
                                            📌
                                        </button>
                                    </div>
                                ))}
                        </>
                    )}

                    {activeTab === "requests" && (
                        <div className="space-y-1 p-2">
                            {friendRequests.length > 0 ? (
                                friendRequests.map((req) => (
                                    <div
                                        key={req.id}
                                        className="bg-[#2a2a2f] rounded p-2 space-y-1"
                                    >
                                        <div className="text-xs font-medium">
                                            {req.displayName}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() =>
                                                    acceptFriendRequest(req.userId)
                                                }
                                                className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded"
                                            >
                                                Accept
                                            </button>
                                            <button className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded">
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-slate-400 text-center py-4">
                                    No pending requests
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "all" && (
                        <>
                            {allUsers.map((user) => (
                                <div
                                    key={user.id}
                                    onClick={() => setSelectedFriend(user)}
                                    className={`px-3 py-2 cursor-pointer border-l-2 text-xs ${selectedFriend?.id === user.id
                                            ? "border-blue-600 bg-[#35353b]"
                                            : "border-transparent hover:bg-[#2a2a2f]"
                                        }`}
                                >
                                    <div className="font-medium truncate">
                                        {user.displayName}
                                    </div>
                                    {!isFriend(user.id) &&
                                        !hasPendingRequest(user.id) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    sendFriendRequest(user.id);
                                                }}
                                                className="text-xs mt-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 rounded w-full"
                                            >
                                                Add
                                            </button>
                                        )}
                                    {hasPendingRequest(user.id) && (
                                        <div className="text-xs text-yellow-400 mt-1">
                                            Request sent
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Chat Area */}
                {selectedFriend && (
                    <div className="flex-1 flex flex-col">
                        {/* Chat Header */}
                        <div className="border-b border-[#2a2a2f] p-3 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                {selectedFriend.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-sm font-medium">
                                    {selectedFriend.displayName}
                                </div>
                                {!isFriend(selectedFriend.id) &&
                                    !hasPendingRequest(selectedFriend.id) && (
                                        <button
                                            onClick={() =>
                                                sendFriendRequest(
                                                    selectedFriend.id
                                                )
                                            }
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            Send Friend Request
                                        </button>
                                    )}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {(messages[selectedFriend.id] || []).map(
                                (msg, idx) => (
                                    <div key={idx} className="text-xs">
                                        <div className="text-slate-400">
                                            {msg.from}
                                        </div>
                                        <div className="text-white">
                                            {msg.text}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Message Input */}
                        {isFriend(selectedFriend.id) && (
                            <div className="border-t border-[#2a2a2f] p-3 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Send a message..."
                                    value={messageInput}
                                    onChange={(e) =>
                                        setMessageInput(e.target.value)
                                    }
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter")
                                            sendMessage();
                                    }}
                                    className="flex-1 bg-[#2a2a2f] text-white text-xs rounded px-2 py-1 focus:outline-none"
                                />
                                <button
                                    onClick={sendMessage}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                                >
                                    Send
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!selectedFriend && (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <div className="text-sm">Select a friend to chat</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
