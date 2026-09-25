import "./env";
import fs from "node:fs";
import path from "node:path";
import { insert } from "../src/lib/rawtree";
import { fetchFact } from "../src/lib/nimble";
import { generateCover } from "../src/lib/flux";
import type { Book, JanitorRun, LearnerModel, ReadingEvents, Score, Truth } from "../src/lib/types";
import { SESSIONS, STUDENT, read, score, truth } from "./student";
import { newTranscript, transcriptObserve, transcriptWrite, type CallLog, type StateChange, type TranscriptState, type WebFact } from "./tutors";
import { JANITOR_EVERY, chaptersUpdate, chaptersWrite, janitor, newLearnerModel, topInterest, type ToolCallLog } from "./chapters";

// npm run simulate -- [--run semester-1] [--sessions 30] [--no-covers]
// Resumable: progress is checkpointed to data/runs/<run>.json after every completed session.

const args = process.argv.slice(2);
const flag = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const RUN = flag("run", "semester-8");
const UNTIL = Number(flag("sessions", String(SESSIONS)));
const COVERS = !args.includes("--no-covers");

export interface SessionRecord {
  session: number;
  truth: Truth;
  books: { transcript: Book; chapters: Book };
  events: { transcript: ReadingEvents; chapters: ReadingEvents };
  scores: { transcript: Score; chapters: Score };
  prompt_tokens: { transcript: number; chapters: number };
  model: LearnerModel; // chapters learner model after this session
  changes: StateChange[];
  calls: CallLog[];
  recalls: string[];
  toolCalls: ToolCallLog[];
  janitor: JanitorRun | null;
  web: { transcript: { topic: string; fact: WebFact | null }; chapters: { topic: string; fact: WebFact | null } };
}

interface Checkpoint {
  run: string;
  done: number;
  transcript: TranscriptState;
  model: LearnerModel;
  sessions: SessionRecord[];
}

const RUN_FILE = path.join("data", "runs", `${RUN}.json`);
const FACTS_FILE = path.join("data", "facts.json");

function load<T>(file: string, dflt: T): T {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : dflt;
}
function save(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
}

async function retry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      console.log(`  ↻ ${label} failed (${(e as Error).message.slice(0, 120)}), retry ${i}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

// Nimble facts cached per topic+session so reruns don't spend credits.
const facts = load<Record<string, WebFact | null>>(FACTS_FILE, {});
async function fact(topic: string, session: number): Promise<WebFact | null> {
  const key = `${topic.toLowerCase()}:${session}`;
  if (key in facts) return facts[key];
  try {
    facts[key] = await retry(`nimble ${topic}`, () => fetchFact(topic), 2);
  } catch (e) {
    console.log(`  ! nimble: ${(e as Error).message.slice(0, 120)}`);
    facts[key] = null;
  }
  save(FACTS_FILE, facts);
  return facts[key];
}

async function cover(book: Book): Promise<string> {
  const rel = `/covers/${RUN}-${book.tutor}-${String(book.session).padStart(2, "0")}.jpg`;
  const abs = path.join("public", rel);
  if (fs.existsSync(abs)) return rel;
  if (!COVERS) return "";
  const scene = `${book.cover_scene} Featuring ${STUDENT.name}, a 7-year-old girl with curly brown hair and a yellow raincoat.`;
  try {
    await retry(`flux ${book.tutor} ${book.session}`, () => generateCover(scene, abs), 2);
    return rel;
  } catch (e) {
    console.log(`  ! flux: ${(e as Error).message.slice(0, 120)}`);
    return "";
  }
}

async function archive(rec: SessionRecord) {
  // batch = one attempt at one session; readers keep only the latest batch per session,
  // so a crash after a partial insert never double-counts.
  const batch = `${RUN}-${rec.session}-${Date.now()}`;
  const ts = new Date().toISOString();
  const tag = (row: object) => ({ run_id: RUN, batch, ts, ...row });
  const both = ["transcript", "chapters"] as const;
  await insert(
    "sessions",
    both.map((tutor) =>
      tag({
        session: rec.session,
        tutor,
        student: STUDENT.name,
        truth_level: rec.truth.level,
        truth_interest: rec.truth.interest,
        truth_weak_skill: rec.truth.weak_skill ?? "none",
        prompt_tokens: rec.prompt_tokens[tutor],
        learner_model: tutor === "chapters" ? JSON.stringify(rec.model) : "",
      }),
    ),
  );
  await insert("books", both.map((t) => tag({ ...rec.books[t] })));
  await insert(
    "events",
    both.map((t) => {
      const { missed_by_skill: _labels, ...ev } = rec.events[t]; // simulator's skill labels stay out of the archive
      return tag({ ...ev, words_missed: JSON.stringify(ev.words_missed), reading_log: JSON.stringify(ev.reading_log ?? []) });
    }),
  );
  await insert("scores", both.map((t) => tag({ ...rec.scores[t] })));
  await insert("llm_calls", rec.calls.map((c) => tag({ ...c })));
  await insert("tool_calls", (rec.toolCalls ?? []).map((c) => tag({ tutor: "chapters", ...c })));
  await insert(
    "nimble_fetches",
    both.map((t) => tag({ session: rec.session, tutor: t, topic: rec.web?.[t].topic ?? "", title: rec.web?.[t].fact?.title ?? "", url: rec.web?.[t].fact?.url ?? "", snippet: rec.web?.[t].fact?.snippet ?? "" })),
  );
  if (rec.janitor)
    await insert(
      "janitor_runs",
      rec.janitor.scores.map((sc) => tag({ session: rec.session, model: rec.janitor!.model, latency_ms: rec.janitor!.latency_ms, fallback: rec.janitor!.fallback ? 1 : 0, ...sc })),
    );
  await insert("state_changes", rec.changes.map((c) => tag({ tutor: "chapters", ...c })));
}

/** Push every locally checkpointed session to RawTree (for runs made before RawTree was available). */
async function backfill() {
  const cp = load<Checkpoint | null>(RUN_FILE, null);
  if (!cp) throw new Error(`no local run ${RUN_FILE}`);
  for (const rec of cp.sessions) {
    await retry(`backfill ${rec.session}`, () => archive(rec));
    console.log(`✔ backfilled session ${rec.session}`);
  }
}

async function main() {
  if (args.includes("--backfill")) return backfill();
  const cp = load<Checkpoint>(RUN_FILE, {
    run: RUN,
    done: 0,
    transcript: newTranscript(),
    model: newLearnerModel(),
    sessions: [],
  });
  console.log(`▶ run "${RUN}": ${cp.done}/${UNTIL} done, covers ${COVERS ? "on" : "off"}`);

  for (let session = cp.done + 1; session <= UNTIL; session++) {
    const t0 = Date.now();
    const tr = truth(session);
    const calls: CallLog[] = [];

    const tTopic = cp.transcript.lastTopic;
    const cTopic = topInterest(cp.model);
    const [tFact, cFact] = await Promise.all([fact(tTopic, session), fact(cTopic, session)]);

    // Work on copies so a crash mid-session leaves the checkpoint untouched.
    const transcript = structuredClone(cp.transcript);
    const model = structuredClone(cp.model);

    const [tw, cw] = await Promise.all([
      // transcriptWrite only appends to the transcript after a successful parse.
      retry("transcript write", () => transcriptWrite(transcript, session, tFact)),
      retry("chapters write", () => chaptersWrite(model, session, cFact)),
    ]);
    calls.push(tw.call, cw.call);
    const books = { transcript: tw.book, chapters: cw.book };
    [books.transcript.cover, books.chapters.cover] = await Promise.all([cover(books.transcript), cover(books.chapters)]);

    const seen = (t: "transcript" | "chapters") => cp.sessions.map((r) => r.books[t].title);
    const events = {
      transcript: read(books.transcript, "transcript", seen("transcript")),
      chapters: read(books.chapters, "chapters", seen("chapters")),
    };
    // Bookkeeping, not memory of the child: the Fox's working context lists its last 3 titles.
    model.recent_books = [...(model.recent_books ?? []), books.chapters.title].slice(-3);

    transcriptObserve(transcript, events.transcript);
    const upd = await retry("chapters update", () => {
      const scratch = structuredClone(model);
      return chaptersUpdate(scratch, books.chapters, events.chapters, RUN).then((r) => ({ ...r, scratch }));
    });
    Object.assign(model, upd.scratch);
    calls.push(...upd.calls);
    let jan: Awaited<ReturnType<typeof janitor>> | null = null;
    if (session % JANITOR_EVERY === 0) {
      const recent = [...cp.sessions.slice(-(JANITOR_EVERY - 1)).map((r) => r.events.chapters), events.chapters];
      jan = await retry("janitor", () => janitor(model, session, recent), 2);
      calls.push(jan.call);
    }

    const rec: SessionRecord = {
      session,
      truth: tr,
      books,
      events,
      scores: { transcript: score(books.transcript), chapters: score(books.chapters) },
      prompt_tokens: { transcript: tw.promptTokens, chapters: cw.promptTokens },
      model: structuredClone(model),
      changes: [...upd.changes, ...(jan?.changes ?? [])],
      calls,
      recalls: upd.recalls,
      toolCalls: upd.toolCalls,
      janitor: jan?.run ?? null,
      web: { transcript: { topic: tTopic, fact: tFact }, chapters: { topic: cTopic, fact: cFact } },
    };

    if (process.env.RAWTREE_API_KEY) await retry("rawtree insert", () => archive(rec));
    else if (session === cp.done + 1) console.log("  ! RAWTREE_API_KEY not set: saving locally only; run `npm run backfill` later");

    cp.transcript = transcript;
    cp.model = model;
    cp.sessions.push(rec);
    cp.done = session;
    save(RUN_FILE, cp);

    const s = rec.scores;
    console.log(
      `✔ session ${String(session).padStart(2)} | transcript "${books.transcript.title}" (${books.transcript.topic}, L${books.transcript.level}) acc ${s.transcript.accuracy} ${tw.promptTokens} tok` +
        ` | chapters "${books.chapters.title}" (${books.chapters.topic}, L${books.chapters.level}) acc ${s.chapters.accuracy} ${cw.promptTokens} tok` +
        ` | ${rec.changes.length} changes, ${upd.recalls.length} recalls, ${upd.toolCalls.length} tools${jan ? `, janitor ${jan.changes.filter((c) => c.action === "archived").length} archived/${jan.changes.filter((c) => c.action === "flagged").length} flagged${jan.run.fallback ? " (fallback)" : ""}` : ""} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
  }
  console.log("■ done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
