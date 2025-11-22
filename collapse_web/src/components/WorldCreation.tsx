import React, { useEffect, useState } from 'react'
import DeckBuilder from '../pages/DeckBuilder'
import WorldEventSelection from '../pages/WorldEventSelection'
import type { UserRole } from './RoleSelectLanding'

const WORLD_EVENT_STORAGE_KEY = 'collapse.world-events.selection'

type WorldCreationProps = {
  role: UserRole
  onBack: () => void
}

function loadStoredEventIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(WORLD_EVENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function WorldCreation({ role, onBack }: WorldCreationProps) {
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(() => loadStoredEventIds())
  const isPlayer = role === 'player'

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WORLD_EVENT_STORAGE_KEY, JSON.stringify(selectedEventIds))
    } catch {
      // ignore storage errors
    }
  }, [selectedEventIds])

  return (
    <div className="world-shell">
      <header className="world-header">
        <div className="world-header__actions">
          <button onClick={onBack}>Change Role</button>
          <span className="world-role-pill">{role === 'gm' ? 'GM Mode' : 'Player Mode'}</span>
        </div>
        <p className="muted world-header__blurb">
          {isPlayer
            ? 'Guided experience with read-only world events and your engram deck builder.'
            : 'GM mode unlocks event selection, editable social matrix, and the full deck builder for prep.'}
        </p>
      </header>

      <section className="world-events-panel">
        <div className="world-events-panel__body">
          <WorldEventSelection
            mode={role}
            selectedEventIds={selectedEventIds}
            onSelectionChange={setSelectedEventIds}
            readOnly={isPlayer}
          />
        </div>
      </section>

      <DeckBuilder />
    </div>
  )
}
