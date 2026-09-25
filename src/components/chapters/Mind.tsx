"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { LearnerModel, SessionView, StateChange } from "@/lib/types";

// "The tutor's mind": Chapters' hot learner model as cards; archived facts drop into the RawTree drawer.

interface Card {
  id: string;
  kind: string;
  title: string;
  detail: string;
  meter?: number;
  confidence?: number;
  left?: number;
  pinned?: boolean;
  flag?: string;
  tone?: "sage" | "clay" | "gold" | "sky";
}

const KIND_LABEL: Record<string, string> = { level: "Reading level", skill: "Skill", interest: "Interest", misconception: "Confusion", what_works: "What works" };
const KIND_TONE: Record<string, Card["tone"]> = { level: "sky", skill: "sage", interest: "gold", misconception: "clay", what_works: "sage" };
const ORDER = ["level", "interest", "skill", "misconception", "what_works"];

function cards(m: LearnerModel, session: number): Card[] {
  const out: Card[] = [];
  if (m.plan) out.push({ id: "plan", kind: "Plan", title: m.plan, detail: "", tone: "gold" });
  const facts = [...(m.facts ?? [])].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || Number(b.value) - Number(a.value));
  for (const f of facts) {
    const numeric = typeof f.value === "number" && f.kind !== "level";
    out.push({
      id: f.id,
      kind: KIND_LABEL[f.kind] ?? f.kind,
      title: f.kind === "level" ? `Level ${f.value}` : f.key.replace("_", " "),
      detail: `from ${f.source}`,
      meter: numeric ? Number(f.value) : undefined,
      confidence: f.confidence,
      left: f.ttl - (session - f.last_confirmed),
      pinned: f.pinned,
      flag: f.flag,
      tone: KIND_TONE[f.kind],
    });
  }
  if (m.recent_books?.length) out.push({ id: "recent", kind: "Recent books", title: m.recent_books.join(" · "), detail: "so stories never repeat", tone: "sky" });
  return out;
}

const TONE = { sage: "var(--sage)", clay: "var(--clay)", gold: "var(--gold)", sky: "var(--sky)" };

export function Mind({ sessions, idx }: { sessions: SessionView[]; idx: number }) {
  const cur = sessions[idx];
  const list = useMemo(() => cards(cur.model, cur.session), [cur]);
  const archived = useMemo(() => sessions.slice(0, idx + 1).flatMap((s) => s.changes.filter((c) => c.action === "archived")), [sessions, idx]);
  const edits = cur.changes.filter((c) => c.action !== "archived" && c.action !== "planned" && !c.reason.startsWith("re-confirmed"));
  const jan = cur.janitor;

  return (
    <section className="paper-card flex min-h-0 flex-col rounded-2xl p-5">
      <header className="mb-3">
        <h2 className="font-display text-xl font-medium">The tutor&apos;s mind</h2>
        <p className="text-xs text-[var(--ink-soft)]">Hot state: the only memory in the Fox&apos;s prompt. Facts fade unless evidence re-confirms them.</p>
      </header>

      <div className="relative min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false} mode="popLayout">
          {list.map((f) => (
            <motion.div
              key={f.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: 60, rotate: -4, scale: 0.9, transition: { duration: 0.6, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
              style={{ borderLeft: `3px solid ${TONE[f.tone ?? "sage"]}` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] tracking-wider text-[var(--ink-soft)] uppercase">
                  {f.pinned && "📌 "}
                  {f.kind}
                </span>
                {f.meter !== undefined && <span className="text-[10px] tabular-nums text-[var(--ink-soft)]">{Math.round(f.meter * 100)}%</span>}
              </div>
              <div className="text-sm leading-snug font-medium">{f.title}</div>
              {f.meter !== undefined && (
                <div className="mt-1.5 h-1 rounded-full bg-[var(--paper-deep)]">
                  <motion.div className="h-full rounded-full" style={{ background: TONE[f.tone ?? "sage"] }} initial={false} animate={{ width: `${f.meter * 100}%` }} />
                </div>
              )}
              {f.flag && <div className="mt-1 rounded bg-[var(--clay-soft)] px-1.5 py-0.5 text-[10px] text-[var(--ribbon)]">⚠ janitor: {f.flag}</div>}
              {f.confidence !== undefined && (
                <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--ink-soft)]">
                  <span className="truncate">{f.detail}</span>
                  <span className="ml-auto shrink-0 tabular-nums" title="confidence">
                    conf {Math.round(f.confidence * 100)}%
                  </span>
                  <span className={`shrink-0 tabular-nums ${f.left !== undefined && f.left <= 1 ? "text-[var(--ribbon)]" : ""}`} title="sessions until this fact expires">
                    ⏳{Math.max(0, f.left ?? 0)}
                  </span>
                </div>
              )}
              {f.confidence === undefined && f.detail && <div className="mt-1 text-[10px] text-[var(--ink-soft)]">{f.detail}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <EditLog edits={edits} />
      {jan && (
        <motion.div key={jan.session} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-lg border border-dashed border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--ink-soft)]">
          🧹 <b className="text-[var(--ink)]">Janitor</b> (Liquid LFM2, local, {(jan.latency_ms / 1000).toFixed(1)}s) scored {jan.scores.length} facts ·{" "}
          {jan.scores.filter((x) => x.decision === "archive").length} archived · {jan.scores.filter((x) => x.decision === "flag").length} flagged
        </motion.div>
      )}
      <ArchiveDrawer archived={archived} fresh={cur.changes.filter((c) => c.action === "archived")} />
    </section>
  );
}

function EditLog({ edits }: { edits: StateChange[] }) {
  return (
    <div className="mt-3 min-h-[3.25rem] border-t border-dashed border-[var(--line)] pt-2">
      <div className="text-[10px] tracking-wider text-[var(--ink-soft)] uppercase">This session&apos;s edits</div>
      <AnimatePresence mode="wait">
        <motion.ul key={edits.map((e) => e.key).join("|")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1 space-y-0.5">
          {edits.length === 0 && <li className="text-xs text-[var(--ink-soft)] italic">No changes. The model still fits.</li>}
          {edits.slice(0, 3).map((e, i) => (
            <li key={i} className="truncate text-xs">
              <span className="font-mono text-[10px] text-[var(--sage)]">{e.action === "added" ? "+" : e.action === "resolved" ? "✓" : "✎"}</span>{" "}
              <span className="font-medium">{e.kind === "skill" || e.kind === "interest" ? `${e.key} → ${e.value}` : e.key}</span>{" "}
              <span className="text-[var(--ink-soft)]">— {e.reason}</span>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}

function ArchiveDrawer({ archived, fresh }: { archived: StateChange[]; fresh: StateChange[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl bg-[var(--paper-deep)] px-3 py-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <Archive className="size-4 text-[var(--ink-soft)]" />
        <span className="text-sm font-medium">Archive · RawTree</span>
        <motion.span
          key={archived.length}
          initial={{ scale: 1.6, color: "var(--clay)" }}
          animate={{ scale: 1, color: "var(--ink)" }}
          className="ml-auto rounded-full bg-[var(--paper)] px-2 text-xs tabular-nums"
        >
          {archived.length}
        </motion.span>
        <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {fresh.map((f) => (
          <motion.div
            key={`${f.session}-${f.key}`}
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 200, damping: 20 }}
            className="mt-1 truncate text-xs text-[var(--ink-soft)]"
          >
            ↓ <span className="line-through decoration-[var(--clay)]">{f.key}</span> · {f.reason}
          </motion.div>
        ))}
      </AnimatePresence>
      {open && (
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-[var(--line)] pt-2">
          {archived.map((a, i) => (
            <li key={i} className="text-[11px] text-[var(--ink-soft)]">
              <span className="tabular-nums">s{a.session}</span> · {a.kind} · <span className="text-[var(--ink)]">{a.key}</span> — {a.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
