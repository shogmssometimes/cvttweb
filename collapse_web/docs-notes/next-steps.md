# Next Steps

1. **Handbook ingestion UI**
   - Build drag-and-drop package importer (zip/csv) that maps each handbook table into the internal schema.
   - Surface validation errors inline with pointers back to the handbook section.

2. **Character limit enforcement UX**
   - Offer archive/export workflow when the device already stores three characters.
   - Provide quick “swap active character” view for multi-character groups.

3. **Deck + Lucky13 fidelity**
   - Replace manual card id inputs with tappable card catalog filtered from handbook data.
   - Calculate Lucky13 totals dynamically using the formula text exposed from the dataset; show breakdown per card.

4. **GM + session sync**
   - Persist NPC stat blocks and initiative orders to IndexedDB so they survive reloads.
   - Allow tagging log entries by encounter/session for easier archiving.

5. **Camera overlay enhancements**
   - Offer optional WebXR hit-test integration when supported.
   - Cache calibration profiles per device and allow manual MR/CR/FR overrides.

6. **Testing & automation**
   - Expand Vitest coverage for storage, calculators, and components.
   - Add Playwright smoke tests for PWA install/offline paths once the UI stabilizes.

   7. **Export / Import Decks**
      - Implemented: deck export and import as JSON files in the Deck Builder UI.
      - Usage: Click the `Export` button in the Deck Builder to download a JSON export of the current deck or click `Import` and select a previously exported JSON file to load counts and deck configuration.
      - Data model: Exports `name`, `deck`, `baseCounts`, `modCounts`, `nullCount`, `modifierCapacity`, and `savedDecks` keys. Imports validate card IDs against the current handbook and rejects malformed objects.
      - Tests: Vitest unit tests validate import parsing and unknown-id filtering.
