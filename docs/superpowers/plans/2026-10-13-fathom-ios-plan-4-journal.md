# Fathom iOS — Plan 4: Discovery Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Give the dives a world to fill in: 18 creatures and places across the three zones, met during dives you breathe well through, kept in a field journal with a logbook of past dives — no streaks, no nagging, no "dive again".

**Architecture:** Pure TypeScript for every rule (catalogue, encounter roll, discovery check, journal store), tested in the harness. One art source per creature (SVG path data) used both by the Pixi scene and by the journal UI. Saved state moves from the web view's localStorage to Capacitor Preferences (iOS can purge web storage) through a hydrated in-memory store, so every existing loader keeps its synchronous API.

**Spec:** `docs/superpowers/specs/2026-10-13-fathom-ios-game-design.md` (Section 3)

## Rules (from the spec, made exact)

- **Catalogue:** 6 per zone — 2 common, 2 uncommon, 2 rare.
  - Twilight: lanternfish shoal, moon jelly (common); hatchetfish, glass squid (uncommon); manta ray, siphonophore (rare).
  - Midnight: firefly squid, comb jelly (common); barreleye, vampire squid (uncommon); giant isopod, sperm whale (rare).
  - Abyss: sea pig, tripod fish (common); anglerfish, dumbo octopus (uncommon); hydrothermal vent, whale fall (rare).
- **Placement:** metres below the depth at which the zone began — common 4–20 m, uncommon 20–45 m, rare 45–75 m. Depth comes only from `descent.ts`, so only longer, slower breaths reach the rare band.
- **Encounters:** rolled once at dive start from a seed: 3 per zone the plan visits (Quick: zone 1 only), preferring entries not yet found (up to 2 unfound, then any). The set never grows during a dive.
- **Discovery:** an encounter is found when the drawn depth passes its depth while the dive light is at least 0.25 and a breath out is under way or ended under 2 s ago. A breath-hold cannot pass any depth, so it can find nothing.
- **Saved:** first-found date and depth per entry; a logbook of dive summaries (date, plan, length, before, after, depth) capped at 200.
- **No totals, ranks or streaks** anywhere; the journal shows what you have found, not a score.

## Tasks

1. **Persistent store (TDD):** `persistentStore.ts` — `hydrate(preferences, legacy)` loads Preferences into memory, migrates legacy localStorage keys once, and returns a synchronous `KeyValueStore` that writes through. `main.tsx` hydrates before rendering; `storage.ts` defaults to it.
2. **Catalogue + rules (TDD):** `journal/catalogue.ts`, `journal/encounters.ts` (`rollEncounters`), `journal/discovery.ts` (`DiscoveryTracker`). Tests: fixed set per seed; quick dive only zone 1; prefers unfound; breath-hold finds nothing; short fast breaths cannot reach a rare band in a zone's time; light below threshold finds nothing; each encounter found once.
3. **Journal store (TDD):** `journal/journalStore.ts` — record discovery (first only), record dive, read back; corrupt data reads as empty.
4. **Art + words:** `journal/creatureArt.ts` (SVG path per entry, glow colour); `journal/creatureStrings.ts` (name + two-line fact, EN/FR).
5. **In the dive:** controller runs the tracker; the Pixi renderer draws the dive's encounters on the mid layer, lit by the dive light; a discovery shows a toast, plays a sonar ping, and a delicate tick haptic.
6. **Screens:** Journal (zone pages, found / "???" entries, detail card), Logbook tab, a Journal button on the title, "Found this dive" on the results.
7. **Verify** on the simulator.
