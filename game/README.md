# Emberwood Online

A small 2D top-down browser MMORPG (Heartwood Online–style): shared persistent world, tile movement, monsters, XP/levels, gold, potions and chat.

## Run
```
cd game
npm install
npm start        # http://localhost:3000  (PORT env var to change)
```
Open it in several tabs/browsers to play together.

## Controls
WASD/Arrows move · click ground to walk · click a monster to attack · Space targets nearest · Q drink potion · I open bag · Enter chat

## Notes
- Authoritative Node + `ws` server (10 Hz tick); the client is plain canvas, no build step.
- Characters are saved by name to `game/data/players.json` (no passwords yet — anyone can use a name when it is offline).
- Zones by distance from town: slimes (near) → wolves → skeletons (far). Town is safe and heals you.

## Loot & inventory
Monsters drop junk, potions, moonstones and randomly rolled gear (common → epic; deeper zones roll better rarities). 20-slot bag, 4 equipment slots (weapon, helm, armor, charm), sell loot in town.
