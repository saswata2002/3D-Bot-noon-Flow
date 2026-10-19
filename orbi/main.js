// Orbi — 3D build of the Figma "Bot 3D 01" set (1032:19174).
//
// The body is a rigid ball: it never squashes or deforms. All motion is
// whole-body — a light hover spring, airy hops with a couple of rebounds and
// a nod/rock wobble kicked by each landing. The bot ignores the cursor; press
// and drag sideways to rotate it freely (it follows the pointer 1:1 and glides
// on with momentum when released, then springs back to face the camera);
// swipe up / down to raise / lower the visor.
//
// The face is not geometry: each state is drawn into a canvas in Figma
// coordinates and sampled in the shader by the vertex's rest direction.
//
// Brought over 1:1 from github.com/saswata2002/3D-noon-bot (6f0850f — brand
// colours, lacquer finish, shorter eyes; first ported at f0a4ade). The only changes:
// the state bar and its visor button are gone (keys 1–6 switch states, V or a
// vertical swipe flips the visor),
// the white scene background is dropped (transparent over Home), the canvas is
// framed to Figma 1068:81084 instead of filling the window, and drag/tap are
// taken from the bot's 80×80 Figma box rather than the whole canvas. Haptics
// (../haptics.js) are added on the entry and on every interaction — see `haptic`.

import * as THREE from 'three';
import { createHelmet, SURFACE_GLSL, SHELL_PATH } from './helmet.js';
import { mountColourPicker } from './colour-picker.js';   // (this page: the sheet's colour slider)

// ─── constants ────────────────────────────────────────────────────────────
const R = 1;                    // body radius (Figma body = 240px → 120px = 1 unit)
const HOVER_Y = 0;              // resting centre height while floating
const FLOOR_Y = -1.18;          // Figma: body bottom 270, contact shadow 288 → 0.15R gap
const GRAVITY = 17;              // low: a light, floaty toy ball
const DRAG_YAW = 0.0105;        // rad per px of horizontal drag (~360° over 600px)
const DRAG_PITCH = 0.006;       // rad per px of vertical drag (tilt while swiping the visor)
const MAX_TILT = 0.5;
const BASE_PITCH = -0.2;        // tip the face up toward the camera

// ─── haptics (../haptics.js) ──────────────────────────────────────────────
//   entry   pop when it reaches full size · success as it greets · soft land
//   press   light tap on touch-down (inside the gesture, so it plays on iOS too)
//   spin    a selection tick per 30° detent while dragged / coasting · medium
//           snap as it springs back face-on
//   tilt    rigid bump when a vertical drag hits the limit
//   hops    soft landing, strength from the touchdown speed (rebounds softer)
//   sleep   third quick tap: a soft settle as it dozes off
//   keys    1–6: greeting success, error rigid, the rest a light tap
const haptic = (kind, ...a) => { try { window.Haptics && window.Haptics[kind](...a); } catch {} };
const DETENT = Math.PI / 6;

const STATES = [
  { key: 'idle',     label: 'Idle' },
  { key: 'greeting', label: 'Greeting' },
  { key: 'working',  label: 'Working' },
  { key: 'error',    label: 'Error' },
  { key: 'dizzy',    label: 'Dizzy' },
  { key: 'sleepy',   label: 'Sleepy' },
  { key: 'angry',    label: 'Angry' },
];

// ─── renderer / scene ─────────────────────────────────────────────────────
const canvas = document.getElementById('orbi');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);
// No shadow maps: at the softness wanted they turned blocky/kinked on the
// curved face. Helmet-on-ball shading is an analytic occlusion term in the
// ball's shader instead (see HELMET_AO_GLSL).

const scene = new THREE.Scene();
// (upstream sets scene.background white to match its page; here the canvas is a
// transparent layer over Home, so the background stays clear)
const pmrem = new THREE.PMREMGenerator(renderer);

// Studio environment: a dim warm gradient dome plus one large softbox up-left
// and two weak fills. Replaces RoomEnvironment, whose many small panel lights
// read as scattered hot spots on the ball.
function studioEnvironment() {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 floorC = vec3(0.045, 0.042, 0.035);
          vec3 sky = vec3(0.30, 0.29, 0.27);
          gl_FragColor = vec4(mix(floorC, sky, smoothstep(-0.25, 0.85, h)), 1.0);
        }`,
    }),
  );
  env.add(dome);
  const panel = (w, h, intensity, pos) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.93).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    p.position.set(...pos);
    p.lookAt(0, 0, 0);
    env.add(p);
  };
  panel(15, 12, 1.9, [-7, 8, 9]);  // key softbox — large, so highlights stay broad and soft
  panel(7, 10, 0.6, [10, 1, 5]);   // right fill
  panel(8, 2.5, 0.7, [3, 5, -10]); // back rim strip
  return env;
}
scene.environment = pmrem.fromScene(studioEnvironment(), 0.06).texture;
scene.environmentIntensity = 1.2;

// long lens: close to the flat Figma front view, so near parts (forehead,
// wordmark) aren't magnified by perspective
const FOV = 13.5;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
const CAM_TARGET = new THREE.Vector3(0, -0.22, 0);
camera.position.set(0, 3.1, 15.2);
camera.lookAt(CAM_TARGET);

const key = new THREE.DirectionalLight(0xfff8e6, 2.0);
key.position.set(-3.6, 5, 4);
scene.add(key);
const bounce = new THREE.HemisphereLight(0xfffcf0, 0x6a6040, 0.85);   // brighter, warmer fill: lifts the shadow side
scene.add(bounce);
const rim = new THREE.DirectionalLight(0xfff4c0, 0.25);
rim.position.set(3.5, 2.5, -3);   // upper back: rims the silhouette without glaring on the flap tips
scene.add(rim);

// ─── framing: 1:1 with Figma "Orbi Soft Idle + Helmet" (1068:81084) ──────
// The frame is 80×80 at (287, 644) in the 375×812 Home frame and its body
// (r 30) is centred at (40, 37.5): 1 unit = 30 px, ball centre at (327, 681.5).
// The camera keeps its lens, position and target; setViewOffset only moves and
// crops the frustum so the resting ball lands on that point at that scale,
// wherever the canvas sits. `view` is where the ball is drawn (see goPage).
// The canvas is a small box (CANVAS_BOX) that travels with the ball — moved by
// a compositor transform, not redrawn bigger — so iOS renders and composites
// ~5× fewer pixels than a full-screen WebGL layer over a scrolling page.
const VIEW = {
  home: { cx: 327, cy: 681.5, unit: 30 },        // 1068:81084 — 80×80 FAB at (287, 644)
  page: { cx: 187.5, cy: 122, unit: 45 },       // the full page (2026-10-19): at rest centred at its top, under the status bar (was on the 1086:92697 sheet's edge)
};
const view = { ...VIEW.home };
// room around the ball for hops, the dizzy orbit, Zz and the soft shadows, even
// at the sheet's 45 px/unit: ±2.9 units across, 3.5 up, 2.7 down
const CANVAS_BOX = { w: 260, h: 280, ax: 130, ay: 160 };
const camDir = new THREE.Vector3();
// pick up + carry (see the pointer section): an offset from `view` and a lift
const CARRY = {
  holdMs: 280,                        // a still press this long picks the bot up
  lift: 0.1,                          // picked up: 80 → 88 (Figma 1096:112825), 10 % bigger
  omega: 13, zeta: 0.7,               // release: a spring home — one gentle overshoot (≈5 % of the distance), ~0.7 s
  maxFling: 2400,                     // px/s of throw carried into the spring
};
const carry = { active: false, back: false, x: 0, y: 0, vx: 0, vy: 0, lift: 0, fx0: 0, fy0: 0, ox0: 0, oy0: 0, far: false,
  trash: false, armed: false, tumble: 0, removing: null, removed: false };
function resize() {
  renderer.setSize(CANVAS_BOX.w, CANVAS_BOX.h, false);
  frameView();
}
function frameView() {
  const w = CANVAS_BOX.w, h = CANVAS_BOX.h;
  camera.clearViewOffset();
  camera.fov = FOV;
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  const depth = -camera.position.dot(camera.getWorldDirection(camDir));   // view depth of the ball centre
  const unit = view.unit * (1 + CARRY.lift * carry.lift);   // picked up: a touch bigger
  const full = unit * 2 * depth * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const o = new THREE.Vector3().project(camera);
  const ox = (o.x + 1) / 2 * full, oy = (1 - o.y) / 2 * full;
  // the box rides with the ball: the ball always sits at its anchor (ax, ay)
  camera.setViewOffset(full, full, ox - CANVAS_BOX.ax, oy - CANVAS_BOX.ay, w, h);
  canvas.style.transform = `translate3d(${(view.cx + carry.x - CANVAS_BOX.ax).toFixed(2)}px, ${(view.cy + carry.y - CANVAS_BOX.ay).toFixed(2)}px, 0)`;
}
addEventListener('resize', resize);
resize();

// ─── body geometry ────────────────────────────────────────────────────────
const geometry = new THREE.SphereGeometry(R, 128, 96);   // (was 256×192: identical at ≤ 105 px radius, 4× fewer vertices)
// rest direction = object-space unit normal; the face shader samples by it
geometry.setAttribute('aRest', geometry.attributes.normal.clone());

// ─── face texture ─────────────────────────────────────────────────────────
// Canvas covers ±90 Figma px around the body centre (body radius = 120 px).
const FACE_EXTENT = 0.75;
const FACE_PX = 512;   // ≥ 3 texels per screen pixel even on the sheet; a blink re-uploads 1 MB, not 16 MB
const S = FACE_PX / 180;
const faceCanvas = document.createElement('canvas');
faceCanvas.width = faceCanvas.height = FACE_PX;
const fctx = faceCanvas.getContext('2d');
const faceTex = new THREE.CanvasTexture(faceCanvas);
faceTex.colorSpace = THREE.SRGBColorSpace;
faceTex.anisotropy = 8;
faceTex.wrapS = faceTex.wrapT = THREE.ClampToEdgeWrapping;

const X = x => FACE_PX / 2 + x * S;
const Y = y => FACE_PX / 2 + y * S;

// ── Morphable face ────────────────────────────────────────────────────────
// Every eye of every state is two brush strokes (N points each) with one
// width: a pill is a short vertical stroke 28 wide, a dash a short
// horizontal one, ^ and ◡ thin arcs, X two crossing strokes (single-stroke
// eyes just repeat the stroke). Because all faces share that shape, a state
// change interpolates points + widths + the glint / lip / cheek weights, so
// pills flow into ^^, a dash splits into an X, etc. The right eye is the
// mirror of the left (same point order), so morphs stay symmetric.
const FACE_DY = 20;   // whole face sits 20 Figma px lower than the Bot 3D 01 layout (clears the helmet liner)
const NP = 28;
const linePts = (x0, y0, x1, y1) => Array.from({ length: NP }, (_, i) => {
  const t = i / (NP - 1); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
});
const arcPts = (cx, cy, r, a0, a1) => Array.from({ length: NP }, (_, i) => {
  const a = a0 + (a1 - a0) * (i / (NP - 1)); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
// left eye per face (Figma px, eye centre around x −32)
const LEFT_EYE = {
  pill:     () => { const l = linePts(-32, -20, -32, 6); return { a: l, b: l, w: 28 }; },           // 28 × 54 pill (Figma 62, shortened)
  greeting: () => { const l = arcPts(-32, -7, 12.5, Math.PI + 0.38, Math.PI * 2 - 0.38); return { a: l, b: l, w: 6.5 }; },
  error:    () => { const l = linePts(-45, -6, -19, -6); return { a: l, b: l, w: 9 }; },
  dizzy:    () => ({ a: linePts(-44, -16, -22, 6), b: linePts(-22, -16, -44, 6), w: 7.5 }),
  sleepy:   () => { const l = arcPts(-32, -12, 12, Math.PI - 0.32, 0.32); return { a: l, b: l, w: 6.5 }; },
  // angry: a stroke is the narrowed eye (short pill), b the brow — high at the
  // outer side, dropping toward the nose
  angry:    () => ({ a: linePts(-31, -9, -31, 7), b: linePts(-49, -35, -17, -21), w: 22 }),
};
const FACE_OF = { idle: 'pill', working: 'pill', greeting: 'greeting', error: 'error', dizzy: 'dizzy', sleepy: 'sleepy', angry: 'angry' };
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);
// Mouth: only the greeting smiles; every other face keeps it collapsed to a
// point (width 0) at the same spot, so the smile grows out of / shrinks into
// nothing as faces morph.
const MOUTH = {
  smile: () => ({ a: arcPts(0, 13, 10.5, Math.PI - 0.55, 0.55), w: 5.5 }),
  frown: () => ({ a: arcPts(0, 29, 9.5, Math.PI + 0.6, Math.PI * 2 - 0.6), w: 5.5 }),
  none: () => ({ a: linePts(0, 23, 0, 23), w: 0 }),
};
function faceSpec(state) {
  const kind = FACE_OF[state] || 'pill';
  const L = LEFT_EYE[kind]();
  const R = { a: mirror(L.a), b: mirror(L.b), w: L.w };
  const pill = kind === 'pill' ? 1 : 0;
  const happy = kind === 'greeting' ? 1 : 0;
  const angry = kind === 'angry' ? 1 : 0;
  const mouth = happy ? MOUTH.smile() : angry ? MOUTH.frown() : MOUTH.none();
  // brow width: the angry brow is a thinner stroke than its eye (stroke b)
  return { eyes: [L, R], mouth, glint: pill, lip: pill, cheeks: happy, flush: angry, brow: angry, blink: pill };
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPts = (A, B, t) => A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);
function lerpFace(A, B, t) {
  return {
    eyes: A.eyes.map((e, i) => ({ a: lerpPts(e.a, B.eyes[i].a, t), b: lerpPts(e.b, B.eyes[i].b, t), w: lerp(e.w, B.eyes[i].w, t) })),
    mouth: { a: lerpPts(A.mouth.a, B.mouth.a, t), w: lerp(A.mouth.w, B.mouth.w, t) },
    glint: lerp(A.glint, B.glint, t), lip: lerp(A.lip, B.lip, t),
    cheeks: lerp(A.cheeks, B.cheeks, t), blink: lerp(A.blink, B.blink, t),
    flush: lerp(A.flush || 0, B.flush || 0, t), brow: lerp(A.brow || 0, B.brow || 0, t),
  };
}

// ─── WebKit-safe canvas blur / shadow ──────────────────────────────────────
// iOS Safari and WKWebView expose CanvasRenderingContext2D.filter but ignore it
// (blurs drew hard-edged), and a stroke drawn with a shadow loses its round caps
// (the pill eyes came out square). Both are avoided by painting shapes sharp
// into a scratch canvas and letting a canvas *shadow* do the soft part:
//   blurFill  draws only the shadow of the scratch image (the image itself is
//             placed off-canvas, its shadow offset back in place). Canvas
//             shadows are Gaussian with σ = shadowBlur / 2, so this matches
//             blur(σ); colour / alpha ride on shadowColor (× globalAlpha).
//   the eyes  are stroked into the scratch with no shadow (round caps intact),
//             then composited in place with the lip as the image's shadow.
// Shadow offsets and blur are in device px; `box` limits the work to a region.
const scratchFor = (() => {
  const pool = new Map();
  return (key, w, h) => {
    let c = pool.get(key);
    if (!c) { c = document.createElement('canvas'); pool.set(key, c); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
    x.shadowColor = 'transparent'; x.globalAlpha = 1; x.filter = 'none';
    return [c, x];
  };
})();
function blurFill(ctx, sigma, color, paint, box) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const [c, s] = scratchFor('blur', W, H);
  s.setTransform(ctx.getTransform());
  s.fillStyle = s.strokeStyle = '#000';
  paint(s);
  const [bx, by, bw, bh] = box || [0, 0, W, H];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = color; ctx.shadowBlur = 2 * sigma; ctx.shadowOffsetX = W + bw; ctx.shadowOffsetY = 0;
  ctx.drawImage(c, bx, by, bw, bh, bx - W - bw, by, bw, bh);
  ctx.restore();
}

let cheeks = null;
function cheeksImage() {                            // the greeting blush, blurred once (face px, before FACE_DY)
  if (cheeks) return cheeks;
  cheeks = document.createElement('canvas');
  cheeks.width = cheeks.height = FACE_PX;
  const c = cheeks.getContext('2d');
  blurFill(c, 3.5 * S, 'rgba(244,128,128,0.55)', (x) => {
    for (const cx of [-61, 63]) { x.beginPath(); x.ellipse(X(cx), Y(29), 17 * S, 9 * S, 0, 0, Math.PI * 2); x.fill(); }
  });
  return cheeks;
}

let flush = null;
function flushImage() {                             // the angry red flush, blurred once (face px, before FACE_DY)
  if (flush) return flush;
  flush = document.createElement('canvas');
  flush.width = flush.height = FACE_PX;
  blurFill(flush.getContext('2d'), 10 * S, 'rgba(232,70,40,0.32)', (x) => {
    x.beginPath(); x.ellipse(X(0), Y(-2), 70 * S, 34 * S, 0, 0, Math.PI * 2); x.fill();
  });
  return flush;
}

function drawFace(spec, open = 1) {
  fctx.clearRect(0, 0, FACE_PX, FACE_PX);
  fctx.save();
  fctx.translate(0, FACE_DY * S);

  if (spec.flush > 0.01) {                           // angry red flush
    fctx.save();
    fctx.globalAlpha = spec.flush;
    fctx.drawImage(flushImage(), 0, 0);               // pre-blurred once (WebKit ignores ctx.filter)
    fctx.restore();
  }

  if (spec.cheeks > 0.01) {                          // greeting blush
    fctx.save();
    fctx.globalAlpha = spec.cheeks;
    fctx.drawImage(cheeksImage(), 0, 0);              // pre-blurred once, so a morph doesn't re-blur every frame
    fctx.restore();
  }

  if (spec.mouth.w > 0.05) {                         // smile
    fctx.save();
    fctx.strokeStyle = '#000';
    fctx.lineWidth = spec.mouth.w * S;
    fctx.lineCap = 'round';
    fctx.lineJoin = 'round';
    fctx.beginPath();
    spec.mouth.a.forEach(([x, y], i) => (i ? fctx.lineTo(X(x), Y(y)) : fctx.moveTo(X(x), Y(y))));
    fctx.stroke();
    fctx.restore();
  }

  const k = spec.glint;                              // "pill-ness": shading + glint weight
  const top = `rgb(${Math.round(59 * k)},${Math.round(59 * k)},${Math.round(59 * k)})`;
  for (const e of spec.eyes) {
    const all = e.a.concat(e.b);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const h = y1 - y0 + e.w;                         // visual height including the round caps
    // the eye, stroked sharp into a scratch canvas — no shadow, so WebKit keeps the round caps
    const [ec, ex] = scratchFor('eye', FACE_PX, FACE_PX);
    ex.setTransform(fctx.getTransform());
    // blink: squash the eye vertically about its centre (pill eyes only)
    const sq = lerp(1, Math.max(open, 5 / 54), spec.blink);   // (upstream 6f0850f: the pill is 54 tall now)
    ex.translate(0, Y(cy)); ex.scale(1, sq); ex.translate(0, -Y(cy));
    const g = ex.createLinearGradient(0, Y(y0 - e.w / 2), 0, Y(y1 + e.w / 2));
    g.addColorStop(0, top);
    g.addColorStop(0.32, '#0c0c0c');
    g.addColorStop(1, '#000');
    ex.strokeStyle = g;
    ex.lineCap = 'round';
    ex.lineJoin = 'round';
    // stroke b shares the eye's width, except as a brow (angry), where it thins (upstream d4993be)
    const widths = [e.w, lerp(e.w, 8.5, spec.brow || 0)];
    const same = e.a.every((p, i) => Math.abs(p[0] - e.b[i][0]) + Math.abs(p[1] - e.b[i][1]) < 0.01);
    (same ? [e.a] : [e.a, e.b]).forEach((pts, si) => {     // single-stroke eyes: draw once
      ex.lineWidth = widths[si] * S;
      ex.beginPath();
      pts.forEach(([x, y], i) => (i ? ex.lineTo(X(x), Y(y)) : ex.moveTo(X(x), Y(y))));
      ex.stroke();
    });
    // composited in place, its bottom lip (the 2px white drop shadow on the Figma eyes) as the image's shadow
    const m = (e.w / 2 + 4) * S;                     // eye box in device px (+ room for the lip)
    const bx = Math.max(0, X(x0) - m), by = Math.max(0, Y(y0) + FACE_DY * S - m);
    const bw = Math.min(FACE_PX - bx, X(x1) - X(x0) + 2 * m), bh = Math.min(FACE_PX - by, (y1 - y0) * S + 2 * m);
    fctx.save();
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.shadowColor = `rgba(255,255,236,${(0.75 * spec.lip).toFixed(3)})`;
    fctx.shadowOffsetY = 2 * S;
    fctx.shadowBlur = 1.5 * S;
    fctx.drawImage(ec, bx, by, bw, bh, bx, by, bw, bh);
    fctx.restore();
    // glint
    const ga = 0.85 * k * THREE.MathUtils.clamp((open - 0.45) * 3, 0, 1);
    if (ga > 0.01) {
      const hh = h * Math.max(open, 5 / 54);
      fctx.save();
      fctx.globalAlpha = ga;
      const gx = X(cx - e.w * 0.22 - 3), gy = Y(cy - hh * 0.36), gp = 0.6 * S * 3;
      blurFill(fctx, 0.6 * S, '#fff', (c) => {
        c.beginPath(); c.roundRect(gx, gy, 6 * S, hh * 0.26 * S, 3 * S); c.fill();
      }, [Math.max(0, gx - gp), Math.max(0, gy + FACE_DY * S - gp), 6 * S + 2 * gp, hh * 0.26 * S + 2 * gp]);
      fctx.restore();
    }
  }
  fctx.restore();
  faceTex.needsUpdate = true;
}

// ─── body material ────────────────────────────────────────────────────────
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0xffeb45,
  roughness: 0.5,
  clearcoat: 0.6,                // lacquered candy finish: a crisp softbox highlight over the satin base
  clearcoatRoughness: 0.26,     // soft enough that the key light blooms instead of a pin-point hotspot
  specularIntensity: 0.75,
  sheen: 0.3,
  sheenColor: new THREE.Color(0xfff6c8),
  sheenRoughness: 0.8,
  emissive: 0x141000,
});
const uniforms = {
  faceMap: { value: faceTex },
  uTint: { value: new THREE.Color(0xf2dc00) },
  uRimColor: { value: new THREE.Color(0xfffbe0) },
  uRim: { value: 0.3 },
  uGlowColor: { value: new THREE.Color(0xffeb45) },     // inner glow, in the body colour (themed)
  uGlow: { value: 0.16 },
  uShade: { value: new THREE.Color(0.9, 0.86, 0.74) },   // colour of the helmet shade (themed)
};
// Helmet → ball occlusion, evaluated on the ball's rest sphere (the helmet is
// a child of the body, so they share that space). The face window is the
// liner's inner edge (Figma liner: sides x ±0.85, top y 0.467, 24px stroke →
// inner edge x ±0.75, y 0.37, corner r ≈ 0.37); its top is pulled down a touch
// because the light comes from above (the Figma "Liner shadow" sits 6px low).
//   • inside the window: dark at the liner, opening to full light ~0.34 in
//   • under the shell: deep shade (the inside of the helmet)
//   • below the shell rim (y −0.55): back into the light over ~0.35
// The shadow is tinted by the theme (uShade) so it reads as the body colour in shade, not grey.
const HELMET_AO_GLSL = `
{
  vec3 rp = normalize(vRest);
  float top = 0.30, bot = -1.7;
  vec2 q = abs(vec2(rp.x, rp.y - (top + bot) * 0.5)) - vec2(0.75, (top - bot) * 0.5) + 0.36;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.36;
  float faceAO = mix(0.46, 1.0, smoothstep(0.0, 0.34, -sd));
  float ao = (rp.z > 0.0 && sd < 0.0) ? faceAO : 0.42;
  ao = max(ao, mix(0.42, 1.0, smoothstep(-0.5, -0.88, rp.y)));   // below the rim
  outgoingLight *= ao * mix(uShade, vec3(1.0), ao);
}`;

bodyMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, uniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aRest;\nvarying vec3 vRest;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
uniform sampler2D faceMap;
uniform vec3 uTint;
uniform vec3 uRimColor;
uniform float uRim;
uniform vec3 uShade;
uniform vec3 uGlowColor;
uniform float uGlow;
varying vec3 vRest;
${SURFACE_GLSL}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
float lower = smoothstep(0.25, -0.95, vRest.y) * smoothstep(-0.6, 0.4, vRest.z);
diffuseColor.rgb = mix(diffuseColor.rgb, uTint, lower * 0.6);
vec2 fuv = vRest.xy / (2.0 * ${FACE_EXTENT.toFixed(3)}) + 0.5;
vec4 face = texture2D(faceMap, fuv);
float faceA = face.a * smoothstep(0.15, 0.4, vRest.z)
  * step(abs(fuv.x - 0.5), 0.5) * step(abs(fuv.y - 0.5), 0.5);
diffuseColor.rgb = mix(diffuseColor.rgb, face.rgb, faceA);
// soft-touch vinyl, evaluated on the rest sphere so it turns with the face:
// gentle tonal depth, a fine moulded grain and a mottled satin sheen
float skin = 1.0 - faceA;
float tone = fbm3(vRest * 3.5 + 11.0);
float grain = vnoise(vRest * 24.0);                 // broad, soft undulation only
diffuseColor.rgb *= mix(1.0, 0.96 + 0.08 * tone, skin);
float mottle = smoothstep(0.3, 0.8, fbm3(vRest * 6.0 + 4.0));`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.32, faceA);
roughnessFactor += skin * (mottle * 0.07 - 0.035);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// grain on the vinyl; the lacquered eyes only get a faint orange peel
normal = bumpN(normal, grain * 0.00012 * skin);`)
    .replace('#include <clearcoat_normal_fragment_begin>', `#include <clearcoat_normal_fragment_begin>
clearcoatNormal = bumpN(clearcoatNormal, grain * 0.0001 * skin);`)
    .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.sheenColor *= 1.0 - faceA;
material.clearcoat *= 1.0 - 0.5 * faceA;
material.specularColor *= 1.0 - 0.6 * faceA;
material.specularColorBlended *= 1.0 - 0.6 * faceA;`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// premium inner glow: the colour seems lit from within, strongest where the ball faces the camera
float facing = saturate(dot(normal, normalize(vViewPosition)));
totalEmissiveRadiance += uGlowColor * uGlow * facing * facing;
totalEmissiveRadiance *= 1.0 - faceA;`)
    .replace('#include <opaque_fragment>', `float fres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
outgoingLight += uRimColor * fres * uRim * (1.0 - faceA);
${HELMET_AO_GLSL}
#include <opaque_fragment>`);
};

const body = new THREE.Mesh(geometry, bodyMat);
body.frustumCulled = false;
scene.add(body);

const helmet = createHelmet();
body.add(helmet.group);

// ─── shadows, exactly as Figma frame 1060:79394 ───────────────────────────
// In the 80px frame the body is r 30, so 1 unit = 30px; Figma blur radius r
// is a Gaussian with σ = r / 2 (what its SVG export writes).
//   Body           DROP_SHADOW  #000 40%, y +5.5, blur 9   → offset 0.183, σ 0.15
//   Helmet shell   DROP_SHADOW  #000 45%, y +10,  blur 18 (in its 320 space, r 120)
//                                                          → offset 0.083, σ 0.075
//   Contact shadow ellipse 30.4×4.8 at y 74.4, #1D2539 16%, LAYER_BLUR 3.2
//                  → rx 0.507, ry 0.08, centre 1.31 below the body centre, σ 0.053
//   Bounce glow    hidden in Figma → not drawn
// They are screen-facing sprites, so they read exactly like the flat drawing:
// the drop shadows sit just behind the bot (scaled to stay the same on screen),
// the contact shadow stays on the ground line.
const SHADOW_EXTENT = 2;
function shadowSprite(draw, extent = SHADOW_EXTENT) {
  const size = 512, k = size / (2 * extent);   // (≥ 1 texel per device px at the sheet's size)
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  draw(ctx, k);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * extent, 2 * extent),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  scene.add(mesh);
  return mesh;
}
const bodyShadow = shadowSprite((ctx, k) => {
  blurFill(ctx, 0.22 * k, 'rgba(0,0,0,0.4)', (c) => {   // Figma σ 0.15, softened ×1.5
    c.beginPath(); c.arc(0, 0, R * k, 0, Math.PI * 2); c.fill();   // offset applied in placeShadows
  });
});
const helmetShadow = shadowSprite((ctx, k) => {
  blurFill(ctx, 0.11 * k, 'rgba(0,0,0,0.45)', (c) => {  // Figma σ 0.075, softened ×1.5
    c.scale(k / 120, k / 120);
    c.translate(-164, -158);                            // offset applied in placeShadows
    c.fill(new Path2D(SHELL_PATH));
  });
});
// Held (Figma 1096:112825): the whole bot casts a big soft shadow — y +18, blur 24, #000 35% on the
// 88 px frame (unit 33) → offset 0.545, σ 0.364 — the silhouette of ball + helmet shell, faded in by the lift
const liftShadow = shadowSprite((ctx, k) => {
  blurFill(ctx, 0.364 * k, 'rgba(0,0,0,0.35)', (c) => {
    c.beginPath(); c.arc(0, 0, R * k, 0, Math.PI * 2); c.fill();
    c.save(); c.scale(k / 120, k / 120); c.translate(-164, -158); c.fill(new Path2D(SHELL_PATH)); c.restore();
  });
}, 3);
liftShadow.material.opacity = 0;
const CONTACT_Y = HOVER_Y - 1.31;
const contactShadow = shadowSprite((ctx, k) => {
  blurFill(ctx, 0.08 * k, 'rgba(29,37,57,0.16)', (c) => {   // Figma σ 0.053, softened ×1.5
    c.beginPath(); c.ellipse(0, 0, 0.507 * k, 0.08 * k, 0, 0, Math.PI * 2); c.fill();
  });
});
const toCam = new THREE.Vector3(), camUp = new THREE.Vector3(), qRoll = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
let viewRoll = 0;                                     // the bot's on-screen roll this frame
const DROP = [[bodyShadow, 0.183], [helmetShadow, 0.083], [liftShadow, 0.545]];   // Figma y offsets (units)
function placeShadows() {
  toCam.subVectors(camera.position, body.position).normalize();
  camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const dBody = camera.position.distanceTo(body.position);
  qRoll.setFromAxisAngle(zAxis, viewRoll);
  for (const [sp, dy] of DROP) {
    sp.position.copy(body.position).addScaledVector(toCam, -1.6);   // just behind the bot
    const sc = camera.position.distanceTo(sp.position) / dBody;
    sp.scale.setScalar(sc * intro.scale);
    sp.position.addScaledVector(camUp, -dy * sc * intro.scale);   // light from above: offset stays straight down
    sp.quaternion.copy(camera.quaternion).multiply(qRoll);   // silhouette turns with the bot
  }
  // contact shadow stays on the ground line and softens as the bot rises
  const lift = Math.max(0, body.position.y - HOVER_Y);
  // drop shadows soften as the bot rises
  bodyShadow.material.opacity = helmetShadow.material.opacity = THREE.MathUtils.clamp((2.8 - lift) / 1.3, 0, 1);
  contactShadow.position.set(body.position.x, CONTACT_Y, 0);
  contactShadow.quaternion.copy(camera.quaternion);
  contactShadow.scale.setScalar((1 + Math.min(lift, 2) * 0.4) * intro.scale);
  contactShadow.material.opacity = THREE.MathUtils.clamp(1 - lift * 0.45, 0, 1) * Math.min(1, intro.scale) * (1 - 0.45 * carry.lift);   // held: 55 % (Figma 1096:112827)
  liftShadow.material.opacity = carry.lift * Math.min(1, intro.scale);   // only while held
  bodyShadow.visible = helmetShadow.visible = contactShadow.visible = body.visible;
  liftShadow.visible = body.visible && carry.lift > 0.005;
}

// ─── props: dizzy orbit, Zz ───────────────────────────────────────────────
const satin = (color, emissive = 0x000000, ei = 0) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.4, emissive, emissiveIntensity: ei,
});

const orbiters = [0.075, 0.055, 0.068].map((r, i) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), satin(0xfff6a8, 0xfff07a, 0.35));
  m.userData.phase = i * Math.PI * 2 / 3;
  m.scale.setScalar(0);
  scene.add(m);
  return m;
});

function zTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff6b0';
  x.font = '800 104px -apple-system, "SF Pro Rounded", system-ui, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('z', 64, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const zTex = zTexture();
const zs = [];
let zTimer = 0;

// ─── rigid-body motion ────────────────────────────────────────────────────
const m = {
  y: HOVER_Y, vy: 0, airborne: false, hoverY: HOVER_Y,
  x: 0, vx: 0,
  spin: 0, spinV: 0,                  // yaw: set by dragging; after release glides, then springs home
  homing: false, home: 0, glideF: 0,  // home = front-facing turn it settles into; glideF = coast friction
  tilt: 0, tiltV: 0,                  // vertical-drag tilt, eases back to level on release
  dragging: false, dragVel: 0, lastDir: 1,
  settlePending: false,               // turned away from face-on → snap when it settles back (haptics)
  nod: 0, nodV: 0, rock: 0, rockV: 0, // pitch / roll wobble kicked by landings
  shake: 0,                           // error tremble amplitude
};

let spinDetent = 0;                   // last 30° detent the spin passed (haptic ticks)

function hop(v) {
  if (m.airborne && m.y > m.hoverY + 0.12) return;   // no re-launching mid-air (rapid taps)
  m.airborne = true;
  m.vy = Math.min(Math.max(m.vy, 0) + v, 4.6);
}

// Where to come to rest after a release: the whole turn (face-on) nearest to
// where the flick would naturally stop. If that's ahead in the direction of
// travel, coast there with exactly the friction that stops on it (no
// overshoot-and-reverse on fast flicks); otherwise spring straight back.
function planReturn() {
  const TAU = Math.PI * 2;
  const proj = m.spin + m.spinV / 2.6;
  m.home = Math.round(proj / TAU) * TAU;
  const dist = m.home - m.spin;
  m.glideF = (Math.abs(m.spinV) > 0.5 && Math.sign(dist) === Math.sign(m.spinV) && Math.abs(dist) > 0.05)
    ? THREE.MathUtils.clamp(m.spinV / dist, 1, 8) : 0;
  m.homing = true;
}

// keyboard nudge: a flick of momentum in that direction
function nudge(dir) {
  m.lastDir = dir;
  m.homing = false;
  m.spinV += dir * 14;                                // about one full turn, then home
  m.settlePending = true;
}

function stepMotion(h) {
  // yaw: the pointer drives it while held; after release it returns face-on
  if (!m.dragging && !intro.active && !pageNav.show && !colourSpin.active) {   // (scripted spins drive the turn themselves)
    // after a release (see planReturn): coast on the flick's momentum with a
    // friction tuned to come to rest on the chosen front-facing turn, then a
    // soft spring finishes the settle (or brings a slow release straight back)
    if (!m.homing) planReturn();
    if (m.glideF > 0) {
      m.spinV *= Math.exp(-h * m.glideF);
      if (Math.abs(m.spinV) < 1.2) m.glideF = 0;
    } else {
      m.spinV += (45 * (m.home - m.spin) - 9.5 * m.spinV) * h;   // ζ ≈ 0.7: one soft overshoot
      if (Math.abs(m.home - m.spin) < 1e-4 && Math.abs(m.spinV) < 1e-3) {
        spinDetent -= Math.round(m.home / DETENT);     // the rebase isn't a turn: no ticks
        m.spin -= m.home; m.home = 0;                  // keep the numbers small
      }
    }
    m.spin += m.spinV * h;
    // arriving face-on after a turn: one snap as it settles within ~2° of home
    if (m.settlePending && Math.abs(m.home - m.spin) < 0.035) { m.settlePending = false; haptic('snap'); }
  }
  if (!m.dragging) {
    // tilt eases back to level (slightly under-damped)
    m.tiltV += (-70 * m.tilt - 11 * m.tiltV) * h;
    m.tilt += m.tiltV * h;
  }

  // vertical: ballistic in the air, light rebounds, then the hover spring.
  // Each touchdown nods the ball forward and rocks it toward the spin.
  if (m.airborne) {
    m.vy -= GRAVITY * h;
    m.y += m.vy * h;
    if (m.y <= m.hoverY && m.vy < 0) {
      const impact = -m.vy;
      m.y = m.hoverY;
      if (impact > 0.6) haptic('land', impact / 4.6);
      m.nodV += Math.min(impact, 4.5) * 0.55;
      m.rockV += m.lastDir * Math.min(impact, 4.5) * 0.35;
      if (impact > 1.5) m.vy = impact * 0.4;
      else { m.airborne = false; m.vy *= 0.3; }
    }
  } else {
    m.vy += (85 * (m.hoverY - m.y) - 11 * m.vy) * h;
    m.y += m.vy * h;
  }

  // wobble springs (ζ ≈ 0.24): two or three gentle rocks, then still
  m.nodV += (-95 * m.nod - 4.6 * m.nodV) * h;
  m.nod += m.nodV * h;
  m.rockV += (-95 * m.rock - 4.6 * m.rockV) * h;
  m.rock += m.rockV * h;

  m.vx += (90 * -m.x - 14 * m.vx) * h;
  m.x += m.vx * h;
}

// ─── state machine ────────────────────────────────────────────────────────
let state = 'idle';
let faceCur = faceSpec('idle');   // what's on the face right now
let morph = null;                 // { from, to, t } while a state change morphs the face
let stateTime = 0;
let eyeOpen = 1;
let blinkT = -1, nextBlink = 2.5;
const scripts = [];               // timed one-shots { at, fn }

function schedule(at, fn) { scripts.push({ at: stateTime + at, fn }); }

// ─── doze off: 10 s without any interaction → Sleepy ──────────────────────
// Any tap / click, drag, wheel, key or page scroll counts as interaction
// (hovering doesn't). After DOZE_MS without one, the bot falls asleep where it
// is — on Home or on its sheet — but never mid-intro, mid sheet transition or
// while it's being dragged. No haptic: nothing was touched. A doze ends on the
// next interaction anywhere (the usual wake hop); a sleep you asked for
// (triple tap, key 6) still lasts until you tap the bot.
const DOZE_MS = 10000;
let lastActive = performance.now(), dozed = false;
function poke(e) {
  lastActive = performance.now();
  if (visorCue && visorCue.doze) visorCue = null;           // touched while it was about to doze: stay awake
  if (state !== 'sleepy' || !dozed) return;
  if (e && e.target && e.target.closest && e.target.closest('#orbiHit')) return;   // the bot wakes itself (tap / drag)
  setState('idle');
}
['pointerdown', 'pointerup', 'wheel', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, poke, { capture: true, passive: true }));   // (the release counts: a long drag ends a fresh 10 s)
addEventListener('pointermove', (e) => { if (e.buttons) poke(e); }, { capture: true, passive: true });
// (any scroll inside the Home — the GitFlow Home's feed and rails mount after this runs, so listen in the capture phase)
addEventListener('scroll', (e) => { if (e.target instanceof Element && e.target.closest('#nkHome')) poke(); }, { capture: true, passive: true });
// ─── visor first: greeting and sleeping happen with the visor up ──────────
// Before it greets or falls asleep, a lowered visor swings up, and only once
// it's up (VISOR_RAISE_MS — the snappy hinge spring is 95% open at ≈318 ms)
// does the greeting / sleep begin. Already up → straight away. `cue` is the
// pending step (a newer one replaces it); it runs from update().
const VISOR_RAISE_MS = 340;
let visorCue = null;
function visorUpThen(fn, { feel = true, doze = false } = {}) {
  if (!helmet.visorDown) { visorCue = null; fn(); return; }
  setVisor(false);
  if (feel) haptic('tap');                                   // the visor click (not for a doze: nothing was touched)
  visorCue = { at: performance.now() + VISOR_RAISE_MS, fn, doze };
}
function updateVisorCue() {
  if (visorCue && performance.now() >= visorCue.at) { const c = visorCue; visorCue = null; c.fn(); }
}

function updateDoze() {
  if (visorCue || state === 'sleepy' || intro.active || pageNav.open || pageNav.show || pageNav.anim || pageNav.drag || m.dragging) return;   // never on the sheet
  if (performance.now() - lastActive < DOZE_MS) return;
  visorUpThen(() => { setState('sleepy'); dozed = true; }, { feel: false, doze: true });
}

function setState(next, { quiet = false } = {}) {
  if (next !== 'sleepy') dozed = false;
  if (!STATES.some(s => s.key === next)) return;
  const prev = state;
  if (prev !== next) { prevState = prev; prevStateTime = stateTime; poseBlend = 0; }
  state = next;
  stateTime = 0;
  scripts.length = 0;
  {
    // into / out of the round pill eyes: go via a closed eye (natural blink
    // into the new expression) instead of twisting the pill into the shape
    const to = faceSpec(next);
    const fromPill = faceCur.blink > 0.5, toPill = to.blink > 0.5;
    morph = fromPill !== toPill ? { via: true, fromPill, from: faceCur, to, t: 0 } : { from: faceCur, to, t: 0 };
  }
  m.shake = 0;

  if (!quiet) {
    switch (next) {
      case 'greeting':
        hop(3.2);
        break;
      case 'error':
        m.vx -= 2.4;
        m.shake = 0.03;
        schedule(0.45, () => { m.shake = 0; });
        break;
      case 'dizzy':
        m.vx += 1.6;
        break;
      case 'angry': {
        // stiffen with a shudder, then a faint steady tremble with a little
        // huff (hop + shake burst) every couple of seconds
        m.shake = 0.024;
        m.nodV += 1.4;
        haptic('error');                                     // strong: the sharp triple buzz as it turns Angry
        schedule(0.4, () => { m.shake = 0.006; });
        const huff = () => {
          if (state !== 'angry') return;
          hop(1.7);
          haptic('heavy');                                   // strong: every huff lands hard
          m.shake = 0.02;
          schedule(0.32, () => { if (state === 'angry') m.shake = 0.006; });
          schedule(2.2 + Math.random() * 0.8, huff);
        };
        schedule(1.6, huff);
        break;
      }
      default:
        if (prev === 'sleepy') hop(3.6);
    }
  }
  syncNav();
}

// ─── UI ───────────────────────────────────────────────────────────────────
// (no state bar here — only the bot is brought over. Upstream's visor button
// lives in that bar, so here the visor flips by tapping it on the Orbi page, or V.)
function syncNav() {}
function syncVisor() {}
function setVisor(down, { slow = false } = {}) {
  if (helmet.visorDown === down) return;
  helmet.setVisorDown(down, { slow });
  m.nodV += (down ? 0.5 : -0.5) * (slow ? 0.4 : 1);   // a little nod as the visor swings
  syncVisor();
}
function toggleVisor() {
  endIntro();
  setVisor(!helmet.visorDown);
}
// ─── colour themes ────────────────────────────────────────────────────────
// C cycles the bot's colour: the ball (base + lower tint) and the
// helmet's paint + stitching (accent) change together and glide over ~0.5 s.
// The last choice is remembered per browser (a convenience only).
const THEMES = [
  // brand tiles from Figma "colour options" (1107:115295); accent = the tile colour
  { name: 'noon',      body: 0xffeb45, tint: 0xf2dc00, accent: 0xfeee00, sheen: 0xfff6c8, shade: [0.9, 0.86, 0.74] },
  { name: 'supermall', body: 0x2526cc, tint: 0x1d1ea0, accent: 0x2122b8 },
  { name: 'Minutes',   body: 0xd12b28, tint: 0xa3221f, accent: 0xd12b28 },
  { name: 'Jahez',     body: 0xf8113a, tint: 0xc90628, accent: 0xf8113a },
  { name: 'noon Food', body: 0xe01858, tint: 0xaf1345, accent: 0xe01858 },
  { name: 'NowNow',    body: 0xf33a01, tint: 0xbe2d01, accent: 0xf33a01 },
];
// Sheen, rim light and helmet-shade colour follow the body; noon keeps its
// hand-tuned originals, the rest derive them the same way.
const WHITE = new THREE.Color(1, 1, 1);
// The brand tiles are flat-graphic saturated; on the 3D ball they read too loud,
// so every theme except noon is toned down (HSL saturation × BRAND_SAT).
const BRAND_SAT = 0.8;
function themeColor(th, hex) {
  const c = new THREE.Color(hex);
  if (th.name === 'noon') return c;
  const hsl = c.getHSL({}, THREE.SRGBColorSpace);
  return c.setHSL(hsl.h, hsl.s * BRAND_SAT, hsl.l, THREE.SRGBColorSpace);
}
function toColors(th) {
  const body = themeColor(th, th.body), tint = themeColor(th, th.tint);
  const t = [(th.tint >> 16 & 255) / 255, (th.tint >> 8 & 255) / 255, (th.tint & 255) / 255];
  const mx = Math.max(...t);
  return {
    body, tint, accent: themeColor(th, th.accent),
    sheen: th.sheen != null ? new THREE.Color(th.sheen) : WHITE.clone().lerp(body, 0.3),
    rim: WHITE.clone().lerp(body, 0.55),               // brand-tinted edge glow
    shade: th.shade ? new THREE.Color(...th.shade) : new THREE.Color(...t.map((c) => 0.9 - 0.16 * (1 - c / mx))),
    logo: th.name === 'noon' ? 0 : 1,                 // front wordmark: black on noon yellow, white on the rest
  };
}
let themeIdx = 0;
try { themeIdx = Math.min(THEMES.length - 1, Math.max(0, +localStorage.getItem('orbi.theme') || 0)); } catch {}
const themeCur = toColors(THEMES[themeIdx]);
let themeTarget = toColors(THEMES[themeIdx]);
function applyTheme() {
  bodyMat.color.copy(themeCur.body);
  uniforms.uTint.value.copy(themeCur.tint);
  uniforms.uRimColor.value.copy(themeCur.rim);
  uniforms.uShade.value.copy(themeCur.shade);
  uniforms.uGlowColor.value.copy(themeCur.body);
  bodyMat.sheenColor.copy(themeCur.sheen);
  bodyMat.emissive.copy(themeCur.tint).multiplyScalar(0.008);   // ≈ the original 0x141000 for yellow
  helmet.setAccent(themeCur.accent);
  helmet.setLogoWhite(themeCur.logo);
}
let themeRate = 7;                                    // blend speed (1/s); quicker while it swaps mid-spin
function updateTheme(dt) {
  const k = 1 - Math.exp(-dt * themeRate);
  for (const key of ['body', 'tint', 'accent', 'sheen', 'rim', 'shade']) themeCur[key].lerp(themeTarget[key], k);
  themeCur.logo += (themeTarget.logo - themeCur.logo) * k;
  applyTheme();
}
// (upstream's swatch button lives in its state bar, which isn't brought over —
// here the colour is picked on the Orbi sheet's slider (orbi/colour-picker.js),
// and C still cycles it; this keeps the slider's swatch in step)
let picker = null;
function syncColour() { if (picker) picker.sync(themeIdx); }
// Changing colour turns the bot a full 360° (to its left, like the intro) with
// a little hop; the new colour swaps in while it faces away, so it comes back
// round already recoloured. Clicking again mid-turn adds another turn.
// (this page: the turn is one spring, not upstream's 0.95 s ease-out-back — that
// overshot 16° and swung back, then handed a dead stop to the yaw spring. The
// spring starts with a light push, is face-on in ≈480 ms with a ≈1° overshoot
// (peak ≈1600°/s), and rests at ≈840 ms, its velocity carried straight into the
// idle settle.)
const COLOUR_SPIN = { omega: 11, zeta: 0.86, kick: 3, swapAt: 0.36 };   // swap once ~130° round (back to camera)
const colourSpin = { active: false, t: 0, from: 0, to: 0, s: 0, sv: 0, pending: null };
// aim the turn at `to`: a fresh turn launches with the kick; another turn added mid-spin keeps its speed
function launchSpin(to, pending) {
  const was = colourSpin.active;
  Object.assign(colourSpin, { active: true, t: 0, from: m.spin, to, s: m.spin - to,
    sv: was ? colourSpin.sv : Math.min(m.spinV, 0) - COLOUR_SPIN.kick, pending });
}
function cycleColour() {
  themeIdx = (themeIdx + 1) % THEMES.length;
  try { localStorage.setItem('orbi.theme', String(themeIdx)); } catch {}
  syncColour();
  if (intro.active) endIntro();
  const TAU = Math.PI * 2;
  const base = colourSpin.active ? colourSpin.to : Math.round(m.spin / TAU) * TAU;
  launchSpin(base - TAU, toColors(THEMES[themeIdx]));
  m.homing = false;
  hop(1.8);
}
// The slider's pick: the same 360° + hop as C, the new colour swapping in while
// its back is turned. A pick made before that swap rides the turn already under
// way (no stacked turns); one made after it starts another turn.
function spinToTheme(i) {
  themeIdx = i;
  try { localStorage.setItem('orbi.theme', String(i)); } catch {}
  if (intro.active) endIntro();
  const next = toColors(THEMES[i]);
  if (colourSpin.active && colourSpin.pending) { colourSpin.pending = next; return; }
  const TAU = Math.PI * 2;
  const base = colourSpin.active ? colourSpin.to : Math.round(m.spin / TAU) * TAU;
  launchSpin(base - TAU, next);
  m.homing = false;
  hop(1.8);
}
function swapColourNow() {
  if (!colourSpin.pending) return;
  themeTarget = colourSpin.pending;
  colourSpin.pending = null;
  themeRate = 30;                                     // near-instant while its back is turned (no muddy mid-blend)
}
function updateColourSpin(dt) {
  if (!colourSpin.active) return;
  colourSpin.t += dt;
  const w = COLOUR_SPIN.omega, z = COLOUR_SPIN.zeta, cs = colourSpin;
  for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(left, 1 / 240);
    cs.sv += (-w * w * cs.s - 2 * z * w * cs.sv) * h;
    cs.s += cs.sv * h;
  }
  m.spin = cs.to + cs.s;
  m.spinV = cs.sv;                                    // the real speed drives the roll lean, like a flick
  const span = cs.from - cs.to;
  if (span && 1 - cs.s / span >= COLOUR_SPIN.swapAt) swapColourNow();
  if (Math.abs(cs.s) < 0.003 && Math.abs(cs.sv) < 0.05) { endColourSpin(); m.spinV = cs.sv; }   // at rest: seamless hand-off
}
function endColourSpin() {
  if (!colourSpin.active) return;
  swapColourNow();
  colourSpin.active = false;
  themeRate = 7;
  m.spinV = 0;
  m.homing = true; m.home = colourSpin.to; m.glideF = 0;   // the yaw spring finishes the settle
}
syncColour();
applyTheme();
addEventListener('keydown', (e) => {
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= STATES.length) {
    endIntro();
    const key = STATES[n - 1].key;
    // (Angry plays its own strong buzz from setState, so no key bump on top)
    const go = () => { setState(key); if (key !== 'angry') haptic(key === 'greeting' ? 'success' : key === 'error' ? 'edge' : 'tap'); };
    if (key === 'sleepy' && (pageNav.open || pageNav.show)) return;   // no sleeping while the sheet is open
    if (key === 'greeting' || key === 'sleepy') visorUpThen(go); else { visorCue = null; go(); }
  }
  if (e.key === 'v' || e.key === 'V') { toggleVisor(); haptic('tap'); }
  if (e.key === 'c' || e.key === 'C') cycleColour();
  if (e.key === 'ArrowLeft') nudge(-1);
  if (e.key === 'ArrowRight') nudge(1);
});

// ─── pointer: drag to rotate, swipe for the visor, tap to bounce ──────────
// The bot does not follow the cursor. Each gesture locks to an axis after a
// few pixels: horizontal drags spin the bot (release hands the velocity to
// the glide → spring back face-on); vertical swipes tilt the bot with the
// finger (eases back level on release) and work the visor — swipe up to raise
// it, down to lower it (once per swipe, after VISOR_SWIPE px).
// A short still press is a tap. Here the gesture is taken from the bot's
// Figma box (#orbiHit), so the rest of the canvas lets taps and scrolls
// through to the page.
const AXIS_LOCK_PX = 8;
const VISOR_SWIPE_PX = 35;
// Pestering: four up/down swipes in quick succession (each within SWIPE_ANGRY.gap of the last) and the bot
// gets Angry — a firm bump, the visor swings up if it's down (so the glare shows), then the Angry face for
// SWIPE_ANGRY.holdS before it calms back to Idle. More swipes while it's angry restart the clock.
const SWIPE_ANGRY = { count: 4, gap: 1200, holdS: 3.5 };
let swipeTimes = [];
function noteSwipe() {
  const now = performance.now();
  if (swipeTimes.length && now - swipeTimes[swipeTimes.length - 1] > SWIPE_ANGRY.gap) swipeTimes = [];   // too slow: start over
  swipeTimes.push(now);
  if (state === 'angry' && swipeAngry) { swipeAngry = now; scheduleCalm(); return; }   // still swiping: stays angry longer
  if (swipeTimes.length < SWIPE_ANGRY.count) return;
  swipeTimes = [];
  haptic('edge');
  visorUpThen(() => { swipeAngry = performance.now(); setState('angry'); scheduleCalm(); }, { feel: false });
}
let swipeAngry = 0;                                          // when the swipe-anger (re)started; 0 = not swipe-angry
function scheduleCalm() {
  const stamp = swipeAngry;
  schedule(SWIPE_ANGRY.holdS, () => { if (state === 'angry' && swipeAngry === stamp) { swipeAngry = 0; setState('idle'); } });
}
const hit = document.getElementById('orbiHit') || canvas;
let gesture = null;

hit.addEventListener('pointerdown', (e) => {
  gesture = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), t: performance.now(), t0: e.timeStamp, moved: 0, axis: null, fired: false };
  haptic('tap');
  if (intro.active) { const sp = m.spin; endIntro(); m.spin = sp; }   // grab takes over mid-turn
  if (colourSpin.active) { const sp = m.spin; endColourSpin(); m.spin = sp; }
  m.dragging = true;
  m.homing = false;
  m.spinV = 0;
  m.dragVel = 0;
  try { hit.setPointerCapture(e.pointerId); } catch {}
  hit.classList.add('grabbing');
});

hit.addEventListener('pointermove', (e) => {
  if (!gesture) return;
  const now = performance.now();
  const dx = e.clientX - gesture.lx, dy = e.clientY - gesture.ly;
  const dt = Math.max(1, now - gesture.lt) / 1000;
  // held still for the full hold before this move: that's a pick-up, even if no frame got to notice it yet
  // (this page: a phone that stalls a few frames would otherwise read the drag as a swipe)
  // (input timestamps, not handler time: a stall that delivers a quick swipe late must not look like a hold)
  if (!gesture.carried && !gesture.axis && gesture.moved < AXIS_LOCK_PX && e.timeStamp - gesture.t0 >= CARRY.holdMs
      && !pageNav.show && !pageNav.anim && !pageNav.drag && !carry.removing && !carry.removed && !carry.active) startCarry(gesture);
  gesture.lx = e.clientX; gesture.ly = e.clientY; gesture.lt = now;
  gesture.moved = Math.max(gesture.moved, Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y));
  if (gesture.carried) { carryTo(e.clientX, e.clientY, dt); return; }   // picked up: it follows the finger
  if (!gesture.axis) {
    if (gesture.moved < AXIS_LOCK_PX) return;          // let taps stay taps
    const tx = e.clientX - gesture.x, ty = e.clientY - gesture.y;
    gesture.axis = Math.abs(tx) >= Math.abs(ty) ? 'x' : 'y';
  }
  if (gesture.axis === 'y') {
    // the bot tilts with the finger as before…
    const atEdge = Math.abs(m.tilt) >= MAX_TILT;
    m.tilt = THREE.MathUtils.clamp(m.tilt + dy * DRAG_PITCH, -MAX_TILT, MAX_TILT);
    if (!atEdge && Math.abs(m.tilt) >= MAX_TILT) haptic('edge');
    m.tiltV = 0;
    // …and the swipe works the visor: up raises it, down lowers it
    const ty = e.clientY - gesture.y;
    if (!gesture.fired && Math.abs(ty) >= VISOR_SWIPE_PX) {
      gesture.fired = true;
      if (helmet.visorDown !== (ty > 0)) haptic('tap');      // a click as the visor goes (not if it's already there)
      setVisor(ty > 0);
      noteSwipe();                                            // pestered with swipes? (see SWIPE_ANGRY)
    }
    return;
  }
  if (state === 'sleepy') setState('idle', { quiet: true });
  m.spin += dx * DRAG_YAW;
  // smoothed angular velocity, used for the release glide and the lean
  m.dragVel += ((dx * DRAG_YAW) / dt - m.dragVel) * 0.35;
  if (dx) m.lastDir = Math.sign(dx);
});

function endGesture(e) {
  if (!gesture) return;
  const g = gesture;
  gesture = null;
  m.dragging = false;
  hit.classList.remove('grabbing');
  if (g.carried) {
    // where the finger actually lifted counts (this page): a slow phone can deliver one or two moves for a whole
    // drag, so the last move may be far from the release point — e.g. it lifted on the cross but never 'arrived'
    if (e && e.type === 'pointerup' && Number.isFinite(e.clientX)) carryTo(e.clientX, e.clientY, 1 / 60);
    releaseCarry(performance.now() - g.lt > 80);   // (held still before letting go: no fling)
    return;
  }
  // stale velocity (pointer held still before release) shouldn't fling it
  const idle = performance.now() - g.lt;
  m.spinV = idle > 80 ? 0 : THREE.MathUtils.clamp(m.dragVel, -14, 14);
  const off = m.spin - Math.round(m.spin / (Math.PI * 2)) * Math.PI * 2;   // turn away from the nearest face-on
  m.settlePending = Math.abs(off) > 0.1 || Math.abs(m.spinV) > 1;
  m.dragVel = 0;
  hit.classList.remove('grabbing');
  // a tap = any touch that never locked into a drag (real fingers jitter a few px and
  // can rest ~0.4 s), so no touch falls between "tap" and "drag" and gets lost
  if (!g.axis && g.moved < AXIS_LOCK_PX && performance.now() - g.t < 500) tap();
}
hit.addEventListener('pointerup', endGesture);
hit.addEventListener('pointercancel', endGesture);

// ─── hold to pick up, drag to carry, let go to spring home ─────────────────
// Press and hold the bot still for CARRY.holdMs and it's picked up: a pop, it
// lifts 8 % and rises above the page. It then follows the finger 1:1 (kept on
// screen), swinging with the hand — it leans into sideways moves and tips with
// vertical ones — while its ground shadow fades. Let go and it springs back to
// where it lives (the FAB on Home, its spot on the sheet), carrying the throw's
// momentum into a bouncy spring, and lands with a soft bump. Quick swipes
// without the hold still spin it / work the visor; a quick tap is still a tap.
const screenEl = document.getElementById('screen');
function startCarry(g) {
  g.carried = true;
  carry.active = true; carry.back = false; carry.far = false;
  carry.fx0 = g.lx; carry.fy0 = g.ly; carry.ox0 = carry.x; carry.oy0 = carry.y;   // (can be caught mid-way home)
  carry.vx = carry.vy = 0;
  if (state === 'sleepy') setState('idle', { quiet: true });
  visorCue = null;
  canvas.classList.add('carrying'); hit.classList.add('carrying');
  haptic('pop');
  // (the remove UI waits until the held bot is actually dragged — see carryTo)
}
const TRASH_REVEAL_PX = 14;          // a held bot must be dragged this far before the remove UI appears
function carryTo(px, py, dt) {
  // Home only: the remove UI rises once the held bot is moved — a still long-press just picks it up
  if (!carry.trash && !pageNav.open && Math.hypot(px - carry.fx0, py - carry.fy0) > TRASH_REVEAL_PX) { showTrash(true); haptic('tick'); }   // (a tick as the remove target rises)
  const W = screenEl.clientWidth || 375, Hh = screenEl.clientHeight || 812, r = 34;   // keep the ball on screen
  const tx = THREE.MathUtils.clamp(carry.ox0 + px - carry.fx0, r - view.cx, W - r - view.cx);
  const ty = THREE.MathUtils.clamp(carry.oy0 + py - carry.fy0, 44 + r - view.cy, Hh - r - view.cy);
  let gx = tx, gy = ty;
  if (carry.trash) {                                         // over the remove target: arm, and pull the bot onto it
    const zx = trashAt.x - view.cx, zy = trashAt.y - view.cy, d = Math.hypot(tx - zx, ty - zy);
    const armed = carry.armed ? d < TRASH.leave : d < TRASH.enter;
    if (armed !== carry.armed) {
      carry.armed = armed;
      trashEl.classList.toggle('is-armed', armed);
      trashLabel.textContent = armed ? 'Release to remove' : 'Drag here to remove';
      haptic(armed ? 'snap' : 'tick');
      // on the cross: the visor swings up (if down) and then it gets angry (brows, frown, flush, shudder);
      // off it, the sequence is dropped and it calms down
      if (armed) { if (state !== 'angry') visorUpThen(() => { if ((carry.armed || carry.removing) && state !== 'angry') setState('angry'); }); }
      else { visorCue = null; if (state === 'angry') setState('idle', { quiet: true }); }
    }
    if (armed) { gx = THREE.MathUtils.lerp(tx, zx, TRASH.magnet); gy = THREE.MathUtils.lerp(ty, zy, TRASH.magnet); }
  }
  carry.vx += ((gx - carry.x) / dt - carry.vx) * 0.35;      // smoothed hand speed: the lean and the throw
  carry.vy += ((gy - carry.y) / dt - carry.vy) * 0.35;
  carry.x = gx; carry.y = gy;
  if (Math.hypot(carry.x, carry.y) > 24) carry.far = true;
}
function releaseCarry(still) {
  if (carry.armed) { removeBot(); return; }                  // dropped on the target: it leaves the frame
  showTrash(false);
  carry.active = false; carry.back = true;
  const f = CARRY.maxFling;
  carry.vx = still ? 0 : THREE.MathUtils.clamp(carry.vx, -f, f);
  carry.vy = still ? 0 : THREE.MathUtils.clamp(carry.vy, -f, f);
}
// ─── drag to remove (Home) ─────────────────────────────────────────────────
// While the bot is held on Home a remove target rises at the bottom. Within
// TRASH.enter px of it the target arms (grows and brightens, "Release to remove",
// a snap) and the bot is pulled onto it — at full size; past TRASH.leave it
// disarms (a tick). On the cross the bot turns Angry; off it, back to Idle.
// Let go armed and the bot falls out of the frame at full size (a firm click):
// a little pop up, then gravity takes it down through the bottom edge,
// tumbling and spinning — and the cross circle falls with it, the same drop, so
// they leave the frame together, while the label and scrim fade. The bot is
// gone (rendering stops) until the page reloads.
const trashEl = document.getElementById('orbiTrash');
const trashLabel = document.getElementById('orbiTrashLabel');
const TRASH = {
  enter: 64, leave: 84, magnet: 0.72,
  beat: 220,                          // ms it stays on the cross, angry, after you let go (so the glare reads)
  windMs: 200, windPx: 16,            // a gentle rise that eases to a stop — the wind-up…
  gravity: 1500,                      // px/s²: …then it falls from rest through the bottom of the frame (≈0.75 s in all)
  tumble: 1.8,                        // roll grows as tumble·τ² (rad) — it tips over more and more as it drops
  spin: [4, 12],                      // rad/s of turn: from 4, rising by 12 per second of fall
};
const trashAt = { x: 187.5, y: 693 };
function showTrash(on) {
  if (!trashEl) return;
  carry.trash = on;
  if (on) {
    trashEl.classList.add('is-on');
    // where the target rests, in frame px — Figma 1098:14090, 64×64 at (155.5, 661): centre 119 px above the bottom
    trashAt.x = (screenEl.clientWidth || 375) / 2;
    trashAt.y = (screenEl.clientHeight || 812) - 119;
  } else {
    trashEl.classList.remove('is-on', 'is-armed');
    carry.armed = false;
    if (trashLabel) trashLabel.textContent = 'Drag here to remove';
  }
}
const trashRing = trashEl && trashEl.querySelector('.orbi-trash__ring');
function removeBot() {
  carry.active = false; carry.armed = false;
  // first it waits on the cross — visor up, angry face in, a beat — then it falls (see updateRemoval)
  carry.removing = { phase: 'wait', t0: performance.now(), last: performance.now() };
  if (state !== 'angry' && !visorCue) visorUpThen(() => setState('angry'));   // released before it got there
}
const easeOutCubicR = (x) => 1 - (1 - x) ** 3;
function updateRemoval() {
  const r = carry.removing, now = performance.now();
  const dt = Math.min(0.05, (now - r.last) / 1000);
  r.last = now;
  const relax = Math.exp(-dt * 6);                           // the lean from the last drag eases out (no frozen tilt)
  carry.vx *= relax; carry.vy *= relax;
  if (r.phase === 'wait') {
    // settles onto the cross while the visor goes up and the angry face comes in
    const zx = trashAt.x - view.cx, zy = trashAt.y - view.cy, k = 1 - Math.exp(-dt * 10);
    carry.x += (zx - carry.x) * k; carry.y += (zy - carry.y) * k;
    const ready = state === 'angry' && !morph && !visorCue && now - r.t0 >= TRASH.beat;
    if (!ready && now - r.t0 < 1800) return;
    r.phase = 'fall'; r.tf = now; r.y0 = carry.y;
    scripts.length = 0;                                      // no angry huff-hop mid-fall
    r.shake0 = m.shake;                                      // the angry shudder eases out as it goes
    haptic('edge');                                          // the firm click as it lets go of the cross
    trashEl.classList.add('is-falling');                     // the label + scrim ease out; the ring is driven below
    return;
  }
  // a gentle wind-up that eases to a stop, then a fall from rest — velocity is continuous throughout
  const tau = (now - r.tf) / 1000, w = TRASH.windMs / 1000;
  const lift = TRASH.windPx * easeOutCubicR(Math.min(1, tau / w));
  const tf = Math.max(0, tau - w);
  carry.y = r.y0 - lift + 0.5 * TRASH.gravity * tf * tf;
  carry.tumble = TRASH.tumble * tf * tf;                     // tips over more and more as it drops
  m.shake = (r.shake0 || 0) * Math.max(0, 1 - tau / 0.25);
  m.spin += (TRASH.spin[0] + TRASH.spin[1] * tf) * dt;
  // the cross circle falls with it — the same drop, frame for frame — so they leave the frame together
  if (trashRing) trashRing.style.transform = `translateY(${(carry.y - r.y0).toFixed(2)}px) scale(1.25) rotate(${(carry.tumble * 40).toFixed(1)}deg)`;
  const H = screenEl.clientHeight || 812, gone = view.cy + carry.y - view.unit * 2.2 > H;   // fully below the bottom edge
  if (!gone && tau < 2) return;
  carry.removing = null; carry.removed = true;
  canvas.classList.add('is-removed'); hit.classList.add('is-removed');
  canvas.setAttribute('aria-hidden', 'true'); hit.setAttribute('aria-hidden', 'true');
  // everything has already left or faded: hide the whole remove UI in one step. (Resetting the ring /
  // dropping .is-falling while it faded made the ✕ snap back and the label + scrim flash for a few frames.)
  trashEl.classList.add('is-gone');
  carry.trash = false; carry.armed = false;
}

// ─── bring it back: three quick taps on the noon tile ─────────────────────
// Once removed, three taps on the yellow "noon" marketplace tile (the first in
// the header — tile or collapsed pill), each within RESTORE.gap of the last,
// bring the bot back: everything from the removal is reset cleanly and it
// replays its intro — grows in place at its Home spot with a 360° turn,
// greets, settles, then lowers its visor. Not removed → the taps do nothing extra.
const RESTORE = { taps: 3, gap: 500 };
// (the GitFlow Home's experience switcher: its noon tile is aria-label="noon", mounted after this runs — delegated)
let noonTaps = [];
addEventListener('click', (e) => {
  if (!(e.target instanceof Element) || !e.target.closest('#nkHome [aria-label="noon"]')) return;
  if (!carry.removed) { noonTaps = []; return; }
  const now = performance.now();
  if (noonTaps.length && now - noonTaps[noonTaps.length - 1] > RESTORE.gap) noonTaps = [];
  noonTaps.push(now);
  if (noonTaps.length >= RESTORE.taps) { noonTaps = []; restoreBot(); }
});
function restoreBot() {
  if (!carry.removed) return;
  // the removal, undone
  Object.assign(carry, { removed: false, removing: null, active: false, back: false, armed: false, trash: false,
    x: 0, y: 0, vx: 0, vy: 0, lift: 0, tumble: 0, far: false });
  canvas.classList.remove('is-removed', 'carrying'); hit.classList.remove('is-removed', 'carrying');
  hit.removeAttribute('aria-hidden');                        // (the canvas itself is always decorative)
  // the remove UI back to its resting (hidden) state — it isn't .is-on, so nothing flashes
  trashEl.classList.remove('is-gone', 'is-falling', 'is-armed', 'is-on');
  if (trashRing) trashRing.style.transform = '';
  if (trashLabel) trashLabel.textContent = 'Drag here to remove';
  // the bot itself, fresh at its Home spot
  Object.assign(view, VIEW.home);
  m.y = HOVER_Y; m.vy = 0; m.airborne = false; m.x = 0; m.vx = 0;
  m.spin = 0; m.spinV = 0; m.home = 0; m.homing = true; m.glideF = 0; spinDetent = 0;
  m.tilt = m.tiltV = 0; m.nod = m.nodV = 0; m.rock = m.rockV = 0; m.shake = 0;
  swipeTimes = []; swipeAngry = 0; visorCue = null;
  scripts.length = 0;
  // …and its intro, from the top (as on page load)
  setState('idle', { quiet: true });
  helmet.setVisorDown(false);
  Object.assign(intro, { active: true, t: 0, scale: 0, greeted: false, popped: false });
  frameView();
  poke();                                                    // (a fresh 10 s before it may doze)
  clock.getDelta();                                          // no giant first step after the pause
  requestAnimationFrame(frame);                              // the render loop stopped on removal: restart it
}

function updateCarry(dt) {
  if (carry.removed) return;
  if (carry.removing) { updateRemoval(); frameView(); return; }
  const g = gesture;
  if (g && !g.carried && !g.axis && g.moved < AXIS_LOCK_PX && performance.now() - g.t >= CARRY.holdMs
      && !pageNav.show && !pageNav.anim && !pageNav.drag) startCarry(g);
  const lifted = carry.active ? 1 : 0;
  carry.lift += (lifted - carry.lift) * (1 - Math.exp(-dt * 16));
  if (carry.back) {
    const w = CARRY.omega, z = CARRY.zeta, H = 1 / 240;
    const d0 = Math.hypot(carry.x, carry.y);
    for (let left = dt; left > 0; left -= H) {
      const h = Math.min(H, left);
      carry.vx += (-w * w * carry.x - 2 * z * w * carry.vx) * h; carry.x += carry.vx * h;
      carry.vy += (-w * w * carry.y - 2 * z * w * carry.vy) * h; carry.y += carry.vy * h;
    }
    const d1 = Math.hypot(carry.x, carry.y);
    if (carry.far && d0 > 4 && d1 <= 4) { carry.far = false; haptic('land', 0.45); }   // home: a soft landing
    if (d1 < 0.3 && Math.hypot(carry.vx, carry.vy) < 6 && carry.lift < 0.01) {
      carry.back = false; carry.x = carry.y = carry.vx = carry.vy = 0; carry.lift = 0;
      canvas.classList.remove('carrying'); hit.classList.remove('carrying');
      frameView();                                          // land exactly on its spot
    }
  }
  if (carry.active || carry.back || carry.lift > 0.001) frameView();
}

// On Home a tap opens the sheet (asleep, it only wakes the bot). On the sheet
// a tap is a hop — the bot never sleeps while its sheet is open (no triple-tap
// sleep, no doze, key 6 ignored there); it greets and stays in Idle.
function tap() {
  if (pageNav.anim || pageNav.show) return;                  // mid-transition
  if (!pageNav.open) {                                       // on Home: a tap opens the Orbi sheet —
    if (state === 'sleepy') { setState('idle'); return; }    // …but only when awake: asleep, a tap just wakes it (the wake hop)
    visorCue = null;                                         // (a pending visor-then-sleep / greet doesn't follow it onto the sheet)
    goPage(true); return;
  }
  if (state === 'sleepy') { setState('idle'); return; }      // (can't fall asleep here, but just in case)
  hop(2.6);
  m.nodV += 1.2;
}

// ─── face animation ───────────────────────────────────────────────────────
const MORPH_S = 0.24;
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeInQuad = (x) => x * x;
const easeOutCubicF = (x) => 1 - (1 - x) ** 3;
// The "closed eye": a short horizontal stroke, exactly the size of a pill eye
// squashed shut (28 wide × ~7 tall), so the two can hand over seamlessly.
const SQUASH = 7.1 / 54;
const CLOSED = (() => {
  const l = linePts(-42.5, -7, -21.5, -7);
  return { eyes: [{ a: l, b: l, w: 7 }, { a: mirror(l), b: mirror(l), w: 7 }], mouth: MOUTH.none(), glint: 0, lip: 1, cheeks: 0, blink: 0 };
})();
const VIA = { close: 0.16, open: 0.26 };            // s: blink shut, then open into the new shape
const VIA_BACK = { reshape: 0.3, open: 0.26 };      // back to pills: relax shut, then open gently
function updateFace(dt) {
  // pill ⇄ other face: squash the pills shut, then the closed line bends into
  // the new shape (and the reverse: reshape to closed, then open into pills)
  if (morph && morph.via) {
    const total = morph.fromPill ? VIA.close + VIA.open : VIA_BACK.reshape + VIA_BACK.open;
    morph.t = Math.min(1, morph.t + dt / total);
    if (morph.fromPill) {
      const split = VIA.close / total;
      if (morph.t < split) {
        faceCur = morph.from;
        drawFace(morph.from, lerp(1, SQUASH, easeInQuad(morph.t / split)));
      } else {
        faceCur = lerpFace(CLOSED, morph.to, easeOutCubicF((morph.t - split) / (1 - split)));
        drawFace(faceCur, 1);
      }
    } else {
      const split = VIA_BACK.reshape / total;         // relax into a closed line, then open gently
      if (morph.t < split) {
        faceCur = lerpFace(morph.from, CLOSED, easeInOutCubic(morph.t / split));
        drawFace(faceCur, 1);
      } else {
        faceCur = morph.to;
        drawFace(morph.to, lerp(SQUASH, 1, easeInOutCubic((morph.t - split) / (1 - split))));
      }
    }
    if (morph.t >= 1) { faceCur = morph.to; morph = null; drawFace(faceCur, 1); }
    return;
  }
  // state change: morph the current face (even mid-morph) into the new one
  if (morph) {
    morph.t = Math.min(1, morph.t + dt / MORPH_S);
    faceCur = lerpFace(morph.from, morph.to, easeInOutCubic(morph.t));
    if (morph.t >= 1) { faceCur = morph.to; morph = null; }
    drawFace(faceCur, 1);
    return;
  }
  // blinks on the pill eyes
  if (faceCur.blink > 0.5) {
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkT < 0) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      const p = blinkT / 0.16;
      eyeOpen = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      if (p >= 1) { eyeOpen = 1; blinkT = -1; nextBlink = 1.8 + Math.random() * 3.5; }
      drawFace(faceCur, ease(Math.max(0, eyeOpen)));
    }
  }
}
const ease = x => 1 - (1 - x) * (1 - x);

// ─── Orbi sheet — Figma "Brand Banner2" (1086:92697), storyboard 1091:108941 ─
// A tap on the bot on Home presents Orbi in a bottom sheet, as storyboarded:
//   1 drop    the bot leaves its FAB on a sideways tangent and curves down to
//             the bottom edge — 80×80 at (148, 741.7), centre (188, 779.25) —
//             accelerating like it's falling, leaning into the curve and
//             dipping its face toward where it's going; a soft thud lands it
//   2 rise    the sheet comes up from below with the bot riding its top edge
//             (it starts a touch ahead and locks on), on an under-damped
//             spring (ζ .72, response .48s: a small iOS-sheet overshoot); the
//             bot grows to 120×120 at (128, 179) and turns a full 360° on the
//             way up, while Home shrinks into its card and the scrim fades in
//   3 settle  a snap as it arrives; if its visor is down it flips it open,
//             then it greets (^^ eyes, smile, a hop) and melts back into Idle
// The end state is Figma 1086:92697 — Home 355×768.7 at (10, 43) (scale
// 0.9467, r 18.93 on screen), black scrim at 80%, sheet 351×564 #F9F9FB r 20
// at y 233. One progress p (0 Home → 1 open; it may overshoot) drives the
// card, scrim and sheet; `view` (where the ball is drawn) follows the motion.
// Close by tapping the scrim, swiping the sheet down (it follows the finger,
// bot riding on it; past 110px or a flick it closes, otherwise it springs
// back), or Escape: a quick 280ms back to the FAB on a snappy curve
// (cubic-bezier(.32, .72, 0, 1): fast off the mark, firm landing), and a visor
// that was down on Home snaps back down on the way, landing as the bot does. On the sheet the bot is fully interactive.
const card = document.getElementById('homeCard');
const scrim = document.getElementById('orbiScrim');
const sheetEl = document.getElementById('orbiSheet');
const sbar = document.getElementById('sbar');                 // 1093:108979, above the whole flow
// (2026-10-19: the sheet is a full page — top 0, travelling the whole frame height; fitFrame sets the real height)
const SHEET = { top: 0, travel: 812, scale: 355 / 375, x: 10, y: 43, r: 20, scrim: 0.8 };
const PAGE_EDGE = 2.25;               // px below the page's top edge where the bot sits as the page starts to rise (as on the old sheet)
const SHOW = {
  drop: 340,                          // ms for the curved drop
  land: { cx: 188, cy: 779.25 },      // storyboard frame 2: 80×80 at (148, 741.7)
  c1: { cx: 232, cy: 676 },           // the arc leaves sideways (the storyboard's tangent)…
  c2: { cx: 188, cy: 702 },           // …and comes down vertically onto the bottom edge
  lean: { pitch: 0.32, roll: 0.28 },  // rad: face dips toward the fall, body leans into the curve
  zeta: 0.81, response: 0.375,        // the rise spring: noon's MOVE spring (stiffness 280.6, damping 27.14 — ζ .81, ω 16.75);
                                      // was ζ .72 / .48, whose ~3 % overshoot lifted the full page's bottom edge off the frame
  spin: { zeta: 0.8, omega: 10 },     // the 360° on the way up: a spring from rest — winds up, whips round,
                                      // face-on at ≈418 ms with a ≈5° overshoot (it was a 640 ms ease that started at full speed)
  lead: 35,                           // px the bot starts above the sheet's edge (closes as (1 − q)²)
  visorDelay: 140,                    // ms after settling before the visor flips open
  // (the hello waits for the visor to be fully up: VISOR_RAISE_MS; straight away if it's already up)
};
const DISMISS_AT = 110;               // px of swipe past which letting go closes the sheet
const pageNav = { open: false, p: 0, lift: 0, anim: null, drag: null, show: null, pose: { pitch: 0, roll: 0 }, visorAt: 0, greetAt: 0, restoreVisor: false };
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
  const dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; }
    t = THREE.MathUtils.clamp(t, 0, 1);
    return Y(t);
  };
}
const easeOutCubicS = (x) => 1 - (1 - x) ** 3;
const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
function setSheetLive(on) {                                  // layering + a11y while presented / animating
  scrim.style.visibility = sheetEl.style.visibility = on ? 'visible' : 'hidden';
  if (on) sheetEl.removeAttribute('inert'); else sheetEl.setAttribute('inert', '');
  sheetEl.setAttribute('aria-hidden', String(!pageNav.open));
  canvas.classList.toggle('on-page', on); hit.classList.toggle('on-page', on);
  card.classList.toggle('is-lifted', on);
}
// ─── the full page: ONE spring (noon motion — "one curve, one start frame") ───
// Everything is one progress p (0 Home → 1 the page) on noon's MOVE spring (stiffness 280.6, damping 27.14:
// ω 16.75, ζ .81 — 1.3 % overshoot, ≈544 ms), started in the tap's frame and driven by the same p:
//   the page        y 100 % → 0 (never past the top — its bottom edge would lift off the frame)
//   Home under it   scale 1 → .94, corners → 24 (own 200 ms clock), dimmed to 85 %  (noon's full-page modal)
//   the bot         one arc from its spot to its rest at the page's top, growing to its page size, turning its
//                   approved 360° on the way up, leaning into the motion; then visor (if down) → hello
// Closing is the same spring back (carrying a swipe's velocity); a swipe follows the finger 1:1.
const PAGE_SPRING = { omega: 16.75, zeta: 0.81 };           // opening: noon MOVE
const PAGE_CLOSE = { omega: 18, zeta: 0.92 };               // closing: a touch quicker and near-critical (≈0.3 px over) — exits land quietly, no bounce at the FAB
// the 360° on the way up turns on its own softer spring from the same frame (the colour spin's: ω 11, ζ .86, a light
// push), so it's face-on just after the bot lands — a follow-through, not a whip (tied to the page it took 250 ms)
const PAGE_TURN = { omega: 11, zeta: 0.86, kick: 3 };
const UNDER = { scale: 0.94, dim: 0.15 };
function flightAt(e) {                                       // the bot's arc, Home spot (e 0) → rest on the page (e 1)
  const a = VIEW.home, b = VIEW.page;
  // leaves upward (a little left), swings in to the centre from the right — a soft, single curve
  const c1 = { cx: a.cx - 12, cy: a.cy - (a.cy - b.cy) * 0.55 }, c2 = { cx: b.cx + 64, cy: b.cy + 90 };
  return { cx: bez(a.cx, c1.cx, c2.cx, b.cx, e), cy: bez(a.cy, c1.cy, c2.cy, b.cy, e), unit: THREE.MathUtils.lerp(a.unit, b.unit, THREE.MathUtils.clamp(e, 0, 1)) };
}
function goPage(open, { settle = false, v0 = 0, glide = 0 } = {}) {
  if (pageNav.open === open && !pageNav.anim && !pageNav.drag && !pageNav.show) return;
  const fromHome = open && !settle && pageNav.p <= 0.001 && !pageNav.anim && !pageNav.drag;
  pageNav.open = open; pageNav.drag = null; pageNav.visorAt = 0; pageNav.greetAt = 0;
  sheetEl.classList.remove('is-landed');                     // travelling: round corners
  if (!open && picker) picker.close();
  if (fromHome) {
    if (intro.active) endIntro();
    pageNav.restoreVisor = helmet.visorDown;
    haptic('snap');                                          // noon: impact medium for a gesture that moves a page
  }
  // the bot starts from wherever it is: its offset from the arc fades out as p reaches the target
  const here = { ...view }, arc0 = flightAt(pageNav.p);
  pageNav.anim = { x: pageNav.p, v: v0, to: open ? 1 : 0, spin: fromHome, s: Math.PI * 2, sv: -PAGE_TURN.kick, x0: pageNav.p,
    glide: glide ? { T: glide, t: 0, v0 } : null,         // a slow swipe's release: a curve that starts at the finger's speed
    off: { cx: here.cx - arc0.cx, cy: here.cy - arc0.cy, unit: here.unit - arc0.unit }, last: 0, prev: here };
  pageNav.show = fromHome ? pageNav.anim : null;             // (a scripted turn: the yaw spring stays out of it)
  pageNav.lift = 0;
  setSheetLive(true);
}
// ─── fit to the phone's height (this page) ───────────────────────────────
// The Figma frame is 375 × 812, but phones aren't: the page is laid out 375 wide
// (index.html's viewport) and the real height varies — an Android phone with
// Chrome's toolbar is ≈700–780. Everything the bot uses below the header is
// anchored to the bottom edge like the nav: its spot above the nav, the drop
// path onto the sheet, and the sheet itself (564 tall, 15 above the bottom).
const FIGMA_H = 812;
const BASE = { home: VIEW.home.cy, page: VIEW.page.cy, top: SHEET.top, land: SHOW.land.cy, c1: SHOW.c1.cy, c2: SHOW.c2.cy };
let frameDy = 0;
function fitFrame() {
  const H = screenEl.clientHeight || FIGMA_H;
  const dy = H - FIGMA_H;
  if (dy === frameDy && fitFrame.done) return;
  fitFrame.done = true;
  const was = frameDy; frameDy = dy;
  VIEW.home.cy = BASE.home + dy;
  SHOW.land.cy = BASE.land + dy; SHOW.c1.cy = BASE.c1 + dy; SHOW.c2.cy = BASE.c2 + dy;
  // the page is the whole frame (CSS), so it travels the phone's height; the bot's rest spot is top-anchored
  SHEET.travel = H;
  if (!pageNav.show && !pageNav.anim && !pageNav.drag) {
    view.cy += dy - was;                                     // wherever it is now (home or on the sheet), it moves with the edge
    placePage();
  }
}

function placePage() {
  const p = pageNav.p, pc = THREE.MathUtils.clamp(p, 0, 1);  // the sheet may overshoot; card + scrim stop at 1
  if (pc > 0) {                                              // Home recedes under the page: scale about its centre
    const sc = 1 - (1 - UNDER.scale) * pc, W = screenEl.clientWidth || 375, Hh = screenEl.clientHeight || 812;
    card.style.transform = `translate(${(W * (1 - sc) / 2).toFixed(3)}px, ${(Hh * (1 - sc) / 2).toFixed(3)}px) scale(${sc.toFixed(5)})`;
  } else card.style.transform = '';
  scrim.style.opacity = (UNDER.dim * pc).toFixed(4);          // chained to the page (85 % brightness at rest)
  if (sbar) sbar.style.setProperty('--sb-ink', '0');          // dark all the way: Home is only lightly dimmed, then the white page
  // (a full page never rises past the top: its bottom edge would lift off the frame and show Home under it)
  sheetEl.style.transform = `translateY(${(Math.max(0, (1 - p) * SHEET.travel) + pageNav.lift).toFixed(2)}px)`;
  frameView();
  const s = view.unit / 30;                                  // the Figma frame box (80 at unit 30)
  const pad = 16 * pc;                                       // on the sheet: room for the raised visor (it rises above the frame)
  hit.style.left = `${(view.cx - 40 * s - pad).toFixed(2)}px`;
  hit.style.top = `${(view.cy - 37.5 * s - pad).toFixed(2)}px`;
  hit.style.width = hit.style.height = `${(80 * s + 2 * pad).toFixed(2)}px`;
}
function stepPage(now) {
  const a = pageNav.anim;
  const dt = Math.min(0.05, a.last ? (now - a.last) / 1000 : 1 / 60); a.last = now;
  const sp = a.to === 1 ? PAGE_SPRING : PAGE_CLOSE, w = sp.omega, z = sp.zeta, ws = PAGE_TURN.omega, zs = PAGE_TURN.zeta;
  if (a.glide) {
    // cubic Hermite: from where the finger let go, at the finger's speed, easing to rest on the target (no jolt
    // on release, and the bot still lands softly)
    const g = a.glide; g.t = Math.min(g.T, g.t + dt);
    const u = g.t / g.T, u2 = u * u, u3 = u2 * u, T = g.T;
    a.x = (2 * u3 - 3 * u2 + 1) * a.x0 + (u3 - 2 * u2 + u) * T * g.v0 + (-2 * u3 + 3 * u2) * a.to;
    a.v = ((6 * u2 - 6 * u) * a.x0 + (3 * u2 - 4 * u + 1) * T * g.v0 + (-6 * u2 + 6 * u) * a.to) / T;
    if (u >= 1) { a.x = a.to; a.v = 0; }
  } else for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(left, 1 / 240);
    a.v += (w * w * (a.to - a.x) - 2 * z * w * a.v) * h;
    a.x += a.v * h;
    if (a.spin) { a.sv += (-ws * ws * a.s - 2 * zs * ws * a.sv) * h; a.s += a.sv * h; }
  }
  const p = a.x;
  // the bot: on its arc, plus whatever offset it started with, fading out as p reaches the target
  const arc = flightAt(p), span = a.to - a.x0, k = Math.abs(span) > 1e-4 ? THREE.MathUtils.clamp((a.to - p) / span, 0, 1) : 0;
  view.cx = arc.cx + a.off.cx * k; view.cy = arc.cy + a.off.cy * k; view.unit = arc.unit + a.off.unit * k;
  // leaning into the motion (like a carried bot): sideways speed → roll, vertical → pitch; straight when still
  const vx = (view.cx - a.prev.cx) / Math.max(dt, 1e-3), vy = (view.cy - a.prev.cy) / Math.max(dt, 1e-3);
  a.prev = { cx: view.cx, cy: view.cy };
  pageNav.pose.roll += (THREE.MathUtils.clamp(-vx * 0.0004, -0.22, 0.22) - pageNav.pose.roll) * Math.min(1, dt * 14);
  pageNav.pose.pitch += (THREE.MathUtils.clamp(vy * 0.00018, -0.2, 0.2) - pageNav.pose.pitch) * Math.min(1, dt * 14);
  if (a.spin) { m.spin = a.s; m.spinV = a.sv; }             // the 360° (its own spring, same start frame)
  if (a.to === 0 && p < 0.45) restoreVisorNow();             // closing: a visor that was down drops in time to land with it
  pageNav.p = p;
  placePage();
  const H = SHEET.travel;
  if (a.to === 1 && !sheetEl.classList.contains('is-landed') && (1 - p) * H < 0.5) sheetEl.classList.add('is-landed');   // landed: corners square
  const turned = !a.spin || (Math.abs(a.s) < 0.01 && Math.abs(a.sv) < 0.15);   // (≈0.6°)
  if (Math.abs(a.to - p) * H < 0.5 && Math.abs(a.v) * H < 15 && turned) {       // visually at rest (< 0.5 px, < 15 px/s)
    pageNav.anim = null; pageNav.show = null; pageNav.p = a.to; pageNav.pose.pitch = pageNav.pose.roll = 0;
    if (a.spin) { m.spin = 0; m.spinV = 0; m.home = 0; m.homing = true; m.glideF = 0; spinDetent = 0; }
    if (a.to === 1) {
      Object.assign(view, VIEW.page);
      placePage();
      sheetEl.classList.add('is-landed');
      sheetEl.setAttribute('aria-hidden', 'false');
      pageNav.visorAt = now + SHOW.visorDelay;              // visor (if down), then the greeting
    } else {
      Object.assign(view, VIEW.home);
      placePage();
      setSheetLive(false);
      haptic('land', 0.35);                                  // a soft landing back in its corner
      restoreVisorNow();
    }
  }
}
// the sheet's hello: the intro's greeting (eyes blink into ^^, smile, cheeks,
// a little hop and wobble), then after GREET_FOR it blinks back into Idle
function greetOnSheet() {
  if (state === 'sleepy') return;
  setState('greeting', { quiet: true });
  hop(2.2);
  haptic('success');
  schedule(GREET_FOR, () => { if (state === 'greeting') setState('idle'); });
}
function restoreVisorNow() {
  if (pageNav.restoreVisor && !helmet.visorDown) setVisor(true);
  pageNav.restoreVisor = false;
}
function updatePage() {
  const now = performance.now();
  if (pageNav.visorAt && now >= pageNav.visorAt) {           // settled: flip the visor open (if down)…
    pageNav.visorAt = 0;
    if (pageNav.open) {
      const flipping = helmet.visorDown;
      if (flipping) { setVisor(false); haptic('tap'); }
      pageNav.greetAt = now + (flipping ? VISOR_RAISE_MS : 0);
    }
  }
  if (pageNav.greetAt && now >= pageNav.greetAt) {           // …and say hello, then back to Idle
    pageNav.greetAt = 0;
    if (pageNav.open) greetOnSheet();
  }
  if (pageNav.anim) stepPage(now);
}
// swipe the sheet down to dismiss: everything follows the finger
sheetEl.addEventListener('pointerdown', (e) => {
  if (!pageNav.open || pageNav.show) return;
  if (e.target.closest('#orbiClose')) return;                // (the close button is a button, not a drag handle)
  pageNav.anim = null;
  sheetEl.classList.remove('is-landed');                     // corners round as it lifts off
  pageNav.drag = { y0: e.clientY - ((1 - pageNav.p) * SHEET.travel + pageNav.lift), ly: e.clientY, lt: performance.now(), vy: 0, armed: false, edged: false };
  try { sheetEl.setPointerCapture(e.pointerId); } catch {}
});
sheetEl.addEventListener('pointermove', (e) => {
  const d = pageNav.drag;
  if (!d) return;
  const now = performance.now(), dt = Math.max(1, now - d.lt) / 1000;
  d.vy += ((e.clientY - d.ly) / dt - d.vy) * 0.35; d.ly = e.clientY; d.lt = now;
  const dy = e.clientY - d.y0;                               // sheet offset from its open position
  pageNav.p = 1 - Math.max(0, dy) / SHEET.travel;
  pageNav.lift = 0;                                          // (a full page: pulling up goes nowhere — the edge bump below says so)
  const armed = dy > DISMISS_AT;                             // haptics: a tick crossing the dismiss point (both ways)…
  if (armed !== d.armed) { d.armed = armed; haptic('tick'); }
  if (dy < -2 && !d.edged) { d.edged = true; haptic('edge'); }   // …and a bump pulling past the top
  else if (dy >= 0) d.edged = false;
  view.cx = VIEW.page.cx; view.unit = VIEW.page.unit;
  view.cy = VIEW.page.cy + (1 - pageNav.p) * SHEET.travel + pageNav.lift;   // the bot rides the sheet
  placePage();
});
const endSheetDrag = () => {
  const d = pageNav.drag;
  if (!d) return;
  pageNav.drag = null;
  const dy = (1 - pageNav.p) * SHEET.travel;
  const v0 = THREE.MathUtils.clamp(-d.vy / SHEET.travel, -8, 8);   // px/s down → progress/s (p falls as it goes down)
  // noon motion: a fast flick (> 900 px/s) settles on the spring with its release velocity; slower releases
  // carry on from the finger's speed and ease to rest (≈0.36 s; the spring would yank them ×3 in one frame)
  const fast = Math.abs(d.vy) > 900;
  const glide = fast ? 0 : 0.3 + 0.12 * Math.abs((dy > DISMISS_AT || d.vy > 700 ? 0 : 1) - pageNav.p);
  // (a monotone glide: the release speed can't exceed 3 × distance / time)
  const span = (to) => Math.abs(to - pageNav.p), cap = (to) => (glide ? Math.sign(v0) * Math.min(Math.abs(v0), 2.5 * span(to) / glide) : v0);
  if (dy > DISMISS_AT || d.vy > 700) { if (!d.armed) haptic('tap'); goPage(false, { v0: cap(0), glide }); }   // (a crossed drag already ticked)
  else { pageNav.open = false; goPage(true, { settle: true, v0: cap(1), glide }); }   // back open
};
sheetEl.addEventListener('pointerup', endSheetDrag);
sheetEl.addEventListener('pointercancel', endSheetDrag);
scrim.addEventListener('pointerdown', () => { if (pageNav.open) haptic('tap'); });
scrim.addEventListener('click', () => { if (pageNav.open) goPage(false); });
document.getElementById('orbiClose')?.addEventListener('pointerdown', () => { if (pageNav.open) haptic('tap'); });
document.getElementById('orbiClose')?.addEventListener('click', () => { if (pageNav.open) goPage(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && pageNav.open) goPage(false); });

// ─── colour slider on the Orbi sheet (orbi/colour-picker.js) ──────────────
// The composer's swatch morphs into a six-stop slider. While it's open the
// bot watches the knob; each colour the knob lands on (release, tap, flick)
// turns the bot a full 360° and swaps the colour in mid-turn.
picker = mountColourPicker({
  themes: THEMES.map((th) => ({ name: th.name, hex: '#' + themeColor(th, th.body).getHexString() })),
  get index() { return themeIdx; },
  choose(i) { if (i !== themeIdx) { spinToTheme(i); haptic('pop'); } },
  // k: −1 (knob at the left end) … 1 (right end), null = let go
  look(k) { gazeLock = k == null ? null : { yaw: 0.3 * k, pitch: 0.2 }; },
  haptic,
});

// ─── device tilt: the phone's left/right tilt turns the bot a little ──────
// Tilt the phone right → it turns (and leans a touch) right; left → left; back
// level → back to neutral. Deliberately light: a 2° dead zone (a hand is never
// perfectly level), then a soft limit — 25° of tilt ≈ 9° of turn, never more
// than ≈11° — a low-pass that takes out sensor jitter, and a critically damped
// spring, so it follows promptly and settles without overshoot. Added on top
// of everything else (it never fights a drag or a scripted spin). iOS only
// sends motion after the page asks, so the first tap anywhere asks.
const TILT = { dead: 2, range: 25, yaw: 0.2, roll: 0.05, smooth: 14, k: 90 };
const tilt = { raw: 0, f: 0, x: 0, v: 0 };
function onOrientation(e) {
  if (e.gamma == null) return;
  const a = (screen.orientation && screen.orientation.angle) || 0;
  // left/right in the screen's own frame (turned sideways, it's the other axis)
  tilt.raw = a === 90 ? -e.beta : a === 270 ? e.beta : a === 180 ? -e.gamma : e.gamma;
}
if (typeof DeviceOrientationEvent !== 'undefined') {
  const listen = () => addEventListener('deviceorientation', onOrientation);
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const ask = () => {
      removeEventListener('touchend', ask, true); removeEventListener('click', ask, true);
      DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') listen(); }).catch(() => {});
    };
    addEventListener('touchend', ask, { capture: true, passive: true });
    addEventListener('click', ask, true);
  } else listen();
}
function updateTilt(dt) {
  dt = Math.min(dt, 0.05);
  const g = tilt.raw, mag = Math.max(0, Math.abs(g) - TILT.dead);
  const x = Math.sign(g) * Math.tanh(mag / TILT.range);          // −1 … 1, easing into the limit
  tilt.f += (x - tilt.f) * (1 - Math.exp(-dt * TILT.smooth));     // jitter out
  const target = carry.removing || carry.removed ? 0 : tilt.f;
  const K = TILT.k, D = 2 * Math.sqrt(K);
  tilt.v += (K * (target - tilt.x) - D * tilt.v) * dt;
  tilt.x += tilt.v * dt;
}

// ─── frame loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const up = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const H = 1 / 240;
let acc = 0;

let simT = 0;
// ─── intro: grow from nothing with a full turn, in place ──────────────────
// Scale 0 → 1 on an ease-out-back (overshoots ~8%, settles) while the bot
// makes one full turn on its vertical axis, ending face-on; shadows grow with
// it. A grab or a state pick finishes it instantly.
const intro = { active: true, t: 0, scale: 0, greeted: false, popped: false };
const GREET_AT = 0.6;       // s into the intro: as the scale overshoot peaks and the turn swings home
const GREET_FOR = 1.7;      // s of greeting before it melts into idle
const INTRO = { delay: 0.12, scale: 0.75, spin: 0.95 };
const easeOutBack = (x, c = 1.9) => 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
const easeOutCubicI = (x) => 1 - (1 - x) ** 3;
function updateIntro(dt) {
  if (!intro.active) return;
  intro.t += dt;
  const t = Math.max(0, intro.t - INTRO.delay);
  const ps = Math.min(1, t / INTRO.scale), pr = Math.min(1, t / INTRO.spin);
  intro.scale = Math.max(0, easeOutBack(ps));
  if (!intro.popped && intro.scale >= 1) { intro.popped = true; haptic('pop'); }
  m.spin = Math.PI * 2 * (1 - easeOutCubicI(pr));   // 360° → 0: turns to its left, ends face-on
  m.spinV = 0;
  if (!intro.greeted && intro.t >= GREET_AT) {
    // no pause: it greets while still settling — eyes morph to ^^, the smile
    // and cheeks bloom, a little happy hop + wave — then melts into idle
    intro.greeted = true;
    setState('greeting', { quiet: true });
    haptic('success');
    hop(2.2);
    schedule(GREET_FOR, () => {
      if (state !== 'greeting') return;
      setState('idle');
      schedule(0.2, () => { if (state === 'idle') setVisor(true, { slow: true }); });   // settles in, then the visor glides down
    });
  }
  if (ps >= 1 && pr >= 1) endIntro();
}
function endIntro() {
  if (!intro.active) return;
  intro.active = false;
  intro.greeted = true;
  intro.popped = true;
  intro.scale = 1;
  m.spin = 0; m.spinV = 0;
  m.homing = true; m.home = 0; m.glideF = 0;
}

// ─── idle glances ─────────────────────────────────────────────────────────
// In Idle the bot looks around: slight left → slight right → up-left →
// up-right → back to centre, holding each glance ~2 s (with a little jitter)
// and sometimes blinking as it shifts. A slow, critically damped spring
// (ζ = 1, ~1.5 s to arrive, no overshoot) drives the look so it drifts
// unhurriedly; leaving Idle eases it back to centre.
const GLANCES = [               // [yaw, pitch]  (+yaw = its face turns right on screen, −pitch = up)
  [-0.2, 0], [0.2, 0], [-0.16, -0.12], [0.16, -0.12], [0, 0],
];
const gaze = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, i: -1, hold: 1.4 };
let gazeLock = null;            // { yaw, pitch } while the colour slider is open: it watches the knob
function updateGaze(dt) {
  if (gazeLock) {
    gaze.ty = gazeLock.yaw; gaze.tp = gazeLock.pitch; gaze.i = -1; gaze.hold = 0.9;
  } else if (state === 'idle' && !m.dragging && !intro.active && !look.busy) {
    gaze.hold -= dt;
    if (gaze.hold <= 0) {
      gaze.i = (gaze.i + 1) % GLANCES.length;
      [gaze.ty, gaze.tp] = GLANCES[gaze.i];
      const centre = gaze.ty === 0 && gaze.tp === 0;
      gaze.hold = (centre ? 2.8 : 2.0) + Math.random() * 0.8;
      if (Math.random() < 0.3 && blinkT < 0) nextBlink = 0.05;     // blink as it shifts its gaze
    }
  } else {
    gaze.ty = 0; gaze.tp = 0; gaze.i = -1; gaze.hold = 0.9;        // back to centre; restart the loop later
  }
  const K = gazeLock ? 70 : 6, D = 2 * Math.sqrt(K);  // critically damped: smooth, no overshoot (snappy when tracking the knob)
  gaze.vy += (K * (gaze.ty - gaze.yaw) - D * gaze.vy) * dt;
  gaze.yaw += gaze.vy * dt;
  gaze.vp += (K * (gaze.tp - gaze.pitch) - D * gaze.vp) * dt;
  gaze.pitch += gaze.vp * dt;
}

// ─── scroll look: follows the Home page scroll ────────────────────────────
// Scrolling down → it looks slightly left and down; scrolling up → slightly
// left and up (left on screen: toward the page, from its spot at the right
// edge). The lean grows with the scroll speed (saturating), so a flick reads
// stronger than a nudge; the left turn follows the same strength.
// The page's speed is smoothed (quick to build), then held for a moment once
// the page stops — so short pauses and momentum scrolling don't flicker — and
// let go. Two critically damped springs (ζ = 1, ~0.45 s, never overshoot) turn
// it into head pitch and yaw. With no scrolling it eases back face-on and the
// Idle glances resume.
// (the page that scrolls: the GitFlow Home's feed — its tallest vertical scroller, found once it has mounted)
let feedEl = null;
function homeScroller() {
  if (feedEl && feedEl.isConnected) return feedEl;
  feedEl = null;
  let best = 0;
  for (const el of document.querySelectorAll('#nkHome .nk-scroll, #nkHome [class*="scroll" i]')) {
    const st = getComputedStyle(el);
    if (!/(auto|scroll)/.test(st.overflowY) || el.scrollHeight <= el.clientHeight + 40) continue;
    if (el.scrollHeight > best) { best = el.scrollHeight; feedEl = el; }
  }
  if (feedEl) look.last = feedEl.scrollTop;
  return feedEl;
}
const LOOK = {
  down: 0.3, up: 0.24,    // rad of pitch at full speed (+ = face down)
  left: 0.2,              // rad of yaw at full speed (− = left on screen)
  speed: 900,             // px/s for tanh(1) ≈ 76% of full
  hold: 0.3,              // s the look holds after the page stops
  release: 4.5,           // 1/s: how fast it lets go after the hold (≈0.7 s)
};
const look = { pitch: 0, yaw: 0, vp: 0, vy: 0, speed: 0, still: 0, last: 0, busy: false };
function updateLook(dt) {
  const pageScroll = homeScroller();
  if (!pageScroll || dt <= 0) return;
  const top = pageScroll.scrollTop;
  const vel = (top - look.last) / dt;               // px/s, + = scrolling down
  look.last = top;
  look.still = Math.abs(vel) < 5 ? look.still + dt : 0;
  if (look.still === 0) look.speed += (vel - look.speed) * (1 - Math.exp(-dt * 10));   // follow the page
  else if (look.still > LOOK.hold) look.speed *= Math.exp(-dt * LOOK.release);        // no input: let go
  const k = state === 'sleepy' || pageNav.open ? 0 : Math.tanh(look.speed / LOOK.speed);   // asleep / on its page: ignores Home
  const tp = k * (k > 0 ? LOOK.down : LOOK.up);
  const ty = -Math.abs(k) * LOOK.left;
  const K = 48, D = 2 * Math.sqrt(K);
  look.vp += (K * (tp - look.pitch) - D * look.vp) * dt;
  look.pitch += look.vp * dt;
  look.vy += (K * (ty - look.yaw) - D * look.vy) * dt;
  look.yaw += look.vy * dt;
  look.busy = Math.abs(k) > 0.03 || Math.abs(look.pitch) > 0.015 || Math.abs(look.yaw) > 0.015;
}

// Per-state body pose (offsets on top of gaze / base pitch). Kept as a pure
// function of time so the previous state's pose can keep playing while it
// crossfades into the new one — no snap when a state ends.
const POSE_BLEND_S = 0.5;
let prevState = 'idle', prevStateTime = 0, poseBlend = 1;
function statePose(st, t, st_t) {
  const p = { yaw: 0, pitch: 0, roll: 0, sway: 0 };
  switch (st) {
    case 'idle':
      p.yaw = Math.sin(t * 0.7) * 0.015;             // faint drift between glances
      break;
    case 'working':
      p.yaw = Math.sin(t * 1.5) * 0.3;
      p.pitch = 0.1;
      break;
    case 'greeting':
      p.roll = Math.sin(st_t * 9) * 0.2 * Math.exp(-st_t * 1.2) + 0.06;
      break;
    case 'error':
      p.roll = Math.sin(st_t * 18) * 0.1 * Math.exp(-st_t * 3);
      p.pitch = 0.05;
      break;
    case 'angry':
      p.pitch = 0.13;                                  // head down: a glare from under the brows
      p.roll = Math.sin(t * 1.9) * 0.025;              // slow, stiff sway
      break;
    case 'dizzy':
      p.roll = Math.sin(t * 2.6) * 0.24;
      p.pitch = Math.cos(t * 2.6) * 0.14;
      p.yaw = Math.sin(t * 1.3) * 0.18;
      p.sway = Math.sin(t * 2.6) * 0.08;
      break;
    case 'sleepy':
      p.roll = 0.14 + Math.sin(t * 0.8) * 0.03;
      p.pitch = 0.16;
      break;
  }
  return p;
}

function update(dt) {
  if (carry.removed) return;                                 // removed via the drag-to-remove target: the bot is gone
  updatePage();
  updateVisorCue();
  updateCarry(dt);
  updateDoze();
  simT += dt;
  const t = simT;
  stateTime += dt;
  for (let i = scripts.length - 1; i >= 0; i--) {
    if (stateTime >= scripts[i].at) { const s = scripts[i]; scripts.splice(i, 1); s.fn(); }
  }

  // hover height: a gentle bob, or sitting on the floor when asleep
  if (state === 'sleepy') m.hoverY = FLOOR_Y + R;
  else m.hoverY = HOVER_Y + Math.sin(t * 1.6) * (state === 'working' ? 0.02 : 0.05);

  updateIntro(dt);
  updateColourSpin(dt);
  acc += dt;
  while (acc >= H) { stepMotion(H); acc -= H; }
  // a tick per 30° detent the user's turn passes (not the entry's 360°)
  const det = Math.round(m.spin / DETENT);
  if (det !== spinDetent) { if (!intro.active && !pageNav.show && !carry.removing && !carry.removed && !colourSpin.active) haptic('tick'); spinDetent = det; }   // (scripted spins don't tick)

  // state-specific pose (self-driven — never from the cursor)
  updateLook(dt);
  updateGaze(dt);
  updateTilt(dt);
  helmet.update(dt);
  updateTheme(dt);
  // state pose, crossfaded from the previous state's pose after a change
  poseBlend = Math.min(1, poseBlend + dt / POSE_BLEND_S);
  prevStateTime += dt;
  const cur = statePose(state, t, stateTime);
  const pb = easeInOutCubic(poseBlend);
  const pv = pb < 1 ? statePose(prevState, t, prevStateTime) : cur;
  let yaw = gaze.yaw + look.yaw + tilt.x * TILT.yaw + lerp(pv.yaw, cur.yaw, pb);
  // carried / swinging home: it leans into sideways moves and tips with vertical ones
  const carryRoll = THREE.MathUtils.clamp(-carry.vx * 0.00045, -0.32, 0.32), carryPitch = THREE.MathUtils.clamp(carry.vy * 0.00035, -0.26, 0.26);
  let pitch = BASE_PITCH + gaze.pitch + look.pitch + pageNav.pose.pitch + carryPitch + lerp(pv.pitch, cur.pitch, pb);
  let roll = pageNav.pose.roll + carryRoll + carry.tumble - tilt.x * TILT.roll + lerp(pv.roll, cur.roll, pb);
  const sway = lerp(pv.sway, cur.sway, pb);
  // lean into the spin like a ball rolling off a flick, plus landing wobble
  roll += THREE.MathUtils.clamp(-(m.dragging ? m.dragVel : m.spinV) * 0.012, -0.18, 0.18) - m.rock;
  pitch += m.nod + m.tilt;

  euler.set(pitch, yaw + m.spin, roll, 'YXZ');
  viewRoll = roll;
  body.quaternion.setFromEuler(euler);
  body.scale.setScalar(Math.max(1e-4, intro.scale));
  const tremble = m.shake ? Math.sin(t * 90) * m.shake : 0;
  body.position.set(m.x + sway + tremble, m.y, 0);

  updateFace(dt);

  placeShadows();
  // dizzy orbit — three beads circling above the head
  up.set(0, 1, 0).applyQuaternion(body.quaternion);
  orbiters.forEach((o, i) => {
    const on = state === 'dizzy' ? 1 : 0;
    o.scale.setScalar(THREE.MathUtils.lerp(o.scale.x, on, 1 - Math.exp(-dt * 10)));
    o.visible = o.scale.x > 0.01;
    if (!o.visible) return;
    const a = t * 3.2 + o.userData.phase;
    tmpV.set(Math.cos(a) * 0.62, 0.02 * Math.sin(a * 2 + i), Math.sin(a) * 0.36);
    o.position.copy(body.position).addScaledVector(up, 1.55).add(tmpV);
  });

  // Zz — drift up and to the right, then fade
  if (state === 'sleepy') {
    zTimer -= dt;
    if (zTimer <= 0) {
      zTimer = 1.15;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, toneMapped: false }));
      sp.userData.age = 0;
      sp.position.copy(body.position).add(new THREE.Vector3(0.55, 0.95, 0.3));
      scene.add(sp);
      zs.push(sp);
    }
  }
  for (let i = zs.length - 1; i >= 0; i--) {
    const z = zs[i];
    z.userData.age += dt;
    const a = z.userData.age;
    z.position.x += dt * 0.22 + Math.sin(a * 3) * dt * 0.08;
    z.position.y += dt * 0.38;
    const s = 0.16 + a * 0.12;
    z.scale.set(s, s, 1);
    z.material.opacity = Math.min(1, a * 3) * Math.max(0, 1 - a / 2.6);
    if (a > 2.6) { scene.remove(z); z.material.dispose(); zs.splice(i, 1); }
  }

}

// Resolution governor (this page): phones vary — on a GPU that can't keep up
// (a sustained < ~45 fps, two seconds of it), the bot's drawing buffer steps
// down a quarter of a pixel ratio at a time, 2 → 1.75 → 1.5, and stays there.
// A phone that holds its frame rate never changes.
const GOV = { from: performance.now() + 4000, ema: 16.7, last: 0, slow: 0, min: 1.5 };
function govern(now) {
  if (GOV.last) { const d = now - GOV.last; if (d < 250) GOV.ema += (d - GOV.ema) * 0.05; }
  GOV.last = now;
  if (now < GOV.from || document.hidden) { GOV.slow = 0; return; }
  GOV.slow = GOV.ema > 22 ? GOV.slow + 1 : 0;
  if (GOV.slow > 90 && renderer.getPixelRatio() > GOV.min + 0.01) {
    renderer.setPixelRatio(Math.max(GOV.min, renderer.getPixelRatio() - 0.25));
    GOV.slow = 0; GOV.from = now + 2000; GOV.ema = 16.7;
  }
}

// Render cadence (this page). Every new frame of the bot also makes the phone recomposite the whole screen;
// measured in Chrome on Android, drawing it at 60 fps was ~⅔ of the device's GPU time with the page sitting
// still — headroom the scroll, the header and the sheet then lacked. On Android (and on any device the governor
// has already found slow) it draws every frame only while something is actually moving — a touch on it, a drag
// or carry, the sheet, a spin, a hop, the visor, the colour slider, a state change and a beat after — and at
// 30 fps for its slow idle sway and glances, 20 fps asleep. Physics still step every frame, and the canvas
// itself still moves at full rate (its position is a CSS transform).
const IS_ANDROID = /Android/i.test(navigator.userAgent);
let cadenceN = 0, busyUntil = 0;
const keepBusy = (ms) => { busyUntil = Math.max(busyUntil, performance.now() + ms); };
hit.addEventListener('pointerdown', () => keepBusy(1500), { passive: true });
sheetEl.addEventListener('pointerdown', () => keepBusy(1200), { passive: true });
function renderEvery(now) {
  const moving = m.dragging || carry.active || carry.back || carry.removing || pageNav.show || pageNav.anim || pageNav.drag
    || intro.active || colourSpin.active || m.airborne || Math.abs(m.spinV) > 0.03 || Math.abs(m.tiltV) > 0.03
    || helmet.visorMoving || visorCue || gazeLock || poseBlend < 1 || (state !== 'idle' && state !== 'sleepy') || stateTime < 1;
  if (moving) keepBusy(400);                                 // (and a short beat after it settles)
  if (now < busyUntil || !(IS_ANDROID || renderer.getPixelRatio() <= GOV.min + 0.01)) return 1;
  return state === 'sleepy' ? 3 : 2;
}

function frame(now) {
  if (carry.removed) return;                                 // dropped on the remove target: nothing left to draw
  now = now || performance.now();
  govern(now);
  update(Math.min(clock.getDelta(), 1 / 30));
  cadenceN = (cadenceN + 1) % 6;
  if (cadenceN % renderEvery(now) === 0) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

drawFace(faceCur, 1);
setState('idle', { quiet: true });
fitFrame();
addEventListener('resize', fitFrame);
requestAnimationFrame(frame);

// small hook for automated checks
window.orbi = { gov: GOV, tilt, restoreBot, carry, look, pageNav, get dozed() { return dozed; }, poke, goPage, view, setState, nudge, cycleColour, get theme() { return THEMES[themeIdx].name; }, helmet, toggleVisor, advance: update, faceCanvas, intro, gaze, replay: () => { setState('idle', { quiet: true }); helmet.setVisorDown(false); syncVisor(); Object.assign(intro, { active: true, t: 0, scale: 0, greeted: false, popped: false }); }, get state() { return state; }, motion: m, bodyUniforms: uniforms, bodyMat, renderer, scene, camera };
