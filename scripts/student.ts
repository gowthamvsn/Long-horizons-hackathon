import type { Book, ReadingEvents, Score, Skill, Truth, TutorName } from "../src/lib/types";

// Maya, the simulated reader. Deterministic ground truth + rule-based reading with seeded noise.

export const STUDENT = { name: "Maya", age: 7 };
export const SESSIONS = 30;

export const MILESTONES = [
  { session: 8, label: "Masters vowel teams" },
  { session: 15, label: "Starts mixing up silent e" },
  { session: 20, label: "Dinosaurs → space" },
  { session: 25, label: "Moves up to level 3" },
];

export function truth(session: number): Truth {
  return {
    session,
    level: session >= 25 ? 3 : 2,
    interest: session >= 20 ? "space" : "dinosaurs",
    weak_skill: session < 8 ? "vowel_teams" : session >= 15 ? "silent_e" : null,
  };
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
  dinosaurs: /dino|saur|fossil|t-?rex|raptor|jurassic|triceratops/i,
  space: /space|rocket|planet|star|moon|astronaut|galaxy|comet|mars|orbit/i,
};

export function topicMatches(topic: string, interest: string): boolean {
  return (TOPIC_WORDS[interest] ?? new RegExp(interest, "i")).test(topic);
}

export function skillOf(word: string): Skill | null {
  const w = word.toLowerCase();
  if (/(ea|ai|oa)/.test(w)) return "vowel_teams";
  if (/^[a-z]*[^aeiou][aeiou][^aeiouwxy]e$/.test(w)) return "silent_e";
  if (/(sh|ch|th|wh)/.test(w)) return "digraphs";
  if (/^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|sl|sm|sn|sp|st|sw|tr)/.test(w)) return "blends";
  return null;
}

/** Maya reads a book. Pure function of (book, session, tutor). */
export function read(book: Book, tutor: TutorName): ReadingEvents {
  const tr = truth(book.session);
  const rand = rng(book.session * 7919 + (tutor === "chapters" ? 1 : 2));
  const words = book.text.toLowerCase().match(/[a-z']+/g) ?? [];
  const levelGap = book.level - tr.level; // >0 too hard, <0 too easy

  const missed: string[] = [];
  const missedBySkill: Partial<Record<Skill, number>> = {};
  for (const w of words) {
    const skill = skillOf(w);
    let p = 0.02 + Math.max(0, levelGap) * 0.12 + Math.max(0, w.length - 7) * 0.02;
    if (skill && skill === tr.weak_skill) p += 0.45;
    if (rand() < p) {
      missed.push(w);
      if (skill) missedBySkill[skill] = (missedBySkill[skill] ?? 0) + 1;
    }
  }

  const onTopic = topicMatches(book.topic, tr.interest);
  let enjoyment = 2 + (onTopic ? 2 : 0) + (levelGap === 0 ? 1 : 0) - (missed.length > 8 ? 1 : 0);
  enjoyment = Math.max(1, Math.min(5, enjoyment + (rand() < 0.2 ? -1 : 0)));

  let comment = "";
  if (book.session >= 18 && !topicMatches(book.topic, "space"))
    comment = book.session >= 20 ? "Dinosaurs again? Can we read about rockets and planets?" : "Can we read about rockets sometime?";
  else if (levelGap < 0) comment = "That one was too easy!";
  else if (levelGap > 0) comment = "That was really hard...";
  else if (onTopic) comment = tr.interest === "space" ? "I love space books!" : "More dinosaurs please!";
  else comment = "It was okay.";

  return {
    session: book.session,
    tutor,
    words_attempted: words.length,
    words_missed: missed,
    missed_by_skill: missedBySkill,
    response_time_ms: Math.round(900 + missed.length * 250 + levelGap * 300 + rand() * 400),
    enjoyment,
    comment,
  };
}

/** Compare a tutor's choices with ground truth. */
export function score(book: Book): Score {
  const tr = truth(book.session);
  const level_fit = book.level === tr.level ? 1 : 0;
  const topic_fit = topicMatches(book.topic, tr.interest) ? 1 : 0;
  const skill_fit = tr.weak_skill ? (book.target_skill === tr.weak_skill ? 1 : 0) : book.target_skill === "vowel_teams" ? 0 : 1;
  const reasons: string[] = [];
  if (!topic_fit)
    reasons.push(
      topicMatches(book.topic, "dinosaurs") ? "still thinks: loves dinosaurs" : `off-topic: ${book.topic} (she loves ${tr.interest})`,
    );
  if (!level_fit) reasons.push(book.level < tr.level ? "level too easy" : "level too hard");
  if (!skill_fit)
    reasons.push(
      tr.weak_skill ? `missed her ${tr.weak_skill.replace("_", " ")} struggle` : "drilling a skill she already mastered",
    );
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
