/* ========== BLUEPRINT · v0.6.0 · Phase 4+5 (Redesign) ==========
   Prestige-driven tree with Schematics currency. Leveled + unlock nodes.
   MK-IV / MK-V machines (10 new). New mechanics: momentum, lossless,
   bulk-buy, auto-buy, auto-click, double-pay.
*/

(() => {
  'use strict';

  // ---------- CONSTANTS ----------
  const SAVE_KEY = 'blueprint.save.v1';
  const SAVE_INTERVAL = 5000;
  const OFFLINE_CAP_MS = 8 * 3600 * 1000;
  const OFFLINE_REPORT_MS = 30_000;
  const VERSION = '0.6.0';
  const LOG_MAX = 20;
  const MOMENTUM_CAP = 0.5;          // +50% max from momentum
  const LOSSLESS_FLOOR = 0.5;        // bottlenecked production floor
  const AUTO_BUY_INTERVAL_MS = 250;  // how often auto-buy attempts per machine

  // Manual click recipes — each click adds `baseMul` progress; when progress >= goal
  // and input is available, 1 unit is produced (and inputCost of prev-tier consumed).
  // Click research (Heavy Hands, Strength, Critical, Double Strike, Transcend) reduces
  // effective clicks-to-completion by boosting baseMul.
  //
  // Tier goals scale ~5×–10× per tier so late-game clicks can't trivialize upper tiers.
  // Machines remain the dominant production path; clicking is a bootstrap / emergency tool.
  const CLICK_RECIPE = {
    ore:       { goal: 1,       inRes: null,      inputCost: 0 },
    ingot:     { goal: 50,      inRes: 'ore',     inputCost: 3 },
    part:      { goal: 250,     inRes: 'ingot',   inputCost: 3 },
    circuit:   { goal: 2000,    inRes: 'part',    inputCost: 3 },
    core:      { goal: 20000,   inRes: 'circuit', inputCost: 3 },
    prototype: { goal: 200000,  inRes: 'core',    inputCost: 3 },
  };

  // ---------- TIERS ----------
  const TIERS = [
    { id: 1, name: 'EXTRACTION',  resource: 'ore'       },
    { id: 2, name: 'SMELTING',    resource: 'ingot'     },
    { id: 3, name: 'FABRICATION', resource: 'part'      },
    { id: 4, name: 'ASSEMBLY',    resource: 'circuit'   },
    { id: 5, name: 'CORE FORGE',  resource: 'core'      },
    { id: 6, name: 'REFINEMENT',  resource: 'prototype' },
  ];

  // Tier unlocks: purchased with Schematics. Permanent across prestige.
  // T6 is intentionally steep — gates the meta-prestige loop.
  const TIER_UNLOCKS = {
    2: { cost: 1,   name: 'T2 · SMELTING' },
    3: { cost: 5,   name: 'T3 · FABRICATION' },
    4: { cost: 20,  name: 'T4 · ASSEMBLY' },
    5: { cost: 80,  name: 'T5 · CORE FORGE' },
    6: { cost: 400, name: 'T6 · REFINEMENT' },
  };

  // ---------- ICONS ----------
  const ICONS = {
    drill:       `<svg viewBox="0 0 32 32"><rect x="6" y="14" width="20" height="14"/><path d="M 10 14 L 16 6 L 22 14"/><line x1="13" y1="22" x2="13" y2="26"/><line x1="19" y1="22" x2="19" y2="26"/></svg>`,
    miner:       `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/></svg>`,
    excavator:   `<svg viewBox="0 0 32 32"><polygon points="16,4 28,10 28,22 16,28 4,22 4,10"/><line x1="10" y1="16" x2="22" y2="16"/></svg>`,
    deep_drill:  `<svg viewBox="0 0 32 32"><rect x="5" y="12" width="22" height="16"/><path d="M 8 12 L 16 4 L 24 12"/><line x1="11" y1="20" x2="11" y2="28"/><line x1="16" y1="20" x2="16" y2="28"/><line x1="21" y1="20" x2="21" y2="28"/></svg>`,
    core_extractor: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2" fill="currentColor" stroke="none"/><line x1="2" y1="16" x2="6" y2="16"/><line x1="26" y1="16" x2="30" y2="16"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="16" y1="26" x2="16" y2="30"/></svg>`,
    furnace:     `<svg viewBox="0 0 32 32"><rect x="8" y="10" width="16" height="16"/><path d="M 12 10 Q 16 4 20 10"/><path d="M 13 22 Q 16 16 19 22"/></svg>`,
    smelter:     `<svg viewBox="0 0 32 32"><polygon points="8,8 24,8 20,26 12,26"/><line x1="12" y1="16" x2="20" y2="16"/></svg>`,
    foundry:     `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><line x1="8" y1="16" x2="24" y2="16"/><line x1="16" y1="8" x2="16" y2="24"/></svg>`,
    crucible:    `<svg viewBox="0 0 32 32"><path d="M 6 8 L 26 8 L 22 28 L 10 28 Z"/><ellipse cx="16" cy="10" rx="10" ry="2"/><line x1="12" y1="20" x2="20" y2="20"/></svg>`,
    arc_forge:   `<svg viewBox="0 0 32 32"><polygon points="6,20 14,4 14,14 22,14 18,28 18,18 10,18"/></svg>`,
    press:       `<svg viewBox="0 0 32 32"><rect x="6" y="12" width="20" height="10"/><circle cx="11" cy="17" r="2.5" fill="currentColor" stroke="none"/><circle cx="21" cy="17" r="2.5" fill="currentColor" stroke="none"/><line x1="6" y1="26" x2="26" y2="26"/></svg>`,
    fabricator:  `<svg viewBox="0 0 32 32"><rect x="6" y="6" width="20" height="20"/><rect x="11" y="11" width="10" height="10" fill="currentColor" stroke="none"/></svg>`,
    lathe:       `<svg viewBox="0 0 32 32"><polygon points="16,6 26,26 6,26"/><line x1="11" y1="20" x2="21" y2="20"/></svg>`,
    mill:        `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="8"/><line x1="16" y1="4" x2="16" y2="10"/><line x1="16" y1="22" x2="16" y2="28"/><line x1="4" y1="16" x2="10" y2="16"/><line x1="22" y1="16" x2="28" y2="16"/><line x1="8" y1="8" x2="12" y2="12"/><line x1="20" y1="20" x2="24" y2="24"/><line x1="24" y1="8" x2="20" y2="12"/><line x1="12" y1="20" x2="8" y2="24"/></svg>`,
    injector:    `<svg viewBox="0 0 32 32"><rect x="12" y="4" width="8" height="18"/><polygon points="10,22 22,22 16,30"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/></svg>`,
    assembler:   `<svg viewBox="0 0 32 32"><rect x="5" y="10" width="22" height="14"/><rect x="10" y="14" width="5" height="6"/><rect x="17" y="14" width="5" height="6"/></svg>`,
    wirer:       `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="9"/><line x1="7" y1="16" x2="25" y2="16"/><line x1="16" y1="7" x2="16" y2="25"/><line x1="10" y1="10" x2="22" y2="22"/></svg>`,
    printer:     `<svg viewBox="0 0 32 32"><rect x="6" y="8" width="20" height="6"/><rect x="6" y="17" width="20" height="6"/><circle cx="10" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="20" r="1" fill="currentColor" stroke="none"/></svg>`,
    modulator:   `<svg viewBox="0 0 32 32"><rect x="6" y="10" width="20" height="12"/><line x1="10" y1="4" x2="10" y2="10"/><line x1="16" y1="4" x2="16" y2="10"/><line x1="22" y1="4" x2="22" y2="10"/><line x1="10" y1="22" x2="10" y2="28"/><line x1="22" y1="22" x2="22" y2="28"/></svg>`,
    quantum_wire:`<svg viewBox="0 0 32 32"><path d="M 4 16 Q 8 8 12 16 T 20 16 T 28 16" fill="none"/><circle cx="4" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="28" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="2.5"/></svg>`,
    forge:       `<svg viewBox="0 0 32 32"><polygon points="16,4 28,16 16,28 4,16"/><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none"/></svg>`,
    compiler:    `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="5"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>`,
    synthesizer: `<svg viewBox="0 0 32 32"><polygon points="16,4 19,13 28,13 21,19 24,28 16,22 8,28 11,19 4,13 13,13"/></svg>`,
    resonator:   `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="3"/><circle cx="16" cy="16" r="7" opacity="0.7"/><circle cx="16" cy="16" r="11" opacity="0.4"/></svg>`,
    star_forge:  `<svg viewBox="0 0 32 32"><polygon points="16,2 18,10 26,6 22,14 30,16 22,18 26,26 18,22 16,30 14,22 6,26 10,18 2,16 10,14 6,6 14,10" stroke-linejoin="round"/></svg>`,
  };

  // ---------- MACHINES ----------
  // slot: position within the 5-wide tier row. mk: base | mk4 | mk5 (gates on tree unlock).
  const MACHINES = {
    // T1 · Extraction
    drill:          { tier: 1, slot: 1, mk: 'base', name: 'DRILL',          produces: { ore: 1 },        consumes: {},                cost: { ore: 10 },          costMul: 1.15, icon: ICONS.drill },
    miner:          { tier: 1, slot: 2, mk: 'base', name: 'MINER',          produces: { ore: 6 },        consumes: {},                cost: { ore: 120 },         costMul: 1.17, icon: ICONS.miner },
    excavator:      { tier: 1, slot: 3, mk: 'base', name: 'EXCAVATOR',      produces: { ore: 40 },       consumes: {},                cost: { ore: 2000 },        costMul: 1.19, icon: ICONS.excavator },
    deep_drill:     { tier: 1, slot: 4, mk: 'mk4',  name: 'DEEP DRILL',     produces: { ore: 200 },      consumes: {},                cost: { ore: 30000 },       costMul: 1.22, icon: ICONS.deep_drill },
    core_extractor: { tier: 1, slot: 5, mk: 'mk5',  name: 'CORE EXTRACTOR', produces: { ore: 1000 },     consumes: {},                cost: { ore: 500000 },      costMul: 1.25, icon: ICONS.core_extractor },

    // T2 · Smelting
    furnace:        { tier: 2, slot: 1, mk: 'base', name: 'FURNACE',        produces: { ingot: 1 },      consumes: { ore: 3 },        cost: { ore: 100 },         costMul: 1.17, icon: ICONS.furnace },
    smelter:        { tier: 2, slot: 2, mk: 'base', name: 'SMELTER',        produces: { ingot: 6 },      consumes: { ore: 18 },       cost: { ore: 1000, ingot: 10 },          costMul: 1.19, icon: ICONS.smelter },
    foundry:        { tier: 2, slot: 3, mk: 'base', name: 'FOUNDRY',        produces: { ingot: 40 },     consumes: { ore: 120 },      cost: { ore: 15000, ingot: 200 },        costMul: 1.21, icon: ICONS.foundry },
    crucible:       { tier: 2, slot: 4, mk: 'mk4',  name: 'CRUCIBLE',       produces: { ingot: 200 },    consumes: { ore: 600 },      cost: { ore: 200000, ingot: 3000 },      costMul: 1.23, icon: ICONS.crucible },
    arc_forge:      { tier: 2, slot: 5, mk: 'mk5',  name: 'ARC FORGE',      produces: { ingot: 1000 },   consumes: { ore: 3000 },     cost: { ore: 3000000, ingot: 50000 },    costMul: 1.25, icon: ICONS.arc_forge },

    // T3 · Fabrication
    press:          { tier: 3, slot: 1, mk: 'base', name: 'PRESS',          produces: { part: 1 },       consumes: { ingot: 3 },      cost: { ingot: 200 },       costMul: 1.18, icon: ICONS.press },
    fabricator:     { tier: 3, slot: 2, mk: 'base', name: 'FABRICATOR',     produces: { part: 6 },       consumes: { ingot: 18 },     cost: { ingot: 2000, part: 20 },         costMul: 1.20, icon: ICONS.fabricator },
    lathe:          { tier: 3, slot: 3, mk: 'base', name: 'LATHE',          produces: { part: 40 },      consumes: { ingot: 120 },    cost: { ingot: 30000, part: 500 },       costMul: 1.22, icon: ICONS.lathe },
    mill:           { tier: 3, slot: 4, mk: 'mk4',  name: 'MILL',           produces: { part: 200 },     consumes: { ingot: 600 },    cost: { ingot: 500000, part: 10000 },    costMul: 1.23, icon: ICONS.mill },
    injector:       { tier: 3, slot: 5, mk: 'mk5',  name: 'INJECTOR',       produces: { part: 1000 },    consumes: { ingot: 3000 },   cost: { ingot: 8000000, part: 150000 },  costMul: 1.25, icon: ICONS.injector },

    // T4 · Assembly
    assembler:      { tier: 4, slot: 1, mk: 'base', name: 'ASSEMBLER',      produces: { circuit: 1 },    consumes: { part: 3 },       cost: { part: 400 },        costMul: 1.19, icon: ICONS.assembler },
    wirer:          { tier: 4, slot: 2, mk: 'base', name: 'WIRER',          produces: { circuit: 6 },    consumes: { part: 18 },      cost: { part: 4000, circuit: 30 },         costMul: 1.21, icon: ICONS.wirer },
    printer:        { tier: 4, slot: 3, mk: 'base', name: 'PRINTER',        produces: { circuit: 40 },   consumes: { part: 120 },     cost: { part: 70000, circuit: 800 },       costMul: 1.23, icon: ICONS.printer },
    modulator:      { tier: 4, slot: 4, mk: 'mk4',  name: 'MODULATOR',      produces: { circuit: 200 },  consumes: { part: 600 },     cost: { part: 1000000, circuit: 15000 },   costMul: 1.24, icon: ICONS.modulator },
    quantum_wire:   { tier: 4, slot: 5, mk: 'mk5',  name: 'QUANTUM WIRE',   produces: { circuit: 1000 }, consumes: { part: 3000 },    cost: { part: 20000000, circuit: 250000 }, costMul: 1.26, icon: ICONS.quantum_wire },

    // T5 · Core Forge
    forge:          { tier: 5, slot: 1, mk: 'base', name: 'FORGE',          produces: { core: 1 },       consumes: { circuit: 3 },    cost: { circuit: 800 },     costMul: 1.20, icon: ICONS.forge },
    compiler:       { tier: 5, slot: 2, mk: 'base', name: 'COMPILER',       produces: { core: 6 },       consumes: { circuit: 18 },   cost: { circuit: 8000, core: 50 },           costMul: 1.22, icon: ICONS.compiler },
    synthesizer:    { tier: 5, slot: 3, mk: 'base', name: 'SYNTHESIZER',    produces: { core: 40 },      consumes: { circuit: 120 },  cost: { circuit: 150000, core: 1200 },       costMul: 1.24, icon: ICONS.synthesizer },
    resonator:      { tier: 5, slot: 4, mk: 'mk4',  name: 'RESONATOR',      produces: { core: 200 },     consumes: { circuit: 600 },  cost: { circuit: 2000000, core: 25000 },     costMul: 1.25, icon: ICONS.resonator },
    star_forge:     { tier: 5, slot: 5, mk: 'mk5',  name: 'STAR FORGE',     produces: { core: 1000 },    consumes: { circuit: 3000 }, cost: { circuit: 35000000, core: 400000 },   costMul: 1.27, icon: ICONS.star_forge },

    // T6 · Refinement (feeds the meta-prestige Publish loop)
    refiner:        { tier: 6, slot: 1, mk: 'base', name: 'REFINER',        produces: { prototype: 0.01 }, consumes: { core: 1 },     cost: { core: 1000000 },   costMul: 1.25, icon: ICONS.compiler },
    compactor:      { tier: 6, slot: 2, mk: 'base', name: 'COMPACTOR',      produces: { prototype: 0.05 }, consumes: { core: 5 },     cost: { core: 10000000 },  costMul: 1.28, icon: ICONS.fabricator },
    prototyper:     { tier: 6, slot: 3, mk: 'base', name: 'PROTOTYPER',     produces: { prototype: 0.2 },  consumes: { core: 20 },    cost: { core: 100000000 }, costMul: 1.30, icon: ICONS.forge },
  };

  // ---------- SUPPORTS ----------
  const SUPPORTS = {
    power: { id: 'power', name: 'POWER NODE',  desc: 'Each unit: <b>+10%</b> global production.',                   cost: { circuit: 50 }, costMul: 1.35, unlockTier: 4, effect: { prodMul: 0.10 } },
    relay: { id: 'relay', name: 'BOOST RELAY', desc: 'Each unit: <b>+15%</b> production, <b>-5%</b> consumption.', cost: { core: 3 },     costMul: 1.5,  unlockTier: 5, effect: { prodMul: 0.15, consMul: -0.05 } },
  };

  // ---------- TREE NODES ----------
  // type: 'leveled' | 'unlock' | 'origin'
  // leveled: costForLevel(nextLevel) → schematics cost to buy that level
  // unlock: cost → one-time schematics cost
  // Progressive reveal: leveled node predecessor needs 50%+ levels; unlock predecessor needs to be owned.
  const TREE_NODES = {
    origin: {
      type: 'origin', name: 'ORIGIN', desc: 'The seed of all research. <b>Free</b> — click to begin.',
      branch: 'origin', pos: { angle: 0, r: 0 }, requires: [],
    },

    // ═══════════════════ SPEED (60°) ═══════════════════
    speed_1:   { type: 'leveled', name: 'SWIFT MECHANISM', desc: '<b>+10% production</b> per level.',
                 branch: 'speed', pos: { angle: 60, r: 1 }, requires: ['origin'],
                 maxLevel: 5, costForLevel: (L) => L * 2,
                 applyEffect: (m, L) => { m.prodMul *= (1 + 0.10 * L); } },
    momentum:  { type: 'unlock',  name: 'MOMENTUM', desc: '<b>+0.5% production per machine owned</b> (capped at +50%).',
                 branch: 'speed', pos: { angle: 60, r: 2 }, requires: ['speed_1'], cost: 15,
                 applyEffect: (m) => { m.momentum += 0.005; } },
    speed_2:   { type: 'leveled', name: 'ACCELERATE', desc: '<b>+15% production</b> per level.',
                 branch: 'speed', pos: { angle: 60, r: 3 }, requires: ['momentum'],
                 maxLevel: 5, costForLevel: (L) => L * 5,
                 applyEffect: (m, L) => { m.prodMul *= (1 + 0.15 * L); } },
    catalyst:  { type: 'leveled', name: 'CATALYST', desc: '<b>+25% production</b> per level.',
                 branch: 'speed', pos: { angle: 60, r: 4 }, requires: ['speed_2'],
                 maxLevel: 3, costForLevel: (L) => L * 12,
                 applyEffect: (m, L) => { m.prodMul *= (1 + 0.25 * L); } },
    speed_3:   { type: 'leveled', name: 'OVERCLOCK', desc: '<b>+30% production</b> per level.',
                 branch: 'speed', pos: { angle: 60, r: 5 }, requires: ['catalyst'],
                 maxLevel: 5, costForLevel: (L) => L * 20,
                 applyEffect: (m, L) => { m.prodMul *= (1 + 0.30 * L); } },
    apex:      { type: 'unlock',  name: 'APEX SPEED', desc: '<b>+100% production</b>. One-time flat boost.',
                 branch: 'speed', pos: { angle: 60, r: 6 }, requires: ['speed_3'], cost: 200,
                 applyEffect: (m) => { m.prodMul *= 2; } },
    infinity:  { type: 'leveled', name: 'INFINITY', desc: '<b>+75% production</b> per level.',
                 branch: 'speed', pos: { angle: 60, r: 7 }, requires: ['apex'],
                 maxLevel: 3, costForLevel: (L) => L * 120,
                 applyEffect: (m, L) => { m.prodMul *= (1 + 0.75 * L); } },
    perpetual_motion: { type: 'unlock', name: 'PERPETUAL MOTION',
                 desc: 'Machines produce at <b>100% rate</b> even when input-starved. Overrides Lossless.',
                 branch: 'speed', pos: { angle: 60, r: 8 }, requires: ['infinity'], cost: 300,
                 applyEffect: (m) => { m.perpetualMotion = true; } },

    // ═══════════════════ LOGISTICS (120°) ═══════════════════
    heavy_hands:  { type: 'leveled', name: 'HEAVY HANDS', desc: '<b>+5 click power</b> per level.',
                    branch: 'logistics', pos: { angle: 120, r: 1 }, requires: ['origin'],
                    maxLevel: 8, costForLevel: (L) => L,
                    applyEffect: (m, L) => { m.clickAdd += 5 * L; } },
    auto_click:   { type: 'unlock',  name: 'AUTO-CLICK', desc: '<b>1 auto-click per second</b>.',
                    branch: 'logistics', pos: { angle: 120, r: 2 }, requires: ['heavy_hands'], cost: 20,
                    applyEffect: (m) => { m.autoClickPerSec += 1; } },
    click_speed:  { type: 'leveled', name: 'RAPID FIRE', desc: '<b>+1 auto-click/sec</b> per level.',
                    branch: 'logistics', pos: { angle: 120, r: 3 }, requires: ['auto_click'],
                    maxLevel: 5, costForLevel: (L) => L * 5,
                    applyEffect: (m, L) => { m.autoClickPerSec += L; } },
    click_power:  { type: 'leveled', name: 'STRENGTH', desc: '<b>+15 click power</b> per level.',
                    branch: 'logistics', pos: { angle: 120, r: 4 }, requires: ['click_speed'],
                    maxLevel: 5, costForLevel: (L) => L * 6,
                    applyEffect: (m, L) => { m.clickAdd += 15 * L; } },
    critical:     { type: 'unlock',  name: 'CRITICAL HIT', desc: '<b>10% chance</b> each click to land a <b>×3 critical</b>.',
                    branch: 'logistics', pos: { angle: 120, r: 5 }, requires: ['click_power'], cost: 60,
                    applyEffect: (m) => { m.critChance = 0.10; m.critMul = 3; } },
    double_click: { type: 'unlock',  name: 'DOUBLE STRIKE', desc: 'Each click counts <b>twice</b>.',
                    branch: 'logistics', pos: { angle: 120, r: 6 }, requires: ['critical'], cost: 150,
                    applyEffect: (m) => { m.clickMul += 1.0; } },
    transcend:    { type: 'leveled', name: 'TRANSCEND', desc: '<b>+75 click power</b> per level.',
                    branch: 'logistics', pos: { angle: 120, r: 7 }, requires: ['double_click'],
                    maxLevel: 3, costForLevel: (L) => L * 80,
                    applyEffect: (m, L) => { m.clickAdd += 75 * L; } },
    crit_cascade: { type: 'unlock', name: 'CRIT CASCADE',
                    desc: 'Critical clicks trigger a <b>3-second ×2 production burst</b>.',
                    branch: 'logistics', pos: { angle: 120, r: 8 }, requires: ['transcend'], cost: 250,
                    applyEffect: (m) => { m.critCascade = true; } },

    // ═══════════════════ YIELD (180°) ═══════════════════
    yield_1:     { type: 'leveled', name: 'ORE WELL', desc: '<b>+3 ore/s passive</b> per level.',
                   branch: 'yield', pos: { angle: 180, r: 1 }, requires: ['origin'],
                   maxLevel: 5, costForLevel: (L) => L * 2,
                   applyEffect: (m, L) => { m.freeRes.ore += 3 * L; } },
    double_pay:  { type: 'unlock',  name: 'DOUBLE PAY', desc: 'Cores count <b>2×</b> for Schematics on prestige.',
                   branch: 'yield', pos: { angle: 180, r: 2 }, requires: ['yield_1'], cost: 40,
                   applyEffect: (m) => { m.doublePay = Math.max(m.doublePay, 2); } },
    yield_2:     { type: 'leveled', name: 'INGOT VEIN', desc: '<b>+1 ingot/s passive</b> per level.',
                   branch: 'yield', pos: { angle: 180, r: 3 }, requires: ['double_pay'],
                   maxLevel: 5, costForLevel: (L) => L * 6,
                   applyEffect: (m, L) => { m.freeRes.ingot += 1 * L; } },
    yield_3:     { type: 'leveled', name: 'PART STREAM', desc: '<b>+0.2 part/s passive</b> per level.',
                   branch: 'yield', pos: { angle: 180, r: 4 }, requires: ['yield_2'],
                   maxLevel: 5, costForLevel: (L) => L * 12,
                   applyEffect: (m, L) => { m.freeRes.part += 0.2 * L; } },
    triple_pay:  { type: 'unlock',  name: 'TRIPLE PAY', desc: 'Cores count <b>3×</b> for Schematics.',
                   branch: 'yield', pos: { angle: 180, r: 5 }, requires: ['yield_3'], cost: 100,
                   applyEffect: (m) => { m.doublePay = Math.max(m.doublePay, 3); } },
    yield_4:     { type: 'leveled', name: 'CIRCUIT FLOW', desc: '<b>+0.05 circuit/s passive</b> per level.',
                   branch: 'yield', pos: { angle: 180, r: 6 }, requires: ['triple_pay'],
                   maxLevel: 3, costForLevel: (L) => L * 30,
                   applyEffect: (m, L) => { m.freeRes.circuit += 0.05 * L; } },
    abundance:   { type: 'unlock',  name: 'ABUNDANCE', desc: '<b>Doubles</b> all Yield passive effects.',
                   branch: 'yield', pos: { angle: 180, r: 7 }, requires: ['yield_4'], cost: 300,
                   applyEffect: (m) => { for (const r in m.freeRes) m.freeRes[r] *= 2; } },
    golden_tick: { type: 'unlock',  name: 'GOLDEN TICK',
                   desc: 'Every <b>60 seconds</b>, a random tier surges <b>×10 production for 5 seconds</b>.',
                   branch: 'yield', pos: { angle: 180, r: 8 }, requires: ['abundance'], cost: 350,
                   applyEffect: (m) => { m.goldenTick = true; } },

    // ═══════════════════ AUTOMATION (240°) ═══════════════════
    auto_1:   { type: 'leveled', name: 'CHEAP PARTS', desc: '<b>-7% machine cost</b> per level.',
                branch: 'automation', pos: { angle: 240, r: 1 }, requires: ['origin'],
                maxLevel: 5, costForLevel: (L) => L * 2,
                applyEffect: (m, L) => { m.costMul *= Math.pow(0.93, L); } },
    bulk_buy: { type: 'unlock',  name: 'BULK BUY', desc: '<b>×10</b> / <b>×100</b> buy modes.',
                branch: 'automation', pos: { angle: 240, r: 2 }, requires: ['auto_1'], cost: 15,
                applyEffect: (m) => { m.bulkBuy = true; } },
    auto_2:   { type: 'leveled', name: 'STREAMLINE', desc: '<b>-5% machine cost</b> per level.',
                branch: 'automation', pos: { angle: 240, r: 3 }, requires: ['bulk_buy'],
                maxLevel: 5, costForLevel: (L) => L * 5,
                applyEffect: (m, L) => { m.costMul *= Math.pow(0.95, L); } },
    auto_buy: { type: 'unlock',  name: 'AUTO-BUY', desc: '<b>Right-click</b> a machine to toggle auto-purchase.',
                branch: 'automation', pos: { angle: 240, r: 4 }, requires: ['auto_2'], cost: 60,
                applyEffect: (m) => { m.autoBuy = true; } },
    auto_3:   { type: 'leveled', name: 'MASS PRODUCTION', desc: '<b>-5% machine cost</b> per level.',
                branch: 'automation', pos: { angle: 240, r: 5 }, requires: ['auto_buy'],
                maxLevel: 5, costForLevel: (L) => L * 10,
                applyEffect: (m, L) => { m.costMul *= Math.pow(0.95, L); } },
    max_buy:  { type: 'unlock',  name: 'MAX BUY', desc: 'Unlock <b>×1000</b> and <b>MAX</b> buy modes.',
                branch: 'automation', pos: { angle: 240, r: 6 }, requires: ['auto_3'], cost: 120,
                applyEffect: (m) => { m.maxBuy = true; } },
    miniaturization: { type: 'leveled', name: 'MINIATURIZATION', desc: '<b>-8% machine cost</b> per level.',
                       branch: 'automation', pos: { angle: 240, r: 7 }, requires: ['max_buy'],
                       maxLevel: 3, costForLevel: (L) => L * 60,
                       applyEffect: (m, L) => { m.costMul *= Math.pow(0.92, L); } },
    blueprint_memory: { type: 'unlock', name: 'BLUEPRINT MEMORY',
                        desc: 'On prestige, rebuild machines to <b>80% of last run</b> for free. Skips the grind.',
                        branch: 'automation', pos: { angle: 240, r: 8 }, requires: ['miniaturization'], cost: 200,
                        applyEffect: (m) => { m.blueprintMemory = true; } },

    // ═══════════════════ EFFICIENCY (300°) ═══════════════════
    eff_1:       { type: 'leveled', name: 'FRUGAL DESIGN', desc: '<b>-5% consumption</b> per level.',
                   branch: 'efficiency', pos: { angle: 300, r: 1 }, requires: ['origin'],
                   maxLevel: 5, costForLevel: (L) => L,
                   applyEffect: (m, L) => { m.consMul *= Math.pow(0.95, L); } },
    lossless:    { type: 'unlock',  name: 'LOSSLESS', desc: 'Bottlenecked machines still produce at <b>50% rate</b>.',
                   branch: 'efficiency', pos: { angle: 300, r: 2 }, requires: ['eff_1'], cost: 25,
                   applyEffect: (m) => { m.lossless = true; } },
    eff_2:       { type: 'leveled', name: 'TIGHT FLOW', desc: '<b>-4% consumption</b> per level.',
                   branch: 'efficiency', pos: { angle: 300, r: 3 }, requires: ['lossless'],
                   maxLevel: 5, costForLevel: (L) => L * 4,
                   applyEffect: (m, L) => { m.consMul *= Math.pow(0.96, L); } },
    recycling:   { type: 'leveled', name: 'RECYCLING', desc: '<b>-4% consumption</b> per level.',
                   branch: 'efficiency', pos: { angle: 300, r: 4 }, requires: ['eff_2'],
                   maxLevel: 3, costForLevel: (L) => L * 12,
                   applyEffect: (m, L) => { m.consMul *= Math.pow(0.96, L); } },
    eff_3:       { type: 'leveled', name: 'COMPRESSION', desc: '<b>-5% consumption</b> per level.',
                   branch: 'efficiency', pos: { angle: 300, r: 5 }, requires: ['recycling'],
                   maxLevel: 3, costForLevel: (L) => L * 25,
                   applyEffect: (m, L) => { m.consMul *= Math.pow(0.95, L); } },
    zero_waste:  { type: 'unlock',  name: 'ZERO WASTE', desc: '<b>-25% consumption</b>. One-time flat.',
                   branch: 'efficiency', pos: { angle: 300, r: 6 }, requires: ['eff_3'], cost: 150,
                   applyEffect: (m) => { m.consMul *= 0.75; } },
    perfection:  { type: 'leveled', name: 'PERFECTION', desc: '<b>-6% consumption</b> per level.',
                   branch: 'efficiency', pos: { angle: 300, r: 7 }, requires: ['zero_waste'],
                   maxLevel: 3, costForLevel: (L) => L * 80,
                   applyEffect: (m, L) => { m.consMul *= Math.pow(0.94, L); } },
    chain_reaction: { type: 'unlock', name: 'CHAIN REACTION',
                      desc: 'When all 5 tiers are actively producing, <b>+30% global production</b>.',
                      branch: 'efficiency', pos: { angle: 300, r: 8 }, requires: ['perfection'], cost: 300,
                      applyEffect: (m) => { m.chainReaction = true; } },

    // ═══════════════════ POWER (0°) ═══════════════════
    mk4:          { type: 'unlock',  name: 'MK-IV MACHINES', desc: 'Unlock the <b>4th machine</b> in each tier (5 new).',
                    branch: 'power', pos: { angle: 0, r: 1 }, requires: ['origin'], cost: 30,
                    applyEffect: () => {} },
    overdrive_1:  { type: 'leveled', name: 'OVERDRIVE I', desc: '<b>+20% support effect</b> per level.',
                    branch: 'power', pos: { angle: 0, r: 2 }, requires: ['mk4'],
                    maxLevel: 5, costForLevel: (L) => L * 5,
                    applyEffect: (m, L) => { m.powerBoost *= (1 + 0.20 * L); } },
    mk5:          { type: 'unlock',  name: 'MK-V MACHINES', desc: 'Unlock the <b>5th machine</b> in each tier (5 more).',
                    branch: 'power', pos: { angle: 0, r: 3 }, requires: ['overdrive_1'], cost: 80,
                    applyEffect: () => {} },
    overdrive_2:  { type: 'leveled', name: 'OVERDRIVE II', desc: '<b>+20% support effect</b> per level.',
                    branch: 'power', pos: { angle: 0, r: 4 }, requires: ['mk5'],
                    maxLevel: 5, costForLevel: (L) => L * 12,
                    applyEffect: (m, L) => { m.powerBoost *= (1 + 0.20 * L); } },
    power_surge:  { type: 'leveled', name: 'POWER SURGE', desc: '<b>-8% support cost</b> per level.',
                    branch: 'power', pos: { angle: 0, r: 5 }, requires: ['overdrive_2'],
                    maxLevel: 5, costForLevel: (L) => L * 8,
                    applyEffect: (m, L) => { m.supportCostMul *= Math.pow(0.92, L); } },
    power_cell:   { type: 'leveled', name: 'POWER CELL', desc: '<b>+30% support effect</b> per level.',
                    branch: 'power', pos: { angle: 0, r: 6 }, requires: ['power_surge'],
                    maxLevel: 3, costForLevel: (L) => L * 40,
                    applyEffect: (m, L) => { m.powerBoost *= (1 + 0.30 * L); } },
    unity:        { type: 'unlock',  name: 'UNITY', desc: 'Support effects <b>doubled</b>.',
                    branch: 'power', pos: { angle: 0, r: 7 }, requires: ['power_cell'], cost: 400,
                    applyEffect: (m) => { m.powerBoost *= 2; } },
    symbiosis:    { type: 'unlock',  name: 'SYMBIOSIS',
                    desc: '<b>+3% production</b> per unique machine type you own (rewards diverse builds).',
                    branch: 'power', pos: { angle: 0, r: 8 }, requires: ['unity'], cost: 300,
                    applyEffect: (m) => { m.symbiosis = 0.03; } },
  };

  // ---------- PATENTS (meta-prestige library) ----------
  // Earned by Publishing. Persist through prestige and publish.
  // Startup effects applied on prestige/publish reset via applyStartupBonuses().
  const PATENTS = {
    draft_inheritance: {
      type: 'unlock', name: 'DRAFT INHERITANCE',
      desc: 'Start every run with <b>T2 · Smelting</b> already unlocked.',
      cost: 1, requires: [], applyEffect: () => {},
    },
    fast_start: {
      type: 'leveled', name: 'FAST START',
      desc: 'Start every run with <b>+1 free Drill</b> per level.',
      maxLevel: 5, costForLevel: (L) => L * 2, requires: [], applyEffect: () => {},
    },
    worldwide_fame: {
      type: 'leveled', name: 'WORLDWIDE FAME',
      desc: '<b>+20% Schematic gain</b> per level on every prestige.',
      maxLevel: 5, costForLevel: (L) => L * 5, requires: [],
      applyEffect: (m, L) => { m.schematicMul *= (1 + 0.20 * L); },
    },
    legacy_wealth: {
      type: 'unlock', name: 'LEGACY WEALTH',
      desc: 'Start every run with <b>10K ore</b> banked.',
      cost: 5, requires: [], applyEffect: () => {},
    },
    schematic_inheritance: {
      type: 'unlock', name: 'SCHEMATIC INHERITANCE',
      desc: 'Start every run with <b>T3 · Fabrication</b> unlocked.',
      cost: 3, requires: ['draft_inheritance'], applyEffect: () => {},
    },
    tailwind: {
      type: 'leveled', name: 'TAILWIND',
      desc: '<b>+4h offline cap</b> per level (max +16h on top of 8h).',
      maxLevel: 4, costForLevel: (L) => L * 5, requires: [],
      applyEffect: (m, L) => { m.offlineHoursAdd += 4 * L; },
    },
    institutional_backing: {
      type: 'unlock', name: 'INSTITUTIONAL BACKING',
      desc: 'Start every run with <b>T4 · Assembly</b> unlocked.',
      cost: 8, requires: ['schematic_inheritance'], applyEffect: () => {},
    },
    tenure: {
      type: 'leveled', name: 'TENURE',
      desc: '<b>+20% permanent production</b> per level. Stacks with research.',
      maxLevel: 5, costForLevel: (L) => L * 6, requires: [],
      applyEffect: (m, L) => { m.prodMul *= (1 + 0.20 * L); },
    },
    mass_production: {
      type: 'leveled', name: 'MASS PRODUCTION',
      desc: '<b>-7% machine cost</b> per level.',
      maxLevel: 5, costForLevel: (L) => L * 5, requires: [],
      applyEffect: (m, L) => { m.costMul *= Math.pow(0.93, L); },
    },
    industrial_empire: {
      type: 'unlock', name: 'INDUSTRIAL EMPIRE',
      desc: 'Start every run with <b>T5 · Core Forge</b> unlocked.',
      cost: 20, requires: ['institutional_backing'], applyEffect: () => {},
    },
    archive: {
      type: 'unlock', name: 'ARCHIVE',
      desc: 'All tier unlock costs <b>halved</b>.',
      cost: 30, requires: ['institutional_backing'],
      applyEffect: (m) => { m.tierUnlockMul *= 0.5; },
    },
    prototype_engine: {
      type: 'leveled', name: 'PROTOTYPE ENGINE',
      desc: '<b>+50% Prototype production</b> per level.',
      maxLevel: 3, costForLevel: (L) => L * 15, requires: ['tenure'],
      applyEffect: (m, L) => { m.prototypeMul *= (1 + 0.50 * L); },
    },
    academia: {
      type: 'unlock', name: 'ACADEMIA',
      desc: 'Reveal the <b>entire Research tree</b> from the start of each run.',
      cost: 25, requires: ['tenure'], applyEffect: () => {},
    },
    dynasty: {
      type: 'leveled', name: 'DYNASTY',
      desc: '<b>+50% Schematic gain</b> per level (stacks with Worldwide Fame).',
      maxLevel: 3, costForLevel: (L) => L * 25, requires: ['worldwide_fame'],
      applyEffect: (m, L) => { m.schematicMul *= (1 + 0.50 * L); },
    },
    nobel_prize: {
      type: 'unlock', name: 'NOBEL PRIZE',
      desc: '<b>Double</b> Prototype production. Accelerates every future Publish.',
      cost: 50, requires: ['prototype_engine'],
      applyEffect: (m) => { m.prototypeMul *= 2; },
    },
    prestige_streak: {
      type: 'unlock', name: 'PRESTIGE STREAK',
      desc: 'Prestige within <b>3 minutes</b> of your last = <b>+20% Schematics</b>.',
      cost: 15, requires: [], applyEffect: () => {},
    },
    rising_tide: {
      type: 'unlock', name: 'RISING TIDE',
      desc: 'Each Tier unlocked beyond T1 gives <b>+5% production</b> to every lower Tier.',
      cost: 25, requires: [], applyEffect: () => {},
    },
    recursive: {
      type: 'unlock', name: 'RECURSIVE',
      desc: 'On Publish, earn <b>+1 Patent per 20 research levels</b> owned.',
      cost: 40, requires: ['worldwide_fame'], applyEffect: () => {},
    },
    auto_prestige_pat: {
      type: 'unlock', name: 'AUTO-PRESTIGE',
      desc: 'Toggle in Mastery. Game auto-prestiges at a Schematics threshold you set.',
      cost: 80, requires: ['tenure'], applyEffect: (m) => { m.autoPrestige = true; },
    },
    auto_publish_pat: {
      type: 'unlock', name: 'AUTO-PUBLISH',
      desc: 'Toggle in Mastery. Game auto-publishes at a Prototype threshold you set.',
      cost: 150, requires: ['auto_prestige_pat'], applyEffect: (m) => { m.autoPublish = true; },
    },
    omnitap: {
      type: 'unlock', name: 'OMNITAP',
      desc: 'Auto-click fires on <b>every unlocked resource</b>, not just Ore.',
      cost: 60, requires: [], applyEffect: (m) => { m.omnitap = true; },
    },
  };

  // ---------- ACHIEVEMENTS ----------
  // One-time milestones. Persist across prestige & publish. Each grants a small
  // permanent bonus scaled to the game stage at which it's earned.
  //
  // bonus keys: prodMul, consMul, costMul, clickAdd, schematicMul, prototypeMul (all additive-stacked)
  const ACHIEVEMENT_BONUSES = {
    // Progress (early-game, small nudges)
    first_machine:   { clickAdd: 1,          label: '+1 click power' },
    first_t2:        { prodMul: 0.02,        label: '+2% production' },
    first_t3:        { consMul: -0.02,       label: '-2% consumption' },
    first_t4:        { costMul: -0.02,       label: '-2% machine cost' },
    first_t5:        { prodMul: 0.05,        label: '+5% production' },
    first_t6:        { prototypeMul: 0.10,   label: '+10% prototype production' },
    first_core:      { prodMul: 0.03,        label: '+3% production' },
    first_proto:     { prototypeMul: 0.05,   label: '+5% prototype production' },

    // Meta (prestige / publish)
    first_prestige:  { schematicMul: 0.05,   label: '+5% schematics gain' },
    first_publish:   { prototypeMul: 0.10,   label: '+10% prototype production' },
    prestige_10:     { schematicMul: 0.05,   label: '+5% schematics gain' },
    prestige_50:     { schematicMul: 0.10,   label: '+10% schematics gain' },
    publish_5:       { prototypeMul: 0.10,   label: '+10% prototype production' },
    publish_25:      { prototypeMul: 0.20,   label: '+20% prototype production' },
    schematics_100:  { schematicMul: 0.05,   label: '+5% schematics gain' },
    schematics_1000: { schematicMul: 0.10,   label: '+10% schematics gain' },
    patents_10:      { prodMul: 0.05,        label: '+5% production' },
    patents_100:     { prodMul: 0.15,        label: '+15% production' },

    // Scale (numbers milestones)
    machines_10:     { costMul: -0.02,       label: '-2% machine cost' },
    machines_100:    { costMul: -0.03,       label: '-3% machine cost' },
    machines_1000:   { costMul: -0.05,       label: '-5% machine cost' },
    ore_million:     { prodMul: 0.03,        label: '+3% production' },
    ore_billion:     { prodMul: 0.10,        label: '+10% production' },
    clicks_100:      { clickAdd: 5,          label: '+5 click power' },
    clicks_1000:     { clickAdd: 25,         label: '+25 click power' },

    // Special (late game)
    mk4:             { prodMul: 0.03,        label: '+3% production' },
    mk5:             { prodMul: 0.05,        label: '+5% production' },
    golden_witness:  { prodMul: 0.05,        label: '+5% production' },
    all_tiers:       { prodMul: 0.10,        label: '+10% production' },
    scholar:         { costMul: -0.10,       label: '-10% machine cost' },
    origin:          { clickAdd: 2,          label: '+2 click power' },

    // Manual clicking (per-resource bootstrap)
    click_ingot:     { clickAdd: 2,          label: '+2 click power' },
    click_part:      { clickAdd: 5,          label: '+5 click power' },
    click_circuit:   { clickAdd: 15,         label: '+15 click power' },
    click_core:      { clickAdd: 50,         label: '+50 click power' },
  };

  const ACHIEVEMENTS = {
    first_machine:    { name: 'FIRST STEPS',       desc: 'Build your first machine.',               group: 'progress' },
    first_t2:         { name: 'SMELTER',           desc: 'Unlock T2 · Smelting.',                    group: 'progress' },
    first_t3:         { name: 'FABRICATOR',        desc: 'Unlock T3 · Fabrication.',                 group: 'progress' },
    first_t4:         { name: 'ASSEMBLY LINE',     desc: 'Unlock T4 · Assembly.',                    group: 'progress' },
    first_t5:         { name: 'CORE WORKER',       desc: 'Unlock T5 · Core Forge.',                  group: 'progress' },
    first_t6:         { name: 'REFINER',           desc: 'Unlock T6 · Refinement.',                  group: 'progress' },
    first_core:       { name: 'THE FIRST CORE',    desc: 'Produce your first Core.',                 group: 'progress' },
    first_proto:      { name: 'PROTOTYPED',        desc: 'Produce your first Prototype.',            group: 'progress' },

    first_prestige:   { name: 'EARLY ADOPTER',     desc: 'Complete your first Prestige.',            group: 'meta' },
    first_publish:    { name: 'PUBLISHED',         desc: 'Complete your first Publish.',             group: 'meta' },
    prestige_10:      { name: 'EXPERIENCED',       desc: 'Complete 10 prestiges (lifetime).',        group: 'meta' },
    prestige_50:      { name: 'VETERAN',           desc: 'Complete 50 prestiges (lifetime).',        group: 'meta' },
    publish_5:        { name: 'WELL-PUBLISHED',    desc: 'Complete 5 Publishes.',                    group: 'meta' },
    publish_25:       { name: 'CITED WORKS',       desc: 'Complete 25 Publishes.',                   group: 'meta' },
    schematics_100:   { name: 'SCHEMATIST',        desc: 'Earn 100 lifetime Schematics.',            group: 'meta' },
    schematics_1000:  { name: 'IP LAWYER',         desc: 'Earn 1,000 lifetime Schematics.',          group: 'meta' },
    patents_10:       { name: 'PATENT HOLDER',     desc: 'Earn 10 lifetime Patents.',                group: 'meta' },
    patents_100:      { name: 'PATENT MOGUL',      desc: 'Earn 100 lifetime Patents.',               group: 'meta' },

    machines_10:      { name: 'GROWING',           desc: 'Own 10 machines.',                          group: 'scale' },
    machines_100:     { name: 'FACTORY FLOOR',     desc: 'Own 100 machines.',                         group: 'scale' },
    machines_1000:    { name: 'INDUSTRY LEADER',   desc: 'Own 1,000 machines.',                       group: 'scale' },
    ore_million:      { name: 'MILLIONAIRE',       desc: 'Produce 1M Ore (lifetime).',                group: 'scale' },
    ore_billion:      { name: 'BILLIONAIRE',       desc: 'Produce 1B Ore (lifetime).',                group: 'scale' },
    clicks_100:       { name: 'CLICKER',           desc: 'Mine 100 times.',                           group: 'scale' },
    clicks_1000:      { name: 'RSI',               desc: 'Mine 1,000 times.',                         group: 'scale' },

    mk4:              { name: 'MK-IV CERTIFIED',   desc: 'Unlock MK-IV Machines research.',          group: 'special' },
    mk5:              { name: 'MK-V CERTIFIED',    desc: 'Unlock MK-V Machines research.',           group: 'special' },
    golden_witness:   { name: 'GOLDEN AGE',        desc: 'Witness the Golden Tick in action.',        group: 'special' },
    all_tiers:        { name: 'TYCOON',            desc: 'Have T1-T6 all unlocked.',                  group: 'special' },
    scholar:          { name: 'SCHOLAR',           desc: 'Purchase 30 research nodes.',               group: 'special' },
    origin:           { name: 'THE ORIGIN',        desc: 'Purchase the Origin node.',                 group: 'special' },

    // Clicking milestones
    click_ingot:      { name: 'CRAFTSMAN',         desc: 'Click-earn 10 Ingot.',                      group: 'scale' },
    click_part:       { name: 'ARTISAN',           desc: 'Click-earn 10 Part.',                       group: 'scale' },
    click_circuit:    { name: 'SPECIALIST',        desc: 'Click-earn 10 Circuit.',                    group: 'scale' },
    click_core:       { name: 'MAESTRO',           desc: 'Click-earn 10 Core.',                       group: 'scale' },
  };

  // Returns { current, goal } for any achievement so progress bars can render.
  function achieveProgress(id) {
    const m = state.meta;
    const s = state;
    const totalMachines = () => { let c = 0; for (const k in s.machines) c += s.machines[k]||0; return c; };
    const researchOwned = () => { let c = 0; for (const k in s.research.levels) if (k !== 'origin') c += s.research.levels[k] > 0 ? 1 : 0; return c; };
    switch (id) {
      case 'first_machine':   return { current: totalMachines(), goal: 1 };
      case 'first_t2':        return { current: s.research.tiersUnlocked[2] ? 1 : 0, goal: 1 };
      case 'first_t3':        return { current: s.research.tiersUnlocked[3] ? 1 : 0, goal: 1 };
      case 'first_t4':        return { current: s.research.tiersUnlocked[4] ? 1 : 0, goal: 1 };
      case 'first_t5':        return { current: s.research.tiersUnlocked[5] ? 1 : 0, goal: 1 };
      case 'first_t6':        return { current: s.research.tiersUnlocked[6] ? 1 : 0, goal: 1 };
      case 'first_core':      return { current: (m.lifetimeProduced && m.lifetimeProduced.core)      || 0, goal: 1 };
      case 'first_proto':     return { current: (m.lifetimeProduced && m.lifetimeProduced.prototype) || 0, goal: 1 };
      case 'first_prestige':  return { current: (m.lifetimePrestiges || m.prestigeCount || 0),          goal: 1 };
      case 'first_publish':   return { current: (m.publishCount || 0),                                  goal: 1 };
      case 'prestige_10':     return { current: (m.lifetimePrestiges || 0),                             goal: 10 };
      case 'prestige_50':     return { current: (m.lifetimePrestiges || 0),                             goal: 50 };
      case 'publish_5':       return { current: (m.publishCount || 0),                                  goal: 5 };
      case 'publish_25':      return { current: (m.publishCount || 0),                                  goal: 25 };
      case 'schematics_100':  return { current: (m.lifetimeSchematics || 0),                            goal: 100 };
      case 'schematics_1000': return { current: (m.lifetimeSchematics || 0),                            goal: 1000 };
      case 'patents_10':      return { current: (m.totalPatents || 0),                                  goal: 10 };
      case 'patents_100':     return { current: (m.totalPatents || 0),                                  goal: 100 };
      case 'machines_10':     return { current: totalMachines(),                                        goal: 10 };
      case 'machines_100':    return { current: totalMachines(),                                        goal: 100 };
      case 'machines_1000':   return { current: totalMachines(),                                        goal: 1000 };
      case 'ore_million':     return { current: (m.lifetimeProduced && m.lifetimeProduced.ore) || 0,    goal: 1e6 };
      case 'ore_billion':     return { current: (m.lifetimeProduced && m.lifetimeProduced.ore) || 0,    goal: 1e9 };
      case 'clicks_100':      return { current: (m.totalClicks || 0),                                   goal: 100 };
      case 'clicks_1000':     return { current: (m.totalClicks || 0),                                   goal: 1000 };
      case 'mk4':             return { current: nodeLevel('mk4') >= 1 ? 1 : 0,                          goal: 1 };
      case 'mk5':             return { current: nodeLevel('mk5') >= 1 ? 1 : 0,                          goal: 1 };
      case 'golden_witness':  return { current: (m.goldenTicksSeen || 0),                               goal: 1 };
      case 'all_tiers':       return { current: [2,3,4,5,6].filter(t => s.research.tiersUnlocked[t]).length, goal: 5 };
      case 'scholar':         return { current: researchOwned(),                                        goal: 30 };
      case 'origin':          return { current: nodeLevel('origin') >= 1 ? 1 : 0,                       goal: 1 };
      case 'click_ingot':     return { current: (m.clicksByRes && m.clicksByRes.ingot)   || 0,          goal: 10 };
      case 'click_part':      return { current: (m.clicksByRes && m.clicksByRes.part)    || 0,          goal: 10 };
      case 'click_circuit':   return { current: (m.clicksByRes && m.clicksByRes.circuit) || 0,          goal: 10 };
      case 'click_core':      return { current: (m.clicksByRes && m.clicksByRes.core)    || 0,          goal: 10 };
    }
    return { current: 0, goal: 1 };
  }
  function achieveCheck(id) {
    const p = achieveProgress(id);
    return p.current >= p.goal;
  }

  let lastAchCheck = 0;
  function checkAchievements(force) {
    const now = Date.now();
    if (!force && now - lastAchCheck < 1000) return;
    lastAchCheck = now;
    if (!state.meta.achievements) state.meta.achievements = {};
    if (!state.meta.newAchievements) state.meta.newAchievements = {};
    let anyNew = false;
    for (const id in ACHIEVEMENTS) {
      if (state.meta.achievements[id]) continue;
      if (achieveCheck(id)) {
        state.meta.achievements[id] = now;
        state.meta.newAchievements[id] = true;
        anyNew = true;
      }
    }
    if (anyNew) {
      invalidateRM();    // bonuses apply immediately
      audio.unlock();    // subtle audio cue
      prevAchSig = '';   // force achievements panel to re-render
    }
  }
  function dismissAchievement(id) {
    if (state.meta.newAchievements && state.meta.newAchievements[id]) {
      delete state.meta.newAchievements[id];
    }
  }
  function dismissAllAchievements() {
    state.meta.newAchievements = {};
  }
  function hasNewAchievements() {
    const n = state.meta.newAchievements;
    if (!n) return 0;
    return Object.keys(n).length;
  }

  const BRANCH_GLYPHS = {
    origin:     '<polygon class="glyph" points="-6,0 0,-6 6,0 0,6"/>',
    speed:      '<polygon class="glyph" points="-5,3 5,3 0,-5"/>',
    logistics:  '<polygon class="glyph" points="-5,-3 -5,3 5,0"/>',
    yield:      '<circle class="glyph" cx="0" cy="0" r="3.5"/>',
    automation: '<rect class="glyph" x="-4" y="-4" width="8" height="8"/>',
    efficiency: '<polygon class="glyph" points="-5,0 0,-5 5,0 0,5"/>',
    power:      '<polygon class="glyph" points="-2,-6 2,-6 -1,0 3,0 -2,6 1,1 -3,1"/>',
  };

  // ---------- STATE ----------
  function emptyResources() { return { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 }; }
  function emptyMachines()  { return Object.fromEntries(Object.keys(MACHINES).map(k => [k, 0])); }
  function emptySupports()  { return Object.fromEntries(Object.keys(SUPPORTS).map(k => [k, 0])); }
  function freshResearch()  { return { levels: { origin: 0 }, tiersUnlocked: { 2: false, 3: false, 4: false, 5: false, 6: false }, patentLevels: {} }; }

  function freshState() {
    return {
      version: VERSION,
      resources: emptyResources(),
      machines: emptyMachines(),
      supports: emptySupports(),
      research: freshResearch(),
      settings: {
        autoBuy: {},
        volume: 0.5,
        muted: false,
        notation: 'si',      // 'si' = K/M/B, 'sci' = scientific
        hintsShown: {},
        buyMode: '1',        // '1' | '10' | '100' | '1000' | 'max'
        autoPrestige: { enabled: false, threshold: 10 },
        autoPublish:  { enabled: false, threshold: 10 },
        tipsMuted: false,
        achievementsExpanded: false,
        autoMine: { ore: true, ingot: false, part: false, circuit: false, core: false, prototype: false },
        haptics: true,
      },
      meta: {
        schematics: 0,
        totalSchematics: 0,
        prestigeCount: 0,
        firstPlay: Date.now(),
        totalPlaytimeMs: 0,
        totalClicks: 0,
        totalProduced: emptyResources(),
        lifetimeProduced: emptyResources(),
        currentRunCores: 0,
        currentRunStartAt: Date.now(),
        currentTab: 'factory',
        patents: 0,
        totalPatents: 0,
        publishCount: 0,
        lifetimePrestiges: 0,
        lifetimeSchematics: 0,
        lastPrestigeAt: 0,
        achievements: {},
        newAchievements: {},
        goldenTicksSeen: 0,
        clickProgress: { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 },
      },
      log: [],
      lastSaveAt: Date.now(),
      lastTickAt: Date.now(),
    };
  }

  let state = freshState();
  let sessionStartAt = Date.now();

  const runtime = {
    machineRatio: {}, bottleneck: {}, tierRate: {},
    totalProdPerSec: 0,
    prodRate: { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 },
    consRate: { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 },
    rm: null,
    autoBuyAccum: 0,
  };

  // ---------- AUDIO ----------
  // Procedural Web Audio — no external files. Every tone synthesized on demand.
  const audio = (() => {
    let ctx = null, master = null;
    function init() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = (state.settings && state.settings.volume != null) ? state.settings.volume : 0.5;
      master.connect(ctx.destination);
      return true;
    }
    function setVolume(v) {
      if (master) master.gain.setValueAtTime(v, ctx.currentTime);
    }
    function silent() {
      return state.settings && (state.settings.muted || (state.settings.volume || 0) <= 0);
    }
    function tone(freq, dur, opts = {}) {
      if (silent()) return;
      if (!init()) return;
      const type = opts.type || 'sine';
      const vol = opts.vol != null ? opts.vol : 0.2;
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(master);
      o.start(now); o.stop(now + dur + 0.05);
    }
    function sweep(f1, f2, dur, opts = {}) {
      if (silent()) return;
      if (!init()) return;
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = opts.type || 'sine';
      o.frequency.setValueAtTime(f1, now);
      o.frequency.exponentialRampToValueAtTime(f2, now + dur);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(opts.vol || 0.25, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(master);
      o.start(now); o.stop(now + dur + 0.05);
    }
    return {
      init, setVolume,
      click:    () => tone(600, 0.04, { type: 'square', vol: 0.1 }),
      buy:      () => { tone(440, 0.06); setTimeout(() => tone(660, 0.08), 40); },
      unlock:   () => { tone(392, 0.07); setTimeout(() => tone(523, 0.07), 70); setTimeout(() => tone(659, 0.15), 140); },
      research: () => { tone(880, 0.05); setTimeout(() => tone(1320, 0.08), 30); },
      prestige: () => { sweep(180, 900, 0.4, { type: 'triangle', vol: 0.3 }); setTimeout(() => { tone(392, 0.07); setTimeout(() => tone(523, 0.07), 70); setTimeout(() => tone(784, 0.2), 140); }, 280); },
    };
  })();

  // ---------- TIPS / HINTS (routed to sidebar Tips log) ----------
  function stripTags(html) { return html.replace(/<[^>]+>/g, ''); }
  function toast(html, opts = {}) {
    if (state.settings && state.settings.tipsMuted) return;
    log(stripTags(html));
  }
  function hint(id, html) {
    if (!state.settings.hintsShown) state.settings.hintsShown = {};
    if (state.settings.hintsShown[id]) return;
    state.settings.hintsShown[id] = true;
    if (state.settings && state.settings.tipsMuted) return;
    log(stripTags(html));
  }

  // ---------- FORMATTERS ----------
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) return (n < 10 && n % 1 !== 0) ? n.toFixed(1) : Math.floor(n).toString();
    if (state.settings && state.settings.notation === 'sci') {
      return n.toExponential(2).replace('e+', 'e');
    }
    const tier = Math.min(Math.floor(Math.log10(n) / 3), SUFFIXES.length - 1);
    const scaled = n / Math.pow(1000, tier);
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return scaled.toFixed(digits) + SUFFIXES[tier];
  }
  function fmtDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ' + (s % 60) + 's';
    const h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }
  function fmtAgo(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's ago';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    return h + 'h ago';
  }

  // ---------- LOG ----------
  function log(text) {
    state.log = state.log || [];
    state.log.unshift({ t: Date.now(), text });
    if (state.log.length > LOG_MAX) state.log.length = LOG_MAX;
  }

  // ---------- UNLOCK / VISIBILITY ----------
  function tierUnlocked(tierId) {
    if (tierId === 1) return true;
    return !!state.research.tiersUnlocked[tierId];
  }
  function tierUnlockAvailable(tierId) {
    if (tierId === 2) return true;
    return !!state.research.tiersUnlocked[tierId - 1];
  }
  function tierUnlockCost(tierId) {
    const base = TIER_UNLOCKS[tierId] ? TIER_UNLOCKS[tierId].cost : 0;
    const mul = rm().tierUnlockMul || 1;
    return Math.max(1, Math.ceil(base * mul));
  }
  function canBuyTierUnlock(tierId) {
    if (tierUnlocked(tierId)) return false;
    if (!tierUnlockAvailable(tierId)) return false;
    return state.meta.schematics >= tierUnlockCost(tierId);
  }
  function buyTierUnlock(tierId) {
    if (!canBuyTierUnlock(tierId)) return false;
    state.meta.schematics -= tierUnlockCost(tierId);
    state.research.tiersUnlocked[tierId] = true;
    audio.unlock();
    if (tierId === 2) hint('post_t2', '<b>TIP</b> — T2 machines consume Ore. Build enough Drills to keep them fed.');
    prevUnlockSig = '';
    return true;
  }
  function resourceVisible(res) {
    const tier = TIERS.find(t => t.resource === res);
    return tier ? tierUnlocked(tier.id) : false;
  }
  function supportUnlocked(id) { return tierUnlocked(SUPPORTS[id].unlockTier); }
  function anySupportUnlocked() { for (const id in SUPPORTS) if (supportUnlocked(id)) return true; return false; }
  function sidebarVisible() {
    for (const id in state.machines) if ((state.machines[id] || 0) > 0) return true;
    return state.meta.prestigeCount > 0 || state.meta.schematics > 0;
  }
  function machineUnlocked(id) {
    const m = MACHINES[id];
    if (m.mk === 'mk4') return (state.research.levels.mk4 || 0) > 0;
    if (m.mk === 'mk5') return (state.research.levels.mk5 || 0) > 0;
    return true;
  }
  function canPrestige() { return schematicsForPrestige() >= 1; }
  function treeTabVisible() { return canPrestige() || state.meta.prestigeCount > 0 || state.meta.schematics > 0; }

  // ---------- RESEARCH ----------
  function nodeLevel(id) { return state.research.levels[id] || 0; }
  function nodeMax(id) {
    const n = TREE_NODES[id];
    if (!n) return 0;
    if (n.type === 'origin') return 1;
    if (n.type === 'unlock') return 1;
    return n.maxLevel;
  }
  function nodeNextCost(id) {
    const n = TREE_NODES[id];
    if (!n || n.type === 'origin') return 0;
    if (n.type === 'unlock') return n.cost;
    const nextLevel = nodeLevel(id) + 1;
    if (nextLevel > n.maxLevel) return Infinity;
    return n.costForLevel(nextLevel);
  }
  function nodePrereqsMet(id) {
    const n = TREE_NODES[id];
    if (!n) return false;
    for (const req of n.requires) {
      if (nodeLevel(req) < 1) return false;
    }
    return true;
  }
  // Progressive reveal: node visible only when predecessors hit their reveal threshold.
  // Leveled: 50%+ of maxLevel. Unlock/origin: owned (level 1+).
  function nodeRevealed(id) {
    const n = TREE_NODES[id];
    if (!n) return false;
    if (n.requires.length === 0) return true;  // origin always revealed
    if (patentLevel('academia') > 0) return true; // ACADEMIA patent reveals whole tree
    for (const req of n.requires) {
      const reqNode = TREE_NODES[req];
      if (!reqNode) return false;
      const lvl = state.research.levels[req] || 0;
      if (reqNode.type === 'leveled') {
        const threshold = Math.ceil(reqNode.maxLevel * 0.5);
        if (lvl < threshold) return false;
      } else {
        if (lvl < 1) return false;  // origin or unlock
      }
    }
    return true;
  }
  function canResearch(id) {
    const n = TREE_NODES[id];
    if (!n) return false;
    if (nodeLevel(id) >= nodeMax(id)) return false;
    if (!nodePrereqsMet(id)) return false;
    const cost = nodeNextCost(id);
    if (state.meta.schematics < cost) return false;
    return true;
  }
  // ---------- PATENTS ----------
  function patentLevel(id) { return (state.research.patentLevels && state.research.patentLevels[id]) || 0; }
  function patentMax(id) {
    const p = PATENTS[id];
    if (!p) return 0;
    return p.type === 'unlock' ? 1 : p.maxLevel;
  }
  function patentNextCost(id) {
    const p = PATENTS[id];
    if (!p) return Infinity;
    if (p.type === 'unlock') return p.cost;
    const next = patentLevel(id) + 1;
    if (next > p.maxLevel) return Infinity;
    return p.costForLevel(next);
  }
  function patentPrereqsMet(id) {
    const p = PATENTS[id];
    if (!p) return false;
    for (const req of p.requires) if (patentLevel(req) < 1) return false;
    return true;
  }
  function canBuyPatent(id) {
    const p = PATENTS[id];
    if (!p) return false;
    if (patentLevel(id) >= patentMax(id)) return false;
    if (!patentPrereqsMet(id)) return false;
    return state.meta.patents >= patentNextCost(id);
  }
  function buyPatent(id) {
    if (!canBuyPatent(id)) return false;
    const cost = patentNextCost(id);
    state.meta.patents -= cost;
    state.research.patentLevels[id] = (state.research.patentLevels[id] || 0) + 1;
    invalidateRM();
    audio.research();
    return true;
  }

  // ---------- PUBLISH (meta-prestige) ----------
  function canPublish() { return (state.resources.prototype || 0) >= 1; }
  function patentsForPublish() {
    let base = Math.floor(state.resources.prototype || 0);
    // RECURSIVE patent: +1 per 20 research levels owned (excluding origin)
    if (patentLevel('recursive') > 0) {
      let lvls = 0;
      for (const id in state.research.levels) {
        if (id === 'origin') continue;
        lvls += state.research.levels[id] || 0;
      }
      base += Math.floor(lvls / 20);
    }
    return base;
  }
  function doPublish() {
    const gained = patentsForPublish();
    state.meta.patents += gained;
    state.meta.totalPatents += gained;
    state.meta.publishCount += 1;

    // WIPE: everything except patents + patent levels + player prefs + lifetime stats.
    state.resources = emptyResources();
    state.machines = emptyMachines();
    state.supports = emptySupports();
    state.research.levels = { origin: 0 };
    state.research.tiersUnlocked = { 2: false, 3: false, 4: false, 5: false, 6: false };
    state.meta.schematics = 0;
    state.meta.totalSchematics = 0;
    state.meta.prestigeCount = 0;
    state.meta.totalProduced = emptyResources();
    state.meta.currentRunCores = 0;
    state.meta.currentRunStartAt = Date.now();
    state.meta.totalClicks = 0;
    state.meta.lastPrestigeAt = 0;
    state.meta.clickProgress = { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 };
    state.settings.autoBuy = {};

    applyStartupBonuses();
    invalidateRM();
    prevUnlockSig = '';
    audio.prestige();
    save();
    rebuildAll();
    setTab('mastery');
  }

  function applyStartupBonuses() {
    const lvls = state.research.patentLevels || {};
    if ((lvls.draft_inheritance || 0) > 0)        state.research.tiersUnlocked[2] = true;
    if ((lvls.schematic_inheritance || 0) > 0)    state.research.tiersUnlocked[3] = true;
    if ((lvls.institutional_backing || 0) > 0)    state.research.tiersUnlocked[4] = true;
    if ((lvls.industrial_empire || 0) > 0)        state.research.tiersUnlocked[5] = true;
    if ((lvls.fast_start || 0) > 0) {
      state.machines.drill = Math.max(state.machines.drill || 0, lvls.fast_start);
    }
    if ((lvls.legacy_wealth || 0) > 0) {
      state.resources.ore = Math.max(state.resources.ore || 0, 10000);
    }
  }

  function researchBuy(id) {
    if (!canResearch(id)) return false;
    const cost = nodeNextCost(id);
    state.meta.schematics -= cost;
    state.research.levels[id] = (state.research.levels[id] || 0) + 1;
    invalidateRM();
    audio.research();
    return true;
  }

  // ---------- RESEARCH MULTIPLIERS ----------
  function researchMultipliers() {
    const m = {
      prodMul: 1, consMul: 1, costMul: 1, supportCostMul: 1,
      clickAdd: 0, clickMul: 0, autoClickPerSec: 0,
      critChance: 0, critMul: 1,
      freeRes: { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0 },
      powerBoost: 1,
      momentum: 0,
      lossless: false,
      doublePay: 1,
      bulkBuy: false,
      autoBuy: false,
      maxBuy: false,
      // patent-level fields
      schematicMul: 1,
      prototypeMul: 1,
      offlineHoursAdd: 0,
      tierUnlockMul: 1,
      autoPrestige: false,
      autoPublish: false,
      omnitap: false,
      // new late-game tree fields
      perpetualMotion: false,
      critCascade: false,
      goldenTick: false,
      blueprintMemory: false,
      chainReaction: false,
      symbiosis: 0,
    };
    for (const id in TREE_NODES) {
      const lvl = nodeLevel(id);
      if (lvl <= 0) continue;
      const node = TREE_NODES[id];
      if (node.applyEffect) node.applyEffect(m, lvl);
    }
    // patent layer — permanent meta-boosts
    for (const id in PATENTS) {
      const lvl = patentLevel(id);
      if (lvl <= 0) continue;
      const p = PATENTS[id];
      if (p.applyEffect) p.applyEffect(m, lvl);
    }
    // achievement layer — small permanent bonuses, stacking additively per stat
    const achs = state.meta.achievements || {};
    for (const id in achs) {
      const b = ACHIEVEMENT_BONUSES[id];
      if (!b) continue;
      if (b.prodMul)       m.prodMul *= (1 + b.prodMul);
      if (b.consMul)       m.consMul *= (1 + b.consMul);
      if (b.costMul)       m.costMul *= (1 + b.costMul);
      if (b.schematicMul)  m.schematicMul *= (1 + b.schematicMul);
      if (b.prototypeMul)  m.prototypeMul *= (1 + b.prototypeMul);
      if (b.clickAdd)      m.clickAdd += b.clickAdd;
    }
    return m;
  }
  function invalidateRM() { runtime.rm = null; }
  function rm() { return runtime.rm || (runtime.rm = researchMultipliers()); }

  // ---------- GLOBAL MULTIPLIERS ----------
  function globalProdMul(totalMachines) {
    const r = rm();
    let mul = r.prodMul;
    for (const id in SUPPORTS) {
      const count = state.supports[id] || 0;
      const eff = (SUPPORTS[id].effect.prodMul || 0) * r.powerBoost;
      mul *= (1 + eff * count);
    }
    const momentumBonus = Math.min(MOMENTUM_CAP, (totalMachines || 0) * r.momentum);
    mul *= (1 + momentumBonus);
    return mul;
  }
  function globalConsMul() {
    const r = rm();
    let mul = r.consMul;
    for (const id in SUPPORTS) {
      const count = state.supports[id] || 0;
      const eff = (SUPPORTS[id].effect.consMul || 0) * r.powerBoost;
      mul *= Math.max(0.05, 1 + eff * count);
    }
    return mul;
  }

  // ---------- PURCHASE ----------
  function machineCost(id) {
    const m = MACHINES[id];
    const owned = state.machines[id] || 0;
    const mul = rm().costMul;
    const out = {};
    for (const res in m.cost) out[res] = m.cost[res] * Math.pow(m.costMul, owned) * mul;
    return out;
  }
  function supportCost(id) {
    const s = SUPPORTS[id];
    const owned = state.supports[id] || 0;
    const mul = rm().supportCostMul;
    const out = {};
    for (const res in s.cost) out[res] = s.cost[res] * Math.pow(s.costMul, owned) * mul;
    return out;
  }
  function canAfford(cost) {
    for (const res in cost) if ((state.resources[res] || 0) < cost[res]) return false;
    return true;
  }
  function buy(id) {
    if (!machineUnlocked(id)) return false;
    const cost = machineCost(id);
    if (!canAfford(cost)) return false;
    for (const res in cost) state.resources[res] -= cost[res];
    state.machines[id] = (state.machines[id] || 0) + 1;
    audio.buy();
    return true;
  }
  function buyMultiple(id, count) {
    let bought = 0;
    for (let i = 0; i < count; i++) {
      if (!buy(id)) break;
      bought++;
    }
    return bought;
  }
  function buyMax(id) {
    let bought = 0;
    // safety cap to prevent freeze if cost scaling is bad
    while (bought < 10000 && canAfford(machineCost(id))) {
      if (!buy(id)) break;
      bought++;
    }
    return bought;
  }
  function buyModeCount(mode, r) {
    // returns numeric count or 'max'; respects what's actually unlocked
    if (mode === '10'   && r.bulkBuy) return 10;
    if (mode === '100'  && r.bulkBuy) return 100;
    if (mode === '1000' && r.maxBuy)  return 1000;
    if (mode === 'max'  && r.maxBuy)  return 'max';
    return 1;
  }
  function buySupport(id) {
    const cost = supportCost(id);
    if (!canAfford(cost)) return false;
    for (const res in cost) state.resources[res] -= cost[res];
    state.supports[id] = (state.supports[id] || 0) + 1;
    audio.buy();
    return true;
  }

  // ---------- TICK ----------
  function tick(dt) {
    const r = rm();

    for (const t of TIERS) runtime.tierRate[t.id] = 0;
    for (const res in runtime.prodRate) runtime.prodRate[res] = 0;
    for (const res in runtime.consRate) runtime.consRate[res] = 0;
    runtime.totalProdPerSec = 0;

    // roll-up manual click rate (sum of gains in last 1s) into prodRate per resource
    if (runtime.clickSamples) {
      const cutoff = Date.now() - 1000;
      for (const res in runtime.clickSamples) {
        runtime.clickSamples[res] = runtime.clickSamples[res].filter(s => s.t >= cutoff);
        let sum = 0;
        for (const s of runtime.clickSamples[res]) sum += s.amt;
        if (sum > 0) runtime.prodRate[res] = (runtime.prodRate[res] || 0) + sum;
      }
    }

    let totalMachines = 0;
    for (const id in state.machines) totalMachines += state.machines[id] || 0;

    let prodMul = globalProdMul(totalMachines);
    const consMul = globalConsMul();

    // ◆ CRIT CASCADE — 2× production while burst active
    if (r.critCascade && runtime.critCascadeEndAt && Date.now() < runtime.critCascadeEndAt) {
      prodMul *= 2;
    }

    // ◆ CHAIN REACTION — global +30% if all 5 base tiers have machines owned
    if (r.chainReaction) {
      let allActive = true;
      for (let t = 1; t <= 5; t++) {
        let any = false;
        for (const id in MACHINES) {
          if (MACHINES[id].tier === t && (state.machines[id] || 0) > 0) { any = true; break; }
        }
        if (!any) { allActive = false; break; }
      }
      if (allActive) prodMul *= 1.30;
    }

    // ◆ SYMBIOSIS — +N% per unique machine type owned
    if (r.symbiosis > 0) {
      let uniq = 0;
      for (const id in state.machines) if ((state.machines[id] || 0) > 0) uniq++;
      if (uniq > 0) prodMul *= (1 + r.symbiosis * uniq);
    }

    // ◆ GOLDEN TICK — scheduler
    if (r.goldenTick) {
      if (!runtime.goldenTick) runtime.goldenTick = { active: false, tierId: null, endAt: 0, nextAt: Date.now() + 60000 };
      const gt = runtime.goldenTick;
      const now = Date.now();
      if (gt.active && now >= gt.endAt) { gt.active = false; gt.nextAt = now + 60000; }
      else if (!gt.active && now >= gt.nextAt) {
        gt.tierId = 1 + Math.floor(Math.random() * 5);
        gt.active = true; gt.endAt = now + 5000;
        state.meta.goldenTicksSeen = (state.meta.goldenTicksSeen || 0) + 1;
        log(`✦ GOLDEN TICK · T${gt.tierId} surges ×10 for 5s`);
      }
    }

    // ◆ RISING TIDE — precompute per-tier bonus
    const risingTideOn = patentLevel('rising_tide') > 0;
    const risingTideBonus = {};
    if (risingTideOn) {
      for (let t = 1; t <= 6; t++) {
        let higher = 0;
        for (let h = t + 1; h <= 6; h++) if (tierUnlocked(h)) higher++;
        risingTideBonus[t] = 1 + (0.05 * higher);
      }
    }

    // Auto-mine: per-resource toggle. Progress accumulates per tick at autoClickPerSec × baseMul.
    //  - ore: needs auto_click tree node unlocked
    //  - others: needs omnitap patent unlocked
    //  - production happens when progress crosses the recipe goal; input cost deducted per unit.
    if (r.autoClickPerSec > 0) {
      const baseMul = (1 + r.clickAdd) * (1 + (r.clickMul || 0));
      if (!state.meta.clickProgress) state.meta.clickProgress = {};
      for (const res in CLICK_RECIPE) {
        if (!isAutoMining(res)) continue;
        const recipe = CLICK_RECIPE[res];
        // Skip tick if input resource is below the inputCost — don't accumulate unredeemable progress
        if (recipe.inRes && (state.resources[recipe.inRes] || 0) < recipe.inputCost) continue;
        const progressPerSec = r.autoClickPerSec * baseMul;
        state.meta.clickProgress[res] = (state.meta.clickProgress[res] || 0) + progressPerSec * dt;

        // units produced this tick (continuous — may be fractional over time)
        const inRes = recipe.inRes;
        const inputCost = recipe.inputCost || 0;
        let produced = 0;
        while (state.meta.clickProgress[res] >= recipe.goal) {
          if (inRes && (state.resources[inRes] || 0) < inputCost) break;
          if (inRes) state.resources[inRes] -= inputCost;
          state.meta.clickProgress[res] -= recipe.goal;
          produced++;
          if (produced > 10000) break; // safety guard
        }

        if (produced > 0) {
          state.resources[res] = (state.resources[res] || 0) + produced;
          state.meta.totalProduced[res] = (state.meta.totalProduced[res] || 0) + produced;
          state.meta.lifetimeProduced[res] = (state.meta.lifetimeProduced[res] || 0) + produced;
        }
        // display rate (effective production/sec from this auto-mine)
        const effRate = progressPerSec / recipe.goal;
        runtime.prodRate[res] = (runtime.prodRate[res] || 0) + effRate;
        if (inRes && effRate > 0) {
          runtime.consRate[inRes] = (runtime.consRate[inRes] || 0) + effRate * inputCost;
        }
      }
    }

    // free resources from Yield
    for (const res in r.freeRes) {
      const ratePerSec = r.freeRes[res];
      if (ratePerSec > 0) {
        const amt = ratePerSec * dt;
        state.resources[res] = (state.resources[res] || 0) + amt;
        state.meta.totalProduced[res] = (state.meta.totalProduced[res] || 0) + amt;
        state.meta.lifetimeProduced[res] = (state.meta.lifetimeProduced[res] || 0) + amt;
        runtime.prodRate[res] = (runtime.prodRate[res] || 0) + ratePerSec;
      }
    }

    // machines
    for (const id in MACHINES) {
      const count = state.machines[id] || 0;
      if (count === 0) { runtime.machineRatio[id] = 1; runtime.bottleneck[id] = null; continue; }
      const m = MACHINES[id];

      let ratio = 1, bottleneck = null;
      for (const res in m.consumes) {
        const need = m.consumes[res] * count * dt * consMul;
        if (need <= 0) continue;
        const avail = state.resources[res] || 0;
        const rr = avail / need;
        if (rr < ratio) { ratio = rr; bottleneck = res; }
      }
      ratio = Math.max(0, Math.min(1, ratio));
      const consumeRatio = ratio;
      let produceRatio = ratio;
      if (r.perpetualMotion) produceRatio = 1;
      else if (r.lossless && ratio < LOSSLESS_FLOOR) produceRatio = LOSSLESS_FLOOR;

      runtime.machineRatio[id] = produceRatio;
      runtime.bottleneck[id] = ratio < 0.999 ? bottleneck : null;

      if (consumeRatio > 0) {
        for (const res in m.consumes) {
          const consumeRate = m.consumes[res] * count * consumeRatio * consMul;
          state.resources[res] -= consumeRate * dt;
          runtime.consRate[res] = (runtime.consRate[res] || 0) + consumeRate;
        }
      }

      if (produceRatio > 0) {
        // Per-machine multipliers: Golden Tick surge, Rising Tide lower-tier bonus
        const goldenMul = (runtime.goldenTick && runtime.goldenTick.active && runtime.goldenTick.tierId === m.tier) ? 10 : 1;
        const tideMul = risingTideOn ? (risingTideBonus[m.tier] || 1) : 1;
        for (const res in m.produces) {
          const extra = (res === 'prototype') ? r.prototypeMul : 1;
          const rate = m.produces[res] * count * produceRatio * prodMul * extra * goldenMul * tideMul;
          const amt = rate * dt;
          state.resources[res] += amt;
          state.meta.totalProduced[res] = (state.meta.totalProduced[res] || 0) + amt;
          state.meta.lifetimeProduced[res] = (state.meta.lifetimeProduced[res] || 0) + amt;
          if (res === 'core') state.meta.currentRunCores = (state.meta.currentRunCores || 0) + amt;
          runtime.tierRate[m.tier] = (runtime.tierRate[m.tier] || 0) + rate;
          runtime.prodRate[res] = (runtime.prodRate[res] || 0) + rate;
          runtime.totalProdPerSec += rate;
        }
      }
    }

    // auto-buy (throttled)
    if (r.autoBuy) {
      runtime.autoBuyAccum += dt * 1000;
      if (runtime.autoBuyAccum >= AUTO_BUY_INTERVAL_MS) {
        runtime.autoBuyAccum = 0;
        for (const id in state.settings.autoBuy) {
          if (!state.settings.autoBuy[id] || !machineUnlocked(id)) continue;
          if (canAfford(machineCost(id))) buy(id);
        }
      }
    }

    state.meta.totalPlaytimeMs += dt * 1000;

    // ◆ AUTO-PRESTIGE
    if (r.autoPrestige && state.settings.autoPrestige && state.settings.autoPrestige.enabled) {
      const threshold = state.settings.autoPrestige.threshold || 10;
      if (schematicsForPrestige() >= threshold && canPrestige()) {
        doPrestige();
        return; // state has been reset
      }
    }
    // ◆ AUTO-PUBLISH
    if (r.autoPublish && state.settings.autoPublish && state.settings.autoPublish.enabled) {
      const threshold = state.settings.autoPublish.threshold || 10;
      if ((state.resources.prototype || 0) >= threshold && canPublish()) {
        doPublish();
        return;
      }
    }

    // first-run hints (throttled via hintsShown once-off)
    const ore = state.meta.totalProduced.ore || 0;
    if (ore >= 10 && (state.machines.drill || 0) === 0) {
      hint('buy_drill', '<b>TIP</b> — buy a <b>DRILL</b> to automate mining.');
    }
    if (canPrestige() && state.meta.prestigeCount === 0) {
      hint('first_prestige', '<b>TIP</b> — you can now <b>PRESTIGE</b>! Earn Schematics to unlock tiers.');
    }
  }

  // Can the player toggle an auto-mine pickaxe on this resource?
  //   Ore: requires auto_click tree node
  //   Others: requires omnitap patent
  function canAutoMine(res) {
    if (!resourceVisible(res)) return false;
    if (res === 'ore') return nodeLevel('auto_click') >= 1;
    return patentLevel('omnitap') >= 1;
  }
  function isAutoMining(res) {
    return canAutoMine(res) && !!(state.settings.autoMine && state.settings.autoMine[res]);
  }

  function clickResource(res) {
    if (!resourceVisible(res)) return false;
    const recipe = CLICK_RECIPE[res];
    if (!recipe) return false;
    // Refuse the click if input is unavailable — matches the red "unaffordable" UI state
    // and prevents users from building up unredeemable progress they can't act on.
    if (recipe.inRes && (state.resources[recipe.inRes] || 0) < recipe.inputCost) return false;
    const r = rm();
    let baseMul = (1 + r.clickAdd) * (1 + (r.clickMul || 0));
    let crit = false;
    if (r.critChance > 0 && Math.random() < r.critChance) {
      baseMul *= r.critMul;
      crit = true;
    }
    // accumulate progress
    if (!state.meta.clickProgress) state.meta.clickProgress = {};
    state.meta.clickProgress[res] = (state.meta.clickProgress[res] || 0) + baseMul;

    // produce units while progress >= goal and input is available
    const goal = recipe.goal;
    const inRes = recipe.inRes;
    const inputCost = recipe.inputCost || 0;
    let produced = 0;
    while (state.meta.clickProgress[res] >= goal) {
      if (inRes && (state.resources[inRes] || 0) < inputCost) break; // starved — progress stays pending
      if (inRes) state.resources[inRes] -= inputCost;
      state.meta.clickProgress[res] -= goal;
      produced++;
    }

    state.meta.totalClicks = (state.meta.totalClicks || 0) + 1;
    if (produced > 0) {
      state.resources[res] = (state.resources[res] || 0) + produced;
      state.meta.totalProduced[res] = (state.meta.totalProduced[res] || 0) + produced;
      state.meta.lifetimeProduced[res] = (state.meta.lifetimeProduced[res] || 0) + produced;
      state.meta.clicksByRes = state.meta.clicksByRes || {};
      state.meta.clicksByRes[res] = (state.meta.clicksByRes[res] || 0) + produced;
      runtime.clickSamples = runtime.clickSamples || {};
      runtime.clickSamples[res] = runtime.clickSamples[res] || [];
      runtime.clickSamples[res].push({ t: Date.now(), amt: produced });
    }
    audio.click();
    if (crit && r.critCascade) runtime.critCascadeEndAt = Date.now() + 3000;
    return true;
  }
  function clickMine() { clickResource('ore'); }

  // ---------- PRESTIGE ----------
  // Weighted score across all resources produced this run (totalProduced resets per prestige).
  // Each tier worth roughly 50× the previous, so reaching a new tier dramatically boosts payout.
  const TIER_SCORE_WEIGHTS = { ore: 1, ingot: 50, part: 2500, circuit: 125000, core: 6250000 };
  function schematicsForPrestige() {
    const p = state.meta.totalProduced || {};
    const r = rm();
    let score = 0;
    for (const res in TIER_SCORE_WEIGHTS) score += (p[res] || 0) * TIER_SCORE_WEIGHTS[res];
    const base = Math.floor(Math.cbrt(score * r.doublePay / 50));
    let schem = Math.floor(base * r.schematicMul);
    // PRESTIGE STREAK patent: +20% if within 3 min of last prestige
    if (patentLevel('prestige_streak') > 0 && state.meta.lastPrestigeAt) {
      if (Date.now() - state.meta.lastPrestigeAt < 3 * 60 * 1000) {
        schem = Math.floor(schem * 1.20);
      }
    }
    return schem;
  }

  function doPrestige() {
    const gained = schematicsForPrestige();
    state.meta.schematics += gained;
    state.meta.totalSchematics = (state.meta.totalSchematics || 0) + gained;
    state.meta.lifetimeSchematics = (state.meta.lifetimeSchematics || 0) + gained;
    state.meta.prestigeCount += 1;
    state.meta.lifetimePrestiges = (state.meta.lifetimePrestiges || 0) + 1;

    // BLUEPRINT MEMORY: snapshot machine counts before reset
    const memorySnapshot = rm().blueprintMemory ? { ...state.machines } : null;

    // RESET run
    state.resources = emptyResources();
    state.machines = emptyMachines();
    state.supports = emptySupports();
    state.meta.totalProduced = emptyResources();
    state.meta.currentRunCores = 0;
    state.meta.currentRunStartAt = Date.now();
    state.meta.totalClicks = 0;
    state.meta.clickProgress = { ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 };
    state.settings.autoBuy = {};

    applyStartupBonuses();

    // BLUEPRINT MEMORY: restore 80% of previous machine counts for free
    if (memorySnapshot) {
      for (const id in memorySnapshot) {
        const restored = Math.floor((memorySnapshot[id] || 0) * 0.8);
        if (restored > 0) state.machines[id] = Math.max(state.machines[id] || 0, restored);
      }
    }

    state.meta.lastPrestigeAt = Date.now();
    invalidateRM();
    prevUnlockSig = '';
    audio.prestige();
    if (state.meta.prestigeCount === 1) {
      hint('post_first_prestige', '<b>TIP</b> — open the <b>RESEARCH</b> tab to spend Schematics on tier unlocks.');
    }
    save();
    rebuildAll();
    setTab('tree');
  }

  // ---------- SAVE / LOAD ----------
  function save() {
    state.lastSaveAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (e) { console.error('[blueprint] save failed', e); }
  }
  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);

      // migrate old Phase 4 research.owned → new levels
      if (parsed.research && parsed.research.owned && !parsed.research.levels) {
        console.log('[blueprint] migrating research to v0.6.0');
        parsed.research = { levels: { origin: 1 } };
      }

      // migrate pre-v0.7.0 saves: grant tier unlocks based on past production
      if (parsed.research && !parsed.research.tiersUnlocked) {
        console.log('[blueprint] granting tier unlocks from prior progress');
        parsed.research.tiersUnlocked = { 2: false, 3: false, 4: false, 5: false };
        const t = (parsed.meta && parsed.meta.totalProduced) || {};
        if ((t.ore     || 0) >= 50) parsed.research.tiersUnlocked[2] = true;
        if ((t.ingot   || 0) >= 30) parsed.research.tiersUnlocked[3] = true;
        if ((t.part    || 0) >= 25) parsed.research.tiersUnlocked[4] = true;
        if ((t.circuit || 0) >= 15) parsed.research.tiersUnlocked[5] = true;
      }

      state = Object.assign(freshState(), parsed);
      state.resources = Object.assign(emptyResources(), state.resources || {});
      state.machines  = Object.assign(emptyMachines(),  state.machines  || {});
      state.supports  = Object.assign(emptySupports(),  state.supports  || {});
      state.research  = Object.assign(freshResearch(),  state.research  || {});
      // Pre-existing saves had origin auto-owned (level 1). New games start at 0 (must purchase).
      const hadOldResearch = state.research.levels && Object.keys(state.research.levels).some(k => k !== 'origin' && state.research.levels[k] > 0);
      const defaultOrigin = hadOldResearch ? 1 : 0;
      state.research.levels = Object.assign({ origin: defaultOrigin }, state.research.levels || {});
      state.research.tiersUnlocked = Object.assign({ 2: false, 3: false, 4: false, 5: false, 6: false }, state.research.tiersUnlocked || {});
      state.research.patentLevels = state.research.patentLevels || {};
      state.settings = Object.assign(freshState().settings, state.settings || {});
      state.settings.autoBuy = state.settings.autoBuy || {};
      state.settings.hintsShown = state.settings.hintsShown || {};
      state.settings.autoPrestige = state.settings.autoPrestige || { enabled: false, threshold: 10 };
      state.settings.autoPublish  = state.settings.autoPublish  || { enabled: false, threshold: 10 };
      if (state.settings.tipsMuted == null) state.settings.tipsMuted = false;
      if (state.settings.achievementsExpanded == null) state.settings.achievementsExpanded = false;
      if (state.settings.haptics == null) state.settings.haptics = true;
      state.settings.autoMine = Object.assign({ ore: true, ingot: false, part: false, circuit: false, core: false, prototype: false }, state.settings.autoMine || {});
      state.meta.achievements = state.meta.achievements || {};
      state.meta.newAchievements = state.meta.newAchievements || {};
      if (state.meta.goldenTicksSeen == null) state.meta.goldenTicksSeen = 0;
      state.meta.clickProgress = Object.assign({ ore: 0, ingot: 0, part: 0, circuit: 0, core: 0, prototype: 0 }, state.meta.clickProgress || {});
      state.meta = Object.assign(freshState().meta, state.meta || {});
      state.meta.totalProduced = Object.assign(emptyResources(), state.meta.totalProduced || {});
      state.meta.lifetimeProduced = Object.assign(emptyResources(), state.meta.lifetimeProduced || {});
      // bootstrap lifetime from current run if missing (older saves)
      for (const r in state.meta.lifetimeProduced) {
        if (state.meta.lifetimeProduced[r] === 0 && state.meta.totalProduced[r] > 0) {
          state.meta.lifetimeProduced[r] = state.meta.totalProduced[r];
        }
      }
      state.log = Array.isArray(state.log) ? state.log : [];
      invalidateRM();
      return true;
    } catch (e) { console.error('[blueprint] load failed', e); return false; }
  }
  function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
  function importSave(b64) {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(b64.trim()))));
      state = Object.assign(freshState(), parsed);
      invalidateRM();
      save(); return true;
    } catch { return false; }
  }
  function wipe() {
    localStorage.removeItem(SAVE_KEY);
    state = freshState();
    sessionStartAt = Date.now();
    prevUnlockSig = '';
    invalidateRM();
    rebuildAll();
  }
  function applyOffline() {
    const now = Date.now();
    const capMs = OFFLINE_CAP_MS + (rm().offlineHoursAdd || 0) * 3600 * 1000;
    const elapsed = Math.min(now - state.lastTickAt, capMs);
    let report = null;
    if (elapsed > 1000) {
      const before = { ...state.resources };
      tick(elapsed / 1000);
      const earned = {};
      for (const res in state.resources) {
        const diff = state.resources[res] - (before[res] || 0);
        if (diff > 0.01) earned[res] = diff;
      }
      report = { elapsed, earned };
    }
    state.lastTickAt = now;
    return report;
  }

  // ========== DOM ==========
  const resBarEl    = document.getElementById('res-bar');
  const factoryEl   = document.getElementById('factory');
  const sidebarEl   = document.getElementById('sidebar');
  const factoryViewEl = document.getElementById('view-factory');
  const treeSvg     = document.getElementById('tree-svg');
  const treeCanvas  = document.getElementById('tree-canvas');
  const treeTip     = document.getElementById('tree-tip');
  const rpValueEl   = document.getElementById('rp-value');
  const rpRateEl    = document.getElementById('rp-rate');
  const prestigeCountEl = document.getElementById('prestige-count');
  const tabTreeEl    = document.getElementById('tab-tree');
  const tabStatsEl   = document.getElementById('tab-stats');
  const tabMasteryEl = document.getElementById('tab-mastery');
  const masteryBodyEl = document.getElementById('mastery-body');
  const achievementsBodyEl = document.getElementById('achievements-body');
  const tierUnlocksBar = document.getElementById('tier-unlocks-bar');
  const slotTip     = document.getElementById('slot-tip');
  const statsBodyEl = document.getElementById('stats-body');
  // Runtime touch tracking. Static matchMedia('(hover: none)') lies on hybrid devices
  // and under DevTools emulation — so instead we watch for real touchstart events and
  // suppress the synthetic mouseenter that fires right after a tap.
  let lastTouchTime = 0;
  document.addEventListener('touchstart', () => {
    lastTouchTime = Date.now();
    // Any pending hover-tip is now stale because the user just tapped.
    hideSlotTip();
  }, { passive: true, capture: true });
  function isSyntheticMouseFromTouch() {
    return Date.now() - lastTouchTime < 700;
  }
  const dom = { tiers: {}, mineCard: null, side: {}, treeNodes: {}, treeLines: [], treeLevelTexts: {}, tierUnlockBtns: {} };

  // ---------- TABS ----------
  function setTab(name) {
    state.meta.currentTab = name;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    if (name === 'stats') renderStats();
    if (name === 'mastery') renderMastery();
    if (name === 'achievements') { prevAchSig = ''; renderAchievementsSection(); }
  }
  function bindTabs() {
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => setTab(t.dataset.tab));
    });
  }

  // ---------- RES BAR ----------
  function buildResBar() {
    resBarEl.innerHTML = '';
    TIERS.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'res clickable'; row.dataset.res = t.resource;
      row.title = `Click to mine ${t.resource}`;
      row.innerHTML = `
        <button class="res-auto-btn" data-auto-btn title="Toggle auto-mine" aria-label="Auto-mine">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M 1.5 4 Q 8 1.5 14.5 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="8" y1="2.7" x2="8" y2="14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="body">
          <div class="l">${t.resource.toUpperCase()}</div>
          <div class="v" data-v>0</div>
          <div class="rates">
            <span class="rate prod" data-prod></span>
            <span class="rate cons" data-cons></span>
          </div>
        </div>
      `;
      row.addEventListener('click', (e) => {
        // Ignore clicks originating on the auto-mine button
        if (e.target.closest('[data-auto-btn]')) return;
        if (!resourceVisible(t.resource)) return;
        clickResource(t.resource);
        row.classList.remove('res-pulse');
        void row.offsetWidth;
        row.classList.add('res-pulse');
      });
      row.querySelector('[data-auto-btn]').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!canAutoMine(t.resource)) return;
        state.settings.autoMine[t.resource] = !state.settings.autoMine[t.resource];
      });
      resBarEl.appendChild(row);
    });
  }
  function renderResBar() {
    resBarEl.querySelectorAll('.res').forEach((el) => {
      const res = el.dataset.res;
      if (!resourceVisible(res)) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      el.querySelector('[data-v]').textContent = fmt(state.resources[res] || 0);
      // auto-mine pickaxe button visibility + state
      const autoBtn = el.querySelector('[data-auto-btn]');
      if (autoBtn) {
        const canAuto = canAutoMine(res);
        autoBtn.style.display = canAuto ? '' : 'none';
        autoBtn.classList.toggle('on', canAuto && !!state.settings.autoMine[res]);
      }

      const prod = runtime.prodRate[res] || 0;
      const cons = runtime.consRate[res] || 0;
      const pEl = el.querySelector('[data-prod]');
      const cEl = el.querySelector('[data-cons]');

      if (prod < 0.05 && cons < 0.05) {
        pEl.textContent = '—';
        pEl.classList.add('zero');
        cEl.textContent = '';
        cEl.style.display = 'none';
      } else {
        pEl.classList.remove('zero');
        pEl.textContent = prod >= 0.05 ? '▲ ' + fmt(prod) + '/s' : '';
        pEl.style.display = prod >= 0.05 ? '' : 'none';
        cEl.textContent = cons >= 0.05 ? '▼ ' + fmt(cons) + '/s' : '';
        cEl.style.display = cons >= 0.05 ? '' : 'none';
      }
    });
  }

  // ---------- FACTORY ----------
  function buildFactory() {
    factoryEl.innerHTML = '';
    dom.tiers = {};

    // BUY MODE BAR — FIRST child of factoryEl, OUTSIDE the scroll wrapper. Stays pinned at top.
    const buyBar = document.createElement('div');
    buyBar.className = 'buy-mode-bar';
    buyBar.innerHTML = `
      <div class="label">◆ BUY MODE</div>
      <div class="bm-btns">
        <button class="bm-btn" data-mode="1">×1</button>
        <button class="bm-btn" data-mode="10">×10</button>
        <button class="bm-btn" data-mode="100">×100</button>
        <button class="bm-btn" data-mode="1000">×1000</button>
        <button class="bm-btn" data-mode="max">MAX</button>
      </div>
      <div class="bm-hint" data-bm-hint></div>
    `;
    factoryEl.appendChild(buyBar);
    dom.buyBar = buyBar;
    buyBar.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('locked')) return;
        state.settings.buyMode = btn.dataset.mode;
      });
    });

    // Scroll wrapper — mine-card, tier rows, achievements all go here
    const scrollEl = document.createElement('div');
    scrollEl.className = 'factory-scroll';
    factoryEl.appendChild(scrollEl);
    dom.factoryScroll = scrollEl;

    // Mine bar — one big clickable button per unlocked resource.
    // Populated/updated by renderMineBar() on each frame.
    const mineCard = document.createElement('div');
    mineCard.className = 'mine-card';
    scrollEl.appendChild(mineCard);
    dom.mineCard = mineCard;
    prevMineSig = ''; // force renderMineBar to repopulate the fresh empty container

    TIERS.forEach((tier) => {
      const unlocked = tierUnlocked(tier.id);
      const row = document.createElement('div');
      row.className = 'tier' + (unlocked ? '' : ' locked');
      row.dataset.tier = tier.id;

      if (!unlocked) {
        const canBuy = canBuyTierUnlock(tier.id);
        const avail = tierUnlockAvailable(tier.id);
        const cost = tierUnlockCost(tier.id);
        const firstRun = state.meta.prestigeCount === 0 && state.meta.schematics === 0;
        let hint;
        if (!avail) {
          hint = `◆ LOCKED · UNLOCK T${tier.id - 1} FIRST`;
        } else if (firstRun) {
          hint = `◆ LOCKED · MINE ORE, THEN ◆ PRESTIGE TO EARN SCHEMATICS`;
        } else if (canBuy) {
          hint = `◆ UNLOCK FOR ${cost} SCHEMATIC${cost > 1 ? 'S' : ''} · OPEN RESEARCH TAB ▲`;
        } else {
          hint = `◆ LOCKED · ${cost} SCHEMATIC${cost > 1 ? 'S' : ''} NEEDED · HAVE ${fmt(state.meta.schematics)} · PRESTIGE FOR MORE`;
        }
        row.innerHTML = `
          <div class="tier-head">
            <b>T${tier.id} · ${tier.name}</b>
            <div class="unlock-hint">${hint}</div>
          </div>
        `;
        scrollEl.appendChild(row);
        dom.tiers[tier.id] = row;
        return;
      }

      row.innerHTML = `
        <div class="tier-head">
          <b>T${tier.id} · ${tier.name}</b>
          <div class="rate" data-rate>+0 ${tier.resource}/s</div>
        </div>
        <div class="slots"></div>
      `;
      const slotsEl = row.querySelector('.slots');

      for (let i = 1; i <= 5; i++) {
        const entry = Object.entries(MACHINES).find(([, m]) => m.tier === tier.id && m.slot === i);
        if (!entry) {
          const s = document.createElement('div');
          s.className = 'slot locked';
          s.innerHTML = `<div class="name">—</div>`;
          slotsEl.appendChild(s);
          continue;
        }
        const [id, m] = entry;
        const slot = document.createElement('button');
        slot.className = 'slot'; slot.dataset.machine = id;
        slot.innerHTML = `
          <span class="count" data-count>×0</span>
          <span class="bottleneck" data-bn title="">◇</span>
          <span class="auto-buy" data-auto>●AUTO</span>
          <button class="auto-chip" data-auto-chip title="Toggle auto-buy" aria-label="Toggle auto-buy">A</button>
          <div class="ico">${m.icon}</div>
          <div class="name">${m.name}</div>
          <div class="cost" data-cost></div>
        `;
        slot.addEventListener('click', (e) => {
          if (slot.__suppressNextClick) { slot.__suppressNextClick = false; return; }
          if (!machineUnlocked(id)) return;
          const r = rm();
          // Modifiers override current buy-mode (quick one-off)
          let count = null;
          if (r.bulkBuy) {
            if (r.maxBuy && e.shiftKey && e.ctrlKey) count = 1000;
            else if (e.shiftKey && e.altKey) count = 100;
            else if (e.shiftKey) count = 10;
          }
          if (count === null) count = buyModeCount(state.settings.buyMode || '1', r);
          const bought = (count === 'max') ? buyMax(id) : buyMultiple(id, count);
          if (bought > 0) { pulse(slot); haptic(12); }
        });
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (!rm().autoBuy || !machineUnlocked(id)) return;
          state.settings.autoBuy[id] = !state.settings.autoBuy[id];
        });
        const autoChip = slot.querySelector('[data-auto-chip]');
        if (autoChip) {
          autoChip.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!rm().autoBuy || !machineUnlocked(id)) return;
            state.settings.autoBuy[id] = !state.settings.autoBuy[id];
          });
        }
        // Desktop hover tooltip — guarded against synthetic mouseenter from a touch tap.
        slot.addEventListener('mouseenter', (e) => {
          if (isSyntheticMouseFromTouch()) return;
          showSlotTip(id, e);
        });
        slot.addEventListener('mousemove', (e) => {
          if (isSyntheticMouseFromTouch()) return;
          moveSlotTip(e);
        });
        slot.addEventListener('mouseleave', hideSlotTip);

        // Long-press on touch devices shows the same tooltip. Wired unconditionally —
        // touch events just never fire on mouse-only machines.
        let pressTimer = null, longPressed = false, pressX = 0, pressY = 0;
        slot.addEventListener('touchstart', (e) => {
          const t = e.touches && e.touches[0];
          if (!t) return;
          pressX = t.clientX; pressY = t.clientY;
          longPressed = false;
          pressTimer = setTimeout(() => {
            longPressed = true;
            pressTimer = null;
            showSlotTip(id, { clientX: pressX, clientY: pressY });
            haptic(20);
          }, 450);
        }, { passive: true });
        slot.addEventListener('touchmove', (e) => {
          const t = e.touches && e.touches[0];
          if (!t || !pressTimer) return;
          if (Math.hypot(t.clientX - pressX, t.clientY - pressY) > 10) {
            clearTimeout(pressTimer); pressTimer = null;
          }
        }, { passive: true });
        slot.addEventListener('touchend', (e) => {
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
          if (longPressed) {
            // Suppress the synthetic click that would otherwise buy after a long-press.
            e.preventDefault && e.preventDefault();
            slot.__suppressNextClick = true;
            setTimeout(() => hideSlotTip(), 2500);
          }
        });
        slot.addEventListener('touchcancel', () => {
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        }, { passive: true });
        slotsEl.appendChild(slot);
      }

      scrollEl.appendChild(row);
      dom.tiers[tier.id] = row;
    });

    // Achievements now live on their own tab — no inline section in the factory view.
  }

  // ACHIEVEMENTS VIEW — rendered into #achievements-body, wired once at startup.
  function buildAchievementsView() {
    if (!achievementsBodyEl || dom.achBody) return; // already wired
    achievementsBodyEl.innerHTML = `
      <div class="ach-page-header">
        <div class="ach-page-title">ACHIEVEMENTS</div>
        <div class="ach-page-stats">
          <span class="ach-page-progress" data-ach-progress>0 / 0</span>
          <span class="ach-page-new" data-ach-new-badge style="display:none">!</span>
        </div>
      </div>
      <div class="ach-page-body" data-ach-body></div>
    `;
    dom.achProgress  = achievementsBodyEl.querySelector('[data-ach-progress]');
    dom.achNewBadge  = achievementsBodyEl.querySelector('[data-ach-new-badge]');
    dom.achBody      = achievementsBodyEl.querySelector('[data-ach-body]');
    dom.achTabBadge  = document.getElementById('ach-tab-badge');
    // Event delegation — dismiss any earned+new card on tap. Survives inner innerHTML rebuilds.
    dom.achBody.addEventListener('click', (e) => {
      const card = e.target.closest('.ach.earned.new');
      if (!card || !card.dataset.achId) return;
      dismissAchievement(card.dataset.achId);
      prevAchSig = '';
      renderAchievementsSection();
    });
    prevAchSig = '';
  }
  function pulse(el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  // Haptic feedback — no-op on non-touch devices. Honors state.settings.haptics.
  function haptic(ms) {
    if (!navigator.vibrate) return;
    if (state.settings && state.settings.haptics === false) return;
    try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }

  // ---------- MINE BAR (per-resource manual click buttons) ----------
  const MINE_ICON_KEY = { ore: 'drill', ingot: 'furnace', part: 'press', circuit: 'assembler', core: 'forge', prototype: 'compiler' };
  const MINE_LABEL = {
    ore:       'MINE ORE',
    ingot:     'SMELT INGOT',
    part:      'CRAFT PART',
    circuit:   'ASSEMBLE CIRCUIT',
    core:      'FORGE CORE',
    prototype: 'REFINE PROTOTYPE',
  };
  let prevMineSig = '';
  function renderMineBar() {
    if (!dom.mineCard) return;
    const visible = Object.keys(CLICK_RECIPE).filter(resourceVisible);
    const sig = visible.join(',');
    if (sig !== prevMineSig) {
      prevMineSig = sig;
      dom.mineCard.innerHTML = '';
      for (const res of visible) {
        const recipe = CLICK_RECIPE[res];
        const btn = document.createElement('button');
        btn.className = 'mine-btn';
        btn.dataset.mineRes = res;
        // Only show progress bar for multi-click recipes (goal > 1)
        const progHtml = recipe.goal > 1 ? `
          <div class="mine-progress">
            <div class="mine-progress-bar"><div class="mine-progress-fill" data-mine-fill></div></div>
            <div class="mine-progress-text" data-mine-prog>…</div>
          </div>
        ` : '';
        btn.innerHTML = `
          <span class="mine-auto-badge">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M 1.5 4 Q 8 1.5 14.5 4" />
              <line x1="8" y1="2.7" x2="8" y2="14" />
            </svg>
            AUTO
          </span>
          <div class="mine-ico">${ICONS[MINE_ICON_KEY[res]]}</div>
          <div class="mine-label">
            <div class="n">${MINE_LABEL[res]}</div>
            <div class="d" data-mine-desc>…</div>
            ${progHtml}
          </div>
        `;
        btn.addEventListener('click', () => {
          if (clickResource(res)) { pulse(btn); haptic(6); }
        });
        dom.mineCard.appendChild(btn);
      }
    }
    // live update — reflects click research bonuses + current progress + affordability
    const r = rm();
    const baseMul = (1 + r.clickAdd) * (1 + (r.clickMul || 0));
    dom.mineCard.querySelectorAll('.mine-btn').forEach(btn => {
      const res = btn.dataset.mineRes;
      const recipe = CLICK_RECIPE[res];
      const inRes = recipe.inRes;
      const inputCost = recipe.inputCost || 0;
      const goal = recipe.goal;
      const progress = (state.meta.clickProgress && state.meta.clickProgress[res]) || 0;

      // Description line — short cost/yield hint. Details live in the progress bar + tooltips.
      const descEl = btn.querySelector('[data-mine-desc]');
      if (descEl) {
        if (goal === 1) {
          descEl.textContent = `+${fmt(baseMul)}/CLICK`;
        } else {
          descEl.textContent = `-${inputCost} ${inRes.toUpperCase()}`;
          const progEl = btn.querySelector('[data-mine-prog]');
          if (progEl) progEl.textContent = `${fmt(progress)} / ${goal}`;
        }
      }
      // Progress bar fill
      const fillEl = btn.querySelector('[data-mine-fill]');
      if (fillEl && goal > 1) {
        fillEl.style.width = Math.min(100, (progress / goal) * 100) + '%';
      }

      // Affordability: can we produce the NEXT unit? Needs enough input for at least one.
      const canAfford = !inRes || (state.resources[inRes] || 0) >= inputCost;
      btn.classList.toggle('unaffordable', !canAfford);
      btn.classList.toggle('auto-on', isAutoMining(res));
    });
  }

  let prevAchSig = '';
  function renderAchievementsSection() {
    if (!dom.achBody) return;
    const achMap = state.meta.achievements || {};
    const newMap = state.meta.newAchievements || {};
    let earned = 0, total = 0;
    for (const id in ACHIEVEMENTS) { total++; if (achMap[id]) earned++; }

    // Header + tab badge updates — cheap, always run
    if (dom.achProgress) dom.achProgress.textContent = `${earned} / ${total}`;
    const newCount = Object.keys(newMap).length;
    if (dom.achNewBadge) {
      dom.achNewBadge.style.display = newCount > 0 ? '' : 'none';
      dom.achNewBadge.textContent = newCount > 1 ? `! ${newCount}` : '!';
    }
    if (dom.achTabBadge) {
      dom.achTabBadge.style.display = newCount > 0 ? '' : 'none';
      dom.achTabBadge.textContent = newCount > 1 ? newCount : '!';
    }

    // Throttle innerHTML rebuild — only when earned set or new set changes.
    // (Rebuilding every frame kills click handlers between mousedown and mouseup.)
    const sig = 'e' + Object.keys(achMap).sort().join(',') + '|n' + Object.keys(newMap).sort().join(',');
    if (sig === prevAchSig) return;
    prevAchSig = sig;

    const groups = { progress: [], meta: [], scale: [], special: [] };
    for (const id in ACHIEVEMENTS) {
      const a = ACHIEVEMENTS[id];
      groups[a.group || 'special'].push({ id, ...a });
    }
    const groupOrder = ['progress', 'meta', 'scale', 'special'];
    const groupLabels = { progress: 'PROGRESS', meta: 'PRESTIGE & PUBLISH', scale: 'SCALE', special: 'SPECIAL' };
    dom.achBody.innerHTML = groupOrder.map(g => `
      <div class="ach-group">
        <div class="ach-group-label">${groupLabels[g]}</div>
        <div class="ach-grid">
          ${groups[g].map(a => {
            const e = !!achMap[a.id];
            const isNew = !!newMap[a.id];
            const bonus = ACHIEVEMENT_BONUSES[a.id];
            const bonusLabel = bonus ? bonus.label : '';
            const pr = achieveProgress(a.id);
            // Progress bar on EVERY card for visual consistency. Earned cards show full bars.
            const cur = e ? pr.goal : pr.current;
            const pct = e ? 100 : Math.min(100, (pr.current / pr.goal) * 100);
            const progBar = `
              <div class="ach-progress-wrap">
                <div class="ach-progress-bar"><div class="ach-progress-fill" data-ach-fill style="width:${pct}%"></div></div>
                <div class="ach-progress-text" data-ach-text>${fmt(cur)} / ${fmt(pr.goal)}</div>
              </div>
            `;
            return `
              <div class="ach ${e ? 'earned' : 'locked'}${isNew ? ' new' : ''}" data-ach-id="${a.id}">
                ${isNew ? '<span class="ach-new-dot" title="Click anywhere on this card to dismiss">!</span>' : ''}
                <div class="ach-name">${e ? '◆' : '◇'} ${a.name}</div>
                <div class="ach-desc">${a.desc}</div>
                ${progBar}
                ${bonusLabel ? `<div class="ach-bonus ${e ? 'active' : ''}">${bonusLabel}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
    // Click handler is delegated from dom.achBody itself (see buildFactory) — survives rebuilds.
  }

  // Cheap per-frame update for achievement progress bars (no DOM rebuild).
  function updateAchievementProgress() {
    if (!dom.achBody) return;
    const achMap = state.meta.achievements || {};
    dom.achBody.querySelectorAll('.ach[data-ach-id]').forEach(card => {
      const fillEl = card.querySelector('[data-ach-fill]');
      if (!fillEl) return;
      const id = card.dataset.achId;
      const pr = achieveProgress(id);
      const earned = !!achMap[id];
      const cur = earned ? pr.goal : pr.current;
      const pct = earned ? 100 : Math.min(100, (pr.current / pr.goal) * 100);
      fillEl.style.width = pct + '%';
      const textEl = card.querySelector('[data-ach-text]');
      if (textEl) textEl.textContent = `${fmt(cur)} / ${fmt(pr.goal)}`;
    });
  }

  // ---------- SIDEBAR ----------
  function buildSidebar() {
    sidebarEl.innerHTML = '';
    dom.side = {};

    const statusBox = document.createElement('div');
    statusBox.className = 'side-box status-box';
    statusBox.innerHTML = `
      <h3>◆ STATUS</h3>
      <div class="bigrow"><span class="k">SCHEMATICS</span><b class="v schem" data-schem>0</b></div>
      <div class="bigrow patents-row" data-patents-row style="display:none">
        <span class="k">PATENTS</span><b class="v patents" data-patents>0</b>
      </div>
      <div class="row"><span>MACHINES</span><b data-machines>0</b></div>
      <div class="row"><span>RUN TIME</span><b data-runtime>0s</b></div>
      <div class="row"><span>TOTAL PLAYED</span><b data-playtime>0s</b></div>
    `;
    sidebarEl.appendChild(statusBox);
    dom.side.schem       = statusBox.querySelector('[data-schem]');
    dom.side.patentsRow  = statusBox.querySelector('[data-patents-row]');
    dom.side.patents     = statusBox.querySelector('[data-patents]');
    dom.side.machines    = statusBox.querySelector('[data-machines]');
    dom.side.runtime     = statusBox.querySelector('[data-runtime]');
    dom.side.playtime    = statusBox.querySelector('[data-playtime]');

    // PRESTIGE box
    const prestigeBox = document.createElement('div');
    prestigeBox.className = 'side-box prestige';
    prestigeBox.innerHTML = `
      <h3>⧉ PRESTIGE</h3>
      <div class="big">+<span data-prestige-gain>0</span> <span class="unit">schematics</span></div>
      <div class="row"><span>CORES · RUN</span><b data-run-cores>0</b></div>
      <button class="prestige-btn" data-prestige-btn>◆ RESET FACTORY</button>
    `;
    sidebarEl.appendChild(prestigeBox);
    dom.side.prestigeBox = prestigeBox;
    dom.side.prestigeGain = prestigeBox.querySelector('[data-prestige-gain]');
    dom.side.prestigeRunCores = prestigeBox.querySelector('[data-run-cores]');
    dom.side.prestigeBtn = prestigeBox.querySelector('[data-prestige-btn]');
    dom.side.prestigeBtn.addEventListener('click', () => {
      if (!canPrestige()) return;
      const gain = schematicsForPrestige();
      showModal('◆ CONFIRM PRESTIGE',
        `<p>Reset this run. You'll earn <b style="color:#ffd670">${gain} Schematics</b>.</p>
         <p>Wiped: resources, machines, supports, auto-buy toggles.</p>
         <p>Kept: Schematics, tree levels, prestige count.</p>`,
        { confirmLabel: 'PRESTIGE', onConfirm: (bg) => { bg.remove(); doPrestige(); } });
    });

    // PUBLISH box (shown when prototypes exist or have published)
    const publishBox = document.createElement('div');
    publishBox.className = 'side-box publish';
    publishBox.innerHTML = `
      <h3>⧉⧉ PUBLISH</h3>
      <div class="big">+<span data-publish-gain>0</span> <span class="unit">patents</span></div>
      <div class="row"><span>PROTOTYPES · RUN</span><b data-run-protos>0</b></div>
      <button class="publish-link-btn" data-publish-link>◆ OPEN MASTERY</button>
    `;
    sidebarEl.appendChild(publishBox);
    dom.side.publishBox = publishBox;
    dom.side.publishGain = publishBox.querySelector('[data-publish-gain]');
    dom.side.publishRunProtos = publishBox.querySelector('[data-run-protos]');
    publishBox.querySelector('[data-publish-link]').addEventListener('click', () => setTab('mastery'));

    // SUPPORT
    const supportBox = document.createElement('div');
    supportBox.className = 'side-box';
    supportBox.innerHTML = `
      <h3>SUPPORT · GLOBAL</h3>
      <div class="support-grid" data-support-grid></div>
      <div class="support-desc" data-support-hint></div>
    `;
    sidebarEl.appendChild(supportBox);
    dom.side.supportBox  = supportBox;
    dom.side.supportGrid = supportBox.querySelector('[data-support-grid]');
    dom.side.supportHint = supportBox.querySelector('[data-support-hint]');
    for (const id in SUPPORTS) {
      const s = SUPPORTS[id];
      const btn = document.createElement('button');
      btn.className = 'support-btn'; btn.dataset.support = id;
      btn.innerHTML = `
        <div class="s-name">${s.name}</div>
        <div class="s-count" data-count>×0</div>
        <div class="s-cost" data-cost></div>
      `;
      btn.addEventListener('click', () => { if (buySupport(id)) pulse(btn); });
      dom.side.supportGrid.appendChild(btn);
    }

    // ACTIVITY
    const logBox = document.createElement('div');
    logBox.className = 'side-box activity-box';
    logBox.innerHTML = `
      <div class="log-head">
        <h3>TIPS</h3>
        <div class="log-head-btns">
          <button class="log-clear-btn" data-log-mute title="Mute or unmute future tips">MUTE</button>
          <button class="log-clear-btn" data-log-clear>CLEAR ALL</button>
        </div>
      </div>
      <div class="log-list" data-log></div>
      <div class="log-muted-note" data-muted-note style="display:none">Tips muted. <span class="log-unmute">Click to resume</span>.</div>
    `;
    sidebarEl.appendChild(logBox);
    dom.side.logBox = logBox;
    dom.side.logList = logBox.querySelector('[data-log]');
    dom.side.logClearBtn = logBox.querySelector('[data-log-clear]');
    dom.side.logMuteBtn = logBox.querySelector('[data-log-mute]');
    dom.side.logMutedNote = logBox.querySelector('[data-muted-note]');
    dom.side.logClearBtn.addEventListener('click', () => {
      if (!state.log || state.log.length === 0) return;
      state.log = [];
      prevLogSig = '';
      renderActivityLog();
    });
    dom.side.logMuteBtn.addEventListener('click', () => {
      state.settings.tipsMuted = !state.settings.tipsMuted;
      if (state.settings.tipsMuted) state.log = [];
      prevLogSig = '';
      renderActivityLog();
    });
    logBox.querySelector('.log-unmute').addEventListener('click', () => {
      state.settings.tipsMuted = false;
      prevLogSig = '';
      renderActivityLog();
    });
    // event delegation for per-item × close
    dom.side.logList.addEventListener('click', (e) => {
      const x = e.target.closest('.log-close');
      if (!x) return;
      const idx = parseInt(x.dataset.idx, 10);
      if (!Number.isNaN(idx) && state.log[idx]) {
        state.log.splice(idx, 1);
        prevLogSig = '';
        renderActivityLog();
      }
    });
    prevLogSig = ''; // force fresh render after rebuild
  }
  function renderSidebar() {
    factoryViewEl.classList.toggle('has-sidebar', sidebarVisible());
    if (!sidebarVisible()) return;

    // STATUS box
    let totalMachines = 0;
    for (const id in state.machines) totalMachines += state.machines[id] || 0;
    dom.side.schem.textContent = fmt(state.meta.schematics || 0);
    dom.side.machines.textContent = fmt(totalMachines);
    dom.side.runtime.textContent = fmtDuration(Date.now() - (state.meta.currentRunStartAt || Date.now()));
    dom.side.playtime.textContent = fmtDuration(state.meta.totalPlaytimeMs);
    const patents = state.meta.patents || 0;
    const hasPatentsArea = patents > 0 || (state.meta.publishCount || 0) > 0;
    dom.side.patentsRow.style.display = hasPatentsArea ? '' : 'none';
    if (hasPatentsArea) dom.side.patents.textContent = fmt(patents);

    // PRESTIGE visibility
    dom.side.prestigeBox.style.display = canPrestige() ? '' : 'none';
    if (canPrestige()) {
      dom.side.prestigeGain.textContent = schematicsForPrestige();
      dom.side.prestigeRunCores.textContent = fmt(state.meta.currentRunCores);
      dom.side.prestigeBtn.classList.toggle('dim', schematicsForPrestige() < 1);
    }

    // PUBLISH visibility (any prototypes, or has published before)
    const proto = state.resources.prototype || 0;
    const showPublish = proto > 0 || (state.meta.publishCount || 0) > 0;
    dom.side.publishBox.style.display = showPublish ? '' : 'none';
    if (showPublish) {
      dom.side.publishGain.textContent = patentsForPublish();
      dom.side.publishRunProtos.textContent = fmt(proto);
    }

    const showSupportBox = anySupportUnlocked();
    dom.side.supportBox.style.display = showSupportBox ? '' : 'none';
    if (showSupportBox) {
      dom.side.supportGrid.querySelectorAll('[data-support]').forEach((btn) => {
        const id = btn.dataset.support;
        const s = SUPPORTS[id];
        const unlocked = supportUnlocked(id);
        const owned = state.supports[id] || 0;
        const cost = supportCost(id);
        const afford = canAfford(cost);
        btn.querySelector('[data-count]').textContent = '×' + owned;
        const costText = Object.entries(cost).map(([r, a]) => fmt(a) + ' ' + r).join(' · ');
        btn.querySelector('[data-cost]').textContent = unlocked ? costText : `T${s.unlockTier}+`;
        btn.classList.toggle('owned', owned > 0);
        btn.classList.toggle('unaffordable', unlocked && !afford);
        btn.classList.toggle('locked', !unlocked);
      });
      let hintHtml = '';
      for (const id in SUPPORTS) {
        if (supportUnlocked(id)) hintHtml += `<div><b>${SUPPORTS[id].name}:</b> ${SUPPORTS[id].desc}</div>`;
      }
      dom.side.supportHint.innerHTML = hintHtml;
    }

    renderActivityLog();
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  // Only rebuild log innerHTML when entries change (otherwise the fade-in animation
  // replays every frame and items stay invisible). Between real changes, just
  // refresh the "X ago" timestamps in place.
  let prevLogSig = '';
  function logSig() {
    const first = state.log[0];
    return (state.log?.length || 0) + '|' + (first?.t || 0) + '|' + (first?.text || '');
  }
  function renderActivityLog() {
    if (!dom.side.logList) return;
    const muted = state.settings && state.settings.tipsMuted;
    if (dom.side.logMuteBtn) dom.side.logMuteBtn.textContent = muted ? 'UNMUTE' : 'MUTE';
    if (dom.side.logMutedNote) dom.side.logMutedNote.style.display = muted ? 'block' : 'none';
    if (dom.side.logList) dom.side.logList.style.display = muted ? 'none' : '';

    const sig = logSig() + (muted ? '|m' : '|u');
    const hasLog = state.log && state.log.length > 0;
    if (dom.side.logClearBtn) dom.side.logClearBtn.disabled = !hasLog;

    if (sig === prevLogSig) {
      // just update relative timestamps
      const now = Date.now();
      const items = dom.side.logList.querySelectorAll('.log-item .log-time');
      items.forEach((el, i) => {
        if (state.log[i]) el.textContent = '· ' + fmtAgo(now - state.log[i].t);
      });
      return;
    }
    prevLogSig = sig;

    if (!hasLog) {
      dom.side.logList.innerHTML = `<div class="log-empty">No activity yet.</div>`;
      return;
    }
    const now = Date.now();
    dom.side.logList.innerHTML = state.log.map((e, i) => {
      const isTip = /^TIP/i.test((e.text || '').trim());
      return `<div class="log-item${isTip ? ' tip' : ''}">${escapeHtml(e.text)} <span class="log-time">· ${fmtAgo(now - e.t)}</span><span class="log-close" data-idx="${i}" title="Dismiss">×</span></div>`;
    }).join('');
  }

  // ---------- TIER UNLOCKS BAR ----------
  function buildTierUnlocksBar() {
    tierUnlocksBar.innerHTML = '';
    dom.tierUnlockBtns = {};
    const label = document.createElement('div');
    label.className = 't-label';
    label.textContent = '◆ TIER UNLOCKS';
    tierUnlocksBar.appendChild(label);
    for (const tid of [2, 3, 4, 5, 6]) {
      const tu = TIER_UNLOCKS[tid];
      const btn = document.createElement('button');
      btn.className = 'tier-unlock';
      btn.dataset.tier = tid;
      btn.innerHTML = `
        <div class="tu-name">${tu.name}</div>
        <div class="tu-state" data-state></div>
      `;
      btn.addEventListener('click', () => {
        if (buyTierUnlock(tid)) {
          renderTierUnlocksBar();
          buildFactory();
          buildResBar();
          renderTree();
        }
      });
      tierUnlocksBar.appendChild(btn);
      dom.tierUnlockBtns[tid] = btn;
    }
  }
  function renderTierUnlocksBar() {
    for (const tid of [2, 3, 4, 5, 6]) {
      const btn = dom.tierUnlockBtns[tid];
      if (!btn) continue;
      const owned = tierUnlocked(tid);
      const avail = tierUnlockAvailable(tid);
      const cost = tierUnlockCost(tid);
      const afford = state.meta.schematics >= cost;
      btn.classList.toggle('owned', owned);
      btn.classList.toggle('locked', !owned && !avail);
      btn.classList.toggle('unaffordable', !owned && avail && !afford);
      btn.classList.toggle('affordable', !owned && avail && afford);
      const stateEl = btn.querySelector('[data-state]');
      if (owned) stateEl.textContent = '◆ UNLOCKED';
      else if (!avail) stateEl.textContent = `Req T${tid - 1}`;
      else stateEl.textContent = `${cost} schematic${cost > 1 ? 's' : ''}`;
    }
  }

  // ---------- TREE ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs = {}) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const TREE_CX = 600, TREE_CY = 600;
  const TREE_RADII = { 0: 0, 1: 85, 2: 155, 3: 225, 4: 295, 5: 365, 6: 435, 7: 505, 8: 575 };
  function treePos(nodeId) {
    const n = TREE_NODES[nodeId];
    const rad = n.pos.angle * Math.PI / 180;
    const r = TREE_RADII[n.pos.r];
    return { x: TREE_CX + r * Math.sin(rad), y: TREE_CY - r * Math.cos(rad) };
  }
  function nodeState(id) {
    const lvl = nodeLevel(id);
    const max = nodeMax(id);
    if (lvl >= max) return 'owned';
    if (!nodePrereqsMet(id)) return 'locked';
    return 'available';
  }

  function buildTree() {
    treeSvg.innerHTML = '';
    const g = svgEl('g', { id: 'tree-g' });
    treeSvg.appendChild(g);

    dom.treeLines = [];
    for (const id in TREE_NODES) {
      const n = TREE_NODES[id];
      const to = treePos(id);
      for (const req of n.requires) {
        const from = treePos(req);
        const line = svgEl('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y });
        line.classList.add('tree-line');
        line.dataset.from = req; line.dataset.to = id;
        g.appendChild(line);
        dom.treeLines.push(line);
      }
    }

    dom.treeNodes = {};
    dom.treeLevelTexts = {};
    for (const id in TREE_NODES) {
      const n = TREE_NODES[id];
      const p = treePos(id);
      const grp = svgEl('g', { transform: `translate(${p.x}, ${p.y})` });
      grp.classList.add('tree-node');
      grp.dataset.node = id;
      const radius = id === 'origin' ? 22 : (n.pos.r === 1 ? 16 : 13);

      const bg = svgEl('circle', { cx: 0, cy: 0, r: radius });
      bg.classList.add('bg');
      grp.appendChild(bg);

      const glyphWrap = svgEl('g');
      glyphWrap.innerHTML = BRANCH_GLYPHS[n.branch] || BRANCH_GLYPHS.origin;
      while (glyphWrap.firstChild) grp.appendChild(glyphWrap.firstChild);

      // level text for leveled nodes — goes just below the node circle
      if (n.type === 'leveled') {
        const lvlText = svgEl('text', { x: 0, y: radius + 13, class: 'level-text' });
        lvlText.textContent = '';
        grp.appendChild(lvlText);
        dom.treeLevelTexts[id] = lvlText;
      }

      // name label goes further below (pushed down for leveled nodes so it doesn't collide with level text)
      const labelY = radius + (n.type === 'leveled' ? 26 : 15);
      const label = svgEl('text', { x: 0, y: labelY, class: 'label' });
      label.textContent = n.name;
      grp.appendChild(label);

      grp.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update tooltip anchor from click coords — so taps (no mousemove) still place the tip correctly.
        if (typeof e.clientX === 'number' && (e.clientX || e.clientY)) {
          lastTipMouse.x = e.clientX; lastTipMouse.y = e.clientY;
        } else {
          // Fallback: anchor to the node itself (center in viewport coords).
          const r = grp.getBoundingClientRect();
          lastTipMouse.x = r.left + r.width / 2;
          lastTipMouse.y = r.top + r.height / 2;
        }
        // Only arm nodes that could actually be purchased — skip owned / locked / prereq-missing
        // and also skip "available but unaffordable" so we don't promise a confirm click the user can't deliver.
        if (nodeState(id) !== 'available' || state.meta.schematics < nodeNextCost(id)) {
          disarmNode(); renderTree(); renderTooltipFor(id); return;
        }
        if (armedNode === id) {
          // second click → confirm
          if (researchBuy(id)) { pulseNode(grp); haptic(20); }
          disarmNode();
        } else {
          // first click → arm
          armNode(id);
          haptic(4);
        }
        renderTree();
        renderTooltipFor(id);
      });
      grp.addEventListener('mouseenter', () => renderTooltipFor(id));
      grp.addEventListener('mouseleave', () => hideTooltip());
      grp.addEventListener('mousemove', moveTooltip);

      g.appendChild(grp);
      dom.treeNodes[id] = grp;
    }

    applyViewBox();
    renderTree();
    bindTreeInteractions();
  }

  function pulseNode(g) { g.classList.remove('pulse'); void g.getBBox(); g.classList.add('pulse'); }

  // Two-click confirmation system for tree purchases.
  let armedNode = null;
  let armedResetTimeout = null;
  const ARMED_WINDOW_MS = 3000;
  function armNode(id) {
    armedNode = id;
    if (armedResetTimeout) clearTimeout(armedResetTimeout);
    armedResetTimeout = setTimeout(() => {
      armedNode = null;
      renderTree();
    }, ARMED_WINDOW_MS);
  }
  function disarmNode() {
    armedNode = null;
    if (armedResetTimeout) { clearTimeout(armedResetTimeout); armedResetTimeout = null; }
  }

  function renderTree() {
    for (const id in dom.treeNodes) {
      const g = dom.treeNodes[id];
      const revealed = nodeRevealed(id);
      g.style.display = revealed ? '' : 'none';
      if (!revealed) continue;
      const st = nodeState(id);
      g.classList.remove('owned', 'available', 'locked', 'origin', 'affordable', 'armed');
      if (id === 'origin') g.classList.add('origin');
      g.classList.add(st);
      if (st === 'available' && state.meta.schematics >= nodeNextCost(id)) {
        g.classList.add('affordable');
      }
      if (id === armedNode) g.classList.add('armed');
    }
    // level text — shows the CURRENT level of the node (e.g. "Lv 3/5")
    for (const id in dom.treeLevelTexts) {
      const lvl = nodeLevel(id);
      const max = nodeMax(id);
      const t = dom.treeLevelTexts[id];
      if (lvl <= 0) t.textContent = '';
      else if (lvl >= max) t.textContent = `MAX ${lvl}/${max === 999 ? '∞' : max}`;
      else t.textContent = `Lv ${lvl}/${max === 999 ? '∞' : max}`;
    }
    // lines — only show when both endpoints revealed
    dom.treeLines.forEach((line) => {
      const from = line.dataset.from;
      const to = line.dataset.to;
      const bothRevealed = nodeRevealed(from) && nodeRevealed(to);
      line.style.display = bothRevealed ? '' : 'none';
      if (!bothRevealed) return;
      const fromOwned = nodeLevel(from) > 0;
      const toOwned = nodeLevel(to) > 0;
      line.classList.toggle('owned', fromOwned && toOwned);
      line.classList.toggle('locked', !fromOwned);
    });
  }

  // ---------- TOOLTIP ----------
  let lastTipMouse = { x: 0, y: 0 };
  function renderTooltipFor(id) {
    const n = TREE_NODES[id];
    const st = nodeState(id);
    const lvl = nodeLevel(id);
    const max = nodeMax(id);
    const cost = nodeNextCost(id);
    const canAff = state.meta.schematics >= cost;

    treeTip.classList.remove('cant', 'owned');
    if (st === 'owned') treeTip.classList.add('owned');
    else if (!canAff || st === 'locked') treeTip.classList.add('cant');

    let reqHtml = '';
    if (st === 'locked') {
      const missing = n.requires.filter(r => nodeLevel(r) < 1).map(r => TREE_NODES[r].name).join(', ');
      reqHtml = `<div class="tip-req">REQUIRES · ${missing}</div>`;
    }

    let costHtml = '';
    if (st === 'owned') {
      if (n.type === 'leveled') costHtml = `<div class="tip-cost">◆ MAX LEVEL · ${lvl}/${max === 999 ? '∞' : max}</div>`;
      else costHtml = `<div class="tip-cost">◆ OWNED</div>`;
    } else if (n.type === 'leveled') {
      costHtml = `
        <div class="tip-cost">CURRENT · Lv ${lvl}/${max === 999 ? '∞' : max}</div>
        <div class="tip-cost" style="margin-top:4px">NEXT LEVEL · ${cost} schematic${cost !== 1 ? 's' : ''}</div>
      `;
    } else {
      costHtml = `<div class="tip-cost">COST · ${cost} schematic${cost !== 1 ? 's' : ''}</div>`;
    }

    const typeTag = n.type === 'leveled' ? '<span style="color:#78e08f">LEVELED</span>' : n.type === 'unlock' ? '<span style="color:#ffd670">UNLOCK</span>' : '';

    const confirmHint = (id === armedNode) ? `<div class="tip-confirm">◆ CLICK AGAIN TO CONFIRM</div>` : '';
    treeTip.innerHTML = `
      <div class="tip-name">${n.name} ${typeTag}</div>
      <div class="tip-desc">${n.desc}</div>
      ${costHtml}
      ${reqHtml}
      ${confirmHint}
    `;
    treeTip.style.display = 'block';
    positionTooltip();
  }
  function moveTooltip(e) { lastTipMouse.x = e.clientX; lastTipMouse.y = e.clientY; positionTooltip(); }
  function positionTooltip() {
    const pad = 16, edge = 8;
    let x = lastTipMouse.x + pad, y = lastTipMouse.y + pad;
    const rect = treeTip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = lastTipMouse.x - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = lastTipMouse.y - rect.height - pad;
    // Final clamp: keep tooltip fully on-screen even when both flips overflow (narrow phones).
    x = Math.max(edge, Math.min(x, window.innerWidth - rect.width - edge));
    y = Math.max(edge, Math.min(y, window.innerHeight - rect.height - edge));
    treeTip.style.left = x + 'px'; treeTip.style.top = y + 'px';
  }
  function hideTooltip() { treeTip.style.display = 'none'; }

  // ---------- SLOT TOOLTIP ----------
  let slotTipMouse = { x: 0, y: 0 };
  function showSlotTip(id, e) {
    const m = MACHINES[id];
    if (!m) return;
    slotTipMouse.x = e.clientX; slotTipMouse.y = e.clientY;
    const count = state.machines[id] || 0;
    const unlocked = machineUnlocked(id);
    const r = rm();
    let totalMachines = 0;
    for (const mid in state.machines) totalMachines += state.machines[mid] || 0;
    const prodMul = globalProdMul(totalMachines);
    const consMul = globalConsMul();
    const cost = machineCost(id);
    const afford = canAfford(cost);
    const ratio = runtime.machineRatio[id] ?? 1;
    const bn = runtime.bottleneck[id];

    let body = '';
    // produces
    const produces = Object.entries(m.produces);
    if (produces.length) {
      body += `<div class="srow"><span class="k">PRODUCES</span><span class="v ok">${produces.map(([res, rate]) => fmt(rate * prodMul) + ' ' + res + '/s').join(' · ')}</span></div>`;
      if (count > 0) {
        body += `<div class="srow"><span class="k">TOTAL OUT</span><span class="v ok">${produces.map(([res, rate]) => fmt(rate * count * prodMul * ratio) + ' ' + res + '/s').join(' · ')}</span></div>`;
      }
    }
    // consumes
    const consumes = Object.entries(m.consumes);
    if (consumes.length) {
      body += `<div class="srow"><span class="k">CONSUMES</span><span class="v">${consumes.map(([res, rate]) => fmt(rate * consMul) + ' ' + res + '/s').join(' · ')}</span></div>`;
    }
    if (bn && count > 0) {
      body += `<div class="srow"><span class="k">STATUS</span><span class="v warn">STARVED OF ${bn.toUpperCase()}</span></div>`;
    }
    body += `<div class="sep"></div>`;
    if (unlocked) {
      const costStr = Object.entries(cost).map(([res, amt]) => fmt(amt) + ' ' + res).join(' · ');
      body += `<div class="srow"><span class="k">NEXT COST</span><span class="v ${afford ? 'ok' : 'warn'}">${costStr}</span></div>`;
      body += `<div class="srow"><span class="k">OWNED</span><span class="v">×${count}</span></div>`;
    } else {
      body += `<div class="srow"><span class="k">LOCKED</span><span class="v warn">Unlock ${m.mk.toUpperCase()} in Research</span></div>`;
    }

    // hints for power users. Once we've seen a touchstart this session we assume
    // keyboard/mouse shortcuts aren't the user's primary input.
    const touchMode = lastTouchTime > 0;
    let hint = '';
    if (!touchMode) {
      if (rm().bulkBuy) hint += 'Shift+click: ×10 · Shift+Alt: ×100. ';
      if (rm().maxBuy)  hint += 'Ctrl+Shift: ×1000. ';
      if (rm().autoBuy) hint += 'Right-click: auto-buy toggle.';
    } else {
      if (rm().autoBuy) hint += 'Tap the "A" chip to toggle auto-buy.';
    }
    if (hint) body += `<div class="stip-hint">${hint}</div>`;

    slotTip.innerHTML = `<div class="stn">${m.name}</div>${body}`;
    slotTip.style.display = 'block';
    positionSlotTip();
  }
  function moveSlotTip(e) {
    slotTipMouse.x = e.clientX; slotTipMouse.y = e.clientY;
    positionSlotTip();
  }
  function positionSlotTip() {
    const pad = 14, edge = 8;
    let x = slotTipMouse.x + pad;
    let y = slotTipMouse.y + pad;
    const rect = slotTip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = slotTipMouse.x - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = slotTipMouse.y - rect.height - pad;
    x = Math.max(edge, Math.min(x, window.innerWidth - rect.width - edge));
    y = Math.max(edge, Math.min(y, window.innerHeight - rect.height - edge));
    slotTip.style.left = x + 'px'; slotTip.style.top = y + 'px';
  }
  function hideSlotTip() { slotTip.style.display = 'none'; }

  // ---------- PAN / ZOOM ----------
  const VIEWBOX_DEFAULT = { x: 0, y: 0, w: 1200, h: 1200 };
  let viewBox = { ...VIEWBOX_DEFAULT };
  function applyViewBox() { treeSvg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`); }
  function zoomBy(factor, cx = 0.5, cy = 0.5) {
    const newW = Math.max(400, Math.min(2400, viewBox.w * factor));
    const newH = viewBox.h * (newW / viewBox.w);
    viewBox.x += (viewBox.w - newW) * cx;
    viewBox.y += (viewBox.h - newH) * cy;
    viewBox.w = newW; viewBox.h = newH;
    applyViewBox();
  }
  function resetView() {
    viewBox = { ...VIEWBOX_DEFAULT };
    applyViewBox();
  }
  let dragging = false, dragStart = null;
  function bindTreeInteractions() {
    // zoom buttons
    document.querySelectorAll('.tree-zoom [data-zoom]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.zoom;
        if (mode === 'in')    zoomBy(0.8);
        if (mode === 'out')   zoomBy(1.25);
        if (mode === 'reset') resetView();
      });
    });
    treeCanvas.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tree-node')) return;
      // Background click → disarm any pending two-click confirmation
      if (armedNode !== null) { disarmNode(); renderTree(); }
      dragging = true;
      dragStart = { x: e.clientX, y: e.clientY, vbx: viewBox.x, vby: viewBox.y };
      treeCanvas.classList.add('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = treeCanvas.getBoundingClientRect();
      const scale = viewBox.w / rect.width;
      viewBox.x = dragStart.vbx - (e.clientX - dragStart.x) * scale;
      viewBox.y = dragStart.vby - (e.clientY - dragStart.y) * scale;
      applyViewBox();
    });
    window.addEventListener('mouseup', () => { dragging = false; treeCanvas.classList.remove('dragging'); });
    treeCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = treeCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const zoom = e.deltaY > 0 ? 1.1 : 0.9;
      const newW = Math.max(400, Math.min(2000, viewBox.w * zoom));
      const newH = viewBox.h * (newW / viewBox.w);
      viewBox.x += (viewBox.w - newW) * mx;
      viewBox.y += (viewBox.h - newH) * my;
      viewBox.w = newW; viewBox.h = newH;
      applyViewBox();
    }, { passive: false });

    // ---------- TOUCH: pan (1 finger) + pinch-zoom (2 fingers) ----------
    // Stored per active pointer to compute distance deltas for pinch.
    const activeTouches = new Map(); // id -> { x, y }
    let touchPanStart = null;        // { x, y, vbx, vby }
    let pinchStart = null;           // { dist, cx, cy, vbx, vby, vbw, vbh }
    let touchMoved = false;

    function touchCenter() {
      let sx = 0, sy = 0, n = 0;
      for (const p of activeTouches.values()) { sx += p.x; sy += p.y; n++; }
      return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
    }
    function touchDistance() {
      const pts = [...activeTouches.values()];
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      return Math.hypot(dx, dy);
    }
    treeCanvas.addEventListener('touchstart', (e) => {
      // Let single-finger taps on nodes through; pan only on empty canvas.
      // For 2-finger gestures we always take over so pinch works anywhere.
      if (e.touches.length === 1 && e.target.closest('.tree-node')) return;
      e.preventDefault();
      activeTouches.clear();
      for (const t of e.touches) activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      touchMoved = false;
      if (activeTouches.size === 1) {
        const p = activeTouches.values().next().value;
        touchPanStart = { x: p.x, y: p.y, vbx: viewBox.x, vby: viewBox.y };
        pinchStart = null;
      } else if (activeTouches.size === 2) {
        const c = touchCenter();
        pinchStart = {
          dist: touchDistance(),
          cx: c.x, cy: c.y,
          vbx: viewBox.x, vby: viewBox.y,
          vbw: viewBox.w, vbh: viewBox.h,
        };
        touchPanStart = null;
      }
      treeCanvas.classList.add('dragging');
    }, { passive: false });

    treeCanvas.addEventListener('touchmove', (e) => {
      if (!activeTouches.size) return;
      e.preventDefault();
      for (const t of e.touches) {
        if (activeTouches.has(t.identifier)) activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      touchMoved = true;
      const rect = treeCanvas.getBoundingClientRect();
      if (activeTouches.size === 1 && touchPanStart) {
        const p = activeTouches.values().next().value;
        const scale = viewBox.w / rect.width;
        viewBox.x = touchPanStart.vbx - (p.x - touchPanStart.x) * scale;
        viewBox.y = touchPanStart.vby - (p.y - touchPanStart.y) * scale;
        applyViewBox();
      } else if (activeTouches.size >= 2 && pinchStart) {
        const c = touchCenter();
        const d = touchDistance();
        if (!d || !pinchStart.dist) return;
        const zoomFactor = pinchStart.dist / d;
        const newW = Math.max(400, Math.min(2400, pinchStart.vbw * zoomFactor));
        const newH = pinchStart.vbh * (newW / pinchStart.vbw);
        // anchor zoom on the initial pinch center (in canvas coords), then also apply center drift.
        const ax = (pinchStart.cx - rect.left) / rect.width;
        const ay = (pinchStart.cy - rect.top) / rect.height;
        const scale = pinchStart.vbw / rect.width;
        const dxPx = c.x - pinchStart.cx;
        const dyPx = c.y - pinchStart.cy;
        viewBox.x = pinchStart.vbx + (pinchStart.vbw - newW) * ax - dxPx * scale;
        viewBox.y = pinchStart.vby + (pinchStart.vbh - newH) * ay - dyPx * scale;
        viewBox.w = newW; viewBox.h = newH;
        applyViewBox();
      }
    }, { passive: false });

    function endTouch(e) {
      if (e && e.changedTouches) {
        for (const t of e.changedTouches) activeTouches.delete(t.identifier);
      }
      if (activeTouches.size === 0) {
        touchPanStart = null; pinchStart = null;
        treeCanvas.classList.remove('dragging');
        // A stationary touch on empty canvas → disarm any pending confirm.
        if (!touchMoved && armedNode !== null && e && e.target && !e.target.closest('.tree-node')) {
          disarmNode(); renderTree();
        }
      } else if (activeTouches.size === 1) {
        // second finger lifted — reset to single-finger pan from current pos
        const p = activeTouches.values().next().value;
        touchPanStart = { x: p.x, y: p.y, vbx: viewBox.x, vby: viewBox.y };
        pinchStart = null;
      }
    }
    treeCanvas.addEventListener('touchend', endTouch, { passive: true });
    treeCanvas.addEventListener('touchcancel', endTouch, { passive: true });
  }

  // ---------- UNLOCK WATCHER ----------
  let prevUnlockSig = '';
  function checkUnlockChanges() {
    const tierSig = TIERS.map(t => tierUnlocked(t.id) ? '1' : '0').join('');
    const mkSig = (state.research.levels.mk4 ? 'A' : 'a') + (state.research.levels.mk5 ? 'B' : 'b');
    const sig = tierSig + '/' + mkSig;
    if (sig !== prevUnlockSig) {
      prevUnlockSig = sig;
      buildResBar(); buildFactory();
    }
    tabTreeEl.classList.toggle('hidden', !treeTabVisible());
    tabStatsEl.classList.toggle('hidden', !statsTabVisible());
    tabMasteryEl.classList.toggle('hidden', !masteryTabVisible());
  }

  function rebuildAll() {
    buildResBar(); buildFactory(); buildSidebar(); buildTierUnlocksBar(); buildTree();
    buildAchievementsView();
    tabTreeEl.classList.toggle('hidden', !treeTabVisible());
    tabStatsEl.classList.toggle('hidden', !statsTabVisible());
    tabMasteryEl.classList.toggle('hidden', !masteryTabVisible());
  }

  function statsTabVisible() { return sidebarVisible(); }
  function masteryTabVisible() {
    return (state.resources.prototype || 0) > 0
        || (state.meta.patents || 0) > 0
        || (state.meta.publishCount || 0) > 0
        || tierUnlocked(6);
  }

  // ---------- STATS VIEW ----------
  function renderStats() {
    if (!statsBodyEl) return;
    const m = state.meta;
    const run = m.currentRunStartAt ? (Date.now() - m.currentRunStartAt) : 0;

    let machineRows = '';
    let totalMachines = 0;
    for (const id in state.machines) {
      const c = state.machines[id] || 0;
      totalMachines += c;
      if (c > 0) machineRows += `<div class="r"><span class="k">${MACHINES[id].name}</span><span class="v">×${fmt(c)}</span></div>`;
    }
    if (!machineRows) machineRows = `<div class="r"><span class="k">— no machines built yet —</span><span class="v"></span></div>`;

    let supportRows = '';
    for (const id in state.supports) {
      const c = state.supports[id] || 0;
      if (c > 0) supportRows += `<div class="r"><span class="k">${SUPPORTS[id].name}</span><span class="v">×${fmt(c)}</span></div>`;
    }

    let researchRows = '';
    for (const id in state.research.levels) {
      const lvl = state.research.levels[id];
      if (id === 'origin' || lvl <= 0) continue;
      const node = TREE_NODES[id];
      if (!node) continue;
      const max = nodeMax(id);
      researchRows += `<div class="r"><span class="k">${node.name}</span><span class="v ${lvl >= max ? 'ok' : 'hi'}">Lv ${lvl}${max < 999 ? '/' + max : ''}</span></div>`;
    }
    if (!researchRows) researchRows = `<div class="r"><span class="k">— no research purchased —</span><span class="v"></span></div>`;

    const lifetime = m.lifetimeProduced || emptyResources();
    const thisRun = m.totalProduced || emptyResources();

    // Achievements are now shown below the factory tiers (collapsible section).
    // The stats view keeps only an earned-count summary.
    const achMap = m.achievements || {};
    let earnedCount = 0, totalCount = 0;
    for (const id in ACHIEVEMENTS) { totalCount++; if (achMap[id]) earnedCount++; }

    statsBodyEl.innerHTML = `
      <div class="stats-block">
        <h3>◆ ALL-TIME</h3>
        <div class="rows">
          <div class="r"><span class="k">ACHIEVEMENTS</span><span class="v hi">${earnedCount} / ${totalCount}</span></div>
          <div class="r"><span class="k">PUBLISHES</span><span class="v hi">${fmt(m.publishCount || 0)}</span></div>
          <div class="r"><span class="k">PATENTS EARNED</span><span class="v hi">${fmt(m.totalPatents || 0)}</span></div>
          <div class="r"><span class="k">PATENTS NOW</span><span class="v ok">${fmt(m.patents || 0)}</span></div>
          <div class="r"><span class="k">PRESTIGES (EPOCH)</span><span class="v hi">${fmt(m.prestigeCount)}</span></div>
          <div class="r"><span class="k">PRESTIGES (LIFETIME)</span><span class="v">${fmt(m.lifetimePrestiges || m.prestigeCount || 0)}</span></div>
          <div class="r"><span class="k">SCHEMATICS (LIFETIME)</span><span class="v">${fmt(m.lifetimeSchematics || m.totalSchematics || 0)}</span></div>
          <div class="r"><span class="k">SCHEMATICS NOW</span><span class="v ok">${fmt(m.schematics)}</span></div>
          <div class="r"><span class="k">TOTAL PLAYTIME</span><span class="v">${fmtDuration(m.totalPlaytimeMs)}</span></div>
          <div class="r"><span class="k">TOTAL CLICKS</span><span class="v">${fmt(m.totalClicks)}</span></div>
        </div>
      </div>
      <div class="stats-block">
        <h3>◆ LIFETIME PRODUCTION</h3>
        <div class="rows">
          <div class="r"><span class="k">ORE</span><span class="v">${fmt(lifetime.ore || 0)}</span></div>
          <div class="r"><span class="k">INGOT</span><span class="v">${fmt(lifetime.ingot || 0)}</span></div>
          <div class="r"><span class="k">PART</span><span class="v">${fmt(lifetime.part || 0)}</span></div>
          <div class="r"><span class="k">CIRCUIT</span><span class="v">${fmt(lifetime.circuit || 0)}</span></div>
          <div class="r"><span class="k">CORE</span><span class="v">${fmt(lifetime.core || 0)}</span></div>
          <div class="r"><span class="k">PROTOTYPE</span><span class="v hi">${fmt(lifetime.prototype || 0)}</span></div>
        </div>
      </div>
      <div class="stats-block">
        <h3>◆ THIS RUN</h3>
        <div class="rows">
          <div class="r"><span class="k">DURATION</span><span class="v">${fmtDuration(run)}</span></div>
          <div class="r"><span class="k">ORE</span><span class="v">${fmt(thisRun.ore || 0)}</span></div>
          <div class="r"><span class="k">INGOT</span><span class="v">${fmt(thisRun.ingot || 0)}</span></div>
          <div class="r"><span class="k">PART</span><span class="v">${fmt(thisRun.part || 0)}</span></div>
          <div class="r"><span class="k">CIRCUIT</span><span class="v">${fmt(thisRun.circuit || 0)}</span></div>
          <div class="r"><span class="k">CORE</span><span class="v ok">${fmt(thisRun.core || 0)}</span></div>
          <div class="r"><span class="k">PROTOTYPE</span><span class="v hi">${fmt(state.resources.prototype || 0)}</span></div>
          <div class="r"><span class="k">NEXT PRESTIGE</span><span class="v">+${schematicsForPrestige()} schematics</span></div>
          <div class="r"><span class="k">NEXT PUBLISH</span><span class="v hi">+${patentsForPublish()} patents</span></div>
        </div>
      </div>
      <div class="stats-block">
        <h3>◆ MACHINES · ${fmt(totalMachines)} TOTAL</h3>
        <div class="rows">${machineRows}</div>
      </div>
      ${supportRows ? `<div class="stats-block"><h3>◆ SUPPORTS</h3><div class="rows">${supportRows}</div></div>` : ''}
      <div class="stats-block">
        <h3>◆ RESEARCH</h3>
        <div class="rows">${researchRows}</div>
      </div>
    `;
  }

  // ---------- MASTERY VIEW ----------
  function renderMastery() {
    if (!masteryBodyEl) return;
    const prototypes = state.resources.prototype || 0;
    const patents = state.meta.patents || 0;
    const publishes = state.meta.publishCount || 0;
    const gain = patentsForPublish();
    const canPub = canPublish();

    const intro = publishes === 0
      ? `<div class="mastery-intro">
          <h4>◆ WHAT IS THIS?</h4>
          <div>Your <b>Refinery</b> machines (T6) convert Cores into <b>Prototypes</b> — the perfected final product of your factory. Once you have Prototypes, you can <b>Publish</b> your work as Patents. Publishing <b>wipes everything</b> (resources, machines, Schematics, the research tree, tier unlocks) but Patents and their permanent upgrades persist forever. Every Publish accelerates your next run.</div>
         </div>`
      : '';

    const patentCards = Object.entries(PATENTS).map(([id, p]) => {
      const lvl = patentLevel(id);
      const max = patentMax(id);
      const cost = patentNextCost(id);
      const prereqMet = patentPrereqsMet(id);
      const owned = lvl > 0 && p.type === 'unlock';
      const maxed = lvl >= max;
      const canBuy = canBuyPatent(id);
      const afford = patents >= cost && prereqMet && !maxed;

      let cls = 'patent';
      if (maxed) cls += ' maxed';
      else if (!prereqMet) cls += ' locked';
      else if (!afford) cls += ' unaffordable';
      else cls += ' affordable';

      let levelLabel;
      if (p.type === 'unlock') levelLabel = owned ? '◆ OWNED' : '◆ UNLOCK';
      else levelLabel = maxed ? `MAX · ${max}/${max}` : `Lv ${lvl}/${max}`;

      let costLabel;
      if (maxed) costLabel = 'FULLY RESEARCHED';
      else if (p.type === 'leveled') costLabel = `NEXT · ${cost} patent${cost !== 1 ? 's' : ''}`;
      else costLabel = `${cost} patent${cost !== 1 ? 's' : ''}`;

      let reqLabel = '';
      if (!prereqMet) {
        const missing = p.requires.filter(r => patentLevel(r) < 1).map(r => PATENTS[r].name).join(', ');
        reqLabel = `<div class="preq">REQUIRES · ${missing}</div>`;
      }

      return `<button class="${cls}" data-patent="${id}" ${canBuy ? '' : 'disabled'}>
        <div class="plevel">${levelLabel}</div>
        <div class="ptitle">${p.name}</div>
        <div class="pdesc">${p.desc}</div>
        <div class="pcost">${costLabel}</div>
        ${reqLabel}
      </button>`;
    }).join('');

    masteryBodyEl.innerHTML = `
      <div class="mastery-header">
        <div class="mastery-title">MASTERY · PATENT LIBRARY</div>
        <div class="mastery-stats">
          <div class="st"><div class="k">PROTOTYPES</div><div class="v">${fmt(prototypes)}</div></div>
          <div class="st"><div class="k">PATENTS</div><div class="v patents">${fmt(patents)}</div></div>
          <div class="st"><div class="k">PUBLISHES</div><div class="v patents">${fmt(publishes)}</div></div>
        </div>
      </div>

      ${intro}

      <div class="publish-bar ${canPub ? '' : 'locked'}">
        <div class="pb-info">
          <div class="pbt">${canPub ? '◆ READY TO PUBLISH' : '◆ PUBLISH LOCKED'}</div>
          <div class="pbd">${canPub
            ? 'Wipes all Schematics, research tree, tier unlocks, and factory state. Keeps only Patents and Patent upgrades.'
            : 'Produce <b>Prototypes</b> via T6 Refinement machines to Publish.'}</div>
        </div>
        <div class="pb-gain">
          <div class="k">YOU WILL EARN</div>
          <div class="v">+${fmt(gain)} PATENT${gain !== 1 ? 'S' : ''}</div>
        </div>
        <button class="publish-btn" data-publish-btn ${canPub ? '' : 'disabled'}>◆ PUBLISH</button>
      </div>

      ${(patentLevel('auto_prestige_pat') > 0 || patentLevel('auto_publish_pat') > 0) ? `
        <div class="auto-section">
          <div class="section-title">◆ AUTOMATION</div>
          ${patentLevel('auto_prestige_pat') > 0 ? `
            <div class="auto-row">
              <label><input type="checkbox" data-auto-prestige-toggle ${state.settings.autoPrestige.enabled ? 'checked' : ''}> AUTO-PRESTIGE</label>
              <span class="auto-hint">when gain ≥</span>
              <input type="number" min="1" value="${state.settings.autoPrestige.threshold}" data-auto-prestige-thr class="auto-num">
              <span class="auto-hint">schematics</span>
            </div>
          ` : ''}
          ${patentLevel('auto_publish_pat') > 0 ? `
            <div class="auto-row">
              <label><input type="checkbox" data-auto-publish-toggle ${state.settings.autoPublish.enabled ? 'checked' : ''}> AUTO-PUBLISH</label>
              <span class="auto-hint">when prototypes ≥</span>
              <input type="number" min="1" value="${state.settings.autoPublish.threshold}" data-auto-publish-thr class="auto-num">
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="section-title">◆ PATENT LIBRARY · SPEND PATENTS FOR PERMANENT BOOSTS</div>
      <div class="patents-grid">${patentCards}</div>
    `;

    // wire up handlers (delegate)
    masteryBodyEl.querySelector('[data-publish-btn]')?.addEventListener('click', () => {
      if (!canPublish()) return;
      const g = patentsForPublish();
      showModal('◆ CONFIRM PUBLISH',
        `<p>Publish your work for <b style="color:#ffd670">${g} Patent${g !== 1 ? 's' : ''}</b>.</p>
         <p>This will <b style="color:#ff7e5f">wipe</b>: resources, machines, supports, Schematics, research tree, tier unlocks, current prestige progress.</p>
         <p>Kept: Patents, Patent upgrades, playtime stats, settings.</p>`,
        { confirmLabel: 'PUBLISH', onConfirm: (bg) => { bg.remove(); doPublish(); } });
    });
    masteryBodyEl.querySelectorAll('[data-patent]').forEach((btn) => {
      const id = btn.dataset.patent;
      btn.addEventListener('click', () => {
        if (buyPatent(id)) renderMastery();
      });
    });

    // auto-prestige / auto-publish toggles
    const apTog = masteryBodyEl.querySelector('[data-auto-prestige-toggle]');
    const apThr = masteryBodyEl.querySelector('[data-auto-prestige-thr]');
    if (apTog) apTog.addEventListener('change', (e) => { state.settings.autoPrestige.enabled = e.target.checked; });
    if (apThr) apThr.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v > 0) state.settings.autoPrestige.threshold = v;
    });
    const apuTog = masteryBodyEl.querySelector('[data-auto-publish-toggle]');
    const apuThr = masteryBodyEl.querySelector('[data-auto-publish-thr]');
    if (apuTog) apuTog.addEventListener('change', (e) => { state.settings.autoPublish.enabled = e.target.checked; });
    if (apuThr) apuThr.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v > 0) state.settings.autoPublish.threshold = v;
    });
  }

  // ---------- SETTINGS MODAL ----------
  function showSettings() {
    const s = state.settings;
    const bg = showModal('SETTINGS', `
      <div class="settings-group">
        <h4>AUDIO</h4>
        <div class="settings-row">
          <span class="label">VOLUME</span>
          <input type="range" id="set-vol" min="0" max="1" step="0.05" value="${s.volume}">
          <span class="val" id="set-vol-val">${Math.round(s.volume * 100)}%</span>
        </div>
        <div class="settings-row">
          <span class="label">MUTED</span>
          <div class="seg">
            <button id="set-mute-off" class="${!s.muted ? 'on' : ''}">OFF</button>
            <button id="set-mute-on"  class="${ s.muted ? 'on' : ''}">ON</button>
          </div>
        </div>
      </div>
      <div class="settings-group">
        <h4>DISPLAY</h4>
        <div class="settings-row">
          <span class="label">NOTATION</span>
          <div class="seg">
            <button id="set-not-si"  class="${s.notation !== 'sci' ? 'on' : ''}">K / M / B</button>
            <button id="set-not-sci" class="${s.notation === 'sci' ? 'on' : ''}">SCIENTIFIC</button>
          </div>
        </div>
      </div>
      ${navigator.vibrate ? `
      <div class="settings-group">
        <h4>TOUCH</h4>
        <div class="settings-row">
          <span class="label">HAPTIC FEEDBACK</span>
          <div class="seg">
            <button id="set-hap-on"  class="${s.haptics !== false ? 'on' : ''}">ON</button>
            <button id="set-hap-off" class="${s.haptics === false ? 'on' : ''}">OFF</button>
          </div>
        </div>
      </div>` : ''}
      <div class="settings-group">
        <h4>ONBOARDING</h4>
        <div class="settings-row">
          <span class="label">RESET ALL HINTS</span>
          <button class="btn" id="set-reset-hints">CLEAR</button>
        </div>
      </div>
      <div class="settings-group">
        <h4>SAVE &amp; SYSTEM</h4>
        ${fsSupported ? `
        <div class="settings-row">
          <span class="label">FULLSCREEN</span>
          <button class="btn" id="set-fullscreen">${inFullscreen() ? 'EXIT' : 'ENTER'}</button>
        </div>` : ''}
        <div class="settings-row">
          <span class="label">EXPORT SAVE</span>
          <button class="btn" id="set-export">EXPORT</button>
        </div>
        <div class="settings-row">
          <span class="label">IMPORT SAVE</span>
          <button class="btn" id="set-import">IMPORT</button>
        </div>
        <div class="settings-row">
          <span class="label">RESET GAME</span>
          <button class="btn warn" id="set-reset">WIPE</button>
        </div>
      </div>
      <div class="settings-group">
        <h4>CONTROLS</h4>
        <div style="font-family: var(--font-ui); font-size: 11px; color: var(--text); line-height: 1.8;">
          <div><b style="color:var(--accent)">CLICK</b> machine to buy 1</div>
          <div><b style="color:var(--accent)">SHIFT+CLICK</b> to buy ×10 (requires Bulk Buy)</div>
          <div><b style="color:var(--accent)">SHIFT+ALT+CLICK</b> to buy ×100</div>
          <div><b style="color:var(--accent)">CTRL+SHIFT+CLICK</b> to buy ×1000 (requires Max Buy)</div>
          <div><b style="color:var(--accent)">RIGHT-CLICK</b> to toggle auto-buy (requires Auto-Buy)</div>
          <div><b style="color:var(--accent)">DRAG</b> on research tree to pan · <b style="color:var(--accent)">SCROLL</b> to zoom</div>
        </div>
      </div>
    `);

    const vol = bg.querySelector('#set-vol');
    const volVal = bg.querySelector('#set-vol-val');
    vol.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      s.volume = v;
      volVal.textContent = Math.round(v * 100) + '%';
      audio.setVolume(v);
      if (v > 0) audio.click();
    });
    bg.querySelector('#set-mute-off').addEventListener('click', () => { s.muted = false; save(); showSettings(); bg.remove(); });
    bg.querySelector('#set-mute-on').addEventListener('click',  () => { s.muted = true;  save(); showSettings(); bg.remove(); });
    bg.querySelector('#set-not-si').addEventListener('click',  () => { s.notation = 'si';  save(); showSettings(); bg.remove(); });
    bg.querySelector('#set-not-sci').addEventListener('click', () => { s.notation = 'sci'; save(); showSettings(); bg.remove(); });
    const hapOn = bg.querySelector('#set-hap-on');
    const hapOff = bg.querySelector('#set-hap-off');
    if (hapOn)  hapOn.addEventListener('click',  () => { s.haptics = true;  haptic(20); save(); showSettings(); bg.remove(); });
    if (hapOff) hapOff.addEventListener('click', () => { s.haptics = false; save(); showSettings(); bg.remove(); });
    bg.querySelector('#set-reset-hints').addEventListener('click', () => {
      s.hintsShown = {};
      toast('<b>Hints cleared.</b> They will appear again as you play.');
    });
    const fsBtn = bg.querySelector('#set-fullscreen');
    if (fsBtn) fsBtn.addEventListener('click', () => {
      toggleFullscreen();
      // Refresh the label — the state flip is async, so give the event a tick.
      setTimeout(() => { fsBtn.textContent = inFullscreen() ? 'EXIT' : 'ENTER'; }, 100);
    });
    bg.querySelector('#set-export').addEventListener('click', () => { bg.remove(); actionExport(); });
    bg.querySelector('#set-import').addEventListener('click', () => { bg.remove(); actionImport(); });
    bg.querySelector('#set-reset').addEventListener('click',  () => { bg.remove(); actionReset(); });
  }

  // ---------- RENDER ----------
  const topEl = {
    fps:     document.getElementById('fps'),
    session: document.getElementById('session'),
    saved:   document.getElementById('saved'),
  };
  let frameCount = 0, fpsAccum = 0, fpsDisplay = 0;

  function renderFactory() {
    renderMineBar();

    // buy-mode bar state
    if (dom.buyBar) {
      const r = rm();
      // The bar itself is pointless until Bulk Buy research is owned — hide it entirely
      // so new players don't see a row of locked buttons they can't interact with.
      const showBar = !!r.bulkBuy;
      dom.buyBar.style.display = showBar ? '' : 'none';
      if (showBar) {
        const allow = {
          '1':    true,
          '10':   !!r.bulkBuy,
          '100':  !!r.bulkBuy,
          '1000': !!r.maxBuy,
          'max':  !!r.maxBuy,
        };
        if (!allow[state.settings.buyMode || '1']) state.settings.buyMode = '1';
        const current = state.settings.buyMode || '1';
        dom.buyBar.querySelectorAll('[data-mode]').forEach(btn => {
          const m = btn.dataset.mode;
          btn.classList.toggle('locked', !allow[m]);
          btn.classList.toggle('on', allow[m] && m === current);
        });
        const hint = dom.buyBar.querySelector('[data-bm-hint]');
        if (hint) {
          if (!r.maxBuy) hint.textContent = 'Unlock MAX BUY for ×1000 / MAX';
          else hint.textContent = '';
        }
      } else {
        // Drop any stale bulk-mode setting so buying still works if the player somehow picked ×10 before.
        if ((state.settings.buyMode || '1') !== '1') state.settings.buyMode = '1';
      }
    }

    TIERS.forEach((tier) => {
      const row = dom.tiers[tier.id];
      if (!row) return;
      const unlocked = tierUnlocked(tier.id);
      if (!unlocked) return;  // static hint, rebuilt on unlock change
      const rateEl = row.querySelector('[data-rate]');
      if (rateEl) rateEl.textContent = '+' + fmt(runtime.tierRate[tier.id] || 0) + ' ' + tier.resource + '/s';

      row.querySelectorAll('.slot[data-machine]').forEach((slot) => {
        const id = slot.dataset.machine;
        const owned = state.machines[id] || 0;
        const unlocked = machineUnlocked(id);
        const cost = machineCost(id);
        const afford = canAfford(cost);

        slot.querySelector('[data-count]').textContent = '×' + owned;
        slot.querySelector('[data-cost]').textContent = unlocked
          ? Object.entries(cost).map(([r, a]) => fmt(a) + ' ' + r).join(' · ')
          : (MACHINES[id].mk === 'mk4' ? 'MK-IV LOCKED' : 'MK-V LOCKED');

        slot.classList.toggle('owned', owned > 0);
        slot.classList.toggle('affordable', unlocked && afford);
        slot.classList.toggle('unaffordable', unlocked && !afford);
        slot.classList.toggle('locked', !unlocked);

        const bn = runtime.bottleneck[id];
        slot.classList.toggle('bottlenecked', owned > 0 && !!bn);
        const bnEl = slot.querySelector('[data-bn]');
        if (bnEl) bnEl.title = bn ? 'starved of ' + bn : '';

        const autoOn = !!state.settings.autoBuy[id];
        slot.classList.toggle('auto-buy-on', autoOn && unlocked);
        slot.classList.toggle('show-auto-chip', !!rm().autoBuy && unlocked);
      });
    });
  }

  function renderTreeHeader() {
    if (rpValueEl) rpValueEl.textContent = fmt(state.meta.schematics);
    if (prestigeCountEl) prestigeCountEl.textContent = state.meta.prestigeCount || 0;
    renderTierUnlocksBar();
  }

  function render() {
    topEl.fps.textContent = fpsDisplay + ' fps';
    topEl.session.textContent = fmtDuration(Date.now() - sessionStartAt);
    const sinceSave = Date.now() - state.lastSaveAt;
    topEl.saved.textContent = sinceSave < 2000 ? 'just now' : fmtDuration(sinceSave) + ' ago';
    renderResBar();
    renderFactory();
    renderAchievementsSection();
    updateAchievementProgress();
    renderSidebar();
    renderTreeHeader();
    if (state.meta.currentTab === 'stats' && Date.now() - lastStatsRender > 500) {
      renderStats();
      lastStatsRender = Date.now();
    }
    if (state.meta.currentTab === 'mastery' && Date.now() - lastMasteryRender > 500) {
      renderMastery();
      lastMasteryRender = Date.now();
    }
  }
  let lastStatsRender = 0;
  let lastMasteryRender = 0;

  // ---------- MAIN LOOP ----------
  let lastFrameAt = performance.now();
  let lastSaveCheck = Date.now();
  function loop(nowPerf) {
    const dtMs = nowPerf - lastFrameAt;
    lastFrameAt = nowPerf;
    const dt = Math.min(dtMs / 1000, 1/15);
    tick(dt);
    state.lastTickAt = Date.now();
    frameCount++; fpsAccum += dtMs;
    if (fpsAccum >= 500) { fpsDisplay = Math.round((frameCount * 1000) / fpsAccum); frameCount = 0; fpsAccum = 0; }
    if (Date.now() - lastSaveCheck > SAVE_INTERVAL) { lastSaveCheck = Date.now(); save(); }
    checkUnlockChanges();
    checkAchievements();
    render();
    requestAnimationFrame(loop);
  }

  // ---------- MODALS ----------
  function showModal(title, body, opts = {}) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        ${body}
        <div class="actions">
          ${opts.confirmLabel ? `<button class="btn" data-action="confirm">${opts.confirmLabel}</button>` : ''}
          <button class="btn" data-action="close">${opts.closeLabel || 'CLOSE'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(bg);
    bg.addEventListener('click', (e) => {
      if (e.target === bg || e.target.dataset.action === 'close') { bg.remove(); opts.onClose && opts.onClose(); }
      else if (e.target.dataset.action === 'confirm') { opts.onConfirm && opts.onConfirm(bg); }
    });
    return bg;
  }
  function showWelcomeBack(report) {
    const entries = Object.entries(report.earned);
    const list = entries.length
      ? entries.map(([r, v]) => `<li>${fmt(v)} ${r}</li>`).join('')
      : `<li class="none">No production while you were away.</li>`;
    showModal('◆ WELCOME BACK',
      `<p>You were away for <b>${fmtDuration(report.elapsed)}</b>${report.elapsed >= OFFLINE_CAP_MS - 1000 ? ' (capped at 8h)' : ''}.</p>
       <ul class="earned-list">${list}</ul>`);
  }
  // ---------- SYSTEM ACTIONS (wired from the Settings modal) ----------
  const fsSupported = !!(document.documentElement.requestFullscreen
    || document.documentElement.webkitRequestFullscreen);
  function inFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function toggleFullscreen() {
    const doc = document;
    if (inFullscreen()) {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    } else {
      const el = doc.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  }
  function actionExport() {
    save();
    showModal('EXPORT SAVE',
      `<p>Copy this string. Paste it into IMPORT to restore your game.</p>
       <textarea readonly>${exportSave()}</textarea>`);
  }
  function actionImport() {
    showModal('IMPORT SAVE',
      `<p>Paste an exported save string. This will overwrite your current progress.</p>
       <textarea placeholder="paste save string..."></textarea>`,
      { confirmLabel: 'IMPORT', onConfirm: (bg) => {
        const code = bg.querySelector('textarea').value;
        if (importSave(code)) {
          bg.remove(); prevUnlockSig = ''; rebuildAll();
          showModal('◆ IMPORT OK', `<p>Save restored.</p>`);
        } else showModal('◆ IMPORT FAILED', `<p>That save string isn't valid.</p>`);
      }});
  }
  function actionReset() {
    showModal('RESET GAME', `<p>Wipe all progress (including Schematics and tree)?</p>`,
      { confirmLabel: 'WIPE', onConfirm: (bg) => { wipe(); bg.remove(); }});
  }

  function bindUI() {
    const setBtn = document.getElementById('btn-settings');
    if (setBtn) setBtn.addEventListener('click', showSettings);
  }

  // ---------- BOOT ----------
  function boot() {
    const loaded = load();
    let offlineReport = null;
    if (loaded) offlineReport = applyOffline();
    else state.lastTickAt = Date.now();
    sessionStartAt = Date.now();

    applyStartupBonuses();
    rebuildAll();
    setTab(state.meta.currentTab === 'tree' && treeTabVisible() ? 'tree' : 'factory');
    prevUnlockSig = '';
    bindTabs(); bindUI();
    requestAnimationFrame(loop);

    window.addEventListener('beforeunload', save);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });

    if (offlineReport && offlineReport.elapsed >= OFFLINE_REPORT_MS) {
      log(`Welcome back — away ${fmtDuration(offlineReport.elapsed)}`);
      setTimeout(() => showWelcomeBack(offlineReport), 400);
    }

    console.log('[blueprint] v' + VERSION + ' · redesigned prestige tree · loaded=' + loaded);
  }
  boot();
})();
