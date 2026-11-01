'use strict';
/* Core: globals, sprite helpers, audio, tweens, input, save, small UI helpers */
const G = window.G = { VW: 640, VH: 360, f: 1, TS: 32, mode: 'title', t: 0, uiOpen: 0,
  waiters: [], tweens: [], flags: {}, shake: 0 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Sprite sheet (24 x 11 atlas of 128px cells) ---------- */
const ANIM = { idle: 0, walk: 1, run: 2, atk1: 3, atk2: 4, atk3: 5, hurt: 6, fall: 7, getup: 8, win: 9, tech: 10 };
const ANIM_NAMES = ['Idle', 'Walk', 'Run', 'Fight 1', 'Fight 2', 'Fight 3', 'Damage', 'Fall', 'Get Up', 'Victory', 'Special'];
// direction indices follow the sheet's column order
const D = { DOWN: 0, DL: 1, L: 2, UL: 3, U: 4, UR: 5, R: 6, DR: 7 };
const DIR_NAMES = ['Down', 'Down-Left', 'Left', 'Up-Left', 'Up', 'Up-Right', 'Right', 'Down-Right'];
const SECT = [6, 7, 0, 1, 2, 3, 4, 5];            // angle sector (0 = east, clockwise on screen) -> sheet dir
const dirOf = (dx, dy) => SECT[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
const OPP = d => (d + 4) % 8;
G.sheet = new Image();
G.sheet.src = 'assets/maya.png';

function animFrame(anim, t, fps, loop = true) {
  const n = Math.floor(t * fps);
  if (anim === ANIM.idle || anim === ANIM.walk) return [0, 1, 2, 1][n % 4];
  return loop ? n % 3 : Math.min(2, n);
}
function drawMaya(c, x, y, dir, anim, frame, scale, alpha = 1) {
  if (!G.sheet.complete || !G.sheet.naturalWidth) return;
  c.save();
  c.globalAlpha = alpha;
  c.drawImage(G.sheet, (dir * 3 + frame) * 128, anim * 128, 128, 128, x - 64 * scale, y - 112 * scale, 128 * scale, 128 * scale);
  c.restore();
}
function shadow(c, x, y, r) {
  c.fillStyle = 'rgba(0,0,0,.32)';
  c.beginPath(); c.ellipse(x, y, r, r * 0.34, 0, 0, TAU); c.fill();
}

/* ---------- Time helpers (driven by the game loop, not timers) ---------- */
G.wait = ms => new Promise(r => G.waiters.push({ t: ms / 1000, r }));
const EASE = { lin: t => t, out: t => 1 - (1 - t) * (1 - t), io: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };
G.tween = (o, to, ms, ease = 'io') => new Promise(r => {
  const from = {}; for (const k in to) from[k] = o[k];
  G.tweens.push({ o, from, to, t: 0, d: ms / 1000, ease: EASE[ease], r });
});
G.tick = dt => {
  for (let i = G.waiters.length - 1; i >= 0; i--) { const w = G.waiters[i]; w.t -= dt; if (w.t <= 0) { G.waiters.splice(i, 1); w.r(); } }
  for (let i = G.tweens.length - 1; i >= 0; i--) {
    const w = G.tweens[i]; w.t += dt; const k = clamp(w.t / w.d, 0, 1), e = w.ease(k);
    for (const p in w.to) w.o[p] = lerp(w.from[p], w.to[p], e);
    if (k >= 1) { G.tweens.splice(i, 1); w.r(); }
  }
  G.shake = Math.max(0, G.shake - dt * 30);
};

/* ---------- Audio (tiny synth, no asset files) ---------- */
const Snd = {
  ctx: null, on: true,
  init() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  tone(f, d, type = 'square', v = .07, slide = 0, delay = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + d + .02);
  },
  noise(d, v = .1, delay = 0) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx, n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; g.gain.value = v;
    s.connect(g); g.connect(c.destination); s.start(c.currentTime + delay);
  },
  sfx(n) {
    switch (n) {
      case 'ui': this.tone(660, .06, 'square', .05); break;
      case 'jab': this.tone(300, .08, 'sawtooth', .06, -150); this.noise(.07, .08, .03); break;
      case 'kick': this.tone(220, .12, 'sawtooth', .07, -120); this.noise(.12, .11, .04); break;
      case 'arc': this.tone(500, .3, 'sine', .08, 700); this.noise(.2, .08, .1); break;
      case 'tech': this.tone(180, .6, 'sawtooth', .08, 900); this.tone(900, .5, 'sine', .06, -600, .2); this.noise(.4, .12, .35); break;
      case 'hurt': this.tone(160, .18, 'square', .08, -90); this.noise(.1, .1); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, .14, 'sine', .07, 0, i * .08)); break;
      case 'lvl': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .2, 'square', .06, 0, i * .1)); break;
      case 'win': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, .22, 'square', .06, 0, i * .11)); break;
      case 'enc': this.tone(120, .5, 'sawtooth', .08, 600); this.noise(.3, .1); break;
      case 'chest': [440, 554, 659].forEach((f, i) => this.tone(f, .12, 'triangle', .08, 0, i * .08)); break;
      case 'lose': [330, 262, 220, 165].forEach((f, i) => this.tone(f, .3, 'triangle', .08, 0, i * .18)); break;
    }
  }
};
G.Snd = Snd;

/* ---------- Input ---------- */
const IN = G.in = { sx: 0, sy: 0, kx: 0, ky: 0, run: false, runToggle: false, aHeld: false, aPress: false, sPress: false, menuPress: false };
const keys = {};
addEventListener('keydown', e => {
  Snd.init();
  if (keys[e.code]) return; keys[e.code] = true;
  if (['Space', 'Enter', 'KeyZ'].includes(e.code)) IN.aPress = true;
  if (['KeyX', 'KeyC'].includes(e.code)) IN.sPress = true;
  if (['Escape', 'KeyM'].includes(e.code)) IN.menuPress = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
G.readInput = () => {
  const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let x = IN.sx + kx, y = IN.sy + ky, m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; m = 1; }
  const run = IN.runToggle || keys.ShiftLeft || keys.ShiftRight || m > 0.88 && (IN.sx || IN.sy);
  return { x, y, m, run };
};
G.consume = k => { const v = IN[k]; IN[k] = false; return v; };

/* touch joystick: any touch on the left half acts as a floating stick */
function initTouch() {
  const zone = $('stickzone'), base = $('stickbase'), knob = $('stickknob');
  let id = null, ox = 0, oy = 0; const R = 46;
  zone.addEventListener('pointerdown', e => {
    Snd.init(); id = e.pointerId; zone.setPointerCapture(id); ox = e.clientX; oy = e.clientY;
    base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const m = Math.hypot(dx, dy);
    if (m > R) { dx = dx / m * R; dy = dy / m * R; }
    knob.style.transform = `translate(calc(${dx}px - 50%),calc(${dy}px - 50%))`;
    const k = Math.hypot(dx, dy) / R; IN.sx = k < .2 ? 0 : dx / R; IN.sy = k < .2 ? 0 : dy / R;
  });
  const end = e => { if (e.pointerId !== id) return; id = null; IN.sx = IN.sy = 0; base.classList.remove('on'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  const press = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); fn(); });
  press($('bA'), () => { IN.aPress = true; });
  press($('bS'), () => { IN.sPress = true; });
  press($('bRun'), () => { IN.runToggle = !IN.runToggle; $('bRun').classList.toggle('on', IN.runToggle); });
  press($('btnMenu'), () => { IN.menuPress = true; });
}

/* ---------- Save / load ---------- */
const SAVE_KEY = 'maya-rpg-save-v1';
G.hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
G.save = () => {
  if (!G.pl || !G.p) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, pl: G.pl, x: G.p.x, y: G.p.y, flags: G.flags })); } catch (e) {}
};
G.readSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } };
G.clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };

/* ---------- Player stats ---------- */
G.newPlayer = () => ({ lv: 1, exp: 0, hp: 60, maxhp: 60, ep: 20, maxep: 20, atk: 12, def: 4, gold: 20, items: { potion: 3, ether: 1 } });
G.expNeed = lv => 20 * lv + 5 * lv * lv;
G.gainExp = n => {            // returns number of levels gained
  const p = G.pl; p.exp += n; let up = 0;
  while (p.lv < 30 && p.exp >= G.expNeed(p.lv)) {
    p.exp -= G.expNeed(p.lv); p.lv++; up++;
    p.maxhp += 14; p.maxep += 3; p.atk += 3; p.def += 2; p.hp = Math.min(p.maxhp, p.hp + 20); p.ep = Math.min(p.maxep, p.ep + 5);
  }
  return up;
};

/* ---------- UI helpers ---------- */
G.say = (text, choices = ['OK']) => new Promise(res => {
  const d = $('dlg'), c = $('dch'); $('dtxt').innerHTML = text; c.innerHTML = '';
  G.uiOpen++;
  choices.forEach((ch, i) => {
    const b = document.createElement('button'); b.textContent = ch;
    b.onclick = () => { d.classList.add('hidden'); G.uiOpen--; Snd.sfx('ui'); res(i); };
    c.appendChild(b);
  });
  d.classList.remove('hidden');
});
let toastT = 0;
G.toast = (msg, ms = 2200) => {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), ms);
};
G.updateHud = () => {
  const p = G.pl; if (!p) return;
  $('hlv').textContent = 'Lv ' + p.lv; $('hgold').textContent = p.gold + 'G';
  $('hpb').style.width = (p.hp / p.maxhp * 100) + '%'; $('hpt').textContent = `HP ${p.hp}/${p.maxhp}`;
  $('epb').style.width = (p.ep / p.maxep * 100) + '%'; $('ept').textContent = `EP ${p.ep}/${p.maxep}`;
};
G.fade = async (to, ms = 350, color = '#000') => {
  const f = $('fade'); f.style.background = color; f.style.transition = `opacity ${ms}ms linear`;
  f.style.opacity = to; await G.wait(ms);
};
