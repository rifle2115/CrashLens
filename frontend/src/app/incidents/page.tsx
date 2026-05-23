"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, TriangleAlert } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import {
  getActiveSessionId,
  getSession,
  getStoredUser,
  getToken,
  type LogEntry,
  type SessionSummary,
} from "@/lib/api";
import { levelBg, levelColor } from "@/lib/store";

export default function IncidentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    setUser(getStoredUser());
    const id = getActiveSessionId();
    if (!id) { setLoading(false); return; }
    getSession(id)
      .then((s) => { setSession(s); setErrors((s as { errors: LogEntry[] }).errors ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (!loading && !session) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          <main className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet/15 text-violet-soft">
              <TriangleAlert size={26} />
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          <h1 className="text-[26px] font-bold tracking-tight">Incidents</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {loading
              ? "Loading…"
              : `${errors.length} error${errors.length !== 1 ? "s" : ""} in ${session?.filename}`}
          </p>

          <div className="mt-6">
            {errors.length === 0 && !loading ? (
              <div
                className="rounded-2xl px-6 py-12 text-center"
                style={{ background: "rgba(63,185,80,0.07)", border: "1px solid rgba(63,185,80,0.25)" }}
              >
                <CheckCircle2 size={34} className="mx-auto" style={{ color: "#3fb950" }} />
                <p className="mt-3 font-semibold" style={{ color: "#3fb950" }}>
                  No errors found in this log.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {errors.map((err, i) => (
                  <Link
                    key={err.id}
                    href={`/incidents/${i}`}
                    className="group flex items-start gap-3.5 rounded-2xl border border-white/[0.08] bg-panel/60 px-4 py-3.5 backdrop-blur-xl transition hover:border-white/20"
                  >
                    <span
                      className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: levelBg(err.level), color: levelColor(err.level) }}
                    >
                      {err.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[13px] text-foreground">{err.raw}</p>
                      <p className="mt-1 text-[11.5px] text-muted">
                        Line {err.line_number} · Click to view details
                      </p>
                    </div>
                    <ArrowRight
                      size={15}
                      className="mt-1 shrink-0 text-muted transition group-hover:text-violet-soft"
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
