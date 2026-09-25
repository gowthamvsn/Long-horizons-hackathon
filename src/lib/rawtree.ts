import { RawTree } from "@rawtree/sdk";

// RawTree = the archive + every number on the dashboard. Tables auto-create on first insert.
// SQL dialect is ClickHouse.

export const TABLES = ["sessions", "events", "books", "state_changes", "llm_calls", "scores"] as const;
export type Table = (typeof TABLES)[number];

let client: RawTree | null = null;

function rt(): RawTree {
  const apiKey = process.env.RAWTREE_API_KEY;
  if (!apiKey) throw new Error("RAWTREE_API_KEY missing");
  client ??= new RawTree({ apiKey, database: db() });
  return client;
}

function db(): string {
  return process.env.RAWTREE_DATABASE || "chapters";
}

/** Table name as used in SQL (the client already pins the database). */
export function t(table: Table): string {
  return table;
}

export async function insert(table: Table, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  // Nested objects are stored as JSON strings so ClickHouse schema inference stays flat.
  const flat = rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]),
    ),
  );
  await rt().insert({ table, values: flat as never });
}

export async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await rt().query<T>({ sql });
  return res.data ?? [];
}

/** Only allow a single read-only statement (used by the tutor's recall tool and "Ask the archive"). */
export function assertReadOnly(sql: string): string {
  const s = sql.trim().replace(/;+\s*$/, "");
  if (s.includes(";")) throw new Error("Only one statement allowed");
  if (!/^(select|with)\b/i.test(s)) throw new Error("Only SELECT queries allowed");
  if (/\b(insert|alter|drop|truncate|delete|update|create|rename|grant|system|attach|detach|optimize|kill)\b/i.test(s))
    throw new Error("Write keywords are not allowed");
  return s;
}
