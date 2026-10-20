/* ══ Orbi's Claw ═════════════════════════════════════════════════════════════════════════════════════════
   The bot's full page (orbi/main.js opens it): a 5-beat personalised "Wrapped" intro built from the order
   history, then "Pick of the day" — a dark stage (after the user's CRED "Deal of the day" reference): a chrome
   serif headline, a swipeable 3D carousel of five metallic cards (one per world of real noon products), each
   previewing its best offer, and a gold GRAB button. GRAB → the carousel spins like a slot reel onto Orbi's
   pick, Orbi flies over it and lowers a claw, which clamps the card and lifts it while the rest fall away; the
   card bursts into a full-screen flood of its colour (light rays, sparkles), flips, and its back becomes the
   hero of that world's discovery page (claw/discover.js) — a page made for the set, not a PLP.
   Motion: the noon standard (~/.claude/skills/noon_sas_motion) — MOVE spring 280.6/27.14 for anything that
   moves (the carousel settles on it too), out-cubic 200 ms fades in, in-out-cubic fades out, 60 ms stagger in /
   25 ms out, EXPAND (0.4, 0.01, 0, 1.01) for the flood, a livelier spring (ζ .55) only for rewards; the claw
   (cable, pendulum, prongs) is integrated per frame. Orbi is the host throughout: it operates the claw, narrates,
   and follows you down the discovery page. ══ */
import { SETS } from './catalog.js';
import { mountDiscover } from './discover.js';
import { mountStory } from './story.js';

// ─── who it's for: a 2026 order history (demo data) and what it adds up to ──────────────────────────────
const USER = { name: 'Saswata' };
const HISTORY = { tech: 14, gym: 11, scents: 8, glow: 7, home: 7 };         // orders per set this year
const SAVED = 1240;                                                         // AED saved on deals, coupons & noon One
const ORDERS = Object.values(HISTORY).reduce((a, b) => a + b, 0);           // 47
const RANKED = Object.entries(HISTORY).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ set: SETS.find((s) => s.id === id), n }));
const ADJ = { gym: 'Gym-Going', tech: 'Tech-Savvy', scents: 'Fragrant', glow: 'Glowing', home: 'Home-Loving' };
const NOUN = { gym: 'Athlete', tech: 'Gadget Geek', scents: 'Scent Collector', glow: 'Glow Getter', home: 'Home Chef' };
const VIBE = `The ${ADJ[RANKED[1].set.id]} ${NOUN[RANKED[0].set.id]}`;      // e.g. "The Gym-Going Gadget Geek"
const EVERY = Math.round(365 / ORDERS);

// each world's card: a metallic gradient (the reference's foil cards), the glow its pages are lit with, and
// the best offer inside it (the deepest discount among its products)
const LOOK = {
  gym: { grad: 'linear-gradient(125deg, #0b6b4a 0%, #19a873 48%, #0e5e43 100%)', glow: '#19a873', cap: 'GYM ESSENTIALS' },
  tech: { grad: 'linear-gradient(125deg, #1f5fa5 0%, #59b6e8 50%, #2a73b8 100%)', glow: '#3d9be0', cap: 'AUDIO & WEARABLES' },
  scents: { grad: 'linear-gradient(125deg, #4b2a7b 0%, #9b6fd6 50%, #3a1f63 100%)', glow: '#8a5cd0', cap: 'SIGNATURE PERFUMES' },
  glow: { grad: 'linear-gradient(125deg, #a83f68 0%, #f08fb2 50%, #93365b 100%)', glow: '#e0709a', cap: 'SKINCARE & GLOW' },
  home: { grad: 'linear-gradient(125deg, #a85a16 0%, #f2a65a 50%, #8f4c16 100%)', glow: '#e8913f', cap: 'KITCHEN UPGRADES' },
};
SETS.forEach((s) => Object.assign(s, LOOK[s.id], { best: Math.max(...s.products.map((p) => (p.was ? Math.round((1 - p.price / p.was) * 100) : 0))) }));
const ORDER = ['tech', 'gym', 'scents', 'glow', 'home'].map((id) => SETS.find((s) => s.id === id));   // the carousel, your top world first
const N = ORDER.length;

// ─── motion tokens (noon standard) ───────────────────────────────────────────────────────────────────────
const MOVE = { w: 16.75, z: 0.81, ms: 544 };
const springAt = (t, w, z) => { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); };
const linearOf = (w, z, ms, n = 40) => `linear(${Array.from({ length: n + 1 }, (_, i) => (i === n ? 1 : springAt((i / n) * ms / 1000, w, z)).toFixed(4)).join(', ')})`;
// (older browsers have no CSS linear(): there the springs fall back to the standard's spring-shaped beziers)
const HAS_LINEAR = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)');
const EASE = {
  move: HAS_LINEAR ? linearOf(MOVE.w, MOVE.z, MOVE.ms) : 'cubic-bezier(0.338, 0.75, 0.061, 1.109)',
  pop: HAS_LINEAR ? linearOf(14, 0.55, 760) : 'cubic-bezier(0.34, 1.56, 0.64, 1)',   // rewards only (noon: ζ .45–.55)
  in: 'cubic-bezier(0.33, 1, 0.68, 1)',                          // FADE IN
  out: 'cubic-bezier(0.65, 0, 0.35, 1)',                         // FADE OUT (the rendered one)
  expand: 'cubic-bezier(0.4, 0.01, 0, 1.01)',                    // EXPAND card → full screen
  fall: 'cubic-bezier(0.55, 0, 1, 0.45)',                        // gravity (in-quad-ish): things dropping away
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const H = () => (window.Haptics || {});
const hap = (k, ...a) => { try { H()[k] && H()[k](...a); } catch {} };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (i) => ((i % N) + N) % N;

// ─── page plumbing ─────────────────────────────────────────────────────────────────────────────────────
const sheet = document.getElementById('orbiSheet');
const root = document.createElement('div');
root.className = 'cx';
const CLAW_SVG = `<svg viewBox="0 0 64 56" aria-hidden="true">
  <g class="pr" data-k="-1"><path d="M28 14 C18 22 12 34 16 50" fill="none" stroke="#d6d9e0" stroke-width="5" stroke-linecap="round"/><circle cx="16" cy="50" r="3.5" fill="#ffd23c"/></g>
  <g class="pr" data-k="1"><path d="M36 14 C46 22 52 34 48 50" fill="none" stroke="#d6d9e0" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="50" r="3.5" fill="#ffd23c"/></g>
  <rect x="20" y="2" width="24" height="16" rx="6" fill="#ffd23c"/><rect x="24" y="7" width="16" height="4" rx="2" fill="#7a3e00" opacity=".4"/></svg>`;
root.innerHTML = `
  <div class="cx-ground"></div>
  <div class="cx-story" data-no-drag></div>
  <div class="st">
    <div class="st-glow"></div>
    <button class="st-back" type="button" aria-label="Close"><svg viewBox="0 0 30 20" aria-hidden="true"><path d="M29 10H2M10 2L2 10l8 8"/></svg></button>
    <button class="st-pill" type="button"><b>🎁</b><span>my picks</span></button>
    <div class="st-lede">let Orbi grab you<br>a deal from 5 worlds</div>
    <div class="st-title">PICK OF THE DAY</div>
    <div class="st-car" data-no-drag></div>
    <div class="st-name st-swap"></div>
    <div class="st-offer st-swap"><b></b><span>+</span><i>🎁</i></div>
    <div class="st-peek st-swap"><u></u><span></span></div>
    <div class="st-plinth"></div>
    <button class="st-grab" type="button" aria-label="Grab a deal"><i></i><span>GRAB</span></button>
    <div class="st-using">using <b>🪙 1</b> free play</div>
    <div class="st-ban" role="button" aria-label="noon One offer"><div class="b-art"></div><div class="b-cap">NOON ONE</div>
      <div class="b-txt">Extra 10% off everything Orbi grabs today</div><div class="b-go"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg></div></div>
    <div class="st-cable"></div><div class="st-claw">${CLAW_SVG}</div>
  </div>
  <div class="tx"><div class="tx-flood"></div><div class="tx-rays"></div><div class="tx-spark"></div></div>
  <div class="cx-say l"></div>
  <div class="cx-burst"></div>
  <div class="cx-confetti"></div>
`;
sheet.appendChild(root);
const $ = (s) => root.querySelector(s);
const story = $('.cx-story'), progress = [];                         // (no story bars or Skip: the beats just play; a tap advances)
const say = $('.cx-say'), burst = $('.cx-burst'), confetti = $('.cx-confetti');
const groundEl = $('.cx-ground');
const st = $('.st'), car = $('.st-car');
const nameEl = $('.st-name'), offerEl = $('.st-offer'), peekEl = $('.st-peek'), grabBtn = $('.st-grab'), usingEl = $('.st-using'), banEl = $('.st-ban');
const cableEl = $('.st-cable'), clawEl = $('.st-claw'), prongs = [...clawEl.querySelectorAll('.pr')];
const tx = $('.tx'), flood = $('.tx-flood'), rays = $('.tx-rays'), sparks = $('.tx-spark');
const expander = document.createElement('div');                 // the hand-off layer out to noon's PLP
expander.className = 'cx-expander'; expander.innerHTML = '<i></i>'; root.appendChild(expander);
banEl.querySelector('.b-art').innerHTML = [ORDER[0].products[0], ORDER[2].products[1]].map((p, k) => `<img src="${p.img}" alt="" style="left:${k * 30}px;top:${k * 14}px;transform:rotate(${k ? 8 : -8}deg)">`).join('');

let run = 0, played = false, phase = 'off';
const alive = (r) => r === run;
const wait = (ms, r) => new Promise((res, rej) => setTimeout(() => (alive(r) ? res() : rej(new Error('stale'))), reduce.matches ? Math.min(ms, 120) : ms));
const anim = (el, kf, o) => el.animate(kf, { fill: 'both', ...o });
const done = (a, r) => Promise.race([a.finished.catch(() => {}), new Promise((res) => setTimeout(res, (a.effect?.getComputedTiming().endTime || 600) + 150))]).then(() => { if (!alive(r)) throw new Error('stale'); });
// the ground: a DS surface per beat, crossfading (400 ms in-out); dark surfaces get light status-bar content
function ground(bgc, ink, dark = false) {
  const i = document.createElement('i'); i.style.background = bgc; groundEl.appendChild(i);
  const a = anim(i, [{ opacity: 0 }, { opacity: 1 }], { duration: reduce.matches ? 0 : 400, easing: EASE.out });
  a.finished.then(() => { while (groundEl.children.length > 1) groundEl.firstChild.remove(); }, () => {});
  root.style.setProperty('--ink', ink);
  window.orbi && window.orbi.statusInk(dark ? 1 : null);
}

// ─── Orbi's voice: a bubble beside the bot, following it ─────────────────────────────────────────────────
let sayAnim = null, sayHideT = 0;
function speak(text, { hold = 0 } = {}) {
  clearTimeout(sayHideT);
  say.textContent = text;
  if (sayAnim) sayAnim.cancel();
  sayAnim = anim(say, [{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: EASE.pop });
  if (hold) sayHideT = setTimeout(hush, hold);
  if (!sayLoop) { sayLoop = true; const f = () => { if (!say.textContent) { sayLoop = false; return; } if (!C.loop) placeSay(); requestAnimationFrame(f); }; requestAnimationFrame(f); }
  placeSay();
}
let sayLoop = false;
function hush() { if (!say.textContent) return; const a = anim(say, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE.out }); a.finished.then(() => { say.textContent = ''; }, () => {}); }
let sayBelow = false;
function placeSay() {
  const o = window.orbi; if (!o || !say.textContent) return;
  const v = o.view, r = v.unit * 1.15;
  say.classList.toggle('b', sayBelow);
  if (sayBelow) {
    say.style.maxWidth = '260px'; say.classList.remove('l', 'r');
    const w = say.offsetWidth, x = clamp(v.cx - w + 30, 10, 375 - 10 - w);
    say.style.setProperty('--ox', `${(v.cx - x).toFixed(0)}px`); say.style.setProperty('--ax', `${(v.cx - x).toFixed(0)}px`);
    say.style.left = `${x.toFixed(1)}px`; say.style.top = `${(v.cy + r + 10).toFixed(1)}px`;
    return;
  }
  const roomR = 375 - 10 - (v.cx + r + 10), roomL = v.cx - r - 10 - 10, right = roomR >= roomL;
  say.style.maxWidth = `${Math.max(120, Math.min(220, right ? roomR : roomL))}px`;
  const w = say.offsetWidth, h = say.offsetHeight;
  say.classList.toggle('l', right); say.classList.toggle('r', !right);
  say.style.setProperty('--ox', right ? '0' : '100%');
  const x = right ? v.cx + r + 10 : v.cx - r - 10 - w;
  say.style.left = `${clamp(x, 10, 375 - 10 - w).toFixed(1)}px`;
  say.style.top = `${clamp(v.cy - h / 2, 50, sheet.clientHeight - h - 10).toFixed(1)}px`;
}

// ─── 1 · the story: four Wrapped-style beats (claw/story.js) ───────────────────────────────────────────
const cardHTML = (s, i) => `<div class="st-card" data-i="${i}" style="--g:${s.grad}">
      <div class="c-brand"><i>${s.emoji}</i>${s.name}</div><div class="c-cap">${s.cap}</div>
      <div class="c-band"><small style="margin:0 6px 0 0">UP TO</small>${s.best}%<small>OFF</small></div><i class="c-dim"></i></div>`;
const storyMod = mountStory({
  story, progress, anim, EASE, MOVE, hap, reduce,
  ink: (dark) => { root.style.setProperty('--ink', dark ? '#F1EFE6' : '#0E0E0E'); window.orbi && window.orbi.statusInk(dark ? 1 : null); },
  layout: () => { layoutStage(); return L; },
  cardsHTML: () => ORDER.map(cardHTML).join(''),
  poseOf: (i, pos, s) => poseOf(i, pos, s),
});
let storyEnd = null;                                                       // the last beat, left for the stage's reveal
async function runIntro(r) {
  phase = 'intro';
  const o = window.orbi;
  story.innerHTML = ''; root.classList.add('is-intro');
  // (the numerals' face: wait for it briefly so nothing reflows mid-beat)
  try { await Promise.race([document.fonts.load('900 100px Unbounded'), new Promise((res) => setTimeout(res, 900))]); } catch {}
  if (!alive(r)) throw new Error('stale');
  // Orbi watches from the top corner (under Skip), hops on the big numbers, then works the stack in the last beat
  o.stage({ cx: 336, cy: 124, unit: 16 }); o.gazeAt(-0.35, 0.15);
  storyEnd = await storyMod.run(r, alive, o, { USER, ORDERS, SAVED, EVERY });
}

// ─── 2 · the stage: "Pick of the day" ──────────────────────────────────────────────────────────────────
car.innerHTML = ORDER.map(cardHTML).join('');
const cards = [...car.querySelectorAll('.st-card')];
const L = { H: 0, cy: 0, k: 1, ban: true };
const ORBI_HOME = () => ({ cx: 322, cy: L.lede + lerp(22, 24, L.k), unit: 22 });       // where the reference has its round button
function layoutStage() {
  const Hh = sheet.clientHeight, k = clamp((Hh - 691) / (812 - 691), 0, 1);
  const hh = lerp(166, 196, k), lede = lerp(100, 122, k), ty = lerp(204, 222, k), cy = lerp(256, 284, k);
  const ny = cy + 138 + lerp(18, 30, k), oy = ny + 24, py = oy + 54, bl = py + lerp(32, 44, k), by = bl + 8, uy = by + 80, ay = uy + 38;
  Object.assign(L, { H: Hh, k, cy, lede, ban: ay + 92 <= Hh - 12 });
  const v = { hh, lede, ty, cy, ny, oy, py, bl, by, uy, ay };
  for (const [n, x] of Object.entries(v)) st.style.setProperty(`--${n}`, `${x.toFixed(1)}px`);
  banEl.style.display = L.ban ? '' : 'none';
}

// the carousel: `pos` is a float card index; every card is placed from its offset to it (a coverflow)
const C = { pos: 0, v: 0, to: 0, drag: null, spin: null, focus: -1, frozen: false, loop: false, last: 0, sp: { x: 1, v: 0 } };
// a card's pose for carousel position `pos`; `s` spreads it from the story's stack (0: stacked, slightly fanned,
// at .62 scale, where claw/story.js draws it) to the coverflow (1)
const STACK_RZ = [0, -7, 5, -3, 8];
function poseOf(i, pos, s = 1) {
  let d = i - pos; d = ((d % N) + N + N / 2) % N - N / 2;              // −2.5 … 2.5
  const ad = Math.abs(d), s1 = Math.min(ad, 1);
  const x = Math.sign(d) * (ad <= 1 ? ad * 206 : 206 + (ad - 1) * 96);
  const rot = clamp(d, -1, 1) * 42, z = -s1 * 80 - Math.max(0, ad - 1) * 60, sc = 1 - s1 * 0.12;
  const op = ad > 1.5 ? Math.max(0, 1 - (ad - 1.5) * 2.4) : 1;
  return {
    transform: `translate3d(${(x * s).toFixed(2)}px, 0, ${(z * s).toFixed(1)}px) rotateZ(${((1 - s) * STACK_RZ[i]).toFixed(2)}deg) rotateY(${(rot * s).toFixed(2)}deg) scale(${lerp(0.62, sc, s).toFixed(4)})`,
    opacity: lerp(1, op, clamp(s * 1.6 - 0.3, 0, 1)), dim: s1 * 0.38 * s, z: 10 - Math.round(ad * 2), sheen: d * 70 * s,
  };
}
function placeCards() {
  cards.forEach((el, i) => {
    if (C.frozen && el !== C.carriedEl) return;
    if (el === C.carriedEl) return;
    const p = poseOf(i, C.pos, C.sp.x);
    el.style.transform = p.transform;
    el.style.opacity = p.opacity.toFixed(3);
    (el._dim || (el._dim = el.querySelector('.c-dim'))).style.opacity = p.dim.toFixed(3);   // (an overlay, not a filter: compositor-only)
    el.style.zIndex = String(p.z);
    el.style.setProperty('--sheen', `${p.sheen.toFixed(1)}%`);
  });
}
function stepCarousel(dt) {
  if (C.spin) {
    const s = C.spin, t = clamp((performance.now() - s.t0) / s.ms, 0, 1);
    const e = 1 - Math.pow(1 - t, 4);                                       // a reel slowing to a stop (out-quart)…
    C.pos = s.from + (s.to - s.from) * e;
    if (t >= 1) { C.pos = s.to; C.v = 0; C.to = s.to; C.spin = null; s.res(); }
  } else if (!C.drag) {                                                      // …everything else settles on MOVE
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      C.v += (MOVE.w ** 2 * (C.to - C.pos) - 2 * MOVE.z * MOVE.w * C.v) * h; C.pos += C.v * h;
    }
  }
  if (C.sp.x !== 1) {                                                        // the stack spreading into the carousel (MOVE)
    for (let left = dt; left > 1e-6; left -= 1 / 240) { const h = Math.min(left, 1 / 240); C.sp.v += (11 ** 2 * (1 - C.sp.x) - 2 * 0.9 * 11 * C.sp.v) * h; C.sp.x += C.sp.v * h; }
    if (Math.abs(1 - C.sp.x) < 0.0015 && Math.abs(C.sp.v) < 0.02) { C.sp.x = 1; C.sp.v = 0; }
  }
  const f = wrap(Math.round(C.pos));
  if (f !== C.focus) {
    const first = C.focus < 0; C.focus = f;
    if (!first) { if (!C.spin) hap('tick'); else if (performance.now() - (C.lastTick || 0) > 45) { C.lastTick = performance.now(); hap('tick'); } }
    showInfo(ORDER[f], { quiet: !!C.spin || first });
  }
  placeCards();
}
function stageTick(now) {
  if (!C.loop) return;
  const dt = Math.min(0.05, C.last ? (now - C.last) / 1000 : 1 / 60); C.last = now;
  stepCarousel(dt);
  if (Q.on) stepClaw(dt);
  placeSay();
  requestAnimationFrame(stageTick);
}
// the set under the focused card: its name, its best offer, a peek at three of its picks
let infoSwap = null;
function fillInfo(s) {
  nameEl.textContent = s.name;
  offerEl.querySelector('b').textContent = `${s.best}%`;
  const from = Math.min(...s.products.map((p) => p.price));
  peekEl.querySelector('u').innerHTML = s.products.slice(0, 3).map((p) => `<img src="${p.img}" alt="" decoding="async">`).join('');
  peekEl.querySelector('span').textContent = `${s.products.length} picks · from AED ${Math.floor(from)}`;
}
function showInfo(s, { quiet = false } = {}) {
  const els = [nameEl, offerEl, peekEl];
  if (quiet || reduce.matches) { fillInfo(s); return; }
  // a quick swap: out 120 ms (fade out, a nudge), new content in on MOVE + 200 ms fade (25 / 60 ms staggers)
  const dir = C.v > 0 ? -1 : 1, id = {}; infoSwap = id;
  Promise.all(els.map((el, i) => anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${dir * 14}px)` }], { duration: 120, easing: EASE.out, delay: i * 25 }).finished.catch(() => {}))).then(() => {
    if (infoSwap !== id) return;
    fillInfo(s);
    els.forEach((el, i) => anim(el, [{ opacity: 0, transform: `translateX(${-dir * 18}px)` }, { opacity: 1, transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: i * 60 }));
  });
}
// drag / flick / tap the carousel
car.addEventListener('pointerdown', (e) => {
  if (phase !== 'ready') return;
  C.drag = { x0: e.clientX, pos0: C.pos, lx: e.clientX, lt: performance.now(), vx: 0, moved: false, id: e.pointerId };
  C.v = 0;
  try { car.setPointerCapture(e.pointerId); } catch {}
});
car.addEventListener('pointermove', (e) => {
  const d = C.drag; if (!d || e.pointerId !== d.id) return;
  const now = performance.now(), dt = Math.max(1, now - d.lt) / 1000;
  d.vx += ((e.clientX - d.lx) / dt - d.vx) * 0.4; d.lx = e.clientX; d.lt = now;
  const dx = (e.clientX - d.x0) / (375 / innerWidth || 1);
  if (Math.abs(dx) > 6) d.moved = true;
  C.pos = d.pos0 - dx / 206;
});
const endCarDrag = (e) => {
  const d = C.drag; if (!d) return; C.drag = null;
  if (!d.moved) {                                                    // a tap: a side card comes to the front
    const el = e.target.closest && e.target.closest('.st-card');
    if (el) {
      let dd = +el.dataset.i - C.pos; dd = ((dd % N) + N + N / 2) % N - N / 2;
      if (Math.abs(dd) > 0.5) { C.to = Math.round(C.pos + dd); hap('tap'); }
      else { C.to = Math.round(C.pos); window.orbi?.hop(1); hap('tap'); speak(`${ORDER[C.focus].line} Hit GRAB 👇`, { hold: 1500 }); }
    }
    return;
  }
  // a flick: the release speed carries it on (≤ 2 cards), it settles on the nearest card with MOVE
  const vc = -d.vx / 206;
  const proj = C.pos + vc * 0.16;
  C.to = clamp(Math.round(proj), Math.round(d.pos0) - 2, Math.round(d.pos0) + 2);
  C.v = clamp(vc, -12, 12);
};
car.addEventListener('pointerup', endCarDrag);
car.addEventListener('pointercancel', endCarDrag);
const spinTo = (to, ms) => new Promise((res) => { C.spin = { from: C.pos, to, t0: performance.now(), ms: reduce.matches ? 200 : ms, res }; });

// the stage comes in: the navy of the last beat deepens to the stage's black, the glows bloom, the headline
// rises, the cards sweep in from the right, the controls follow (60 ms stagger)
const ENTER = () => [$('.st-lede'), $('.st-title'), nameEl, offerEl, peekEl, $('.st-plinth'), grabBtn, usingEl, banEl, $('.st-pill'), $('.st-back')];
async function showStage(r, { again = false, fromStory = null } = {}) {
  phase = 'stage';
  const o = window.orbi;
  root.classList.remove('is-intro'); sheet.classList.add('cx-dark');
  ground('#050506', '#FFFFFF', true);
  o.setState('idle');
  layoutStage();
  st.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  Object.assign(C, { frozen: false, carriedEl: null, drag: null, spin: null, v: 0, focus: -1 });
  cards.forEach((c) => { c.style.transformOrigin = ''; c.style.visibility = ''; });
  C.sp = { x: 1, v: 0 };
  if (fromStory) { C.pos = 0; C.to = 0; C.sp = { x: 0, v: 0 }; }          // (the story's stack spreads into the carousel)
  else if (!again) { C.pos = -2.6; C.to = 0; }                           // (the sweep: the cards glide in on MOVE)
  else { C.to = Math.round(C.pos); C.pos = C.to - 1.4; }
  if (fromStory) {
    // the stage takes over the last beat in place: the same black, the same cards in the same pose; the beat's
    // words go and its radar blooms out under the stage (see-through until the beat is gone)
    st.style.background = 'transparent';
    storyMod.leave(fromStory);
    const end = fromStory;
    setTimeout(() => { end.remove(); st.style.background = ''; }, 900);
    hap('snap');
  }
  st.classList.add('is-on');
  C.loop = true; C.last = 0; requestAnimationFrame(stageTick);
  anim($('.st-glow'), [{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: EASE.out });
  ENTER().forEach((el, i) => {
    anim(el, [{ transform: 'translateY(22px)' }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: 60 + i * 40 });
    anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: 60 + i * 40 });
  });
  usingEl.innerHTML = again ? 'using <b>🪙 1</b> bonus play' : 'using <b>🪙 1</b> free play';
  setTimeout(() => alive(r) && hap('land', 0.5), 260);
  // Orbi settles into the header, where it operates the claw from
  o.stage(ORBI_HOME()); o.gazeAt(-0.3, 0.3); sayBelow = true;
  await wait(again ? 420 : 620, r);
  o.lock(true);
  speak(again ? 'Back for another round? 🎰' : 'Swipe the worlds, then hit GRAB 👇', { hold: again ? 1800 : 3000 });
  grabBtn.disabled = false; grabBtn.classList.add('is-ready');
  phase = 'ready';
}

// ─── 3 · GRAB: the reel spins onto Orbi's pick, the claw comes down, clamps it, lifts it ──────────────────
let lastPick = null;
function pickSet() {
  // weighted by what you buy (your top world is likeliest), never the same twice in a row
  const pool = ORDER.filter((s) => s.id !== lastPick);
  const wts = pool.map((s) => (HISTORY[s.id] || 4) + 3);
  let x = Math.random() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= wts[i]; if (x <= 0) return pool[i]; }
  return pool[0];
}
grabBtn.addEventListener('pointerdown', () => { if (!grabBtn.disabled) { grabBtn.classList.add('is-down'); hap('tap'); } });
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => grabBtn.addEventListener(ev, () => grabBtn.classList.remove('is-down')));
grabBtn.addEventListener('click', () => { if (phase === 'ready') grab(run).catch(() => {}); });

// the claw hangs from Orbi: Orbi's spot glides on a spring, the cable reels, the claw swings as a pendulum
const Q = { on: false, x: 0, vx: 0, tx: 0, y: 0, vy: 0, ty: 0, L: 0, Lv: 0, Lt: 0, th: 0, thv: 0, open: 0, openv: 0, opent: 0, k: { w: 9, z: 0.92 } };
const cableTop = () => Q.y + 19;                                           // (from under the ball)
const hubPos = () => ({ x: Q.x + Math.sin(Q.th) * Q.L, y: cableTop() + Math.cos(Q.th) * Q.L });
function stepClaw(dt) {
  for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(left, 1 / 240);
    const ax = Q.k.w ** 2 * (Q.tx - Q.x) - 2 * Q.k.z * Q.k.w * Q.vx; Q.vx += ax * h; Q.x += Q.vx * h;
    const ay = Q.k.w ** 2 * (Q.ty - Q.y) - 2 * Q.k.z * Q.k.w * Q.vy; Q.vy += ay * h; Q.y += Q.vy * h;
    Q.Lv += (100 * (Q.Lt - Q.L) - 2 * 0.92 * 10 * Q.Lv) * h; Q.L += Q.Lv * h;
    const g = 2600 + ay * 0.3, Ln = Math.max(24, Q.L);
    Q.thv += (-(g / Ln) * Math.sin(Q.th) - 0.42 * (ax / Ln) * Math.cos(Q.th) - 4 * Q.thv) * h; Q.th = clamp(Q.th + Q.thv * h, -0.45, 0.45);
    Q.openv += (22 * 22 * (Q.opent - Q.open) - 2 * 0.8 * 22 * Q.openv) * h; Q.open += Q.openv * h;
  }
  const hub = hubPos(), deg = -Q.th * 57.2958;
  cableEl.style.transform = `translate(${Q.x.toFixed(2)}px, ${cableTop().toFixed(2)}px) rotate(${deg.toFixed(2)}deg)`;
  cableEl.style.height = `${Math.max(0, Q.L - 2).toFixed(1)}px`;
  clawEl.style.transform = `translate(${hub.x.toFixed(2)}px, ${hub.y.toFixed(2)}px) rotate(${deg.toFixed(2)}deg)`;
  const ang = lerp(6, 30, clamp(Q.open, -0.1, 1.15));
  prongs.forEach((p) => { const k = +p.dataset.k; p.setAttribute('transform', `rotate(${(k * ang).toFixed(2)} ${k < 0 ? 28 : 36} 14)`); });
  if (C.carriedEl) C.carriedEl.style.transform = `translate3d(${(hub.x - 187.5).toFixed(2)}px, ${(hub.y + 30 - L.cy).toFixed(2)}px, 0) rotate(${(deg + C.tilt).toFixed(2)}deg)`;
  const o = window.orbi;
  if (o && Q.follow) { o.stage({ cx: Q.x, cy: Q.y, unit: 22 }, { snap: true }); o.gazeAt(clamp(Q.vx / 900, -0.3, 0.3), 0.42); }
}
const settled = (x, t, v, eps = 1.5, veps = 30) => Math.abs(t - x) < eps && Math.abs(v) < veps;
function until(cond, r, maxMs = 3000) {
  return new Promise((res, rej) => { const t0 = performance.now(); const f = () => { if (!alive(r)) return rej(new Error('stale')); if (cond() || performance.now() - t0 > maxMs) return res(); requestAnimationFrame(f); }; f(); });
}
const cableTo = (Ln, r) => { Q.Lt = Ln; return until(() => settled(Q.L, Q.Lt, Q.Lv, 2, 40), r); };

async function grab(r) {
  phase = 'grab'; grabBtn.disabled = true; grabBtn.classList.remove('is-ready');
  hap('snap');
  usingEl.innerHTML = '<b>🪙 0</b> plays left — good luck!';
  const o = window.orbi;
  const target = pickSet(); lastPick = target.id;
  const ti = ORDER.indexOf(target);
  o.setState('working'); o.gazeAt(-0.1, 0.5);
  speak('Spinning the worlds… 🎰');
  // the reel: two full turns and onto the pick (out-quart, ~1.7 s; a tick per card)
  const base = Math.round(C.pos), off = ((ti - wrap(base)) + N) % N;
  await spinTo(base + 2 * N + off, 1750);
  if (!alive(r)) throw new Error('stale');
  hap('snap'); sayBelow = false;
  speak(`${target.emoji} ${target.name}! Grabbing it…`);
  const card = cards[ti];
  anim(card, [{ transform: card.style.transform }, { transform: `${card.style.transform} scale(1.06)`, offset: 0.35 }, { transform: card.style.transform }], { duration: 420, easing: EASE.pop });
  // the headline makes room; Orbi flies over the card
  [$('.st-title'), $('.st-lede')].forEach((el) => anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 200, easing: EASE.out }));
  const y0 = L.cy - 132;
  o.stage({ cx: 187.5, cy: y0, unit: 22 });
  await until(() => Math.abs(o.view.cy - y0) < 3 && Math.abs(o.view.cx - 187.5) < 3, r, 900);
  // the claw drops out of Orbi: prongs open on the way down, close on the card's top edge
  Object.assign(Q, { on: true, follow: true, x: o.view.cx, tx: 187.5, vx: 0, y: o.view.cy, ty: y0, vy: 0, L: 4, Lt: 4, Lv: 0, th: 0, thv: 0, open: 0, opent: 1 });
  [cableEl, clawEl].forEach((e) => anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in }));
  hap('tick');
  await cableTo(L.cy - 30 - cableTop(), r);
  hap('land', 0.5);
  Q.opent = -0.05; await wait(160, r);
  hap('snap');
  C.carriedEl = card; C.tilt = 0; C.frozen = true;
  card.getAnimations().forEach((a) => a.cancel()); card.style.transformOrigin = '50% 0'; card.style.zIndex = '20';
  speak('Gotcha! 🎉');
  o.setState('greeting');
  // the others drop away, the controls clear out (25 ms stagger), the card is lifted with a swing
  cards.filter((c) => c !== card).forEach((c, i) => {
    const m = new DOMMatrix(getComputedStyle(c).transform), side = m.m41 < 0 ? -1 : 1;
    anim(c, [{ transform: c.style.transform, opacity: +c.style.opacity || 1 }, { transform: `${c.style.transform} translate3d(${side * 30}px, 520px, 0) rotateZ(${side * (14 + i * 4)}deg)`, opacity: 0 }], { duration: 620, easing: EASE.fall, delay: i * 25 });
  });
  [nameEl, offerEl, peekEl, $('.st-plinth'), grabBtn, usingEl, banEl].forEach((el, i) => anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(26px)' }], { duration: 200, easing: EASE.out, delay: i * 25 }));
  setTimeout(() => alive(r) && hap('land', 0.4), 420);
  Q.ty = y0 - 26; Q.tx = 187.5 + 18; Q.Lt = Math.max(30, Q.L - 52);
  await wait(240, r); Q.tx = 187.5;
  await wait(520, r);
  await toDiscover(target, card, r);
}

// ─── 4 · the full-screen transition: the card floods the screen in its colour, flips, becomes the hero ───
let discoverSet = null;
async function toDiscover(set, card, r) {
  phase = 'tx';
  const o = window.orbi;
  hush();
  const s = sheet.getBoundingClientRect(), cr = card.getBoundingClientRect(), Hh = sheet.clientHeight;
  const k = 375 / s.width;                                          // (screen px → layout px)
  const cx = (cr.left + cr.width / 2 - s.left) * k, cy = (cr.top + cr.height / 2 - s.top) * k;
  // the flying card: a copy with a back (the next page's title), started exactly where the claw holds it
  const fc = document.createElement('div');
  fc.className = 'tx-card'; fc.style.setProperty('--g', set.grad);
  fc.innerHTML = `<div class="tx-front">${card.innerHTML}</div><div class="tx-back"><div><b>${set.name}</b><small>ORBI'S PICK OF THE DAY</small></div></div>`;
  tx.appendChild(fc); tx.style.setProperty('--g', set.grad); tx.classList.add('is-on');
  flood.style.clipPath = `circle(0px at ${cx}px ${cy}px)`;
  const rot0 = -Q.th * 57.2958 + C.tilt;
  const at = (x, y, sc, ry, rz = 0) => `translate(${(x - 114).toFixed(1)}px, ${(y - 69).toFixed(1)}px) rotateZ(${rz}deg) rotateY(${ry}deg) scale(${sc})`;
  card.style.visibility = 'hidden';
  // the claw lets go and reels back into Orbi
  Q.opent = 1; Q.Lt = 0; hap('pop');
  [cableEl, clawEl].forEach((e) => anim(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: EASE.out, delay: 120 }));
  const ex = 187.5, ey = Hh * 0.46;
  // the card: to the middle, turning over (MOVE, a touch longer for the flip), growing
  const fly = anim(fc, [{ transform: at(cx, cy, 1, 0, rot0.toFixed(2)) }, { transform: at(ex, ey, 1.28, 180) }], { duration: 1000, easing: HAS_LINEAR ? linearOf(10, 0.8, 1000) : EASE.move });
  // the flood: a circle in the card's colour from the card's centre to past the corners (EXPAND)
  const R = Math.hypot(Math.max(cx, 375 - cx), Math.max(cy, Hh - cy)) + 20;
  const fl = anim(flood, [{ clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${R}px at ${cx}px ${cy}px)` }], { duration: 560, easing: EASE.expand, delay: 90 });
  // light rays spin up behind the card, sparkles burst out of it
  anim(rays, [{ opacity: 0, transform: `translate(${ex - 187.5}px, ${ey - Hh / 2}px) rotate(0deg) scale(.6)` }, { opacity: 0.95, transform: `translate(${ex - 187.5}px, ${ey - Hh / 2}px) rotate(40deg) scale(1)`, offset: 0.4 }, { opacity: 0, transform: `translate(${ex - 187.5}px, ${ey - Hh / 2}px) rotate(80deg) scale(1.15)` }], { duration: 1500, easing: 'cubic-bezier(.33,.6,.4,1)', delay: 160 });
  sparkBurst(ex, ey, r);
  setTimeout(() => alive(r) && hap('snap'), 420);
  Q.follow = false;
  o.stage({ cx: 322, cy: 96, unit: 24 }); o.gazeAt(-0.2, 0.25);
  setTimeout(() => alive(r) && o.hop(2), 380);
  await done(fly, r);
  await done(fl, r).catch(() => {});
  C.loop = false; Q.on = false;
  // the hand-off: the page arrives under the flood (its hero is the same colour), the card's back rises and
  // dissolves into the hero's title, the flood fades away
  discoverSet = set;
  st.classList.remove('is-on');
  disc.show(set);
  fc.querySelector('.tx-front').style.visibility = 'hidden';
  anim(fc, [{ transform: at(ex, ey, 1.28, 180) }, { transform: at(ex, ey - 40, 1.6, 180) }], { duration: 300, easing: EASE.out });
  anim(fc.querySelector('.tx-back'), [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE.out });
  const fo = anim(flood, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: EASE.out, delay: 80 });
  hap('success');
  await done(fo, r).catch(() => {});
  tx.classList.remove('is-on'); fc.remove(); flood.getAnimations().forEach((a) => a.cancel()); flood.style.clipPath = '';
  phase = 'discover';
}
function sparkBurst(x, y, r) {
  sparks.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const e = document.createElement('i'); sparks.appendChild(e);
    const a = (i / 28) * Math.PI * 2 + Math.random() * 0.3, d = 110 + Math.random() * 190, sz = 0.5 + Math.random() * 1.1;
    anim(e, [{ transform: `translate(${x}px, ${y}px) scale(0)`, opacity: 0 }, { transform: `translate(${x + Math.cos(a) * d * 0.55}px, ${y + Math.sin(a) * d * 0.55}px) scale(${sz})`, opacity: 1, offset: 0.35 },
      { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) scale(0)`, opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', delay: 180 + Math.random() * 120 });
  }
}

// ─── 5 · the discovery page (claw/discover.js), and the ways out of it ───────────────────────────────────
const disc = mountDiscover({
  root, sheet, anim, EASE, MOVE, hap, reduce,
  speak: (t, o) => speak(t, o), hush: () => hush(),
  onAgain: () => { if (phase === 'discover') backToStage(run).catch(() => {}); },
  onExplore: (s) => { if (phase === 'discover') toPLP(s, run).catch(() => {}); },
});
async function backToStage(r) {
  phase = 'back'; hush();
  const o = window.orbi;
  o.setState('idle');
  await disc.hide();
  if (!alive(r)) return;
  await showStage(r, { again: true });
}
// "Explore all on noon": the GitFlow PLP for the set loads underneath, a white layer covers the page, the page dissolves into it
async function toPLP(set, r) {
  phase = 'leave'; hush();
  const o = window.orbi;
  speak('Let\'s see everything! 🛍️', { hold: 700 });
  try { window.nkGo && window.nkGo('plp/listing', { query: set.query }); } catch {}
  expander.style.background = '#FFFFFF'; expander.style.display = 'block'; expander.style.clipPath = 'none';
  const a = anim(expander, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE.out });
  hap('snap');
  await done(a, r).catch(() => {});
  o.lock(false); o.stage(null); o.gazeAt(null); o.setState('idle'); o.statusInk(null);
  o.goPage(false, { fade: true });
}
// the header: back closes the page; "my picks" reopens the last world Orbi grabbed
$('.st-back').addEventListener('pointerdown', () => hap('tap'));
$('.st-back').addEventListener('click', () => { if (['stage', 'ready'].includes(phase)) window.orbi?.goPage(false); });
$('.st-pill').addEventListener('click', () => {
  if (phase !== 'ready') return; hap('tap');
  if (!lastPick) { speak('Nothing yet — press GRAB and I\'ll win you one! 🎯', { hold: 1800 }); return; }
  const s = SETS.find((x) => x.id === lastPick);
  phase = 'tx'; hush();
  [...cards, ...ENTER()].forEach((el) => anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE.out }));
  setTimeout(() => { if (phase !== 'tx') return; C.loop = false; st.classList.remove('is-on'); discoverSet = s; disc.show(s, { fromFlood: false }); phase = 'discover'; window.orbi?.stage({ cx: 322, cy: 96, unit: 24 }); }, 170);
});
banEl.addEventListener('click', () => { if (phase === 'ready') { hap('tap'); window.orbi?.hop(1.2); speak('noon One members get 10% extra on my picks 💛', { hold: 2000 }); } });

// ─── lifecycle: the page opens → intro (first time) or straight to the stage; it closes → everything resets
function reset() {
  sayBelow = false;
  run++; phase = 'off'; C.loop = false; Q.on = false; Q.follow = false;
  clearTimeout(sayHideT);
  root.querySelectorAll('*').forEach((e) => e.getAnimations && e.getAnimations().forEach((a) => a.cancel()));
  story.innerHTML = ''; say.textContent = ''; burst.innerHTML = ''; confetti.innerHTML = ''; sparks.innerHTML = '';
  st.classList.remove('is-on'); tx.classList.remove('is-on'); tx.querySelectorAll('.tx-card').forEach((e) => e.remove());
  disc.hide({ instant: true }); expander.style.display = 'none';
  Object.assign(C, { carriedEl: null, frozen: false, drag: null, spin: null, focus: -1 });
  cards.forEach((c) => { c.style.visibility = ''; c.style.transformOrigin = ''; });
  grabBtn.disabled = true; grabBtn.classList.remove('is-ready', 'is-down');
  sheet.classList.remove('cx-dark');
  groundEl.innerHTML = ''; root.style.setProperty('--ink', '#1D2539'); window.orbi && window.orbi.statusInk(null);
  progress.forEach((p) => p.style.setProperty('--f', 0));
}
async function start() {
  if (phase !== 'off') return;
  reset();
  const r = run, o = window.orbi;
  if (!o) return;
  try {
    const again = played;
    if (!played) { await runIntro(r); if (!alive(r)) return; played = true; await showStage(r, { fromStory: storyEnd }); storyEnd = null; return; }
    await showStage(r, { again });
  } catch {}
}
addEventListener('orbi:page', (e) => {
  if (e.detail === 'arrived') start();               // (the page has landed; Orbi finishes its turn meanwhile)
  else if (e.detail === 'closing') { const o = window.orbi; o && (o.lock(false), o.stage(null), o.gazeAt(null), o.statusInk(null)); if (phase !== 'leave') { run++; phase = 'closing'; C.loop = false; Q.on = false; } }
  else if (e.detail === 'closed') reset();
});
addEventListener('orbi:poke', () => {
  if (phase === 'ready') speak(['Hehe, that tickles!', 'Psst — press GRAB 👇', 'Swipe the cards — I\'ll pick one!'][Math.floor(Math.random() * 3)], { hold: 1600 });
  else if (phase === 'discover') disc.poke();
});
addEventListener('resize', () => { if (st.classList.contains('is-on')) layoutStage(); });
window.orbiClaw = { get phase() { return phase; }, start, reset, C, Q, L, disc, ORDER, get discoverSet() { return discoverSet; } };
