"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { SessionView } from "@/lib/types";

// Race scoreboard: stars earned (fit vs. the real Maya), backpack weight (prompt tokens), coins (cost).

function Counter({ value, fmt = (n: number) => String(n) }: { value: number; fmt?: (n: number) => string }) {
  return (
    <motion.span key={fmt(value)} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-block tabular-nums">
      {fmt(value)}
    </motion.span>
  );
}

function Team({ who, emoji, color, stars, max, tokens, coins, leading }: { who: string; emoji: string; color: string; stars: number; max: number; tokens: number; coins: number; leading: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#fffdf7]/90 px-4 py-2 shadow-sm ring-1 ring-[var(--line)] backdrop-blur">
      <span className="text-3xl leading-none">{emoji}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-medium" style={{ color }}>
            {who}
          </span>
          {leading && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-full bg-[var(--gold)] px-1.5 text-[9px] font-bold tracking-wider text-white uppercase">
              leading
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--ink-soft)]">
          <span title="Stars: right level, topic and skill for the real Maya">
            ⭐ <b className="text-[var(--ink)]"><Counter value={stars} /></b>/{max}
          </span>
          <span title="Prompt tokens carried this session">
            🎒 <b className="text-[var(--ink)]"><Counter value={tokens} fmt={(n) => `${(n / 1000).toFixed(1)}k`} /></b>
          </span>
          <span title="Total LLM spend so far">
            🪙 <b className="text-[var(--ink)]"><Counter value={coins} fmt={(n) => `$${n.toFixed(2)}`} /></b>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hud({ sessions, idx }: { sessions: SessionView[]; idx: number }) {
  const upto = sessions.slice(0, idx + 1);
  const sum = (f: (s: SessionView) => number) => upto.reduce((a, s) => a + f(s), 0);
  const tStars = sum((s) => Math.round(s.scores.transcript.accuracy * 3));
  const cStars = sum((s) => Math.round(s.scores.chapters.accuracy * 3));
  const cur = sessions[idx];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Team who="Transcript Owl" emoji="🦉" color="var(--clay)" stars={tStars} max={upto.length * 3} tokens={cur.tokens.transcript} coins={sum((s) => s.cost.transcript)} leading={tStars > cStars} />
      <div className="font-display text-2xl text-[var(--ink-soft)] italic">vs</div>
      <Team who="Chapters Fox" emoji="🦊" color="var(--sage)" stars={cStars} max={upto.length * 3} tokens={cur.tokens.chapters} coins={sum((s) => s.cost.chapters)} leading={cStars > tStars} />
    </div>
  );
}

export function MilestoneBanner({ session, milestones }: { session: number; milestones: { session: number; label: string; emoji?: string }[] }) {
  const m = milestones.find((x) => x.session === session);
  const text = m ? `${m.emoji ?? "⭐"}  ${m.label}` : "";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
      <AnimatePresence>
        {text && (
          <motion.div
            key={session}
            initial={{ y: -40, opacity: 0, scale: 0.8, rotate: -3 }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="font-display rounded-full bg-[var(--ink)] px-6 py-2 text-lg text-[var(--paper)] shadow-xl"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
