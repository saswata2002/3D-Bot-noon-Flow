# home-app — the "noon App GitFlow" Home, built standalone

Built from `noon-app-skill/` (saswata2002/noon-app-skill, fork of arnabdebnath07/noon-app-skill — `@noon/flow-kit`) at commit `3325869`: only the Home flow (`src/flows/home`) is registered, frameless, toasts off. `index.html` mounts it into `#nkHome`; `styles.css` scales its 390-wide layout to the 375 frame.

## Rebuild (when the Home changes in noon-app-skill)

1. In a scratch folder: symlink `node_modules` → `noon-app-skill/node_modules`, add the `index.html`, `entry.tsx` and `vite.config.mjs` below (fix the two paths).
2. `./node_modules/.bin/vite build --config vite.config.mjs`
3. Replace `home-app/assets/` with `dist/assets/`, and update the two hashed `index-*.js` / `index-*.css` names in `index.html`.

### entry.tsx
```tsx
// Standalone build of noon-app-skill's Home flow (the "noon App GitFlow" project) for noon-home-page:
// only the Home flow is registered, frameless, so it renders as the page's Home layer under the bot.
import { createRoot } from 'react-dom/client';
import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import { NoonPrototype } from '@kit/kit/NoonPrototype';
import { homeFlow } from '@kit/flows/home';
import '@kit/motion/custom';

setWasmUrl(new URL('./node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', import.meta.url).href);

const el = document.getElementById('nkHome');
if (el) createRoot(el).render(<NoonPrototype flows={[homeFlow]} frame={false} toasts={false} initialRoute="home/home" />);
```

### vite.config.mjs
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const SKILL = "/path/to/noon-app-skill";
const B = "/path/to/this/scratch/folder";
export default defineConfig({
  root: B,
  base: '/home-app/',
  plugins: [react()],
  resolve: { alias: { '@kit': SKILL + '/src', '@assets': SKILL + '/src/assets' }, dedupe: ['react', 'react-dom', 'motion'] },
  assetsInclude: ['**/*.lottie'],
  build: { outDir: B + '/dist', emptyOutDir: true, assetsInlineLimit: 0, sourcemap: false },
  server: { fs: { allow: [SKILL, B] } },
});
```

### index.html
```html
<!doctype html><html><head><meta charset="utf-8"></head><body><div id="nkHome"></div><script type="module" src="./entry.tsx"></script></body></html>
```
