/* Bundle the welcome story into www/story/: the manifest verbatim, every frame
   at its FULL native resolution as lossless WebP (pixel-identical to the PNG
   masters at roughly half the bytes — v116, Chad: "high resolution PNG quality"),
   the four 256px badges. The manifest's image paths are rewritten to the .webp
   names so the app reads one manifest and never guesses a filename. Every
   frame carries its width and height so the app can give it a box of its own
   ratio and never crop a coach; a `focus` on a frame (the subject's centre as
   fractions) rides through untouched. */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
const SRC = '../assets/story', OUT = 'www/story';
mkdirSync(join(OUT, 'scenes'), { recursive: true }); mkdirSync(join(OUT, 'badges'), { recursive: true });
const man = JSON.parse(readFileSync(join(SRC, 'STORY.json'), 'utf8'));
let inBytes = 0, outBytes = 0;
const done = new Map();   /* master path -> {dest, width, height}; a frame used on two surfaces is encoded once */
async function frame(rel, what) {
  const src = join(SRC, rel);
  if (!existsSync(src)) throw new Error('missing ' + what + ' ' + src);
  if (done.has(src)) return done.get(src);
  const dest = 'scenes/' + basename(rel).replace(/\.png$/i, '.webp');
  const meta = await sharp(src).metadata();
  const out = join(OUT, dest);
  /* lossless: the bytes of the PNG, no resize, no quality knob — the phone gets what the master has */
  const stale = !existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs || process.env.STORY_FORCE;
  if (stale) await sharp(src).webp({ lossless: true, effort: 0 }).toFile(out);   /* effort 0: the same pixels, a quarter of the encode time */
  inBytes += statSync(src).size; outBytes += statSync(out).size;
  /* a 48 px thumbnail rides in the manifest (~1 KB): the blurred ground and the frame's slot are painted the instant
     the screen shows, while the full-size file (2 MB) is still on its way */
  const th = await sharp(src).resize({ width: 48 }).webp({ quality: 60 }).toBuffer();
  const r = { dest, width: meta.width, height: meta.height, thumb: 'data:image/webp;base64,' + th.toString('base64') };
  done.set(src, r); return r;
}
for (const st of man.steps) {
  if (!st.image) continue;                                  /* v120: the door step carries no photo — the mark in the ring */
  const r = await frame(st.image, 'frame');
  st.image = r.dest; st.width = r.width; st.height = r.height; st.thumb = r.thumb;
}
for (const [coach, list] of Object.entries(man.badges || {})) {
  const pick = list.find((b) => /-256\.png$/.test(b)) || list[list.length - 1];
  const src = join(SRC, pick);
  if (!existsSync(src)) continue;
  const dest = 'badges/' + basename(pick).replace(/\.png$/i, '.webp');
  await sharp(src).webp({ lossless: true }).toFile(join(OUT, dest));
  man.badges[coach] = [dest];
}
/* the sheet frames: coach art for a sheet, outside the story order. Their size and focus go on `sheetsMeta` keyed by the bundled path. */
man.sheetsMeta = {};
for (const [coach, map] of Object.entries(man.sheets || {})) {
  for (const [key, rel] of Object.entries(map)) {
    const focus = (man.sheetsFocus && man.sheetsFocus[rel]) || null;
    const r = await frame(rel, 'sheet frame');
    map[key] = r.dest;
    man.sheetsMeta[r.dest] = { width: r.width, height: r.height, thumb: r.thumb, ...(focus ? { focus } : {}) };
  }
}
delete man.sheetsFocus;
/* v108: the screen frames — one per screen, in the One Big Thing */
for (const [screen, art] of Object.entries(man.screens || {})) {
  const r = await frame(art.image, 'screen frame');
  art.image = r.dest; art.width = r.width; art.height = r.height; art.thumb = r.thumb;
  if (art.empty && art.empty.image) { const e = await frame(art.empty.image, 'empty-state frame'); art.empty.image = e.dest; art.empty.width = e.width; art.empty.height = e.height; art.empty.thumb = e.thumb; }
  if (art.wide && art.wide.image) { const e = await frame(art.wide.image, 'wide frame'); art.wide.image = e.dest; art.wide.width = e.width; art.wide.height = e.height; art.wide.thumb = e.thumb; }
}
/* v120: the share cards' backdrops */
for (const [kind, a] of Object.entries(man.shareArt || {})) {
  const r = await frame(a.image, 'share frame');
  a.image = r.dest; a.width = r.width; a.height = r.height; a.thumb = r.thumb;
}
delete man.heroes; delete man.rings; delete man.retired; delete man.style;   /* repo-side bookkeeping; the bundle carries what the app reads */
man.bundled = { at: new Date().toISOString(), from: 'assets/story', frames: man.steps.length, screens: Object.keys(man.screens || {}).length, encoding: 'lossless webp, native size' };
writeFileSync(join(OUT, 'STORY.json'), JSON.stringify(man, null, 1));
console.log(`story bundled: ${man.steps.length} frames, ${done.size} files, ${(inBytes / 1048576).toFixed(1)} MB PNG -> ${(outBytes / 1048576).toFixed(1)} MB lossless WebP`);
