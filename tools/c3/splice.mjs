#!/usr/bin/env node
/**
 * splice.mjs: put the C3 screens into the app file.
 *
 *   node tools/c3/splice.mjs            build the block and splice it in (idempotent)
 *   node tools/c3/splice.mjs --check    build only, write nothing, exit 1 on any problem
 *   node tools/c3/splice.mjs --remove   take the block out again
 *
 * The app is one file (theregimen-ios/www/index.html). Everything C3 lives between
 *   <!-- c3:start -->  and  <!-- c3:end -->
 * directly before the LAST </body>. Running this twice gives the same bytes.
 *
 * What goes in, in this fixed order:
 *   <link id="c3fonts">     Barlow Condensed 800/900 (the app only loads 500-700)
 *   <style id="c3global">   src/c3global.css   (the few rules that must be global)
 *   <script id="c3js">      one classic script:
 *       C3_CSS = base.css + chrome.css + every other src/*.css in name order
 *                (never c3global.css); core.js injects it into the shadow root
 *       core.js, helpers.js, billing.js,    the foundation, in that order (billing.js is
 *       chrome.js                           window.BILLING: web payments and server truth)
 *       screen-*.js                         every screen file, in name order,
 *                                           each inside its own try/catch
 *       boot.js                             last
 *
 * Every source file is syntax-checked with `node --check` on its own before it
 * is allowed in, and the finished script is checked again as one piece. After a
 * splice run `node tools/check-scripts.mjs` as well (repo rule).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC = path.join(HERE, 'src');
const APP = path.join(ROOT, 'theregimen-ios', 'www', 'index.html');
const START = '<!-- c3:start -->', END = '<!-- c3:end -->';
const args = new Set(process.argv.slice(2));
const die = (m) => { console.error('splice: ' + m); process.exit(1); };

const names = fs.readdirSync(SRC).sort();
const CORE_JS = ['core.js', 'helpers.js', 'billing.js', 'chrome.js'];
const CORE_CSS = ['base.css', 'chrome.css'];
const screens = names.filter((n) => /^screen-[a-z0-9-]+\.js$/.test(n));
const cssRest = names.filter((n) => n.endsWith('.css') && n !== 'c3global.css' && !CORE_CSS.includes(n));
const unknown = names.filter((n) => !CORE_JS.includes(n) && !CORE_CSS.includes(n) && !screens.includes(n) && !cssRest.includes(n) && n !== 'boot.js' && n !== 'c3global.css');
if (unknown.length) die('files in src/ that match no rule (name screens screen-<name>.js / .css): ' + unknown.join(', '));
for (const need of [...CORE_JS, ...CORE_CSS, 'boot.js', 'c3global.css']) if (!names.includes(need)) die('missing src/' + need);

const read = (n) => fs.readFileSync(path.join(SRC, n), 'utf8').replace(/\r\n/g, '\n');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c3-'));
function check(label, code) {
  const f = path.join(tmp, label.replace(/[^a-z0-9.-]/gi, '_') + '.js');
  fs.writeFileSync(f, code);
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { die('syntax error in ' + label + '\n' + String(e.stderr || e.message).split('\n').slice(0, 8).join('\n')); }
}
function guard(label, text, isCss) {
  if (/<\/script/i.test(text)) die(label + ' contains "</script", which would end the block early');
  if (isCss && /<\/style/i.test(text)) die(label + ' contains "</style"');
  if (/<!--\s*c3:(start|end)\s*-->/.test(text)) die(label + ' contains a c3 marker');
  if (/[\x08\x0b\x0c]/.test(text)) die(label + ' contains a stray control byte');
  if (new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(text)) die(label + ' contains a long dash (house rule: none)');
}

/* ---- the shadow-root stylesheet ---- */
const cssFiles = [...CORE_CSS, ...cssRest];
let css = '';
for (const n of cssFiles) { const t = read(n); guard('src/' + n, t, true); css += '/* ---- ' + n + ' ---- */\n' + t.trim() + '\n'; }
const globalCss = read('c3global.css'); guard('src/c3global.css', globalCss, true);

/* ---- the script ---- */
let js = '/* C3: built by tools/c3/splice.mjs from tools/c3/src. Do not edit here; edit the source and splice again. */\n';
js += 'window.C3_CSS = ' + JSON.stringify(css).replace(/<\//g, '<\\/') + ';\n';
for (const n of CORE_JS) { const t = read(n); guard('src/' + n, t); check(n, t); js += '\n/* ---- ' + n + ' ---- */\n' + t.trim() + '\n'; }
for (const n of screens) {
  const t = read(n); guard('src/' + n, t); check(n, t);
  js += '\n/* ---- ' + n + ' ---- */\ntry{\n' + t.trim() + '\n}catch(e){ console.error("[c3] ' + n + ' failed to load", e); }\n';
}
{ const t = read('boot.js'); guard('src/boot.js', t); check('boot.js', t); js += '\n/* ---- boot.js ---- */\n' + t.trim() + '\n'; }
check('c3js (whole)', js);

const block = START + '\n' +
  '<link id="c3fonts" rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800;900&display=swap">\n' +
  '<style id="c3global">\n' + globalCss.trim() + '\n</style>\n' +
  '<script id="c3js">\n' + js + '</script>\n' + END + '\n';

if (args.has('--check')) { console.log('splice --check: ' + cssFiles.length + ' css, ' + (CORE_JS.length + screens.length + 1) + ' js, block ' + block.length + ' bytes, all parse'); process.exit(0); }

/* ---- into the app ---- */
let html = fs.readFileSync(APP, 'utf8');
const s = html.indexOf(START), e = html.lastIndexOf(END);
if ((s < 0) !== (e < 0)) die('only one of the two markers is in the app file; fix it by hand');
if (html.indexOf(START, s + 1) >= 0 || (e >= 0 && html.indexOf(END) !== e)) die('a marker appears twice in the app file');
if (s >= 0) {
  if (e < s) die('markers are in the wrong order');
  let tail = e + END.length; if (html[tail] === '\n') tail++;
  html = html.slice(0, s) + html.slice(tail);
}
if (args.has('--remove')) { fs.writeFileSync(APP, html); console.log('splice: block removed'); process.exit(0); }
const at = html.lastIndexOf('</body>');           /* the LAST one: an earlier match once shipped a broken file */
if (at < 0) die('no </body> in the app file');
html = html.slice(0, at) + block + html.slice(at);
fs.writeFileSync(APP, html);
console.log('splice: ' + screens.length + ' screens (' + screens.map((n) => n.slice(7, -3)).join(', ') + '), css ' + css.length + ' b, js ' + js.length + ' b -> ' + path.relative(ROOT, APP));
console.log('next: node tools/check-scripts.mjs');
