import type Anthropic from "@anthropic-ai/sdk";
import { llm, parseJson, type LlmResult } from "../src/lib/llm";
import { curate } from "../src/lib/curator";
import { assertReadOnly, query } from "../src/lib/rawtree";
import type { Book, CallLog, LearnerModel, ReadingEvents, Skill, StateChange, TutorName } from "../src/lib/types";

export type { CallLog, StateChange };
import { STUDENT, rawObservation } from "./student";

// Both tutors share the book-writing step. They differ only in what goes in the prompt:
//   transcript -> the whole conversation so far
//   chapters   -> a small learner model it edits with tools; the rest lives in RawTree

function logCall(tutor: TutorName, session: number, purpose: string, r: LlmResult): CallLog {
  return {
    tutor,
    session,
    purpose,
    model: r.model,
    prompt_tokens: r.inputTokens,
    completion_tokens: r.outputTokens,
    cost_usd: r.costUsd,
    latency_ms: r.latencyMs,
  };
}

// ---------------------------------------------------------------- book writing

export const INITIAL_PROFILE = `${STUDENT.name} is ${STUDENT.age}. Reading level 2. Struggles with vowel teams (ea, ai, oa). Loves dinosaurs.`;

const WRITER_SYSTEM = `You are a warm, expert reading tutor who writes short picture books for one child.
Each book: a title, about 150 words of story at the child's reading level (level 2 = short sentences, mostly one/two-syllable words; level 3 = longer sentences, richer vocabulary), about the child's current interest, deliberately practicing the one phonics skill they most need (use many words with that pattern).
If a real current fact is provided, weave it into the story naturally in kid-friendly words.
Reply with JSON only:
{"title": string, "level": 2|3, "topic": string (1-3 words), "target_skill": "vowel_teams"|"silent_e"|"digraphs"|"blends"|"none", "text": string, "cover_scene": string (one sentence describing the cover illustration, no text in image)}`;

export interface Fact {
  title: string;
  url: string;
  snippet: string;
}

function factLine(fact: Fact | null): string {
  return fact ? `\nReal current fact you can use (from ${fact.url}): "${fact.title}. ${fact.snippet}"` : "";
}

function toBook(tutor: TutorName, session: number, raw: Omit<Book, "tutor" | "session" | "cover" | "fact_title" | "fact_url">, fact: Fact | null): Book {
  return {
    tutor,
    session,
    title: raw.title,
    level: Number(raw.level),
    topic: raw.topic,
    target_skill: raw.target_skill,
    text: raw.text,
    cover_scene: raw.cover_scene,
    cover: "",
    fact_title: fact?.title ?? "",
    fact_url: fact?.url ?? "",
  };
}

// ---------------------------------------------------------------- transcript tutor

export interface TranscriptState {
  messages: Anthropic.MessageParam[];
  lastTopic: string;
}

export function newTranscript(): TranscriptState {
  return { messages: [], lastTopic: "dinosaurs" };
}

const TRANSCRIPT_SYSTEM = `${WRITER_SYSTEM}\n\nAbout the child: ${INITIAL_PROFILE}\nThe conversation contains every previous session: the books you wrote and how the child read them.`;

export async function transcriptWrite(state: TranscriptState, session: number, fact: Fact | null) {
  const ask: Anthropic.MessageParam = {
    role: "user",
    content: `Session ${session}. Write the next book.${factLine(fact)}`,
  };
  const r = await llm({ system: TRANSCRIPT_SYSTEM, messages: [...state.messages, ask], maxTokens: 4000 });
  const book = toBook("transcript", session, parseJson(r.text), fact);
  state.messages.push(ask, { role: "assistant", content: r.text });
  state.lastTopic = book.topic;
  return { book, call: logCall("transcript", session, "write_book", r), promptTokens: r.inputTokens };
}

export function transcriptObserve(state: TranscriptState, ev: ReadingEvents) {
  // Raw reading log appended verbatim: this is what makes the transcript grow.
  state.messages.push({
    role: "user",
    content: `Reading results for session ${ev.session}: ${JSON.stringify(rawObservation(ev))}`,
  });
  state.messages.push({ role: "assistant", content: "Noted." });
}

// ---------------------------------------------------------------- chapters tutor

export function newLearnerModel(): LearnerModel {
  return {
    level: 2,
    skills: { vowel_teams: { mastery: 0.2, evidence: [], last_seen: 0 } },
    misconceptions: [{ what: "reads ea/ai/oa as two separate sounds", since: 0, status: "active" }],
    interests: [{ topic: "dinosaurs", strength: 0.9, last_signal: 0 }],
    what_works: [],
  };
}

export function topInterest(m: LearnerModel): string {
  return [...m.interests].sort((a, b) => b.strength - a.strength)[0]?.topic ?? "animals";
}

export async function chaptersWrite(model: LearnerModel, session: number, fact: Fact | null) {
  const prompt = `Session ${session}. Learner model (your only memory of ${STUDENT.name}):\n${JSON.stringify(model, null, 1)}${factLine(fact)}\nWrite the next book.`;
  const r = await llm({ system: WRITER_SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 4000 });
  return { book: toBook("chapters", session, parseJson(r.text), fact), call: logCall("chapters", session, "write_book", r), promptTokens: r.inputTokens };
}

const SKILLS = ["vowel_teams", "silent_e", "digraphs", "blends"];

const TOOLS: Anthropic.Tool[] = [
  {
    name: "update_mastery",
    description: "Set mastery (0-1) for a phonics skill based on this session's evidence.",
    input_schema: {
      type: "object",
      properties: { skill: { type: "string", enum: SKILLS }, mastery: { type: "number" }, reason: { type: "string" } },
      required: ["skill", "mastery", "reason"],
    },
  },
  {
    name: "add_misconception",
    description: "Record a new specific confusion the child shows.",
    input_schema: {
      type: "object",
      properties: { what: { type: "string" }, reason: { type: "string" } },
      required: ["what", "reason"],
    },
  },
  {
    name: "resolve_misconception",
    description: "Mark an existing misconception as resolved (use its exact 'what' text).",
    input_schema: {
      type: "object",
      properties: { what: { type: "string" }, reason: { type: "string" } },
      required: ["what", "reason"],
    },
  },
  {
    name: "shift_interest",
    description: "Add an interest or change its strength (0-1). Lower strength for fading interests.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string" }, strength: { type: "number" }, reason: { type: "string" } },
      required: ["topic", "strength", "reason"],
    },
  },
  {
    name: "set_level",
    description: "Change the child's reading level (2 or 3).",
    input_schema: {
      type: "object",
      properties: { level: { type: "integer" }, reason: { type: "string" } },
      required: ["level", "reason"],
    },
  },
  {
    name: "note_what_works",
    description: "Record a short teaching insight that worked (max ~10 words).",
    input_schema: {
      type: "object",
      properties: { insight: { type: "string" } },
      required: ["insight"],
    },
  },
  {
    name: "recall",
    description:
      "Run a read-only ClickHouse SQL query against the archive of past sessions. Tables: events(run_id, session, tutor, words_attempted, words_missed JSON string, missed_by_skill JSON string, enjoyment, comment), books(run_id, session, tutor, title, level, topic, target_skill), state_changes(run_id, session, action, kind, key, value, reason, by). Always filter tutor = 'chapters' and run_id = the given run id. Use LIMIT.",
    input_schema: {
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    },
  },
];

const UPDATER_SYSTEM = `You maintain a compact learner model for one child. After each reading session, update it with the tools so the next book fits the child exactly as they are NOW.
The reading log lists every word as [word, milliseconds, correct 1/0]. Work out which phonics patterns the missed and slow words share: vowel_teams (ea, ai, oa), silent_e (cake, bone, kite), digraphs (sh, ch, th, wh), blends (st, tr, bl...).
Children change and regress. Things to watch every session:
- a skill that looks solid now (few misses on its words) -> raise mastery, resolve related misconceptions
- a skill that was mastered but whose words are being missed again -> lower mastery; use recall to check its history in the archive
- level: many misses and "hard" remarks -> lower level; almost no misses and "easy" remarks -> raise level
- interests: remarks about a new topic -> add it strongly; low enjoyment on the current topic -> lower its strength
Update only what the evidence supports, and keep the model small. When done, reply with one short sentence summarizing what changed.`;

function applyTool(
  model: LearnerModel,
  session: number,
  name: string,
  input: Record<string, unknown>,
  changes: StateChange[],
): string {
  const reason = String(input.reason ?? "");
  switch (name) {
    case "update_mastery": {
      const skill = input.skill as Skill;
      const prev = model.skills[skill];
      const mastery = Math.max(0, Math.min(1, Number(input.mastery)));
      model.skills[skill] = { mastery, evidence: [...(prev?.evidence ?? []), session].slice(-5), last_seen: session };
      changes.push({ session, action: prev ? "updated" : "added", kind: "skill", key: skill, value: String(mastery), reason, by: "tutor" });
      return `ok, ${skill} mastery ${mastery}`;
    }
    case "add_misconception": {
      const what = String(input.what);
      model.misconceptions.push({ what, since: session, status: "active" });
      changes.push({ session, action: "added", kind: "misconception", key: what, value: "active", reason, by: "tutor" });
      return "ok";
    }
    case "resolve_misconception": {
      const what = String(input.what);
      const m = model.misconceptions.find((x) => x.what === what) ?? model.misconceptions.find((x) => x.status === "active" && x.what.includes(what.slice(0, 12)));
      if (!m) return `no misconception named "${what}"`;
      m.status = "resolved";
      changes.push({ session, action: "resolved", kind: "misconception", key: m.what, value: "resolved", reason, by: "tutor" });
      return "ok";
    }
    case "shift_interest": {
      const topic = String(input.topic).toLowerCase();
      const strength = Math.max(0, Math.min(1, Number(input.strength)));
      const prev = model.interests.find((i) => i.topic === topic);
      if (prev) Object.assign(prev, { strength, last_signal: session });
      else model.interests.push({ topic, strength, last_signal: session });
      changes.push({ session, action: prev ? "updated" : "added", kind: "interest", key: topic, value: String(strength), reason, by: "tutor" });
      return "ok";
    }
    case "set_level": {
      const level = Number(input.level);
      if (level !== model.level) {
        changes.push({ session, action: "updated", kind: "level", key: "level", value: String(level), reason, by: "tutor" });
        model.level = level;
      }
      return "ok";
    }
    case "note_what_works": {
      const insight = String(input.insight);
      model.what_works.push(insight);
      changes.push({ session, action: "added", kind: "what_works", key: insight, value: "", reason: "tutor insight", by: "tutor" });
      return "ok";
    }
    default:
      return `unknown tool ${name}`;
  }
}

export async function chaptersUpdate(model: LearnerModel, book: Book, ev: ReadingEvents, runId: string) {
  const calls: CallLog[] = [];
  const changes: StateChange[] = [];
  const recalls: string[] = [];
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Run id: ${runId}. Session ${book.session}.\nLearner model:\n${JSON.stringify(model, null, 1)}\n\nBook given: ${JSON.stringify({ title: book.title, level: book.level, topic: book.topic, target_skill: book.target_skill })}\nReading results (raw): ${JSON.stringify(rawObservation(ev))}`,
    },
  ];

  for (let turn = 0; turn < 6; turn++) {
    const r = await llm({ system: UPDATER_SYSTEM, messages, tools: TOOLS, maxTokens: 4000 });
    calls.push(logCall("chapters", book.session, "update_model", r));
    messages.push({ role: "assistant", content: r.message.content });
    const uses = r.message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (r.message.stop_reason !== "tool_use" || uses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const input = u.input as Record<string, unknown>;
      try {
        if (u.name === "recall") {
          const sql = assertReadOnly(String(input.sql));
          recalls.push(sql);
          const rows = await query(sql);
          results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(rows.slice(0, 30)) });
        } else {
          results.push({ type: "tool_result", tool_use_id: u.id, content: applyTool(model, book.session, u.name, input, changes) });
        }
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: u.id, content: (e as Error).message, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { calls, changes, recalls };
}

// ---------------------------------------------------------------- curator (Liquid AI LFM2)

const CURATOR_SYSTEM = `You prune a child's learner model so it stays small and current. Return JSON only:
{"archive": [{"kind": "interest"|"misconception"|"skill"|"what_works", "key": string, "reason": string}]}
Archive: resolved misconceptions, interests with strength below 0.3, and what_works items that repeat others. Keep everything else. Reasons are short.`;

type ArchiveItem = { kind: StateChange["kind"]; key: string; reason: string };

/** Rule backstop so pruning never depends on a 1.2B model getting JSON perfectly right. */
function staleByRule(m: LearnerModel): ArchiveItem[] {
  const out: ArchiveItem[] = [];
  for (const x of m.misconceptions) if (x.status === "resolved") out.push({ kind: "misconception", key: x.what, reason: "resolved" });
  for (const i of m.interests) if (i.strength < 0.3) out.push({ kind: "interest", key: i.topic, reason: `faded (strength ${i.strength})` });
  if (m.what_works.length > 4) for (const w of m.what_works.slice(0, m.what_works.length - 4)) out.push({ kind: "what_works", key: w, reason: "older insight, kept in archive" });
  return out;
}

export async function curateModel(model: LearnerModel, session: number) {
  const r = await curate(CURATOR_SYSTEM, `Session ${session}. Learner model:\n${JSON.stringify(model)}`);
  let picked: ArchiveItem[] = [];
  try {
    picked = (parseJson<{ archive?: ArchiveItem[] }>(r.text).archive ?? []).filter((a) => a && a.key);
  } catch {
    /* LFM output unusable: rules decide */
  }
  const rules = staleByRule(model);
  // Accept curator picks that the rules agree are archivable, with the curator's reason; add any rule-only items.
  const final = new Map<string, ArchiveItem>();
  for (const a of rules) final.set(`${a.kind}:${a.key}`, a);
  for (const a of picked) {
    const k = `${a.kind}:${a.key}`;
    if (final.has(k)) final.set(k, { ...a, reason: a.reason || final.get(k)!.reason });
  }

  const changes: StateChange[] = [];
  for (const a of final.values()) {
    let value = "";
    if (a.kind === "misconception") {
      value = JSON.stringify(model.misconceptions.find((x) => x.what === a.key));
      model.misconceptions = model.misconceptions.filter((x) => x.what !== a.key);
    } else if (a.kind === "interest") {
      value = JSON.stringify(model.interests.find((x) => x.topic === a.key));
      model.interests = model.interests.filter((x) => x.topic !== a.key);
    } else if (a.kind === "skill") {
      value = JSON.stringify(model.skills[a.key as Skill]);
      delete model.skills[a.key as Skill];
    } else if (a.kind === "what_works") {
      model.what_works = model.what_works.filter((w) => w !== a.key);
    }
    changes.push({ session, action: "archived", kind: a.kind, key: a.key, value, reason: a.reason, by: "curator" });
  }
  const call: CallLog = {
    tutor: "chapters",
    session,
    purpose: "curate",
    model: r.model,
    prompt_tokens: r.inputTokens,
    completion_tokens: r.outputTokens,
    cost_usd: 0,
    latency_ms: r.latencyMs,
  };
  return { changes, call };
}
