'use strict';
const TS = 32;
const T = { GRASS: 0, WATER: 1, TREE: 2, PATH: 3, SAND: 4, WALL: 5, FLOWER: 6 };
const SOLID = new Set([1, 2, 5]);
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let ws, W, H, map, MON, myId, you = { xp: 0, next: 1, gold: 0, potions: 0 };
let players = new Map(), mons = new Map(), floats = [], bubbles = new Map(), swings = [];
let path = [], targetId = null, keys = {}, lastSend = 0, lastAtk = 0, camera = { x: 0, y: 0 }, chatting = false;

function resize() { cv.width = innerWidth; cv.height = innerHeight; ctx.imageSmoothingEnabled = false; }
addEventListener('resize', resize); resize();

// ---------- connection ----------
function connect() {
  const name = $('name').value.trim();
  $('err').textContent = '';
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'login', name }));
  ws.onclose = () => { if (myId) { $('login').style.display = 'flex'; $('err').textContent = 'Disconnected.'; myId = null; } };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'error') { $('err').textContent = m.msg; ws.close(); }
    else if (m.t === 'init') {
      myId = m.id; W = m.w; H = m.h; MON = m.mon;
      map = Uint8Array.from(atob(m.map), c => c.charCodeAt(0));
      $('login').style.display = 'none'; $('chat').style.display = 'block'; $('help').style.display = 'block';
      requestAnimationFrame(frame);
    } else if (m.t === 'state') onState(m);
  };
}
$('go').onclick = connect;
$('name').onkeydown = e => { if (e.key === 'Enter') connect(); };
const sendMsg = o => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

function onState(m) {
  const seen = new Set();
  for (const [id, name, x, y, dir, hp, mhp, lvl, color] of m.p) {
    seen.add(id);
    let p = players.get(id);
    if (!p) { p = { rx: x, ry: y }; players.set(id, p); }
    Object.assign(p, { id, name, x, y, dir, hp, mhp, lvl, color });
  }
  for (const id of players.keys()) if (!seen.has(id)) players.delete(id);
  const seenM = new Set();
  for (const [id, type, x, y, hp, max] of m.m) {
    seenM.add(id);
    let o = mons.get(id);
    if (!o) { o = { rx: x, ry: y }; mons.set(id, o); }
    Object.assign(o, { id, type, x, y, hp, max });
  }
  for (const id of mons.keys()) if (!seenM.has(id)) { mons.delete(id); if (targetId === id) targetId = null; }
  you = m.you;
  for (const e of m.ev) {
    if (e.e === 'float') floats.push({ x: e.x, y: e.y, text: e.text, c: e.c, t: performance.now() });
    else if (e.e === 'chat') addLog(e.from, e.text, e.kind);
    else if (e.e === 'say') bubbles.set(e.id, { text: e.text, t: performance.now() });
    else if (e.e === 'swing') swings.push({ id: e.id, x: e.x, y: e.y, t: performance.now() });
  }
}
function addLog(from, text, kind) {
  const d = document.createElement('div');
  if (kind === 'sys') { d.className = 'sys'; d.textContent = text; } else d.textContent = `${from}: ${text}`;
  $('log').appendChild(d);
  while ($('log').children.length > 30) $('log').firstChild.remove();
}

// ---------- input ----------
const me = () => players.get(myId);
addEventListener('keydown', e => {
  if (!myId) return;
  if (e.key === 'Enter') {
    if (chatting) { const t = $('msg').value.trim(); if (t) sendMsg({ t: 'chat', text: t }); $('msg').value = ''; $('msg').blur(); chatting = false; }
    else { chatting = true; $('msg').focus(); }
    e.preventDefault(); return;
  }
  if (chatting) return;
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'q') sendMsg({ t: 'potion' });
  if (e.key === ' ') { e.preventDefault(); const n = nearest(); if (n) targetId = n.id; }
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { delete keys[e.key.toLowerCase()]; });
cv.addEventListener('mousedown', e => {
  if (!myId) return;
  const wx = (e.clientX - cv.width / 2) / TS + camera.x, wy = (e.clientY - cv.height / 2) / TS + camera.y;
  const tx = Math.floor(wx), ty = Math.floor(wy);
  const mon = [...mons.values()].find(m => m.x === tx && m.y === ty);
  if (mon) { targetId = mon.id; path = []; return; }
  targetId = null;
  path = findPath(me(), { x: tx, y: ty });
});
function nearest() {
  const p = me(); let best = null, bd = 1e9;
  for (const m of mons.values()) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd && d < 8) { bd = d; best = m; } }
  return best;
}

// ---------- pathfinding (BFS, 8-dir without corner cutting) ----------
const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !SOLID.has(map[y * W + x]);
function findPath(a, b, adjacent) {
  if (!a || (!adjacent && !walk(b.x, b.y))) return [];
  const key = (x, y) => y * W + x, prev = new Map([[key(a.x, a.y), null]]), q = [[a.x, a.y]];
  const blocked = new Set([...mons.values()].map(m => key(m.x, m.y)));
  for (const p of players.values()) if (p.id !== myId) blocked.add(key(p.x, p.y));
  let found = null;
  for (let i = 0; i < q.length && i < 4000; i++) {
    const [x, y] = q[i];
    if (adjacent ? Math.max(Math.abs(x - b.x), Math.abs(y - b.y)) <= 1 : (x === b.x && y === b.y)) { found = [x, y]; break; }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walk(nx, ny) || blocked.has(k)) continue;
      if (dx && dy && (!walk(x + dx, y) || !walk(x, y + dy))) continue;
      prev.set(k, [x, y]); q.push([nx, ny]);
    }
  }
  const out = [];
  while (found && prev.get(key(found[0], found[1]))) { out.unshift({ x: found[0], y: found[1] }); found = prev.get(key(found[0], found[1])); }
  return out;
}

function update(now) {
  const p = me(); if (!p) return;
  if (now - lastSend < 140) return;
  let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  if (dx || dy) { path = []; targetId = null; }
  else if (targetId && mons.has(targetId)) {
    const m = mons.get(targetId);
    if (Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 1) {
      if (now - lastAtk > 700) { sendMsg({ t: 'attack', id: m.id }); lastAtk = now; }
    } else {
      const pp = findPath(p, m, true);
      if (pp.length) { dx = pp[0].x - p.x; dy = pp[0].y - p.y; }
    }
  } else if (path.length) {
    while (path.length && path[0].x === p.x && path[0].y === p.y) path.shift();
    if (path.length) { dx = path[0].x - p.x; dy = path[0].y - p.y; if (Math.abs(dx) > 1 || Math.abs(dy) > 1) path = []; }
  }
  if (dx || dy) { sendMsg({ t: 'move', dx, dy }); lastSend = now; }
}

// ---------- rendering (cozy storybook style) ----------
const INK = '#3d2b2b', FONT = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';
const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.WATER : map[y * W + x];
const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
function shape(fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw || 1.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
function circle(cx, cy, r, fill, lw) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); shape(fill, lw); }
function shadow(sx, sy, w) { ctx.fillStyle = '#2a3a1c40'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 28, w, 4.5, 0, 0, 7); ctx.fill(); }

function drawGround(t, x, y, sx, sy, tm) {
  const h = hash(x, y), h2 = hash(y + 7, x + 3);
  const rect = (c, a, b, w, hh) => { ctx.fillStyle = c; ctx.fillRect(sx + a, sy + b, w, hh); };
  const grass = () => {
    rect(((x + y) & 1) ? '#8ec468' : '#94c86d', 0, 0, TS, TS);
    if (h < 0.55) { rect('#a9d97f', 4 + h * 40, 6 + h2 * 14, 2, 2); }
    if (h2 < 0.5) { // tuft
      const tx = 6 + h * 18, ty = 14 + h2 * 12; ctx.strokeStyle = '#6aa653'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(sx + tx, sy + ty); ctx.lineTo(sx + tx - 2, sy + ty - 5); ctx.moveTo(sx + tx, sy + ty); ctx.lineTo(sx + tx + 1, sy + ty - 6); ctx.moveTo(sx + tx, sy + ty); ctx.lineTo(sx + tx + 3, sy + ty - 4); ctx.stroke();
    }
  };
  switch (t) {
    case T.WATER: {
      rect(((x + y) & 1) ? '#6bb6d6' : '#64afd0', 0, 0, TS, TS);
      const w = Math.sin(tm * 1.3 + x * 1.7 + y) * 3;
      ctx.strokeStyle = '#bfe6f3'; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(sx + 5 + w, sy + 10 + h * 8); ctx.quadraticCurveTo(sx + 10 + w, sy + 7 + h * 8, sx + 15 + w, sy + 10 + h * 8); ctx.stroke();
      ctx.fillStyle = '#e8f6fb'; // foam on shore sides
      if (tileAt(x, y - 1) !== T.WATER) ctx.fillRect(sx, sy, TS, 3);
      if (tileAt(x, y + 1) !== T.WATER) ctx.fillRect(sx, sy + TS - 3, TS, 3);
      if (tileAt(x - 1, y) !== T.WATER) ctx.fillRect(sx, sy, 3, TS);
      if (tileAt(x + 1, y) !== T.WATER) ctx.fillRect(sx + TS - 3, sy, 3, TS);
      break;
    }
    case T.SAND: rect('#f2e1a9', 0, 0, TS, TS); rect('#e2cd8c', h * 24, h2 * 24, 3, 2); rect('#fff3c8', 8 + h2 * 14, 6 + h * 14, 2, 2); break;
    case T.PATH: {
      rect('#e6cc98', 0, 0, TS, TS); rect('#d6b87e', h * 22, h2 * 22, 5, 3); rect('#f1dcae', 4 + h2 * 18, 4 + h * 18, 4, 2);
      ctx.fillStyle = '#c9a56b';
      const g = (nx, ny) => { const n = tileAt(nx, ny); return n !== T.PATH && n !== T.WALL; };
      if (g(x, y - 1)) ctx.fillRect(sx, sy, TS, 3); if (g(x, y + 1)) ctx.fillRect(sx, sy + TS - 3, TS, 3);
      if (g(x - 1, y)) ctx.fillRect(sx, sy, 3, TS); if (g(x + 1, y)) ctx.fillRect(sx + TS - 3, sy, 3, TS);
      break;
    }
    case T.WALL: house(x, y, sx, sy); break;
    default:
      grass();
      if (t === T.FLOWER) {
        for (let i = 0; i < 3; i++) {
          const fx = 6 + hash(x + i, y) * 20, fy = 8 + hash(y, x + i) * 18, c = ['#fff3a8', '#ffb3c8', '#ffffff', '#c9b3ff'][(h * 4 + i) | 0 % 4];
          ctx.fillStyle = '#fff'; ctx.fillRect(sx + fx - 2, sy + fy, 5, 1); ctx.fillRect(sx + fx, sy + fy - 2, 1, 5);
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx + fx, sy + fy, 2.4, 0, 7); ctx.fill();
          ctx.fillStyle = '#f2a52a'; ctx.fillRect(sx + fx - 0.5, sy + fy - 0.5, 1.5, 1.5);
        }
      }
  }
}
function house(x, y, sx, sy) {
  let row = 0, col = 0;
  while (tileAt(x, y - row - 1) === T.WALL) row++;
  while (tileAt(x - col - 1, y) === T.WALL) col++;
  let wLeft = col, wRight = 0; while (tileAt(x + wRight + 1, y) === T.WALL) wRight++;
  const first = col === 0, last = wRight === 0;
  if (row < 2) { // roof
    ctx.fillStyle = row ? '#c55a40' : '#d4694b'; ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = '#a9452f'; for (let i = 0; i < 2; i++) { ctx.fillRect(sx, sy + 7 + i * 14 + (row ? 0 : 0), TS, 2); }
    ctx.fillStyle = '#e48a6a'; ctx.fillRect(sx + 2, sy + 3, TS - 4, 2); ctx.fillRect(sx + 2, sy + 17, TS - 4, 2);
    ctx.fillStyle = INK; if (row === 0) ctx.fillRect(sx, sy, TS, 2); if (first) ctx.fillRect(sx, sy, 2, TS); if (last) ctx.fillRect(sx + TS - 2, sy, 2, TS);
    if (row === 0 && col === 1) { ctx.fillStyle = '#7a5a48'; ctx.fillRect(sx + 18, sy - 0, 8, 6); }
  } else { // wall, door and windows
    ctx.fillStyle = '#f5e6c4'; ctx.fillRect(sx, sy, TS, TS);
    ctx.fillStyle = '#d9c298'; ctx.fillRect(sx, sy + TS - 5, TS, 5);
    ctx.fillStyle = '#7a5538'; ctx.fillRect(sx, sy, TS, 3);
    ctx.fillStyle = INK; ctx.fillRect(sx, sy + TS - 1, TS, 1); if (first) ctx.fillRect(sx, sy, 2, TS); if (last) ctx.fillRect(sx + TS - 2, sy, 2, TS);
    if (col === 1) { rr(sx + 5, sy + 7, 22, 25, [11, 11, 0, 0]); ctx.fillStyle = '#8a5a35'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(sx + 22, sy + 20, 1.8, 0, 7); ctx.fill(); }
    else if (col === 0 || col === 2 || col === 3) {
      rr(sx + 7, sy + 9, 18, 13, 3); ctx.fillStyle = '#9fd6ea'; ctx.fill(); ctx.strokeStyle = '#7a5538'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#7a5538'; ctx.fillRect(sx + 15, sy + 9, 2, 13); ctx.fillStyle = '#ffffff90'; ctx.fillRect(sx + 9, sy + 11, 4, 2);
      ctx.fillStyle = '#7a5538'; ctx.fillRect(sx + 5, sy + 23, 22, 4); ctx.fillStyle = '#ff8fab'; ctx.fillRect(sx + 7, sy + 21, 4, 3); ctx.fillStyle = '#ffe27a'; ctx.fillRect(sx + 14, sy + 21, 4, 3); ctx.fillStyle = '#ff8fab'; ctx.fillRect(sx + 21, sy + 21, 4, 3);
    }
  }
}
function drawTree(x, y, sx, sy, tm) {
  const h = hash(x, y), sway = Math.sin(tm * 1.1 + x) * 0.8, blossom = h > 0.82;
  shadow(sx, sy, 12);
  rr(sx + 12, sy + 16, 8, 13, 2); shape('#8a5a35', 1.5);
  const light = blossom ? '#ffc4d6' : '#7fc56a', mid = blossom ? '#f7a8c2' : '#5aa957', dark = blossom ? '#e58aa9' : '#3f8a4d';
  circle(sx + 9 + sway, sy + 14, 8, dark); circle(sx + 23 + sway, sy + 14, 8, dark);
  circle(sx + 16 + sway, sy + 9, 11, mid, 1.5);
  ctx.fillStyle = light; ctx.beginPath(); ctx.arc(sx + 12 + sway, sy + 6, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff55'; ctx.fillRect(sx + 19 + sway, sy + 9, 3, 2);
}

function label(text, x, y, color, size) {
  ctx.font = `bold ${size || 12}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#2b1d1dcc'; ctx.strokeText(text, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(text, x, y);
}
function drawBar(cx, y, w, f, c) {
  rr(cx - w / 2 - 1.5, y - 1.5, w + 3, 7, 3.5); ctx.fillStyle = '#2b1d1d'; ctx.fill();
  if (f > 0) { rr(cx - w / 2, y, Math.max(3, w * Math.min(1, f)), 4, 2); ctx.fillStyle = c; ctx.fill(); ctx.fillStyle = '#ffffff55'; ctx.fillRect(cx - w / 2 + 1, y + 0.5, Math.max(1, w * Math.min(1, f) - 2), 1); }
}
function drawPlayer(p, sx, sy, isMe, tm) {
  const moving = Math.abs(p.rx - p.x) + Math.abs(p.ry - p.y) > 0.05;
  const bob = moving ? Math.abs(Math.sin(tm * 14)) * -2 : Math.sin(tm * 3 + p.id) * 0.5;
  shadow(sx, sy, 9);
  if (isMe) { ctx.strokeStyle = '#fff7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 28, 13, 6, 0, 0, 7); ctx.stroke(); }
  const y = sy + bob, side = p.dir === 1 ? 1 : p.dir === 3 ? -1 : 0, back = p.dir === 0;
  // feet
  const step = moving ? Math.sin(tm * 14) * 2 : 0;
  rr(sx + 9 + step, y + 24, 6, 4, 2); shape('#5a3e2b', 1.2); rr(sx + 17 - step, y + 24, 6, 4, 2); shape('#5a3e2b', 1.2);
  // sword on far side
  if (side !== -1) { ctx.save(); ctx.translate(sx + 25, y + 18); ctx.rotate(0.5); rr(-1.5, -9, 3, 11, 1); shape('#dfe6ee', 1.2); ctx.fillStyle = '#c9892e'; ctx.fillRect(-3, 1, 6, 2); ctx.restore(); }
  // tunic
  rr(sx + 8, y + 14, 16, 12, 5); shape(p.color, 1.5);
  ctx.fillStyle = '#00000022'; ctx.fillRect(sx + 9, y + 22, 14, 3);
  ctx.fillStyle = '#8a5a35'; ctx.fillRect(sx + 9, y + 20, 14, 2);
  // head
  circle(sx + 16, y + 10, 8, '#ffd9b3', 1.5);
  ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.arc(sx + 16, y + 8, 8.5, Math.PI, 0); ctx.lineTo(sx + 24, back ? y + 12 : y + 8); ctx.lineTo(sx + 8, back ? y + 12 : y + 8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
  if (!back) {
    ctx.fillStyle = INK; ctx.fillRect(sx + 12.5 + side * 2.5, y + 10, 2, 3); ctx.fillRect(sx + 17.5 + side * 2.5, y + 10, 2, 3);
    ctx.fillStyle = '#ff9aa855'; ctx.fillRect(sx + 10 + side * 2, y + 13, 3, 2); ctx.fillRect(sx + 19 + side * 2, y + 13, 3, 2);
  }
  if (side === -1) { ctx.save(); ctx.translate(sx + 7, y + 18); ctx.rotate(-0.5); rr(-1.5, -9, 3, 11, 1); shape('#dfe6ee', 1.2); ctx.restore(); }
  label(`${p.name}  Lv${p.lvl}`, sx + 16, sy - 9, isMe ? '#d6ffb8' : '#fff', 12);
  drawBar(sx + 16, sy - 5, 28, p.hp / p.mhp, '#ef5b5b');
}
function drawMonster(m, sx, sy, tm) {
  const t = tm * 4 + m.id;
  shadow(sx, sy, 11);
  if (m.type === 'slime') {
    const s = Math.sin(t) * 0.07, w = 13 * (1 + s), hh = 14 * (1 - s);
    ctx.beginPath(); ctx.moveTo(sx + 16 - w, sy + 27); ctx.bezierCurveTo(sx + 16 - w - 1, sy + 27 - hh, sx + 16 - w * 0.5, sy + 27 - hh - 3, sx + 16, sy + 27 - hh - 3);
    ctx.bezierCurveTo(sx + 16 + w * 0.5, sy + 27 - hh - 3, sx + 16 + w + 1, sy + 27 - hh, sx + 16 + w, sy + 27); ctx.closePath(); shape('#7fdc8a', 1.6);
    ctx.fillStyle = '#5cc470'; ctx.fillRect(sx + 16 - w + 1, sy + 24, w * 2 - 2, 2.5);
    ctx.fillStyle = '#ffffffaa'; ctx.beginPath(); ctx.ellipse(sx + 10, sy + 16, 2.5, 1.6, -0.6, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.fillRect(sx + 11, sy + 19, 2.5, 4); ctx.fillRect(sx + 18.5, sy + 19, 2.5, 4);
    ctx.fillStyle = '#ff8fa8aa'; ctx.fillRect(sx + 8, sy + 23, 3, 2); ctx.fillRect(sx + 21, sy + 23, 3, 2);
  } else if (m.type === 'wolf') {
    const wag = Math.sin(t * 1.5) * 2;
    ctx.beginPath(); ctx.moveTo(sx + 4, sy + 16); ctx.quadraticCurveTo(sx - 2, sy + 10 + wag, sx + 1, sy + 7 + wag); ctx.lineTo(sx + 7, sy + 15); ctx.closePath(); shape('#8b8fa3', 1.4);
    rr(sx + 5, sy + 24, 4, 5, 1.5); shape('#7a7e92', 1.2); rr(sx + 20, sy + 24, 4, 5, 1.5); shape('#7a7e92', 1.2);
    rr(sx + 4, sy + 13, 22, 13, 6); shape('#a3a8bd', 1.6); rr(sx + 8, sy + 21, 14, 4, 2); ctx.fillStyle = '#e8eaf2'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + 20, sy + 5); ctx.lineTo(sx + 22, sy - 1); ctx.lineTo(sx + 25, sy + 5); ctx.closePath(); shape('#8b8fa3', 1.2);
    circle(sx + 24, sy + 11, 6.5, '#a3a8bd', 1.6); rr(sx + 26, sy + 11, 7, 5, 2); shape('#dfe2ec', 1.3);
    ctx.fillStyle = INK; ctx.fillRect(sx + 31, sy + 11, 2, 2); ctx.fillRect(sx + 23, sy + 8.5, 2.5, 2.5);
  } else {
    const rock = Math.sin(t) * 1;
    rr(sx + 11, sy + 15, 10, 11, 3); shape('#efe8d2', 1.5); ctx.fillStyle = INK; ctx.fillRect(sx + 12, sy + 18, 8, 1.2); ctx.fillRect(sx + 12, sy + 21, 8, 1.2);
    rr(sx + 11, sy + 25, 4, 4, 1.5); shape('#efe8d2', 1.2); rr(sx + 17, sy + 25, 4, 4, 1.5); shape('#efe8d2', 1.2);
    rr(sx + 5, sy + 15 + rock, 5, 3, 1.5); shape('#efe8d2', 1.2); rr(sx + 22, sy + 15 - rock, 5, 3, 1.5); shape('#efe8d2', 1.2);
    circle(sx + 16, sy + 9, 8, '#f6f0dc', 1.6); ctx.fillStyle = INK; ctx.fillRect(sx + 11, sy + 8, 4, 4); ctx.fillRect(sx + 17, sy + 8, 4, 4);
    ctx.fillStyle = '#ff5a5a'; ctx.fillRect(sx + 12, sy + 9, 2, 2); ctx.fillRect(sx + 18, sy + 9, 2, 2); ctx.fillStyle = INK; ctx.fillRect(sx + 13, sy + 14, 6, 1.5);
  }
  const sel = m.id === targetId;
  if (sel) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -tm * 20; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 27, 15, 7, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (sel || m.hp < m.max) { label(m.type, sx + 16, sy - 9, '#ffd6d0', 11); drawBar(sx + 16, sy - 5, 28, m.hp / m.max, '#ef5b5b'); }
}

const petals = Array.from({ length: 22 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.6, r: Math.random() * 6 }));
function frame(now) {
  requestAnimationFrame(frame);
  update(now);
  const tm = now / 1000, p = me();
  if (p) {
    for (const o of [...players.values(), ...mons.values()]) { o.rx += (o.x - o.rx) * 0.3; o.ry += (o.y - o.ry) * 0.3; }
    camera.x += (p.rx + 0.5 - camera.x) * 0.2; camera.y += (p.ry + 0.5 - camera.y) * 0.2;
  }
  ctx.fillStyle = '#5aa5c8'; ctx.fillRect(0, 0, cv.width, cv.height);
  const ox = cv.width / 2 - camera.x * TS, oy = cv.height / 2 - camera.y * TS;
  const x0 = Math.max(0, Math.floor(-ox / TS)), y0 = Math.max(0, Math.floor(-oy / TS));
  const x1 = Math.min(W - 1, Math.ceil((cv.width - ox) / TS)), y1 = Math.min(H - 1, Math.ceil((cv.height - oy) / TS));
  const px = x => Math.round(ox + x * TS), py = y => Math.round(oy + y * TS);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = map[y * W + x]; drawGround(t === T.TREE ? T.GRASS : t, x, y, px(x), py(y), tm);
  }
  if (p && path.length) { const d = path[path.length - 1]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); rr(px(d.x) + 5, py(d.y) + 5, TS - 10, TS - 10, 6); ctx.stroke(); ctx.setLineDash([]); }
  const draw = [];
  for (let y = y0; y <= y1 + 1; y++) for (let x = x0; x <= x1; x++) if (tileAt(x, y) === T.TREE) draw.push([y, () => drawTree(x, y, px(x), py(y), tm)]);
  for (const m of mons.values()) draw.push([m.ry, () => drawMonster(m, px(m.rx), py(m.ry), tm)]);
  for (const q of players.values()) draw.push([q.ry, () => drawPlayer(q, px(q.rx), py(q.ry), q.id === myId, tm)]);
  draw.sort((a, b) => a[0] - b[0]).forEach(d => d[1]());
  swings = swings.filter(s => now - s.t < 220);
  for (const s of swings) {
    const a = (now - s.t) / 220, cx = px(s.x) + 16, cy = py(s.y) + 16;
    ctx.strokeStyle = `rgba(255,255,255,${1 - a})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, 12 + a * 6, -2 + a * 3, -0.6 + a * 3); ctx.stroke(); ctx.lineCap = 'butt';
  }
  for (const [id, b] of bubbles) {
    const q = players.get(id); if (!q || now - b.t > 5000) { bubbles.delete(id); continue; }
    ctx.font = `12px ${FONT}`; const w = ctx.measureText(b.text).width + 14, bx = px(q.rx) + 16, by = py(q.ry) - 30;
    rr(bx - w / 2, by - 14, w, 20, 8); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 4, by + 5); ctx.lineTo(bx, by + 10); ctx.lineTo(bx + 4, by + 5); ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(b.text, bx, by);
  }
  floats = floats.filter(f => now - f.t < 1100);
  for (const f of floats) { ctx.globalAlpha = Math.min(1, (1100 - (now - f.t)) / 400); label(f.text, px(f.x) + 16, py(f.y) - (now - f.t) / 22, f.c, 14); ctx.globalAlpha = 1; }
  // warm light, vignette, drifting petals
  const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.35, cv.width / 2, cv.height / 2, cv.height * 0.95);
  g.addColorStop(0, 'rgba(255,230,170,0.06)'); g.addColorStop(1, 'rgba(60,35,20,0.38)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  for (const q of petals) {
    q.x += 0.00025 * q.s + Math.sin(tm + q.r) * 0.0002; q.y += 0.0004 * q.s; if (q.x > 1.05) q.x = -0.05; if (q.y > 1.05) { q.y = -0.05; q.x = Math.random(); }
    ctx.fillStyle = '#ffd5e0cc'; ctx.beginPath(); ctx.ellipse(q.x * cv.width, q.y * cv.height, 3 * q.s, 1.8 * q.s, q.r + tm, 0, 7); ctx.fill();
  }
  hud(p);
}
function panel(x, y, w, h) {
  rr(x, y, w, h, 10); ctx.fillStyle = '#5b3f2b'; ctx.fill(); ctx.strokeStyle = '#2f1f14'; ctx.lineWidth = 2; ctx.stroke();
  rr(x + 4, y + 4, w - 8, h - 8, 7); ctx.fillStyle = '#7a5a40'; ctx.fill();
}
function hud(p) {
  if (!p) return;
  const x = 12, y = 12; panel(x, y, 232, 92);
  ctx.textAlign = 'left'; ctx.font = `bold 14px ${FONT}`; ctx.fillStyle = '#fff2d6'; ctx.fillText(`${p.name}`, x + 14, y + 25);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd36e'; ctx.fillText(`Level ${p.lvl}`, x + 218, y + 25);
  bar2(x + 14, y + 33, 204, p.hp / p.mhp, '#ef5b5b', `HP ${p.hp}/${p.mhp}`);
  bar2(x + 14, y + 53, 204, you.xp / you.next, '#5aa9e6', `XP ${you.xp}/${you.next}`);
  ctx.textAlign = 'left'; ctx.font = `bold 13px ${FONT}`; ctx.fillStyle = '#ffd36e'; ctx.fillText(`● ${you.gold} gold`, x + 14, y + 83);
  ctx.fillStyle = '#ffb3c8'; ctx.fillText(`♥ ${you.potions} potions (Q)`, x + 100, y + 83);
  const t = `${players.size} online`; ctx.font = `bold 13px ${FONT}`; const w = ctx.measureText(t).width + 24;
  panel(cv.width - w - 12, 12, w, 34); ctx.textAlign = 'center'; ctx.fillStyle = '#fff2d6'; ctx.fillText(t, cv.width - w / 2 - 12, 34);
}
function bar2(x, y, w, f, c, text) {
  rr(x, y, w, 16, 8); ctx.fillStyle = '#2b1d1d'; ctx.fill();
  if (f > 0.01) { rr(x + 1.5, y + 1.5, Math.max(10, (w - 3) * Math.min(1, f)), 13, 6.5); ctx.fillStyle = c; ctx.fill(); ctx.fillStyle = '#ffffff40'; ctx.fillRect(x + 6, y + 3, Math.max(0, (w - 3) * Math.min(1, f) - 10), 2); }
  ctx.fillStyle = '#fff'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#2b1d1d'; ctx.strokeText(text, x + w / 2, y + 12); ctx.fillText(text, x + w / 2, y + 12);
}
