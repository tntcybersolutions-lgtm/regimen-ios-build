#!/usr/bin/env node
/**
 * check-scripts.mjs — every inline <script> in index.html must parse.
 *
 * WHY THIS EXISTS
 *
 * I shipped "SyntaxError: Invalid or unexpected token" to the live site.
 * Four string literals in the ?fps meter contained a REAL newline instead
 * of the two characters backslash-n, and a JavaScript string cannot span
 * lines, so everything after that point in the script never ran.
 *
 * It is the same root cause as the 0x08 byte that silently killed ?lite:
 * these edits are written through Python, where a backslash-n inside a
 * string IS a newline unless it is doubled. I fixed that class of bug
 * once, in this file, and then reproduced it four more times an hour
 * later in a script I had just added.
 *
 * The app survived both times only by luck -- the broken script happened
 * to be the last one in the file, so everything before it had already
 * run. It cost the one diagnostic that could have explained the jitter,
 * twice, for the same reason.
 *
 * A 2.9MB single-file app cannot be eyeballed. Run this before pushing.
 *
 *   node tools/check-scripts.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FILE = 'theregimen-ios/www/index.html';
const src = fs.readFileSync(FILE, 'utf8');

/* a literal 0x08, 0x0b or 0x0c is never intentional in source and is
   exactly what a mishandled escape leaves behind */
const ctl = [...src.matchAll(/[\x08\x0b\x0c]/g)];
if (ctl.length) {
  for (const m of ctl) {
    console.log(`control byte 0x${src.charCodeAt(m.index).toString(16)} at line ${src.slice(0, m.index).split('\n').length}`);
  }
}

const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
/* each run parses in its own folder: two runs at once (the C3 test suites each call this) used to
   share /tmp/chkN.js and delete each other's files */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-'));
let m, n = 0, bad = 0;
while ((m = re.exec(src)) !== null) {
  n++;
  const line = src.slice(0, m.index).split('\n').length;
  const tmp = path.join(dir, `chk${n}.js`);
  fs.writeFileSync(tmp, m[1]);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } catch (e) {
    bad++;
    console.log(`\nSCRIPT AT LINE ${line} DOES NOT PARSE`);
    console.log(String(e.stderr).split('\n').slice(0, 5).join('\n'));
  } finally { fs.unlinkSync(tmp); }
}
try { fs.rmdirSync(dir); } catch (e) {}
console.log(`${n} inline scripts, ${bad} broken, ${ctl.length} stray control bytes`);
process.exit(bad || ctl.length ? 1 : 0);
