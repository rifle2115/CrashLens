"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { getMe, login, setStoredUser, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await login(username, password);
      setToken(access_token);
      const me = await getMe();
      if (me) setStoredUser({ id: me.id, username: me.username });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-violet-soft text-white shadow-lg shadow-violet/30">
            <Zap size={22} />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight">Sign in to CrashLens</h1>
          <p className="mt-1.5 text-[13px] text-muted">Analyze your logs, track your incidents</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/[0.08] bg-panel/60 p-7 backdrop-blur-xl"
        >
          <label className="mb-1.5 block text-[12.5px] font-semibold">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="your_username"
            className="mb-4 w-full rounded-xl border border-white/[0.08] bg-ink-soft/80 px-3.5 py-2.5 text-[13.5px] outline-none transition placeholder:text-muted focus:border-violet/50"
          />

          <label className="mb-1.5 block text-[12.5px] font-semibold">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="mb-5 w-full rounded-xl border border-white/[0.08] bg-ink-soft/80 px-3.5 py-2.5 text-[13.5px] outline-none transition placeholder:text-muted focus:border-violet/50"
          />

          {error && (
            <div
              className="mb-4 rounded-xl px-3.5 py-2.5 text-[12.5px]"
              style={{ background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.3)", color: "#f85149" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-violet to-violet-soft py-3 text-[14px] font-bold text-white shadow-lg shadow-violet/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-violet-soft hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
