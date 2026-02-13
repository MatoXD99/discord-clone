import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import EmojiPicker from "./EmojiPicker";
import { fetchJson, resolveMediaUrl } from "../apiClient";
import type { DmConversation, FriendshipState } from "./Layout";

type Message = {
    id?: number;
    type: string;
    userId?: number;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    text?: string;
    fileUrl?: string;
    timestamp: Date;
};

export default function Chat({
    socket,
    activeView,
    activeChannel,
    activeDm,
    friendshipState,
}: {
    socket: Socket;
    activeView: "channel" | "friends" | "dm";
    activeChannel: { id: number; name: string; serverName: string } | null;
    activeDm: DmConversation | null;
    friendshipState: FriendshipState;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        setMessages([]);
        const onChannelHistory = (history: Message[]) => activeView === "channel" && setMessages(history);
        const onReceive = (msg: Message) => activeView === "channel" && setMessages((prev) => [...prev, msg]);
        const onDmHistory = (payload: { conversationId: number; messages: Message[] }) => {
            if (activeView === "dm" && payload.conversationId === activeDm?.id) setMessages(payload.messages);
        };
        const onReceiveDm = (msg: Message & { conversationId: number }) => {
            if (activeView === "dm" && msg.conversationId === activeDm?.id) setMessages((prev) => [...prev, msg]);
        };

        socket.on("message_history", onChannelHistory);
        socket.on("receive_message", onReceive);
        socket.on("dm_history", onDmHistory);
        socket.on("receive_dm", onReceiveDm);

        return () => {
            socket.off("message_history", onChannelHistory);
            socket.off("receive_message", onReceive);
            socket.off("dm_history", onDmHistory);
            socket.off("receive_dm", onReceiveDm);
        };
    }, [socket, activeView, activeDm?.id]);

    const sendPayload = (payload: { text?: string; fileUrl?: string; type: string }) => {
        if (activeView === "channel") socket.emit("send_message", payload);
        if (activeView === "dm" && activeDm) socket.emit("send_dm", { ...payload, conversationId: activeDm.id });
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const data = await fetchJson<{ fileUrl: string }>("/upload", { method: "POST", body: formData }, "Upload failed");
            sendPayload({ fileUrl: data.fileUrl, type: "image" });
        } catch {
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    if (activeView === "friends") {
        return (
            <div className="flex-1 bg-[#1a1c1f] p-6 overflow-y-auto">
                <h2 className="text-xl font-semibold mb-4">Friends</h2>
                <div className="space-y-2">
                    {friendshipState.friends.map((friend) => (
                        <div key={friend.id} className="bg-[#22262c] rounded-md p-3">{friend.user.displayName}</div>
                    ))}
                    {friendshipState.friends.length === 0 && <p className="text-slate-400">No friends yet.</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#1a1c1f] overflow-hidden">
            <div className="h-14 border-b border-white/10 flex items-center px-5 bg-[#17191c]">
                <h2 className="text-lg font-semibold">{activeView === "dm" ? `@ ${activeDm?.user.displayName}` : `# ${activeChannel?.name}`}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.map((msg, idx) => {
                    const showHeader = idx === 0 || messages[idx - 1].userId !== msg.userId;
                    return (
                        <div key={`${msg.timestamp}-${idx}`} className="flex justify-start">
                            <div className="flex gap-2 max-w-[75%]">
                                <div className={`w-9 h-9 ${showHeader ? "opacity-100" : "opacity-0"}`}>
                                    {showHeader && (msg.avatarUrl ? <img src={resolveMediaUrl(msg.avatarUrl)} className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-slate-700" />)}
                                </div>
                                <div>
                                    {showHeader && <div className="text-sm text-slate-300 mb-1">{msg.displayName || msg.username} · {new Date(msg.timestamp).toLocaleTimeString()}</div>}
                                    {msg.type === "image" ? <ImageWithLoader url={resolveMediaUrl(msg.fileUrl)} /> : <p className="bg-[#2b2f35] rounded-2xl px-4 py-2 text-sm">{msg.text}</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            {isUploading && <div className="text-sm px-5 py-2 border-t border-white/10">Uploading image...</div>}
            <MessageInput
                onSendMessage={(text) => sendPayload({ text, type: "text" })}
                onFileUpload={handleFileUpload}
                placeholder={activeView === "dm" ? `Message ${activeDm?.user.displayName || "user"}` : `Message #${activeChannel?.name || "channel"}`}
            />
        </div>
    );
}

function ImageWithLoader({ url }: { url?: string }) {
    const [isLoading, setIsLoading] = useState(true);
    if (!url) return null;

    return (
        <div className="relative w-fit">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#20242a] rounded-xl min-h-28 min-w-40">
                    <div className="w-7 h-7 border-4 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
                </div>
            )}
            <img src={url} alt="shared" onLoad={() => setIsLoading(false)} onError={() => setIsLoading(false)} className="max-w-sm rounded-xl border border-white/10" />
        </div>
    );
}

function MessageInput({ onSendMessage, onFileUpload, placeholder }: { onSendMessage: (text: string) => void; onFileUpload: (file: File) => void; placeholder: string; }) {
    const [inputValue, setInputValue] = useState("");
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        onSendMessage(inputValue.trim());
        setInputValue("");
    };

    return (
        <div className="bg-[#17191c] border-t border-white/10 p-4 relative">
            <div className="flex gap-2 items-center bg-[#23272d] rounded-xl px-3 py-2 border border-white/5">
                <button onClick={() => fileInputRef.current?.click()} className="p-2">📎</button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
                <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder={placeholder} className="flex-1 bg-transparent outline-none" />
                <button onClick={() => setEmojiPickerOpen(!emojiPickerOpen)} className="p-2">😊</button>
                <button onClick={handleSend} className="bg-slate-200 text-slate-900 px-4 py-2 rounded-md text-sm font-medium">Send</button>
            </div>
            <EmojiPicker isOpen={emojiPickerOpen} onClose={() => setEmojiPickerOpen(false)} onEmojiSelect={(emoji) => setInputValue((v) => v + emoji)} />
        </div>
    );
}
