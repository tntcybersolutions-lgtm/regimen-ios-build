/* The master is theregimen-ios/www/index.html. Edit it directly.
   THIS SCRIPT NO LONGER BUILDS www FROM ANYTHING. Until 22 Sep 2026 it read
   ../app/index.html and wrote www/index.html. That file stopped being the master
   after v130.4 while www went on to v157, so running this would have erased 27
   versions of work in one command. app/index.html is deleted; this script now
   only does the two things that still have to happen for the iOS shell, and
   checks that the shell pieces it used to inject are still in place.
   The shell transforms are already baked into www permanently:
     1. <script src="native.js"> as the first script in <body>
     2. viewport-fit=cover, no zoom
     3. <style id="shell"> last in <head>
     4. three.js pointed at www/vendor/three.min.js, not the CDN  */
import { existsSync, cpSync, readFileSync } from 'node:fs';

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

console.log('www is ready for the iOS shell. The master was not touched.');
