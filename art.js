'use strict';
/* Procedural enemy art + battle effects. Enemies are drawn facing left, origin = feet centre. */
const ell = (c, x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
const poly = (c, pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); };
const eye = (c, x, y, r, col = '#fff', p = '#111') => { ell(c, x, y, r, r, col); ell(c, x - r * .25, y, r * .5, r * .5, p); };

const ENEMY_ART = {
  slime(c, t) {
    const sq = 1 + Math.sin(t * 4) * .09;
    ell(c, 0, -15 * sq, 25 / sq, 18 * sq, '#4fd36a'); ell(c, -6, -22 * sq, 9, 5, 'rgba(255,255,255,.45)');
    ell(c, 0, -3, 25, 4, 'rgba(20,90,40,.5)'); eye(c, -8, -17 * sq, 4.5); eye(c, 7, -17 * sq, 4.5);
    c.strokeStyle = '#1d6b33'; c.lineWidth = 2; c.beginPath(); c.arc(0, -10 * sq, 5, .2, Math.PI - .2); c.stroke();
  },
  bat(c, t) {
    const fl = Math.sin(t * 14) * 14, y = -44 + Math.sin(t * 3) * 5;
    poly(c, [-6, y, -34, y - 14 + fl, -24, y + 8, -14, y + 4], '#5b3a86'); poly(c, [6, y, 34, y - 14 + fl, 24, y + 8, 14, y + 4], '#5b3a86');
    ell(c, 0, y, 11, 13, '#3c2560'); poly(c, [-9, y - 8, -6, y - 22, -2, y - 9], '#3c2560'); poly(c, [9, y - 8, 6, y - 22, 2, y - 9], '#3c2560');
    ell(c, -4, y - 2, 2.5, 2.5, '#ff4d5e'); ell(c, 4, y - 2, 2.5, 2.5, '#ff4d5e'); poly(c, [-3, y + 5, 0, y + 11, 3, y + 5], '#fff');
  },
  wolf(c, t) {
    const b = Math.sin(t * 5) * 1.5;
    c.fillStyle = '#6b7280'; c.fillRect(-22, -16, 6, 16); c.fillRect(-6, -16, 6, 16); c.fillRect(12, -16, 6, 16); c.fillRect(24, -16, 6, 16);
    ell(c, 6, -26 + b, 28, 16, '#8b93a1'); poly(c, [30, -34 + b, 44, -22 + b, 32, -16 + b], '#8b93a1');
    ell(c, -26, -38 + b, 14, 12, '#9aa2b0'); poly(c, [-40, -38 + b, -58, -30 + b, -38, -28 + b], '#9aa2b0');
    poly(c, [-30, -46 + b, -28, -62 + b, -20, -48 + b], '#6b7280'); ell(c, -57, -31 + b, 3, 2.5, '#111'); ell(c, -29, -40 + b, 3, 2.2, '#ffd23f');
    poly(c, [-50, -26 + b, -46, -20 + b, -43, -26 + b], '#fff');
  },
  goblin(c, t) {
    const b = Math.sin(t * 5) * 1.5;
    c.fillStyle = '#5b3a1e'; c.fillRect(-12, -14, 8, 14); c.fillRect(4, -14, 8, 14);
    ell(c, 0, -28 + b, 15, 16, '#8a5a2b'); ell(c, 0, -52 + b, 13, 12, '#79c34a');
    poly(c, [-12, -54 + b, -28, -60 + b, -12, -46 + b], '#79c34a'); poly(c, [12, -54 + b, 28, -60 + b, 12, -46 + b], '#79c34a');
    eye(c, -5, -53 + b, 3.4, '#ffe97a'); eye(c, 5, -53 + b, 3.4, '#ffe97a');
    c.save(); c.translate(-20, -30 + b); c.rotate(-.6 + Math.sin(t * 5) * .1); c.fillStyle = '#7a4a1e'; c.fillRect(-3, -24, 7, 34); ell(c, 0, -26, 8, 10, '#8b5a2b'); c.restore();
  },
  spider(c, t) {
    c.strokeStyle = '#1a1325'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const a = Math.sin(t * 8 + i) * 4;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6, -22); c.quadraticCurveTo(s * (26 + i * 4), -48 + i * 6 + a, s * (34 + i * 3), -2); c.stroke(); } }
    ell(c, 10, -24, 18, 14, '#2b1f40'); ell(c, -12, -26, 11, 9, '#3a2a58');
    ell(c, -16, -29, 2.5, 2.5, '#ff3b3b'); ell(c, -10, -29, 2.5, 2.5, '#ff3b3b'); ell(c, 14, -26, 6, 4, '#7a2b8f');
  },
  skeleton(c, t) {
    const b = Math.sin(t * 4) * 1.5;
    c.fillStyle = '#e8e4d4'; c.fillRect(-9, -22, 5, 22); c.fillRect(4, -22, 5, 22);
    for (let i = 0; i < 4; i++) c.fillRect(-12, -52 + i * 7 + b, 24, 3);
    c.fillRect(-2, -56 + b, 4, 30); ell(c, 0, -68 + b, 12, 12, '#f4f1e4'); c.fillStyle = '#f4f1e4'; c.fillRect(-7, -60 + b, 14, 7);
    ell(c, -4, -69 + b, 3.2, 3.8, '#1b1b2b'); ell(c, 4, -69 + b, 3.2, 3.8, '#1b1b2b');
    c.save(); c.translate(-14, -50 + b); c.rotate(-.9 + Math.sin(t * 4) * .1); c.fillStyle = '#c0c8d8'; c.fillRect(-2, -34, 5, 40); c.fillStyle = '#6b4a2a'; c.fillRect(-6, 4, 13, 4); c.restore();
  },
  wraith(c, t) {
    const y = -50 + Math.sin(t * 2.5) * 6;
    c.globalAlpha = .85; c.fillStyle = '#4b3a8f'; c.beginPath(); c.moveTo(-26, y + 44);
    for (let i = 0; i <= 6; i++) c.lineTo(-26 + i * 8.7, y + 44 + (i % 2 ? 10 : 0) + Math.sin(t * 5 + i) * 3);
    c.lineTo(22, y - 4); c.quadraticCurveTo(0, y - 36, -22, y - 4); c.closePath(); c.fill(); c.globalAlpha = 1;
    ell(c, 0, y - 6, 12, 13, '#1a1030'); ell(c, -5, y - 8, 3.3, 4, '#7dffe9'); ell(c, 5, y - 8, 3.3, 4, '#7dffe9');
    c.strokeStyle = '#2a1d55'; c.lineWidth = 4; c.beginPath(); c.moveTo(-30, y + 6); c.lineTo(-48, y + 24); c.stroke();
  },
  guardian(c, t) {
    const b = Math.sin(t * 2) * 2, g = '#7d8798', d = '#566074', l = '#9aa6bb';
    c.fillStyle = d; c.fillRect(-30, -34, 22, 34); c.fillRect(8, -34, 22, 34);
    c.fillStyle = g; c.fillRect(-36, -86 + b, 72, 56); c.fillStyle = l; c.fillRect(-36, -86 + b, 72, 8);
    c.fillStyle = d; c.fillRect(-60, -84 + b, 22, 46); c.fillRect(38, -84 + b, 22, 46); c.fillStyle = g; c.fillRect(-64, -40 + b, 28, 24); c.fillRect(36, -40 + b, 28, 24);
    c.fillStyle = g; c.fillRect(-20, -118 + b, 40, 34); c.fillStyle = l; c.fillRect(-20, -118 + b, 40, 6);
    const glow = .6 + Math.sin(t * 4) * .3; ell(c, 0, -62 + b, 9, 9, `rgba(80,230,255,${glow})`);
    ell(c, -8, -102 + b, 4, 3.5, '#6ff3ff'); ell(c, 8, -102 + b, 4, 3.5, '#6ff3ff');
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(-36, -86 + b, 72, 56);
  },
  chest(c) { ell(c, 0, -4, 18, 5, 'rgba(0,0,0,.3)'); }
};

/* ---------- Enemy catalogue ---------- */
const ENEMIES = {
  slime:    { name: 'Slime',    hp: 20,  atk: 7,  def: 1,  exp: 6,  gold: 4,  s: 1 },
  bat:      { name: 'Bat',      hp: 16,  atk: 9,  def: 0,  exp: 7,  gold: 5,  s: 1 },
  goblin:   { name: 'Goblin',   hp: 38,  atk: 12, def: 3,  exp: 14, gold: 11, s: 1 },
  wolf:     { name: 'Wolf',     hp: 34,  atk: 13, def: 2,  exp: 15, gold: 9,  s: 1 },
  spider:   { name: 'Cave Spider', hp: 46, atk: 15, def: 3, exp: 20, gold: 13, s: 1 },
  skeleton: { name: 'Skeleton', hp: 62,  atk: 18, def: 5,  exp: 28, gold: 18, s: .95 },
  wraith:   { name: 'Wraith',   hp: 56,  atk: 21, def: 4,  exp: 34, gold: 22, s: 1 },
  guardian: { name: 'Stone Guardian', hp: 380, atk: 28, def: 9, exp: 220, gold: 250, s: 1.35, boss: true }
};
const ZONES = {
  grass: ['slime', 'slime', 'bat', 'goblin'],
  tall:  ['wolf', 'goblin', 'bat', 'slime', 'wolf'],
  cave:  ['bat', 'spider', 'spider', 'skeleton'],
  ruin:  ['skeleton', 'wraith', 'wraith', 'spider']
};
const ZONE_RATE = { grass: [14, 30], tall: [6, 13], cave: [5, 10], ruin: [6, 11] };

/* offscreen scratch canvas so enemies can be flashed / faded as a unit */
const scratch = document.createElement('canvas'); scratch.width = 220; scratch.height = 220;
const sc = scratch.getContext('2d');
function drawEnemy(c, e, t) {
  sc.clearRect(0, 0, 220, 220); sc.save(); sc.translate(110, 180);
  if (e.type !== 'chest') ell(sc, 0, 0, 24 * e.def.s, 7 * e.def.s, 'rgba(0,0,0,.3)');
  ENEMY_ART[e.type](sc, t + e.ph); sc.restore();
  if (e.flash > 0) { sc.globalCompositeOperation = 'source-atop'; sc.fillStyle = `rgba(255,255,255,${Math.min(1, e.flash)})`; sc.fillRect(0, 0, 220, 220); sc.globalCompositeOperation = 'source-over'; }
  c.save(); c.globalAlpha = e.alpha; c.translate(e.x + e.ox, e.y); c.scale(e.def.s, e.def.s);
  c.drawImage(scratch, -110, -180); c.restore();
}

/* ---------- Effects ---------- */
const FX = G.fx = { parts: [], texts: [], rings: [], bolts: [], slashes: [] };
G.spark = (x, y, col = '#fff', n = 12, sp = 160) => { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(.3, 1) * sp;
  FX.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: rand(.3, .6), max: .6, col, sz: rand(1.5, 3.5) }); } };
G.floatText = (x, y, txt, col = '#fff', big = false) => FX.texts.push({ x, y, txt, col, life: 1, big });
G.ring = (x, y, max, col, life = .5) => FX.rings.push({ x, y, max, col, life, l0: life });
G.bolt = (x, y, col = '#9be7ff') => FX.bolts.push({ x, y, col, life: .35, seed: Math.random() * 99 });
G.slash = (x, y, ang, col = '#fff') => FX.slashes.push({ x, y, ang, col, life: .22 });
G.updateFx = dt => {
  FX.parts = FX.parts.filter(p => (p.life -= dt) > 0 && (p.x += p.vx * dt, p.y += p.vy * dt, p.vy += 360 * dt, true));
  FX.texts = FX.texts.filter(t => (t.life -= dt * .9) > 0 && (t.y -= 34 * dt, true));
  FX.rings = FX.rings.filter(r => (r.life -= dt) > 0);
  FX.bolts = FX.bolts.filter(b => (b.life -= dt) > 0);
  FX.slashes = FX.slashes.filter(s => (s.life -= dt) > 0);
};
G.drawFx = c => {
  for (const r of FX.rings) { const k = 1 - r.life / r.l0; c.globalAlpha = 1 - k; c.strokeStyle = r.col; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.ellipse(r.x, r.y, r.max * k, r.max * k * .45, 0, 0, TAU); c.stroke(); }
  for (const b of FX.bolts) { c.globalAlpha = Math.min(1, b.life * 4); c.strokeStyle = b.col; c.lineWidth = 4; c.shadowColor = b.col; c.shadowBlur = 12; c.beginPath(); let y = b.y - 220, x = b.x; c.moveTo(x, y);
    for (let i = 0; i < 8; i++) { y += 28; x = b.x + Math.sin(b.seed + i * 3.1 + G.t * 60) * 14; c.lineTo(x, y); } c.stroke(); c.shadowBlur = 0; }
  for (const s of FX.slashes) { const k = 1 - s.life / .22; c.globalAlpha = 1 - k; c.strokeStyle = s.col; c.lineWidth = 5 * (1 - k) + 1; c.beginPath();
    c.arc(s.x, s.y, 30, s.ang - .9 + k * .8, s.ang + .2 + k * .8); c.stroke(); }
  c.globalAlpha = 1;
  for (const p of FX.parts) { c.globalAlpha = clamp(p.life / p.max, 0, 1); c.fillStyle = p.col; c.fillRect(p.x, p.y, p.sz, p.sz); }
  c.globalAlpha = 1; c.textAlign = 'center'; c.lineJoin = 'round';
  for (const t of FX.texts) { c.globalAlpha = clamp(t.life * 1.6, 0, 1); c.font = `800 ${t.big ? 26 : 19}px -apple-system,Helvetica,Arial,sans-serif`;
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)'; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.col; c.fillText(t.txt, t.x, t.y); }
  c.globalAlpha = 1;
};
