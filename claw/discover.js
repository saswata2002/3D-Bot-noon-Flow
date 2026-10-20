/* ══ Orbi's Claw — the discovery page ════════════════════════════════════════════════════════════════════
   Where a grabbed card lands: not a PLP but a page made around that one set — a hero in the card's colour
   (its flip side becomes this hero), Orbi's #1 pick on a glowing plinth (drag to turn it), a snap-swiped deck
   of tall cards, coupons, a "steals" grid, and a finale that hands you back to the claw or out to noon's PLP.
   Orbi stays on the page: in the hero first, then in the corner, with a line for each section as it arrives.
   Motion: the noon standard — sections rise on the MOVE spring with a 60 ms stagger and fade in out-cubic
   200 ms; the hero parallaxes; the top bar fades in once the hero has scrolled away. ══ */

const pct = (p) => (p.was ? Math.round((1 - p.price / p.was) * 100) : 0);
const aed = (n) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 2 : 0 });
const short = (t, n = 56) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// each set's story: the hero line, Orbi's lines per section, its coupons
const STORY = {
  gym: { cap: 'Gym essentials', lede: 'Lift heavier, stretch deeper — the gear you keep coming back for, picked for you.', spot: 'My #1 pick for your gains 💪 Drag to spin it', code: 'LIFT' },
  tech: { cap: 'Audio & wearables', lede: 'Earbuds, watches and the small things that make every day sound better.', spot: 'This one\'s a crowd favourite 🎧 Drag to spin it', code: 'TECH' },
  scents: { cap: 'Perfumes', lede: 'Signature scents for every mood — from the office to a night out.', spot: 'Smells like a 5-star review ✨ Drag to spin it', code: 'SCENT' },
  glow: { cap: 'Skincare', lede: 'Serums, sunscreens and the glow-up kit worth putting in your bag.', spot: 'Your skin will thank you 💖 Drag to spin it', code: 'GLOW' },
  home: { cap: 'Kitchen appliances', lede: 'The upgrades that make home feel like a five-star kitchen.', spot: 'Chef\'s kiss 👨‍🍳 Drag to spin it', code: 'HOME' },
};
const LINES = { deck: 'Swipe through — tap + to add 👉', tix: 'Coupons! Tap one to copy 🎟️', grid: 'Small prices, big vibes', end: 'Fancy another go? 🎰' };

export function mountDiscover(ctx) {
  const { root, sheet, anim, EASE, MOVE, hap, speak, reduce } = ctx;
  const dv = document.createElement('div');
  dv.className = 'dv';
  dv.innerHTML = `<div class="dv-scroll" data-no-drag></div><div class="dv-bar"><span></span></div>
    <button class="dv-back" type="button" aria-label="Back to the claw"><svg viewBox="0 0 22 16" aria-hidden="true"><path d="M21 8H1.5M8 1L1 8l7 7"/></svg></button>`;
  root.appendChild(dv);
  const scroller = dv.querySelector('.dv-scroll'), bar = dv.querySelector('.dv-bar'), back = dv.querySelector('.dv-back');
  let set = null, io = null, timerT = 0, on = false, corner = null, said = new Set(), heroIn = null;

  function build(s) {
    const st = STORY[s.id], ps = [...s.products];
    const spot = ps.slice().sort((a, b) => (pct(b) * 0.7 + (b.rating || 4) * 10) - (pct(a) * 0.7 + (a.rating || 4) * 10))[0];
    const rest = ps.filter((p) => p !== spot);
    const cap = [100, 150, 200, 300, 500].find((n) => ps.filter((p) => p.price < n).length >= 4) || 500;
    const steals = ps.filter((p) => p.price < cap).sort((a, b) => a.price - b.price).slice(0, 4);
    const best = Math.max(...ps.map(pct));
    const tile = (p) => `<div class="dv-tile" data-sku="${p.sku}"><div class="t-img">${p.tag ? `<span class="t-tag">${esc(p.tag)}</span>` : ''}<img src="${p.img}" alt="" decoding="async" loading="lazy"></div>
      <div class="t-in"><div class="t-brand">${esc(p.brand)}</div><div class="t-ttl">${esc(short(p.title))}</div>
      <div class="t-row"><b><small>AED</small>${aed(p.price)}</b>${pct(p) >= 5 ? `<u>-${pct(p)}%</u>` : `<u>★ ${p.rating || '4.5'}</u>`}<button class="dv-q" type="button" aria-label="Add to cart">+</button></div></div></div>`;
    scroller.innerHTML = `
      <div class="dv-hero"><div class="h-in">
        <div class="dv-cap">🏆 PICK OF THE DAY · ${esc(st.cap.toUpperCase())}</div>
        <div class="dv-h1">${esc(s.name)}</div>
        <div class="dv-lede">${esc(st.lede)}</div>
        <div class="dv-timer"><i></i><span>Deal ends in <b class="dv-clock">--:--:--</b></span></div>
      </div></div>
      <div class="dv-sec dv-rv" data-say="spot">
        <div class="dv-spot"><span class="s-tag">🏆 TOP PICK</span>${pct(spot) >= 5 ? `<span class="s-off">-${pct(spot)}%</span>` : ''}
          <div class="s-stage"><div class="s-disc"></div><div class="s-img"><img src="${spot.img}" alt="" decoding="async"></div></div>
          <div class="s-meta"><b>${esc(short(spot.title, 80))}</b><span><small style="font-size:13px;font-weight:600">AED</small> ${aed(spot.price)}${spot.was && spot.was > spot.price ? `<s>AED ${aed(spot.was)}</s><em>-${pct(spot)}%</em>` : ''}</span></div>
          <button class="dv-add" type="button"><span>Add to cart</span></button></div></div>
      <div class="dv-sec dv-rv" data-say="deck"><h3>${rest.length} more picks <em>swipe →</em></h3><div class="dv-deck">${rest.map(tile).join('')}</div></div>
      <div class="dv-sec dv-rv" data-say="tix"><h3>Unlocked for you <em>${best}% max</em></h3><div class="dv-tix">
        ${[[`${Math.min(15, Math.max(10, Math.round(best / 6)))}%`, `${st.code}10`, `Extra off today's picks`, 'Min. spend AED 150 · today only'],
           ['AED 25', 'NOONONE', 'noon One members', 'On orders over AED 200'],
           ['FREE', 'SHIPFREE', 'Free express delivery', `On everything in ${s.name}`]]
          .map(([l, c, b, t]) => `<div class="dv-tik"><div class="k-l">${l}</div><div class="k-r"><b>${esc(b)}</b><span>${esc(t)}</span></div><button class="k-copy" type="button" data-code="${c}">${c}</button></div>`).join('')}
      </div></div>
      <div class="dv-sec dv-rv" data-say="grid"><h3>Steals under AED ${cap} <em>${steals.length} picks</em></h3><div class="dv-grid">${steals.map(tile).join('')}</div></div>
      <div class="dv-end dv-rv" data-say="end"><b>Not quite your vibe?</b><span>Four more worlds are waiting in the machine.</span>
        <button class="dv-again" type="button">Grab again</button>
        <button class="dv-all" type="button">Explore all ${esc(st.cap.toLowerCase())} on noon →</button></div>
      <div class="dv-pad"></div>`;
    dv.style.setProperty('--g', s.grad); dv.style.setProperty('--a', s.glow);
    bar.querySelector('span').textContent = s.name;
    // the spotlight: drag to turn the product; it eases back to a slow idle sway
    const spotEl = scroller.querySelector('.dv-spot'), img = spotEl.querySelector('.s-img');
    const tilt = { a: 0, v: 0, drag: null, t0: performance.now() };
    spotEl.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; tilt.drag = { x: e.clientX, a: tilt.a, lx: e.clientX, lt: performance.now() }; });
    spotEl.addEventListener('pointermove', (e) => {
      const d = tilt.drag; if (!d) return;
      const now = performance.now(); tilt.v = (e.clientX - d.lx) / Math.max(1, now - d.lt) * 1000 * 0.25; d.lx = e.clientX; d.lt = now;
      const na = Math.max(-58, Math.min(58, d.a + (e.clientX - d.x) * 0.35));
      if (Math.abs(na) >= 58 && Math.abs(tilt.a) < 58) hap('edge');
      tilt.a = na;
    });
    const endTilt = () => { tilt.drag = null; };
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => spotEl.addEventListener(ev, endTilt));
    const turn = (now) => {
      if (!on) return;
      if (!tilt.drag) { const h = 1 / 60; const sway = reduce.matches ? 0 : Math.sin((now - tilt.t0) / 1400) * 9; tilt.v += (16.75 ** 2 * (sway - tilt.a) - 2 * 0.81 * 16.75 * tilt.v) * h; tilt.a += tilt.v * h; }
      img.style.transform = `rotateY(${tilt.a.toFixed(2)}deg) translateY(${(Math.sin((now - tilt.t0) / 900) * (reduce.matches ? 0 : 4)).toFixed(2)}px)`;
      requestAnimationFrame(turn);
    };
    requestAnimationFrame(turn);
    // add to cart → a morph to "Added", Orbi cheers
    const add = spotEl.querySelector('.dv-add');
    add.addEventListener('click', () => {
      const added = add.classList.toggle('is-added');
      add.querySelector('span').textContent = added ? '✓ Added to cart' : 'Add to cart';
      hap(added ? 'success' : 'tap');
      anim(add, [{ transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 420, easing: EASE.pop });
      if (added) { window.orbi?.hop(1.8); speak('Great pick! It\'s in your cart 🛒', { hold: 1800 }); }
    });
    scroller.querySelectorAll('.dv-q').forEach((q) => q.addEventListener('click', () => {
      const added = q.classList.toggle('is-added'); q.textContent = added ? '✓' : '+';
      hap(added ? 'pop' : 'tap');
      anim(q, [{ transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: 420, easing: EASE.pop });
      if (added) window.orbi?.hop(1.1);
    }));
    scroller.querySelectorAll('.k-copy').forEach((k) => k.addEventListener('click', () => {
      try { navigator.clipboard?.writeText(k.dataset.code).catch(() => {}); } catch {}
      k.classList.add('is-done'); k.textContent = 'COPIED'; hap('success');
      setTimeout(() => { k.classList.remove('is-done'); k.textContent = k.dataset.code; }, 1600);
    }));
    // the deck: each card's product drifts against the swipe (a little depth)
    const deck = scroller.querySelector('.dv-deck');
    let lastSnap = -1;
    deck.addEventListener('scroll', () => {
      const mid = deck.scrollLeft + deck.clientWidth / 2;
      [...deck.children].forEach((t) => { const c = t.offsetLeft + t.offsetWidth / 2, k = (c - mid) / deck.clientWidth; t.querySelector('.t-img img').style.transform = `translateX(${(-k * 26).toFixed(1)}px) rotate(${(-k * 6).toFixed(1)}deg)`; });
      const i = Math.round(deck.scrollLeft / 184); if (i !== lastSnap) { if (lastSnap >= 0) hap('tick'); lastSnap = i; }
    }, { passive: true });
    scroller.querySelector('.dv-again').addEventListener('click', () => { hap('tap'); ctx.onAgain(); });
    scroller.querySelector('.dv-all').addEventListener('click', () => { hap('tap'); ctx.onExplore(s); });
  }

  // the countdown: today's deal ends at midnight
  function clock() {
    const el = scroller.querySelector('.dv-clock'); if (!el) return;
    const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((end - now) / 1000)), p = (n) => String(n).padStart(2, '0');
    el.textContent = `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }

  // Orbi on the page: in the hero, then the bottom corner once you scroll; a line per section
  const HERO_BOT = () => ({ cx: 322, cy: 96, unit: 24 });
  const CORNER = () => ({ cx: 342, cy: sheet.clientHeight - 56, unit: 15 });
  function onScroll() {
    const y = scroller.scrollTop;
    const hin = scroller.querySelector('.h-in');
    if (hin) { hin.style.transform = `translateY(${(y * 0.38).toFixed(1)}px)`; hin.style.opacity = String(Math.max(0, 1 - y / 260)); }
    bar.classList.toggle('is-on', y > 230);
    const c = y > 150;
    if (c !== corner) { corner = c; window.orbi?.stage(c ? CORNER() : HERO_BOT()); if (c) ctx.hush(); }
  }
  scroller.addEventListener('scroll', onScroll, { passive: true });

  function observe() {
    io && io.disconnect();
    io = new IntersectionObserver((ents) => {
      let k = 0;
      ents.filter((e) => e.isIntersecting).forEach((e) => {
        const el = e.target; io.unobserve(el);
        const d = (k++) * 60;
        anim(el, [{ transform: 'translateY(18px)' }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: d });
        anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: d });
        const key = el.dataset.say;
        if (key && !said.has(key) && corner) { said.add(key); setTimeout(() => on && speak(key === 'spot' ? STORY[set.id].spot : LINES[key], { hold: 2200 }), 160 + d); }
      });
    }, { root: scroller, threshold: 0.35 });
    scroller.querySelectorAll('.dv-rv').forEach((el) => io.observe(el));
  }

  // in: the hero's lines rise out of the card's flip side; the page under it reveals as you go
  function show(s, { fromFlood = true } = {}) {
    set = s; on = true; said = new Set(); corner = null;
    build(s); scroller.scrollTop = 0;
    dv.classList.add('is-on');
    clock(); clearInterval(timerT); timerT = setInterval(clock, 1000);
    const lines = [...scroller.querySelectorAll('.h-in > *')];
    lines.forEach((el, i) => {
      anim(el, [{ transform: 'translateY(26px)' }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: 80 + i * 60 });
      anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: 80 + i * 60 });
    });
    heroIn = anim(dv, [{ opacity: 0 }, { opacity: 1 }], { duration: fromFlood ? 260 : 200, easing: EASE.in });
    onScroll();
    setTimeout(() => { if (on) { observe(); speak(`Welcome to ${s.name}! These are the ones I'd grab 😉`, { hold: 2600 }); } }, 380);
    return heroIn;
  }
  function hide({ instant = false } = {}) {
    on = false; clearInterval(timerT); io && io.disconnect();
    if (instant) { dv.classList.remove('is-on'); dv.getAnimations().forEach((a) => a.cancel()); return Promise.resolve(); }
    const a = anim(dv, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE.out });
    return a.finished.catch(() => {}).then(() => { dv.classList.remove('is-on'); a.cancel(); });
  }
  back.addEventListener('pointerdown', () => hap('tap'));
  back.addEventListener('click', () => on && ctx.onAgain());
  return { el: dv, show, hide, get on() { return on; }, poke() {
    const tips = ['Scroll on, there\'s more 👇', 'Psst — the coupons stack!', 'I picked these just for you 🫶'];
    speak(tips[Math.floor(Math.random() * tips.length)], { hold: 1800 });
  } };
}
