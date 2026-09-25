import Nimble from "@nimble-way/nimble-js";

// Nimble: a real, current fact about the kid's interest for each book.

export interface WebFact {
  title: string;
  url: string;
  snippet: string;
}

let client: Nimble | null = null;

export async function fetchFact(topic: string): Promise<WebFact | null> {
  const apiKey = process.env.NIMBLE_API_KEY;
  if (!apiKey) throw new Error("NIMBLE_API_KEY missing");
  client ??= new Nimble({ apiKey });
  const res = (await client.search({
    query: `${topic} news for kids`,
    max_results: 5,
    search_depth: "lite",
  } as never)) as unknown as { results?: { title: string; url: string; description?: string; content?: string }[] };
  const hit = res.results?.find((r) => (r.description || r.content || "").length > 40) ?? res.results?.[0];
  if (!hit) return null;
  return {
    title: hit.title,
    url: hit.url,
    snippet: (hit.description || hit.content || "").replace(/\s+/g, " ").slice(0, 400),
  };
}
