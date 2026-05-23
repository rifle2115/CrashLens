"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSearch, Search } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import {
  getActiveSessionId,
  getEntries,
  getSession,
  getStoredUser,
  getToken,
  type LogEntry,
  type SessionSummary,
} from "@/lib/api";
import { levelBg, levelColor } from "@/lib/store";

const LEVELS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL", "UNKNOWN"];

export default function ExplorerPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    setUser(getStoredUser());
    const id = getActiveSessionId();
    if (!id) { setLoading(false); return; }

    Promise.all([getSession(id), getEntries(id)])
      .then(([s, e]) => { setSession(s); setEntries(e); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const id = getActiveSessionId();
    if (!id) return;
    getEntries(id, filter === "ALL" ? undefined : filter, search || undefined)
      .then(setEntries)
      .catch(() => {});
  }, [filter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => { map[e.level] = (map[e.level] ?? 0) + 1; });
    return map;
  }, [entries]);

  if (!loading && !session) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          <main className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet/15 text-violet-soft">
              <FileSearch size={26} />
            </div>
            <h2 className="text-[19px] font-bold">No active session</h2>
            <p className="text-[13px] text-muted">Upload a log or select a session from the dashboard.</p>
            <Link
              href="/upload"
              className="mt-2 rounded-xl bg-gradient-to-r from-violet to-violet-soft px-5 py-2.5 text-[13px] font-semibold text-white"
            >
              Upload Log →
            </Link>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex flex-1 flex-col overflow-hidden px-8 py-7">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">Log Explorer</h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {session?.filename} · {entries.length} entries shown
            </p>
          </div>

          {/* Search + filters */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs…"
                className="w-64 rounded-xl border border-white/[0.08] bg-panel/50 py-2.5 pl-9 pr-3 text-[13px] outline-none transition placeholder:text-muted focus:border-violet/50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((l) => {
                const count = l === "ALL" ? entries.length : (counts[l] ?? 0);
                const active = filter === l;
                const c = l === "ALL" ? "#7c5cff" : levelColor(l);
                return (
                  <button
                    key={l}
                    onClick={() => setFilter(l)}
                    className="rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition"
                    style={{
                      borderColor: active ? c : "rgba(255,255,255,0.08)",
                      background: active ? `${c}1f` : "transparent",
                      color: active ? c : "#8b8b9c",
                    }}
                  >
                    {l} {count > 0 && <span className="opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 backdrop-blur-xl">
            <div className="grid grid-cols-[64px_92px_1fr] border-b border-white/[0.06] px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-muted">
              <span>Line</span>
              <span>Level</span>
              <span>Message</span>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted">Loading entries…</div>
            ) : error ? (
              <div className="px-5 py-4 text-[13px]" style={{ color: "#f85149" }}>⚠ {error}</div>
            ) : entries.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted">No entries match your filter.</div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {entries.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[64px_92px_1fr] border-b border-white/[0.04] px-4 py-2 transition hover:bg-white/[0.025]"
                    style={i % 2 ? { background: "rgba(255,255,255,0.012)" } : undefined}
                  >
                    <span className="font-mono text-[11px] text-muted/70">{entry.line_number}</span>
                    <span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: levelBg(entry.level), color: levelColor(entry.level) }}
                      >
                        {entry.level}
                      </span>
                    </span>
                    <span
                      className="break-words font-mono text-[12.5px]"
                      style={{ color: levelColor(entry.level) }}
                    >
                      {entry.raw}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
