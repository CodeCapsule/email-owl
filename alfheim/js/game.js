// Core game: entities, input, camera, combat, AI, quests, inventory, pets, mounts and saving.
import * as THREE from 'three';
import {
  CLASSES, SKILLS, MONSTERS, SPAWNS, ZONES, PETS, SPRITES, CLASS_SPRITE, MOUNTS, ITEMS, SLOTS, QUALITY, QUALITY_PREFIX,
  WEAPON_NAMES, WEAPON_ICONS, SLOT_BASE, SLOT_INFO, NPCS, TELEPORTS, QUESTS, BOUNTY_TARGETS, SIGNIN, ONLINE_GIFTS, MALL,
  BOT_NAMES, GUILDS, TITLES, CHAT_LINES,
} from './data.js';
import { ARENA, TELEPORT_CIRCLE } from './world.js';
import {
  buildHumanoid, classLook, npcLook, buildMonster, buildPet, buildMount, buildSprite, animateHumanoid, animateCreature, blobShadow, HAIR_COLORS, EYE_COLORS,
} from './models.js';
import { shadowTexture, textTexture, targetRingTexture } from './toon.js';

export const SAVE_KEY = 'alfheim_tales_save_v1';
const MAX_LEVEL = 30, BAG_SIZE = 48;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);

export function newSave({ name, cls, gender, hair, eye }) {
  return {
    v: 1, name, cls, gender, hair, eye, level: 1, exp: 0, gold: 200, diamonds: 20,
    bag: [{ id: 'hp_potion', qty: 5 }, { id: 'mp_potion', qty: 5 }], equip: {}, pets: {}, activePet: null,
    sprites: [], activeSprite: null, mounts: [], activeMount: null, wings: false,
    quest: { id: 'q1', status: 'available', prog: 0 }, bounty: null, talent: 0, skillLv: {},
    signin: { count: 0, last: '' }, gift: { idx: 0, t: 0 }, pos: null, kills: {}, title: 0, uid: 1,
    settings: { others: true, autoPotion: true, shadows: true, sound: true },
  };
}
export function needExp(l) { return Math.floor(70 * Math.pow(l, 1.6) + 30); }

export class Game {
  constructor(o) {
    Object.assign(this, o); // renderer, scene, camera, world, fx, portraits, ui, sfx, S, sun
    this.time = 0; this.timers = [];
    this.monsters = []; this.npcs = []; this.bots = []; this.ents = [];
    this.keys = {}; this.cd = {}; this.potionCD = 0;
    this.cam = { yaw: 0.35, pitch: 0.6, dist: 15, target: new THREE.Vector3() };
    this.auto = false; this.autoPathing = false; this.engage = false; this.pendingSkill = null; this.pendingTalk = null;
    this.mounted = false; this.lastCombat = -99; this.zone = null; this.saveT = 0; this.chatT = 6; this.annT = 40;
    this.layer = document.getElementById('world-ui');
    this.ray = new THREE.Raycaster();
  }

  // ============================================================== setup
  start() {
    const S = this.S;
    this.createPlayer();
    const p = S.pos || { x: 0, z: 9 };
    this.player.pos.set(p.x, this.world.heightAt(p.x, p.z), p.z);
    this.player.yaw = Math.PI;
    for (const n of NPCS) this.createNPC(n);
    for (const sp of SPAWNS) for (let i = 0; i < sp.count; i++) this.createMonster(sp);
    this.createBots();
    this.targetRing = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: targetRingTexture('#ff4a3a'), transparent: true, depthWrite: false }));
    this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false; this.targetRing.renderOrder = 2;
    this.scene.add(this.targetRing);
    this.recalc(true);
    this.syncPet(); this.syncSprite();
    this.cam.target.copy(this.player.pos);
    this.ui.bind(this);
    this.ui.refreshAll();
    this.ui.chat('system', 'Welcome to <b>Carlyle</b>! Click the quest in the tracker on the right to auto-path to your goal.');
    this.ui.chat('system', 'Controls: click to move or attack · drag to turn the camera · scroll to zoom · 1–6 skills · R mount · T auto battle.');
    if (S.level === 1 && S.quest.id === 'q1') setTimeout(() => this.ui.banner('Sylvan Haven', 'Carlyle · Town', 'zone'), 400);
    this.bindInput();
    if (S.mounts.length && S.activeMount && S.wasMounted) this.mount(true);
  }

  makeEnt(kind, inner, o = {}) {
    const model = new THREE.Group();
    model.add(inner);
    const sh = blobShadow(o.shadowR || 0.65, shadowTexture()); sh.position.y = 0.06; model.add(sh);
    this.scene.add(model);
    const e = {
      kind, model, inner, pos: model.position, yaw: 0, yawT: 0, name: o.name || '', level: o.level || 1,
      hp: 1, maxHp: 1, mp: 0, maxMp: 0, atk: 10, def: 5, crit: 5, critDmg: 0.6, speed: o.speed || 5,
      height: o.height || inner.userData.height || 2, radius: o.radius || 0.7, dead: false, state: 'idle',
      actT: 0, actDur: 1, attackCD: 0, stun: 0, buffs: [], shield: 0, path: [], target: null, vy: 0, jumpY: 0, t0: Math.random() * 10,
    };
    this.ents.push(e);
    return e;
  }

  nameplate(e, html, cls, hp = false) {
    const el = document.createElement('div');
    el.className = 'np stroke ' + cls;
    el.innerHTML = html + (hp ? '<div class="hb"><i></i></div>' : '');
    this.layer.appendChild(el);
    e.np = el; e.npHb = hp ? el.querySelector('.hb i') : null;
  }

  playerLook() { const S = this.S; return classLook(S.cls, S.gender, S.hair, S.eye, { wings: S.wings }); }

  createPlayer() {
    const S = this.S;
    const inner = buildHumanoid(this.playerLook());
    const p = this.makeEnt('player', inner, { name: S.name, radius: 0.6 });
    p.humanoid = inner;
    this.player = p;
    this.nameplate(p, '', 'me', true);
    this.refreshPlayerPlate();
  }
  refreshPlayerPlate() {
    const S = this.S;
    const t = TITLES[Math.min(TITLES.length - 1, S.title)];
    this.player.np.innerHTML = `<div class="t">«${esc(t)}»</div><div class="n">${esc(S.name)}</div><div class="hb"><i></i></div>`;
    this.player.npHb = this.player.np.querySelector('.hb i');
  }
  rebuildPlayerModel() {
    const p = this.player, old = p.humanoid;
    const inner = buildHumanoid(this.playerLook());
    old.parent.add(inner); old.parent.remove(old);
    inner.position.copy(old.position); inner.rotation.copy(old.rotation);
    p.humanoid = inner; if (p.inner === old) p.inner = inner;
    this.portraits.cache.delete('player-head'); this.portraits.cache.delete('player-full');
  }

  createNPC(n) {
    const look = npcLook(n.look);
    const inner = buildHumanoid(look);
    const e = this.makeEnt('npc', inner, { name: n.name, radius: 0.8 });
    const y = this.world.heightAt(n.x, n.z);
    e.pos.set(n.x, y + (n.look === 'sylphie' ? 0.6 : 0), n.z);
    e.baseY = e.pos.y; e.yaw = e.homeYaw = n.face; e.data = n; e.id = n.id; e.humanoid = inner;
    e.float = n.look === 'sylphie';
    this.nameplate(e, `<div class="t">&lt;${esc(n.title)}&gt;</div><div class="n">${esc(n.name)}</div>`, 'npc');
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('!'), depthWrite: false }));
    mk.scale.setScalar(1.3); mk.visible = false; e.marker = mk; this.scene.add(mk);
    this.npcs.push(e);
  }

  monsterStats(type, lvl) {
    const d = MONSTERS[type], k = lvl - d.lvl[0];
    return { hp: Math.round(d.hp * (1 + 0.18 * k)), atk: d.atk * (1 + 0.1 * k), def: d.def * (1 + 0.08 * k) };
  }
  createMonster(sp) {
    const d = MONSTERS[sp.type];
    const variant = (Math.random() * 3) | 0;
    const inner = buildMonster(d.model, variant);
    const e = this.makeEnt('monster', inner, { radius: d.boss ? 3 : d.elite ? 1.6 : d.height > 3 ? 1.4 : 0.9, shadowR: d.boss ? 4 : d.elite || d.height > 3 ? 1.6 : 0.85, height: d.height });
    e.type = sp.type; e.def0 = d; e.spawn = sp; e.speed = d.speed;
    const cls = 'monster' + (d.aggressive ? ' aggr' : '') + (d.elite ? ' elite' : '') + (d.boss ? ' boss' : '');
    this.nameplate(e, `<div class="n"></div>`, cls, true);
    this.respawn(e, true);
    this.monsters.push(e);
    return e;
  }
  respawn(e, first = false) {
    const sp = e.spawn, d = e.def0;
    let x = sp.x, z = sp.z;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp.r;
      x = sp.x + Math.cos(a) * r; z = sp.z + Math.sin(a) * r;
      if (!this.world.isBlocked(x, z)) break;
    }
    e.level = Math.round(rnd(d.lvl[0], d.lvl[1]));
    const st = this.monsterStats(e.type, e.level);
    e.maxHp = e.hp = st.hp; e.atk = st.atk; e.def = st.def; e.crit = d.boss ? 8 : 4;
    e.pos.set(x, this.world.heightAt(x, z), z);
    e.home = { x, z };
    e.dead = false; e.state = 'idle'; e.target = null; e.returning = false; e.tagged = false; e.stun = 0; e.dots = [];
    e.model.visible = true; e.inner.position.y = 0; e.inner.scale.setScalar(1);
    e.wanderT = rnd(1, 5); e.attackCD = 1; e.skillT = 6;
    e.yaw = Math.random() * Math.PI * 2;
    if (e.np) {
      const tag = d.boss ? '[Boss] ' : d.elite ? '[Elite] ' : '';
      e.np.querySelector('.n').textContent = `${tag}Lv${e.level} ${d.name}`;
    }
    if (!first) {
      this.fx.spawnPuff(e.pos, 0xffffff);
      if (d.boss) this.ui.chat('announce', `<b>[Announcement]</b> ${d.name} has awakened in the Elder Ruins arena!`);
    }
  }

  createBots() {
    const roles = ['town', 'town', 'town', 'town', 'town', 'town', 'jelly', 'bunny', 'jelly', 'shroom', 'wolf', 'golem', 'treant'];
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const classes = Object.keys(CLASSES);
    roles.forEach((role, i) => {
      const cls = pick(classes), gender = Math.random() < 0.55 ? 'f' : 'm';
      const look = classLook(cls, gender, pick(HAIR_COLORS), pick(EYE_COLORS), { wings: Math.random() < 0.5, wingColor: pick(['#9fe8ff', '#ffb8e8', '#d8b8ff', '#b8ffd0']) });
      const hum = buildHumanoid(look);
      const e = this.makeEnt('bot', hum, { name: names[i], radius: 0.6 });
      e.humanoid = hum; e.cls = cls; e.level = role === 'town' ? ((rnd(8, 32)) | 0) : ({ jelly: 3, bunny: 5, shroom: 8, wolf: 10, golem: 15, treant: 16 }[role] + ((Math.random() * 3) | 0));
      e.maxHp = e.hp = 200 + e.level * 40; e.atk = 18 + e.level * 4.5; e.def = 6 + e.level * 2.5; e.crit = 10;
      e.speed = CLASSES[cls].speed; e.role = role; e.guild = pick(GUILDS); e.range = CLASSES[cls].range * (CLASSES[cls].ranged ? 0.8 : 1);
      e.skills = SKILLS[cls];
      const sp = role === 'town' ? null : SPAWNS.find((s) => s.type === role);
      e.spawnRef = sp;
      const home = sp ? sp : { x: rnd(-30, 30), z: rnd(-30, 30) };
      let x = home.x + rnd(-8, 8), z = home.z + rnd(-8, 8);
      [x, z] = this.world.nearestFree(x, z);
      e.pos.set(x, this.world.heightAt(x, z), z);
      e.waitT = rnd(0, 4); e.attackCD = rnd(0, 2);
      // pets for bots
      const pd = pick(PETS);
      const pm = buildPet(pd.model); pm.scale.setScalar(0.85);
      e.petModel = pm; this.scene.add(pm);
      if (role === 'town' && Math.random() < 0.45) {
        const md = pick(MOUNTS); const mm = buildMount(md.model);
        e.mountModel = mm; e.mountSpeed = md.speed;
        e.model.remove(hum); mm.add(hum); mm.userData.parts.seat.add(hum); hum.position.set(0, -0.55, 0);
        e.model.add(mm); e.inner = mm; e.mounted = true;
      }
      const g = e.guild ? `<div class="g">&lt;${esc(e.guild)}&gt;</div>` : '';
      this.nameplate(e, `${g}<div class="n">${esc(e.name)}</div>`, 'bot');
      this.bots.push(e);
    });
  }

  // ============================================================== stats
  recalc(fill = false) {
    const S = this.S, C = CLASSES[S.cls], L = S.level, p = this.player;
    let hp = C.base.hp + C.grow.hp * (L - 1), mp = C.base.mp + C.grow.mp * (L - 1), atk = C.base.atk + C.grow.atk * (L - 1), def = C.base.def + C.grow.def * (L - 1);
    let crit = C.base.crit, critDmg = 0.6, speed = C.speed, heal = 1, cdr = 0;
    for (const s of SLOTS) {
      const eq = S.equip[s]; if (!eq) continue;
      const k = 1 + 0.08 * (eq.enh || 0);
      hp += (eq.stats.hp || 0) * k; atk += (eq.stats.atk || 0) * k; def += (eq.stats.def || 0) * k; crit += (eq.stats.crit || 0);
    }
    const T = C.talents[S.talent].mods;
    hp *= T.hp || 1; mp *= T.mp || 1; atk *= T.atk || 1; def *= T.def || 1; crit += T.crit || 0; critDmg += T.critDmg || 0; heal *= T.heal || 1; cdr += T.cdr || 0;
    let petBR = 0;
    if (S.activePet) { const pd = PETS.find((x) => x.id === S.activePet), lv = S.pets[S.activePet]?.lv || 1; hp += pd.hp * (1 + 0.15 * (lv - 1)); petBR = (pd.atk * 12 + pd.hp) * (1 + 0.15 * (lv - 1)); }
    let spBR = 0;
    if (S.activeSprite) {
      const sd = SPRITES.find((x) => x.id === S.activeSprite), m = sd.mods || {};
      atk *= m.atk || 1; def *= m.def || 1; speed *= m.speed || 1; crit += m.crit || 0; spBR = 260;
    }
    if (S.wings) { hp *= 1.05; atk *= 1.05; }
    const mountBR = S.mounts.reduce((a, id) => a + (MOUNTS.find((m) => m.id === id)?.br || 0), 0);
    const ratio = p.maxHp > 1 ? p.hp / p.maxHp : 1, mratio = p.maxMp > 1 ? p.mp / p.maxMp : 1;
    p.maxHp = Math.round(hp); p.maxMp = Math.round(mp); p.atk = atk; p.def = def; p.crit = crit; p.critDmg = critDmg; p.baseSpeed = speed; p.level = L;
    p.hp = fill ? p.maxHp : Math.max(1, Math.round(p.maxHp * ratio)); p.mp = fill ? p.maxMp : Math.round(p.maxMp * mratio);
    this.healMod = heal; this.cdr = cdr;
    this.br = Math.round(p.maxHp * 0.55 + atk * 9 + def * 7 + crit * 14 + petBR + spBR + mountBR + (S.wings ? 300 : 0));
    this.ui.refreshPlayer && this.ui.refreshPlayer();
  }
  buffMod(e, key) { let m = 1; for (const b of e.buffs) if (b.mods && b.mods[key] && key !== 'crit') m *= b.mods[key]; return m; }
  atkOf(e) { return e.atk * this.buffMod(e, 'atk'); }
  defOf(e) { return e.def * this.buffMod(e, 'def'); }
  critOf(e) { let c = e.crit; for (const b of e.buffs) if (b.mods && b.mods.crit) c += b.mods.crit; return c; }
  speedOf(e) {
    if (e === this.player) return e.baseSpeed * this.buffMod(e, 'speed') * (this.mounted ? (MOUNTS.find((m) => m.id === this.S.activeMount)?.speed || 1.4) : 1);
    return e.speed * (e.mounted ? e.mountSpeed : 1);
  }
  skillList() { return SKILLS[this.S.cls]; }
  skillLevel(id) { return this.S.skillLv[id] || 1; }

  // ============================================================== input
  bindInput() {
    const cv = this.renderer.domElement;
    const ptrs = new Map(); let drag = null, pinch = 0;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      this.sfx.ensure();
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, moved: false };
      document.activeElement && document.activeElement.blur && document.activeElement !== document.body && document.activeElement.blur();
    });
    cv.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * (pinch / Math.max(1, d)), 6, 30); pinch = d; return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
        if (drag.moved) {
          this.cam.yaw -= dx * 0.006; this.cam.pitch = THREE.MathUtils.clamp(this.cam.pitch + dy * 0.004, 0.18, 1.35);
        }
        drag.x = e.clientX; drag.y = e.clientY;
      } else {
        const h = this.pick(e.clientX, e.clientY);
        cv.style.cursor = h ? (h.kind === 'monster' ? 'crosshair' : 'pointer') : 'default';
      }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (drag && !drag.moved && drag.btn === 0 && ptrs.size === 0) this.onClick(e.clientX, e.clientY);
      if (ptrs.size === 0) drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 6, 30); }, { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  onKey(e, down) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (down && e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key.toLowerCase();
    this.keys[k] = down;
    if (!down) return;
    if (this.player.dead && k !== 'escape') return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.player.path = []; this.autoPathing = false; this.pendingTalk = null; this.ui.setAutoPath(false); if (k.startsWith('arrow')) e.preventDefault(); return; }
    if (k >= '1' && k <= '6') { this.useSkill(+k); return; }
    switch (k) {
      case 'q': this.usePotion('hp_potion'); break;
      case 'e': this.usePotion('mp_potion'); break;
      case 'r': this.toggleMount(); break;
      case 't': this.toggleAuto(); break;
      case 'f': { const n = this.npcs.filter((x) => flat(x.pos, this.player.pos) < 6).sort((a, b) => flat(a.pos, this.player.pos) - flat(b.pos, this.player.pos))[0]; if (n) this.talkTo(n); break; }
      case ' ': e.preventDefault(); this.jump(); break;
      case 'tab': e.preventDefault(); this.cycleTarget(); break;
      case 'enter': e.preventDefault(); this.ui.focusChat(); break;
      case 'escape': if (!this.ui.closeTop()) { this.setTarget(null); this.engage = false; } break;
      case 'c': this.ui.togglePanel('char'); break;
      case 'b': case 'i': this.ui.togglePanel('bag'); break;
      case 'k': this.ui.togglePanel('skills'); break;
      case 'p': this.ui.togglePanel('pets'); break;
      case 'u': this.ui.togglePanel('mounts'); break;
      case 'l': this.ui.togglePanel('quests'); break;
      case 'm': this.ui.togglePanel('map'); break;
      case 'o': this.ui.togglePanel('settings'); break;
    }
  }

  screenOf(v) {
    const p = v.clone().project(this.camera);
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, z: p.z };
  }
  pick(sx, sy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = sx - rect.left, y = sy - rect.top;
    let best = null, bd = Infinity;
    const focal = rect.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const cands = [...this.monsters, ...this.npcs, ...(this.S.settings.others ? this.bots : [])];
    for (const e of cands) {
      if (e.dead || !e.model.visible) continue;
      const c = e.pos.clone(); c.y += e.height * 0.5;
      const dcam = c.distanceTo(this.camera.position);
      if (dcam > 120) continue;
      const s = this.screenOf(c); if (s.z > 1) continue;
      const rpx = Math.max(16, (Math.max(e.radius, e.height * 0.45) / dcam) * focal);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < rpx && dcam < bd) { bd = dcam; best = e; }
    }
    return best;
  }
  groundPoint(sx, sy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let prev = 0;
    for (let t = 0.5; t < 400; t += t < 40 ? 0.5 : 2) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= this.world.heightAt(x, z)) {
        let a = prev, b = t;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2; const mx = o.x + d.x * m, my = o.y + d.y * m, mz = o.z + d.z * m; if (my <= this.world.heightAt(mx, mz)) b = m; else a = m; }
        return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
      }
      prev = t;
    }
    return null;
  }

  onClick(x, y) {
    if (this.player.dead) return;
    const h = this.pick(x, y);
    if (h) {
      if (h.kind === 'monster') { this.setTarget(h); this.engage = true; this.player.path = []; this.pendingTalk = null; this.autoPathing = false; this.ui.setAutoPath(false); return; }
      if (h.kind === 'npc') { this.talkTo(h); return; }
      if (h.kind === 'bot') { this.setTarget(h); return; }
    }
    const g = this.groundPoint(x, y);
    if (g) { this.engage = false; this.pendingSkill = null; this.pendingTalk = null; this.pathTo(g.x, g.z, false); this.fx.clickMarker(g); }
  }

  pathTo(x, z, auto = true) {
    const p = this.player;
    p.path = this.world.findPath(p.pos.x, p.pos.z, x, z);
    this.autoPathing = auto && flat(p.pos, { x, z }) > 12;
    this.ui.setAutoPath(this.autoPathing);
    if (auto && this.autoPathing && !this.mounted && this.S.activeMount && !this.casting && flat(p.pos, { x, z }) > 40) this.mount(true);
  }

  setTarget(t) {
    this.player.target = t;
    this.ui.refreshTarget && this.ui.refreshTarget();
  }
  cycleTarget() {
    const p = this.player;
    const list = this.monsters.filter((m) => !m.dead && flat(m.pos, p.pos) < 30).sort((a, b) => flat(a.pos, p.pos) - flat(b.pos, p.pos));
    if (!list.length) return;
    const i = list.indexOf(p.target);
    this.setTarget(list[(i + 1) % list.length]); this.engage = true;
  }
  nearestEnemy(r = 25, type = null, from = null) {
    const c = from || this.player.pos;
    let best = null, bd = r;
    for (const m of this.monsters) {
      if (m.dead || m.returning) continue;
      if (type && m.type !== type) continue;
      const d = flat(m.pos, c);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  jump() {
    const p = this.player;
    if (p.jumpY > 0.01 || p.dead) return;
    p.vy = 8.5;
  }

  // ============================================================== skills & combat
  useSkill(idx) {
    const p = this.player; if (p.dead) return;
    const sk = this.skillList()[idx]; if (!sk) return;
    if (this.S.level < sk.lvl) { this.ui.toast(`Unlocks at Lv ${sk.lvl}`, 'warn'); this.sfx.play('error'); return; }
    if ((this.cd[sk.id] || 0) > this.time) { this.ui.toast('Skill is cooling down', 'warn'); return; }
    if (p.mp < sk.mp) { this.ui.toast('Not enough MP', 'warn'); this.sfx.play('error'); return; }
    if (p.stun > 0) return;
    const needsTarget = ['target', 'dash', 'proj', 'aoeTarget'].includes(sk.kind);
    if (needsTarget) {
      if (!p.target || p.target.dead || p.target.kind !== 'monster') {
        const n = this.nearestEnemy(25);
        if (!n) { this.ui.toast('No target nearby', 'warn'); return; }
        this.setTarget(n);
      }
      this.engage = true;
      const d = flat(p.pos, p.target.pos) - p.target.radius;
      if (d > (sk.range || 3)) { this.pendingSkill = idx; p.path = []; return; }
    }
    this.castSkill(sk);
  }

  castSkill(sk) {
    const p = this.player, t = p.target;
    if (this.mounted) this.dismount(true);
    p.path = []; this.pendingSkill = null;
    if (t && ['target', 'dash', 'proj', 'aoeTarget'].includes(sk.kind)) p.yaw = p.yawT = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
    p.mp -= sk.mp;
    this.cd[sk.id] = this.time + sk.cd * (sk.basic ? 1 : 1 - this.cdr);
    const ranged = CLASSES[this.S.cls].ranged || ['buff', 'heal', 'zone'].includes(sk.kind);
    p.state = ranged ? 'cast' : 'attack'; p.actDur = p.actT = sk.basic ? 0.42 : 0.5;
    p.attackCD = this.cd[sk.id] - this.time;
    this.lastCombat = this.time;
    if (!sk.basic) { this.sfx.play('cast'); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 12, color: CLASSES[this.S.cls].elemColor, speed: 2, life: 0.5, size: 0.5, up: 1 }); }
    this.after(sk.basic ? 0.16 : 0.2, () => this.applySkill(sk, t));
    this.ui.refreshSkillCD && this.ui.refreshSkillCD();
  }

  applySkill(sk, t) {
    const p = this.player; if (p.dead) return;
    const lv = 1 + 0.08 * (this.skillLevel(sk.id) - 1);
    const mult = (sk.mult || 0) * lv;
    const elem = CLASSES[this.S.cls].elemColor;
    const hits = sk.hits || 1;
    const hand = p.pos.clone().add(new THREE.Vector3(Math.sin(p.yaw) * 0.6, 1.3, Math.cos(p.yaw) * 0.6));
    switch (sk.kind) {
      case 'target':
        if (!t || t.dead) return;
        for (let i = 0; i < hits; i++) this.after(i * 0.13, () => {
          if (t.dead) return;
          this.skillFx(sk.fx, t.pos, i);
          this.damage(p, t, mult);
          if (sk.stun) { t.stun = sk.stun; this.fx.text(t.pos.clone().setY(t.pos.y + t.height), 'Stunned', 'miss'); }
          if (sk.dot) this.addDot(t, sk.dot, mult);
        });
        break;
      case 'dash': {
        if (!t || t.dead) return;
        const from = p.pos.clone();
        const dir = new THREE.Vector3(t.pos.x - p.pos.x, 0, t.pos.z - p.pos.z).normalize();
        const dest = t.pos.clone().addScaledVector(dir, -(t.radius + 1.0));
        for (let i = 0; i <= 8; i++) this.fx.emit(from.clone().lerp(dest, i / 8).setY(this.world.heightAt(from.x, from.z) + 1), { count: 6, color: 0xa87aff, speed: 1, life: 0.5, size: 0.8 });
        if (!this.world.isBlocked(dest.x, dest.z)) { p.pos.x = dest.x; p.pos.z = dest.z; }
        this.skillFx('slash2', t.pos, 0); this.damage(p, t, mult);
        break;
      }
      case 'proj':
        if (!t || t.dead) return;
        this.skillFx(sk.fx, hand, 0, t, () => {
          this.damage(p, t, mult);
          if (sk.stun && !t.dead) { t.stun = sk.stun; this.fx.bubble(t, sk.stun); }
        });
        break;
      case 'aoeTarget': {
        if (!t) return;
        const c = t.pos.clone();
        if (sk.fx === 'meteor') { this.fx.meteor(c, 0xff7a2a, sk.delay || 0.8, () => { this.sfx.play('boom'); this.aoe(c, sk.radius, mult); }); break; }
        for (let i = 0; i < hits; i++) this.after((sk.delay || 0.05) + i * 0.4, () => {
          if (sk.fx === 'inferno') {
            const o = c.clone().add(new THREE.Vector3(rnd(-3, 3), 0, rnd(-3, 3))); o.y = this.world.heightAt(o.x, o.z);
            this.fx.meteor(o, 0xff5a1a, 0.45, () => { this.sfx.play('boom'); this.aoe(c, sk.radius, mult); });
          } else { this.skillFx(sk.fx, c, i, null, null, sk.radius); this.aoe(c, sk.radius, mult, sk.stun); }
        });
        break;
      }
      case 'aoeSelf':
        for (let i = 0; i < hits; i++) this.after(i * 0.16, () => { this.skillFx(sk.fx, p.pos.clone(), i, null, null, sk.radius); this.aoe(p.pos.clone(), sk.radius, mult, sk.stun); });
        break;
      case 'buff': {
        const b = { id: sk.id, icon: sk.icon, until: this.time + sk.dur, mods: sk.buff || null };
        p.buffs = p.buffs.filter((x) => x.id !== sk.id); p.buffs.push(b);
        if (sk.healPct) this.heal(p, p.maxHp * sk.healPct);
        if (sk.shieldPct) { p.shield = p.maxHp * sk.shieldPct; b.shield = true; }
        this.fx.buff(p, elem);
        this.sfx.play('heal');
        break;
      }
      case 'heal':
        this.heal(p, p.maxHp * sk.healPct * this.healMod); this.fx.heal(p); this.sfx.play('heal');
        break;
      case 'zone': {
        const c = p.pos.clone();
        this.fx.circle(c, '#9ae8ff', sk.radius, sk.ticks + 0.3);
        this.fx.pillar(c, 0x8ad8ff, sk.radius * 0.8, 6, 0.8);
        for (let i = 0; i < sk.ticks; i++) this.after(i + 0.3, () => {
          if (flat(p.pos, c) < sk.radius) { this.heal(p, p.maxHp * sk.healPct * this.healMod); }
          this.fx.emit(c.clone().setY(c.y + 0.3), { count: 30, colors: [0x9ae8ff, 0xffffff], speed: 1, life: 1, size: 0.6, up: 3, jitter: sk.radius * 1.5 });
          this.aoe(c, sk.radius, mult);
        });
        break;
      }
    }
  }

  aoe(c, r, mult, stun) {
    let n = 0;
    for (const m of this.monsters) {
      if (m.dead || flat(m.pos, c) > r + m.radius * 0.5) continue;
      this.damage(this.player, m, mult); n++;
      if (stun && !m.dead && !m.def0.boss) m.stun = stun;
    }
    return n;
  }

  addDot(t, dot, mult) {
    for (let i = 1; i <= dot.ticks; i++) this.after(i, () => {
      if (t.dead) return;
      this.fx.emit(t.pos.clone().setY(t.pos.y + t.height * 0.6), { count: 8, color: 0x7aff5a, speed: 1.5, life: 0.5, size: 0.5, up: 1 });
      this.damage(this.player, t, dot.mult * (mult / 1.2), { canCrit: false, cls: 'pet' });
    });
  }

  skillFx(kind, pos, i = 0, target = null, onHit = null, radius = 4) {
    const p = this.player, fx = this.fx;
    switch (kind) {
      case 'slash': fx.slash(p.pos, p.yaw, 0xffffff, 1.7, 0.3); break;
      case 'bigslash': fx.slash(p.pos, p.yaw, 0xffb04a, 2.4, -0.4, 0.35); fx.emit(pos.clone().setY(pos.y + 1), { count: 30, colors: [0xffb04a, 0xffffff], speed: 7, life: 0.5, size: 0.6 }); fx.shake(0.2); break;
      case 'bash': fx.emit(pos.clone().setY(pos.y + 1.2), { count: 26, color: 0xffe07a, speed: 6, life: 0.5, size: 0.7 }); fx.ring(pos, 0xffe07a, 2.5, 0.35); fx.shake(0.15); break;
      case 'slash2': fx.slash(p.pos, p.yaw, 0x7affd0, 1.5, i % 2 ? 0.6 : -0.6, 0.22); break;
      case 'venom': fx.slash(p.pos, p.yaw, 0x8aff5a, 1.6, 0.4); fx.emit(pos.clone().setY(pos.y + 1), { count: 24, color: 0x6aff3a, speed: 3, life: 0.8, size: 0.6, up: 1 }); break;
      case 'spin': fx.spin(p.pos, 0xffe07a, radius); break;
      case 'quake': fx.quake(pos, radius); this.sfx.play('boom'); break;
      case 'titan': fx.pillar(p.pos, 0xffc84a, 3, 14, 1.0); fx.quake(p.pos, radius); this.sfx.play('boom'); break;
      case 'gale': fx.ring(pos, 0x7affb0, radius, 0.5); fx.emit(pos.clone().setY(pos.y + 1), { count: 50, colors: [0x7affb0, 0xffffff], speed: 7, life: 0.6, size: 0.5, spread: 1.2 }); break;
      case 'tempest': fx.slash(p.pos, i * 1.05, 0x7affd0, radius * 0.6, (i % 3 - 1) * 0.5, 0.25); if (i === 0) fx.ring(p.pos, 0x7affb0, radius, 0.6); fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 16, color: 0x7affd0, speed: 6, life: 0.4, size: 0.5 }); break;
      case 'firebolt': fx.projectile(pos, target, { color: 0xff7a2a, size: 0.3, onHit }); break;
      case 'fireball': fx.projectile(pos, target, { color: 0xff5a1a, size: 0.55, speed: 22, onHit }); break;
      case 'waterbolt': fx.projectile(pos, target, { color: 0x4ab8ff, size: 0.3, onHit }); break;
      case 'aquaorb': fx.projectile(pos, target, { color: 0x3a9aff, size: 0.55, speed: 22, onHit }); break;
      case 'prison': fx.projectile(pos, target, { color: 0x8ad8ff, size: 0.5, speed: 20, onHit }); break;
      case 'pillar': fx.pillar(pos, 0xff6a2a, radius * 0.6, 10, 0.9); fx.emit(pos.clone().setY(pos.y + 1), { count: 40, colors: [0xff6a2a, 0xffd04a], speed: 4, life: 0.8, size: 0.8, up: 6 }); this.sfx.play('boom'); break;
      case 'ring': fx.ring(p.pos, 0xff7a2a, radius, 0.5); fx.emit(p.pos.clone().setY(p.pos.y + 0.6), { count: 50, colors: [0xff6a2a, 0xffd04a], speed: 9, life: 0.5, size: 0.7, spread: 1 }); break;
      case 'tidal': fx.ring(pos, 0x4ab8ff, radius, 0.6); fx.pillar(pos, 0x6ad0ff, radius * 0.7, 4, 0.7); fx.emit(pos.clone().setY(pos.y + 0.5), { count: 50, colors: [0x6ad0ff, 0xffffff], speed: 6, life: 0.8, size: 0.7, up: 5, gravity: -12 }); break;
    }
  }

  damage(src, dst, mult, o = {}) {
    if (dst.dead) return 0;
    const canCrit = o.canCrit !== false;
    let base = this.atkOf(src) * mult * rnd(0.9, 1.1);
    const crit = canCrit && Math.random() * 100 < this.critOf(src);
    if (crit) base *= 1 + (src.critDmg ?? 0.6);
    if (src.kind === 'monster' && Math.random() < 0.05) {
      if (dst === this.player) this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height), 'Miss', 'miss');
      return 0;
    }
    let dmg = Math.max(1, Math.round(base * 60 / (60 + this.defOf(dst))));
    if (dst.shield > 0) {
      const ab = Math.min(dst.shield, dmg); dst.shield -= ab; dmg -= ab;
      if (dst === this.player && ab > 0) this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height), 'Absorb', 'miss');
      if (dst.shield <= 0) dst.buffs = dst.buffs.filter((b) => !b.shield);
    }
    dst.hp -= dmg;
    const head = dst.pos.clone().setY(dst.pos.y + dst.height * 0.9);
    const mine = src === this.player || src.kind === 'pet';
    if (dst === this.player) { if (dmg) this.fx.text(head, '-' + dmg, 'hurt'); this.sfx.play('hurt'); this.lastCombat = this.time; }
    else if (mine) {
      this.fx.text(head, String(dmg), o.cls || (src.kind === 'pet' ? 'pet' : crit ? 'crit' : 'dmg'));
      this.sfx.play(crit ? 'crit' : 'hit');
      this.fx.emit(head, { count: crit ? 16 : 8, color: crit ? 0xffb02a : 0xffffff, speed: 4, life: 0.3, size: 0.4 });
      dst.hitT = 0.15;
      if (crit) this.fx.shake(0.12);
    } else if (dst.kind === 'monster' && src.kind === 'bot' && flat(dst.pos, this.player.pos) < 25) {
      this.fx.emit(head, { count: 5, color: 0xffffff, speed: 3, life: 0.25, size: 0.35 });
      dst.hitT = 0.12;
    }
    if (dst.kind === 'monster') {
      if (mine) { dst.tagged = true; this.lastCombat = this.time; }
      if (!dst.target || dst.target.dead || (mine && dst.target.kind === 'bot' && Math.random() < 0.3)) dst.target = src.kind === 'pet' ? this.player : src;
      dst.returning = false;
    }
    if (dst.hp <= 0) {
      if (dst.kind === 'monster') this.killMonster(dst);
      else if (dst === this.player) this.playerDied(src);
      else if (dst.kind === 'bot') { dst.hp = dst.maxHp; this.fx.heal(dst); }
    }
    return dmg;
  }

  heal(e, amt) {
    amt = Math.round(amt);
    const before = e.hp; e.hp = Math.min(e.maxHp, e.hp + amt);
    if (e === this.player && e.hp > before) this.fx.text(e.pos.clone().setY(e.pos.y + e.height), '+' + (e.hp - before), 'heal');
  }

  killMonster(m) {
    const d = m.def0, p = this.player;
    m.hp = 0; m.dead = true; m.state = 'dead'; m.deadT = 0; m.respawnT = d.boss ? 90 : rnd(9, 15);
    m.dots = [];
    if (p.target === m) { this.setTarget(null); }
    if (this.pet && this.pet.target === m) this.pet.target = null;
    if (!m.tagged) return;
    m.tagged = false;
    // exp
    let exp = d.exp * (1 + 0.15 * (m.level - d.lvl[0]));
    if (this.S.level - m.level > 4) exp *= 0.4;
    exp = Math.round(exp);
    this.after(0.3, () => { this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.3), `+${exp} EXP`, 'exp'); this.gainExp(exp); });
    // gold
    const gold = Math.round(rnd(d.gold[0], d.gold[1]) * (1 + 0.1 * (m.level - d.lvl[0])));
    this.fx.coins(m.pos, p, Math.min(8, 2 + (gold / 15) | 0), () => { this.S.gold += gold; this.sfx.play('coin'); this.ui.refreshWallet(); this.fx.text(p.pos.clone().setY(p.pos.y + p.height), `+${gold} Gold`, 'gold', 0.5); });
    this.S.kills[m.type] = (this.S.kills[m.type] || 0) + 1;
    // drops
    if (Math.random() < (d.boss ? 1 : d.elite ? 0.4 : 0.1)) {
      const q = d.boss ? 4 : this.rollQuality(d.elite ? 1 : 0);
      const eq = this.genEquip(pick(SLOTS), Math.max(1, m.level), q);
      if (this.addEquip(eq)) this.lootMsg(eq.name, QUALITY[q].color);
    }
    if (Math.random() < 0.08) { this.addItem('hp_potion', 1); this.lootMsg(ITEMS.hp_potion.name, QUALITY[0].color); }
    if (Math.random() < 0.05) { this.addItem('mp_potion', 1); this.lootMsg(ITEMS.mp_potion.name, QUALITY[0].color); }
    for (const dr of d.drops || []) {
      if (Math.random() > dr.chance) continue;
      if (dr.id.startsWith('pet_') && dr.id !== 'pet_egg') {
        if (this.S.pets[dr.id]) continue;
        this.gainPet(dr.id, true);
      } else if (dr.id.startsWith('mount_')) {
        if (this.S.mounts.includes(dr.id)) continue;
        this.gainMount(dr.id, true);
      } else { this.addItem(dr.id, 1); this.lootMsg(ITEMS[dr.id].name, QUALITY[ITEMS[dr.id].quality].color); }
    }
    this.questKill(m);
  }

  lootMsg(name, color) {
    this.ui.chat('system', `Obtained <span class="it" style="color:${color}">[${esc(name)}]</span>`);
    this.ui.toast(`Obtained [${name}]`, 'item');
  }

  gainExp(n) {
    const S = this.S;
    if (S.level >= MAX_LEVEL) return;
    S.exp += n;
    let leveled = false;
    while (S.level < MAX_LEVEL && S.exp >= needExp(S.level)) { S.exp -= needExp(S.level); S.level++; leveled = true; }
    if (leveled) {
      this.recalc(true);
      this.fx.levelUp(this.player); this.sfx.play('level');
      this.ui.banner('LEVEL UP!', `You reached Level ${S.level}`);
      this.ui.chat('system', `Congratulations! You reached <b>Level ${S.level}</b>.`);
      const unlocked = this.skillList().filter((s) => s.lvl === S.level && !s.basic);
      for (const s of unlocked) { this.ui.toast(`New skill unlocked: ${s.name}`, 'good'); this.ui.chat('system', `New skill unlocked: <b>${s.icon} ${esc(s.name)}</b>`); }
      if (S.level >= 10 && S.title < 3) { S.title = 3; this.refreshPlayerPlate(); }
      this.ui.refreshSkills();
      this.save();
    }
    this.ui.refreshExp();
  }

  playerDied(src) {
    const p = this.player;
    p.hp = 0; p.dead = true; p.state = 'dead'; this.auto = false; this.ui.setAutoBattle(false);
    this.engage = false; p.path = []; this.setTarget(null);
    if (this.mounted) this.dismount(true);
    for (const m of this.monsters) if (m.target === p) { m.target = null; m.returning = true; }
    this.ui.chat('system', `You were defeated by ${esc(src?.def0?.name || src?.name || 'a monster')}.`);
    this.ui.modal('You have been defeated', 'Your spirit drifts back toward the World Tree... Choose how to return.', [
      { label: 'Revive in Town', cls: 'blue', fn: () => this.revive(false) },
      { label: 'Revive Here (10 💎)', fn: () => this.revive(true) },
    ], true);
  }
  revive(here) {
    const p = this.player, S = this.S;
    if (here && S.diamonds < 10) { this.ui.toast('Not enough diamonds', 'warn'); return false; }
    if (here) S.diamonds -= 10;
    else { p.pos.set(0, this.world.heightAt(0, 9), 9); this.cam.target.copy(p.pos); }
    p.dead = false; p.state = 'idle'; p.hp = p.maxHp; p.mp = p.maxMp;
    this.fx.levelUp(p); this.ui.refreshWallet();
    return true;
  }

  // ============================================================== items
  rollQuality(bonus = 0) {
    const r = Math.random();
    let q = r < 0.55 ? 0 : r < 0.84 ? 1 : r < 0.97 ? 2 : 3;
    return Math.min(4, q + bonus);
  }
  genEquip(slot, lvl, q) {
    const S = this.S, qm = QUALITY[q].mult;
    const st = {};
    if (slot === 'weapon') st.atk = (8 + lvl * 2.4) * qm;
    if (slot === 'helm') { st.hp = (24 + lvl * 10) * qm; st.def = (2 + lvl * 0.6) * qm; }
    if (slot === 'armor') { st.def = (4 + lvl * 1.2) * qm; st.hp = (20 + lvl * 8) * qm; }
    if (slot === 'boots') { st.def = (2 + lvl * 0.7) * qm; st.hp = (10 + lvl * 4) * qm; }
    if (slot === 'necklace') { st.hp = (30 + lvl * 12) * qm; st.atk = (2 + lvl * 0.5) * qm; }
    if (slot === 'ring') { st.atk = (3 + lvl * 1.0) * qm; st.crit = 1 + q * 1.5; }
    for (const k in st) st[k] = Math.round(st[k] * 10) / 10;
    const base = slot === 'weapon' ? WEAPON_NAMES[S.cls] : SLOT_BASE[slot];
    return { uid: S.uid++, slot, name: `${QUALITY_PREFIX[q]} ${base}`, quality: q, lvl, stats: st, enh: 0, icon: slot === 'weapon' ? WEAPON_ICONS[S.cls] : SLOT_INFO[slot].icon };
  }
  addItem(id, qty = 1) {
    const S = this.S, it = ITEMS[id];
    const ex = S.bag.find((b) => b.id === id);
    if (ex) ex.qty = Math.min(999, ex.qty + qty);
    else { if (S.bag.length >= BAG_SIZE) { this.ui.toast('Bag is full!', 'warn'); return false; } S.bag.push({ id, qty }); }
    if (it.type === 'quest') this.questCollectCheck();
    this.ui.refreshPanel(); this.ui.refreshSkills();
    return true;
  }
  addEquip(eq) {
    const S = this.S;
    if (S.bag.length >= BAG_SIZE) { this.ui.toast('Bag is full!', 'warn'); return false; }
    S.bag.push({ eq }); this.ui.refreshPanel(); this.ui.markMenu('bag');
    return true;
  }
  countItem(id) { return this.S.bag.filter((b) => b.id === id).reduce((a, b) => a + b.qty, 0); }
  removeItem(id, qty) {
    const S = this.S;
    for (const b of S.bag) if (b.id === id) { const n = Math.min(qty, b.qty); b.qty -= n; qty -= n; if (!qty) break; }
    S.bag = S.bag.filter((b) => !b.id || b.qty > 0);
    this.ui.refreshPanel(); this.ui.refreshSkills();
  }
  usePotion(id) {
    const p = this.player;
    if (p.dead) return;
    if (this.potionCD > this.time) return;
    if (!this.countItem(id)) { this.ui.toast(`No ${ITEMS[id].name} left`, 'warn'); return; }
    this.removeItem(id, 1); this.potionCD = this.time + 3;
    if (id === 'hp_potion') { this.heal(p, p.maxHp * 0.35); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 20, color: 0xff6a7a, speed: 1, life: 0.8, size: 0.5, up: 2.5, jitter: 1 }); }
    else { p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.35); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 20, color: 0x5aa8ff, speed: 1, life: 0.8, size: 0.5, up: 2.5, jitter: 1 }); }
    this.sfx.play('heal');
  }
  useBagItem(i) {
    const S = this.S, b = S.bag[i]; if (!b) return;
    if (b.eq) return this.equip(i);
    const it = ITEMS[b.id];
    if (b.id === 'hp_potion' || b.id === 'mp_potion') return this.usePotion(b.id);
    if (b.id === 'pet_egg') {
      const pool = PETS.filter((pd) => pd.rarity <= 2 && !S.pets[pd.id]);
      this.removeItem('pet_egg', 1);
      if (!pool.length) { S.gold += 600; this.ui.toast('All common pets collected: received 600 Gold', 'good'); this.ui.refreshWallet(); return; }
      const pd = pick(pool);
      this.fx.levelUp(this.player); this.sfx.play('quest');
      this.gainPet(pd.id, false);
      this.ui.modal('The egg hatched!', `A ${pd.species} named ${pd.name} wriggles out of the shell and looks up at you adoringly.`, [{ label: 'Summon it', fn: () => this.setPet(pd.id) }, { label: 'Later', cls: 'gray' }], false, this.petIcon(pd.id));
      return;
    }
    if (b.id === 'exp_scroll') { this.removeItem('exp_scroll', 1); this.gainExp(Math.round(needExp(S.level) * 0.25)); this.fx.buff(this.player, '#c8ff6a'); return; }
    if (it.type === 'quest') this.ui.toast('Quest item — bring it to the right person', 'warn');
  }
  equip(i) {
    const S = this.S, b = S.bag[i]; if (!b || !b.eq) return;
    const eq = b.eq;
    if (eq.lvl > S.level + 5) { this.ui.toast(`Requires Lv ${eq.lvl - 5}`, 'warn'); return; }
    S.bag.splice(i, 1);
    if (S.equip[eq.slot]) S.bag.push({ eq: S.equip[eq.slot] });
    S.equip[eq.slot] = eq;
    this.recalc(); this.sfx.play('click'); this.ui.refreshPanel();
    this.ui.toast(`Equipped ${eq.name}`, 'good');
  }
  unequip(slot) {
    const S = this.S;
    if (!S.equip[slot]) return;
    if (S.bag.length >= BAG_SIZE) { this.ui.toast('Bag is full!', 'warn'); return; }
    S.bag.push({ eq: S.equip[slot] }); delete S.equip[slot];
    this.recalc(); this.ui.refreshPanel();
  }
  sell(i) {
    const S = this.S, b = S.bag[i]; if (!b) return;
    let g = 0;
    if (b.eq) g = Math.round(12 * b.eq.lvl * (b.eq.quality + 1) * (1 + (b.eq.enh || 0) * 0.3));
    else { const it = ITEMS[b.id]; if (it.type === 'quest') { this.ui.toast('Quest items cannot be sold', 'warn'); return; } g = Math.round((it.price || 10) * 0.3) * b.qty; }
    S.bag.splice(i, 1); S.gold += g; this.sfx.play('coin');
    this.ui.toast(`Sold for ${fmt(g)} Gold`, 'good'); this.ui.refreshWallet(); this.ui.refreshPanel();
  }
  enhanceCost(eq) { return Math.round(80 * Math.pow(eq.enh + 1, 2) * (1 + eq.lvl / 10)); }
  enhance(slot) {
    const S = this.S, eq = S.equip[slot]; if (!eq) return;
    if (eq.enh >= 15) { this.ui.toast('Already at +15', 'warn'); return; }
    const cost = this.enhanceCost(eq);
    if (S.gold < cost) { this.ui.toast('Not enough Gold', 'warn'); this.sfx.play('error'); return; }
    S.gold -= cost;
    const chance = Math.max(0.35, 1 - eq.enh * 0.07);
    if (Math.random() < chance) {
      eq.enh++; this.recalc(); this.sfx.play('level'); this.fx.buff(this.player, '#ffe07a');
      this.ui.toast(`Enhance succeeded! ${eq.name} +${eq.enh}`, 'good');
      if (eq.enh >= 7) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} enhanced <span style="color:${QUALITY[eq.quality].color}">[${esc(eq.name)}]</span> to +${eq.enh}!`);
    } else { this.sfx.play('error'); this.ui.toast('Enhance failed... the gear is unharmed.', 'warn'); }
    this.ui.refreshWallet(); this.ui.refreshPanel();
  }

  // ============================================================== pets / sprites / mounts
  gainPet(id, announce) {
    const S = this.S, pd = PETS.find((x) => x.id === id);
    if (S.pets[id]) return;
    S.pets[id] = { lv: 1 };
    this.ui.chat('system', `New pet: <span class="it" style="color:${QUALITY[pd.rarity + 1].color}">[${esc(pd.name)}]</span> joined your collection!`);
    if (announce || pd.rarity >= 2) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} obtained the pet <b>[${esc(pd.name)}]</b>!`);
    this.ui.toast(`New pet: ${pd.name}!`, 'good');
    this.ui.markMenu('pets');
    if (!S.activePet) this.setPet(id);
    this.recalc(); this.ui.refreshPanel();
  }
  setPet(id) {
    this.S.activePet = id; this.syncPet(); this.recalc(); this.ui.refreshPanel(); this.ui.refreshPlayer();
  }
  feedPet(id) {
    const S = this.S, st = S.pets[id]; if (!st) return;
    if (st.lv >= 20) { this.ui.toast('Max pet level', 'warn'); return; }
    const cost = 150 * st.lv * st.lv;
    if (S.gold < cost) { this.ui.toast('Not enough Gold', 'warn'); this.sfx.play('error'); return; }
    S.gold -= cost; st.lv++;
    this.sfx.play('level'); if (this.pet && S.activePet === id) this.fx.levelUp(this.pet);
    this.ui.toast(`${PETS.find((x) => x.id === id).name} grew to Lv ${st.lv}!`, 'good');
    this.recalc(); this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshPlayer();
  }
  syncPet() {
    const S = this.S;
    if (this.pet) { this.scene.remove(this.pet.model); this.ents = this.ents.filter((e) => e !== this.pet); this.pet.np?.remove(); this.pet = null; }
    if (!S.activePet) return;
    const pd = PETS.find((x) => x.id === S.activePet);
    const inner = buildPet(pd.model);
    const e = this.makeEnt('pet', inner, { name: pd.name, radius: 0.5, shadowR: 0.45 });
    const pp = this.player.pos;
    e.pos.set(pp.x - 1.5, pp.y, pp.z - 1); e.data = pd; e.speed = 8; e.attackCD = 1;
    this.nameplate(e, `<div class="n" style="color:#ffb8e8;font-size:11px">${esc(pd.name)}</div>`, 'pet');
    this.pet = e;
    this.fx.spawnPuff(e.pos, 0xffb8e8);
  }
  setSprite(id) { this.S.activeSprite = id; this.syncSprite(); this.recalc(); this.ui.refreshPanel(); }
  syncSprite() {
    if (this.sprite) { this.scene.remove(this.sprite); this.sprite = null; }
    const id = this.S.activeSprite; if (!id) return;
    const sd = SPRITES.find((x) => x.id === id);
    this.sprite = buildSprite(sd.color); this.sprite.userData.color = sd.color; this.sprite.userData.def = sd;
    this.scene.add(this.sprite);
    this.spriteRegenT = 4;
  }
  gainMount(id, announce) {
    const S = this.S, md = MOUNTS.find((x) => x.id === id);
    if (S.mounts.includes(id)) return;
    S.mounts.push(id);
    this.ui.chat('system', `New mount: <span class="it" style="color:#ff9a2e">[${esc(md.name)}]</span>! Press R to ride.`);
    if (announce) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} tamed the mount <b>[${esc(md.name)}]</b>!`);
    this.ui.toast(`New mount: ${md.name}!`, 'good');
    this.ui.markMenu('mounts');
    if (!S.activeMount) S.activeMount = id;
    this.recalc(); this.ui.refreshPanel();
  }
  setMount(id) {
    const was = this.mounted;
    if (was) this.dismount(true);
    this.S.activeMount = id;
    if (was) this.mount(true);
    this.ui.refreshPanel(); this.ui.refreshMountBtn();
  }
  toggleMount() { if (this.mounted) this.dismount(); else this.mount(); }
  mount(instant = false) {
    const S = this.S, p = this.player;
    if (!S.activeMount) { this.ui.toast('You have no mount yet', 'warn'); return; }
    if (p.dead || this.mounted || this.casting) return;
    const go = () => {
      const md = MOUNTS.find((x) => x.id === S.activeMount);
      const mm = buildMount(md.model);
      p.model.remove(p.humanoid); mm.userData.parts.seat.add(p.humanoid); p.humanoid.position.set(0, -0.55, 0); p.humanoid.rotation.set(0, 0, 0);
      p.model.add(mm); p.inner = mm; this.mountModel = mm; this.mounted = true; S.wasMounted = true;
      this.fx.spawnPuff(p.pos, 0xffffff); this.sfx.play('mount');
      p.height = 3.2; this.ui.refreshMountBtn();
    };
    if (instant) go();
    else this.castBar(`Summoning ${MOUNTS.find((x) => x.id === S.activeMount).name}`, 1.0, go);
  }
  dismount(quiet = false) {
    const p = this.player; if (!this.mounted) return;
    const mm = this.mountModel;
    mm.userData.parts.seat.remove(p.humanoid); p.model.remove(mm); p.model.add(p.humanoid); p.humanoid.position.set(0, 0, 0);
    p.inner = p.humanoid; this.mounted = false; this.mountModel = null; this.S.wasMounted = false; p.height = 2.1;
    if (!quiet) this.fx.spawnPuff(p.pos, 0xffffff);
    this.ui.refreshMountBtn();
  }
  castBar(label, dur, done) {
    if (this.casting) return;
    this.player.path = [];
    this.casting = { t: 0, dur, done, x: this.player.pos.x, z: this.player.pos.z };
    this.ui.cast(label, dur);
  }

  toggleAuto(force) {
    this.auto = force !== undefined ? force : !this.auto;
    this.ui.setAutoBattle(this.auto);
    if (this.auto) { this.autoAnchor = this.player.pos.clone(); this.engage = true; this.ui.toast('Auto Battle ON', 'good'); }
    else { this.autoPref = null; this.ui.toast('Auto Battle OFF'); }
  }

  // ============================================================== quests
  quest() { const q = this.S.quest; return q && q.id ? { def: QUESTS.find((x) => x.id === q.id), ...q } : null; }
  npcById(id) { return this.npcs.find((n) => n.id === id); }
  npcName(id) { return NPCS.find((n) => n.id === id)?.name || id; }

  talkTo(n) {
    const p = this.player;
    if (flat(p.pos, n.pos) > 4.5) { this.pendingTalk = n; this.pathTo(n.pos.x, n.pos.z, flat(p.pos, n.pos) > 12); return; }
    this.pendingTalk = null; p.path = []; this.autoPathing = false; this.ui.setAutoPath(false);
    n.yaw = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
    this.sfx.play('open');
    this.openDialog(n);
  }

  openDialog(n) {
    const q = this.quest(), S = this.S, d = n.data;
    const btns = [];
    let text = d.greet, qname = null, rewards = null;
    if (q && q.def) {
      if (q.status === 'available' && q.def.giver === n.id) {
        qname = q.def.name; text = q.def.text; rewards = q.def.type === 'end' ? null : q.def.rewards;
        btns.push({ label: q.def.type === 'end' ? 'Farewell' : 'Accept', fn: () => this.acceptQuest() });
      } else if (q.status === 'complete' && q.def.turnin === n.id) {
        qname = q.def.name; text = q.def.done; rewards = q.def.rewards;
        btns.push({ label: 'Complete', cls: 'green', fn: () => this.completeQuest(n) });
      } else if (q.status === 'active' && q.def.turnin === n.id) {
        qname = q.def.name; text = `Still working on it? ${this.questObjective()}.`;
      }
    }
    const B = S.bounty;
    if (d.service === 'bounty' && this.bountyUnlocked()) {
      if (B && B.status === 'complete') btns.push({ label: 'Turn in Bounty', cls: 'green', fn: () => this.completeBounty() });
      else if (!B) btns.push({ label: 'Take a Bounty', cls: 'blue', fn: () => this.takeBounty() });
    }
    const svc = { pets: ['Pet Collection', 'pets'], mounts: ['Mount Stable', 'mounts'], shop: ['Open Shop', 'mall'], enhance: ['Enhance Gear', 'char'] }[d.service];
    if (svc) btns.push({ label: svc[0], cls: 'blue', fn: () => this.ui.togglePanel(svc[1], true) });
    if (d.service === 'teleport') TELEPORTS.forEach((t, i) => btns.push({ label: `${t.name}`, cls: 'blue small', fn: () => this.teleport(i) }));
    btns.push({ label: 'Goodbye', cls: 'gray' });
    this.ui.dialog({ npc: n, qname, text, rewards, buttons: btns });
  }

  questObjective(q = this.quest()) {
    if (!q || !q.def) return '';
    const d = q.def;
    if (q.status === 'available') return `Talk to ${this.npcName(d.giver)}`;
    if (q.status === 'complete') return `${d.type === 'talk' ? 'Talk to' : 'Return to'} ${this.npcName(d.turnin)}`;
    if (d.type === 'kill') return `Defeat ${MONSTERS[d.target].name} (${q.prog}/${d.count})`;
    if (d.type === 'collect') return `Collect ${ITEMS[d.item].name} (${Math.min(d.count, this.countItem(d.item))}/${d.count})`;
    return `Talk to ${this.npcName(d.turnin)}`;
  }

  acceptQuest() {
    const q = this.quest(), S = this.S; if (!q) return;
    const d = q.def;
    this.sfx.play('quest');
    if (d.type === 'end') { S.quest = { id: null, status: 'done', prog: 0 }; this.ui.banner('Chapter I Complete', 'Thank you for playing!'); this.ui.refreshQuest(); this.save(); return; }
    if (d.type === 'talk') {
      S.quest.status = 'complete';
      if (d.turnin === d.giver) { this.completeQuest(this.npcById(d.giver)); return; }
    } else {
      S.quest.status = 'active'; S.quest.prog = 0;
      if (d.type === 'collect') this.questCollectCheck();
    }
    this.ui.toast(`Quest accepted: ${d.name}`, 'good');
    this.ui.chat('system', `Quest accepted: <b>${esc(d.name)}</b>`);
    this.ui.closeDialog();
    this.ui.refreshQuest(); this.save();
  }

  completeQuest(n) {
    const q = this.quest(), S = this.S; if (!q || q.status !== 'complete') return;
    const d = q.def, r = d.rewards || {};
    if (d.type === 'collect') this.removeItem(d.item, d.count);
    this.sfx.play('quest');
    this.ui.banner('Quest Complete', d.name);
    this.ui.chat('system', `Quest complete: <b>${esc(d.name)}</b>`);
    if (r.gold) { S.gold += r.gold; }
    if (r.diamonds) { S.diamonds += r.diamonds; }
    if (r.items) for (const [id, qty] of r.items) this.addItem(id, qty);
    if (r.equip) { const eq = this.genEquip(r.equip, Math.max(S.level, 2), d.id === 'q10' ? 4 : 2); if (this.addEquip(eq)) this.lootMsg(eq.name, QUALITY[eq.quality].color); }
    if (r.pet) this.gainPet(r.pet, d.id === 'q10');
    if (r.mount) { this.gainMount(r.mount); }
    if (r.sprite) { const sid = CLASS_SPRITE[S.cls]; if (!S.sprites.includes(sid)) S.sprites.push(sid); this.setSprite(sid); this.ui.chat('system', `The Sprite <b>${SPRITES.find((x) => x.id === sid).name}</b> now flies at your side.`); }
    if (r.wings) { S.wings = true; this.rebuildPlayerModel(); if (this.mounted) { this.dismount(true); this.mount(true); } S.title = Math.max(S.title, 5); this.refreshPlayerPlate(); this.fx.levelUp(this.player); }
    if (d.id === 'q2') S.title = Math.max(S.title, 1);
    if (d.id === 'q4') { S.title = Math.max(S.title, 2); this.refreshPlayerPlate(); }
    if (r.exp) this.gainExp(r.exp);
    this.ui.refreshWallet();
    S.quest = d.next ? { id: d.next, status: 'available', prog: 0 } : { id: null, status: 'done', prog: 0 };
    this.recalc(); this.ui.refreshQuest(); this.ui.refreshPanel(); this.save();
    const nq = this.quest();
    if (nq && nq.def && nq.def.giver === n?.id) setTimeout(() => this.openDialog(n), 350);
    else this.ui.closeDialog();
  }

  questKill(m) {
    const q = this.quest(), S = this.S;
    if (q && q.def && q.status === 'active') {
      const d = q.def;
      if (d.type === 'kill' && d.target === m.type) {
        S.quest.prog++;
        this.ui.toast(`${MONSTERS[d.target].name} ${Math.min(S.quest.prog, d.count)}/${d.count}`);
        if (S.quest.prog >= d.count) this.questReady(d);
      }
      if (d.type === 'collect' && d.target === m.type && Math.random() < d.chance && this.countItem(d.item) < d.count) {
        this.addItem(d.item, 1); this.lootMsg(ITEMS[d.item].name, QUALITY[1].color);
      }
    }
    const B = S.bounty;
    if (B && B.status === 'active' && B.target === m.type) {
      B.prog++;
      if (B.prog >= B.count) { B.status = 'complete'; this.ui.toast('Bounty complete! Report to Captain Elena', 'good'); this.sfx.play('quest'); }
    }
    this.ui.refreshQuest();
  }
  questCollectCheck() {
    const q = this.quest();
    if (q && q.def && q.status === 'active' && q.def.type === 'collect' && this.countItem(q.def.item) >= q.def.count) this.questReady(q.def);
    this.ui.refreshQuest();
  }
  questReady(d) {
    this.S.quest.status = 'complete';
    this.sfx.play('quest');
    this.ui.toast(`Quest objective complete! Return to ${this.npcName(d.turnin)}`, 'good');
    this.ui.chat('system', `<b>${esc(d.name)}</b>: objective complete. Return to ${esc(this.npcName(d.turnin))}.`);
    if (this.auto && this.autoPref === d.target) { this.toggleAuto(false); this.autoQuest('main'); }
  }
  bountyUnlocked() { const i = QUESTS.findIndex((x) => x.id === this.S.quest.id); return i === -1 || i >= 5; }
  takeBounty() {
    const S = this.S;
    const options = BOUNTY_TARGETS.filter((t) => MONSTERS[t].lvl[0] <= S.level + 2);
    const target = options.length ? options[Math.max(0, options.length - 1 - ((Math.random() * 2) | 0))] : 'jelly';
    const count = MONSTERS[target].elite ? 4 : 10;
    S.bounty = { target, count, prog: 0, status: 'active' };
    this.sfx.play('quest'); this.ui.toast(`Bounty: defeat ${count} ${MONSTERS[target].name}`, 'good');
    this.ui.refreshQuest(); this.ui.closeDialog(); this.save();
  }
  completeBounty() {
    const S = this.S, B = S.bounty; if (!B || B.status !== 'complete') return;
    const exp = Math.round(needExp(S.level) * 0.3), gold = 150 + S.level * 40;
    S.gold += gold; S.diamonds += 10; S.bounty = null;
    this.sfx.play('quest'); this.ui.banner('Bounty Complete', `+${fmt(exp)} EXP · +${fmt(gold)} Gold · +10 Diamonds`);
    this.gainExp(exp); this.ui.refreshWallet(); this.ui.refreshQuest(); this.ui.closeDialog(); this.save();
  }

  autoQuest(which = 'main') {
    const p = this.player; if (p.dead) return;
    let goal = null, npc = null, type = null;
    if (which === 'bounty') {
      const B = this.S.bounty; if (!B) return;
      if (B.status === 'complete') npc = this.npcById('elena');
      else type = B.target;
    } else {
      const q = this.quest(); if (!q || !q.def) return;
      if (q.status === 'available') npc = this.npcById(q.def.giver);
      else if (q.status === 'complete') npc = this.npcById(q.def.turnin);
      else if (q.def.type === 'kill' || q.def.type === 'collect') type = q.def.target;
      else npc = this.npcById(q.def.turnin);
    }
    if (npc) { this.talkTo(npc); return; }
    if (type) {
      const sp = SPAWNS.find((s) => s.type === type);
      const near = this.nearestEnemy(30, type);
      if (near) { this.autoPref = type; this.auto = false; this.toggleAuto(true); this.autoAnchor = new THREE.Vector3(sp.x, 0, sp.z); return; }
      goal = { x: sp.x, z: sp.z };
      this.pathTo(goal.x, goal.z, true);
      this.arriveAuto = { type, x: sp.x, z: sp.z };
    }
  }

  teleport(i) {
    const t = TELEPORTS[i];
    this.ui.closeDialog();
    this.castBar(`Teleporting to ${t.name}`, 1.4, () => {
      const p = this.player;
      this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 0.8);
      const [x, z] = this.world.nearestFree(t.x, t.z);
      p.pos.set(x, this.world.heightAt(x, z), z); p.path = [];
      this.cam.target.copy(p.pos);
      if (this.pet) this.pet.pos.set(x - 1.5, p.pos.y, z - 1);
      this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 1.0); this.fx.circle(p.pos, '#7ad8ff', 2.5, 1.2);
      this.sfx.play('cast');
    });
  }

  // ============================================================== activities
  claimSignin() {
    const S = this.S;
    if (S.signin.last === today()) { this.ui.toast('Already claimed today — come back tomorrow!', 'warn'); return; }
    const r = SIGNIN[S.signin.count % 7];
    S.signin.count++; S.signin.last = today();
    this.grant(r);
    this.ui.toast(`Day ${r.day} reward: ${r.label}`, 'good'); this.sfx.play('quest');
    this.ui.refreshPanel(); this.ui.refreshActs(); this.save();
  }
  grant(r) {
    const S = this.S;
    if (r.gold) S.gold += r.gold;
    if (r.diamonds) S.diamonds += r.diamonds;
    if (r.items) for (const [id, q] of r.items) this.addItem(id, q);
    if (r.pet) { if (S.pets[r.pet]) { S.gold += 1000; this.ui.toast('Duplicate pet converted to 1,000 Gold', 'good'); } else this.gainPet(r.pet); }
    if (r.mount) { if (S.mounts.includes(r.mount)) S.gold += 2000; else this.gainMount(r.mount); }
    this.ui.refreshWallet();
  }
  claimGift() {
    const S = this.S, g = ONLINE_GIFTS[S.gift.idx]; if (!g) return;
    if (S.gift.t < g.secs) { this.ui.toast('Gift is not ready yet', 'warn'); return; }
    this.grant(g); S.gift.idx++; S.gift.t = 0;
    this.ui.toast(`Online gift: ${g.label}`, 'good'); this.sfx.play('quest'); this.ui.refreshActs(); this.save();
  }
  buyMall(i) {
    const S = this.S, m = MALL[i];
    const c = m.cost;
    if (m.kind === 'pet' && S.pets[m.id]) { this.ui.toast('You already own this pet', 'warn'); return; }
    if (m.kind === 'mount' && S.mounts.includes(m.id)) { this.ui.toast('You already own this mount', 'warn'); return; }
    if ((c.gold || 0) > S.gold || (c.diamonds || 0) > S.diamonds) { this.ui.toast(c.gold ? 'Not enough Gold' : 'Not enough Diamonds', 'warn'); this.sfx.play('error'); return; }
    S.gold -= c.gold || 0; S.diamonds -= c.diamonds || 0;
    if (m.kind === 'item') { this.addItem(m.id, m.qty); this.ui.toast(`Bought ${ITEMS[m.id].name} x${m.qty}`, 'good'); }
    if (m.kind === 'pet') this.gainPet(m.id, true);
    if (m.kind === 'mount') this.gainMount(m.id, true);
    this.sfx.play('coin'); this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
  }
  upgradeSkill(id) {
    const S = this.S, lv = this.skillLevel(id), cost = 120 * lv * lv;
    const sk = this.skillList().find((s) => s.id === id);
    if (S.level < sk.lvl) return;
    const cap = Math.min(10, Math.floor(S.level / 2) + 1);
    if (lv >= cap) { this.ui.toast(`Reach Lv ${lv * 2} to upgrade further`, 'warn'); return; }
    if (S.gold < cost) { this.ui.toast('Not enough Gold', 'warn'); this.sfx.play('error'); return; }
    S.gold -= cost; S.skillLv[id] = lv + 1;
    this.sfx.play('level'); this.ui.toast(`${sk.name} upgraded to Lv ${lv + 1}`, 'good');
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.recalc();
  }
  setTalent(i) {
    if (this.S.talent === i) return;
    this.S.talent = i; this.recalc(); this.fx.buff(this.player, CLASSES[this.S.cls].elemColor);
    this.ui.toast(`Talent switched to ${CLASSES[this.S.cls].talents[i].name}`, 'good'); this.ui.refreshPanel();
  }
  setSetting(k, v) {
    this.S.settings[k] = v;
    if (k === 'others') for (const b of this.bots) { b.model.visible = v; b.petModel.visible = v; if (b.np) b.np.style.display = v ? '' : 'none'; }
    if (k === 'shadows') { this.renderer.shadowMap.enabled = v; this.sun.castShadow = v; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    if (k === 'sound') this.sfx.on = v;
    this.save();
  }
  sendChat(text) {
    text = text.trim().slice(0, 80); if (!text) return;
    this.ui.chat('world', esc(text), this.S.name);
    const low = text.toLowerCase();
    let reply = null;
    if (/\b(hi|hello|hey|yo)\b/.test(low)) reply = pick(['hey there!', 'hi hi~', 'welcome to Carlyle!', 'o/']);
    else if (/\b(lf|party|group)\b/.test(low)) reply = pick(['I can join in a bit!', 'what level are you?', 'inv me']);
    else if (/\b(gz|grats|congrats)\b/.test(low)) reply = pick(['ty!!', 'thanks :D']);
    else if (/\?$/.test(low)) reply = pick(['try asking the Elder in the plaza', 'check the quest tracker on the right', 'no idea tbh', 'Sylphie knows about the spirits']);
    if (reply) { const b = pick(this.bots); setTimeout(() => this.ui.chat('world', esc(reply), b.name), 1200 + Math.random() * 2000); }
  }

  // ============================================================== portraits
  headIcon() {
    const key = 'player-head';
    return this.portraits.snap(key, () => buildHumanoid(this.playerLook()), { w: 128, h: 128, look: [0, 1.5, 0], from: [0.45, 1.62, 2.3], fov: 32 });
  }
  fullIcon() {
    return this.portraits.snap('player-full', () => { const m = buildHumanoid(this.playerLook()); m.rotation.y = 0.35; return m; }, { w: 190, h: 250, look: [0, 1.08, 0], from: [0, 1.25, 5.4], fov: 30 });
  }
  npcIcon(id, look) {
    return this.portraits.snap('npc-' + id, () => buildHumanoid(npcLook(look)), { w: 180, h: 220, look: [0, 1.25, 0], from: [0.5, 1.4, 3.7], fov: 32 });
  }
  monsterIcon(type) {
    const d = MONSTERS[type], h = d.height;
    return this.portraits.snap('mon-' + type, () => buildMonster(d.model, 0), { w: 96, h: 96, look: [0, h * 0.62, 0], from: [h * 0.35, h * 0.72, h * 1.25], fov: 34 });
  }
  petIcon(id) {
    const pd = PETS.find((x) => x.id === id);
    return this.portraits.snap('pet-' + id, () => buildPet(pd.model), { w: 112, h: 112, look: [0, 0.6, 0], from: [0.6, 0.95, 2.6], fov: 34 });
  }
  mountIcon(id) {
    const md = MOUNTS.find((x) => x.id === id);
    return this.portraits.snap('mount-' + id, () => { const m = buildMount(md.model); m.rotation.y = 0.6; return m; }, { w: 112, h: 112, look: [0, 1.1, 0], from: [1.6, 1.9, 4.6], fov: 34 });
  }
  spriteIcon(id) {
    const sd = SPRITES.find((x) => x.id === id);
    return this.portraits.snap('sprite-' + id, () => buildSprite(sd.color), { w: 96, h: 96, look: [0, 0, 0], from: [0, 0.1, 1.4], fov: 40 });
  }

  // ============================================================== timers
  after(t, fn) { this.timers.push({ t: this.time + t, fn }); }

  // ============================================================== update
  update(dt) {
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].t <= this.time) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    this.updatePlayer(dt);
    this.updatePet(dt);
    this.updateSprite(dt);
    for (const m of this.monsters) this.updateMonster(m, dt);
    for (const b of this.bots) this.updateBot(b, dt);
    for (const n of this.npcs) this.updateNPC(n, dt);
    this.animateAll(dt);
    this.updateCamera(dt);
    this.updatePlates();
    this.updateTargetRing();
    this.updateMisc(dt);
  }

  updatePlayer(dt) {
    const p = this.player, S = this.S;
    if (p.dead) return;
    p.actT = Math.max(0, p.actT - dt);
    if (p.stun > 0) { p.stun -= dt; return; }
    // buffs
    p.buffs = p.buffs.filter((b) => b.until > this.time || (b.shield && p.shield > 0 && b.until > this.time));
    if (!p.buffs.some((b) => b.shield)) p.shield = 0;
    // casting bar
    if (this.casting) {
      const c = this.casting; c.t += dt;
      if (flat(p.pos, c) > 0.5 || this.keys.w || this.keys.a || this.keys.s || this.keys.d) { this.casting = null; this.ui.cancelCast(); this.ui.toast('Interrupted', 'warn'); }
      else if (c.t >= c.dur) { this.casting = null; this.ui.cancelCast(); c.done(); }
    }
    let moving = false;
    // keyboard
    let kx = 0, kz = 0;
    if (this.keys.w || this.keys.arrowup) kz -= 1; if (this.keys.s || this.keys.arrowdown) kz += 1;
    if (this.keys.a || this.keys.arrowleft) kx -= 1; if (this.keys.d || this.keys.arrowright) kx += 1;
    const speed = this.speedOf(p);
    if ((kx || kz) && p.actT <= 0.1) {
      const y = this.cam.yaw;
      const fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      let dx = fx * -kz + rx * kx, dz = fz * -kz + rz * kx; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
      this.moveEnt(p, p.pos.x + dx * 3, p.pos.z + dz * 3, speed, dt);
      moving = true; this.pendingSkill = null; this.pendingTalk = null; this.engage = this.auto ? this.engage : false;
    }
    // pending skill: approach
    const t = p.target;
    if (!moving && this.pendingSkill != null) {
      const sk = this.skillList()[this.pendingSkill];
      if (!t || t.dead) this.pendingSkill = null;
      else {
        const d = flat(p.pos, t.pos) - t.radius;
        if (d <= (sk.range || 3)) { if (p.actT <= 0) this.castSkill(sk); }
        else { this.moveEnt(p, t.pos.x, t.pos.z, speed, dt); moving = true; }
      }
    }
    // auto battle
    if (this.auto && !moving && this.pendingSkill == null) this.autoBattle(dt);
    // engage basic attacks
    if (!moving && this.pendingSkill == null && this.engage && t && t.kind === 'monster' && !t.dead) {
      const basic = this.skillList()[0];
      const d = flat(p.pos, t.pos) - t.radius;
      if (d > basic.range) {
        if (this.world.lineClear(p.pos.x, p.pos.z, t.pos.x, t.pos.z)) { this.moveEnt(p, t.pos.x, t.pos.z, speed, dt); moving = true; }
        else if (!p.path.length) p.path = this.world.findPath(p.pos.x, p.pos.z, t.pos.x, t.pos.z);
      } else if (p.actT <= 0 && (this.cd[basic.id] || 0) <= this.time) {
        p.path = []; this.castSkill(basic);
      } else p.yawT = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
    }
    // path following
    if (!moving && p.path.length && p.actT <= 0.1) {
      const wp = p.path[0];
      const r = this.moveEnt(p, wp.x, wp.z, speed, dt);
      moving = true;
      if (r === true || flat(p.pos, wp) < 0.4) p.path.shift();
      if (r === 'blocked' && p.path.length) {
        p.blockedN = (p.blockedN || 0) + 1;
        const end = p.path[p.path.length - 1];
        p.path = p.blockedN > 3 ? [] : this.world.findPath(p.pos.x, p.pos.z, end.x, end.z);
      } else if (r !== 'blocked') p.blockedN = 0;
      if (!p.path.length) {
        this.autoPathing = false; this.ui.setAutoPath(false);
        if (this.arriveAuto) { const a = this.arriveAuto; this.arriveAuto = null; this.autoPref = a.type; this.auto = false; this.toggleAuto(true); this.autoAnchor = new THREE.Vector3(a.x, 0, a.z); }
      }
    }
    if (this.pendingTalk && flat(p.pos, this.pendingTalk.pos) < 4.5) { const n = this.pendingTalk; this.talkTo(n); }
    // jump physics
    if (p.vy !== 0 || p.jumpY > 0) { p.vy -= 24 * dt; p.jumpY = Math.max(0, p.jumpY + p.vy * dt); if (p.jumpY === 0) p.vy = 0; }
    p.pos.y = this.world.heightAt(p.pos.x, p.pos.z);
    p.inner.position.y = p.jumpY;
    p.moving = moving;
    if (p.actT <= 0) p.state = moving ? 'run' : 'idle';
    // regen
    const ooc = this.time - this.lastCombat > 5;
    const zoneSafe = this.zone && this.zone.safe;
    const rate = ooc ? (zoneSafe ? 0.06 : 0.025) : 0;
    if (rate) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * rate * dt); }
    p.mp = Math.min(p.maxMp, p.mp + p.maxMp * (ooc ? 0.03 : 0.012) * dt);
    if (S.settings.autoPotion && p.hp < p.maxHp * 0.35 && this.countItem('hp_potion') && this.potionCD <= this.time) this.usePotion('hp_potion');
    if (S.settings.autoPotion && p.mp < p.maxMp * 0.15 && this.countItem('mp_potion') && this.potionCD <= this.time) this.usePotion('mp_potion');
  }

  autoBattle() {
    const p = this.player;
    let t = p.target;
    if (!t || t.dead || t.kind !== 'monster') {
      const anchor = this.autoAnchor || p.pos;
      t = this.nearestEnemy(14, this.autoPref, p.pos) || this.nearestEnemy(40, this.autoPref, anchor) || (this.autoPref ? null : this.nearestEnemy(40, null, anchor));
      if (t) { this.setTarget(t); this.engage = true; }
      else if (this.autoAnchor && flat(p.pos, this.autoAnchor) > 6 && !p.path.length) p.path = this.world.findPath(p.pos.x, p.pos.z, this.autoAnchor.x, this.autoAnchor.z);
      return;
    }
    this.engage = true;
    if (p.actT > 0) return;
    const list = this.skillList();
    // heal / buffs first
    for (let i = list.length - 1; i >= 1; i--) {
      const sk = list[i];
      if (this.S.level < sk.lvl || (this.cd[sk.id] || 0) > this.time || p.mp < sk.mp) continue;
      if (sk.kind === 'heal' && p.hp > p.maxHp * 0.6) continue;
      if (sk.kind === 'buff' && p.buffs.some((b) => b.id === sk.id)) continue;
      if (sk.kind === 'zone' && p.hp > p.maxHp * 0.8 && flat(p.pos, t.pos) > sk.radius) continue;
      if (sk.kind === 'aoeSelf' && flat(p.pos, t.pos) > sk.radius) continue;
      const d = flat(p.pos, t.pos) - t.radius;
      if (['target', 'dash', 'proj', 'aoeTarget'].includes(sk.kind) && d > (sk.range || 3)) continue;
      this.useSkill(i);
      return;
    }
  }

  moveEnt(e, tx, tz, speed, dt) {
    const dx = tx - e.pos.x, dz = tz - e.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const step = Math.min(d, speed * dt);
    const nx = e.pos.x + (dx / d) * step, nz = e.pos.z + (dz / d) * step;
    const W = this.world;
    const inside = W.isBlocked(e.pos.x, e.pos.z);
    e.yawT = Math.atan2(dx, dz);
    if (inside || !W.isBlocked(nx, nz)) { e.pos.x = nx; e.pos.z = nz; }
    else if (!W.isBlocked(nx, e.pos.z)) e.pos.x = nx;
    else if (!W.isBlocked(e.pos.x, nz)) e.pos.z = nz;
    else return 'blocked';
    return d <= step;
  }

  updatePet(dt) {
    const e = this.pet; if (!e) return;
    const p = this.player;
    e.attackCD -= dt;
    const pd = e.data, lv = this.S.pets[pd.id]?.lv || 1;
    e.atk = pd.atk * (1 + 0.15 * (lv - 1)) + p.atk * 0.15; e.crit = 5; e.critDmg = 0.5;
    const t = p.target && p.target.kind === 'monster' && !p.target.dead && this.time - this.lastCombat < 4 ? p.target : null;
    let moving = false;
    if (flat(e.pos, p.pos) > 30) { e.pos.set(p.pos.x - 1, p.pos.y, p.pos.z - 1); }
    if (t && flat(t.pos, p.pos) < 25) {
      const d = flat(e.pos, t.pos) - t.radius;
      if (d > 1.6) { this.moveEnt(e, t.pos.x, t.pos.z, Math.max(8, this.speedOf(p) * 1.1), dt); moving = true; }
      else {
        e.yawT = Math.atan2(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
        if (e.attackCD <= 0) {
          e.attackCD = 1.5; e.state = 'attack'; e.actT = e.actDur = 0.4;
          this.after(0.18, () => { if (!t.dead) { this.damage(e, t, 1); this.fx.emit(t.pos.clone().setY(t.pos.y + 1), { count: 10, color: 0xff9ad8, speed: 3, life: 0.4, size: 0.5 }); } });
        }
      }
    } else {
      const off = new THREE.Vector3(-1.4, 0, -1.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
      const gx = p.pos.x + off.x, gz = p.pos.z + off.z;
      if (Math.hypot(gx - e.pos.x, gz - e.pos.z) > 0.6) { this.moveEnt(e, gx, gz, Math.max(5, this.speedOf(p) * (flat(e.pos, p.pos) > 5 ? 1.25 : 1.0)), dt); moving = Math.hypot(gx - e.pos.x, gz - e.pos.z) > 0.3; }
      else e.yawT = p.yaw;
    }
    e.actT = Math.max(0, e.actT - dt);
    if (e.actT <= 0) e.state = 'idle';
    e.moving = moving;
    e.pos.y = this.world.heightAt(e.pos.x, e.pos.z);
  }

  updateSprite(dt) {
    const s = this.sprite; if (!s) return;
    const p = this.player, t = this.time;
    const tgt = new THREE.Vector3(p.pos.x + Math.sin(t * 1.3) * 1.1, p.pos.y + p.height + 0.3 + Math.sin(t * 2.6) * 0.2, p.pos.z + Math.cos(t * 1.3) * 1.1);
    s.position.lerp(tgt, 1 - Math.exp(-dt * 6));
    s.userData.wings.children.forEach((w, i) => { w.rotation.y = (i % 2 ? -1 : 1) * (0.4 + Math.sin(t * 22) * 0.5); });
    if (Math.random() < dt * 14) this.fx.emit(s.position, { count: 1, color: s.userData.color, speed: 0.4, life: 0.8, size: 0.35, gravity: -1 });
    const sd = s.userData.def;
    if (sd.regen) {
      this.spriteRegenT -= dt;
      if (this.spriteRegenT <= 0) { this.spriteRegenT = 4; if (p.hp < p.maxHp && !p.dead) { this.heal(p, p.maxHp * sd.regen); } }
    }
  }

  updateMonster(m, dt) {
    const d = m.def0, W = this.world;
    if (m.dead) {
      m.deadT += dt; m.respawnT -= dt;
      if (m.deadT > 1.4) { m.inner.position.y = -Math.min(2, (m.deadT - 1.4) * 2); if (m.deadT > 2.4) m.model.visible = false; }
      if (m.respawnT <= 0) this.respawn(m);
      return;
    }
    m.actT = Math.max(0, m.actT - dt); m.attackCD -= dt; m.hitT = Math.max(0, (m.hitT || 0) - dt);
    if (m.stun > 0) { m.stun -= dt; m.moving = false; if (Math.random() < dt * 8) this.fx.emit(m.pos.clone().setY(m.pos.y + m.height + 0.2), { count: 1, color: 0xffe07a, speed: 1, life: 0.5, size: 0.4 }); return; }
    const home = m.home;
    let moving = false;
    if (m.target && (m.target.dead || flat(m.pos, home) > (d.boss ? 30 : 38) || (m.target === this.player && this.player.dead))) { m.target = null; m.returning = true; }
    if (m.returning) {
      const r = this.moveEnt(m, home.x, home.z, m.speed * 1.8, dt); moving = true;
      m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt);
      if (r === true || flat(m.pos, home) < 1 || r === 'blocked') { m.returning = false; m.hp = m.maxHp; }
    } else {
      if (!m.target && d.aggressive && !this.player.dead) {
        const ar = d.boss ? 13 : 9;
        if (flat(m.pos, this.player.pos) < ar && !(this.zone && this.zone.safe)) m.target = this.player;
        else for (const b of this.bots) if (b.role !== 'town' && flat(m.pos, b.pos) < ar * 0.7) { m.target = b; break; }
      }
      const t = m.target;
      if (t) {
        const dd = flat(m.pos, t.pos) - t.radius;
        if (dd > d.range) { if (m.actT <= 0) { const r = this.moveEnt(m, t.pos.x, t.pos.z, m.speed * 1.25, dt); moving = r !== 'blocked'; } }
        else {
          m.yawT = Math.atan2(t.pos.x - m.pos.x, t.pos.z - m.pos.z);
          if (m.attackCD <= 0 && m.actT <= 0) {
            m.attackCD = d.boss ? 2.1 : d.elite ? 1.8 : 1.6; m.state = 'attack'; m.actT = m.actDur = 0.55;
            this.after(0.3, () => {
              if (m.dead || t.dead || m.stun > 0) return;
              if (flat(m.pos, t.pos) - t.radius <= d.range + 1) {
                this.damage(m, t, 1);
                this.fx.emit(t.pos.clone().setY(t.pos.y + 1), { count: 8, color: d.boss ? 0xc07aff : 0xff8a6a, speed: 3, life: 0.3, size: 0.45 });
              }
            });
          }
          if (d.boss) this.bossSkills(m, t, dt);
        }
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = rnd(3, 8);
          const a = Math.random() * Math.PI * 2, r = Math.random() * m.spawn.r * 0.8;
          m.wander = { x: m.spawn.x + Math.cos(a) * r, z: m.spawn.z + Math.sin(a) * r };
          if (Math.random() < 0.35) m.wander = null;
        }
        if (m.wander) {
          const r = this.moveEnt(m, m.wander.x, m.wander.z, m.speed * 0.45, dt); moving = true;
          if (r === true || r === 'blocked') m.wander = null;
        }
      }
    }
    if (m.actT <= 0) m.state = 'idle';
    m.moving = moving;
    m.pos.y = W.heightAt(m.pos.x, m.pos.z);
  }

  bossSkills(m, t, dt) {
    m.skillT -= dt;
    if (m.skillT > 0) return;
    const enraged = m.hp < m.maxHp * 0.5;
    m.skillT = enraged ? 6 : 9;
    if (Math.random() < 0.5) {
      const c = m.pos.clone().add(new THREE.Vector3(Math.sin(m.yaw) * 3, 0, Math.cos(m.yaw) * 3)); c.y = this.world.heightAt(c.x, c.z) + 0.55;
      this.ui.toast('Yggr raises his arms — get out of the red circle!', 'warn');
      m.state = 'attack'; m.actT = m.actDur = 1.6;
      this.fx.telegraph(c, 7, 1.6, () => {
        if (m.dead) return;
        this.fx.quake(c, 7); this.sfx.play('boom');
        for (const e of [this.player, ...this.bots]) if (!e.dead && flat(e.pos, c) < 7) this.damage(m, e, 2.4, { canCrit: false });
      });
    } else {
      this.ui.toast('Thorned roots burst from the ground!', 'warn');
      for (let i = 0; i < (enraged ? 4 : 3); i++) {
        const c = t.pos.clone().add(new THREE.Vector3(rnd(-4, 4), 0, rnd(-4, 4))); c.y = this.world.heightAt(c.x, c.z) + 0.55;
        this.fx.telegraph(c, 3.2, 1.4 + i * 0.15, () => {
          if (m.dead) return;
          this.fx.emit(c.clone().setY(c.y + 0.5), { count: 30, colors: [0x7a3aa8, 0x5ac84a, 0x3a2a1a], speed: 6, life: 0.6, size: 0.8, up: 6, gravity: -14 });
          this.fx.pillar(c, 0x8a4ac8, 1.6, 4, 0.5);
          for (const e of [this.player, ...this.bots]) if (!e.dead && flat(e.pos, c) < 3.2) this.damage(m, e, 1.6, { canCrit: false });
        });
      }
    }
  }

  updateBot(b, dt) {
    b.attackCD -= dt; b.actT = Math.max(0, b.actT - dt);
    let moving = false;
    if (b.role === 'town') {
      if (b.goal) {
        const r = this.moveEnt(b, b.goal.x, b.goal.z, this.speedOf(b) * 0.85, dt); moving = true;
        if (r === true || r === 'blocked') { b.goal = null; b.waitT = rnd(2, 8); }
      } else {
        b.waitT -= dt;
        if (b.waitT <= 0) {
          const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 38;
          let [x, z] = this.world.nearestFree(Math.cos(a) * r, Math.sin(a) * r);
          b.goal = { x, z };
          if (!this.world.lineClear(b.pos.x, b.pos.z, x, z)) { const path = this.world.findPath(b.pos.x, b.pos.z, x, z); b.goal = path[0]; }
        }
        if (Math.random() < dt * 0.05 && b.jumpY === 0) b.vy = 8;
      }
    } else {
      let t = b.target;
      if (!t || t.dead) {
        b.target = t = null;
        let bd = 30;
        for (const m of this.monsters) { if (m.dead || m.type !== b.role) continue; const d = flat(m.pos, b.pos); if (d < bd && (!m.target || m.target === b)) { bd = d; t = m; } }
        b.target = t;
      }
      if (t) {
        const d = flat(b.pos, t.pos) - t.radius;
        if (d > b.range) { this.moveEnt(b, t.pos.x, t.pos.z, this.speedOf(b), dt); moving = true; }
        else {
          b.yawT = Math.atan2(t.pos.x - b.pos.x, t.pos.z - b.pos.z);
          if (b.attackCD <= 0) {
            b.attackCD = rnd(1.1, 1.6); b.state = CLASSES[b.cls].ranged ? 'cast' : 'attack'; b.actT = b.actDur = 0.45;
            const near = flat(b.pos, this.player.pos) < 35;
            this.after(0.2, () => {
              if (t.dead) return;
              if (near) {
                if (CLASSES[b.cls].ranged) this.fx.projectile(b.pos.clone().setY(b.pos.y + 1.3), t, { color: b.cls === 'mage' ? 0xff7a2a : 0x4ab8ff, size: 0.3 });
                else this.fx.slash(b.pos, b.yaw, 0xffffff, 1.4, 0.3, 0.25);
              }
              this.damage(b, t, Math.random() < 0.3 ? 1.8 : 1);
            });
          }
        }
      } else if (b.spawnRef) {
        if (!b.goal || flat(b.pos, b.goal) < 1) { const a = Math.random() * Math.PI * 2; b.goal = { x: b.spawnRef.x + Math.cos(a) * 10, z: b.spawnRef.z + Math.sin(a) * 10 }; }
        const r = this.moveEnt(b, b.goal.x, b.goal.z, this.speedOf(b) * 0.6, dt); moving = true; if (r === 'blocked') b.goal = null;
      }
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.01 * dt);
    }
    if (b.vy !== 0 || b.jumpY > 0) { b.vy -= 24 * dt; b.jumpY = Math.max(0, b.jumpY + b.vy * dt); if (b.jumpY === 0) b.vy = 0; }
    if (b.actT <= 0) b.state = moving ? 'run' : 'idle';
    b.moving = moving;
    b.pos.y = this.world.heightAt(b.pos.x, b.pos.z);
    b.inner.position.y = b.jumpY;
    // bot pet follows
    const off = new THREE.Vector3(-1.3, 0, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw);
    const pm = b.petModel;
    pm.position.lerp(new THREE.Vector3(b.pos.x + off.x, this.world.heightAt(b.pos.x + off.x, b.pos.z + off.z), b.pos.z + off.z), 1 - Math.exp(-dt * 4));
    pm.rotation.y = angLerp(pm.rotation.y, b.yaw, 1 - Math.exp(-dt * 6));
  }

  updateNPC(n, dt) {
    const p = this.player, d = flat(n.pos, p.pos);
    if (d < 7) n.yawT = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z); else n.yawT = n.homeYaw;
    if (n.float) n.pos.y = n.baseY + Math.sin(this.time * 2) * 0.15;
    // quest marker
    const q = this.quest(); let mark = null;
    if (q && q.def) {
      if (q.status === 'available' && q.def.giver === n.id) mark = '!';
      else if (q.status === 'complete' && q.def.turnin === n.id) mark = '?';
      else if (q.status === 'active' && q.def.turnin === n.id) mark = '…';
    }
    if (n.id === 'elena' && this.S.bounty && this.S.bounty.status === 'complete') mark = '?';
    if (mark !== n.markChar) {
      n.markChar = mark;
      if (mark) { n.marker.material.map = textTexture(mark, mark === '…' ? { color: '#c8d0e0', stroke: '#2a2a3a' } : {}); n.marker.material.needsUpdate = true; }
    }
    n.marker.visible = !!mark && d < 120;
    n.marker.position.set(n.pos.x, n.pos.y + n.height * (n.data.look === 'brom' ? 1.12 : n.data.look === 'sylphie' ? 0.85 : 1) + 1.55 + Math.sin(this.time * 3) * 0.12, n.pos.z);
  }

  animateAll(dt) {
    const camPos = this.camera.position;
    for (const e of this.ents) {
      const far = e.pos.distanceTo(camPos) > (e.kind === 'monster' && e.def0.boss ? 220 : 110);
      if (e.kind === 'bot' && !this.S.settings.others) continue;
      if (e.kind === 'monster' && e.dead && e.deadT > 2.4) continue;
      e.model.visible = !far;
      if (e.kind === 'bot') e.petModel.visible = !far;
      if (far) continue;
      e.yaw = angLerp(e.yaw, e.yawT ?? e.yaw, 1 - Math.exp(-dt * 12));
      e.model.rotation.y = e.yaw;
      const t = this.time + e.t0;
      const a = e.actDur ? 1 - e.actT / e.actDur : 0;
      const hum = e.humanoid;
      if (hum) {
        const riding = (e === this.player && this.mounted) || e.mounted;
        animateHumanoid(hum, e.state === 'dead' ? 'dead' : riding && e.state !== 'attack' && e.state !== 'cast' ? 'ride' : e.state, t, a, 1);
        if (riding) animateCreature(e.inner, e.moving ? 'run' : 'idle', t, 0, e.moving);
      } else {
        animateCreature(e.inner, e.state, t, e.state === 'dead' ? Math.min(1, e.deadT || 0) : a, e.moving);
        if (e.hitT > 0) { const s = 1 + e.hitT * 0.6; e.inner.scale.set(s, 1 / s, s); } else if (e.kind === 'monster') e.inner.scale.setScalar(1);
      }
    }
    if (!this.S.settings.others) return;
    for (const b of this.bots) animateCreature(b.petModel, 'idle', this.time + b.t0, 0, b.moving);
  }

  updateCamera(dt) {
    const p = this.player, c = this.cam;
    const tgt = p.pos.clone(); tgt.y += (this.mounted ? 2.2 : 1.5) + p.jumpY * 0.5;
    c.target.lerp(tgt, 1 - Math.exp(-dt * 10));
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const pos = new THREE.Vector3(c.target.x + Math.sin(c.yaw) * cp * c.dist, c.target.y + sp * c.dist, c.target.z + Math.cos(c.yaw) * cp * c.dist);
    const gh = this.world.heightAt(pos.x, pos.z) + 1.2;
    if (pos.y < gh) pos.y = gh;
    if (this.fx.shakeAmt > 0) pos.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(this.fx.shakeAmt * 0.6));
    this.camera.position.copy(pos);
    this.camera.lookAt(c.target);
    // sun follows player for shadows
    this.sun.position.set(p.pos.x + 50, p.pos.y + 70, p.pos.z + 40);
    this.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);
  }

  updatePlates() {
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    const v = new THREE.Vector3();
    for (const e of this.ents) {
      if (!e.np) continue;
      let show = e.model.visible && !(e.kind === 'monster' && e.dead) && !(e.kind === 'bot' && !this.S.settings.others);
      if (show) {
        v.copy(e.pos); v.y += e.height + (e.kind === 'npc' && e.data.look === 'brom' ? 0.25 : 0.25);
        const dist = v.distanceTo(this.camera.position);
        if (dist > (e.kind === 'npc' ? 80 : e.kind === 'monster' && e.def0.boss ? 120 : 55)) show = false;
        else {
          v.project(this.camera);
          if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) show = false;
          else {
            e.np.style.transform = `translate(${((v.x * 0.5 + 0.5) * w) | 0}px, ${((-v.y * 0.5 + 0.5) * h) | 0}px) translate(-50%, -100%)`;
            if (e.npHb) e.npHb.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
          }
        }
      }
      if (show !== e.npShown) { e.np.style.visibility = show ? 'visible' : 'hidden'; e.npShown = show; }
    }
  }

  updateTargetRing() {
    const t = this.player.target, r = this.targetRing;
    if (!t || t.dead || !t.model.visible) { r.visible = false; return; }
    r.visible = true;
    r.position.set(t.pos.x, t.pos.y + 0.12, t.pos.z);
    r.scale.setScalar(t.radius * 1.5 + 0.4);
    r.rotation.z = this.time * 1.5;
    r.material.color.set(t.kind === 'monster' ? 0xffffff : 0x7aff7a);
  }

  updateMisc(dt) {
    const S = this.S, p = this.player;
    S.gift.t += dt;
    // zone
    const z = this.world.zoneAt(p.pos.x, p.pos.z, ZONES) || { name: 'Wilds of Carlyle', lv: '', x: 0, z: 0 };
    if (!this.zone || z.name !== this.zone.name) {
      const first = !this.zone; this.zone = z; this.ui.setZone(z);
      if (!first) { this.ui.banner(z.name, z.lv ? `Carlyle · ${z.lv}` : 'Carlyle', 'zone'); }
    }
    // chatter
    this.chatT -= dt;
    if (this.chatT <= 0) {
      this.chatT = rnd(7, 18);
      const b = pick(this.bots);
      const ch = Math.random() < 0.2 && b.guild ? 'guild' : 'world';
      if (ch === 'guild' && b.guild !== 'Moonlight') this.ui.chat('world', esc(pick(CHAT_LINES)), b.name);
      else this.ui.chat(ch, esc(pick(CHAT_LINES)), b.name);
    }
    this.annT -= dt;
    if (this.annT <= 0) {
      this.annT = rnd(70, 140);
      const b = pick(this.bots);
      const it = pick([['Pegasus', '#ff9a2e'], ['Twinkle', '#c46bff'], ['Elven Ring +8', '#c46bff'], ['Sparky', '#ff9a2e'], ['Frost Wolf', '#4aa8ff']]);
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(b.name)} obtained <span style="color:${it[1]}">[${it[0]}]</span>! Congratulations!`);
    }
    this.saveT += dt;
    if (this.saveT > 15) { this.saveT = 0; this.save(); }
  }

  save() {
    const S = this.S, p = this.player;
    if (p && !p.dead) S.pos = { x: Math.round(p.pos.x * 10) / 10, z: Math.round(p.pos.z * 10) / 10 };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage unavailable */ }
  }
}

export { fmt, esc, ARENA, TELEPORT_CIRCLE };
