# Changelog

All notable changes to **Blueprint** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
