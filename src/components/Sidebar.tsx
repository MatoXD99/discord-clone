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
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] z-30 md:hidden" onClick={onClose}></div>
            )}

            <aside
                className={`fixed md:static top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-[#15181c] transition-transform duration-300 z-40 md:z-0 overflow-y-auto flex flex-col border-r border-white/10
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
            >
                <button
                    onClick={onClose}
                    className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors"
                    aria-label="Close sidebar"
                >
                    <span className="text-2xl leading-none text-slate-300">&times;</span>
                </button>

                <div className="p-4 border-b border-white/10">
                    <h2 className="text-xs font-semibold uppercase text-slate-400 tracking-[0.15em]">Text channels</h2>
                </div>

                <nav className="flex-1 p-3">
                    <ul className="space-y-1.5">
                        {channels.map((channel) => (
                            <li key={channel.id}>
                                <button
                                    onClick={() => handleChannelClick(channel.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${activeChannel === channel.id
                                        ? "bg-[#2e333a] text-slate-100 font-medium"
                                        : "text-slate-400 hover:bg-[#252a31] hover:text-slate-200"
                                        }`}
                                >
                                    {channel.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>
    );
}
