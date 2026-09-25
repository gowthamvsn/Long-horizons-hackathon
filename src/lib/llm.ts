import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

// Single entry point for the main LLM. Provider picked by LLM_PROVIDER (anthropic | bedrock).

type Provider = "anthropic" | "bedrock";

// $ per 1M tokens (input, output). Anthropic first-party rates; Bedrock billed by AWS but same order.
const PRICING: Record<string, [number, number]> = {
  "claude-opus-5": [5, 25],
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};

export interface LlmCall {
  system?: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
}

export interface LlmResult {
  message: Anthropic.Message;
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  model: string;
}

let anthropicClient: Anthropic | null = null;
let bedrockClient: AnthropicBedrockMantle | null = null;

function provider(): Provider {
  return (process.env.LLM_PROVIDER as Provider) || "anthropic";
}

export function modelId(): string {
  return provider() === "bedrock"
    ? process.env.BEDROCK_MODEL || "anthropic.claude-opus-5"
    : process.env.LLM_MODEL || "claude-opus-5";
}

function price(model: string, input: number, output: number): number {
  const key = model.replace(/^anthropic\./, "");
  const [pi, po] = PRICING[key] ?? PRICING["claude-opus-5"];
  return (input * pi + output * po) / 1_000_000;
}

export async function llm(call: LlmCall): Promise<LlmResult> {
  const model = modelId();
  const effort = (process.env.LLM_EFFORT || "low") as "low" | "medium" | "high";
  const base = {
    model,
    max_tokens: call.maxTokens ?? 16000,
    system: call.system,
    messages: call.messages,
    tools: call.tools,
    output_config: { effort },
  };
  const started = Date.now();
  let message: Anthropic.Message;

  if (provider() === "bedrock") {
    bedrockClient ??= new AnthropicBedrockMantle({ awsRegion: process.env.AWS_REGION || "us-east-1" });
    message = (await bedrockClient.messages.create(base as never)) as Anthropic.Message;
  } else {
    anthropicClient ??= new Anthropic();
    // Server-side refusal fallbacks (beta) so a classifier false-positive never kills a sim run.
    message = (await anthropicClient.beta.messages.create({
      ...base,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as never)) as unknown as Anthropic.Message;
  }

  const latencyMs = Date.now() - started;
  if (message.stop_reason === "refusal") throw new Error(`LLM refusal (${model})`);
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;
  return {
    message,
    text,
    inputTokens,
    outputTokens,
    costUsd: price(model, inputTokens, outputTokens),
    latencyMs,
    model,
  };
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences). */
export function parseJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in LLM output: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]) as T;
}
