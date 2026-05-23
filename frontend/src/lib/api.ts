// Configured at build time via NEXT_PUBLIC_API_URL. Falls back to localhost
// so plain `npm run dev` keeps working with no .env.local.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Token / session helpers ───────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cl_token");
}
export function setToken(t: string) { localStorage.setItem("cl_token", t); }
export function clearToken() { localStorage.removeItem("cl_token"); localStorage.removeItem("cl_user"); localStorage.removeItem("cl_session"); }

export function getStoredUser(): { id: number; username: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cl_user");
  return raw ? JSON.parse(raw) : null;
}
export function setStoredUser(u: { id: number; username: string }) { localStorage.setItem("cl_user", JSON.stringify(u)); }

export function getActiveSessionId(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem("cl_session");
  return v ? Number(v) : null;
}
export function setActiveSessionId(id: number) { localStorage.setItem("cl_session", String(id)); }

// ── Base fetch ────────────────────────────────────────────────────────────────

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${BASE}${path}`, { ...init, headers });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signup(username: string, password: string): Promise<{ access_token: string }> {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return json(res);
}

export async function login(username: string, password: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return json(res);
}

export async function getMe(): Promise<{ id: number; username: string; created_at: string } | null> {
  const res = await req("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: number;
  filename: string;
  total_lines: number;
  summary: Record<string, number>;
  uploaded_at: string;
}

export interface LogEntry {
  id: number;
  line_number: number;
  level: string;
  raw: string;
}

export interface SessionDetail extends SessionSummary {
  entries: LogEntry[];
  errors: LogEntry[];
  warnings: LogEntry[];
}

export async function getSessions(): Promise<SessionSummary[]> {
  return json(await req("/sessions"));
}

export async function getSession(id: number): Promise<SessionDetail> {
  return json(await req(`/sessions/${id}`));
}

export async function getEntries(sessionId: number, level?: string, q?: string): Promise<LogEntry[]> {
  const params = new URLSearchParams();
  if (level && level !== "ALL") params.set("level", level);
  if (q) params.set("q", q);
  return json(await req(`/sessions/${sessionId}/entries?${params}`));
}

export async function analyzeLog(formData: FormData): Promise<SessionSummary> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/analyze`, { method: "POST", headers, body: formData });
  return json(res);
}

export async function deleteSession(id: number): Promise<void> {
  const res = await req(`/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithAI(
  message: string,
  history: ChatMessage[],
  sessionId: number | null | undefined,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE}/ai/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ session_id: sessionId ?? null, message, history: history.slice(-6) }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail ?? "Request failed");
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out — try a shorter question.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
