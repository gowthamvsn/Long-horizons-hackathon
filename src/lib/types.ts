// Shared shapes between the simulation scripts and the UI.

export type Skill = "vowel_teams" | "silent_e" | "digraphs" | "blends";
export type TutorName = "transcript" | "chapters";

export type FactKind = "level" | "skill" | "interest" | "misconception" | "what_works";

/** One fact in the Fox's hot state. Everything it knows about the child is a HotFact. */
export interface HotFact {
  id: string; // `${kind}:${key}`
  kind: FactKind;
  key: string; // "digraphs", "ocean", "level", free text for misconceptions / what_works
  value: number | string; // mastery 0-1 | strength 0-1 | level 2/3 | text
  source: string; // where it came from: "s7 reading log", "s10 remark", ...
  since: number; // session first recorded
  last_confirmed: number; // session last supported by evidence
  confidence: number; // 0-1, decays each session it isn't re-confirmed
  ttl: number; // sessions after last_confirmed before it expires
  pinned?: boolean;
  flag?: string; // janitor: contradiction noticed, for the tutor to resolve
}

/** Hot state: the only memory in the Fox's prompt. Roughly constant in size. */
export interface LearnerModel {
  facts: HotFact[];
  plan: string; // what the next couple of books should do
  recent_books?: string[]; // last 3 titles, so stories don't repeat
}

/** Ground truth about the kid at a given session (known only to the simulator and scorer). */
export interface Truth {
  session: number;
  level: number;
  interest: string;
  weak_skill: Skill | null;
}

export interface Book {
  tutor: TutorName;
  session: number;
  title: string;
  level: number;
  topic: string;
  target_skill: Skill | "none";
  text: string;
  cover_scene: string;
  cover: string; // /covers/...
  fact_title: string;
  fact_url: string;
}

export interface ReadingEvents {
  session: number;
  tutor: TutorName;
  words_attempted: number;
  words_missed: string[];
  missed_by_skill: Partial<Record<Skill, number>>;
  response_time_ms: number;
  enjoyment: number; // 1..5
  comment: string;
  reading_log?: [word: string, ms: number, correct: 0 | 1][];
}

export interface Score {
  tutor: TutorName;
  session: number;
  level_fit: number; // 0|1
  topic_fit: number; // 0|1
  skill_fit: number; // 0|1
  accuracy: number; // mean of the three
  stale_reason: string;
}

export interface CallLog {
  tutor: TutorName;
  session: number;
  purpose: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  latency_ms: number;
}

export interface StateChange {
  session: number;
  action: "added" | "updated" | "resolved" | "archived" | "pinned" | "flagged" | "planned";
  kind: FactKind | "plan";
  key: string;
  value: string;
  reason: string;
  by: "tutor" | "curator" | "janitor";
}

/** One janitor (LFM2) pass: per-fact scores and what it decided. */
export interface JanitorRun {
  session: number;
  model: string;
  latency_ms: number;
  fallback: boolean; // true when the small model's output was unusable and rules decided alone
  scores: { id: string; staleness: number; relevance: number; contradiction: string; decision: "keep" | "archive" | "flag" }[];
}

type PerTutor<T> = Record<TutorName, T>;

/** One session as the UI replays it. */
export interface SessionView {
  session: number;
  truth: Truth;
  books: PerTutor<Book>;
  events: PerTutor<ReadingEvents>;
  scores: PerTutor<Score>;
  tokens: PerTutor<number>; // prompt tokens of the book-writing call
  cost: PerTutor<number>; // $ spent this session
  model: LearnerModel; // chapters learner model after the session
  changes: StateChange[];
  janitor?: JanitorRun | null;
}

export interface SemesterData {
  run: string;
  source: "rawtree" | "local" | "mock";
  student: { name: string; age: number };
  milestones: { session: number; label: string; emoji?: string }[];
  sessions: SessionView[];
}
