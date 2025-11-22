import React, {useState} from 'react'
import './index.css'
import Landing from './components/Landing'
import WorldCreation from './components/WorldCreation'
import type { UserRole } from './components/RoleSelectLanding'

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null)

  if (!role) {
    return <Landing onSelectRole={setRole} />
  }

  return <WorldCreation role={role} onBack={() => setRole(null)} />
}
