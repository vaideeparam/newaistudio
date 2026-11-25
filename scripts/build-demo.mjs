// Builds the mock-only demo as one self-contained HTML page (for a shareable preview link).
// Usage: npm run build:demo  ->  dist-demo/ai-studio-demo.html
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('vite build', { stdio: 'inherit', env: { ...process.env, VITE_STATIC_MOCK: '1' } });
const dir = 'dist-demo/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8'));
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.length}`);
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const page = `<title>ai/Studio preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>${css.join('\n')}
html, body, #root { height: 100%; }
body { background: var(--color-bg); }</style>
<div id="root"></div>
<script type="module">${safe(js[0])}</script>
`;
writeFileSync('dist-demo/ai-studio-demo.html', page);
console.log(`dist-demo/ai-studio-demo.html ${(page.length / 1024).toFixed(0)} KB`);
