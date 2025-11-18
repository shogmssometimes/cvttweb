import React, { useState } from "react";
import { SocialMatrix } from "../components/SocialMatrix";
import { WorldEventCard } from "../components/WorldEventCard";
import { Meters } from "../domain/meters";
import { WorldEvent } from "../domain/worldEvents";
import { worldEvents } from "../data/worldEvents";

const initialMeters: Meters = {
  trust: 0,
  distrust: 0,
  surveillance: 0,
  carteBlanche: 0,
  influence: 0,
  record: 0,
  collapse: 0,
};

function applyEventEffects(selectedIds: string[], events: WorldEvent[]): Meters {
  const meters = { ...initialMeters };
  selectedIds.forEach(id => {
    const event = events.find(e => e.id === id);
    if (event) {
      event.effects.forEach(eff => {
        meters[eff.meter] += eff.change;
      });
    }
  });
  return meters;
}

export const WorldEventSelection: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const meters = applyEventEffects(selectedIds, worldEvents);

  const handleSelect = (id: string) => {
    setSelectedIds(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  };

  return (
    <div>
      <h2>World Events</h2>
      {worldEvents.map(event => (
        <WorldEventCard
          key={event.id}
          event={event}
          selected={selectedIds.includes(event.id)}
          onSelect={handleSelect}
        />
      ))}
      <h2>Social Matrix & Meters</h2>
      <SocialMatrix meters={meters} />
      <div style={{ marginTop: 24 }}>
        <h3>Selected Events Summary</h3>
        {selectedIds.length === 0 ? (
          <p>No events selected.</p>
        ) : (
          selectedIds.map(id => {
            const event = worldEvents.find(e => e.id === id);
            return (
              <div key={id} style={{ marginBottom: 12 }}>
                <strong>{event?.name}</strong>
                <p>{event?.description}</p>
                  <ul>
                    {event?.effects.map((eff: { meter: string; change: number }, i: number) => (
                      <li key={i}>
                        <strong>{eff.meter}:</strong> {eff.change > 0 ? "+" : ""}{eff.change}
                      </li>
                    ))}
                  </ul>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
