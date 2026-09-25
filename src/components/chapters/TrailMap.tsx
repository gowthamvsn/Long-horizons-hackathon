"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { SessionView } from "@/lib/types";

// The semester as a board-game trail. Maya hops stone to stone; the Owl (transcript tutor)
// hauls an ever-growing backpack of history, the Fox (Chapters) carries a small notebook and
// drops stale pages as leaves onto the RawTree.

const W = 1400;
const H = 380;
const SPACE_FROM = 20;

function stonePos(i: number, n: number) {
  const t = n <= 1 ? 0 : i / (n - 1);
  const x = 90 + t * (W - 330);
  const y = 200 + Math.sin(t * Math.PI * 3.2 + 0.4) * 95;
  return { x, y };
}

const LANDMARKS: Record<number, { emoji: string; label: string; dy: number }> = {
  8: { emoji: "🌉", label: "Vowel Bridge", dy: -58 },
  15: { emoji: "🐸", label: "Silent-E Swamp", dy: 62 },
  20: { emoji: "🚀", label: "Launchpad", dy: -62 },
  25: { emoji: "🏰", label: "Level 3 Tower", dy: 62 },
};

function stars(acc: number) {
  return Math.round(acc * 3);
}

export function TrailMap({
  sessions,
  idx,
  onPick,
}: {
  sessions: SessionView[];
  idx: number;
  onPick: (session: number) => void;
}) {
  const n = sessions.length;
  const pts = useMemo(() => sessions.map((_, i) => stonePos(i, Math.max(n, 30))), [sessions, n]);
  const path = useMemo(() => {
    const all = Array.from({ length: 30 }, (_, i) => stonePos(i, 30));
    return all.reduce((d, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = all[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${d} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
    }, "");
  }, []);

  const cur = sessions[idx];
  const here = pts[idx];
  const maxTok = Math.max(...sessions.map((s) => s.tokens.transcript), 1);
  const packScale = 0.6 + (cur.tokens.transcript / maxTok) * 0.9;
  const packHot = cur.tokens.transcript / maxTok > 0.55;
  const archived = sessions.slice(0, idx + 1).flatMap((s) => s.changes.filter((c) => c.action === "archived"));
  const freshLeaves = cur.changes.filter((c) => c.action === "archived").length;
  const spaceX = stonePos(SPACE_FROM - 1.5, 30).x;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] shadow-[0_18px_40px_-24px_rgba(60,40,10,0.5)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
        <defs>
          <linearGradient id="sky" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#e9f0da" />
            <stop offset={`${(spaceX / W) * 0.85}`} stopColor="#f6ecd2" />
            <stop offset={`${spaceX / W}`} stopColor="#c9b7d6" />
            <stop offset="1" stopColor="#3f4f74" />
          </linearGradient>
          <filter id="paper" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n" />
            <feColorMatrix in="n" values="0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0.06 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <filter id="soft">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <radialGradient id="glow">
            <stop offset="0" stopColor="#fff6d8" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* sky + land */}
        <rect width={W} height={H} fill="url(#sky)" />
        {Array.from({ length: 26 }, (_, i) => (
          <circle key={i} cx={spaceX + 40 + ((i * 137) % (W - spaceX - 60))} cy={20 + ((i * 71) % 150)} r={i % 3 === 0 ? 1.8 : 1.1} fill="#fff" opacity={0.85} />
        ))}
        <circle cx={W - 120} cy={60} r={26} fill="#f7ecc9" opacity={0.95} />
        <circle cx={W - 110} cy={54} r={24} fill="#3f4f74" opacity={0.25} />
        <path d={`M0 ${H - 90} C 200 ${H - 150}, 380 ${H - 60}, 620 ${H - 110} S 1000 ${H - 60}, ${W} ${H - 120} L ${W} ${H} L 0 ${H} Z`} fill="#b9cf9f" opacity={0.55} filter="url(#soft)" />
        <path d={`M0 ${H - 40} C 260 ${H - 90}, 520 ${H - 20}, 820 ${H - 70} S 1200 ${H - 30}, ${W} ${H - 60} L ${W} ${H} L 0 ${H} Z`} fill="#94b384" opacity={0.5} />

        {/* scenery */}
        <g fontSize="34" opacity={0.9}>
          <text x={150} y={90}>🌴</text>
          <text x={330} y={H - 30}>🦕</text>
          <text x={520} y={80}>🌋</text>
          <text x={640} y={H - 25}>🌿</text>
          <text x={spaceX + 90} y={H - 30}>🛰️</text>
          <text x={spaceX + 250} y={80}>🪐</text>
        </g>

        {/* RawTree: archived facts become leaves */}
        <g transform={`translate(${W - 150}, ${H - 175})`}>
          <rect x={-9} y={40} width={18} height={95} rx={6} fill="#8a6a4a" />
          <circle cx={0} cy={20} r={62} fill="#6f9468" opacity={0.9} />
          <circle cx={-38} cy={42} r={36} fill="#7fa476" opacity={0.9} />
          <circle cx={40} cy={40} r={38} fill="#5f8a5d" opacity={0.9} />
          <AnimatePresence>
            {archived.map((a, i) => {
              const ang = i * 2.39996;
              const r = 12 + ((i * 17) % 48);
              return (
                <motion.ellipse
                  key={`${a.session}-${a.key}`}
                  cx={Math.cos(ang) * r}
                  cy={22 + Math.sin(ang) * r * 0.75}
                  rx={10}
                  ry={6}
                  transform={`rotate(${(i * 47) % 180})`}
                  fill={i % 2 ? "#e8b54a" : "#d9793f"}
                  initial={{ opacity: 0, x: -500, y: -60, scale: 0.4 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                />
              );
            })}
          </AnimatePresence>
          <text x={0} y={158} textAnchor="middle" className="font-display" fontSize="15" fill="#2b2622">
            RawTree
          </text>
          <text x={0} y={174} textAnchor="middle" fontSize="11" fill="#6f655b">
            {archived.length} archived {archived.length === 1 ? "fact" : "facts"}
          </text>
        </g>

        {/* trail */}
        <path d={path} fill="none" stroke="#e8dcc0" strokeWidth={26} strokeLinecap="round" opacity={0.9} />
        <path d={path} fill="none" stroke="#c9b690" strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round" />

        {/* landmarks */}
        {Object.entries(LANDMARKS).map(([s, l]) => {
          const p = stonePos(Number(s) - 1, 30);
          const reached = idx + 1 >= Number(s);
          return (
            <g key={s} transform={`translate(${p.x}, ${p.y + l.dy})`} opacity={reached ? 1 : 0.55}>
              <text textAnchor="middle" fontSize="30" y={10}>
                {l.emoji}
              </text>
              <text textAnchor="middle" y={l.dy < 0 ? -22 : 32} fontSize="11" fill="#2b2622" className="font-display">
                {l.label}
              </text>
            </g>
          );
        })}

        {/* stones */}
        {pts.map((p, i) => {
          const s = sessions[i];
          const done = i <= idx;
          const cStars = stars(s.scores.chapters.accuracy);
          const tStars = stars(s.scores.transcript.accuracy);
          return (
            <g key={i} transform={`translate(${p.x}, ${p.y})`} className="cursor-pointer" onClick={() => onPick(i + 1)}>
              <ellipse cx={0} cy={4} rx={17} ry={8} fill="#000" opacity={0.08} />
              <circle r={14} fill={done ? "#fffdf7" : "#f3ebd9"} stroke={done ? "#c9973a" : "#d8ccb3"} strokeWidth={2} />
              <text textAnchor="middle" y={4} fontSize="11" fill={done ? "#2b2622" : "#a39684"} className="tabular-nums">
                {i + 1}
              </text>
              {done && (
                <>
                  <text textAnchor="middle" y={-19} fontSize="9" fill="#4f7a68" letterSpacing="-1">
                    {"★".repeat(cStars)}
                    <tspan fill="#d8ccb3">{"★".repeat(3 - cStars)}</tspan>
                  </text>
                  <text textAnchor="middle" y={28} fontSize="9" fill="#b8603f" letterSpacing="-1">
                    {"★".repeat(tStars)}
                    <tspan fill="#d8ccb3">{"★".repeat(3 - tStars)}</tspan>
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* current stone glow */}
        <motion.circle r={34} fill="url(#glow)" initial={false} cx={here.x} cy={here.y} animate={{ cx: here.x, cy: here.y }} transition={{ type: "spring", stiffness: 160, damping: 20 }} />

        {/* the travelling party: Owl (behind), Maya, Fox (ahead) */}
        <motion.g animate={{ x: here.x, y: here.y }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
          {/* Owl + backpack */}
          <g transform="translate(-46, -62)">
            <motion.g animate={{ scale: packScale }} transition={{ type: "spring", stiffness: 120, damping: 14 }} style={{ originX: "50%", originY: "100%" }}>
              <rect x={-30} y={-26} width={26} height={30} rx={7} fill={packHot ? "#b3372b" : "#b8603f"} stroke="#fffdf7" strokeWidth={1.5} />
              <text x={-17} y={-6} textAnchor="middle" fontSize="12">
                📜
              </text>
            </motion.g>
            <text textAnchor="middle" fontSize="30" y={8}>
              🦉
            </text>
            <text textAnchor="middle" y={-30} fontSize="11" fill={packHot ? "#b3372b" : "#6f655b"} fontWeight={600} className="tabular-nums">
              {(cur.tokens.transcript / 1000).toFixed(1)}k
            </text>
          </g>

          {/* Maya hops */}
          <motion.g key={idx} initial={{ y: -26 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 12 }}>
            <circle cy={-34} r={17} fill="#e2a24f" stroke="#fffdf7" strokeWidth={3} />
            <text textAnchor="middle" y={-28} fontSize="16" fill="#fff" className="font-display">
              M
            </text>
          </motion.g>

          {/* Fox + notebook */}
          <g transform="translate(46, -62)">
            <text textAnchor="middle" fontSize="30" y={8}>
              🦊
            </text>
            <text x={22} y={-8} fontSize="14">
              📓
            </text>
            <text textAnchor="middle" y={-30} fontSize="11" fill="#4f7a68" fontWeight={600} className="tabular-nums">
              {(cur.tokens.chapters / 1000).toFixed(1)}k
            </text>
            {/* stale pages flutter off toward the RawTree */}
            <AnimatePresence>
              {Array.from({ length: freshLeaves }, (_, i) => (
                <motion.text
                  key={`${idx}-${i}`}
                  fontSize="14"
                  initial={{ x: 20, y: -10, opacity: 1, rotate: 0 }}
                  animate={{ x: 180 + i * 30, y: -90 - i * 20, opacity: 0, rotate: 200 }}
                  transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 + i * 0.15 }}
                >
                  🍂
                </motion.text>
              ))}
            </AnimatePresence>
          </g>
        </motion.g>
        <rect width={W} height={H} filter="url(#paper)" fill="#fff" opacity={0.6} pointerEvents="none" />
      </svg>
    </div>
  );
}
