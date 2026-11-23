/* v359: THE LOG ON TRAIN. Chad, 26 Oct 2026: "make the workouts like Liftoff, logically easy to see your workouts and
   use them without clicking a million different screens for the information you need. Quick."
   Today's session on the Train tab as one list: every move, every set, what you did last time, the weight, the reps
   and a tick. Nothing to open: type a number if it changed, tap the tick. The rest counts down under the set just
   ticked. Every number is the app's own and every tick is the app's own tickSet, the same path the workout screen
   (START) and the watch use; the session is the same ALL.workLog[today] they write, so the two never disagree and
   a reload, START or the strip all show the same sets. The last set runs the app's finish path.
     C3.trlog.html(day)   the list, for today's planned session (day: the plan's day {name, blocks})
     C3.trlog.wire(root)  its controls */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  var DRAFT = {};          /* numbers typed but not ticked yet, by key|move|row; kept across repaints */
  var OPENW = {};          /* moves whose warm-up sets are shown one by one (folded into one row otherwise) */
  var FOLD = {};           /* a move folded or opened by hand, by key|move; otherwise a move folds once every set is in */
  var REST = null;         /* {end, total, id} after a working set is ticked */
  var tick = 0, armT = 0, ARMED = 0;
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  function num(v){ v = +v; return isFinite(v) ? v : 0; }
  function today(){
    return safe(function(){
      var wi = weekIndexNow(), dow = new Date().getDay(), day = weekAt(wi)[dow];
      return (day && !day.rest && day.blocks && day.blocks.length) ? {key: dkey(Date.now()), wi: wi, dow: dow, day: day} : null;
    }, null);
  }
  function logOf(S){ var L = safe(function(){ return (ALL.workLog || {})[S.key]; }, null); return L && L.blocks ? L : null; }
  /* what the workout screen's begin() does on START: the session in the log, every move's warm-ups ramped */
  function open(S){
    ALL.workLog = ALL.workLog || {};
    var L = ALL.workLog[S.key] = ALL.workLog[S.key] || {done: [], loads: {}, sets: {}};
    L.sets = L.sets || {}; L.done = L.done || []; L.at = L.at || Date.now();
    L.name = S.day.name; L.focus = S.day.focus; L.week = S.wi;
    L.blocks = h.sessionBlocks(L, S.day.blocks).map(function(b){ return {id: b.id, n: b.n, grp: b.grp, pat: b.pat, eq: b.eq, unil: b.unil, sets: b.sets, reps: b.reps, restSec: b.restSec, load: b.load, ss: b.ss, retired: !!b.retired}; });
    safe(function(){ sessionStamp(S.key); });
    S.day.blocks.forEach(function(bl){ safe(function(){ ensureRamp(L, bl, S.key); }); });
    safe(function(){ save(); });
    return L;
  }
  /* the rows a move will have: the log's own, or (before the first tick) the same rows worked out on a copy */
  function rowsOf(S, L, bl){
    if(L) return safe(function(){ return setRows(L, bl); }, []);
    var tmp = {done: [], loads: {}, sets: {}, rows: {}};
    safe(function(){ setRows(tmp, bl); ensureRamp(tmp, bl, S.key); });
    return (tmp.rows && tmp.rows[bl.id]) || [];
  }
  /* the numbers a row opens on: what tickSet would fill in (last time, else the program); inside one move the
     weight just lifted carries to the next set, as on the workout screen */
  /* the last session with this move in it: the app's lastTime (a weighted set), else the last one with reps or
     seconds in it, so a bodyweight move shows what you did too */
  function lastAny(id, key){
    var lt = safe(function(){ return lastTime(id, key); }, null); if(lt) return lt;
    return safe(function(){
      var keys = Object.keys(ALL.workLog || {}).filter(function(k){ return k < key; }).sort().reverse(), i, L, rows;
      for(i = 0; i < keys.length; i++){
        L = ALL.workLog[keys[i]]; rows = L && L.rows && L.rows[id];
        if(Array.isArray(rows) && rows.some(function(x){ return x.done && x.t !== 'W' && (x.reps > 0 || x.sec > 0); })) return {key: keys[i], at: L.at, rows: rows};
      }
      return null;
    }, null);
  }
  /* last time's set that matches this one: working set 2 against working set 2 (warm-ups change with the weight, so
     they are never matched). exact: only a set that was there; otherwise the last one, to start an added set from */
  function lastRow(lt, rows, ri, exact){
    var r = rows[ri]; if(!lt || !lt.rows || !r || r.t === 'W') return null;
    var n = 0, k; for(k = 0; k < ri; k++) if(rows[k].t !== 'W') n++;
    var work = lt.rows.filter(function(x){ return x.t !== 'W'; });
    var x = exact ? work[n] : work[Math.min(n, work.length - 1)];
    return x && x.done ? x : null;
  }
  function prefill(S, bl, rows, ri, lt){
    var r = rows[ri], lr = lastRow(lt, rows, ri, false);
    var lb = r.lb != null ? +r.lb : null, k;
    var prog = (bl.why && bl.load && bl.load.type === 'lb' && bl.load.value > 0) ? +bl.load.value : null;
    if(lb == null && r.t !== 'W'){
      for(k = ri - 1; k >= 0; k--){ if(rows[k].done && rows[k].t !== 'W' && rows[k].lb > 0){ lb = +rows[k].lb; break; } }
      if(lb == null) lb = prog != null ? prog : (lr && lr.lb) ? +lr.lb : ((bl.load && bl.load.type === 'lb' && bl.load.value > 0) ? +bl.load.value : null);
    }
    var reps = r.reps != null ? +r.reps : ((lr && lr.reps) ? +lr.reps : (+safe(function(){ return repTarget(bl.reps); }, '') || null));
    var sec = r.sec !== undefined ? (r.sec != null ? +r.sec : ((lr && lr.sec) ? +lr.sec : safe(function(){ return holdTarget(bl); }, 30))) : undefined;
    return {lb: lb > 0 ? lb : null, reps: reps, sec: sec, lr: lastRow(lt, rows, ri, true)};
  }
  /* Read the same fold state in the renderer and the click handler. */
  function isFolded(S, L, bi){
    var bl = S.day.blocks[bi], key = S.key + '|' + bl.id;
    if(FOLD[key] != null) return !!FOLD[key];
    var first = -1;
    S.day.blocks.some(function(b, i){
      var rows = rowsOf(S, L, b);
      if(!rows.length || rows.some(function(r){ return !r.done; })){ first = i; return true; }
      return false;
    });
    return bi !== first;
  }
  function validDraft(D, timed){
    var checks = [['lb', false], [timed ? 'sec' : 'reps', true]];
    return checks.every(function(c){
      var v = D[c[0]];
      if(v == null || v === '') return true;
      var n = Number(v);
      return isFinite(n) && (c[1] ? n > 0 && Math.floor(n) === n : n >= 0);
    });
  }
  function invalid(){
    safe(function(){ say('Enter a weight of 0 or more, and a whole number above 0 for reps or seconds. Nothing was logged.'); });
    return false;
  }
  function rowWord(r){
    if(!r) return '';
    if(r.sec !== undefined) return (r.lb > 0 ? safe(function(){ return loadTxt(r.lb); }, r.lb) + ' · ' : '') + num(r.sec) + ' s';
    return r.lb > 0 ? safe(function(){ return fmtW(loadNum(r.lb)); }, r.lb) + ' × ' + num(r.reps) : num(r.reps) + ' reps';
  }
  function shown(lb){ return lb > 0 ? safe(function(){ return fmtW(loadNum(lb)); }, String(lb)) : ''; }
  function counts(S, L){
    var done = 0, total = 0;
    h.sessionBlocks(L, S.day.blocks).forEach(function(bl){
      var n = h.sessionCount(L, bl); total += n.total; done += n.done;
    });
    return {done: done, total: total};
  }
  /* the two columns from 1024 px: each move spans as many 2 px rows as it is tall, the grid places it under the
     shorter column. Below that the list is one column and nothing is set. */
  function pack(root){
    var T = root && root.querySelector('.trl'); if(!T) return;
    var grid = safe(function(){ return getComputedStyle(T).display === 'grid'; }, false);
    T.querySelectorAll('.trl-move, .trl-top').forEach(function(m){
      m.style.gridRowEnd = '';
      if(!grid) return;
      var mb = parseFloat(getComputedStyle(m).marginBottom) || 0;
      m.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((m.getBoundingClientRect().height + mb) / 2));
    });
  }
  var packWired = false;
  function restLeft(){ return REST ? Math.max(0, Math.ceil((REST.end - Date.now()) / 1000)) : 0; }
  function clock(s){ return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  /* the rest, right under the set just ticked */
  function restHTML(){ return '<li class="trl-rest" role="timer" aria-live="off"><span>Rest</span><b class="c3-num" data-tlrest>' + clock(restLeft()) + '</b><button type="button" class="c3-link" data-act="tlrest" data-key="tlrest">Skip</button></li>'; }

  C3.trlog = {
    /* the list for today's planned session, or '' when today has none */
    html: function(){
      var S = today(); if(!S) return '';
      var L = logOf(S), N = counts(S, L), U = safe(function(){ return wU(); }, 'lb'), fin = !!(L && L.fin);
      var firstOpen = null;
      var moves = S.day.blocks.map(function(bl, bi){
        var rows = rowsOf(S, L, bl), lt = lastAny(bl.id, S.key);
        var timed = rows.some(function(r){ return r.sec !== undefined; });
        var warmN = 0, setN = 0, doneN = rows.filter(function(r){ return r.done; }).length;
        /* the warm-ups fold into one row: what they are, one tick for all of them; Show opens them one by one */
        var warmIx = [], warmDone = 0;
        rows.forEach(function(r, ri){ if(r.t === 'W'){ warmIx.push(ri); if(r.done) warmDone++; } });
        var fold = warmIx.length > 1 && !OPENW[S.key + '|' + bl.id], warmRow = '';
        if(fold){
          var allW = warmDone === warmIx.length, wTop = warmIx.reduce(function(m, ri){ return Math.max(m, +rows[ri].lb || 0); }, 0);
          /* v362: one short line (the five weights read as a row of numbers); Show opens them one by one */
          var wList = warmIx.length + ' sets' + (wTop > 0 ? ' to ' + shown(wTop) + ' ' + U : '');
          var isNextW = !allW && firstOpen === null; if(isNextW) firstOpen = 'W';
          warmRow = '<li class="trl-row wsum' + (allW ? ' done' : '') + (isNextW ? ' next' : '') + '">' +
            '<span class="s c3-num">W</span>' +
            '<span class="ws"><b>Warm-up</b><span class="c3-num">' + esc(wList) + '</span>' +
              '<button type="button" class="c3-link" data-act="tlwarm" data-b="' + bi + '" data-key="tlwarm-' + esc(bl.id) + '">Show</button></span>' +
            '<button type="button" class="trl-ok" data-act="tickwarm" data-b="' + bi + '" data-key="tickwarm-' + esc(bl.id) + '" aria-pressed="' + (allW ? 'true' : 'false') + '" aria-label="' + esc((allW ? (fin ? 'Logged: ' : 'Undo ') : 'Done: ') + 'all ' + warmIx.length + ' warm-up sets of ' + bl.n) + '"' + (fin ? ' disabled' : '') + '>' + h.icon('check', 22, 3.2) + '</button></li>';
        }
        var body = warmRow + rows.map(function(r, ri){
          if(fold && r.t === 'W') return '';
          var P = prefill(S, bl, rows, ri, lt), id = S.key + '|' + bl.id + '|' + ri, D = DRAFT[id] || {};
          var label = r.t === 'W' ? 'W' + (++warmN) : String(++setN);
          var isNext = !r.done && firstOpen === null; if(isNext) firstOpen = id;
          var lbV = D.lb != null ? D.lb : (r.done ? shown(r.lb) : shown(P.lb));
          var rpV = timed ? (D.sec != null ? D.sec : String(r.done ? num(r.sec) : num(P.sec))) : (D.reps != null ? D.reps : (r.done ? String(num(r.reps) || '') : (P.reps ? String(P.reps) : '')));
          var aria = (r.t === 'W' ? 'Warm-up ' + warmN : 'Set ' + setN) + ' of ' + bl.n;
          var restHere = REST && REST.id === bl.id && REST.ri === ri && restLeft() > 0;
          return '<li class="trl-row' + (r.done ? ' done' : '') + (isNext ? ' next' : '') + (r.t === 'W' ? ' warm' : '') + '">' +
            '<span class="s c3-num">' + esc(label) + '</span>' +
            '<span class="p c3-num' + (P.lr ? '' : ' none') + '">' + esc(P.lr ? rowWord(P.lr) : (!lt && r.t !== 'W' && setN === 1 ? 'First time' : '')) + '</span>' +
            '<label class="f"><span class="u">' + esc(U) + '</span><input class="trl-in c3-num" type="number" inputmode="decimal" min="0" step="any" data-tl="lb" data-id="' + esc(id) + '" value="' + esc(lbV) + '" placeholder="' + (r.t === 'W' || P.lb ? '' : 'BW') + '" aria-label="' + esc(aria) + ', weight in ' + esc(U) + '"' + (fin ? ' disabled' : '') + '></label>' +
            '<label class="f"><span class="u">' + (timed ? 'sec' : 'reps') + '</span><input class="trl-in c3-num" type="number" inputmode="numeric" min="1" step="1" data-tl="' + (timed ? 'sec' : 'reps') + '" data-id="' + esc(id) + '" value="' + esc(rpV) + '" aria-label="' + esc(aria) + ', ' + (timed ? 'seconds' : 'reps') + '"' + (fin ? ' disabled' : '') + '></label>' +
            '<button type="button" class="trl-ok" data-act="tick" data-b="' + bi + '" data-i="' + ri + '" data-key="tick-' + esc(bl.id) + '-' + ri + '" aria-pressed="' + (r.done ? 'true' : 'false') + '" aria-label="' + esc((r.done ? (fin ? 'Logged: ' : 'Undo ') : 'Done: ') + aria) + '"' + (fin ? ' disabled' : '') + '>' + h.icon('check', 22, 3.2) + '</button>' +
            '</li>' + (restHere ? restHTML() : '');
        }).join('');
        var full = rows.length && doneN >= rows.length;
        /* folded: one line. A move folds itself once every set is ticked, so the next one is near the top; a tap on
           its name folds or opens any move (Chad, 26 Oct: "make the workout sections collapsible") */
        var folded = isFolded(S, L, bi);
        var work = rows.filter(function(r){ return r.t !== 'W'; }), workDone = work.filter(function(r){ return r.done; });
        var best = null; workDone.forEach(function(r){ if(!best || (+r.lb || 0) > (+best.lb || 0) || ((+r.lb || 0) === (+best.lb || 0) && (+r.reps || +r.sec || 0) > (+best.reps || +best.sec || 0))) best = r; });
        var sum = workDone.length + ' / ' + work.length + ' sets' + (best ? ' · ' + rowWord(best) : '');
        var head = '<button type="button" class="trl-t" data-act="tlfold" data-b="' + bi + '" data-key="tlfold-' + esc(bl.id) + '" aria-expanded="' + (folded ? 'false' : 'true') + '">' +
          '<span class="nm">' + esc(bl.n) + '</span>' +
          /* v362: under the name, one line: folded, what was done; open, the prescription (the muscle group label and
             the boxed Watch went: the name says it, Watch is the round icon beside it) */
          (folded ? '<span class="sm c3-num">' + (full ? h.icon('check', 16, 3.2) : '') + '<span>' + esc(sum) + '</span></span>'
                  : '<span class="sm px c3-num"><span>' + esc(work.length + ' \u00d7 ' + (bl.reps || '')) + (bl.restSec ? ' · ' + (bl.restSec | 0) + ' s rest' : '') + '</span></span>') +
          '<svg class="cv" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>';
        if(folded){
          /* the rest after a move's last set stays in sight under its folded line */
          var restF = REST && REST.id === bl.id && restLeft() > 0 ? '<ol class="trl-rows">' + restHTML() + '</ol>' : '';
          return '<section class="trl-move folded' + (full ? ' full' : '') + '" aria-label="' + esc(bl.n) + '"><div class="trl-h">' + head + '</div>' + restF + '</section>';
        }
        return '<section class="trl-move' + (full ? ' full' : '') + '" aria-label="' + esc(bl.n) + '">' +
          '<div class="trl-h">' + head +
            '<div class="trl-x">' + h.watchHTML(bl.id, bl.n, {key: 'tlwatch-' + bl.id, icon: true}) + '</div></div>' +
          '<div class="trl-cols" aria-hidden="true"><span>Set</span><span>Last time</span><span>' + esc(U) + '</span><span>' + (timed ? 'Sec' : 'Reps') + '</span><span></span></div>' +
          '<ol class="trl-rows">' + body + '</ol>' +
          (fin ? '' : '<div class="trl-sets"><button type="button" class="c3-link" data-act="tladd" data-b="' + bi + '" data-key="tladd-' + esc(bl.id) + '">' + h.icon('plus', 16, 3) + '<span>Add set</span></button>' +
            (rows.filter(function(r){ return r.t !== 'W'; }).length > 1 && rows.length && !rows[rows.length - 1].done ? '<button type="button" class="c3-link yd-danger" data-act="tlless" data-b="' + bi + '" data-key="tlless-' + esc(bl.id) + '">Remove set</button>' : '') + '</div>') +
          '</section>';
      }).join('');
      /* Finish, once a working set is in: the big count is the hero's, right above */
      var ask = ARMED && Date.now() < ARMED + 4000;
      var top = (N.done > 0 && !fin) ? '<div class="trl-top"><button type="button" class="c3-btn-quiet trl-fin' + (ask ? ' pink' : '') + '" data-act="tlfin" data-key="tlfin">' + (ask ? 'Finish at ' + N.done + ' of ' + N.total + ' sets? Tap again' : 'Finish workout · ' + N.done + ' of ' + N.total + ' sets') + '</button></div>' : '';
      return '<p class="trl-guide">Check weight and reps, then tap the circle after each set. Start opens guided timers.</p><section class="trl" aria-label="Today\u2019s workout, every set">' + moves + top + '</section>';
    },
    wire: function(root){
      root.querySelectorAll('.trl-in').forEach(function(el){
        el.addEventListener('input', function(){ var d = DRAFT[el.getAttribute('data-id')] = DRAFT[el.getAttribute('data-id')] || {}; d[el.getAttribute('data-tl')] = el.value; });
        /* a logged set changed: logged again with the new numbers (the app's own tick, so records stay right) */
        el.addEventListener('change', function(){ var p = String(el.getAttribute('data-id')).split('|'); C3.trlog.edit(p[1], +p[2]); });
        el.addEventListener('focus', function(){ try{ el.select(); }catch(e){} });
      });
      root.querySelectorAll('[data-act="tick"],[data-act="tickwarm"],[data-act="tlwarm"],[data-act="tlfold"],[data-act="tlfin"],[data-act="tlrest"],[data-act="tladd"],[data-act="tlless"]').forEach(function(b){
        b.addEventListener('click', function(ev){
          ev.stopPropagation();
          var a = b.getAttribute('data-act');
          if(a === 'tick') C3.trlog.tick(+b.getAttribute('data-b'), +b.getAttribute('data-i'));
          else if(a === 'tickwarm') C3.trlog.warm(+b.getAttribute('data-b'));
          else if(a === 'tladd') C3.trlog.sets(+b.getAttribute('data-b'), 1);
          else if(a === 'tlless') C3.trlog.sets(+b.getAttribute('data-b'), -1);
          else if(a === 'tlwarm'){ var S0 = today(), bl0 = S0 && S0.day.blocks[+b.getAttribute('data-b')]; if(bl0){ OPENW[S0.key + '|' + bl0.id] = 1; C3.render(); } }
          else if(a === 'tlrest'){ REST = null; C3.render(); }
          else if(a === 'tlfold') C3.trlog.fold(+b.getAttribute('data-b'));
          else if(a === 'tlfin'){
            if(ARMED && Date.now() < ARMED + 4000 && Date.now() > ARMED + 450){ ARMED = 0; C3.trlog.finish(); return; }
            ARMED = Date.now(); clearTimeout(armT); armT = setTimeout(function(){ ARMED = 0; if(C3.current === 'train') C3.render(); }, 4000); C3.render();
          }
        });
      });
      pack(root);
      if(!packWired){
        packWired = true;
        var again = function(){ if(C3.current === 'train' && C3.root) pack(C3.root); };
        window.addEventListener('resize', again);
        safe(function(){ document.fonts.ready.then(again); });
      }
      if(REST && restLeft() > 0 && !tick){
        tick = setInterval(function(){
          var el = C3.root && C3.root.querySelector('[data-tlrest]'), left = restLeft();
          if(!REST || left <= 0 || C3.current !== 'train'){ clearInterval(tick); tick = 0; if(REST && left <= 0){ REST = null; safe(function(){ appBuzz([40, 60, 40]); }); if(C3.current === 'train') C3.render(); } return; }
          if(el) el.textContent = clock(left);
        }, 500);
      }
    },
    /* one tick: the app's tickSet on the row, with the numbers on screen; ticking a done row takes it back */
    tick: function(bi, ri){
      var S = today(); if(!S) return false;
      var bl = S.day.blocks[bi]; if(!bl) return false;
      var L = logOf(S); if(L && L.fin) return false;
      var preview = rowsOf(S, L, bl), draft = DRAFT[S.key + '|' + bl.id + '|' + ri] || {};
      if(!preview[ri]) return false;
      if(!preview[ri].done && !validDraft(draft, preview[ri].sec !== undefined)) return invalid();
      L = L || open(S);
      L.blocks = h.sessionBlocks(L, S.day.blocks);
      var rows = safe(function(){ return setRows(L, bl); }, []), r = rows[ri]; if(!r) return false;
      var id = S.key + '|' + bl.id + '|' + ri, D = DRAFT[id] || {}, opts = {noRest: true, silent: true};
      if(!r.done){
        var P = prefill(S, bl, rows, ri, lastAny(bl.id, S.key));
        var lb = D.lb != null && D.lb !== '' ? safe(function(){ return wIn(+D.lb); }, +D.lb) : P.lb;
        if(D.lb != null && D.lb !== '' && +D.lb === 0) r.lb = 0;
        if(r.sec !== undefined){ r.sec = num(D.sec != null && D.sec !== '' ? D.sec : P.sec) || 30; if(lb > 0) opts.lb = lb; }
        else{ opts.lb = lb > 0 ? lb : null; opts.reps = +(D.reps != null && D.reps !== '' ? D.reps : P.reps) || null; }
      }
      var res = safe(function(){ return tickSet(L, bl, ri, S.key, S.day.blocks, opts); }, null);
      if(!res || !res.ok){ C3.render(); return false; }
      delete DRAFT[id];
      if(res.undone){ if(!rows.some(function(x){ return x.done; })){ var k = L.done.indexOf(bl.id); if(k >= 0) L.done.splice(k, 1); } if(REST && REST.id === bl.id) REST = null; }
      else{
        if(L.done.indexOf(bl.id) < 0) L.done.push(bl.id);
        var R = safe(function(){ return restFor(r, bl, S.day.blocks); }, {sec: bl.restSec | 0});
        var restOn = safe(function(){ return trainCfg().rest !== false; }, true) && R && R.sec > 0 && r.t !== 'W';
        REST = restOn ? {end: Date.now() + R.sec * 1000, total: R.sec, id: bl.id, ri: ri} : null;
        if(res.records > 0 && r.t !== 'W') safe(function(){ appBuzz([25, 45, 25]); });
      }
      safe(function(){ save(); });
      /* every set of the session ticked: the app's finish path, as the workout screen does on its last set */
      var all = S.day.blocks.every(function(b){ return (setRows(L, b) || []).every(function(x){ return x.done; }); });
      if(all){ C3.trlog.finish(); return true; }
      C3.refresh();
      return true;
    },
    /* one more set (a copy of the last working set's numbers to start from) or one fewer (the last, if not logged) */
    sets: function(bi, dir){
      var S = today(); if(!S) return false;
      var bl = S.day.blocks[bi]; if(!bl) return false;
      var L = logOf(S); if(L && L.fin) return false;
      L = L || open(S);
      L.blocks = h.sessionBlocks(L, S.day.blocks);
      var rows = safe(function(){ return setRows(L, bl); }, []);
      var work = rows.filter(function(r){ return r.t !== 'W'; });
      if(dir > 0){
        if(rows.length >= safe(function(){ return SET_MAX; }, 60)) return false;
        var last = work[work.length - 1] || rows[rows.length - 1] || {};
        rows.push({lb: null, reps: null, rir: null, t: null, rR: last.rR === undefined ? undefined : null, sec: last.sec === undefined ? undefined : null, pt: last.pt === undefined ? undefined : null, done: false, at: null});
      }else{
        var end = rows[rows.length - 1];
        if(work.length <= 1 || !end || end.done || end.t === 'W') return false;
        delete DRAFT[S.key + '|' + bl.id + '|' + (rows.length - 1)];
        rows.pop();
      }
      safe(function(){ save(); });
      C3.refresh();
      return true;
    },
    /* a logged set's numbers changed: take the tick back and tick it again with the new numbers */
    edit: function(bid, ri){
      var S = today(); if(!S) return false;
      var bi = -1; S.day.blocks.forEach(function(b, k){ if(b.id === bid) bi = k; }); if(bi < 0) return false;
      var L = logOf(S); if(!L) return false;
      var bl = S.day.blocks[bi], rows = safe(function(){ return setRows(L, bl); }, []), r = rows[ri];
      if(!r || !r.done || L.fin) return false;
      var draft = DRAFT[S.key + '|' + bl.id + '|' + ri] || {};
      if(!validDraft(draft, r.sec !== undefined)) return invalid();
      var at = r.at;
      safe(function(){ tickSet(L, bl, ri, S.key, S.day.blocks, {noRest: true, silent: true}); });   /* back */
      var id = S.key + '|' + bl.id + '|' + ri, D = DRAFT[id] || {};
      if(D.lb != null && D.lb !== '') r.lb = +safe(function(){ return wIn(+D.lb); }, +D.lb) || 0;
      if(r.sec !== undefined){ if(D.sec != null && D.sec !== '') r.sec = +D.sec || r.sec; }
      else if(D.reps != null && D.reps !== '') r.reps = +D.reps || r.reps;
      var res = safe(function(){ return tickSet(L, bl, ri, S.key, S.day.blocks, {noRest: true, silent: true, at: at, lb: r.lb, reps: r.reps}); }, null);
      delete DRAFT[id];
      safe(function(){ save(); });
      C3.refresh();
      return !!(res && res.ok);
    },
    pack: function(){ pack(C3.root); },
    warm: function(bi){
      var S = today(); if(!S) return false;
      var bl = S.day.blocks[bi]; if(!bl) return false;
      var L = logOf(S); if(L && L.fin) return false;
      L = L || open(S);
      L.blocks = h.sessionBlocks(L, S.day.blocks);
      var rows = safe(function(){ return setRows(L, bl); }, []);
      var ix = []; rows.forEach(function(r, ri){ if(r.t === 'W') ix.push(ri); });
      var allDone = ix.every(function(ri){ return rows[ri].done; });
      ix.forEach(function(ri){ if(rows[ri].done === allDone) safe(function(){ tickSet(L, bl, ri, S.key, S.day.blocks, {noRest: true, silent: true}); }); });
      if(!allDone){ if(L.done.indexOf(bl.id) < 0) L.done.push(bl.id); }
      else if(!rows.some(function(x){ return x.done; })){ var k = L.done.indexOf(bl.id); if(k >= 0) L.done.splice(k, 1); }
      safe(function(){ save(); });
      C3.refresh();
      return true;
    },
    /* fold a move to one line, or open it */
    fold: function(bi){
      var S = today(); if(!S) return false;
      var bl = S.day.blocks[bi]; if(!bl) return false;
      var k = S.key + '|' + bl.id, L = logOf(S), rows = rowsOf(S, L, bl);
      var now = isFolded(S, L, bi);
      FOLD[k] = !now;
      C3.render();
      return !now;
    },
    finish: function(){
      var S = today(); if(!S) return false;
      REST = null; ARMED = 0;
      var ok = safe(function(){ return h.finishSession(S.key); }, false);
      if(ok) safe(function(){ say('<b>' + esc(S.day.name) + '</b> done.'); });
      C3.refresh();
      return ok;
    }
  };
})();

