import "./env";
import fs from "node:fs";
import path from "node:path";
import { generateCover } from "../src/lib/flux";
import type { Book } from "../src/lib/types";
import { STUDENT } from "./student";

// Paint any missing FLUX covers for a finished (or running) semester.
// npm run covers -- [--run semester-1] [--concurrency 6]
// Files land at public/covers/<run>-<tutor>-<nn>.jpg; the UI finds them by that name.

const args = process.argv.slice(2);
const flag = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const RUN = flag("run", "semester-1");
const CONCURRENCY = Number(flag("concurrency", "6"));

export function coverPath(run: string, tutor: string, session: number) {
  return `/covers/${run}-${tutor}-${String(session).padStart(2, "0")}.jpg`;
}

async function main() {
  const cp = JSON.parse(fs.readFileSync(path.join("data", "runs", `${RUN}.json`), "utf8")) as {
    sessions: { books: Record<string, Book> }[];
  };
  const todo = cp.sessions
    .flatMap((s) => Object.values(s.books))
    .filter((b) => !fs.existsSync(path.join("public", coverPath(RUN, b.tutor, b.session))));
  console.log(`▶ ${todo.length} covers to paint for "${RUN}"`);

  let ok = 0;
  let failed = 0;
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let b = queue.shift(); b; b = queue.shift()) {
        const scene = `${b.cover_scene} Featuring ${STUDENT.name}, a 7-year-old girl with curly brown hair and a yellow raincoat.`;
        try {
          await generateCover(scene, path.join("public", coverPath(RUN, b.tutor, b.session)));
          ok++;
          console.log(`✔ ${b.tutor} ${b.session} "${b.title}"`);
        } catch (e) {
          failed++;
          console.log(`✘ ${b.tutor} ${b.session}: ${(e as Error).message.slice(0, 140)}`);
          if (/402|credits/i.test((e as Error).message)) queue.length = 0; // out of credits: stop early
        }
      }
    }),
  );
  console.log(`■ painted ${ok}, failed ${failed}`);
}

main();
