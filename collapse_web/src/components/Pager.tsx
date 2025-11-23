import React, {useEffect, useRef, useState, useCallback} from 'react'

type PagerProps = {
  pageIndex: number
  onPageIndexChange: (i: number) => void
  children: React.ReactNode
}

export default function Pager({pageIndex, onPageIndexChange, children}: PagerProps) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const startXRef = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth || 1 : 1

  const setCssOffset = useCallback((offsetPx: number) => {
    const el = innerRef.current
    if (!el) return
    // var is used in CSS as: translateX(calc(-1 * var(--pager-offset)))
    el.style.setProperty('--pager-offset', `calc(${pageIndex * 100}% - ${offsetPx}px)`)
  }, [pageIndex])

  useEffect(() => {
    // update CSS var whenever pageIndex or dragOffset change
    setCssOffset(dragOffset)
  }, [pageIndex, dragOffset, setCssOffset])

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (startXRef.current === null) return
      const delta = (e.clientX || 0) - startXRef.current
      setDragOffset(delta)
      if (Math.abs(delta) > 4 && !isDragging) setIsDragging(true)
      // prevent text selection / native drag while interacting
      e.preventDefault()
    }

    function onPointerUp(e: PointerEvent) {
      if (startXRef.current === null) return
      const delta = (e.clientX || 0) - startXRef.current
      startXRef.current = null
      setIsDragging(false)
      setDragOffset(0)
      // threshold to change page
      if (Math.abs(delta) > 60) {
        if (delta < 0) onPageIndexChange(Math.min(1, pageIndex + 1))
        else onPageIndexChange(Math.max(0, pageIndex - 1))
      }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }

    if (isDragging) {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    }

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [isDragging, onPageIndexChange, pageIndex])

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    function onPointerDown(e: PointerEvent) {
      // Only start on primary button / touch
      if ((e as any).pointerType === 'mouse' && e.button !== 0) return
      startXRef.current = e.clientX || 0
      setIsDragging(false)
      // capture pointer on the target if possible
      try { (e.target as Element).setPointerCapture?.((e as any).pointerId) } catch {}
      // add listeners handled by useEffect
    }
    el.addEventListener('pointerdown', onPointerDown)
    return () => el.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // keyboard navigation: left/right arrows
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') onPageIndexChange(Math.min(1, pageIndex + 1))
      if (e.key === 'ArrowLeft') onPageIndexChange(Math.max(0, pageIndex - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPageIndexChange, pageIndex])

  return (
    <div className="pager">
      <div
        ref={innerRef}
        className={`pager-inner ${isDragging ? 'disable-pointer-events' : ''}`}
        // use CSS var to control transform; default set above via effect
        style={{ ['--pager-offset' as any]: `calc(${pageIndex * 100}% - ${dragOffset}px)` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}
