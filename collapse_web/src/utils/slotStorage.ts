import { UserRole } from "../components/RoleSelectLanding";

const SLOT_COUNT = 3;

export interface SlotPayload {
  eventIds: string[];
  savedAt: number;
}

export const SLOT_INDEXES = Array.from({ length: SLOT_COUNT }, (_, idx) => idx + 1);

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const buildKey = (role: UserRole, slot: number) => `collapse-slot-${role}-${slot}`;

export function saveSlot(role: UserRole, slot: number, eventIds: string[]) {
  if (!isBrowser()) return;
  const payload: SlotPayload = {
    eventIds,
    savedAt: Date.now(),
  };
  localStorage.setItem(buildKey(role, slot), JSON.stringify(payload));
}

export function loadSlot(role: UserRole, slot: number): SlotPayload | null {
  if (!isBrowser()) return null;
  const serialized = localStorage.getItem(buildKey(role, slot));
  if (!serialized) return null;
  try {
    return JSON.parse(serialized) as SlotPayload;
  } catch (error) {
    console.error("Failed to parse slot payload", error);
    return null;
  }
}

export function clearSlot(role: UserRole, slot: number) {
  if (!isBrowser()) return;
  localStorage.removeItem(buildKey(role, slot));
}

export function getSlotSummaries(role: UserRole) {
  if (!isBrowser()) {
    return SLOT_INDEXES.map((slot) => ({ slot, payload: null }));
  }
  return SLOT_INDEXES.map((slot) => ({
    slot,
    payload: loadSlot(role, slot),
  }));
}