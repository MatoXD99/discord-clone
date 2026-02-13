import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import EmojiPicker from "./EmojiPicker";
import { fetchJson } from "../apiClient";
import type { UserProfile } from "./Layout";

type Channel = {
    id: string;
    name: string;
};

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
    activeChannel,
    channels,
    currentUser,
}: {
    socket: Socket;
    activeChannel: string;
    channels: Channel[];
    currentUser: UserProfile;
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const currentChannel = channels.find((c) => c.id === activeChannel);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        setMessages([]);

        socket.on("message_history", (history: Message[]) => {
            setMessages(history);
        });

        socket.on("receive_message", (data: Message) => {
            setMessages((prev) => [...prev, data]);
        });

        return () => {
            socket.off("message_history");
            socket.off("receive_message");
        };
    }, [socket, activeChannel]);

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const data = await fetchJson<{ fileUrl: string }>("/upload", {
                method: "POST",
                body: formData,
            }, "Upload failed");

            socket.emit("send_message", {
                fileUrl: data.fileUrl,
                type: "image",
                timestamp: new Date(),
            });
        } catch (error) {
            console.error("File upload error:", error);
            alert("Failed to upload image");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSendMessage = (text: string) => {
        socket.emit("send_message", {
            text,
            type: "text",
            timestamp: new Date(),
        });
    };

    return (
        <div className="flex-1 flex flex-col bg-[#313338] overflow-hidden">
            <div className="h-14 border-b border-black/20 flex items-center px-6 flex-shrink-0 bg-[#313338]">
                <h2 className="text-lg font-semibold text-slate-100">{currentChannel ? currentChannel.name : "No channel"}</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-1">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <p className="text-base">No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const prev = messages[idx - 1];
                        const next = messages[idx + 1];
                        const isSystem = msg.type === "system";
                        const isOwn = !isSystem && msg.userId === currentUser.id;

                        const groupedWithPrev = !isSystem
                            && !!prev
                            && prev.type !== "system"
                            && prev.userId === msg.userId;

                        const groupedWithNext = !isSystem
                            && !!next
                            && next.type !== "system"
                            && next.userId === msg.userId;

                        if (isSystem) {
                            return (
                                <div key={`${msg.timestamp}-${idx}`} className="text-center text-xs text-slate-500 italic py-3">
                                    {msg.text}
                                </div>
                            );
                        }

                        const showHeader = !groupedWithPrev;
                        const avatarFallback = (msg.displayName || msg.username || "?").charAt(0).toUpperCase();

                        return (
                            <div key={`${msg.timestamp}-${idx}`} className={`flex ${isOwn ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-1" : "mt-3"}`}>
                                <div className={`flex ${isOwn ? "flex-row-reverse" : "flex-row"} items-end gap-2 max-w-[85%] md:max-w-[72%]`}>
                                    <div className={`w-9 h-9 ${showHeader ? "opacity-100" : "opacity-0"}`}>
                                        {showHeader && (
                                            msg.avatarUrl ? (
                                                <img src={msg.avatarUrl} alt={msg.displayName || msg.username} className="w-9 h-9 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-xs font-semibold text-slate-200">{avatarFallback}</div>
                                            )
                                        )}
                                    </div>

                                    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                        {showHeader && (
                                            <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                                                <span className="text-sm font-medium text-slate-200">{msg.displayName || msg.username}</span>
                                                <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        )}

                                        {msg.type === "image" ? (
                                            <img
                                                src={msg.fileUrl}
                                                alt="shared"
                                                className={`max-w-sm rounded-2xl border border-white/10 ${isOwn ? "rounded-br-md" : "rounded-bl-md"} ${groupedWithNext ? "mb-0.5" : ""}`}
                                            />
                                        ) : (
                                            <p
                                                className={`px-4 py-2.5 text-sm leading-relaxed break-words shadow ${isOwn
                                                    ? "bg-[#5865f2] text-white"
                                                    : "bg-[#383a40] text-slate-100"
                                                    } ${isOwn
                                                        ? (groupedWithPrev ? "rounded-2xl rounded-tr-lg" : "rounded-3xl rounded-br-lg")
                                                        : (groupedWithPrev ? "rounded-2xl rounded-tl-lg" : "rounded-3xl rounded-bl-lg")
                                                    } ${groupedWithNext ? (isOwn ? "rounded-br-lg" : "rounded-bl-lg") : ""}`}
                                            >
                                                {msg.text}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {isUploading && (
                <div className="bg-[#5865f2] text-white px-6 py-2 text-sm border-t border-black/20">
                    Uploading image...
                </div>
            )}

            <MessageInput
                onSendMessage={handleSendMessage}
                onFileUpload={handleFileUpload}
                channelName={currentChannel?.name.slice(2) || "channel"}
            />
        </div>
    );
}

function MessageInput({
    onSendMessage,
    onFileUpload,
    channelName,
}: {
    onSendMessage: (text: string) => void;
    onFileUpload: (file: File) => void;
    channelName: string;
}) {
    const [inputValue, setInputValue] = useState("");
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEmojiSelect = (emoji: string) => {
        setInputValue((prev) => prev + emoji);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileUpload(file);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="bg-[#313338] border-t border-black/20 p-4 md:p-6 flex-shrink-0 relative">
            <div className="flex gap-2 items-center bg-[#383a40] rounded-xl px-3 py-2">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:bg-white/10 text-slate-200 p-2 rounded-md transition-all"
                    title="Upload image"
                >
                    📎
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Upload image"
                />

                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={`Message #${channelName}`}
                    className="flex-1 bg-transparent text-white placeholder-slate-400 px-2 py-1 focus:outline-none"
                />

                <button
                    onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                    className="hover:bg-white/10 text-slate-200 p-2 rounded-md transition-all"
                    title="Open emoji picker"
                >
                    😊
                </button>

                <button
                    onClick={handleSend}
                    className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                    Send
                </button>
            </div>

            <EmojiPicker
                isOpen={emojiPickerOpen}
                onClose={() => setEmojiPickerOpen(false)}
                onEmojiSelect={handleEmojiSelect}
            />
        </div>
    );
}
