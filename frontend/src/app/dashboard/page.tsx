"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bug,
  ChevronRight,
  Clock,
  FileStack,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MetricCard, { type MetricCardData } from "@/components/MetricCard";
import AICard from "@/components/AICard";
import {
  deleteSession,
  getSessions,
  getStoredUser,
  getToken,
  setActiveSessionId,
  type SessionSummary,
} from "@/lib/api";

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "#8b949e",
  INFO: "#58a6ff",
  WARNING: "#e3b341",
  ERROR: "#f85149",
  CRITICAL: "#ff7b72",
  UNKNOWN: "#6e7681",
};

/* ── helpers to build real graph data from sessions ────────────────────────── */

function buildPerUploadSeries(
  sessions: SessionSummary[],
  extract: (s: SessionSummary) => number,
): { i: number; v: number }[] {
  if (sessions.length === 0) return [{ i: 0, v: 0 }];

  // one point per upload, sorted oldest → newest
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime(),
  );
  return sorted.map((s, i) => ({ i, v: extract(s) }));
}

function computeTrend(series: { v: number }[]): number {
  if (series.length < 2) return 0;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  if (first === 0) return last > 0 ? 100 : 0;
  return Math.round(((last - first) / first) * 1000) / 10;
}

function todayCount(sessions: SessionSummary[], extract: (s: SessionSummary) => number): number {
  const today = new Date().toISOString().slice(0, 10);
  return sessions
    .filter((s) => new Date(s.uploaded_at).toISOString().slice(0, 10) === today)
    .reduce((a, s) => a + extract(s), 0);
}

function formatTag(trend: number, todayVal: number): string {
  const arrow = trend >= 0 ? "▲" : "▼";
  const display = todayVal >= 1000 ? `${(todayVal / 1000).toFixed(1)}k` : String(todayVal);
  return `${arrow} ${display} today`;
}

/* ── component ─────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    getSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setUser(getStoredUser());
    load();
  }, [router]);

  const handleOpen = (id: number) => {
    setActiveSessionId(id);
    router.push("/explorer");
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this log session?")) return;
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const totals = sessions.reduce(
    (acc, s) => ({
      logs: acc.logs + s.total_lines,
      errors: acc.errors + (s.summary.ERROR ?? 0) + (s.summary.CRITICAL ?? 0),
      warnings: acc.warnings + (s.summary.WARNING ?? 0),
    }),
    { logs: 0, errors: 0, warnings: 0 },
  );

  // Build real series — one data point per upload
  const extractErrors = (s: SessionSummary) => (s.summary.ERROR ?? 0) + (s.summary.CRITICAL ?? 0);
  const extractWarnings = (s: SessionSummary) => s.summary.WARNING ?? 0;
  const extractLines = (s: SessionSummary) => s.total_lines;

  const errorSeries = buildPerUploadSeries(sessions, extractErrors);
  const warnSeries = buildPerUploadSeries(sessions, extractWarnings);
  const linesSeries = buildPerUploadSeries(sessions, extractLines);

  const errorTrend = computeTrend(errorSeries);
  const warnTrend = computeTrend(warnSeries);
  const linesTrend = computeTrend(linesSeries);

  const metrics: MetricCardData[] = [
    {
      id: "errors",
      label: sessions.length > 0 ? `Across ${sessions.length} sessions` : "No sessions yet",
      name: "Errors",
      value: totals.errors,
      trend: errorTrend,
      tag: formatTag(errorTrend, todayCount(sessions, extractErrors)),
      color: "#f85149",
      href: "/incidents",
      icon: <Bug size={17} />,
      series: errorSeries,
    },
    {
      id: "warnings",
      label: sessions.length > 0 ? `Across ${sessions.length} sessions` : "No sessions yet",
      name: "Warnings",
      value: totals.warnings,
      trend: warnTrend,
      tag: formatTag(warnTrend, todayCount(sessions, extractWarnings)),
      color: "#e3b341",
      href: "/explorer",
      icon: <TriangleAlert size={17} />,
      series: warnSeries,
    },
    {
      id: "lines",
      label: sessions.length > 0 ? `Across ${sessions.length} sessions` : "No sessions yet",
      name: "Lines Parsed",
      value: totals.logs,
      trend: linesTrend,
      tag: formatTag(linesTrend, todayCount(sessions, extractLines)),
      color: "#a78bfa",
      href: "/upload",
      icon: <FileStack size={17} />,
      series: linesSeries,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          {/* Header row */}
          <h1 className="text-[26px] font-bold tracking-tight">Dashboard</h1>

          {/* Metrics + AI card — 2×2 grid */}
          <div className="mt-6 grid grid-cols-1 gap-5 auto-rows-fr sm:grid-cols-2">
            {metrics.map((m, i) => (
              <MetricCard key={m.id} data={m} index={i} />
            ))}
            <AICard />
          </div>

          {/* Sessions panel */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32, ease: "easeOut" }}
            className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 backdrop-blur-xl"
          >
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold">Your log sessions</h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                  <Clock size={12} /> Last updated just now
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/upload"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-muted transition hover:text-foreground"
                  aria-label="Upload log"
                >
                  <Plus size={14} />
                </Link>
                <button
                  onClick={load}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-muted transition hover:text-foreground"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* States */}
            {loading && (
              <div className="px-5 py-12 text-center text-[13px] text-muted">
                Loading sessions…
              </div>
            )}
            {error && (
              <div className="px-5 py-4 text-[13px]" style={{ color: "#f85149" }}>
                ⚠ {error}
              </div>
            )}
            {!loading && !error && sessions.length === 0 && (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/15 text-violet-soft">
                  <FileStack size={22} />
                </div>
                <p className="text-sm font-semibold">No logs uploaded yet</p>
                <p className="mt-1 text-[12.5px] text-muted">
                  Upload your first log file to get started.
                </p>
                <Link
                  href="/upload"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet to-violet-soft px-4 py-2.5 text-[12.5px] font-semibold text-white"
                >
                  <Plus size={14} /> Upload Log
                </Link>
              </div>
            )}

            {/* Rows */}
            {!loading &&
              sessions.map((s) => {
                const errors = (s.summary.ERROR ?? 0) + (s.summary.CRITICAL ?? 0);
                const warnings = s.summary.WARNING ?? 0;
                const maxCount = Math.max(...Object.values(s.summary), 1);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleOpen(s.id)}
                    className="flex cursor-pointer items-center gap-4 border-b border-white/[0.05] px-5 py-3.5 transition last:border-0 hover:bg-white/[0.025]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-muted">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-foreground">
                          {s.filename}
                        </span>
                        {errors > 0 && (
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: "rgba(248,81,73,0.13)", color: "#f85149" }}
                          >
                            {errors} err
                          </span>
                        )}
                        {warnings > 0 && (
                          <span
                            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                            style={{ background: "rgba(227,179,65,0.13)", color: "#e3b341" }}
                          >
                            {warnings} warn
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {Object.entries(s.summary)
                          .filter(([, v]) => v > 0)
                          .map(([level, count]) => (
                            <div key={level} className="flex items-center gap-1">
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: Math.max(5, Math.round((count / maxCount) * 44)),
                                  background: LEVEL_COLORS[level] ?? "#8b949e",
                                }}
                              />
                              <span className="text-[9.5px] text-muted/70">{count}</span>
                            </div>
                          ))}
                        <span className="ml-1 text-[10.5px] text-muted/70">
                          · {s.total_lines} lines ·{" "}
                          {new Date(s.uploaded_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link
                        href={`/incidents?session=${s.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSessionId(s.id);
                        }}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11.5px] font-medium text-violet-soft transition hover:border-violet/40"
                      >
                        Incidents
                      </Link>
                      <button
                        onClick={(e) => handleDelete(e, s.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] text-muted transition hover:text-[#f85149]"
                        aria-label="Delete session"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight size={15} className="text-muted/50" />
                    </div>
                  </div>
                );
              })}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
