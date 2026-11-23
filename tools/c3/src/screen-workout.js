/* C3 screen: workout. Full screen, one exercise and one set at a time, one thumb.
   Three states of one screen: SET (the load huge, the steppers, COMPLETE SET),
   REST (the screen's own countdown, + 30 s, SKIP REST) and DONE.
   The session is the app's own: the same ALL.workLog[key] the app's session sheet
   writes (rows, done, ramp), every set goes through the app's tickSet, and the last
   set runs the app's finish path. Nothing is kept here that the log does not hold,
   so End and a reload both come back to the first undone set. */
(function(){
  'use strict';
  /* v374: workouts adjust themselves (build plan item 2). The shell's buildWeek calls the global
     progressDecision for the next target load; this wrapper holds the jump when the muscle has not
     recovered (muscleRecovery < 60%, its six-day decay model) and says why in one line. The recovery
     line is the only new copy: "Chest is 45% recovered from 2 days ago. Same weight as last time today." */
  (function(){
    var orig = window.progressDecision;
    if(typeof orig !== 'function' || orig.__v374) return;
    var wrapped = function(prev, ex, perf, opts){
      var dec = orig.apply(this, arguments);
      if(dec && dec.lb > prev && typeof muscleRecovery === 'function' && ex && ex.grp){
        var rec = muscleRecovery(ex.grp);
        if(rec && !rec.ready){
          var g = String(ex.grp); g = g.charAt(0).toUpperCase() + g.slice(1);
          dec.lb = prev; dec.holdForReps = false;
          var dAgoN = rec.daysSince == null ? null : Math.round(rec.daysSince);
          var dAgo = dAgoN == null ? '' : (dAgoN < 1 ? ' from today' : (dAgoN === 1 ? ' from a day ago' : ' from ' + dAgoN + ' days ago'));
          dec.why = g + ' has recent logged training' + dAgo + '. Recovery is an estimate, not a medical assessment. Same weight as last time today.';
        }
      }
      return dec;
    };
    wrapped.__v374 = true;
    window.progressDecision = wrapped;
  })();
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  var GUARD_MS = 450;          /* a double tap must not land on the control that takes this one's place */
  var ARM_MS = 4000;           /* Finish early asks twice: the second tap must come inside this window */
  var armT = 0;                /* the timer that takes the question away again; cleared on leave */
  var WK = null;               /* the session on screen (null when the screen is not up) */
  var timer = 0;               /* the rest countdown; cleared on leave */
  var watch = 0;               /* looks for a plan edit while the app's day sheet is open (Swap) */

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function num(v){ v = +v; return isFinite(v) ? v : 0; }
  function r2(v){ return Math.round(v * 100) / 100; }
  /* v317: the workout's buzzes go through the app's one buzz (appBuzz in index.html): the phone's haptics
     in the iPhone app, navigator.vibrate in a browser that has it */
  function buzz(p){ try{ if(typeof appBuzz === 'function') appBuzz(p); else if(navigator.vibrate) navigator.vibrate(p); }catch(e){} }
  /* v318: SAY IT OUT LOUD on this screen. The app's own spoken cues (speak() in index.html), only when the person
     has switched them on (Train > Full plan > Say it out loud, or Settings): the set as it comes up, the rest as
     it starts, the countdown, and each cue only if its own switch is on. Every number said is the one on the screen. */
  function sayOn(k){ return safe(function(){ var V = voiceCfg(); return !!V.on && sayAvailable() && (!k || !V.cues || V.cues[k] !== false); }, false); }
  function say(t){ if(t) safe(function(){ speak(t); }); }
  function spokenLoad(lb){ return safe(function(){ return fmtW(loadNum(lb)) + (isMetric() ? ' kilograms' : ' pounds'); }, ''); }
  function setCue(c){
    var bl = c.bl, r = c.r, warm = r.t === 'W', kind = kindOf(bl);
    var group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(r) + 1;
    var bits = [bl.n + '.', (warm ? 'Warm-up ' : 'Set ') + no + ' of ' + group.length + '.'];
    var w = sayOn('weight') && WK.lb > 0 ? spokenLoad(WK.lb) + (kind === 'dumbbell' ? ' each' : '') : '';
    var rp = r.sec !== undefined ? 'for ' + num(WK.sec) + ' seconds'
           : warm ? (WK.reps > 0 ? 'for ' + WK.reps : '')
           : (String(bl.reps || '') ? 'for ' + String(bl.reps).replace('+', ' or more').replace(/(\d)-(\d)/, '$1 to $2') : '');
    if(w || rp) bits.push([w, rp].filter(Boolean).join(', ') + '.');
    return bits.join(' ');
  }
  function restCue(sec){ return safe(function(){ return cueRest(sec); }, sec > 0 ? 'Rest ' + sec + ' seconds.' : ''); }
  function countCue(left){ return safe(function(){ return cueCountdown(left); }, ''); }

  /* ---------- the log ---------- */
  /* what the app's liveStore() does: the day's blocks go into the log as "what the session was" */
  function store(){
    ALL.workLog = ALL.workLog || {};
    var L = ALL.workLog[WK.key] = ALL.workLog[WK.key] || {done:[], loads:{}, sets:{}};
    L.sets = L.sets || {}; L.done = L.done || []; L.at = L.at || Date.now();
    L.name = WK.day.name; L.focus = WK.day.focus; L.week = WK.wi;
    L.blocks = h.sessionBlocks(L, WK.day.blocks).map(function(b){ return {id:b.id, n:b.n, grp:b.grp, pat:b.pat, eq:b.eq, unil:b.unil, sets:b.sets, reps:b.reps, restSec:b.restSec, load:b.load, ss:b.ss, retired:!!b.retired}; });
    return L;
  }
  /* ALL is replaced on sync: the log is read at call time, never kept */
  function log(){ var L = (ALL.workLog || {})[WK.key]; return (L && L.blocks) ? L : store(); }
  function rowsOf(L, bl){ return setRows(L, bl); }
  function sig(day){ return (day && day.blocks || []).map(function(b){ return b.id + ':' + b.sets + ':' + b.reps; }).join('|'); }
  function ramp(L){ WK.day.blocks.forEach(function(bl){ try{ ensureRamp(L, bl, WK.key); }catch(e){} }); }

  /* START / RESUME: what the app's openLive() does, without its sheet */
  function begin(p){
    p = p || {};
    var now = Date.now(), todayKey = dkey(now);
    var key = p.key || todayKey, wi = p.wi != null ? p.wi : weekIndexNow(), dow = new Date(now).getDay();
    var day = p.day || weekAt(wi)[dow];
    if(!day || day.rest || !day.blocks || !day.blocks.length) return false;
    WK = {key:key, wi:wi, dow:dow, day:day, planned: !p.day && key === todayKey, sig:sig(day),
          i:0, mode:'set', pos:'', lb:null, reps:null, sec:null, rest:null, guard:0, records:[], lastDone:null, arm:0, early:false};
    var L = store();
    try{ sessionStamp(key); }catch(e){}
    ramp(L);
    var first = -1;
    day.blocks.forEach(function(bl, k){ if(rowsOf(L, bl).some(function(r){ return !r.done; }) && first < 0) first = k; });   /* every move gets its rows, as the app's session sheet does on its first draw */
    try{ save(); }catch(e){}
    WK.i = first < 0 ? 0 : first;
    WK.mode = first < 0 ? 'done' : 'set';
    return true;
  }
  /* the plan was edited while the session is up (Swap in the app's day sheet): take the new list */
  function resync(){
    if(!WK || !WK.planned || WK.mode === 'done') return;
    var plan = safe(function(){ return weekAt(WK.wi)[WK.dow]; }, null);
    if(!plan || plan.rest || !plan.blocks || !plan.blocks.length) return;
    var s = sig(plan); if(s === WK.sig) return false;
    var curId = (WK.day.blocks[WK.i] || {}).id;
    WK.day = plan; WK.sig = s;
    var L = store(); ramp(L);
    var at = -1; plan.blocks.some(function(b, k){ if(b.id === curId){ at = k; return true; } return false; });
    WK.i = at >= 0 ? at : Math.min(WK.i, plan.blocks.length - 1);
    WK.pos = '';
    try{ save(); }catch(e){}
    return true;
  }
  /* the app's liveNext(): stay on this move while it has an undone set, else the next one that has */
  function next(){
    var L = log(), B = WK.day.blocks, k;
    for(k = WK.i; k < B.length; k++){ if(rowsOf(L, B[k]).some(function(r){ return !r.done; })){ WK.i = k; return true; } }
    for(k = 0; k < WK.i; k++){ if(rowsOf(L, B[k]).some(function(r){ return !r.done; })){ WK.i = k; return true; } }
    return false;
  }
  function cur(){
    var L = log(), bl = WK.day.blocks[WK.i]; if(!bl) return null;
    var rows = rowsOf(L, bl), ri = -1;
    rows.some(function(r, k){ if(!r.done){ ri = k; return true; } return false; });
    return {L:L, bl:bl, rows:rows, ri:ri, r: ri >= 0 ? rows[ri] : null};
  }
  /* sets, counted the way Today counts them */
  function counts(){
    var L = log(), done = 0, total = 0;
    h.sessionBlocks(L, WK.day.blocks).forEach(function(bl){
      var n = h.sessionCount(L, bl); total += n.total; done += n.done;
    });
    return {done:done, total:total};
  }
  /* the newest ticked row of this session, from the log itself */
  function lastTicked(){
    var L = log(), best = null;
    h.sessionBlocks(L, WK.day.blocks).forEach(function(bl){
      var bi = WK.day.blocks.map(function(b){ return b.id; }).indexOf(bl.id);
      if(bi < 0) bi = WK.i;
      ((L.rows || {})[bl.id] || []).forEach(function(r, ri){ if(r && r.done && r.at && (!best || r.at >= best.at)) best = {at:r.at, bl:bl, bi:bi, ri:ri, r:r}; });
    });
    return best;
  }
  /* the last session that has this move at all (lastTime() only knows weighted sets) */
  function lastAny(exId){
    return safe(function(){
      var keys = Object.keys(ALL.workLog || {}).filter(function(k){ return k < WK.key; }).sort().reverse();
      for(var a = 0; a < keys.length; a++){
        var rows = ((ALL.workLog[keys[a]] || {}).rows || {})[exId];
        if(Array.isArray(rows)){
          var top = null;
          rows.forEach(function(r){ if(r && r.done && r.t !== 'W' && (!top || num(r.lb) * (num(r.reps) || 1) > num(top.lb) * (num(top.reps) || 1))) top = r; });
          if(top) return top;
        }
      }
      var lt = lastTime(exId, WK.key);
      return lt ? (lt.rows.filter(function(r){ return r.done && r.lb > 0 && r.t !== 'W'; })[0] || null) : null;
    }, null);
  }
  /* how a logged row reads, in the person's unit: "230 lb × 8", "8 reps", "45 s" */
  function rowWord(r){
    if(!r) return '';
    if(r.sec !== undefined) return (r.lb > 0 ? loadTxt(r.lb) + ' · ' : '') + num(r.sec) + ' s';
    var reps = r.rR !== undefined ? num(r.reps) + ' / ' + num(r.rR) : num(r.reps);
    return r.lb > 0 ? loadTxt(r.lb) + ' × ' + reps : reps + ' reps';
  }
  /* what the load sits on, for stepping (a block without a known weight still has equipment) */
  function kindOf(bl){
    if(bl.load && bl.load.type === 'bw') return 'bodyweight';
    return bl.eq || safe(function(){ return (exdbFind(bl.id) || {}).eq; }, '') || 'other';
  }
  /* the values the steppers open on: what tickSet would fill in (last time, else the program);
     inside one move the weight just lifted carries to the next set */
  function prefill(c){
    var bl = c.bl, r = c.r, ri = c.ri, k;
    var last = safe(function(){ return lastTime(bl.id, WK.key); }, null);
    var work = last && last.rows ? last.rows.filter(function(x){ return x.t !== 'W'; }) : [];
    var ordinal = c.rows.slice(0, ri).filter(function(x){ return x.t !== 'W'; }).length;
    var lr = r.t !== 'W' && work.length ? work[Math.min(ordinal, work.length - 1)] : null;
    var lb = r.lb != null ? +r.lb : null;
    /* v330: the program moved this lift on from what was logged (progressDecision, its reason in bl.why): that load is
       the start, not last time's (it used to be overwritten by last time's weight, so the increase never showed) */
    var prog = (bl.why && bl.load && bl.load.type === 'lb' && bl.load.value > 0) ? +bl.load.value : null;
    WK.lr = (lr && r.t !== 'W' && lr.t !== 'W') ? lr : null; WK.prog = prog;
    if(lb == null && r.t !== 'W'){
      for(k = ri - 1; k >= 0; k--){ if(c.rows[k].done && c.rows[k].t !== 'W' && c.rows[k].lb > 0){ lb = +c.rows[k].lb; break; } }
      if(lb == null) lb = prog != null ? prog : (lr && lr.lb) ? +lr.lb : ((bl.load && bl.load.type === 'lb' && bl.load.value > 0) ? +bl.load.value : null);
    }
    WK.lb = lb > 0 ? lb : null;
    WK.reps = r.reps != null ? +r.reps : ((lr && lr.reps) ? +lr.reps : (+repTarget(bl.reps) || null));
    WK.sec = r.sec !== undefined ? (r.sec != null ? +r.sec : ((lr && lr.sec) ? +lr.sec : (typeof holdTarget === 'function' ? holdTarget(bl) : 30))) : null;
  }
  /* one step of weight, by what this gym can make (gear()) */
  function stepWeight(lb, kind, dir){
    var G = gear(), v;
    if(!(lb > 0)){
      if(dir < 0) return null;
      if(kind === 'barbell') return G.bar;
      if(kind === 'dumbbell') return G.dbMin || G.dbStep || 5;
      if(kind === 'kettlebell') return (G.kb || []).slice().sort(function(a, b){ return a - b; })[0] || 10;
      if(kind === 'machine') return G.machineStep || 10;
      if(kind === 'cable') return G.cableStep || 5;
      return isMetric() ? r2(wIn(2.5)) : 5;
    }
    if(kind === 'barbell'){
      var small = G.plates.length ? G.plates[G.plates.length - 1] : 0;
      if(!small) return G.bar;
      v = lb + dir * 2 * small; return r2(Math.max(G.bar, v));
    }
    if(kind === 'dumbbell'){ v = lb + dir * (G.dbStep || 5); return r2(Math.min(G.dbMax || 999, Math.max(G.dbMin || G.dbStep || 5, v))); }
    if(kind === 'kettlebell'){
      var list = (G.kb || []).slice().sort(function(a, b){ return a - b; });
      if(!list.length) return r2(Math.max(5, lb + dir * 5));
      var up = list.filter(function(x){ return x > lb + 1e-9; })[0], dn = list.filter(function(x){ return x < lb - 1e-9; }).pop();
      return dir > 0 ? (up != null ? up : lb) : (dn != null ? dn : lb);
    }
    if(kind === 'machine'){ v = lb + dir * (G.machineStep || 10); return r2(Math.max(G.machineStep || 10, v)); }
    if(kind === 'cable'){ v = lb + dir * (G.cableStep || 5); return r2(Math.max(G.cableStep || 5, v)); }
    var st = isMetric() ? wIn(1) : 2.5;
    v = lb + dir * st; return v > 0.01 ? r2(v) : null;
  }

  /* ---------- drawing ---------- */
  var IC = {
    camera: '<path d="M3.5 8.5h3l1.6-2.5h7.8l1.6 2.5h3v10h-17z"></path><circle cx="12" cy="13.2" r="3.4"></circle>',
    x: '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    clock: '<circle cx="12" cy="13.5" r="7.5"></circle><path d="M12 9.5v4l2.6 1.8"></path><path d="M9.5 3h5"></path>',
    minus: '<path d="M4 12h16"></path>',
    plus: '<path d="M12 4v16"></path><path d="M4 12h16"></path>',
    check: '<path d="M4 12.5l5.5 5.5L20 6.5"></path>',
    skip: '<path d="M5 5l8 7-8 7z"></path><path d="M18.5 5v14"></path>',
    arrow: '<path d="M4 12h15"></path><path d="M13 5l7 7-7 7"></path>',
    play: '<path d="M7 4.5v15L19.5 12z" fill="currentColor"></path>'
  };
  function ic(name, size, sw){ return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + IC[name] + '</svg>'; }

  function header(){
    var B = WK.day.blocks, L = log();
    var segs = B.map(function(bl, k){
      var rows = (L.rows || {})[bl.id] || [], d = rows.filter(function(r){ return r && r.done; }).length;
      var w = rows.length ? Math.round(d / rows.length * 100) : 0;
      return '<span class="' + (WK.mode !== 'done' && k === WK.i ? 'on' : '') + '"><i style="width:' + w + '%"></i></span>';
    }).join('');
    var can = WK.mode !== 'done' && anyTicked(), ask = can && armed(), N = ask ? counts() : null;
    return '<header class="wk-top' + (ask ? ' ask' : can ? ' can' : '') + '">' +
        '<button type="button" class="wk-end" data-act="end" data-key="end" aria-label="End for now. Your sets are kept">' + ic('x', 18, 2.4) + '<span>End</span></button>' +
        (ask
          ? '<button type="button" class="wk-fin on" data-act="finish-yes" data-key="finish" aria-label="Yes, finish the session now with ' + N.done + ' of ' + N.total + ' sets">Finish at ' + N.done + ' / ' + N.total + '? Tap again</button>'
          : '<button type="button" class="wk-discomfort" data-go="recovery" data-params="&#123;&quot;view&quot;:&quot;inj&quot;&#125;" data-key="discomfort" aria-label="Report discomfort">Discomfort?</button>' +
            (can ? '<button type="button" class="wk-fin" data-act="finish" data-key="finish" aria-label="Finish the session early">Finish early</button>' : '') +
            '<span class="wk-of c3-num">' + (safe(function(){ return C3.live && C3.live.on(); }, false) ? '<i class="wk-live" role="img" aria-label="Live board on"></i>' : '') + (WK.i + 1) + ' / ' + B.length + '</span>') +
      '</header>' +
      '<div class="wk-segs" role="img" aria-label="Session track, move ' + (WK.i + 1) + ' of ' + B.length + '">' + segs + '</div>';
  }
  /* the set ring: one segment per row of this move; a warm-up row is thinner and paler */
  function setRing(c){
    var n = c.rows.length, R = 102, C = 118, out = '';
    var slot = 360 / n;
    function pt(deg){ var a = deg * Math.PI / 180; return (Math.round((C + R * Math.cos(a)) * 10) / 10) + ' ' + (Math.round((C + R * Math.sin(a)) * 10) / 10); }
    c.rows.forEach(function(r, k){
      var warm = r.t === 'W', sw = warm ? 9 : 21;
      var gap = Math.min(slot * 0.62, (10 + sw) / R * 180 / Math.PI);
      var a0 = -90 + k * slot + gap / 2, a1 = -90 + (k + 1) * slot - gap / 2;
      if(a1 - a0 < 0.6) a1 = a0 + 0.6;
      var d = 'M ' + pt(a0) + ' A ' + R + ' ' + R + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + pt(a1);
      var col = warm ? '#EDEEEF' : '#5CF2B0';
      out += '<path d="' + d + '" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="' + sw + '" stroke-linecap="round"></path>' +
             '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-opacity=".22" stroke-width="' + sw + '" stroke-linecap="round"></path>';
      if(r.done) out += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-opacity="' + (warm ? '.8' : '1') + '" stroke-width="' + sw + '" stroke-linecap="round" style="filter:drop-shadow(0 0 ' + (warm ? 4 : 7) + 'px ' + col + ')"></path>';
      else if(k === c.ri) out += '<path class="c3-ring-pulse" d="' + d + '" fill="none" stroke="' + col + '" stroke-opacity=".6" stroke-width="' + sw + '" stroke-linecap="round"></path>';
    });
    var hard = c.rows.filter(function(r){ return r.t !== 'W'; }).length, warmN = n - hard;
    return '<svg viewBox="0 0 236 236" role="img" aria-label="Set ring: ' + (warmN ? warmN + ' warm-up and ' : '') + hard + ' sets, ' + c.rows.filter(function(r){ return r.done; }).length + ' done" focusable="false">' +
      '<circle cx="118" cy="118" r="86.5" fill="rgba(255,255,255,0.1)"></circle>' + out + '</svg>';
  }
  /* the middle of the ring: the load, huge */
  function loadHTML(c){
    var kind = kindOf(c.bl);
    if(c.r.sec !== undefined && !(WK.lb > 0)) return '<span class="wk-load-w">' + (kind === 'bodyweight' ? 'Bodyweight' : 'Timed') + '</span>';
    if(WK.lb > 0){
      var t = fmtW(loadNum(WK.lb));
      return '<span class="wk-load-n' + (t.length > 4 ? ' xs' : t.length > 3 ? ' sm' : '') + '">' + esc(t) + '</span>' +
             '<span class="wk-load-u">' + esc(wU()) + (kind === 'dumbbell' ? ' each hand' : '') + '</span>';
    }
    return '<span class="wk-load-w">' + (kind === 'bodyweight' ? 'Bodyweight' : 'Your load') + '</span>';
  }
  /* plates for one side of the bar, from the app's own plateStack() */
  function platesHTML(c){
    if(kindOf(c.bl) !== 'barbell' || !(WK.lb > 0)) return '';
    var G = gear(), S = plateStack(WK.lb, G), x = 44, rects = '';
    var look = function(p){
      var k = Math.max(0, Math.min(1, p / 45));
      return {w: Math.round(5 + 10 * k), hgt: Math.round(12 + 30 * k), col: p >= 45 ? '#5CF2B0' : p >= 35 ? '#B9FFE0' : p >= 25 ? '#FF4FCB' : p >= 10 ? '#FFB85C' : p >= 5 ? '#EDEEEF' : '#FFFFFF'};
    };
    S.perSide.forEach(function(p){ var k = look(p); rects += '<rect x="' + x + '" y="' + (22 - k.hgt / 2) + '" width="' + k.w + '" height="' + k.hgt + '" rx="' + (k.w > 8 ? 4 : 2) + '" fill="' + k.col + '"></rect>'; x += k.w + 4; });
    var wv = Math.max(150, x + 24);
    var words = S.perSide.length ? S.perSide.map(function(p){ return fmtW(p); }).join(' + ') : 'Empty bar';
    var under = (S.perSide.length ? 'Per side · ' : '') + fmtW(G.bar) + ' lb bar' + (S.short > 0 ? ' · ' + fmtW(S.short) + ' lb short' : '');
    return '<svg class="wk-plates-pic" viewBox="0 0 ' + wv + ' 44" role="img" aria-label="Plates per side: ' + esc(S.perSide.length ? S.perSide.join(', ') : 'none') + '" focusable="false">' +
        '<path d="M0 22 H' + wv + '" stroke="#EDEEEF" stroke-width="5" stroke-linecap="round"></path><path d="M36 12 V32" stroke="#EDEEEF" stroke-width="5" stroke-linecap="round"></path>' + rects + '</svg>' +
      '<div class="wk-plates-t"><span class="c3-num">' + esc(words) + '</span><span>' + esc(under) + '</span></div>';
  }
  /* what one press of a stepper would make the value (the same rules nudge() applies) */
  function stepped(what, dir, c){
    if(what === 'w') return stepWeight(WK.lb, kindOf(c.bl), dir);
    if(what === 'r') return Math.max(1, Math.min(99, (WK.reps > 0 ? WK.reps : (dir > 0 ? 0 : 2)) + dir));
    return Math.max(5, Math.min(900, num(WK.sec) + dir * 5));
  }
  /* a stepper at its end (the empty bar, one rep, five seconds, the heaviest dumbbell) is switched off, not dead */
  function atEnd(what, dir, c){
    var cur = what === 'w' ? (WK.lb > 0 ? WK.lb : null) : what === 'r' ? (WK.reps > 0 ? WK.reps : null) : num(WK.sec);
    var nx = stepped(what, dir, c);
    return nx === cur || (nx == null && cur == null);
  }
  function stepper(kind, label, value, unit, downLabel, upLabel, c){
    return '<div class="wk-step" data-step="' + kind + '">' +
      '<button type="button" class="wk-pm" data-act="' + kind + '-" data-key="' + kind + 'dn" aria-label="' + downLabel + '"' + (atEnd(kind, -1, c) ? ' disabled' : '') + '>' + ic('minus', 30, 3) + '</button>' +
      '<div class="wk-val" aria-live="polite"><span class="v c3-num" data-v="' + kind + '">' + esc(value) + '</span><span class="u">' + esc(unit) + '</span></div>' +
      '<button type="button" class="wk-pm" data-act="' + kind + '+" data-key="' + kind + 'up" aria-label="' + upLabel + '"' + (atEnd(kind, 1, c) ? ' disabled' : '') + '>' + ic('plus', 30, 3) + '</button></div>';
  }
  function weightVal(){ return WK.lb > 0 ? fmtW(loadNum(WK.lb)) : '--'; }
  function setLine(c){
    var r = c.r, warm = r.t === 'W';
    var group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(r) + 1;
    var what = r.sec !== undefined ? '<b>' + num(WK.sec) + '</b> s' : warm ? '<b>' + (r.reps != null ? num(r.reps) : num(WK.reps)) + '</b> reps' : '<b>' + esc(String(c.bl.reps)) + '</b> reps';
    return (warm ? 'Warm-up' : 'Set') + ' <b>' + no + '</b> of <b>' + group.length + '</b> <i>·</i> ' + what;
  }
  /* v317: THE FORM LOOP. The move's own start and finish photos (the bundled library, exdb) crossfade beside
     the set ring, the same height, at the photos' own 3:2 and never cropped: the person sees the move while
     doing it. A tap is Watch (the video, the pictures and the cues). The ring and the load stay as they are. */
  var formTries = 0;
  function formPics(bl){
    return safe(function(){
      if(!EXDB.data){ formWait(); return null; }
      var e = exdbFind(bl.id); if(!e) return null;
      var a = exImg(e, 0), b = exImg(e, 1); return a && b ? [a, b] : null;
    }, null);
  }
  /* the library still loading (the first seconds after boot): draw the photos in when it lands */
  function formWait(){
    if(formTries) return; formTries = 1;
    safe(function(){ exdbLoad(); }, null);
    (function look(){
      if(!WK || C3.current !== 'workout') { formTries = 0; return; }
      if(safe(function(){ return !!EXDB.data; }, false)){ if(WK.mode === 'set') C3.render(true); return; }
      if(++formTries < 40) setTimeout(look, 300);
    })();
  }
  function formHTML(bl, pics){
    return '<button type="button" class="wk-form" data-watch="' + esc(bl.id) + '" data-key="watch-form" aria-label="' + esc(bl.n) + ': start and finish, looping. Watch how to do it">' +
      '<img src="' + esc(pics[0]) + '" alt="" decoding="async" width="480" height="320"><img class="b" src="' + esc(pics[1]) + '" alt="" decoding="async" width="480" height="320"></button>';
  }
  function nextBlock(){
    var B = WK.day.blocks, L = log();
    for(var k = WK.i + 1; k < B.length; k++){ if(rowsOf(L, B[k]).some(function(r){ return !r.done; })) return B[k]; }
    return null;
  }
  /* the play mark and the word, as they stand inside the "Up next" control */
  function watchWord(){ return '<span class="wk-link w">' + h.icon('play', 13, 2) + '<span>Watch</span></span>'; }

  /* v315: LIVE HEART RATE on the session, the number big enough to read between sets, painted in place
     on every beat (heartOn in index.html). Connected: the number, bpm and the zone (a measured max
     only). Not connected, on a device that can: one quiet link that opens the heart sheet. A device
     that cannot (Safari on an iPhone, outside the app) gets nothing, never a dead control. */
  var ZCOL = ['#7FB0FF', '#5CF2B0', '#FFB85C', '#FF8A3D', '#FF4FCB'];
  function hrChip(){
    var H = safe(function(){ return typeof HEART !== 'undefined' ? HEART : null; }, null);
    if(!H) return '';
    if(!H.kind){
      if(!safe(function(){ return heartAny(); }, false)) return '';
      return '<button type="button" class="wk-hr off" data-hr data-act="heart" data-key="heart" aria-label="Connect a heart rate monitor">' + heartIc(16) + '<span>Heart rate</span></button>';
    }
    var fresh = safe(function(){ return heartFresh(); }, false), z = fresh ? safe(function(){ return heartZone(); }, null) : null;
    var n = H.bpm && fresh ? String(H.bpm) : '--';
    var col = z ? ZCOL[z.zone - 1] : '#FF4FCB';
    var word = H.state === 'reconnecting' || H.state === 'connecting' ? 'Linking' : H.contact === false ? 'No skin' : '';
    return '<button type="button" class="wk-hr' + (fresh ? ' live' : '') + '" data-hr data-act="heart" data-key="heart" style="--hc:' + col + (fresh && H.bpm ? ';--hb:' + (60 / H.bpm).toFixed(2) + 's' : '') + '" aria-label="Heart rate ' + (fresh ? H.bpm + ' beats a minute' + (z ? ', zone ' + z.zone : '') : 'waiting') + '">' +
      heartIc(16) + '<b class="c3-num" data-hrn>' + n + '</b><span>' + (word || 'bpm') + '</span>' + (z ? '<em class="c3-num">Z' + z.zone + '</em>' : '') + '</button>';
  }
  function heartIc(sz){ return '<svg class="wk-hr-ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-8.5-5-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 16 12 21 12 21z"></path></svg>'; }
  var hrOff = null, hrLast = '';
  function hrPaint(){
    var root = C3.root; if(!root || !WK || C3.current !== 'workout') return;
    var el = root.querySelector('[data-hr]'), html = hrChip();
    if(!el){ if(html && WK.mode !== 'done') hrLast = ''; return; }
    if(html === hrLast) return;
    hrLast = html;
    liveSend(false);
    var t = document.createElement('div'); t.innerHTML = html;
    if(t.firstChild) el.replaceWith(t.firstChild); else el.remove();
  }
  /* the session's heart, from the readings stored for its span */
  function hrSum(L, end){ return safe(function(){ return hrSpan(L.at || end, end); }, null); }
  function hrDoneHTML(L, end){
    var S = hrSum(L, end); if(!S) return '';
    /* the log keeps the summary, so the history and the report read the same numbers */
    safe(function(){ var keep = {avg:S.avg, max:S.max, min:S.min, n:S.n, zones:S.zones}; if(JSON.stringify(L.hr || null) !== JSON.stringify(keep)){ L.hr = keep; save(); } });
    var w = 300, hh = 56, rows = S.rows, t0 = rows[0].at, t1 = rows[rows.length - 1].at, lo = S.min - 5, hi = S.max + 5;
    var pts = rows.map(function(x){ return (Math.round((x.at - t0) / Math.max(1, t1 - t0) * w * 10) / 10) + ',' + (Math.round((hh - 3 - (x.bpm - lo) / Math.max(1, hi - lo) * (hh - 6)) * 10) / 10); }).join(' ');
    var zbar = '';
    if(S.zones){
      var tot = S.zones.reduce(function(a, b){ return a + b; }, 0);
      if(tot > 0) zbar = '<div class="wk-hz" role="img" aria-label="Time in zones: ' + S.zones.map(function(v, i){ return 'zone ' + (i + 1) + ' ' + Math.round(v / 60) + ' min'; }).join(', ') + '">' +
        S.zones.map(function(v, i){ return v > 0 ? '<i style="flex:' + v + ';background:' + ZCOL[i] + '"></i>' : ''; }).join('') + '</div>';
    }
    return '<div class="wk-hrsum"><div class="wk-hrsum-n"><span class="k">' + heartIc(15) + 'Heart</span>' +
        '<span class="v"><b class="c3-num">' + S.avg + '</b><small>avg</small><b class="c3-num">' + S.max + '</b><small>peak bpm</small></span></div>' +
      '<svg class="wk-hrsum-line" viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="#FF4FCB" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline></svg>' +
      zbar + '</div>';
  }

  function viewSet(){
    var c = cur(); if(!c || !c.r) return '';
    var pos = c.bl.id + ':' + c.ri;
    if(WK.pos !== pos){ WK.pos = pos; prefill(c); shutMore(); }
    /* v318: read once, the first time this set is on the screen (after a rest, a skip or START alike) */
    var sk = pos + ':' + (c.r.t === 'W' ? 'W' : 'S') + ':' + c.rows.length;      /* a skipped warm-up renumbers the rows: the key must still change */
    if(WK.said !== sk && sayOn('next')){ WK.said = sk; say(setCue(c)); }
    var bl = c.bl, r = c.r, N = counts(), kind = kindOf(bl), timed = r.sec !== undefined, warm = r.t === 'W';
    var R = safe(function(){ return restFor(r, bl, WK.day.blocks); }, {sec: bl.restSec | 0});
    var restOff = safe(function(){ return trainCfg().rest === false; }, false);
    var lt = lastAny(bl.id), nx = nextBlock(), lastT = lastTicked();
    var LD = WK.lastDone;
    var anyDone = c.rows.some(function(x){ return x.done; }), warmLeft = c.rows.some(function(x){ return x.t === 'W' && !x.done; });
    var showWeight = !(kind === 'bodyweight' && !(WK.lb > 0));
    var pics = formPics(bl);
    /* Watch: the form video, the pictures and the cues for THIS move, over the set, one tap */
    /* v366: one row, two or three words. Show me how, Skip warm-up while there is one, and More: Swap, Skip move
       and Film wait behind it (they were four underlined words in a row, two rows on a phone) */
    var moreIn = (WK.planned ? '<button type="button" class="wk-link" data-act="swap" data-key="swap">Swap</button>' : '') +   /* swap stays on once sets are done: a taken machine mid-move is exactly when it is needed; the plan swap keeps done sets in the log and resync brings the new move */
      (WK.day.blocks.length > 1 ? '<button type="button" class="wk-link" data-act="skipmove" data-key="skipmove">Skip move</button>' : '') +
      (warm && warmLeft ? '' : filmLink('film'));   /* v331: on every working set and rest */
    var links = h.watchHTML(bl.id, bl.n, {key:'watch-cur', cls:'wk-watch'}).replace('<span>Watch</span>','<span>Show me how</span>') +
      (warm && warmLeft ? '<button type="button" class="wk-link" data-act="nowarm" data-key="nowarm">Skip warm-up</button>' : '') +
      h.moreHTML('wk', moreIn, 'More');
    return '<div class="wk set' + (warm ? ' warm' : '') + '" data-state="set">' +
      '<div class="wk-a">' + header() +
        '<div class="wk-row"><span class="wk-hard"><b class="c3-num">' + N.done + ' / ' + N.total + '</b> sets</span>' + hrChip() +
          '<span class="wk-restw c3-num">' + ic('clock', 16, 2) + '<span>' + (restOff ? 'Rest off' : 'Rest ' + (R.sec | 0) + ' s') + '</span></span></div>' +
      '</div>' +
      '<div class="wk-l"><div class="wk-b"><div class="wk-muscle">' + (WK.day && WK.day.deload ? '<span class="wk-dl">Deload</span> · ' : '') + esc(fmt.group(bl.grp)) + '</div>' +
        '<h1 class="wk-move' + (String(bl.n).length > 24 ? ' long' : '') + '">' + esc(bl.n) + '</h1>' +
        '<div class="wk-links">' + links + '</div></div>' +
      '<div class="wk-c"><div class="wk-vis' + (pics ? ' form' : '') + '"><div class="wk-ring">' + setRing(c) + '<div class="wk-load" data-load>' + loadHTML(c) + '</div></div>' + (pics ? formHTML(bl, pics) : '') + '</div>' +
        '<div class="wk-setline" data-setline>' + setLine(c) + '</div>' +
        '<div class="wk-last">' + (LD && LD.record && LD.id === bl.id ? '<b>Record.</b> ' + esc(LD.label + ': ' + LD.word) : lastLine(c, lt)) + '</div></div></div>' +
      '<div class="wk-r"><div class="wk-plates" data-plates>' + platesHTML(c) + '</div>' +
      '<div class="wk-steps">' +
        (showWeight ? stepper('w', 'Weight', weightVal(), wU(), 'Less weight', 'More weight', c) : '') +
        (timed ? stepper('s', 'Seconds', String(num(WK.sec)), 'sec', 'Five seconds fewer', 'Five seconds more', c)
               : stepper('r', 'Reps', WK.reps > 0 ? String(WK.reps) : '--', r.rR !== undefined ? 'reps a side' : 'reps', 'One rep fewer', 'One rep more', c)) +
      '</div>' +
      /* v311: a hold (plank, wall sit, carry, hang) is not typed in, it is timed. The big control starts the
         countdown (3 s to get set, then the seconds above), and the set logs itself when it reaches zero.
         Logging it without the clock stays one quiet tap away, under the control. */
      (timed
        ? '<div class="wk-d"><div class="wk-cta-rail"><button type="button" class="wk-cta" data-act="hold-go" data-key="cta" aria-label="Start the ' + num(WK.sec) + ' second hold">' + ic('play', 34, 2) + '<span>Start ' + num(WK.sec) + ' s</span></button></div>' +
          '<div class="wk-holdalt"><button type="button" class="wk-link" data-act="done" data-key="done-notimer">Log ' + num(WK.sec) + ' s without the timer</button></div>'
        : '<div class="wk-d"><div class="wk-cta-rail"><button type="button" class="wk-cta" data-act="done" data-key="cta" aria-label="Complete ' + (warm ? 'warm-up set' : 'set') + '">' + ic('check', 38, 3.2) + '<span>Complete set</span></button></div>') +
        '<div class="wk-foot">' + (nx
            ? '<button type="button" class="wk-next" data-watch="' + esc(nx.id) + '" data-key="watch-next" aria-label="Up next: ' + esc(nx.n) + '. Watch how to do it"><span class="t">Up next: ' + esc(nx.n) + '</span>' + watchWord() + '</button>'
            : '<span class="wk-next">Last move of the session</span>') +
          (lastT ? '<button type="button" class="wk-link" data-act="undo" data-key="undo">Undo last set</button>' : '') + '</div></div></div>' +
    '</div>';
  }
  /* FINISH EARLY: quiet, in the top row beside End (far from the thumb), and it asks twice.
     Only once a set is logged (there is nothing to finish before that). The first tap turns the
     top row into the question with the real count; the second tap, inside 4 s and not a double
     tap, ends the session through the app's finish path. */
  function anyTicked(){ var L = log(); return h.sessionBlocks(L, WK.day.blocks).some(function(bl){ return ((L.rows || {})[bl.id] || []).some(function(r){ return r && r.done; }); }); }
  function armed(){ return !!(WK && WK.arm && Date.now() < WK.arm + ARM_MS); }

  var RC = 2 * Math.PI * 126;
  function restLeft(){ return WK.rest ? Math.max(0, Math.ceil((WK.rest.end - Date.now()) / 1000)) : 0; }
  function restDash(){ var f = WK.rest && WK.rest.total > 0 ? Math.max(0, Math.min(1, (WK.rest.end - Date.now()) / 1000 / WK.rest.total)) : 0; return (Math.round(f * RC * 10) / 10) + ' 2000'; }
  function viewRest(){
    var c = cur(); if(!c || !c.r) return '';
    var bl = c.bl, r = c.r, N = counts(), warm = r.t === 'W', LD = WK.lastDone, same = LD && LD.id === bl.id;
    var group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(r) + 1;
    var pos = bl.id + ':' + c.ri; if(WK.pos !== pos){ WK.pos = pos; prefill(c); }
    var setWord = (warm ? 'Warm-up ' : 'Set ') + no + ' of ' + group.length;
    var loadW = WK.lb > 0 ? loadTxt(WK.lb) : (kindOf(bl) === 'bodyweight' ? 'Bodyweight' : '');
    var big = same ? setWord : bl.n;
    var sub = same ? bl.n + (loadW ? ' · ' + loadW : '') : setWord + (loadW ? ' · ' + loadW : '');
    var left = restLeft();
    return '<div class="wk rest" data-state="rest">' +
      '<div class="wk-a">' + header() + '</div>' +
      '<div class="wk-l"><div class="wk-clock" role="timer" aria-label="Rest, ' + left + ' seconds left">' +
        '<svg viewBox="0 0 284 284" aria-hidden="true" focusable="false"><circle cx="142" cy="142" r="112" fill="rgba(255,255,255,0.1)"></circle>' +
          '<circle cx="142" cy="142" r="126" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="18"></circle>' +
          '<circle cx="142" cy="142" r="126" fill="none" stroke="#FF4FCB" stroke-opacity=".25" stroke-width="18"></circle>' +
          '<circle data-restarc cx="142" cy="142" r="126" fill="none" stroke="#FF4FCB" stroke-width="18" stroke-linecap="round" stroke-dasharray="' + restDash() + '" transform="rotate(-90 142 142)" style="filter:drop-shadow(0 0 9px #FF4FCB)"></circle></svg>' +
        '<div class="wk-clock-mid"><span class="t">Rest</span><span class="n c3-num" data-restnum>' + left + '</span><span class="s">seconds</span></div></div></div>' +
      '<div class="wk-r"><div class="wk-up"><div class="wk-up-l">Up next</div>' +
        '<div class="wk-up-big' + (same ? '' : ' name') + (big.length > 22 ? ' long' : '') + '">' + esc(big) + '</div>' +
        '<div class="wk-up-sub c3-num">' + esc(sub) + '</div>' +
        (LD ? '<div class="wk-up-log' + (LD.record ? ' rec' : '') + '">' + (LD.record ? '<b>Record.</b> ' : '') + esc(LD.label + ' logged: ' + LD.word) + '</div>' : '') + '</div>' +
      coachRow(c) +
      '<div class="wk-d"><div class="wk-row line"><span class="wk-hard"><b class="c3-num">' + N.done + ' / ' + N.total + '</b> sets</span>' + hrChip() +
          '<button type="button" class="wk-more c3-num" data-act="more" data-key="more" aria-label="Add 30 seconds of rest">+ 30 s</button></div>' +
        '<div class="wk-cta-rail pink"><button type="button" class="wk-cta pink" data-act="skip" data-key="cta" aria-label="Skip rest">' + ic('skip', 34, 3) + '<span>Skip rest</span></button></div>' +
        '<div class="wk-foot">' + h.watchHTML(bl.id, bl.n, {key:'watch-cur', cls:'wk-watch'}).replace('<span>Watch</span>','<span>Show me how</span>') + filmLink('film-rest') + '<button type="button" class="wk-link" data-act="undo" data-key="undo">Undo last set</button></div></div></div>' +
    '</div>';
  }

  /* ---------- v311: THE HOLD, a countdown ----------
     WK.hold = {ready: when the seconds start (3 s after the tap, to get into position), end, total}.
     Painted in place like the rest clock; at zero the set is logged with the seconds held. */
  var READY_MS = 3000;
  function holdLeft(){ var H = WK.hold, t = Date.now(); if(!H) return 0; return t < H.ready ? Math.ceil((H.ready - t) / 1000) : Math.max(0, Math.ceil((H.end - t) / 1000)); }
  function holdReady(){ return !!(WK.hold && Date.now() >= WK.hold.ready); }
  function holdDash(){
    var H = WK.hold; if(!H) return '0 2000';
    var t = Date.now(), f = t < H.ready ? 1 : Math.max(0, Math.min(1, (H.end - t) / 1000 / H.total));
    return (Math.round(f * RC * 10) / 10) + ' 2000';
  }
  function viewHold(){
    var c = cur(); if(!c || !c.r) return '';
    var bl = c.bl, r = c.r, warm = r.t === 'W', N = counts();
    var group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(r) + 1;
    var go = holdReady(), left = holdLeft();
    return '<div class="wk rest hold" data-state="hold">' +
      '<div class="wk-a">' + header() + '</div>' +
      '<div class="wk-l"><div class="wk-clock" role="timer" aria-label="' + (go ? 'Hold, ' + left + ' seconds left' : 'Get set, ' + left) + '">' +
        '<svg viewBox="0 0 284 284" aria-hidden="true" focusable="false"><circle cx="142" cy="142" r="112" fill="rgba(255,255,255,0.1)"></circle>' +
          '<circle cx="142" cy="142" r="126" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="18"></circle>' +
          '<circle cx="142" cy="142" r="126" fill="none" stroke="#5CF2B0" stroke-opacity=".25" stroke-width="18"></circle>' +
          '<circle data-holdarc cx="142" cy="142" r="126" fill="none" stroke="#5CF2B0" stroke-width="18" stroke-linecap="round" stroke-dasharray="' + holdDash() + '" transform="rotate(-90 142 142)" style="filter:drop-shadow(0 0 9px #5CF2B0)"></circle></svg>' +
        '<div class="wk-clock-mid"><span class="t" data-holdword>' + (go ? 'Hold' : 'Get set') + '</span><span class="n c3-num" data-holdnum>' + left + '</span><span class="s" data-holdunit>' + (go ? 'seconds' : 'get ready') + '</span></div></div></div>' +
      '<div class="wk-r"><div class="wk-up"><div class="wk-up-l">' + (warm ? 'Warm-up ' : 'Set ') + no + ' of ' + group.length + '</div>' +
        '<div class="wk-up-big name' + (String(bl.n).length > 22 ? ' long' : '') + '">' + esc(bl.n) + '</div>' +
        '<div class="wk-up-sub c3-num">' + num(WK.hold.total) + ' s hold</div></div>' +
      '<div class="wk-d"><div class="wk-row line"><span class="wk-hard"><b class="c3-num">' + N.done + ' / ' + N.total + '</b> sets</span>' + hrChip() + '</div>' +
        '<div class="wk-cta-rail"><button type="button" class="wk-cta" data-act="hold-stop" data-key="cta" aria-label="Stop, log the seconds held">' + ic('check', 38, 3.2) + '<span>Done</span></button></div>' +
        '<div class="wk-foot">' + h.watchHTML(bl.id, bl.n, {key:'watch-cur', cls:'wk-watch'}).replace('<span>Watch</span>','<span>Show me how</span>') + '<button type="button" class="wk-link" data-act="hold-cancel" data-key="hold-cancel">Cancel, not logged</button></div></div></div>' +
    '</div>';
  }
  function startHold(){
    if(!WK || WK.mode !== 'set' || Date.now() < WK.guard) return;
    var c = cur(); if(!c || !c.r || c.r.done || c.r.sec === undefined) return;
    var total = Math.max(5, num(WK.sec) || 30), t = Date.now();
    WK.hold = {ready: t + READY_MS, end: t + READY_MS + total * 1000, total: total}; WK.holdSaid = null;
    WK.mode = 'hold'; WK.guard = t + GUARD_MS;
    C3.render(true); holdTimer();
  }
  function holdTimer(){
    stopTimer();
    var buzzed = false;
    timer = setInterval(function(){
      if(!WK || WK.mode !== 'hold' || !WK.hold || C3.current !== 'workout' || C3.mode !== 'on'){ stopTimer(); return; }
      if(!buzzed && holdReady()){ buzzed = true; buzz(40); if(sayOn('count')) say('Go.'); }
      if(holdReady() && sayOn('count')){ var hl = holdLeft(); if(hl !== WK.holdSaid && hl > 0 && hl <= 3){ WK.holdSaid = hl; say(countCue(hl)); } }
      if(holdReady() && Date.now() >= WK.hold.end){ endHold(WK.hold.total); return; }
      paintHold();
    }, 200);
  }
  function paintHold(){
    var root = C3.root; if(!root) return;
    var n = root.querySelector('[data-holdnum]'), a = root.querySelector('[data-holdarc]');
    if(!n || !a){ C3.render(true); return; }
    var go = holdReady(), t = String(holdLeft());
    if(n.textContent !== t){
      n.textContent = t;
      var w = root.querySelector('[data-holdword]'), u = root.querySelector('[data-holdunit]'), cl = root.querySelector('.wk-clock');
      if(w) w.textContent = go ? 'Hold' : 'Get set';
      if(u) u.textContent = go ? 'seconds' : 'get ready';
      if(cl) cl.setAttribute('aria-label', go ? 'Hold, ' + t + ' seconds left' : 'Get set, ' + t);
    }
    a.setAttribute('stroke-dasharray', holdDash());
  }
  /* the hold is over: log the seconds actually held through the same path as Complete set */
  function endHold(secs){
    stopTimer();
    buzz([60, 60, 60]);
    WK.sec = Math.max(1, Math.round(secs));
    WK.hold = null; WK.mode = 'set'; WK.guard = 0;
    complete();
  }
  function stopHold(){
    if(!WK || WK.mode !== 'hold' || !WK.hold || Date.now() < WK.guard) return;
    if(!holdReady()){ cancelHold(); return; }                        /* stopped before it started: nothing was held */
    endHold(Math.min(WK.hold.total, (Date.now() - WK.hold.ready) / 1000));
  }
  function cancelHold(){
    if(!WK || WK.mode !== 'hold') return;
    stopTimer(); WK.hold = null; WK.mode = 'set'; WK.guard = Date.now() + GUARD_MS;
    C3.render(true);
  }

  function clockWord(ms){
    var s = Math.max(0, Math.round(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    var p = function(v){ return v < 10 ? '0' + v : '' + v; };
    return hh ? hh + ':' + p(mm) + ':' + p(ss) : mm + ':' + p(ss);
  }
  /* v331: FILM. A quiet link on the set and rest screens opens the phone's camera; the photo or clip is kept with
     this session for the Post screen (C3.post, IndexedDB). The numbers go under it there, never on it. */
  function filmLink(k){
    if(!C3.post || !C3.post.add) return '';
    return '<label class="wk-link wk-film" data-key="' + k + '">' + ic('camera', 15, 2.2) + '<span>Film' + (WK.filmed ? ' · ' + WK.filmed : '') + '</span>' +
      '<input type="file" accept="video/*,image/*" capture="environment" data-film aria-label="Film this set, or take a photo"></label>';
  }
  function onFilm(e){
    var el = e.target; if(!el || !el.hasAttribute || !el.hasAttribute('data-film') || !WK) return;
    var f = el.files && el.files[0], key = WK.key; if(!f) return;
    /* which set it shows: on the rest screen the one just logged, on the set screen the one about to be. The Post
       screen reads that row from the log when it makes the video, so the band says what was actually lifted. */
    var ref = safe(function(){
      if(WK.mode === 'rest' && WK.lastDone){ var b0 = WK.day.blocks.filter(function(b){ return b.id === WK.lastDone.id; })[0]; return {id: WK.lastDone.id, ri: WK.lastDone.ri, n: b0 ? b0.n : ''}; }
      var c = cur(); return c && c.r ? {id: c.bl.id, ri: c.ri, n: c.bl.n} : null;
    }, null);
    Promise.resolve(C3.post.add(f, key, ref ? {ref: ref} : null)).then(function(it){
      el.value = '';
      if(!it){ try{ say('That one could not be read here.', 'bad'); }catch(x){} return; }
      if(WK && WK.key === key){ WK.filmed = (WK.filmed || 0) + 1; try{ say((it.kind === 'video' ? 'Clip' : 'Photo') + ' kept for your post. ' + WK.filmed + ' so far.'); }catch(x){} if(C3.current === 'workout' && !(C3.screens.workout.hold && C3.screens.workout.hold())) C3.render(); }
    });
  }
  /* v331: THE LIVE BOARD. What this screen says, for the board page (api/live.js, live.html): the move, the set, the
     weight and reps, the rest clock, the sets done, the heart. C3.live sends it when it changes (and every 15 s), only
     while the person has the board on. Training numbers only. */
  function liveState(){
    if(!WK || !WK.day) return null;
    var N = counts(), L = log(), s = {day: String(WK.day.name || ''), done: N.done, total: N.total, unit: safe(function(){ return wU(); }, 'lb')};
    if(L.at) s.el = Math.max(0, Math.round((Date.now() - L.at) / 1000));
    var hb = safe(function(){ return (typeof HEART !== 'undefined' && HEART && HEART.bpm && heartFresh()) ? HEART.bpm : null; }, null); if(hb) s.hr = hb;
    var rc = WK.records && WK.records.length ? WK.records[WK.records.length - 1] : null; if(rc) s.rec = rc.n + ' ' + rc.word;
    if(WK.mode === 'done'){ s.mode = 'done'; return s; }
    var c = cur(); if(!c || !c.r){ s.mode = 'idle'; return s; }
    var warm = c.r.t === 'W', group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(c.r) + 1;
    s.mode = WK.mode === 'rest' ? 'rest' : WK.mode === 'hold' ? 'hold' : warm ? 'warm' : 'set';
    s.move = c.bl.n; s.set = no; s.of = group.length;
    if(WK.lb > 0) s.lb = safe(function(){ return wNum(WK.lb, 1); }, WK.lb);
    if(WK.reps > 0 && WK.sec == null) s.reps = WK.reps;
    if(WK.sec != null && WK.sec > 0) s.sec = WK.sec;
    if(s.mode === 'rest'){ s.left = restLeft(); s.len = WK.rest && WK.rest.total ? Math.round(WK.rest.total) : 0; s.next = c.bl.n + ' · ' + (warm ? 'Warm-up ' : 'Set ') + no + ' of ' + group.length; }
    return s;
  }
  function liveSend(force){ safe(function(){ if(C3.live && C3.live.on && C3.live.on()){ var st = liveState(); if(st) C3.live.send(st, force); } }); }
  C3.workoutLive = liveState;

  function viewDone(){
    var L = log(), N = counts(), W = h.week(), F = h.fractions();
    var end = L.fin || safe(function(){ var m = 0; Object.keys(L.rows || {}).forEach(function(id){ (L.rows[id] || []).forEach(function(r){ if(r && r.done && r.at > m) m = r.at; }); }); return m; }, 0) || Date.now();
    var elapsed = Math.max(0, end - (L.at || end));
    var keys = ['train', 'protein', 'water', 'steps'].filter(function(k){ return F[k].applies; });
    var ring = h.ringSVG({arcs: keys.map(function(k){ return {key:k, frac:F[k].frac}; }), start: keys.length === 4 ? 180 : 270, compact:true,
                          big: F.pct + '%', label:'Day ring, ' + F.pct + ' percent. ' + keys.join(', ')});
    var m = function(key, name, val){ return F[key].applies ? '<div class="wk-m ' + key + '"><span class="k"><i></i>' + name + '</span><span class="v c3-num">' + val + '</span></div>' : ''; };
    var meters = m('train', 'Train', F.train.done + ' / ' + F.train.planned) +
      m('protein', 'Protein', fmt.n(F.protein.now) + ' / ' + fmt.n(F.protein.target) + ' g') +
      m('water', 'Water', fmt.liters(F.water.now) + ' / ' + fmt.liters(F.water.target, 1) + ' L') +
      m('steps', 'Steps', fmt.n(F.steps.now) + ' / ' + fmt.n(F.steps.target));
    var recs = WK.records.length
      ? '<div class="wk-recs"><span class="k">' + (WK.records.length === 1 ? 'Record' : WK.records.length + ' records') + '</span>' +
        WK.records.slice(0, 3).map(function(x){ return '<span class="r">' + esc(x.n) + ' <b class="c3-num">' + esc(x.word) + '</b></span>'; }).join('') +
        (WK.records.length > 3 ? '<span class="r">+' + (WK.records.length - 3) + ' more</span>' : '') + '</div>' : '';
    return '<div class="wk done" data-state="done">' +
      '<div class="wk-l"><div class="wk-dh"><div class="wk-dtop"><div class="wk-dn' + (String(WK.day.name).length > 12 ? ' long' : '') + '">' + esc(WK.day.name).replace(/ (\S+)$/, '&nbsp;$1') + (WK.early && N.done < N.total ? '<span class="wk-dn-e"><span class="sep"> · </span>finished early</span>' : '') + '</div>' +
        /* v331: the session's numbers under their own photos and clips (the Post screen), up here so the end still fits one screen */
        '<button type="button" class="wk-link wk-postl" data-go="post" data-params="' + esc(JSON.stringify({key: WK.key})) + '" data-key="post">' + ic('camera', 16, 2.2) + '<span>Post it' + (WK.filmed ? ' · ' + WK.filmed : '') + '</span></button></div>' +
        '<div class="wk-dd"><h1 class="wk-done-w"><span class="c3-sr">Session </span>Done</h1><span class="wk-tag" aria-hidden="true">Earned.<br>Not given.</span></div></div>' +
      shayDone() +
      '<div class="wk-dm"><div class="wk-dpic"><div class="wk-photo-fallback"><b>Workout saved</b><span>Your sets are in History. Back to Today for what comes next.</span></div>' + h.pictureHTML('crew-celebrate-portrait', {eager:true}) + '</div>' +
        '<div class="wk-dside"><div class="wk-dring">' + ring + '<div class="l">of your day</div></div><div class="wk-meters">' + meters + '</div></div></div></div>' +
      '<div class="wk-r"><div class="wk-stats"><div><b class="c3-num">' + N.done + ' / ' + N.total + '</b><span>Sets</span></div>' +
        '<div><b class="c3-num">' + (W.planned > 0 ? W.done + ' of ' + W.planned : String(W.done)) + '</b><span>This week</span></div>' +
        '<div><b class="c3-num">' + clockWord(elapsed) + '</b><span>Elapsed</span></div></div>' +
      hrDoneHTML(L, end) + recs +
      '<div class="wk-d"><div class="wk-cta-rail"><button type="button" class="wk-cta back" '+(C3.daily&&C3.daily.state().active?'data-act="continue-day"':'data-go="today"')+' data-key="cta"><span>'+(C3.daily&&C3.daily.state().active?'Continue my day':'Back to Today')+'</span>' + ic('arrow', 34, 3) + '</button></div></div></div>' +
    '</div>';
  }

  /* v312: Shay says one of her win lines at the end (Chad's 10,000, brain/shaniqua/lines). The same
     line every time this session's end is shown; none when her sass is off. Beside the picture,
     never on it. */
  function shayDone(){
    var t = safe(function(){ return typeof window.shayEventLine === 'function' ? window.shayEventLine('wins_and_team', 'session:' + WK.key, 'finished my workout') : null; }, null);
    if(!t) return '';
    if(WK.spoke !== t){ WK.spoke = t; safe(function(){ if(typeof window.shaySpeak === 'function') window.shaySpeak(t); }); }   /* v313: out loud too, when Listen is on */
    var face = safe(function(){ return coachBadge('shaniqua', 96); }, '');
    return '<div class="wk-shay">' + (face ? '<img src="' + esc(face) + '" alt="" width="44" height="44">' : '') +
      '<p><b>Shay</b> ' + esc(t) + '</p></div>';
  }

  /* ---------- the rest clock: the screen's own, updated in place ---------- */
  function stopTimer(){ if(timer){ clearInterval(timer); timer = 0; } }
  function startTimer(){
    stopTimer();
    timer = setInterval(function(){
      if(!WK || WK.mode !== 'rest' || C3.current !== 'workout' || C3.mode !== 'on'){ stopTimer(); return; }
      var left = restLeft();
      if(left !== WK.restSaid && sayOn('count') && left > 0){ var cw = countCue(left); if(cw){ WK.restSaid = left; say(cw); } }
      if(left <= 0){ toSet(); buzz(30); return; }
      paintRest();
    }, 250);
  }
  function paintRest(){
    var root = C3.root; if(!root) return;
    var n = root.querySelector('[data-restnum]'), a = root.querySelector('[data-restarc]');
    if(!n || !a){ C3.render(true); return; }
    var left = restLeft(), t = String(left);
    if(n.textContent !== t){ n.textContent = t; var cl = root.querySelector('.wk-clock'); if(cl) cl.setAttribute('aria-label', 'Rest, ' + left + ' seconds left'); }
    a.setAttribute('stroke-dasharray', restDash());
  }
  function toSet(){ stopTimer(); WK.rest = null; WK.mode = 'set'; WK.guard = Date.now() + GUARD_MS; C3.render(true); }

  /* ---------- actions ---------- */
  function paintVals(){
    var root = C3.root, c = cur(); if(!root || !c || !c.r) return;
    var q = function(s){ return root.querySelector(s); };
    var a = q('[data-load]'); if(a) a.innerHTML = loadHTML(c);
    var p = q('[data-plates]'); if(p) p.innerHTML = platesHTML(c);
    var w = q('[data-v="w"]'); if(w) w.textContent = weightVal();
    var r = q('[data-v="r"]'); if(r) r.textContent = WK.reps > 0 ? String(WK.reps) : '--';
    var s = q('[data-v="s"]'); if(s) s.textContent = String(num(WK.sec));
    var sl = q('[data-setline]'); if(sl) sl.innerHTML = setLine(c);
    /* v311: the hold's start control and its quiet twin say the seconds the stepper now shows */
    var hg = q('[data-act="hold-go"]'); if(hg){ var hs = hg.querySelector('span'); if(hs) hs.textContent = 'Start ' + num(WK.sec) + ' s'; hg.setAttribute('aria-label', 'Start the ' + num(WK.sec) + ' second hold'); }
    var ha = q('[data-key="done-notimer"]'); if(ha) ha.textContent = 'Log ' + num(WK.sec) + ' s without the timer';
    ['w', 'r', 's'].forEach(function(k){
      var dn = q('[data-act="' + k + '-"]'), up = q('[data-act="' + k + '+"]');
      if(dn){ var a0 = atEnd(k, -1, c); if(a0 && root.activeElement === dn && up) up.focus({preventScroll:true}); dn.disabled = a0; }
      if(up){ var a1 = atEnd(k, 1, c); if(a1 && root.activeElement === up && dn) dn.focus({preventScroll:true}); up.disabled = a1; }
    });
  }
  function complete(){
    if(!WK || WK.mode !== 'set' || Date.now() < WK.guard) return;
    var c = cur(); if(!c || !c.r || c.r.done) return;                 /* tickSet toggles: only ever an undone row */
    var bl = c.bl, r = c.r, L = c.L, timed = r.sec !== undefined, warm = r.t === 'W';
    var liftedBefore = !!safe(function(){ return lastTime(bl.id, WK.key); }, null);
    var group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(r) + 1;
    var opts = {noRest:true, silent:true};                       /* no app toast over the thumb zone: a record is shown in the layout */
    if(timed){ r.sec = num(WK.sec) || 30; if(WK.lb > 0) opts.lb = WK.lb; }
    else{ if(!(WK.lb > 0)) r.lb = 0; opts.lb = WK.lb > 0 ? WK.lb : null; opts.reps = WK.reps > 0 ? WK.reps : null; }
    var res;
    try{ res = tickSet(L, bl, c.ri, WK.key, WK.day.blocks, opts); }catch(e){ console.error('[c3] workout tickSet', e); return; }
    if(!res || !res.ok || res.undone){ C3.render(true); return; }
    if(L.done.indexOf(bl.id) < 0) L.done.push(bl.id);                 /* as the app's session sheet does */
    try{ save(); }catch(e){}
    var record = res.records > 0 && liftedBefore && !warm;            /* a first-ever set is a baseline, not a record */
    if(record){ WK.records.push({n:bl.n, word:rowWord(r)}); buzz('record'); }   /* v317: a record buzzes like one */
    WK.lastDone = {id:bl.id, ri:c.ri, word:rowWord(r), label:(warm ? 'Warm-up ' : 'Set ') + no, record:record};
    var R = safe(function(){ return restFor(r, bl, WK.day.blocks); }, {sec:0});
    if(!next()){ finish(); return; }
    var restOn = safe(function(){ return trainCfg().rest !== false; }, true) && R.sec > 0 && !warm;   /* a warm-up ramps straight into the next one */
    WK.guard = Date.now() + GUARD_MS;
    if(restOn){ WK.mode = 'rest'; WK.rest = {end: Date.now() + R.sec * 1000, total: R.sec}; WK.restSaid = null; if(sayOn('rest')) say(restCue(R.sec)); startTimer(); }
    else{ WK.mode = 'set'; WK.rest = null; }
    C3.render(true);
  }
  /* THE END of a session, whichever way it is reached (the last set, Skip move past the last
     one, Finish early): the app's finish path through C3.h.finishSession(key), then DONE. */
  function finish(early){
    stopTimer(); disarm(); WK.rest = null;
    var ok = false;
    try{ ok = h.finishSession(WK.key); }catch(e){ console.error('[c3] workout finish', e); ok = false; }
    if(!ok){ C3.go('today'); return; }                               /* nothing was logged: there is no session to show */
    WK.early = !!early;
    WK.mode = 'done';
    C3.render(true);
    try{ window.scrollTo(0, 0); }catch(e){}
  }
  function disarm(){ if(armT){ clearTimeout(armT); armT = 0; } if(WK) WK.arm = 0; }
  function armFinish(){
    if(!WK || WK.mode === 'done' || !anyTicked()) return;
    disarm();
    WK.arm = Date.now();
    armT = setTimeout(function(){ armT = 0; if(WK){ WK.arm = 0; if(C3.current === 'workout' && C3.mode === 'on' && WK.mode !== 'done') C3.render(true); } }, ARM_MS);
    C3.render(true);
  }
  function finishEarly(){
    if(!WK || WK.mode === 'done' || !armed()) return;
    if(Date.now() < WK.arm + GUARD_MS) return;                       /* the second half of a double tap is not a yes */
    finish(true);
  }
  function undo(){
    if(!WK || WK.mode === 'done') return;
    var t = lastTicked(); if(!t) return;
    var L = log();
    try{ tickSet(L, t.bl, t.ri, WK.key, L.blocks, {noRest:true, silent:true}); }catch(e){ console.error('[c3] workout undo', e); return; }
    if(!rowsOf(L, t.bl).some(function(r){ return r.done; })){ var k = L.done.indexOf(t.bl.id); if(k >= 0) L.done.splice(k, 1); }
    try{ save(); }catch(e){}
    stopTimer(); disarm(); WK.rest = null; WK.mode = 'set'; WK.i = t.bi; WK.pos = ''; WK.lastDone = null; WK.guard = Date.now() + GUARD_MS;
    C3.render(true);
  }
  function skipMove(){
    if(!WK || WK.mode !== 'set') return;
    WK.i = (WK.i + 1) % WK.day.blocks.length; WK.pos = '';
    if(!next()){ finish(); return; }
    C3.render(true);
  }
  /* take the warm-up rows that are left off this move, the way the app's set menu deletes a set */
  function skipWarm(){
    var c = cur(); if(!c) return;
    for(var k = c.rows.length - 1; k >= 0; k--){ if(c.rows[k].t === 'W' && !c.rows[k].done && c.rows.length > 1) c.rows.splice(k, 1); }
    try{ syncBest(c.L, c.bl.id); save(); }catch(e){}
    WK.pos = '';
    C3.render(true);
  }
  function swap(){
    var c = cur(); if(!c || !WK.planned) return;
    try{
      viewWeekOffset = 0;
      if(typeof DAYUI !== 'undefined'){ var left = c.rows.filter(function(r){ return !r.done && r.t !== 'W'; }).length; DAYUI.swapLeft = left > 0 ? left : null; DAYUI.swap = c.bl.id; DAYUI.add = false; DAYUI.q = ''; }   /* the sheet writes swapLeft into this week's sets, so a mid-move swap replaces only the sets that are left */
      C3.sheet('day', {dow: WK.dow});
      /* while the app's sheet is up, look for the edit; render() itself never writes */
      stopWatch();
      watch = setInterval(function(){
        if(!WK || C3.current !== 'workout' || C3.mode !== 'on'){ stopWatch(); return; }
        var sh = document.getElementById('sheet'), open = !!(sh && !sh.hidden && typeof SH !== 'undefined' && SH === 'day');
        if(WK.mode === 'set' && resync()) C3.render(true);
        if(!open) stopWatch();
      }, 300);
    }catch(e){ console.error('[c3] workout swap', e); }
  }
  function stopWatch(){ if(watch){ clearInterval(watch); watch = 0; } }
  /* v344: Titan, between sets (Pro only, the app's coachPro()). The last set was too heavy or too easy: the next set
     moves one real step through the same stepper the screen uses (the plates, the dumbbell rack, the machine's step;
     reps for bodyweight, five seconds for a hold). Ask opens his chat asked what to do now, answered from the rows. */
  function coachWhat(c){ var timed = c.r.sec !== undefined; return timed ? 's' : (WK.lb > 0 || kindOf(c.bl) !== 'bodyweight') ? 'w' : 'r'; }
  function coachRow(c){
    if(!safe(function(){ return coachPro(); }, false)) return '';
    var t = safe(function(){ return h.coaches().filter(function(x){ return x.id === 'titan-kane'; })[0]; }, null); if(!t) return '';
    var w = coachWhat(c), dn = !atEnd(w, -1, c), up = !atEnd(w, 1, c);
    var cn = t.name || 'Kayne';   /* v366: the name the rest of the app shows (it read "Titan" here only) */
    return '<div class="wk-coach" role="group" aria-label="' + esc(cn) + ', about the last set"><img src="' + esc(t.badge) + '" alt="" width="36" height="36">' +
      '<span class="t"><b>' + esc(cn) + '</b>Last set?</span>' +
      '<button type="button" class="wk-link" data-act="c-heavy" data-key="c-heavy"' + (dn ? '' : ' disabled') + '>Too heavy</button>' +
      '<button type="button" class="wk-link" data-act="c-easy" data-key="c-easy"' + (up ? '' : ' disabled') + '>Too easy</button>' +
      '<button type="button" class="wk-link" data-act="c-ask" data-key="c-ask" aria-label="Ask ' + esc(cn) + ' what to do now">Ask</button></div>';
  }
  function coachStep(dir){
    var c = cur(); if(!c || !c.r || !safe(function(){ return coachPro(); }, false)) return;
    var w = coachWhat(c), nx = stepped(w, dir, c); if(nx == null || atEnd(w, dir, c)) return;
    if(w === 'w') WK.lb = nx; else if(w === 'r') WK.reps = nx; else WK.sec = nx;
    var word = w === 'w' ? safe(function(){ return loadTxt(nx); }, nx + '') : w === 'r' ? nx + ' reps' : nx + ' seconds';
    safe(function(){ window.say('Kayne: next set ' + word + '.'); });
    C3.render(true);
  }
  /* v344: "What do I do now?" asked in the middle of a workout is about the workout: the set, from the rows */
  C3.workoutNowText = function(){
    return safe(function(){
      if(!WK || !WK.day || C3.current !== 'workout' || WK.mode === 'done') return '';
      var c = cur(); if(!c || !c.r) return '';
      var warm = c.r.t === 'W', group = c.rows.filter(function(x){ return (x.t === 'W') === warm; }), no = group.indexOf(c.r) + 1;
      var load = WK.lb > 0 ? loadTxt(WK.lb) : '';
      var amt = WK.sec != null && WK.sec > 0 ? WK.sec + ' seconds' : WK.reps > 0 ? (load ? load + ' \u00d7 ' + WK.reps : WK.reps + ' reps') : load;
      var set = c.bl.n + ', ' + (warm ? 'warm-up ' : 'set ') + no + ' of ' + group.length + (amt ? ': ' + amt : '') + '.';
      var N = counts(), tail = ' ' + N.done + ' of ' + N.total + ' sets done.';
      if(WK.mode === 'rest' && restLeft() > 0) return 'Rest ' + restLeft() + ' more seconds. Then ' + set + tail;
      return 'Now: ' + set + tail;
    }, '');
  };
  function nudge(what, dir){
    var c = cur(); if(!c || !c.r) return;
    if(what === 'w') WK.lb = stepped('w', dir, c);
    else if(what === 'r') WK.reps = stepped('r', dir, c);
    else if(what === 's') WK.sec = stepped('s', dir, c);
    paintVals();
  }
  /* v330: this set last time (the same set number, last session), why today's weight is what it is, and one tap to
     put last time's numbers back */
  function lastLine(c, lt){
    var lr = WK.lr, first = !c.rows.slice(0, c.ri).some(function(x){ return x.done && x.t !== 'W'; });
    var out = lr ? 'This set last time: <b class="wk-lt">' + esc(rowWord(lr)) + '</b>' : (lt ? 'Last time: ' + esc(rowWord(lt)) : 'First time. This sets your baseline.');
    /* v374: the reason shows on a hold too ("One short. Same weight again before adding any."), not only on a jump */
    if(first && c.bl.why) out += '<span class="wk-why">' + esc(c.bl.why) + '</span>';
    var same = lr && ((lr.lb > 0 && +WK.lb !== +lr.lb) || (lr.reps > 0 && +WK.reps !== +lr.reps));
    if(same) out += '<button type="button" class="wk-link wk-same" data-act="same" data-key="same">Same as last time</button>';
    return out;
  }
  /* v366: More folds shut again once one of its links is used, and on every new set */
  function shutMore(){ if(C3.moreOpen) C3.moreOpen.wk = false; }
  function onClick(e){
    var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if(!b || !WK) return;
    var a = b.getAttribute('data-act');
    if(a === 'done') complete();
    else if(a === 'hold-go') startHold();
    else if(a === 'hold-stop') stopHold();
    else if(a === 'hold-cancel') cancelHold();
    else if(a === 'skip'){ if(WK.mode === 'rest' && Date.now() >= WK.guard) toSet(); }
    else if(a === 'more'){ if(WK.mode === 'rest' && WK.rest){ WK.rest.end += 30000; WK.rest.total += 30; paintRest(); } }
    else if(a === 'undo') undo();
    else if(a === 'end') C3.go('today');
    else if(a === 'continue-day' && C3.daily) C3.daily.openNext();
    else if(a === 'finish') armFinish();
    else if(a === 'finish-yes') finishEarly();
    else if(a === 'swap'){ shutMore(); swap(); }
    else if(a === 'skipmove'){ shutMore(); skipMove(); }
    else if(a === 'nowarm') skipWarm();
    else if(a === 'same'){ var lr = WK.lr; if(lr){ if(lr.lb > 0) WK.lb = +lr.lb; if(lr.reps > 0) WK.reps = +lr.reps; if(lr.sec != null) WK.sec = +lr.sec; paintVals(); C3.render(); } }
    else if(a === 'heart') C3.sheet('heart');
    else if(a === 'c-heavy') coachStep(-1);
    else if(a === 'c-easy') coachStep(1);
    else if(a === 'c-ask'){ if(safe(function(){ return coachPro(); }, false)){ C3.sheet('coach', {coach: 'titan-kane'}); safe(function(){ coachAsk('titan-kane', 'What do I do now?', {chip: true}); }); } }
    else if(a === 'w+' || a === 'w-') nudge('w', a === 'w+' ? 1 : -1);
    else if(a === 'r+' || a === 'r-') nudge('r', a === 'r+' ? 1 : -1);
    else if(a === 's+' || a === 's-') nudge('s', a === 's+' ? 1 : -1);
  }

  C3.screen('workout', {
    nav: 'train', chrome: false,
    enter: function(ctx){
      var ok = false;
      try{ ok = begin(ctx.params); }catch(e){ console.error('[c3] workout begin', e); ok = false; }
      if(!ok){ WK = null; setTimeout(function(){ try{ C3.go('train'); }catch(e){} }, 0); return false; }
      safe(function(){ if(typeof window.shayLoad === 'function') window.shayLoad('wins_and_team'); });   /* v312: Shay's line for the end, ready before it */
      safe(function(){ if(!hrOff && typeof window.heartOn === 'function') hrOff = window.heartOn(hrPaint); if(typeof window.heartResume === 'function') window.heartResume(); });   /* v315: the heart, live */
      hrLast = '';
      return true;
    },
    /* the countdown is painted in place; nothing outside may rebuild the screen under it */
    hold: function(){ return !!(WK && ((WK.mode === 'rest' && C3.root && C3.root.querySelector('[data-restnum]')) || (WK.mode === 'hold' && C3.root && C3.root.querySelector('[data-holdnum]')))); },
    render: function(){
      if(!WK) return '';
      if(WK.mode !== 'done' && !next()){ WK.mode = 'done'; stopTimer(); }
      if(WK.mode === 'rest' && !(WK.rest && restLeft() > 0)){ WK.mode = 'set'; WK.rest = null; }
      if(WK.mode === 'hold' && !WK.hold){ WK.mode = 'set'; }
      var html = WK.mode === 'done' ? viewDone() : WK.mode === 'rest' ? viewRest() : WK.mode === 'hold' ? viewHold() : viewSet();
      setTimeout(function(){ liveSend(false); }, 0);   /* v331: the board, after the screen has its values */
      return html;
    },
    wire: function(root){
      root.querySelectorAll('.wk-dpic img').forEach(function(img){
        var failed = function(){ img.parentNode.classList.add('photo-missing'); };
        img.addEventListener('error', failed, {once:true});
        if(img.complete && !img.naturalWidth) failed();
      });
      if(!root.__wk){ root.__wk = 1; root.addEventListener('click', onClick); root.addEventListener('change', onFilm); }
      if(WK && WK.mode === 'rest' && !timer) startTimer();
      if(WK && WK.mode === 'hold' && !timer) holdTimer();
    },
    leave: function(){ if(WK && WK.mode !== 'done') safe(function(){ if(C3.live && C3.live.on()) C3.live.send({mode: 'idle', day: String(WK.day && WK.day.name || '')}, true); }); stopTimer(); stopWatch(); disarm(); WK = null; if(hrOff){ try{ hrOff(); }catch(e){} hrOff = null; } }
  });

  /* for the tests: which of this screen's timers are running right now */
  C3.workoutTimers = function(){ return {rest: !!timer && !!WK && WK.mode === 'rest', hold: !!timer && !!WK && WK.mode === 'hold', watch: !!watch, arm: !!armT, up: !!WK}; };

  /* The app's own doors into a session (the day sheet's "Start the session", a saved workout's
     "Start now", a coach's button) all end in openLive(). With C3 up they open this screen
     instead of the session sheet. An empty quick workout still opens the app's sheet, which has
     the exercise picker this screen does not. */
  try{
    if(typeof window.openLive === 'function' && !window.openLive.__c3){
      var live0 = window.openLive;
      var live1 = function(key, d, wi){
        try{
          if(C3.mounted && C3.mode !== 'off' && d && !d.rest && !d.quick && d.blocks && d.blocks.length){
            try{ var sh = document.getElementById('sheet'); if(sh && !sh.hidden && typeof closeSheet === 'function') closeSheet(); }catch(x){}
            var today = safe(function(){ return dkey(Date.now()); }, ''), plan = safe(function(){ return weekAt(weekIndexNow())[new Date().getDay()]; }, null);
            var isPlan = key === today && plan && !plan.rest && sig(plan) === sig(d);
            if(C3.go('workout', isPlan ? {} : {key:key, day:d, wi:wi}) !== false) return;
          }
        }catch(e){ console.error('[c3] openLive', e); }
        return live0.apply(this, arguments);
      };
      live1.__c3 = 1;
      window.openLive = live1;
    }
  }catch(e){}
})();
