# Changelog

All notable changes to **Blueprint** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] — 2026-04-19

Phase 2 of the v0.7 / v0.8 roadmap — the endgame layer. Ship alongside v0.7.0's content + slowdown so players can feedback the whole stack at once before v1.0. Not a soft launch: this is the "now there's actually something to do past mastery" patch.

### Added

- **Third prestige layer — Exhibitions.** Unlocks once the player has earned **30 lifetime Patents**. A new top-bar tab, between Mastery and Achievements, surfaces the system. Exhibitions are run-spanning goals rolled from a pool of 3; the player picks one, attempts it during their next run, and on Prestige the goal is evaluated. Success grants **1 Legacy Mark**; failure clears the slot with no penalty. The player rolls a new pool whenever they want another shot.
- **8 starting exhibitions**: SCALE SHOW (produce 10 M ore), MINIATURE WORKS (prestige with ≤ 20 machines), THE LONG HAUL (1 h+ run), EXHIBITION MATCH (5 K schematics in one prestige), THE GRAND TOUR (own every MK-V), SILENT EXHIBITION (zero clicks), EMPTY STAGE (no research), HEAVY ARTILLERY (10+ of every slot-1 base machine).
- **The Archive — 10 Legacy Upgrades.** Permanent purchases, persist through every reset (prestige AND publish):
  - ENDOWMENT (1 LM) · +5 % global production
  - DRAFTING HEIRLOOM (1 LM) · +1 starting drill, stacks with FAST START
  - OPEN ARCHIVE (2 LM) · whole research tree revealed from start
  - PATRONS (2 LM) · +10 % patent gain
  - EFFICIENT MIND (2 LM) · -20 % research cost
  - AMPLIFIER (3 LM) · challenge rewards ×1.5
  - FOURTH BLUEPRINT (3 LM) · blueprint pool rolls 4 per prestige
  - WIDER NET (3 LM) · +6 h offline cap
  - ANNOTATED SCHEMATIC (4 LM) · +20 % schematic gain
  - GRAND ARCHIVE (5 LM) · -25 % tier unlock costs
- Total Archive cost is **28 Legacy Marks** — at ~1 LM per completed exhibition run, the full Archive is 28+ dedicated prestiges of endgame work.
- New **Legacy layer** in `researchMultipliers()` applied before the challenge layer so AMPLIFIER can scale every challenge reward in-place.
- **Save migration** — existing saves pick up `legacyMarks`, `legacyUpgrades`, and `exhibitions` fields from the fresh-state merge without losing any other data.

### Integration

- **Challenges & Exhibitions evaluate independently on prestige.** You can run a challenge *and* an exhibition in the same prestige — both the challenge's permanent reward and the exhibition's Legacy Mark drop on success.
- **ECHO challenge reward + FOURTH BLUEPRINT legacy upgrade stack** — both set `m.extraBlueprintRoll`, so owning either gives you 4 blueprint rolls per prestige.
- **ARCHIVIST blueprint + EFFICIENT MIND legacy upgrade stack** — multiplicative through `m.researchCostMul`.

### Balance

- **Pacing target:** with v0.7.0's slowdown, first publish lands at ~3 h. Exhibitions unlock at 30 lifetime Patents (~10–15 h of play). The full Archive takes another 10–20 h on top. That puts "fully completed" in the **25–40 h range** the game has been missing.
- **No base numbers touched this patch** — the global slowdown already shipped in v0.7.0. v0.8.0 adds content on top of it, not further nerfs.

## [0.7.0] — 2026-04-19

Phase 1 of the v0.7 / v0.8 content roadmap. Five new challenges, five new blueprints, and a global balance pass that pushes the first publish from ~1 h to ~3 h of focused play. Phase 2 (the Exhibition endgame) ships as v0.8.0 after this one settles.

### Added

- **5 new challenges** (total is now 14):
  - **AUSTERE** — all machine costs doubled during the run. Reward: −5 % machine cost, permanent.
  - **GLASSWARE** — every 60 s, you lose 50 % of your most-held resource. Reward: +10 % schematic gain.
  - **OVERCLOCK** — production ×3, consumption ×4. Scale the upstream tiers or starve downstream. Reward: +10 % production, permanent.
  - **ECHO** — after buying a machine, that type is locked for 5 s. Reward: the blueprint pool rolls 4 options per prestige instead of 3.
  - **FAMINE** — all production halved. Reward: +25 % schematic gain.
- **5 new blueprints** (total is now 15):
  - **VANGUARD** (common) — first 3 machines of every type are free.
  - **HARVEST** (common) — start the run with 100 ingots, 20 parts, and 5 circuits.
  - **PARALLEL** (rare) — support effects doubled, support costs ×10.
  - **CRITICAL** (rare) — click crit chance doubled, auto-click halved.
  - **ARCHIVIST** (mythic) — research costs halved, all production ×0.5.
- **`applyDuring(m)` hook on challenges** — mirrors the blueprint pattern, so time-active challenge modifiers (like AUSTERE's ×2 cost or FAMINE's ×0.5 prod) compose through `researchMultipliers()` without scattering inline checks.

### Balance

- **Tier unlock Schematic costs doubled** across the board (6 / 30 / 120 / 500 / 2500). Each later tier now requires several more publishes of mature production rather than being available on run 2–3.
- **Schematic divisor 150 → 250** in `schematicsForPrestige`. About 18 % fewer schematics per run at equal production, so progression asks for more runs to unlock everything.
- **MK-IV research cost 70 → 120** and **MK-V 200 → 400**. Reinforces the v0.6.3 intent that high-tier machines are earned, not auto-unlocked.
- **No machine costs changed.** v0.6.3's slot 1–3 costMul bump is already biting the right way; this pass lengthens the *schematic* curve, not the per-machine curve.

## [0.6.3] — 2026-04-18

Vertical progression balance pass. Early feedback was that players could reach the endgame using only the base (slot 1–3) machines in each tier and never need the MK-IV / MK-V variants the research tree gates behind Power. This pass tightens the base-tier scaling wall so those upgrades become the only efficient next step, *without* making them cheaper — runs shouldn't get shorter, they should get steeper.

### Balance

- **Slots 1–3 costMul +0.02 across T1–T5** — base machines now hit their exponential wall noticeably sooner. The break-even point where the next base machine costs the same as a single MK-IV moves down from ~51 owned to ~43 owned, so the upgrade decision lands naturally while you're still in the tier. MK-IV and MK-V costs are intentionally unchanged — cheaper upgrades would only accelerate runs, which is the opposite of the fix this patch ships.
- **T6 untouched** — the Refinement tier has only three slots and already uses steep costMul values (1.27 / 1.3 / 1.32).
- **Existing saves keep all owned machines** — cost changes only affect the next purchase, so there are no broken states or lost inventory.

## [0.6.2] — 2026-04-18

Hotfix for two issues reported in itch.io comments.

### Fixed

- **Auto-prestige can no longer soft-lock the game into a reset loop.** A late-game build that produces 10+ schematics per tick was triggering a prestige every frame, leaving the player no time to interact. Both auto-prestige and auto-publish now require a minimum run time before firing (30 s for prestige, 60 s for publish). The threshold still gates on top, so short manual runs aren't affected.
- **Research (Schematics) tab no longer disappears after a Publish.** The old visibility check gated on `prestigeCount > 0 || schematics > 0`, both of which reset on publish — so the tab hid itself right after players unlocked it. The lifetime gates `lifetimePrestiges > 0` and `publishCount > 0` keep the tab visible forever once either has happened.

## [0.6.1] — 2026-04-18

First post-launch patch, driven by early itch.io feedback and an internal
polish pass across every view.

### Balance

- **Publish economy rebalanced** — `patentsForPublish` switched from `sqrt(proto) * 2` to `cbrt(proto) * 3`. Cube-root damping stops a single grindy publish from buying every mastery upgrade. Full mastery (~1,707 patents) now takes ~5 publishes instead of 1. A first publish at ~200K prototypes pays ~175 patents instead of ~900 — enough to unlock tier inheritance and a few leveled patents, not the whole library.
- **TALL challenge stays winnable regardless of `fast_start` level.** `fast_start` at level 4 or 5 used to seed the run with more drills than TALL's 3-per-machine cap, making the challenge literally impossible. Starting drill grant is now clamped to 2 during TALL.

### Added

- **One-tap copy-to-clipboard** in the Export Save modal, with inline "COPIED ✓" / "COPY FAILED" status. Falls back to `execCommand` if the modern clipboard API denies, with a "select + copy manually" hint if both paths fail.
- **Last-backup pill** next to Export Save in Settings, with stale / fresh colouring based on time since last export.
- **Backup-suggested toast** after prestige or publish if playtime > 30 min and no export in the last hour. Fires at most once per session.
- **Version footer** (`◆ BLUEPRINT · v0.6.1`) at the bottom of the Settings modal.
- **Drafting-grid background + corner ticks + pip + rule headers** on every view (Factory, Mastery, Stats, Achievements, Sidebar), extending the research-tab schematic look to the whole app.
- **Flow connectors** between tier rows on the factory page — vertical dashed pipes labelled with the flowing material (`↓ ORE`, `↓ INGOT`, etc.).
- **Source block** wraps the mine card with a "◆ SOURCE / MANUAL EXTRACTION" callout, so the page opens like the head of an engineering sheet.
- **Professional README** with banner, screenshots, PWA / accessibility / mobile coverage, and split desktop / touch control tables.
- **itch.io release** with release zip, SVG + PNG cover, page copy, and publish checklist in the gitignored `.itch/` folder.

### Fixed

- **Resources never display as `-0.0` again.** Tiny floating-point slop in the consumption loop was leaving pools at `-1e-13`, which rendered as "-0.0" in the top bar. `state.resources[res]` is now floored at zero after every tick subtraction.
- **Settings modal no longer clips on mobile Safari.** The backdrop now owns the scroll with `align-items: safe center`, so the modal top and footer both stay reachable when iOS browser chrome shrinks the visible viewport.
- **Settings gear sits on the far right in landscape mobile.** The landscape-phone media query was pushing `.tabs` past the default order but not `.topbar-settings`, so the gear was rendering mid-topbar.
- **Tapping the top resource pill no longer flashes a blue line.** Two compounding issues: mobile browsers kept their default focus ring drawn after a touch-tap, and `.res-bar`'s overflow-x scroll indicator flashed during the post-click reflow. Both are now suppressed (`-webkit-tap-highlight-color: transparent`, `:focus:not(:focus-visible) { outline: none }`, scrollbar display `none` on the res-bar).
- **Hover info toast no longer fires during spam-clicks** of unaffordable machines. Per-slot `hoverSuppressed` flag cancels the pending tooltip on click and resets on `mouseleave`, so the tooltip stays useful on clean hovers.
- **Haptic feedback actually actuates now.** Durations under 20 ms were below the Android motor's startup latency, so many events registered in code but weren't felt. `haptic(ms)` now floors scalar durations at 20 ms.
- **Mobile sidebar stays hidden on fresh games.** `.factory-view:not(.has-sidebar) .sidebar` now has `display: none !important` inside the mobile media query so the publish / support boxes don't peek through before they unlock.
- **Patent titles are left-aligned** — the centered `<button>` default plus the absolute-positioned level badge was pushing titles off-centre.

### Changed

- **Achievements page re-grouped** into bordered schematic panels with corner ticks and the same pip + dashed-rule heading pattern as the other views. Green corner-dot decoration retired in favour of full corner ticks.
- **OG image re-centered** so the bottom stat strip no longer clips on the right edge.

## [0.6.0] — 2026-04-17

Initial public release.

### Features

- **6 production tiers** — Ore → Ingot → Part → Circuit → Core → Prototype — with **28 machines** (base + MK-IV + MK-V variants) and **2 support structures** (Power Node, Boost Relay).
- **Radial research tree** with **60+ nodes** across six discipline branches (Speed, Logistics, Yield, Automation, Efficiency, Power) plus the Tier Unlocks rail.
- **Twin prestige layers** — Schematics per-run resets, Patents meta-layer survives every reset.
- **21 patents** in the Mastery library with stacking leveled upgrades.
- **9 challenge modes** with constraint-driven runs and permanent rewards (Pacifist, Blitz, Blackout, Tall, Monoculture, Purist, Ironman, Slow Burn, Chaos).
- **10 blueprints** — random per-run modifiers rolled after every prestige for run-to-run variance.
- **59 achievements** with live progress bars and stacking passive bonuses.
- **Onboarding** via progressive hints, no tutorial wall.
- **Procedural audio** via the Web Audio API — every event has its own voice; no samples.
- **Offline progression** capped at 8 hours (extendable to +16 h via the Tailwind patent).
- **PWA** — installable from the browser on desktop and mobile, offline-capable via a cache-first service worker.
- **Accessibility** — reduce motion (auto / on / off) and an IBM-derived colorblind-safe palette.
- **Touch-first mobile layout** — pinch-zoom and drag the research tree, long-press machines for detail, BUY MODE bar for bulk purchases without modifier keys.
- **Local save** with base64 export/import for backup or cross-device transfer.
- **Stats page** with live production, resource, and schematics/patents charts on a 1-hour rolling window.
