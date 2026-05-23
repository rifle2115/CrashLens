"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

function openAI(prompt?: string) {
  window.dispatchEvent(
    new CustomEvent("crashlens:open-ai", prompt ? { detail: { prompt } } : undefined),
  );
}

export default function AICard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.26, ease: "easeOut" }}
      className="relative flex flex-col overflow-hidden rounded-2xl border border-violet/30 p-6"
      style={{ background: "linear-gradient(160deg, #2a1a4a 0%, #1a1330 58%, #120f20 100%)" }}
    >
      <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-violet/40 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet to-violet-soft text-white">
            <Sparkles size={16} />
          </div>
          <span className="text-[14px] font-semibold">CrashLens AI</span>
        </div>
      </div>

      <h2 className="relative mt-5 text-[22px] font-bold leading-tight tracking-tight">
        AI Crash Analysis
      </h2>
      <p className="relative mt-2 text-[12.5px] leading-relaxed text-white/55">
        Ask CrashLens AI anything about your logs — it spots patterns, explains
        errors, and suggests fixes instantly.
      </p>

      <div className="relative mt-auto flex flex-col gap-2.5 pt-6">
        <button
          onClick={() => openAI()}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/95 px-4 py-3 text-[13px] font-bold text-[#2a1a4a] transition hover:bg-white"
        >
          <Sparkles size={15} /> Ask CrashLens AI
        </button>
        <button
          onClick={() => openAI("Summarize the key issues")}
          className="flex items-center justify-center gap-2 rounded-xl border border-violet/30 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white/75 transition hover:bg-white/[0.08]"
        >
          Summarize my logs <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}
