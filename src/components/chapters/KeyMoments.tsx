"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { SessionView } from "@/lib/types";

// The honest comparison: aggregate stats computed from the real run (not cherry-picked), plus
// per-session drill-downs for the clearest divergences. This is the answer to "where do I point
// in the demo" — every number here comes straight from the data.

interface Moment {
  session: number;
  winner: "chapters" | "transcript";
  fox: SessionView["scores"]["chapters"];
  owl: SessionView["scores"]["transcript"];
}

function computeMoments(sessions: SessionView[]): Moment[] {
  const out: Moment[] = [];
  for (const s of sessions) {
    const diff = s.scores.chapters.accuracy - s.scores.transcript.accuracy;
    if (Math.abs(diff) < 0.6) continue; // only the clearest gaps: at least a full criterion apart
    out.push({ session: s.session, winner: diff > 0 ? "chapters" : "transcript", fox: s.scores.chapters, owl: s.scores.transcript });
  }
  return out;
}

interface Totals {
  wrongSessions: number;
  wrongTopic: number;
  wrongSkill: number;
  wrongLevel: number;
  streakTopic: number;
  streakSkill: number;
}

function streak(sessions: SessionView[], tutor: "transcript" | "chapters", key: "level_fit" | "topic_fit" | "skill_fit"): number {
  let cur = 0;
  let max = 0;
  for (const s of sessions) {
    if (!s.scores[tutor][key]) {
      cur++;
      max = Math.max(max, cur);
    } else cur = 0;
  }
  return max;
}

function computeTotals(sessions: SessionView[], tutor: "transcript" | "chapters"): Totals {
  let wrongSessions = 0;
  let wrongTopic = 0;
  let wrongSkill = 0;
  let wrongLevel = 0;
  for (const s of sessions) {
    const sc = s.scores[tutor];
    if (sc.accuracy < 1) wrongSessions++;
    if (!sc.topic_fit) wrongTopic++;
    if (!sc.skill_fit) wrongSkill++;
    if (!sc.level_fit) wrongLevel++;
  }
  return { wrongSessions, wrongTopic, wrongSkill, wrongLevel, streakTopic: streak(sessions, tutor, "topic_fit"), streakSkill: streak(sessions, tutor, "skill_fit") };
}

function Bar({ label, owl, fox, unit = "" }: { label: string; owl: number; fox: number; unit?: string }) {
  const max = Math.max(owl, fox, 1);
  const foxBetter = fox < owl;
  const foxTie = fox === owl;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-[var(--ink-soft)]">
        <span>{label}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[11px]">🦉 Owl</span>
          <div className="h-3 flex-1 rounded-full bg-[var(--paper-deep)]">
            <div className="h-full rounded-full bg-[var(--clay)]" style={{ width: `${(owl / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] tabular-nums">
            {owl}
            {unit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[11px]">🦊 Fox</span>
          <div className="h-3 flex-1 rounded-full bg-[var(--paper-deep)]">
            <div className="h-full rounded-full" style={{ width: `${(fox / max) * 100}%`, background: foxBetter ? "var(--sage)" : "var(--gold)" }} />
          </div>
          <span className={`w-8 shrink-0 text-right text-[11px] font-medium tabular-nums ${foxBetter ? "text-[var(--sage)]" : ""}`}>
            {fox}
            {unit}
          </span>
        </div>
      </div>
      {!foxTie && <div className="mt-0.5 text-[10px] text-[var(--ink-soft)]">{foxBetter ? "🦊 fewer" : "🦉 fewer"} — lower is better</div>}
    </div>
  );
}

function Criteria({ score, tone }: { score: Moment["fox"]; tone: "sage" | "clay" }) {
  const items: [string, number][] = [
    ["level", score.level_fit],
    ["topic", score.topic_fit],
    ["skill", score.skill_fit],
  ];
  return (
    <div className="mt-2 flex gap-2">
      {items.map(([k, v]) => (
        <span
          key={k}
          className="rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
          style={v ? { background: "var(--sage-soft)", color: "var(--sage)" } : { background: "var(--clay-soft)", color: "var(--ribbon)" }}
        >
          {v ? "✓" : "✕"} {k}
        </span>
      ))}
    </div>
  );
}

export function KeyMoments({ sessions, onPick }: { sessions: SessionView[]; onPick: (session: number) => void }) {
  const moments = useMemo(() => computeMoments(sessions), [sessions]);
  const owlTotals = useMemo(() => computeTotals(sessions, "transcript"), [sessions]);
  const foxTotals = useMemo(() => computeTotals(sessions, "chapters"), [sessions]);
  const [open, setOpen] = useState<Moment | null>(null);
  const n = sessions.length;

  return (
    <section className="paper-card rounded-2xl px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-[var(--gold)]" />
        <h3 className="font-display text-base font-medium">The honest scorecard</h3>
        <span className="text-[11px] text-[var(--ink-soft)]">— every number below is computed live from this run, over {n} sessions</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Bar label="Sessions with any mistake" owl={owlTotals.wrongSessions} fox={foxTotals.wrongSessions} />
        <Bar label="Sessions with the wrong skill" owl={owlTotals.wrongSkill} fox={foxTotals.wrongSkill} />
        <Bar label="Longest streak drilling the wrong skill" owl={owlTotals.streakSkill} fox={foxTotals.streakSkill} unit=" sess" />
        <Bar label="Longest streak on the wrong topic" owl={owlTotals.streakTopic} fox={foxTotals.streakTopic} unit=" sess" />
      </div>

      {moments.length > 0 && (
        <>
          <div className="mt-4 mb-2 text-[11px] text-[var(--ink-soft)]">Clearest single-session divergences (tap to jump):</div>
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
                }}
              >
                <span className="font-display font-medium">Session {m.session}</span>
                <span>
                  {m.winner === "chapters" ? "🦊 Fox" : "🦉 Owl"} right, {m.winner === "chapters" ? "🦉 Owl" : "🦊 Fox"} wrong
                </span>
                <span aria-hidden>→</span>
              </button>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden rounded-xl border border-[var(--line)]">
            <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="bg-[var(--sage-soft)] p-4">
                <div className="text-[10px] font-semibold tracking-wider text-[var(--sage)] uppercase">🦊 Chapters Fox · session {open.session}</div>
                <Criteria score={open.fox} tone="sage" />
                {open.fox.stale_reason && <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{open.fox.stale_reason}</p>}
              </div>
              <div className="bg-[var(--clay-soft)] p-4">
                <div className="text-[10px] font-semibold tracking-wider text-[var(--ribbon)] uppercase">🦉 Transcript Owl · session {open.session}</div>
                <Criteria score={open.owl} tone="clay" />
                {open.owl.stale_reason && <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{open.owl.stale_reason}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
