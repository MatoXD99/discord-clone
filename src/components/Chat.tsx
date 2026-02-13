import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import EmojiPicker from "./EmojiPicker";
import { buildApiUrl } from "../apiClient";

type Channel = {
    id: string;
    name: string;
};

type Message = {
    type: string;
    username: string;
    text?: string;
    fileUrl?: string;
    timestamp: Date;
};

// Main Chat component
export default function Chat({
    socket,
    activeChannel,
    channels,
}: {
    socket: Socket;
    activeChannel: string;
    channels: Channel[];
}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Get current channel object
    const currentChannel = channels.find((c) => c.id === activeChannel);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Listen for incoming messages and history
    useEffect(() => {
        // Clear messages when switching channels
        setMessages([]);

        // Listen for message history when joining a channel
        socket.on("message_history", (history: Message[]) => {
            setMessages(history);
        });

        // Listen for new messages
        socket.on("receive_message", (data: Message) => {
            setMessages((prev) => [...prev, data]);
        });

        return () => {
            socket.off("message_history");
            socket.off("receive_message");
        };
    }, [socket, activeChannel]);

    // Handle file upload
    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(buildApiUrl("/upload"), {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();

            // Emit image message to server
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

    // Handle sending text message
    const handleSendMessage = (text: string) => {
        socket.emit("send_message", {
            text,
            type: "text",
            timestamp: new Date(),
        });
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {/* Header */}
            <div className="h-20 bg-gradient-to-r from-slate-800 to-red-950 border-b border-red-900/50 flex items-center px-8 flex-shrink-0 shadow-lg">
                <h2 className="text-2xl font-bold text-red-400">
                    # {currentChannel ? currentChannel.name : "No channel"}
                </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-red-200/50">
                        <p className="text-lg">No messages yet. Start the conversation! 💬</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex gap-4 group ${msg.type === "system" ? "justify-center" : ""
                                }`}
                        >
                            {msg.type === "system" ? (
                                <div className="text-center text-sm text-red-300/60 italic py-2">
                                    {msg.text}
                                </div>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 font-bold text-white shadow-lg">
                                        {msg.username[0].toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0 group-hover:bg-red-900/10 p-3 rounded-lg transition-colors">
                                        <div className="flex items-baseline gap-3">
                                            <span className="font-semibold text-red-300">
                                                {msg.username}
                                            </span>
                                            <span className="text-xs text-red-200/50">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        {msg.type === "image" ? (
                                            <img
                                                src={msg.fileUrl}
                                                alt="shared"
                                                className="max-w-sm rounded-lg mt-3 max-h-96 object-cover border border-red-600/30"
                                            />
                                        ) : (
                                            <p className="text-red-100 mt-2 break-words leading-relaxed">{msg.text}</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Upload status */}
            {isUploading && (
                <div className="bg-red-600/80 text-white px-6 py-3 text-sm border-t border-red-900/50">
                    ⏳ Uploading image...
                </div>
            )}

            {/* Input */}
            <MessageInput
                onSendMessage={handleSendMessage}
                onFileUpload={handleFileUpload}
                channelName={currentChannel?.name.slice(2) || "channel"}
            />
        </div>
    );
}

// Component for message input with file upload and emoji picker
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
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-t border-red-900/50 p-6 flex-shrink-0 relative shadow-lg">
            <div className="flex gap-4">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-red-600/80 hover:bg-red-700 text-white p-3 rounded-lg transition-all flex items-center justify-center shadow-md hover:shadow-red-600/50"
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
                    onKeyPress={handleKeyPress}
                    placeholder={`Message #${channelName}...`}
                    className="flex-1 bg-slate-800 text-white placeholder-slate-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600 border border-slate-700 transition-all"
                />

                <button
                    onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                    className="bg-red-600/80 hover:bg-red-700 text-white p-3 rounded-lg transition-all flex items-center justify-center shadow-md hover:shadow-red-600/50"
                    title="Open emoji picker"
                >
                    😊
                </button>

                <button
                    onClick={handleSend}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-red-600/50"
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
