import { useState } from "react";
import type { FormEvent } from "react";

type LoginProps = {
  onSubmit: (username: string, password: string) => void;
  onSwitchToRegister: () => void;
};

export default function Login({ onSubmit, onSwitchToRegister }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim()) return;
    onSubmit(username.trim(), password);
  };

  return (
    <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center px-4">
      {/* Auth card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-8 shadow-2xl"
      >
        <h1 className="text-3xl font-semibold text-zinc-100">Welcome back</h1>
        <p className="mt-2 text-sm text-zinc-400">Log in to continue chatting.</p>

        <div className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-300">
              Username
            </label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 outline-none transition hover:border-zinc-500 focus:border-zinc-400"
              placeholder="Enter password"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-7 w-full rounded-lg border border-zinc-600 bg-zinc-700 px-4 py-2.5 font-medium text-zinc-100 transition hover:bg-zinc-600"
        >
          Log In
        </button>

        <p className="mt-5 text-center text-sm text-zinc-400">
          Need an account?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-zinc-200 underline decoration-zinc-500 underline-offset-2 hover:text-zinc-100"
          >
            Register
          </button>
        </p>
      </form>
    </div>
  );
}
