import React from "react";

type Channel = {
    id: string;
    name: string;
};

type ChatAreaProps = {
    channel?: Channel;
};

const placeholderMessages = [
    { id: 1, user: "Alice", text: "Hey everyone! Welcome to the channel 👋" },
    { id: 2, user: "Bob", text: "Thanks for having us!" },
    {
        id: 3,
        user: "Charlie",
        text: "This looks like a really cool Discord clone!",
    },
    { id: 4, user: "Alice", text: "Thanks! Built with React + Tailwind 🎉" },
    { id: 5, user: "Diana", text: "The responsive design is awesome" },
];

export default function ChatArea({ channel }: ChatAreaProps) {
    return (
        <main className="flex-1 flex flex-col bg-gray-800 overflow-hidden">
            {/* Header */}
            <div className="h-16 bg-gray-750 border-b border-gray-700 flex items-center px-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-white">
                    {channel ? channel.name : "Select a channel"}
                </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {placeholderMessages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 group hover:bg-gray-750 p-2 rounded transition-colors">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-white">
                            {msg.user[0]}
                        </div>

                        {/* Message */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-white">{msg.user}</span>
                                <span className="text-xs text-gray-500">10:45 AM</span>
                            </div>
                            <p className="text-gray-200 mt-1 break-words">{msg.text}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Input area */}
            <div className="bg-gray-750 border-t border-gray-700 p-4 flex-shrink-0">
                <input
                    type="text"
                    placeholder="Message #general"
                    className="w-full bg-gray-900 text-white placeholder-gray-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
            </div>
        </main>
    );
}
