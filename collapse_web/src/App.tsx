import React, { useCallback, useEffect, useState } from "react";
import RoleSelectLanding, { UserRole } from "./components/RoleSelectLanding";
import { WorldEventSelection } from "./pages/WorldEventSelection";
import { SLOT_INDEXES, SlotPayload, clearSlot, getSlotSummaries, loadSlot, saveSlot } from "./utils/slotStorage";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [activeSlot, setActiveSlot] = useState<number>(1);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [slotSummaries, setSlotSummaries] = useState<{ slot: number; payload: SlotPayload | null }[]>([]);

  const refreshSlots = useCallback((selectedRole: UserRole) => {
    setSlotSummaries(getSlotSummaries(selectedRole));
  }, []);

  useEffect(() => {
    if (!role) return;
    refreshSlots(role);
    setActiveSlot(1);
    const initial = loadSlot(role, 1);
    setSelectedEventIds(initial?.eventIds ?? []);
  }, [role, refreshSlots]);

  const handleSaveSlot = (slot: number) => {
    if (!role) return;
    saveSlot(role, slot, selectedEventIds);
    refreshSlots(role);
    setActiveSlot(slot);
  };

  const handleLoadSlot = (slot: number) => {
    if (!role) return;
    const payload = loadSlot(role, slot);
    if (payload) {
      setSelectedEventIds(payload.eventIds);
      setActiveSlot(slot);
    }
  };

  const handleClearSlot = (slot: number) => {
    if (!role) return;
    clearSlot(role, slot);
    refreshSlots(role);
    if (slot === activeSlot) {
      setSelectedEventIds([]);
    }
  };

  if (!role) {
    return <RoleSelectLanding onSelect={setRole} />;
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", gap: 24, padding: "1.5rem clamp(1rem, 4vw, 3rem)", maxWidth: 960, margin: "0 auto" }}>
      <header>
        <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: 1.2 }}>Collapse Companion</p>
        <h1 style={{ margin: "0.25rem 0 0" }}>{role === "gm" ? "GM Worldbuilding" : "Player Reference"}</h1>
        <p style={{ marginTop: 8, maxWidth: 640 }}>
          {role === "gm"
            ? "Select the World Events that define the tone, stakes, and faction pressure for this campaign."
            : "Track the World Events your GM selected or prep your own loadout. Everything saves locally on your device."}
        </p>
      </header>

      <section style={{ border: "1px solid #1f1f1f", borderRadius: 12, padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>{role === "gm" ? "GM Save Slots" : "Player Save Slots"}</h2>
        <p style={{ marginTop: 0, color: "#9aa0a6" }}>Store up to three configurations locally on this device. Slots are unique per role.</p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {slotSummaries.map(({ slot, payload }) => (
            <div key={slot} style={{ border: "1px solid #2a2a2a", borderRadius: 10, padding: 12, background: activeSlot === slot ? "#111" : "#080808" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => handleLoadSlot(slot)}
                >
                  Slot {slot}
                </button>
                <span style={{ fontSize: "0.8rem", color: "#8a8a8a" }}>
                  {payload ? new Date(payload.savedAt).toLocaleString() : "Empty"}
                </span>
              </div>
              <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                {payload ? `${payload.eventIds.length} event(s)` : "No data"}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => handleLoadSlot(slot)} disabled={!payload}>
                  Load
                </button>
                <button onClick={() => handleSaveSlot(slot)} disabled={selectedEventIds.length === 0}>
                  Save
                </button>
                <button onClick={() => handleClearSlot(slot)} disabled={!payload}>
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <WorldEventSelection
        mode={role}
        selectedEventIds={selectedEventIds}
        onSelectionChange={setSelectedEventIds}
        readOnly={false}
      />

      <button style={{ alignSelf: "flex-start", marginTop: 16 }} onClick={() => setRole(null)}>
        Switch Role
      </button>
    </main>
  );
}
