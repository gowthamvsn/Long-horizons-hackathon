import fs from "node:fs/promises";
import path from "node:path";

// Black Forest Labs FLUX: one picture-book cover per session.

const BASE = "https://api.bfl.ai/v1";
export const COVER_STYLE =
  "warm children's picture-book cover, soft watercolor and gouache, gentle paper texture, muted warm palette, " +
  "cream background, whimsical hand-drawn linework, cozy and friendly, no text, no letters";

function key(): string {
  const k = process.env.BFL_API_KEY;
  if (!k) throw new Error("BFL_API_KEY missing");
  return k;
}

/** Generate a cover and save it to outPath. Returns the path. */
export async function generateCover(scene: string, outPath: string): Promise<string> {
  const model = process.env.BFL_MODEL || "flux-2-pro";
  const submit = await fetch(`${BASE}/${model}`, {
    method: "POST",
    headers: { "x-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `${scene}. ${COVER_STYLE}`, width: 768, height: 1024 }),
  });
  if (!submit.ok) throw new Error(`FLUX submit ${submit.status}: ${await submit.text()}`);
  const { polling_url } = (await submit.json()) as { id: string; polling_url: string };

  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const poll = await fetch(polling_url, { headers: { "x-key": key() } });
    const body = (await poll.json()) as { status: string; result?: { sample?: string } };
    if (body.status === "Ready" && body.result?.sample) {
      const img = await fetch(body.result.sample); // signed URL, valid 10 min: download now
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, Buffer.from(await img.arrayBuffer()));
      return outPath;
    }
    if (body.status === "Error" || body.status === "Failed") throw new Error(`FLUX failed: ${JSON.stringify(body)}`);
  }
  throw new Error("FLUX timed out");
}
