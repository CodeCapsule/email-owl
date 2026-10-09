'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const W = 96, H = 96;
const TOWN = { x: 48, y: 48 };
const T = { GRASS: 0, WATER: 1, TREE: 2, PATH: 3, SAND: 4, WALL: 5, FLOWER: 6 };
const SOLID = new Set([T.WATER, T.TREE, T.WALL]);

// ---------- world generation (seeded) ----------
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
function valueNoise(seed) {
  const r = rng(seed), g = [];
  for (let i = 0; i < 17 * 17; i++) g.push(r());
  const at = (x, y) => g[(y % 17) * 17 + (x % 17)];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
  };
}
function genMap() {
  const n1 = valueNoise(7), n2 = valueNoise(99), r = rng(42);
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - W / 2, y - H / 2) / (W / 2);
    const h = n1(x / 6, y / 6) * 0.75 + n1(x / 3, y / 3) * 0.25 - d * d * 0.5;
    let t = T.GRASS;
    if (h < 0.18) t = T.WATER; else if (h < 0.24) t = T.SAND;
    else if (n2(x / 4, y / 4) > 0.62 && r() < 0.8) t = T.TREE;
    else if (r() < 0.06) t = T.FLOWER;
    m[y * W + x] = t;
  }
  // town clearing with paths and houses
  for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
    if (Math.hypot(x, y) <= 9) m[(TOWN.y + y) * W + TOWN.x + x] = T.GRASS;
  }
  for (let i = -W; i < W; i++) {
    for (const [x, y] of [[TOWN.x + i, TOWN.y], [TOWN.x, TOWN.y + i]]) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const k = y * W + x;
      if (m[k] === T.TREE || m[k] === T.FLOWER || m[k] === T.GRASS) m[k] = T.PATH;
    }
  }
  for (const [hx, hy] of [[-6, -5], [3, -5], [-6, 3], [3, 3]]) {
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) m[(TOWN.y + hy + y) * W + TOWN.x + hx + x] = T.WALL;
  }
  return m;
}
const map = genMap();
const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !SOLID.has(map[y * W + x]);

// ---------- game state ----------
const MON = {
  slime:    { hp: 12, dmg: [1, 3],  xp: 6,  gold: [1, 4],   speed: 600, color: '#5fd35f', zone: 0 },
  wolf:     { hp: 30, dmg: [2, 6],  xp: 16, gold: [3, 10],  speed: 380, color: '#9a9aa8', zone: 1 },
  skeleton: { hp: 60, dmg: [5, 10], xp: 38, gold: [8, 24],  speed: 450, color: '#e8e4d0', zone: 2 },
};
const players = new Map();
const monsters = [];
let nextId = 1;
const now = () => Date.now();
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const occupied = (x, y, self) =>
  monsters.some(m => m !== self && !m.dead && m.x === x && m.y === y) ||
  [...players.values()].some(p => p !== self && p.x === x && p.y === y);

function spawnMonster(m) {
  for (let tries = 0; tries < 200; tries++) {
    const x = ri(1, W - 2), y = ri(1, H - 2);
    const d = Math.hypot(x - TOWN.x, y - TOWN.y);
    const zone = d < 14 ? -1 : d < 26 ? 0 : d < 36 ? 1 : 2;
    if (zone < 0 || zone !== m.zone || !walkable(x, y) || occupied(x, y)) continue;
    Object.assign(m, { x, y, hx: x, hy: y, hp: m.max, dead: false, target: null, lastMove: 0, lastAtk: 0 });
    return true;
  }
  return false;
}
// zone: 0 near (slimes), 1 mid (wolves, some slimes), 2 far (skeletons, wolves)
function populate() {
  const plan = [['slime', 0, 40], ['slime', 1, 8], ['wolf', 1, 34], ['wolf', 2, 8], ['skeleton', 2, 30]];
  for (const [type, zone, n] of plan) for (let i = 0; i < n; i++) {
    const m = { id: nextId++, type, zone, max: MON[type].hp, dead: false, respawnAt: 0 };
    if (spawnMonster(m)) monsters.push(m);
  }
}
populate();

// ---------- persistence ----------
const DATA = path.join(__dirname, 'data'), FILE = path.join(DATA, 'players.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* fresh */ }
function save() {
  for (const p of players.values()) db[p.key] = pick(p);
  try { fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('save failed', e.message); }
}
const pick = p => ({ name: p.name, x: p.x, y: p.y, lvl: p.lvl, xp: p.xp, gold: p.gold, potions: p.potions, color: p.color });
setInterval(save, 30000);

const xpFor = lvl => Math.floor(20 * Math.pow(lvl, 1.6));
const maxHp = lvl => 30 + lvl * 10;

function addPlayer(ws, rawName) {
  const name = String(rawName || '').replace(/[^\w \-]/g, '').trim().slice(0, 14);
  if (name.length < 2) return null;
  const key = name.toLowerCase();
  if ([...players.values()].some(p => p.key === key)) return 'taken';
  const s = db[key] || { lvl: 1, xp: 0, gold: 0, potions: 2, color: `hsl(${ri(0, 359)},60%,55%)` };
  const p = {
    id: nextId++, ws, key, name, lvl: s.lvl, xp: s.xp, gold: s.gold, potions: s.potions, color: s.color,
    x: TOWN.x + ri(-1, 1), y: TOWN.y + ri(-1, 1), dir: 2, lastMove: 0, lastAtk: 0, lastHurt: 0, lastRegen: now(),
  };
  if (s.x !== undefined && walkable(s.x, s.y) && !occupied(s.x, s.y)) { p.x = s.x; p.y = s.y; }
  p.hp = maxHp(p.lvl);
  return p;
}

let events = [];
const ev = e => events.push(e);
function chatAll(from, text, kind) { ev({ e: 'chat', from, text, kind: kind || 'chat' }); }

function gainXp(p, amount) {
  p.xp += amount;
  ev({ e: 'float', x: p.x, y: p.y, text: `+${amount} xp`, c: '#8cf' });
  while (p.xp >= xpFor(p.lvl)) {
    p.xp -= xpFor(p.lvl); p.lvl++; p.hp = maxHp(p.lvl);
    chatAll('', `${p.name} reached level ${p.lvl}!`, 'sys');
    ev({ e: 'float', x: p.x, y: p.y - 1, text: 'LEVEL UP!', c: '#ff0' });
  }
}
function killMonster(m, p) {
  const def = MON[m.type];
  m.dead = true; m.respawnAt = now() + 10000 + Math.random() * 5000;
  const g = ri(...def.gold); p.gold += g;
  ev({ e: 'float', x: m.x, y: m.y, text: `+${g}g`, c: '#fc4' });
  if (Math.random() < 0.2) { p.potions++; ev({ e: 'float', x: m.x, y: m.y - 1, text: '+potion', c: '#f6a' }); }
  gainXp(p, def.xp);
}
function hurtPlayer(p, dmg, m) {
  p.hp -= dmg; p.lastHurt = now();
  ev({ e: 'float', x: p.x, y: p.y, text: `-${dmg}`, c: '#f55' });
  if (p.hp <= 0) {
    const lost = Math.floor(p.gold * 0.1); p.gold -= lost;
    chatAll('', `${p.name} was slain by a ${m.type}.`, 'sys');
    p.x = TOWN.x; p.y = TOWN.y + 2; p.hp = maxHp(p.lvl);
    for (const mm of monsters) if (mm.target === p.id) mm.target = null;
  }
}

// ---------- network ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
  const full = path.join(__dirname, 'public', path.normalize(f).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});
const wss = new WebSocketServer({ server, maxPayload: 2048 });
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

wss.on('connection', ws => {
  let p = null;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!p) {
      if (m.t !== 'login') return;
      const r = addPlayer(ws, m.name);
      if (r === 'taken') return send(ws, { t: 'error', msg: 'That name is already online.' });
      if (!r) return send(ws, { t: 'error', msg: 'Name must be 2-14 letters/numbers.' });
      p = r; players.set(p.id, p);
      send(ws, { t: 'init', id: p.id, w: W, h: H, map: Buffer.from(map).toString('base64'), mon: MON });
      chatAll('', `${p.name} entered the world.`, 'sys');
      return;
    }
    const t = now();
    if (m.t === 'move') {
      if (t - p.lastMove < 150) return;
      const dx = Math.sign(m.dx | 0), dy = Math.sign(m.dy | 0);
      if (!dx && !dy) return;
      p.dir = dx ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      const nx = p.x + dx, ny = p.y + dy;
      if (walkable(nx, ny) && !occupied(nx, ny, p) && (!dx || !dy || (walkable(p.x + dx, p.y) && walkable(p.x, p.y + dy)))) {
        p.x = nx; p.y = ny; p.lastMove = t;
      }
    } else if (m.t === 'attack') {
      const mon = monsters.find(q => q.id === m.id && !q.dead);
      if (!mon || dist(p, mon) > 1 || t - p.lastAtk < 700) return;
      p.lastAtk = t;
      const dmg = ri(2, 4) + p.lvl * 2;
      mon.hp -= dmg; mon.target = p.id;
      ev({ e: 'float', x: mon.x, y: mon.y, text: `${dmg}`, c: '#fff' });
      ev({ e: 'swing', id: p.id, x: mon.x, y: mon.y });
      if (mon.hp <= 0) killMonster(mon, p);
    } else if (m.t === 'potion') {
      if (p.potions > 0 && p.hp < maxHp(p.lvl)) {
        p.potions--; const h = Math.min(40, maxHp(p.lvl) - p.hp); p.hp += h;
        ev({ e: 'float', x: p.x, y: p.y, text: `+${h}`, c: '#6f6' });
      }
    } else if (m.t === 'chat') {
      const text = String(m.text || '').slice(0, 120).trim();
      if (text && t - (p.lastChat || 0) > 500) { p.lastChat = t; chatAll(p.name, text); ev({ e: 'say', id: p.id, text }); }
    }
  });
  ws.on('close', () => {
    if (!p) return;
    players.delete(p.id); db[p.key] = pick(p); save();
    for (const mm of monsters) if (mm.target === p.id) mm.target = null;
    chatAll('', `${p.name} left the world.`, 'sys');
  });
});

// ---------- game loop (10 Hz) ----------
function stepToward(m, tx, ty) {
  const dx = Math.sign(tx - m.x), dy = Math.sign(ty - m.y);
  const opts = Math.abs(tx - m.x) > Math.abs(ty - m.y) ? [[dx, 0], [0, dy], [dx, dy]] : [[0, dy], [dx, 0], [dx, dy]];
  for (const [ox, oy] of opts) {
    if (!ox && !oy) continue;
    const nx = m.x + ox, ny = m.y + oy;
    if (walkable(nx, ny) && !occupied(nx, ny, m) && Math.hypot(nx - TOWN.x, ny - TOWN.y) > 11) { m.x = nx; m.y = ny; return true; }
  }
  return false;
}
setInterval(() => {
  const t = now();
  for (const m of monsters) {
    if (m.dead) { if (t >= m.respawnAt) spawnMonster(m); continue; }
    const def = MON[m.type];
    let tgt = m.target ? players.get(m.target) : null;
    if (!tgt) {
      m.target = null;
      for (const p of players.values()) if (dist(p, m) <= 5 && Math.hypot(p.x - TOWN.x, p.y - TOWN.y) > 11 && (!tgt || dist(p, m) < dist(tgt, m))) tgt = p;
      if (tgt && m.type !== 'slime') m.target = tgt.id;
      else if (tgt && dist(tgt, m) <= 3) m.target = tgt.id; else tgt = null;
    }
    if (tgt && (dist(tgt, m) > 12 || dist(m, { x: m.hx, y: m.hy }) > 16)) { m.target = null; tgt = null; }
    if (tgt) {
      if (dist(tgt, m) <= 1) {
        if (t - m.lastAtk > 1200) { m.lastAtk = t; hurtPlayer(tgt, ri(...def.dmg), m); }
      } else if (t - m.lastMove > def.speed) { m.lastMove = t; stepToward(m, tgt.x, tgt.y); }
    } else if (t - m.lastMove > def.speed * 4 && Math.random() < 0.5) {
      m.lastMove = t;
      if (dist(m, { x: m.hx, y: m.hy }) > 6) stepToward(m, m.hx, m.hy);
      else stepToward(m, m.x + ri(-1, 1), m.y + ri(-1, 1));
    }
  }
  for (const p of players.values()) {
    if (t - p.lastHurt > 5000 && t - p.lastRegen > 3000 && p.hp < maxHp(p.lvl)) { p.hp++; p.lastRegen = t; }
    const inTown = Math.hypot(p.x - TOWN.x, p.y - TOWN.y) <= 9;
    if (inTown && t - p.lastRegen > 1000 && p.hp < maxHp(p.lvl)) { p.hp = Math.min(maxHp(p.lvl), p.hp + 3); p.lastRegen = t; }
  }
  const state = {
    t: 'state',
    p: [...players.values()].map(p => [p.id, p.name, p.x, p.y, p.dir, p.hp, maxHp(p.lvl), p.lvl, p.color]),
    m: monsters.filter(m => !m.dead).map(m => [m.id, m.type, m.x, m.y, m.hp, m.max]),
    ev: events,
  };
  events = [];
  for (const p of players.values()) {
    send(p.ws, { ...state, you: { xp: p.xp, next: xpFor(p.lvl), gold: p.gold, potions: p.potions } });
  }
}, 100);

server.listen(PORT, () => console.log(`Emberwood Online running at http://localhost:${PORT}`));
process.on('SIGINT', () => { save(); process.exit(0); });
