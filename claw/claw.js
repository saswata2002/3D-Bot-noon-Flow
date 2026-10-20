/* ══ Orbi's Claw ═════════════════════════════════════════════════════════════════════════════════════════
   The bot's full page (orbi/main.js opens it): a 5-beat personalised "Wrapped" intro built from the order
   history, then a claw machine with five sets of real noon product cards. GRAB → Orbi, riding the gantry, hunts
   (a fake-out, then the real pick, weighted by what you buy), drops the claw, grabs a card, carries it to the
   chute — the prize pops out, and opens that set's PLP (the GitFlow PLP, home-app/, via window.nkGo).
   Motion: the noon standard (~/.claude/skills/noon_sas_motion) — MOVE spring 280.6/27.14 for anything that
   moves, out-cubic 200 ms fades in, in-out-cubic fades out, 60 ms stagger in / 25 ms out, a livelier spring
   (ζ .55) only for the reward pop; physics (the carriage glide, cable pendulum, falling card) are integrated
   per frame. Orbi is the host: a playful arcade champ who narrates, watches the claw and cheers. ══ */
import { SETS } from './catalog.js';

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
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const H = () => (window.Haptics || {});
const hap = (k, ...a) => { try { H()[k] && H()[k](...a); } catch {} };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ─── page plumbing ─────────────────────────────────────────────────────────────────────────────────────
const sheet = document.getElementById('orbiSheet');
const root = document.createElement('div');
root.className = 'cx';
root.innerHTML = `
  <div class="cx-ground"></div>
  <div class="cx-progress">${'<i></i>'.repeat(5)}</div>
  <div class="cx-story" data-no-drag></div>
  <div class="cm">
    <div class="cm-marquee"><div class="cm-bulbs"></div><span class="cm-title">ORBI'S<b>CLAW</b></span></div>
    <div class="cm-glass">
      <div class="cm-rail"></div><i class="cm-carriage"></i>
      <div class="cm-cable"></div>
      <div class="cm-claw"><svg viewBox="0 0 64 56" aria-hidden="true">
        <g class="pr" data-k="-1"><path d="M28 14 C18 22 12 34 16 50" fill="none" stroke="#c9d0f0" stroke-width="5" stroke-linecap="round"/><circle cx="16" cy="50" r="3.5" fill="#feee00"/></g>
        <g class="pr" data-k="1"><path d="M36 14 C46 22 52 34 48 50" fill="none" stroke="#c9d0f0" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="50" r="3.5" fill="#feee00"/></g>
        <rect x="20" y="2" width="24" height="16" rx="6" fill="#feee00"/><rect x="24" y="7" width="16" height="4" rx="2" fill="#1d2539" opacity=".35"/>
      </svg></div>
      <div class="cm-chute"><span>Prize</span></div>
      <div class="cm-glare"></div>
    </div>
    <div class="cm-panel">
      <div class="cm-stick"><i></i></div>
      <button class="cm-grab" type="button" aria-label="Grab a prize"><span>GRAB</span></button>
      <div class="cm-coin"><b>FREE PLAY</b><span>×1</span></div>
      <div class="cm-hint">Orbi drives — you press</div>
    </div>
  </div>
  <div class="cx-say l"></div>
  <div class="cx-burst"></div>
  <div class="cx-confetti"></div>
  <div class="cx-prize"><div class="pz-band"></div><span class="pz-kick">You won</span><span class="pz-emoji"></span>
    <div class="pz-name"></div><div class="pz-sub"></div><div class="pz-fan"><i></i><i></i><i></i></div>
    <div class="pz-meta"><span></span><em></em></div>
    <button class="pz-go" type="button"><i></i><span>Open my picks</span></button></div>
  <button class="cx-skip" type="button">Skip</button>`;
sheet.appendChild(root);
const $ = (s) => root.querySelector(s);
const story = $('.cx-story'), progress = [...root.querySelectorAll('.cx-progress i')], skipBtn = $('.cx-skip');
const cm = $('.cm'), glass = $('.cm-glass'), carriageEl = $('.cm-carriage'), cableEl = $('.cm-cable'), clawEl = $('.cm-claw');
const prongs = [...clawEl.querySelectorAll('.pr')], grabBtn = $('.cm-grab'), stick = $('.cm-stick'), coin = $('.cm-coin span');
const say = $('.cx-say'), burst = $('.cx-burst'), confetti = $('.cx-confetti'), prize = $('.cx-prize');
const groundEl = $('.cx-ground');
const expander = document.createElement('div');                 // the prize → PLP hand-off layer
expander.className = 'cx-expander'; expander.innerHTML = '<i></i>'; root.appendChild(expander);
const bulbs = $('.cm-bulbs');
for (let i = 0; i < 18; i++) {                                    // marquee bulbs round the sign
  const b = document.createElement('i'); const t = i / 18;
  const per = 2 * (335 + 46), d = t * per;                         // walk the inner perimeter
  const [x, y] = d < 335 ? [d, 0] : d < 381 ? [335, d - 335] : d < 716 ? [335 - (d - 381), 46] : [0, 46 - (d - 716)];
  b.style.left = `${x - 3}px`; b.style.top = `${y - 3}px`; bulbs.appendChild(b);
}
const bulbEls = [...bulbs.children];

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
}
function hush() { if (!say.textContent) return; const a = anim(say, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE.out }); a.finished.then(() => { say.textContent = ''; }, () => {}); }
function placeSay() {
  const o = window.orbi; if (!o || !say.textContent) return;
  const v = o.view, r = v.unit * 1.15;
  const roomR = 375 - 10 - (v.cx + r + 10), roomL = v.cx - r - 10 - 10, right = roomR >= roomL;
  say.style.maxWidth = `${Math.max(120, Math.min(220, right ? roomR : roomL))}px`;
  const w = say.offsetWidth, h = say.offsetHeight;
  say.classList.toggle('l', right); say.classList.toggle('r', !right);
  say.style.setProperty('--ox', right ? '0' : '100%');
  const x = right ? v.cx + r + 10 : v.cx - r - 10 - w;
  say.style.left = `${clamp(x, 10, 375 - 10 - w).toFixed(1)}px`;
  say.style.top = `${clamp(v.cy - h / 2, 50, sheet.clientHeight - h - 10).toFixed(1)}px`;
}

// ─── 1 · the intro: five beats, ~4.9 s ─────────────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString('en-US');
const ln = (cls, html) => `<span class="cx-ln ${cls}"><span>${html}</span></span>`;
// each beat sits on a noon DS surface: brand yellow → inverted navy → white → page grey → inverted navy;
// type is the DS ramp (H40 ExtraBold, H28 Bold, B16, B12 Bold); the stat colours are DS semantics
// (brand yellow on navy, success green for "saved")
const BEATS = [
  { ms: 700, bg: '#FEEE00', ink: '#0E0E0E', html: () => `${ln('cx-kick', `${USER.name}, your 2026`)}${ln('cx-h1', 'Wrapped by Orbi')}${ln('cx-sub', 'Your year on noon, in five seconds')}` },
  { ms: 720, bg: '#101628', ink: '#FFFFFF', dark: true, accent: '#FEEE00', html: () => `${ln('cx-kick', 'You placed')}${ln('cx-num', '<span data-count="' + ORDERS + '">0</span>')}${ln('cx-h2', 'orders')}${ln('cx-sub', `That's one every ${EVERY} days 📦`)}`, count: true },
  { ms: 720, bg: '#FFFFFF', ink: '#1D2539', accent: '#0F8857', html: () => `${ln('cx-kick', 'And saved')}${ln('cx-num', '<small>AED</small><span data-count="' + SAVED + '">0</span>')}${ln('cx-sub', 'on deals, coupons & noon One 🎉')}`, count: true, coins: true },
  { ms: 800, bg: '#F2F3F7', ink: '#1D2539', html: () => `${ln('cx-kick', 'Your top 3')}<div class="cx-rows">${RANKED.slice(0, 3).map((r, i) => `<div class="cx-row" style="--tint:${r.set.tint}"><i>${i + 1}</i><b>${r.set.emoji}</b><span>${r.set.name}</span><em>${r.n} orders</em></div>`).join('')}</div>`, rows: true },
  { ms: 880, bg: '#101628', ink: '#FFFFFF', dark: true, accent: '#FEEE00', html: () => `${ln('cx-kick', 'Your shopper vibe')}${ln('cx-h1', `<span style="color:#FEEE00">${VIBE}</span>`)}${ln('cx-sub', 'Orbi has a little prize for you…')}` },
];
function countUp(el, to, ms) {
  const t0 = performance.now();
  const f = (now) => { const t = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - t, 3); el.textContent = fmt(Math.round(to * e)); if (t < 1 && el.isConnected) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function riseIn(beat, r) {
  const lines = [...beat.querySelectorAll('.cx-ln > span, .cx-row')];
  lines.forEach((el, i) => {
    const row = el.classList.contains('cx-row');
    anim(el, [{ transform: row ? 'translateY(20px)' : 'translateY(105%)' }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: i * 60 });
    anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: i * 60 });
    if (row) setTimeout(() => alive(r) && hap('tick'), 120 + i * 60);
  });
}
function leave(beat) {
  const lines = [...beat.querySelectorAll('.cx-ln > span, .cx-row')].reverse();
  return Promise.all(lines.map((el, i) => anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-16px)' }], { duration: 150, easing: EASE.out, delay: i * 20 }).finished.catch(() => {})));
}
function coinBurst(x, y) {
  burst.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('i'); c.textContent = i % 3 ? '🪙' : '✨'; burst.appendChild(c);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, d = 70 + Math.random() * 90;
    anim(c, [{ transform: `translate(${x}px, ${y}px) scale(.3)`, opacity: 0 }, { transform: `translate(${x + Math.cos(a) * d * 0.6}px, ${y + Math.sin(a) * d * 0.6}px) scale(1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d + 60}px) scale(.8)`, opacity: 0 }], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
}
let beatIdx = -1, beatNext = null;
async function runIntro(r) {
  phase = 'intro';
  const o = window.orbi;
  o.stage({ cx: 187.5, cy: 150, unit: 36 });
  story.innerHTML = ''; root.classList.add('is-intro');
  skipBtn.style.opacity = '1'; skipBtn.style.pointerEvents = '';
  anim($('.cx-progress'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE.in });
  progress.forEach((p) => p.style.setProperty('--f', 0));
  for (let i = 0; i < BEATS.length; i++) {
    if (!alive(r)) throw new Error('stale');
    beatIdx = i;
    const b = BEATS[i];
    ground(b.bg, b.ink, b.dark);
    const el = document.createElement('div');
    el.className = 'cx-beat is-on'; el.style.setProperty('--ink', b.ink); if (b.accent) el.style.setProperty('--accent', b.accent);
    el.style.setProperty('--top', `${Math.max(214, sheet.clientHeight * 0.3)}px`);
    el.innerHTML = b.html(); story.appendChild(el);
    riseIn(el, r);
    hap('tick');
    if (b.count) el.querySelectorAll('[data-count]').forEach((c) => countUp(c, +c.dataset.count, 560));
    if (b.coins) setTimeout(() => { if (!alive(r)) return; const q = el.querySelector('.cx-num > span').getBoundingClientRect(), s = sheet.getBoundingClientRect(); coinBurst(q.right - s.left + 18, q.top - s.top + 20); hap('pop'); o.hop(1.4); }, 460);
    if (i === 1) setTimeout(() => alive(r) && (o.hop(1.2), hap('pop')), 560);
    o.gazeAt(i === 3 ? -0.18 : -0.12, i === 3 ? 0.34 : 0.26);                         // reading along with you
    if (i === 4) { o.setState('working'); }
    // the beat holds (tap = next), its segment fills
    const seg = progress[i];
    const fill = anim(seg, [{ '--f': 0 }, { '--f': 1 }], { duration: reduce.matches ? 300 : b.ms, easing: 'linear' });
    await new Promise((res) => { beatNext = res; fill.finished.then(res, res); });
    seg.style.setProperty('--f', 1); fill.cancel?.();
    if (!alive(r)) throw new Error('stale');
    await leave(el); el.remove();
  }
}
story.addEventListener('click', () => { if (phase === 'intro' && beatNext) { const f = beatNext; beatNext = null; f(); } });

// ─── 2 · the machine ─────────────────────────────────────────────────────────────────────────────────────
const G = { W: 0, H: 0, top: 0, left: 0, railY: 12, botY: 40, botUnit: 22, cableTop: 64, L0: 30 };
const piles = [];
function layout() {
  const Hh = sheet.clientHeight;
  const y0 = 106, panel = Hh < 720 ? 132 : 150;
  cm.style.setProperty('--y0', `${y0}px`); cm.style.setProperty('--panel', `${panel}px`);
  const r = glass.getBoundingClientRect(), s = sheet.getBoundingClientRect();
  Object.assign(G, { W: r.width, H: r.height, left: r.left - s.left, top: r.top - s.top });
  G.cableTop = G.botY + G.botUnit + 2;
  // the pit: three piles on the back shelf, two in front beside the chute
  G.L0 = G.H < 420 ? 20 : 30;
  // the back shelf high enough that every set's label reads, low enough that the claw at rest clears its cards
  const back = Math.max(G.H * 0.6, G.cableTop + G.L0 + 66 + 96 * 0.86), front = G.H - 28;
  cm.classList.toggle('is-compact', panel < 140);
  const spots = [{ x: 0.22, y: back, s: 0.86 }, { x: 0.5, y: back, s: 0.86 }, { x: 0.78, y: back, s: 0.86 }, { x: 0.55, y: front, s: 1 }, { x: 0.83, y: front, s: 1 }];
  piles.forEach((p, i) => { const sp = spots[i]; p.x = sp.x * G.W; p.bottom = sp.y; p.scale = sp.s; p.el.style.left = `${p.x}px`; p.el.style.top = `${p.bottom - 96 * p.scale}px`; p.el.style.transform = `scale(${p.scale})`; p.el.style.transformOrigin = '50% 0'; });
  G.chuteX = 56; G.chuteTop = G.H - 10 - 78;
}
function buildPiles() {
  glass.querySelectorAll('.cm-pile').forEach((e) => e.remove()); piles.length = 0;
  // the order on the shelves mixes the sets (the pick is weighted, not positional)
  const order = ['scents', 'tech', 'glow', 'gym', 'home'].map((id) => SETS.find((s) => s.id === id));
  order.forEach((set, i) => {
    const el = document.createElement('div'); el.className = `cm-pile${i < 3 ? ' back' : ''}`;
    const picks = set.products.slice(0, 3);
    el.innerHTML = picks.map((p, k) => `<div class="cm-card" style="transform:rotate(${[-9, 7, -2][k]}deg) translate(${[-6, 6, 0][k]}px, ${[4, 2, 0][k]}px)"><img src="${p.img}" alt="" decoding="async"><b><small>AED</small> ${Math.round(p.price)}</b></div>`).join('') + `<span class="cm-tag">${set.emoji} ${set.name}</span>`;
    glass.insertBefore(el, glass.querySelector('.cm-chute'));
    piles.push({ set, el, cards: [...el.querySelectorAll('.cm-card')] });
  });
}

// physics state (glass coordinates)
const P = {
  cx: 0, cv: 0, ct: 0, ck: { w: 9, z: 0.9 },               // carriage: a gliding spring
  L: 30, Lv: 0, Lt: 30, Lk: { w: 9, z: 0.92 },              // cable length
  th: 0, thv: 0,                                            // pendulum angle
  open: 0, openv: 0, opent: 0,                              // prongs (0 closed … 1 open)
  carried: null, falling: null, prevCv: 0, last: 0,
};
let looping = false, follow = false;
function hubPos() { return { x: P.cx + Math.sin(P.th) * P.L, y: G.cableTop + Math.cos(P.th) * P.L }; }
function tick(now) {
  if (!looping) return;
  const dt = Math.min(0.05, P.last ? (now - P.last) / 1000 : 1 / 60); P.last = now;
  const sub = 1 / 240;
  for (let left = dt; left > 1e-6; left -= sub) {
    const h = Math.min(left, sub);
    const a = (P.ck.w ** 2) * (P.ct - P.cx) - 2 * P.ck.z * P.ck.w * P.cv;
    P.cv += a * h; P.cx += P.cv * h;
    P.Lv += ((P.Lk.w ** 2) * (P.Lt - P.L) - 2 * P.Lk.z * P.Lk.w * P.Lv) * h; P.L += P.Lv * h;
    // the claw swings on its cable: carriage acceleration kicks it, gravity brings it back, air damps it
    // (the kick is softened: the real carriage acceleration flung it sideways — a heavy claw on a short cable sways, it doesn't fly)
    const g = 2600, L = Math.max(24, P.L);
    P.thv += (-(g / L) * Math.sin(P.th) - 0.42 * (a / L) * Math.cos(P.th) - 5 * P.thv) * h; P.th = clamp(P.th + P.thv * h, -0.5, 0.5);
    P.openv += (22 * 22 * (P.opent - P.open) - 2 * 0.8 * 22 * P.openv) * h; P.open += P.openv * h;
  }
  draw();
  if (P.falling) stepFall(dt);
  requestAnimationFrame(tick);
}
function draw() {
  const hub = hubPos();
  carriageEl.style.transform = `translateX(${P.cx.toFixed(2)}px)`;
  cableEl.style.transform = `translate(${P.cx.toFixed(2)}px, ${G.cableTop.toFixed(2)}px) rotate(${(-P.th * 57.2958).toFixed(2)}deg)`;
  cableEl.style.height = `${Math.max(0, P.L - 2).toFixed(1)}px`;
  clawEl.style.transform = `translate(${hub.x.toFixed(2)}px, ${hub.y.toFixed(2)}px) rotate(${(-P.th * 57.2958).toFixed(2)}deg)`;
  const ang = lerp(6, 30, clamp(P.open, -0.1, 1.15));
  prongs.forEach((g) => { const k = +g.dataset.k; g.setAttribute('transform', `rotate(${(k * ang).toFixed(2)} ${k < 0 ? 28 : 36} 14)`); });
  if (P.carried) {
    const c = P.carried, rot = -P.th * 57.2958 + c.tilt;
    c.el.style.transform = `translate(${(hub.x - 37).toFixed(2)}px, ${(hub.y + 34).toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${c.scale})`;
  }
  // Orbi rides the carriage; it watches the claw and leans into the glide
  const o = window.orbi;
  if (follow && o) {
    o.stage({ cx: G.left + P.cx, cy: G.top + G.botY, unit: G.botUnit }, { snap: true });
    o.gazeAt(clamp(P.cv / 900, -0.3, 0.3), phase === 'grab' ? 0.4 : 0.22);
  }
  placeSay();
}
const settled = (x, t, v, eps = 0.6, veps = 14) => Math.abs(t - x) < eps && Math.abs(v) < veps;
function until(cond, r, maxMs = 3000) {
  return new Promise((res, rej) => { const t0 = performance.now(); const f = () => { if (!alive(r)) return rej(new Error('stale')); if (cond() || performance.now() - t0 > maxMs) return res(); requestAnimationFrame(f); }; f(); });
}
// (each step hands over once it has visibly arrived — a couple of px, slow — not on the spring's sub-pixel tail)
const moveTo = (x, r) => { P.ct = x; stick.style.setProperty('--tilt', `${clamp((x - P.cx) / 8, -18, 18)}deg`); return until(() => settled(P.cx, P.ct, P.cv, 1.5, 30), r).then(() => stick.style.setProperty('--tilt', '0deg')); };
const cableTo = (L, r, k = { w: 10, z: 0.9 }) => { P.Lt = L; P.Lk = k; return until(() => settled(P.L, P.Lt, P.Lv, 2, 40), r); };
const swingCalm = (r, maxMs = 500) => until(() => Math.abs(P.th) < 0.05 && Math.abs(P.thv) < 0.4, r, maxMs);

async function showMachine(r, { again = false } = {}) {
  phase = 'machine';
  const o = window.orbi;
  root.classList.remove('is-intro');
  anim(skipBtn, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE.out }); skipBtn.style.pointerEvents = 'none';
  anim($('.cx-progress'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE.out });
  ground('#F2F3F7', '#1D2539');
  o.setState('idle');
  buildPiles(); cm.classList.add('is-on'); layout();
  Object.assign(P, { cx: G.W / 2, cv: 0, ct: G.W / 2, L: G.L0, Lt: G.L0, Lv: 0, th: 0, thv: 0, open: 0, opent: 0, carried: null, falling: null, last: 0 });
  // the cabinet rises (MOVE + fade), the bulbs light up, the sets drop onto the shelves (60 ms stagger)
  anim(cm, [{ transform: 'translateY(70px)' }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move });
  anim(cm, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE.in });
  [cableEl, clawEl, carriageEl].forEach((e) => anim(e, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE.in, delay: 260 }));
  piles.forEach((p, i) => {
    anim(p.el, [{ translate: '0 -26px' }, { translate: '0 0' }], { duration: MOVE.ms, easing: EASE.move, delay: 200 + i * 60 });
    anim(p.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: 200 + i * 60 });
  });
  setTimeout(() => alive(r) && hap('land', 0.6), 420);
  bulbsOn(r);
  looping = true; requestAnimationFrame(tick);
  // Orbi hops down onto the gantry
  o.stage({ cx: G.left + G.W / 2, cy: G.top + G.botY, unit: G.botUnit });
  o.gazeAt(0, 0.22);
  await wait(again ? 380 : 520, r);
  follow = true;
  o.lock(true);
  speak(again ? 'Back for another round? 🎰' : `Ready, champ? Smash GRAB and I'll snag you something good!`);
  grabBtn.disabled = false; grabBtn.classList.add('is-ready');
  phase = 'ready';
}
let bulbT = 0;
function bulbsOn(r) {
  clearInterval(bulbT); let k = 0;
  bulbT = setInterval(() => { if (!alive(r)) { clearInterval(bulbT); return; } k++; bulbEls.forEach((b, i) => b.classList.toggle('on', (i + k) % 3 === 0)); }, phase === 'grab' ? 90 : 180);
}

// ─── 3 · GRAB ────────────────────────────────────────────────────────────────────────────────────────────
let lastPick = null;
function pickSet() {
  // weighted by what you buy (your top set is likeliest), never the same twice in a row
  const pool = piles.filter((p) => p.set.id !== lastPick && p.cards.length);
  const wts = pool.map((p) => (HISTORY[p.set.id] || 4) + 3);
  let x = Math.random() * wts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { x -= wts[i]; if (x <= 0) return pool[i]; }
  return pool[0];
}
grabBtn.addEventListener('pointerdown', () => { if (!grabBtn.disabled) { grabBtn.classList.add('is-down'); hap('tap'); } });
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => grabBtn.addEventListener(ev, () => grabBtn.classList.remove('is-down')));
grabBtn.addEventListener('click', () => { if (phase === 'ready') grab(run).catch(() => {}); });

async function grab(r) {
  phase = 'grab'; grabBtn.disabled = true; grabBtn.classList.remove('is-ready');
  hap('snap'); bulbsOn(r);
  coin.textContent = '×0';
  const o = window.orbi;
  const target = pickSet(); lastPick = target.set.id;
  // the fake-out: first a neighbour on the far side, then the real one
  const others = piles.filter((p) => p !== target);
  const fake = others.sort((a, b) => Math.abs(b.x - target.x) - Math.abs(a.x - target.x))[Math.floor(Math.random() * 2)];
  o.setState('working');
  speak('Ooh… let me see 👀');
  await moveTo(fake.x, r); hap('tick');
  fake.el.classList.add('is-aim');
  speak('This one? Hmm… nah!');
  await wait(360, r);
  fake.el.classList.remove('is-aim');
  hush();
  await moveTo(target.x, r); hap('tick');
  target.el.classList.add('is-aim');
  speak('THIS one! ✨');
  await swingCalm(r, 420);
  // drop: the prongs open on the way down, the claw meets the top card
  const card = target.cards[target.cards.length - 1];
  const topY = target.bottom - 96 * target.scale;
  P.opent = 1;
  await cableTo(topY - 22 - G.cableTop, r, { w: 10, z: 1 });
  hap('land', 0.5);
  P.opent = -0.05; await wait(170, r);
  hap('snap');
  // the card is in the claw: lift it out of its pile into the glass, keeping where it was on screen
  const cr = card.getBoundingClientRect(), gr = glass.getBoundingClientRect();
  card.classList.add('carried'); glass.appendChild(card);
  card.style.left = '0px'; card.style.top = '0px';
  target.cards.pop();
  const hub = hubPos();
  P.carried = { el: card, tilt: (Math.random() - 0.5) * 10, scale: target.scale };
  // (snap from its pile spot to the claw's grip over the lift — no jump: it starts where it lay)
  const from = { x: cr.left - gr.left - (hub.x - 37), y: cr.top - gr.top - (hub.y + 34) };
  const grip = anim(card, [{ translate: `${from.x}px ${from.y}px` }, { translate: '0 0' }], { duration: 260, easing: EASE.in });
  target.el.classList.remove('is-aim');
  speak('Gotcha! 🎉');
  await cableTo(G.L0, r, { w: 10, z: 0.85 });
  grip.cancel(); card.style.translate = '';
  // over to the chute, the prize swinging
  hush();
  await moveTo(G.chuteX, r);
  await swingCalm(r, 380);
  P.opent = 1; hap('tick');
  const h2 = hubPos();
  P.falling = { el: card, x: h2.x - 37, y: h2.y + 34, vx: P.cv * 0.2 + Math.sin(P.th) * 60, vy: 0, rot: -P.th * 57.3 + P.carried.tilt, vr: (Math.random() - 0.5) * 240, scale: P.carried.scale, set: target.set, done: false };
  P.carried = null;
  await until(() => !P.falling || P.falling.done, r, 1500);
  P.opent = 0;
  await reveal(target.set, r);
}
function stepFall(dt) {
  const f = P.falling;
  f.vy += 2600 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
  f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px) rotate(${f.rot.toFixed(1)}deg) scale(${f.scale})`;
  if (!f.done && f.y > G.chuteTop + 18) {
    f.done = true; hap('land', 0.9);
    anim(f.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: EASE.out }).finished.then(() => { f.el.remove(); }, () => f.el.remove());
    anim($('.cm-chute'), [{ transform: 'scale(1)' }, { transform: 'scale(1.06, .94)' }, { transform: 'scale(1)' }], { duration: 340, easing: EASE.pop });
  }
  if (f.y > G.H + 40) P.falling = null;
}

// ─── 4 · the prize ──────────────────────────────────────────────────────────────────────────────────────
let autoGo = null, prizeSet = null;
async function reveal(set, r) {
  phase = 'won'; prizeSet = set;
  const o = window.orbi;
  // the prize card pops out of the chute and flies to the middle (a reward: the livelier spring)
  prize.style.setProperty('--tint', set.tint);
  prize.querySelector('.pz-emoji').textContent = set.emoji;
  prize.querySelector('.pz-name').textContent = set.name;
  const from = Math.min(...set.products.map((p) => p.price));
  prize.querySelector('.pz-sub').textContent = 'Orbi picked these just for you';
  prize.querySelector('.pz-meta span').textContent = `${set.products.length} picks`;
  prize.querySelector('.pz-meta em').textContent = `from AED ${Math.floor(from)}`;
  prize.querySelectorAll('.pz-fan i').forEach((i, k) => { i.innerHTML = `<img src="${set.products[k].img}" alt="">`; });
  const Wp = 311, Hp = 404, Hh = sheet.clientHeight;
  const end = { x: (375 - Wp) / 2, y: clamp((Hh - Hp) / 2 + 20, 100, Hh - Hp - 16) };
  const s0 = 92 / Wp, st = { x: G.left + 10, y: G.top + G.chuteTop };
  prize.classList.add('is-on');
  prize.style.transform = `translate(${end.x}px, ${end.y}px)`;
  const pop = anim(prize, [{ transform: `translate(${st.x}px, ${st.y}px) scale(${s0}) rotate(-12deg)` }, { transform: `translate(${end.x}px, ${end.y}px) scale(1) rotate(0deg)` }], { duration: 760, easing: EASE.pop });
  anim(prize, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in });
  prize.querySelectorAll('.pz-fan i').forEach((i, k) => anim(i, [{ transform: 'rotate(0deg) translateY(10px)' }, { transform: `rotate(${[-16, 0, 16][k]}deg) translate(${[-58, 0, 58][k]}px, ${[14, 0, 14][k]}px)` }], { duration: 760, easing: EASE.pop, delay: 180 + k * 60 }));
  // the cabinet steps back behind it
  anim(cm, [{ opacity: 1, filter: 'blur(0px)', transform: 'none' }, { opacity: 0.35, filter: 'blur(4px)', transform: 'scale(.96)' }], { duration: 380, easing: EASE.out });
  hap('success'); o.setState('greeting'); o.hop(2.2);
  follow = false;
  o.stage({ cx: 187.5, cy: Math.max(78, end.y - 40), unit: 30 }); o.gazeAt(0, 0.35);
  setTimeout(() => alive(r) && confettiBurst(end.x + Wp / 2, end.y + 140, set.accent), 260);
  speak(set.line, {});
  await done(pop, r);
  // it opens by itself in a beat (the bar fills), or tap
  const bar = prize.querySelector('.pz-go i');
  autoGo = anim(bar, [{ '--f': 0 }, { '--f': 1 }], { duration: reduce.matches ? 600 : 2600, easing: 'linear' });
  autoGo.finished.then(() => { if (alive(r) && phase === 'won') toPLP(r); }).catch(() => {});
}
prize.querySelector('.pz-go').addEventListener('click', () => { if (phase === 'won') { hap('tap'); toPLP(run); } });
function confettiBurst(x, y, c) {
  confetti.innerHTML = '';
  const cols = [c, '#FEEE00', '#3866DF', '#0F8857', '#FF9741'];   // DS: the set's accent, brand yellow, CTA blue, success, warning
  for (let i = 0; i < 46; i++) {
    const e = document.createElement('i'); e.style.background = cols[i % cols.length]; confetti.appendChild(e);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 380 + Math.random() * 520, T = 1.3 + Math.random() * 0.5;
    const pts = []; for (let k = 0; k <= 8; k++) { const t = (k / 8) * T; pts.push({ transform: `translate(${(x + Math.cos(a) * v * t).toFixed(1)}px, ${(y + Math.sin(a) * v * t + 900 * t * t).toFixed(1)}px) rotate(${(k * 80 * (i % 2 ? 1 : -1)).toFixed(0)}deg) scale(${(1 - k / 16).toFixed(2)})`, opacity: k > 5 ? (8 - k) / 3 : 1 }); }
    anim(e, pts, { duration: T * 1000, easing: 'linear' });
  }
}

// ─── 5 · into the PLP ────────────────────────────────────────────────────────────────────────────────────
async function toPLP(r) {
  if (phase !== 'won') return;
  phase = 'leave';
  if (autoGo) autoGo.cancel?.();
  const o = window.orbi, set = prizeSet;
  hush();
  speak('Let\'s go shopping! 🛍️', { hold: 700 });
  // the PLP for the set loads underneath (the page still covers it)
  try { window.nkGo && window.nkGo('plp/listing', { query: set.query }); } catch {}
  // the prize grows to the whole page (noon EXPAND: (0.4, 0.01, 0, 1.01), 400 ms), its content fades first,
  // then it turns the PLP's white — and the page dissolves into the PLP as Orbi flies home
  // (a plain layer in the set's colour grows out of the card's exact shape — the card's own content never
  // scales: it fades underneath — then turns the PLP's white)
  const pr = prize.getBoundingClientRect(), s = sheet.getBoundingClientRect(), Hh = sheet.clientHeight;
  const x = pr.left - s.left, y = pr.top - s.top;
  [...prize.children].forEach((k) => anim(k, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: EASE.out }));
  await wait(120, r).catch(() => {});                         // (the card is plain white now — the PLP's surface)
  expander.style.background = '#FFFFFF'; expander.style.display = 'block';
  const inset = (t, rgt, b, l, rad) => `inset(${t}px ${rgt}px ${b}px ${l}px round ${rad}px)`;
  const grow = anim(expander, [{ clipPath: inset(y, 375 - x - pr.width, Hh - y - pr.height, x, 30) }, { clipPath: inset(0, 0, 0, 0, 0) }], { duration: 420, easing: EASE.expand });
  anim(expander.firstChild, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: EASE.in, delay: 230 });
  hap('snap');
  await done(grow, r).catch(() => {});
  await wait(120, r).catch(() => {});
  o.lock(false); o.stage(null); o.gazeAt(null); o.setState('idle');
  o.goPage(false, { fade: true });
}

// ─── lifecycle: the page opens → intro (first time) or straight to the machine; it closes → everything resets
function reset() {
  run++; looping = false; follow = false; phase = 'off';
  clearInterval(bulbT); clearTimeout(sayHideT);
  root.querySelectorAll('*').forEach((e) => e.getAnimations && e.getAnimations().forEach((a) => a.cancel()));
  story.innerHTML = ''; say.textContent = ''; burst.innerHTML = ''; confetti.innerHTML = '';
  cm.classList.remove('is-on'); prize.classList.remove('is-on'); expander.style.display = 'none';
  prize.removeAttribute('style'); prize.querySelectorAll('*').forEach((e) => e.style && (e.style.opacity = ''));
  coin.textContent = '×1'; grabBtn.disabled = true; grabBtn.classList.remove('is-ready', 'is-down');
  groundEl.innerHTML = ''; root.style.setProperty('--ink', '#1D2539'); window.orbi && window.orbi.statusInk(null);
  progress.forEach((p) => p.style.setProperty('--f', 0));
}
async function start() {
  if (phase !== 'off') return;
  reset();
  const r = run, o = window.orbi;
  if (!o) return;
  try {
    const again = played && lastPick != null;
    if (!played) { await runIntro(r); if (!alive(r)) return; played = true; }
    await showMachine(r, { again });
  } catch {}
}
skipBtn.addEventListener('click', () => {
  if (phase !== 'intro') return;
  hap('tap'); played = true;
  const r = ++run; story.innerHTML = '';
  showMachine(r).catch(() => {});
});
addEventListener('orbi:page', (e) => {
  if (e.detail === 'arrived') start();               // (the page has landed; Orbi finishes its turn meanwhile)
  else if (e.detail === 'closing') { const o = window.orbi; o && (o.lock(false), o.stage(null), o.gazeAt(null), o.statusInk(null)); if (phase !== 'leave') { run++; phase = 'closing'; } }
  else if (e.detail === 'closed') reset();
});
addEventListener('orbi:poke', () => { if (phase === 'ready') speak(['Hehe, that tickles!', 'Psst — press GRAB 👇', 'I\'m ready when you are!'][Math.floor(Math.random() * 3)], { hold: 1600 }); });
addEventListener('resize', () => { if (cm.classList.contains('is-on')) layout(); });
window.orbiClaw = { get phase() { return phase; }, start, reset, P, G, piles };
