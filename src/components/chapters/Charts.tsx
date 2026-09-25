"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SessionView } from "@/lib/types";

const C = { transcript: "#b8603f", chapters: "#4f7a68" };
const axis = { fontSize: 10, fill: "#6f655b" };

function Panel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="paper-card flex min-w-0 flex-col rounded-2xl px-4 pt-3 pb-1">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display truncate text-base font-medium">{title}</h3>
        <span className="shrink-0 text-[10px] text-[var(--ink-soft)]">{note}</span>
      </div>
      <div className="h-36">{children}</div>
    </div>
  );
}

function Chart({ data, current, fmt, domain }: { data: Record<string, number>[]; current: number; fmt: (n: number) => string; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#e4d8c1" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="session" tick={axis} tickLine={false} axisLine={{ stroke: "#e4d8c1" }} ticks={[1, 8, 15, 20, 25, 30]} />
        <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={fmt} domain={domain} width={48} />
        <Tooltip
          contentStyle={{ background: "#fffdf7", border: "1px solid #e4d8c1", borderRadius: 10, fontSize: 12 }}
          formatter={(v, n) => [fmt(Number(v)), n === "transcript" ? "Transcript" : "Chapters"]}
          labelFormatter={(l) => `Session ${l}`}
        />
        <ReferenceLine x={current} stroke="#2b2622" strokeWidth={1.5} strokeDasharray="3 3" />
        <Line type="monotone" dataKey="transcript" stroke={C.transcript} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="chapters" stroke={C.chapters} strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Charts({ sessions, current }: { sessions: SessionView[]; current: number }) {
  let ct = 0;
  let cc = 0;
  const rows = sessions.map((s, i) => {
    ct += s.cost.transcript;
    cc += s.cost.chapters;
    const win = sessions.slice(Math.max(0, i - 2), i + 1);
    const avg = (k: "transcript" | "chapters") => win.reduce((a, w) => a + w.scores[k].accuracy, 0) / win.length;
    return {
      session: s.session,
      tokT: s.tokens.transcript,
      tokC: s.tokens.chapters,
      costT: ct,
      costC: cc,
      accT: avg("transcript") * 100,
      accC: avg("chapters") * 100,
    };
  });
  const pick = (a: string, b: string) => rows.map((r) => ({ session: r.session, transcript: (r as never)[a], chapters: (r as never)[b] }));
  const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Prompt tokens" note="per session">
        <Chart data={pick("tokT", "tokC")} current={current} fmt={k} />
      </Panel>
      <Panel title="Cumulative cost" note="USD">
        <Chart data={pick("costT", "costC")} current={current} fmt={(n) => `$${n.toFixed(2)}`} />
      </Panel>
      <Panel title="Accuracy vs. real Maya" note="3-session avg">
        <Chart data={pick("accT", "accC")} current={current} fmt={(n) => `${Math.round(n)}%`} domain={[0, 100]} />
      </Panel>
    </div>
  );
}
