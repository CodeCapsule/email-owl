// Static game data: classes, skills, monsters, pets, mounts, sprites, NPCs, quests, items.

export const QUALITY = [
  { name: 'Common', color: '#e8e8e8', mult: 1.0 },
  { name: 'Uncommon', color: '#5ee05a', mult: 1.3 },
  { name: 'Rare', color: '#4aa8ff', mult: 1.7 },
  { name: 'Epic', color: '#c46bff', mult: 2.2 },
  { name: 'Legendary', color: '#ff9a2e', mult: 3.0 },
];

export const CLASSES = {
  knight: {
    name: 'Knight', element: 'Earth', elemColor: '#d9a441', icon: '⚔️',
    desc: 'A stalwart warrior blessed by the Earth Spirit. Knights stand at the front line, shielding allies and crushing foes with heavy blows.',
    talents: [
      { name: 'Guardian', role: 'Tank', desc: '+30% Max HP, +25% Defense', mods: { hp: 1.3, def: 1.25 } },
      { name: 'Berserker', role: 'Damage', desc: '+20% Attack, +5% Critical', mods: { atk: 1.2, crit: 5 } },
    ],
    base: { hp: 260, mp: 90, atk: 20, def: 14, crit: 5 },
    grow: { hp: 36, mp: 6, atk: 4.4, def: 3.2 },
    range: 2.8, ranged: false, speed: 7.2,
    ratings: { Attack: 3, Defense: 5, Control: 3, Difficulty: 1 },
    outfit: { main: 0xc9d3e6, accent: 0x2f5fb8, trim: 0xe8b64a, skirt: 0x3a4a78 },
    weapon: 'sword', hat: 'none',
  },
  assassin: {
    name: 'Assassin', element: 'Wind', elemColor: '#59e0a4', icon: '🗡️',
    desc: 'A swift shadow guided by the Wind Spirit. Assassins dart between enemies, striking weak points with twin blades.',
    talents: [
      { name: 'Shadow', role: 'Burst', desc: '+12% Critical, +20% Crit Damage', mods: { crit: 12, critDmg: 0.2 } },
      { name: 'Duelist', role: 'Sustain', desc: '+15% Attack, +10% Max HP', mods: { atk: 1.15, hp: 1.1 } },
    ],
    base: { hp: 190, mp: 100, atk: 24, def: 9, crit: 15 },
    grow: { hp: 26, mp: 7, atk: 5.2, def: 2.0 },
    range: 2.5, ranged: false, speed: 7.8,
    ratings: { Attack: 5, Defense: 2, Control: 2, Difficulty: 3 },
    outfit: { main: 0x3b2f5c, accent: 0x55d6a8, trim: 0xb0b8d0, skirt: 0x2a2140 },
    weapon: 'daggers', hat: 'none',
  },
  mage: {
    name: 'Mage', element: 'Fire', elemColor: '#ff7a3d', icon: '🔥',
    desc: 'A scholar of the Fire Spirit who calls down flame and meteor from afar. Fragile, but devastating against groups.',
    talents: [
      { name: 'Pyromancer', role: 'Damage', desc: '+20% Attack', mods: { atk: 1.2 } },
      { name: 'Arcanist', role: 'Control', desc: '+30% Max MP, -15% Cooldowns', mods: { mp: 1.3, cdr: 0.15 } },
    ],
    base: { hp: 150, mp: 150, atk: 26, def: 6, crit: 8 },
    grow: { hp: 21, mp: 12, atk: 5.6, def: 1.5 },
    range: 15, ranged: true, speed: 7.0,
    ratings: { Attack: 5, Defense: 1, Control: 4, Difficulty: 2 },
    outfit: { main: 0xc2373b, accent: 0xffd36b, trim: 0x2b2340, skirt: 0x8e2230 },
    weapon: 'staff', hat: 'witch',
  },
  priest: {
    name: 'Priest', element: 'Water', elemColor: '#4fb8ff', icon: '✨',
    desc: 'A gentle servant of the Water Spirit. Priests mend wounds, bless allies and wash foes away with tidal magic.',
    talents: [
      { name: 'Oracle', role: 'Healer', desc: '+30% Healing, +20% Max MP', mods: { heal: 1.3, mp: 1.2 } },
      { name: 'Inquisitor', role: 'Damage', desc: '+20% Attack, +5% Critical', mods: { atk: 1.2, crit: 5 } },
    ],
    base: { hp: 170, mp: 160, atk: 20, def: 9, crit: 6 },
    grow: { hp: 24, mp: 12, atk: 4.5, def: 2.0 },
    range: 14, ranged: true, speed: 7.0,
    ratings: { Attack: 2, Defense: 3, Control: 3, Difficulty: 2 },
    outfit: { main: 0xf4f6ff, accent: 0x3f8cff, trim: 0xf0c24a, skirt: 0xdfe8ff },
    weapon: 'scepter', hat: 'circlet',
  },
};

// kind: target | aoeTarget | aoeSelf | dash | proj | buff | heal | zone
export const SKILLS = {
  knight: [
    { id: 'k0', name: 'Slash', icon: '⚔️', lvl: 1, cd: 1.0, mp: 0, kind: 'target', range: 2.8, mult: 1.0, fx: 'slash', basic: true, desc: 'Basic attack.' },
    { id: 'k1', name: 'Heavy Strike', icon: '🪓', lvl: 1, cd: 5, mp: 10, kind: 'target', range: 3, mult: 2.3, fx: 'bigslash', desc: 'A crushing blow that deals 230% Attack damage.' },
    { id: 'k2', name: 'Whirlwind', icon: '🌀', lvl: 3, cd: 8, mp: 18, kind: 'aoeSelf', radius: 5, mult: 1.7, fx: 'spin', desc: 'Spin your blade, hitting all nearby enemies for 170%.' },
    { id: 'k3', name: 'Shield Bash', icon: '🛡️', lvl: 6, cd: 10, mp: 15, kind: 'target', range: 3, mult: 1.5, stun: 2, fx: 'bash', desc: 'Bash the target for 150% and stun it for 2s.' },
    { id: 'k4', name: 'Earthshatter', icon: '⛰️', lvl: 10, cd: 14, mp: 30, kind: 'aoeTarget', range: 4, radius: 6, mult: 2.7, fx: 'quake', desc: 'Slam the ground, erupting rocks that deal 270% in an area.' },
    { id: 'k5', name: 'Iron Bastion', icon: '🏰', lvl: 14, cd: 25, mp: 25, kind: 'buff', buff: { def: 1.5 }, dur: 10, healPct: 0.15, fx: 'buffEarth', desc: 'Restore 15% HP and raise Defense by 50% for 10s.' },
    { id: 'k6', name: "Titan's Wrath", icon: '💥', lvl: 18, cd: 30, mp: 45, kind: 'aoeSelf', radius: 8, mult: 4.0, fx: 'titan', desc: 'Call the might of the earth: 400% to all enemies around you.' },
  ],
  assassin: [
    { id: 'a0', name: 'Stab', icon: '🗡️', lvl: 1, cd: 0.8, mp: 0, kind: 'target', range: 2.5, mult: 0.9, fx: 'slash2', basic: true, desc: 'Basic attack.' },
    { id: 'a1', name: 'Shadow Strike', icon: '🌑', lvl: 1, cd: 5, mp: 10, kind: 'dash', range: 12, mult: 2.1, fx: 'dash', desc: 'Dash to the target and strike for 210%.' },
    { id: 'a2', name: 'Twin Fangs', icon: '✖️', lvl: 3, cd: 7, mp: 14, kind: 'target', range: 2.8, mult: 0.95, hits: 3, fx: 'slash2', desc: 'Three rapid slashes, each dealing 95%.' },
    { id: 'a3', name: 'Venom Edge', icon: '🧪', lvl: 6, cd: 10, mp: 15, kind: 'target', range: 2.8, mult: 1.2, dot: { ticks: 5, mult: 0.6 }, fx: 'venom', desc: 'Strike for 120% and poison: 60% every second for 5s.' },
    { id: 'a4', name: 'Gale Fan', icon: '🍃', lvl: 10, cd: 12, mp: 25, kind: 'aoeTarget', range: 10, radius: 5, mult: 2.3, fx: 'gale', desc: 'Hurl a storm of wind blades: 230% in an area.' },
    { id: 'a5', name: 'Phantom Veil', icon: '👤', lvl: 14, cd: 25, mp: 20, kind: 'buff', buff: { crit: 40, speed: 1.3 }, dur: 8, fx: 'buffWind', desc: '+40% Critical and +30% speed for 8s.' },
    { id: 'a6', name: 'Tempest Dance', icon: '🌪️', lvl: 18, cd: 30, mp: 40, kind: 'aoeSelf', radius: 7, mult: 0.95, hits: 6, fx: 'tempest', desc: 'Dance through foes: 6 hits of 95% around you.' },
  ],
  mage: [
    { id: 'm0', name: 'Firebolt', icon: '🔥', lvl: 1, cd: 1.1, mp: 0, kind: 'proj', range: 15, mult: 1.0, fx: 'firebolt', basic: true, desc: 'Basic attack.' },
    { id: 'm1', name: 'Fireball', icon: '☄️', lvl: 1, cd: 3, mp: 10, kind: 'proj', range: 15, mult: 2.1, fx: 'fireball', desc: 'Launch a fireball dealing 210%.' },
    { id: 'm2', name: 'Flame Pillar', icon: '🕯️', lvl: 3, cd: 8, mp: 20, kind: 'aoeTarget', range: 15, radius: 4, mult: 2.2, fx: 'pillar', desc: 'Erupt a column of fire under the target: 220% in an area.' },
    { id: 'm3', name: 'Blazing Ring', icon: '⭕', lvl: 6, cd: 10, mp: 22, kind: 'aoeSelf', radius: 6, mult: 1.7, stun: 1, fx: 'ring', desc: 'A ring of fire bursts outward: 170% and stuns for 1s.' },
    { id: 'm4', name: 'Meteor', icon: '🌠', lvl: 10, cd: 15, mp: 35, kind: 'aoeTarget', range: 15, radius: 6, mult: 3.3, delay: 0.8, fx: 'meteor', desc: 'Call down a meteor: 330% in a large area.' },
    { id: 'm5', name: 'Arcane Barrier', icon: '🔮', lvl: 14, cd: 25, mp: 25, kind: 'buff', shieldPct: 0.3, dur: 10, fx: 'buffFire', desc: 'Absorb damage equal to 30% Max HP for 10s.' },
    { id: 'm6', name: 'Inferno', icon: '🌋', lvl: 18, cd: 30, mp: 50, kind: 'aoeTarget', range: 15, radius: 8, mult: 1.3, hits: 5, fx: 'inferno', desc: 'Rain fire on an area: 5 waves of 130%.' },
  ],
  priest: [
    { id: 'p0', name: 'Water Bolt', icon: '💧', lvl: 1, cd: 1.1, mp: 0, kind: 'proj', range: 14, mult: 0.95, fx: 'waterbolt', basic: true, desc: 'Basic attack.' },
    { id: 'p1', name: 'Aqua Orb', icon: '🔵', lvl: 1, cd: 3, mp: 8, kind: 'proj', range: 14, mult: 1.9, fx: 'aquaorb', desc: 'Fire a pressurised orb of water: 190%.' },
    { id: 'p2', name: 'Healing Light', icon: '💚', lvl: 3, cd: 8, mp: 20, kind: 'heal', healPct: 0.32, fx: 'heal', desc: 'Restore 32% of your Max HP.' },
    { id: 'p3', name: 'Tidal Wave', icon: '🌊', lvl: 6, cd: 10, mp: 22, kind: 'aoeTarget', range: 14, radius: 5, mult: 2.0, fx: 'tidal', desc: 'A crashing wave deals 200% in an area.' },
    { id: 'p4', name: 'Aqua Prison', icon: '🫧', lvl: 10, cd: 12, mp: 20, kind: 'proj', range: 14, mult: 1.5, stun: 3, fx: 'prison', desc: 'Trap the target in a bubble: 150% and stun for 3s.' },
    { id: 'p5', name: 'Divine Blessing', icon: '👼', lvl: 14, cd: 25, mp: 25, kind: 'buff', buff: { atk: 1.3, def: 1.3 }, dur: 12, fx: 'buffWater', desc: '+30% Attack and Defense for 12s.' },
    { id: 'p6', name: 'Sanctuary', icon: '⛲', lvl: 18, cd: 30, mp: 45, kind: 'zone', radius: 7, mult: 0.9, ticks: 6, healPct: 0.05, fx: 'sanctuary', desc: 'Holy ground: heals 5%/s and deals 90%/s to foes for 6s.' },
  ],
};

export const MONSTERS = {
  jelly: { name: 'Jellopop', lvl: [1, 3], hp: 70, atk: 9, def: 2, exp: 20, gold: [3, 9], model: 'jelly', aggressive: false, speed: 3.2, range: 1.8, height: 1.4, drops: [{ id: 'pet_jelly', chance: 0.03 }] },
  bunny: { name: 'Fluffbun', lvl: [3, 5], hp: 130, atk: 15, def: 4, exp: 36, gold: [6, 14], model: 'bunny', aggressive: false, speed: 4, range: 1.8, height: 1.6, drops: [{ id: 'pet_bunny', chance: 0.03 }] },
  shroom: { name: 'Shroomling', lvl: [5, 7], hp: 220, atk: 23, def: 7, exp: 58, gold: [10, 20], model: 'shroom', aggressive: false, speed: 3.4, range: 1.9, height: 1.8, drops: [{ id: 'pet_shroom', chance: 0.03 }] },
  wolf: { name: 'Thornwolf', lvl: [7, 9], hp: 330, atk: 33, def: 10, exp: 90, gold: [14, 28], model: 'wolf', aggressive: true, speed: 5.5, range: 2.2, height: 1.7, drops: [{ id: 'pet_owl', chance: 0.02 }] },
  golem: { name: 'Ruin Golem', lvl: [11, 13], hp: 900, atk: 58, def: 24, exp: 220, gold: [30, 55], model: 'golem', aggressive: false, speed: 3.2, range: 2.8, height: 3.3, drops: [{ id: 'pet_ghost', chance: 0.03 }] },
  treant: { name: 'Bramble Treant', lvl: [10, 12], hp: 1150, atk: 52, def: 18, exp: 280, gold: [30, 60], model: 'treant', aggressive: true, elite: true, speed: 3.6, range: 3, height: 3.8, drops: [{ id: 'pet_egg', chance: 0.15 }] },
  boss: { name: 'Treant King Yggr', lvl: [15, 15], hp: 9500, atk: 80, def: 26, exp: 2600, gold: [400, 600], model: 'boss', aggressive: true, boss: true, speed: 3.4, range: 4.5, height: 8, drops: [{ id: 'pet_dragon', chance: 0.25 }, { id: 'mount_unicorn', chance: 0.15 }] },
};

export const SPAWNS = [
  { type: 'jelly', x: 108, z: -12, r: 24, count: 10 },
  { type: 'bunny', x: 132, z: 52, r: 24, count: 9 },
  { type: 'shroom', x: -18, z: 112, r: 24, count: 9 },
  { type: 'wolf', x: 42, z: 140, r: 20, count: 8 },
  { type: 'treant', x: -86, z: -58, r: 20, count: 5 },
  { type: 'golem', x: -122, z: 52, r: 20, count: 6 },
  { type: 'boss', x: -150, z: -112, r: 4, count: 1 },
];

export const ZONES = [
  { name: 'Sylvan Haven', x: 0, z: 0, r: 52, safe: true, lv: 'Town' },
  { name: 'Breezy Meadow', x: 120, z: 20, r: 70, lv: 'Lv 1-5' },
  { name: 'Mossveil Forest', x: 12, z: 122, r: 70, lv: 'Lv 5-9' },
  { name: 'Elder Ruins', x: -120, z: -20, r: 95, lv: 'Lv 10-15' },
  { name: 'World Tree Overlook', x: 0, z: -130, r: 70, lv: 'Scenic' },
];

export const PETS = [
  { id: 'pet_icecream', name: 'Scoopy', species: 'Ice Cream', rarity: 0, atk: 6, hp: 40, model: 'icecream', src: 'Quest: A Loyal Friend' },
  { id: 'pet_cat', name: 'Mochi', species: 'Cat', rarity: 0, atk: 7, hp: 35, model: 'cat', src: 'Daily Sign-In, Day 3' },
  { id: 'pet_jelly', name: 'Wobbles', species: 'Jelly', rarity: 0, atk: 6, hp: 50, model: 'minijelly', src: 'Drop: Jellopop' },
  { id: 'pet_bunny', name: 'Fluffkin', species: 'Bunny', rarity: 0, atk: 8, hp: 30, model: 'minibunny', src: 'Drop: Fluffbun' },
  { id: 'pet_shroom', name: 'Mushy', species: 'Mushroom', rarity: 1, atk: 10, hp: 60, model: 'minishroom', src: 'Drop: Shroomling' },
  { id: 'pet_cupcake', name: 'Cupcake Puff', species: 'Cupcake', rarity: 1, atk: 11, hp: 70, model: 'cupcake', src: 'Mall: 1,800 Gold' },
  { id: 'pet_penguin', name: 'Pengu', species: 'Penguin', rarity: 1, atk: 12, hp: 60, model: 'penguin', src: 'Online Gift' },
  { id: 'pet_owl', name: 'Hootie', species: 'Owl', rarity: 1, atk: 13, hp: 55, model: 'owl', src: 'Drop: Thornwolf' },
  { id: 'pet_puppet', name: 'Pip', species: 'Puppet', rarity: 2, atk: 16, hp: 80, model: 'puppet', src: 'Mall: 4,500 Gold' },
  { id: 'pet_ghost', name: 'Boo', species: 'Ghost', rarity: 2, atk: 18, hp: 70, model: 'ghost', src: 'Drop: Ruin Golem' },
  { id: 'pet_star', name: 'Twinkle', species: 'Star', rarity: 3, atk: 24, hp: 110, model: 'star', src: 'Mall: 300 Diamonds' },
  { id: 'pet_dragon', name: 'Sparky', species: 'Baby Dragon', rarity: 3, atk: 28, hp: 120, model: 'dragon', src: 'Drop: Treant King Yggr' },
];

export const SPRITES = [
  { id: 'sp_fire', name: 'Ember', element: 'Fire', color: 0xff6a2a, desc: '+8% Attack', mods: { atk: 1.08 } },
  { id: 'sp_water', name: 'Aqua', element: 'Water', color: 0x3fb4ff, desc: 'Restores 2% HP every 4s', regen: 0.02 },
  { id: 'sp_wind', name: 'Zephyr', element: 'Wind', color: 0x5cf0a6, desc: '+10% Move Speed, +3% Critical', mods: { speed: 1.1, crit: 3 } },
  { id: 'sp_earth', name: 'Terra', element: 'Earth', color: 0xe0b040, desc: '+12% Defense', mods: { def: 1.12 } },
];
export const CLASS_SPRITE = { knight: 'sp_earth', assassin: 'sp_wind', mage: 'sp_fire', priest: 'sp_water' };

export const MOUNTS = [
  { id: 'mount_chick', name: 'Fluffy Chick', speed: 1.45, br: 120, model: 'chick', src: 'Quest: Swift as the Wind' },
  { id: 'mount_panda', name: 'Bamboo Panda', speed: 1.5, br: 180, model: 'panda', src: 'Daily Sign-In, Day 7' },
  { id: 'mount_wolf', name: 'Frost Wolf', speed: 1.6, br: 260, model: 'frostwolf', src: 'Mall: 6,000 Gold' },
  { id: 'mount_pegasus', name: 'Pegasus', speed: 1.75, br: 420, model: 'pegasus', src: 'Mall: 500 Diamonds' },
  { id: 'mount_unicorn', name: 'Starlight Unicorn', speed: 1.75, br: 480, model: 'unicorn', src: 'Drop: Treant King Yggr' },
];

export const ITEMS = {
  hp_potion: { name: 'Healing Draught', icon: '🧪', type: 'consumable', quality: 0, stack: 99, price: 40, desc: 'Restores 35% Max HP.', tint: '#ff5a6a' },
  mp_potion: { name: 'Mana Draught', icon: '🧴', type: 'consumable', quality: 0, stack: 99, price: 40, desc: 'Restores 35% Max MP.', tint: '#4aa8ff' },
  pet_egg: { name: 'Mystery Pet Egg', icon: '🥚', type: 'egg', quality: 2, stack: 99, price: 900, desc: 'Hatch to receive a random pet you do not own yet.' },
  glowcap: { name: 'Glowcap', icon: '🍄', type: 'quest', quality: 1, stack: 99, desc: 'A luminous mushroom from Mossveil Forest.' },
  exp_scroll: { name: 'Scroll of Wisdom', icon: '📜', type: 'consumable', quality: 2, stack: 99, price: 600, desc: 'Grants experience equal to 25% of your current level.' },
};

export const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'necklace', 'ring'];
export const SLOT_INFO = {
  weapon: { label: 'Weapon', icon: '⚔️' },
  helm: { label: 'Helm', icon: '⛑️' },
  armor: { label: 'Armor', icon: '🥋' },
  boots: { label: 'Boots', icon: '👢' },
  necklace: { label: 'Necklace', icon: '📿' },
  ring: { label: 'Ring', icon: '💍' },
};
export const WEAPON_NAMES = { knight: 'Longsword', assassin: 'Twin Daggers', mage: 'Ember Staff', priest: 'Tidal Scepter' };
export const WEAPON_ICONS = { knight: '⚔️', assassin: '🗡️', mage: '🪄', priest: '🔱' };
export const QUALITY_PREFIX = ['Worn', 'Sturdy', 'Sylvan', 'Elven', 'Yggdrasil'];
export const SLOT_BASE = { helm: 'Helm', armor: 'Tunic', boots: 'Boots', necklace: 'Amulet', ring: 'Ring' };

export const NPCS = [
  { id: 'elder', name: 'Elder Rowan', title: 'Village Elder', x: -6, z: -16, look: 'elder', face: 0.5,
    greet: 'The Spirits have been restless, traveler. Carlyle needs heroes now more than ever.' },
  { id: 'mimi', name: 'Mimi', title: 'Pet Keeper', x: 18, z: -10, look: 'mimi', face: -1.2, service: 'pets',
    greet: 'Nyaa~! Every adventurer needs a fluffy friend. Have you met all my little ones?' },
  { id: 'brom', name: 'Brom', title: 'Stablemaster', x: 24, z: 16, look: 'brom', face: -2.2, service: 'mounts',
    greet: 'Long roads ahead, friend. Best not walk them on foot!' },
  { id: 'lyla', name: 'Lyla', title: 'Merchant', x: -20, z: 10, look: 'lyla', face: 1.9, service: 'shop',
    greet: 'Potions, eggs, scrolls! Fresh stock every dawn. Take a look~' },
  { id: 'gorm', name: 'Gorm', title: 'Blacksmith', x: -26, z: -8, look: 'gorm', face: 1.4, service: 'enhance',
    greet: 'Bring me your gear and gold. I will make it sing!' },
  { id: 'elena', name: 'Captain Elena', title: 'Guard Captain', x: 34, z: 2, look: 'elena', face: -1.6, service: 'bounty',
    greet: 'The roads are dangerous. I always have bounties for capable hands.' },
  { id: 'sylphie', name: 'Sylphie', title: 'Spirit Guide', x: 6, z: 18, look: 'sylphie', face: 3.0,
    greet: 'The four Spirits watch over Carlyle. Listen closely and they will guide you.' },
  { id: 'nix', name: 'Nix', title: 'Teleporter', x: 0, z: -40, look: 'nix', face: 0, service: 'teleport',
    greet: 'Where shall the winds carry you today?' },
];

export const TELEPORTS = [
  { name: 'Sylvan Haven', x: 0, z: -34, lv: 'Town' },
  { name: 'Breezy Meadow', x: 92, z: 2, lv: 'Lv 1-5' },
  { name: 'Mossveil Forest', x: 6, z: 92, lv: 'Lv 5-9' },
  { name: 'Elder Ruins', x: -86, z: -6, lv: 'Lv 10-15' },
  { name: 'World Tree Overlook', x: 0, z: -150, lv: 'Scenic' },
];

// Main story chain. type: talk | kill | collect | end
export const QUESTS = [
  { id: 'q1', name: 'Welcome to Carlyle', giver: 'elder', turnin: 'elder', type: 'talk',
    text: 'Ah, a new face! Welcome to Sylvan Haven, heart of Carlyle. The Four Spirits — Fire, Water, Wind and Earth — have kept our world in balance for ages. But lately the forest grows wild and the creatures restless. You arrived just in time.',
    done: 'Rest a moment, then let us see what you can do.', rewards: { exp: 60, gold: 120, items: [['hp_potion', 10], ['mp_potion', 5]] }, next: 'q2' },
  { id: 'q2', name: 'Jelly Trouble', giver: 'elder', turnin: 'elder', type: 'kill', target: 'jelly', count: 6,
    text: 'Jellopops from Breezy Meadow keep oozing into the crop fields east of the river. Cross the bridge and defeat 6 of them. Do not let their cute faces fool you!',
    done: 'Splendid work! Take this weapon — it suits you far better than that stick.', rewards: { exp: 260, gold: 200, equip: 'weapon' }, next: 'q3' },
  { id: 'q3', name: 'A Loyal Friend', giver: 'elder', turnin: 'mimi', type: 'talk',
    text: 'No adventurer should travel alone. Mimi, our Pet Keeper, has been raising a little companion just for you. Go see her by the eastern houses.',
    done: 'Nyaa~! This is Scoopy! Scoopy will follow you everywhere and fight by your side. Be gentle, Scoopy melts when nervous!', rewards: { exp: 160, gold: 100, pet: 'pet_icecream' }, next: 'q4' },
  { id: 'q4', name: 'Fluffy Menace', giver: 'mimi', turnin: 'mimi', type: 'kill', target: 'bunny', count: 8,
    text: 'The Fluffbuns in the southern meadow have been stealing my pet treats! Teach 8 of them a lesson — Scoopy will help!',
    done: 'My treats are safe! Here, take this Mystery Egg. Who knows what will hatch~', rewards: { exp: 520, gold: 260, items: [['pet_egg', 1]] }, next: 'q5' },
  { id: 'q5', name: 'Swift as the Wind', giver: 'mimi', turnin: 'brom', type: 'talk',
    text: 'You will be traveling far, so you need a mount! Brom the Stablemaster is just south of the plaza.',
    done: 'Hah! So you are the hero everyone talks about. Take this Fluffy Chick — fastest bird in Carlyle. Press R to ride!', rewards: { exp: 320, gold: 150, mount: 'mount_chick' }, next: 'q6' },
  { id: 'q6', name: "Spirit's Call", giver: 'brom', turnin: 'sylphie', type: 'talk',
    text: 'Sylphie the Spirit Guide has been asking for you. Something about your element... spirits give me the shivers.',
    done: 'The Spirits have chosen you! Receive this Sprite and these Fairy Wings, symbols of their blessing. May they light your way.', rewards: { exp: 420, gold: 200, sprite: true, wings: true }, next: 'q7' },
  { id: 'q7', name: 'Glowcap Harvest', giver: 'sylphie', turnin: 'lyla', type: 'collect', target: 'shroom', item: 'glowcap', count: 6, chance: 0.6,
    text: 'Mossveil Forest to the south is sick. Shroomlings there carry Glowcaps, which Lyla can brew into a cure. Gather 6 Glowcaps and bring them to her.',
    done: 'Six perfect Glowcaps! I will brew a cure right away. Take some of my finest stock as thanks.', rewards: { exp: 1300, gold: 400, items: [['hp_potion', 15], ['exp_scroll', 1]], diamonds: 30 }, next: 'q8' },
  { id: 'q8', name: 'Howls in Mossveil', giver: 'lyla', turnin: 'elena', type: 'kill', target: 'wolf', count: 8,
    text: 'Thornwolves attacked my supply cart in Mossveil! Captain Elena wants them driven back. Defeat 8 of them, then report to her.',
    done: 'Good hunting. The roads will be safer now. You have the makings of a true guardian.', rewards: { exp: 2100, gold: 500, equip: 'armor' }, next: 'q9' },
  { id: 'q9', name: 'Thorns of the Ruins', giver: 'elena', turnin: 'elena', type: 'kill', target: 'treant', count: 3,
    text: 'Our scouts saw Bramble Treants marching out of the Elder Ruins to the west. They are elite foes — bring potions, and defeat 3 of them.',
    done: 'Three Treants felled! But they were fleeing from something deeper in the ruins...', rewards: { exp: 3600, gold: 800, diamonds: 50, equip: 'ring' }, next: 'q10' },
  { id: 'q10', name: 'The Treant King', giver: 'elena', turnin: 'elder', type: 'kill', target: 'boss', count: 1,
    text: 'Treant King Yggr, an ancient spirit of the wood, has been corrupted. He waits in the northern arena of the Elder Ruins. Watch for the red circles on the ground — step out of them! Defeat him and report to Elder Rowan.',
    done: 'You freed Yggr from the corruption... The Spirits sing your name tonight, hero of Carlyle!', rewards: { exp: 8000, gold: 2000, diamonds: 150, pet: 'pet_dragon', equip: 'necklace' }, next: 'q11' },
  { id: 'q11', name: 'Beyond the World Tree', giver: 'elder', turnin: 'elder', type: 'end',
    text: 'Look north, past the mountains: the World Tree, Yggdrasil. Its roots bind the realms together, and something stirs in its branches. Chapter I of your tale ends here. Keep training, take bounties from Captain Elena, and collect every pet and mount you can!',
    done: '', rewards: {}, next: null },
];

export const BOUNTY_TARGETS = ['jelly', 'bunny', 'shroom', 'wolf', 'golem', 'treant'];

export const SIGNIN = [
  { day: 1, label: '1,000 Gold', gold: 1000 },
  { day: 2, label: 'Healing x10', items: [['hp_potion', 10]] },
  { day: 3, label: 'Pet: Mochi', pet: 'pet_cat' },
  { day: 4, label: '60 Diamonds', diamonds: 60 },
  { day: 5, label: 'Pet Egg x2', items: [['pet_egg', 2]] },
  { day: 6, label: '3,000 Gold', gold: 3000 },
  { day: 7, label: 'Mount: Panda', mount: 'mount_panda' },
];

export const ONLINE_GIFTS = [
  { secs: 60, label: '300 Gold', gold: 300 },
  { secs: 180, label: 'Mana x5', items: [['mp_potion', 5]] },
  { secs: 300, label: 'Pet: Pengu', pet: 'pet_penguin' },
  { secs: 600, label: '40 Diamonds', diamonds: 40 },
  { secs: 900, label: 'Pet Egg', items: [['pet_egg', 1]] },
];

export const MALL = [
  { kind: 'item', id: 'hp_potion', qty: 10, cost: { gold: 380 } },
  { kind: 'item', id: 'mp_potion', qty: 10, cost: { gold: 380 } },
  { kind: 'item', id: 'pet_egg', qty: 1, cost: { gold: 900 } },
  { kind: 'item', id: 'exp_scroll', qty: 1, cost: { gold: 600 } },
  { kind: 'pet', id: 'pet_cupcake', cost: { gold: 1800 } },
  { kind: 'pet', id: 'pet_puppet', cost: { gold: 4500 } },
  { kind: 'pet', id: 'pet_star', cost: { diamonds: 300 } },
  { kind: 'mount', id: 'mount_wolf', cost: { gold: 6000 } },
  { kind: 'mount', id: 'mount_pegasus', cost: { diamonds: 500 } },
];

export const BOT_NAMES = ['Lunaria', 'xXShadowXx', 'MochiMochi', 'Kirito77', 'SakuraBloom', 'Valkyr', 'Pudding', 'Aerith', 'NoobSlayer', 'Celestine', 'Tofu', 'RuneKnight', 'Mirabelle', 'Zephyrus', 'Bubbles', 'DarkAngel', 'Yuki', 'Ignis', 'Mercy', 'Felix'];
export const GUILDS = ['Moonlight', 'Starfall', 'Sakura', 'Valhalla', 'Dreamers', ''];
export const TITLES = ['Novice Adventurer', 'Jelly Hunter', 'Pet Lover', 'Rising Star', 'Guardian of Carlyle', 'Spirit Chosen'];

export const CHAT_LINES = [
  'LF2M Treant King, need healer!!',
  'WTS Mystery Pet Egg 800g pm me',
  'anyone know where the Pet Keeper is?',
  'my Scoopy is sooo cute omg',
  '<Moonlight> recruiting Lv10+, friendly guild~',
  'how do you get the Pegasus?',
  'gz on the level up!',
  'is the boss up? ruins are empty',
  'Fluffbuns stole my potions lol',
  'just got Sparky from Yggr!!! finally',
  'tip: click the quest tracker to auto-path',
  'who wants to farm golems together?',
  'Frost Wolf mount is worth every gold',
  'Daily sign-in day 7 gives a Panda mount!',
  'brb dinner',
  'Mage or Priest for a new player?',
  'Knight guardian talent is so tanky',
  'sell Elven ring, 2k gold',
  'online gift gives Pengu after 5 min btw',
  'love the music in Sylvan Haven',
];

export const TIPS = [
  'Click a quest in the tracker to auto-path to your objective.',
  'Press R to summon or dismiss your mount.',
  'Turn on Auto Battle to fight nearby monsters automatically.',
  'Pets fight by your side and add to your Battle Rating.',
  'Enhance gear at Gorm the Blacksmith to raise your Battle Rating.',
  'Step out of red circles on the ground to avoid boss attacks!',
  'Claim your Daily Sign-In reward every day.',
];
