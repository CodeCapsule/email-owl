// The overworld of Carlyle: terrain, river, Sylvan Haven, ruins, sky, World Tree, collision grid and A* pathing.
import * as THREE from 'three';
import { toon, glow, outlineMaterial, grassTexture, stoneTexture, cloudTexture, glowTexture, magicCircleTexture, getGradient } from './toon.js';

export const SIZE = 400, HALF = 200;
export const WATER_Y = -1.0;
const SEG = 200;
const CELL = 2, GN = SIZE / CELL;

const RIVER = [[112, -215], [88, -120], [72, -50], [70, 10], [85, 80], [118, 150], [150, 215]];
const ROADS = [
  [[0, 0], [60, 0], [100, 1], [158, 2]],
  [[0, 0], [0, 60], [2, 95], [-12, 124]],
  [[0, 0], [-60, 0], [-100, -12], [-128, -60], [-146, -92]],
  [[0, 0], [0, -60], [0, -150]],
];
export const BRIDGES = [{ x: 70.5, z: 0.5, len: 26, w: 6, axis: 'x' }, { x: 102, z: 118, len: 24, w: 5, axis: 'x' }];
export const ARENA = { x: -150, z: -112, r: 21 };
export const OVERLOOK = { x: 0, z: -160 };
export const TELEPORT_CIRCLE = { x: 0, z: -46 };
export const WORLD_TREE = { x: 0, z: -470 };
const PLATFORMS = [{ x: 0, z: 0, r: 17.2, y: 0.3 }, { x: -150, z: -112, r: 21.5, y: 0.55 }, { x: 0, z: -160, r: 8, y: 1.95 }, { x: 0, z: -46, r: 4.6, y: 0.2 }];

// ---------------------------------------------------------------- noise
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function polyDist(px, pz, poly) { let d = 1e9; for (let i = 0; i < poly.length - 1; i++) d = Math.min(d, segDist(px, pz, poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1])); return d; }
export const riverDist = (x, z) => polyDist(x, z, RIVER);
export const roadDist = (x, z) => { let d = 1e9; for (const r of ROADS) d = Math.min(d, polyDist(x, z, r)); return d; };
function onBridge(x, z) {
  for (const b of BRIDGES) {
    if (Math.abs(z - b.z) < b.w / 2 && Math.abs(x - b.x) < b.len / 2) return b;
  }
  return null;
}
function bridgeDeckY(b, x) { const t = (x - (b.x - b.len / 2)) / b.len; return 0.35 + Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * 1.4; }

function rawHeight(x, z) {
  let h = fbm(x / 70 + 10, z / 70 + 3) * 7 - 2.2 + fbm(x / 20, z / 20) * 1.3;
  if (z > 60 && x < 80) h += fbm(x / 30 + 5, z / 30) * 3;
  const dT = Math.hypot(x, z);
  h = lerp(0, h, smooth(50, 78, dT));
  const rd = roadDist(x, z);
  h = lerp(h * 0.3, h, smooth(3, 10, rd));
  const da = Math.hypot(x - ARENA.x, z - ARENA.z);
  h = lerp(0.4, h, smooth(ARENA.r + 1, ARENA.r + 10, da));
  const dO = Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z);
  h = lerp(1.5, h, smooth(14, 24, dO));
  const rv = riverDist(x, z);
  if (rv < 14) { h = Math.max(h, -0.2); h = lerp(-2.9, h, smooth(5.5, 12, rv)); }
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 158) h += Math.pow((e - 158) / 42, 2) * 48 * (0.7 + 0.6 * fbm(x / 25, z / 25));
  return h;
}

// ---------------------------------------------------------------- static batching
class Batch {
  constructor() { this.parts = []; }
  add(geo, color, matrix) { this.parts.push([geo, new THREE.Color(color), matrix]); }
  build() {
    if (!this.parts.length) return null;
    let nv = 0, ni = 0;
    for (const [g] of this.parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    const v = new THREE.Vector3(), nm = new THREE.Matrix3();
    for (const [g, c, m] of this.parts) {
      const p = g.attributes.position, n = g.attributes.normal; nm.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], (vo + i) * 3);
        v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
        col.set([c.r, c.g, c.b], (vo + i) * 3);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      else for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
      vo += p.count; io += g.index ? g.index.count : p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 12, 9),
  sphHi: new THREE.SphereGeometry(1, 18, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  roof: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  hemi: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 18, Math.PI),
  dode: new THREE.DodecahedronGeometry(1, 0),
};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function M(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _s.set(sx, sy, sz); _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.heights = new Float32Array((SEG + 1) * (SEG + 1));
    this.grid = new Uint8Array(GN * GN);
    this.batches = new Map();
    this.anim = [];
    this.treeSpots = [];
    this.buildings = [];
    this.t = 0;
  }

  // -------------------------------------------------------------- queries
  heightAt(x, z) {
    const b = onBridge(x, z);
    const fx = (x + HALF) / SIZE * SEG, fz = (z + HALF) / SIZE * SEG;
    const ix = Math.max(0, Math.min(SEG - 1, Math.floor(fx))), iz = Math.max(0, Math.min(SEG - 1, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - ix)), tz = Math.min(1, Math.max(0, fz - iz));
    const H = this.heights, W = SEG + 1;
    const h = lerp(lerp(H[iz * W + ix], H[iz * W + ix + 1], tx), lerp(H[(iz + 1) * W + ix], H[(iz + 1) * W + ix + 1], tx), tz);
    if (b) return Math.max(h, bridgeDeckY(b, x));
    for (const p of PLATFORMS) if (Math.hypot(x - p.x, z - p.z) < p.r) return Math.max(h, p.y);
    return h;
  }
  cellOf(x, z) { return [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)]; }
  isBlocked(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    if (cx < 0 || cz < 0 || cx >= GN || cz >= GN) return true;
    return this.grid[cz * GN + cx] === 1;
  }
  blockCircle(x, z, r) {
    const [c0x, c0z] = this.cellOf(x - r, z - r), [c1x, c1z] = this.cellOf(x + r, z + r);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      if (cx < 0 || cz < 0 || cx >= GN || cz >= GN) continue;
      const wx = -HALF + (cx + 0.5) * CELL, wz = -HALF + (cz + 0.5) * CELL;
      if (Math.hypot(wx - x, wz - z) < r + 0.6) this.grid[cz * GN + cx] = 1;
    }
  }
  blockRect(x, z, w, d, rot = 0) {
    const r = Math.hypot(w, d) / 2 + 1;
    const [c0x, c0z] = this.cellOf(x - r, z - r), [c1x, c1z] = this.cellOf(x + r, z + r);
    const c = Math.cos(-rot), s = Math.sin(-rot);
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) {
      if (cx < 0 || cz < 0 || cx >= GN || cz >= GN) continue;
      const wx = -HALF + (cx + 0.5) * CELL - x, wz = -HALF + (cz + 0.5) * CELL - z;
      const lx = wx * c + wz * s, lz = -wx * s + wz * c;
      if (Math.abs(lx) < w / 2 + 0.4 && Math.abs(lz) < d / 2 + 0.4) this.grid[cz * GN + cx] = 1;
    }
  }
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / (CELL * 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  nearestFree(x, z) {
    if (!this.isBlocked(x, z)) return [x, z];
    for (let r = 1; r < 30; r++) for (let a = 0; a < 16; a++) {
      const px = x + Math.cos(a / 16 * Math.PI * 2) * r * CELL, pz = z + Math.sin(a / 16 * Math.PI * 2) * r * CELL;
      if (!this.isBlocked(px, pz)) return [px, pz];
    }
    return [x, z];
  }
  findPath(sx, sz, tx, tz) {
    [tx, tz] = this.nearestFree(tx, tz);
    if (this.lineClear(sx, sz, tx, tz)) return [{ x: tx, z: tz }];
    const [ax, az] = this.cellOf(...this.nearestFree(sx, sz)), [bx, bz] = this.cellOf(tx, tz);
    const N = GN * GN, start = az * GN + ax, goal = bz * GN + bx;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [], push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hfn = (i) => { const dx = Math.abs(i % GN - bx), dz = Math.abs(((i / GN) | 0) - bz); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    g[start] = 0; push(hfn(start), start);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, iter = 0;
    while (heap.length && iter++ < 60000) {
      const [, cur] = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % GN, cz = (cur / GN) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= GN || nz >= GN) continue;
        const ni = nz * GN + nx;
        if (this.grid[ni] || closed[ni]) continue;
        if (dx && dz && (this.grid[cz * GN + nx] || this.grid[nz * GN + cx])) continue;
        const ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + hfn(ni), ni); }
      }
    }
    if (!found) return [{ x: tx, z: tz }];
    const cells = []; for (let c = goal; c !== -1; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => ({ x: -HALF + (c % GN + 0.5) * CELL, z: -HALF + (((c / GN) | 0) + 0.5) * CELL }));
    pts[pts.length - 1] = { x: tx, z: tz };
    // string pulling
    const out = []; let ax2 = sx, az2 = sz, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(ax2, az2, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); ax2 = pts[j].x; az2 = pts[j].z; i = j + 1;
    }
    return out;
  }
  zoneAt(x, z, zones) {
    let best = null, bd = 1e9;
    for (const zn of zones) { const d = Math.hypot(x - zn.x, z - zn.z) / zn.r; if (d < 1 && d < bd) { bd = d; best = zn; } }
    return best;
  }

  // -------------------------------------------------------------- build
  batch(x, z) {
    const key = Math.floor((x + HALF) / 80) + ',' + Math.floor((z + HALF) / 80);
    if (!this.batches.has(key)) this.batches.set(key, { toon: new Batch(), glow: new Batch() });
    return this.batches.get(key);
  }
  put(geo, color, x, y, z, sx, sy, sz, rx, ry, rz) { this.batch(x, z).toon.add(geo, color, M(x, y, z, sx, sy, sz, rx, ry, rz)); }
  putGlow(geo, color, x, y, z, sx, sy, sz, rx, ry, rz) { this.batch(x, z).glow.add(geo, color, M(x, y, z, sx, sy, sz, rx, ry, rz)); }
  // place a part relative to a rotated anchor
  putRel(ax, az, rot, geo, color, lx, y, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0, isGlow = false) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const x = ax + lx * c + lz * s, z = az - lx * s + lz * c;
    (isGlow ? this.putGlow : this.put).call(this, geo, color, x, y, z, sx, sy, sz, rx, ry + rot, rz);
  }

  build(onProgress = () => {}) {
    this.buildTerrain(); onProgress(0.2);
    this.buildWater(); this.buildSky(); onProgress(0.3);
    this.buildTown(); onProgress(0.45);
    this.buildBridges(); this.buildRuins(); this.buildOverlook(); onProgress(0.55);
    this.buildTrees(); onProgress(0.7);
    this.buildGroundCover(); onProgress(0.8);
    this.buildBoundary(); this.buildWorldTree(); this.buildIslands(); onProgress(0.9);
    this.finishBatches();
    this.buildAmbient();
    this.buildMinimap(); onProgress(1);
  }

  buildTerrain() {
    const W = SEG + 1;
    for (let iz = 0; iz <= SEG; iz++) for (let ix = 0; ix <= SEG; ix++) {
      const x = -HALF + ix / SEG * SIZE, z = -HALF + iz / SEG * SIZE;
      this.heights[iz * W + ix] = rawHeight(x, z);
    }
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), cA = new THREE.Color();
    const C = {
      grass: new THREE.Color('#7cc650'), meadow: new THREE.Color('#9ad85e'), forest: new THREE.Color('#4f9c40'),
      ruins: new THREE.Color('#a4b860'), dirt: new THREE.Color('#dcbc80'), sand: new THREE.Color('#ead9a0'),
      bed: new THREE.Color('#9ab0a0'), rock: new THREE.Color('#a39b90'), snow: new THREE.Color('#f4f8ff'), town: new THREE.Color('#86cc5a'),
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // PlaneGeometry rotated: rows run along z
      const ix = Math.round((x + HALF) / SIZE * SEG), iz = Math.round((z + HALF) / SIZE * SEG);
      const h = this.heights[iz * W + ix];
      pos.setY(i, h);
      c.copy(C.grass);
      const meadowT = smooth(70, 100, x) * (1 - smooth(60, 100, z));
      c.lerp(C.meadow, meadowT);
      c.lerp(C.forest, smooth(60, 95, z) * (1 - smooth(70, 110, x)));
      c.lerp(C.ruins, smooth(-60, -95, x));
      c.lerp(C.town, 1 - smooth(40, 60, Math.hypot(x, z)));
      const n = fbm(x / 9, z / 9);
      c.multiplyScalar(0.86 + n * 0.28);
      const rd = roadDist(x, z);
      if (rd < 6) { cA.copy(C.dirt).multiplyScalar(0.92 + n * 0.16); c.lerp(cA, 1 - smooth(3, 6, rd)); }
      const rv = riverDist(x, z);
      if (rv < 12) c.lerp(C.sand, 1 - smooth(8, 12, rv));
      if (h < WATER_Y) c.copy(C.bed);
      const e = Math.max(Math.abs(x), Math.abs(z));
      if (e > 168) c.lerp(C.rock, smooth(168, 182, e));
      if (h > 26) c.lerp(C.snow, smooth(26, 34, h));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const gt = grassTexture(); gt.repeat.set(90, 90);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: gt });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // collision: water, mountains
    for (let cz = 0; cz < GN; cz++) for (let cx = 0; cx < GN; cx++) {
      const x = -HALF + (cx + 0.5) * CELL, z = -HALF + (cz + 0.5) * CELL;
      const e = Math.max(Math.abs(x), Math.abs(z));
      let blocked = e > 176;
      if (!blocked && riverDist(x, z) < 7.2 && !onBridge(x, z)) blocked = true;
      if (blocked) this.grid[cz * GN + cx] = 1;
    }
  }

  buildWater() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]);
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, fog: true, depthWrite: false,
      vertexShader: [
        'varying vec3 vW;',
        '#include <fog_pars_vertex>',
        'void main() {',
        '  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;',
        '  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;',
        '  #include <fog_vertex>',
        '}'].join('\n'),
      fragmentShader: [
        'uniform float uTime; varying vec3 vW;',
        '#include <common>',
        '#include <fog_pars_fragment>',
        'void main() {',
        '  float w = sin(vW.x*0.35+uTime*1.1)*0.5 + sin(vW.z*0.42-uTime*0.9)*0.5;',
        '  float c = sin(vW.x*1.3+uTime*1.6+sin(vW.z*0.9+uTime*0.8)*2.0)*sin(vW.z*1.1-uTime*1.2+sin(vW.x*0.7)*2.0);',
        '  vec3 col = mix(vec3(0.20,0.58,0.86), vec3(0.42,0.82,0.96), w*0.5+0.5);',
        '  col += smoothstep(0.55,0.95,c)*vec3(0.5,0.6,0.6);',
        '  gl_FragColor = vec4(col, 0.84);',
        '  #include <fog_fragment>',
        '}'].join('\n'),
    });
    const geo = new THREE.PlaneGeometry(SIZE + 200, SIZE + 200, 1, 1); geo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(geo, mat); this.water.position.y = WATER_Y; this.water.renderOrder = -1;
    this.scene.add(this.water);
  }

  buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#2f86e0') }, mid: { value: new THREE.Color('#8fd0ff') }, bot: { value: new THREE.Color('#e8f8ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0),0.8)) : mix(mid, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
    this.scene.add(this.sky);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff6c8, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.position.set(500, 700, 400); sun.scale.setScalar(320); this.scene.add(sun);
    // clouds
    this.clouds = [];
    const ct = cloudTexture();
    for (let i = 0; i < 46; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 700;
      s.position.set(Math.cos(a) * r, 120 + Math.random() * 110, Math.sin(a) * r);
      const sc = 70 + Math.random() * 90; s.scale.set(sc * 2, sc, 1);
      this.scene.add(s); this.clouds.push(s);
    }
  }

  // ---------------------------------------------------------- town
  house(x, z, rot, { w = 8, d = 7, h = 4.5, roof = 0xd8504a, wall = 0xfff1d6, tower = false } = {}) {
    const y = this.heightAt(x, z) - 0.2;
    const R = (geo, col, lx, ly, lz, sx, sy, sz, rx, ry, rz, gl) => this.putRel(x, z, rot, geo, col, lx, y + ly, lz, sx, sy, sz, rx, ry, rz, gl);
    const beam = 0x6a4430;
    if (tower) {
      R(GEO.cyl, wall, 0, h / 2, 0, w / 2, h, w / 2);
      R(GEO.cone, roof, 0, h + h * 0.45, 0, w / 2 + 0.8, h * 0.9, w / 2 + 0.8);
      R(GEO.box, beam, 0, 1.2, w / 2 - 0.05, 1.4, 2.4, 0.3);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; R(GEO.box, 0xffe08a, Math.sin(a) * (w / 2), h * 0.65, Math.cos(a) * (w / 2), 0.8, 1.1, 0.2, 0, a, 0, true); }
      R(GEO.cyl6, beam, 0, h * 1.95, 0, 0.08, 1.6, 0.08);
      R(GEO.box, roof, 0.55, h * 2.2, 0, 1.0, 0.6, 0.05);
      this.blockCircle(x, z, w / 2);
      this.buildings.push({ x, z, w, d: w, rot });
      return;
    }
    R(GEO.box, wall, 0, h / 2, 0, w, h, d);
    R(GEO.box, 0xb89a7a, 0, 0.3, 0, w + 0.3, 0.6, d + 0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) R(GEO.box, beam, sx * w / 2, h / 2, sz * d / 2, 0.35, h, 0.35);
    R(GEO.box, beam, 0, h - 0.15, d / 2, w, 0.3, 0.2); R(GEO.box, beam, 0, h - 0.15, -d / 2, w, 0.3, 0.2);
    R(GEO.box, beam, 0, h * 0.5, d / 2 + 0.02, w, 0.22, 0.15);
    R(GEO.roof, roof, 0, h + h * 0.42, 0, w * 0.86, h * 0.85, d * 0.86);
    R(GEO.box, 0x7a4a30, 0, 1.15, d / 2 + 0.05, 1.3, 2.3, 0.2);
    R(GEO.sph, 0xffd84a, 0.4, 1.15, d / 2 + 0.2, 0.08, 0.08, 0.08);
    for (const sx of [-1, 1]) {
      R(GEO.box, 0xffe08a, sx * w * 0.3, h * 0.62, d / 2 + 0.03, 1.0, 1.0, 0.12, 0, 0, 0, true);
      R(GEO.box, beam, sx * w * 0.3, h * 0.62, d / 2 + 0.08, 1.2, 0.12, 0.1);
      R(GEO.box, 0x8a5a3a, sx * w * 0.3, h * 0.62 - 0.65, d / 2 + 0.25, 1.2, 0.3, 0.4);
      for (let k = -1; k <= 1; k++) R(GEO.sph, [0xff6a8a, 0xffd84a, 0xc87aff][k + 1], sx * w * 0.3 + k * 0.35, h * 0.62 - 0.45, d / 2 + 0.3, 0.2, 0.2, 0.2);
      R(GEO.box, 0xffe08a, sx * w / 2 + sx * 0.03, h * 0.62, 0, 0.12, 1.0, 1.0, 0, 0, 0, true);
    }
    R(GEO.box, 0x9a8a80, w * 0.25, h + h * 0.6, -d * 0.15, 0.8, h * 0.7, 0.8);
    this.blockRect(x, z, w, d, rot);
    this.buildings.push({ x, z, w, d, rot });
  }

  mushroomHouse(x, z, rot, cap = 0xe04a3a) {
    const y = this.heightAt(x, z) - 0.2;
    const R = (geo, col, lx, ly, lz, sx, sy, sz, rx, ry, rz, gl) => this.putRel(x, z, rot, geo, col, lx, y + ly, lz, sx, sy, sz, rx, ry, rz, gl);
    R(GEO.cyl, 0xfff0d8, 0, 2.5, 0, 3, 5, 3);
    R(GEO.hemi, cap, 0, 4.6, 0, 5.4, 3.6, 5.4);
    R(GEO.cyl, 0xf8e0c0, 0, 4.62, 0, 5.3, 0.15, 5.3);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i % 2 ? 2.6 : 4.1; R(GEO.sph, 0xffffff, Math.cos(a) * r, 4.6 + 3.6 * Math.sqrt(1 - (r / 5.4) ** 2), Math.sin(a) * r, 0.75, 0.32, 0.75); }
    R(GEO.sph, 0xffffff, 0, 8.2, 0, 0.9, 0.3, 0.9);
    R(GEO.box, 0x7a4a30, 0, 1.1, 2.95, 1.2, 2.2, 0.2);
    R(GEO.box, 0xffe08a, 1.9, 3.0, 2.4, 0.8, 0.8, 0.12, 0, 0.6, 0, true);
    R(GEO.box, 0xffe08a, -1.9, 3.0, 2.4, 0.8, 0.8, 0.12, 0, -0.6, 0, true);
    this.blockCircle(x, z, 3.2);
    this.buildings.push({ x, z, w: 6, d: 6, rot });
  }

  lamp(x, z) {
    const y = this.heightAt(x, z);
    this.put(GEO.cyl6, 0x3a3440, x, y + 1.6, z, 0.1, 3.2, 0.1);
    this.put(GEO.box, 0x3a3440, x, y + 3.25, z, 0.55, 0.12, 0.55);
    this.putGlow(GEO.box, 0xffd27a, x, y + 3.65, z, 0.4, 0.6, 0.4);
    this.put(GEO.cone4, 0x3a3440, x, y + 4.15, z, 0.45, 0.45, 0.45, 0, Math.PI / 4, 0);
    this.blockCircle(x, z, 0.3);
    this.lampGlows.push([x, y + 3.65, z]);
  }

  fence(ax, az, bx, bz, color = 0x9a6a40) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(d / 2.5)), rot = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, y = this.heightAt(x, z);
      this.put(GEO.box, color, x, y + 0.6, z, 0.22, 1.2, 0.22);
      if (i < n) {
        const mx = x + (bx - ax) / n / 2, mz = z + (bz - az) / n / 2, my = this.heightAt(mx, mz);
        this.put(GEO.box, color, mx, my + 0.85, mz, 0.12, 0.16, d / n, 0, rot, 0);
        this.put(GEO.box, color, mx, my + 0.45, mz, 0.12, 0.16, d / n, 0, rot, 0);
      }
    }
  }

  gate(x, z, rot) {
    const y = this.heightAt(x, z);
    const R = (geo, col, lx, ly, lz, sx, sy, sz, rx = 0, ry = 0, rz = 0, gl) => this.putRel(x, z, rot, geo, col, lx, y + ly, lz, sx, sy, sz, rx, ry, rz, gl);
    for (const s of [-1, 1]) {
      R(GEO.box, 0xd8d0c0, s * 5, 3, 0, 1.4, 6, 1.4);
      R(GEO.box, 0xb8b0a0, s * 5, 6.2, 0, 1.8, 0.4, 1.8);
      R(GEO.cone4, 0x3a6ad8, s * 5, 7.4, 0, 1.3, 2.0, 1.3, 0, Math.PI / 4, 0);
      R(GEO.box, 0x3a6ad8, s * 5, 3.6, 0.75, 1.0, 2.2, 0.05);
      R(GEO.sph, 0xf0c040, s * 5, 4.4, 0.8, 0.25, 0.25, 0.08);
      this.blockCircle(x + Math.cos(rot) * s * 5, z - Math.sin(rot) * s * 5, 0.9);
    }
    R(GEO.torus, 0xd8d0c0, 0, 6.2, 0, 5, 3.2, 4);
    R(GEO.box, 0x7a4a30, 0, 7.2, 0.3, 4.4, 1.1, 0.2);
  }

  buildTown() {
    this.lampGlows = [];
    // plaza
    const stoneTex = stoneTexture(); stoneTex.repeat.set(6, 6);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(17, 17.5, 0.5, 48), new THREE.MeshToonMaterial({ color: 0xffffff, map: stoneTex, gradientMap: getGradient() }));
    plaza.position.y = 0.05; plaza.receiveShadow = true; this.scene.add(plaza);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(17.3, 0.35, 6, 64), toon(0xb8a890)); ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.3; this.scene.add(ringM);
    // fountain
    this.put(GEO.cyl, 0xd8d0c4, 0, 0.6, 0, 5, 0.9, 5);
    this.put(GEO.cyl, 0xc4bcb0, 0, 1.6, 0, 1.0, 2.2, 1.0);
    this.put(GEO.cyl, 0xd8d0c4, 0, 2.8, 0, 2.2, 0.35, 2.2);
    this.put(GEO.cyl, 0xc4bcb0, 0, 3.6, 0, 0.5, 1.4, 0.5);
    this.blockCircle(0, 0, 5.2);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.85 }));
    fw.position.y = 1.12; this.scene.add(fw);
    const fw2 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.1, 30), fw.material); fw2.position.y = 3.04; this.scene.add(fw2);
    // spirit crystal atop fountain
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshToonMaterial({ color: 0x9af0ff, emissive: 0x2a6a8a, gradientMap: getGradient() }));
    crystal.position.y = 5.6; crystal.scale.y = 1.6; this.scene.add(crystal);
    const ch = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9af0ff, blending: THREE.AdditiveBlending, depthWrite: false }));
    ch.scale.setScalar(5); ch.position.y = 5.6; this.scene.add(ch);
    this.anim.push((t) => { crystal.rotation.y = t * 0.8; crystal.position.y = 5.6 + Math.sin(t * 1.5) * 0.25; ch.position.y = crystal.position.y; });
    this.fountain = { x: 0, y: 3.8, z: 0 };
    // four spirit shrines around the plaza
    const shrines = [[0xff6a3a, 'Fire'], [0x4fb8ff, 'Water'], [0x5cf0a6, 'Wind'], [0xe0b040, 'Earth']];
    shrines.forEach(([col], i) => {
      const a = Math.PI / 4 + i * Math.PI / 2, x = Math.cos(a) * 12.5, z = Math.sin(a) * 12.5;
      this.put(GEO.cyl6, 0xd8d0c4, x, 0.9, z, 0.8, 1.8, 0.8);
      this.put(GEO.cyl6, 0xb8b0a4, x, 1.9, z, 1.0, 0.25, 1.0);
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glow(col)); g.position.set(x, 2.7, z); g.scale.y = 1.5; this.scene.add(g);
      const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false })); hs.scale.setScalar(2.6); hs.position.copy(g.position); this.scene.add(hs);
      this.anim.push((t) => { g.rotation.y = t * 1.2 + i; g.position.y = 2.7 + Math.sin(t * 2 + i) * 0.15; hs.position.y = g.position.y; });
      this.blockCircle(x, z, 0.9);
    });

    // buildings
    this.house(-15, -29, 0, { w: 10, d: 7, h: 5, roof: 0x4aa05a });       // elder
    this.house(28, -20, -0.5, { w: 7, d: 6, h: 4.2, roof: 0xff7aa8 });     // pet house
    this.house(-30, -32, 0.3, { w: 7, d: 6, roof: 0x4a7ad8 });
    this.house(-40, 28, 2.2, { w: 8, d: 6, roof: 0xe8903a });
    this.house(22, 40, Math.PI, { w: 8, d: 7, roof: 0x3ab0a0 });
    this.house(-44, -4, Math.PI / 2, { w: 8, d: 7, h: 4.6, roof: 0x8a5a4a }); // blacksmith
    this.house(44, -16, 0, { w: 6.5, h: 7, roof: 0x3a6ad8, tower: true });   // guard tower
    this.house(-44, -22, 0, { w: 5.5, h: 8, roof: 0x9a5ad8, tower: true });
    this.mushroomHouse(32, -38, 0.4, 0x9a5ad8);
    this.mushroomHouse(-14, 42, 3.0, 0xe04a3a);
    this.mushroomHouse(42, 30, -1.2, 0xf08a3a);
    // stable pen
    this.house(38, 22, -Math.PI / 2, { w: 8, d: 6, h: 4, roof: 0xb83a3a, wall: 0xe8d0b0 });
    this.fence(26, 12, 26, 28); this.fence(26, 28, 32, 28);
    for (const [hx, hz] of [[29, 14], [29.5, 17]]) { const y = this.heightAt(hx, hz); this.put(GEO.cyl, 0xf0d060, hx, y + 0.5, hz, 0.8, 1.0, 0.8, Math.PI / 2, 0.3, 0); this.blockCircle(hx, hz, 0.8); }
    // market stalls
    const stalls = [[-27, 12, 1.8, 0xe84a5a], [-30, 20, 2.3, 0x4a8ae8], [-24, 24, 2.8, 0xf0b030]];
    for (const [sx, sz, r, col] of stalls) {
      const y = this.heightAt(sx, sz);
      const R = (geo, c, lx, ly, lz, a, b, cc, rx = 0, ry = 0, rz = 0) => this.putRel(sx, sz, r, geo, c, lx, y + ly, lz, a, b, cc, rx, ry, rz);
      for (const a of [-1, 1]) for (const b of [-1, 1]) R(GEO.box, 0x8a5a3a, a * 1.6, 1.4, b * 1.0, 0.18, 2.8, 0.18);
      R(GEO.box, 0xa87a50, 0, 1.0, 0, 3.4, 0.2, 2.2);
      for (let k = 0; k < 6; k++) R(GEO.box, k % 2 ? 0xffffff : col, -1.55 + k * 0.62, 3.0, 0, 0.62, 0.15, 2.8, 0.25, 0, 0);
      for (let k = 0; k < 5; k++) R(GEO.sph, [0xff4a3a, 0xffd84a, 0x7ad84a, 0xff9a3a, 0xc07aff][k], -1.2 + k * 0.6, 1.3, 0.3, 0.25, 0.25, 0.25);
      R(GEO.box, 0xb88a5a, 1.0, 1.4, -0.4, 0.7, 0.6, 0.7);
      this.blockRect(sx, sz, 3.4, 2.2, r);
    }
    // forge
    { const y = this.heightAt(-34, -8); this.put(GEO.box, 0x6a6470, -34, y + 1, -8, 2.4, 2, 2.4); this.putGlow(GEO.box, 0xff7a2a, -34, y + 1.2, -6.75, 1.2, 0.8, 0.1); this.put(GEO.box, 0x5a5560, -31.5, y + 0.5, -10, 1.0, 1.0, 0.6); this.put(GEO.box, 0x5a5560, -31.5, y + 1.05, -10, 1.4, 0.25, 0.7); this.blockRect(-34, -8, 2.4, 2.4); this.blockCircle(-31.5, -10, 0.8); }
    // teleport circle
    const tc = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#7ad8ff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    tc.rotation.x = -Math.PI / 2; tc.position.set(TELEPORT_CIRCLE.x, 0.26, TELEPORT_CIRCLE.z); this.scene.add(tc);
    this.anim.push((t) => { tc.rotation.z = t * 0.4; });
    this.put(GEO.cyl, 0xd8d0c4, TELEPORT_CIRCLE.x, 0.1, TELEPORT_CIRCLE.z, 4.6, 0.2, 4.6);
    // gates
    this.gate(56, 0.5, Math.PI / 2); this.gate(0.5, 56, 0); this.gate(-56, 0, Math.PI / 2); this.gate(0, -56, 0);
    // perimeter fence (skip gaps at roads)
    const R0 = 60, segs = 48;
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      const mx = Math.cos((a0 + a1) / 2) * R0, mz = Math.sin((a0 + a1) / 2) * R0;
      if (roadDist(mx, mz) < 8 || riverDist(mx, mz) < 12) continue;
      this.fence(Math.cos(a0) * R0, Math.sin(a0) * R0, Math.cos(a1) * R0, Math.sin(a1) * R0, 0xa87a50);
    }
    // lamps along roads
    for (let d = 20; d <= 52; d += 11) for (const s of [-1, 1]) { this.lamp(d, s * 4.5); this.lamp(-d, s * 4.5); this.lamp(s * 4.5, d); this.lamp(s * 4.5, -d); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; if (Math.abs(Math.sin(a * 2)) > 0.2) this.lamp(Math.cos(a) * 19.5, Math.sin(a) * 19.5); }
    // flower beds and barrels
    const beds = [[-8, 22], [12, -24], [-22, -14], [18, 26], [-10, -40], [14, -44]];
    for (const [bx, bz] of beds) {
      const y = this.heightAt(bx, bz);
      this.put(GEO.cyl, 0x9a7a5a, bx, y + 0.3, bz, 2.0, 0.6, 2.0);
      this.put(GEO.cyl, 0x5a3a2a, bx, y + 0.62, bz, 1.8, 0.05, 1.8);
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = 0.4 + (k % 3) * 0.45; this.put(GEO.sph, [0xff6a8a, 0xffd84a, 0xffffff, 0xc87aff][k % 4], bx + Math.cos(a) * r, y + 0.9, bz + Math.sin(a) * r, 0.28, 0.24, 0.28); }
      this.blockCircle(bx, bz, 1.8);
    }
    const barrels = [[-20, 4], [-22, 5.5], [25, -6], [36, 8], [-38, -12], [10, 34], [-35, 36]];
    for (const [bx, bz] of barrels) { const y = this.heightAt(bx, bz); this.put(GEO.cyl, 0x9a6a40, bx, y + 0.6, bz, 0.6, 1.2, 0.6); this.put(GEO.cyl, 0x5a5a60, bx, y + 0.95, bz, 0.62, 0.08, 0.62); this.put(GEO.cyl, 0x5a5a60, bx, y + 0.3, bz, 0.62, 0.08, 0.62); this.blockCircle(bx, bz, 0.6); }
    // banners on poles around plaza
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 23, z = Math.sin(a) * 23;
      if (roadDist(x, z) < 5) continue;
      this.put(GEO.cyl6, 0x6a4430, x, 3, z, 0.1, 6, 0.1);
      this.put(GEO.box, [0xe84a5a, 0x4a8ae8, 0xf0b030][i % 3], x, 4.4, z, 0.05, 2.4, 1.2, 0, a, 0);
      this.blockCircle(x, z, 0.3);
    }
  }

  buildBridges() {
    for (const b of BRIDGES) {
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const x = b.x - b.len / 2 + i / n * b.len, y = bridgeDeckY(b, x);
        const slope = Math.atan2(1.4 * Math.PI / b.len * Math.cos(Math.PI * i / n), 1);
        this.put(GEO.box, i % 2 ? 0xb88050 : 0xa87048, x, y - 0.15, b.z, b.len / n + 0.05, 0.3, b.w, 0, 0, slope);
        if (i % 3 === 0) for (const s of [-1, 1]) {
          this.put(GEO.box, 0x7a4a30, x, y + 0.55, b.z + s * (b.w / 2 - 0.2), 0.25, 1.4, 0.25);
        }
      }
      for (const s of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          const x0 = b.x - b.len / 2 + i / n * b.len, x1 = x0 + b.len / n;
          const y0 = bridgeDeckY(b, x0), y1 = bridgeDeckY(b, x1);
          this.put(GEO.box, 0x8a5a3a, (x0 + x1) / 2, (y0 + y1) / 2 + 1.15, b.z + s * (b.w / 2 - 0.2), b.len / n + 0.06, 0.16, 0.16, 0, 0, Math.atan2(y1 - y0, x1 - x0));
        }
        // supports
        for (const k of [0.25, 0.5, 0.75]) { const x = b.x - b.len / 2 + k * b.len; this.put(GEO.cyl, 0x6a4a30, x, -1.6, b.z + s * (b.w / 2 - 0.4), 0.35, 4, 0.35); }
      }
    }
  }

  buildRuins() {
    const pillar = (x, z, h, broken) => {
      const y = this.heightAt(x, z);
      this.put(GEO.cyl, 0xc8c4b8, x, y + 0.3, z, 1.3, 0.6, 1.3);
      this.put(GEO.cyl, 0xd8d4c8, x, y + h / 2, z, 0.85, h, 0.85);
      if (!broken) { this.put(GEO.box, 0xc8c4b8, x, y + h + 0.3, z, 2.0, 0.6, 2.0); }
      else this.put(GEO.cyl, 0xd8d4c8, x + 1.5, y + 0.6, z + 0.6, 0.8, 2.6, 0.8, 0, 0.6, Math.PI / 2);
      this.put(GEO.sph, 0x6aa84a, x + 0.3, y + h * 0.4, z + 0.5, 0.6, 0.3, 0.5);
      this.blockCircle(x, z, 1.1);
    };
    const rng = mulberry(7);
    // scattered ruins
    for (let i = 0; i < 26; i++) {
      const x = -70 - rng() * 100, z = -80 + rng() * 170;
      if (roadDist(x, z) < 7 || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 6) continue;
      if (Math.max(Math.abs(x), Math.abs(z)) > 168) continue;
      pillar(x, z, 3 + rng() * 5, rng() < 0.5);
    }
    // broken walls
    for (let i = 0; i < 10; i++) {
      const x = -80 - rng() * 80, z = -60 + rng() * 140, r = rng() * Math.PI;
      if (roadDist(x, z) < 8 || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 8) continue;
      const y = this.heightAt(x, z), L = 5 + rng() * 6;
      this.put(GEO.box, 0xc8c0b0, x, y + 1.0, z, L, 2.0 + rng() * 1.5, 1.0, 0, r, 0);
      this.put(GEO.box, 0xd8d0c0, x + Math.cos(r) * L * 0.25, y + 2.6, z - Math.sin(r) * L * 0.25, L * 0.5, 1.0, 1.0, 0, r, 0);
      this.blockRect(x, z, L, 1.2, r);
    }
    // glowing rune stones
    for (let i = 0; i < 8; i++) {
      const x = -90 - rng() * 60, z = -40 + rng() * 120;
      if (roadDist(x, z) < 6) continue;
      const y = this.heightAt(x, z);
      this.put(GEO.box, 0x8a8478, x, y + 1.2, z, 1.2, 2.4, 0.6, 0, rng() * 3, 0.1);
      this.putGlow(GEO.box, 0x8af0ff, x, y + 1.4, z, 1.25, 0.12, 0.62, 0, 0, 0.1);
      this.blockCircle(x, z, 0.8);
    }
    // boss arena
    const st = stoneTexture().clone(); st.needsUpdate = true; st.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(ARENA.r, ARENA.r + 1, 0.6, 48), new THREE.MeshToonMaterial({ color: 0xc8c0d8, map: st, gradientMap: getGradient() }));
    floor.position.set(ARENA.x, 0.25, ARENA.z); floor.receiveShadow = true; this.scene.add(floor);
    const mc = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ map: magicCircleTexture('#c07aff'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    mc.rotation.x = -Math.PI / 2; mc.position.set(ARENA.x, 0.6, ARENA.z); this.scene.add(mc);
    this.anim.push((t) => { mc.rotation.z = -t * 0.15; });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const x = ARENA.x + Math.cos(a) * (ARENA.r + 1.5), z = ARENA.z + Math.sin(a) * (ARENA.r + 1.5);
      const toRoad = Math.atan2(-92 - ARENA.z, -146 - ARENA.x);
      if (Math.abs(Math.atan2(Math.sin(a - toRoad), Math.cos(a - toRoad))) < 0.35) continue;
      pillar(x, z, 6 + (i % 3) * 1.5, i % 4 === 1);
      this.putGlow(GEO.sph, 0xc07aff, x, this.heightAt(x, z) + 7.8 + (i % 3) * 1.5, z, 0.4, 0.4, 0.4);
    }
  }

  buildOverlook() {
    const { x, z } = OVERLOOK; const y = this.heightAt(x, z);
    this.put(GEO.cyl, 0xd8d0c4, x, y + 0.2, z, 8, 0.5, 8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, px = x + Math.cos(a) * 7, pz = z + Math.sin(a) * 7;
      if (Math.sin(a) > 0.8) continue;
      this.put(GEO.cyl6, 0xf4f0e8, px, y + 2.5, pz, 0.3, 4.6, 0.3);
      this.blockCircle(px, pz, 0.4);
    }
    this.put(GEO.cone8, 0x3ab0a0, x, y + 6.0, z, 8.6, 2.6, 8.6);
    this.put(GEO.sph, 0xf0c040, x, y + 7.5, z, 0.5, 0.5, 0.5);
  }

  buildTrees() {
    const rng = mulberry(42);
    const greens = [0x5cb84a, 0x6ac850, 0x4aa840, 0x7ad458];
    const tree = (x, z, kind, s) => {
      const y = this.heightAt(x, z) - 0.2;
      if (kind === 'pine') {
        this.put(GEO.cyl6, 0x7a5234, x, y + 1.2 * s, z, 0.35 * s, 2.4 * s, 0.35 * s);
        for (let i = 0; i < 3; i++) this.put(GEO.cone8, [0x3a8a4a, 0x429a52, 0x4aa85a][i], x, y + (3.0 + i * 1.6) * s, z, (2.6 - i * 0.6) * s, (3.0 - i * 0.3) * s, (2.6 - i * 0.6) * s);
      } else if (kind === 'blossom') {
        this.put(GEO.cyl6, 0x7a5234, x, y + 1.5 * s, z, 0.35 * s, 3 * s, 0.35 * s);
        const cols = [0xffb6d0, 0xffc8dc, 0xff9ac0];
        for (const [dx, dy, dz, r] of [[0, 3.8, 0, 2.2], [1.3, 3.3, 0.4, 1.6], [-1.2, 3.4, -0.3, 1.7], [0.2, 4.8, -0.2, 1.4]]) this.put(GEO.sph, cols[(Math.abs(dx * 3) | 0) % 3], x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.9, r * s);
      } else if (kind === 'big') {
        this.put(GEO.cyl, 0x6a4628, x, y + 3.5 * s, z, 0.9 * s, 7 * s, 0.9 * s);
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; this.put(GEO.cyl6, 0x6a4628, x + Math.cos(a) * 1.0 * s, y + 0.4 * s, z + Math.sin(a) * 1.0 * s, 0.35 * s, 1.6 * s, 0.35 * s, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
        for (const [dx, dy, dz, r] of [[0, 8.5, 0, 3.8], [2.5, 7.3, 0.8, 2.7], [-2.4, 7.5, -0.6, 2.9], [0.4, 10.2, -0.3, 2.6], [0.5, 7.4, 2.4, 2.4], [-0.6, 7.6, -2.5, 2.5]]) this.put(GEO.sph, greens[(Math.abs(dx * 7 + dz) | 0) % 4] - 0x101008, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.85, r * s);
      } else if (kind === 'olive') {
        this.put(GEO.cyl6, 0x8a6a48, x, y + 1.3 * s, z, 0.3 * s, 2.6 * s, 0.3 * s, 0, 0, 0.15);
        for (const [dx, dy, dz, r] of [[0.3, 3.0, 0, 1.4], [-0.8, 2.6, 0.4, 1.0], [0.8, 2.4, -0.6, 0.9]]) this.put(GEO.sph, 0x9ab048, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.8, r * s);
      } else {
        this.put(GEO.cyl6, 0x7a5234, x, y + 1.4 * s, z, 0.38 * s, 2.8 * s, 0.38 * s);
        const g = greens[(rng() * 4) | 0];
        for (const [dx, dy, dz, r] of [[0, 3.8, 0, 2.1], [1.2, 3.1, 0.4, 1.5], [-1.1, 3.2, -0.3, 1.6], [0.2, 4.7, -0.2, 1.3]]) this.put(GEO.sph, g, x + dx * s, y + dy * s, z + dz * s, r * s, r * s * 0.9, r * s);
      }
      this.blockCircle(x, z, (kind === 'big' ? 1.0 : 0.45) * s);
      this.treeSpots.push([x, z, kind, s]);
    };
    const ok = (x, z, spawns) => {
      if (Math.max(Math.abs(x), Math.abs(z)) > 172) return false;
      if (Math.hypot(x, z) < 64) return false;
      if (roadDist(x, z) < 7 || riverDist(x, z) < 11) return false;
      if (Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 6) return false;
      if (Math.hypot(x - OVERLOOK.x, z - OVERLOOK.z) < 20) return false;
      if (this.isBlocked(x, z)) return false;
      for (const s of spawns) if (Math.hypot(x - s.x, z - s.z) < s.r * 0.75) return false;
      return true;
    };
    const spawns = this.spawnAreas || [];
    let placed = 0;
    for (let i = 0; i < 3200 && placed < 330; i++) {
      const x = -175 + rng() * 350, z = -175 + rng() * 350;
      const forest = z > 60 && x < 85, ruins = x < -60, meadow = x > 75 && z < 70;
      const p = forest ? 0.55 : ruins ? 0.18 : meadow ? 0.08 : 0.22;
      if (rng() > p) continue;
      if (!ok(x, z, spawns)) continue;
      let kind = 'round';
      if (forest) kind = rng() < 0.35 ? 'big' : rng() < 0.5 ? 'pine' : 'round';
      else if (ruins) kind = rng() < 0.6 ? 'olive' : 'round';
      else if (z < -60) kind = rng() < 0.6 ? 'pine' : 'round';
      else if (rng() < 0.15) kind = 'blossom';
      tree(x, z, kind, 0.85 + rng() * 0.45);
      placed++;
    }
    // town trees
    for (const [x, z, k] of [[10, 28, 'blossom'], [-24, -42, 'round'], [26, -44, 'blossom'], [-48, 14, 'round'], [48, 46, 'round'], [-50, -36, 'pine'], [14, 50, 'blossom'], [-28, 46, 'blossom'], [50, -30, 'pine'], [-8, -52, 'round'], [8, -52, 'round']]) tree(x, z, k, k === 'blossom' ? 1.3 : 1.1);
    this.sacredTree = { x: 10, z: 28 };
  }

  buildGroundCover() {
    const rng = mulberry(99);
    const tuft = new THREE.ConeGeometry(0.12, 0.7, 3); tuft.translate(0, 0.35, 0);
    const pts = [];
    for (let i = 0; i < 9000 && pts.length < 4200; i++) {
      const x = -170 + rng() * 340, z = -170 + rng() * 340;
      if (Math.hypot(x, z) < 18 || roadDist(x, z) < 3.5 || riverDist(x, z) < 8 || Math.hypot(x - ARENA.x, z - ARENA.z) < ARENA.r + 1) continue;
      pts.push([x, z]);
    }
    const im = new THREE.InstancedMesh(tuft, new THREE.MeshLambertMaterial({ color: 0xffffff }), pts.length * 3);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let k = 0;
    for (const [x, z] of pts) {
      const y = this.heightAt(x, z), base = z > 60 && x < 85 ? 0x4a9a3a : x > 75 ? 0x8ad050 : 0x6ac048;
      for (let j = 0; j < 3; j++) {
        m.compose(new THREE.Vector3(x + (rng() - 0.5) * 0.5, y - 0.05, z + (rng() - 0.5) * 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.6, rng() * 3, (rng() - 0.5) * 0.6)), new THREE.Vector3(1, 0.7 + rng() * 0.8, 1));
        im.setMatrixAt(k, m); c.setHex(base).multiplyScalar(0.85 + rng() * 0.35); im.setColorAt(k, c); k++;
      }
    }
    im.instanceMatrix.needsUpdate = true; this.scene.add(im);
    // flowers
    const fgeo = new THREE.SphereGeometry(0.2, 6, 4); fgeo.scale(1, 0.6, 1); fgeo.translate(0, 0.25, 0);
    const fl = [];
    for (let i = 0; i < 6000 && fl.length < 2000; i++) {
      const x = -170 + rng() * 340, z = -170 + rng() * 340;
      if (Math.hypot(x, z) < 18 || roadDist(x, z) < 3.5 || riverDist(x, z) < 9) continue;
      const meadow = x > 70 || (Math.hypot(x, z) < 60);
      if (!meadow && rng() < 0.6) continue;
      fl.push([x, z]);
    }
    const fim = new THREE.InstancedMesh(fgeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), fl.length);
    const fcols = [0xff7aa0, 0xffe066, 0xffffff, 0xc89aff, 0x7ac8ff, 0xff9a5a];
    fl.forEach(([x, z], i) => {
      m.makeTranslation(x, this.heightAt(x, z), z); fim.setMatrixAt(i, m); fim.setColorAt(i, c.setHex(fcols[(rng() * fcols.length) | 0]));
    });
    fim.instanceMatrix.needsUpdate = true; this.scene.add(fim);
    // rocks
    for (let i = 0; i < 70; i++) {
      const x = -170 + rng() * 340, z = -170 + rng() * 340;
      if (Math.hypot(x, z) < 62 || roadDist(x, z) < 6 || riverDist(x, z) < 9 || this.isBlocked(x, z)) continue;
      const s = 0.6 + rng() * 1.4, y = this.heightAt(x, z);
      this.put(GEO.dode, 0xa8a49a, x, y + s * 0.3, z, s, s * 0.7, s * 1.1, rng(), rng() * 3, 0);
      if (s > 1.2) this.blockCircle(x, z, s * 0.8);
    }
  }

  buildBoundary() {
    const rng = mulberry(5);
    // big rocks along the edge
    for (let i = 0; i < 48; i++) {
      const side = i % 4, t = -175 + rng() * 350;
      const x = side === 0 ? 178 + rng() * 15 : side === 1 ? -178 - rng() * 15 : t;
      const z = side === 2 ? 178 + rng() * 15 : side === 3 ? -178 - rng() * 15 : t;
      const s = 4 + rng() * 5;
      this.put(GEO.dode, rng() < 0.5 ? 0x9a948a : 0x8a8a90, x, this.heightAt(x, z) + s * 0.2, z, s, s * 1.2, s, rng(), rng() * 3, rng());
    }
    // mountain wall hugging the map edge so the terrain never ends in a cliff
    const wallMat = [new THREE.MeshLambertMaterial({ color: 0x7aa078, flatShading: true }), new THREE.MeshLambertMaterial({ color: 0x8a9a88, flatShading: true })];
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xf4f8ff, flatShading: true });
    for (let side = 0; side < 4; side++) for (let k = -5; k <= 5; k++) {
      const t = k * 40 + (rng() - 0.5) * 14, off = 214 + rng() * 22;
      const x = side < 2 ? (side ? -off : off) : t, z = side < 2 ? t : (side === 2 ? off : -off);
      const north = side === 3 && Math.abs(t) < 90;
      const hgt = (north ? 45 : 60) + rng() * 45, w = 34 + rng() * 16;
      const m = new THREE.Mesh(new THREE.ConeGeometry(w, hgt, 6), wallMat[(rng() * 2) | 0]);
      m.position.set(x, hgt / 2 + 6, z); m.rotation.y = rng() * 3; this.scene.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, hgt * 0.32, 6), snowMat);
      cap.position.set(x, hgt + 6 - hgt * 0.16 + 0.3, z); cap.rotation.y = m.rotation.y; this.scene.add(cap);
    }
    // distant mountain ring
    for (let i = 0; i < 44; i++) {
      const a = i / 44 * Math.PI * 2 + rng() * 0.08, r = 270 + rng() * 80;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const north = z < 0 && Math.abs(x) < 120;
      const h = (north ? 50 : 80) + rng() * 70, w = 50 + rng() * 40;
      const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7), new THREE.MeshLambertMaterial({ color: rng() < 0.5 ? 0x6a9a7a : 0x5a8a8a, flatShading: true }));
      m.position.set(x, h / 2 - 10, z); m.rotation.y = rng() * 3; this.scene.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3, h * 0.3, 7), new THREE.MeshLambertMaterial({ color: 0xf4f8ff, flatShading: true }));
      cap.position.set(x, h - 10 - h * 0.15 + 0.5, z); cap.rotation.y = m.rotation.y; this.scene.add(cap);
    }
  }

  buildWorldTree() {
    const { x, z } = WORLD_TREE;
    const g = new THREE.Group(); g.position.set(x, -30, z);
    const bark = toon(0x8a6448);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(26, 44, 340, 18), bark); trunk.position.y = 170; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(6, 14, 120, 8), bark);
      r.position.set(Math.cos(a) * 52, 20, Math.sin(a) * 52); r.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(r);
    }
    const leafA = toon(0x7ad87a), leafB = toon(0x9ae88a), leafC = toon(0x5ac06a);
    const rng = mulberry(3);
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, r = rng() * 160, y = 330 + rng() * 120 - r * 0.35;
      const s = new THREE.Mesh(new THREE.SphereGeometry(55 + rng() * 45, 14, 10), [leafA, leafB, leafC][i % 3]);
      s.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(s);
    }
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(5, 10, 160, 8), bark);
      br.position.set(Math.cos(a) * 60, 300, Math.sin(a) * 60); br.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); g.add(br);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xd8ffd0, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    halo.scale.setScalar(700); halo.position.y = 360; g.add(halo);
    this.scene.add(g);
    this.worldTree = g;
  }

  buildIslands() {
    const rng = mulberry(11);
    this.islands = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.45 + rng() * 0.2, r = 300 + rng() * 120;
      const g = new THREE.Group(); const s = 10 + rng() * 14;
      const rock = new THREE.Mesh(new THREE.ConeGeometry(s, s * 2.2, 7), new THREE.MeshLambertMaterial({ color: 0x9a7a5a, flatShading: true })); rock.rotation.x = Math.PI; rock.position.y = -s * 1.1; g.add(rock);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.02, s, s * 0.35, 7), toon(0x7ad458)); top.position.y = s * 0.12; g.add(top);
      const tr = new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 10, 8), toon(0x5ab84a)); tr.position.set(s * 0.2, s * 0.9, 0); g.add(tr);
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.09, s * 0.7, 6), toon(0x7a5234)); tk.position.set(s * 0.2, s * 0.45, 0); g.add(tk);
      g.position.set(Math.cos(a) * r, 70 + rng() * 90, Math.sin(a) * r);
      g.userData.base = g.position.y; g.userData.ph = rng() * 6;
      this.scene.add(g); this.islands.push(g);
    }
  }

  finishBatches() {
    const toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getGradient() });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const om = outlineMaterial(0.05, 0x3a2a24);
    for (const { toon: tb, glow: gb } of this.batches.values()) {
      const g = tb.build();
      if (g) {
        const m = new THREE.Mesh(g, toonMat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
        const o = new THREE.Mesh(g, om); this.scene.add(o);
      }
      const gg = gb.build(); if (gg) this.scene.add(new THREE.Mesh(gg, glowMat));
    }
    // lamp halos
    const lm = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
    for (const [x, y, z] of this.lampGlows) { const s = new THREE.Sprite(lm); s.position.set(x, y, z); s.scale.setScalar(2.6); this.scene.add(s); }
  }

  buildAmbient() {
    // fountain spray
    const N = 160, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const spray = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xbfefff, size: 0.55, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.scene.add(spray);
    const reset = (i) => { pos[i * 3] = (Math.random() - 0.5) * 0.4; pos[i * 3 + 1] = 4.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4; const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 1.6; vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = 3 + Math.random() * 2.5; vel[i * 3 + 2] = Math.sin(a) * s; };
    for (let i = 0; i < N; i++) { reset(i); pos[i * 3 + 1] = 1 + Math.random() * 3; }
    this.anim.push((t, dt) => {
      for (let i = 0; i < N; i++) {
        vel[i * 3 + 1] -= 9 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 1.0) reset(i);
      }
      geo.attributes.position.needsUpdate = true;
    });
    // fireflies in the forest
    const F = 220, fp = new Float32Array(F * 3), fb = [];
    const rng = mulberry(17);
    for (let i = 0; i < F; i++) { const x = -60 + rng() * 140, z = 70 + rng() * 100; fb.push([x, z, rng() * 6]); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const ff = new THREE.Points(fg, new THREE.PointsMaterial({ map: glowTexture(), color: 0xd8ff7a, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(ff);
    this.anim.push((t) => {
      for (let i = 0; i < F; i++) { const [x, z, p] = fb[i]; fp[i * 3] = x + Math.sin(t * 0.5 + p) * 2; fp[i * 3 + 2] = z + Math.cos(t * 0.4 + p * 1.3) * 2; fp[i * 3 + 1] = this.heightAt(x, z) + 1.2 + Math.sin(t * 0.8 + p * 2) * 0.9; }
      fg.attributes.position.needsUpdate = true;
    });
    // butterflies
    const wingGeo = new THREE.PlaneGeometry(0.45, 0.35); wingGeo.translate(0.22, 0, 0);
    for (let i = 0; i < 18; i++) {
      const col = [0xffa8d8, 0xfff08a, 0x9ad8ff, 0xffffff, 0xffb86a][i % 5];
      const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
      const b = new THREE.Group(); const l = new THREE.Mesh(wingGeo, mat), r = new THREE.Mesh(wingGeo, mat); r.scale.x = -1; b.add(l); b.add(r);
      const cx = i < 8 ? (rng() - 0.5) * 80 : 80 + rng() * 70, cz = i < 8 ? (rng() - 0.5) * 80 : -40 + rng() * 100, ph = rng() * 6;
      this.scene.add(b);
      this.anim.push((t) => {
        const a = t * 0.4 + ph;
        b.position.set(cx + Math.cos(a) * 6, this.heightAt(cx, cz) + 1.5 + Math.sin(t * 1.3 + ph) * 0.6, cz + Math.sin(a * 1.3) * 6);
        b.rotation.y = -a; const f = Math.sin(t * 18 + ph) * 1.1; l.rotation.y = f; r.rotation.y = -f;
      });
    }
  }

  buildMinimap() {
    const S = 400; const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const col = this.terrain.geometry.attributes.color;
    const W = SEG + 1;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const ix = Math.min(SEG, Math.round(px / S * SEG)), iz = Math.min(SEG, Math.round(py / S * SEG));
      const i = iz * W + ix;
      const h = this.heights[i], hx = this.heights[iz * W + Math.min(SEG, ix + 1)];
      let r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
      if (h < WATER_Y) { r = 0.25; gg = 0.6; b = 0.88; }
      const shade = 1 + (h - hx) * 0.12;
      const o = (py * S + px) * 4;
      img.data[o] = Math.min(255, Math.pow(r, 1 / 2.2) * 255 * shade); img.data[o + 1] = Math.min(255, Math.pow(gg, 1 / 2.2) * 255 * shade); img.data[o + 2] = Math.min(255, Math.pow(b, 1 / 2.2) * 255 * shade); img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const toPx = (v) => (v + HALF) / SIZE * S;
    g.fillStyle = 'rgba(40,90,40,0.55)';
    for (const [x, z, , s] of this.treeSpots) { g.beginPath(); g.arc(toPx(x), toPx(z), 1.6 * s, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#c8b8a0'; g.beginPath(); g.arc(toPx(0), toPx(0), 17 / SIZE * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a6a5a'; g.strokeStyle = '#4a2a20'; g.lineWidth = 1;
    for (const b of this.buildings) {
      g.save(); g.translate(toPx(b.x), toPx(b.z)); g.rotate(-b.rot); g.fillRect(-b.w / 2, -b.d / 2, b.w, b.d); g.strokeRect(-b.w / 2, -b.d / 2, b.w, b.d); g.restore();
    }
    g.fillStyle = '#c8b8d8'; g.beginPath(); g.arc(toPx(ARENA.x), toPx(ARENA.z), ARENA.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b07a50';
    for (const b of BRIDGES) g.fillRect(toPx(b.x - b.len / 2), toPx(b.z - b.w / 2), b.len, b.w);
    this.minimapCanvas = c;
  }

  update(dt, t) {
    this.t = t;
    this.water.material.uniforms.uTime.value = t;
    for (const f of this.anim) f(t, dt);
    for (const c of this.clouds) { c.position.x += dt * 3; if (c.position.x > 800) c.position.x = -800; }
    for (const g of this.islands) { g.position.y = g.userData.base + Math.sin(t * 0.3 + g.userData.ph) * 3; g.rotation.y += dt * 0.02; }
  }
}

export function mulberry(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
