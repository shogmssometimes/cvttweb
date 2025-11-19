import React, {useMemo, useRef, useState} from 'react'
import DeckEngine, {Card} from '../domain/decks/DeckEngine'
import Handbook from '../data/handbook'

// A small sample card pool for initial builder — used as a fallback if the handbook
// hasn't been imported yet.
const SAMPLE_CARDS: Card[] = [
  { id: 'c1', name: 'Burning Memory', type: 'Event', text: 'Deal 1 damage to a target.' },
  { id: 'c2', name: 'Echo of Loss', type: 'Tactic', text: 'Discard a card to gain 2.' },
  { id: 'c3', name: 'Quiet Resolve', type: 'Skill', text: 'Prevent 1 damage this turn.' },
  { id: 'c4', name: 'Lucky13 Twist', type: 'Event', text: 'Draw two, discard one.' },
  { id: 'c5', name: 'Network Trace', type: 'Support', text: 'Peek top 3 cards.' },
]

export default function DeckBuilder(){
  const engineRef = useRef<DeckEngine>(new DeckEngine(SAMPLE_CARDS.slice(0,0)))
  // Prefer handbook card pool if available; otherwise fall back to SAMPLE_CARDS.
  const handbookPool = Handbook.getAllCards ? Handbook.getAllCards() : []
  const [pool] = useState<Card[]>(handbookPool.length > 0 ? handbookPool : SAMPLE_CARDS)
  const [deckVersion, setDeckVersion] = useState(0)

  const state = useMemo(()=> engineRef.current.getState(), [deckVersion])

  function addToDeck(card:Card){
    engineRef.current.addCardToLibrary({...card, id: `${card.id}-${Date.now()}`})
    setDeckVersion(v=>v+1)
  }

  function removeFromDeck(id:string){
    engineRef.current.removeCardFromLibraryById(id)
    setDeckVersion(v=>v+1)
  }

  function shuffle(){
    engineRef.current.shuffle()
    setDeckVersion(v=>v+1)
  }

  function draw(){
    engineRef.current.draw(1)
    setDeckVersion(v=>v+1)
  }

  function reset(){
    engineRef.current.reset()
    setDeckVersion(v=>v+1)
  }

  // Import functionality removed: handbook updates are developer-driven only.

  return (
    <main style={{padding:'1rem',maxWidth:960,margin:'0 auto'}}>
      <header>
        <h1>Engram Deck Builder</h1>
        <p className="muted">Build your deck (MTG-like). Tap a card in the pool to add it — deck updates live.</p>
      </header>

      <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
        <div>
          <h3>Card Pool</h3>
          <div style={{marginBottom:12}}>
            <label style={{display:'block',marginBottom:6}}>Card pool (handbook)</label>
            <div style={{color:'#9aa0a6',fontSize:'0.9rem'}}>
              Handbook data is developer-maintained. To update cards, edit the TypeScript modules
              under <code>src/data/handbook/</code> and commit the change.
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8}}>
            {pool.map(c=> (
              <div key={c.id} style={{border:'1px solid #222',padding:10,borderRadius:8,background:'#070707'}}>
                <div style={{fontWeight:700}}>{c.name}</div>
                <div style={{fontSize:'0.8rem',color:'#9aa0a6'}}>{c.type}</div>
                <p style={{fontSize:'0.8rem'}}>{c.text}</p>
                <button onClick={()=>addToDeck(c)} style={{width:'100%'}}>Add</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Your Deck</h3>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            <button onClick={shuffle}>Shuffle</button>
            <button onClick={draw}>Draw</button>
            <button onClick={()=>{ engineRef.current.returnDiscardToLibrary(true); setDeckVersion(v=>v+1); }}>Return Discard</button>
            <button onClick={reset}>Reset</button>
          </div>

          <div style={{border:'1px solid #222',borderRadius:10,padding:12,background:'#080808'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div>Library: {state.library.length}</div>
              <div>Hand: {state.hand.length}</div>
              <div>Discard: {state.discard.length}</div>
            </div>

            <h4 style={{marginTop:12}}>Top of Library (first 10)</h4>
            <ul style={{margin:0,paddingLeft:16}}>
              {state.library.slice(0,10).map(c=> (
                <li key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{c.name}</span>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{ engineRef.current.moveToTop(c); setDeckVersion(v=>v+1); }}>Top</button>
                    <button onClick={()=>removeFromDeck(c.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>

            <h4 style={{marginTop:12}}>Hand</h4>
            <ul style={{margin:0,paddingLeft:16}}>
              {state.hand.map((c,i)=> (
                <li key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{c.name}</span>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{ engineRef.current.playFromHand(i); setDeckVersion(v=>v+1) }}>Play</button>
                    <button onClick={()=>{ engineRef.current.discardFromHand(i); setDeckVersion(v=>v+1) }}>Discard</button>
                  </div>
                </li>
              ))}
            </ul>

            <h4 style={{marginTop:12}}>Discard</h4>
            <ul style={{margin:0,paddingLeft:16}}>
              {state.discard.map(c=> (<li key={c.id}>{c.name}</li>))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
