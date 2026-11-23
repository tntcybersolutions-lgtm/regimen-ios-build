/* C3 screen: post (v331). THE STUDIO, and the live board.
   Chad: "ADD EASY WAY TO SHARE TO TIKTOK FACEBOOK AND X AS THEY WORKOUT PICS VIDEO STREAMING LIVE STREAMING AS WELL"
   and "GO BIGGER".
   A session's photos and clips (filmed from the set screen, or picked from the phone) become one picture or one
   video: the picture on top, the session's own numbers in a band UNDER it (never on a face, never on the picture),
   in the shape each app wants: 9:16 for TikTok, Reels, Stories and Shorts; 4:5 for a feed; square. Several make a
   reel (a photo holds three seconds with a slow push-in; a clip runs up to fifteen, from where they say).
   Share opens the phone's own sheet (TikTok, Instagram, Facebook and X are in it when they are on the phone); on a
   computer it saves the file and each site's upload page is one tap away.
   Live: the workout screen sends its numbers (the move, the set, the weight and reps, the rest clock, the sets done,
   the heart) to a board page, /live.html, which OBS or Streamlabs add as a browser source, or any screen shows.
   Nothing is uploaded by the app: the file is made on the phone and goes where the person sends it. Training only:
   no compound, no dose, ever (training and research never share a frame). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var DAYMS = 864e5;
  var safe = function(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } };
  var todayKey = function(){ return safe(function(){ return dkey(Date.now()); }, new Date().toISOString().slice(0, 10)); };

  /* ================= the media, kept by session (IndexedDB: a reload or a closed app keeps them) ================= */
  var P = C3.post = C3.post || {};
  P.items = P.items || []; P.key = P.key || ''; P.fmt = P.fmt || 'story';
  P.show = P.show || {name: 1, sets: 1, vol: 1, time: 1, top: 1, hr: 1};
  P.out = P.out || null; P.busy = 0; P.prog = 0; P.cap = null;
  var DBP = null;
  function db(){
    if(DBP) return DBP;
    DBP = new Promise(function(res, rej){
      try{
        var r = indexedDB.open('fl-post', 1);
        r.onupgradeneeded = function(){ var d = r.result; if(!d.objectStoreNames.contains('m')) d.createObjectStore('m', {keyPath: 'id'}); };
        r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); };
      }catch(e){ rej(e); }
    });
    DBP.catch(function(){ DBP = null; });
    return DBP;
  }
  function idb(mode, fn){
    return db().then(function(d){ return new Promise(function(res, rej){
      var t = d.transaction('m', mode), st = t.objectStore('m'), q = fn(st);
      t.oncomplete = function(){ res(q && 'result' in q ? q.result : null); }; t.onerror = function(){ rej(t.error); }; t.onabort = function(){ rej(t.error); };
    }); });
  }
  var rowOf = function(it){ return {id: it.id, key: it.key, kind: it.kind, blob: it.blob, type: it.type, at: it.at, w: it.w, h: it.h, dur: it.dur, start: it.start || 0, len: it.len || 0, n: it.n || 0, ref: it.ref || null}; };
  P.saveItem = function(it){ return idb('readwrite', function(s){ return s.put(rowOf(it)); }).catch(function(){ return null; }); };
  P.dropItem = function(id){ return idb('readwrite', function(s){ return s.delete(id); }).catch(function(){ return null; }); };
  /* every kept item of one session, oldest first; anything older than a week goes */
  P.load = function(key){
    return idb('readonly', function(s){ return s.getAll(); }).then(function(all){
      all = all || [];
      all.filter(function(r){ return Date.now() - (r.at || 0) > 7 * DAYMS; }).forEach(function(r){ P.dropItem(r.id); });
      return all.filter(function(r){ return r.key === key && Date.now() - (r.at || 0) <= 7 * DAYMS; }).sort(function(a, b){ return (a.n || a.at) - (b.n || b.at); });
    }, function(){ return []; });
  };
  P.count = function(key){ return P.load(key || todayKey()).then(function(L){ return L.length; }); };

  /* the hidden shelf the clips play from (Safari draws a video into a canvas reliably only when it is in the page) */
  function shelf(){
    var s = document.getElementById('po-shelf');
    if(!s){ s = document.createElement('div'); s.id = 'po-shelf'; s.setAttribute('aria-hidden', 'true'); s.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1'; document.body.appendChild(s); }
    return s;
  }
  /* an element to draw from, and the size and length it reads */
  function prime(it){
    if(it.el && it.ready) return Promise.resolve(it);
    if(!it.url) it.url = URL.createObjectURL(it.blob);
    return new Promise(function(res){
      var done = false, fin = function(){ if(done) return; done = true; it.ready = true; res(it); };
      if(it.kind === 'image'){
        var im = new Image(); im.decoding = 'async';
        im.onload = function(){ it.w = im.naturalWidth; it.h = im.naturalHeight; fin(); }; im.onerror = function(){ it.bad = 1; fin(); };
        im.src = it.url; it.el = im;
      }else{
        var v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous';
        shelf().appendChild(v); it.el = v;
        v.onloadedmetadata = function(){
          it.w = v.videoWidth; it.h = v.videoHeight;
          if(isFinite(v.duration) && v.duration > 0){ it.dur = v.duration; fin(); return; }
          /* a clip recorded in a browser says its length is Infinity until it has been read to the end */
          v.ontimeupdate = function(){ v.ontimeupdate = null; it.dur = isFinite(v.duration) ? v.duration : 0; try{ v.currentTime = 0; }catch(e){} fin(); };
          try{ v.currentTime = 1e7; }catch(e){ fin(); }
        };
        v.onerror = function(){ it.bad = 1; fin(); };
        v.src = it.url;
        setTimeout(fin, 6000);
      }
    });
  }
  /* ADD: a photo or a clip, to the session it was taken in */
  var SEQ = 0;
  /* extra: {ref: {id, ri, n}} when it was filmed in the workout: the set it shows */
  P.add = function(file, key, extra){
    var type = (file && file.type) || '', kind = /^video\//.test(type) ? 'video' : /^image\//.test(type) ? 'image' : (/\.(mov|mp4|webm|m4v)$/i.test(file && file.name || '') ? 'video' : /\.(jpe?g|png|heic|webp|gif)$/i.test(file && file.name || '') ? 'image' : '');
    if(!kind) return Promise.resolve(null);
    key = key || todayKey();
    var it = {id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), key: key, kind: kind, blob: file, type: type || (kind === 'video' ? 'video/mp4' : 'image/jpeg'), at: Date.now(), n: Date.now() * 1000 + (++SEQ % 1000), start: 0, len: 0};
    if(extra && extra.ref && extra.ref.id) it.ref = {id: String(extra.ref.id), ri: extra.ref.ri | 0, n: String(extra.ref.n || '')};
    return prime(it).then(function(){
      if(it.bad){ return null; }
      if(it.kind === 'video') it.len = Math.min(15, Math.floor((it.dur || 15) * 10) / 10);
      P.saveItem(it);
      if(P.key === key){ P.items.push(it); P.items.sort(function(a, b){ return a.n - b.n; }); P.stale(); }
      return it;
    });
  };
  P.stale = function(){ if(P.out){ var u = P.out.url; setTimeout(function(){ try{ URL.revokeObjectURL(u); }catch(e){} }, 4000); } P.out = null; };

  /* ================= the session's numbers ================= */
  function sumOf(key){
    var r = safe(function(){ return sessionRows().filter(function(x){ return x.key === key; })[0]; }, null); if(!r) return null;
    var L = safe(function(){ return ALL.workLog[key]; }, null) || {};
    var ms = (L.fin && L.at && L.fin > L.at && L.fin - L.at < 6 * 3600e3) ? L.fin - L.at : r.mins * 60000;
    var recs = safe(function(){ return Object.keys(ALL.prs || {}).map(function(k){ return ALL.prs[k]; }).filter(function(p){ return p && p.at && dkey(p.at) === key && p.lb > 0; }); }, []) || [];
    var hr = safe(function(){ var H = hrSpan(L.at, L.fin || (L.at + ms)); return H && H.avg > 0 ? Math.round(H.avg) : null; }, null);
    return {key: key, name: r.name || 'Session', at: r.at, sets: r.hard, vol: r.vol, ms: ms, best: r.best, recs: recs, hr: hr};
  }
  var unit = function(){ return safe(function(){ return wU(); }, 'lb'); };
  var wv = function(lb){ return safe(function(){ return wNum(lb, 0); }, Math.round(lb)); };
  var comma = function(n){ return Math.round(n).toLocaleString('en-US'); };
  function clockOf(ms){ var s = Math.round(ms / 1000), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return hh ? hh + ':' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss : mm + ':' + (ss < 10 ? '0' : '') + ss; }
  var dayWord = function(at){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}); }, ''); };
  function setWord(lb, reps){ return comma(wv(lb)) + ' ' + unit() + ' × ' + reps; }
  /* the line under the numbers: a record set today, else the heaviest set */
  function topLine(S){
    if(!S) return null;
    if(S.recs.length){ var r = S.recs.slice().sort(function(a, b){ return b.e1rm - a.e1rm; })[0]; return {k: S.recs.length > 1 ? S.recs.length + ' records' : 'Record', v: r.n + ' ' + setWord(r.lb, r.reps), rec: true}; }
    if(S.best && S.best.lb > 0) return {k: 'Top set', v: S.best.n + ' ' + setWord(S.best.lb, S.best.reps), rec: false};
    return null;
  }
  function statsOf(S, show){
    if(!S) return [];
    var out = [];
    if(show.sets && S.sets) out.push([String(S.sets), 'Sets']);
    if(show.vol && S.vol > 0) out.push([comma(wv(S.vol)), unit() + ' moved']);
    if(show.time && S.ms > 0) out.push([clockOf(S.ms), 'Time']);
    if(show.hr && S.hr) out.push([String(S.hr), 'Avg heart']);
    return out;
  }
  /* the set a clip or photo filmed in the workout shows, as logged ("Back Squat 245 lb × 5"), or null */
  function tagOf(it){
    if(!it || !it.ref) return null;
    var r = safe(function(){ return ALL.workLog[it.key].rows[it.ref.id][it.ref.ri]; }, null);
    if(!r || !r.done) return null;
    var w = r.sec !== undefined && r.sec != null ? (r.lb > 0 ? setWord(r.lb, '').replace(/ × $/, '') + ' · ' : '') + r.sec + ' s' : r.lb > 0 ? setWord(r.lb, r.reps) : (r.reps || 0) + ' reps';
    return (it.ref.n ? it.ref.n + ' ' : '') + w;
  }
  P.tagOf = tagOf;
  P.caption = function(S){
    if(!S) return 'Training with formed fit. #formedfit';
    var bits = [];
    if(S.sets) bits.push(S.sets + ' sets'); if(S.vol > 0) bits.push(comma(wv(S.vol)) + ' ' + unit() + ' moved'); if(S.ms > 0) bits.push(Math.round(S.ms / 60000) + ' min');
    var t = topLine(S);
    return S.name + ': ' + bits.join(', ') + '.' + (t ? ' ' + t.k + ': ' + t.v + '.' : '') + ' #formedfit';
  };

  /* ================= the compositor ================= */
  var FORMATS = {
    story:  {w: 1080, h: 1920, band: 560, n: '9:16', say: 'TikTok, Reels, Stories, Shorts'},
    feed:   {w: 1080, h: 1350, band: 420, n: '4:5', say: 'Instagram and Facebook feed, X'},
    square: {w: 1080, h: 1080, band: 360, n: '1:1', say: 'Square, any feed'}
  };
  P.FORMATS = FORMATS;
  var FH = '"Barlow Condensed","Arial Narrow",sans-serif', FN = 'Barlow,system-ui,sans-serif', FB = 'Barlow,system-ui,sans-serif';
  function fontsReady(){
    var want = ['800 40px "Barlow Condensed"', '700 80px Barlow', '600 28px Barlow'];
    return safe(function(){ return Promise.race([Promise.all(want.map(function(f){ return document.fonts.load(f); })), new Promise(function(r){ setTimeout(r, 1500); })]); }, Promise.resolve());
  }
  function spaced(g, px){ try{ if('letterSpacing' in g) g.letterSpacing = px + 'px'; }catch(e){} }
  /* the band: the session's numbers, drawn once per make, under the picture */
  function bandCanvas(F, S, show, tag){
    var c = document.createElement('canvas'); c.width = F.w; c.height = F.band;
    var g = c.getContext('2d'), s = F.band / 560, pad = 64, W = F.w;
    var gr = g.createLinearGradient(0, 0, 0, F.band); gr.addColorStop(0, '#1F2023'); gr.addColorStop(1, '#141517');
    g.fillStyle = gr; g.fillRect(0, 0, W, F.band);
    g.fillStyle = '#5CF2B0'; g.fillRect(0, 0, W, Math.max(4, Math.round(6 * s)));
    g.textBaseline = 'alphabetic';
    /* the eyebrow: the session and the day */
    var eye = ((show.name && S ? S.name + '  ·  ' : '') + dayWord(S ? S.at : Date.now()));
    g.fillStyle = '#5CF2B0'; g.font = '800 ' + Math.round(42 * s) + 'px ' + FH; spaced(g, 0);
    g.fillText(eye, pad, Math.round(96 * s), W - pad * 2);
    /* the numbers */
    var st = statsOf(S, show), y = Math.round(236 * s);
    if(st.length){
      /* the columns set edge to edge: the first on the left margin, the last on the right, the space shared */
      var avail = W - pad * 2, lf = '700 ' + Math.round(30 * s) + 'px ' + FH, vf = Math.round(100 * s), widths;
      var measure = function(){ return st.map(function(x){ g.font = '800 ' + vf + 'px ' + FN; spaced(g, 0); var a = g.measureText(x[0]).width; g.font = lf; spaced(g, 0); return Math.max(a, g.measureText(x[1]).width); }); };
      var sum = function(a){ return a.reduce(function(t, v){ return t + v; }, 0); };
      widths = measure();
      while(sum(widths) + 48 * s * (st.length - 1) > avail && vf > 40){ vf -= 4; widths = measure(); }
      var gap = st.length > 1 ? (avail - sum(widths)) / (st.length - 1) : 0, cx = pad;
      st.forEach(function(x, i){
        g.fillStyle = '#FFFFFF'; g.font = '800 ' + vf + 'px ' + FN; spaced(g, 0);
        g.fillText(x[0], cx, y);
        g.fillStyle = 'rgba(255,255,255,.74)'; g.font = lf; spaced(g, 0);
        g.fillText(x[1], cx, y + Math.round(46 * s));
        cx += widths[i] + gap;
      });
    }
    /* the set this clip shows, else a record, else the top set */
    var t = tag ? {k: 'This set', v: tag, rec: false} : show.top ? topLine(S) : null;
    if(t && F.band >= 400){
      var ty = Math.round(390 * s);
      g.fillStyle = t.rec ? '#FF4FCB' : '#5CF2B0'; g.beginPath(); g.arc(pad + 10 * s, ty - 13 * s, 10 * s, 0, Math.PI * 2); g.fill();
      g.font = '800 ' + Math.round(36 * s) + 'px ' + FH; spaced(g, 0);
      var kw = t.k; g.fillText(kw, pad + 32 * s, ty);
      var kx = pad + 32 * s + g.measureText(kw).width + 18 * s;
      g.fillStyle = '#FFFFFF'; g.font = '700 ' + Math.round(38 * s) + 'px ' + FB; spaced(g, 0);
      g.fillText(t.v, kx, ty, W - pad - kx);
    }
    /* the mark */
    var fy = F.band - Math.round(46 * s);
    g.fillStyle = '#FFFFFF'; g.font = '800 ' + Math.round(40 * s) + 'px ' + FH; spaced(g, 2 * s); g.fillText('formed fit', pad, fy);
    g.fillStyle = 'rgba(255,255,255,.74)'; g.font = '600 ' + Math.round(28 * s) + 'px ' + FB; spaced(g, 0); g.textAlign = 'right'; g.fillText('app.formedlabs.co', W - pad, fy); g.textAlign = 'left';
    return c;
  }
  P.band = bandCanvas;
  /* one frame: the picture cropped to fill the space above the band (a little more is kept from the top, where
     heads are), a slow push-in on a photo in a reel, a short fade in at each cut */
  function frame(g, F, it, p, t, band){
    var W = F.w, H = F.h - F.band;
    g.fillStyle = '#0D0E0F'; g.fillRect(0, 0, W, H);
    var el = it && it.el, sw = it ? (it.kind === 'video' ? el.videoWidth : el.naturalWidth) : 0, sh = it ? (it.kind === 'video' ? el.videoHeight : el.naturalHeight) : 0;
    if(sw && sh){
      var z = it.kind === 'image' && p != null ? 1 + 0.06 * p : 1, sc = Math.max(W / sw, H / sh) * z, dw = sw * sc, dh = sh * sc;
      g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip();
      try{ g.drawImage(el, (W - dw) / 2, (H - dh) * 0.4, dw, dh); }catch(e){}
      g.restore();
    }
    if(t != null && t < 0.25){ g.fillStyle = 'rgba(2,10,40,' + (1 - t / 0.25).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    g.drawImage(band, 0, H);
  }
  P.frame = frame;
  /* what the reel runs: each item and how long */
  P.plan = function(items){
    var out = [], tot = 0;
    (items || P.items).forEach(function(it){
      if(it.bad || tot >= 60) return;
      var d = it.kind === 'image' ? 3 : Math.max(1, Math.floor(Math.min(15, it.len || it.dur || 15, (it.dur || 15) - (it.start || 0)) * 10) / 10);
      d = Math.min(d, 60 - tot); out.push({it: it, d: d}); tot += d;
    });
    return {segs: out, secs: tot};
  };
  function mimeFor(){
    if(typeof MediaRecorder === 'undefined') return '';
    var L = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for(var i = 0; i < L.length; i++){ if(safe(function(){ return MediaRecorder.isTypeSupported(L[i]); }, false)) return L[i]; }
    return '';
  }
  P.mime = mimeFor;
  /* the sound of the clips, mixed into the video (one context; each clip wired once) */
  function audioBus(){
    if(P.ac === false) return null;
    if(!P.ac){ try{ var AC = window.AudioContext || window.webkitAudioContext; P.ac = new AC(); P.dest = P.ac.createMediaStreamDestination(); }catch(e){ P.ac = false; return null; } }
    return P.ac;
  }
  var stopNow = null;
  P.cancel = function(){ if(stopNow) stopNow(true); };
  /* MAKE. A single photo makes a picture (JPEG). A clip, or more than one item, makes a video in real time
     (MediaRecorder on the canvas, the clips' sound with it): MP4 where the device can (iPhone, Chrome), else WebM.
     Called from the tap itself, so the clips may play with sound. */
  P.make = function(onProg){
    if(P.busy) return Promise.resolve(null);
    var F = FORMATS[P.fmt] || FORMATS.story, items = P.items.filter(function(it){ return !it.bad; });
    var S = sumOf(P.key), show = P.show;
    var still = items.length <= 1 && !(items[0] && items[0].kind === 'video');
    var mime = still ? '' : mimeFor();
    var cv = document.createElement('canvas'); cv.width = F.w; cv.height = F.h; var g = cv.getContext('2d');
    if(!still && (!mime || !cv.captureStream)) return Promise.resolve({err: 'This browser cannot make a video. A single photo still makes a picture.'});
    P.busy = 1; P.prog = 0; P.stale();
    /* inside the tap: let every clip play, and wake the sound */
    var ac = still ? null : audioBus();
    if(ac){ try{ ac.resume(); }catch(e){} }
    items.forEach(function(it){ if(it.kind === 'video' && it.el){ try{ it.el.muted = false; var pr = it.el.play(); if(pr && pr.then) pr.then(function(){ it.el.pause(); }, function(){}); else it.el.pause(); }catch(e){} } });
    return Promise.all(items.map(prime)).then(fontsReady).then(function(){
      var bands = {}, bandFor = function(it){ var t = tagOf(it) || ''; if(!bands[t]) bands[t] = bandCanvas(F, S, show, t || null); return bands[t]; };
      var band = bandFor(null);
      if(still){
        frame(g, F, items[0] || null, null, null, items[0] ? bandFor(items[0]) : band);
        return new Promise(function(res){ cv.toBlob(function(b){ P.busy = 0; P.prog = 1; res(b ? setOut(b, 'image/jpeg', F, 0) : {err: 'The picture could not be made here.'}); }, 'image/jpeg', 0.92); });
      }
      var plan = P.plan(items), segs = plan.segs;
      if(!segs.length){ P.busy = 0; return {err: 'Nothing to make yet.'}; }
      var stream = cv.captureStream(30);
      if(ac && P.dest){
        items.forEach(function(it){ if(it.kind === 'video' && it.el && !it.el.__src){ try{ it.el.__src = ac.createMediaElementSource(it.el); it.el.__src.connect(P.dest); }catch(e){} } });
        safe(function(){ P.dest.stream.getAudioTracks().forEach(function(tr){ stream.addTrack(tr); }); });
      }
      var rec; try{ rec = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 8000000}); }catch(e){ try{ rec = new MediaRecorder(stream); }catch(e2){ P.busy = 0; return {err: 'This browser cannot make a video.'}; } }
      var chunks = [];
      rec.ondataavailable = function(e){ if(e.data && e.data.size) chunks.push(e.data); };
      return new Promise(function(res){
        var i = -1, t0 = 0, before = 0, live = true, iv = 0, waitT = 0, tail = 0;
        var cur = function(){ return segs[i]; };
        function startSeg(k){
          if(i >= 0 && segs[i].it.kind === 'video') safe(function(){ segs[i].it.el.pause(); });
          if(i >= 0) before += segs[i].d;
          i = k; t0 = 0;
          var s = segs[i];
          if(s.it.kind === 'video'){
            var v = s.it.el; s.go = false;
            var go = function(){ if(!s.go){ s.go = true; t0 = performance.now(); } };
            v.onplaying = go; clearTimeout(waitT); waitT = setTimeout(go, 1500);
            safe(function(){ v.currentTime = s.it.start || 0; });
            safe(function(){ var pr = v.play(); if(pr && pr.catch) pr.catch(function(){ v.muted = true; v.play().catch(function(){}); }); });
          }else{ s.go = true; t0 = performance.now(); }
        }
        function tick(){
          if(!live) return;
          var s = cur(); if(!s) return;
          if(!s.go){ return; }                                         /* a clip still finding its first frame: hold the last */
          var t = (performance.now() - t0) / 1000;
          if(t >= s.d){
            if(i + 1 < segs.length){ startSeg(i + 1); return; }
            /* the end: hold the last frame a moment so the encoder writes it, then stop */
            if(!tail) tail = performance.now();
            frame(g, F, s.it, 1, null, bandFor(s.it));
            if(performance.now() - tail > 500) finish(false);
            return;
          }
          frame(g, F, s.it, t / s.d, i > 0 ? t : null, bandFor(s.it));   /* a fade in at each cut, not at the start; the band names the set a clip shows */
          P.prog = Math.min(1, (before + t) / plan.secs); if(onProg) onProg(P.prog);
        }
        function finish(cancel){
          if(!live) return; live = false; clearInterval(iv); clearTimeout(waitT); stopNow = null;
          segs.forEach(function(x){ if(x.it.kind === 'video') safe(function(){ x.it.el.pause(); x.it.el.muted = true; }); });
          rec.onstop = function(){
            P.busy = 0;
            if(cancel){ res({err: 'Stopped.'}); return; }
            var type = (rec.mimeType || mime).split(';')[0] || 'video/webm';
            var b = new Blob(chunks, {type: type});
            P.prog = 1; res(b.size ? setOut(b, type, F, plan.secs) : {err: 'The video came out empty.'});
          };
          try{ rec.stop(); }catch(e){ P.busy = 0; res({err: 'The video could not be finished.'}); }
          safe(function(){ stream.getVideoTracks().forEach(function(tr){ tr.stop(); }); });
        }
        stopNow = finish;
        frame(g, F, segs[0].it, 0, null, bandFor(segs[0].it));
        rec.start(250);
        startSeg(0);
        iv = setInterval(tick, 1000 / 30);
      });
    }).catch(function(e){ P.busy = 0; console.error('[c3] post make', e); return {err: 'That could not be made here.'}; });
  };
  function setOut(blob, type, F, secs){
    var ext = /mp4/.test(type) ? 'mp4' : /webm/.test(type) ? 'webm' : /png/.test(type) ? 'png' : 'jpg';
    P.out = {blob: blob, url: URL.createObjectURL(blob), type: type, ext: ext, w: F.w, h: F.h, secs: secs, video: /^video/.test(type), at: Date.now(), fmt: P.fmt, key: P.key};
    return P.out;
  }
  P.fileName = function(){ var O = P.out; return 'formed-fit-' + (O && O.key || todayKey()) + '-' + (O && O.fmt || P.fmt) + '.' + (O ? O.ext : 'jpg'); };

  /* ================= the live board =================
     Kept on this device: whether it is on, its key (the link), and a clear background. The workout screen calls
     C3.live.state(...) as it changes; send() goes out when what the board would show changes, or every 15 s. */
  var L = C3.live = C3.live || {};
  var LK = 'theregimen.live';
  function lread(){ try{ return JSON.parse(localStorage.getItem(LK) || '{}') || {}; }catch(e){ return {}; } }
  function lwrite(o){ try{ localStorage.setItem(LK, JSON.stringify(o)); }catch(e){} }
  function newKey(){ var a = new Uint8Array(12); crypto.getRandomValues(a); return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  var api = function(){ return /^https?:$/.test(location.protocol) ? '' : 'https://app.formedlabs.co'; };
  L.on = function(){ return !!lread().on; };
  L.clear = function(){ return !!lread().clear; };
  L.key = function(){ var o = lread(); if(!o.k){ o.k = newKey(); lwrite(o); } return o.k; };
  L.url = function(){ return 'https://app.formedlabs.co/live.html?k=' + L.key() + (L.clear() ? '&clear=1' : ''); };
  L.set = function(on){ var o = lread(); o.on = !!on; if(!o.k) o.k = newKey(); lwrite(o); L.raw = ''; return L.send(on ? (L.last || {mode: 'idle'}) : {mode: 'off'}, true); };
  L.setClear = function(on){ var o = lread(); o.clear = !!on; lwrite(o); };
  L.rotate = function(){ var o = lread(); o.k = newKey(); lwrite(o); L.raw = ''; return o.on ? L.send(L.last || {mode: 'idle'}, true) : Promise.resolve(false); };
  L.status = 0;
  L.send = function(s, force){
    if(!s || (!force && !L.on())) return Promise.resolve(false);
    L.last = s;
    var raw = JSON.stringify(Object.assign({}, s, {el: 0, left: 0, hr: 0})), now = Date.now();
    if(!force && raw === L.raw && now - (L.at || 0) < 15000) return Promise.resolve(false);
    L.raw = raw; L.at = now;
    var tok = safe(function(){ return (typeof CLOUD !== 'undefined' && CLOUD && CLOUD.signedIn && CLOUD.signedIn()) ? CLOUD.token() : null; }, null);
    return Promise.resolve(tok).then(function(t){
      if(!t){ L.status = 401; return false; }
      return fetch(api() + '/api/live', {method: 'POST', headers: {authorization: 'Bearer ' + t, 'content-type': 'application/json'}, body: JSON.stringify({k: L.key(), s: s}), cache: 'no-store', credentials: 'omit'})
        .then(function(r){ L.status = r.status; L.sent = r.ok ? Date.now() : L.sent; if(C3.current === 'post') safe(function(){ C3.refresh(); }); return r.ok; }, function(){ L.status = 0; return false; });
    }, function(){ return false; });
  };
  /* what the board reads back (the Post screen shows whether the link is answering) */
  L.check = function(){
    return fetch(api() + '/api/live?k=' + encodeURIComponent(L.key()), {cache: 'no-store', credentials: 'omit'}).then(function(r){ return r.json().catch(function(){ return null; }).then(function(j){ return {status: r.status, j: j}; }); }, function(){ return {status: 0}; });
  };

  /* ================= the screen ================= */
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc;
    /* v345: each with its network's own logo (h.brand) */
    var NETS = [
      ['TikTok', 'https://www.tiktok.com/upload', 'tiktok'],
      ['Instagram', 'https://www.instagram.com/', 'instagram'],
      ['Facebook', 'https://www.facebook.com/', 'facebook'],
      ['X', 'https://x.com/compose/post', 'x'],
      ['YouTube', 'https://www.youtube.com/upload', 'youtube']
    ];
    var KEYS = [
      ['TikTok LIVE', 'https://livecenter.tiktok.com/producer', 'tiktok'],
      ['YouTube Studio', 'https://studio.youtube.com/', 'youtube'],
      ['Facebook Live Producer', 'https://www.facebook.com/help/www/587160588142067', 'facebook'],
      ['X Media Studio', 'https://help.x.com/en/using-x/how-to-use-live-producer', 'x']
    ];
    var phoneShare = function(){ return safe(function(){ return !!(navigator.share && navigator.canShare && navigator.canShare({files: [new File([new Blob(['x'], {type: 'image/jpeg'})], 'x.jpg', {type: 'image/jpeg'})]})); }, false); };
    function download(){
      var O = P.out; if(!O) return;
      var a = document.createElement('a'); a.href = O.url; a.download = P.fileName(); a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
      yd.toast('Saved as <b>' + esc(P.fileName()) + '</b>.');
    }
    function share(){
      var O = P.out; if(!O) return;
      var file = safe(function(){ return new File([O.blob], P.fileName(), {type: O.type}); }, null);
      if(file && navigator.share && safe(function(){ return navigator.canShare({files: [file]}); }, false)){
        Promise.resolve(navigator.share({files: [file]})).then(function(){}, function(e){ if(!e || e.name !== 'AbortError') download(); });
        return;
      }
      download();
    }
    function copy(t, ok){ try{ navigator.clipboard.writeText(t).then(function(){ yd.toast(ok); }, function(){ yd.toast('Copy is not available here.', 'bad'); }); }catch(e){ yd.toast('Copy is not available here.', 'bad'); } }
    /* the session: the one asked for, else today's if it has sets, else the newest */
    function pickSession(ctx, fresh){
      var p = ctx.params || {}, rows = safe(function(){ return sessionRows(); }, []) || [];
      var want = (fresh ? '' : ctx.state.key) || p.key || '';
      if(!want){ var t = todayKey(); want = rows.some(function(r){ return r.key === t; }) ? t : (rows[0] ? rows[0].key : t); }
      return {key: want, rows: rows.slice(0, 8)};
    }
    function loadFor(key){
      if(P.key === key && (P.loaded || P.loading)) return;
      P.loading = true;
      P.items.forEach(function(it){ if(it.url) safe(function(){ URL.revokeObjectURL(it.url); }); if(it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el); });
      P.key = key; P.items = []; P.loaded = false; P.stale();
      P.load(key).then(function(list){
        if(P.key !== key) return;
        P.items = list.map(function(r){ return Object.assign({}, r); });
        return Promise.all(P.items.map(prime));
      }).then(function(){ if(P.key !== key) return; P.loaded = true; P.loading = false; if(C3.current === 'post') C3.render(); }, function(){ P.loading = false; P.loaded = true; });
    }

    /* how much of a clip runs: 5, 10 or 15 seconds where the clip is longer, or all of it */
    function lenSeg(it, i){
      var full = Math.min(15, Math.floor(it.dur * 10) / 10), opts = [5, 10, 15].filter(function(x){ return x < full; }).map(function(x){ return [x, x + ' s']; });
      if(!opts.length) return '';
      opts.push([full, it.dur > 15 ? '15 s' : 'All ' + Math.round(full) + ' s']);
      var cur = opts.filter(function(o){ return Math.abs(o[0] - (it.len || full)) < 0.05; })[0];
      return yd.seg('plen', opts.map(function(o){ return [it.id + '|' + o[0], o[1]]; }), it.id + '|' + (cur ? cur[0] : full), {aria: 'Clip ' + (i + 1) + ' length', cls: 'po-len'});
    }
    function thumb(it, i, n){
      var dur = (it.kind === 'video' ? (it.dur ? Math.round(it.dur) + ' s' : 'Clip') : 'Photo') + (tagOf(it) ? ' · ' + tagOf(it) : '');
      return '<li class="po-it" data-id="' + esc(it.id) + '">' +
        '<span class="po-th">' + (it.kind === 'image' ? '<img src="' + esc(it.url) + '" alt="Photo ' + (i + 1) + '">' : '<video src="' + esc(it.url) + '#t=' + (it.start || 0.1) + '" muted playsinline preload="metadata" aria-label="Clip ' + (i + 1) + '"></video>') + '<b class="c3-num">' + (i + 1) + '</b></span>' +
        '<span class="po-im"><span class="c3-num">' + esc(dur) + '</span>' +
          (it.kind === 'video' && it.dur > 2 ? '<label class="po-trim"><span>From <b class="c3-num">' + (Math.round((it.start || 0) * 10) / 10) + ' s</b></span><input type="range" min="0" max="' + Math.max(0, Math.floor((it.dur - 1) * 2) / 2) + '" step="0.5" value="' + (it.start || 0) + '" data-chg="pfrom" data-v="' + esc(it.id) + '" data-key="from-' + esc(it.id) + '" aria-label="Clip ' + (i + 1) + ' starts at"></label>' +
            lenSeg(it, i) : '') +
        '</span>' +
        '<span class="po-ia">' + (i > 0 ? yd.btn('pup', 'Earlier', {v: it.id, icon: 'up', aria: 'Move item ' + (i + 1) + ' earlier'}) : '') + yd.btn('pdel', 'Remove', {v: it.id, icon: 'x', pink: true, aria: 'Remove item ' + (i + 1)}) + '</span></li>';
    }

    yd.screen('post', {
      parent: 'today', nav: 'today',
      fall: function(){ C3.go('share'); },
      enter: function(ctx){ var S0 = pickSession(ctx, true); ctx.state.key = S0.key; P.cap = null; loadFor(S0.key); },
      render: function(ctx){
        var st = ctx.state, pk = pickSession(ctx); if(st.key !== pk.key){ st.key = pk.key; } loadFor(pk.key);
        var S = sumOf(pk.key), F = FORMATS[P.fmt] || FORMATS.story, items = P.items, plan = P.plan(), O = P.out;
        var hasVid = items.some(function(it){ return it.kind === 'video'; }), willVideo = hasVid || items.length > 1, canVid = !!mimeFor();
        /* the picture: what was made, else the first frame of what will be */
        var pic = '<section class="po-pic ' + esc(P.fmt) + '" aria-label="Your post">' +
          (O ? (O.video ? '<video class="po-out" src="' + esc(O.url) + '" controls playsinline loop width="' + O.w + '" height="' + O.h + '" style="aspect-ratio:' + O.w + ' / ' + O.h + '" aria-label="Your video, ' + Math.round(O.secs) + ' seconds"></video>'
                        : '<img class="po-out" src="' + esc(O.url) + '" width="' + O.w + '" height="' + O.h + '" style="aspect-ratio:' + O.w + ' / ' + O.h + '" alt="' + esc('Your picture with the session under it. ' + P.caption(S)) + '">')
             : '<canvas class="po-out po-prev" width="' + F.w + '" height="' + F.h + '" style="aspect-ratio:' + F.w + ' / ' + F.h + '" role="img" aria-label="' + esc('Preview: ' + (items.length ? items.length + (items.length === 1 ? ' item' : ' items') : 'no picture yet') + ', the session under it') + '"></canvas>') +
          (P.busy ? '<div class="po-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(P.prog * 100) + '"><i style="width:' + Math.round(P.prog * 100) + '%"></i></div>' : '') +
        '</section>';
        var add = '<div class="po-add">' +
          '<label class="c3-btn-quiet yd-btn po-file" data-key="add-cam">' + yd.icon('plus', 17, 2.2) + '<span>Take a photo</span><input type="file" accept="image/*" capture="environment" data-chg="padd" data-key="in-cam"></label>' +
          '<label class="c3-btn-quiet yd-btn po-file" data-key="add-film">' + yd.icon('plus', 17, 2.2) + '<span>Film a clip</span><input type="file" accept="video/*" capture="environment" data-chg="padd" data-key="in-film"></label>' +
          '<label class="c3-btn-quiet yd-btn po-file" data-key="add-pick">' + yd.icon('plus', 17, 2.2) + '<span>From your photos</span><input type="file" accept="image/*,video/*" multiple data-chg="padd" data-key="in-pick"></label></div>';
        var make = P.busy ? '<section class="sh-act">' + yd.primary('pstop', 'Making it', '<span class="c3-num">' + Math.round(P.prog * 100) + '%</span><span>Keep this screen open</span>', {icon: 'x'}) + '</section>'
          : O ? '<section class="sh-act" aria-label="Share">' + yd.primary('pshare', 'Share', '<span>' + esc(F.n) + '</span><span class="c3-num">' + (O.video ? Math.round(O.secs) + ' s video' : 'picture') + '</span>', {icon: 'arrow'}) +
              '<div class="yd-acts">' + yd.btn('psave', O.video ? 'Save video' : 'Save picture', {icon: 'down'}) + yd.btn('pcopy', 'Copy caption', {icon: 'copy'}) + yd.btn('pagain', 'Change it', {icon: 'refresh'}) + '</div></section>'
          /* nothing yet: THE control is the camera itself (a photo or a clip), not a Make that cannot make anything */
          : !items.length ? '<section class="sh-act"><label class="c3-btn-primary yd-primary po-file" data-key="primary"><span>Shoot it</span><span class="r"><small><span>photo</span><span>or clip</span></small>' + yd.icon('plus', 34, 3) + '</span>' +
              '<input type="file" accept="image/*,video/*" capture="environment" data-chg="padd" data-key="in-shoot" aria-label="Take a photo or film a clip"></label></section>'
          : '<section class="sh-act">' + yd.primary('pmake', 'Make it', '<span>' + esc(F.n) + '</span><span class="c3-num">' + (willVideo ? Math.round(plan.secs) + ' s video' : 'picture') + '</span>', {icon: 'arrow', disabled: willVideo && !canVid}) +
              (willVideo && !canVid ? yd.note('This browser cannot make a video. One photo still makes a picture.', 'bad') : '') + '</section>';
        var list = items.length ? '<ol class="po-list">' + items.map(function(it, i){ return thumb(it, i, items.length); }).join('') + '</ol>' +
            yd.note(willVideo ? 'A reel: ' + items.length + (items.length === 1 ? ' clip' : ' items') + ', ' + Math.round(plan.secs) + ' seconds' + (plan.secs >= 60 ? ' (the most it makes)' : '') + '. Photos hold 3 seconds.' : 'One photo makes a picture. Add a clip or another photo and it makes a video.')
          : yd.empty('Film from the set screen while you train, or add photos and clips here. Your numbers go under them, never on them.');
        var sess = pk.rows.length > 1 ? yd.seg('psess', pk.rows.map(function(r){ return [r.key, r.name + ' · ' + yd.day(r.at)]; }), pk.key, {aria: 'Which session', cls: 'wrap2 po-sess'}) : '';
        var shape = yd.seg('pfmt', Object.keys(FORMATS).map(function(k){ return [k, FORMATS[k].n, FORMATS[k].say]; }), P.fmt, {aria: 'Shape'}) + yd.note(esc(F.say) + '.');
        var under = '<div class="yd-list">' + [['name', 'The session’s name'], ['sets', 'Sets'], ['vol', 'Weight moved'], ['time', 'Time'], ['top', 'Record or top set'], ['hr', 'Average heart']].filter(function(x){ return x[0] !== 'hr' || (S && S.hr); }).map(function(x){ return yd.sw('pshow', !!P.show[x[0]], x[1], '', {v: x[0]}); }).join('') + '</div>';
        var cap = P.cap != null ? P.cap : P.caption(S);
        var capSec = yd.input('pcap', cap, 'Caption', {max: 300}) + yd.note('Copied with Copy caption, to paste in the post.');
        var where = phoneShare() ? yd.note('Share opens your phone’s own sheet: TikTok, Instagram, Facebook and X are in it when they are on this phone.')
          : '<div class="po-nets">' + NETS.map(function(n){ return '<a class="c3-btn-quiet yd-btn po-net" href="' + esc(n[1]) + '" target="_blank" rel="noopener" data-key="net-' + esc(n[0]) + '">' + h.brand(n[2], 28) + '<span>' + esc(n[0]) + '</span></a>'; }).join('') + '</div>' + yd.note('Save the file, then post it on the site.');
        /* live */
        var signed = yd.signedIn(), on = L.on();
        var liveBody = !signed ? yd.empty('Sign in and the workout puts its numbers on a live board for your stream.') + '<div class="yd-acts">' + '<button type="button" class="c3-btn-rail" data-act="psignin" data-key="btn-psignin"><span>Sign in</span>' + h.icon('arrow', 24, 2.8) + '</button>' + '</div>'
          : '<div class="yd-list">' + yd.sw('plive', on, 'Live board', on ? 'On. The workout sends each set as you log it.' : 'The move, the set, the weight and reps, the rest clock and your heart, on a page your stream shows.') +
            (on ? yd.sw('pclear', L.clear(), 'Clear background', 'For laying it over your camera in OBS or Streamlabs.') : '') + '</div>' +
            (on ? '<p class="sh-url c3-num" data-key="live-url">' + esc(L.url()) + '</p>' +
              '<div class="yd-acts">' + yd.btn('plcopy', 'Copy link', {icon: 'copy'}) + '<a class="c3-btn-quiet yd-btn" href="' + esc(L.url()) + '" target="_blank" rel="noopener" data-key="live-open">' + yd.icon('link', 17, 2.2) + '<span>Open the board</span></a>' + yd.arm(ctx, 'plnew', 'New link', 'Tap again: the old link stops') + '</div>' +
              yd.stats([[L.sent ? h.clock(L.sent) : '·', L.sent ? 'last sent' : 'nothing sent yet', L.sent ? 'good' : ''], [!L.status ? 'Waiting' : L.status < 300 ? 'Live' : L.status === 401 ? 'Sign in' : String(L.status), 'the board', !L.status ? '' : L.status < 300 ? 'good' : 'bad']], 'po-lstat') +
              yd.note('In OBS or Streamlabs: add a Browser source with this link, 1080 × 1920 for a phone-shaped stream or 1920 × 1080 for a wide one. Or open it on any screen in the gym.') +
              '<div class="po-keys">' + KEYS.map(function(n){ return '<a class="c3-btn-quiet yd-btn po-net" href="' + esc(n[1]) + '" target="_blank" rel="noopener" data-key="key-' + esc(n[0]) + '">' + h.brand(n[2], 28) + '<span>' + esc(n[0]) + '</span></a>'; }).join('') + '</div>' +
              yd.note('Where each one gives you the stream key your streaming app needs.') : '');
        /* v345: Go live (Today, Train, You) opens with the live board first; Post it opens with the picture */
        var liveFirst = !!(ctx.params && ctx.params.live);
        var liveSec = yd.sec(liveFirst ? 'Live board' : 'Live', liveBody, {id: 'live', cls: liveFirst ? 'po-live1' : ''});
        return '<div class="yd sh po' + (liveFirst ? ' live1' : '') + '" data-fmt="' + esc(P.fmt) + '">' + yd.head({back: 'today', eyebrow: S ? S.name + ' · ' + yd.day(S.at) : 'Your training', title: liveFirst ? 'Go' : 'Post', pk: liveFirst ? 'live' : 'it'}) +
          (liveFirst ? liveSec + '<h2 class="yd-lbl po-then"><span>Post it</span></h2>' : '') +
          '<div class="yd-cols even sh-cols"><div class="yd-col sh-a">' + pic + make + (O ? capSec + where : '') + '</div>' +
          '<div class="yd-col sh-b">' + yd.sec('Pictures and clips', add + list, {id: 'items', n: items.length ? String(items.length) : null}) +
            (sess ? yd.sec('Session', sess, {id: 'sess'}) : '') + yd.sec('Shape', shape, {id: 'fmt'}) + yd.sec('Under the picture', under, {id: 'under'}) +
            (liveFirst ? '' : liveSec) +
            yd.note('Made on this phone. Nothing is uploaded until you share it, and only where you send it.') + '</div></div></div>';
      },
      wire: function(root, ctx){
        /* the preview: the first frame, drawn live */
        var pv = root.querySelector('.po-prev');
        if(pv){
          var F = FORMATS[P.fmt] || FORMATS.story, S = sumOf(ctx.state.key), first = P.items.filter(function(it){ return !it.bad; })[0] || null;
          fontsReady().then(function(){ return first ? prime(first) : null; }).then(function(){ if(!pv.isConnected) return; var g = pv.getContext('2d'); frame(g, F, first, null, null, bandCanvas(F, S, P.show, tagOf(first))); });
        }
        var ov = root.querySelector('video.po-out'); if(ov) ov.addEventListener('loadedmetadata', function(){ try{ if(ov.currentTime < 0.4) ov.currentTime = 0.4; }catch(e){} }, {once: true});
        var re = function(){ P.stale(); C3.render(); };
        var byId = function(id){ return P.items.filter(function(x){ return x.id === id; })[0]; };
        yd.wire(root, ctx, {
          pmake: function(){
            var bar = function(p){ var b = C3.root && C3.root.querySelector('.po-prog i'); if(b) b.style.width = Math.round(p * 100) + '%'; var n = C3.root && C3.root.querySelector('[data-key="primary"] .c3-num'); if(n) n.textContent = Math.round(p * 100) + '%'; };
            var pr = P.make(bar); C3.render();
            pr.then(function(r){ if(r && r.err) yd.toast(esc(r.err), 'bad'); C3.render(); });
          },
          pstop: function(){ P.cancel(); },
          pshare: function(){ share(); },
          psave: function(){ download(); },
          pcopy: function(){ copy(P.cap != null ? P.cap : P.caption(sumOf(ctx.state.key)), 'Caption copied.'); },
          pagain: function(){ re(); },
          pfmt: function(v){ if(P.fmt === v) return; P.fmt = v; re(); },
          pshow: function(v){ P.show[v] = !P.show[v]; re(); },
          psess: function(v){ ctx.state.key = v; P.cap = null; re(); },
          pup: function(id){ var i = P.items.indexOf(byId(id)); if(i > 0){ var x = P.items[i]; P.items[i] = P.items[i - 1]; P.items[i - 1] = x; P.items.forEach(function(it, k){ it.n = k + 1; P.saveItem(it); }); re(); } },
          pdel: function(id){ var it = byId(id); if(!it) return; P.items = P.items.filter(function(x){ return x !== it; }); P.dropItem(id); if(it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el); re(); },
          plen: function(v){ var a = String(v).split('|'), it = byId(a[0]); if(it){ it.len = +a[1]; P.saveItem(it); re(); } },
          psignin: function(){ h.openSignIn(); },
          plive: function(){ var on = !L.on(); L.set(on); yd.toast(on ? 'The live board is on.' : 'The live board is off.'); C3.render(); },
          pclear: function(){ L.setClear(!L.clear()); C3.render(); },
          plcopy: function(){ copy(L.url(), 'Link copied.'); },
          plnew: function(){ L.rotate(); yd.toast('New link made. The old one stopped working.'); C3.render(); }
        }, {
          padd: function(v, el){
            var files = Array.prototype.slice.call(el.files || []), room = 6 - P.items.length;
            if(!files.length) return;
            if(room <= 0){ yd.toast('Six is the most one post holds.', 'bad'); return; }
            /* one at a time, so they keep the order they were picked in */
            files.slice(0, room).reduce(function(pr, f){ return pr.then(function(acc){ return P.add(f, ctx.state.key).then(function(it){ acc.push(it); return acc; }); }); }, Promise.resolve([])).then(function(got){
              var n = got.filter(Boolean).length;
              if(n < files.slice(0, room).length) yd.toast('One of those could not be read here.', 'bad');
              C3.render();
            });
          },
          pfrom: function(v, el){ var it = byId(el.getAttribute('data-v')); if(it){ it.start = +v; P.saveItem(it); re(); } },
          pcap: function(v){ P.cap = String(v || '').slice(0, 300); }
        });
      },
      leave: function(){ if(P.busy) P.cancel(); }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
