/* ══ Orbi's Claw — the world card (after the user's Figma ref: Sas-Motion 307:49813 "Marketplace card / noon,
   food, minutes, supermall"). A 165 × 190 design box, scaled to wherever it's drawn (the carousel, the story's
   stack, the transition card, the discovery page's hero): a vivid ground with a white glow rising from the
   bottom (the ref's "Art mask"), two product cut-outs bursting out of the bottom edge (the back one blurred),
   the chrome star, a soft-light glow, white sparkles, the heading, a dark count pill with a yellow highlight,
   and the ref's glossy inner bevel. Colours: the ref's four cards (supermall blue, minutes red, food pink,
   noon yellow) + a violet in the same recipe for the fifth world.
   Art: claw/art — the ref's own renders (sneaker, headphones, watch, star, mask/glow/sparkles SVGs) and noon
   product photos cut out of their white studio backgrounds. ══ */
const A = 'claw/art/';
// p: [src, centre x, centre y, height, rotate°, blur px] in the 165 × 190 box
export const CARD = {
  tech: { bg: '#2829F6', bd: '#8A8AFA', pill: '#0809B5', ts: '#001360', hd: '#FFFFFF',
    ins: 'inset 0 2px 9px 3px rgba(255,255,255,.4), inset 0 -6px 4px rgba(0,0,0,.45)',
    back: ['tech-watch.webp', 38, 150, 118, 14, 2], front: ['tech-headphones.webp', 120, 136, 150, -12, 0], star: [70, 96, 46, 18] },
  gym: { bg: '#F82A26', bd: '#F95552', pill: '#C01200', ts: '#6A0002', hd: '#FFFFFF',
    ins: 'inset 0 2px 9px 2px rgba(255,255,255,.6), inset 0 -4px 4px rgba(143,13,0,.4)',
    back: ['gym-whey.webp', 38, 146, 122, -12, 2], front: ['gym-sneaker.webp', 112, 146, 140, -4, 0], star: [118, 92, 42, -12] },
  scents: { bg: '#7B2FF7', bd: '#B48CFF', pill: '#4A12B0', ts: '#1E0550', hd: '#FFFFFF',
    ins: 'inset 0 3px 9px 2px rgba(255,255,255,.55), inset 0 -5px 6px rgba(40,0,100,.45)',
    back: ['scent-supremacy.webp', 50, 150, 138, -13, 1.8], front: ['scent-asad.webp', 114, 140, 158, 11, 0], star: [80, 92, 44, 8] },
  glow: { bg: '#FF1367', bd: '#FF4789', pill: '#BD0043', ts: '#65021E', hd: '#FFFFFF',
    ins: 'inset 0 4px 9px 0 rgba(255,255,255,.8), inset 0 -4px 10px 0 rgba(189,0,67,.4)',
    back: ['glow-niacinamide.webp', 52, 150, 132, -14, 1.8], front: ['glow-serum.webp', 112, 140, 156, 12, 0], star: [80, 94, 44, 6] },
  home: { bg: '#FEDC00', bd: '#FEE74F', pill: '#A55B01', ts: '#401D00', hd: '#1A1A1A',
    ins: 'inset 0 4px 9px 3px rgba(255,255,255,.9), inset 0 -4px 10px 0 rgba(198,140,2,.4)',
    back: ['home-coffee.webp', 40, 148, 132, -9, 2], front: ['home-airfryer.webp', 112, 148, 126, 6, 0], star: [72, 98, 42, 14] },
};
export const cardVars = (s) => { const c = CARD[s.id]; return `--bg:${c.bg};--bd:${c.bd};--pill:${c.pill};--ts:${c.ts};--hd:${c.hd};--ins:${c.ins}`; };
const prod = ([src, x, y, h, r, b], cls) => `<img class="mc-p ${cls}" src="${A}${src}" alt="" decoding="async" draggable="false"
  style="left:${x}px;top:${y}px;height:${h}px;transform:translate(-50%,-50%) rotate(${r}deg);${b ? `filter:blur(${b}px)` : ''}">`;
// the 165 × 190 art (the caller scales it with --k)
export function cardArt(s) {
  const c = CARD[s.id], [sx, sy, sw, sr] = c.star;
  return `<div class="mc"><i class="mc-bg"></i><img class="mc-mask" src="${A}mask.svg" alt="" draggable="false">
    <img class="mc-spark" src="${A}sparkles.svg" alt="" draggable="false">
    ${prod(c.back, 'back')}${prod(c.front, 'front')}
    <img class="mc-star" src="${A}star.webp" alt="" draggable="false" style="left:${sx}px;top:${sy}px;width:${sw}px;transform:translate(-50%,-50%) rotate(${sr}deg)">
    <img class="mc-glow" src="${A}glow.svg" alt="" draggable="false">
    <div class="mc-head"><b>${s.name}</b><span class="mc-pill">Up to <em>${s.best}%</em> off</span></div></div><i class="mc-ins"></i>`;
}

// the landing page's coupon (Figma 309:49973 "Coupon": 244 × 325, white, a 215-tall lavender banner, the offer
// under it). The banner shows the world's two products bursting up from its bottom edge, over the ref's glow and
// sparkles; the offer reads "N% off up to" / "<dirham> cap" (Noontree carries the dirham at U+E001).
const CAP = { tech: 150, gym: 100, scents: 100, glow: 75, home: 200 };
export const couponOf = (s) => ({ pct: Math.min(15, Math.max(10, Math.round(s.best / 6))), cap: CAP[s.id] || 100 });
export function couponArt(s) {
  const c = CARD[s.id], { pct, cap } = couponOf(s), [sx, sy, sw, sr] = c.star;
  return `<div class="lp-ban"><div class="mc lp-art"><img class="mc-mask" src="${A}mask.svg" alt="" draggable="false">
      <img class="mc-spark" src="${A}sparkles.svg" alt="" draggable="false">
      ${prod(c.back, 'back')}${prod(c.front, 'front')}
      <img class="mc-star" src="${A}star.webp" alt="" draggable="false" style="left:${sx}px;top:${sy}px;width:${sw}px;transform:translate(-50%,-50%) rotate(${sr}deg)">
      <img class="mc-glow" src="${A}glow.svg" alt="" draggable="false"></div></div>
    <div class="lp-offer"><p class="l1">${pct}% off up to</p><p class="l2">\uE001${cap}</p></div><i class="lp-stroke"></i>`;
}
