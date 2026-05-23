"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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

function generateAnalysis(raw: string, level: string): { cause: string; fix: string; impact: string } {
  const msg = raw.toLowerCase();
  if (msg.includes("connection refused") || msg.includes("connection failed"))
    return { cause: "The service attempted to connect to a dependency but the connection was refused. The target service may be down, misconfigured, or unreachable.", fix: "1. Verify the target service is running.\n2. Check host/port in your config.\n3. Inspect firewall rules blocking the port.\n4. Review connection pool settings for exhaustion.", impact: "Dependent features will fail. Users may see 500 errors or degraded functionality." };
  if (msg.includes("timeout"))
    return { cause: "A network call or query exceeded the configured timeout. This can be caused by high latency, overloaded services, or slow queries.", fix: "1. Check if the target service is overloaded.\n2. Review slow query logs.\n3. Consider raising timeout limits for non-critical paths.\n4. Add circuit breaker patterns to fail fast.", impact: "Requests will hang until timeout, degrading UX and potentially blocking threads." };
  if (msg.includes("out of memory") || msg.includes("oom"))
    return { cause: "The process exceeded available memory — caused by memory leaks, oversized payloads, or insufficient heap allocation.", fix: "1. Profile memory with a heap dump.\n2. Review for leaks in recent changes.\n3. Increase container memory limits if appropriate.\n4. Implement pagination for large data loads.", impact: "The OS will kill the process, causing unexpected restarts and potential data loss." };
  if (msg.includes("permission denied") || msg.includes("access denied"))
    return { cause: "The process lacks required file system or resource permissions to perform the requested action.", fix: "1. Check file ownership with `ls -la`.\n2. Verify the service runs as the correct user.\n3. Apply correct permissions with `chmod`/`chown`.\n4. Review SELinux/AppArmor policies.", impact: "Operations requiring this resource will fail completely until permissions are corrected." };
  return { cause: `An unexpected error occurred. The message is: "${raw}". Manual investigation is required.`, fix: "1. Search the codebase for the error string.\n2. Review recent deployments or config changes.\n3. Check related log lines for context.\n4. Enable verbose/debug logging around this code path.", impact: level === "CRITICAL" ? "Critical severity — system stability may be affected." : "Error severity — the affected operation failed." };
}

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [sessionData, setSessionData] = useState<SessionDetail | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    setUser(getStoredUser());
    const id = getActiveSessionId();
    if (!id) { router.push("/incidents"); return; }
    getSession(id).then(setSessionData).catch(() => router.push("/incidents"));
  }, [router]);

  const id = Number(params.id);
  const incident: LogEntry | undefined = sessionData?.errors[id];

  if (!sessionData || !incident) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          <main className="flex flex-1 items-center justify-center">
            <p className="text-[13px] text-muted">
              {!sessionData ? "Loading…" : "Incident not found."}{" "}
              <Link href="/incidents" className="text-violet-soft hover:underline">Back</Link>
            </p>
          </main>
        </div>
      </div>
    );
  }

  const analysis = generateAnalysis(incident.raw, incident.level);
  const contextLines = sessionData.entries.filter(
    (e) => e.line_number >= incident.line_number - 3 && e.line_number <= incident.line_number + 3,
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          <div className="mx-auto max-w-3xl">
            <div className="text-[12px] text-muted">
              <Link href="/incidents" className="text-violet-soft hover:underline">Incidents</Link>
              <span className="mx-1.5">›</span>
              <span>Incident #{id + 1}</span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span
                className="rounded-md px-2.5 py-1 text-[12px] font-bold"
                style={{ background: levelBg(incident.level), color: levelColor(incident.level) }}
              >
                {incident.level}
              </span>
              <span className="text-[12px] text-muted">
                Line {incident.line_number} · {sessionData.filename}
              </span>
            </div>

            <h1
              className="mt-3 break-words font-mono text-[17px] font-bold leading-relaxed"
              style={{ color: levelColor(incident.level) }}
            >
              {incident.raw}
            </h1>

            {/* Context */}
            <div className="mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 backdrop-blur-xl">
              <div className="border-b border-white/[0.06] px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-muted">
                Log Context
              </div>
              {contextLines.map((line) => {
                const hit = line.line_number === incident.line_number;
                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-[52px_1fr] px-4 py-1.5"
                    style={{
                      background: hit ? `${levelColor(incident.level)}14` : "transparent",
                      borderLeft: hit
                        ? `3px solid ${levelColor(incident.level)}`
                        : "3px solid transparent",
                    }}
                  >
                    <span className="font-mono text-[11px] text-muted/70">{line.line_number}</span>
                    <span
                      className="font-mono text-[12px]"
                      style={{ color: hit ? levelColor(incident.level) : "#8b8b9c" }}
                    >
                      {line.raw}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Analysis */}
            {[
              { label: "Probable Root Cause", content: analysis.cause, color: "#e3b341", pre: false },
              { label: "Suggested Fix", content: analysis.fix, color: "#a78bfa", pre: true },
              { label: "Impact", content: analysis.impact, color: "#f85149", pre: false },
            ].map(({ label, content, color, pre }) => (
              <div
                key={label}
                className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-panel/60 backdrop-blur-xl"
              >
                <div className="border-b border-white/[0.06] px-4 py-3 text-[13px] font-bold" style={{ color }}>
                  {label}
                </div>
                <div className="px-4 py-3.5">
                  {pre ? (
                    <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-foreground/85">
                      {content}
                    </pre>
                  ) : (
                    <p className="text-[13.5px] leading-relaxed text-foreground/85">{content}</p>
                  )}
                </div>
              </div>
            ))}

            <div className="mt-6 flex gap-2.5">
              <Link
                href="/incidents"
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-muted transition hover:text-foreground"
              >
                <ArrowLeft size={14} /> Back
              </Link>
              <Link
                href="/explorer"
                className="rounded-xl bg-gradient-to-r from-violet to-violet-soft px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Open in Explorer
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
