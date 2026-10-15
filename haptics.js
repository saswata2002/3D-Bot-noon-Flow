/* ══ Haptics — iOS-style feedback (engine from the Product Upscale prototype) ══
   Same channels and pacing as noon-home/app.js; only the bot uses it here, so the
   page-wide tap listener is left out, and two kinds are added for Orbi.
   Kinds (named after the iOS generators they map to):
     tick    UISelectionFeedbackGenerator — Orbi turning past a 30° detent
     snap    medium impact @0.8 — Orbi springing back face-on
     edge    rigid impact @0.6 — a vertical drag hitting the tilt limit; Error state
     tap     light impact — pressing the bot; Idle / Working / Dizzy / Sleepy states
     success notification — the entry greeting; Greeting state
     pop     medium impact @0.7 — the entry: Orbi reaching full size        (new)
     land    soft impact @intensity — a hop touching down, by impact speed  (new)
     heavy   heavy impact @1 — the strongest single tap: each angry huff     (new)
     error   error notification — the sharp triple buzz: turning Angry       (new)
   Channels, best first (only one plays):
   · a native host — window.webkit.messageHandlers.haptic (Vercel Sim and any
     WKWebView shell) → real UIFeedbackGenerators, during drags and animations too
   · Android / Chrome — the Vibration API (after the first user gesture)
   · iPhone Safari (WebKit 18+, no Vibration API) — toggling a hidden native
     <input type="checkbox" switch> plays the system haptic, but only inside a
     user activation — and a touch's activation lands on its RELEASE (pointerup /
     touchend), not its press. So on iOS a pulse fired outside one (a press, a
     beat after a tap) is held and played on the finger's release, if that comes
     within IOS_HOLD_MS; older ones are dropped, so an animation's landing never
     borrows a later, unrelated tap. Animation-only kinds still can't play there. */
window.Haptics = (() => {
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const NATIVE = { tick: 'selection', snap: { type: 'medium', intensity: 0.8 }, edge: { type: 'rigid', intensity: 0.6 }, tap: 'light', success: 'success',
    pop: { type: 'medium', intensity: 0.7 }, heavy: { type: 'heavy', intensity: 1 }, error: 'error' };
  // Android (Vibration API): many phone motors can't render a pulse much under ~8 ms, so these are a touch longer
  // than the iOS-style taps they stand for — a tick is still the shortest, heavy/error the only long ones
  const VIBE = { tick: 8, snap: 18, edge: 22, tap: 12, success: [14, 60, 24], pop: 18, heavy: 40, error: [30, 60, 30, 60, 40] };
  let label = null;
  const sw = () => {
    if (label && label.isConnected) return label;
    label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
    label.appendChild(input); document.body.appendChild(label);
    return label;
  };
  // two pulses inside ~40ms read as one blurred bump (and native hosts merge them): a tick is dropped,
  // anything stronger waits until the gap has passed (≤40ms — still reads as the same moment)
  const GAP = 40;
  const IOS_HOLD_MS = 700;
  let iosHeld = null;
  const iosActive = () => !navigator.userActivation || navigator.userActivation.isActive;
  const iosPlay = (kind) => {
    sw().click();
    if (kind === 'success') setTimeout(() => sw().click(), 90);
    if (kind === 'error') { setTimeout(() => sw().click(), 80); setTimeout(() => sw().click(), 160); }
  };
  ['pointerup', 'touchend', 'click'].forEach((ev) => addEventListener(ev, () => {
    const h = iosHeld; iosHeld = null;
    if (h && performance.now() - h.t < IOS_HOLD_MS) try { iosPlay(h.kind); } catch (_) {}
  }, { capture: true, passive: true }));
  let lastAt = -1e9, held = 0;
  function fire(kind, native = NATIVE[kind], vibe = VIBE[kind]) {
    const now = performance.now(), since = now - lastAt;
    if (since < GAP) {
      if (kind === 'tick') return;
      clearTimeout(held); held = setTimeout(() => fire(kind, native, vibe), GAP - since + 1); return;
    }
    lastAt = now;
    try {
      const h = window.webkit && window.webkit.messageHandlers;
      if (h && h.haptic) { h.haptic.postMessage(native || 'light'); return; }
      if (navigator.vibrate) {
        if (!navigator.userActivation || navigator.userActivation.hasBeenActive) navigator.vibrate(vibe || 8);
        return;
      }
      if (iOS) { if (iosActive()) iosPlay(kind); else iosHeld = { kind, t: performance.now() }; }
    } catch (_) {}
  }
  // land: 0..1 — a soft impact whose strength follows the touchdown speed
  const land = (i) => {
    const k = Math.max(0.3, Math.min(1, i));
    fire('land', { type: 'soft', intensity: +k.toFixed(2) }, Math.round(8 + 14 * k));
  };
  return { tick: () => fire('tick'), snap: () => fire('snap'), edge: () => fire('edge'), tap: () => fire('tap'),
    success: () => fire('success'), pop: () => fire('pop'), heavy: () => fire('heavy'), error: () => fire('error'), land };
})();

/* ── Page taps (the Product Upscale engine's tap listener, on the GitFlow Home) ──
   The Home is the "noon App GitFlow" project's (home-app/, #nkHome); its controls are <button> /
   [role=button] (its Pressable), the tab bar a floating nav[data-variant]. Its own kit only buzzes on
   page navigations (Android only), so this engine plays every tap, on iOS too:
     tick     a tab in the tab bar (nothing when tapping the one already selected) — on touch-down
     tap      anything else tappable in the Home — it all sits in the scrolling feed / rails, so on a
              clean release (moved < 8px, < 600ms): starting a scroll or a swipe on it never buzzes
   The bot, the Orbi sheet and its scrim play their own (orbi/main.js); the sheet's composer
   buttons theirs (orbi/colour-picker.js). */
(() => {
  const H = window.Haptics;
  const TAPPABLE = '#nkHome button, #nkHome [role="button"], #nkHome a[href]';
  let pending = null;
  addEventListener('pointerdown', (e) => {
    pending = null;
    const t = e.target.closest && e.target.closest(TAPPABLE);
    if (!t || e.target.closest('#orbiHit, .sheet, .sheet-scrim')) return;
    if (t.closest('#nkHome nav[data-variant]')) {                          // the tab bar
      if (t.getAttribute('aria-current') !== 'page') H.tick();
      return;
    }
    pending = { x: e.clientX, y: e.clientY, t: performance.now() };
  }, { capture: true, passive: true });
  addEventListener('pointerup', (e) => {
    const p = pending; pending = null;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8 && performance.now() - p.t < 600) H.tap();
  }, { capture: true, passive: true });
  addEventListener('pointercancel', () => { pending = null; }, { capture: true, passive: true });
})();
