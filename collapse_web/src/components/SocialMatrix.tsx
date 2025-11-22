import React from 'react'
import type { Meters } from '../domain/meters'

function clamp(v: number, a = 0, b = 5) {
  return Math.max(a, Math.min(b, v))
}

export default function SocialMatrix({meters}:{meters:Meters}) {
  const trust = clamp(meters.trust ?? 0)
  const distrust = clamp(meters.distrust ?? 0)
  const surveillance = clamp(meters.surveillance ?? 0)
  const carte = clamp(meters.carteBlanche ?? 0)
  const entries = Object.entries(meters) as Array<[keyof Meters, number]>

  // Map simple meters to a 600x600 viewbox point
  const x = 300 - trust * 40 + distrust * 40
  const y = 300 - surveillance * 40 + carte * 40

  return (
    <div className="social-matrix">
      <div className="matrix-image" style={{width: '100%', maxWidth: 400, position: 'relative'}}>
        <svg viewBox="0 0 600 600" style={{width: '100%', display: 'block'}}>
          <circle cx={x} cy={y} r={12} fill="#00eaff" stroke="#fff" strokeWidth={3} />
        </svg>
      </div>
      <div className="meter-list">
        {entries.map(([k,v]) => (
          <div key={String(k)} className="meter-line"><strong>{String(k).charAt(0).toUpperCase()+String(k).slice(1)}:</strong> {v}</div>
        ))}
      </div>
    </div>
  )
}
