"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  role: Role;
  content: string;
};

type ModeDecision = {
  mood: "negative" | "positive" | "neutral";
  mode: "Supportive" | "Exploratory";
  reason: string;
  confidence: number;
  matches: { positive: string[]; negative: string[] };
};

const initialAssistant: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I'm Bridge's mood-aware assistant. Share how you're feeling or what you're exploring, and I'll adapt my style in real time.",
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistant]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<ModeDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);
    setDecision(null);
    setLoading(true);
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let metaParsed = false;
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        if (!metaParsed) {
          const newlineIndex = buffer.indexOf("\n");
          if (newlineIndex !== -1) {
            const metaLine = buffer.slice(0, newlineIndex);
            if (metaLine.startsWith("META:")) {
              try {
                const parsed = JSON.parse(metaLine.replace("META:", ""));
                setDecision(parsed);
              } catch (err) {
                console.error("Failed to parse mode metadata", err);
              }
              buffer = buffer.slice(newlineIndex + 1);
            }
            metaParsed = true;
          } else {
            continue;
          }
        }

        if (buffer) {
          assistantText += buffer;
          buffer = "";
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: assistantText };
            return next;
          });
        }
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong streaming the response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <div className="m-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Bridge Mood-Aware Chat</p>
            <h1 className="text-2xl font-bold text-zinc-900">Adaptive chat prototype</h1>
            <p className="text-sm text-zinc-600">
              Detect mood, route to mode, and stream a response from Claude.
            </p>
          </div>
          {decision && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              <p className="font-semibold">
                Mode: {decision.mode} · Mood: {decision.mood}
              </p>
              <p className="text-xs text-indigo-700">Why: {decision.reason || "heuristic routing"}</p>
            </div>
          )}
        </header>

        <div
          ref={listRef}
          className="flex min-h-[320px] max-h-[480px] flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4"
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-6 ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-zinc-800 border border-zinc-200"
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.08em] opacity-70">
                  {m.role === "user" ? "You" : "Claude (streaming)"}
                </p>
                <p>{m.content || (loading ? "..." : "")}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-xs">
          <label className="mb-2 block text-sm font-medium text-zinc-700">Message</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-inner outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="How are you feeling or what are you exploring?"
            disabled={loading}
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              Mode and rationale show up as soon as the stream starts.
            </div>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                canSend ? "bg-indigo-600 hover:bg-indigo-500" : "bg-zinc-300 cursor-not-allowed"
              }`}
            >
              {loading ? "Streaming..." : "Send"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-zinc-900">What’s happening</p>
            <p>Heuristic mood detection -> mode routing -> Claude streaming reply.</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">Modes</p>
            <p>Negative -> Supportive (acknowledge, normalize, gentle question).</p>
            <p>Neutral/positive -> Exploratory (build, extend, one follow-up).</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-900">Visibility</p>
            <p>Mode + rationale card updates as soon as streaming starts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
