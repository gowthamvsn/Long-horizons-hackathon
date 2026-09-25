"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { SponsorTag } from "./SponsorTag";

const EXAMPLES = [
  "When did she last miss 'ea' words?",
  "What topics has she enjoyed most?",
  "Which facts were archived and why?",
  "How did token cost compare between the two tutors?",
];

interface Result {
  answer?: string;
  sql?: string;
  rowCount?: number;
  error?: string;
}

export function AskArchive({ run }: { run: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function ask(question: string) {
    setQ(question);
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, run }) });
      setRes(await r.json());
    } catch (e) {
      setRes({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="paper-card rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-medium">
          Ask the archive
          <SponsorTag tool="rawtree" note="RawTree (Tinybird) stores every raw event and archived fact. This box turns your question into SQL, runs it live, and shows both." />
        </h2>
        <p className="text-xs text-[var(--ink-soft)]">Everything Chapters let go of is still in RawTree, one SQL query away.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q);
        }}
        className="mt-3 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask anything about Maya's semester…"
            className="w-full rounded-full border border-[var(--line)] bg-[var(--paper)] py-2.5 pr-4 pl-9 text-sm outline-none focus:border-[var(--sage)]"
          />
        </div>
        <button disabled={busy} className="rounded-full bg-[var(--ink)] px-5 text-sm text-[var(--paper)] disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => ask(ex)} disabled={busy} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--ink-soft)] transition hover:bg-[var(--sage-soft)] hover:text-[var(--ink)]">
            {ex}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {res && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 grid gap-3 md:grid-cols-2">
            {res.error ? (
              <p className="text-sm text-[var(--ribbon)]">{res.error}</p>
            ) : (
              <>
                <p className="font-display text-lg leading-snug">{res.answer}</p>
                <div className="min-w-0">
                  <div className="mb-1 text-[10px] tracking-wider text-[var(--ink-soft)] uppercase">
                    SQL run on RawTree · {res.rowCount} rows
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-[var(--ink)] p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-[#f3ebd9]">{res.sql}</pre>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
