// HUD, panels, dialogs, chat, minimap and world map.
import {
  CLASSES, MONSTERS, SPAWNS, ZONES, PETS, SPRITES, MOUNTS, ITEMS, SLOTS, SLOT_INFO, QUALITY, NPCS, QUESTS, SIGNIN, ONLINE_GIFTS, MALL, BOT_NAMES, TELEPORTS,
} from './data.js';
import { needExp, fmt, esc } from './game.js';
import { BRIDGES, ARENA } from './world.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const RAR = ['Common', 'Rare', 'Epic', 'Legendary'];
const RARC = ['var(--q1)', 'var(--q2)', 'var(--q3)', 'var(--q4)'];
const CHN = { world: 'World', system: 'System', guild: 'Guild', team: 'Team', announce: 'Announce' };

export class UI {
  constructor() {
    this.panel = null; this.panelName = null; this.sel = {}; this.chatFilter = 'all';
    this.toasts = $('toasts'); this.bannerEl = $('banner');
    this.cacheTxt = new Map();
  }
  txt(el, s) { if (this.cacheTxt.get(el) !== s) { this.cacheTxt.set(el, s); el.textContent = s; } }

  bind(game) {
    this.g = game;
    const g = game, S = g.S;
    // skill bar
    const bar = $('skillbar'); bar.innerHTML = '';
    this.slots = [];
    for (let i = 1; i <= 6; i++) {
      const b = h('button', 'slot'); b.dataset.i = i; b.setAttribute('aria-label', 'Skill ' + i);
      b.innerHTML = `<span class="ic"></span><span class="key">${i}</span><span class="cd"></span><span class="cdt"></span>`;
      b.addEventListener('click', () => g.useSkill(i));
      this.tip(b, () => this.skillTip(g.skillList()[i]));
      bar.appendChild(b); this.slots.push(b);
    }
    for (const [id, key] of [['hp_potion', 'Q'], ['mp_potion', 'E']]) {
      const b = h('button', 'slot potion'); b.innerHTML = `${ITEMS[id].icon}<span class="key">${key}</span><span class="cnt"></span><span class="cd"></span>`;
      b.setAttribute('aria-label', ITEMS[id].name);
      b.addEventListener('click', () => g.usePotion(id));
      this.tip(b, () => `<b>${ITEMS[id].name}</b>${ITEMS[id].desc}<br><span class="ts">Hotkey ${key} · 3s cooldown</span>`);
      bar.appendChild(b); this.slots.push(b); b.dataset.potion = id;
    }
    $('btn-mount').onclick = () => g.toggleMount();
    $('btn-auto').onclick = () => g.toggleAuto();
    // menu
    const menu = $('hud-menu'); menu.innerHTML = '';
    const items = [['char', '👤', 'Character', 'C'], ['bag', '🎒', 'Bag', 'B'], ['skills', '📖', 'Skills', 'K'], ['pets', '🐾', 'Pets', 'P'], ['mounts', '🐎', 'Mounts', 'U'], ['quests', '📜', 'Quests', 'L'], ['map', '🗺️', 'World Map', 'M'], ['settings', '⚙️', 'Settings', 'O']];
    this.menuBtns = {};
    for (const [n, ic, label, k] of items) {
      const b = h('button', 'mbtn', `${ic}<span class="k">${k}</span>`); b.title = `${label} (${k})`; b.setAttribute('aria-label', label);
      b.onclick = () => { this.togglePanel(n); g.sfx.play('click'); };
      menu.appendChild(b); this.menuBtns[n] = b;
    }
    // activities
    const acts = $('hud-acts'); acts.innerHTML = '';
    const A = [['signin', '📅', 'Sign-In'], ['gift', '🎁', 'Gift'], ['mall', '💎', 'Mall'], ['rank', '🏆', 'Ranking'], ['bounty', '📜', 'Bounty'], ['teleport', '🌀', 'Teleport']];
    this.acts = {};
    for (const [n, ic, label] of A) {
      const b = h('button', 'act', `<span class="ai">${ic}</span><span class="al stroke">${label}</span>`); b.setAttribute('aria-label', label);
      b.onclick = () => {
        g.sfx.play('click');
        if (n === 'bounty') { if (S.bounty) g.autoQuest('bounty'); else if (g.bountyUnlocked()) g.talkTo(g.npcById('elena')); else this.toast('Bounties unlock after "Swift as the Wind"', 'warn'); return; }
        if (n === 'teleport') { g.talkTo(g.npcById('nix')); return; }
        this.togglePanel(n);
      };
      acts.appendChild(b); this.acts[n] = b;
    }
    // map & misc
    $('minimap').onclick = () => this.togglePanel('map');
    $('btn-wmap').onclick = () => this.togglePanel('map');
    $('btn-sound').onclick = () => { g.setSetting('sound', !S.settings.sound); this.refreshSound(); };
    $('hud-pet').onclick = () => this.togglePanel('pets');
    $('qt-tog').onclick = () => { const l = $('qt-list'); l.hidden = !l.hidden; $('qt-tog').textContent = l.hidden ? '▸' : '▾'; };
    $('qt-team').onclick = () => this.togglePanel('quests');
    $('chat-toggle').onclick = () => $('hud-chat').classList.toggle('open');
    $('chat-tabs').querySelectorAll('button').forEach((b) => b.onclick = () => {
      $('chat-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b));
      this.chatFilter = b.dataset.c; this.applyChatFilter();
    });
    $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const i = $('chat-in'); g.sendChat(i.value); i.value = ''; i.blur(); });
    this.mm = $('mm').getContext('2d');
    this.refreshSound();
    $('hud').hidden = false;
  }

  refreshAll() { this.refreshPlayer(); this.refreshSkills(); this.refreshQuest(); this.refreshExp(); this.refreshActs(); this.refreshMountBtn(); this.refreshTarget(); }
  refreshSound() { $('btn-sound').textContent = this.g.S.settings.sound ? '🔊' : '🔇'; }

  // ------------------------------------------------------------ HUD
  refreshPlayer() {
    const g = this.g; if (!g || !g.player) return;
    const S = g.S;
    $('pf-img').src = g.headIcon();
    this.txt($('pf-name'), S.name);
    this.txt($('pf-level'), String(S.level));
    this.txt($('pf-br'), fmt(g.br));
    const pet = S.activePet && PETS.find((x) => x.id === S.activePet);
    $('hud-pet').hidden = !pet;
    if (pet) { $('pet-img').src = g.petIcon(pet.id); this.txt($('pet-name'), pet.name); this.txt($('pet-lv'), `Lv ${S.pets[pet.id].lv} · ${pet.species}`); }
    this.refreshWallet();
  }
  refreshWallet() { const S = this.g.S; this.txt($('w-gold'), fmt(S.gold)); this.txt($('w-dia'), fmt(S.diamonds)); }
  refreshExp() {
    const S = this.g.S, need = needExp(S.level);
    const pct = S.level >= 30 ? 100 : (S.exp / need) * 100;
    $('exp-f').style.width = pct + '%';
    this.txt($('exp-t'), S.level >= 30 ? 'MAX LEVEL' : `EXP ${fmt(S.exp)} / ${fmt(need)}  (${pct.toFixed(1)}%)`);
  }
  refreshSkills() {
    const g = this.g; if (!g || !this.slots) return;
    const list = g.skillList();
    this.slots.forEach((b) => {
      if (b.dataset.potion) { b.querySelector('.cnt').textContent = g.countItem(b.dataset.potion); return; }
      const sk = list[+b.dataset.i];
      b.querySelector('.ic').textContent = sk.icon;
      const locked = g.S.level < sk.lvl;
      b.classList.toggle('locked', locked);
      let lk = b.querySelector('.lk');
      if (locked && !lk) { lk = h('span', 'lk'); b.appendChild(lk); }
      if (lk) { if (locked) lk.textContent = 'Lv' + sk.lvl; else lk.remove(); }
    });
  }
  refreshSkillCD() {}
  refreshMountBtn() {
    const g = this.g, S = g.S, b = $('btn-mount');
    const md = MOUNTS.find((m) => m.id === S.activeMount);
    const ic = { chick: '🐤', panda: '🐼', frostwolf: '🐺', pegasus: '🦄', unicorn: '🦄' }[md?.model] || '🐎';
    b.innerHTML = `${ic}<small>${g.mounted ? 'Dismount' : 'Mount'}</small>`;
    b.classList.toggle('on', g.mounted);
    b.style.opacity = S.activeMount ? 1 : 0.5;
  }
  refreshTarget() {
    const g = this.g, t = g?.player?.target, el = $('hud-target');
    if (!t || t.dead) { el.hidden = true; this.tgShown = null; return; }
    el.hidden = false;
    if (this.tgShown !== t) {
      this.tgShown = t;
      el.classList.toggle('boss', !!(t.def0 && t.def0.boss));
      if (t.kind === 'monster') {
        $('tg-img').src = g.monsterIcon(t.type);
        const tag = t.def0.boss ? '<em>BOSS</em>' : t.def0.elite ? '<em>ELITE</em>' : '';
        $('tg-name').innerHTML = `Lv${t.level} ${esc(t.def0.name)}${tag}`;
      } else {
        $('tg-img').src = '';
        $('tg-name').innerHTML = `Lv${t.level} ${esc(t.name)} <em style="color:#9ad0ff">${CLASSES[t.cls]?.name || ''}</em>`;
      }
    }
  }
  refreshActs() {
    const S = this.g.S;
    const canSign = S.signin.last !== new Date().toISOString().slice(0, 10);
    this.acts.signin.classList.toggle('glow', canSign);
    this.setBadge(this.acts.signin, canSign ? '!' : '');
    this.acts.gift.hidden = S.gift.idx >= ONLINE_GIFTS.length;
    this.acts.bounty.classList.toggle('glow', !!(S.bounty && S.bounty.status === 'complete'));
  }
  setBadge(el, txt) { let b = el.querySelector('.badge'); if (!txt) { b && b.remove(); return; } if (!b) { b = h('span', 'badge'); el.appendChild(b); } b.textContent = txt; }
  markMenu(n) { const b = this.menuBtns[n]; if (b && this.panelName !== n && !b.querySelector('.dotn')) b.appendChild(h('span', 'dotn')); }
  setZone(z) { $('zone-name').innerHTML = `${esc(z.name)}${z.lv ? `<small>${esc(z.lv)}</small>` : ''}`; }
  setAutoPath(on) { $('hud-autopath').hidden = !on; }
  setAutoBattle(on) { $('hud-autobattle').hidden = !on; $('btn-auto').classList.toggle('on', on); }
  focusChat() { const c = $('hud-chat'); c.classList.add('open'); $('chat-in').focus(); }

  frame() {
    const g = this.g; if (!g) return;
    const p = g.player, S = g.S;
    $('pf-hp').style.width = (p.hp / p.maxHp) * 100 + '%';
    this.txt($('pf-hp-t'), `${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}`);
    $('pf-mp').style.width = (p.mp / p.maxMp) * 100 + '%';
    this.txt($('pf-mp-t'), `${fmt(p.mp)} / ${fmt(p.maxMp)}`);
    // target
    const t = p.target;
    if (t !== this.tgShown || (t && t.dead)) this.refreshTarget();
    if (t && !t.dead) { $('tg-hp').style.width = (t.hp / t.maxHp) * 100 + '%'; this.txt($('tg-hp-t'), `${fmt(Math.max(0, t.hp))} / ${fmt(t.maxHp)}`); }
    // cooldowns
    const list = g.skillList();
    for (const b of this.slots) {
      let rem = 0, total = 1;
      if (b.dataset.potion) { rem = g.potionCD - g.time; total = 3; }
      else { const sk = list[+b.dataset.i]; rem = (g.cd[sk.id] || 0) - g.time; total = sk.cd * (1 - g.cdr); b.classList.toggle('nomp', p.mp < sk.mp && S.level >= sk.lvl); }
      const cd = b.querySelector('.cd'), cdt = b.querySelector('.cdt');
      if (rem > 0) { cd.style.background = `conic-gradient(rgba(0,0,0,.7) ${(rem / total) * 360}deg, transparent 0)`; if (cdt) this.txt(cdt, rem > 1 ? String(Math.ceil(rem)) : rem.toFixed(1)); }
      else if (cd.style.background) { cd.style.background = ''; if (cdt) this.txt(cdt, ''); }
    }
    // buffs
    const bf = $('pf-buffs');
    const sig = p.buffs.map((b) => b.id + Math.ceil(b.until - g.time)).join();
    if (sig !== this.buffSig) { this.buffSig = sig; bf.innerHTML = p.buffs.map((b) => `<div class="buff">${b.icon}<small>${Math.ceil(b.until - g.time)}</small></div>`).join(''); }
    // cast bar
    if (g.casting) $('cast-f').style.width = Math.min(100, (g.casting.t / g.casting.dur) * 100) + '%';
    // coords & gift timer
    this.txt($('coords'), `${Math.round(p.pos.x)}, ${Math.round(p.pos.z)}`);
    const gf = ONLINE_GIFTS[S.gift.idx];
    if (gf) {
      const left = Math.max(0, gf.secs - S.gift.t);
      const lbl = this.acts.gift.querySelector('.al');
      this.txt(lbl, left > 0 ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'Claim!');
      const ready = left <= 0;
      if (ready !== this.giftReady) { this.giftReady = ready; this.acts.gift.classList.toggle('glow', ready); this.setBadge(this.acts.gift, ready ? '!' : ''); }
    }
    this.frameN = (this.frameN || 0) + 1;
    if (this.frameN % 2 === 0) this.drawMinimap();
    if (this.panelName === 'map' && this.frameN % 15 === 0) this.drawWorldMap();
  }

  drawMinimap() {
    const g = this.g, c = this.mm, p = g.player.pos, src = g.world.minimapCanvas;
    const R = 60, S = 150, k = S / (R * 2);
    c.clearRect(0, 0, S, S);
    c.drawImage(src, p.x + 200 - R, p.z + 200 - R, R * 2, R * 2, 0, 0, S, S);
    const dot = (x, z, col, r = 2.5) => { const sx = (x - p.x + R) * k, sy = (z - p.z + R) * k; if (sx < 0 || sy < 0 || sx > S || sy > S) return; c.fillStyle = col; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill(); };
    for (const m of g.monsters) if (!m.dead) dot(m.pos.x, m.pos.z, m.def0.boss ? '#ff3aa8' : m.def0.aggressive ? '#ff4a3a' : '#ff9a6a', m.def0.boss ? 5 : 2.2);
    if (g.S.settings.others) for (const b of g.bots) dot(b.pos.x, b.pos.z, '#6ac8ff', 2.2);
    for (const n of g.npcs) {
      dot(n.pos.x, n.pos.z, '#ffe066', 3);
      if (n.markChar && n.markChar !== '…') { const sx = (n.pos.x - p.x + R) * k, sy = (n.pos.z - p.z + R) * k; c.font = 'bold 13px sans-serif'; c.fillStyle = '#ffd84a'; c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeText(n.markChar, sx - 3, sy - 4); c.fillText(n.markChar, sx - 3, sy - 4); }
    }
    // path
    if (g.player.path.length) {
      c.strokeStyle = 'rgba(122,255,122,.8)'; c.lineWidth = 2; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(S / 2, S / 2);
      for (const w of g.player.path) c.lineTo((w.x - p.x + R) * k, (w.z - p.z + R) * k);
      c.stroke(); c.setLineDash([]);
    }
    c.save(); c.translate(S / 2, S / 2); c.rotate(Math.PI - g.player.yaw);
    c.fillStyle = '#fff'; c.strokeStyle = '#1a3a1a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------ quest tracker
  refreshQuest() {
    const g = this.g; if (!g) return;
    const S = g.S, list = $('qt-list'); list.innerHTML = '';
    const q = g.quest();
    if (q && q.def) {
      const done = q.status === 'complete';
      const obj = g.questObjective(q);
      const it = h('div', 'qt-item', `<span class="qtag main">Main</span><span class="qn">${esc(q.def.name)}</span><div class="qo ${done ? 'done' : ''}">${linkify(obj)}</div>`);
      it.onclick = () => { g.sfx.play('click'); g.autoQuest('main'); };
      it.title = 'Click to auto-path';
      list.appendChild(it);
    } else {
      list.appendChild(h('div', 'qt-item', `<span class="qtag main">Main</span><span class="qn">Chapter I complete</span><div class="qo">More chapters coming soon. Take bounties from <u>Captain Elena</u>.</div>`)).onclick = () => g.talkTo(g.npcById('elena'));
    }
    const B = S.bounty;
    if (B) {
      const obj = B.status === 'complete' ? 'Return to Captain Elena' : `Defeat ${MONSTERS[B.target].name} (${B.prog}/${B.count})`;
      const it = h('div', 'qt-item', `<span class="qtag bounty">Bounty</span><span class="qn">Daily Bounty</span><div class="qo ${B.status === 'complete' ? 'done' : ''}">${linkify(obj)}</div>`);
      it.onclick = () => g.autoQuest('bounty');
      list.appendChild(it);
    } else if (g.bountyUnlocked()) {
      list.appendChild(h('div', 'qt-item', `<span class="qtag bounty">Bounty</span><div class="qo">Visit <u>Captain Elena</u> for a bounty</div>`)).onclick = () => g.talkTo(g.npcById('elena'));
    }
    if (this.panelName === 'quests') this.renderPanel();
  }

  // ------------------------------------------------------------ feedback
  chat(ch, html, who) {
    const log = $('chat-log');
    const p = h('p', 'c-' + ch, `<span class="ch">[${CHN[ch] || ch}]</span> ${who ? `<span class="who">${esc(who)}</span>: ` : ''}${html}`);
    p.dataset.ch = ch;
    log.appendChild(p);
    while (log.children.length > 90) log.firstChild.remove();
    this.filterOne(p);
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    if (near || ch === 'system') log.scrollTop = log.scrollHeight;
  }
  filterOne(p) { const f = this.chatFilter, c = p.dataset.ch; p.hidden = !(f === 'all' || f === c || (f === 'system' && c === 'announce')); }
  applyChatFilter() { for (const p of $('chat-log').children) this.filterOne(p); $('chat-log').scrollTop = 1e9; }
  toast(msg, cls = '') {
    const t = h('div', 'toast stroke ' + cls); t.textContent = msg;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2400);
  }
  banner(a, b, cls = '') {
    const el = this.bannerEl; el.className = cls; el.innerHTML = `<div class="b1">${esc(a)}</div>${b ? `<div class="b2 stroke">${esc(b)}</div>` : ''}`;
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => { el.innerHTML = ''; }, 2800);
  }
  cast(label, dur) { $('hud-cast').hidden = false; $('cast-l').textContent = label; $('cast-f').style.width = '0%'; }
  cancelCast() { $('hud-cast').hidden = true; }

  // ------------------------------------------------------------ dialog & modal
  dialog({ npc, qname, text, rewards, buttons }) {
    const g = this.g, d = $('dialog');
    d.hidden = false; d.innerHTML = '';
    const pi = h('div', 'dp'); const img = new Image(); img.alt = ''; img.src = g.npcIcon(npc.id, npc.data.look); pi.appendChild(img);
    const box = h('div', 'db frame');
    box.innerHTML = `<button class="x-close" aria-label="Close">✕</button><div class="dn">${esc(npc.data.name)}<small>&lt;${esc(npc.data.title)}&gt;</small></div>${qname ? `<div class="dq">❖ ${esc(qname)}</div>` : ''}<div class="dt"></div>`;
    box.querySelector('.x-close').onclick = () => this.closeDialog();
    if (rewards) {
      const rw = h('div', 'drew', 'Rewards:');
      const chip = (html) => rw.appendChild(h('span', 'rw', html));
      if (rewards.exp) chip(`✨ ${fmt(rewards.exp)} EXP`);
      if (rewards.gold) chip(`<span class="coin"></span>${fmt(rewards.gold)}`);
      if (rewards.diamonds) chip(`<span class="gem"></span>${fmt(rewards.diamonds)}`);
      for (const [id, q] of rewards.items || []) chip(`${ITEMS[id].icon} ${esc(ITEMS[id].name)} x${q}`);
      if (rewards.equip) chip(`${SLOT_INFO[rewards.equip].icon} <span style="color:var(--q2)">Rare ${SLOT_INFO[rewards.equip].label}</span>`);
      if (rewards.pet) { const pd = PETS.find((x) => x.id === rewards.pet); chip(`🐾 <span style="color:${RARC[pd.rarity]}">${esc(pd.name)}</span>`); }
      if (rewards.mount) chip(`🐎 ${esc(MOUNTS.find((x) => x.id === rewards.mount).name)}`);
      if (rewards.sprite) chip('🧚 Elemental Sprite');
      if (rewards.wings) chip('🪽 Fairy Wings');
      box.appendChild(rw);
    }
    const acts = h('div', 'dacts');
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.cls || ''), esc(b.label));
      btn.onclick = () => { g.sfx.play('click'); if (b.fn) b.fn(); else this.closeDialog(); };
      acts.appendChild(btn);
    }
    box.appendChild(acts);
    d.appendChild(pi); d.appendChild(box);
    // typewriter
    const dt = box.querySelector('.dt'); let i = 0;
    clearInterval(this.typeT);
    this.typeT = setInterval(() => { i += 3; dt.textContent = text.slice(0, i); if (i >= text.length) clearInterval(this.typeT); }, 16);
    dt.onclick = () => { clearInterval(this.typeT); dt.textContent = text; };
  }
  closeDialog() { clearInterval(this.typeT); $('dialog').hidden = true; }
  modal(title, text, buttons = [{ label: 'OK' }], persistent = false, img = null) {
    const m = $('modal'); m.hidden = false;
    m.innerHTML = `<div class="frame">${img ? `<img src="${img}" alt="" style="width:120px;height:120px;border-radius:10px;background:radial-gradient(circle at 50% 40%,#4a6ac8,#10183a);margin-bottom:8px">` : ''}<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="macts"></div></div>`;
    const acts = m.querySelector('.macts');
    for (const b of buttons) {
      const btn = h('button', 'btn ' + (b.cls || ''), esc(b.label));
      btn.onclick = () => { this.g?.sfx.play('click'); const r = b.fn ? b.fn() : true; if (r !== false) this.closeModal(); };
      acts.appendChild(btn);
    }
    this.modalPersistent = persistent;
    m.onclick = (e) => { if (e.target === m && !persistent) this.closeModal(); };
  }
  closeModal() { $('modal').hidden = true; }
  closeTop() {
    if (!$('modal').hidden && !this.modalPersistent) { this.closeModal(); return true; }
    if (!$('dialog').hidden) { this.closeDialog(); return true; }
    if (this.panel) { this.closePanels(); return true; }
    return false;
  }

  // ------------------------------------------------------------ tooltip
  tip(el, fn) {
    const tt = $('tooltip');
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; const html = fn(); if (!html) return; tt.innerHTML = html; tt.hidden = false; this.moveTip(e); });
    el.addEventListener('pointermove', (e) => this.moveTip(e));
    el.addEventListener('pointerleave', () => { tt.hidden = true; });
  }
  moveTip(e) {
    const tt = $('tooltip'); if (tt.hidden) return;
    const w = tt.offsetWidth, hh = tt.offsetHeight;
    let x = e.clientX + 14, y = e.clientY - hh - 10;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y < 8) y = e.clientY + 18;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  }
  skillTip(sk) {
    const g = this.g, lv = g.skillLevel(sk.id);
    return `<b style="color:var(--gold-l)">${sk.icon} ${esc(sk.name)} <span style="color:var(--cyan)">Lv ${lv}</span></b>${esc(sk.desc)}<br><span class="ts">MP ${sk.mp} · Cooldown ${sk.cd}s${g.S.level < sk.lvl ? ` · Unlocks at Lv ${sk.lvl}` : ''}</span>`;
  }
  equipTip(eq) {
    const st = Object.entries(eq.stats).map(([k, v]) => `${{ atk: 'Attack', def: 'Defense', hp: 'Max HP', crit: 'Critical %' }[k]} +${fmt(v * (1 + 0.08 * (eq.enh || 0)))}`).join('<br>');
    return `<b style="color:${QUALITY[eq.quality].color}">${esc(eq.name)}${eq.enh ? ` +${eq.enh}` : ''}</b>${QUALITY[eq.quality].name} ${SLOT_INFO[eq.slot].label} · Lv ${eq.lvl}<br><span class="ts">${st}</span>`;
  }

  // ------------------------------------------------------------ panels
  togglePanel(name, forceOpen = false) {
    if (this.panelName === name && !forceOpen) { this.closePanels(); return; }
    this.closePanels(true); this.closeDialog();
    this.panelName = name;
    const dot = this.menuBtns[name]?.querySelector('.dotn'); if (dot) dot.remove();
    const titles = { char: 'Character', bag: 'Bag', skills: 'Skills', pets: 'Pets & Sprites', mounts: 'Mount Stable', quests: 'Quest Log', map: 'World Map of Carlyle', settings: 'Settings', mall: 'Mall', signin: 'Daily Sign-In', gift: 'Online Gifts', rank: 'Battle Rating Ranking' };
    const widths = { char: 600, bag: 460, skills: 520, pets: 520, mounts: 520, quests: 480, map: 600, settings: 400, mall: 560, signin: 560, gift: 420, rank: 480 };
    const p = h('div', 'panel frame');
    p.style.width = `min(${widths[name]}px, calc(100vw - 24px))`;
    p.innerHTML = `<div class="ptitle">${titles[name]}</div><button class="x-close" aria-label="Close">✕</button><div class="pbody"></div>`;
    p.querySelector('.x-close').onclick = () => this.closePanels();
    $('panels').appendChild(p);
    this.panel = p;
    this.renderPanel();
    p.style.left = Math.max(12, (innerWidth - p.offsetWidth) / 2) + 'px';
    p.style.top = Math.max(12, (innerHeight - p.offsetHeight) / 2 - 20) + 'px';
    this.dragify(p);
    this.g.sfx.play('open');
  }
  closePanels(silent) { if (this.panel) this.panel.remove(); this.panel = null; this.panelName = null; $('tooltip').hidden = true; }
  dragify(p) {
    const t = p.querySelector('.ptitle'); let d = null;
    t.addEventListener('pointerdown', (e) => { d = { x: e.clientX - p.offsetLeft, y: e.clientY - p.offsetTop }; t.setPointerCapture(e.pointerId); });
    t.addEventListener('pointermove', (e) => { if (!d) return; p.style.left = Math.min(innerWidth - 60, Math.max(-p.offsetWidth + 80, e.clientX - d.x)) + 'px'; p.style.top = Math.min(innerHeight - 40, Math.max(0, e.clientY - d.y)) + 'px'; });
    t.addEventListener('pointerup', () => { d = null; });
  }
  refreshPanel() { if (this.panel) this.renderPanel(); }
  renderPanel() {
    const body = this.panel.querySelector('.pbody');
    const scroll = body.scrollTop;
    body.innerHTML = '';
    this['panel_' + this.panelName](body);
    body.scrollTop = scroll;
    $('tooltip').hidden = true;
  }
  tabs(body, key, list) {
    const cur = this.sel[key] ?? list[0][0];
    const t = h('div', 'tabs');
    for (const [id, label] of list) { const b = h('button', cur === id ? 'sel' : '', label); b.onclick = () => { this.sel[key] = id; this.renderPanel(); }; t.appendChild(b); }
    body.appendChild(t);
    return cur;
  }

  panel_char(body) {
    const g = this.g, S = g.S, p = g.player, C = CLASSES[S.cls];
    const wrap = h('div', 'char-wrap');
    const col = (slots) => {
      const c = h('div', 'eq-col');
      for (const s of slots) {
        const eq = S.equip[s];
        const b = h('button', 'cell ' + (eq ? 'q' + eq.quality : 'empty'), eq ? `${eq.icon}${eq.enh ? `<span class="enh">+${eq.enh}</span>` : ''}` : `<span style="opacity:.35">${SLOT_INFO[s].icon}</span>`);
        b.setAttribute('aria-label', SLOT_INFO[s].label);
        if (this.sel.eqSlot === s) b.style.outline = '2px solid var(--gold)';
        b.onclick = () => { this.sel.eqSlot = s; this.renderPanel(); };
        this.tip(b, () => eq ? this.equipTip(eq) : `<b>${SLOT_INFO[s].label}</b>Empty slot`);
        c.appendChild(b);
      }
      return c;
    };
    wrap.appendChild(col(['weapon', 'helm', 'armor']));
    const port = h('div', 'char-portrait'); const img = new Image(); img.alt = ''; img.src = g.fullIcon(); port.appendChild(img);
    port.appendChild(h('div', 'cpn stroke', `Lv${S.level} ${esc(S.name)} · ${C.name}`));
    wrap.appendChild(port);
    wrap.appendChild(col(['boots', 'necklace', 'ring']));
    const st = h('div', 'stats-col');
    st.appendChild(h('div', 'br-big', `<span class="flame"></span>${fmt(g.br)}`));
    const T = C.talents[S.talent];
    st.appendChild(h('div', 'stats', `
      <span>Class</span><span>${C.name}</span><span>Talent</span><span>${T.name}</span>
      <span>Max HP</span><span>${fmt(p.maxHp)}</span><span>Max MP</span><span>${fmt(p.maxMp)}</span>
      <span>Attack</span><span>${fmt(g.atkOf(p))}</span><span>Defense</span><span>${fmt(g.defOf(p))}</span>
      <span>Critical</span><span>${g.critOf(p).toFixed(1)}%</span><span>Crit Damage</span><span>+${Math.round(p.critDmg * 100)}%</span>
      <span>Move Speed</span><span>${(g.speedOf(p) / 7 * 100).toFixed(0)}%</span><span>Element</span><span style="color:${C.elemColor}">${C.element}</span>`));
    wrap.appendChild(st);
    body.appendChild(wrap);
    const s = this.sel.eqSlot, eq = s && S.equip[s];
    const det = h('div', 'detail');
    if (eq) {
      const cost = g.enhanceCost(eq), chance = Math.round(Math.max(0.35, 1 - eq.enh * 0.07) * 100);
      det.innerHTML = `<div class="dtx">${this.equipTip(eq)}<br>Enhance: <span class="price"><span class="coin"></span>${fmt(cost)}</span> · ${chance}% success</div>`;
      const acts = h('div', 'acts');
      const be = h('button', 'btn', `Enhance +${eq.enh + 1}`); be.onclick = () => g.enhance(s); acts.appendChild(be);
      const bu = h('button', 'btn gray', 'Unequip'); bu.onclick = () => { g.unequip(s); this.sel.eqSlot = null; }; acts.appendChild(bu);
      det.appendChild(acts);
    } else det.innerHTML = '<div class="dtx">Select an equipment slot. Gorm the Blacksmith says: enhanced gear raises your Battle Rating!</div>';
    body.appendChild(det);
  }

  panel_bag(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'bagTab', [['all', 'All'], ['eq', 'Equipment'], ['it', 'Items']]);
    const grid = h('div', 'grid-bag');
    const idx = S.bag.map((b, i) => [b, i]).filter(([b]) => tab === 'all' || (tab === 'eq' ? !!b.eq : !b.eq));
    for (let k = 0; k < 48; k++) {
      const e = idx[k];
      if (!e) { grid.appendChild(h('div', 'cell empty')); continue; }
      const [b, i] = e;
      const q = b.eq ? b.eq.quality : ITEMS[b.id].quality;
      const c = h('button', `cell q${q}`, b.eq ? `${b.eq.icon}${b.eq.enh ? `<span class="enh">+${b.eq.enh}</span>` : ''}` : `${ITEMS[b.id].icon}<span class="cnt">${b.qty}</span>`);
      if (this.sel.bagIdx === i) c.style.outline = '2px solid var(--gold)';
      c.onclick = () => { this.sel.bagIdx = i; this.renderPanel(); };
      c.ondblclick = () => g.useBagItem(i);
      this.tip(c, () => b.eq ? this.equipTip(b.eq) + this.compare(b.eq) : `<b style="color:${QUALITY[q].color}">${esc(ITEMS[b.id].name)}</b>${esc(ITEMS[b.id].desc)}`);
      grid.appendChild(c);
    }
    body.appendChild(grid);
    body.appendChild(h('div', '', `<div style="margin-top:8px;font-size:12px;color:var(--muted)">Slots ${S.bag.length}/48 · Double-click to use or equip</div>`));
    const b = S.bag[this.sel.bagIdx];
    if (b) {
      const det = h('div', 'detail');
      det.innerHTML = `<div class="dtx">${b.eq ? this.equipTip(b.eq) + this.compare(b.eq) : `<b style="color:${QUALITY[ITEMS[b.id].quality].color}">${esc(ITEMS[b.id].name)}</b><br>${esc(ITEMS[b.id].desc)}`}</div>`;
      const acts = h('div', 'acts');
      const it = b.eq ? null : ITEMS[b.id];
      if (b.eq || (it && it.type !== 'quest')) { const bu = h('button', 'btn green', b.eq ? 'Equip' : it.type === 'egg' ? 'Hatch' : 'Use'); bu.onclick = () => { const i = this.sel.bagIdx; this.sel.bagIdx = null; g.useBagItem(i); }; acts.appendChild(bu); }
      if (!it || it.type !== 'quest') { const bs = h('button', 'btn gray', 'Sell'); bs.onclick = () => { const i = this.sel.bagIdx; this.sel.bagIdx = null; g.sell(i); }; acts.appendChild(bs); }
      det.appendChild(acts);
      body.appendChild(det);
    }
  }
  compare(eq) {
    const cur = this.g.S.equip[eq.slot];
    if (!cur) return '<br><span class="ts">Slot is empty — equip for a free upgrade!</span>';
    const score = (e) => Object.entries(e.stats).reduce((a, [k, v]) => a + v * { atk: 9, def: 7, hp: 0.55, crit: 14 }[k] * (1 + 0.08 * (e.enh || 0)), 0);
    const d = Math.round(score(eq) - score(cur));
    return `<br><span style="color:${d >= 0 ? '#7aff7a' : '#ff7a7a'}">Battle Rating ${d >= 0 ? '▲ +' : '▼ '}${fmt(d)}</span>`;
  }

  panel_skills(body) {
    const g = this.g, S = g.S, C = CLASSES[S.cls];
    body.appendChild(h('div', 'lbl', 'Dual Talent'));
    const tl = h('div', 'talents');
    C.talents.forEach((t, i) => {
      const d = h('div', '', `<b>${t.name} <span style="color:var(--cyan);font-size:11px">${t.role}</span></b>${t.desc}`);
      d.style.cursor = 'pointer'; if (S.talent === i) { d.style.borderColor = 'var(--gold)'; d.style.boxShadow = '0 0 10px rgba(243,199,91,.4)'; }
      d.onclick = () => g.setTalent(i);
      tl.appendChild(d);
    });
    body.appendChild(tl);
    const list = h('div', 'list');
    for (const sk of g.skillList()) {
      const lv = g.skillLevel(sk.id), locked = S.level < sk.lvl;
      const r = h('div', 'row');
      r.innerHTML = `<div class="ic">${sk.icon}</div><div class="tx"><b>${esc(sk.name)} <span class="lv">Lv ${lv}</span>${sk.basic ? ' <span style="color:var(--muted);font-size:11px">(auto attack)</span>' : ''}</b>${esc(sk.desc)}<br>MP ${sk.mp} · CD ${sk.cd}s${locked ? ` · <span style="color:#ff8a7a">Unlocks at Lv ${sk.lvl}</span>` : ''}</div>`;
      if (!locked && !sk.basic) {
        const b = h('button', 'btn small', `Upgrade<br><span class="price" style="justify-content:center"><span class="coin"></span>${fmt(120 * lv * lv)}</span>`);
        b.onclick = () => g.upgradeSkill(sk.id); r.appendChild(b);
      }
      list.appendChild(r);
    }
    body.appendChild(list);
  }

  panel_pets(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'petTab', [['pets', `Pets (${Object.keys(S.pets).length}/${PETS.length})`], ['sprites', `Sprites (${S.sprites.length}/${SPRITES.length})`]]);
    if (tab === 'pets') {
      const cards = h('div', 'cards');
      for (const pd of PETS) {
        const own = S.pets[pd.id];
        const c = h('button', 'card' + (own ? '' : ' locked') + (this.sel.pet === pd.id ? ' sel' : ''));
        c.innerHTML = `<img alt="" src="${g.petIcon(pd.id)}"><div>${own ? esc(pd.name) : '???'}</div><div class="rar" style="color:${RARC[pd.rarity]}">${RAR[pd.rarity]}</div>${S.activePet === pd.id ? '<span class="on">OUT</span>' : ''}`;
        c.onclick = () => { this.sel.pet = pd.id; this.renderPanel(); };
        cards.appendChild(c);
      }
      body.appendChild(cards);
      const pd = PETS.find((x) => x.id === (this.sel.pet || S.activePet || PETS[0].id)), own = S.pets[pd.id];
      const det = h('div', 'detail');
      const lv = own ? own.lv : 1, k = 1 + 0.15 * (lv - 1);
      det.innerHTML = `<img alt="" src="${g.petIcon(pd.id)}" ${own ? '' : 'style="filter:grayscale(1) brightness(.5)"'}><div class="dtx"><b>${own ? esc(pd.name) : '???'}</b> <span style="color:${RARC[pd.rarity]}">${RAR[pd.rarity]} ${esc(pd.species)}</span><br>${own ? `Level ${lv} · Attack ${fmt(pd.atk * k)} · HP +${fmt(pd.hp * k)}` : `How to obtain: ${esc(pd.src)}`}<br>Pets fight beside you and add to your Battle Rating.</div>`;
      if (own) {
        const acts = h('div', 'acts');
        if (S.activePet === pd.id) { const b = h('button', 'btn gray', 'Recall'); b.onclick = () => g.setPet(null); acts.appendChild(b); }
        else { const b = h('button', 'btn green', 'Summon'); b.onclick = () => g.setPet(pd.id); acts.appendChild(b); }
        const f = h('button', 'btn', `Feed · <span class="coin" style="display:inline-block;vertical-align:-3px"></span> ${fmt(150 * lv * lv)}`); f.onclick = () => g.feedPet(pd.id); acts.appendChild(f);
        det.appendChild(acts);
      }
      body.appendChild(det);
    } else {
      const list = h('div', 'list');
      for (const sd of SPRITES) {
        const own = S.sprites.includes(sd.id);
        const r = h('div', 'row');
        r.innerHTML = `<div class="ic"><img alt="" src="${g.spriteIcon(sd.id)}"></div><div class="tx"><b>${esc(sd.name)} <span style="color:var(--cyan);font-size:12px">${sd.element} Sprite</span></b>${esc(sd.desc)}${own ? '' : '<br><span style="color:var(--dim)">Locked — earned from the Spirit Guide for your element</span>'}</div>`;
        if (own) { const b = h('button', S.activeSprite === sd.id ? 'btn gray small' : 'btn green small', S.activeSprite === sd.id ? 'Active' : 'Call'); b.onclick = () => g.setSprite(sd.id); r.appendChild(b); }
        list.appendChild(r);
      }
      body.appendChild(list);
    }
  }

  panel_mounts(body) {
    const g = this.g, S = g.S;
    const cards = h('div', 'cards');
    for (const md of MOUNTS) {
      const own = S.mounts.includes(md.id);
      const c = h('button', 'card' + (own ? '' : ' locked') + (this.sel.mount === md.id ? ' sel' : ''));
      c.innerHTML = `<img alt="" src="${g.mountIcon(md.id)}"><div>${esc(md.name)}</div><div class="rar" style="color:var(--gold)">+${Math.round((md.speed - 1) * 100)}% speed</div>${S.activeMount === md.id ? '<span class="on">ACTIVE</span>' : ''}`;
      c.onclick = () => { this.sel.mount = md.id; this.renderPanel(); };
      cards.appendChild(c);
    }
    body.appendChild(cards);
    const md = MOUNTS.find((x) => x.id === (this.sel.mount || S.activeMount || MOUNTS[0].id)), own = S.mounts.includes(md.id);
    const det = h('div', 'detail');
    det.innerHTML = `<img alt="" src="${g.mountIcon(md.id)}" ${own ? '' : 'style="filter:grayscale(1) brightness(.5)"'}><div class="dtx"><b>${esc(md.name)}</b><br>Move speed +${Math.round((md.speed - 1) * 100)}% · Battle Rating +${md.br}<br>${own ? 'Every mount you own adds to your Battle Rating.' : `How to obtain: ${esc(md.src)}`}</div>`;
    if (own) {
      const acts = h('div', 'acts');
      if (S.activeMount !== md.id) { const b = h('button', 'btn green', 'Set Active'); b.onclick = () => g.setMount(md.id); acts.appendChild(b); }
      const r = h('button', 'btn blue', g.mounted ? 'Dismount' : 'Ride (R)'); r.onclick = () => { if (S.activeMount !== md.id) g.setMount(md.id); g.toggleMount(); this.closePanels(); }; acts.appendChild(r);
      det.appendChild(acts);
    }
    body.appendChild(det);
  }

  panel_quests(body) {
    const g = this.g, S = g.S, q = g.quest();
    const idx = q && q.def ? QUESTS.findIndex((x) => x.id === q.def.id) : QUESTS.length;
    body.appendChild(h('div', 'lbl', 'Chapter I · The Restless Spirits'));
    const list = h('div', 'list');
    QUESTS.forEach((qd, i) => {
      if (i > idx) return;
      const cur = i === idx;
      const r = h('div', 'row');
      r.innerHTML = `<div class="ic" style="font-size:20px">${cur ? '❖' : '✔'}</div><div class="tx"><b style="color:${cur ? '#ffe066' : 'var(--muted)'}">${esc(qd.name)}</b>${cur ? `${esc(qd.text)}<br><span style="color:#7aff7a">${esc(g.questObjective(q))}</span>` : 'Completed'}</div>`;
      if (cur) { const b = h('button', 'btn small blue', 'Go'); b.onclick = () => { this.closePanels(); g.autoQuest('main'); }; r.appendChild(b); }
      list.appendChild(r);
    });
    if (idx >= QUESTS.length) list.appendChild(h('div', 'row', '<div class="tx"><b>Chapter I complete!</b>Keep leveling with bounties, collect pets and mounts, and enhance your gear.</div>'));
    body.appendChild(list);
    body.appendChild(h('div', 'lbl', '<br>Bounty'));
    const B = S.bounty;
    body.appendChild(h('div', 'row', `<div class="ic">📜</div><div class="tx">${B ? `<b>Defeat ${B.count} ${esc(MONSTERS[B.target].name)}</b>Progress ${B.prog}/${B.count}${B.status === 'complete' ? ' — report to Captain Elena' : ''}` : g.bountyUnlocked() ? '<b>No active bounty</b>Captain Elena by the east gate has work for you.' : '<b>Locked</b>Bounties unlock after "Swift as the Wind".'}</div>`));
    body.appendChild(h('div', 'lbl', '<br>Team'));
    body.appendChild(h('div', 'row', `<div class="ic">🛡️</div><div class="tx"><b>Solo adventurer</b>Your pet${S.activePet ? ` ${esc(PETS.find((x) => x.id === S.activePet).name)}` : ''}${S.activeSprite ? ` and sprite ${esc(SPRITES.find((x) => x.id === S.activeSprite).name)}` : ''} fight at your side.</div>`));
  }

  panel_map(body) {
    const g = this.g;
    const wrap = h('div', 'worldmap');
    const cv = document.createElement('canvas'); cv.width = 560; cv.height = 560; wrap.appendChild(cv);
    this.wmCanvas = cv;
    for (const z of ZONES) {
      const l = h('div', 'wm-label stroke', `${esc(z.name)}<small>${esc(z.lv)}</small>`);
      l.style.left = ((z.x + 200) / 400 * 100) + '%'; l.style.top = ((z.z + 200) / 400 * 100) + '%';
      wrap.appendChild(l);
    }
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 400 - 200, z = (e.clientY - r.top) / r.height * 400 - 200;
      if (g.world.isBlocked(x, z) && g.world.nearestFree(x, z)[0] === x) { this.toast('Cannot travel there', 'warn'); return; }
      this.closePanels(); g.engage = false; g.pathTo(x, z, true);
    };
    body.appendChild(wrap);
    body.appendChild(h('div', '', '<div style="margin-top:8px;font-size:12px;color:var(--muted)">Click anywhere on the map to auto-path there. Talk to Nix at the north teleport circle for instant travel.</div>'));
    this.drawWorldMap();
  }
  drawWorldMap() {
    const cv = this.wmCanvas; if (!cv || !cv.isConnected) return;
    const g = this.g, c = cv.getContext('2d'), k = cv.width / 400;
    c.drawImage(g.world.minimapCanvas, 0, 0, cv.width, cv.height);
    const P = (x, z) => [(x + 200) * k, (z + 200) * k];
    for (const sp of SPAWNS) { const [x, y] = P(sp.x, sp.z); c.fillStyle = MONSTERS[sp.type].boss ? 'rgba(255,60,160,.35)' : 'rgba(255,90,60,.22)'; c.beginPath(); c.arc(x, y, sp.r * k + (MONSTERS[sp.type].boss ? 10 : 0), 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 11px Nunito, sans-serif'; c.strokeStyle = '#000'; c.lineWidth = 3; const lbl = `${MONSTERS[sp.type].name} Lv${MONSTERS[sp.type].lvl[0]}`; c.strokeText(lbl, x - 30, y + 4); c.fillText(lbl, x - 30, y + 4); }
    for (const n of NPCS) { const [x, y] = P(n.x, n.z); c.fillStyle = '#ffe066'; c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill(); }
    const p = g.player; const [px, py] = P(p.pos.x, p.pos.z);
    c.save(); c.translate(px, py); c.rotate(Math.PI - p.yaw); c.fillStyle = '#7aff7a'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 7); c.lineTo(0, 3); c.lineTo(-7, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
    if (p.path.length) { c.strokeStyle = '#7aff7a'; c.setLineDash([5, 4]); c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); for (const w of p.path) c.lineTo(...P(w.x, w.z)); c.stroke(); c.setLineDash([]); }
  }

  panel_settings(body) {
    const g = this.g, S = g.S;
    const s = h('div', 'settings');
    const row = (label, key) => {
      s.appendChild(h('span', '', label));
      const b = h('button', 'switch' + (S.settings[key] ? ' on' : '')); b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', !!S.settings[key]);
      b.onclick = () => { g.setSetting(key, !S.settings[key]); this.refreshSound(); this.renderPanel(); };
      s.appendChild(b);
    };
    row('Show other players', 'others'); row('Auto-use potions at low HP', 'autoPotion'); row('Real-time shadows', 'shadows'); row('Sound & music', 'sound');
    body.appendChild(s);
    const acts = h('div', 'acts'); acts.style.cssText = 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap';
    const sv = h('button', 'btn blue', 'Save Game'); sv.onclick = () => { g.save(); this.toast('Game saved', 'good'); }; acts.appendChild(sv);
    const del = h('button', 'btn gray', 'New Character'); del.onclick = () => this.modal('Start over?', 'This deletes your saved hero and returns to character creation.', [{ label: 'Delete & Restart', fn: () => { try { localStorage.removeItem('alfheim_tales_save_v1'); } catch { /* ignore */ } location.reload(); } }, { label: 'Cancel', cls: 'gray' }]);
    acts.appendChild(del);
    body.appendChild(acts);
    body.appendChild(h('div', '', '<p style="font-size:12px;color:var(--muted);line-height:1.6;margin-top:14px">Controls: click to move · click monsters to attack · drag to rotate camera · scroll or pinch to zoom · WASD to walk · 1–6 skills · Q/E potions · R mount · T auto battle · Space jump · Tab next target · F talk · Enter chat.</p>'));
  }

  panel_mall(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'mallTab', [['item', 'Supplies'], ['pet', 'Pets'], ['mount', 'Mounts']]);
    body.appendChild(h('div', '', `<div style="display:flex;gap:14px;margin-bottom:10px;font-family:var(--f-num);font-weight:400"><span class="price"><span class="coin"></span>${fmt(S.gold)}</span><span class="price" style="color:#9ae0ff"><span class="gem"></span>${fmt(S.diamonds)}</span></div>`));
    const grid = h('div', 'mall-grid');
    MALL.forEach((m, i) => {
      if (m.kind !== tab) return;
      let icon, name, owned = false;
      if (m.kind === 'item') { icon = ITEMS[m.id].icon; name = `${ITEMS[m.id].name} x${m.qty}`; }
      if (m.kind === 'pet') { const pd = PETS.find((x) => x.id === m.id); icon = `<img alt="" src="${g.petIcon(m.id)}">`; name = `${pd.name} <span style="color:${RARC[pd.rarity]};font-size:11px">${RAR[pd.rarity]}</span>`; owned = !!S.pets[m.id]; }
      if (m.kind === 'mount') { const md = MOUNTS.find((x) => x.id === m.id); icon = `<img alt="" src="${g.mountIcon(m.id)}">`; name = md.name; owned = S.mounts.includes(m.id); }
      const c = h('div', 'mall-item', `<div class="mi">${icon}</div><div>${name}</div><div class="price">${m.cost.gold ? `<span class="coin"></span>${fmt(m.cost.gold)}` : `<span class="gem"></span>${fmt(m.cost.diamonds)}`}</div>`);
      const b = h('button', 'btn small' + (owned ? ' gray' : ''), owned ? 'Owned' : 'Buy'); b.disabled = owned; b.onclick = () => g.buyMall(i);
      c.appendChild(b); grid.appendChild(c);
    });
    body.appendChild(grid);
  }

  panel_signin(body) {
    const g = this.g, S = g.S;
    const can = S.signin.last !== new Date().toISOString().slice(0, 10);
    const cur = S.signin.count % 7;
    const grid = h('div', 'signin');
    SIGNIN.forEach((r, i) => {
      const claimed = i < cur || (!can && i === (cur + 6) % 7 && S.signin.count > 0 && cur === 0);
      const icon = r.pet ? `<img alt="" src="${g.petIcon(r.pet)}" style="width:44px;height:44px">` : r.mount ? `<img alt="" src="${g.mountIcon(r.mount)}" style="width:44px;height:44px">` : r.gold ? '💰' : r.diamonds ? '💎' : ITEMS[r.items[0][0]].icon;
      grid.appendChild(h('div', 'sday' + (i === cur && can ? ' today' : '') + (claimed ? ' claimed' : ''), `Day ${r.day}<div class="si">${icon}</div>${esc(r.label)}`));
    });
    body.appendChild(grid);
    const b = h('button', 'btn big', can ? 'Claim Today' : 'Come back tomorrow'); b.disabled = !can; b.style.marginTop = '14px'; b.onclick = () => g.claimSignin();
    const wrap = h('div', ''); wrap.style.textAlign = 'center'; wrap.appendChild(b); body.appendChild(wrap);
  }

  panel_gift(body) {
    const g = this.g, S = g.S;
    const list = h('div', 'list');
    ONLINE_GIFTS.forEach((gf, i) => {
      const done = i < S.gift.idx, cur = i === S.gift.idx;
      const left = cur ? Math.max(0, gf.secs - S.gift.t) : gf.secs;
      const r = h('div', 'row', `<div class="ic">${gf.pet ? `<img alt="" src="${g.petIcon(gf.pet)}">` : '🎁'}</div><div class="tx"><b>${esc(gf.label)}</b>${done ? 'Claimed' : cur ? (left > 0 ? `Ready in ${Math.ceil(left)}s of play` : 'Ready to claim!') : `${Math.round(gf.secs / 60)} min after the previous gift`}</div>`);
      if (cur) { const b = h('button', 'btn small', 'Claim'); b.disabled = left > 0; b.onclick = () => g.claimGift(); r.appendChild(b); }
      list.appendChild(r);
    });
    body.appendChild(list);
    clearTimeout(this.giftRefresh); this.giftRefresh = setTimeout(() => { if (this.panelName === 'gift') this.renderPanel(); }, 1000);
  }

  panel_rank(body) {
    const g = this.g, S = g.S;
    if (!this.rankData) {
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, 15);
      const cls = Object.keys(CLASSES);
      this.rankData = names.map((n, i) => ({ name: n, cls: cls[i % 4], lv: 30 - Math.floor(i * 1.5), br: Math.round(42000 * Math.pow(0.8, i) + 600) }));
    }
    const rows = [...this.rankData, { name: S.name, cls: S.cls, lv: S.level, br: g.br, me: true }].sort((a, b) => b.br - a.br);
    const t = h('div', '');
    t.appendChild(h('div', 'rank-row', '<span class="rk">#</span><span>Name</span><span class="cls">Class</span><span style="text-align:right">BR</span>'));
    rows.forEach((r, i) => t.appendChild(h('div', 'rank-row' + (r.me ? ' me' : ''), `<span class="rk ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><span>${esc(r.name)} <small style="color:var(--muted)">Lv${r.lv}</small></span><span class="cls" style="color:${CLASSES[r.cls].elemColor}">${CLASSES[r.cls].name}</span><span style="text-align:right;font-family:var(--f-num);font-weight:400;color:#ffd36b">${fmt(r.br)}</span>`)));
    body.appendChild(t);
  }
}

function linkify(obj) {
  return esc(obj).replace(/(Talk to |Return to |Defeat |Collect )(.+?)( \(|$)/, (m, a, b, c) => `${a}<u>${b}</u>${c}`);
}
