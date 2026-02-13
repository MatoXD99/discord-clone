import React, { useState } from "react";
import { fetchJson } from "../apiClient";

type LoginProps = {
    onLoginSuccess: (token: string, username: string) => void;
    onSwitchToRegister: () => void;
};

export default function Login({ onLoginSuccess, onSwitchToRegister }: LoginProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { token, user } = await fetchJson<{ token: string; user: { username: string } }>("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            }, "Login failed");
            localStorage.setItem("authToken", token);
            onLoginSuccess(token, user.username);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Login failed";
            console.error("Login error:", err);
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-900/50 p-12 rounded-2xl shadow-2xl max-w-md w-full backdrop-blur">
                <h1 className="text-4xl font-bold text-red-400 mb-3">Chat Hub</h1>
                <p className="text-red-200/70 mb-10 text-lg">Welcome back!</p>

                {error && (
                    <div className="bg-red-600/80 text-white p-4 rounded-lg mb-6 text-sm border border-red-400/50">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-red-300 text-sm font-semibold mb-3">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600 border border-slate-700 transition-all"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-red-300 text-sm font-semibold mb-3">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600 border border-slate-700 transition-all"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-red-800 disabled:to-red-900 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-red-600/50"
                    >
                        {loading ? "Logging in..." : "Log In"}
                    </button>
                </form>

                <p className="text-red-200/60 text-center mt-8">
                    Don't have an account?{" "}
                    <button
                        onClick={onSwitchToRegister}
                        className="text-red-400 hover:text-red-300 font-semibold transition-colors"
                    >
                        Register here
                    </button>
                </p>
            </div>
        </div>
    );
}
