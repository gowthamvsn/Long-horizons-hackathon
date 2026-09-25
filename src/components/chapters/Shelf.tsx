"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Book, Score, TutorName } from "@/lib/types";
import { Cover } from "./Cover";

const META: Record<TutorName, { name: string; sub: string; color: string }> = {
  transcript: { name: "🦉 Transcript Owl", sub: "Remembers everything, verbatim", color: "var(--clay)" },
  chapters: { name: "🦊 Chapters Fox", sub: "Remembers what matters now", color: "var(--sage)" },
};

export function Shelf({ tutor, book, score, onOpen }: { tutor: TutorName; book: Book; score: Score; onOpen: () => void }) {
  const meta = META[tutor];
  const stale = score.accuracy < 1 && !!score.stale_reason;
  return (
    <section className="paper-card flex min-w-0 flex-col rounded-2xl p-5">
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-medium" style={{ color: meta.color }}>
            {meta.name}
          </h2>
          <p className="text-xs text-[var(--ink-soft)]">{meta.sub}</p>
        </div>
        <Fit score={score} />
      </header>

      <div className="grid flex-1 grid-cols-[minmax(0,230px)_1fr] items-start gap-5">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.button
            key={`${tutor}-${book.session}`}
            onClick={onOpen}
            initial={{ opacity: 0, rotateY: -25, x: -20 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: 20, x: 20 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative block w-full text-left [perspective:800px]"
            whileHover={{ y: -4 }}
          >
            <Cover book={book} />
            {stale && tutor === "transcript" && <Ribbon />}
          </motion.button>
        </AnimatePresence>

        <div className="flex min-w-0 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={book.session}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex min-w-0 flex-1 flex-col"
            >
              <button onClick={onOpen} className="text-left font-display text-2xl leading-tight font-medium hover:underline decoration-[var(--line)] underline-offset-4">
                {book.title}
              </button>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <Chip>Level {book.level}</Chip>
                <Chip>{book.topic}</Chip>
                <Chip>{book.target_skill.replace("_", " ")}</Chip>
              </div>
              <p className="font-display mt-3 line-clamp-[9] text-[15px] leading-relaxed text-[var(--ink-soft)]">{book.text}</p>
              {stale && (
                <p
                  className="mt-auto pt-3 text-xs font-medium"
                  style={{ color: tutor === "transcript" ? "var(--ribbon)" : "var(--gold)" }}
                >
                  {tutor === "transcript" ? "✕ " : "△ "}
                  {score.stale_reason}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2 py-0.5 capitalize text-[var(--ink-soft)]">{children}</span>;
}

function Fit({ score }: { score: Score }) {
  const dots = [
    ["level", score.level_fit],
    ["topic", score.topic_fit],
    ["skill", score.skill_fit],
  ] as const;
  return (
    <div className="flex gap-1.5" title="Fit vs. what Maya actually needs">
      {dots.map(([k, v]) => (
        <span
          key={k}
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={v ? { background: "var(--sage-soft)", color: "var(--sage)" } : { background: "var(--clay-soft)", color: "var(--ribbon)" }}
        >
          {v ? "✓" : "✕"} {k}
        </span>
      ))}
    </div>
  );
}

function Ribbon() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25 }}
      className="pointer-events-none absolute -top-1 -right-1 size-24 overflow-hidden"
    >
      <div className="absolute top-5 -right-8 w-36 rotate-45 bg-[var(--ribbon)] py-1 text-center text-[10px] font-semibold tracking-widest text-white uppercase shadow-md">
        Stale
      </div>
    </motion.div>
  );
}
