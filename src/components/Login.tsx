import React, { useState } from "react";
import { clearPreferredApiBaseUrl, fetchJson, getCurrentApiBaseUrl, setPreferredApiBaseUrl } from "../apiClient";

import type { UserProfile } from "./Layout";

type LoginProps = {
    onLoginSuccess: (token: string, user: UserProfile) => void;
    onSwitchToRegister: () => void;
};

export default function Login({ onLoginSuccess, onSwitchToRegister }: LoginProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showConnectionSettings, setShowConnectionSettings] = useState(false);
    const [apiBaseInput, setApiBaseInput] = useState(getCurrentApiBaseUrl());
    const [apiBaseStatus, setApiBaseStatus] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { token, user } = await fetchJson<{ token: string; user: UserProfile }>("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            }, "Login failed");
            localStorage.setItem("authToken", token);
            onLoginSuccess(token, user);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Login failed";
            console.error("Login error:", err);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveApiBase = () => {
        setApiBaseStatus("");
        const ok = setPreferredApiBaseUrl(apiBaseInput);
        if (!ok) {
            setApiBaseStatus("Invalid URL. Example: https://api.discord.slovenitech.si");
            return;
        }
        setApiBaseStatus(`Using API base: ${getCurrentApiBaseUrl()}`);
    };

    const handleResetApiBase = () => {
        clearPreferredApiBaseUrl();
        const next = getCurrentApiBaseUrl();
        setApiBaseInput(next);
        setApiBaseStatus(`Reset complete. Using: ${next}`);
    };

    return (
        <div className="min-h-screen bg-[#0c0e11] flex items-center justify-center p-6">
            <div className="bg-[#14171b] border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl max-w-md w-full">
                <h1 className="text-3xl font-bold text-slate-100 mb-2">Chat Hub</h1>
                <p className="text-slate-400 mb-8 text-base">Welcome back.</p>

                {error && (
                    <div className="bg-slate-800 text-slate-100 p-4 rounded-lg mb-6 text-sm border border-slate-600/60">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-slate-300 text-sm font-semibold mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            className="w-full bg-[#0f1216] text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500 border border-white/10 transition-all"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-slate-300 text-sm font-semibold mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full bg-[#0f1216] text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500 border border-white/10 transition-all"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-200 hover:bg-white disabled:bg-slate-500 text-slate-900 font-bold py-3 rounded-lg transition-all"
                    >
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </form>

                <div className="mt-6 pt-4 border-t border-white/10">
                    <button
                        type="button"
                        onClick={() => setShowConnectionSettings((prev) => !prev)}
                        className="text-sm text-slate-300 hover:text-slate-100 transition-colors"
                    >
                        {showConnectionSettings ? "Hide" : "Show"} connection settings
                    </button>

                    {showConnectionSettings && (
                        <div className="mt-3 space-y-3">
                            <label className="block text-slate-300 text-xs font-semibold">API Base URL</label>
                            <input
                                type="text"
                                value={apiBaseInput}
                                onChange={(e) => setApiBaseInput(e.target.value)}
                                placeholder="https://api.discord.slovenitech.si"
                                className="w-full bg-[#0f1216] text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 border border-white/10"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveApiBase}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold py-2 rounded-lg"
                                >
                                    Save API URL
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetApiBase}
                                    className="flex-1 bg-[#0f1216] hover:bg-slate-800 text-slate-200 text-sm font-semibold py-2 rounded-lg border border-white/10"
                                >
                                    Reset
                                </button>
                            </div>
                            {apiBaseStatus && <p className="text-xs text-slate-300/90">{apiBaseStatus}</p>}
                        </div>
                    )}
                </div>

                <p className="text-slate-400 text-center mt-8">
                    Don't have an account?{" "}
                    <button
                        onClick={onSwitchToRegister}
                        className="text-slate-100 hover:text-white font-semibold transition-colors"
                    >
                        Register here
                    </button>
                </p>
            </div>
        </div>
    );
}
