# Alfheim Tales — fan-made 3D browser MMORPG

A single-player tribute to the 2013 anime-style web MMORPG *Alfheim Tales Online*, built with Three.js.
Every model, texture, icon and sound is generated in code; no assets from the original game are used.

## Play

Serve this folder with any static web server and open `index.html`:

```sh
npx http-server alfheim -p 8080   # then visit http://localhost:8080
```

Three.js loads from jsDelivr, so the first load needs an internet connection.

## What's in it

- **World of Carlyle**: Sylvan Haven town with the four Spirit shrines and fountain, Breezy Meadow, Mossveil Forest,
  the Elder Ruins with a boss arena, a river with bridges, floating islands and the World Tree on the horizon.
- **4 classes, each tied to one of the four elements**: Knight (Earth), Assassin (Wind), Mage (Fire) and Priest (Water). Each class has 6 skills and a dual talent.
- **Story chapter**: 11 quests with NPC dialogs, auto-pathing from the quest tracker, kill and collect objectives and
  the Treant King Yggr boss with telegraphed red-circle attacks. Repeatable bounties follow.
- **Pets, sprites, mounts and wings**: 12 collectible pets that fight beside you, 4 elemental sprites, 5 mounts and fairy wings.
- **Dungeons**: three instanced dungeons with their own entrances in the world (Mossy Hollow Lv 6, Elder Catacombs Lv 11,
  Yggdrasil Roots Lv 16). Clear each chamber to break the rune seal ahead, then fight a boss with telegraphed attacks
  (slams, novas, root bursts, dragon breath, summons). Runs are timed and rated S/A/B; the rating sets the size of the
  treasure chest. Three free entries a day, then Dungeon Tickets or diamonds.
- **Loot**: gear drops on the ground with a light beam in its rarity color across six tiers: Common, Uncommon, Rare,
  Special, Unique and Legendary. Rare and better items roll bonus affixes (lifesteal, crit damage, cooldowns, thorns and
  more). Unique and Legendary items are named and carry a special power, such as chain lightning, meteor strikes every
  6th hit, phoenix rebirth or a healing nova. Loot auto-collects (toggle in Settings).
- **MMO systems**: Battle Rating, enhancement up to +15, bag, skill upgrades, auto battle, auto potions,
  daily sign-in, online gifts, a gold/diamond mall, a ranking board, world chat with other adventurers, minimap and world map.
- **Icons**: every icon is a hand-made SVG in `js/icons/`, so nothing depends on the device's emoji font.

## Controls

| Action | Input |
| --- | --- |
| Move / attack / talk | Click (or tap) the ground, a monster or an NPC; WASD also moves |
| Camera | Drag to rotate, scroll or pinch to zoom |
| Skills | 1–6 |
| Potions | Q (HP), E (MP) |
| Mount / Auto battle | R / T |
| Panels | C character, B bag, K skills, P pets, U mounts, L quests, M map, O settings |
| Other | Space jump, Tab next target, F talk, Enter chat, Esc close |

Progress saves to the browser's local storage.

## Code layout

| File | Purpose |
| --- | --- |
| `js/data.js` | Classes, skills, monsters, pets, mounts, quests and other tables |
| `js/toon.js` | Cel-shaded materials, ink outlines and canvas textures |
| `js/models.js` | Procedural chibi characters, monsters, pets, mounts and sprites |
| `js/world.js` | Terrain, town, scenery batching, collision grid and A* pathfinding |
| `js/fx.js` | Particles, skill effects, projectiles, telegraphs and combat text |
| `js/game.js` | Game state, combat, AI, quests, inventory, loot drops, dungeon runs and saving |
| `js/loot.js` | Rarity tiers, affixes, named Unique/Legendary items and loot rolls |
| `js/dungeon.js` | Dungeon environments, rune seals, chests, exit portals and overworld entrances |
| `js/models-dungeon.js` | Dungeon monsters and bosses |
| `js/nav.js` | Walkability grid and A* pathfinding shared by the world and dungeons |
| `js/icons.js`, `js/icons/*.js` | SVG icon set (skills, UI, items) |
| `js/ui.js` | HUD, panels, dialogs, chat, minimap and world map |
| `js/main.js` | Boot, title screen, character creation and main loop |
