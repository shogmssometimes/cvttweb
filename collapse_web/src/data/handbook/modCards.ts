import { Card } from '../../domain/decks/DeckEngine'

// Mod cards are the frequently-updated content (upgrades, modifiers, expansions).
export const modCards: Card[] = [
  { id: 'm1', name: 'Network Trace', type: 'Support', text: 'Peek top 3 cards.' },
  // Placeholder — real mod cards will come from handbook imports.
]

export default modCards
