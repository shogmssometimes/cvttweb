import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react'
import Pager from '../components/Pager'
import { startPlaySelection, toggleAttach, finalizeSelection, cancelSelection, ActivePlay } from '../utils/playFlow'
import { getModCapacityUsed, canAddModCardFrom } from '../utils/modCapacity'
import { validateImportedDeck, exportObjectAsJSON } from '../utils/deckExportImport'
import Handbook from '../data/handbook'
import { Card } from '../domain/decks/DeckEngine'

const BASE_TARGET = 26
const MIN_NULLS = 5
const STORAGE_KEY = 'collapse.deck-builder.v2'

type CountMap = Record<string, number>

type DeckBuilderState = {
  baseCounts: CountMap
  modCounts: CountMap
  nullCount: number
  modifierCapacity: number
  // runtime deck state
  deck?: string[]
  hand?: { id: string; state: 'unspent' | 'played' }[]
  discard?: { id: string; origin: 'played' | 'discarded' }[]
  isLocked?: boolean
  deckName?: string
  savedDecks?: Record<string, {
    name: string
    deck: string[]
    baseCounts: CountMap
    modCounts: CountMap
    nullCount: number
    modifierCapacity: number
    createdAt: string
  }>
  handLimit?: number
}

const clamp = (value: number, min: number, max?: number) => {
  if (value < min) return min
  if (typeof max === 'number' && value > max) return max
  return value
}

const sumCounts = (counts: CountMap) => Object.values(counts).reduce((sum, qty) => sum + qty, 0)

const buildInitialCounts = (cards: Card[]) =>
  cards.reduce<CountMap>((acc, card) => {
    acc[card.id] = 0
    return acc
  }, {})

const defaultState = (baseCards: Card[], modCards: Card[]): DeckBuilderState => ({
  baseCounts: buildInitialCounts(baseCards),
  modCounts: buildInitialCounts(modCards),
  nullCount: MIN_NULLS,
  modifierCapacity: 10,
  deck: [],
  hand: [],
  discard: [],
  isLocked: false,
  deckName: '',
  savedDecks: {},
  handLimit: 5,
})

const loadState = (baseCards: Card[], modCards: Card[]): DeckBuilderState => {
  if (typeof window === 'undefined') return defaultState(baseCards, modCards)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState(baseCards, modCards)
    const parsed = JSON.parse(raw) as DeckBuilderState
    return {
      baseCounts: { ...buildInitialCounts(baseCards), ...parsed.baseCounts },
      modCounts: { ...buildInitialCounts(modCards), ...parsed.modCounts },
      nullCount: Math.max(parsed.nullCount ?? MIN_NULLS, MIN_NULLS),
      modifierCapacity: parsed.modifierCapacity ?? 10,
      deck: parsed.deck ?? [],
      hand: parsed.hand ?? [],
      discard: parsed.discard ?? [],
      isLocked: parsed.isLocked ?? false,
      deckName: parsed.deckName ?? '',
      handLimit: parsed.handLimit ?? 5,
      savedDecks: parsed.savedDecks ?? {},
    }
  } catch {
    return defaultState(baseCards, modCards)
  }
}

export default function DeckBuilder(){
  const baseCards = Handbook.baseCards ?? []
  const modCards = Handbook.modCards ?? []
  const nullCard = Handbook.nullCards?.[0]

  const [builderState, setBuilderState] = useState(() => loadState(baseCards, modCards))
  const [modSearch, setModSearch] = useState('')
  const [deckSeed, setDeckSeed] = useState(0)
  const [activePlay, setActivePlay] = useState<ActivePlay>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const dragStartRef = useRef<number | null>(null)
  const pointerDownRef = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(builderState))
  }, [builderState])

  const baseTotal = sumCounts(builderState.baseCounts)
  const modCapacityUsed = useMemo(() => getModCapacityUsed(modCards, builderState.modCounts), [builderState.modCounts, modCards])

    // enforce mod capacity when adding a modifier
    const canAddModCard = useCallback((cardId: string) => canAddModCardFrom(modCards, builderState, cardId), [builderState.modCounts, builderState.modifierCapacity, modCards])

    // pure helper: test if a card can be added given a state snapshot
    function canAddModCardSnapshot(state: DeckBuilderState, cardId: string) {
      return canAddModCardFrom(modCards, state, cardId)
    }

  const baseValid = baseTotal === BASE_TARGET
  const nullValid = builderState.nullCount >= MIN_NULLS
  const modValid = modCapacityUsed <= builderState.modifierCapacity
  const deckIsValid = baseValid && nullValid && modValid

  // Mouse move/up handlers attached to window for desktop drag support
  function onWindowMouseMove(e: MouseEvent) {
    if (!pointerDownRef.current || dragStartRef.current === null) return
    const delta = e.clientX - (dragStartRef.current ?? 0)
    setDragOffset(delta)
  }

  function onWindowMouseUp(e: MouseEvent) {
    if (!pointerDownRef.current) return
    const delta = dragOffset
    pointerDownRef.current = false
    dragStartRef.current = null
    setDragOffset(0)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
    if (Math.abs(delta) > 60) {
      if (delta < 0) setPageIndex((p) => Math.min(1, p + 1))
      else setPageIndex((p) => Math.max(0, p - 1))
    }
  }

  // keyboard left/right navigation for pager
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setPageIndex((p) => Math.min(1, p + 1))
      if (e.key === 'ArrowLeft') setPageIndex((p) => Math.max(0, p - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filteredModCards = useMemo(() => {
    if (!modSearch.trim()) return modCards
    const needle = modSearch.trim().toLowerCase()
    return modCards.filter((card) =>
      [card.name, card.text, card.details?.map((d) => d.value).join(' ')].some((field) =>
        field?.toLowerCase().includes(needle)
      )
    )
  }, [modCards, modSearch])

  // utility: build a fresh deck array (ids repeated per counts)
  const buildDeckArray = () => {
    const out: string[] = []
    Object.entries(builderState.baseCounts).forEach(([id, qty]) => {
      for (let i = 0; i < qty; i++) out.push(id)
    })
    Object.entries(builderState.modCounts).forEach(([id, qty]) => {
      for (let i = 0; i < qty; i++) out.push(id)
    })
    // add nulls
    if (builderState.nullCount && nullCard) {
      for (let i = 0; i < builderState.nullCount; i++) out.push(nullCard.id)
    }
    return out
  }

  const shuffleInPlace = (arr: any[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const generateDeck = (shuffle = true) => {
    const newDeck = buildDeckArray()
    if (shuffle) shuffleInPlace(newDeck)
    setBuilderState((prev) => ({ ...prev, deck: newDeck }))
    setDeckSeed((s) => s + 1)
  }

  const shuffleDeck = () => {
    setBuilderState((prev) => ({ ...prev, deck: prev.deck ? shuffleInPlace([...prev.deck]) : [] }))
    setDeckSeed((s) => s + 1)
  }

  // Draw a single card to hand (only allowed when deck is locked)
  const draw = () => {
    setBuilderState((prev) => {
      // disallow drawing when deck isn't locked
      if (!prev.isLocked) return prev
      // disallow drawing when hand is at or above the limit; this prevents
      // returning discard to the deck (which turns a draw into a discard)
      if ((prev.hand ?? []).length >= (prev.handLimit ?? 5)) return prev
      const deck = [...(prev.deck ?? [])]
      const hand = [...(prev.hand ?? [])]
      const discard = [...(prev.discard ?? [])]

      if (deck.length === 0) {
        // shuffle discard back in if deck is empty
        if (discard.length === 0) return { ...prev }
        const ids = discard.map((d) => d.id)
        shuffleInPlace(ids)
        // for LIFO model, append shuffled discard to the end (top)
        deck.push(...ids)
        discard.length = 0
      }
      // LIFO: draw from top-of-deck with pop
      const cardId = deck.pop()
      if (!cardId) return { ...prev, deck, hand, discard }
      // we already checked hand limit above, so adding is safe
      hand.push({ id: cardId, state: 'unspent' })
      return { ...prev, deck, hand, discard }
    })
    setDeckSeed((s) => s + 1)
  }

  const discardFromHand = (index: number, origin: 'discarded' | 'played' = 'discarded') => {
    setBuilderState((prev) => {
      const hand = [...(prev.hand ?? [])]
      const discard = [...(prev.discard ?? [])]
      const removed = hand.splice(index, 1)
      if (removed.length === 0) return { ...prev, hand, discard }
      discard.push({ id: removed[0].id, origin })
      return { ...prev, hand, discard }
    })
    setDeckSeed((s) => s + 1)
  }

  // Remove discardFromDeck - deprecated in new UI; keep internal function to support automated flows
  const discardFromDeck = (count = 1) => {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      for (let i = 0; i < count; i++) {
        const cardId = deck.pop()
        if (!cardId) break
        discard.push({ id: cardId, origin: 'discarded' })
      }
      return { ...prev, deck, discard }
    })
    setDeckSeed((s) => s + 1)
  }

  const returnDiscardToDeck = (shuffle = true, toTop = true) => {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      // when returning discard to deck for FIFO, push them to the end (bottom) after shuffling
      const ids = discard.map((d) => d.id)
      if (shuffle) shuffleInPlace(ids)
      // For LIFO model: 'top' is the end of the array
      if (toTop) deck.push(...ids)
      else deck.unshift(...ids)
      if (shuffle) shuffleInPlace(deck)
      return { ...prev, deck, discard: [] }
    })
    setDeckSeed((s) => s + 1)
  }

  const resetDeck = () => {
    const newDeck = buildDeckArray()
    setBuilderState((prev) => ({ ...prev, deck: shuffleInPlace(newDeck), hand: [], discard: [] }))
    setDeckSeed((s) => s + 1)
  }

  // Lock / Unlock the deck (save)
  const toggleLockDeck = () => {
    setBuilderState((prev) => ({ ...prev, isLocked: !prev.isLocked }))
  }

  const setDeckName = (name: string) => {
    setBuilderState((prev) => ({ ...prev, deckName: name }))
  }

  const saveDeck = (name?: string) => {
    setBuilderState((prev) => {
      const n = name ?? prev.deckName ?? `deck-${Date.now()}`
      if (!n) return prev
      const item = {
        name: n,
        deck: [...(prev.deck ?? [])],
        baseCounts: { ...prev.baseCounts },
        modCounts: { ...prev.modCounts },
        nullCount: prev.nullCount,
        modifierCapacity: prev.modifierCapacity,
        createdAt: new Date().toISOString(),
      }
      // Normalize: move any 'played' states out of hand and into discard
      const hand = prev.hand ?? []
      const discard = prev.discard ?? []
      type HandItem = { id: string; state: 'unspent' | 'played' }
      type DiscardItem = { id: string; origin: 'played' | 'discarded' }
      const [played, remainingHand] = hand.reduce<[DiscardItem[], HandItem[]]>(([p, h], card: HandItem) => {
        if (card.state === 'played') {
          p.push({ id: card.id, origin: 'played' })
        } else {
          h.push(card)
        }
        return [p, h]
      }, [[], []] as [DiscardItem[], HandItem[]])

      const newDiscard = [...discard, ...played]

      return { ...prev, savedDecks: { ...(prev.savedDecks ?? {}), [n]: item }, deckName: n, isLocked: true, hand: remainingHand, discard: newDiscard }
    })
  }

  const handleExport = () => {
    const filename = `collapse-deck-${builderState.deckName ?? 'export'}-${Date.now()}.json`
    // only export the core representation; exclude ephemeral runtime state like hand/discard
    const exportData = {
      name: builderState.deckName,
      deck: builderState.deck,
      baseCounts: builderState.baseCounts,
      modCounts: builderState.modCounts,
      nullCount: builderState.nullCount,
      modifierCapacity: builderState.modifierCapacity,
      savedDecks: builderState.savedDecks,
      exportedAt: new Date().toISOString(),
    }
    exportObjectAsJSON(filename, exportData)
  }

  const handleImportedFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result))
        const imported = validateImportedDeck(raw, baseCards, modCards)
        // If the import contains counts, load into builder; otherwise try merging savedDecks
        setBuilderState((prev) => ({
          ...prev,
          deck: imported.deck ?? prev.deck,
          baseCounts: imported.baseCounts ? { ...prev.baseCounts, ...imported.baseCounts } : prev.baseCounts,
          modCounts: imported.modCounts ? { ...prev.modCounts, ...imported.modCounts } : prev.modCounts,
          nullCount: imported.nullCount ?? prev.nullCount,
          modifierCapacity: imported.modifierCapacity ?? prev.modifierCapacity,
          deckName: imported.name ?? prev.deckName,
        }))
        window.alert('Deck imported successfully.')
      } catch (err: any) {
        window.alert('Invalid deck file: ' + (err?.message ?? String(err)))
      }
    }
    reader.onerror = () => window.alert('Failed to read file')
    reader.readAsText(file)
  }

  const onClickImport = () => {
    fileInputRef.current?.click()
  }

  const loadSavedDeck = (name: string) => {
    setBuilderState((prev) => {
      const sd = prev.savedDecks?.[name]
      if (!sd) return prev
      return {
        ...prev,
        deck: [...sd.deck],
        baseCounts: { ...sd.baseCounts },
        modCounts: { ...sd.modCounts },
        nullCount: sd.nullCount,
        modifierCapacity: sd.modifierCapacity,
      }
    })
  }

  const deleteSavedDeck = (name: string) => {
    setBuilderState((prev) => {
      if (!prev.savedDecks) return prev
      const copy = { ...prev.savedDecks }
      delete copy[name]
      return { ...prev, savedDecks: copy }
    })
  }

  // drawSize removed - we only allow Draw 1

  const adjustBaseCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      const current = prev.baseCounts[cardId] ?? 0
      const next = clamp(current + delta, 0)
      const prevTotal = sumCounts(prev.baseCounts)
      const newTotal = prevTotal - current + next
      if (newTotal > BASE_TARGET) return prev
      return {
        ...prev,
        baseCounts: { ...prev.baseCounts, [cardId]: next },
      }
    })
  }

  const adjustModCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      if (prev.isLocked) return prev
      // use snapshot helper to determine if we can add this mod
      if (delta > 0 && !canAddModCardSnapshot(prev, cardId)) return prev

      return {
        ...prev,
        modCounts: {
          ...prev.modCounts,
          [cardId]: clamp((prev.modCounts[cardId] ?? 0) + delta, 0),
        },
      }
    })
  }

  const adjustNullCount = (delta: number) => {
    setBuilderState((prev) => ({
      ...prev,
      nullCount: clamp(prev.nullCount + delta, MIN_NULLS),
    }))
  }

  const setNullCount = (value: number) => {
    if (Number.isNaN(value)) return
    setBuilderState((prev) => ({
      ...prev,
      nullCount: clamp(value, MIN_NULLS),
    }))
  }

  const setModifierCapacity = (value: number) => {
    if (Number.isNaN(value)) return
    setBuilderState((prev) => ({
      ...prev,
      modifierCapacity: Math.max(value, 0),
    }))
  }

  const resetBuilder = () => {
    setBuilderState(defaultState(baseCards, modCards))
    setModSearch('')
  }

  // Moves a discard item back to the top of the deck
  const returnDiscardItemToDeck = (idx: number) => {
    setBuilderState((prev) => {
      const d = [...(prev.discard ?? [])]
      const it = d.splice(idx, 1)[0]
      const deck = [...(prev.deck ?? [])]
      deck.push(it.id)
      return { ...prev, discard: d, deck }
    })
  }

  // Moves all or one discard card of a given id back to the deck (top)
  function returnDiscardGroupToDeck(cardId: string, all = true) {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      if (all) {
        const idsToMove = discard.filter((d) => d.id === cardId).map((d) => d.id)
        const remaining = discard.filter((d) => d.id !== cardId)
        // push moved ids to the end (top)
        deck.push(...idsToMove)
        return { ...prev, discard: remaining, deck }
      }
      const idx = discard.findIndex((d) => d.id === cardId)
      if (idx === -1) return prev
      const it = discard.splice(idx, 1)[0]
      deck.push(it.id)
      return { ...prev, discard, deck }
    })
  }

  // Moves a discard item back to the hand (unspent)
  function returnDiscardItemToHand(idx: number) {
    setBuilderState((prev) => {
      const handLimit = prev.handLimit ?? 5
      if ((prev.hand ?? []).length >= handLimit) {
        // prevent returns that would exceed hand limit
        return prev
      }
      const d = [...(prev.discard ?? [])]
      const it = d.splice(idx, 1)[0]
      return { ...prev, discard: d, hand: [...(prev.hand ?? []), { id: it.id, state: 'unspent' }] }
    })
  }

  function returnDiscardGroupToHand(cardId: string, all = false) {
    setBuilderState((prev) => {
      const handLimit = prev.handLimit ?? 5
      const space = Math.max(0, handLimit - (prev.hand ?? []).length)
      if (space <= 0) return prev
      const discard = [...(prev.discard ?? [])]
      const moved: { id: string; origin: 'played' | 'discarded' }[] = []
      for (let i = discard.length - 1; i >= 0 && (moved.length < space); i--) {
        if (discard[i].id === cardId) {
          moved.push(discard.splice(i, 1)[0])
          if (!all) break
        }
      }
      if (moved.length === 0) return prev
      const newHand = [...(prev.hand ?? []), ...(moved.map((m) => ({ id: m.id, state: 'unspent' })) as { id: string; state: 'unspent' | 'played' }[])]
      return { ...prev, discard, hand: newHand }
    })
  }

  const groupedDiscardElements = useMemo(() => {
    const groups = (builderState.discard ?? []).reduce((acc: Record<string, {count:number, idxs:number[]}>, d, i) => {
      const g = acc[d.id] ?? {count:0, idxs:[]}
      g.count++
      g.idxs.push(i)
      acc[d.id] = g
      return acc
    }, {} as Record<string, {count:number, idxs:number[]}>)
    return Object.entries(groups).map(([id,g]) => {
      const card = Handbook.getAllCards().find(c => c.id === id)
      return (
        <div key={id} className={`card base-card small-card`} style={{border:'1px solid #333',background:'#050505'}}>
          <div style={{fontWeight:700}}>{card?.name ?? id} <span style={{color:'#9aa0a6',fontSize:'0.9rem'}}>(x{g.count})</span></div>
          <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Stacked</div>
          <div style={{marginTop:8}}>{renderDetails(card ?? {id, name:id, type:'', cost:0, text:'' as any})}</div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button onClick={()=>returnDiscardGroupToDeck(id)}>Return to Deck (Top)</button>
            <button onClick={()=>returnDiscardGroupToHand(id)} disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? 5)}>Return to Hand</button>
          </div>
        </div>
      )
    })
  }, [builderState.discard, builderState.hand, builderState.handLimit])

  const groupedHandElements = useMemo(() => {
    const groups = (builderState.hand ?? []).reduce((acc: Record<string, {count:number, idxs:number[]}>, d, i) => {
      const g = acc[d.id] ?? {count:0, idxs:[]}
      g.count++
      g.idxs.push(i)
      acc[d.id] = g
      return acc
    }, {} as Record<string, {count:number, idxs:number[]}>)
    return Object.entries(groups).map(([id,g]) => {
      const card = Handbook.getAllCards().find(c => c.id === id)
      return (
        <div key={id} className={`card base-card small-card`} style={{border:'1px solid #333',background:'#050505'}}>
          <div style={{fontWeight:700}}>{card?.name ?? id} <span style={{color:'#9aa0a6',fontSize:'0.9rem'}}>(x{g.count})</span></div>
          <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{card?.type ?? ''}</div>
          <div style={{marginTop:8}}>{renderDetails(card ?? {id, name:id, type:'', cost:0, text:'' as any})}</div>
          <div style={{marginTop:8,display:'flex',gap:8,flexDirection:'column'}}>
            <div style={{display:'flex',gap:8}}>
              {/* If this is a base card, starting a play selects it as the required base */}
              {card?.type === 'base' ? (
                (!activePlay) ? (
                  <button onClick={() => startPlayBase(id)}>Play (Select Base)</button>
                ) : (
                  <button disabled>{activePlay?.baseId === id ? 'Base Selected' : 'Play (disabled)'}</button>
                )
              ) : (
                // modifier or other: allow play (attach) when an active base is selected, otherwise allow discard
                activePlay ? (
                  <button onClick={() => attachModifier(id)}>Play</button>
                ) : (
                  <button onClick={() => discardGroupFromHand(id,false,'discarded')}>Discard</button>
                )
              )}
            </div>
          </div>
        </div>
      )
    })
  }, [builderState.hand, activePlay])

  // Move grouped items from hand to discard (single or all)
  function discardGroupFromHand(cardId: string, all = false, origin: 'played' | 'discarded' = 'discarded') {
    setBuilderState((prev) => {
      const hand = [...(prev.hand ?? [])]
      const removed: { id: string; state: 'unspent' | 'played' }[] = []
      if (all) {
        for (let i = hand.length - 1; i >= 0; i--) {
          if (hand[i].id === cardId) removed.push(hand.splice(i, 1)[0])
        }
      } else {
        const idx = hand.findIndex((h) => h.id === cardId)
        if (idx >= 0) removed.push(hand.splice(idx, 1)[0])
      }
      if (removed.length === 0) return prev
      const discard = [...(prev.discard ?? []), ...removed.map(r => ({ id: r.id, origin }))]
      return { ...prev, hand, discard }
    })
  }

  // Play flow handlers (use pure helpers)
  function startPlayBase(cardId: string) {
    setActivePlay((prev) => startPlaySelection(prev, cardId))
  }

  function attachModifier(cardId: string) {
    const handCounts = (builderState.hand ?? []).reduce<Record<string, number>>((acc, it) => {
      acc[it.id] = (acc[it.id] ?? 0) + 1
      return acc
    }, {})
    const cardCosts = Handbook.getAllCards().reduce<Record<string, number>>((acc, c) => { acc[c.id] = c.cost ?? 0; return acc }, {})
    setActivePlay((prev) => toggleAttach(prev, cardId, handCounts, cardCosts, builderState.modifierCapacity))
  }

  function finalizePlay() {
    const sel = finalizeSelection(activePlay)
    if (!sel) return
    // move base and attached mods from hand into discard as 'played'
    discardGroupFromHand(sel.baseId, false, 'played')
    sel.mods.forEach((m) => discardGroupFromHand(m, false, 'played'))
    setActivePlay(null)
  }

  function cancelPlay() {
    setActivePlay(cancelSelection(activePlay))
  }


  function renderDetails(card: Card) {
    if (!card.details || card.details.length === 0) return null
    return (
      <dl className="card-details" style={{marginTop:8,marginBottom:0,fontSize:'0.8rem',width:'100%'}}>
        {card.details.map((detail) => (
          <React.Fragment key={`${card.id}-${detail.label}`}>
            <dt style={{fontWeight:600}}>{detail.label}</dt>
            <dd style={{margin:0}}>{detail.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    )
  }

  return (
    <main className="app-shell">
      <header>
        <h1>Engram Deck Builder</h1>
        <p className="muted">Assemble MTG-style decks from official handbook data. Decks require 26 base cards, at least 5 Nulls, and modifier capacity must not be exceeded.</p>
      </header>

      <Pager pageIndex={pageIndex} onPageIndexChange={setPageIndex}>
          {/* Page 1: main builder UI (everything except Discard + Deck Operations) */}
          <div className="page">
            <section className="card-grid base-card-grid" style={{border:'1px solid #222',borderRadius:12,padding:16,background:'#080808'}}>
              <div>
                <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Base Cards</div>
                <div style={{fontSize:'1.8rem',fontWeight:700}}>{baseTotal} / {BASE_TARGET}</div>
                {!baseValid && <div style={{color:'#f7b500',fontSize:'0.85rem'}}>Deck must contain exactly 26 base cards.</div>}
              </div>

              <div>
                <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Null Cards</div>
                <div style={{fontSize:'1.8rem',fontWeight:700}}>{builderState.nullCount}</div>
                {!nullValid && <div style={{color:'#f7b500',fontSize:'0.85rem'}}>Minimum of {MIN_NULLS} Nulls required.</div>}
              </div>
              <div>
                <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Modifier Capacity</div>
                <div style={{fontSize:'1.8rem',fontWeight:700}}>{modCapacityUsed} / {builderState.modifierCapacity}</div>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <label style={{fontSize:'0.85rem',color:'#9aa0a6'}}>Capacity</label>
                  <input
                    aria-label="Modifier Capacity"
                    type="number"
                    min={0}
                    value={builderState.modifierCapacity}
                    onChange={(e) => setModifierCapacity(Number.parseInt(e.target.value || '0', 10))}
                    style={{width:92,padding:'4px 8px',background:'#0b0b0b',border:'1px solid #333',color:'#fff',borderRadius:6}}
                  />
                </div>
                <div style={{fontSize:'0.85rem',color:'#9aa0a6',marginTop:6}}>Mod Capacity Used</div>
                {!modValid && <div style={{color:'#ff6b6b',fontSize:'0.85rem'}}>Reduce modifier cards or raise capacity.</div>}
              </div>
              <div>
                <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Deck Status</div>
                <div style={{fontSize:'1.8rem',fontWeight:700,color:deckIsValid ? '#4caf50' : '#ff6b6b'}}>{deckIsValid ? 'Ready' : 'Needs Attention'}</div>
                <button onClick={resetBuilder} style={{marginTop:8}}>Reset Builder</button>
              </div>
            </section>

            <section style={{border:'1px solid #222',borderRadius:12,padding:16}}>
              <h2>Base Skill Cards</h2>
              <p style={{marginTop:0,color:'#9aa0a6'}}>Pick any combination of the 15 skills until you reach 26 total cards.</p>
                <div className="card-grid base-card-grid">
                {baseCards.map((card) => {
                  const qty = builderState.baseCounts[card.id] ?? 0
                      const isSelectedBase = activePlay?.baseId === card.id
                      return (
                        <div key={card.id} className={`card base-card`} style={{border:`1px solid ${isSelectedBase ? '#7b78ff' : '#333'}`,background:'#050505'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',minWidth:0}}>
                            <div style={{minWidth:0, flex: '1 1 auto'}}>
                              <div style={{fontWeight:700}}>{card.name}</div>
                              {isSelectedBase && <div style={{fontSize:'0.75rem',color:'#7b78ff',marginTop:4}}>Selected Base</div>}
                              <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{card.text}</div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0, flex: '0 0 auto'}}>
                              <button onClick={()=>adjustBaseCount(card.id,-1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                              <div style={{minWidth:24,textAlign:'center'}}>{qty}</div>
                              <button onClick={()=>adjustBaseCount(card.id,1)} disabled={baseTotal >= BASE_TARGET || builderState.isLocked}>+</button>
                            </div>
                          </div>
                          {renderDetails(card)}
                        </div>
                      )
                })}
              </div>
            </section>

                <section style={{border:'1px solid #222',borderRadius:12,padding:16,display:'flex',flexDirection:'column',gap:16}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:12,justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <h2 style={{marginBottom:4}}>Modifier Cards</h2>
                      <p style={{marginTop:0,color:'#9aa0a6'}}>Each modifier consumes capacity equal to its card cost. Stay within your Engram Modifier Capacity.</p>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <label style={{fontWeight:600}}>Modifier Capacity</label>
                      <input type="number" min={0} value={builderState.modifierCapacity} onChange={(event)=>setModifierCapacity(parseInt(event.target.value,10))} style={{width:140,maxWidth:'100%'}} />
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <label style={{fontWeight:600}}>Search Mods</label>
                        <input type="text" placeholder="Search name, target, effect" value={modSearch} onChange={(event)=>setModSearch(event.target.value)} style={{minWidth:0,width:'100%'}} />
                    </div>
                  </div>

                  <div className="card-grid mod-card-grid">
                    {filteredModCards.map((card) => {
                      const qty = builderState.modCounts[card.id] ?? 0
                      const cost = card.cost ?? 0
                      const isAttached = activePlay?.mods?.includes(card.id)
                      return (
                        <div key={card.id} className={`card mod-card`} style={{border:`1px solid ${isAttached ? '#7b78ff' : '#333'}`,background:'#050505'}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                            <div style={{minWidth:0, flex: '1 1 auto'}}>
                              <div style={{fontWeight:700}}>{card.name}</div>
                              <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Cost {cost}</div>
                              {isAttached && <div style={{fontSize:'0.75rem',color:'#7b78ff',marginTop:4}}>Attached</div>}
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0, flex: '0 0 auto'}}>
                              <button onClick={()=>adjustModCount(card.id,-1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                              <div style={{minWidth:24,textAlign:'center'}}>{qty}</div>
                              <button onClick={()=>adjustModCount(card.id,1)} disabled={builderState.isLocked || !canAddModCard(card.id)}>+</button>
                            </div>
                          </div>
                          <p style={{margin:0,fontSize:'0.85rem'}}>{card.text}</p>
                          {renderDetails(card)}
                        </div>
                      )
                    })}
                  </div>
                </section>

          </div>

          {/* Page 2: Deck Operations + Discard Pile */}
          <div className="page">
            <section style={{border:'1px solid #222',borderRadius:12,padding:16,display:'grid',gridTemplateColumns:'1fr',gap:12}}>
              <div>
                <label style={{fontWeight:600}}>Hand Draw</label>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <button onClick={()=>draw()} disabled={!builderState.isLocked || ((builderState.hand ?? []).length >= (builderState.handLimit ?? 5))}>Draw 1</button>
                </div>
              </div>
            </section>

            <section className="card-grid base-card-grid" style={{border:'1px solid #222',borderRadius:12,padding:16}}>
              <div>
                <h3>Hand</h3>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <div style={{fontSize:'0.85rem',color:'#9aa0a6'}}>Duplicates stacked</div>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {groupedHandElements}
                  {(groupedHandElements?.length ?? 0) === 0 && (builderState.hand ?? []).map((handCard, idx) => {
                      const card = Handbook.getAllCards().find(c => c.id === handCard.id)
                    return (
                        <div key={idx} className={`card base-card small-card`} style={{border:'1px solid #333',background:'#050505'}}>
                          <div style={{fontWeight:700}}>{card?.name ?? handCard.id}</div>
                        <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{card?.type ?? ''}</div>
                        <div style={{marginTop:8}}>{renderDetails(card ?? {id:handCard.id,name:handCard.id,type:'',cost:0,text:'' as any})}</div>
                        <div style={{marginTop:8,display:'flex',gap:8,flexDirection:'column'}}>
                          <div style={{fontSize:'0.9rem',fontWeight:600}}>{handCard.state === 'played' ? 'Played' : ''}</div>
                            <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>discardFromHand(idx, 'discarded')}>Discard</button>
                            {handCard.state === 'unspent' && (
                              card?.type === 'base' ? (
                                <button onClick={() => startPlayBase(handCard.id)}>Play</button>
                              ) : (
                                activePlay ? (
                                  <button onClick={() => attachModifier(handCard.id)}>Play</button>
                                ) : null
                              )
                            )}
                            </div>
                        </div>
                      </div>
                    )
                  })}
                  {((builderState.hand ?? []).length === 0) && <div style={{color:'#9aa0a6'}}>No cards in hand</div>}
                </div>
              </div>
            </section>

            {/* Discard Pile will be added after Deck Operations */}

            <section className="card-grid base-card-grid" style={{border:'1px solid #222',borderRadius:12,padding:16}}>
              <div>
                <h2>Deck Operations</h2>
                <p style={{marginTop:0,color:'#9aa0a6'}}>Shuffle, draw, and discard cards from your deck. Draw uses the top-of-deck (LIFO) model.</p>
                <div className="ops-toolbar">
                  <button onClick={()=>generateDeck(true)}>Build Deck</button>
                  <button onClick={()=>shuffleDeck()}>Shuffle</button>
                  <button onClick={()=>toggleLockDeck()}>{builderState.isLocked ? 'Unlock Deck' : 'Lock Deck'}</button>
                  <div className="ops-save">
                    <input placeholder="Deck name" value={builderState.deckName ?? ''} onChange={(e)=>setDeckName(e.target.value)} />
                    <button onClick={()=>saveDeck()}>Save Deck</button>
                    <button onClick={handleExport} title="Export current deck as JSON">Export</button>
                    <button onClick={onClickImport} title="Import deck from JSON file">Import</button>
                    <input ref={fileInputRef} type="file" accept="application/json" style={{display:'none'}} onChange={(e)=>handleImportedFile(e.target.files ? e.target.files[0] : null)} />
                  </div>
                </div>
                <div style={{marginTop:12}}>
                  <div style={{fontSize:'0.85rem'}}>Deck Count: <strong>{(builderState.deck ?? []).length}</strong></div>
                  <div style={{fontSize:'0.85rem'}}>Discard Count: <strong>{(builderState.discard ?? []).length}</strong></div>
                  {activePlay && (
                    <div style={{marginTop:12,border:'1px solid #444',padding:8,borderRadius:8,background:'#0a0a0a'}}>
                      <div style={{fontWeight:700}}>Active Play</div>
                      <div style={{fontSize:'0.9rem',color:'#9aa0a6',marginTop:6}}>Base: {Handbook.getAllCards().find(c=>c.id===activePlay.baseId)?.name ?? activePlay.baseId}</div>
                      <div style={{fontSize:'0.85rem',color:'#9aa0a6',marginTop:6}}>Modifiers: {activePlay.mods.length}</div>
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <button onClick={()=>finalizePlay()}>Finalize Play</button>
                        <button onClick={()=>cancelPlay()}>Cancel Play</button>
                      </div>
                    </div>
                  )}
                  <div style={{marginTop:8}}>
                    <label style={{fontWeight:600}}>Hand Limit</label>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                      <input type="number" min={0} value={builderState.handLimit ?? 5} onChange={(e)=>setBuilderState(prev=>({...prev, handLimit: parseInt(e.target.value,10)||5}))} style={{width:80,maxWidth:'100%',textAlign:'center'}} />
                      <div style={{color:'#9aa0a6',fontSize:'0.85rem'}}>Active cap for hand cards.</div>
                    </div>
                  </div>
                  <div style={{marginTop:8}}>
                    <div style={{fontWeight:600}}>Saved Decks</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6}}>
                      {Object.keys(builderState.savedDecks ?? {}).length === 0 && <div style={{color:'#9aa0a6'}}>No saved decks</div>}
                      {Object.entries(builderState.savedDecks ?? {}).map(([k,v])=> (
                        <div key={k} style={{display:'flex',gap:8,alignItems:'center'}}>
                          <div style={{minWidth:160}}>{v.name}</div>
                          <button onClick={()=>loadSavedDeck(k)}>Load</button>
                          <button onClick={()=>deleteSavedDeck(k)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section style={{border:'1px solid #222',borderRadius:12,padding:16,display:'grid',gridTemplateColumns:'1fr',gap:12}}>
              <div>
                <h3>Discard Pile</h3>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <div style={{fontSize:'0.85rem',color:'#9aa0a6'}}>Duplicates stacked</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {groupedDiscardElements}
                  {(groupedDiscardElements?.length ?? 0) === 0 && (builderState.discard ?? []).map((item, idx) => {
                    const card = Handbook.getAllCards().find(c => c.id === item.id)
                    return (
                      <div key={idx} className={`card base-card small-card`} style={{border:'1px solid #333',background:'#050505'}}>
                        <div style={{fontWeight:700}}>{card?.name ?? item.id}</div>
                        <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>#{idx+1} • {item.origin === 'played' ? 'Played' : 'Discarded'}</div>
                        <div style={{marginTop:8}}>{renderDetails(card ?? {id:item.id,name:item.id,type:'',cost:0,text:'' as any})}</div>
                        <div style={{display:'flex',gap:8,marginTop:8}}>
                          <button onClick={() => returnDiscardItemToDeck(idx)}>Return to Deck (Top)</button>
                          <button onClick={() => returnDiscardItemToHand(idx)} disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? 5)}>Return to Hand</button>
                        </div>
                      </div>
                    )
                  })}
                  {((builderState.discard ?? []).length === 0) && <div style={{color:'#9aa0a6'}}>Discard pile is empty</div>}
                </div>
              </div>
            </section>
              </div>
          </Pager>

      <div className="pager-nav" style={{display:'flex',justifyContent:'center',marginTop:12,gap:8}}>
          {[{i:0,label:'Builder'},{i:1,label:'Deck Ops'}].map(({i,label}) => (
            <div key={i} className={`pager-item`} aria-current={pageIndex === i} onClick={()=>setPageIndex(i)} style={{cursor:'pointer'}} role="button" aria-label={`Navigate to ${label}`}>
              <div className={`pager-dot ${pageIndex === i ? 'active' : ''}`} />
              <div className="pager-label">{label}</div>
            </div>
          ))}
        </div>
    </main>
  )
}
