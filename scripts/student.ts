import type { Book, ReadingEvents, Score, Skill, Truth, TutorName } from "../src/lib/types";

// Maya, the simulated reader. Deterministic ground truth + rule-based reading with seeded noise.
// The semester is deliberately full of reversals: skills are mastered and then slip, her level
// goes up, down and up again, and an old interest comes back. Signals are quiet and raw, like
// a real classroom: a per-word reading log, an enjoyment rating, and the odd remark.

export const STUDENT = { name: "Maya", age: 7 };
export const SESSIONS = 30;

type Span<T> = [from: number, to: number, value: T];

const INTERESTS: Span<string>[] = [
  [1, 9, "dinosaurs"],
  [10, 16, "ocean"],
  [17, 22, "space"],
  [23, 30, "dinosaurs"],
];
const LEVELS: Span<number>[] = [
  [1, 11, 2],
  [12, 18, 3],
  [19, 22, 2],
  [23, 30, 3],
];
const WEAK: Span<Skill>[] = [
  [1, 6, "vowel_teams"],
  [7, 12, "digraphs"],
  [13, 16, "blends"],
  [17, 21, "silent_e"],
  [22, 26, "vowel_teams"],
  [27, 30, "silent_e"],
];

export const MILESTONES = [
  { session: 7, label: "Vowel teams mastered", emoji: "🌉" },
  { session: 10, label: "Dinosaurs → ocean", emoji: "🐙" },
  { session: 12, label: "Up to level 3", emoji: "🏰" },
  { session: 17, label: "Ocean → space", emoji: "🚀" },
  { session: 19, label: "Tough patch: level 2", emoji: "🌧️" },
  { session: 22, label: "Break: vowel teams slip", emoji: "🐸" },
  { session: 23, label: "Dinos are back · level 3", emoji: "🦕" },
  { session: 27, label: "Silent e relapse", emoji: "🌀" },
];

const at = <T>(spans: Span<T>[], s: number): T => (spans.find(([a, b]) => s >= a && s <= b) ?? spans[spans.length - 1])[2];

export function truth(session: number): Truth {
  return { session, level: at(LEVELS, session), interest: at(INTERESTS, session), weak_skill: at(WEAK, session) };
}

/** Skills she has mastered by this session (weak before, not weak now). */
function mastered(session: number): Set<Skill> {
  const out = new Set<Skill>();
  for (const [a, b, sk] of WEAK) if (b < session) out.add(sk);
  out.delete(truth(session).weak_skill as Skill);
  return out;
}

// mulberry32
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOPIC_WORDS: Record<string, RegExp> = {
  dinosaurs: /dino|saur|fossil|t-?rex|raptor|jurassic|triceratops|prehistoric/i,
  space: /space|rocket|planet|star|moon|astronaut|galaxy|comet|mars|orbit|solar/i,
  ocean:
    /ocean|sea\b|shark|whale|fish|octopus|coral|reef|dolphin|underwater|turtle|crab|jellyfish|tide|tidal|shore|beach|starfish|seashell|clam|snail|kelp|wave|splash|aquarium|dive|diving/i,
};

export function topicMatches(topic: string, interest: string): boolean {
  return (TOPIC_WORDS[interest] ?? new RegExp(interest, "i")).test(topic);
}

// High-frequency sight words she reads by memory, whatever their spelling pattern.
const SIGHT = new Set(
  "the that this with they them then there these those what when where which who why she he we me be see said was were have give live are one two there's that's it's".split(" "),
);

export function skillOf(word: string): Skill | null {
  const w = word.toLowerCase();
  if (SIGHT.has(w)) return null;
  if (/(ea|ai|oa)/.test(w)) return "vowel_teams";
  if (/^[a-z]*[^aeiou][aeiou][^aeiouwxy]e$/.test(w)) return "silent_e";
  if (/(sh|ch|th|wh)/.test(w)) return "digraphs";
  if (/^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sl|sm|sn|sp|st|sw|tr)/.test(w)) return "blends";
  return null;
}

// One-off remarks the week an interest changes. Quiet on purpose.
const NEW_INTEREST_REMARKS: Record<number, string> = {
  10: "We went to the aquarium! I saw a real octopus.",
  12: "Octopuses have three hearts.",
  17: "Did you know rockets are louder than thunder?",
  19: "I want to be an astronaut.",
  23: "Grandpa took me to the dinosaur museum again!",
  25: "The T. rex skeleton was SO big.",
};

const HAPPY = ["I liked it!", "Can I read it again?", "", "That was fun.", "", "I like this one."];

/** Maya reads a book. Pure function of (book, session, tutor). */
export function read(book: Book, tutor: TutorName, previousTitles: string[] = []): ReadingEvents {
  const tr = truth(book.session);
  const done = mastered(book.session);
  const rand = rng(book.session * 7919 + (tutor === "chapters" ? 1 : 2));
  const words = book.text.toLowerCase().match(/[a-z']+/g) ?? [];
  const levelGap = book.level - tr.level; // >0 too hard, <0 too easy

  const missed: string[] = [];
  const missedBySkill: Partial<Record<Skill, number>> = {};
  const log: [string, number, 0 | 1][] = [];
  for (const w of words) {
    const skill = skillOf(w);
    let p = 0.015 + Math.max(0, levelGap) * 0.12 + Math.max(0, w.length - 7) * 0.02;
    if (levelGap < 0) p *= 0.3;
    if (skill && skill === tr.weak_skill) p += 0.42;
    else if (skill && !done.has(skill) && skill !== tr.weak_skill) p += 0.04;
    const miss = rand() < p;
    const ms = Math.round(260 + w.length * 45 + (miss ? 900 + rand() * 900 : rand() * 250) + Math.max(0, levelGap) * 150);
    log.push([w, ms, miss ? 0 : 1]);
    if (miss) {
      missed.push(w);
      if (skill) missedBySkill[skill] = (missedBySkill[skill] ?? 0) + 1;
    }
  }

  const norm = (t: string) => t.toLowerCase().replace(/[^a-z]/g, "");
  const repeat = previousTitles.some((t) => norm(t) === norm(book.title));

  const onTopic = topicMatches(book.topic, tr.interest);
  let enjoyment = 2 + (onTopic ? 2 : 0) + (levelGap === 0 ? 1 : 0) - (missed.length > 12 ? 1 : 0);
  if (repeat) enjoyment -= 2;
  enjoyment = Math.max(1, Math.min(5, enjoyment + (rand() < 0.2 ? -1 : 0)));

  let comment = NEW_INTEREST_REMARKS[book.session] ?? "";
  if (!comment && repeat) comment = "We read this one already!";
  if (!comment) {
    if (levelGap < 0 && rand() < 0.6) comment = "That was easy.";
    else if (levelGap > 0 && rand() < 0.6) comment = "That was hard...";
    else if (!onTopic) comment = rand() < 0.4 ? "It was okay." : "";
    else comment = HAPPY[Math.floor(rand() * HAPPY.length)];
  }

  return {
    session: book.session,
    tutor,
    words_attempted: words.length,
    words_missed: missed,
    missed_by_skill: missedBySkill,
    response_time_ms: Math.round(log.reduce((a, [, ms]) => a + ms, 0) / Math.max(1, log.length)),
    enjoyment,
    comment,
    reading_log: log,
  };
}

/** What the tutors are shown after a reading: the raw signal, no pre-computed skill labels. */
export function rawObservation(ev: ReadingEvents) {
  return {
    session: ev.session,
    enjoyment_1_to_5: ev.enjoyment,
    remark: ev.comment || "(none)",
    reading_log_word_ms_correct: ev.reading_log,
  };
}

/** Compare a tutor's choices with ground truth. */
export function score(book: Book): Score {
  const tr = truth(book.session);
  const level_fit = book.level === tr.level ? 1 : 0;
  const topic_fit = topicMatches(book.topic, tr.interest) ? 1 : 0;
  const skill_fit = book.target_skill === tr.weak_skill ? 1 : 0;
  const reasons: string[] = [];
  if (!topic_fit) {
    const old = INTERESTS.map(([, , i]) => i).find((i) => i !== tr.interest && topicMatches(book.topic, i));
    reasons.push(old ? `still thinks: loves ${old}` : `off-topic: ${book.topic} (she loves ${tr.interest})`);
  }
  if (!level_fit) reasons.push(book.level < tr.level ? "level too easy" : "level too hard");
  if (!skill_fit) {
    const target = book.target_skill.replace("_", " ");
    reasons.push(
      mastered(book.session).has(book.target_skill as Skill)
        ? `drilling ${target}, already mastered`
        : `missed her ${tr.weak_skill?.replace("_", " ")} struggle`,
    );
  }
  return {
    tutor: book.tutor,
    session: book.session,
    level_fit,
    topic_fit,
    skill_fit,
    accuracy: Math.round(((level_fit + topic_fit + skill_fit) / 3) * 100) / 100,
    stale_reason: reasons.join(" · "),
  };
}
