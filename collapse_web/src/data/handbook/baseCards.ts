import { Card } from '../../domain/decks/DeckEngine'

// Base cards are the stable, canonical engram cards shipped with the handbook.
export const baseCards: Card[] = [
  { id: 'b1', name: 'Burning Memory', type: 'Event', text: 'Deal 1 damage to a target.' },
  { id: 'b2', name: 'Echo of Loss', type: 'Tactic', text: 'Discard a card to gain 2.' },
  { id: 'b3', name: 'Quiet Resolve', type: 'Skill', text: 'Prevent 1 damage this turn.' },
  { id: 'b4', name: 'Lucky13 Twist', type: 'Event', text: 'Draw two, discard one.' },
]

export default baseCards
