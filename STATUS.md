# Chapters: live build status

_Last updated: 12:24 PT · deadline 4:30 PM PT (code freeze 4:05)_

## Right now
- 🛑 **BLOCKED: the Anthropic API is out of credits.** semester-4 stopped at session 19 ("credit balance is too low"). Sessions 1–18 are saved and can resume.
- ✅ The three-tier memory upgrade is **built and type-checks**: hot facts with source, confidence and TTL; `set_fact`/`retire_fact`/`pin`/`update_plan`/`recall` tools; an LFM2 janitor every 2 sessions (scores staleness and relevance, flags contradictions, and its scores decide archiving); cold log tables `tool_calls`, `nimble_fetches` and `janitor_runs` in RawTree; the UI shows confidence, ⏳TTL, 📌 pins and ⚠️ flags.
- ⏳ Waiting on you: add Anthropic credits (about $20 recommended), or choose a cheaper model.

## Results so far
| Run | What changed | Outcome |
|---|---|---|
| semester-1 | first design, 4 simple milestones, loud signals | ❌ same quality: Claude with the full transcript kept up. Only tokens differed (21.7k vs 1.8k). |
| semester-2 / 3 | reversals, raw per-word logs, quiet signals | ❌ stopped early: the Fox repeated books; the sim counted "the" as a digraph; the Fox jumped level too fast |
| semester-4 (stopped at 18, out of credits) | fixes: sight words exempt, level-change discipline, `recall` restricted to what a tutor could know | ⚠️ **Fox 76% vs Owl 70%** over 18 sessions, with the Owl at 29.5k tokens vs the Fox at 1.2k. The Owl clung to dinosaurs at sessions 16–17 and drilled mastered vowel teams. The Fox's weak spot: it never moved Maya up to level 3 (sessions 12–18). |

## Sponsor tools status
- ✅ RawTree: live, and every run streams into it (database `default`)
- ✅ Nimble: live, a real web fact per book
- ✅ Liquid AI LFM2: running locally in Ollama (~2s per call)
- ✅ Black Forest Labs FLUX: credits live, covers painted with `npm run covers`
- ✅ Claude `claude-opus-5`: tutor brain (not a sponsor)

## Next plan
1. ~~Finish the upgrade~~ ✅ done
2. **Needs credits:** Launch **semester-5** with the upgrade and watch the accuracy gap at the reversals (sessions 7, 10, 12, 17, 19, 22, 23, 27).
3. If the Fox clearly beats the Owl, make it the demo run. Otherwise use the better of semester-4 and semester-5, and explain honestly.
4. Paint all covers (FLUX) in parallel.
5. UI polish on real data, then screenshots.
6. README with real numbers.
7. Demo video script, then code freeze at 4:05.

## Log
- 09:56 Started. Phase 1 scaffold, sponsor clients, smoke tests.
- 10:19 Phase 2 (tutors), Phase 4a (UI on mock), Phase 5 (Ask the archive) committed.
- 11:0x Keys added; RawTree database fixed (`default`).
- 11:2x Game-style UI: trail map, Owl vs Fox HUD, milestone banners.
- 11:38 semester-1 done: same quality. Redesigning the semester to be harder.
- 11:43 FLUX credits confirmed working.
- 12:00 Found sim/prompt flaws (sight words, level jumps, repeated books); fixed them, started semester-4.
- 12:05 You asked about the three-tier memory design. We only had it partly (see the gap table in chat); building it fully now.
- 12:14 Created this file.
- 12:22 Anthropic credits ran out mid-run (total spent across all runs ≈ $8.70). semester-4 stopped at 18/30.
- 12:24 Three-tier upgrade built, type-checks, committed. Waiting for credits to launch semester-5.
