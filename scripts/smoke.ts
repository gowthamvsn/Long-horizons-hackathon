import "./env";
import { llm, modelId } from "../src/lib/llm";
import { insert, query, t } from "../src/lib/rawtree";
import { fetchFact } from "../src/lib/nimble";
import { generateCover } from "../src/lib/flux";
import { curate } from "../src/lib/curator";

// One tiny call per sponsor to prove every key works. `npm run smoke [name...]`

const checks: Record<string, () => Promise<string>> = {
  llm: async () => {
    const r = await llm({ messages: [{ role: "user", content: "Say 'ready' and nothing else." }], maxTokens: 200 });
    return `${modelId()} -> "${r.text.trim()}" (${r.inputTokens}+${r.outputTokens} tok, $${r.costUsd.toFixed(5)}, ${r.latencyMs}ms)`;
  },
  rawtree: async () => {
    await insert("llm_calls", [{ tutor: "smoke", session: 0, prompt_tokens: 1, completion_tokens: 1, cost_usd: 0, latency_ms: 0, ts: new Date().toISOString() }]);
    const rows = await query<{ n: number }>(`SELECT count() AS n FROM ${t("llm_calls")} WHERE tutor = 'smoke'`);
    return `smoke rows in llm_calls: ${rows[0]?.n}`;
  },
  nimble: async () => {
    const f = await fetchFact("dinosaurs");
    return f ? `${f.title} — ${f.url}` : "no results";
  },
  flux: async () => {
    const p = await generateCover("a small friendly triceratops reading a book under a tree", "public/covers/_smoke.jpg");
    return `saved ${p}`;
  },
  curator: async () => {
    const r = await curate("Reply with JSON only.", 'Return {"ok": true}.');
    return `${r.model} -> ${r.text.trim()} (${r.latencyMs}ms)`;
  },
};

async function main() {
const only = process.argv.slice(2);
let failed = 0;
for (const [name, fn] of Object.entries(checks)) {
  if (only.length && !only.includes(name)) continue;
  try {
    console.log(`✔ ${name}: ${await fn()}`);
  } catch (e) {
    failed++;
    console.log(`✘ ${name}: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
}

main();
