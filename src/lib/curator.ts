import { llm } from "./llm";

// The curator: Liquid AI LFM2 running locally in Ollama. Falls back to the main LLM
// (CURATOR_PROVIDER=llm) behind the same interface.

export interface CuratorResult {
  text: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

export async function curate(system: string, prompt: string): Promise<CuratorResult> {
  if ((process.env.CURATOR_PROVIDER || "ollama") === "llm") {
    const r = await llm({ system, messages: [{ role: "user", content: prompt }], maxTokens: 2000 });
    return { text: r.text, model: r.model, latencyMs: r.latencyMs, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
  }
  const model = process.env.CURATOR_MODEL || "hf.co/LiquidAI/LFM2-1.2B-GGUF:Q4_K_M";
  const started = Date.now();
  const res = await fetch(`${process.env.OLLAMA_URL || "http://localhost:11434"}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { message: { content: string }; prompt_eval_count?: number; eval_count?: number };
  return {
    text: body.message.content,
    model: `ollama:${model}`,
    latencyMs: Date.now() - started,
    inputTokens: body.prompt_eval_count ?? 0,
    outputTokens: body.eval_count ?? 0,
  };
}
