'use strict';
/* Overworld: procedural map, tile art, player movement, encounters, towns, chests, boss */
const T = { GRASS: 0, TALL: 1, FOREST: 2, WATER: 3, SAND: 4, PATH: 5, ROCK: 6, FLOWER: 7, ROOF: 8, INN: 9, CAVE: 10, BRIDGE: 11,
  SHOP: 12, RUIN: 13, WALL: 14, PILLAR: 15, TOWN: 16, CAVEWALL: 17 };
const SOLID = new Set([T.FOREST, T.WATER, T.ROCK, T.ROOF, T.WALL, T.PILLAR, T.CAVEWALL]);
const MW = 64, MH = 48, TS = 32;
const TOWN_RECT = { x0: 3, y0: 3, x1: 21, y1: 17 };
const SPAWN = { tx: 11, ty: 12 };

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeNoise(seed) {
  const r = mulberry(seed), v = Array.from({ length: 4096 }, () => r()), s = t => t * t * (3 - 2 * t);
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const g = (a, b) => v[(b & 63) * 64 + (a & 63)];
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), xf), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), xf), yf); };
  return (x, y) => n(x, y) * .6 + n(x * 2, y * 2) * .3 + n(x * 4, y * 4) * .1;
}

/* ---------- Map generation ---------- */
function genMap() {
  const t = new Uint8Array(MW * MH), rnd = mulberry(1337), ne = makeNoise(11), nm = makeNoise(97);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < MW && y < MH) t[y * MW + x] = v; };
  const get = (x, y) => t[y * MW + x];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const e = ne(x / 9, y / 9), m = nm(x / 7, y / 7); let v = T.GRASS;
    if (e < .36) v = T.WATER; else if (e < .395) v = T.SAND; else if (e > .66) v = T.ROCK;
    else if (m > .6) v = T.FOREST; else if (m > .5) v = T.TALL; else if (rnd() < .05) v = T.FLOWER;
    set(x, y, v);
  }
  // town
  const R = TOWN_RECT;
  for (let y = R.y0; y <= R.y1; y++) for (let x = R.x0; x <= R.x1; x++) {
    const edge = x === R.x0 || x === R.x1 || y === R.y0 || y === R.y1;
    let v = rnd() < .08 ? T.FLOWER : T.GRASS;
    if ((x >= 8 && x <= 14 && y >= 8 && y <= 14) || (x >= 10 && x <= 12) || (y >= 10 && y <= 12)) v = T.TOWN;
    if (edge) v = T.FOREST;
    set(x, y, v);
  }
  for (let y = 10; y <= 12; y++) set(R.x1, y, T.TOWN);
  for (let x = 10; x <= 12; x++) set(x, R.y1, T.TOWN);
  const building = (x0, x1, y, door, dtype) => { for (let x = x0; x <= x1; x++) { set(x, y - 1, T.ROOF); set(x, y, T.WALL); } set(door, y, dtype); };
  building(6, 9, 7, 7, T.INN); building(14, 17, 7, 15, T.SHOP);
  // cave
  for (let y = 34; y <= 45; y++) for (let x = 3; x <= 24; x++) set(x, y, (x === 3 || x === 24 || y === 34 || y === 45) ? T.CAVEWALL : T.CAVE);
  const prot = (x, y) => (x >= 9 && x <= 13 && y >= 33) || (y >= 39 && y <= 42) || (x >= 18 && x <= 22 && y >= 39);
  for (let i = 0; i < 26; i++) { const cx = ri(5, 22), cy = ri(36, 44), r = ri(1, 2);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
      if (x > 3 && x < 24 && y > 34 && y < 45 && !prot(x, y) && Math.hypot(x - cx, y - cy) <= r + .3) set(x, y, T.CAVEWALL); }
  for (let x = 10; x <= 12; x++) set(x, 34, T.CAVE);
  // ruins
  for (let y = 28; y <= 41; y++) for (let x = 44; x <= 58; x++) set(x, y, (x === 44 || x === 58 || y === 28 || y === 41) ? T.ROCK : T.RUIN);
  for (let x = 48; x <= 50; x++) set(x, 28, T.RUIN);
  for (const [x, y] of [[47, 31], [55, 31], [47, 37], [55, 37]]) set(x, y, T.PILLAR);
  // roads
  const road = (x0, y0, x1, y1) => {
    const put = (x, y) => { const c = get(x, y); if (c === T.WATER) set(x, y, T.BRIDGE); else if (c !== T.TOWN && c !== T.BRIDGE) set(x, y, T.PATH); };
    for (let x = x0; x <= x1; x++) for (let w = -1; w <= 1; w++) put(x, y0 + w);
    for (let y = y0; y <= y1; y++) for (let w = -1; w <= 1; w++) put(x1 + w, y);
  };
  road(R.x1 + 1, 11, 49, 27); road(11, R.y1 + 1, 11, 33);
  // chests
  const clear = (x, y, v) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (get(x + dx, y + dy) !== T.CAVE && get(x + dx, y + dy) !== T.RUIN) set(x + dx, y + dy, v); };
  clear(34, 15, T.GRASS); for (let y = 13; y <= 15; y++) set(34, y, T.GRASS);
  // border
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) set(x, y, T.ROCK);
  G.map = { t, W: MW, H: MH };
  G.chestDefs = [
    { id: 'town', tx: 5, ty: 15, loot: { items: { potion: 2 }, gold: 0 } },
    { id: 'forest', tx: 34, ty: 15, loot: { gold: 45 } },
    { id: 'cave', tx: 20, ty: 41, loot: { items: { ether: 2 }, gold: 60 } },
    { id: 'ruin1', tx: 46, ty: 39, loot: { items: { potion: 3 }, gold: 0 } },
    { id: 'ruin2', tx: 56, ty: 39, loot: { items: { ether: 2 }, gold: 120 } }
  ];
  for (const c of G.chestDefs) { const v = c.id.startsWith('ruin') ? T.RUIN : c.id === 'cave' ? T.CAVE : c.id === 'town' ? T.GRASS : T.GRASS; set(c.tx, c.ty, v); }
  G.npcDefs = [
    { tx: 9, ty: 10, col: '#7a5ac8', hair: '#ddd', dialog: ["Welcome, Maya. The <b>Stone Guardian</b> sleeps in the ruins far to the south-east. Follow the road east, then south.", "Train in the tall grass first… and use the Inn when you're hurt."] },
    { tx: 17, ty: 13, col: '#c8587a', hair: '#5a2d1a', dialog: ["Tap <b>A</b> to throw a combo, <b>S</b> for a tech pose, and the <b>RUN</b> button to sprint!", "Chests hide potions and gold. I saw one west of the south road, in the cave."] },
    { tx: 20, ty: 10, col: '#3a7ac8', hair: '#222', dialog: ["Wolves prowl the tall grass. The cave in the south-west is crawling with bats and bones.", "Roads are safe. Grass is not."] }
  ];
}
const tileAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? T.ROCK : G.map.t[ty * MW + tx];
const inTown = (tx, ty) => tx >= TOWN_RECT.x0 && tx <= TOWN_RECT.x1 && ty >= TOWN_RECT.y0 && ty <= TOWN_RECT.y1;
function zoneAt(tx, ty) {
  if (inTown(tx, ty)) return null;
  switch (tileAt(tx, ty)) { case T.GRASS: case T.FLOWER: return 'grass'; case T.TALL: return 'tall'; case T.CAVE: return 'cave'; case T.RUIN: return 'ruin'; }
  return null;
}
G.zoneAt = zoneAt;

/* ---------- Tile art ---------- */
function paintTile(c, type, v, fr) {
  const r = mulberry(type * 131 + v * 17 + 5), S = TS;
  const grassBase = (a = '#4c8f3e', b = '#427f36') => { c.fillStyle = a; c.fillRect(0, 0, S, S); c.fillStyle = b; for (let i = 0; i < 10; i++) c.fillRect(r() * S, r() * S, 3, 2);
    c.fillStyle = '#62a850'; for (let i = 0; i < 8; i++) c.fillRect(r() * S, r() * S, 1.5, 3); };
  switch (type) {
    case T.GRASS: grassBase(); break;
    case T.FLOWER: grassBase(); for (let i = 0; i < 4; i++) { c.fillStyle = pick(['#ff7ab0', '#ffe14a', '#fff', '#b58cff']); const x = 4 + r() * 24, y = 4 + r() * 24; c.fillRect(x, y, 3, 3); c.fillStyle = '#ffd23f'; c.fillRect(x + 1, y + 1, 1, 1); } break;
    case T.TALL: grassBase('#3c7a35', '#2f6a2d'); c.strokeStyle = '#6fc25a'; c.lineWidth = 1.6;
      for (let i = 0; i < 16; i++) { const x = r() * S, y = 6 + r() * 26; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y - 9); c.moveTo(x, y); c.lineTo(x + 1, y - 11); c.moveTo(x, y); c.lineTo(x + 4, y - 8); c.stroke(); } break;
    case T.FOREST: grassBase('#3d7a35', '#2f6a2d'); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(16, 28, 13, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#5a3a1e'; c.fillRect(13, 18, 6, 12); const gs = ['#1f5a2a', '#2a7236', '#37893f'];
      [[16, 12, 12, 0], [9, 17, 9, 1], [23, 17, 9, 1], [16, 8, 8, 2]].forEach(([x, y, rr, k]) => { c.fillStyle = gs[k]; c.beginPath(); c.arc(x + (r() - .5) * 2, y, rr, 0, TAU); c.fill(); });
      c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(13, 7, 4, 0, TAU); c.fill(); break;
    case T.WATER: { const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#2f78bd'); g.addColorStop(1, '#215f9e'); c.fillStyle = g; c.fillRect(0, 0, S, S);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const y = 6 + i * 10 + (fr ? 2 : 0), x = 4 + r() * 8; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y - 3, x + 12, y); c.quadraticCurveTo(x + 18, y + 3, x + 22, y); c.stroke(); } break; }
    case T.SAND: c.fillStyle = '#dcc47e'; c.fillRect(0, 0, S, S); c.fillStyle = '#c4a95f'; for (let i = 0; i < 12; i++) c.fillRect(r() * S, r() * S, 2, 1.5); break;
    case T.PATH: c.fillStyle = '#b09062'; c.fillRect(0, 0, S, S); c.fillStyle = '#9a7c50'; for (let i = 0; i < 10; i++) c.fillRect(r() * S, r() * S, 3, 2); c.fillStyle = '#c9ab7c'; for (let i = 0; i < 8; i++) c.fillRect(r() * S, r() * S, 2, 2); break;
    case T.BRIDGE: c.fillStyle = '#215f9e'; c.fillRect(0, 0, S, S); c.fillStyle = '#8a5a2b'; c.fillRect(0, 2, S, 28); c.strokeStyle = '#5a3a1a'; c.lineWidth = 1.5;
      for (let x = 0; x < S; x += 8) { c.beginPath(); c.moveTo(x, 2); c.lineTo(x, 30); c.stroke(); } break;
    case T.ROCK: grassBase('#6b6f78', '#5a5e68'); c.fillStyle = '#80858f'; c.beginPath(); c.moveTo(0, 32); c.lineTo(8, 8 + r() * 4); c.lineTo(16, 2); c.lineTo(26, 10); c.lineTo(32, 32); c.fill();
      c.fillStyle = '#9aa0ab'; c.beginPath(); c.moveTo(16, 2); c.lineTo(26, 10); c.lineTo(20, 14); c.fill(); c.fillStyle = '#50545e'; c.beginPath(); c.moveTo(8, 12); c.lineTo(14, 4); c.lineTo(14, 32); c.lineTo(0, 32); c.fill(); break;
    case T.ROOF: c.fillStyle = '#a8442f'; c.fillRect(0, 0, S, S); c.fillStyle = '#8c3626'; for (let y = 0; y < S; y += 8) { c.fillRect(0, y + 6, S, 2); for (let x = (y / 8 % 2) * 8; x < S; x += 16) c.fillRect(x, y, 1.5, 6); } break;
    case T.WALL: case T.INN: case T.SHOP: c.fillStyle = '#e6d9bd'; c.fillRect(0, 0, S, S); c.fillStyle = '#c9b88f'; c.fillRect(0, 0, S, 3); c.fillRect(0, S - 2, S, 2);
      if (type === T.WALL) { c.fillStyle = '#7ab0d6'; c.fillRect(9, 8, 14, 12); c.strokeStyle = '#5a3a1e'; c.lineWidth = 2; c.strokeRect(9, 8, 14, 12); c.beginPath(); c.moveTo(16, 8); c.lineTo(16, 20); c.stroke(); }
      else { c.fillStyle = '#5a3a1e'; c.fillRect(6, 7, 20, 25); c.fillStyle = '#7a4e28'; c.fillRect(8, 9, 16, 23); c.fillStyle = '#ffd23f'; c.fillRect(21, 21, 2, 2);
        c.fillStyle = type === T.INN ? '#3a7ac8' : '#c88a2a'; c.fillRect(4, 0, 24, 8); c.fillStyle = '#fff'; c.font = '800 8px sans-serif'; c.textAlign = 'center'; c.fillText(type === T.INN ? 'INN' : 'SHOP', 16, 7); } break;
    case T.TOWN: c.fillStyle = '#cdbf9c'; c.fillRect(0, 0, S, S); c.strokeStyle = '#a89870'; c.lineWidth = 1;
      for (let y = 0; y < S; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke(); for (let x = (y / 8 % 2) * 8; x < S; x += 16) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 8); c.stroke(); } } break;
    case T.CAVE: c.fillStyle = '#3b3550'; c.fillRect(0, 0, S, S); c.fillStyle = '#2f2a42'; for (let i = 0; i < 9; i++) c.fillRect(r() * S, r() * S, 4, 3);
      c.strokeStyle = '#26213a'; c.lineWidth = 1; c.beginPath(); c.moveTo(r() * S, 0); c.lineTo(r() * S, S); c.stroke(); c.fillStyle = '#5a5278'; for (let i = 0; i < 3; i++) c.fillRect(r() * S, r() * S, 2, 2); break;
    case T.CAVEWALL: c.fillStyle = '#17131f'; c.fillRect(0, 0, S, S); c.fillStyle = '#251f33'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(r() * S, r() * S, 6 + r() * 5, 0, TAU); c.fill(); }
      c.fillStyle = '#322a45'; c.beginPath(); c.arc(8 + r() * 16, 8 + r() * 16, 4, 0, TAU); c.fill(); break;
    case T.RUIN: case T.PILLAR: c.fillStyle = '#8f8c9e'; c.fillRect(0, 0, S, S); c.strokeStyle = '#6f6c80'; c.lineWidth = 1.2; c.strokeRect(.5, .5, S - 1, S - 1);
      c.fillStyle = '#a3a0b4'; for (let i = 0; i < 6; i++) c.fillRect(r() * S, r() * S, 2, 2);
      if (v === 1 && type === T.RUIN) { c.strokeStyle = '#5a5870'; c.beginPath(); c.moveTo(4, 10); c.lineTo(14, 18); c.lineTo(10, 28); c.stroke(); }
      if (type === T.PILLAR) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(16, 29, 12, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#c4c1d4'; c.fillRect(8, 2, 16, 27); c.fillStyle = '#9d9ab0'; c.fillRect(19, 2, 5, 27); c.fillStyle = '#dedbee'; c.fillRect(5, 0, 22, 5); c.fillRect(5, 26, 22, 5); } break;
  }
}
function buildTileset() {
  const cv = document.createElement('canvas'); cv.width = 8 * TS; cv.height = 18 * TS; const c = cv.getContext('2d');
  for (let t = 0; t < 18; t++) for (let v = 0; v < 8; v++) { c.save(); c.translate(v * TS, t * TS); c.beginPath(); c.rect(0, 0, TS, TS); c.clip(); paintTile(c, t, v % 4, v >> 2); c.restore(); }
  G.tileset = cv;
}
function buildMinimap() {
  const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH; const c = cv.getContext('2d');
  const col = { 0: '#4c8f3e', 1: '#3c7a35', 2: '#245a2a', 3: '#2f78bd', 4: '#dcc47e', 5: '#b09062', 6: '#6b6f78', 7: '#4c8f3e', 8: '#a8442f', 9: '#3a7ac8', 10: '#3b3550', 11: '#8a5a2b', 12: '#c88a2a', 13: '#8f8c9e', 14: '#e6d9bd', 15: '#c4c1d4', 16: '#cdbf9c', 17: '#17131f' };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { c.fillStyle = col[tileAt(x, y)]; c.fillRect(x, y, 1, 1); }
  G.miniBase = cv;
}

/* ---------- Props ---------- */
function drawNpc(c, n, t) {
  const b = Math.sin(t * 2 + n.tx) * 1; shadow(c, n.x, n.y, 11);
  c.fillStyle = n.col; c.beginPath(); c.moveTo(n.x - 9, n.y); c.lineTo(n.x - 6, n.y - 24 + b); c.lineTo(n.x + 6, n.y - 24 + b); c.lineTo(n.x + 9, n.y); c.fill();
  ell(c, n.x, n.y - 30 + b, 7, 7.5, '#f0c9a0'); c.fillStyle = n.hair; c.beginPath(); c.arc(n.x, n.y - 32 + b, 7.5, Math.PI, TAU); c.fill();
  c.fillStyle = '#222'; c.fillRect(n.x - 3, n.y - 30 + b, 1.5, 2); c.fillRect(n.x + 2, n.y - 30 + b, 1.5, 2);
}
function drawChest(c, ch) {
  const x = ch.x, y = ch.y; shadow(c, x, y + 2, 13);
  c.fillStyle = '#7a4a1e'; c.fillRect(x - 11, y - 14, 22, 14); c.fillStyle = '#9a6228'; c.fillRect(x - 11, y - 14, 22, 5);
  if (ch.open) { c.fillStyle = '#5a3412'; c.fillRect(x - 11, y - 24, 22, 8); c.fillStyle = 'rgba(255,230,120,.5)'; c.fillRect(x - 9, y - 14, 18, 3); }
  else { c.fillStyle = '#b87a30'; c.fillRect(x - 11, y - 20, 22, 8); }
  c.fillStyle = '#ffd23f'; c.fillRect(x - 2, y - 11, 4, 5); c.fillRect(x - 11, y - 8, 22, 1.5);
}

/* ---------- Game state for world ---------- */
G.world = {
  init(newGame, save) {
    genMap(); buildTileset(); buildMinimap();
    const px = (save ? save.x : SPAWN.tx * TS + 16), py = (save ? save.y : SPAWN.ty * TS + 16);
    G.p = { x: px, y: py, dir: D.DOWN, moving: false, run: false, t: 0, act: null, combo: 0, comboT: 0, cd: 0 };
    G.pl = save ? save.pl : G.newPlayer(); G.flags = save ? (save.flags || {}) : {};
    G.chests = G.chestDefs.map(c => ({ ...c, x: c.tx * TS + 16, y: c.ty * TS + 28, open: !!G.flags['c_' + c.id] }));
    G.npcs = G.npcDefs.map(n => ({ ...n, x: n.tx * TS + 16, y: n.ty * TS + 28, i: 0 }));
    G.boss = { x: 51 * TS + 16, y: 34 * TS + 30 };
    G.stepAcc = 0; G.stepNeed = ri(8, 16); G.cam = { x: 0, y: 0 };
    G.updateHud();
  },
  blocked(x, y) {
    const pts = [[-7, -4], [7, -4], [-7, 0], [7, 0]];
    for (const [dx, dy] of pts) if (SOLID.has(tileAt(Math.floor((x + dx) / TS), Math.floor((y + dy) / TS)))) return true;
    for (const n of G.npcs) if (Math.hypot(n.x - x, n.y - y) < 13) return true;
    return false;
  },
  async update(dt) {
    const p = G.p; p.t += dt; p.comboT -= dt;
    if (p.act) { p.act.t += dt; if (p.act.t >= p.act.dur) p.act = null; }
    if (G.uiOpen || G.busy) { p.moving = false; return; }
    if (G.consume('menuPress')) { G.openMenu(); return; }
    if (p.act) return;
    const inp = G.readInput();
    if (G.consume('aPress')) {
      const n = G.npcs.find(n => Math.hypot(n.x - p.x, n.y - p.y) < 40);
      if (n) { p.dir = dirOf(n.x - p.x, n.y - p.y); p.moving = false; G.busy = true; Snd.sfx('ui');
        await G.say('<b>Villager</b><br>' + n.dialog[n.i++ % n.dialog.length]); G.busy = false; return; }
      if (p.comboT <= 0) p.combo = 0;
      const a = [ANIM.atk1, ANIM.atk2, ANIM.atk3][p.combo % 3]; Snd.sfx(['jab', 'kick', 'arc'][p.combo % 3]);
      p.act = { anim: a, t: 0, dur: .46, fps: 8, loop: false }; p.combo++; p.comboT = 1.1; p.moving = false; return;
    }
    if (G.consume('sPress')) { p.act = { anim: ANIM.tech, t: 0, dur: .9, fps: 4, loop: false }; Snd.sfx('tech'); p.moving = false; return; }
    p.moving = inp.m > 0; p.run = inp.run && p.moving;
    if (p.moving) {
      p.dir = dirOf(inp.x, inp.y);
      const sp = (p.run ? 150 : 82) * (inp.m < .5 ? .6 + inp.m : 1), dx = inp.x / inp.m * inp.m * sp * dt, dy = inp.y / inp.m * inp.m * sp * dt;
      const ox = p.x, oy = p.y;
      if (!this.blocked(p.x + dx, p.y)) p.x += dx;
      if (!this.blocked(p.x, p.y + dy)) p.y += dy;
      const moved = Math.hypot(p.x - ox, p.y - oy);
      if (moved > 0) this.afterMove(moved);
    }
  },
  async afterMove(dist) {
    const p = G.p, tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS), tt = tileAt(tx, ty);
    if (tt === T.INN) return this.inn();
    if (tt === T.SHOP) return this.shop();
    for (const c of G.chests) if (!c.open && Math.hypot(c.x - p.x, c.y - p.y) < 20) return this.openChest(c);
    if (!G.flags.boss && Math.hypot(G.boss.x - p.x, G.boss.y - p.y) < 40) return this.bossFight();
    const z = zoneAt(tx, ty);
    if (z) { G.stepAcc += dist / TS;
      if (G.stepAcc >= G.stepNeed) { G.stepAcc = 0; const [a, b] = ZONE_RATE[z]; G.stepNeed = ri(a, b); G.startBattle(z); } }
  },
  pushOut(tx, ty) { G.p.x = tx * TS + 16; G.p.y = (ty + 1) * TS + 12; G.p.dir = D.DOWN; G.p.moving = false; },
  async inn() {
    const p = G.p, dt = tileAt(Math.floor(p.x / TS), Math.floor(p.y / TS)); const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    G.busy = true; this.pushOut(tx, ty); Snd.sfx('ui');
    const pl = G.pl;
    const full = pl.hp >= pl.maxhp && pl.ep >= pl.maxep;
    const r = await G.say(`<b>Inn</b><br>${full ? 'You look well rested already.' : 'Rest for <b>20G</b> to fully recover HP and EP?'}<br><small>Gold: ${pl.gold}G</small>`, full ? ['Leave'] : ['Rest (20G)', 'Leave']);
    if (r === 0 && !full) {
      if (pl.gold < 20) await G.say('Not enough gold.');
      else { pl.gold -= 20; await G.fade(1, 500); pl.hp = pl.maxhp; pl.ep = pl.maxep; G.updateHud(); Snd.sfx('heal');
        p.act = { anim: ANIM.getup, t: 0, dur: 1.2, fps: 2.6, loop: false }; await G.fade(0, 500); G.save(); G.toast('Rested and saved. HP/EP restored!'); }
    }
    G.busy = false;
  },
  async shop() {
    const p = G.p, tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS); G.busy = true; this.pushOut(tx, ty); Snd.sfx('ui');
    for (;;) {
      const pl = G.pl;
      const r = await G.say(`<b>Shop</b><br>Potion (+60 HP) <b>15G</b> · Ether (+20 EP) <b>25G</b><br><small>Gold: ${pl.gold}G · Potions: ${pl.items.potion} · Ethers: ${pl.items.ether}</small>`, ['Buy Potion', 'Buy Ether', 'Leave']);
      if (r === 2) break;
      const [k, cost] = r === 0 ? ['potion', 15] : ['ether', 25];
      if (pl.gold < cost) { Snd.sfx('hurt'); G.toast('Not enough gold!'); } else { pl.gold -= cost; pl.items[k]++; Snd.sfx('chest'); G.updateHud(); G.save(); }
    }
    G.busy = false;
  },
  async openChest(c) {
    G.busy = true; c.open = true; G.flags['c_' + c.id] = 1; Snd.sfx('chest'); const p = G.p; p.moving = false;
    p.dir = D.DOWN; p.act = { anim: ANIM.win, t: 0, dur: 1.3, fps: 5, loop: true };
    const l = c.loot, parts = []; if (l.gold) { G.pl.gold += l.gold; parts.push(l.gold + 'G'); }
    for (const k in (l.items || {})) { G.pl.items[k] += l.items[k]; parts.push(l.items[k] + '× ' + (k === 'potion' ? 'Potion' : 'Ether')); }
    G.updateHud(); await G.wait(900);
    await G.say('<b>Treasure!</b><br>You found ' + parts.join(' and ') + '.'); G.save(); G.busy = false;
  },
  async bossFight() {
    G.busy = true; G.p.moving = false; Snd.sfx('enc'); G.shake = 8;
    await G.say('<b>The Stone Guardian awakens!</b><br>Its core glows with ancient power…');
    await G.startBattle('boss'); G.busy = false;
  },
  respawn() {            // after a defeat
    const p = G.p, pl = G.pl; p.x = SPAWN.tx * TS + 16; p.y = SPAWN.ty * TS + 16; p.dir = D.DOWN; p.moving = false;
    pl.hp = Math.ceil(pl.maxhp / 2); pl.ep = Math.ceil(pl.maxep / 2); pl.gold = Math.floor(pl.gold / 2); G.updateHud();
    p.act = { anim: ANIM.getup, t: 0, dur: 1.4, fps: 2.2, loop: false }; G.save();
  },
  draw(c) {
    const p = G.p, W = G.VW, H = G.VH;
    const cx = G.cam.x = clamp(Math.round(p.x - W / 2), 0, MW * TS - W), cy = G.cam.y = clamp(Math.round(p.y - H / 2 - 10), 0, MH * TS - H);
    const fr = Math.floor(G.t * 2) % 2, x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS), x1 = Math.ceil((cx + W) / TS), y1 = Math.ceil((cy + H) / TS);
    c.save(); c.translate(-cx, -cy);
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
      const t = tileAt(tx, ty), v = ((tx * 73856093) ^ (ty * 19349663)) >>> 0, col = (v % 4) + (t === T.WATER ? fr * 4 : 0);
      c.drawImage(G.tileset, col * TS, t * TS, TS, TS, tx * TS, ty * TS, TS, TS);
    }
    const ents = [];
    for (const n of G.npcs) ents.push({ y: n.y, f: () => drawNpc(c, n, G.t) });
    for (const ch of G.chests) ents.push({ y: ch.y, f: () => drawChest(c, ch) });
    if (!G.flags.boss) ents.push({ y: G.boss.y, f: () => { c.save(); c.translate(G.boss.x, G.boss.y); c.scale(.62, .62); ell(c, 0, 0, 44, 12, 'rgba(0,0,0,.35)'); ENEMY_ART.guardian(c, G.t * .6); c.restore(); } });
    ents.push({ y: p.y, f: () => this.drawPlayer(c) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
    c.restore();
    const g = c.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, W * .65); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.38)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    this.drawMini();
  },
  drawPlayer(c) {
    const p = G.p; let anim = ANIM.idle, fps = 4, loop = true, t = p.t, dir = p.dir;
    if (p.act) { anim = p.act.anim; fps = p.act.fps; loop = p.act.loop; t = p.act.t; }
    else if (p.moving) { anim = p.run ? ANIM.run : ANIM.walk; fps = p.run ? 10 : 7; }
    shadow(c, p.x, p.y, 13);
    drawMaya(c, p.x, p.y, dir, anim, animFrame(anim, t, fps, loop), .5);
  },
  drawMini() {
    const m = $('mini').getContext('2d'); m.drawImage(G.miniBase, 0, 0);
    m.fillStyle = '#ff3b3b'; m.fillRect(Math.floor(G.p.x / TS) - 1, Math.floor(G.p.y / TS) - 1, 3, 3);
    if (!G.flags.boss) { m.fillStyle = '#ffd23f'; m.fillRect(51, 34, 2, 2); }
    m.fillStyle = '#4ad8ff'; for (const c of G.chests) if (!c.open) m.fillRect(c.tx, c.ty, 2, 2);
  }
};
