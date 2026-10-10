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
- **Daily and weekly missions**: a fresh set of daily missions every day and weekly missions every Monday (00:00 UTC),
  tracked automatically. Missions cover kills, dungeons, crafting, trading, donations, world bosses and guild wars. Claimed
  missions fill an activity bar with treasure chests (daily 20/40/60/80/100, weekly 150/300/450/600).
- **Guilds and guild wars**: join one of five guilds or found your own (recruits arrive while you play). Daily gold,
  material and diamond donations level the guild (up to Lv 10) for a permanent Guild Blessing (+Attack, +Max HP) and
  earn Contribution for the guild shop. Guild chat comes alive with guildmates. **Guild Wars** (Lv 10+, two a day) are
  4-minute battles in the Spirit Crystal Arena: lead four guildmates against a rival guild, destroy their crystal and
  defend yours.
- **World bosses**: every 15 minutes a world boss descends on the Storm Altar north-east of Breezy Meadow (the
  Thunderhoof Behemoth, or a festival boss such as the Pumpkin King). Other adventurers teleport in to help, a live damage
  meter ranks everyone, and rewards scale with your rank, with a bonus for the last hit.
- **Trading and crafting**: monsters drop materials and gems into a separate pouch. Gorm's Forge crafts potions, tickets,
  pet eggs, gem pouches and Rare to Unique gear (with a Masterwork chance). The Market lists goods from other players at
  prices that drift through the day; list your own items and they sell over time (cheaper sells faster, 5% tax). Players
  also whisper you trade offers.
- **Equipment progression**: besides enhancing to +15, gear can be reforged (reroll affixes), re-tempered to your level,
  ascended up a rarity tier (Special gear awakens into a named Unique, Unique into a Legendary), socketed with Ruby,
  Sapphire, Emerald and Topaz gems in three levels (combine 3 into 1), and salvaged into Spirit Dust, Shards and Star
  Essence. The Legendary Codex tracks all 21 named items, grants a collection bonus and pays out at milestones.
- **Seasons, festivals and leaderboards**: each month is a season with a 30-tier Season Pass (free and premium tracks)
  and a Season leaderboard that pays out when the month ends. Leaderboards also rank Battle Rating, Level, World Boss
  damage, dungeon speed, guild war wins and guilds. Festivals follow the calendar: the Harvest Moon (October to early
  November) brings Jackpuffs, the Pumpkin King, Moon Candy, pumpkin decorations in town and a festival shop with the
  Pumpkin Pip pet, orange fairy wings and a title. Winter Starlight (December) and Sakura Bloom (spring) work the same way.
- **MMO systems**: Battle Rating, bag, skill upgrades, auto battle, auto potions, titles, daily sign-in, online gifts,
  a gold/diamond mall, world/guild/whisper chat with other adventurers, minimap and world map.
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
| Live systems | H missions, G guild, N market, Y forge, X codex, J season pass |
| Other | Space jump, Tab next target, F talk, Enter chat, Esc close |

Progress saves to the browser's local storage. Daily and weekly resets, world boss times and seasons follow the real clock (UTC).
Other players, guildmates, market sellers and rivals are simulated, so everything works offline and single-player.

## Code layout

| File | Purpose |
| --- | --- |
| `js/data.js` | Classes, skills, monsters, pets, mounts, quests and other tables |
| `js/toon.js` | Cel-shaded materials, ink outlines and canvas textures |
| `js/models.js` | Procedural chibi characters, monsters, pets, mounts and sprites |
| `js/world.js` | Terrain, town, scenery batching, collision grid and A* pathfinding |
| `js/fx.js` | Particles, skill effects, projectiles, telegraphs and combat text |
| `js/game.js` | Game state, combat, AI, quests, inventory, loot drops, dungeon runs and saving |
| `js/systems.js` | Missions, guilds, guild wars, world bosses, materials, crafting, market, gear upgrades, codex, festivals, season pass and leaderboards |
| `js/systems-data.js` | Tables for the systems above (missions, recipes, guilds, market goods, festivals, season rewards) |
| `js/models-event.js` | World bosses, festival monsters and pets, guild war crystals |
| `js/loot.js` | Rarity tiers, affixes, named Unique/Legendary items and loot rolls |
| `js/dungeon.js` | Dungeon and guild-war arena environments, rune seals, chests, exit portals and overworld entrances |
| `js/models-dungeon.js` | Dungeon monsters and bosses |
| `js/nav.js` | Walkability grid and A* pathfinding shared by the world and dungeons |
| `js/icons.js`, `js/icons/*.js` | SVG icon set (skills, UI, items) |
| `js/ui.js` | HUD, panels, dialogs, chat, minimap and world map |
| `js/ui-systems.js` | Panels and HUD widgets for the live systems |
| `js/main.js` | Boot, title screen, character creation and main loop |
