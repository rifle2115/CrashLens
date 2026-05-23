"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Repeat } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import {
  getActiveSessionId,
  getSession,
  getStoredUser,
  getToken,
  type LogEntry,
  type SessionDetail,
} from "@/lib/api";
import { levelBg, levelColor } from "@/lib/store";

function severity(level: string): number {
  const map: Record<string, number> = { CRITICAL: 5, ERROR: 4, WARNING: 3, INFO: 2, DEBUG: 1, UNKNOWN: 0 };
  return map[level.toUpperCase()] ?? 0;
}

function findRecurring(entries: LogEntry[]) {
  const map = new Map<string, { count: number; level: string; lines: number[] }>();
  for (const e of entries) {
    const key = e.raw.replace(/\d+/g, "N").toLowerCase().trim();
    const existing = map.get(key);
    if (existing) { existing.count++; existing.lines.push(e.line_number); }
    else map.set(key, { count: 1, level: e.level, lines: [e.line_number] });
  }
  return [...map.entries()]
    .filter(([, v]) => v.count >= 2 && ["ERROR", "CRITICAL", "WARNING"].includes(v.level))
    .map(([message, v]) => ({ message, ...v }))
    .sort((a, b) => b.count - a.count || severity(b.level) - severity(a.level))
    .slice(0, 10);
}

export default function AlertsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    setUser(getStoredUser());
    const id = getActiveSessionId();
    if (!id) { setLoading(false); return; }
    getSession(id).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [router]);

  const alerts = useMemo(() => {
    if (!data) return [];
    return [...data.errors, ...data.warnings].sort(
      (a, b) => severity(b.level) - severity(a.level) || a.line_number - b.line_number,
    );
  }, [data]);

  const recurring = useMemo(() => (data ? findRecurring(data.entries) : []), [data]);

  if (!loading && !data) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          <main className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet/15 text-violet-soft">
              <BellRing size={26} />
            </div>
            <h2 className="text-[19px] font-bold">No active session</h2>
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

  const { ERROR = 0, CRITICAL = 0, WARNING = 0 } = data?.summary ?? {};

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          <h1 className="text-[26px] font-bold tracking-tight">Alerts</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {loading
              ? "Loading…"
              : `${data?.filename} · ${ERROR + CRITICAL} error(s) · ${WARNING} warning(s)`}
          </p>

          {/* Stat cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Critical", count: CRITICAL, color: "#ff7b72" },
              { label: "Errors", count: ERROR, color: "#f85149" },
              { label: "Warnings", count: WARNING, color: "#e3b341" },
              { label: "Recurring", count: recurring.length, color: "#a78bfa" },
            ].map((s) => (
              <div
                key={s.label}
                className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 p-5 backdrop-blur-xl"
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl"
                  style={{ background: s.color }}
                />
                <div className="relative text-[28px] font-bold tracking-tight" style={{ color: s.color }}>
                  {s.count}
                </div>
                <div className="relative mt-1 text-[12px] text-muted">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recurring */}
          {recurring.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 backdrop-blur-xl">
              <div
                className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5 text-[13px] font-bold"
                style={{ color: "#e3b341" }}
              >
                <Repeat size={14} /> Recurring Failures
              </div>
              {recurring.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-3 last:border-0"
                >
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: levelBg(r.level), color: levelColor(r.level) }}
                  >
                    {r.level}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground/85">
                    {r.message}
                  </span>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "rgba(227,179,65,0.15)", color: "#e3b341" }}
                  >
                    ×{r.count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* All alerts */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 backdrop-blur-xl">
            <div className="border-b border-white/[0.06] px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              All Alerts ({alerts.length})
            </div>
            {alerts.length === 0 && !loading ? (
              <div className="px-5 py-12 text-center text-[13px] text-muted">
                No errors or warnings found.
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                {alerts.map((alert) => {
                  const errorIdx = data?.errors.indexOf(alert) ?? -1;
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center gap-3 border-b border-white/[0.04] px-5 py-2.5 last:border-0"
                      style={{ borderLeft: `3px solid ${levelColor(alert.level)}` }}
                    >
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: levelBg(alert.level), color: levelColor(alert.level) }}
                      >
                        {alert.level}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground/85">
                        {alert.raw}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted/70">Line {alert.line_number}</span>
                      {errorIdx >= 0 && (
                        <Link
                          href={`/incidents/${errorIdx}`}
                          className="shrink-0 text-[11px] font-medium text-violet-soft hover:underline"
                        >
                          Details →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
