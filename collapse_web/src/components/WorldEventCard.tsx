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
        border: selected ? "2px solid #00eaff" : "1px solid #333",
        borderRadius: 12,
        margin: "8px 0",
        background: selected ? "#1a2630" : "#222",
        color: "#fff",
        padding: 12,
        boxShadow: selected ? "0 0 8px #00eaff" : "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        position: "relative"
      }}
      onClick={() => !disabled && onSelect(event.id)}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>{event.name}</h3>
        {selected && (
          <span style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#00eaff",
            marginLeft: 4,
            border: "2px solid #fff"
          }} title="Selected"></span>
        )}
      </div>
      <button
        style={{ fontSize: 12, marginTop: 4, background: "#111", color: "#00eaff", border: "1px solid #00eaff", borderRadius: 4, padding: "2px 8px" }}
        onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
      >
        {expanded ? "Hide Details" : "Show Details"}
      </button>
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
