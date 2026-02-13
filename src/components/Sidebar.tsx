
type Channel = {
    id: string;
    name: string;
};

type SidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    channels: Channel[];
    activeChannel: string;
    onChannelSelect: (id: string) => void;
};

export default function Sidebar({
    isOpen,
    onClose,
    channels,
    activeChannel,
    onChannelSelect,
}: SidebarProps) {
    const handleChannelClick = (id: string) => {
        onChannelSelect(id);
        onClose();
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
                    onClick={onClose}
                ></div>
            )}

            {/* Sidebar */}
            <aside
                className={`fixed md:static top-20 left-0 h-[calc(100vh-5rem)] w-64 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-red-900/50 transition-transform duration-300 z-40 md:z-0 overflow-y-auto flex flex-col shadow-lg
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
            >
                {/* Close button for mobile */}
                <button
                    onClick={onClose}
                    className="md:hidden absolute top-6 right-6 w-8 h-8 flex items-center justify-center hover:bg-red-900/50 rounded-lg transition-colors"
                    aria-label="Close sidebar"
                >
                    <span className="text-2xl leading-none text-red-400">&times;</span>
                </button>

                {/* Sidebar header */}
                <div className="p-6 border-b border-red-900/50 mt-8 md:mt-0">
                    <h2 className="text-lg font-bold text-red-400">📢 Channels</h2>
                </div>

                {/* Channel list */}
                <nav className="flex-1 p-6">
                    <ul className="space-y-3">
                        {channels.map((channel) => (
                            <li key={channel.id}>
                                <button
                                    onClick={() => handleChannelClick(channel.id)}
                                    className={`w-full text-left px-5 py-3 rounded-lg transition-all ${activeChannel === channel.id
                                        ? "bg-red-600/80 text-white font-semibold shadow-lg shadow-red-600/30"
                                        : "text-red-200/70 hover:bg-red-900/30 hover:text-red-300"
                                        }`}
                                >
                                    # {channel.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>
    );
}
