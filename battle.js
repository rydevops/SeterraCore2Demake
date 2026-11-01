'use strict';
/* Turn-based battle: Maya uses every animation (run in/out, 3 attacks, special, damage, fall, victory) */
let B = null;
G.B = () => B;

function drawBattleBg(c, zone, W, H, t) {
  const gy = 212;
  if (zone === 'cave') {
    let g = c.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, '#120e22'); g.addColorStop(1, '#2d2347'); c.fillStyle = g; c.fillRect(0, 0, W, gy);
    c.fillStyle = '#0c0916'; for (let x = -20; x < W + 40; x += 46) { const h = 30 + 26 * Math.abs(Math.sin(x * .37)); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 46, 0); c.lineTo(x + 23, h); c.fill(); }
    g = c.createLinearGradient(0, gy, 0, H); g.addColorStop(0, '#3b3352'); g.addColorStop(1, '#1d1830'); c.fillStyle = g; c.fillRect(0, gy, W, H - gy);
    c.fillStyle = 'rgba(120,200,255,.5)'; for (let i = 0; i < 14; i++) c.fillRect((i * 97 + 31) % W, 40 + (i * 53) % 150 + Math.sin(t + i) * 3, 2, 2);
  } else if (zone === 'ruin' || zone === 'boss') {
    let g = c.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, '#2b1f4d'); g.addColorStop(1, '#d9755a'); c.fillStyle = g; c.fillRect(0, 0, W, gy);
    c.fillStyle = '#ffd9a0'; c.beginPath(); c.arc(W * .7, 110, 34, 0, TAU); c.fill();
    c.fillStyle = '#3d3552'; for (let i = 0; i < 6; i++) { const x = i * W / 5.4 + 20; c.fillRect(x, 70 + (i % 2) * 24, 26, gy - 70); c.fillRect(x - 5, 66 + (i % 2) * 24, 36, 8); }
    g = c.createLinearGradient(0, gy, 0, H); g.addColorStop(0, '#8d8aa0'); g.addColorStop(1, '#4f4c66'); c.fillStyle = g; c.fillRect(0, gy, W, H - gy);
    c.strokeStyle = 'rgba(0,0,0,.25)'; for (let y = gy + 18; y < H; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  } else {
    let g = c.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, '#6bb7ef'); g.addColorStop(1, '#d6f0ff'); c.fillStyle = g; c.fillRect(0, 0, W, gy);
    c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 4; i++) { const x = (i * 260 + t * 6) % (W + 120) - 60; ell(c, x, 50 + i * 14, 46, 13, 'rgba(255,255,255,.8)'); ell(c, x + 28, 44 + i * 14, 28, 11, 'rgba(255,255,255,.8)'); }
    c.fillStyle = '#5c9a68'; c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= W; x += 20) c.lineTo(x, gy - 40 - 24 * Math.sin(x * .012 + 1)); c.lineTo(W, gy); c.fill();
    c.fillStyle = '#3f7a48'; c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= W; x += 20) c.lineTo(x, gy - 14 - 12 * Math.sin(x * .02)); c.lineTo(W, gy); c.fill();
    g = c.createLinearGradient(0, gy, 0, H); g.addColorStop(0, zone === 'tall' ? '#3f8a3c' : '#55a447'); g.addColorStop(1, '#2c6a2d'); c.fillStyle = g; c.fillRect(0, gy, W, H - gy);
    c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, gy + i * 26); c.lineTo(W, gy + i * 26); c.stroke(); }
  }
}

function setAnim(m, anim, dir, fps, loop) { m.anim = anim; m.dir = dir; m.fps = fps; m.loop = loop; m.t = 0; }
const alive = () => B.enemies.filter(e => !e.dead);
const msg = t => { $('bmsg').textContent = t; $('bmsg').classList.toggle('hidden', !t); };

function formation(n, boss) {
  const bx = G.VW * .66;
  if (boss) return [[G.VW * .7, 268]];
  return [[[bx, 258]], [[bx - 26, 236], [bx + 30, 282]], [[bx - 40, 232], [bx + 24, 258], [bx - 40, 284]]][n - 1];
}

G.startBattle = async function (zone) {
  if (G.mode === 'battle') return;
  G.busy = true; G.mode = 'trans'; Snd.sfx('enc');
  for (let i = 0; i < 3; i++) { await G.fade(1, 80, '#fff'); await G.fade(0, 80, '#fff'); }
  await G.fade(1, 300, '#000');
  // build battle
  const boss = zone === 'boss', n = boss ? 1 : pick([1, 2, 2, 3, 3]);
  const types = boss ? ['guardian'] : Array.from({ length: n }, () => pick(ZONES[zone]));
  const pos = formation(n, boss), counts = {}, seen = {};
  types.forEach(t => counts[t] = (counts[t] || 0) + 1);
  const enemies = types.map((t, i) => { const d = ENEMIES[t]; seen[t] = (seen[t] || 0) + 1;
    return { type: t, def: d, name: d.name + (counts[t] > 1 ? ' ' + 'ABC'[seen[t] - 1] : ''), hp: d.hp, max: d.hp, x: pos[i][0] + 160, y: pos[i][1], ox: 0, alpha: 1, flash: 0, ph: rand(0, 6), dead: false }; });
  const hx = G.VW * .22, hy = 262;
  B = { zone, boss, enemies, guard: false, selecting: false, maya: { x: hx - 160, y: hy, hx, hy, dir: D.R, anim: ANIM.run, t: 0, fps: 11, loop: true, alpha: 1 } };
  G.fx.parts.length = G.fx.texts.length = 0; G.mode = 'battle'; document.body.classList.add('inb');
  $('touch').classList.add('hidden'); $('mini').classList.add('hidden'); $('btnMenu').classList.add('hidden'); $('bui').classList.remove('hidden');
  G.updateHud(); $('bcmd').innerHTML = ''; msg('');
  await G.fade(0, 350, '#000');
  Snd.sfx('enc');
  await Promise.all([G.tween(B.maya, { x: hx }, 600, 'out'), ...enemies.map((e, i) => G.tween(e, { x: pos[i][0] }, 600 + i * 120, 'out'))]);
  setAnim(B.maya, ANIM.idle, D.R, 4, true);
  msg(boss ? 'The Stone Guardian blocks your path!' : enemies.length > 1 ? `${enemies.length} enemies appear!` : `A ${enemies[0].name} appears!`);
  await G.wait(700);
  await battleLoop();
};

async function battleLoop() {
  const pl = G.pl, M = B.maya;
  for (;;) {
    const a = await playerTurn();
    const res = await perform(a);
    if (res === 'ran') return endBattle('run');
    if (!alive().length) return victory();
    for (const e of alive()) { await enemyTurn(e); if (pl.hp <= 0) return defeat(); await G.wait(120); }
    B.guard = false; setAnim(M, ANIM.idle, D.R, 4, true);
  }
}

/* ---------- player menu ---------- */
function cmds(items) {
  const box = $('bcmd'); box.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button'); b.innerHTML = `${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}`; b.disabled = !!it.off;
    b.onclick = () => { Snd.sfx('ui'); it.fn(); }; box.appendChild(b);
  }
}
function playerTurn() {
  return new Promise(resolve => {
    const pl = G.pl;
    const main = () => { msg('What will Maya do?'); B.selecting = false; cmds([
      { label: 'Fight', sub: 'Attacks', fn: fight }, { label: 'Tech', sub: '10 EP', off: pl.ep < 10, fn: () => target({ type: 'tech' }, main) },
      { label: 'Item', sub: `🧪${pl.items.potion} ⚡${pl.items.ether}`, fn: items }, { label: 'Guard', sub: '+3 EP', fn: () => resolve({ type: 'guard' }) },
      { label: 'Run', sub: B.boss ? 'No escape' : '', off: B.boss, fn: () => resolve({ type: 'run' }) }]); };
    const fight = () => cmds([
      { label: 'Jab', sub: 'Fight 1 · +2 EP', fn: () => target({ type: 'atk1' }, fight) },
      { label: 'Kick', sub: 'Fight 2 · 3 EP', off: pl.ep < 3, fn: () => target({ type: 'atk2' }, fight) },
      { label: 'Arc Burst', sub: 'Fight 3 · 6 EP · all', off: pl.ep < 6, fn: () => resolve({ type: 'atk3' }) },
      { label: '◀ Back', fn: main }]);
    const items = () => cmds([
      { label: 'Potion', sub: `+60 HP · ×${pl.items.potion}`, off: !pl.items.potion || pl.hp >= pl.maxhp, fn: () => resolve({ type: 'item', k: 'potion' }) },
      { label: 'Ether', sub: `+20 EP · ×${pl.items.ether}`, off: !pl.items.ether || pl.ep >= pl.maxep, fn: () => resolve({ type: 'item', k: 'ether' }) },
      { label: '◀ Back', fn: main }]);
    const target = (act, back) => {
      const al = alive(); if (al.length === 1) { act.t = al[0]; return resolve(act); }
      msg('Choose a target (tap an enemy)'); B.selecting = true;
      B.pick = e => { B.selecting = false; B.pick = null; act.t = e; resolve(act); };
      cmds([...al.map(e => ({ label: e.name, sub: `${e.hp}/${e.max}`, fn: () => B.pick(e) })), { label: '◀ Back', fn: () => { B.selecting = false; B.pick = null; back(); } }]);
    };
    main();
  });
}

/* ---------- actions ---------- */
function calc(atk, mult, def) { const crit = Math.random() < .1; let d = Math.max(1, Math.round(atk * mult * rand(.85, 1.15) - def * .6)); if (crit) d = Math.round(d * 1.6); return { d, crit }; }
function hurtEnemy(e, mult, col = '#fff') {
  const { d, crit } = calc(G.pl.atk, mult, e.def.def); e.hp = Math.max(0, e.hp - d); e.flash = 1; G.shake = Math.max(G.shake, crit ? 9 : 5);
  G.floatText(e.x, e.y - 78 * e.def.s, d, crit ? '#ffd23f' : '#fff', crit); G.spark(e.x, e.y - 40 * e.def.s, col, crit ? 22 : 12); G.slash(e.x, e.y - 40 * e.def.s, rand(-.4, .4), col);
  if (e.hp <= 0) { e.dead = true; G.tween(e, { alpha: 0 }, 650, 'lin'); G.spark(e.x, e.y - 30, '#fff', 26, 200); }
}
async function runTo(M, x, y, ms = 300) {
  const dir = dirOf(x - M.x, y - M.y); setAnim(M, ANIM.run, dir, 12, true); await G.tween(M, { x, y }, ms, 'io'); return dir;
}
async function runHome(M, fromDir) {
  setAnim(M, ANIM.run, OPP(fromDir), 12, true); await G.tween(M, { x: M.hx, y: M.hy }, 300, 'io'); setAnim(M, ANIM.idle, D.R, 4, true);
}
async function perform(a) {
  const M = B.maya, pl = G.pl; M.dir = D.R; $('bcmd').innerHTML = '';
  switch (a.type) {
    case 'atk1': case 'atk2': {
      const e = a.t, k = a.type === 'atk1'; msg(k ? 'Jab!' : 'Kick!'); pl.ep = Math.max(0, pl.ep - (k ? 0 : 3)); if (k) pl.ep = Math.min(pl.maxep, pl.ep + 2); G.updateHud();
      const d = await runTo(M, e.x - 58 * e.def.s - 10, clamp(e.y, 232, 290));
      setAnim(M, k ? ANIM.atk1 : ANIM.atk2, d, k ? 10 : 8, false); Snd.sfx(k ? 'jab' : 'kick'); await G.wait(k ? 130 : 190); hurtEnemy(e, k ? 1 : 1.7); await G.wait(k ? 260 : 330);
      await runHome(M, d); break;
    }
    case 'atk3': {
      msg('Arc Burst!'); pl.ep -= 6; G.updateHud(); const al = alive(), mx = Math.min(...al.map(e => e.x)), my = al.reduce((s, e) => s + e.y, 0) / al.length;
      const d = await runTo(M, mx - 90, clamp(my, 240, 285), 380);
      setAnim(M, ANIM.atk3, D.R, 6, false); Snd.sfx('arc'); G.ring(M.x + 30, M.y - 30, 90, '#7fd0ff', .5); await G.wait(220);
      for (const e of al) { hurtEnemy(e, 1.15, '#7fd0ff'); G.ring(e.x, e.y - 10, 50, '#7fd0ff', .4); } await G.wait(480);
      await runHome(M, d); break;
    }
    case 'tech': {
      const e = a.t; msg('Special Tech: Overdrive!'); pl.ep -= 10; G.updateHud(); setAnim(M, ANIM.tech, D.R, 3.6, false); Snd.sfx('tech');
      G.ring(M.x, M.y - 10, 70, '#7fd0ff', .8); await G.wait(500); G.ring(M.x, M.y - 10, 100, '#bfe9ff', .7); await G.wait(300);
      G.bolt(e.x, e.y - 20); G.ring(e.x, e.y, 80, '#9be7ff', .6); G.shake = 14; hurtEnemy(e, 3.6, '#9be7ff'); await G.wait(250); hurtEnemy(e, 1.2, '#9be7ff'); await G.wait(500);
      setAnim(M, ANIM.idle, D.R, 4, true); break;
    }
    case 'guard': msg('Maya braces for impact.'); B.guard = true; pl.ep = Math.min(pl.maxep, pl.ep + 3); G.updateHud(); setAnim(M, ANIM.hurt, D.R, 0.0001, false);
      G.ring(M.x, M.y - 30, 44, '#7fd0ff', .6); Snd.sfx('ui'); await G.wait(650); break;
    case 'item': {
      setAnim(M, ANIM.win, D.DOWN, 5, true); pl.items[a.k]--; Snd.sfx('heal');
      if (a.k === 'potion') { const h = Math.min(60, pl.maxhp - pl.hp); pl.hp += h; msg('Potion: +' + h + ' HP'); G.floatText(M.x, M.y - 110, '+' + h, '#6bff8f', true); }
      else { const h = Math.min(20, pl.maxep - pl.ep); pl.ep += h; msg('Ether: +' + h + ' EP'); G.floatText(M.x, M.y - 110, '+' + h + ' EP', '#7fd0ff', true); }
      G.updateHud(); G.ring(M.x, M.y - 10, 50, '#6bff8f', .7); await G.wait(900); setAnim(M, ANIM.idle, D.R, 4, true); break;
    }
    case 'run': {
      if (Math.random() < .65) { msg('Maya escaped!'); setAnim(M, ANIM.run, D.L, 12, true); await G.tween(M, { x: -80 }, 650, 'in'); return 'ran'; }
      msg("Couldn't get away!"); await G.wait(700); break;
    }
  }
  if (alive().length) await G.wait(150);
}
EASE.in = t => t * t;

async function enemyTurn(e) {
  const M = B.maya, pl = G.pl, heavy = e.def.boss && Math.random() < .4;
  msg(heavy ? `${e.name} unleashes Crushing Blow!` : `${e.name} attacks!`);
  const dist = e.x - M.x - 50;
  if (heavy) { await G.tween(e, { ox: 30 }, 350, 'out'); G.shake = 6; }
  await G.tween(e, { ox: -dist }, heavy ? 160 : 260, 'in');
  if (Math.random() < .06) { G.floatText(M.x, M.y - 100, 'MISS', '#ccc'); }
  else {
    let { d, crit } = calc(e.def.atk, heavy ? 1.9 : 1, pl.def); if (B.guard) d = Math.max(1, Math.round(d * .45));
    pl.hp = Math.max(0, pl.hp - d); G.updateHud(); G.shake = heavy ? 14 : 7; Snd.sfx('hurt');
    G.floatText(M.x, M.y - 100, d, B.guard ? '#7fd0ff' : '#ff6b6b', crit); G.spark(M.x, M.y - 50, '#ff6b6b', 12);
    if (pl.hp > 0) { if (!B.guard) setAnim(M, ANIM.hurt, D.R, 7, false); }
  }
  await G.tween(e, { ox: 0 }, 260, 'out'); await G.wait(pl.hp > 0 ? 260 : 100);
  if (pl.hp > 0 && !B.guard) setAnim(M, ANIM.idle, D.R, 4, true);
}

/* ---------- outcomes ---------- */
async function endBattle(how) {
  await G.fade(1, 350, '#000');
  $('bui').classList.add('hidden'); $('bcmd').innerHTML = ''; msg('');
  $('touch').classList.remove('hidden'); $('mini').classList.remove('hidden'); $('btnMenu').classList.remove('hidden');
  G.mode = 'world'; B = null; document.body.classList.remove('inb'); G.updateHud();
  if (how === 'lose') { G.world.respawn(); } G.save();
  await G.fade(0, 350, '#000'); G.busy = false;
  if (how === 'lose') G.toast('Maya wakes up at the Inn… half her gold is gone.', 3200);
}
async function victory() {
  const M = B.maya, pl = G.pl; await G.wait(500);
  msg('Victory!'); Snd.sfx('win'); setAnim(M, ANIM.win, D.DOWN, 5, true);
  let exp = 0, gold = 0, drops = 0; for (const e of B.enemies) { exp += e.def.exp; gold += e.def.gold; if (Math.random() < .15 || e.def.boss) drops++; }
  pl.gold += gold; pl.items.potion += drops; const ups = G.gainExp(exp); G.updateHud();
  if (ups) { Snd.sfx('lvl'); G.floatText(M.x, M.y - 120, 'LEVEL UP!', '#ffd23f', true); G.ring(M.x, M.y - 10, 70, '#ffd23f', .9); }
  await G.wait(900);
  let t = `<b>Victory!</b><br>+${exp} EXP · +${gold}G${drops ? ` · +${drops} Potion` : ''}`;
  if (ups) t += `<br><b style="color:#ffd23f">Level up! Maya is now Lv ${pl.lv}</b><br><small>HP ${pl.maxhp} · EP ${pl.maxep} · ATK ${pl.atk} · DEF ${pl.def}</small>`;
  if (B.boss) { G.flags.boss = 1; t += '<br><br>The Stone Guardian crumbles. The ruins fall silent…<br><small>You beat the game! Keep exploring and grinding.</small>'; }
  await G.say(t); await endBattle('win');
}
async function defeat() {
  const M = B.maya; msg('Maya falls…'); Snd.sfx('lose'); setAnim(M, ANIM.fall, D.R, 3, false); await G.wait(1700);
  await endBattle('lose');
}

/* ---------- update / draw ---------- */
G.battleUpdate = dt => {
  if (!B) return; B.maya.t += dt; for (const e of B.enemies) if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 5); G.updateFx(dt);
};
G.battleDraw = c => {
  if (!B) return; const W = G.VW, H = G.VH, M = B.maya;
  c.save(); if (G.shake > 0) c.translate(rand(-G.shake, G.shake) * .5, rand(-G.shake, G.shake) * .5);
  drawBattleBg(c, B.zone, W, H, G.t);
  const ents = B.enemies.map(e => ({ y: e.y, f: () => drawEnemy(c, e, G.t) }));
  ents.push({ y: M.y, f: () => { shadow(c, M.x, M.y, 27); drawMaya(c, M.x, M.y, M.dir, M.anim, animFrame(M.anim, M.t, M.fps, M.loop), 1, M.alpha); } });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
  for (const e of alive()) {     // hp bars + target arrows
    const bw = 46, bx = e.x + e.ox - bw / 2, by = e.y - 92 * e.def.s - (e.type === 'bat' ? 0 : 0);
    c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 1, by - 1, bw + 2, 7); c.fillStyle = e.hp / e.max > .4 ? '#5cd65c' : '#e85050'; c.fillRect(bx, by, bw * e.hp / e.max, 5);
    c.font = '700 10px -apple-system,Helvetica,Arial,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 3; c.strokeText(e.name, e.x, by - 4); c.fillText(e.name, e.x, by - 4);
    if (B.selecting) { const ay = by - 18 + Math.sin(G.t * 8) * 3; poly(c, [e.x - 7, ay - 8, e.x + 7, ay - 8, e.x, ay + 2], '#ffd23f'); }
  }
  G.drawFx(c); c.restore();
};
// tap an enemy to target it
G.battleTap = (x, y) => {
  if (!B || !B.selecting || !B.pick) return;
  for (const e of alive()) if (Math.abs(x - e.x) < 44 * e.def.s && y > e.y - 100 * e.def.s && y < e.y + 14) { Snd.sfx('ui'); return B.pick(e); }
};
