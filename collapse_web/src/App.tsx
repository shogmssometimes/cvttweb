import React, { useState } from "react";
import RoleSelectLanding, { UserRole } from "./components/RoleSelectLanding";
import DeckBuilder from "./pages/DeckBuilder";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);

  if (!role) {
    return <RoleSelectLanding onSelect={setRole} />;
  }

  return <DeckBuilder />;
}
