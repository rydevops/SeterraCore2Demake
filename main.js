'use strict';
/* Boot, render loop, title screen, pause menu, PWA update handling */
const canvas = $('c'), ctx = canvas.getContext('2d');

function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  G.f = canvas.height / 360; G.VW = canvas.width / G.f; G.VH = 360;
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200)); resize();

/* ---------- pause menu ---------- */
G.openMenu = () => {
  const m = $('menu'); G.uiOpen++; Snd.sfx('ui'); m.classList.remove('hidden');
  const render = () => {
    const p = G.pl;
    $('mstat').innerHTML = `<b>MAYA</b> &nbsp;Lv ${p.lv}<br>HP ${p.hp}/${p.maxhp} · EP ${p.ep}/${p.maxep}<br>ATK ${p.atk} · DEF ${p.def}<br>EXP ${p.exp}/${G.expNeed(p.lv)} · ${p.gold}G<br>Potion ×${p.items.potion} · Ether ×${p.items.ether}`;
    const box = $('mbtns'); box.innerHTML = '';
    const add = (t, fn, off) => { const b = document.createElement('button'); b.textContent = t; b.disabled = !!off; b.onclick = () => { Snd.sfx('ui'); fn(); }; box.appendChild(b); };
    add(`Use Potion (${p.items.potion})`, () => { p.items.potion--; p.hp = Math.min(p.maxhp, p.hp + 60); Snd.sfx('heal'); G.updateHud(); render(); }, !p.items.potion || p.hp >= p.maxhp);
    add(`Use Ether (${p.items.ether})`, () => { p.items.ether--; p.ep = Math.min(p.maxep, p.ep + 20); Snd.sfx('heal'); G.updateHud(); render(); }, !p.items.ether || p.ep >= p.maxep);
    add('Save', () => { G.save(); G.toast('Game saved'); });
    add(Snd.on ? 'Sound: On' : 'Sound: Off', () => { Snd.on = !Snd.on; render(); });
    add('Quit to Title', () => { close(); G.save(); showTitle(); });
    add('Resume', close);
  };
  const close = () => { m.classList.add('hidden'); G.uiOpen--; };
  render();
};

/* ---------- title screen ---------- */
function showTitle() {
  G.mode = 'title'; G.busy = false; $('title').classList.remove('hidden');
  ['hud', 'touch'].forEach(i => $(i).classList.add('hidden')); $('tCont').classList.toggle('hidden', !G.hasSave());
}
async function startGame(cont) {
  Snd.init(); Snd.sfx('ui'); const save = cont ? G.readSave() : null;
  if (!cont) G.clearSave();
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  $('title').classList.add('hidden');
  G.world.init(!save, save); G.mode = 'world'; ['hud', 'touch'].forEach(i => $(i).classList.remove('hidden')); $('btnMenu').classList.remove('hidden'); $('mini').classList.remove('hidden');
  if (!save) { G.busy = true; await G.say('<b>Maya</b> is a fighter from the Seterra Core.<br>A <b>Stone Guardian</b> awakens in the ruins to the south-east. Grow strong, then end it.<br><small>Drag on the left to move · A combo · S tech · RUN sprint · ☰ menu</small>', ['Begin']); G.busy = false; }
}
$('tNew').onclick = () => startGame(false); $('tCont').onclick = () => startGame(true);
$('ver').textContent = 'v' + (self.GAME_VERSION || '?');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (isIOS && !navigator.standalone) $('thint').textContent = 'Install: tap Share, then “Add to Home Screen” for fullscreen play.';

function drawTitle(c) {
  const W = G.VW, H = G.VH; let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1230'); g.addColorStop(.6, '#1c3b6e'); g.addColorStop(1, '#0d2a2a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 50; i++) c.fillRect((i * 137) % W, (i * 71) % (H * .6), 1.5, 1.5);
  c.fillStyle = '#0a1d1d'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 24) c.lineTo(x, H - 70 - 20 * Math.sin(x * .03)); c.lineTo(W, H); c.fill();
  const ai = Math.floor(G.t / 2.4) % 11, di = Math.floor(G.t / .3) % 8, x = W * .78, y = H * .76;
  shadow(c, x, y, 40); drawMaya(c, x, y, di, ai, animFrame(ai, G.t, ai === ANIM.run ? 10 : ai === 0 || ai === 1 ? 5 : 6, true), 1.5);
  c.font = '700 12px -apple-system,Helvetica,Arial,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#9fc4ff'; c.fillText(`${ANIM_NAMES[ai]} · ${DIR_NAMES[di]}`, x, y + 22);
}

/* ---------- main loop ---------- */
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (innerHeight > innerWidth) return;                 // portrait: paused behind the rotate overlay
  G.t += dt; G.tick(dt);
  ctx.setTransform(G.f, 0, 0, G.f, 0, 0); ctx.clearRect(0, 0, G.VW, G.VH); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (G.mode === 'title') drawTitle(ctx);
  else if (G.mode === 'battle') { G.battleUpdate(dt); G.battleDraw(ctx); }
  else { G.world.update(dt); G.updateFx(dt); G.world.draw(ctx); }
  if (G.reloadPending && (G.mode === 'title' || (G.mode === 'world' && !G.busy && !G.uiOpen))) { G.reloadPending = false; G.save(); location.reload(); }
}

canvas.addEventListener('pointerdown', e => {
  Snd.init(); const r = canvas.getBoundingClientRect();
  G.battleTap((e.clientX - r.left) / r.width * G.VW, (e.clientY - r.top) / r.height * G.VH);
});
['gesturestart', 'gesturechange'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
document.addEventListener('touchmove', e => { if (!e.target.closest('#menu,#dlg')) e.preventDefault(); }, { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
addEventListener('pagehide', () => G.save());
initTouch(); showTitle(); requestAnimationFrame(frame);

/* ---------- PWA: check for a new version on every open ---------- */
async function initUpdates() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    let hadController = !!navigator.serviceWorker.controller;
    const check = () => reg.update().catch(() => {});
    check();                                                           // every launch
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });   // every resume from background
    setInterval(check, 30 * 60 * 1000);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw) return; if (hadController) G.toast('New version found – downloading…', 4000);
      nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('SKIP_WAITING'); });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }             // first install claiming this page: nothing to refresh
      G.toast('Updated! Restarting…', 3000); G.reloadPending = true;     // reload at the next safe moment (not mid-battle)
    });
  } catch (e) { /* offline or unsupported */ }
}
initUpdates();
