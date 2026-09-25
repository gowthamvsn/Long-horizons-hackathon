"use client";

import { motion } from "framer-motion";

// Context gauges: prompt tokens each tutor sends to write this session's book.

function Gauge({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const frac = Math.min(1, value / max);
  const r = 44;
  const arc = Math.PI * r;
  const hot = frac > 0.6;
  const stroke = color === "transcript" ? (hot ? "var(--ribbon)" : "var(--clay)") : "var(--sage)";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 110 64" className="w-full max-w-[150px]">
        <path d="M 11 56 A 44 44 0 0 1 99 56" fill="none" stroke="var(--paper-deep)" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d="M 11 56 A 44 44 0 0 1 99 56"
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={arc}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: arc * (1 - frac), stroke }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </svg>
      <motion.div className="font-display -mt-5 text-xl tabular-nums" animate={{ color: hot && color === "transcript" ? "var(--ribbon)" : "var(--ink)" }}>
        {value.toLocaleString()}
      </motion.div>
      <div className="text-[10px] tracking-wider text-[var(--ink-soft)] uppercase">{label}</div>
    </div>
  );
}

export function Gauges({ transcript, chapters, max }: { transcript: number; chapters: number; max: number }) {
  return (
    <section className="paper-card rounded-2xl p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-display text-base font-medium">Context in the prompt</h3>
        <span className="text-[10px] text-[var(--ink-soft)]">tokens</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Gauge label="Transcript" value={transcript} max={max} color="transcript" />
        <Gauge label="Chapters" value={chapters} max={max} color="chapters" />
      </div>
    </section>
  );
}
