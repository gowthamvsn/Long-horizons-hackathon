"use client";

import { Pause, Play } from "lucide-react";
import { motion } from "framer-motion";

export function Scrubber({
  value,
  max,
  milestones,
  playing,
  onChange,
  onTogglePlay,
}: {
  value: number;
  max: number;
  milestones: { session: number; label: string }[];
  playing: boolean;
  onChange: (v: number) => void;
  onTogglePlay: () => void;
}) {
  const pct = (s: number) => ((s - 1) / Math.max(1, max - 1)) * 100;
  return (
    <div className="flex items-center gap-5">
      <button
        onClick={onTogglePlay}
        aria-label={playing ? "Pause" : "Play semester"}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] shadow-md transition hover:scale-105"
      >
        {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
      </button>

      <div className="relative flex-1 pt-7 pb-10">
        {/* milestone labels */}
        {milestones.map((m, k) => (
          <button
            key={m.session}
            onClick={() => onChange(m.session)}
            className={`absolute -translate-x-1/2 text-[11px] whitespace-nowrap text-[var(--ink-soft)] transition hover:text-[var(--ink)] ${k % 2 ? "top-[2.6rem]" : "top-0"}`}
            style={{ left: `${pct(m.session)}%` }}
          >
            <span className={value >= m.session ? "font-medium text-[var(--ink)]" : ""}>{m.label}</span>
          </button>
        ))}

        {/* track */}
        <div className="relative h-2 rounded-full bg-[var(--paper-deep)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--sage)]"
            animate={{ width: `${pct(value)}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          />
          {milestones.map((m) => (
            <div
              key={m.session}
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-[var(--paper)] bg-[var(--clay)]"
              style={{ left: `${pct(m.session)}%` }}
            />
          ))}
          <motion.div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--paper)] bg-[var(--ink)] shadow"
            animate={{ left: `${pct(value)}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          />
        </div>
        <input
          type="range"
          min={1}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-x-0 top-5 h-6 w-full cursor-pointer opacity-0"
          aria-label="Session"
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-[var(--ink-soft)]">
          <span>Session 1</span>
          <span className="font-display text-sm text-[var(--ink)]">Session {value}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
