import { NextResponse } from "next/server";
import { llm, parseJson } from "@/lib/llm";
import { RUN } from "@/lib/load";
import { assertReadOnly, query } from "@/lib/rawtree";

// "Ask the archive": question -> LLM writes read-only ClickHouse SQL -> RawTree -> LLM answers from rows.

export const dynamic = "force-dynamic";

const SCHEMA = `ClickHouse tables (every row has run_id String, batch String, ts String ISO time):
- sessions(session, tutor, truth_level, truth_interest, truth_weak_skill, prompt_tokens, learner_model JSON string)
- books(session, tutor, title, level, topic, target_skill, text, fact_title, fact_url)
- events(session, tutor, words_attempted, words_missed JSON array string e.g. '["beach","rain"]', missed_by_skill JSON object string, response_time_ms, enjoyment 1-5, comment)
- scores(session, tutor, level_fit, topic_fit, skill_fit, accuracy, stale_reason)
- state_changes(session, tutor, action added|updated|resolved|archived, kind level|skill|misconception|interest|what_works, key, value, reason, by tutor|curator)
- llm_calls(session, tutor, purpose, model, prompt_tokens, completion_tokens, cost_usd, latency_ms)
tutor is 'transcript' or 'chapters'. The student is Maya. Numbers may be stored as strings: wrap with toFloat64OrZero() when doing math.
To test for a word in words_missed use: arrayExists(w -> w LIKE '%ea%', JSONExtract(words_missed, 'Array(String)')).`;

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 });
  const run = RUN.replace(/'/g, "''");

  try {
    const plan = await llm({
      system: `You write one read-only ClickHouse SELECT query to answer questions about a reading tutor's archive.\n${SCHEMA}\nAlways filter run_id = '${run}'. Prefer tutor = 'chapters' unless the question is about comparing tutors. Add LIMIT 50. Reply with JSON only: {"sql": string}`,
      messages: [{ role: "user", content: question }],
      maxTokens: 2000,
    });
    const sql = assertReadOnly(parseJson<{ sql: string }>(plan.text).sql);
    const rows = await query(sql);

    const answer = await llm({
      system: "Answer the question in one or two warm, plain sentences for a teacher, using only the query results. Mention session numbers when relevant. If the results are empty, say the archive has no record of it.",
      messages: [{ role: "user", content: `Question: ${question}\nSQL: ${sql}\nRows (${rows.length}): ${JSON.stringify(rows.slice(0, 50))}` }],
      maxTokens: 1000,
    });
    return NextResponse.json({ answer: answer.text.trim(), sql, rows: rows.slice(0, 20), rowCount: rows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
