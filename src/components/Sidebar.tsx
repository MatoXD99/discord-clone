
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
                <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onClose}></div>
            )}

            <aside
                className={`fixed md:static top-14 left-0 h-[calc(100vh-3.5rem)] w-64 bg-[#2b2d31] transition-transform duration-300 z-40 md:z-0 overflow-y-auto flex flex-col
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
            >
                <button
                    onClick={onClose}
                    className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-md transition-colors"
                    aria-label="Close sidebar"
                >
                    <span className="text-2xl leading-none text-slate-300">&times;</span>
                </button>

                <div className="p-4 border-b border-black/20">
                    <h2 className="text-sm font-semibold uppercase text-slate-400 tracking-wide">Text channels</h2>
                </div>

                <nav className="flex-1 p-2">
                    <ul className="space-y-1">
                        {channels.map((channel) => (
                            <li key={channel.id}>
                                <button
                                    onClick={() => handleChannelClick(channel.id)}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-all ${activeChannel === channel.id
                                        ? "bg-[#404249] text-slate-100 font-medium"
                                        : "text-slate-400 hover:bg-[#35373c] hover:text-slate-200"
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
