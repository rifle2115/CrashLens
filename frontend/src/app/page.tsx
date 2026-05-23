"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const dest = getToken() ? "/dashboard" : "/signup";
    const t = setTimeout(() => router.replace(dest), 2100);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "radial-gradient(680px circle at 50% 46%, rgba(124,92,255,0.24), #0a0a0f 72%)" }}
    >
      <span
        className="cl-splash-word font-extrabold tracking-tight"
        style={{ fontSize: "clamp(42px, 9vw, 72px)" }}
      >
        CrashLens
      </span>
    </div>
  );
}
