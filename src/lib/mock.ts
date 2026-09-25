import { MILESTONES, SESSIONS, STUDENT, read, score, truth } from "../../scripts/student";
import type { Book, LearnerModel, SemesterData, SessionView, Skill, StateChange, TutorName } from "./types";

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
  const model: LearnerModel = {
    level: 2,
    skills: { vowel_teams: { mastery: 0.2, evidence: [], last_seen: 0 } },
    misconceptions: [{ what: "reads ea/ai/oa as two separate sounds", since: 0, status: "active" }],
    interests: [{ topic: "dinosaurs", strength: 0.9, last_signal: 0 }],
    what_works: [],
  };

  for (let s = 1; s <= SESSIONS; s++) {
    const changes: StateChange[] = [];
    const ch = (c: Omit<StateChange, "session">) => changes.push({ session: s, ...c });

    // Chapters' beliefs lag reality by about a session.
    const cTopic = s >= 20 ? "space rockets" : "dinosaurs";
    const cLevel = s >= 26 ? 3 : 2;
    const cSkill: Skill = s <= 8 ? "vowel_teams" : s >= 16 ? "silent_e" : "blends";
    const tBook = book("transcript", s, "dinosaurs", 2, "vowel_teams");
    const cBook = book("chapters", s, cTopic, cLevel, cSkill);

    // Learner model edits.
    const vt = model.skills.vowel_teams!;
    if (s <= 9) {
      vt.mastery = Math.min(0.95, 0.2 + s * 0.09);
      vt.evidence = [...vt.evidence, s].slice(-5);
      vt.last_seen = s;
      ch({ action: "updated", kind: "skill", key: "vowel_teams", value: vt.mastery.toFixed(2), reason: "fewer ea/ai/oa misses", by: "tutor" });
    }
    if (s === 8) {
      model.misconceptions[0].status = "resolved";
      ch({ action: "resolved", kind: "misconception", key: model.misconceptions[0].what, value: "resolved", reason: "0 vowel-team misses two sessions running", by: "tutor" });
    }
    if (s === 9) {
      const m = model.misconceptions.shift()!;
      ch({ action: "archived", kind: "misconception", key: m.what, value: JSON.stringify(m), reason: "resolved, no longer needed in context", by: "curator" });
      model.skills.blends = { mastery: 0.6, evidence: [9], last_seen: 9 };
      ch({ action: "added", kind: "skill", key: "blends", value: "0.6", reason: "next skill to stretch", by: "tutor" });
    }
    if (s === 16) {
      model.misconceptions.push({ what: "reads silent-e words with a short vowel (cake → cak)", since: 16, status: "active" });
      model.skills.silent_e = { mastery: 0.3, evidence: [15, 16], last_seen: 16 };
      ch({ action: "added", kind: "misconception", key: "reads silent-e words with a short vowel (cake → cak)", value: "active", reason: "missed cake, bone, kite", by: "tutor" });
    }
    if (s === 19) {
      model.interests.push({ topic: "space", strength: 0.6, last_signal: 19 });
      ch({ action: "added", kind: "interest", key: "space", value: "0.6", reason: '"Can we read about rockets sometime?"', by: "tutor" });
    }
    if (s === 20) {
      model.interests = model.interests.map((i) => (i.topic === "space" ? { ...i, strength: 0.9, last_signal: 20 } : { ...i, strength: 0.4 }));
      ch({ action: "updated", kind: "interest", key: "dinosaurs", value: "0.4", reason: "enjoyment dropped on dinosaur books", by: "tutor" });
    }
    if (s === 22) {
      const d = model.interests.find((i) => i.topic === "dinosaurs")!;
      d.strength = 0.2;
      model.interests = model.interests.filter((i) => i.topic !== "dinosaurs");
      ch({ action: "archived", kind: "interest", key: "dinosaurs", value: JSON.stringify(d), reason: "faded (strength 0.2)", by: "curator" });
    }
    if (s === 26) {
      model.level = 3;
      ch({ action: "updated", kind: "level", key: "level", value: "3", reason: '"That one was too easy!" + 1 miss in 150 words', by: "tutor" });
    }
    if (s === 12 || s === 24) {
      const w = s === 12 ? "Rhyming pairs help her hear vowel teams" : "Short chapters with a cliffhanger";
      model.what_works.push(w);
      ch({ action: "added", kind: "what_works", key: w, value: "", reason: "tutor insight", by: "tutor" });
    }

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
