import type Anthropic from "@anthropic-ai/sdk";
import { curate } from "../src/lib/curator";
import { llm, parseJson } from "../src/lib/llm";
import { assertReadOnly, query } from "../src/lib/rawtree";
import type { Book, CallLog, FactKind, HotFact, JanitorRun, LearnerModel, ReadingEvents, StateChange } from "../src/lib/types";
import { STUDENT, rawObservation } from "./student";
import { WRITER_SYSTEM, factLine, logCall, toBook, type WebFact } from "./tutors";

// The Chapters tutor ("the Fox"): three tiers of memory.
//   1. Hot state   - a small mutable fact list, the ONLY memory in its prompt. Every fact carries
//                    source, timestamps, confidence and a time-to-live. Edited through tools.
//   2. Cold log    - RawTree. Raw events, tool calls, Nimble fetches and retired facts. recall(sql).
//   3. Janitor     - Liquid AI LFM2 running locally every 2 sessions: scores each hot fact for
//                    staleness/relevance, flags contradictions, moves low-value facts to cold storage.

export const JANITOR_EVERY = 2;
const DECAY = 0.85;

// ---------------------------------------------------------------- hot state

const fid = (kind: FactKind, key: string) => (kind === "level" ? "level" : `${kind}:${key.toLowerCase().trim()}`);

function fact(kind: FactKind, key: string, value: number | string, source: string, confidence: number, ttl: number): HotFact {
  return { id: fid(kind, key), kind, key: kind === "level" ? "level" : key.toLowerCase().trim(), value, source, since: 0, last_confirmed: 0, confidence, ttl };
}

export function newLearnerModel(): LearnerModel {
  return {
    facts: [
      fact("level", "level", 2, "intake profile", 0.7, 8),
      fact("skill", "vowel_teams", 0.2, "intake profile", 0.7, 6),
      fact("misconception", "reads ea/ai/oa as two separate sounds", "active", "intake profile", 0.6, 6),
      fact("interest", "dinosaurs", 0.9, "intake profile", 0.7, 6),
    ],
    plan: "Dinosaur stories at level 2 that practice vowel teams (ea, ai, oa).",
    recent_books: [],
  };
}

export function level(m: LearnerModel): number {
  return Number(m.facts.find((f) => f.kind === "level")?.value ?? 2);
}

export function topInterest(m: LearnerModel): string {
  const interests = m.facts.filter((f) => f.kind === "interest");
  return interests.sort((a, b) => Number(b.value) * b.confidence - Number(a.value) * a.confidence)[0]?.key ?? "animals";
}

/** Compact, prompt-friendly rendering of the hot state. */
export function render(m: LearnerModel, session: number): string {
  const lines = m.facts.map((f) => {
    const left = f.ttl - (session - f.last_confirmed);
    const v = typeof f.value === "number" ? (f.kind === "level" ? String(f.value) : f.value.toFixed(2)) : f.value;
    return `- ${f.id} = ${v} | conf ${f.confidence.toFixed(2)} | from ${f.source} | confirmed s${f.last_confirmed} | ${left > 0 ? `${left} sessions left` : "EXPIRED"}${f.pinned ? " | PINNED" : ""}${f.flag ? ` | ⚠ janitor: ${f.flag}` : ""}`;
  });
  return `Plan: ${m.plan || "(none)"}\nRecent books: ${(m.recent_books ?? []).join(" · ") || "(none)"}\nFacts:\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------- writing

export async function chaptersWrite(model: LearnerModel, session: number, web: WebFact | null) {
  const prompt = `Session ${session}. Your hot state: the only memory you have of ${STUDENT.name}. Trust high-confidence, recently confirmed facts.\n${render(model, session)}${factLine(web)}\nWrite the next book.`;
  const r = await llm({ system: WRITER_SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 4000 });
  return { book: toBook("chapters", session, parseJson(r.text), web), call: logCall("chapters", session, "write_book", r), promptTokens: r.inputTokens };
}

// ---------------------------------------------------------------- editing (tools)

const KINDS: FactKind[] = ["level", "skill", "interest", "misconception", "what_works"];

const TOOLS: Anthropic.Tool[] = [
  {
    name: "set_fact",
    description:
      "Add, update or re-confirm a fact in hot state. Re-confirming (even with the same value) resets its clock. kind=level: key 'level', value 2 or 3. kind=skill: key vowel_teams|silent_e|digraphs|blends, value = mastery 0-1. kind=interest: key = topic, value = strength 0-1. kind=misconception: key = short description, value 'active'. kind=what_works: key = short insight, value 'yes'.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: KINDS },
        key: { type: "string" },
        value: { type: "string", description: "number as text for level/skill/interest" },
        confidence: { type: "number", description: "0-1, how sure the evidence makes you" },
        ttl: { type: "integer", description: "sessions this stays valid without re-confirmation (2-8)" },
        source: { type: "string", description: "evidence, e.g. 's9 log: missed ship, chip, whale'" },
      },
      required: ["kind", "key", "value", "confidence", "ttl", "source"],
    },
  },
  {
    name: "retire_fact",
    description: "Move a fact out of hot state into the cold archive (RawTree) because it is no longer true or useful.",
    input_schema: { type: "object", properties: { id: { type: "string" }, reason: { type: "string" } }, required: ["id", "reason"] },
  },
  {
    name: "pin",
    description: "Pin (or unpin) a fact so the janitor never archives it.",
    input_schema: { type: "object", properties: { id: { type: "string" }, pinned: { type: "boolean" }, reason: { type: "string" } }, required: ["id", "pinned", "reason"] },
  },
  {
    name: "update_plan",
    description: "One sentence: what the next books should do (level, topic, target skill).",
    input_schema: { type: "object", properties: { plan: { type: "string" } }, required: ["plan"] },
  },
  {
    name: "recall",
    description:
      "Read-only ClickHouse SQL on the cold archive. Tables: events(run_id, session, tutor, words_attempted, words_missed JSON array string, enjoyment, comment), books(run_id, session, tutor, title, level, topic, target_skill), state_changes(run_id, session, tutor, action, kind, key, value, reason, by). Always filter tutor = 'chapters' AND run_id = the given run id. Select only needed columns; LIMIT 20.",
    input_schema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
  },
];

const UPDATER_SYSTEM = `You manage the hot state of a reading tutor for one child. The hot state is your ONLY memory in future sessions, so after each reading, edit it with the tools until it describes the child exactly as they are NOW.

Evidence: the reading log lists every word as [word, milliseconds, correct 1/0]. Work out which phonics patterns the missed and slow words share: vowel_teams (ea, ai, oa), silent_e (cake, bone, kite), digraphs (sh, ch, th, wh: ship, chip, whale, teeth), blends (st, tr, bl...). Common sight words (the, said, was) are not phonics evidence.

Rules:
- Facts lose confidence every session they are not re-confirmed and expire after their ttl. Re-confirm with set_fact whatever this session's evidence still supports; let the rest fade.
- Facts marked ⚠ were flagged by the janitor as possibly contradicted. Resolve every flag: update it, retire it, or re-confirm it.
- Skills: keep a skill fact for each pattern that shows up in the misses (mastery 0 = can't read these words, 1 = fluent). A skill that is fluent now -> raise it and retire its misconceptions. A mastered skill whose words are missed again -> lower it and use recall to see when it was last a problem.
- Level: change it ONLY when the miss rate itself (misses / words_attempted this session) is decisive — under 5% with an "easy" remark to go up, over 15% with a "hard" remark to go down — AND the previous session's evidence pointed the same way (use recall to check it). Do not raise the level just because most misses fall in a skill you're already drilling; a high overall miss rate means the level is wrong even if the misses cluster in one pattern. One clean session is not enough on its own. Revert a level change that clearly backfired.
- Interests: a remark about a new topic -> set it to 0.9 and lower the others. Do NOT lower an interest just because one book on it landed poorly if that book was a repeat of an earlier title (repeats crush enjoyment regardless of topic) — check "Recent books" first. Only lower an interest after a FRESH (non-repeated) book on it also gets low enjoyment, or after an explicit remark about a different topic.
- Pin only what must never be forgotten. Keep hot state small (at most ~10 facts).
- Always finish with update_plan, then reply with one short sentence.`;

export interface ToolCallLog {
  session: number;
  tool: string;
  input: string;
  result: string;
}

function applyTool(m: LearnerModel, session: number, name: string, input: Record<string, unknown>, changes: StateChange[]): string {
  const change = (c: Omit<StateChange, "session" | "by">) => changes.push({ session, by: "tutor", ...c });
  switch (name) {
    case "set_fact": {
      const kind = input.kind as FactKind;
      if (!KINDS.includes(kind)) return `unknown kind ${kind}`;
      const key = kind === "level" ? "level" : String(input.key).toLowerCase().trim();
      const raw = String(input.value);
      const value = kind === "level" || kind === "skill" || kind === "interest" ? Number(raw) : raw;
      if (typeof value === "number" && Number.isNaN(value)) return `value must be a number for ${kind}`;
      const conf = Math.max(0, Math.min(1, Number(input.confidence)));
      const ttl = Math.max(1, Math.min(10, Math.round(Number(input.ttl) || 4)));
      const source = String(input.source ?? "").slice(0, 120);
      const id = fid(kind, key);
      const prev = m.facts.find((f) => f.id === id);
      if (prev) {
        const changed = prev.value !== value;
        Object.assign(prev, { value, confidence: conf, ttl, source, last_confirmed: session, flag: undefined });
        change({ action: "updated", kind, key, value: String(value), reason: changed ? source : `re-confirmed: ${source}` });
      } else {
        m.facts.push({ id, kind, key, value, source, since: session, last_confirmed: session, confidence: conf, ttl });
        change({ action: "added", kind, key, value: String(value), reason: source });
      }
      return `ok ${id}`;
    }
    case "retire_fact": {
      const f = m.facts.find((x) => x.id === String(input.id));
      if (!f) return `no fact ${input.id}`;
      if (f.kind === "level") return "the level fact can be changed but not retired";
      m.facts = m.facts.filter((x) => x !== f);
      change({ action: "archived", kind: f.kind, key: f.key, value: JSON.stringify(f), reason: String(input.reason ?? "") });
      return "ok, moved to archive";
    }
    case "pin": {
      const f = m.facts.find((x) => x.id === String(input.id));
      if (!f) return `no fact ${input.id}`;
      f.pinned = Boolean(input.pinned);
      change({ action: "pinned", kind: f.kind, key: f.key, value: String(f.pinned), reason: String(input.reason ?? "") });
      return "ok";
    }
    case "update_plan": {
      m.plan = String(input.plan).slice(0, 240);
      change({ action: "planned", kind: "plan", key: "plan", value: m.plan, reason: "tutor plan" });
      return "ok";
    }
    default:
      return `unknown tool ${name}`;
  }
}

export async function chaptersUpdate(model: LearnerModel, book: Book, ev: ReadingEvents, runId: string) {
  const calls: CallLog[] = [];
  const changes: StateChange[] = [];
  const toolCalls: ToolCallLog[] = [];
  const recalls: string[] = [];
  const s = book.session;
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Run id: ${runId}. Session ${s} just finished.\n\nHot state before this session:\n${render(model, s)}\n\nBook given: ${JSON.stringify({ title: book.title, level: book.level, topic: book.topic, target_skill: book.target_skill })}\nReading results (raw): ${JSON.stringify(rawObservation(ev))}`,
    },
  ];

  for (let turn = 0; turn < 8; turn++) {
    const r = await llm({ system: UPDATER_SYSTEM, messages, tools: TOOLS, maxTokens: 4000 });
    calls.push(logCall("chapters", s, "update_state", r));
    messages.push({ role: "assistant", content: r.message.content });
    const uses = r.message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (r.message.stop_reason !== "tool_use" || uses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const input = u.input as Record<string, unknown>;
      let out: string;
      let isError = false;
      try {
        if (u.name === "recall") {
          const sql = assertReadOnly(String(input.sql));
          // A tutor only knows what it observed: no ground truth, no scores.
          if (/\b(sessions|scores|llm_calls|janitor_runs)\b/i.test(sql)) throw new Error("recall can only read events, books and state_changes");
          recalls.push(sql);
          out = JSON.stringify((await query(sql)).slice(0, 20));
        } else {
          out = applyTool(model, s, u.name, input, changes);
        }
      } catch (e) {
        out = (e as Error).message;
        isError = true;
      }
      toolCalls.push({ session: s, tool: u.name, input: JSON.stringify(input), result: out.slice(0, 500) });
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.slice(0, 4000), is_error: isError || undefined });
    }
    messages.push({ role: "user", content: results });
  }

  // Unconfirmed facts fade.
  for (const f of model.facts) if (!f.pinned && f.last_confirmed < s) f.confidence = Math.round(f.confidence * DECAY * 100) / 100;
  return { calls, changes, recalls, toolCalls };
}

// ---------------------------------------------------------------- janitor (Liquid AI LFM2, local)

const JANITOR_SYSTEM = `You are the janitor for a tutor's memory about one child. For EVERY fact, score:
- staleness: 0 = fresh and still true, 1 = clearly outdated (not confirmed for many sessions, past its time-to-live, or contradicted by recent evidence)
- relevance: 0 = useless for choosing the next book, 1 = essential
- contradiction: a few words if the recent evidence contradicts the fact, otherwise ""
Reply with JSON only: {"scores": [{"id": "...", "staleness": 0.0, "relevance": 0.0, "contradiction": ""}]}`;

type Score = { id: string; staleness: number; relevance: number; contradiction: string };

function ruleScore(f: HotFact, session: number): Score {
  const expired = session - f.last_confirmed > f.ttl;
  return { id: f.id, staleness: expired ? 0.9 : Math.round((1 - f.confidence) * 100) / 100, relevance: 0.5, contradiction: "" };
}

export async function janitor(model: LearnerModel, session: number, recent: ReadingEvents[]) {
  const factsText = model.facts
    .map((f) => `${f.id} = ${f.value} | confidence ${f.confidence.toFixed(2)} | last confirmed ${session - f.last_confirmed} sessions ago | ttl ${f.ttl}${f.pinned ? " | pinned" : ""}`)
    .join("\n");
  const evidence = recent
    .map((e) => `s${e.session}: missed [${e.words_missed.slice(0, 18).join(", ")}] of ${e.words_attempted} words; enjoyment ${e.enjoyment}/5; remark "${e.comment}"`)
    .join("\n");
  const r = await curate(JANITOR_SYSTEM, `Now: session ${session}.\nFacts:\n${factsText}\n\nRecent evidence:\n${evidence}`);

  let fallback = false;
  let picked: Score[] = [];
  try {
    picked = (parseJson<{ scores?: Score[] }>(r.text).scores ?? []).filter((x) => x && typeof x.id === "string");
  } catch {
    fallback = true;
  }
  if (picked.length === 0) fallback = true;

  const top = topInterest(model);
  const changes: StateChange[] = [];
  const scores: JanitorRun["scores"] = [];
  for (const f of [...model.facts]) {
    const got = picked.find((p) => p.id === f.id);
    const sc: Score = got
      ? {
          id: f.id,
          staleness: Math.max(0, Math.min(1, Number(got.staleness) || 0)),
          relevance: Math.max(0, Math.min(1, Number(got.relevance) || 0)),
          contradiction: String(got.contradiction ?? "").slice(0, 120),
        }
      : ruleScore(f, session);
    const expired = session - f.last_confirmed > f.ttl;
    const protectedFact = f.pinned || f.kind === "level" || (f.kind === "interest" && f.key === top);
    let decision: "keep" | "archive" | "flag" = "keep";
    if (!protectedFact && ((sc.staleness >= 0.7 && sc.relevance <= 0.5) || (expired && sc.staleness >= 0.5) || f.confidence < 0.2)) decision = "archive";
    else if (sc.contradiction.length > 4) decision = "flag";

    if (decision === "archive") {
      model.facts = model.facts.filter((x) => x !== f);
      changes.push({
        session,
        action: "archived",
        kind: f.kind,
        key: f.key,
        value: JSON.stringify(f),
        reason: `stale ${sc.staleness.toFixed(1)}, relevance ${sc.relevance.toFixed(1)}${expired ? ", past ttl" : ""}${sc.contradiction ? `: ${sc.contradiction}` : ""}`,
        by: "janitor",
      });
    } else if (decision === "flag") {
      f.flag = sc.contradiction;
      changes.push({ session, action: "flagged", kind: f.kind, key: f.key, value: String(f.value), reason: sc.contradiction, by: "janitor" });
    }
    scores.push({ ...sc, decision });
  }

  const run: JanitorRun = { session, model: r.model, latency_ms: r.latencyMs, fallback, scores };
  const call: CallLog = { tutor: "chapters", session, purpose: "janitor", model: r.model, prompt_tokens: r.inputTokens, completion_tokens: r.outputTokens, cost_usd: 0, latency_ms: r.latencyMs };
  return { changes, run, call };
}
