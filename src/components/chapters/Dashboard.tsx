"use client";

import { useEffect, useState } from "react";
import type { SemesterData, TutorName } from "@/lib/types";
import { BookModal } from "./BookModal";
import { Charts } from "./Charts";
import { Gauges } from "./Gauges";
import { Hud, MilestoneBanner } from "./Hud";
import { Mind } from "./Mind";
import { Scrubber } from "./Scrubber";
import { Shelf } from "./Shelf";
import { TrailMap } from "./TrailMap";

export function Dashboard({ data, initialSession = 1, askSlot }: { data: SemesterData; initialSession?: number; askSlot?: React.ReactNode }) {
  const n = data.sessions.length;
  const [session, setSession] = useState(Math.min(Math.max(1, initialSession), Math.max(1, n)));
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState<TutorName | null>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setSession((s) => {
        if (s >= n) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1600);
    return () => clearInterval(t);
  }, [playing, n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") setSession((s) => Math.min(n, s + 1));
      if (e.key === "ArrowLeft") setSession((s) => Math.max(1, s - 1));
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, open]);

  if (n === 0) return null;
  const idx = Math.min(session, n) - 1;
  const cur = data.sessions[idx];
  const maxTokens = Math.max(...data.sessions.map((s) => s.tokens.transcript)) * 1.05;

  return (
    <main className="mx-auto flex max-w-[1500px] flex-col gap-4 px-6 py-5">
      <header className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-5xl font-semibold tracking-tight">Chapters</h1>
          <p className="font-display text-lg text-[var(--ink-soft)] italic">A tutor that grows with the kid</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-lg leading-none">{data.student.name}</div>
            <div className="text-xs text-[var(--ink-soft)]">
              age {data.student.age} · reading level {cur.truth.level} · loves {cur.truth.interest}
            </div>
          </div>
          <Avatar name={data.student.name} />
        </div>
      </header>

      <Hud sessions={data.sessions} idx={idx} />

      <div className="relative">
        <MilestoneBanner session={session} />
        <TrailMap
          sessions={data.sessions}
          idx={idx}
          onPick={(v) => {
            setPlaying(false);
            setSession(v);
          }}
        />
      </div>

      <div className="paper-card rounded-2xl px-5 py-2">
        <Scrubber
          value={session}
          max={n}
          milestones={data.milestones.filter((m) => m.session <= n)}
          playing={playing}
          onChange={(v) => {
            setPlaying(false);
            setSession(v);
          }}
          onTogglePlay={() => {
            if (session >= n) setSession(1);
            setPlaying((p) => !p);
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_340px]">
        <Shelf tutor="transcript" book={cur.books.transcript} score={cur.scores.transcript} onOpen={() => setOpen("transcript")} />
        <Shelf tutor="chapters" book={cur.books.chapters} score={cur.scores.chapters} onOpen={() => setOpen("chapters")} />
        <div className="flex min-h-0 flex-col gap-4 lg:row-span-2 lg:max-h-[calc(100vh-170px)]">
          <Mind sessions={data.sessions} idx={idx} />
          <Gauges transcript={cur.tokens.transcript} chapters={cur.tokens.chapters} max={maxTokens} />
        </div>
        <div className="lg:col-span-2">
          <Charts sessions={data.sessions} current={session} />
        </div>
      </div>

      {askSlot}

      <footer className="pb-2 text-center text-[10px] text-[var(--ink-soft)]">
        Replaying run <span className="font-mono">{data.run}</span> from {data.source === "rawtree" ? "RawTree" : data.source === "local" ? "local checkpoint" : "mock data"} ·
        ← → to step · space to play
      </footer>

      <BookModal book={open ? cur.books[open] : null} score={open ? cur.scores[open] : undefined} onClose={() => setOpen(null)} />
    </main>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="font-display grid size-12 place-items-center rounded-full text-xl text-white shadow-md ring-4 ring-[var(--paper)]"
      style={{ background: "radial-gradient(circle at 35% 30%, #f1c27d, #d9973f 55%, #b8603f)" }}
    >
      {name[0]}
    </div>
  );
}
