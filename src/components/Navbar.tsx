import React from "react";

type NavbarProps = {
    onMenuClick: () => void;
    username?: string;
    onLogout?: () => void;
};

export default function Navbar({ onMenuClick, username, onLogout }: NavbarProps) {
    return (
        <nav className="h-20 bg-gradient-to-r from-slate-900 to-red-950 border-b border-red-900/50 flex items-center justify-between px-6 gap-6 md:px-8 shadow-lg">
            <div className="flex items-center gap-6">
                <button
                    onClick={onMenuClick}
                    className="md:hidden w-10 h-10 flex flex-col justify-center items-center gap-1.5 hover:bg-red-900/50 rounded-lg transition-colors"
                    aria-label="Toggle menu"
                >
                    <div className="w-6 h-0.5 bg-red-400"></div>
                    <div className="w-6 h-0.5 bg-red-400"></div>
                    <div className="w-6 h-0.5 bg-red-400"></div>
                </button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">Chat Hub</h1>
            </div>

            {username && (
                <div className="flex items-center gap-6">
                    <span className="text-red-200/80 font-medium">👤 {username}</span>
                    <button
                        onClick={onLogout}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-all text-sm font-semibold shadow-md hover:shadow-red-600/50"
                    >
                        Logout
                    </button>
                </div>
            )}
        </nav>
    );
}