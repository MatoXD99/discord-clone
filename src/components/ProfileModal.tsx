import React, { useMemo, useRef, useState } from "react";
import { fetchJson } from "../apiClient";
import type { UserProfile } from "./Layout";

type ProfileModalProps = {
    authToken: string;
    user: UserProfile;
    onClose: () => void;
    onUserUpdate: (user: UserProfile) => void;
};

export default function ProfileModal({ authToken, user, onClose, onUserUpdate }: ProfileModalProps) {
    const [displayName, setDisplayName] = useState(user.displayName);
    const [email, setEmail] = useState(user.email ?? "");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const avatarInitial = useMemo(() => {
        return (displayName || user.username || "?").charAt(0).toUpperCase();
    }, [displayName, user.username]);

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setStatus("");
        setIsSaving(true);

        try {
            const response = await fetchJson<{ user: UserProfile }>("/api/me", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ displayName, email }),
            }, "Failed to update profile");

            onUserUpdate(response.user);
            setStatus("Profile updated successfully.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update profile";
            setStatus(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        setStatus("");
        setIsUploading(true);

        try {
            const response = await fetchJson<{ user: UserProfile }>("/api/me/avatar", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                body: formData,
            }, "Failed to upload avatar");
            onUserUpdate(response.user);
            setStatus("Avatar updated successfully.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to upload avatar";
            setStatus(message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-xl rounded-2xl border border-slate-600 bg-[#1e1f22] p-6" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-100">My Profile</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>
                </div>

                <div className="flex items-center gap-4 mb-6">
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center font-semibold text-lg">{avatarInitial}</div>
                    )}
                    <div>
                        <p className="font-semibold">{user.displayName}</p>
                        <p className="text-sm text-slate-400">@{user.username}</p>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="ml-auto bg-[#5865f2] hover:bg-[#4752c4] px-3 py-2 rounded-md text-sm"
                        disabled={isUploading}
                    >
                        {isUploading ? "Uploading..." : "Upload picture"}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                <form className="space-y-4" onSubmit={handleSave}>
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Display name</label>
                        <input
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            className="w-full rounded-md bg-[#111214] border border-slate-700 px-3 py-2"
                            maxLength={40}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="w-full rounded-md bg-[#111214] border border-slate-700 px-3 py-2"
                            placeholder="name@example.com"
                        />
                    </div>

                    {status && <p className="text-sm text-slate-300">{status}</p>}

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600">Close</button>
                        <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-70">
                            {isSaving ? "Saving..." : "Save profile"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
