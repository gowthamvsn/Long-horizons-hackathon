"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { SessionView } from "@/lib/types";

// Data-driven "look here" moments: sessions where the two tutors' accuracy diverges clearly.
// This is the explicit answer to "where do I point in the demo" — not something to infer from the trail.

interface Moment {
  session: number;
  winner: "chapters" | "transcript";
  foxAcc: number;
  owlAcc: number;
  foxReason: string;
  owlReason: string;
  headline: string;
}

function computeMoments(sessions: SessionView[]): Moment[] {
  const out: Moment[] = [];
  for (const s of sessions) {
    const f = s.scores.chapters.accuracy;
    const o = s.scores.transcript.accuracy;
    const diff = f - o;
    if (Math.abs(diff) < 0.34) continue; // require a real, visible gap
    const winner = diff > 0 ? "chapters" : "transcript";
    const headline =
      winner === "chapters"
        ? `Fox got it right, Owl didn't`
        : `Owl got it right, Fox didn't`;
    out.push({
      session: s.session,
      winner,
      foxAcc: f,
      owlAcc: o,
      foxReason: s.scores.chapters.stale_reason || "Correct: right level, right topic, right skill.",
      owlReason: s.scores.transcript.stale_reason || "Correct: right level, right topic, right skill.",
      headline,
    });
  }
  return out;
}

export function KeyMoments({ sessions, onPick }: { sessions: SessionView[]; onPick: (session: number) => void }) {
  const moments = useMemo(() => computeMoments(sessions), [sessions]);
  const [open, setOpen] = useState<Moment | null>(null);

  if (moments.length === 0) return null;

  return (
    <section className="paper-card rounded-2xl px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-4 text-[var(--gold)]" />
        <h3 className="font-display text-base font-medium">Key moments</h3>
        <span className="text-[11px] text-[var(--ink-soft)]">— where the two tutors' choices actually diverged</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {moments.map((m) => (
          <button
            key={m.session}
            onClick={() => {
              onPick(m.session);
              setOpen(m);
            }}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition hover:-translate-y-0.5"
            style={{
              borderColor: m.winner === "chapters" ? "var(--sage)" : "var(--clay)",
              background: m.winner === "chapters" ? "var(--sage-soft)" : "var(--clay-soft)",
              color: "var(--ink)",
            }}
          >
            <span className="font-display font-medium">Session {m.session}</span>
            <span>{m.winner === "chapters" ? "🦊 Fox" : "🦉 Owl"} caught it, {m.winner === "chapters" ? "🦉 Owl" : "🦊 Fox"} didn't</span>
            <span aria-hidden>→</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]"
          >
            <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="bg-[var(--sage-soft)] p-4">
                <div className="text-[10px] font-semibold tracking-wider text-[var(--sage)] uppercase">🦊 Chapters Fox · {Math.round(open.foxAcc * 100)}% right</div>
                <p className="font-display mt-1 text-lg leading-snug">
                  {open.foxAcc === 1 ? "Nailed it: right level, right topic, right skill." : open.foxReason}
                </p>
              </div>
              <div className="bg-[var(--clay-soft)] p-4">
                <div className="text-[10px] font-semibold tracking-wider text-[var(--ribbon)] uppercase">🦉 Transcript Owl · {Math.round(open.owlAcc * 100)}% right</div>
                <p className="font-display mt-1 text-lg leading-snug">
                  {open.owlAcc === 1 ? "Nailed it: right level, right topic, right skill." : open.owlReason}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
