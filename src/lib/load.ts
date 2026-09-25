import fs from "node:fs";
import path from "node:path";
import { MILESTONES, STUDENT } from "../../scripts/student";
import { mockSemester } from "./mock";
import { query } from "./rawtree";
import type { Book, CallLog, LearnerModel, ReadingEvents, Score, SemesterData, SessionView, StateChange, TutorName } from "./types";

// Where the UI's data comes from, in order: RawTree -> local checkpoint -> mock.

export const RUN = process.env.RUN_ID || "semester-3";
type Row = Record<string, unknown>;
const TUTORS: TutorName[] = ["transcript", "chapters"];

const num = (v: unknown) => Number(v ?? 0);
const json = <T>(v: unknown, dflt: T): T => {
  if (typeof v !== "string" || !v) return (v as T) ?? dflt;
  try {
    return JSON.parse(v) as T;
  } catch {
    return dflt;
  }
};
const esc = (s: string) => s.replace(/'/g, "''");

async function fromRawTree(run: string): Promise<SemesterData | null> {
  if (!process.env.RAWTREE_API_KEY) return null;
  const where = `run_id = '${esc(run)}' AND batch IN (SELECT argMax(batch, ts) FROM sessions WHERE run_id = '${esc(run)}' GROUP BY session)`;
  const [sessions, books, events, scores, calls, changes] = await Promise.all([
    query<Row>(`SELECT * FROM sessions WHERE ${where} ORDER BY session`),
    query<Row>(`SELECT * FROM books WHERE ${where}`),
    query<Row>(`SELECT * FROM events WHERE ${where}`),
    query<Row>(`SELECT * FROM scores WHERE ${where}`),
    query<Row>(`SELECT session, tutor, sum(cost_usd) AS cost FROM llm_calls WHERE ${where} GROUP BY session, tutor`),
    query<Row>(`SELECT * FROM state_changes WHERE ${where} ORDER BY ts`),
  ]);
  if (sessions.length === 0) return null;

  const pick = (rows: Row[], s: number, t: TutorName) => rows.find((r) => num(r.session) === s && r.tutor === t) ?? {};
  const bySession = new Map<number, SessionView>();
  for (const r of sessions) {
    const s = num(r.session);
    if (!bySession.has(s))
      bySession.set(s, {
        session: s,
        truth: { session: s, level: num(r.truth_level), interest: String(r.truth_interest), weak_skill: r.truth_weak_skill === "none" ? null : (r.truth_weak_skill as never) },
        books: {} as SessionView["books"],
        events: {} as SessionView["events"],
        scores: {} as SessionView["scores"],
        tokens: { transcript: 0, chapters: 0 },
        cost: { transcript: 0, chapters: 0 },
        model: {} as LearnerModel,
        changes: [],
      });
    const v = bySession.get(s)!;
    const tutor = r.tutor as TutorName;
    v.tokens[tutor] = num(r.prompt_tokens);
    if (tutor === "chapters") v.model = json<LearnerModel>(r.learner_model, v.model);
  }
  for (const v of bySession.values()) {
    for (const t of TUTORS) {
      const b = pick(books, v.session, t);
      v.books[t] = { ...(b as unknown as Book), session: v.session, level: num(b.level), tutor: t };
      const e = pick(events, v.session, t);
      v.events[t] = {
        ...(e as unknown as ReadingEvents),
        words_missed: json(e.words_missed, []),
        missed_by_skill: json(e.missed_by_skill, {}),
        enjoyment: num(e.enjoyment),
        words_attempted: num(e.words_attempted),
        response_time_ms: num(e.response_time_ms),
      };
      const sc = pick(scores, v.session, t);
      v.scores[t] = {
        ...(sc as unknown as Score),
        level_fit: num(sc.level_fit),
        topic_fit: num(sc.topic_fit),
        skill_fit: num(sc.skill_fit),
        accuracy: num(sc.accuracy),
        stale_reason: String(sc.stale_reason ?? ""),
      };
      v.cost[t] = num(pick(calls, v.session, t).cost);
    }
    v.changes = changes.filter((c) => num(c.session) === v.session).map((c) => ({ ...(c as unknown as StateChange), session: v.session }));
  }
  return { run, source: "rawtree", student: STUDENT, milestones: MILESTONES, sessions: [...bySession.values()] };
}

interface LocalRecord {
  session: number;
  truth: SessionView["truth"];
  books: SessionView["books"];
  events: SessionView["events"];
  scores: SessionView["scores"];
  prompt_tokens: SessionView["tokens"];
  model: LearnerModel;
  changes: StateChange[];
  calls: CallLog[];
}

function fromLocal(run: string): SemesterData | null {
  const file = path.join(process.cwd(), "data", "runs", `${run}.json`);
  if (!fs.existsSync(file)) return null;
  const cp = JSON.parse(fs.readFileSync(file, "utf8")) as { sessions: LocalRecord[] };
  if (!cp.sessions?.length) return null;
  const sessions: SessionView[] = cp.sessions.map((r) => ({
    session: r.session,
    truth: r.truth,
    books: r.books,
    events: r.events,
    scores: r.scores,
    tokens: r.prompt_tokens,
    cost: {
      transcript: r.calls.filter((c) => c.tutor === "transcript").reduce((a, c) => a + c.cost_usd, 0),
      chapters: r.calls.filter((c) => c.tutor === "chapters").reduce((a, c) => a + c.cost_usd, 0),
    },
    model: r.model,
    changes: r.changes,
  }));
  return { run, source: "local", student: STUDENT, milestones: MILESTONES, sessions };
}

/** Covers are painted separately (npm run covers); pick up any that exist on disk. */
function withCovers(data: SemesterData): SemesterData {
  for (const s of data.sessions)
    for (const b of Object.values(s.books)) {
      if (b.cover) continue;
      const rel = `/covers/${data.run}-${b.tutor}-${String(s.session).padStart(2, "0")}.jpg`;
      if (fs.existsSync(path.join(process.cwd(), "public", rel))) b.cover = rel;
    }
  return data;
}

export async function loadSemester(run = RUN): Promise<SemesterData> {
  if (run !== "mock") {
    try {
      const rt = await fromRawTree(run);
      if (rt) return withCovers(rt);
    } catch (e) {
      console.warn("[semester] RawTree unavailable, falling back:", (e as Error).message);
    }
    const local = fromLocal(run);
    if (local) return withCovers(local);
  }
  return mockSemester();
}
