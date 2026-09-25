"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { SessionView } from "@/lib/types";
import { truth } from "../../../scripts/student";

// The semester as a board-game trail. Maya hops stone to stone; the Owl (transcript tutor)
// hauls an ever-growing backpack of history, the Fox (Chapters) carries a small notebook and
// drops stale pages as leaves onto the RawTree.

const W = 1400;
const H = 380;
const N = 30;

function stonePos(i: number, n: number) {
  const t = n <= 1 ? 0 : i / (n - 1);
  const x = 90 + t * (W - 330);
  const y = 200 + Math.sin(t * Math.PI * 3.2 + 0.4) * 95;
  return { x, y };
}

// Landscape follows what Maya is into: jungle -> ocean -> space -> jungle again.
const ZONE: Record<string, { top: string; bottom: string; land: string; scenery: string[] }> = {
  dinosaurs: { top: "#eef3de", bottom: "#f6ecd2", land: "#a9c592", scenery: ["🌴", "🦕", "🌋", "🌿"] },
  ocean: { top: "#d6ecef", bottom: "#a9d3dc", land: "#7fb6c4", scenery: ["🐠", "🐙", "🐚", "🌊"] },
  space: { top: "#3f4f74", bottom: "#b7a6cf", land: "#8d86b4", scenery: ["🪐", "🛰️", "☄️", "🌙"] },
};

function zones(interests: string[]) {
  const out: { interest: string; from: number; to: number }[] = [];
  interests.forEach((it, i) => {
    const last = out[out.length - 1];
    if (last && last.interest === it) last.to = i;
    else out.push({ interest: it, from: i, to: i });
  });
  return out.map((z) => ({
    ...z,
    x0: z.from === 0 ? 0 : stonePos(z.from - 0.5, N).x,
    x1: z.to === N - 1 ? W : stonePos(z.to + 0.5, N).x,
  }));
}

function stars(acc: number) {
  return Math.round(acc * 3);
}

export function TrailMap({
  sessions,
  idx,
  milestones,
  onPick,
}: {
  sessions: SessionView[];
  idx: number;
  milestones: { session: number; label: string; emoji?: string }[];
  onPick: (session: number) => void;
}) {
  const zs = useMemo(() => zones(Array.from({ length: N }, (_, i) => truth(i + 1).interest)), []);
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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] shadow-[0_18px_40px_-24px_rgba(60,40,10,0.5)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full select-none">
        <defs>
          {Object.entries(ZONE).map(([k, z]) => (
            <linearGradient key={k} id={`sky-${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={z.top} />
              <stop offset="1" stopColor={z.bottom} />
            </linearGradient>
          ))}
          <filter id="blend" x="-10%" y="0" width="120%" height="100%">
            <feGaussianBlur stdDeviation="28 0" />
          </filter>
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

        {/* sky: one soft-edged band per interest */}
        <rect width={W} height={H} fill="#f6ecd2" />
        <g filter="url(#blend)">
          {zs.map((z) => (
            <rect key={z.from} x={z.x0 - 20} y={0} width={z.x1 - z.x0 + 40} height={H} fill={`url(#sky-${z.interest})`} />
          ))}
        </g>
        {zs
          .filter((z) => z.interest === "space")
          .map((z) =>
            Array.from({ length: 16 }, (_, i) => (
              <circle key={`${z.from}-${i}`} cx={z.x0 + 30 + ((i * 97) % Math.max(40, z.x1 - z.x0 - 60))} cy={18 + ((i * 53) % 130)} r={i % 3 === 0 ? 1.8 : 1.1} fill="#fff" opacity={0.85} />
            )),
          )}
        {zs
          .filter((z) => z.interest === "ocean")
          .map((z) =>
            [0, 1, 2].map((i) => (
              <path
                key={`${z.from}-w${i}`}
                d={`M ${z.x0 + 20 + i * 60} ${58 + i * 28} q 20 -10 40 0 t 40 0 t 40 0 t 40 0`}
                fill="none"
                stroke="#fff"
                strokeWidth={2}
                opacity={0.6}
              />
            )),
          )}
        {/* rolling land tinted by zone */}
        <g filter="url(#blend)" opacity={0.55}>
          {zs.map((z) => (
            <rect key={z.from} x={z.x0 - 20} y={H - 110} width={z.x1 - z.x0 + 40} height={110} fill={ZONE[z.interest].land} />
          ))}
        </g>
        <path d={`M0 ${H - 40} C 260 ${H - 90}, 520 ${H - 20}, 820 ${H - 70} S 1200 ${H - 30}, ${W} ${H - 60} L ${W} ${H} L 0 ${H} Z`} fill="#94b384" opacity={0.35} />

        {/* scenery per zone */}
        <g fontSize="32" opacity={0.9}>
          {zs.flatMap((z) => {
            const span = z.x1 - z.x0;
            const items = ZONE[z.interest].scenery.slice(0, span > 300 ? 4 : 2);
            return items.map((e, i) => (
              <text key={`${z.from}-${i}`} x={z.x0 + 30 + (i * span) / items.length} y={i % 2 ? H - 26 : 74}>
                {e}
              </text>
            ));
          })}
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
        {milestones.map((m, k) => {
          const p = stonePos(m.session - 1, N);
          const up = k % 2 === 0;
          const reached = idx + 1 >= m.session;
          return (
            <g key={m.session} transform={`translate(${p.x}, ${p.y + (up ? -62 : 64)})`} opacity={reached ? 1 : 0.5}>
              <text textAnchor="middle" fontSize="26" y={9}>
                {m.emoji ?? "⭐"}
              </text>
              <text textAnchor="middle" y={up ? -20 : 30} fontSize="11" fill="#2b2622" className="font-display" paintOrder="stroke" stroke="#fffdf7" strokeWidth={3}>
                {m.label}
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
