import React, {useEffect, useMemo, useState} from 'react'
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(builderState))
  }, [builderState])

  const baseTotal = sumCounts(builderState.baseCounts)
  const modCapacityUsed = useMemo(
    () =>
      modCards.reduce((total, card) => {
        const qty = builderState.modCounts[card.id] ?? 0
        const cost = card.cost ?? 0
        return total + qty * cost
      }, 0),
    [builderState.modCounts, modCards]
  )

  const baseValid = baseTotal === BASE_TARGET
  const nullValid = builderState.nullCount >= MIN_NULLS
  const modValid = modCapacityUsed <= builderState.modifierCapacity
  const deckIsValid = baseValid && nullValid && modValid

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
      if (!prev.isLocked) return prev
      const deck = [...(prev.deck ?? [])]
      const hand = [...(prev.hand ?? [])]
      const discard = [...(prev.discard ?? [])]

      if (deck.length === 0) {
        // shuffle discard back in if deck is empty
        if (discard.length === 0) return { ...prev }
        const ids = discard.map((d) => d.id)
        shuffleInPlace(ids)
        // when using FIFO we put shuffled cards into the front
        deck.push(...ids)
        discard.length = 0
      }
      // FIFO: draw from top-of-deck with shift
      const cardId = deck.shift()
      if (!cardId) return { ...prev, deck, hand, discard }
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

  const returnDiscardToDeck = (shuffle = true) => {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      // when returning discard to deck for FIFO, push them to the end (bottom) after shuffling
      const ids = discard.map((d) => d.id)
      if (shuffle) shuffleInPlace(ids)
      deck.push(...ids)
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
      return { ...prev, savedDecks: { ...(prev.savedDecks ?? {}), [n]: item }, deckName: n, isLocked: true }
    })
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
    setBuilderState((prev) => ({
      ...prev,
      modCounts: {
        ...prev.modCounts,
        [cardId]: clamp((prev.modCounts[cardId] ?? 0) + delta, 0),
      },
    }))
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


  const renderDetails = (card: Card) => {
    if (!card.details || card.details.length === 0) return null
    return (
      <dl style={{marginTop:8,marginBottom:0,display:'grid',gridTemplateColumns:'max-content 1fr',columnGap:8,rowGap:4,fontSize:'0.8rem'}}>
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
    <main style={{padding:'1rem',maxWidth:1100,margin:'0 auto',display:'flex',flexDirection:'column',gap:24}}>
      <header>
        <h1>Engram Deck Builder</h1>
        <p className="muted">Assemble MTG-style decks from official handbook data. Decks require 26 base cards, at least 5 Nulls, and modifier capacity must not be exceeded.</p>
      </header>

      <section style={{border:'1px solid #222',borderRadius:12,padding:16,background:'#080808',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
        <div>
          <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Base Cards</div>
          <div style={{fontSize:'1.8rem',fontWeight:700}}>{baseTotal} / {BASE_TARGET}</div>
          {!baseValid && <div style={{color:'#f7b500',fontSize:'0.85rem'}}>Deck must contain exactly 26 base cards.</div>}
        </div>

        <div>
          <h3>Discard Pile</h3>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {(builderState.discard ?? []).map((item, idx) => {
              const card = Handbook.getAllCards().find(c => c.id === item.id)
              return (
                <div key={idx} style={{border:'1px solid #333',borderRadius:10,padding:8,background:'#050505',minWidth:220}}>
                  <div style={{fontWeight:700}}>{card?.name ?? item.id}</div>
                  <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{item.origin === 'played' ? 'Played' : 'Discarded'}</div>
                </div>
              )
            })}
            {((builderState.discard ?? []).length === 0) && <div style={{color:'#9aa0a6'}}>Discard pile is empty</div>}
          </div>
        </div>
        <div>
          <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Null Cards</div>
          <div style={{fontSize:'1.8rem',fontWeight:700}}>{builderState.nullCount}</div>
          {!nullValid && <div style={{color:'#f7b500',fontSize:'0.85rem'}}>Minimum of {MIN_NULLS} Nulls required.</div>}
        </div>
        <div>
          <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Modifier Capacity</div>
          <div style={{fontSize:'1.8rem',fontWeight:700}}>{modCapacityUsed} / {builderState.modifierCapacity}</div>
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          {baseCards.map((card) => {
            const qty = builderState.baseCounts[card.id] ?? 0
            return (
              <div key={card.id} style={{border:'1px solid #333',borderRadius:10,padding:12,background:'#050505',display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:700}}>{card.name}</div>
                    <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{card.text}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
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

      <section style={{border:'1px solid #222',borderRadius:12,padding:16,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,alignItems:'center'}}>
        <div>
          <h2 style={{marginBottom:8}}>Null Cards</h2>
          <p style={{marginTop:0,color:'#9aa0a6'}}>GMs may raise or lower the number of Nulls. Decks must keep at least {MIN_NULLS}.</p>
          {nullCard && (
            <div style={{border:'1px solid #333',borderRadius:10,padding:12,background:'#050505',marginBottom:12}}>
              <div style={{fontWeight:700}}>{nullCard.name}</div>
              <div style={{fontSize:'0.85rem'}}>{nullCard.text}</div>
            </div>
          )}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <label style={{fontWeight:600}}>Null Count</label>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>adjustNullCount(-1)} disabled={builderState.isLocked}>-</button>
            <input type="number" min={MIN_NULLS} value={builderState.nullCount} onChange={(event)=>setNullCount(parseInt(event.target.value,10))} style={{width:80,textAlign:'center'}} />
            <button onClick={()=>adjustNullCount(1)} disabled={builderState.isLocked}>+</button>
          </div>
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
            <input type="number" min={0} value={builderState.modifierCapacity} onChange={(event)=>setModifierCapacity(parseInt(event.target.value,10))} style={{width:140}} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <label style={{fontWeight:600}}>Search Mods</label>
            <input type="text" placeholder="Search name, target, effect" value={modSearch} onChange={(event)=>setModSearch(event.target.value)} style={{minWidth:220}} />
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
          {filteredModCards.map((card) => {
            const qty = builderState.modCounts[card.id] ?? 0
            const cost = card.cost ?? 0
            return (
              <div key={card.id} style={{border:'1px solid #333',borderRadius:10,padding:12,background:'#050505',display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
                  <div>
                    <div style={{fontWeight:700}}>{card.name}</div>
                    <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>Cost {cost}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <button onClick={()=>adjustModCount(card.id,-1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                    <div style={{minWidth:24,textAlign:'center'}}>{qty}</div>
                    <button onClick={()=>adjustModCount(card.id,1)} disabled={builderState.isLocked}>+</button>
                  </div>
                </div>
                <p style={{margin:0,fontSize:'0.85rem'}}>{card.text}</p>
                {renderDetails(card)}
              </div>
            )
          })}
        </div>
      </section>

      <section style={{border:'1px solid #222',borderRadius:12,padding:16,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
        <div>
          <h2>Deck Operations</h2>
          <p style={{marginTop:0,color:'#9aa0a6'}}>Shuffle, draw, and discard cards from your deck. Draw uses the top-of-deck (LIFO) model.</p>
          <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
            <button onClick={()=>generateDeck(true)}>Build Deck</button>
            <button onClick={()=>shuffleDeck()}>Shuffle</button>
            <button onClick={()=>toggleLockDeck()}>{builderState.isLocked ? 'Unlock Deck' : 'Lock Deck'}</button>
            <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:12}}>
              <input placeholder="Deck name" value={builderState.deckName ?? ''} onChange={(e)=>setDeckName(e.target.value)} style={{width:200}} />
              <button onClick={()=>saveDeck()}>Save Deck</button>
            </div>
          </div>
          <div style={{marginTop:12}}>
            <div style={{fontSize:'0.85rem'}}>Deck Count: <strong>{(builderState.deck ?? []).length}</strong></div>
            <div style={{fontSize:'0.85rem'}}>Discard Count: <strong>{(builderState.discard ?? []).length}</strong></div>
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

        <div>
          <label style={{fontWeight:600}}>Hand Draw</label>
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
            <button onClick={()=>draw()} disabled={!builderState.isLocked}>Draw 1</button>
          </div>
        </div>

        <div>
          <h3>Hand</h3>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {(builderState.hand ?? []).map((handCard, idx) => {
                const card = Handbook.getAllCards().find(c => c.id === handCard.id)
              return (
                  <div key={idx} style={{border:'1px solid #333',borderRadius:10,padding:8,background:'#050505',minWidth:120}}>
                    <div style={{fontWeight:700}}>{card?.name ?? handCard.id}</div>
                  <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{card?.type ?? ''}</div>
                    <div style={{marginTop:8,display:'flex',gap:8,flexDirection:'column'}}>
                      <div style={{fontSize:'0.9rem',fontWeight:600}}>{handCard.state === 'unspent' ? 'Unspent' : 'Played'}</div>
                      <div style={{display:'flex',gap:8}}>
                        <button onClick={()=>discardFromHand(idx, 'discarded')}>Discard</button>
                        <button onClick={()=>discardFromHand(idx, 'played')}>Play</button>
                      </div>
                  </div>
                </div>
              )
            })}
            {((builderState.hand ?? []).length === 0) && <div style={{color:'#9aa0a6'}}>No cards in hand</div>}
          </div>
        </div>
      </section>
    </main>
  )
}
