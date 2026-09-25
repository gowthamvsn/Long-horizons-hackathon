# Notes for the pitch / judge Q&A

Things explained in chat that are worth having in writing. Read this alongside `DEMO_SCRIPT.md` and `README.md`.

## "Is this just a recommendation engine for Maya?"

Partly, but don't undersell it that way to judges. The honest framing:

- **Similar:** yes — both keep a profile of a user and use it to decide what to serve next.
- **Different, and this is the actual point:**
  1. It **generates**, it doesn't select. No catalog to rank — a brand-new story and cover every time.
  2. The goal isn't "what will she like," it's "what does she need" — sometimes the correct book is one she'll enjoy less (harder, less-loved topic). That's tutoring, not recommendation.
  3. **The hard problem isn't the picking, it's keeping the profile honest over 30 sessions of a kid changing her mind, mastering things, and forgetting them again.** That's a memory-lifecycle problem, not a ranking problem. The Owl-vs-Fox comparison is entirely about *that*.

**One-liner if asked directly:** "It looks like a recommendation engine on the surface, but the thing we're testing is how the profile survives change without going stale or growing without bound. The recommendation is the easy part; the memory architecture is the point."

## "How do you decide something is stale or relevant?"

Two mechanisms, layered:

**1. Automatic decay (no AI, just arithmetic).** Every fact has `confidence` (0-1) and `ttl` (sessions before it expires without reconfirmation). Any fact not reconfirmed with fresh evidence this session loses 15% confidence (`× 0.85`). Simple neglect is enough to fade a fact.

**2. Active judgment — the Liquid AI janitor, every 2 sessions.** Liquid AI's LFM2 (local, in Ollama) is shown every current fact plus the last couple sessions' raw reading evidence, and scores each fact:
   - **staleness** (0-1): does this look outdated?
   - **relevance** (0-1): does the next book even need this?
   - **contradiction**: a short note if evidence actively disagrees with the fact

   **Decision rule:** archive if clearly stale + not relevant, or expired + somewhat stale, or confidence very low. Flag (⚠, not deleted) if there's a contradiction that doesn't clearly meet the archive bar — the tutor must resolve it explicitly next update. Otherwise keep.

   **Protected facts** (current level, strongest current interest, anything pinned) can never be archived — the writer needs them every session.

   **Fallback:** if the small model's output isn't usable JSON, a rule-based backstop (pure expiry/confidence math) decides instead, so pruning never silently fails.

**Where this shows on screen:** confidence % + countdown on each fact card in "The tutor's mind," ⚠ flags, and the leaf-falling animation into the RawTree archive drawer.

## Quick reference: what's real vs. simulated

| Real (actual API calls) | Simulated (our code, `scripts/student.ts`) |
|---|---|
| Both tutors' book-writing (Claude Opus) | Maya's reading level, interests, weak skills over time |
| Fox editing its own memory via tool calls | Which words she gets right/wrong each session |
| The Liquid AI janitor scoring memory | Her enjoyment rating and remarks |
| Nimble's web searches | The "ground truth" used to score both tutors (never shown to either tutor) |
| FLUX generating covers | |
| "Ask the archive" (live SQL generation + execution) | |

## Final numbers (semester-8, the official demo run — 30/30 sessions, `claude-opus-5`)

- Fox average accuracy **78%** vs Owl **66%**. Fox record: **11 wins / 16 ties / 3 losses**.
- Sessions with any mistake: Owl 20/30, Fox 14/30.
- By session 30: Owl's prompt **48,929 tokens**, Fox's **1,085 tokens** — a **45x** difference, growing every session for the Owl, flat for the Fox.
- **Honest caveat to say yourself before a judge asks:** raw $ cost this run was close between the two (Fox makes several small calls per session vs. the Owl's one big call). The claim is "bounded context forever," not "cheaper today" — that gap would become decisive over a real school year (180+ sessions), which we didn't have time to run.

## Sponsor tools, one line each

- **RawTree (Tinybird):** the whole cold archive — every session/book/score/tool-call. Dashboard charts + "Ask the archive" read from it live.
- **Nimble:** one real web fact per book.
- **Black Forest Labs FLUX:** all 60 book covers.
- **Liquid AI (LFM2, local):** the memory janitor (see above).

## After a restart — how to get back up and running

```bash
cd D:\hackathon_sep25
npm run dev
```
Then open **http://localhost:3000/?run=semester-8** — that's the final demo run, already saved in RawTree and locally (`data/runs/semester-8.json`), so it loads instantly with no re-running needed.

Everything else that matters is already durable:
- All code is committed to git (`git log` to check).
- All 30 sessions + 60 covers are saved to disk and to RawTree (a hosted service — unaffected by your restart).
- `.env.local` (your API keys) is a plain file on disk, untouched by a restart.
- `STATUS.md` has the full timestamped history of the build. `DEMO_SCRIPT.md` has the exact recording shot list. This file has the pitch talking points.

Nothing needs to be re-run. If the dev server was mid-command when you restart, just run `npm run dev` again.
