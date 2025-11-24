import React, { useRef } from 'react'

function downloadJSON(filename: string, data: any) {
  const text = JSON.stringify(data, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export default function ImportExportJSON({ filenamePrefix = 'collapse-data' }: { filenamePrefix?: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null)

  const handleExportAll = () => {
    try {
      const data: Record<string, any> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue
        const raw = localStorage.getItem(key)
        if (raw === null) continue
        try {
          data[key] = JSON.parse(raw)
        } catch {
          data[key] = raw
        }
      }
      const filename = `${filenamePrefix}-${Date.now()}.json`
      downloadJSON(filename, data)
    } catch (err) {
      window.alert('Export failed: ' + String(err))
    }
  }

  const handleImportClick = () => {
    fileRef.current?.click()
  }

  const handleFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!parsed || typeof parsed !== 'object') throw new Error('Imported file is not a JSON object')
        // Merge into localStorage (overwrites existing keys)
        Object.entries(parsed).forEach(([k, v]) => {
          try {
            localStorage.setItem(k, JSON.stringify(v))
          } catch (e) {
            // fallback to string
            localStorage.setItem(k, String(v))
          }
        })
        window.alert('Import complete. The page will reload to apply imported data.')
        window.location.reload()
      } catch (err: any) {
        window.alert('Import failed: ' + (err?.message ?? String(err)))
      }
    }
    reader.onerror = () => window.alert('Failed to read file')
    reader.readAsText(file)
  }

  return (
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <input ref={fileRef} type="file" accept="application/json" style={{display:'none'}} onChange={(e)=>handleFile(e.target.files?.[0] ?? null)} />
      <button onClick={handleExportAll} title="Export all localStorage to JSON">Export JSON</button>
      <button onClick={handleImportClick} title="Import JSON into localStorage">Import JSON</button>
    </div>
  )
}
