"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import Avatar from "@/components/Avatar";

export default function TopBar({ user }: { user: { username: string } | null }) {
  const name = user?.username ?? "Guest";

  return (
    <header className="flex items-center gap-4 border-b border-white/[0.06] bg-ink-soft/40 px-8 py-4 backdrop-blur-xl">
      {/* user chip */}
      <div className="flex items-center gap-3">
        <Avatar username={name} size={40} />
        <p className="hidden text-[14px] font-semibold capitalize sm:block">{name}</p>
      </div>


      {/* actions */}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/upload"
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet to-violet-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-white shadow-lg shadow-violet/25 transition hover:opacity-90"
        >
          <Plus size={15} /> Upload Log
        </Link>
      </div>
    </header>
  );
}
