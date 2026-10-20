# home-app — the "noon App GitFlow" Home + PLP, built standalone

Built from `noon-app-skill/` (saswata2002/noon-app-skill, fork of arnabdebnath07/noon-app-skill — `@noon/flow-kit`) at commit `0291b9d`: the Home and PLP flows, frameless, toasts off. The claw machine's five sets (`claw/catalog.js`, real noon.com products) are added to the PLP's catalogue, and `window.nkGo(route, params)` lets the page open a screen (the claw's prize → `plp/listing` with the set's query). `index.html` mounts it into `#nkHome`; `styles.css` scales its 390-wide layout to the 375 frame.

## Rebuild (when the Home/PLP change in noon-app-skill, or claw/catalog.js changes)

1. In a scratch folder: symlink `node_modules` → `noon-app-skill/node_modules`, add the `index.html`, `entry.tsx` and `vite.config.mjs` below (fix the paths).
2. `./node_modules/.bin/vite build --config vite.config.mjs`
3. Replace `home-app/assets/` with `dist/assets/`, and update the two hashed `index-*.js` / `index-*.css` names in `index.html`.

### entry.tsx
```tsx
// Standalone build of noon-app-skill's Home + PLP flows (the "noon App GitFlow" project) for noon-home-page:
// frameless, toasts off. The claw machine's five card sets (noon-home-page/claw/catalog.js) are added to the
// PLP's catalogue, and window.nkGo(route, params) lets the page open a screen (the claw → its set's PLP).
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import { NoonPrototype } from '@kit/kit/NoonPrototype';
import { homeFlow } from '@kit/flows/home';
import { plpFlow } from '@kit/flows/plp';
import { products } from '@kit/flows/plp/data';
import type { Product } from '@kit/data/types';
import { SETS } from '@page/claw/catalog.js';
import '@kit/motion/custom';

setWasmUrl(new URL('./node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', import.meta.url).href);

// the claw's sets in the PLP's catalogue: each set's category is its query, so the PLP for it shows exactly its products
for (const s of SETS) {
  s.products.forEach((p, i) => {
    const item: Product = {
      id: p.sku, sku: p.sku, brand: p.brand, title: p.title, price: p.price, was: p.was ?? undefined,
      rating: p.rating, ratingCount: p.ratingCount, emoji: s.emoji, tint: '#F2F3F7', // token-lint-ignore: catalog data
      image: p.img, images: [p.img], express: i % 3 !== 2, freeDelivery: true, seller: 'noon',
      delivery: i % 2 ? 'Get it <b>Tomorrow</b>' : 'Get it in <b>2 hrs</b>',
      category: s.query.charAt(0).toUpperCase() + s.query.slice(1), tag: p.tag ?? undefined,
    };
    products.push(item);
  });
}

const FLOWS = [homeFlow, plpFlow];
type Reset = { route: string; params?: Record<string, unknown>; nonce: number };
function App() {
  const [reset, setReset] = useState<Reset>();
  useEffect(() => {
    (window as unknown as { nkGo: (r: string, p?: Record<string, unknown>) => void }).nkGo = (route, params) =>
      setReset((r) => ({ route, params, nonce: (r?.nonce ?? 0) + 1 }));
  }, []);
  return <NoonPrototype flows={FLOWS} frame={false} toasts={false} initialRoute="home/home" resetSignal={reset} />;
}

const el = document.getElementById('nkHome');
if (el) createRoot(el).render(<App />);
```

### vite.config.mjs
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const SKILL = "/path/to/noon-app-skill";
const PAGE = "/path/to/noon-home-page";
const B = "/path/to/this/scratch/folder";
export default defineConfig({
  root: B,
  base: '/home-app/',
  plugins: [react()],
  resolve: { alias: { '@kit': SKILL + '/src', '@assets': SKILL + '/src/assets', '@page': PAGE }, dedupe: ['react', 'react-dom', 'motion'] },
  assetsInclude: ['**/*.lottie'],
  build: { outDir: B + '/dist', emptyOutDir: true, assetsInlineLimit: 0, sourcemap: false },
  server: { fs: { allow: [SKILL, B, PAGE] } },
});
```

### index.html
```html
<!doctype html><html><head><meta charset="utf-8"></head><body><div id="nkHome"></div><script type="module" src="./entry.tsx"></script></body></html>
```
