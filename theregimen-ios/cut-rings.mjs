/* The four coaches in the one neon ring (v108). The masters in
   assets/story/rings/ are the ring portraits as generated: a bright blue-cyan
   ring core with a violet halo outside it, over a background that is a baked
   checkerboard on two of them. This finds the ring core on the pixels, cuts
   the portrait at the core's outer edge (the halo is drawn by CSS, the same
   for all four, on every size), and writes the badge set and the roster card
   from the one cut. Run from theregimen-ios (sharp lives here).

     node cut-rings.mjs            -> ../assets/story/badges/*-badge-{32..1254}.png
                                     ../assets/story/scenes/*-card.png (1254) */
import sharp from 'sharp';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = '../assets/story/rings', BADGES = '../assets/story/badges', SCENES = '../assets/story/scenes';
const COACHES = ['dakota-jane', 'shaniqua', 'titan-kane', 'nova-reyes'];
const SIZES = [1254, 512, 256, 128, 64, 32];

/* the ring core: blue-cyan, read from outside in along the four axes */
const isCore = (r, g, b, a) => a > 200 && b > 200 && g > 120 && r < 150;

async function coreRadius(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const px = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  const walks = [
    () => { for (let x = 0; x < cx; x++) if (isCore(...px(x, cy))) return cx - x; },
    () => { for (let x = W - 1; x > cx; x--) if (isCore(...px(x, cy))) return x - cx; },
    () => { for (let y = 0; y < cy; y++) if (isCore(...px(cx, y))) return cy - y; },
    () => { for (let y = H - 1; y > cy; y--) if (isCore(...px(cx, y))) return y - cy; },
  ];
  const rs = walks.map(w => w()).filter(r => r);
  if (rs.length < 4) throw new Error(file + ': the ring core was not found on all four axes (' + rs.join(',') + ')');
  /* the ring's own centre, from its four edges: a portrait's ring can sit a few pixels off the frame's centre */
  const [l, rr, t, bb] = rs;
  const ccx = Math.round(cx + (rr - l) / 2), ccy = Math.round(cy + (bb - t) / 2);
  /* the generated rings are a few pixels elliptical; the cut takes the widest radius so the whole core is inside on every axis */
  const r = Math.round(Math.max((l + rr) / 2, (t + bb) / 2));
  if (Math.abs((l + rr) - (t + bb)) > 40) throw new Error(file + ': the ring is not round (' + rs.join(',') + ')');
  return { W, H, cx: ccx, cy: ccy, r, rs };
}

for (const id of COACHES) {
  const file = join(SRC, id + '-ring.png');
  if (!existsSync(file)) throw new Error('missing master ' + file);
  const g = await coreRadius(file);
  const rc = g.r + 2;                                        /* the whole core, none of the halo */
  const side = rc * 2;
  const left = g.cx - rc, top = g.cy - rc;
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><circle cx="${rc}" cy="${rc}" r="${rc - 0.5}" fill="#fff"/></svg>`);
  /* a ring drawn to the frame's edge (Shaniqua's hero) needs room: the source is padded with clear pixels before the cut */
  const PAD = 16;
  const padded = await sharp(file).ensureAlpha().extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();   /* sharp runs extract before extend in one pipeline, so the pad is its own step */
  const cut = await sharp(padded).extract({ left: left + PAD, top: top + PAD, width: side, height: side })
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  for (const s of SIZES) {
    const out = join(BADGES, `${id}-badge-${s}.png`);
    await sharp(cut).resize(s, s, { fit: 'cover', kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(out);
  }
  await sharp(cut).resize(1254, 1254, { fit: 'cover', kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(join(SCENES, `${id}-card.png`));
  console.log(`${id.padEnd(12)} core r=${g.r} (${g.rs.join('/')}) of ${g.W}  cut ${side}px  badges ${SIZES.join('/')}  card 1254  (${(statSync(join(SCENES, id + '-card.png')).size / 1024).toFixed(0)} KB)`);
}
