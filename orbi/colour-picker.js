/* ══ Orbi colour slider — the Orbi sheet's composer ══════════════════════════
   After the reference clip (ChatGPT's model slider): the swatch button in the
   composer squishes, and a slider sprouts out of it and stretches across the
   bar on a spring, while the bar's content blurs away and the colour's name
   blurs in above. Six stops, one per brand colour.
     · drag the knob (or tap a stop): the fill follows the knob in the stop's
       colour, a tick at each stop, the name rolls over at each midpoint, and
       the bot watches the knob
     · let go: it settles on the nearest stop (a flick carries on to the next),
       and that's the pick — the bot turns a full 360° and the colour swaps in
       while its back is turned
     · tap anywhere else, wait ~2 s, or close the sheet: the slider shrinks back
       into the swatch, whose ring then turns to the new colour
   Every frame is one spring progress `p` (0 swatch … 1 slider) plus the knob's
   own spring; geometry is in composer px (375-wide frame), so a scaled
   screen only needs the pointer mapped through its rect.
   main.js owns the bot side (api: themes, index, choose, look, haptic). */

const W = 327;                                   // .cmp box, styles.css
const ICON = { cx: 219, cy: 72, d: 24 };         // the swatch's ring centre
const TRACK = { x: 10, y: 46, w: 307, h: 44 };   // open slider
const KNOB = 36, INSET = 4, END = KNOB / 2 + INSET;   // knob centre at either end: 22
const OPEN = { zeta: 0.74, response: 0.42 };     // sprouts with a little stretch
const CLOSE = { zeta: 1, response: 0.3 };        // folds back firmly, no bounce
const SNAP = { zeta: 0.84, response: 0.3 };      // settling on a stop (≈250 ms, like the clip)
const FOLLOW = { zeta: 1, response: 0.07 };      // under the finger: tight, but never jittery
const IDLE_CLOSE_MS = 2200;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
function step(s, target, dt, { zeta, response }) {
  const w = (2 * Math.PI) / response, k = w * w, c = 2 * zeta * w;
  for (let t = dt; t > 1e-6; t -= 1 / 240) {
    const h = Math.min(t, 1 / 240);
    s.v += (k * (target - s.x) - c * s.v) * h;
    s.x += s.v * h;
  }
}

export function mountColourPicker(api) {
  const cmp = document.getElementById('orbiCmp');
  if (!cmp) return null;
  const body = cmp.querySelector('.cmp__body');
  const swatch = cmp.querySelector('.cmp__swatch');
  const ring = cmp.querySelector('.swatch__ring');
  const dot = cmp.querySelector('.swatch__dot');
  const pk = cmp.querySelector('.cpk');
  const label = pk.querySelector('.cpk__label');
  const track = pk.querySelector('.cpk__track');
  const fill = pk.querySelector('.cpk__fill');
  const knobEl = pk.querySelector('.cpk__knob');
  const themes = api.themes, n = themes.length;
  const STEP = (TRACK.w - 2 * END) / (n - 1);
  const stopX = (i) => END + i * STEP;
  const stopOf = (x) => clamp(Math.round((x - END) / STEP), 0, n - 1);

  // the swatch: a ring of every colour (the current one turned to the top) around a dot of the current one
  const SEG = 360 / n;
  ring.style.background = `conic-gradient(from ${-SEG / 2}deg, ${themes.map((t, i) => `${t.hex} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(', ')})`;
  let ringDeg = 0;
  function setSwatch(i, animate) {
    let target = -i * SEG;                         // the shortest way round from where it is
    target += Math.round((ringDeg - target) / 360) * 360;
    ringDeg = target;
    ring.classList.toggle('is-instant', !animate);
    dot.classList.toggle('is-instant', !animate);
    ring.style.transform = `rotate(${ringDeg}deg)`;
    dot.style.background = themes[i].hex;
  }

  // stops
  const dots = themes.map((t, i) => {
    const d = document.createElement('i');
    d.className = 'cpk__dot';
    d.style.setProperty('--c', t.hex);
    d.style.left = `${stopX(i)}px`;
    track.insertBefore(d, knobEl);
    return d;
  });

  // the name: two layers, so one can leave while the next arrives
  const names = [...label.children];
  let nameFront = 0;
  function setName(i, dir) {
    const out = names[nameFront], inn = names[1 - nameFront];
    nameFront = 1 - nameFront;
    inn.textContent = themes[i].name;
    inn.style.setProperty('--dy', `${dir * 7}px`);
    out.style.setProperty('--dy', `${-dir * 7}px`);
    inn.classList.add('is-enter'); inn.classList.remove('is-on');
    void inn.offsetWidth;                          // start the entrance from below / above
    inn.classList.remove('is-enter'); inn.classList.add('is-on');
    out.classList.remove('is-on');
  }

  let idx = api.index, chosen = idx;
  const morph = { x: 0, v: 0 };
  const knob = { x: stopX(idx), v: 0, target: stopX(idx) };
  let isOpen = false, drag = null, raf = 0, last = 0, closeTimer = 0, committed = true, edged = false;
  names[0].textContent = themes[idx].name; names[0].classList.add('is-on');
  pk.style.setProperty('--c', themes[idx].hex);
  setSwatch(idx, false);

  function open() {
    if (isOpen) return;
    isOpen = true; committed = false; chosen = idx;
    knob.x = knob.target = stopX(idx); knob.v = 0;
    names[nameFront].textContent = themes[idx].name;
    pk.classList.add('is-live'); cmp.classList.add('is-picking');
    swatch.setAttribute('aria-expanded', 'true');
    pk.setAttribute('aria-hidden', 'false');
    track.setAttribute('aria-valuenow', String(idx));
    track.setAttribute('aria-valuetext', themes[idx].name);
    api.haptic('tap');
    kick();
    armIdle();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false; drag = null; edged = false;
    clearTimeout(closeTimer);
    knob.target = stopX(idx);
    choose(idx);                                   // folded mid-drag: what it shows is what it gets
    cmp.classList.remove('is-picking');
    swatch.setAttribute('aria-expanded', 'false');
    pk.setAttribute('aria-hidden', 'true');
    api.look(null);
    kick();
  }
  function armIdle() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!drag) close(); }, IDLE_CLOSE_MS);
  }

  function pick(i) {
    if (i === idx) return;
    const dir = i > idx ? 1 : -1;
    idx = i;
    setName(i, dir);
    pk.style.setProperty('--c', themes[i].hex);
    track.setAttribute('aria-valuenow', String(i));
    track.setAttribute('aria-valuetext', themes[i].name);
    api.haptic('tick');
  }
  // the knob is headed for stop i: that's the pick (the bot turns 360° and changes)
  function choose(i) {
    if (i === chosen) return;
    chosen = i;
    api.choose(i);
  }

  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    step(morph, isOpen ? 1 : 0, dt, isOpen ? OPEN : CLOSE);
    step(knob, knob.target, dt, drag ? FOLLOW : SNAP);
    if (isOpen && morph.x > 0.6) {
      const i = stopOf(knob.x);
      if (i !== idx) pick(i);
    }
    render();
    if (isOpen) api.look(clamp((knob.x - END) / (TRACK.w - 2 * END) * 2 - 1, -1, 1));
    // folded back: the swatch's ring turns to the new colour
    if (!isOpen && !committed && morph.x < 0.12) {
      committed = true;
      setSwatch(idx, true);
    }
    const still = Math.abs(morph.v) < 0.002 && Math.abs(morph.x - (isOpen ? 1 : 0)) < 0.001
      && Math.abs(knob.v) < 0.5 && Math.abs(knob.x - knob.target) < 0.05 && !drag;
    if (still) {
      morph.x = isOpen ? 1 : 0; morph.v = 0; knob.x = knob.target; knob.v = 0;
      render();
      if (!isOpen) pk.classList.remove('is-live');
      raf = 0; last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

  function render() {
    const p = morph.x, pc = clamp(p, 0, 1);
    // the pill: from the swatch's ring to the full track (p > 1 stretches it a touch past, then back)
    const tw = lerp(ICON.d, TRACK.w, p), th = lerp(ICON.d, TRACK.h, pc);
    const tx = lerp(ICON.cx, TRACK.x + TRACK.w / 2, p) - tw / 2;
    const ty = lerp(ICON.cy, TRACK.y + TRACK.h / 2, pc) - th / 2;
    track.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
    track.style.width = `${tw.toFixed(2)}px`;
    track.style.height = `${th.toFixed(2)}px`;
    // the knob rides out of the swatch's centre to its stop
    const kd = lerp(12, KNOB, pc);
    const kx = lerp(ICON.cx, TRACK.x + knob.x, p) - tx;
    knobEl.style.transform = `translate3d(${(kx - kd / 2).toFixed(2)}px, ${((th - kd) / 2).toFixed(2)}px, 0)`;
    knobEl.style.width = knobEl.style.height = `${kd.toFixed(2)}px`;
    // the fill hugs the knob's right side (a ring round it at the first stop); a full disc while it's still the swatch
    const fw = Math.min(tw, kx + kd / 2 + INSET * pc + (1 - pc) * 14);
    fill.style.width = `${Math.max(th, fw).toFixed(2)}px`;
    const dp = ramp(p, 0.5, 1);
    track.style.setProperty('--dots', dp.toFixed(3));
    for (let i = 0; i < n; i++) dots[i].classList.toggle('is-in', stopX(i) < fw - 6);
    // the bar's own content dissolves; the name blurs in above
    const bp = ramp(p, 0, 0.5);
    body.style.opacity = (1 - bp).toFixed(3);
    body.style.filter = bp > 0.001 && bp < 0.999 ? `blur(${(bp * 6).toFixed(2)}px)` : bp >= 0.999 ? 'blur(6px)' : '';
    body.style.transform = bp > 0.001 ? `scale(${(1 - 0.03 * bp).toFixed(4)})` : '';
    const lp = ramp(p, 0.35, 1);
    label.style.opacity = lp.toFixed(3);
    label.style.filter = lp < 0.999 ? `blur(${((1 - lp) * 5).toFixed(2)}px)` : '';
    label.style.transform = `translateY(${((1 - lp) * 8).toFixed(2)}px)`;
    track.style.opacity = ramp(p, 0, 0.08).toFixed(3);
    swatch.style.opacity = p > 0.04 ? '0' : '';
  }

  // ── input ──
  swatch.addEventListener('pointerdown', (e) => { e.stopPropagation(); swatch.classList.add('is-pressed'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => swatch.addEventListener(ev, () => swatch.classList.remove('is-pressed')));
  swatch.addEventListener('click', () => (isOpen ? close() : open()));

  const localX = (e) => {
    const r = cmp.getBoundingClientRect();
    return (e.clientX - r.left) * (W / r.width) - TRACK.x;
  };
  track.addEventListener('pointerdown', (e) => {
    if (!isOpen) return;
    e.stopPropagation();                           // not a sheet drag
    clearTimeout(closeTimer);
    const x = localX(e);
    const onKnob = Math.abs(x - knob.x) < KNOB * 0.75;
    drag = { off: onKnob ? x - knob.x : 0, x0: x, lx: x, lt: performance.now(), v: 0, moved: false };
    knobEl.classList.add('is-held');
    edged = false;
    if (onKnob) knob.target = knob.x;
    else knob.target = clamp(x, END, TRACK.w - END);   // pressing the track: the knob comes to the finger
    try { track.setPointerCapture(e.pointerId); } catch {}
    kick();
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const x = localX(e), now = performance.now(), dt = Math.max(1, now - drag.lt) / 1000;
    drag.v += ((x - drag.lx) / dt - drag.v) * 0.4; drag.lx = x; drag.lt = now;
    if (Math.abs(x - drag.x0) > 3) drag.moved = true;
    let t = x - drag.off;
    const lo = END, hi = TRACK.w - END;            // past either end: rubber band
    if (t < lo) t = lo - (1 - 1 / ((lo - t) * 0.012 + 1)) * 26;
    else if (t > hi) t = hi + (1 - 1 / ((t - hi) * 0.012 + 1)) * 26;
    const out = t < lo - 1 || t > hi + 1;
    if (out && !edged) { edged = true; api.haptic('edge'); } else if (!out) edged = false;
    knob.target = t;
    kick();
  });
  const release = () => {
    if (!drag) return;
    const d = drag; drag = null;
    knobEl.classList.remove('is-held');
    const aim = d.moved ? knob.x + clamp(d.v, -1500, 1500) * 0.06 : d.x0;   // a flick carries on to the next stop
    knob.target = stopX(stopOf(aim));
    choose(stopOf(aim));
    knob.v = d.moved ? clamp(d.v, -1500, 1500) : 0;
    edged = false;
    kick();
    armIdle();
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = clamp(stopOf(knob.target) + d, 0, n - 1);
    knob.target = stopX(i);
    choose(i);
    kick(); armIdle();
  });
  // anything else folds it away (the tap still does what it does)
  addEventListener('pointerdown', (e) => {
    if (isOpen && !track.contains(e.target)) close();
  }, { capture: true, passive: true });
  addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
  }, { capture: true });
  // the composer is the sheet's content, not a drag handle
  cmp.addEventListener('pointerdown', (e) => e.stopPropagation());

  render();
  return {
    open, close,
    get isOpen() { return isOpen; },
    // the colour changed elsewhere (the C key)
    sync(i) {
      if (i === idx) return;
      const dir = i > idx ? 1 : -1;
      idx = chosen = i;
      knob.x = knob.target = stopX(i);
      pk.style.setProperty('--c', themes[i].hex);
      setName(i, dir);
      if (!isOpen) setSwatch(i, true);
      kick();
    },
  };
}
