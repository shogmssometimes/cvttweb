# Collapse Companion – VTT Parity Roadmap

## Purpose
Bring the Collapse Foundry system's table-side functionality into the web companion so a group can run fully in-person sessions (map on the table, everyone using the app as their "brain"). The app should feel like the control panel half of Foundry: all rules enforcement, bookkeeping, and UX flows without the virtual scene rendering.

---

## Feature Parity Targets

| Foundry Capability | Web Companion Requirement | Notes |
| --- | --- | --- |
| **Actor contextual tabs** (full/combat/recovery/commerce/loadout/story) | Responsive character cockpit with the same presets, quick switching, and view-specific layouts | Use presets in `ACTOR_VIEW_PRESETS`; hide/show sections via data attributes. |
| **Engram deck + hand apps** (draw/play/return/discard, validation rules) | Deck workspace with card grouping, rule validation, hand/discard counts, null enforcement | Port `DeckBuilderController` logic into a TS service (`useDeckEngine`). |
| **Lucky13 tracking and formulas** | Real-time Lucky13 calculator tied to deck and manual overrides | Use handbook formulas and deck events to keep totals in sync. |
| **Combat + duel overlays** (push/overdrive, CA durability ladder, range bands, initiative HUD) | Combat dashboard: initiative list, CA tracker, range-band meter, duel flow controls | Range bands already in handbook bundle; add CA ladder and duel presets to schema. |
| **Rest hooks** (short/long rest recovery, null handling) | Rest automation panel that updates character stats, decks, and status effects | Mirror `rest/short-rest-recovery.js` behavior in a web service (with confirmations + log entries). |
| **Status/conditions manager** | Status board with add/remove, timer tracking, description references | Seed from handbook statuses; allow quick taps and session-log links. |
| **GM console** (encounter tracker, NPC roster, scene manager, role assignment) | Dedicated GM workspace: encounter builder, initiative tracker, NPC card view, session prep notes | Use `collapse/scripts/gm/*.js` as behavior reference. |
| **Table rolls + economy/lifestyle utilities** | Roll widgets for loot/encounters + calculators for wallet/lifestyle tiers | Derive from `gm/table-rolls.js` and `economy/lifestyle.js`. |
| **Social matrix + engram DB apps** | Optional panels for relationship tracking and lore lookup | Pull from `assets/social-matrix` + `engrams/engram-db.js`. |
| **Hooks + settings** (handbook versioning, engram limits) | Data import/export, schema validation, per-device settings | Continue using `HandbookBundle` + IndexedDB; add migrations + settings UI. |

---

## Responsive Experience Principles

1. **Docked panes**: Primary layout is a three-pane system (Character, Combat/GM, Utilities). On mobile, panes collapse into tabs at the bottom for thumb reach.
2. **Thumb-first actions**: Quick actions (rest, card draws, status toggles) should be large tap targets; keep destructive actions behind long-press or confirmation modals.
3. **Persistent timeline**: Session log floats as a right-edge slide-out so every action can be tagged without leaving the current pane.
4. **Offline resilience**: All data—handbook bundle, characters, sessions—is cached. Network is only needed for optional sync/export.
5. **Dark-friendly visuals**: Reuse Collapse CSS tokens for high-contrast, neon-accent UI similar to Foundry sheets.

---

## Implementation Roadmap

### Phase 1 – Core Character & Deck Engine
- Extend `HandbookBundle` with CA ladders, duel presets, GM tables, and NPC archetypes (import from `collapse/scripts/data/*`).
- Port `DeckBuilderController` + hand/discard logic into `src/domain/decks/DeckEngine.ts` (TypeScript, unit-tested).
- Build Character Cockpit component with contextual presets, Lucky13 widget, CA tracker, movement panel, and inventory list.
- Implement Engram Workspace (deck builder + live hand/discard UI) tied to the deck engine service.

### Phase 2 – Combat + Session Operations
- Combat Dashboard: initiative order, push/overdrive toggles, range-band meter, CA durability ladder, duel mode controls.
- Rest Automation: short/long rest actions apply `rest/short-rest-recovery.js` rules, reshuffle decks, log entries.
- Status Board: add/remove statuses, timers, and quick reference text sourced from handbook statuses.
- Expand Session Tools with macros (burn card, draw, null space, rest) that call into deck/combat services and log results.

### Phase 3 – GM Console & Utilities
- Encounter Builder + Tracker using NPC catalog + role assignment helpers.
- Wallet/Lifestyle calculator and loot/encounter roll widgets derived from `economy/lifestyle.js` and `gm/table-rolls.js`.
- NPC/CE sheets for quick reference, including engram DB search.
- Social Matrix panel mirroring Foundry app (matrix grid, notes).

### Phase 4 – Advanced Lore & Sync
- Engram DB browser with search/filter, ability to push cards into decks.
- Handbook import/export UI (JSON upload/download, validation feedback).
- Optional device-to-device sync via share codes or cloud storage (stretch).

### Supporting Workstreams
- **Testing**: Vitest suites for deck engine, rest automation, combat calculators, GM tools.
- **Design System**: Component library for cards, stats, meters, and HUD widgets.
- **Data Pipelines**: Scripts to regenerate handbook bundle from `collapse/scripts/data` so updates stay in sync.

---

## Immediate Next Steps
1. Scaffold `src/domain` modules (decks, combat, gm, rest) with TypeScript interfaces and initial tests.
2. Import card/role/status data from Foundry scripts into the `defaultHandbookBundle` (with adapters).
3. Build the Character Cockpit MVP (contextual tabs + deck/CA widgets) leveraging the new services.
