# Collapse Companion PWA Architecture

## 1. Goals

- Deliver a **phone-friendly, offline-only** utility app that mirrors the Collapse handbook without inventing rules.
- Replace bookkeeping with **data views, rollers, and trackers** while keeping the handbook as the sole source of truth.
- Ensure **every formula and table remains user-editable** and transparently shown in the UI.

## 2. High-Level Structure

```
collapse_web/
├── public/
│   ├── manifest.webmanifest
│   ├── icons/
│   └── sample-handbook-data.json (auto-generated from handbook exports)
├── src/
│   ├── app/
│   │   ├── AppShell.tsx
│   │   ├── routes.tsx
│   │   └── providers/
│   ├── data/
│   │   ├── schema.ts
│   │   ├── handbook-adapter.ts
│   │   ├── storage.ts (IndexedDB powered by `idb`)
│   │   └── migrations/
│   ├── features/
│   │   ├── character/
│   │   ├── play/
│   │   ├── gm/
│   │   ├── session/
│   │   ├── data-admin/
│   │   └── tools/
│   ├── sensors/
│   │   └── range-overlay/
│   ├── utils/
│   └── service-worker.ts
├── vite.config.ts
├── tsconfig.json
└── ...
```

## 3. Data-First Workflow

1. **Import**: Users load the official handbook export (JSON/CSV bundle). `handbook-adapter` maps it into the strongly typed schema.
2. **Persist**: Parsed datasets land in IndexedDB stores:
   - `rulesets` (tables, formulas, statuses, engram metadata)
   - `cards` (base + mod decks)
   - `characters` (up to 3 active builds with history snapshots)
   - `npcs`
   - `sessions` (logs, notes)
3. **Apply**: Calculators use only the stored formulas. Example: Lucky13 totals reference `rulesets.formulas.lucky13` to compute values.
4. **Expose**: Every derived value is shown with a `Show formula` toggle that expands JSON for transparency.
5. **Update**: Re-importing a new handbook bumps the dataset version. Migrations keep characters referencing the latest ids.

## 4. Feature Mapping to Requirements

| Requirement | Implementation Notes |
| --- | --- |
| Offline-only | Vite PWA plugin pre-caches shell; IndexedDB backs data; no network fetches after install |
| Local storage of all data | `idb` stores for rules, characters, NPCs, logs; export/import as encrypted JSON (optional passphrase) |
| 3 character slots | Characters store with `maxActive=3`; additional imports allowed but must archive existing first |
| Live Play view | Dashboard card with HP/Viv, initiative, deck counts, Lucky13, statuses, CA durability, movement zones, inventory widgets |
| Dice roller | Shared component supporting presets from handbook dice tables; logs results w/ formulas |
| Card draw/burn | Deck manager uses card datasets; actions mutate local state and log events |
| Opposed roll helper | UI accepts attacker/defender stats, calculates margins per formula, displays breakdown |
| Null Space + Rest | Buttons trigger rule lookups (null counts, rest recovery) and prompt user confirmations |
| GM NPC/CE | NPC table referencing same schema; initiative tracker ties into session log |
| Session log | Append-only log stored per session; exportable as text/JSON |
| Handbook updates | Data admin panel to import JSON (drag/drop or paste). Validation ensures ids/formulas match schema |
| Exposed formulas | Each calculated widget has an info panel showing the JSON path + expression |

## 5. Camera-Based Range Overlay

- **Goal**: Visual aid for MR/CR/FR banding without platform-specific APIs.
- **Approach**:
  1. Use `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` to stream the rear camera.
  2. Users tap two points on the live feed to establish a **calibration baseline**; they enter the real-world distance between those points (e.g., width of a standard playing card).
  3. Compute pixel-to-distance ratio; store it with device metadata for reuse.
  4. Handbook data defines MR/CR/FR ranges numerically. Overlay draws concentric arcs or rulers scaled per ratio.
  5. Optional device motion (`DeviceOrientationEvent`) refines scaling when available; fallback remains manual calibration.
  6. For hardware that supports **WebXR `immersive-ar`**: detect feature and switch to hit-test mode for automatic depth measurement (progressive enhancement).
- **Result**: Universal (any camera) with better accuracy on devices offering WebXR/AR support.

## 6. Data Contracts (abridged)

```ts
interface HandbookBundle {
  version: string;
  tables: Record<string, HandbookTable>;
  formulas: Record<string, FormulaDefinition>;
  cards: HandbookCard[];
  statuses: HandbookStatus[];
  engrams: HandbookEngram[];
  combatApparatus: CombatApparatus[];
}

interface CharacterRecord {
  id: string;
  name: string;
  role: string;
  stats: CharacterStats; // hp, viv, initiative, null, mod capacity
  deckState: DeckState; // draw, hand, discard arrays of card ids
  lucky13: Lucky13Breakdown;
  statusEffects: string[]; // references statuses
  inventory: InventoryItem[];
  ca: CombatApparatusState;
  movement: MovementState;
  history: SessionSnapshot[];
}
```

Schemas will live in `src/data/schema.ts` and be validated with `zod` (optional future dependency).

## 7. Offline + Build Considerations

- **Caching**: App shell, fonts, icons cached via service worker; handbook datasets cached upon import (hash-based keys).
- **Sync**: No background sync. Data export via JSON file or copy-to-clipboard string.
- **Testing**: Vitest + Testing Library for data adapters and UI logic; Playwright (future) for PWA install flows.

## 8. Next Steps

1. Build the data layer (schema definitions, `idb` stores, import pipeline).
2. Implement core routes/layout with nav tabs: Character, Play, GM, Session, Data, Tools.
3. Hook up measurement overlay component under Tools.
4. Integrate service worker + manifest, test offline install on iOS/Android.
5. Expand automated tests for calculators and storage migrations.
