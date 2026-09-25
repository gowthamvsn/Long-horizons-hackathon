# 3-minute silent demo — shot list

No audio. Press **C** on the page to turn on the caption bar (bottom, dark strip). Step through it with **]** (next) / **[** (back), in your own time, synced to your clicks. It's already loaded with the script below — you don't need to type anything while recording.

Open **http://localhost:3000/?run=semester-8** before you hit record. Full screen the browser.

| Time | Caption (already loaded, press `]`) | What you click / do |
|---|---|---|
| 0:00–0:10 | *"Meet Maya, 7. A reading tutor writes her a book every session for a whole semester."* | Just let the page sit on session 1. Point at Maya's avatar top-right. |
| 0:10–0:20 | *"Two tutors compete on the same kid: 🦉 remembers everything. 🦊 remembers what matters now."* | Point at the two bookshelves, then the Owl/Fox HUD race bar at the top. |
| 0:20–0:35 | *"Press ▶ and watch 30 sessions play out."* | Click ▶ on the trail map. Let it autoplay ~10-12 sessions, don't touch anything. |
| 0:35–0:50 | *"🦉's backpack never stops growing. 🦊's notebook stays small — on purpose."* | Pause autoplay. Point at the Owl's growing red backpack icon on the trail, then the two token gauges (bottom right) — Owl's red and rising, Fox's small and flat. |
| 0:50–1:05 | *"Maya changes: masters skills, forgets them again, changes her mind about what she loves."* | Scrub the slider slowly left→right once, pointing at the milestone labels above the trail (vowel teams mastered, →ocean, →space, level down, vowel relapse, →dinosaurs, silent-e relapse). |
| 1:05–1:25 | *"Here — 🦊 spotted the change. 🦉 is still teaching yesterday's lesson."* | Scroll to the **Key Moments** strip. Click the **session 12**, **24**, or **28** chip (Fox 1.0, Owl 0.33 or lower — the biggest gaps in this run). Let the side-by-side callout render — point at the Owl's red panel (its mistake) vs the Fox's green panel (correct). |
| 1:25–1:40 | *"Hover: FLUX painted this cover live. Nimble found a real fact for the story."* | Click a book cover to open the modal. Hover the **FLUX** badge top-right of the cover (tooltip pops). Hover the **Nimble** badge on the fact line at the bottom. |
| 1:40–1:55 | *"🦊's memory isn't a transcript — it's edited facts, each with a confidence score that fades."* | Close modal. Point at **"The tutor's mind"** panel — hover one fact card, point at the confidence % and ⏳ countdown. |
| 1:55–2:10 | *"A small AI (Liquid, running locally) cleans up 🦊's memory — old facts fall into the archive."* | Scrub to **session 10, 20, 22, or 24** (the janitor flagged a contradiction on each of these). Hover the **Liquid AI** badge on that strip. Point at a fact card fading/dropping into the Archive drawer, and the drawer's running count. |
| 2:10–2:30 | *"Nothing is thrown away. Ask the archive anything — it writes real SQL and answers live."* | Scroll to **Ask the archive**. Hover the **RawTree** badge. Click one of the 3 example chips. Wait for the real answer + SQL to render (this is a genuine live call, give it 3-5 seconds). |
| 2:30–2:50 | *"🦊 kept up with Maya all semester. 🦉's memory only grew. That's the whole idea."* | Scroll to the three **charts** at the bottom. Point at the accuracy chart (Fox above Owl for most of the back half) and the token chart (Owl's line climbing, Fox's flat). |
| 2:50–3:00 | (let the last caption sit) | Hold on the charts or the HUD final score. End the recording. |

## Numbers to have ready if anyone asks after the video
From the final demo run (`semester-8`, 30/30 sessions, `claude-opus-5`):
- Fox average accuracy **78%** vs Owl **66%**. Fox won 11 sessions, tied 16, lost 3.
- Sessions with any mistake: Owl 20, Fox 14 (out of 30).
- By session 30, the Owl's prompt is **48,929 tokens**; the Fox's is **1,085** — a **45x** difference, and the Owl's keeps growing every session while the Fox's doesn't.
- Honest note if asked about $ cost: total dollar cost this run is close between the two, because the Fox makes several small calls per session (write + memory update + janitor) versus the Owl's one big call. The real claim is **bounded context, not lower cost today** — over a longer horizon (a school year) the Owl's per-call cost would eventually outpace the Fox's call count, but a fair year-long run wasn't feasible in the time we had.

## If you want narration instead
Everything above also works as a spoken script — just read the captions aloud instead of stepping through them. The click choreography is identical either way.
