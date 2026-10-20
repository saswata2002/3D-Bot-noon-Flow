/* ══ Orbi's Claw — the story (after the user's Spotify Wrapped 2025 reference) ═════════════════════════════
   Four full-bleed beats, paper and ink, op-art patterns and huge extended numerals:
     0 · open      — checker rings spinning behind a giant "2026"; the rings split like a curtain onto paper:
                     "We're ready for you, Saswata." with a yellow 2026 band rising from the bottom
     1 · orders    — ink: "You shopped. We counted." → the count slams in from the left (47), rings in the corner
     2 · saved     — paper, dot grids that ripple into yellow dashes: "Every deal adds up." → "You saved" over a
                     marquee of the amount
     3 · curating  — ink: "Curating offers for you…" while the five worlds' cards riffle in a stack, radar rings
                     pulsing; the stack sits exactly where the carousel's cards will be, so the stage can spread
                     it straight into the carousel (claw.js showStage({ fromStory }))
   Between beats: a full-screen vertical push (the reference's cut), 950 ms on a soft in-out (0.7, 0, 0.2, 1) —
   the next beat slides over the last, which drifts up at a third of the speed; its content starts once the
   push is under way and settles on the MOVE spring. A tap jumps to the next beat. ══ */

const SVGNS = 'http://www.w3.org/2000/svg';
// checker rings (op-art): ring widths grow outward (a tunnel), alternate rings offset by half a cell
function checkerRings(R = 640, sectors = 20, fg = '#0E0E0E') {
  let d = '', r0 = 0, k = 0;
  const f = (n) => n.toFixed(1);
  while (r0 < R) {
    const r1 = r0 + 16 + k * 3.2;
    for (let j = 0; j < sectors; j++) {
      if ((k + j) % 2) continue;
      const a0 = (j / sectors) * Math.PI * 2, a1 = ((j + 1) / sectors) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      d += `M${f(r0 * c0)} ${f(r0 * s0)}L${f(r1 * c0)} ${f(r1 * s0)}A${f(r1)} ${f(r1)} 0 0 1 ${f(r1 * c1)} ${f(r1 * s1)}L${f(r0 * c1)} ${f(r0 * s1)}${r0 > 0 ? `A${f(r0)} ${f(r0)} 0 0 0 ${f(r0 * c0)} ${f(r0 * s0)}` : ''}Z`;
    }
    r0 = r1; k++;
  }
  return `<svg viewBox="${-R} ${-R} ${2 * R} ${2 * R}" aria-hidden="true"><path d="${d}" fill="${fg}"/></svg>`;
}
// plain concentric stripes (the dark beats), one ring in noon yellow
function stripeRings(R = 300, step = 22, fg = '#F1EFE6', hi = 4) {
  let c = '';
  for (let k = 1, r = step; r < R; k++, r += step) c += `<circle r="${r - step / 4}" stroke="${k === hi ? '#FEEE00' : fg}" stroke-width="${step / 2}"/>`;
  return `<svg viewBox="${-R} ${-R} ${2 * R} ${2 * R}" aria-hidden="true"><g fill="none">${c}</g></svg>`;
}
const SQUIGGLE = ['M-20 70 C 40 20, 90 110, 150 64 S 230 0, 280 52 S 330 130, 400 30',
  'M-20 40 C 60 90, 110 -10, 180 50 S 250 120, 300 60 C 330 26, 360 40, 400 80',
  'M-20 90 C 30 40, 80 40, 120 80 S 200 120, 240 60 S 320 -10, 400 50'];
const squiggle = (i, col) => `<svg class="ws-line" viewBox="0 0 375 140" preserveAspectRatio="none" aria-hidden="true"><path d="${SQUIGGLE[i]}" pathLength="1" stroke="${col}"/></svg>`;

export function mountStory(ctx) {
  const { story, progress, anim, EASE, MOVE, hap, reduce } = ctx;
  const PUSH = 950, SOFT = 'cubic-bezier(0.7, 0, 0.2, 1)';            // the cuts and the big moves: slow in, long soft landing
  let cur = null;                         // the beat on screen: { skip() }
  story.addEventListener('click', () => { if (cur && cur.skip) cur.skip(); });
  const fmt = (n) => n.toLocaleString('en-US');

  // a beat's own clock: waits that a tap cuts short (rejects 'skip'), and that die with the run (rejects 'stale')
  function clock(alive, r) {
    let skipNow; const skipP = new Promise((_, rej) => { skipNow = () => rej(new Error('skip')); }); skipP.catch(() => {});
    const sw = (ms) => Promise.race([new Promise((res) => setTimeout(res, reduce.matches ? Math.min(ms, 150) : ms)), skipP]).then(() => { if (!alive(r)) throw new Error('stale'); });
    return { sw, skip: () => skipNow() };
  }
  const rise = (els, { y = 26, d0 = 0, gap = 60 } = {}) => els.forEach((el, i) => {
    anim(el, [{ transform: `translateY(${y}px)` }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: d0 + i * gap });
    anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: d0 + i * gap });
  });
  const drawLine = (svg, ms = 900, delay = 0) => { const p = svg.querySelector('path'); anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms, easing: 'cubic-bezier(.45,.05,.25,1)', delay }); };
  const spin = (el, deg, ms) => el.animate([{ rotate: '0deg' }, { rotate: `${deg}deg` }], { duration: ms, iterations: Infinity, easing: 'linear' });
  function countUp(els, to, ms, pre = '') {
    const t0 = performance.now();
    const f = (now) => { const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3), v = pre + fmt(Math.round(to * e)); els.forEach((el) => { el.textContent = v; }); if (t < 1 && els[0].isConnected) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  const scene = (cls, html) => { const el = document.createElement('div'); el.className = `ws ${cls}`; el.innerHTML = html; return el; };

  // ── the beats ─────────────────────────────────────────────────────────────────────────────────────────
  const BEATS = [
    { id: 'open', dark: false, ms: 2300,
      html: (d) => `<div class="ws-half t"><div class="ws-rings">${checkerRings()}</div></div><div class="ws-half b"><div class="ws-rings">${checkerRings()}</div></div>
        <div class="ws-year"><span>20</span><span>26</span></div>
        ${squiggle(0, '#0E0E0E')}
        <div class="ws-copy"><div class="ws-h">We're ready<br>for you, ${d.USER.name}.</div><div class="ws-s">Your 2026 on noon, wrapped by Orbi</div></div>
        <div class="ws-band"><div class="ws-btrack">${'<b>2026</b>'.repeat(4)}</div></div>`,
      async play(el, { sw }, o) {
        const halves = [...el.querySelectorAll('.ws-half')], rings = [...el.querySelectorAll('.ws-rings')], year = el.querySelector('.ws-year');
        rings.forEach((g) => { spin(g, 360, 26000); anim(g, [{ scale: '1.35' }, { scale: '1' }], { duration: 1400, easing: 'cubic-bezier(.2,.7,.2,1)' }); });
        anim(year, [{ transform: 'translateX(70%)' }, { transform: 'none' }], { duration: 1000, easing: SOFT });
        anim(year, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in });
        setTimeout(() => hap('tick'), 120);
        await sw(1050);
        // the year flies out left, the rings part like a curtain onto paper
        anim(year, [{ transform: 'none' }, { transform: 'translateX(-130%)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' });
        await sw(220);
        anim(halves[0], [{ transform: 'none' }, { transform: 'translateY(-101%)' }], { duration: 950, easing: SOFT });
        anim(halves[1], [{ transform: 'none' }, { transform: 'translateY(101%)' }], { duration: 950, easing: SOFT });
        hap('snap');
        rise([...el.querySelectorAll('.ws-copy > *')], { d0: 380, gap: 90 });
        anim(el.querySelector('.ws-band'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1000, easing: SOFT, delay: 420 });
        el.querySelector('.ws-btrack').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 7000, iterations: Infinity, easing: 'linear' });
        drawLine(el.querySelector('.ws-line'), 1400, 360);
        o.gazeAt(-0.25, 0.3);
        await sw(1700);
      } },
    { id: 'orders', dark: true, ms: 2400,
      html: (d) => `<div class="ws-corner">${stripeRings()}</div>${squiggle(1, '#F1EFE6')}
        <div class="ws-copy"><div class="ws-h">You shopped.<br>We counted.</div></div>
        <div class="ws-num"><b>0</b></div>
        <div class="ws-cap"><div class="ws-h2">orders placed in 2026</div><div class="ws-s">That's one every ${d.EVERY} days 📦</div></div>`,
      async play(el, { sw }, o, d) {
        spin(el.querySelector('.ws-corner'), -360, 30000);
        anim(el.querySelector('.ws-corner'), [{ scale: '.6' }, { scale: '1' }], { duration: 1200, easing: 'cubic-bezier(.2,.7,.2,1)' });
        rise([...el.querySelectorAll('.ws-copy > *')], { d0: 120 });
        drawLine(el.querySelector('.ws-line'), 1100, 100);
        await sw(1250);
        // the line drifts up and goes; the number slams in from the left, counting as it travels
        const copy = el.querySelector('.ws-copy');
        anim(copy, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-34px)' }], { duration: 420, easing: EASE.out });
        const num = el.querySelector('.ws-num b');
        anim(num, [{ transform: 'translateX(-460px)', opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 1000, easing: SOFT, delay: 200 });
        countUp([num], d.ORDERS, 950);
        setTimeout(() => { hap('pop'); o.hop(1.4); }, 820);
        rise([...el.querySelectorAll('.ws-cap > *')], { d0: 700, y: 18, gap: 90 });
        await sw(1900);
      } },
    { id: 'saved', dark: false, ms: 2700,
      html: (d) => {
        const dots = (n) => Array.from({ length: n }, (_, r) => `<div class="ws-row${r % 2 ? ' o' : ''}">${'<i></i>'.repeat(7)}</div>`).join('');
        const amt = `<span>AED <em>0</em></span>`;
        return `<div class="ws-dots t">${dots(3)}</div><div class="ws-dots b">${dots(3)}</div>
        <div class="ws-copy"><div class="ws-h">Every deal<br>adds up.</div></div>
        <div class="ws-kick">You saved</div>
        <div class="ws-marq"><div class="ws-track">${amt}${amt}${amt}${amt}</div></div>
        <div class="ws-cap s"><div class="ws-s">on deals, coupons &amp; noon One 🎉</div></div>`;
      },
      async play(el, { sw }, o, d) {
        rise([...el.querySelectorAll('.ws-copy > *')], { d0: 100 });
        // the dots ripple into yellow dashes, column by column (the reference's red dashes)
        const rows = [...el.querySelectorAll('.ws-row')];
        rows.forEach((row, ri) => [...row.children].forEach((dot, ci) => {
          anim(dot, [{ transform: 'scale(1)', background: '#0E0E0E' }, { transform: 'scale(1.75, .4)', background: '#FEEE00', offset: 0.45 }, { transform: 'scale(1.75, .4)', background: '#FEEE00', offset: 0.7 }, { transform: 'scale(1)', background: '#0E0E0E' }],
            { duration: 1900, easing: 'cubic-bezier(.65,0,.35,1)', delay: 300 + ci * 90 + (ri % 3) * 50 });
        }));
        el.querySelectorAll('.ws-dots').forEach((g, i) => anim(g, [{ transform: `translateY(${i ? 40 : -40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE.ms, easing: EASE.move }));
        await sw(1350);
        anim(el.querySelector('.ws-copy'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-30px)' }], { duration: 420, easing: EASE.out });
        // "You saved" and the amount as a marquee band (the reference's "listening age" ticker)
        rise([el.querySelector('.ws-kick')], { d0: 260, y: 20 });
        const marq = el.querySelector('.ws-marq'), track = el.querySelector('.ws-track');
        anim(marq, [{ transform: 'translateX(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100, easing: SOFT, delay: 300 });
        track.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 5200, iterations: Infinity, easing: 'linear' });
        countUp([...el.querySelectorAll('.ws-track em')], d.SAVED, 1100);
        setTimeout(() => { hap('success'); o.hop(1.6); }, 1000);
        rise([...el.querySelectorAll('.ws-cap > *')], { d0: 760, y: 16 });
        await sw(2100);
      } },
    { id: 'curating', dark: true, ms: 1900, final: true,
      html: (d) => `<div class="ws-radar">${'<i></i>'.repeat(4)}</div>
        <div class="ws-copy c"><div class="ws-h">Curating offers<br>for you<span class="ws-ell"><i>.</i><i>.</i><i>.</i></span></div></div>
        <div class="ws-stack"></div>
        <div class="ws-cap c"><div class="ws-s">Matching ${d.ORDERS} orders to 5 worlds of deals</div></div>`,
      async play(el, { sw }, o, d) {
        const L = ctx.layout();
        el.style.setProperty('--cy', `${L.cy}px`);
        el.querySelector('.ws-copy').style.top = `${Math.round(L.cy - 132)}px`;
        el.querySelector('.ws-cap').style.top = `${Math.round(L.cy + 170)}px`;
        // the five worlds as a stack in the carousel's exact spot and pose (spread 0)
        const stack = el.querySelector('.ws-stack');
        stack.innerHTML = ctx.cardsHTML();
        const cards = [...stack.children];
        cards.forEach((c, i) => { const p = ctx.poseOf(i, 0, 0); c.style.transform = p.transform; c.style.zIndex = p.z; });
        rise([...el.querySelectorAll('.ws-copy > *')], { d0: 80 });
        el.querySelectorAll('.ws-radar i').forEach((r, i) => r.animate([{ transform: 'scale(.25)', opacity: 0.75 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 1800, iterations: Infinity, delay: i * 450, easing: 'cubic-bezier(.2,.6,.3,1)' }));
        anim(stack, [{ transform: 'translateY(60px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE.ms, easing: EASE.move, delay: 120 });
        rise([el.querySelector('.ws-cap > *')], { d0: 300, y: 14 });
        // Orbi works the stack: it hovers above, and cards pop out and back as it sorts them
        o.setState('working');
        o.stage({ cx: 187.5, cy: Math.max(92, L.cy - 168), unit: 20 }); o.gazeAt(0, 0.45);
        const order = [3, 1, 4, 2, 0, 1];
        for (let k = 0; k < order.length; k++) {
          await sw(k ? 260 : 600);
          const i = order[k], c = cards[i], base = ctx.poseOf(i, 0, 0).transform, side = k % 2 ? 1 : -1;
          c.style.zIndex = '30';
          const a = anim(c, [{ transform: base }, { transform: `${base} translate(${side * 70}px, -92px) rotate(${side * 14}deg)`, offset: 0.45 }, { transform: base }], { duration: 520, easing: 'cubic-bezier(.45,0,.3,1)' });
          hap('tick');
          a.finished.then(() => { c.style.zIndex = String(ctx.poseOf(i, 0, 0).z); a.cancel(); }, () => {});
        }
        await sw(700);
      } },
  ];

  // run every beat; resolves once the last beat is set for the stage's reveal (or throws 'stale')
  async function run(r, alive, o, data) {
    progress.forEach((p) => p.style.setProperty('--f', 0));
    let prev = null;
    for (let i = 0; i < BEATS.length; i++) {
      if (!alive(r)) throw new Error('stale');
      const b = BEATS[i], el = scene(`ws-${b.id}${b.dark ? ' dark' : ''}`, b.html(data));
      story.appendChild(el);
      ctx.ink(b.dark);
      // the cut: a full-screen push up (the first beat just appears — the page itself has just arrived)
      if (prev) {
        const p0 = prev;
        anim(p0, [{ transform: 'none' }, { transform: 'translateY(-34%)' }], { duration: PUSH, easing: SOFT }).finished.then(() => p0.remove(), () => p0.remove());
        anim(el, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: PUSH, easing: SOFT });
        hap('tap');
        await new Promise((res) => setTimeout(res, reduce.matches ? 0 : 380));   // (its content starts once the push is under way)
      } else anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE.in });
      const c = clock(alive, r); cur = b.final ? null : c;
      const seg = progress[i], fill = seg && anim(seg, [{ '--f': 0 }, { '--f': 1 }], { duration: reduce.matches ? 300 : b.ms, easing: 'linear' });
      try { await b.play(el, c, o, data); } catch (e) { if (e.message !== 'skip') throw e; }
      if (fill) { fill.cancel(); seg.style.setProperty('--f', 1); }
      cur = null; prev = el;
      if (b.final) return el;
    }
  }
  // the last beat steps aside for the stage: its words go, the radar blooms out; its stack is handed over
  function leave(el) {
    if (!el) return;
    [...el.querySelectorAll('.ws-copy, .ws-cap')].forEach((e) => anim(e, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 360, easing: EASE.out }));
    el.querySelectorAll('.ws-radar i').forEach((r) => { r.getAnimations().forEach((a) => a.cancel()); anim(r, [{ transform: 'scale(.6)', opacity: 0.6 }, { transform: 'scale(3)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)' }); });
  }
  return { run, leave, get skippable() { return !!cur; } };
}
