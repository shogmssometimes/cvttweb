import React, { useState } from "react";
import RoleSelectLanding, { UserRole } from "./components/RoleSelectLanding";
import { WorldEventSelection } from "./pages/WorldEventSelection";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);

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
            : "Review the canon World Events for this campaign. These are read-only—check with your GM for the active set."}
        </p>
      </header>

      <WorldEventSelection mode={role} />

      <button style={{ alignSelf: "flex-start", marginTop: 16 }} onClick={() => setRole(null)}>
        Switch Role
      </button>
    </main>
  );
}
