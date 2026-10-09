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

// ---------- rendering ----------
const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function drawTile(t, x, y, sx, sy) {
  const h = hash(x, y), tm = performance.now() / 600;
  const fill = c => { ctx.fillStyle = c; ctx.fillRect(sx, sy, TS, TS); };
  switch (t) {
    case T.WATER: fill(`hsl(208,60%,${38 + Math.sin(tm + x + y * 0.7) * 3}%)`);
      ctx.fillStyle = '#ffffff30'; ctx.fillRect(sx + 4 + (Math.sin(tm + x) * 3 | 0), sy + 10 + h * 10, 10, 2); break;
    case T.SAND: fill('#d8c58a'); ctx.fillStyle = '#c4b178'; ctx.fillRect(sx + h * 20, sy + h * 24, 3, 3); break;
    case T.PATH: fill('#a8885a'); ctx.fillStyle = '#94764a'; ctx.fillRect(sx + h * 22, sy + h * 20, 5, 3); ctx.fillRect(sx + 18 - h * 10, sy + 22, 4, 3); break;
    case T.WALL: fill('#8b5a3c'); ctx.fillStyle = '#6e452d'; ctx.fillRect(sx, sy + TS - 6, TS, 6);
      ctx.fillStyle = '#c9a06a'; ctx.fillRect(sx + 4, sy + 4, TS - 8, 3); if (h > 0.6) { ctx.fillStyle = '#9ad'; ctx.fillRect(sx + 9, sy + 12, 14, 10); } break;
    default:
      fill(`hsl(100,38%,${33 + h * 5}%)`);
      ctx.fillStyle = '#4f8a3a'; ctx.fillRect(sx + h * 24, sy + h * 20, 2, 5); ctx.fillRect(sx + 24 - h * 14, sy + 8 + h * 12, 2, 4);
      if (t === T.FLOWER) { ctx.fillStyle = h > 0.5 ? '#f5e050' : '#f58ab0'; ctx.fillRect(sx + 12, sy + 12, 5, 5); ctx.fillRect(sx + 20, sy + 20, 4, 4); }
      if (t === T.TREE) {
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(sx + 13, sy + 18, 6, 12);
        ctx.fillStyle = '#1f5a28'; ctx.beginPath(); ctx.arc(sx + 16, sy + 12, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#2c7a38'; ctx.beginPath(); ctx.arc(sx + 12, sy + 9, 7, 0, 7); ctx.fill();
      }
  }
}
function drawBar(cx, y, w, f, c) {
  ctx.fillStyle = '#000a'; ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = c; ctx.fillRect(cx - w / 2, y, w * Math.max(0, f), 4);
}
function label(text, x, y, color) {
  ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(text, x, y); ctx.fillStyle = color || '#fff'; ctx.fillText(text, x, y);
}
function drawPlayer(p, sx, sy, isMe) {
  const bob = Math.abs(p.rx - p.x) + Math.abs(p.ry - p.y) > 0.05 ? Math.sin(performance.now() / 70) * 1.5 : 0;
  ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 28, 10, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = p.color; ctx.fillRect(sx + 8, sy + 13 + bob, 16, 13);
  ctx.fillStyle = '#f0c8a0'; ctx.fillRect(sx + 9, sy + 3 + bob, 14, 11);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(sx + 9, sy + 2 + bob, 14, 4);
  ctx.fillStyle = '#222';
  const ex = p.dir === 1 ? 4 : p.dir === 3 ? -4 : 0;
  if (p.dir !== 0) { ctx.fillRect(sx + 12 + ex, sy + 8 + bob, 2, 3); ctx.fillRect(sx + 18 + ex, sy + 8 + bob, 2, 3); }
  label(`${p.name} (${p.lvl})`, sx + 16, sy - 6, isMe ? '#9f9' : '#fff');
  drawBar(sx + 16, sy - 2, 28, p.hp / p.mhp, '#e44');
}
function drawMonster(m, sx, sy) {
  const def = MON[m.type], c = def.color, tm = performance.now() / 200 + m.id;
  ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 28, 11, 4, 0, 0, 7); ctx.fill();
  if (m.type === 'slime') {
    const s = 1 + Math.sin(tm) * 0.08;
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 22, 12 * s, 9 / s, 0, Math.PI, 0); ctx.fillRect(sx + 4 * (2 - s), sy + 21, 24 * s - 0, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(sx + 11, sy + 17, 3, 4); ctx.fillRect(sx + 18, sy + 17, 3, 4);
    ctx.fillStyle = '#000'; ctx.fillRect(sx + 12, sy + 19, 2, 2); ctx.fillRect(sx + 19, sy + 19, 2, 2);
  } else if (m.type === 'wolf') {
    ctx.fillStyle = c; ctx.fillRect(sx + 4, sy + 14, 22, 10); ctx.fillRect(sx + 20, sy + 8, 10, 9);
    ctx.fillRect(sx + 21, sy + 4, 3, 5); ctx.fillRect(sx + 27, sy + 4, 3, 5); ctx.fillRect(sx + 1, sy + 12, 5, 3);
    ctx.fillStyle = '#f33'; ctx.fillRect(sx + 26, sy + 10, 2, 2);
    ctx.fillStyle = '#6a6a78'; ctx.fillRect(sx + 7, sy + 24, 3, 4); ctx.fillRect(sx + 21, sy + 24, 3, 4);
  } else {
    ctx.fillStyle = c; ctx.fillRect(sx + 10, sy + 3, 12, 11); ctx.fillRect(sx + 13, sy + 14, 6, 11);
    ctx.fillRect(sx + 8, sy + 16, 16, 2); ctx.fillRect(sx + 11, sy + 25, 3, 4); ctx.fillRect(sx + 18, sy + 25, 3, 4);
    ctx.fillStyle = '#000'; ctx.fillRect(sx + 12, sy + 7, 3, 3); ctx.fillRect(sx + 17, sy + 7, 3, 3);
  }
  const sel = m.id === targetId;
  if (sel) { ctx.strokeStyle = '#f44'; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, TS - 2, TS - 2); }
  if (sel || m.hp < m.max) { label(m.type, sx + 16, sy - 6, '#fba'); drawBar(sx + 16, sy - 2, 28, m.hp / m.max, '#e44'); }
}

function frame(now) {
  requestAnimationFrame(frame);
  update(now);
  const p = me();
  if (p) {
    for (const o of [...players.values(), ...mons.values()]) { o.rx += (o.x - o.rx) * 0.3; o.ry += (o.y - o.ry) * 0.3; }
    camera.x += (p.rx + 0.5 - camera.x) * 0.2; camera.y += (p.ry + 0.5 - camera.y) * 0.2;
  }
  ctx.fillStyle = '#0a0e0a'; ctx.fillRect(0, 0, cv.width, cv.height);
  const ox = cv.width / 2 - camera.x * TS, oy = cv.height / 2 - camera.y * TS;
  const x0 = Math.max(0, Math.floor(-ox / TS)), y0 = Math.max(0, Math.floor(-oy / TS));
  const x1 = Math.min(W - 1, Math.ceil((cv.width - ox) / TS)), y1 = Math.min(H - 1, Math.ceil((cv.height - oy) / TS));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const t = map[y * W + x];
    drawTile(t === T.TREE ? T.GRASS : t, x, y, Math.round(ox + x * TS), Math.round(oy + y * TS));
  }
  // y-sorted entities and trees
  const draw = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (map[y * W + x] === T.TREE) draw.push([y, () => drawTile(T.TREE, x, y, Math.round(ox + x * TS), Math.round(oy + y * TS))]);
  for (const m of mons.values()) draw.push([m.ry, () => drawMonster(m, Math.round(ox + m.rx * TS), Math.round(oy + m.ry * TS))]);
  for (const q of players.values()) draw.push([q.ry, () => drawPlayer(q, Math.round(ox + q.rx * TS), Math.round(oy + q.ry * TS), q.id === myId)]);
  draw.sort((a, b) => a[0] - b[0]).forEach(d => d[1]());
  // click destination marker
  if (path.length) { const d = path[path.length - 1]; ctx.strokeStyle = '#ff0'; ctx.lineWidth = 2; ctx.strokeRect(ox + d.x * TS + 6, oy + d.y * TS + 6, TS - 12, TS - 12); }
  // swings, bubbles, floats
  swings = swings.filter(s => now - s.t < 200);
  for (const s of swings) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
    const cx = ox + (s.x + 0.5) * TS, cy = oy + (s.y + 0.5) * TS, a = (now - s.t) / 200 * 2;
    ctx.arc(cx, cy, 14, a, a + 1.5); ctx.stroke();
  }
  for (const [id, b] of bubbles) {
    const q = players.get(id); if (!q || now - b.t > 5000) { bubbles.delete(id); continue; }
    ctx.font = '12px system-ui'; const w = ctx.measureText(b.text).width + 10, bx = ox + q.rx * TS + 16, by = oy + q.ry * TS - 30;
    ctx.fillStyle = '#fffe'; ctx.fillRect(bx - w / 2, by - 12, w, 17); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.fillText(b.text, bx, by);
  }
  floats = floats.filter(f => now - f.t < 1100);
  for (const f of floats) label(f.text, ox + (f.x + 0.5) * TS, oy + f.y * TS - (now - f.t) / 25, f.c);
  hud(p);
}
function hud(p) {
  if (!p) return;
  const x = 10, y = 10;
  ctx.fillStyle = '#000a'; ctx.fillRect(x, y, 220, 78);
  ctx.textAlign = 'left'; ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#fff';
  ctx.fillText(`${p.name}  Lv ${p.lvl}`, x + 8, y + 18);
  drawBar2(x + 8, y + 26, 204, p.hp / p.mhp, '#d33', `${p.hp}/${p.mhp}`);
  drawBar2(x + 8, y + 44, 204, you.xp / you.next, '#38c', `XP ${you.xp}/${you.next}`);
  ctx.fillStyle = '#fc4'; ctx.fillText(`Gold ${you.gold}`, x + 8, y + 71);
  ctx.fillStyle = '#f9c'; ctx.fillText(`Potions (Q) ${you.potions}`, x + 100, y + 71);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(`${players.size} online`, cv.width - 10, 22);
}
function drawBar2(x, y, w, f, c, text) {
  ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, 14); ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), 14);
  ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(text, x + w / 2, y + 11); ctx.textAlign = 'left'; ctx.font = 'bold 13px system-ui';
}
