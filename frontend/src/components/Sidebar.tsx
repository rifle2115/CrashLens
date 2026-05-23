"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellRing,
  FileText,
  LayoutDashboard,
  LogOut,
  ScrollText,
  TriangleAlert,
  Upload,
  Zap,
} from "lucide-react";
import {
  clearToken,
  getSessions,
  getStoredUser,
  getToken,
  setActiveSessionId,
  type SessionSummary,
} from "@/lib/api";
import AIAssistant from "@/components/AIAssistant";
import Avatar from "@/components/Avatar";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Log", icon: Upload },
  { href: "/explorer", label: "Log Explorer", icon: ScrollText },
  { href: "/incidents", label: "Incidents", icon: TriangleAlert },
  { href: "/alerts", label: "Alerts", icon: BellRing },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    setUser(getStoredUser());
    if (getToken()) getSessions().then(setSessions).catch(() => {});
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const openSession = (id: number) => {
    setActiveSessionId(id);
    router.push("/explorer");
  };

  return (
    <>
      <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-soft/80 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-violet-soft text-white shadow-lg shadow-violet/30">
              <Zap size={18} />
            </div>
            <div>
              <p className="text-[14px] font-bold leading-none">CrashLens</p>
              <p className="mt-1 text-[10.5px] text-muted">Crash Log Intelligence</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3">
          <p className="px-3 pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted">
            Menu
          </p>
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition ${
                  active
                    ? "bg-gradient-to-r from-violet/25 to-violet/[0.04] font-semibold text-foreground"
                    : "font-medium text-muted hover:bg-white/[0.04] hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-violet" />
                )}
                <Icon size={17} className={active ? "text-violet-soft" : ""} />
                {item.label}
              </Link>
            );
          })}

          {/* Recent sessions */}
          <div className="mt-5 flex items-center justify-between px-3 pb-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
              Recent Sessions
            </span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet/20 px-1.5 text-[10.5px] font-bold text-violet-soft">
              {sessions.length}
            </span>
          </div>
          {sessions.length === 0 && (
            <p className="px-3 pb-2 text-[11.5px] text-muted/70">No logs uploaded yet.</p>
          )}
          {sessions.slice(0, 5).map((s) => {
            const errs = (s.summary.ERROR ?? 0) + (s.summary.CRITICAL ?? 0);
            return (
              <button
                key={s.id}
                onClick={() => openSession(s.id)}
                className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.04]"
              >
                <FileText size={15} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/90">
                  {s.filename}
                </span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: errs > 0 ? "#f85149" : "#8b8b9c" }}
                >
                  {errs > 0 ? `${errs} err` : "clean"}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.06] p-3">
          {user && (
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5">
              <Avatar username={user.username} size={32} />
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold capitalize">
                  {user.username}
                </p>
                <p className="text-[10.5px] text-muted">Signed in</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:border-white/20 hover:text-foreground"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <AIAssistant />
    </>
  );
}
