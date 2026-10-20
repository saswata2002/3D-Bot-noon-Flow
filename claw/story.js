/* ══ Orbi's Claw — the story (after the user's Spotify Wrapped 2025 reference), cut to the two facts that matter:
     1 · orders  — ink: "In 2026 you placed" / the count stamping in digit by digit / "orders" / one every N days
     2 · saved   — paper: "and saved" / the amount on slot-machine reels / on deals, coupons & noon One
   Between them (and out to the card page): a full-screen vertical push, 950 ms on a soft in-out — the next
   surface slides over the last, which drifts up at a third of the speed. A tap jumps ahead. ══ */

const SVGNS = 'http://www.w3.org/2000/svg';
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
    // 1 · orders — ink, rings turning in the corner, a hand-drawn line; the count stamps in digit by digit
    { id: 'orders', dark: true, ms: 2700,
      html: (d) => `<div class="ws-corner">${stripeRings()}</div>${squiggle(1, '#F1EFE6')}
        <div class="ws-ord">
          <div class="ws-k">In 2026 you placed</div>
          <div class="ws-big">${String(d.ORDERS).split('').map((n) => `<span><i class="ws-ring"></i><b>${n}</b></span>`).join('')}</div>
          <div class="ws-w">orders</div>
          <div class="ws-s">That's one every ${d.EVERY} days 📦</div>
        </div>`,
      async play(el, { sw }, o) {
        const corner = el.querySelector('.ws-corner');
        spin(corner, -360, 30000);
        anim(corner, [{ scale: '.6', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 1200, easing: 'cubic-bezier(.2,.7,.2,1)' });
        drawLine(el.querySelector('.ws-line'), 1300, 150);
        rise([el.querySelector('.ws-k')], { d0: 120, y: 18 });
        // each digit drops in from above, tipping forward like a stamp, lands with a squash and a yellow shockwave
        [...el.querySelectorAll('.ws-big span')].forEach((sp, i) => {
          const dl = 420 + i * 170, dg = sp.querySelector('b'), ring = sp.querySelector('.ws-ring');
          anim(dg, [{ transform: 'translateY(-150px) rotateX(70deg) scale(1.25)', opacity: 0 }, { transform: 'translateY(8px) rotateX(-6deg) scale(1.04, .94)', opacity: 1, offset: 0.62 }, { transform: 'none', opacity: 1 }],
            { duration: 640, delay: dl, easing: 'cubic-bezier(.3,0,.25,1)' });
          anim(ring, [{ transform: 'scale(.35)', opacity: 0 }, { transform: 'scale(.35)', opacity: 0.9, offset: 0.01 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 760, delay: dl + 380, easing: 'cubic-bezier(.2,.7,.2,1)' });
          setTimeout(() => { hap('pop'); if (i === 0) o.hop(1.3); }, dl + 390);
        });
        rise([el.querySelector('.ws-w'), el.querySelector('.ws-ord .ws-s')], { d0: 900, y: 16, gap: 110 });
        await sw(2600);
      } },
    // 2 · saved — paper, two light dot rows, the amount on slot-machine reels
    { id: 'saved', dark: false, ms: 3600, final: true,
      html: (d) => {
        const dots = (n) => Array.from({ length: n }, (_, r) => `<div class="ws-row${r % 2 ? ' o' : ''}">${'<i></i>'.repeat(9)}</div>`).join('');
        const chars = fmt(d.SAVED).split(''); let ri = 0;
        const reels = chars.map((ch) => {
          if (ch === ',') return '<b class="ws-comma">,</b>';
          const turns = 2 + ri++, cells = Array.from({ length: turns * 10 + +ch + 1 }, (_, k) => `<i>${k % 10}</i>`).join('');
          return `<div class="ws-reel" data-to="${turns * 10 + +ch}"><div class="ws-strip">${cells}</div></div>`;
        }).join('');
        return `<div class="ws-dots t">${dots(2)}</div><div class="ws-dots b">${dots(2)}</div>
        <div class="ws-kick">and saved</div>
        <div class="ws-slot"><span class="ws-cur">AED</span>${reels}</div>
        <div class="ws-cap s"><div class="ws-s">on deals, coupons &amp; noon One 🎉</div></div>`;
      },
      async play(el, { sw }, o) {
        el.querySelectorAll('.ws-dots').forEach((g, i) => anim(g, [{ transform: `translateY(${i ? 30 : -30}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE.ms, easing: EASE.move }));
        rise([el.querySelector('.ws-kick')], { d0: 60, y: 20 });
        const slot = el.querySelector('.ws-slot');
        anim(slot, [{ transform: 'translateY(40px) rotate(-3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 860, easing: SOFT, delay: 140 });
        const reels = [...el.querySelectorAll('.ws-reel')], CELL = 92;
        let last = 0;
        reels.forEach((rl, i) => {
          const strip = rl.firstElementChild, to = +rl.dataset.to * CELL, ms = reduce.matches ? 300 : 1150 + i * 240, dl = 380 + i * 90;
          // a long decelerating spin a touch past the digit, then a springy settle back onto it; blurred while fast
          anim(strip, [{ transform: 'translateY(0)', easing: 'cubic-bezier(.12,.55,.18,1)' }, { transform: `translateY(${-to - 16}px)`, offset: 0.86, easing: 'cubic-bezier(.3,1.4,.5,1)' }, { transform: `translateY(${-to}px)` }],
            { duration: ms, delay: dl, easing: 'linear' });
          anim(strip, [{ filter: 'blur(0px)' }, { filter: 'blur(2.6px)', offset: 0.12 }, { filter: 'blur(2.2px)', offset: 0.5 }, { filter: 'blur(0px)', offset: 0.82 }], { duration: ms, delay: dl, easing: 'linear' });
          setTimeout(() => { hap('tick'); anim(rl, [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)', offset: 0.4 }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }, dl + ms * 0.86);
          last = Math.max(last, dl + ms);
        });
        // the jackpot: the plaque pops, the dots ripple into yellow dashes, the bot hops
        setTimeout(() => {
          hap('success'); o.hop(1.6);
          anim(slot, [{ transform: 'none' }, { transform: 'scale(1.05) rotate(1.5deg)', offset: 0.35 }, { transform: 'none' }], { duration: 620, easing: EASE.pop });
          [...el.querySelectorAll('.ws-row')].forEach((row, ri) => [...row.children].forEach((dot, ci) => {
            anim(dot, [{ transform: 'scale(1)', background: '#0E0E0E' }, { transform: 'scale(1.8, .42)', background: '#FEEE00', offset: 0.4 }, { transform: 'scale(1.8, .42)', background: '#FEEE00', offset: 0.75 }, { transform: 'scale(1)', background: '#0E0E0E' }],
              { duration: 1500, easing: 'cubic-bezier(.65,0,.35,1)', delay: ci * 55 + (ri % 2) * 40 });
          }));
        }, last - 120);
        rise([...el.querySelectorAll('.ws-cap > *')], { d0: last - 300, y: 16 });
        await sw(last + 850);
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
      const c = clock(alive, r); cur = c;
      const seg = progress[i], fill = seg && anim(seg, [{ '--f': 0 }, { '--f': 1 }], { duration: reduce.matches ? 300 : b.ms, easing: 'linear' });
      try { await b.play(el, c, o, data); } catch (e) { if (e.message !== 'skip') throw e; }
      if (fill) { fill.cancel(); seg.style.setProperty('--f', 1); }
      cur = null; prev = el;
      if (b.final) return el;
    }
  }
  // the last beat pushes up and away as the card page slides in under it (the same cut as between the beats)
  function leave(el) {
    if (!el) return;
    anim(el, [{ transform: 'none' }, { transform: 'translateY(-34%)' }], { duration: PUSH, easing: SOFT }).finished.then(() => el.remove(), () => el.remove());
  }
  const cut = { PUSH, SOFT };
  return { run, leave, cut, get skippable() { return !!cur; } };
}
