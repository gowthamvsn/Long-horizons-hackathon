import type Anthropic from "@anthropic-ai/sdk";
import { llm, parseJson, type LlmResult } from "../src/lib/llm";
import type { Book, CallLog, ReadingEvents, StateChange, TutorName } from "../src/lib/types";

export type { CallLog, StateChange };
import { STUDENT, rawObservation } from "./student";

// Both tutors share the book-writing step. They differ only in what goes in the prompt:
//   transcript -> the whole conversation so far
//   chapters   -> three-tier memory, see chapters.ts

export function logCall(tutor: TutorName, session: number, purpose: string, r: LlmResult): CallLog {
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

export const WRITER_SYSTEM = `You are a warm, expert reading tutor who writes short picture books for one child.
Each book: a title, about 150 words of story at the child's reading level (level 2 = short sentences, mostly one/two-syllable words; level 3 = longer sentences, richer vocabulary), about the child's current interest, deliberately practicing the one phonics skill they most need (use many words with that pattern).
If a real current fact is provided, weave it into the story naturally in kid-friendly words.
Every book must be new: never reuse a title or storyline the child has already read.
Target the phonics skill the child is struggling with right now. Do not keep practicing a skill they have already mastered.
Reply with JSON only:
{"title": string, "level": 2|3, "topic": string (1-3 words), "target_skill": "vowel_teams"|"silent_e"|"digraphs"|"blends"|"none", "text": string, "cover_scene": string (one sentence describing the cover illustration, no text in image)}`;

export interface WebFact {
  title: string;
  url: string;
  snippet: string;
}

export function factLine(fact: WebFact | null): string {
  return fact ? `\nReal current fact you can use (from ${fact.url}): "${fact.title}. ${fact.snippet}"` : "";
}

export function toBook(tutor: TutorName, session: number, raw: Omit<Book, "tutor" | "session" | "cover" | "fact_title" | "fact_url">, fact: WebFact | null): Book {
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

export async function transcriptWrite(state: TranscriptState, session: number, fact: WebFact | null) {
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
