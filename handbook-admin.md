**Handbook Admin**
- Purpose: describe how developers update handbook data (base cards, mods, nulls, gear, events).

Developer workflow
- Edit source modules:
  - `src/data/handbook/baseCards.ts` (stable base cards)
  - `src/data/handbook/modCards.ts` (mods / gear / frequently-updated cards)
  - `src/data/handbook/nullCards.ts` (nulls / placeholders)
  - `src/data/handbook/gear.ts` (equipment)
  - `src/data/handbook/events.ts` (world/national/regional events)
- Commit changes to `main` and push. CI builds the site and publishes the `docs/` output to `gh-pages`.


Developer-only updates
- The app no longer exposes any import controls in the UI. Handbook updates must be made by editing the TypeScript modules in the repository and committing the change.

- To update handbook data locally during development, edit files under `src/data/handbook/` and run the dev server:

```bash
# macOS / zsh
npm run dev
```

- Imported data or runtime imports are not supported in production builds. This ensures the canonical handbook is always changed only via code.

Notes
- Users can save personal deck state to `localStorage` (this is per-device and not propagated upstream).
- For larger handbook changes, prefer providing a canonical handbook JSON/ZIP and adding an adapter script to generate the TypeScript modules or a `defaultHandbookBundle.json` that the app can consume.
