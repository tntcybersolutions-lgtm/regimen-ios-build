/* The legacy master is theregimen-ios/www/index.html; shared C3 screens come
   from tools/c3/src. Until 22 Sep 2026 this script read
   ../app/index.html and wrote www/index.html. That file stopped being the master
   after v130.4 while www went on to v157, so running this would have erased 27
   versions of work in one command. app/index.html is deleted; this script now
   regenerates only the current C3 block before preparing the iOS shell, and
   checks that its native integration pieces are still in place.
   The shell transforms are already baked into www permanently:
     1. <script src="native.js"> as the first script in <body>
     2. viewport-fit=cover, no zoom
     3. <style id="shell"> last in <head>
     4. three.js pointed at www/vendor/three.min.js, not the CDN  */
import { existsSync, cpSync, readFileSync } from 'node:fs';
// Both app releases regenerate the same reviewed screen sources before packaging.
import '../tools/apply-daily-release.mjs';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.1/three.min.js';
if (!existsSync('www/index.html')) throw new Error('www/index.html is missing -- that file IS the app; restore it from git');
if (!existsSync('www/vendor/three.min.js')) throw new Error('www/vendor/three.min.js missing -- fetch it from ' + CDN);

const html = readFileSync('www/index.html', 'utf8');
const checks = [
  ['native.js injected', html.includes('<script src="native.js"></script>')],
  ['viewport-fit=cover', html.includes('viewport-fit=cover')],
  ['shell stylesheet', html.includes('<style id="shell">')],
  ['three.js vendored', !html.includes(CDN) && html.includes('vendor/three.min.js')],
];
let bad = 0;
for (const [what, ok] of checks) { console.log((ok ? '  ok   ' : '  MISSING ') + what); if (!ok) bad++; }
if (bad) throw new Error(bad + ' shell piece(s) missing from www/index.html -- the iOS shell will not behave correctly');

/* The exercise database (assets/exdb: exercises.json + 873 start/finish photo
   pairs, 29 MB) ships inside the app so every movement has its photos with no
   network. Copied as-is; built by tools/build-exdb.mjs. */
if (existsSync('../assets/exdb/exercises.json')) {
  cpSync('../assets/exdb', 'www/exdb', { recursive: true });
  console.log('  ok   exdb copied into www/exdb');
} else console.log('  --   no assets/exdb - run node tools/build-exdb.mjs');

console.log('www is ready for the iOS shell with the current shared screen sources.');

