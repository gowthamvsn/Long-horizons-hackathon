// Shared shapes between the simulation scripts and the UI.

export type Skill = "vowel_teams" | "silent_e" | "digraphs" | "blends";
export type TutorName = "transcript" | "chapters";

export interface SkillState {
  mastery: number; // 0..1
  evidence: number[]; // session ids
  last_seen: number;
}

export interface Misconception {
  what: string;
  since: number;
  status: "active" | "resolved";
}

export interface Interest {
  topic: string;
  strength: number; // 0..1
  last_signal: number;
}

export interface LearnerModel {
  level: number;
  skills: Partial<Record<Skill, SkillState>>;
  misconceptions: Misconception[];
  interests: Interest[];
  what_works: string[];
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
  action: "added" | "updated" | "resolved" | "archived";
  kind: "level" | "skill" | "misconception" | "interest" | "what_works";
  key: string;
  value: string;
  reason: string;
  by: "tutor" | "curator";
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
}

export interface SemesterData {
  run: string;
  source: "rawtree" | "local" | "mock";
  student: { name: string; age: number };
  milestones: { session: number; label: string }[];
  sessions: SessionView[];
}
