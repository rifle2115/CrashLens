"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FolderOpen, Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { analyzeLog, getStoredUser, getToken, setActiveSessionId } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [dragging, setDragging] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    setUser(getStoredUser());
  }, [router]);

  const applyFile = (f: File) => {
    setFile(f);
    setSessionName(f.name.replace(/\.[^.]+$/, ""));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) applyFile(dropped);
  };

  const handleUpload = async () => {
    setErrorMsg("");
    if (tab === "file" && !file) { setErrorMsg("Please select a file first."); return; }
    if (tab === "paste" && !pasteText.trim()) { setErrorMsg("Please paste some log content first."); return; }

    setStatus("uploading");
    try {
      const resolvedName = sessionName.trim() || (tab === "paste" ? "Pasted Log" : file?.name ?? "log");
      const formData = new FormData();
      if (tab === "file" && file) {
        formData.append("file", file);
      } else {
        formData.append("file", new Blob([pasteText], { type: "text/plain" }), "pasted.log");
      }
      formData.append("name", resolvedName);
      setStatus("analyzing");
      const session = await analyzeLog(formData);
      setActiveSessionId(session.id);
      setStatus("done");
      setTimeout(() => router.push("/explorer"), 900);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Upload failed. Is the backend running?");
    }
  };

  const busy = status === "uploading" || status === "analyzing";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-[26px] font-bold tracking-tight">Upload Log</h1>
            <p className="mt-1.5 text-[13px] text-muted">
              Upload a .log or .txt file, or paste raw log content. Your logs are saved to your account.
            </p>

            {/* Tabs */}
            <div className="mt-6 flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
              {(["file", "paste"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-semibold transition ${
                    tab === t
                      ? "bg-gradient-to-r from-violet to-violet-soft text-white"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t === "file" ? "Upload File" : "Paste Logs"}
                </button>
              ))}
            </div>

            {tab === "file" ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`mt-5 cursor-pointer rounded-2xl border-2 border-dashed p-14 text-center transition ${
                  dragging
                    ? "border-violet bg-violet/[0.06]"
                    : file
                      ? "border-[#3fb950]/60"
                      : "border-white/10 bg-panel/40 hover:border-white/20"
                }`}
                style={file ? { background: "rgba(63,185,80,0.05)" } : undefined}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".log,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files && applyFile(e.target.files[0])}
                />
                {file ? (
                  <>
                    <CheckCircle2 size={40} className="mx-auto" style={{ color: "#3fb950" }} />
                    <p className="mt-3 font-semibold" style={{ color: "#3fb950" }}>{file.name}</p>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </>
                ) : (
                  <>
                    <FolderOpen size={40} className="mx-auto text-violet-soft" />
                    <p className="mt-3 font-semibold">Drop your log file here</p>
                    <p className="mt-1 text-[12.5px] text-muted">
                      or click to browse · .log and .txt supported
                    </p>
                  </>
                )}
              </div>
            ) : (
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Paste log content here…\n\nINFO Server started\nWARNING Memory high\nERROR Database connection failed"}
                className="mt-5 h-60 w-full resize-y rounded-2xl border border-white/[0.08] bg-panel/50 p-4 font-mono text-[13px] leading-relaxed outline-none transition placeholder:text-muted focus:border-violet/50"
              />
            )}

            {/* Save as */}
            <div className="mt-5">
              <label className="mb-1.5 block text-[12.5px] font-medium text-muted">Save as</label>
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={tab === "paste" ? "Pasted Log" : "My log session"}
                disabled={busy}
                className="w-full rounded-xl border border-white/[0.08] bg-panel/50 px-3.5 py-2.5 text-[13px] outline-none transition placeholder:text-muted focus:border-violet/50 disabled:opacity-60"
              />
            </div>

            {busy && (
              <div
                className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px]"
                style={{ background: "rgba(124,92,255,0.1)", border: "1px solid rgba(124,92,255,0.3)", color: "#a78bfa" }}
              >
                <Loader2 size={15} className="animate-spin" />
                {status === "uploading" ? "Uploading file…" : "Parsing and saving to your account…"}
              </div>
            )}
            {status === "done" && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-[13px]"
                style={{ background: "rgba(63,185,80,0.1)", border: "1px solid rgba(63,185,80,0.3)", color: "#3fb950" }}
              >
                Saved to your account — redirecting to Log Explorer…
              </div>
            )}
            {errorMsg && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-[13px]"
                style={{ background: "rgba(248,81,73,0.1)", border: "1px solid rgba(248,81,73,0.3)", color: "#f85149" }}
              >
                ⚠ {errorMsg}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={busy || status === "done"}
              className="mt-6 rounded-xl bg-gradient-to-r from-violet to-violet-soft px-6 py-3 text-[14px] font-bold text-white shadow-lg shadow-violet/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Analyzing…" : "Analyze Log →"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
