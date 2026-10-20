/* ══ Orbi's Claw — the discovery page, 1:1 with Figma Sas-Motion 306:49099 "noon Offers — Full page" ═════════
   Where a grabbed coupon lands: "Offers for you", built for the world the claw picked —
     01 Perfect deal pick for you — the hero card: ETA strip, media with rank tag / discount / wishlist, brand ·
        rating · reviews · express, title, and a swipe-to-buy rail with the total
     02 More deals that you might like — a centre-focus carousel of deal cards (the world's picks)
     04 Want to try something similar to your usuals? — a neighbouring category
     05 Brands you love, just in a fresh new deal — brand cards with a line item and Add to cart
     06 Want to keep it light? — small treats under AED 99, three round picks
     07 Trending deals near you — full-bleed trend cards
   Data: claw/offers.js (real noon.com UAE products scraped from noon search) + the world's own picks
   (claw/catalog.js). Motion: the noon standard — sections rise on MOVE with a 60 ms stagger as they scroll in;
   rewards (add to cart, wishlist, swipe to buy) pop on the ζ .55 spring. ══ */
import { OFFERS } from './offers.js';

const I = 'claw/art/op/';
const D = '';                                   // Noontree's dirham glyph
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => (n == null ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 2 : 0 }));
const kfmt = (c) => (c == null || c === '' ? '' : typeof c === 'number' ? (c >= 1000 ? `${(c / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(c)) : String(c));
const off = (p) => p.off || (p.was ? Math.round((1 - p.price / p.was) * 100) : 0);
const shortName = (t, b, n = 30) => {
  let s = t.toLowerCase().startsWith(String(b).toLowerCase()) ? t.slice(b.length) : t;
  s = s.replace(/^[\s,:-]+/, '').split(/\s[-–|]\s|,|\(|\[/)[0].trim();
  if (s.length > n) s = s.slice(0, n).replace(/\s+\S*$/, '');
  return s.replace(/\s+(and|with|for|by|of|&|-|in)$/i, '');
};
// the world's own picks (catalog.js) as deal cards
const fromCatalog = (p) => ({ brand: p.brand, name: shortName(p.title, p.brand), rating: p.rating, count: p.ratingCount, price: p.price, was: p.was, off: off(p), meta: p.tag, img: p.img });
const HEAD = { tech: 'Headphones', gym: 'Sneakers', scents: 'Fragrance', glow: 'Face Serums', home: 'Blenders' };
const SIM_LINE = { tech: 'Explore bluetooth speakers', gym: 'Explore fitness trackers', scents: 'Explore bakhoor', glow: 'Explore hair serums', home: 'Explore electric kettles' };

const rating = (r, c) => (r ? `<span class="op-rt"><img src="${I}star.svg" alt=""><b>${r}</b></span>${c ? `<span class="op-ct">(${esc(kfmt(c))})</span>` : ''}` : '');
const heart = (cls = '') => `<button class="op-wish ${cls}" type="button" aria-label="Wishlist"><img src="${I}heart16.svg" alt=""><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14s-5.6-3.4-5.6-7.3C2.4 4.6 4 3 5.9 3 7 3 7.7 3.6 8 4.2 8.3 3.6 9 3 10.1 3 12 3 13.6 4.6 13.6 6.7 13.6 10.6 8 14 8 14z"/></svg></button>`;
const addBtn = () => `<button class="op-add" type="button"><span>ADD</span><img src="${I}plus.svg" alt=""></button>`;
const title = (pre, mark) => `<div class="op-title">${pre ? `<p>${esc(pre)}</p>` : ''}<span class="op-mark"><i></i>${esc(mark)}</span></div>`;

function dealCard(p, i) {
  return `<div class="op-deal" data-i="${i}"><div class="op-media">${p.img ? `<img class="op-img" src="${p.img}" alt="" decoding="async" loading="lazy">` : ''}
      ${off(p) >= 5 ? `<span class="op-off">${off(p)}% OFF</span>` : ''}${heart()}${p.rank ? `<span class="op-rank s">${esc(p.rank)}</span>` : ''}</div>
    <div class="op-body"><div class="op-brow"><span class="op-brand">${esc(p.brand)}</span><img class="op-exp" src="${I}express.svg" alt="express"></div>
      <p class="op-name">${esc(p.name)}</p>
      <div class="op-meta">${rating(p.rating, p.count)}${p.meta ? `<span class="op-dot">·</span><span class="op-var">${esc(p.meta)}</span>` : ''}</div>
      <div class="op-pa"><div class="op-price"><b>${D}${money(p.price)}</b>${p.was ? `<s>${money(p.was)}</s>` : ''}</div>${addBtn()}</div></div></div>`;
}
function brandCard(p, i) {
  const eta = p.eta ? 'Get it today' : 'Get it tomorrow';
  return `<div class="op-bc" data-i="${i}"><div class="op-bm"><img class="op-img" src="${p.img}" alt="" decoding="async" loading="lazy"></div>
    <div class="op-bb"><p class="op-bn">${esc(p.brand)}</p><p class="op-eta"><img src="${I}clock.svg" alt="">${eta}</p></div><i class="op-div"></i>
    <div class="op-bi"><p class="op-li"><img src="${I}fbn.svg" alt=""><span>1 x ${esc(p.name)}</span></p>
      <div class="op-bpa"><div class="op-price m"><b>${D}${money(p.price)}</b>${p.was ? `<s>${money(p.was)}</s>` : ''}</div>
        <button class="op-atc" type="button"><span>Add to cart</span><img src="${I}chev-bold-blue.svg" alt=""></button></div>
      <p class="op-best">Best offer applied</p></div></div>`;
}
function trendCard(p, i) {
  const nudge = off(p) >= 30 ? 'Lowest price in a year' : '';
  return `<div class="op-tc" data-i="${i}"><i class="op-tint"></i><img class="op-timg" src="${p.img}" alt="" decoding="async" loading="lazy"><i class="op-fade"></i>
    ${off(p) >= 5 ? `<span class="op-off t">${off(p)}% OFF</span>` : ''}${heart('t')}
    <div class="op-tb">${nudge ? `<span class="op-nudge"><img src="${I}discount.svg" alt="">${nudge}</span>` : ''}
      <div class="op-trow"><b>${esc(p.name)}</b><b>${D}${money(p.price)}</b></div>
      <div class="op-tsub"><span>${esc(p.brand)}${p.rank ? ` · ${esc(p.rank.replace(/^#\d+ in /, ''))}` : ''}</span>${p.was ? `<s>${money(p.was)}</s>` : ''}</div>
      <div class="op-tpa"><div class="op-meta">${rating(p.rating, p.count)}<img class="op-exp" src="${I}express.svg" alt="express"></div>${addBtn()}</div></div></div>`;
}

export function mountDiscover(ctx) {
  const { root, anim, EASE, MOVE, hap } = ctx;
  const dv = document.createElement('div');
  dv.className = 'dv op';
  dv.innerHTML = `<div class="dv-scroll" data-no-drag></div>
    <div class="op-head"><button class="dv-back op-back" type="button" aria-label="Back"><img src="claw/art/lp/back.svg" width="20" height="20" alt=""></button><span>Offers for you</span></div>`;
  root.appendChild(dv);
  const scroller = dv.querySelector('.dv-scroll'), head = dv.querySelector('.op-head'), back = dv.querySelector('.op-back');
  let io = null, on = false;

  function build(s) {
    const o = OFFERS[s.id], h = o.hero;
    const deals = s.products.filter((p) => p.was).map(fromCatalog).slice(0, 6);
    scroller.innerHTML = `<i class="op-glow"></i>
      <section class="op-sec op-hero-sec">${title('', 'Perfect deal pick for you')}
        <div class="op-hero">
          <div class="op-strip"><img src="${I}flash.svg" alt=""><b>${esc(h.eta || 'Get it in 1 hr 14 mins')}</b><i></i><span>Home · Marina Gate 1, Dubai Marina</span></div>
          <div class="op-hmedia"><img class="op-img" src="${h.img}" alt="" decoding="async">
            <span class="op-rank">${esc(h.rank ? h.rank.replace(/ & .*$/, '') : `#1 in ${HEAD[s.id]}`)}</span>${off(h) >= 5 ? `<span class="op-off h">${off(h)}% OFF</span>` : ''}${heart('h')}</div>
          <div class="op-info"><div class="op-brow"><span class="op-brand l">${esc(h.brand)}</span>${rating(h.rating, h.count)}<img class="op-exp t" src="${I}express-today.svg" alt="express today"></div>
            <p class="op-htitle">${esc(h.name)}</p></div>
          <div class="op-swipe"><div class="op-knob"><b>SWIPE TO BUY</b><img src="${I}chev-bold.svg" alt=""></div>
            <div class="op-hint"><img src="${I}hint1.svg" alt=""><img src="${I}hint2.svg" alt=""><img src="${I}hint3.svg" alt=""></div>
            <div class="op-total"><p><span>Total</span><b>${D}${money(h.price)}</b>${h.was ? `<s>${money(h.was)}</s>` : ''}</p><em>(with offers)</em></div>
            <div class="op-done">✓ Added to cart</div></div>
        </div></section>
      <section class="op-sec op-rv"><i class="op-hair"></i>${title('More deals', 'that you might like')}
        <div class="op-car op-deals" data-no-drag>${deals.map(dealCard).join('')}</div>
        <button class="op-more" type="button"><span>Explore more</span><img src="${I}arrow-right.svg" alt=""></button></section>
      <section class="op-sec s op-rv"><div class="op-sim"><div class="op-simc"><p>Want to try something similar to your usuals?</p>
          <button class="op-link" type="button"><span>${esc(SIM_LINE[s.id])}</span><img src="${I}chev-blue.svg" alt=""></button></div>
        <div class="op-simm"><img class="op-img" src="${o.similar.img}" alt="" decoding="async" loading="lazy"></div></div></section>
      <section class="op-sec b op-rv"><div class="op-panel"><div class="op-ptitle"><p>Brands you love,</p><p>just in a fresh new deal</p></div>
        <div class="op-car op-brands" data-no-drag>${o.brands.map(brandCard).join('')}</div>
        <button class="op-link c" type="button"><span>Explore more</span><img src="${I}chev-blue.svg" alt=""></button></div></section>
      <section class="op-sec op-rv"><i class="op-hair"></i>${title('', 'Want to keep it light?')}
        <div class="op-panel l"><div class="op-lh"><b>Small treats under ${D}99</b><span>${esc(o.light.sub)}</span></div>
          <div class="op-picks">${o.light.picks.map((p) => `<button class="op-pick" type="button"><span class="op-pm"><img class="op-img" src="${p.img}" alt="" decoding="async" loading="lazy"></span><b>${esc(p.label)}</b><span class="op-from"><i>from</i><em>${D}${money(p.from)}</em></span></button>`).join('')}</div>
          <button class="op-link c" type="button"><span>Explore more</span><img src="${I}chev-blue.svg" alt=""></button></div></section>
      <section class="op-sec op-rv"><i class="op-hair"></i><div class="op-title"><span class="op-pin"><img src="${I}location.svg" alt=""></span><p>Trending deals</p><span class="op-mark"><i></i>near you</span></div>
        <div class="op-car op-trend" data-no-drag>${o.trending.map(trendCard).join('')}</div></section>
      <div class="op-end"><button class="dv-again" type="button">Grab again</button><button class="dv-all" type="button">Explore all ${esc(s.name)} on noon →</button></div>`;
    wire(s);
  }

  // interactions
  function wire(s) {
    scroller.querySelectorAll('.op-wish').forEach((w) => w.addEventListener('click', () => {
      const onw = w.classList.toggle('is-on'); hap(onw ? 'pop' : 'tap');
      anim(w, [{ transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: 520, easing: EASE.pop });
    }));
    scroller.querySelectorAll('.op-add, .op-atc').forEach((b) => b.addEventListener('click', () => {
      const atc = b.classList.contains('op-atc'), added = b.classList.toggle('is-added');
      b.querySelector('span').textContent = added ? (atc ? 'Added ✓' : 'ADDED') : (atc ? 'Add to cart' : 'ADD');
      hap(added ? 'success' : 'tap'); anim(b, [{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 520, easing: EASE.pop });
      if (added) window.orbi?.hop(1.1);
    }));
    scroller.querySelectorAll('.op-more, .op-link, .op-pick, .dv-all').forEach((b) => b.addEventListener('click', () => { hap('tap'); ctx.onExplore(s); }));
    scroller.querySelector('.dv-again').addEventListener('click', () => { hap('tap'); ctx.onAgain(); });
    // centre-focus carousels: the card nearest the centre is fully opaque (Figma: neighbours at .9), a tick per snap
    scroller.querySelectorAll('.op-car').forEach((car) => {
      let last = -1;
      const focus = () => {
        const mid = car.scrollLeft + car.clientWidth / 2; let best = 0, bd = 1e9;
        [...car.children].forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
        [...car.children].forEach((c, i) => c.classList.toggle('is-f', i === best));
        if (best !== last) { if (last >= 0) hap('tick'); last = best; }
      };
      // start centred on the second card (as the Figma frames show), so there's a neighbour on each side
      requestAnimationFrame(() => { const c = car.children[Math.min(1, car.children.length - 1)]; if (c) car.scrollLeft = c.offsetLeft + c.offsetWidth / 2 - car.clientWidth / 2; focus(); });
      car.addEventListener('scroll', focus, { passive: true });
    });
    // swipe to buy: drag the knob to the end of the rail
    const rail = scroller.querySelector('.op-swipe'), knob = rail.querySelector('.op-knob');
    let drag = null, x = 0;
    const max = () => rail.clientWidth - knob.offsetWidth - 8;
    const place = (v) => { x = v; knob.style.transform = `translateX(${v.toFixed(1)}px)`; rail.style.setProperty('--p', (v / max()).toFixed(3)); };
    knob.addEventListener('pointerdown', (e) => { if (rail.classList.contains('is-done')) return; drag = { x0: e.clientX, v0: x }; try { knob.setPointerCapture(e.pointerId); } catch {} hap('tap'); knob.getAnimations().forEach((a) => a.cancel()); });
    knob.addEventListener('pointermove', (e) => { if (!drag) return; place(Math.max(0, Math.min(max(), drag.v0 + (e.clientX - drag.x0) * (375 / innerWidth || 1)))); });
    const release = () => {
      if (!drag) return; drag = null;
      if (x > max() * 0.72) {
        const from = x; place(max());
        knob.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${max()}px)` }], { duration: 200, easing: EASE.in });
        rail.classList.add('is-done'); hap('success'); window.orbi?.hop(1.8);
      } else {
        const from = x; place(0);
        knob.animate([{ transform: `translateX(${from}px)` }, { transform: 'translateX(0)' }], { duration: MOVE.ms, easing: EASE.move });
      }
    };
    knob.addEventListener('pointerup', release); knob.addEventListener('pointercancel', release);
    knob.addEventListener('click', () => { if (!drag && x === 0 && !rail.classList.contains('is-done')) anim(knob, [{ transform: 'translateX(0)' }, { transform: 'translateX(22px)', offset: 0.4 }, { transform: 'translateX(0)' }], { duration: 620, easing: EASE.pop }); });
  }

  function onScroll() { head.classList.toggle('is-on', scroller.scrollTop > 24); }
  scroller.addEventListener('scroll', onScroll, { passive: true });

  function observe() {
    io && io.disconnect();
    io = new IntersectionObserver((ents) => {
      let k = 0;
      ents.filter((e) => e.isIntersecting).forEach((e) => {
        const el = e.target; io.unobserve(el); const d = (k++) * 60;
        anim(el, [{ transform: 'translateY(24px)' }, { transform: 'none' }], { duration: MOVE.ms, easing: EASE.move, delay: d });
        anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE.in, delay: d });
      });
    }, { root: scroller, threshold: 0.12 });
    scroller.querySelectorAll('.op-rv').forEach((el) => io.observe(el));
  }

  // in: the page fades up, the hero card rises with its product popping in; the rest reveals on scroll
  function show(s, { fromFlood = true } = {}) {
    on = true;
    build(s); scroller.scrollTop = 0; onScroll();
    dv.classList.add('is-on');
    window.orbi?.statusInk(null);
    const a = anim(dv, [{ opacity: 0 }, { opacity: 1 }], { duration: fromFlood ? 260 : 200, easing: EASE.in });
    const hero = scroller.querySelector('.op-hero'), heroImg = scroller.querySelector('.op-hmedia .op-img');
    anim(scroller.querySelector('.op-hero-sec .op-title'), [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE.ms, easing: EASE.move, delay: 80 });
    anim(hero, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: MOVE.ms, easing: EASE.move, delay: 160 });
    if (heroImg) anim(heroImg, [{ transform: 'translateY(30px) scale(.82)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 760, easing: EASE.pop, delay: 300 });
    requestAnimationFrame(observe);
    return a;
  }
  function hide({ instant = false } = {}) {
    on = false; io && io.disconnect();
    if (instant) { dv.classList.remove('is-on'); dv.getAnimations().forEach((x) => x.cancel()); return Promise.resolve(); }
    const a = anim(dv, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: EASE.out });
    return a.finished.catch(() => {}).then(() => { dv.classList.remove('is-on'); a.cancel(); });
  }
  back.addEventListener('pointerdown', () => hap('tap'));
  back.addEventListener('click', () => on && ctx.onAgain());
  return { el: dv, show, hide, get on() { return on; }, poke() {} };
}
