import { MILESTONES, SESSIONS, STUDENT, read, score, truth } from "../../scripts/student";
import type { Book, HotFact, LearnerModel, SemesterData, SessionView, Skill, StateChange, TutorName } from "./types";

// Plausible stand-in semester so the UI can be built before the real run lands.
// Shape is identical to what the RawTree loader returns.

const STORIES: Record<string, string[]> = {
  dinosaurs: [
    "Maya and the Brave Triceratops",
    "The Dino Who Loved the Rain",
    "A Stegosaurus at the Beach",
    "Tiny T. rex Takes a Train",
  ],
  space: ["Maya's Rocket to the Moon", "The Comet That Came Home", "A Picnic on Mars", "Stars Over the Space Station"],
};

const TEXTS: Record<string, string> = {
  dinosaurs:
    "Maya ran to the tree. A big green dinosaur sat in the rain. \"Hello,\" said Maya. The dinosaur gave a slow, happy roar. They ate a meal of leaves and beans. Then the rain came down again, and the team hid under a leaf as big as a boat. \"I can read the sky,\" said the dinosaur. \"Soon the sun will shine.\" And it did.",
  space:
    "Maya put on her helmet and stepped into the rocket. Five, four, three, two, one! The rocket rose up past the clouds. The Earth grew small and blue. Maya waved at the moon. She saw a comet with a long, bright tail. \"I will make a wish,\" she said. She wished to come back and explore every planet, one by one.",
};

function book(tutor: TutorName, session: number, topic: string, level: number, target: Skill | "none"): Book {
  const key = topic.includes("dino") ? "dinosaurs" : "space";
  const titles = STORIES[key];
  return {
    tutor,
    session,
    title: titles[(session + (tutor === "chapters" ? 1 : 0)) % titles.length],
    level,
    topic,
    target_skill: target,
    text: TEXTS[key],
    cover_scene: "",
    cover: "",
    fact_title: key === "space" ? "NASA's Artemis crew trains for lunar flyby" : "New dinosaur species found in Patagonia",
    fact_url: "https://example.com",
  };
}

export function mockSemester(): SemesterData {
  const sessions: SessionView[] = [];
  for (let s = 1; s <= SESSIONS; s++) {
    const changes: StateChange[] = [];
    // Chapters' beliefs lag reality by one session.
    const seen = truth(Math.max(1, s - 1));
    const cTopic = seen.interest;
    const cLevel = seen.level;
    const cSkill = (seen.weak_skill ?? "none") as Skill | "none";
    const tBook = book("transcript", s, "dinosaurs", 2, "vowel_teams");
    const cBook = book("chapters", s, cTopic, cLevel, cSkill);
    const fact = (kind: HotFact["kind"], key: string, value: number | string, since: number): HotFact => ({
      id: kind === "level" ? "level" : `${kind}:${key}`,
      kind,
      key,
      value,
      source: `s${since} reading log`,
      since,
      last_confirmed: s,
      confidence: 0.8,
      ttl: 5,
    });
    const model: LearnerModel = {
      facts: [fact("level", "level", cLevel, s), fact("interest", cTopic, 0.9, s), fact("skill", String(cSkill), 0.3, s)],
      plan: `${cTopic} stories at level ${cLevel} practicing ${String(cSkill).replace("_", " ")}`,
      recent_books: [],
    };
    const prev = truth(Math.max(1, s - 2));
    if (prev.interest !== seen.interest)
      changes.push({ session: s, action: "archived", kind: "interest", key: prev.interest, value: "", reason: "stale 0.8, relevance 0.2", by: "janitor" });

    const tTok = 1100 + (s - 1) * 720;
    const cTok = 980 + ((s * 37) % 140);
    sessions.push({
      session: s,
      truth: truth(s),
      books: { transcript: tBook, chapters: cBook },
      events: { transcript: read(tBook, "transcript"), chapters: read(cBook, "chapters") },
      scores: { transcript: score(tBook), chapters: score(cBook) },
      tokens: { transcript: tTok, chapters: cTok },
      cost: { transcript: (tTok * 5 + 450 * 25) / 1e6, chapters: ((cTok + 1800) * 5 + 900 * 25) / 1e6 },
      model: structuredClone(model),
      changes,
    });
  }
  return { run: "mock", source: "mock", student: STUDENT, milestones: MILESTONES, sessions };
}
