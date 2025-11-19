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
