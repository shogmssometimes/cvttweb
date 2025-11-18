import React, { useState } from "react";
import { WorldEvent } from "../domain/worldEvents";

interface Props {
  event: WorldEvent;
  selected: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export const WorldEventCard: React.FC<Props> = ({ event, selected, onSelect, disabled }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: selected ? "2px solid #00eaff" : "1px solid #ccc",
        borderRadius: 12,
        margin: "8px 0",
        background: "#222",
        color: "#fff",
        padding: 12,
        boxShadow: selected ? "0 0 8px #00eaff" : "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
      onClick={() => !disabled && onSelect(event.id)}
    >
      <div onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}>
        <h3 style={{ margin: 0 }}>{event.name}</h3>
        <p style={{ margin: "4px 0" }}>{event.description.slice(0, 60)}...</p>
        <button style={{ fontSize: 12, marginTop: 4 }}>
          {expanded ? "Hide Details" : "Show Details"}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 8 }}>
          <p>{event.description}</p>
          <ul>
            {event.effects.map((eff, i) => (
              <li key={i}>
                <strong>{eff.meter}:</strong> {eff.change > 0 ? "+" : ""}{eff.change}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
