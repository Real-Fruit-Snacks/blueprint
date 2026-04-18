# Blueprint

> A browser-based incremental factory game. Build, automate, prestige, publish.

**▶ [Play in your browser](https://real-fruit-snacks.github.io/blueprint/)**

Zero-dependency incremental game built in pure HTML, CSS, and JavaScript. No frameworks. No build step. No external assets — every machine icon, research node, UI element, and glyph is drawn from SVG and CSS primitives. Every sound is synthesized at runtime.

---

## Overview

Start with a single Drill mining Ore. Smelt it into Ingots, craft Parts, assemble Circuits, forge Cores, refine Prototypes. Unlock a radial research tree with 45+ nodes. Prestige for **Schematics** that fund permanent upgrades. Push deep enough to unlock a second layer — **Publish** your work for **Patents** that persist across every reset.

## Features

### Production
- **6 tiers** — Ore → Ingot → Part → Circuit → Core → Prototype
- **28 machines** with multi-resource recipes at upgrade tiers
- **Per-tier bottleneck feedback** when inputs run dry
- **Capped offline progression** (8h base, extendable via patents)
- **Support structures** (Power Node, Boost Relay) that scale global output

### Progression
- **Radial research tree** — 45+ nodes across 6 branches with progressive reveal
- **Two-layer prestige loop** — Schematics per-run, Patents meta-layer
- **Patent Library** — 15+ permanent unlocks surviving every reset
- **30+ achievements** with stacking passive bonuses and live progress bars

### Interaction
- **Per-resource manual crafting** — click-to-mine Ore, click-to-smelt Ingots, click-to-craft Parts… each tier consuming prev-tier input with a click-progress counter
- **Per-resource auto-mine toggles** (unlocked via research + the Omnitap patent)
- **Buy modes** — ×1, ×10, ×100, ×1000, MAX — gated by research
- **Procedural audio** via the Web Audio API

### Quality of life
- **Local save** with base64 export/import for backup
- **Settings** panel — volume, number notation (K/M/B vs scientific), hint reset
- **Stats** tab — lifetime totals, prestige/publish history, achievement progress
- **Tips panel** (mutable) for ephemeral guidance

## Controls

| Action | Binding |
| :--- | :--- |
| Buy one machine | Click |
| Buy ×10 | Shift + Click *(requires Bulk Buy)* |
| Buy ×100 | Shift + Alt + Click *(requires Bulk Buy)* |
| Buy ×1000 | Ctrl + Shift + Click *(requires Max Buy)* |
| Toggle auto-buy per machine | Right-click *(requires Auto-Buy)* |
| Pan research tree | Click and drag |
| Zoom research tree | Scroll wheel · or the on-screen ⊕ / ⊖ buttons |

All modifier shortcuts can be replaced with the on-screen buy-mode selector for a pure-click experience.

## Running Locally

Open `index.html` in any modern desktop browser. No install, no build step, no server required.

```bash
git clone https://github.com/Real-Fruit-Snacks/blueprint.git
cd blueprint
# open index.html in your browser
```

## Tech

- **Pure vanilla** HTML / CSS / JavaScript — no frameworks
- **Zero dependencies** — no `package.json`, no `node_modules`
- **Web Audio API** for procedural SFX
- **LocalStorage** for persistence
- **SVG + CSS** for every visual element
- **Single-file deploy** — ships as-is to any static host

## Browser Support

Tested on current Chrome, Firefox, Edge, and Safari. Optimized for desktop — touch input is supported but shift/right-click modifiers and hover-dependent UI limit the mobile experience.

## License

[MIT](LICENSE)
