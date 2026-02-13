import React, { useState } from "react";
import { fetchJson } from "../apiClient";

import type { UserProfile } from "./Layout";

type RegisterProps = {
    onRegisterSuccess: (token: string, user: UserProfile) => void;
    onSwitchToLogin: () => void;
};

export default function Register({ onRegisterSuccess, onSwitchToLogin }: RegisterProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            await fetchJson<{ id: number; username: string }>("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            }, "Registration failed");

            const { token, user } = await fetchJson<{ token: string; user: UserProfile }>("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            }, "Login after registration failed");
            localStorage.setItem("authToken", token);
            onRegisterSuccess(token, user);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Registration failed";
            console.error("Registration error:", err);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0c0e11] flex items-center justify-center p-6">
            <div className="bg-[#14171b] border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl max-w-md w-full">
                <h1 className="text-3xl font-bold text-slate-100 mb-2">Join Chat Hub</h1>
                <p className="text-slate-400 mb-8 text-base">Create your account.</p>

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
                            placeholder="Choose a username"
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
                            placeholder="Create a password"
                            className="w-full bg-[#0f1216] text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500 border border-white/10 transition-all"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-slate-300 text-sm font-semibold mb-2">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            className="w-full bg-[#0f1216] text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500 border border-white/10 transition-all"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-200 hover:bg-white disabled:bg-slate-500 text-slate-900 font-bold py-3 rounded-lg transition-all"
                    >
                        {loading ? "Creating account..." : "Register"}
                    </button>
                </form>

                <p className="text-slate-400 text-center mt-8">
                    Already have an account?{" "}
                    <button
                        onClick={onSwitchToLogin}
                        className="text-slate-100 hover:text-white font-semibold transition-colors"
                    >
                        Log in here
                    </button>
                </p>
            </div>
        </div>
    );
}
