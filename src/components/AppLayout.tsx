import { useState } from "react";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";

const channels = [
    { id: "general", name: "# General" },
    { id: "random", name: "# Random" },
    { id: "help", name: "# Help" },
];

export default function AppLayout() {
    const [activeChannel, setActiveChannel] = useState(channels[0].id);

    return (
        <div className="flex h-screen bg-gray-900 text-white">
            <Sidebar
                isOpen
                onClose={() => {}}
                channels={channels}
                activeChannel={activeChannel}
                onChannelSelect={setActiveChannel}
            />
            <ChatArea channel={channels.find((c) => c.id === activeChannel)} />
        </div>
    );
}
