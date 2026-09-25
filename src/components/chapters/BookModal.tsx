"use client";

import { Pause, Play, Square, Volume2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Book, Score } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Cover } from "./Cover";
import { useReadAloud } from "./useReadAloud";

const SKILL_LABEL: Record<string, string> = {
  vowel_teams: "vowel teams (ea, ai, oa)",
  silent_e: "silent e",
  digraphs: "digraphs (sh, ch, th)",
  blends: "blends",
  none: "free reading",
};

export function BookModal({ book, score, onClose }: { book: Book | null; score?: Score; onClose: () => void }) {
  return (
    <Dialog open={!!book} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl! border-[var(--line)] bg-[#fffdf7] p-0 sm:max-w-4xl">
        {book && <BookBody book={book} score={score} />}
      </DialogContent>
    </Dialog>
  );
}

function BookBody({ book, score }: { book: Book; score?: Score }) {
  const { tokens, state, activeToken, play, pause, stop, supported } = useReadAloud(book.text);
  return (
    <div className="grid gap-8 p-8 md:grid-cols-[240px_1fr]">
      <div className="space-y-4">
        <Cover book={book} />
        <div className="space-y-1 text-xs text-[var(--ink-soft)]">
          <div>
            Session {book.session} · Level {book.level} · {book.topic}
          </div>
          <div>Practicing {SKILL_LABEL[book.target_skill] ?? book.target_skill}</div>
          <div className="capitalize">{book.tutor === "chapters" ? "Chapters tutor" : "Transcript tutor"}</div>
        </div>
        {score?.stale_reason && (
          <div className="rounded-md bg-[var(--clay-soft)] px-3 py-2 text-xs text-[var(--ribbon)]">{score.stale_reason}</div>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <DialogTitle className="font-display text-3xl leading-tight font-medium">{book.title}</DialogTitle>
        <DialogDescription className="sr-only">Full text of the picture book</DialogDescription>

        {supported && (
          <div className="mt-4 flex items-center gap-2">
            {state === "playing" ? (
              <button onClick={pause} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--paper)] transition hover:opacity-90">
                <Pause className="size-4" /> Pause
              </button>
            ) : (
              <button onClick={play} className="inline-flex items-center gap-2 rounded-full bg-[var(--sage)] px-4 py-2 text-sm text-white transition hover:opacity-90">
                {state === "paused" ? <Play className="size-4" /> : <Volume2 className="size-4" />}
                {state === "paused" ? "Resume" : "Read to me"}
              </button>
            )}
            {state !== "idle" && (
              <button onClick={stop} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-[var(--ink-soft)] hover:bg-[var(--paper-deep)]">
                <Square className="size-3.5" /> Stop
              </button>
            )}
          </div>
        )}

        <p className="font-display mt-6 text-[1.35rem] leading-[1.75] text-[var(--ink)]">
          {tokens.map((t, i) =>
            t.isWord ? (
              <span key={i} className={cn("transition-colors duration-150", i === activeToken && "word-active")}>
                {t.text}
              </span>
            ) : (
              t.text
            ),
          )}
        </p>

        {book.fact_title && (
          <div className="mt-auto pt-6 text-xs text-[var(--ink-soft)]">
            Real-world fact via Nimble:{" "}
            <a href={book.fact_url} target="_blank" rel="noreferrer" className="underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--ink)]">
              {book.fact_title}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
