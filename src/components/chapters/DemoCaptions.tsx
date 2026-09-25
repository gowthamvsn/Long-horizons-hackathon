"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

// Silent-video caption bar. Press "C" once to turn it on, then "]" / "[" to step through the
// script below in your own time while recording — perfectly synced to your clicks, no editing
// needed after. Hidden by default; invisible if you never press "C".

export const SCRIPT = [
  "Meet Maya, 7. A reading tutor writes her a book every session for a whole semester.",
  "Two tutors compete on the same kid: 🦉 remembers everything. 🦊 remembers what matters now.",
  "Press ▶ and watch 30 sessions play out.",
  "🦉's backpack never stops growing. 🦊's notebook stays small — on purpose.",
  "Maya changes: masters skills, forgets them again, changes her mind about what she loves.",
  "Here — 🦊 spotted the change. 🦉 is still teaching yesterday's lesson.",
  "Hover: FLUX painted this cover live. Nimble found a real fact for the story.",
  "🦊's memory isn't a transcript — it's edited facts, each with a confidence score that fades.",
  "A small AI (Liquid, running locally) cleans up 🦊's memory — old facts fall into the archive.",
  "Nothing is thrown away. Ask the archive anything — it writes real SQL and answers live.",
  "🦊 kept up with Maya all semester. 🦉's memory only grew. That's the whole idea.",
];

export function DemoCaptions() {
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "c") setOn((o) => !o);
      if (!on) return;
      if (e.key === "]") setI((v) => Math.min(SCRIPT.length - 1, v + 1));
      if (e.key === "[") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);

  if (!on) return null;

  return (
    <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="font-display max-w-2xl rounded-xl bg-[var(--ink)]/95 px-5 py-3 text-center text-lg text-[var(--paper)] shadow-2xl"
        >
          {SCRIPT[i]}
          <div className="mt-1 text-[10px] font-sans text-white/50">
            {i + 1}/{SCRIPT.length} · [ / ] to step · C to hide
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
