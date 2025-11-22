import React from 'react'
import RoleSelectLanding, { UserRole } from './RoleSelectLanding'

interface LandingProps {
  onSelectRole: (role: UserRole) => void
}

export default function Landing({ onSelectRole }: LandingProps) {
  return <RoleSelectLanding onSelect={onSelectRole} />
}
