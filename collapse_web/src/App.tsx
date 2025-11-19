import React, { useCallback, useEffect, useState } from "react";
import RoleSelectLanding, { UserRole } from "./components/RoleSelectLanding";
import DeckBuilder from "./pages/DeckBuilder";
// NOTE: WorldEventSelection and other features are temporarily hidden (iced) while
// the engram deck builder is the primary flow. They remain in the codebase and
// can be restored later.
// import { WorldEventSelection } from "./pages/WorldEventSelection";
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

  // After role selection we send the user directly to the Engram Deck Builder.
  return <DeckBuilder />;
}
