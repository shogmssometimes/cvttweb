import React from 'react'
import type { WorldEvent } from '../domain/worldEvents'

type Props = {
  event: WorldEvent
  selected: boolean
  onSelect: (id: string) => void
  disabled?: boolean
}

export default function WorldEventCard({event, selected, onSelect, disabled}: Props) {
  return (
    <div className={`we-card ${selected ? 'selected' : ''}`} onClick={() => !disabled && onSelect(event.id)}>
      <div className="we-card-head">
        <strong>{event.name}</strong>
        <label className="we-checkbox">
          <input type="checkbox" checked={selected} readOnly />
        </label>
      </div>
      {event.description && <p className="we-desc">{event.description}</p>}
      {event.effects && (
        <ul className="we-effects">
          {event.effects.map((e, i) => (
            <li key={i}><strong>{e.meter}:</strong> {e.change > 0 ? '+' : ''}{e.change}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
