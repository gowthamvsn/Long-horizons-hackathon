# Chapters: live build status

_Last updated: **2026-09-25, 12:29 PT** · deadline 4:30 PM PT today (code freeze 4:05 PM)_

## Right now
- ✅ **semester-5 running, quality gap still favors Fox overall.** At session 15/30 (started 12:20 PT, ETA ~12:35 PT).
- Since session 7: Owl avg accuracy ~0.55, Fox avg accuracy ~0.66. Owl prompt at 23.5k tokens and climbing; Fox at 1.3k, roughly flat.
- Session 15: Owl 0.67, Fox 0.33. Checked: **scoring artifact**, not a Fox mistake — regex doesn't recognize "tide pool" as ocean-related. Applies equally to both tutors, noting for README.
- Session 16: Owl 0.67, Fox **0** — this one is a real Fox mistake, and an interesting one: it conflated a repeated book (which tanked enjoyment) with genuine interest fade, and pivoted to dinosaurs one session before the real ocean→space shift (session 17). Good honest material for the README: the Fox isn't perfect, it can misattribute a signal — just in the opposite direction from the Owl's staleness (too reactive vs. too static).
- Session 17-20: Fox stayed ahead or tied (1.0, 0.67, 0.67 vs Owl's 0.67, 0.33, 0.67). Owl now at 32.1k tokens, Fox 1.2k.
- **First real janitor catch at session 20**: flagged a contradiction between the silent_e skill fact and an old misconception. Didn't silently delete it, just flagged ⚠️ for the tutor to resolve next turn — the 3-tier design working exactly as intended.
- Session 22 (vowel relapse): tied 0.67. Session 23 (interest reverts to dinosaurs): both lagged 0.33 (expected). **Session 24: Fox caught it perfectly (1.0), Owl still 0.67.** Owl 38.7k tokens, Fox 1.4k.
- Switched default LLM_MODEL to claude-haiku-4-5 (cheap) in .env.local/.env.example per user request — only affects future runs (e.g. the live-session button), not the running semester-5.
- User asked for the demo to feel live/interactive, not a screenshot. Answered in chat: most of it already is (play button animates trail, scrubber swaps books live, Read-to-me speaks+highlights live, Ask-the-archive is a real live LLM+SQL call). Added plan: build a "Run next session live" button (real API call on click) once this run finishes.

## Results so far (all times PT, 2026-09-25)
| Run | Time | What changed | Outcome |
|---|---|---|---|
| semester-1 | 11:38 | first design, 4 simple milestones, loud signals | ❌ same quality: Claude with the full transcript kept up. Only tokens differed (21.7k vs 1.8k). |
| semester-2 / 3 | 11:40–12:00 | reversals, raw per-word logs, quiet signals | ❌ stopped early: the Fox repeated books; the sim counted "the" as a digraph; the Fox jumped level too fast |
| semester-4 | 12:00–12:22 (stopped: out of credits, 18/30 done) | fixes: sight words exempt, level-change discipline, `recall` restricted to what a tutor could know | ⚠️ Fox 76% vs Owl 70% accuracy. Owl at 29.5k tokens vs Fox 1.2k. |
| semester-5 | 12:20–now (running, 13/30 done) | full three-tier memory (confidence/TTL, LFM2 janitor) | ✅ **best result yet** — see "Right now" above |

## Sponsor tools status
- ✅ RawTree: live, every run streams into it (database `default`)
- ✅ Nimble: live, a real web fact per book
- ✅ Liquid AI LFM2: running locally in Ollama (~2s per call), now doing real janitor work every 2 sessions
- ✅ Black Forest Labs FLUX: credits live, covers painted with `npm run covers`
- ✅ Claude `claude-opus-5`: tutor brain (not a sponsor)

## Next plan
1. ~~Build three-tier memory upgrade~~ ✅ done (12:24)
2. ~~Launch semester-5, watch reversals~~ ⏳ in progress, looking good
3. Let semester-5 finish (~12:32 PT), tally full 30-session results
4. If it holds, make semester-5 the demo run. Paint all 60 covers with FLUX (parallel)
5. UI polish on real data, screenshots
6. README with real numbers
7. Demo video script, then **code freeze 4:05 PM**

## Log (2026-09-25, all times PT)
- 09:56 Started. Phase 1 scaffold, sponsor clients, smoke tests.
- 10:19 Phase 2 (tutors), Phase 4a (UI on mock), Phase 5 (Ask the archive) committed.
- 11:05 Keys added; RawTree database fixed (`default`).
- 11:20 Game-style UI: trail map, Owl vs Fox HUD, milestone banners.
- 11:38 semester-1 done: same quality as baseline. Redesigning the semester to be harder.
- 11:43 FLUX credits confirmed working.
- 12:00 Found sim/prompt flaws (sight words, level jumps, repeated books); fixed them, started semester-4.
- 12:05 You asked about the three-tier memory design; found we only had it partly. Started building it fully.
- 12:14 Created this status file.
- 12:22 Anthropic credits ran out mid-run (total spent ≈ $8.70). semester-4 stopped at 18/30.
- 12:24 Three-tier upgrade finished, type-checked, committed.
- 12:24 Noticed unrelated leftover Cognee plugin config; confirmed plugin itself already uninstalled, flagged 2 harmless manual cleanup steps for you.
- 12:26 Credits topped up ($20). Launched semester-5 with the full upgrade.
- 12:29 semester-5 at session 13/30, Fox ahead on quality (0.71 vs 0.52 avg since session 7) and cost (1.5k vs 20.3k tokens). Added explicit dates to this log.
- 12:30 Session 15: Fox 0.33, Owl 0.67 (first Owl lead). Checked data: scoring-regex artifact ("tide pool" not recognized as ocean), not a real Fox mistake.
- 12:31 Session 16: Fox scored 0, a genuine mistake — conflated a repeated book's low enjoyment with real interest fade, pivoted to dinosaurs one session early.
- 12:32 Session 17-18: Fox recovered fast, hit 1.0 by session 18 (right topic/level/skill on space). Owl still catching up.
- 12:33 Session 19-20: Fox 0.67/0.67, Owl 0.33/0.67. First real janitor catch at session 20: flagged a contradiction (silent_e skill vs. stale misconception) instead of silently deleting — design working as intended.
- 12:34 User: don't need to run to 30 if results are good by 20. Flagged that sessions 22/23/27 are the "forgetting" reversals this whole redesign was for; recommended continuing to ~24-27 instead. User implicitly OK'd by not objecting; continued run.
- 12:35 Session 21-23: tied 0.67, then both lagged 0.33 at the interest-revert session (23) — expected, evidence lands next session.
- 12:35 User: demo needs to feel live/interactive, not a screenshot. Answered in chat with a concrete click-by-click demo plan (play button, scrubber, Read-to-me, Ask-the-archive) and added a "Run next session live" button to the build plan.
- 12:36 User: switch the LLM to something cheap. Set LLM_MODEL=claude-haiku-4-5 in .env.local and .env.example (affects future runs only, not the running semester-5).
- 12:36 Session 24: Fox nailed the double reversal (1.0 — correct topic, level and skill on the dinosaur revert). Owl 0.67, now at 38.7k tokens vs Fox's 1.4k.
- 12:37 User flagged that this Log wasn't being appended to (only "Right now" was being overwritten, losing history). Backfilled the missing entries above; will append every update from here on.
- 12:37 Session 25: Fox 1.0, Owl 0.67. Owl 40.4k tokens, Fox 1.4k. Fox has now won or tied every session since 17.
- 12:38 Session 26: Fox 1.0, Owl 0.67. Owl 42.2k tokens, Fox 1.3k. Silent-e relapse (session 27) is next.
- 12:39 Session 27 (silent-e relapse lands): tied 0.67 (expected lag, evidence just landed). Owl 43.9k tokens, Fox 1.3k. 3 sessions left.
- 12:40 Session 28: tied 0.67 again — Fox targeted vowel_teams instead of the new silent-e relapse. Root cause: the janitor archived the silent_e skill fact (contradicted by a new misconception) instead of lowering it, so the writer had only a text misconception, no low-mastery skill fact, and defaulted elsewhere. Honest nuance for the README: facts cooperate, and cleanup + targeting didn't fully coordinate here. Owl 45.6k tokens, Fox 1.1k.
- 12:41 Session 29: Fox recovered to 1.0 (correctly re-targeted silent_e). Owl dropped to 0.33. Owl 47.3k tokens, Fox 1.1k. 1 session left.
