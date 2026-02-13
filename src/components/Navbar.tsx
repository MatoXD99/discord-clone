import { useState } from "react";
import type { UserProfile } from "./Layout";
import ProfileModal from "./ProfileModal";

type NavbarProps = {
    onMenuClick: () => void;
    user: UserProfile | null;
    authToken: string | null;
    onUserUpdate: (user: UserProfile) => void;
    onLogout?: () => void;
};

export default function Navbar({ onMenuClick, user, authToken, onUserUpdate, onLogout }: NavbarProps) {
    const [showProfile, setShowProfile] = useState(false);

    return (
        <>
            <nav className="h-14 bg-[#1e1f22] border-b border-black/30 flex items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden w-9 h-9 flex flex-col justify-center items-center gap-1 hover:bg-white/10 rounded-md transition-colors"
                        aria-label="Toggle menu"
                    >
                        <div className="w-5 h-0.5 bg-slate-300"></div>
                        <div className="w-5 h-0.5 bg-slate-300"></div>
                        <div className="w-5 h-0.5 bg-slate-300"></div>
                    </button>
                    <h1 className="text-lg font-semibold text-slate-100">Cordor</h1>
                </div>

                {user && (
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded-md">
                            {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-semibold">
                                    {user.displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <span className="text-sm text-slate-200 hidden md:inline">{user.displayName}</span>
                        </button>
                        <button
                            onClick={onLogout}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-md transition-all text-sm font-medium"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </nav>

            {showProfile && user && authToken && (
                <ProfileModal
                    authToken={authToken}
                    user={user}
                    onClose={() => setShowProfile(false)}
                    onUserUpdate={onUserUpdate}
                />
            )}
        </>
    );
}
