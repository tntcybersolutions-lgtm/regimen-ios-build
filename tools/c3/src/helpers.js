/* C3 helpers: C3.h. Every number a screen shows comes from here, and everything
   here comes from the app's own functions, read at call time. Nothing is cached
   between calls (ALL and S are replaced on sync) and nothing is invented: when
   the app has no value, the helper returns an honest zero or null. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h;
  var DAY_MS = 86400000;
  var ABBR = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function num(v){ v = +v; return isFinite(v) ? v : 0; }
  function clamp01(x){ x = +x; return !(x > 0) ? 0 : x > 1 ? 1 : x; }

  /* ---------- text ---------- */
  h.esc = function(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var esc = h.esc;

  h.fmt = {
    /* 7500 -> "7,500" */
    n: function(v){ return Math.round(num(v)).toLocaleString('en-US'); },
    /* mL -> liters text without the unit: 0 -> "0.0", 250 -> "0.25", 3930 -> "3.93"; pass dp to force it (targets use 1) */
    liters: function(ml, dp){ ml = num(ml); if(dp == null) dp = (Math.round(ml) % 100 === 0) ? 1 : 2; return (ml / 1000).toFixed(dp); },
    /* a weight stored in lb, in the person's unit, with the unit: "230 lb" / "104.3 kg" */
    weight: function(lb, dp){ return safe(function(){ return wTxt(lb, dp); }, Math.round(num(lb)) + ' lb'); },
    /* the unit word alone */
    unit: function(){ return safe(function(){ return wU(); }, 'lb'); },
    /* what a block is loaded with: "230 lb", "Bodyweight", or "" when the app has no weight for it */
    load: function(bl){
      var L = bl && bl.load; if(!L) return '';
      if(L.type === 'bw') return 'Bodyweight';
      if(L.type === 'lb' && L.value > 0) return safe(function(){ return loadTxt(L.value); }, L.value + ' lb');
      return '';
    },
    /* "4 x 6-10" with a real multiplication sign */
    /* v311: a hold (plank, wall sit, carry, hang) is planned in seconds: "3 × 20 s" (isHoldMove and holdTarget, the app's one rule) */
    sets: function(bl){
      if(!bl) return '';
      if(typeof isHoldMove === 'function' && isHoldMove(bl)) return bl.sets + ' × ' + (typeof holdTarget === 'function' ? holdTarget(bl) : 30) + ' s';
      return bl.sets + ' × ' + bl.reps;
    },
    /* minutes -> "3.0" hours */
    hours: function(min){ return (num(min) / 60).toFixed(1); },
    /* Date or ms -> "FRI OCT 9" */
    date: function(d){ d = new Date(d); var t = function(x){ return x.charAt(0) + x.slice(1).toLowerCase(); }; return t(ABBR[d.getDay()]) + ' ' + t(MON[d.getMonth()]) + ' ' + d.getDate(); },   /* v364: Fri Oct 9, not FRI OCT 9 */
    dayAbbr: function(dow){ return ABBR[dow] || ''; },
    dayLong: function(dow){ return LONG[dow] || ''; },
    /* 0..1 -> whole percent */
    pct: function(frac){ return Math.round(clamp01(frac) * 100); },
    /* muscle group id -> the app's label ("hams" -> "Hamstrings") */
    group: function(g){ return safe(function(){ return grpLabel(g); }, g || ''); }
  };
  var fmt = h.fmt;

  /* "2 of 4 sessions this week" as plain text. Never "of 0": with nothing planned it is the
     count alone when there is one ("2 sessions this week"), else the honest note. */
  h.countOf = function(done, planned, word, none){
    done = done | 0; planned = planned | 0;
    if(planned > 0) return done + ' of ' + planned + ' ' + word;
    return done > 0 ? done + ' ' + word : (none || ('No ' + word));
  };

  /* ---------- first run, trial ---------- */
  /* the app's own first-run test (boot, CODEMAP 1.4): no dose ever and setup never finished */
  h.firstRun = function(){
    return safe(function(){ return !ALL.setupDone && !ALL.protocols.some(function(p){ return p.doses.length; }) && !(ALL.body && ALL.body.sex); }, false);
  };
  /* null unless the app's own rule would show the trial notice (trialBannerHTML):
     {state:'active'|'expired', daysLeft, text, short} */
  h.trial = function(){
    return safe(function(){
      if(!trialBannerHTML()) return null;
      var t = trialInfo();
      if(t.state === 'active') return {state:'active', daysLeft:t.daysLeft, text:'Trial: ' + t.daysLeft + ' day' + (t.daysLeft === 1 ? '' : 's') + ' left', short: t.daysLeft + ' day' + (t.daysLeft === 1 ? '' : 's') + ' left in trial'};
      return {state:'expired', daysLeft:0, text:'Trial ended', short:'Trial ended'};
    }, null);
  };

  /* ---------- the day ---------- */
  function logged(L){
    if(!L) return false;
    if(L.done && L.done.length) return true;
    var rows = L.rows || {};
    return Object.keys(rows).some(function(id){ return (rows[id] || []).some(function(r){ return r && r.done; }); });
  }
  function hardDoneOf(L, bl){
    var n = 0; ((L && L.rows || {})[bl.id] || []).forEach(function(r){ if(safe(function(){ return setMath(r).hard; }, false)) n++; });
    return n;
  }
  /* shared with the screens: "a session is logged" (any set ticked) and the sets done on one block */
  h.logged = logged;
  h.hardDoneOf = hardDoneOf;
  /* Keep logged moves when the remaining plan changes. Retired moves contribute only
     their completed sets, never their abandoned prescription or an undone next set. */
  h.sessionBlocks = function(L, blocks){
    var current = (blocks || []).map(function(b){ return Object.assign({}, b); });
    var ids = current.map(function(b){ return b.id; });
    (L && L.blocks || []).forEach(function(b){
      if(ids.indexOf(b.id) >= 0) return;
      var rows = (L.rows || {})[b.id] || [];
      if(!rows.some(function(r){ return r && r.done; })) return;
      current.push(Object.assign({}, b, {retired:true, sets:rows.filter(function(r){ return r && r.done && r.t !== 'W'; }).length}));
      ids.push(b.id);
    });
    return current;
  };
  h.sessionCount = function(L, bl){
    var rows = L && L.rows && L.rows[bl.id];
    var total = Array.isArray(rows) ? rows.filter(function(r){ return r && r.t !== 'W' && (!bl.retired || r.done); }).length : (bl.sets | 0);
    return {total:total, done:Math.min(hardDoneOf(L, bl), total)};
  };
  /* the warm-up routine the app ships: {id, name, word:"6 min · 9 holds", minutes, holds} */
  h.warmup = function(){
    return safe(function(){
      var r = routineById('pre_lift'); var st = routineSteps(r);
      return {id:'pre_lift', name:r.n, word:routineWord(r), minutes:Math.round(routineSeconds(r) / 60), holds:st.length, running: !!(MOBUI.run && MOBUI.run.id === 'pre_lift')};
    }, null);
  };
  /* TODAY, for real: the planned day (never the preview week), its log, and the count.
     {now, key, dow, wi, date, day, rest, name, focus, minutes, moves, log, hardDone, hardPlanned,
      started, done, rows:[{i, id, n, grp, group, sets, reps, restSec, load, loadTxt, setsText, hardDone, done}], warm} */
  h.today = function(){
    var now = Date.now(), date = new Date(now), dow = date.getDay(), key = safe(function(){ return dkey(now); }, '');
    var wi = safe(function(){ return weekIndexNow(); }, 0);
    var day = safe(function(){ return weekAt(wi)[dow]; }, null) || {day:dow, name:'Rest', focus:'Rest', rest:true, blocks:[], est:{minutes:0, sets:0, hardSets:0}};
    var L = safe(function(){ return (ALL.workLog || {})[key] || null; }, null);
    var blocks = L && L.fin && L.blocks && L.blocks.length ? L.blocks : h.sessionBlocks(L, day.blocks || []), hardPlanned = 0, hardDone = 0;
    var rows = blocks.map(function(bl, i){
      var count = h.sessionCount(L, bl), d = count.done, planned = count.total;
      hardPlanned += planned; hardDone += Math.min(d, planned);
      return {i:i, id:bl.id, n:bl.n, grp:bl.grp, group:fmt.group(bl.grp), sets:planned, reps:bl.reps, restSec:bl.restSec,
              load:bl.load || null, loadTxt:fmt.load(bl), setsText:fmt.sets(bl), hardDone:d, done: planned > 0 && d >= planned};
    });
    var fin = !!(L && L.fin);
    return {now:now, key:key, dow:dow, wi:wi, date:date, day:day, rest:!!day.rest, name:day.name || '', focus:day.focus || '',
            minutes:(day.est && day.est.minutes) || 0, moves:blocks.length, log:L, hardDone:hardDone, hardPlanned:hardPlanned,
            started: logged(L), done: !day.rest && hardPlanned > 0 && (hardDone >= hardPlanned || (fin && logged(L))),
            rows:rows, warm:h.warmup(),
            /* v330: lighter today (the app's week overrides), and whether it is one of their low days */
            lighter: (!day.rest && day.scaled > 0 && day.scaled < 1) ? Math.round((1 - day.scaled) * 100) : 0, lowDay: !!day.lowDay};
  };

  /* ---------- the week ---------- */
  /* the catch-up marks live inside the app's own this-week edits (trainCfg().overrides[wi].edit) */
  function editOf(wi, dow){ return safe(function(){ return dayEditOf(wi, dow); }, null); }
  /* THE WEEK, Sunday to Saturday around today, the way the app maps it (weekCardsHTML).
     {wi, weekNo, label, hardSets, minutes, hours, planned, done, todayDow, catchTo,
      days:[{dow, abbr, letter, long, date, key, at, isToday, past, rest, name, focus, minutes, moves, hardSets,
             blocks:[{id,n,grp,group,sets,reps}], logged, status, movedTo, movedFrom, canCatchUp}]}
     status: 'done' | 'today' | 'missed' | 'moved' | 'future' | 'rest' | 'paused' | 'before'
       done    a session is logged on that day (the app's own test: any set ticked)
       today   today, a session is planned, not finished
       missed  a past day with a session planned and nothing logged
       moved   a past day whose session was caught up onto another day (movedTo)
       future  a coming day with a session planned (movedFrom when it is a catch-up)
       rest    nothing planned
       paused  a past day the person marked as a planned break
       before  a past day from before this plan started (never called missed) */
  h.week = function(){
    var now = Date.now(), todayDow = new Date(now).getDay(), todayKey = safe(function(){ return dkey(now); }, '');
    var wi = safe(function(){ return weekIndexNow(); }, 0);
    var wk = safe(function(){ return weekAt(wi); }, []) || [];
    var vol = safe(function(){ return weekVolume(wk); }, {hardSets:0, minutes:0});
    var cfg = safe(function(){ return trainCfg(); }, {});
    var startKey = cfg.startedAt ? safe(function(){ return dkey(cfg.startedAt); }, '') : '';
    var days = [], planned = 0, done = 0, i;
    for(i = 0; i < 7; i++){
      var d = wk[i] || {day:i, name:'Rest', focus:'Rest', rest:true, blocks:[], est:{minutes:0, hardSets:0}};
      var dt = new Date(now); dt.setDate(dt.getDate() - (todayDow - i)); dt.setHours(12, 0, 0, 0);
      var key = safe(function(){ return dkey(dt.getTime()); }, '');
      var L = safe(function(){ return (ALL.workLog || {})[key] || null; }, null);
      var isLogged = logged(L), own = !!(d.rest && L && L.blocks && L.blocks.length && isLogged);
      var blocks = own ? L.blocks : (d.blocks || []);
      var E = editOf(wi, i) || {};
      var past = i < todayDow, isToday = i === todayDow;
      var movedOk = false;
      if(d.rest && E.c3to != null){ var Et = editOf(wi, E.c3to); movedOk = !!(Et && Et.c3from === i); }
      var status;
      if(isToday) status = own ? 'done' : (d.rest ? 'rest' : 'today');
      else if(isLogged) status = 'done';
      else if(d.rest) status = (past && movedOk) ? 'moved' : 'rest';
      else if(past) status = (startKey && key < startKey) ? 'before' : (safe(function(){ return isPaused(key); }, false) ? 'paused' : 'missed');
      else status = 'future';
      days.push({
        dow:i, abbr:ABBR[i], letter:ABBR[i].charAt(0), long:LONG[i], date:dt.getDate(), key:key, at:dt.getTime(),
        isToday:isToday, past:past, rest: !!d.rest && !own,
        name: own ? (L.name || 'Logged session') : (status === 'moved' ? (E.c3name || d.wasName || 'Rest') : (d.rest ? 'Rest' : d.name)),
        focus: d.focus || '', minutes: (d.est && d.est.minutes) || 0, moves: blocks.length,
        hardSets: (d.est && d.est.hardSets) || 0,
        blocks: blocks.map(function(b){ return {id:b.id, n:b.n, grp:b.grp, group:fmt.group(b.grp), sets:b.sets, reps:b.reps}; }),
        logged:isLogged, status:status,
        movedTo: (status === 'moved') ? E.c3to : null,
        movedFrom: (!d.rest && E.c3from != null) ? E.c3from : null,
        canCatchUp:false
      });
    }
    /* today's own state comes from h.today(): a finished session reads done */
    var T = h.today();
    if(T.done) days[todayDow].status = 'done';
    days.forEach(function(x){
      var plannedDay = x.status === 'done' || x.status === 'today' || x.status === 'missed' || x.status === 'future';
      if(plannedDay) planned++;
      if(x.status === 'done') done++;
    });
    /* where a missed session can go: the first day from today on that is rest and has nothing logged */
    var catchTo = null;
    for(i = todayDow; i < 7; i++){ if(days[i].status === 'rest' && !days[i].logged){ catchTo = i; break; } }
    days.forEach(function(x){ x.canCatchUp = x.status === 'missed' && catchTo != null; });
    var goal = safe(function(){ return (GOALS.filter(function(g){ return g[0] === cfg.goal; })[0] || [])[1]; }, '') || '';
    var prog = safe(function(){ return progById(cfg.prog); }, null);
    /* v343: plain words ("4 days a week, lose fat and build muscle"), not "4-day Recomp" */
    var GW = {fatloss:'lose fat', muscle:'build muscle', recomp:'lose fat and build muscle', strength:'get stronger', maintain:'hold steady'};
    var plain = GW[cfg.goal] || String(goal || '').toLowerCase(), nd = cfg.days || planned;
    return {wi:wi, weekNo:wi + 1, label: prog ? prog.n : (nd + (nd === 1 ? ' day' : ' days') + ' a week' + (plain ? ', ' + plain : '')),
            hardSets: vol.hardSets || 0, minutes: vol.minutes || 0, hours: fmt.hours(vol.minutes || 0),
            planned:planned, done:done, todayDow:todayDow, todayKey:todayKey, catchTo:catchTo, days:days};
  };

  /* ---------- targets and the day ring ---------- */
  /* {training, protein (g or null), kcal (or null), water (mL), steps} from the app's own target functions */
  h.targets = function(){
    var tr = safe(function(){ return isTrainingToday(); }, false);
    return {
      training: tr,
      protein: safe(function(){ return proteinTarget(); }, null),
      kcal: safe(function(){ var c = calorieTarget(); return c ? c.kcal : null; }, null),
      /* v339: no weight on file, no water target (the app's fallback is a 200 lb person) */
      water: safe(function(){ return ((ALL.body && ALL.body.wt > 0) || (ALL.weights || []).length) ? hydrationTarget(tr) : 0; }, 0),
      steps: safe(function(){ return stepTarget(tr); }, 0)
    };
  };
  /* THE DAY: each part 0..1 and the day percent = the mean of the parts that apply today
     (train, protein, water, steps on a training day; protein, water, steps on a rest day).
     {training, train:{applies,done,planned,frac}, protein:{applies,now,target,frac},
      water:{applies,now,target,frac}, steps:{applies,now,target,frac},
      parts:[{key,frac,closed}] (ring order), pct, closed, of} */
  h.fractions = function(){
    var T = h.today(), G = h.targets(), k = T.key;
    var p = safe(function(){ return dayTotals(k).p; }, 0) || 0;
    var w = safe(function(){ return (ALL.hydration || {})[k] || 0; }, 0);
    var s = safe(function(){ return (ALL.steps || {})[k] || 0; }, 0);
    var train = {applies: !T.rest && T.hardPlanned > 0, done:T.hardDone, planned:T.hardPlanned, frac: T.hardPlanned ? clamp01(T.hardDone / T.hardPlanned) : 0};
    var protein = {applies: G.protein > 0, now: Math.round(p), target: G.protein || null, frac: G.protein > 0 ? clamp01(p / G.protein) : 0};
    var water = {applies: G.water > 0, now: w, target: G.water, frac: G.water > 0 ? clamp01(w / G.water) : 0};
    var steps = {applies: G.steps > 0, now: s, target: G.steps, frac: G.steps > 0 ? clamp01(s / G.steps) : 0};
    var parts = [];
    if(train.applies) parts.push({key:'train', frac:train.frac});
    if(protein.applies) parts.push({key:'protein', frac:protein.frac});
    if(water.applies) parts.push({key:'water', frac:water.frac});
    if(steps.applies) parts.push({key:'steps', frac:steps.frac});
    var sum = 0, closed = 0;
    parts.forEach(function(x){ sum += x.frac; x.closed = x.frac >= 1; if(x.closed) closed++; });
    return {training: train.applies, train:train, protein:protein, water:water, steps:steps, parts:parts,
            pct: parts.length ? Math.round(sum / parts.length * 100) : 0, closed:closed, of:parts.length};
  };

  /* add water to today, the app's own way (ALL.hydration[dayKey] in mL, save, repaint), with Undo */
  h.addWater = function(ml){
    ml = Math.round(num(ml)); if(!(ml > 0)) return false;
    return safe(function(){
      var k = dkey(Date.now());
      ALL.hydration = ALL.hydration || {};
      var had = Object.prototype.hasOwnProperty.call(ALL.hydration, k), before = ALL.hydration[k] || 0;
      ALL.hydration[k] = before + ml;
      save(); drawAll();
      offerUndo('<b>' + ml + ' mL</b> · ' + fmt.liters(ALL.hydration[k]) + ' L today.', function(){
        var cur = (ALL.hydration || {})[k] || 0, next = Math.max(0, cur - ml);
        if(next <= 0 && !had) delete ALL.hydration[k]; else ALL.hydration[k] = next;
      });
      return true;
    }, false);
  };

  /* THE RING: n arcs with a faint track, drawn as SVG; the live number is HTML laid over it.
     opts: { arcs:[{key, color, frac}]   clockwise, in order
             start: degrees               where the first arc's slot begins (0 = 3 o'clock, 270 = 12 o'clock);
                                          default 180 for four arcs, 270 otherwise (the approved layouts)
             compact: true                the phone drawing: thicker band, solid start dots
             top, big, bottom             three lines of HTML for the middle (already escaped)
             label                        aria-label for the picture
             cls                          extra class on the wrapper }
     Returns one <div class="c3-ring">; size it with CSS width (it is square). */
  h.RING_COLORS = {plan:'#FFFFFF', dose:'#B98CFF', train:'#5CF2B0', protein:'#FF4FCB', water:'#7FB0FF', steps:'#FFB85C'};   /* v339: plan */
  h.ringSVG = function(o){
    o = o || {};
    var arcs = (o.arcs || []).filter(Boolean), n = arcs.length;
    var c = 220, R = o.compact ? 188.6 : 184, SW = o.compact ? 45 : 34, GAP = 7.8;
    var start = o.start != null ? +o.start : (n === 4 ? 180 : 270);
    var slot = n ? 360 / n : 360;
    function pt(r, deg){ var a = deg * Math.PI / 180; return (Math.round((c + r * Math.cos(a)) * 10) / 10) + ' ' + (Math.round((c + r * Math.sin(a)) * 10) / 10); }
    function arc(r, a0, a1){ return 'M ' + pt(r, a0) + ' A ' + r + ' ' + r + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' + pt(r, a1); }
    var s = '<svg viewBox="0 0 440 440" role="img" aria-label="' + esc(o.label || 'Day ring') + '" focusable="false">' +
            '<circle cx="220" cy="220" r="' + (o.compact ? 156 : 165) + '" fill="rgba(255,255,255,0.1)"></circle>';
    arcs.forEach(function(a, i){
      var a0 = start + i * slot + GAP, a1 = start + (i + 1) * slot - GAP;
      var len = R * (a1 - a0) * Math.PI / 180, f = clamp01(a.frac), col = a.color || h.RING_COLORS[a.key] || '#5CF2B0';
      var d = arc(R, a0, a1), p0 = pt(R, a0).split(' ');
      s += '<g data-arc="' + esc(a.key || i) + '">' +
        '<path d="' + d + '" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="' + SW + '" stroke-linecap="round"></path>' +
        '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-opacity="' + (o.compact ? '.1' : '.07') + '" stroke-width="' + SW + '" stroke-linecap="round"></path>' +   /* v360: on black a stronger tint read as a full ring */
        '<path d="' + arc(R + SW / 2 - 1 + (o.compact ? 5 : 0), a0 - (o.compact ? 2 : 0), a1 + (o.compact ? 2 : 0)) + '" fill="none" stroke="' + col + '" stroke-opacity="' + (o.compact ? '.9' : '.8') + '" stroke-width="' + (o.compact ? 3 : 1.5) + '" stroke-linecap="round"></path>' +
        (o.compact ? '' : '<path d="' + arc(R - SW / 2 + 1, a0, a1) + '" fill="none" stroke="' + col + '" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"></path>') +
        '<path class="c3-ring-val" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + SW + '" stroke-linecap="round" stroke-dasharray="' + (Math.round(f * len * 10) / 10) + ' 2000"' + (o.compact && !(f > 0) ? ' stroke-opacity="0"' : '') + ' style="filter:drop-shadow(0 0 9px ' + col + ')"></path>' +
        (o.compact
          ? '<circle cx="' + p0[0] + '" cy="' + p0[1] + '" r="22.6" fill="' + col + '" style="filter:drop-shadow(0 0 12px ' + col + ')"></circle><circle cx="' + p0[0] + '" cy="' + p0[1] + '" r="7" fill="#FFFFFF"></circle>'
          : '<circle class="c3-ring-pulse" cx="' + p0[0] + '" cy="' + p0[1] + '" r="22" fill="none" stroke="' + col + '" stroke-width="2"></circle><circle cx="' + p0[0] + '" cy="' + p0[1] + '" r="5" fill="#FFFFFF"></circle>') +
        '</g>';
    });
    s += '</svg>';
    var mid = (o.top != null || o.big != null || o.bottom != null)
      ? '<div class="c3-ring-mid">' + (o.top != null ? '<span class="c3-ring-top">' + o.top + '</span>' : '') +
        (o.big != null ? '<span class="c3-ring-big">' + o.big + '</span>' : '') +
        (o.bottom != null ? '<span class="c3-ring-bot">' + o.bottom + '</span>' : '') + '</div>' : '';
    return '<div class="c3-ring' + (o.compact ? ' compact' : '') + (o.cls ? ' ' + esc(o.cls) : '') + '">' + s + mid + '</div>';
  };

  /* ---------- coaches ---------- */
  var BRAIN_ID = {today:'console', train:'train', workout:'train', food:'food', progress:'recap', you:'crew'};
  /* which kinds of coach-log message may stand on which screen: only messages about the
     person's own training, food, water, steps or weight. Anything not listed never shows. */
  var TRAIN_KINDS = ['missed-day', 'gap', 'streak', 'post-session', 'pr', 'stall', 'deload', 'week-review', 'lighter', 'move', 'volume', 'swap'];
  var LINE_KINDS = {
    today: TRAIN_KINDS.concat(['protein-low', 'hydration', 'steps-low', 'weigh-in', 'win']),
    train: TRAIN_KINDS, workout: TRAIN_KINDS,
    food: ['protein-low', 'hydration', 'plateau'],
    progress: ['weigh-in', 'plateau', 'pr', 'streak', 'week-review', 'stall', 'win'],
    you: []
  };
  /* first net: the message's own kind / key / link, from the app's data */
  var PROMO_KEY = /welcome|guide|book|plan-?hub|shop|store|promo|trial|upgrade|pro\b/i;
  /* second net: the words. A link, the guide, the plan hub, the book, the shop, the brand site. */
  var PROMO_TEXT = /https?:|www\.|\.co\b|\.com\b|formed\s*labs|formedlabs|\bguide\b|plan hub|plan book|\bbook\b|\bshop\b|\bstore\b|\bbuy\b|free plan|welcome in/i;
  function laneWords(t){ try{ return LANE_RE.test(t); }catch(e){ return false; } }
  function cleanText(t){ t = String(t || '').trim(); return !!t && !PROMO_TEXT.test(t) && !laneWords(t); }
  /* may this coach-log message be a coach line on this screen, right now? */
  function lineOk(m, screen, T){
    if(!m || !m.text || !m.kind) return false;
    if((LINE_KINDS[screen] || []).indexOf(m.kind) < 0) return false;          /* welcome, guide and every unknown kind stop here */
    if(PROMO_KEY.test(String(m.key || ''))) return false;
    if(m.go && m.go.url) return false;                                         /* an outbound link is never a coach line */
    if(m.proposal && (m.decided != null || m.acted != null)) return false;     /* an answered question is not asked again */
    if(!cleanText(m.text)) return false;
    var now = Date.now();
    if(!(m.at <= now) || now - m.at > 36 * 3600000) return false;
    var sameDay = safe(function(){ return dkey(m.at) === dkey(now); }, false);
    if(screen !== 'progress' && !sameDay) return false;                        /* yesterday's nudge is not today's line */
    if(T && T.done && ['post-session', 'pr', 'streak', 'week-review', 'protein-low', 'hydration', 'steps-low', 'weigh-in', 'win'].indexOf(m.kind) < 0 && screen !== 'food' && screen !== 'progress') return false;
    return true;
  }
  /* a line built from the person's own numbers, when the coaches have said nothing usable.
     One short sentence. Only facts h.today / h.week / h.fractions hold. */
  function builtLine(screen, T, W){
    if(screen === 'food'){
      var F = h.fractions().protein;
      if(!F.target) return 'Log a weigh-in and your protein target shows up here.';
      var left = Math.max(0, Math.round(F.target - F.now));
      return left > 0 ? left + ' g of protein left today.' : 'Protein is closed for today: ' + fmt.n(F.now) + ' of ' + fmt.n(F.target) + ' g.';
    }
    if(screen === 'progress'){
      var n = safe(function(){ return (ALL.weights || []).length; }, 0);
      if(n === 0) return 'No weigh-in yet. The trend starts with the first two.';
      if(n === 1) return 'One weigh-in. The trend starts with the second.';
      return h.countOf(W.done, W.planned, 'sessions this week', 'No sessions planned this week') + ', ' + n + ' weigh-ins on the log.';
    }
    if(screen === 'you') return h.countOf(W.done, W.planned, 'sessions this week', 'No sessions planned this week') + '.';
    /* today, train, workout */
    if(T.rest){
      /* v309: a free rest day with a session that can move here says so, the same as the big button */
      var Pc = h.pullCandidate();
      if(Pc) return Pc.kind === 'missed' ? Pc.name + ' did not happen yet. Today is open: do it today and the week is back on track.'
                                         : Pc.name + ' is ready whenever you are. Do it today, or rest and it waits.';
      return 'Rest day. Steps and water still count.';
    }
    if(T.done) return T.name + ' is logged. Water and protein, then rest.';
    if(T.started) return T.hardDone + ' of ' + T.hardPlanned + ' sets in. Finish ' + T.name + '.';
    var y = W.days[T.dow - 1];
    if(y && y.status === 'missed') return 'Nothing on yesterday. No guilt. ' + T.name + ' today puts the week back.';
    return T.name + ' is on the board: ' + T.moves + ' moves, about ' + T.minutes + ' min.';
  }
  /* THE COACH LINE for a screen ('today' | 'train' | 'workout' | 'food' | 'progress' | 'you').
     Always about the person's own day or the screen they are on. NEVER a welcome, a guide,
     a plan-book, a shop or any other outbound or marketing message, and never a line that
     names a compound or a dose (lane rule). In this order:
       1. the model's read for that screen (brainLine), if it passes the same filter
       2. the newest coach-log message of a kind that belongs on that screen (LINE_KINDS)
       3. one sentence built from the real numbers (builtLine)
     Screens use ONLY this; they never read ALL.coach.log or coachPresence() themselves.
     {id, name, first, text, badge, live, from:'brain'|'log'|'data', kind} */
  h.coachLine = function(screen){
    try{
      if(!LINE_KINDS[screen]) screen = 'today';
      var T = h.today(), W = h.week(), st = coachState(), out = null;
      var lead = coachById(st.lead) || coachById('dakota-jane');
      var owner = safe(function(){ return coachById(brainOwner(BRAIN_ID[screen])); }, null) || lead;
      var bl = (typeof brainLine === 'function') ? brainLine(BRAIN_ID[screen]) : null;
      if(bl && cleanText(bl.text)) out = {coach: coachById(bl.coach) || owner, text: bl.text, live:true, from:'brain', kind:''};
      if(!out && st.on !== false){
        var m = (st.log || []).slice().sort(function(a, b){ return b.at - a.at; }).filter(function(x){ return lineOk(x, screen, T); })[0];
        if(m) out = {coach: coachById(m.coach) || owner, text: m.text, live:true, from:'log', kind:m.kind,
                     ask: (m.proposal && m.decided == null && m.acted == null) ? {id:m.id, yes:m.proposal.yes || 'Yes'} : null};
      }
      if(!out) out = {coach: (screen === 'today' || screen === 'you') ? lead : owner, text: builtLine(screen, T, W), live:false, from:'data', kind:''};
      if(!out.coach || !out.text) return null;
      var c = out.coach;
      return {id:c.id, name:c.name, first:String(c.name).split(' ')[0], text:String(out.text), badge:h.badge(c.id), live:out.live, from:out.from, kind:out.kind, ask:out.ask || null};
    }catch(e){ try{ console.error('[c3] coachLine', e); }catch(x){} return null; }
  };
  /* round badge of a coach, from the story bundle */
  h.badge = function(id){ return safe(function(){ return coachBadge(id, 256); }, ''); };
  /* [{id, name, role, badge}] the four coaches, in the app's order */
  h.coaches = function(){ return safe(function(){ return COACHES.map(function(c){ return {id:c.id, name:c.id === 'titan-kane' ? 'Kayne' : c.id === 'shaniqua' ? 'Shay' : c.name, role:c.role, badge:h.badge(c.id)}; }); }, []); };

  /* ---------- pictures ---------- */
  /* files that exist in story/scenes (checked when this was written): [w, h, alt] */
  var PHOTOS = {
    'welcome-your-team':       [1671, 941,  'The four formed labs coaches standing together outside at sunset'],
    'one-team-every-goal':     [1672, 941,  'The whole gym floor, coaches training with members under the One team, every goal sign'],
    'train-squat':             [1254, 1254, 'Dakota Jane, seen from behind, at the bottom of a barbell squat in the rack under the formed labs sign'],
    'train-heavy':             [1254, 1254, 'Kayne setting up a heavy barbell deadlift under the formed labs sign'],
    'train-row':               [1254, 1254, 'Dakota Jane doing a one-arm dumbbell row on a bench'],
    'train-log':               [1254, 1254, 'Dakota Jane pressing dumbbells overhead on a bench while Shay films the set'],
    'train-team':              [1254, 1254, 'Dakota Jane, Kayne and Shay training together with bands, ropes and a medicine ball'],
    'dakota-stretch':          [1672, 941,  'Dakota Jane in a wide seated stretch on a mat on the gym floor, reaching for her foot'],
    'nova-stretch':            [1536, 1024, 'Nova Reyes stretching on a mat with two members'],
    'crew-celebrate-portrait': [1024, 1536, 'The coaches celebrating with a member who is ringing the bell'],
    'nova-cook':               [1024, 1536, 'Nova Reyes walking through the kitchen bar with a tablet'],
    'nova-water':              [1536, 1024, 'Nova Reyes handing a water bottle to a member at the hydration station'],
    'fuel-readout':            [1672, 941,  'Nova Reyes showing a member a nutrition readout on a big screen'],
    'first-session':           [1672, 941,  'Dakota Jane coaching a member through a first session'],
    'titan-kane-hero':         [1024, 1536, 'Kayne standing with a loaded barbell']
  };
  /* URL of a picture that exists, or '' (and a console warning) for a name that is not in the table */
  h.photo = function(name){
    if(!PHOTOS[name]){ try{ console.warn('[c3] no picture named', name); }catch(e){} return ''; }
    var base = safe(function(){ return STORY.base; }, null) || 'story/';
    return base + 'scenes/' + name + '.webp';
  };
  /* {src, w, h, ratio:"1254 / 1254", alt} or null */
  h.photoInfo = function(name){ var p = PHOTOS[name]; return p ? {src:h.photo(name), w:p[0], h:p[1], ratio:p[0] + ' / ' + p[1], alt:p[2]} : null; };
  /* the picture as it must be shown: real aspect ratio, rounded, neon edge, never anything on top.
     opts: {eager:true (first screen only), cls, alt} */
  h.pictureHTML = function(name, opts){
    var p = h.photoInfo(name); if(!p) return ''; opts = opts || {};
    return '<img class="c3-pic' + (opts.cls ? ' ' + esc(opts.cls) : '') + '" src="' + esc(p.src) + '" width="' + p.w + '" height="' + p.h + '" alt="' + esc(opts.alt || p.alt) + '" style="aspect-ratio:' + p.ratio + '"' +
           (opts.eager ? ' decoding="sync" fetchpriority="high"' : (h.isWarm && h.isWarm(p.src)) ? ' decoding="sync"' : ' loading="lazy" decoding="async"') + '>';
  };
  /* v362: "More", one quiet control that opens a screen's secondary links in place (Chad, 26 Oct: "it still feels
     overwhelming and cluttered"). inner: the links' HTML, unchanged, so each keeps its own data-go / data-act. */
  C3.moreOpen = C3.moreOpen || {};
  h.moreHTML = function(key, inner, label){
    if(!inner) return '';
    var on = !!C3.moreOpen[key];
    return '<div class="c3-more"><button type="button" class="c3-more-t" data-more="' + esc(key) + '" data-key="more-' + esc(key) + '" aria-expanded="' + (on ? 'true' : 'false') + '">' +
      '<span>' + esc(label || 'More') + '</span><svg class="cv" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '<div class="c3-more-p"' + (on ? '' : ' hidden') + '>' + inner + '</div></div>';
  };
  /* which square picture stands beside a session, by what the session trains */
  h.sessionPhoto = function(day){
    var t = ((day && (day.focus || '')) + ' ' + (day && (day.name || ''))).toLowerCase();
    if(/lower|leg|glute|quad|ham|squat/.test(t)) return 'train-squat';
    if(/push|press|chest|shoulder/.test(t)) return 'train-log';
    if(/upper|pull|back|row|arm/.test(t)) return 'train-row';
    if(/condition|cardio|circuit|hiit/.test(t)) return 'train-team';
    return 'train-heavy';
  };

  /* the logo, cloned with its own gradient defs so it paints inside the shadow root. Never recolored. */
  var markCache = '';
  h.markSVG = function(){
    if(!markCache) markCache = safe(function(){ return brandMarkHTML(); }, '') || '';
    return markCache;
  };

  /* ---------- actions ---------- */
  /* START: straight into the C3 workout screen, never through the day sheet */
  h.startWorkout = function(){ return C3.go('workout'); };
  /* the app's own no-equipment routine ("Before you lift", 6 min, 9 holds); it runs in the app's rest bar */
  h.startStretch = function(){ return safe(function(){ mobStart('pre_lift'); C3.refresh(); return true; }, false); };
  h.stopStretch = function(){ return safe(function(){ mobStop(); C3.refresh(); return true; }, false); };
  /* an old screen under the C3 bar: h.deep('progress', 'body') */
  h.deep = function(group, pane){ return C3.deep(group, pane); };

  /* CATCH UP: move a missed session onto a rest day with the app's own move logic
     (the day sheet's "Move it to": setDayEdit on both days, this week only), plus Undo.
     Returns {ok, name, to} or {ok:false, why}. */
  h.catchUp = function(fromDow, toDow){
    try{
      var W = h.week(), from = W.days[fromDow];
      if(toDow == null) toDow = W.catchTo;
      var to = W.days[toDow];
      /* v309: a missed session can go to any free day from today on; an upcoming one can be
         pulled onto today (Chad: a member must be able to train the day they join) */
      if(!from || !(from.status === 'missed' || (from.status === 'future' && toDow === W.todayDow))) return {ok:false, why:'not a movable session'};
      if(!to || to.status !== 'rest' || to.logged || toDow < W.todayDow) return {ok:false, why:'no free day'};
      var wi = W.wi, week = weekAt(wi), src = week[fromDow];
      var prevFrom = editOf(wi, fromDow), prevTo = editOf(wi, toDow);
      var list = dayBlocksEditable(wi, fromDow, week), name = src.name, focus = src.focus;
      var copy = function(x){ return x ? JSON.parse(JSON.stringify(x)) : null; };
      setDayEdit(wi, toDow, {rest:false, blocks:list, name:name, focus:focus, c3from:fromDow, c3prev:copy(prevTo)});
      setDayEdit(wi, fromDow, {rest:true, c3to:toDow, c3name:name, c3prev:copy(prevFrom)});
      drawAll();
      offerUndo('<b>' + esc(name) + '</b> is now on ' + LONG[toDow] + '.', function(){ undoMove(wi, fromDow); });
      return {ok:true, name:name, to:toDow};
    }catch(e){ console.error('[c3] catchUp', e); return {ok:false, why:'error'}; }
  };
  /* v309: what today can hold when it is a free rest day: the latest missed session this week
     first (the coach asks for exactly that), otherwise the next one coming up. Null when today
     already has a session, is logged, or nothing this week can move. */
  h.pullCandidate = function(){
    try{
      var W = h.week(), t = W.days[W.todayDow];
      if(!t || t.status !== 'rest' || t.logged) return null;
      var pick = null, i;
      for(i = W.todayDow - 1; i >= 0; i--){ if(W.days[i].status === 'missed'){ pick = W.days[i]; break; } }
      if(!pick) for(i = W.todayDow + 1; i < 7; i++){ if(W.days[i].status === 'future'){ pick = W.days[i]; break; } }
      return pick ? {from:pick.dow, name:pick.name, minutes:pick.minutes, kind: pick.status === 'missed' ? 'missed' : 'next'} : null;
    }catch(e){ return null; }
  };
  h.pullToday = function(fromDow){ var W = h.week(); return h.catchUp(fromDow, W.todayDow); };
  function undoMove(wi, fromDow){
    var Ef = editOf(wi, fromDow); if(!Ef || Ef.c3to == null) return false;
    var toDow = Ef.c3to, Et = editOf(wi, toDow);
    if(Et && Et.c3from === fromDow) setDayEdit(wi, toDow, Et.c3prev || null);
    setDayEdit(wi, fromDow, Ef.c3prev || null);
    return true;
  }
  /* put a caught-up session back where it was. Pass either day of the pair. */
  h.undoCatchUp = function(dow){
    return safe(function(){
      var wi = weekIndexNow(), E = editOf(wi, dow); if(!E) return false;
      var from = E.c3to != null ? dow : (E.c3from != null ? E.c3from : null);
      if(from == null) return false;
      var ok = undoMove(wi, from);
      if(ok){ drawAll(); try{ say('Back where it was.'); }catch(e){} }
      return ok;
    }, false);
  };

  /* FINISH a session the way the app's own session screen does (liveFinish), without its sheet:
     marks the moves that have a ticked set as done, stamps the finish, stops the rest clock,
     repaints, tells Apple Health and the coaches. ONE path for every session:
       h.finishSession()       today's
       h.finishSession(key)    the session logged under that day key (a saved workout, a past day)
     Returns false when nothing is logged (there is nothing to finish). It also ends a session
     early: whatever is ticked is what the session was. */
  h.finishSession = function(key){
    return safe(function(){
      var T = null, k = key;
      if(!k){ T = h.today(); k = T.key; }
      var L = (ALL.workLog || {})[k]; if(!L) return false;
      var blocks = (L.blocks && L.blocks.length) ? L.blocks : ((T || h.today()).key === k ? ((T || h.today()).day.blocks || []) : []);
      var ticked = function(id){ return ((L.rows || {})[id] || []).some(function(r){ return r && r.done; }); };
      var done = blocks.filter(function(bl){ return ticked(bl.id); }).map(function(bl){ return bl.id; });
      if(!done.length) return false;
      L.done = done;
      L.fin = Date.now();
      save();
      try{ restStop(true); }catch(e){}
      drawAll();
      try{ healthPushSession(k, L); }catch(e){}
      try{ coachMoment('post-session'); }catch(e){}
      return true;
    }, false);
  };

  /* ---------- doors into the old app, shared by You and Welcome ---------- */
  /* an old You screen under the C3 bar, optionally scrolled to one of its blocks (and a control focused).
     The app's drawAll() fills the blocks of whichever You pane is showing (v297). */
  h.openYou = function(pane, anchor, focus){
    /* wave2:youdeep start (Reminders, Units and Apple Health are C3 screens now; screen-youdeep.js decides) */
    try{ if(C3.youRoute && C3.youRoute(pane, anchor, focus)) return; }catch(e){}
    /* wave2:youdeep end */
    C3.deep('profile', pane);
    if(!anchor) return;
    setTimeout(function(){
      try{
        var el = document.getElementById(anchor); if(!el || !el.getBoundingClientRect().width) return;
        var bar = C3.root && C3.root.querySelector('.c3-top'), off = (bar ? bar.getBoundingClientRect().height : 60) + 12;
        window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - off));
        if(focus){ var f = document.getElementById(focus); if(f) f.focus({preventScroll:true}); }
      }catch(e){}
    }, 140);
  };
  /* the app's own account screen, on the sign-in form */
  h.openSignIn = function(){ try{ ACCT.view = 'signin'; ACCT.err = ''; ACCT.msg = ''; ACCT.gateDone = 1; }catch(e){}   /* v368: asked to sign in: the form, not the phone landing */
  h.openYou('youaccount', 'acctCard'); };
  /* THE WALKTHROUGH, on purpose: the only door to openStory(). Nothing plays by itself. */
  h.openTeam = function(){
    try{
      Promise.resolve(openStory(null)).then(function(ok){
        if(!ok){ try{ say('The welcome story is not bundled with this build.', 'warn'); }catch(e){} }
      }, function(){});
    }catch(e){ console.error('[c3] story', e); }
  };

  /* ---------- the research lane ---------- */
  /* null unless the person is on a peptide AND a protocol has doses. Never shown beside a coach.
     {name, mg, mgTxt, everyDays, everyTxt, pct (of steady-state peak, 0..n), truth: doseTruth(P)} */
  h.peptide = function(){
    return safe(function(){
      if(!onPeptide()) return null;
      var P = (S && S.doses && S.doses.length) ? S : (ALL.protocols || []).filter(function(p){ return p.doses && p.doses.length; })[0];
      if(!P || !P.doses || !P.doses.length) return null;
      var now = Date.now(), c = byId(P.compound), pct = 0;
      /* the app's own inline math (renderConsole, CODEMAP 6.3), in one place */
      try{
        var ke = keOf(c.t12), ka = kaFromTmax(c.tmax, ke, c.id);
        var lastMg = +P.doses[P.doses.length - 1].mg, refMg = lastMg > 0 ? lastMg : P.doseMg;
        var ss = steadyState(refMg, P.everyH, ka, ke), t0 = P.doses[0].at;
        var dz = P.doses.map(function(d){ return {tH:(d.at - t0) / HOUR, mg:d.mg}; });
        pct = ss.peak ? concAt((now - t0) / HOUR, dz, ka, ke) / ss.peak * 100 : 0;
      }catch(e){ pct = 0; }
      var truth = doseTruth(P) || {};
      var mg = truth.mg || P.doseMg, days = P.everyH / 24;
      return {name:(c && c.n) || P.name || 'Your protocol', mg:mg, mgTxt:truth.mgTxt || String(mg),
              everyDays:days, everyTxt: days === 1 ? 'every day' : (days % 1 === 0 ? 'every ' + days + ' days' : 'every ' + Math.round(P.everyH) + ' hours'),
              pct: Math.max(0, Math.round(pct)), truth:truth};
    }, null);
  };

  /* ---------- small shared markup ---------- */
  /* the coach line component: round badge + name + one line; a tap opens that coach's chat */
  h.coachLineHTML = function(screen, opts){
    if(!safe(function(){ return coachPro(); }, true)) return '';   /* v343: the coaches reading your day are Pro (the app's isPro()) */
    var c = h.coachLine(screen); if(!c || !c.text) return '';
    opts = opts || {};
    return '<button type="button" class="c3-coach' + (opts.cls ? ' ' + esc(opts.cls) : '') + '" data-coach="' + esc(c.id) + '" data-key="coach" aria-label="' + esc(c.name + ': ' + c.text + ' Open chat') + '">' +
      '<img class="c3-coach-face" src="' + esc(c.badge) + '" alt="" width="56" height="56" decoding="sync">' +
      '<span class="c3-coach-txt"><span class="c3-coach-name">' + esc(c.name) + '</span><span class="c3-coach-line">' + esc(c.text) + '</span></span></button>' +
      /* v309: a coach who asks a question gets an answer right there (Chad: Shay asked
         "put it on today, yes?" and there was nothing to tap) */
      (c.ask ? '<div class="c3-coach-ask"><button type="button" class="c3-btn-rail c3-ask-yes" onclick="C3coachAnswer(\'' + esc(c.ask.id) + '\', true)">' + esc(c.ask.yes) + '</button>' +
               '<button type="button" class="c3-link c3-ask-no" onclick="C3coachAnswer(\'' + esc(c.ask.id) + '\', false)">Not now</button></div>' : '');
  };
  window.C3coachAnswer = function(id, yes){
    try{ if(yes) coachAccept(id); else coachDecline(id); }catch(e){ console.error('[c3] coach answer', e); }
    try{ C3.refresh(); }catch(e){}
  };
  /* THE WEEK STRIP, shared by Today and Train. W = h.week(), sel = the selected dow.
     opts: {todayFrac: 0..1 (fills today's small ring on a phone),
            dayExtra: function(day, dow) -> html written inside that day's column, after its
                      name and minutes (Train lists the day's first moves there)}.
     Each day is <button data-day="0..6" aria-pressed>; the screen wires the click. */
  h.weekStripHTML = function(W, sel, opts){
    opts = opts || {};
    var out = '<div class="c3-week" role="group" aria-label="This week, Sunday to Saturday">';
    W.days.forEach(function(d){
      var st = d.status, isCatch = st === 'future' && d.movedFrom != null;
      var cls = 'c3-day ' + st + (d.isToday ? ' today' : '') + (d.rest && st !== 'moved' ? ' rest' : '') + (isCatch ? ' catch' : '');
      var say = d.long + ' ' + d.date + ', ' + d.name + (st === 'missed' ? ', open' : st === 'done' ? ', done' : st === 'moved' ? ', moved to ' + LONG[d.movedTo] : isCatch ? ', catch-up' : d.isToday ? ', today' : '');
      var ico, tag = '';
      var ring = function(col, op){ return '<circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="7"></circle><circle cx="24" cy="24" r="18" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="7"></circle>'; };
      var tick = '<circle cx="24" cy="24" r="21.5" fill="#5CF2B0"></circle><path d="M14.5 24.5l6.5 6.5 12.5-13.5" fill="none" stroke="#141517" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>';
      if(st === 'done'){ ico = tick; tag = h.icon('check', 17, 3.2) + '<span class="w">Done</span>'; }
      else if(st === 'today'){
        var f = clamp01(opts.todayFrac || 0), len = 2 * Math.PI * 18;
        ico = '<circle class="c3-ring-pulse" cx="24" cy="24" r="23.5" fill="none" stroke="#5CF2B0" stroke-width="1.5"></circle>' + ring('#5CF2B0', '.35') +
              '<circle cx="24" cy="24" r="18" fill="none" stroke="#5CF2B0" stroke-width="7" stroke-dasharray="' + (Math.round(f * len * 10) / 10) + ' 200"' + (f > 0 ? '' : ' stroke-opacity="0"') + ' transform="rotate(-90 24 24)"></circle><circle cx="24" cy="24" r="5" fill="#5CF2B0"></circle>';
        tag = '<span class="dot"></span><span class="w">Today</span>';
      }
      else if(st === 'missed'){ ico = ring('#EDEEEF', '.28'); tag = '<span class="w">Open</span>'; }   /* v330: no slash, no "Missed": a day that went by is open, and Catch up moves it */
      else if(st === 'moved'){ ico = ring('#FF4FCB', '.55') + '<path d="M16 24h15M26 18l6 6-6 6" fill="none" stroke="#FF4FCB" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>'; tag = '<span class="dot pk"></span><span class="w">To ' + ABBR[d.movedTo].charAt(0) + ABBR[d.movedTo].slice(1).toLowerCase() + '</span>'; }
      else if(isCatch){ ico = ring('#5CF2B0', '.6') + '<path d="M24 16v16" stroke="#5CF2B0" stroke-width="4" stroke-linecap="round"></path><path d="M16 24h16" stroke="#5CF2B0" stroke-width="4" stroke-linecap="round"></path>'; tag = '<span class="dot pk"></span><span class="w">Catch-up</span>'; }
      else if(st === 'future' || st === 'before' || st === 'paused'){ ico = ring('#B9FFE0', st === 'future' ? '.6' : '.25'); tag = st === 'paused' ? '<span class="w">Paused</span>' : ''; }
      else{ ico = '<circle cx="24" cy="24" r="18" fill="none" stroke="#EDEEEF" stroke-opacity=".6" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"></circle><path d="M17 24 H31" stroke="#EDEEEF" stroke-width="3.5" stroke-linecap="round"></path>'; tag = d.isToday ? '<span class="dot"></span><span class="w">Today</span>' : h.icon('moon', 20, 1.8); }
      var meta = (st === 'rest') ? '' : (st === 'moved') ? 'Moved' : (d.minutes ? esc(d.minutes + ' min') + '<span class="mv"> \u00b7 ' + d.moves + ' moves</span>' : esc(d.moves + ' moves'));
      out += '<button type="button" class="' + cls + '" data-day="' + d.dow + '" data-key="day' + d.dow + '" aria-pressed="' + (sel === d.dow ? 'true' : 'false') + '" aria-label="' + esc(say) + '">' +
        '<span class="c3-day-top"><i></i></span>' +
        '<span class="c3-day-ico"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + ico + '</svg></span>' +
        '<span class="c3-day-body">' +
          '<span class="c3-day-head"><span class="lt">' + d.letter + '</span><span class="ab">' + d.abbr + '</span><span class="dt">' + d.date + '</span><span class="tag">' + tag + '</span></span>' +
          /* v311: a day before the person started says so in the strip, not a workout they could never have done */
          '<span class="c3-day-name">' + esc(st === 'before' ? 'Before start' : d.name) + '</span>' +
          '<span class="c3-day-meta">' + meta + '</span>' +
          (typeof opts.dayExtra === 'function' ? (opts.dayExtra(d, d.dow) || '') : '') +
        '</span></button>';
    });
    return out + '</div>';
  };
  /* the line above the strip: "0 OF 4 THIS WEEK", the pills, the program, the volume */
  /* v331: what this week already holds (wins, never debts): the weight moved and the records set, Sunday to now */
  h.weekWins = function(){
    return safe(function(){
      var d = new Date(), ws = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime();
      var rows = sessionRows().filter(function(r){ return r.at >= ws; });
      var vol = rows.reduce(function(t, r){ return t + (r.vol || 0); }, 0);
      var recs = Object.keys(ALL.prs || {}).map(function(k){ return ALL.prs[k]; }).filter(function(p){ return p && p.at >= ws && p.lb > 0; }).length;
      return {sessions: rows.length, vol: vol, recs: recs};
    }, {sessions: 0, vol: 0, recs: 0});
  };
  h.weekHeadHTML = function(W){
    var pills = ''; for(var i = 0; i < W.planned; i++) pills += '<i' + (i < W.done ? ' class="on"' : '') + '></i>';
    var WW = h.weekWins(), vw = safe(function(){ return wNum(WW.vol, 0); }, Math.round(WW.vol)), u = safe(function(){ return wU(); }, 'lb');
    var wins = (WW.vol > 0 || WW.recs > 0) ? '<span class="wins">' + (WW.vol > 0 ? '<b class="c3-num">' + (vw >= 10000 ? (Math.round(vw / 100) / 10) + 'k' : Math.round(vw).toLocaleString('en-US')) + '</b> ' + esc(u) + ' moved' : '') +
      (WW.recs > 0 ? '<span class="rec"><i></i><b class="c3-num">' + WW.recs + '</b> ' + (WW.recs === 1 ? 'record' : 'records') + '</span>' : '') + '</span>' : '';
    return '<div class="c3-weekhead">' +
      /* v311: plain words. "0 of 1 this week" read as a mistake to a beginner who could see three workout days
         (the days before they started are not counted). Now: "0 done · 1 to go this week", "All 3 done this week". */
      '<span class="cnt">' + (W.planned > 0 ? (W.done >= W.planned ? 'All <b>' + W.planned + '</b> done this week' : '<b>' + W.done + '</b> done <i>·</i> <b>' + (W.planned - W.done) + '</b> to go this week') : (W.done > 0 ? '<b>' + W.done + '</b> this week' : 'No sessions planned')) + '</span>' +
      wins +
      '<span class="c3-pills" aria-hidden="true">' + pills + '</span>' +
      /* v340: where the week sits in the 12-week block (BLOCK_WEEKS, the same block as "The next 12 weeks") */
      '<span class="prog">Week ' + W.weekNo + (W.weekNo <= safe(function(){ return BLOCK_WEEKS; }, 12) ? ' of ' + safe(function(){ return BLOCK_WEEKS; }, 12) : '') + (W.label ? ' · ' + esc(W.label) : '') + '</span>' +
      '<span class="vol"><span class="n">Week ' + W.weekNo + ' · </span><b>' + W.hardSets + '</b> sets · <b>' + W.hours + '</b> hours<span class="w"> planned</span></span>' +
    '</div>';
  };

  /* inline icons used across screens (stroke SVG, currentColor) */
  var ICON = {
    arrow:  '<path d="M4 12h15"></path><path d="M13 5l7 7-7 7"></path>',
    plus:   '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    check:  '<path d="M4 12.5l5.5 5.5L20 7"></path>',
    back:   '<path d="M15 5l-7 7 7 7"></path>',
    moon:   '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path>',
    you:    '<circle cx="12" cy="8.5" r="3.6"></circle><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"></path>',
    today:  '<circle cx="12" cy="12" r="8.2"></circle><circle cx="12" cy="12" r="2.2"></circle>',
    train:  '<path d="M3 12h18"></path><path d="M6.5 7v10"></path><path d="M17.5 7v10"></path><path d="M3.5 9.5v5"></path><path d="M20.5 9.5v5"></path>',
    food:   '<path d="M7 3v18"></path><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3"></path><path d="M17 21v-7h-2.5c0-5 1-9 2.5-11z"></path>',
    progress:'<path d="M4 4v16h16"></path><path d="M7.5 15.5l4-5 3.2 3L19.5 7"></path>',
    missed: '<circle cx="12" cy="12" r="9"></circle><path d="M7.8 16.2l8.4-8.4"></path>',
    /* v333: the Stack tab: a vial with its cap and its fill line */
    stack:  '<path d="M9 2.8h6"></path><path d="M10 2.8v3.4"></path><path d="M14 2.8v3.4"></path><rect x="7.5" y="6.2" width="9" height="15" rx="2.2"></rect><path d="M7.5 12.5h9"></path><path d="M10.5 15.5h3"></path>',
    /* v339: Today's checklist, one mark per kind of task instead of a number */
    drop:   '<path d="M12 3.2c3.2 4 5.6 7.3 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-3.1 2.4-6.4 5.6-10.4z"></path><path d="M9.6 14.6a2.6 2.6 0 0 0 2.4 2.2"></path>',
    walk:   '<circle cx="13.5" cy="4.3" r="1.8"></circle><path d="M10 21l2.2-5.2 2.6 2.4V21"></path><path d="M12.2 15.8l.9-5.2-2.9 1.4-1.4 3"></path><path d="M13.1 10.6l2.2 2.6 2.7.7"></path>',
    plan:   '<rect x="5" y="3.5" width="14" height="17" rx="2.2"></rect><path d="M8.5 8.5h7"></path><path d="M8.5 12h7"></path><path d="M8.5 15.5h4"></path>'
  };
  /* h.icon('arrow', 24, 3) -> <svg> string; color follows the text color */
  h.icon = function(name, size, sw){
    size = size || 20;
    return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICON[name] || '') + '</svg>';
  };
})();

/* =====================================================================================
   v298 ADD (appended block; nothing above this line is changed)
   THE OVERLAY LAYER, ADJUST and WATCH.

   One layer inside the shadow root, one thing open at a time, never stacked:
     C3.h.adjust(kind, fromEl, arg)   the ONE control for a number a person logs: the amount big,
                                      minus and plus, quick sizes, type the total. Water and steps
                                      are built in; a screen adds its own kind (a food portion,
                                      a weigh-in) with C3.h.adjustKinds[kind] = function(arg){ spec }.
     C3.h.watch(idOrName, fromEl)     how to do a movement: the app's own form video (moveVideo,
                                      /api/yt), the start and finish pictures, the steps and the
                                      coaching cues, over whatever screen is up.
     C3.h.watchHTML(id, name, opts)   the "Watch" control that stands beside an exercise name.
   Declarative: data-adjust="water" (optional data-arg), data-watch="<exercise id or name>".
   A phone gets a panel that rises from the bottom edge; from 700 px up ADJUST is anchored to
   the control that opened it and WATCH sits in the middle. Both close on a tap outside,
   Escape, the browser's Back, the X, and whenever the screen under them changes.
   ===================================================================================== */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function num(v){ v = +v; return isFinite(v) ? v : 0; }
  function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }
  function cssq(s){ return String(s).replace(/["\\]/g, '\\$&'); }

  /* ---------- a few more icons (h.icon learns them; the first table is untouched) ---------- */
  var ICON2 = {
    chev:   '<path d="M9 5l7 7-7 7"></path>',   /* v367: a row's mint chevron */
    play:   '<path d="M7.5 4.8v14.4L19.5 12z" fill="currentColor"></path>',
    minus:  '<path d="M5 12h14"></path>',
    x:      '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    adjust: '<path d="M12 3.5v9"></path><path d="M7.5 8h9"></path><path d="M7.5 19.5h9"></path>',
    out:    '<path d="M14 5h5v5"></path><path d="M19 5l-8 8"></path><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"></path>'
  };
  var icon0 = h.icon;
  h.icon = function(name, size, sw){
    if(!ICON2[name]) return icon0(name, size, sw);
    size = size || 20;
    return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON2[name] + '</svg>';
  };
  var ic = h.icon;

  /* ==================== the layer ==================== */
  var OV = null;             /* {kind, el, panel, fromKey, fromEl, onClose, anchor, data} */
  var LAYER = null, watching = null;
  var H = {pushed:false, backing:false, want:false};      /* the one history entry that makes Back close it */

  function wrapEl(){ return C3.root ? C3.root.querySelector('.c3') : null; }
  function layerEl(){
    var w = wrapEl(); if(!w) return null;
    if(LAYER && LAYER.parentNode === w) return LAYER;
    LAYER = document.createElement('div'); LAYER.className = 'c3-ov'; LAYER.hidden = true;
    w.appendChild(LAYER);
    LAYER.addEventListener('click', onLayerClick);
    LAYER.addEventListener('submit', onLayerSubmit);
    /* the page under the layer does not scroll while it is up; a panel taller than the screen scrolls itself */
    var stop = function(e){
      var n = e.target, p = OV && OV.panel;
      while(n && p && n !== LAYER){
        if(n.scrollHeight > n.clientHeight + 1){ var oy = getComputedStyle(n).overflowY; if(oy === 'auto' || oy === 'scroll') return; }
        n = n.parentNode;
      }
      e.preventDefault();
    };
    LAYER.addEventListener('wheel', stop, {passive:false});
    LAYER.addEventListener('touchmove', stop, {passive:false});
    /* the screen under it changed (another screen, a deep screen): the layer goes */
    try{
      watching = new MutationObserver(function(list){
        if(!OV) return;
        for(var i = 0; i < list.length; i++){ if(list[i].oldValue !== w.getAttribute(list[i].attributeName)){ closeOv({silent:true}); return; } }
      });
      watching.observe(w, {attributes:true, attributeFilter:['data-mode', 'data-screen'], attributeOldValue:true});
    }catch(e){}
    return LAYER;
  }
  function focusables(){
    if(!OV) return [];
    return [].slice.call(OV.panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')).filter(function(n){ return !n.disabled && n.getClientRects().length; });
  }
  function onKey(e){
    if(!OV) return;
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeOv(); return; }
    if(e.key === 'Tab'){
      var f = focusables(); if(!f.length){ e.preventDefault(); return; }
      var a = C3.root.activeElement, first = f[0], last = f[f.length - 1];
      if(!a || !OV.panel.contains(a) || a === OV.panel){ e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if(e.shiftKey && a === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && a === last){ e.preventDefault(); first.focus(); }
    }
  }
  /* where the panel stands: above the keyboard and the app's rest bar on a phone; beside the
     control that opened it from 700 px up (ADJUST) */
  function place(){
    if(!OV) return;
    var p = OV.panel, w = window.innerWidth, hgt = window.innerHeight, vv = window.visualViewport;
    var kb = vv ? Math.max(0, Math.round(hgt - vv.height - vv.offsetTop)) : 0;
    var lift = 0;
    try{ var rb = document.getElementById('restBar'); if(rb && !rb.hidden){ var rr = rb.getBoundingClientRect(); if(rr.height > 0 && rr.top > hgt / 2) lift = Math.max(0, Math.round(hgt - rr.top)); } }catch(e){}
    OV.el.style.setProperty('--ov-kb', (w < 700 ? Math.max(kb, lift) : 0) + 'px');
    if(!OV.anchor || w < 700){ p.style.left = ''; p.style.top = ''; return; }
    var a = null;
    try{ a = OV.fromKey ? C3.root.querySelector('#c3screen [data-key="' + cssq(OV.fromKey) + '"]') : null; }catch(e){}
    if(!a && OV.fromEl && OV.fromEl.isConnected) a = OV.fromEl;
    var pw = p.offsetWidth, ph = p.offsetHeight, x, y;
    if(a && a.getClientRects().length){
      var r = a.getBoundingClientRect();
      x = r.left + r.width / 2 - pw / 2;
      y = r.bottom + 12;
      if(y + ph > hgt - 12) y = r.top - ph - 12;                      /* no room under it: above it */
      if(y < 12){ y = Math.max(12, hgt - ph - 12); x = r.right + 16; if(x + pw > w - 12) x = r.left - pw - 16; }   /* no room above either: beside it */
    }else{ x = (w - pw) / 2; y = (hgt - ph) / 2; }
    p.style.left = Math.round(clamp(x, 12, Math.max(12, w - pw - 12))) + 'px';
    p.style.top = Math.round(clamp(y, 12, Math.max(12, hgt - ph - 12))) + 'px';
  }
  function histOpen(){
    if(H.backing){ H.want = true; return; }
    try{ history.pushState(Object.assign({}, history.state || {}, {c3ov:1}), ''); H.pushed = true; }catch(e){ H.pushed = false; }
  }
  function histClose(fromPop){
    H.want = false;
    if(fromPop){ H.pushed = false; return; }
    if(C3.nav && C3.nav.backing){ H.pushed = false; H.backing = false; return; }
    if(H.pushed){ H.pushed = false; H.backing = true; try{ if(C3.nav) C3.nav.backing = true; history.back(); }catch(e){ H.backing = false; if(C3.nav) C3.nav.backing = false; } }
  }
  window.addEventListener('popstate', function(){
    if(H.backing){ H.backing = false; if(H.want && OV){ H.want = false; histOpen(); } return; }
    if(OV) closeOv({fromPop:true});
  });

  /* o: {kind, cls, label, html, from, anchor, onClose, data} */
  function openOv(o){
    closeOv({silent:true});
    var el = layerEl(); if(!el) return null;
    el.className = 'c3-ov ' + o.kind + (o.cls ? ' ' + o.cls : '');
    el.innerHTML = '<div class="c3-ov-scrim" data-ov="close"></div>' +
      '<section class="c3-ov-panel" role="dialog" aria-modal="true" aria-label="' + esc(o.label || '') + '" tabindex="-1">' + o.html + '</section>';
    el.hidden = false;
    var from = (o.from && o.from.getAttribute) ? o.from : safe(function(){ return C3.root.activeElement; }, null);
    OV = {kind:o.kind, el:el, panel:el.querySelector('.c3-ov-panel'), fromEl:from || null, fromKey:(from && from.getAttribute && from.getAttribute('data-key')) || '',
          onClose:o.onClose || null, anchor: !!o.anchor, data:o.data || {}};
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    if(window.visualViewport){ try{ visualViewport.addEventListener('resize', place); visualViewport.addEventListener('scroll', place); }catch(e){} }
    place();
    histOpen();
    try{ OV.panel.focus({preventScroll:true}); }catch(e){}
    return OV;
  }
  /* o: {silent (something else takes the screen: no focus work), fromPop, skip (do not commit)} */
  function closeOv(o){
    o = o || {};
    var ov = OV; if(!ov) return false;
    OV = null;
    try{ if(ov.onClose) ov.onClose(ov, o); }catch(e){ try{ console.error('[c3] overlay close', e); }catch(x){} }
    ov.el.hidden = true; ov.el.innerHTML = '';                         /* a playing video ends here */
    ov.el.style.removeProperty('--ov-kb');
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    if(window.visualViewport){ try{ visualViewport.removeEventListener('resize', place); visualViewport.removeEventListener('scroll', place); }catch(e){} }
    histClose(!!o.fromPop);
    if(!o.silent){
      /* the keyboard goes back to the control that opened it (found again by its key: the screen may have repainted) */
      var back = function(){
        try{
          var n = ov.fromKey ? C3.root.querySelector('#c3screen [data-key="' + cssq(ov.fromKey) + '"]') : null;
          if(!n && ov.fromEl && ov.fromEl.isConnected) n = ov.fromEl;
          if(n && !OV) n.focus({preventScroll:true});
        }catch(e){}
      };
      back(); try{ requestAnimationFrame(function(){ requestAnimationFrame(back); }); }catch(e){}
    }
    return true;
  }
  h.closeOverlay = function(silent){ return closeOv({silent:!!silent}); };
  /* v317: a layer for another module (the fast-food radar): {kind, label, html, onClose}; its
     buttons carry data-rd and go to h.radarAct */
  h.openLayer = function(o){ return openOv(o); };
  /* what is open right now: null, or {kind:'adjust'|'watch', id} (the tests read this) */
  h.overlay = function(){ return OV ? {kind:OV.kind, id:(OV.data && OV.data.id) || ''} : null; };

  function onLayerClick(e){
    if(!OV) return;
    var t = e.target && e.target.closest ? e.target.closest('[data-ov],[data-adj],[data-adj-q],[data-wa],[data-rd]') : null;
    if(!t || t.disabled) return;
    if(t.hasAttribute('data-rd')){ if(typeof h.radarAct === 'function') h.radarAct(t.getAttribute('data-rd'), t); return; }
    if(t.hasAttribute('data-adj')){ adjAct(t.getAttribute('data-adj')); return; }
    if(t.hasAttribute('data-adj-q')){ adjQuick(+t.getAttribute('data-adj-q')); return; }
    if(t.hasAttribute('data-wa')){ watchAct(t.getAttribute('data-wa')); return; }
    if(t.getAttribute('data-ov') === 'close'){ e.preventDefault(); closeOv(); }
  }
  function onLayerSubmit(e){
    e.preventDefault();
    if(OV && OV.kind === 'adjust') adjTyped(true);
  }

  /* the app's own sheet opening over C3 puts the layer away first: never two things up */
  try{
    if(typeof window.openSheet === 'function' && !window.openSheet.__c3ov){
      var sheet0 = window.openSheet;
      var sheet1 = function(){ try{ closeOv({silent:true}); }catch(e){} return sheet0.apply(this, arguments); };
      sheet1.__c3ov = 1;
      window.openSheet = sheet1;
    }
  }catch(e){}

  /* declarative: data-adjust, data-watch. core.js's own click handler is untouched; this one is
     added to the same element when C3 mounts. */
  function onScreenClick(e){
    var t = e.target && e.target.closest ? e.target.closest('[data-adjust],[data-watch]') : null;
    if(!t || t.disabled || (LAYER && LAYER.contains(t))) return;
    e.preventDefault();
    if(t.hasAttribute('data-adjust')) h.adjust(t.getAttribute('data-adjust'), t, t.getAttribute('data-arg'));
    else h.watch(t.getAttribute('data-watch'), t);
  }
  var mount0 = C3.mount;
  C3.mount = function(){
    var r = mount0.apply(this, arguments);
    try{ var w = wrapEl(); if(r && w && !w.__c3ov){ w.__c3ov = 1; w.addEventListener('click', onScreenClick); } }catch(e){}
    return r;
  };

  /* ==================== ADJUST ==================== */
  /* A day's number, written the app's way: the same maps the app's own sheets write
     (ALL.hydration / ALL.steps, keyed by day), save(), repaint. Lowering it stamps the day
     (the app's dayFixed) so a sync cannot put the old number back. Returns what is now stored. */
  function setDay(map, v){
    var k = dkey(Date.now());
    ALL[map] = ALL[map] || {};
    var before = num(ALL[map][k]);
    v = Math.max(0, Math.round(num(v)));
    if(v === before) return before;
    if(v < before){ try{ if(typeof dayFixed === 'function') dayFixed(map, k); }catch(e){} }
    if(v > 0) ALL[map][k] = v; else delete ALL[map][k];
    save(); drawAll();
    return v;
  }
  h.setDay = setDay;
  var WATER_MAX = 12000, STEPS_MAX = 200000;      /* mL a day; the app's own ceiling for a typed step count */
  function litersText(ml){ return String(Math.round(ml / 10) / 100); }                 /* 750 -> "0.75", 2000 -> "2" */

  /* kind -> function(arg, fromEl) -> spec, or null when there is nothing to adjust.
     spec: { id, title, tone ('water' | 'steps' | 'food' | 'weight'), step, min, max,
             read() -> the number now,
             live:true + write(v) -> stored value        every tap is saved at once (water, steps), or
             apply(v, v0)                                saved once, when the panel closes (an item),
             show(v) -> the big text, unit, sub(v) -> the line under it, frac(v) -> 0..1 for the bar (optional),
             quick:[{add:n | set:n, label, sub}], round(v) (default: whole numbers),
             decimal:bool, entryUnit, entry(v) -> text in the box, parse(text) -> number | null, hint (said when the text is no number),
             lessSay, moreSay (aria), undoMsg(v) (html; live kinds get the app's Undo toast when the panel closes),
             remove:{label, run()} (optional), note (one honest line, optional) } */
  h.adjustKinds = {
    water: function(){
      var tgt = num(h.targets().water);
      return {
        id:'water', title:'Water today', tone:'water', live:true, step:250, min:0, max:WATER_MAX,
        read:function(){ return num(safe(function(){ return (ALL.hydration || {})[dkey(Date.now())]; }, 0)); },
        write:function(v){ return setDay('hydration', v); },
        show:function(v){ return fmt.liters(v); }, unit:'L',
        sub:function(){ return tgt > 0 ? 'of ' + fmt.liters(tgt, 1) + ' L' : ''; },
        frac:function(v){ return tgt > 0 ? v / tgt : 0; },
        lessSay:'250 milliliters less', moreSay:'250 milliliters more',
        /* the sizes of the app's own water sheet */
        quick:[{add:250, label:'+ 250 mL', sub:'Glass'}, {add:500, label:'+ 500 mL', sub:'Bottle'}, {add:710, label:'+ 710 mL', sub:'24 oz bottle'}, {add:1000, label:'+ 1 L', sub:'Liter'}],
        decimal:true, entryUnit:'L', entry:litersText, hint:'Liters, like 2.5',
        /* liters. A whole number no one drinks in liters (over 12, like 750) is milliliters; a number
           with a decimal point is always liters; "750 ml" and "2.5 l" both read */
        parse:function(t){
          var m = /^(\d+(?:[.,]\d+)?|[.,]\d+)\s*(ml|l|liters?)?$/i.exec(String(t).trim()); if(!m) return null;
          var n = parseFloat(m[1].replace(',', '.')), u = (m[2] || '').toLowerCase(); if(!isFinite(n)) return null;
          var ml = (u === 'ml' || (!u && n > 12 && !/[.,]/.test(m[1]))) ? n : n * 1000;
          return ml > WATER_MAX ? null : Math.round(ml / 10) * 10;
        },
        undoMsg:function(v){ return 'Water <b>' + fmt.liters(v) + ' L</b> today.'; }
      };
    },
    steps: function(){
      var tgt = num(h.targets().steps);
      var health = safe(function(){ return !!(window.RUN && RUN.health && RUN.health.available()); }, false);
      return {
        id:'steps', title:'Steps today', tone:'steps', live:true, step:500, min:0, max:STEPS_MAX,
        read:function(){ return num(safe(function(){ return (ALL.steps || {})[dkey(Date.now())]; }, 0)); },
        write:function(v){ return setDay('steps', v); },
        show:function(v){ return fmt.n(v); }, unit:'',
        sub:function(){ return tgt > 0 ? 'of ' + fmt.n(tgt) + ' steps' : 'steps'; },
        frac:function(v){ return tgt > 0 ? v / tgt : 0; },
        lessSay:'500 steps fewer', moreSay:'500 steps more',
        quick:[{add:1000, label:'+ 1,000'}, {add:2500, label:'+ 2,500'}, {add:5000, label:'+ 5,000'}],
        decimal:false, entryUnit:'steps', entry:function(v){ return String(Math.round(v)); }, hint:'A whole number, like 8400',
        parse:function(t){ var s = String(t).replace(/[,\s]/g, ''); if(!/^\d{1,6}$/.test(s)) return null; var n = +s; return n > STEPS_MAX ? null : n; },
        undoMsg:function(v){ return 'Steps <b>' + fmt.n(v) + '</b> today.'; },
        /* the app's own rule (mergeHealth): the phone's count wins whenever it is the larger one */
        note: health ? 'Apple Health adds its count and keeps the larger number.' : ''
      };
    }
  };

  function adjData(){ return (OV && OV.kind === 'adjust') ? OV.data : null; }
  function adjRound(S, v){ v = S.round ? S.round(v) : Math.round(v); return clamp(v, S.min, S.max); }
  function adjPaint(keepBox){
    var d = adjData(); if(!d) return;
    var S = d.S, p = OV.panel, q = function(s){ return p.querySelector(s); };
    var v = d.v, n;
    if((n = q('[data-adj-v]'))){ var t = S.show(v); n.textContent = t; n.className = 'c3-num' + (t.length > 6 ? ' xs' : t.length > 4 ? ' sm' : ''); }
    if((n = q('[data-adj-sub]'))) n.textContent = S.sub ? (S.sub(v) || '') : '';
    if((n = q('[data-adj-m]'))) n.style.width = (Math.round(clamp(S.frac(v), 0, 1) * 1000) / 10) + '%';
    var dn = q('[data-adj="-"]'), up = q('[data-adj="+"]');
    if(dn){ var a0 = v <= S.min; if(a0 && C3.root.activeElement === dn && up) up.focus({preventScroll:true}); dn.disabled = a0; }
    if(up){ var a1 = v >= S.max; if(a1 && C3.root.activeElement === up && dn) dn.focus({preventScroll:true}); up.disabled = a1; }
    [].forEach.call(p.querySelectorAll('[data-adj-q]'), function(b){ var x = S.quick[+b.getAttribute('data-adj-q')]; b.disabled = x.add != null ? (x.add > 0 ? v >= S.max : v <= S.min) : false; });
    var box = q('#c3adjIn');
    if(box && !keepBox){ box.value = S.entry(v); d.typed = box.value; }
    var er = q('[data-adj-err]'); if(er && !keepBox){ er.hidden = true; er.textContent = ''; }
  }
  function adjSet(v, keepBox){
    var d = adjData(); if(!d) return;
    var S = d.S; v = adjRound(S, v);
    if(v !== d.v){
      d.v = v;
      if(S.live){ try{ d.v = S.write(v); }catch(e){ try{ console.error('[c3] adjust write', e); }catch(x){} } }
    }
    adjPaint(keepBox);
  }
  /* the typed total. say: show the hint when the text is not a number (Set and Enter do; Done does not nag) */
  function adjTyped(say){
    var d = adjData(); if(!d) return true;
    var box = OV.panel.querySelector('#c3adjIn'); if(!box) return true;
    var txt = String(box.value).trim();
    if(txt === '' || txt === d.typed) return true;                     /* nothing new was typed */
    var v = d.S.parse(txt);
    if(v == null){
      if(say){ var er = OV.panel.querySelector('[data-adj-err]'); if(er){ er.textContent = d.S.hint || 'Type a number.'; er.hidden = false; } try{ box.focus(); box.select(); }catch(e){} }
      return false;
    }
    adjSet(v);
    return true;
  }
  function adjAct(a){
    var d = adjData(); if(!d) return;
    if(a === '-' || a === '+'){ adjSet(d.v + (a === '+' ? 1 : -1) * d.S.step); return; }
    if(a === 'done'){ if(!adjTyped(true))return; closeOv({commit:true}); return; }
    if(a === 'remove' && d.S.remove){
      var run = d.S.remove.run;
      closeOv({skip:true});
      try{ run(); }catch(e){ try{ console.error('[c3] adjust remove', e); }catch(x){} }
    }
  }
  function adjQuick(i){
    var d = adjData(); if(!d) return;
    var x = (d.S.quick || [])[i]; if(!x) return;
    adjSet(x.add != null ? d.v + x.add : x.set);
  }
  function adjHTML(S){
    var qs = (S.quick || []).map(function(x, i){
      return '<button type="button" class="c3-adj-q" data-adj-q="' + i + '"><b>' + esc(x.label) + '</b>' + (x.sub ? '<span>' + esc(x.sub) + '</span>' : '') + '</button>';
    }).join('');
    return '<header class="c3-ov-head"><span class="c3-ov-t"><i></i>' + esc(S.title) + '</span>' +
        '<button type="button" class="c3-ov-x" data-ov="close" aria-label="Close">' + ic('x', 22, 2.6) + '</button></header>' +
      '<div class="c3-adj-row">' +
        '<button type="button" class="c3-adj-pm" data-adj="-" aria-label="' + esc(S.lessSay || 'Less') + '">' + ic('minus', 30, 3) + '</button>' +
        '<div class="c3-adj-val" role="status" aria-live="polite"><b class="c3-num" data-adj-v></b><span class="u">' + esc(S.unit || '') + '</span></div>' +
        '<button type="button" class="c3-adj-pm" data-adj="+" aria-label="' + esc(S.moreSay || 'More') + '">' + ic('plus', 30, 3) + '</button></div>' +
      '<div class="c3-adj-sub" data-adj-sub></div>' +
      (S.frac ? '<span class="c3-adj-meter" aria-hidden="true"><i data-adj-m></i></span>' : '') +
      (qs ? '<div class="c3-adj-quick" role="group" aria-label="Quick sizes" style="--n:' + S.quick.length + '">' + qs + '</div>' : '') +
      '<form class="c3-adj-set" novalidate><label for="c3adjIn">' + esc(S.setLabel || 'Set total') + '</label>' +
        '<span class="f"><input id="c3adjIn" type="text" inputmode="' + (S.decimal ? 'decimal' : 'numeric') + '" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-describedby="c3adjErr">' +
          '<span class="u">' + esc(S.entryUnit || S.unit || '') + '</span></span>' +
        '<button type="submit" class="c3-btn-quiet">Set</button></form>' +
      '<p class="c3-adj-err" id="c3adjErr" role="alert" data-adj-err hidden></p>' +
      (S.note ? '<p class="c3-adj-note">' + esc(S.note) + '</p>' : '') +
      '<div class="c3-adj-foot">' + (S.remove ? '<button type="button" class="c3-btn-quiet pink bare" data-adj="remove">' + esc(S.remove.label || 'Remove') + '</button>' : '<span></span>') +
        '<button type="button" class="c3-btn-quiet" data-adj="done">Done</button></div>';
  }
  /* open ADJUST. kind: 'water' | 'steps' | a kind a screen registered; or a spec object.
     Returns true when it opened. */
  h.adjust = function(kind, fromEl, arg){
    try{
      var make = typeof kind === 'string' ? h.adjustKinds[kind] : null;
      var S = make ? make(arg, fromEl) : (kind && typeof kind === 'object' ? kind : null);
      if(!S) return false;
      var v0 = adjRound(S, num(S.read()));
      var ov = openOv({kind:'adjust', cls:S.tone || '', label:S.title, html:adjHTML(S), from:fromEl, anchor:true, data:{id:S.id, S:S, v:v0, v0:v0, typed:''},
        onClose:function(o, how){
          var d = o.data;
          if(how && how.skip) return;
          if(d.v === d.v0) return;
          if(S.live){
            if(S.undoMsg && typeof offerUndo === 'function'){ var was = d.v0; offerUndo(S.undoMsg(d.v), function(){ S.write(was); }); }
          }else if(how && how.commit && S.apply) S.apply(d.v, d.v0);
        }});
      if(!ov) return false;
      adjPaint();
      place();
      return true;
    }catch(e){ try{ console.error('[c3] adjust', e); }catch(x){} return false; }
  };
  /* the small mark that says "this number can be changed": the plus-minus sign and the word.
     It goes INSIDE the control that opens ADJUST (it is not a control by itself). */
  h.adjustHintHTML = function(word){ return '<span class="c3-adjhint">' + ic('adjust', 13, 2.6) + '<span>' + esc(word || 'Adjust') + '</span></span>'; };

  /* ONE TAP: add water to today (replaces the first h.addWater: the same write, the same Undo
     toast, and now the take-back is a correction the sync keeps). */
  h.addWater = function(ml){
    ml = Math.round(num(ml)); if(!(ml > 0)) return false;
    return safe(function(){
      var k = dkey(Date.now()), before = num((ALL.hydration || {})[k]);
      var now = setDay('hydration', Math.min(WATER_MAX, before + ml)), added = now - before;
      if(!(added > 0)) return false;
      offerUndo('<b>' + added + ' mL</b> · ' + fmt.liters(now) + ' L today.', function(){
        setDay('hydration', Math.max(0, num((ALL.hydration || {})[k]) - added));
      });
      return true;
    }, false);
  };

  /* ==================== WATCH ==================== */
  /* the app's own way of finding a movement from an id or a name (openHow), without its sheet */
  function findMove(ref){
    ref = String(ref || '').trim(); if(!ref) return null;
    var e = safe(function(){ return exdbFind(ref); }, null);
    if(e) return e;
    e = safe(function(){
      var k = exdbNorm(ref).trim();
      var x = EXERCISES.find(function(m){ return !m.cx && exdbNorm(m.n).trim() === k; });
      if(!x && k.length > 5){ var k2 = k.replace(/\b(left|right|each side|l|r)\b/g, '').trim(); x = EXERCISES.find(function(m){ return !m.cx && exdbNorm(m.n).trim() === k2; }); }
      return x || null;
    }, null);
    return e || {id:'how:' + ref, n:ref, howOnly:true};
  }
  /* everything the app holds about one movement, read fresh:
     {id, n, group, howOnly, img:[start, finish] (urls that exist, or []), steps:[...], facts:[[label, text]],
      cue:{s, x, e:[...]} | null (its own), pat:{c, e} | null (the cue of its kind of movement)} */
  h.moveInfo = function(ref){
    var e = findMove(ref); if(!e) return null;
    var d = safe(function(){ return exdbOf(e); }, null);
    var img = [safe(function(){ return exImg(e, 0); }, ''), safe(function(){ return exImg(e, 1); }, '')].filter(Boolean);
    var C = e.howOnly ? {} : (safe(function(){ return cueFor(e.id); }, {}) || {});
    var cue = (C.ex && (C.ex.s || C.ex.x || (C.ex.e && C.ex.e.length))) ? {s:C.ex.s || '', x:C.ex.x || '', e:(C.ex.e || []).slice()} : null;
    var pat = (!cue && C.pat && (C.pat.c || C.pat.e)) ? {c:C.pat.c || '', e:C.pat.e || ''} : null;
    var lab = function(m){ return safe(function(){ return EXDB_MUSCLE_LABEL[m]; }, '') || m; };
    var up = function(s){ s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
    var facts = [];
    if(d){
      if(d.pm && d.pm.length) facts.push(['Main', d.pm.map(lab).join(', ')]);
      if(d.sm && d.sm.length) facts.push(['Also', d.sm.map(lab).join(', ')]);
      if(d.eq) facts.push(['Equipment', up(d.eq)]);
      if(d.level) facts.push(['Level', up(d.level)]);
    }
    return {id:e.id, n:e.n, e:e, howOnly:!!e.howOnly, group: e.grp ? fmt.group(e.grp) : '', img:img, steps:(d && d.steps) ? d.steps.slice() : [], facts:facts, cue:cue, pat:pat,
            loaded: safe(function(){ return !!EXDB.data; }, false)};
  };
  /* BRANDS:BEGIN (written by tools/c3/make-brands.mjs, do not edit by hand) */
  var BRANDS = {
    facebook: [256, 256, "<path fill=\"#1877f2\" d=\"M256 128C256 57.308 198.692 0 128 0S0 57.308 0 128c0 63.888 46.808 116.843 108 126.445V165H75.5v-37H108V99.8c0-32.08 19.11-49.8 48.348-49.8C170.352 50 185 52.5 185 52.5V84h-16.14C152.959 84 148 93.867 148 103.99V128h35.5l-5.675 37H148v89.445c61.192-9.602 108-62.556 108-126.445\"/><path fill=\"#fff\" d=\"m177.825 165l5.675-37H148v-24.01C148 93.866 152.959 84 168.86 84H185V52.5S170.352 50 156.347 50C127.11 50 108 67.72 108 99.8V128H75.5v37H108v89.445A129 129 0 0 0 128 256a129 129 0 0 0 20-1.555V165z\"/>"],
    youtube: [256, 180, "<path fill=\"red\" d=\"M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134\"/><path fill=\"#fff\" d=\"m102.421 128.06l66.328-38.418l-66.328-38.418z\"/>"],
    whatsapp: [256, 258, "<defs><linearGradient id=\"SVGK3KZq49U\" x1=\"50%\" x2=\"50%\" y1=\"100%\" y2=\"0%\"><stop offset=\"0%\" stop-color=\"#1faf38\"/><stop offset=\"100%\" stop-color=\"#60d669\"/></linearGradient><linearGradient id=\"SVGefMkoEOd\" x1=\"50%\" x2=\"50%\" y1=\"100%\" y2=\"0%\"><stop offset=\"0%\" stop-color=\"#f9f9f9\"/><stop offset=\"100%\" stop-color=\"#fff\"/></linearGradient></defs><path fill=\"url(#SVGK3KZq49U)\" d=\"M5.463 127.456c-.006 21.677 5.658 42.843 16.428 61.499L4.433 252.697l65.232-17.104a123 123 0 0 0 58.8 14.97h.054c67.815 0 123.018-55.183 123.047-123.01c.013-32.867-12.775-63.773-36.009-87.025c-23.23-23.25-54.125-36.061-87.043-36.076c-67.823 0-123.022 55.18-123.05 123.004\"/><path fill=\"url(#SVGefMkoEOd)\" d=\"M1.07 127.416c-.007 22.457 5.86 44.38 17.014 63.704L0 257.147l67.571-17.717c18.618 10.151 39.58 15.503 60.91 15.511h.055c70.248 0 127.434-57.168 127.464-127.423c.012-34.048-13.236-66.065-37.3-90.15C194.633 13.286 162.633.014 128.536 0C58.276 0 1.099 57.16 1.071 127.416m40.24 60.376l-2.523-4.005c-10.606-16.864-16.204-36.352-16.196-56.363C22.614 69.029 70.138 21.52 128.576 21.52c28.3.012 54.896 11.044 74.9 31.06c20.003 20.018 31.01 46.628 31.003 74.93c-.026 58.395-47.551 105.91-105.943 105.91h-.042c-19.013-.01-37.66-5.116-53.922-14.765l-3.87-2.295l-40.098 10.513z\"/><path fill=\"#fff\" d=\"M96.678 74.148c-2.386-5.303-4.897-5.41-7.166-5.503c-1.858-.08-3.982-.074-6.104-.074c-2.124 0-5.575.799-8.492 3.984c-2.92 3.188-11.148 10.892-11.148 26.561s11.413 30.813 13.004 32.94c1.593 2.123 22.033 35.307 54.405 48.073c26.904 10.609 32.379 8.499 38.218 7.967c5.84-.53 18.844-7.702 21.497-15.139c2.655-7.436 2.655-13.81 1.859-15.142c-.796-1.327-2.92-2.124-6.105-3.716s-18.844-9.298-21.763-10.361c-2.92-1.062-5.043-1.592-7.167 1.597c-2.124 3.184-8.223 10.356-10.082 12.48c-1.857 2.129-3.716 2.394-6.9.801c-3.187-1.598-13.444-4.957-25.613-15.806c-9.468-8.442-15.86-18.867-17.718-22.056c-1.858-3.184-.199-4.91 1.398-6.497c1.431-1.427 3.186-3.719 4.78-5.578c1.588-1.86 2.118-3.187 3.18-5.311c1.063-2.126.531-3.986-.264-5.579c-.798-1.593-6.987-17.343-9.819-23.64\"/>"],
    reddit: [256, 256, "<circle cx=\"128\" cy=\"128\" r=\"128\" fill=\"#ff4500\"/><path fill=\"#fff\" d=\"M213.15 129.22c0-10.376-8.391-18.617-18.617-18.617a18.74 18.74 0 0 0-12.97 5.189c-12.818-9.157-30.368-15.107-49.9-15.87l8.544-39.981l27.773 5.95c.307 7.02 6.104 12.667 13.278 12.667c7.324 0 13.275-5.95 13.275-13.278c0-7.324-5.95-13.275-13.275-13.275c-5.188 0-9.768 3.052-11.904 7.478l-30.976-6.562c-.916-.154-1.832 0-2.443.458c-.763.458-1.22 1.22-1.371 2.136l-9.464 44.558c-19.837.612-37.692 6.562-50.662 15.872a18.74 18.74 0 0 0-12.971-5.188c-10.377 0-18.617 8.391-18.617 18.617c0 7.629 4.577 14.037 10.988 16.939a33.6 33.6 0 0 0-.458 5.646c0 28.686 33.42 52.036 74.621 52.036c41.202 0 74.622-23.196 74.622-52.036a35 35 0 0 0-.458-5.646c6.408-2.902 10.985-9.464 10.985-17.093M85.272 142.495c0-7.324 5.95-13.275 13.278-13.275c7.324 0 13.275 5.95 13.275 13.275s-5.95 13.278-13.275 13.278c-7.327.15-13.278-5.953-13.278-13.278m74.317 35.251c-9.156 9.157-26.553 9.768-31.588 9.768c-5.188 0-22.584-.765-31.59-9.768c-1.371-1.373-1.371-3.51 0-4.883c1.374-1.371 3.51-1.371 4.884 0c5.8 5.8 18.008 7.782 26.706 7.782s21.058-1.983 26.704-7.782c1.374-1.371 3.51-1.371 4.884 0c1.22 1.373 1.22 3.51 0 4.883m-2.443-21.822c-7.325 0-13.275-5.95-13.275-13.275s5.95-13.275 13.275-13.275c7.327 0 13.277 5.95 13.277 13.275c0 7.17-5.95 13.275-13.277 13.275\"/>"],
    telegram: [256, 256, "<defs><linearGradient id=\"SVG6DaOZcwt\" x1=\"50%\" x2=\"50%\" y1=\"0%\" y2=\"100%\"><stop offset=\"0%\" stop-color=\"#2aabee\"/><stop offset=\"100%\" stop-color=\"#229ed9\"/></linearGradient></defs><path fill=\"url(#SVG6DaOZcwt)\" d=\"M128 0C94.06 0 61.48 13.494 37.5 37.49A128.04 128.04 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51s-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0\"/><path fill=\"#fff\" d=\"M57.94 126.648q55.98-24.384 74.64-32.152c35.56-14.786 42.94-17.354 47.76-17.441c1.06-.017 3.42.245 4.96 1.49c1.28 1.05 1.64 2.47 1.82 3.467c.16.996.38 3.266.2 5.038c-1.92 20.24-10.26 69.356-14.5 92.026c-1.78 9.592-5.32 12.808-8.74 13.122c-7.44.684-13.08-4.912-20.28-9.63c-11.26-7.386-17.62-11.982-28.56-19.188c-12.64-8.328-4.44-12.906 2.76-20.386c1.88-1.958 34.64-31.748 35.26-34.45c.08-.338.16-1.598-.6-2.262c-.74-.666-1.84-.438-2.64-.258c-1.14.256-19.12 12.152-54 35.686c-5.1 3.508-9.72 5.218-13.88 5.128c-4.56-.098-13.36-2.584-19.9-4.708c-8-2.606-14.38-3.984-13.82-8.41c.28-2.304 3.46-4.662 9.52-7.072\"/>"],
    instagram: [256, 256, "<g fill=\"none\"><rect width=\"256\" height=\"256\" fill=\"url(#SVGKdMMobCR)\" rx=\"60\"/><rect width=\"256\" height=\"256\" fill=\"url(#SVGqYUiQbXV)\" rx=\"60\"/><path fill=\"#fff\" d=\"M128.009 28c-27.158 0-30.567.119-41.233.604c-10.646.488-17.913 2.173-24.271 4.646c-6.578 2.554-12.157 5.971-17.715 11.531c-5.563 5.559-8.98 11.138-11.542 17.713c-2.48 6.36-4.167 13.63-4.646 24.271c-.477 10.667-.602 14.077-.602 41.236s.12 30.557.604 41.223c.49 10.646 2.175 17.913 4.646 24.271c2.556 6.578 5.973 12.157 11.533 17.715c5.557 5.563 11.136 8.988 17.709 11.542c6.363 2.473 13.631 4.158 24.275 4.646c10.667.485 14.073.604 41.23.604c27.161 0 30.559-.119 41.225-.604c10.646-.488 17.921-2.173 24.284-4.646c6.575-2.554 12.146-5.979 17.702-11.542c5.563-5.558 8.979-11.137 11.542-17.712c2.458-6.361 4.146-13.63 4.646-24.272c.479-10.666.604-14.066.604-41.225s-.125-30.567-.604-41.234c-.5-10.646-2.188-17.912-4.646-24.27c-2.563-6.578-5.979-12.157-11.542-17.716c-5.562-5.562-11.125-8.979-17.708-11.53c-6.375-2.474-13.646-4.16-24.292-4.647c-10.667-.485-14.063-.604-41.23-.604zm-8.971 18.021c2.663-.004 5.634 0 8.971 0c26.701 0 29.865.096 40.409.575c9.75.446 15.042 2.075 18.567 3.444c4.667 1.812 7.994 3.979 11.492 7.48c3.5 3.5 5.666 6.833 7.483 11.5c1.369 3.52 3 8.812 3.444 18.562c.479 10.542.583 13.708.583 40.396s-.104 29.855-.583 40.396c-.446 9.75-2.075 15.042-3.444 18.563c-1.812 4.667-3.983 7.99-7.483 11.488c-3.5 3.5-6.823 5.666-11.492 7.479c-3.521 1.375-8.817 3-18.567 3.446c-10.542.479-13.708.583-40.409.583c-26.702 0-29.867-.104-40.408-.583c-9.75-.45-15.042-2.079-18.57-3.448c-4.666-1.813-8-3.979-11.5-7.479s-5.666-6.825-7.483-11.494c-1.369-3.521-3-8.813-3.444-18.563c-.479-10.542-.575-13.708-.575-40.413s.096-29.854.575-40.396c.446-9.75 2.075-15.042 3.444-18.567c1.813-4.667 3.983-8 7.484-11.5s6.833-5.667 11.5-7.483c3.525-1.375 8.819-3 18.569-3.448c9.225-.417 12.8-.542 31.437-.563zm62.351 16.604c-6.625 0-12 5.37-12 11.996c0 6.625 5.375 12 12 12s12-5.375 12-12s-5.375-12-12-12zm-53.38 14.021c-28.36 0-51.354 22.994-51.354 51.355s22.994 51.344 51.354 51.344c28.361 0 51.347-22.983 51.347-51.344c0-28.36-22.988-51.355-51.349-51.355zm0 18.021c18.409 0 33.334 14.923 33.334 33.334c0 18.409-14.925 33.334-33.334 33.334s-33.333-14.925-33.333-33.334c0-18.411 14.923-33.334 33.333-33.334\"/><defs><radialGradient id=\"SVGKdMMobCR\" cx=\"0\" cy=\"0\" r=\"1\" gradientTransform=\"matrix(0 -253.715 235.975 0 68 275.717)\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#fd5\"/><stop offset=\".1\" stop-color=\"#fd5\"/><stop offset=\".5\" stop-color=\"#ff543e\"/><stop offset=\"1\" stop-color=\"#c837ab\"/></radialGradient><radialGradient id=\"SVGqYUiQbXV\" cx=\"0\" cy=\"0\" r=\"1\" gradientTransform=\"rotate(78.68 -32.69 -16.937)scale(113.412 467.488)\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#2B2D31\"/><stop offset=\".128\" stop-color=\"#2B2D31\"/><stop offset=\"1\" stop-color=\"#60f\" stop-opacity=\"0\"/></radialGradient></defs></g>"],
    tiktok: [256, 256, "<rect width=\"256\" height=\"256\" rx=\"58\" fill=\"#000\"/><g transform=\"translate(57.9 48.6) scale(0.5473)\"><path fill=\"#ff004f\" d=\"M189.72 104.421c18.678 13.345 41.56 21.197 66.273 21.197v-47.53a67 67 0 0 1-13.918-1.456v37.413c-24.711 0-47.59-7.851-66.272-21.195v96.996c0 48.523-39.356 87.855-87.9 87.855c-18.113 0-34.949-5.473-48.934-14.86c15.962 16.313 38.222 26.432 62.848 26.432c48.548 0 87.905-39.332 87.905-87.857v-96.995zm17.17-47.952c-9.546-10.423-15.814-23.893-17.17-38.785v-6.113h-13.189c3.32 18.927 14.644 35.097 30.358 44.898M69.673 225.607a40 40 0 0 1-8.203-24.33c0-22.192 18.001-40.186 40.21-40.186a40.3 40.3 0 0 1 12.197 1.883v-48.593c-4.61-.631-9.262-.9-13.912-.801v37.822a40.3 40.3 0 0 0-12.203-1.882c-22.208 0-40.208 17.992-40.208 40.187c0 15.694 8.997 29.281 22.119 35.9\"/><path fill=\"#fff\" d=\"M175.803 92.849c18.683 13.344 41.56 21.195 66.272 21.195V76.631c-13.794-2.937-26.005-10.141-35.186-20.162c-15.715-9.802-27.038-25.972-30.358-44.898h-34.643v189.843c-.079 22.132-18.049 40.052-40.21 40.052c-13.058 0-24.66-6.221-32.007-15.86c-13.12-6.618-22.118-20.206-22.118-35.898c0-22.193 18-40.187 40.208-40.187c4.255 0 8.356.662 12.203 1.882v-37.822c-47.692.985-86.047 39.933-86.047 87.834c0 23.912 9.551 45.589 25.053 61.428c13.985 9.385 30.82 14.86 48.934 14.86c48.545 0 87.9-39.335 87.9-87.857z\"/><path fill=\"#00f2ea\" d=\"M242.075 76.63V66.516a66.3 66.3 0 0 1-35.186-10.047a66.47 66.47 0 0 0 35.186 20.163M176.53 11.57a68 68 0 0 1-.728-5.457V0h-47.834v189.845c-.076 22.13-18.046 40.05-40.208 40.05a40.06 40.06 0 0 1-18.09-4.287c7.347 9.637 18.949 15.857 32.007 15.857c22.16 0 40.132-17.918 40.21-40.05V11.571zM99.966 113.58v-10.769a89 89 0 0 0-12.061-.818C39.355 101.993 0 141.327 0 189.845c0 30.419 15.467 57.227 38.971 72.996c-15.502-15.838-25.053-37.516-25.053-61.427c0-47.9 38.354-86.848 86.048-87.833\"/></g>"],
    x: [256, 256, "<rect width=\"256\" height=\"256\" rx=\"58\" fill=\"#000\"/><g transform=\"translate(50.2 48.6) scale(0.6200)\"><path fill=\"#fff\" d=\"M149.079 108.399L242.33 0h-22.098l-80.97 94.12L74.59 0H0l97.796 142.328L0 256h22.1l85.507-99.395L175.905 256h74.59L149.073 108.399zM118.81 143.58l-9.909-14.172l-78.84-112.773h33.943l63.625 91.011l9.909 14.173l82.705 118.3H186.3l-67.49-96.533z\"/></g>"],
    threads: [256, 256, "<rect width=\"256\" height=\"256\" rx=\"58\" fill=\"#000\"/><g transform=\"translate(58.4 48.6) scale(0.5436)\"><path fill=\"#fff\" d=\"M130.261 291.804h-.087c-43.537-.291-77.007-14.648-99.505-42.661C10.68 224.193.35 189.498 0 146.019v-.204C.35 102.307 10.68 67.64 30.698 42.69C53.167 14.649 86.666.291 130.174 0h.175c33.382.233 61.308 8.812 82.99 25.504C233.734 41.203 248.091 63.555 256 91.977l-24.803 6.916c-13.423-48.148-47.39-72.747-100.965-73.127c-35.366.263-62.125 11.38-79.516 33.033c-16.254 20.28-24.658 49.577-24.979 87.103c.321 37.526 8.725 66.823 25.008 87.104c17.391 21.68 44.15 32.799 79.516 33.032c31.895-.233 52.992-7.674 70.53-24.862c20.017-19.609 19.667-43.683 13.248-58.331c-3.765-8.638-10.622-15.816-19.872-21.273c-2.335 16.429-7.558 29.735-15.612 39.773c-10.767 13.394-26.029 20.718-45.346 21.769c-14.62.788-28.714-2.656-39.627-9.747c-12.927-8.374-20.485-21.155-21.302-36.037c-.788-14.474 4.96-27.78 16.166-37.468c10.71-9.25 25.766-14.678 43.566-15.7c13.102-.729 25.387-.145 36.71 1.722c-1.518-9.016-4.553-16.195-9.105-21.36c-6.245-7.12-15.903-10.738-28.684-10.826h-.35c-10.272 0-24.22 2.83-33.091 16.05L76.132 95.42c11.905-17.683 31.223-27.43 54.45-27.43h.526c38.839.234 61.979 24.016 64.284 65.51a163 163 0 0 1 3.91 1.722c18.121 8.52 31.37 21.419 38.344 37.322c9.687 22.148 10.592 58.244-18.822 87.045c-22.498 22.002-49.782 31.953-88.475 32.215zm12.198-142.138c-2.947 0-5.924.088-8.988.263c-22.323 1.255-36.242 11.497-35.454 26.058c.817 15.262 17.654 22.352 33.85 21.477c14.881-.788 34.257-6.595 37.525-45.113c-8.228-1.78-17.245-2.685-26.933-2.685\"/></g>"]
  };
  /* a network's own app icon, in its own colors: h.brand('tiktok', 28). Only beside a link that opens that network. */
  h.brand = function(name, size){
    var b = BRANDS[String(name || '').toLowerCase()]; if(!b) return '';
    var s = size || 28, w = Math.round(s * b[0] / Math.max(b[0], b[1])), hh = Math.round(s * b[1] / Math.max(b[0], b[1]));
    return '<svg class="c3-brand" width="' + w + '" height="' + hh + '" viewBox="0 0 ' + b[0] + ' ' + b[1] + '" aria-hidden="true" focusable="false">' + b[2] + '</svg>';
  };
  /* BRANDS:END */
  /* the Watch control: a play mark and the word, beside an exercise name.
     opts: {key (data-key; must be unique on the screen), cls} */
  h.watchHTML = function(id, name, opts){
    opts = opts || {};
    /* opts.icon (v362): the round play icon alone, its name for a screen reader */
    return '<button type="button" class="c3-watch' + (opts.icon ? ' ic' : '') + (opts.cls ? ' ' + esc(opts.cls) : '') + '" data-watch="' + esc(id) + '" data-key="' + esc(opts.key || ('watch-' + id)) + '" aria-label="Watch how to do ' + esc(name) + '">' +
      ic('play', opts.icon ? 18 : 15, 2) + '<span>Watch</span></button>';
  };

  /* v346: YouTube's standard player, not the privacy-enhanced one (youtube-nocookie.com). Measured in a real
     Chrome on app.formedlabs.co, 18 Oct 2026: the privacy-enhanced player answered error 150 for every form video
     the lookup returned (4 of 4), and the standard player played the same videos (state 1, playing). */
  var VIDEO_WAIT = 9000, YT = 'https://www.youtube.com', VIDEO_TRIES = 3;
  /* v300: inside the iPhone app the page is capacitor://localhost, and YouTube's player refuses a
     page that cannot send a web address as its referrer (an error where the video should be). There
     the player is framed through the app's own web page (yt.html on app.formedlabs.co), which relays
     its messages; in a browser it is framed directly, as before. */
  var YT_WRAP = 'https://app.formedlabs.co';
  function ytWrapped(){ return !/^https?:$/.test(location.protocol); }
  function ytFrame(v, name){
    if(ytWrapped()){
      return '<iframe src="' + YT_WRAP + '/yt.html?v=' + encodeURIComponent(v.id) + '&amp;t=' + encodeURIComponent(name || '') + '" data-yt-via="wrap" title="' + esc(name + ', ' + (v.title || 'how to do it')) + '"' +
        ' allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    }
    /* the player, inline (never full screen by itself), started without sound.
       enablejsapi: the player tells this page when it cannot play (ytListen). */
    var org = /^https?:$/.test(location.protocol) ? '&amp;origin=' + encodeURIComponent(location.origin) : '';
    return '<iframe src="' + YT + '/embed/' + esc(v.id) + '?rel=0&amp;modestbranding=1&amp;playsinline=1&amp;autoplay=1&amp;mute=1&amp;enablejsapi=1' + org + '" title="' + esc(name + ', ' + (v.title || 'how to do it')) + '"' +
      ' allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }
  /* The player runs in another origin: a video that was removed, blocked where the person is, or
     refused to this device shows YouTube's own "Video unavailable" inside the frame and this page
     would never know. It does say so over the player's message channel (onError). Listening for
     that is what lets the frame give way to the honest line instead of a dead rectangle.
     Returns the function that stops listening. */
  function ytListen(frame, on){
    var ready = false, n = 0, t = 0;
    var via = frame.getAttribute('data-yt-via') === 'wrap' ? YT_WRAP : YT;   /* who the messages come from and go to */
    var say = function(o){ try{ frame.contentWindow.postMessage(JSON.stringify(o), via); }catch(e){} };
    var hello = function(){
      say({event:'listening', id:1, channel:'widget'});
      say({event:'command', func:'addEventListener', args:['onError'], id:1, channel:'widget'});
      say({event:'command', func:'addEventListener', args:['onStateChange'], id:1, channel:'widget'});
    };
    var msg = function(e){
      if(e.origin !== via || e.source !== frame.contentWindow) return;
      var d = e.data; try{ if(typeof d === 'string') d = JSON.parse(d); }catch(x){ return; }
      if(!d || typeof d !== 'object') return;
      if(d.event === 'initialDelivery' || d.event === 'onReady'){ if(!ready){ ready = true; hello(); } }
      else if(d.event === 'onError') on('error', d.info);
      else if((d.event === 'onStateChange' && d.info === 1) || (d.event === 'infoDelivery' && d.info && d.info.playerState === 1)) on('playing');
    };
    /* the app pauses its own players when the tab is put away; this one is asked the same way */
    var vis = function(){ if(document.hidden) say({event:'command', func:'pauseVideo', args:[], id:1, channel:'widget'}); };
    window.addEventListener('message', msg);
    document.addEventListener('visibilitychange', vis);
    frame.addEventListener('load', function(){
      if(t) clearInterval(t);
      n = 0; hello();
      t = setInterval(function(){ if(ready || ++n > 20){ clearInterval(t); t = 0; return; } hello(); }, 300);
    });
    return function(){ window.removeEventListener('message', msg); document.removeEventListener('visibilitychange', vis); if(t){ clearInterval(t); t = 0; } };
  }
  /* the app keeps the video it found for a name for 30 days (VID.mem, localStorage reg.vid);
     one that will not play is forgotten so the next look asks again */
  function forgetVideo(name){
    try{ delete VID.mem[name]; }catch(e){}
    try{ var c = JSON.parse(localStorage.getItem('reg.vid') || '{}'); if(c[name]){ delete c[name]; localStorage.setItem('reg.vid', JSON.stringify(c)); } }catch(e){}
  }
  function watchLoad(){
    var ov = OV; if(!ov || ov.kind !== 'watch') return;
    var d = ov.data, box = ov.panel.querySelector('[data-wa-video]'), by = ov.panel.querySelector('[data-wa-by]');
    if(!box) return;
    var alive = function(){ return OV === ov && box.isConnected; };
    if(d.stop){ try{ d.stop(); }catch(e){} d.stop = null; }
    var done = false, run = ++d.run;
    /* why: 'lookup' (the service gave no video), 'player' (YouTube will not play it here), 'offline' */
    var fail = function(why){
      if(!alive() || d.run !== run) return;
      if(d.stop){ try{ d.stop(); }catch(e){} d.stop = null; }
      var q = encodeURIComponent(d.info.n + ' exercise proper form');
      var has = d.info.img.length || d.info.steps.length || d.info.cue || d.info.pat;
      box.setAttribute('data-state', 'none'); box.setAttribute('data-why', why);
      if(by) by.textContent = '';
      box.innerHTML = '<div class="c3-wa-none"><span role="status">' + (why === 'offline' ? 'No connection. The video needs one.' : why === 'player' ? 'This video will not play here.' : 'The video could not be loaded here.') + '</span>' +
        '<span class="acts">' + (why === 'player' ? '' : '<button type="button" class="c3-btn-quiet bare" data-wa="retry">Try again</button>') +
        '<a class="c3-wa-yt" href="https://www.youtube.com/results?search_query=' + q + '" target="_blank" rel="noopener">Search YouTube' + ic('out', 15, 2.2) + '</a></span>' +
        (has ? '<span class="more">' + ic('arrow', 14, 2.6) + (d.info.img.length ? 'Pictures and steps below' : 'How to do it, below') + '</span>' : '') + '</div>';
    };
    if(navigator.onLine === false && !safe(function(){ return VID.mem[d.info.n]; }, null)){ fail('offline'); return; }
    box.setAttribute('data-state', 'wait'); box.removeAttribute('data-why');
    box.innerHTML = '<div class="c3-wa-wait" role="status"><i></i><span>Finding the video</span></div>';
    if(by) by.textContent = '';
    var t = setTimeout(function(){ if(!done){ done = true; fail('lookup'); } }, VIDEO_WAIT);
    var p;
    d.skip = d.skip || [];
    try{ p = moveVideo(d.info.e, d.skip); }catch(err){ p = Promise.reject(err); }       /* the app's own lookup and its 30-day memory */
    Promise.resolve(p).then(function(v){
      if(done) return; done = true; clearTimeout(t);
      if(!alive() || d.run !== run) return;
      if(!v || !/^[A-Za-z0-9_-]{11}$/.test(v.id || '')){ fail('lookup'); return; }
      if(d.skip.indexOf(v.id) >= 0){ forgetVideo(d.info.n); fail('player'); return; }      /* the lookup has nothing new: the honest line, not the same refusal again */
      box.setAttribute('data-state', 'frame');
      box.innerHTML = ytFrame(v, d.info.n);
      if(by) by.textContent = (v.title || '') + (v.by ? ' · ' + v.by : '');
      var fr = box.querySelector('iframe');
      d.stop = ytListen(fr, function(what){
        if(!alive() || d.run !== run) return;
        if(what === 'playing') box.setAttribute('data-state', 'playing');
        else if(what === 'error'){
          forgetVideo(d.info.n);
          /* v346: a video its owner will not let play outside YouTube is skipped, and the lookup is asked
             for the next one YouTube ranks, up to VIDEO_TRIES videos, before the honest line shows */
          if(d.skip.indexOf(v.id) < 0) d.skip.push(v.id);
          safe(function(){ vidMarkBad(v.id); }, null);   /* v346.1: this device will not be offered it again */
          d.tries = (d.tries || 0) + 1;                 /* counted apart from the list: a lookup that answers the same id again cannot loop */
          if(d.tries < VIDEO_TRIES) watchLoad(); else fail('player');
        }
      });
    }, function(){ if(done) return; done = true; clearTimeout(t); fail('lookup'); });
  }
  function watchAct(a){
    var ov = OV; if(!ov || ov.kind !== 'watch') return;
    if(a === 'retry'){ ov.data.tries = 0; watchLoad(); }
    else if(a === 'lib'){
      var id = ov.data.info.id;
      closeOv({silent:true});
      try{ openMoveInLibrary(id); }catch(e){ try{ console.error('[c3] library', e); }catch(x){} }
    }
  }
  function watchBody(I){
    var s = '';
    if(I.img.length){
      s += '<div class="c3-wa-demo' + (I.img.length === 1 ? ' one' : '') + '">' +
        I.img.map(function(src, i){ return '<figure><img src="' + esc(src) + '" alt="' + esc(I.n + ', ' + (i ? 'finish' : 'start') + ' position') + '" decoding="async"><figcaption>' + (i ? 'Finish' : 'Start') + '</figcaption></figure>'; }).join('') + '</div>';
    }
    var t = '';
    if(I.facts.length) t += '<p class="c3-wa-facts">' + I.facts.map(function(f){ return '<span>' + esc(f[0]) + ' <b>' + esc(f[1]) + '</b></span>'; }).join('') + '</p>';
    if(I.steps.length) t += '<h3 class="c3-wa-h">How to do it</h3><ol class="c3-wa-steps">' + I.steps.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    if(I.cue){
      t += '<h3 class="c3-wa-h">Coaching cues</h3>' + (I.cue.s ? '<p class="c3-wa-p">' + esc(I.cue.s) + '</p>' : '') + (I.cue.x ? '<p class="c3-wa-p">' + esc(I.cue.x) + '</p>' : '');
      if(I.cue.e.length) t += '<h3 class="c3-wa-h warn">Watch for</h3><ul class="c3-wa-bad">' + I.cue.e.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    }else if(I.pat){
      t += '<h3 class="c3-wa-h">Coaching cues</h3>' + (I.pat.c ? '<p class="c3-wa-p">' + esc(I.pat.c) + '</p>' : '');
      if(I.pat.e) t += '<h3 class="c3-wa-h warn">Watch for</h3><ul class="c3-wa-bad"><li>' + esc(I.pat.e) + '</li></ul>';
    }
    return {media:s, text:t};
  }
  /* open WATCH for an exercise id or a movement name. Returns true when it opened.
     Nothing under it is touched: a workout keeps its set, its numbers and its rest clock. */
  h.watch = function(ref, fromEl){
    try{
      var I = h.moveInfo(ref); if(!I) return false;
      var B = watchBody(I);
      var inWorkout = C3.current === 'workout' && C3.mode === 'on';
      var html = '<header class="c3-ov-head"><span class="c3-ov-t"><i></i>' + esc(I.group || 'How to do it') + '</span>' +
          '<button type="button" class="c3-ov-x" data-ov="close" aria-label="Close">' + ic('x', 22, 2.6) + '</button></header>' +
        '<h2 class="c3-wa-name">' + esc(I.n) + '</h2>' +
        '<div class="c3-wa-grid"><div class="c3-wa-media"><div class="c3-wa-video" data-wa-video></div><p class="c3-wa-by" data-wa-by></p><div data-wa-demo>' + B.media + '</div></div>' +
          '<div class="c3-wa-text" data-wa-text>' + B.text + '</div></div>' +
        '<div class="c3-adj-foot">' + ((I.howOnly || inWorkout) ? '<span></span>' : '<button type="button" class="c3-link" data-wa="lib">Open in the library</button>') +
          '<button type="button" class="c3-btn-quiet" data-ov="close">Done</button></div>';
      var ov = openOv({kind:'watch', label:'How to do ' + I.n, html:html, from:fromEl, anchor:false, data:{id:I.id, info:I, run:0, stop:null},
        onClose:function(o){ if(o.data.stop){ try{ o.data.stop(); }catch(e){} o.data.stop = null; } }});
      if(!ov) return false;
      watchLoad();
      /* the picture and step library still loading (first seconds after boot): fill them in when it lands */
      if(!I.loaded && !I.howOnly){
        /* exdbLoad() answers at once with nothing while the boot's own load is still in flight, so
           look again until the library is there (about 12 s), for as long as this viewer is up */
        var tries = 0;
        var fill = function(){
          if(OV !== ov) return;
          var J = h.moveInfo(ref);
          if(J && J.loaded){
            var b2 = watchBody(J), dm = ov.panel.querySelector('[data-wa-demo]'), tx = ov.panel.querySelector('[data-wa-text]');
            if(dm) dm.innerHTML = b2.media; if(tx) tx.innerHTML = b2.text;
            ov.data.info = J;
            return;
          }
          if(++tries < 40) setTimeout(fill, 300);
        };
        safe(function(){ exdbLoad(); }, null);
        setTimeout(fill, 150);
      }
      return true;
    }catch(e){ try{ console.error('[c3] watch', e); }catch(x){} return false; }
  };
})();

/* v298: pictures warmed before they are needed. The screens draw their pictures from scratch on
   every visit, and the first visit to a screen showed an empty frame for a beat while the file
   came down. Once the first screen has painted and the page is idle, this asks for the few
   pictures the other screens and this week's sessions use, decodes them, and keeps them, so a
   frame is never drawn empty. It asks for nothing on a data saver connection, and it asks for
   each file once. */
(function(){
  var W = window, kept = {}, started = false;
  function list(){
    var h = W.C3 && W.C3.h; if(!h) return [];
    var names = ['nova-cook', 'nova-water', 'train-heavy', 'one-team-every-goal', 'crew-celebrate-portrait', 'dakota-stretch', 'nova-stretch', 'train-team'];
    try{ ((h.week() || {}).days || []).forEach(function(d){ if(d && !d.rest) names.unshift(h.sessionPhoto(d)); }); }catch(e){}
    try{ if(h.firstRun && h.firstRun()) names = ['welcome-your-team', 'first-session'].concat(names); }catch(e){}
    var out = [], seen = {};
    /* v361: the four coaches' faces first (You and every coach line draw them; they were drawn empty for a beat) */
    try{ (h.coaches() || []).forEach(function(c){ if(c && c.badge && !seen[c.badge]){ seen[c.badge] = 1; out.push(c.badge); } }); }catch(e){}
    names.forEach(function(n){ var src = h.photo(n); if(src && !seen[src]){ seen[src] = 1; out.push(src); } });
    return out;
  }
  function warm(){
    if(started) return; started = true;
    try{ var c = navigator.connection; if(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return; }catch(e){}
    var q = list();
    /* one at a time, so the pictures never compete with what the person is doing */
    (function next(){
      var src = q.shift(); if(!src) return;
      if(kept[src]) return next();
      var img = new Image(); img.decoding = 'async'; kept[src] = img;
      var go = function(){ setTimeout(next, 60); };
      img.onload = function(){ try{ img.decode ? img.decode().then(go, go) : go(); }catch(e){ go(); } };
      img.onerror = go;
      img.src = src;
    })();
  }
  function soon(){ var idle = W.requestIdleCallback || function(f){ return setTimeout(f, 1200); }; idle(warm, {timeout: 4000}); }
  if(document.readyState === 'complete') setTimeout(soon, 800);
  else W.addEventListener('load', function(){ setTimeout(soon, 800); }, {once: true});
  /* for the tests: what was asked for */
  /* a picture already decoded here is drawn straight away (no lazy wait) by pictureHTML */
  if(W.C3 && W.C3.h){ W.C3.h.warmed = function(){ return Object.keys(kept); };
    W.C3.h.isWarm = function(src){ var k = kept[src]; return !!(k && k.complete && k.naturalWidth > 0); }; }
})();

/* ---------- v313: THE NOW ENGINE ----------
   Chad, 15 Oct 2026: "we need it to almost come alive and know exactly what to do before the human does
   anything". The app learns from the person's own log, on the phone, no AI and nothing sent anywhere:
   - likely: the foods they eat around this time of day (within 75 minutes of now, on 2+ different days in
     the last 28), at their usual amount, best first
   - protein: their go-to protein (eaten on 3+ days, 15+ g a serving), the one likely now first
   - meal: yesterday's meal around this hour, when this meal is not logged yet today
   - weigh: whether they weigh in the morning (3+ mornings in 14 days) and whether today is done
   And h.now() picks the one thing that matters this minute (the morning weigh-in, the refuel after a
   session), which Today puts first with a one-tap answer. */
(function(W){
  'use strict';
  var C3 = W.C3; if(!C3 || !C3.h) return;
  var h = C3.h, DAY = 864e5, MIN = 60000;
  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function tod(ms){ var d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
  function gap(a, b){ var d = Math.abs(a - b); return Math.min(d, 1440 - d); }
  function key(ms){ return safe(function(){ return dkey(ms); }, ''); }
  function median(xs){ var s = xs.slice().sort(function(a, b){ return a - b; }), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; }
  function r1(v){ return Math.round((+v || 0) * 10) / 10; }
  function mealWord(m){ return m < 630 ? 'breakfast' : m < 900 ? 'lunch' : m < 1020 ? 'afternoon snack' : m < 1260 ? 'dinner' : 'evening snack'; }
  function serving(id, grams){
    var f = safe(function(){ return foodById(id); }, null); if(!f) return null;
    var g = Math.max(1, Math.round(+grams || 0)); var s = scaleFood(f, g);
    return {id: id, n: f.n, g: g, p: r1(s.p), kcal: Math.round(s.kcal)};
  }
  h.learn = function(now){
    now = now || Date.now();
    var food = safe(function(){ return (ALL.food || []).filter(function(e){ return e && e.id && e.at > now - 28 * DAY && e.at <= now; }); }, []);
    var today = key(now), m0 = tod(now);
    var by = {};
    food.forEach(function(e){
      var b = by[e.id] = by[e.id] || {id: e.id, days: {}, nearDays: {}, grams: [], nearGrams: [], p: []};
      var k = key(e.at); b.days[k] = 1; b.grams.push(+e.g || 0); b.p.push(+e.p || 0);
      if(gap(tod(e.at), m0) <= 75 && k !== today){ b.nearDays[k] = 1; b.nearGrams.push(+e.g || 0); }
    });
    var todayIds = {}; food.forEach(function(e){ if(key(e.at) === today) todayIds[e.id] = 1; });
    var likely = Object.keys(by).map(function(id){ var b = by[id], n = Object.keys(b.nearDays).length; return n >= 2 && !todayIds[id] ? {b: b, n: n} : null; })
      .filter(Boolean).sort(function(a, b){ return b.n - a.n; }).slice(0, 3)
      .map(function(x){ var s = serving(x.b.id, median(x.b.nearGrams)); if(s) s.days = x.n; return s; }).filter(Boolean);
    var protein = Object.keys(by).map(function(id){ var b = by[id], n = Object.keys(b.days).length, pm = median(b.p); return n >= 3 && pm >= 15 ? {b: b, n: n, near: Object.keys(b.nearDays).length, pm: pm} : null; })
      .filter(Boolean).sort(function(a, b){ return (b.near - a.near) || (b.pm - a.pm); })
      .map(function(x){ var s = serving(x.b.id, median(x.b.grams)); if(s) s.days = x.n; return s; }).filter(Boolean)[0] || null;
    /* yesterday's meal around this hour, unless this meal is already logged today */
    var yk = key(now - DAY);
    var near = function(e){ return gap(tod(e.at), m0) <= 90; };
    var meal = null;
    if(!food.some(function(e){ return key(e.at) === today && near(e); })){
      var items = food.filter(function(e){ return key(e.at) === yk && near(e); }).map(function(e){ return serving(e.id, e.g); }).filter(Boolean);
      if(items.length) meal = {word: mealWord(m0), items: items, p: r1(items.reduce(function(a, x){ return a + x.p; }, 0)), kcal: items.reduce(function(a, x){ return a + x.kcal; }, 0)};
    }
    var Wt = safe(function(){ return (ALL.weights || []).filter(function(w){ return w.at > now - 14 * DAY; }); }, []);
    var mornings = {}; Wt.forEach(function(w){ if(tod(w.at) < 660) mornings[key(w.at)] = 1; });
    var weigh = {habit: Object.keys(mornings).length >= 3, mornings: Object.keys(mornings).length, today: Wt.some(function(w){ return key(w.at) === today; })};
    var sess = safe(function(){ return Object.keys(ALL.workLog || {}).map(function(k){ return ALL.workLog[k]; }); }, []);
    var firsts = sess.map(function(L){ var m = 0; Object.keys((L && L.rows) || {}).forEach(function(id){ (L.rows[id] || []).forEach(function(r){ if(r && r.done && r.at && (!m || r.at < m)) m = r.at; }); }); return m; }).filter(function(x){ return x > now - 28 * DAY; });
    return {now: now, likely: likely, protein: protein, meal: meal, weigh: weigh, train: {usual: firsts.length >= 3 ? Math.round(median(firsts.map(tod))) : null, sessions: firsts.length}};
  };
  function sessionEnd(L){ var m = 0; Object.keys((L && L.rows) || {}).forEach(function(id){ (L.rows[id] || []).forEach(function(r){ if(r && r.done && r.at > m) m = r.at; }); }); return (L && L.fin) || m; }
  /* the one thing this minute is for, or null */
  h.now = function(now){
    now = now || Date.now();
    var L = h.learn(now), m = tod(now);
    if(m >= 240 && m < 660 && L.weigh.habit && !L.weigh.today){
      var w = safe(function(){ return healthWeigh() || lastWeigh(); }, null);
      if(w && w.lb > 0) return {kind: 'weigh', lb: w.lb, health: !!safe(function(){ return healthWeigh(); }, null), learn: L};
    }
    var F = safe(function(){ return h.fractions(); }, null), T = safe(function(){ return h.today(); }, null);
    var Lw = safe(function(){ return (ALL.workLog || {})[key(now)]; }, null);
    if(F && T && T.done && F.protein.applies && F.protein.frac < 1 && L.protein){
      var end = sessionEnd(Lw), mins = end ? Math.round((now - end) / MIN) : null;
      if(mins != null && mins >= 0 && mins <= 120) return {kind: 'refuel', left: Math.max(0, Math.round(F.protein.target - F.protein.now)), food: L.protein, mins: mins, learn: L};
    }
    return null;
  };
  /* one tap: log a food at an amount, with Undo */
  h.logFood = function(id, grams, quiet){
    var f = safe(function(){ return foodById(id); }, null); if(!f || !(grams > 0)) return null;
    var e = safe(function(){ return foodAdd(f, grams); }, null); if(!e) return null;
    if(!quiet){
      safe(function(){ offerUndo('<b>' + esc(f.n) + '</b> ' + Math.round(grams) + ' g logged · ' + Math.round(e.p) + ' g protein.', function(){ foodDelete(e.at); }); });
      safe(function(){ drawAll(); }); safe(function(){ appBuzz(18); });
    }
    return e;
  };
  h.repeatMeal = function(items){
    var done = (items || []).map(function(x){ return h.logFood(x.id, x.g, true); }).filter(Boolean);
    if(!done.length) return 0;
    var p = done.reduce(function(a, e){ return a + (+e.p || 0); }, 0);
    safe(function(){ offerUndo('<b>' + done.length + ' food' + (done.length === 1 ? '' : 's') + '</b> logged · ' + Math.round(p) + ' g protein.', function(){ done.forEach(function(e){ foodDelete(e.at); }); }); });
    safe(function(){ drawAll(); }); safe(function(){ appBuzz(18); });
    return done.length;
  };
  /* the app's own one-tap weigh-in (one reading per six hours, with Undo) */
  h.weighAgain = function(){ var q = safe(function(){ return quickFor('weigh'); }, null); if(!q) return false; q.run(); return true; };
  h.clock = function(ms){ return safe(function(){ return new Date(ms || Date.now()).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}); }, ''); };
})(window);

/* ================================================================
   v317: THE FAST-FOOD RADAR (written v315 on the v309 branch, ported to main v317)
   Chad, 15 Oct 2026: "know when you pull into a fast food restaurant and then give pushback and
   offer healthy selections". Off until the person switches it on (Settings, Fast-food radar).
   Only while the app is open and on screen (a browser cannot watch location in the background,
   and the iPhone app asks for location only while in use):
   - the phone's location is watched; the restaurants around it come from OpenStreetMap, asked
     for by a 2 km square, never the exact spot (Overpass API), and kept in memory only;
   - a chain the app has verified numbers for (brain/radar/chains.json, every number read from
     the chain's own nutrition page) within 70 m for 40 s with the phone barely moving is
     "pulled in": Nova shows the order that fits what is left of today, its calories and protein,
     and one tap logs it;
   - Not now: not again at that place for 6 hours. Mute here: never at that place again. Both
     kept on this phone only (localStorage), with no coordinates in them.
   ================================================================ */
(function(W){
  var h = W.C3 && W.C3.h; if(!h) return;
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  function esc(s){ return h.esc ? h.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
  var R = {watch:null, chains:null, loading:null, tiles:{}, tileLoading:{}, near:null, since:0, last:null, open:null, err:''};
  var TILE = 0.02, NEAR_M = 70, DWELL_MS = 40000, SNOOZE_MS = 6 * 3600e3;
  var OVERPASS = 'https://overpass-api.de/api/interpreter';

  function prefs(){ var u = safe(function(){ return ALL.ui; }, null) || {}; return {on: !!(u.radar && u.radar.on)}; }
  h.radarOn = function(){ return prefs().on; };
  function local(k, v){
    try{
      if(v === undefined){ var x = localStorage.getItem(k); return x ? JSON.parse(x) : {}; }
      localStorage.setItem(k, JSON.stringify(v));
    }catch(e){ return {}; }
  }
  function norm(s){ return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function meters(a, b){
    var r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  /* the chains with verified numbers, fetched once */
  function chains(){
    if(R.chains) return Promise.resolve(R.chains);
    if(R.loading) return R.loading;
    R.loading = fetch('brain/radar/chains.json', {cache:'force-cache'}).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if(!j || !Array.isArray(j.chains)) throw new Error('no chains');
      j.byName = {}; j.byWd = {};
      j.chains.forEach(function(c){ (c.osm || [c.brand]).concat([c.brand]).forEach(function(n){ j.byName[norm(n)] = c; }); if(c.wikidata) j.byWd[c.wikidata] = c; });
      R.chains = j; return j;
    }).catch(function(){ R.loading = null; return null; });
    return R.loading;
  }
  function chainFor(tags){
    var C = R.chains; if(!C || !tags) return null;
    /* OpenStreetMap tags a chain's places with its Wikidata id (brand:wikidata): that first, then the names */
    return (tags['brand:wikidata'] && C.byWd[tags['brand:wikidata']]) || C.byName[norm(tags.brand)] || C.byName[norm(tags.name)] || null;
  }
  /* the restaurants of one 2 km square, from OpenStreetMap; the square is all that is sent */
  function tileKey(lat, lon){ return Math.floor(lat / TILE) + ':' + Math.floor(lon / TILE); }
  function tile(lat, lon){
    var k = tileKey(lat, lon);
    if(R.tiles[k]) return Promise.resolve(R.tiles[k]);
    if(R.tileLoading[k]) return R.tileLoading[k];
    var a = k.split(':'), S = (+a[0]) * TILE, Wd = (+a[1]) * TILE, pad = 0.002;
    var bb = [(S - pad).toFixed(4), (Wd - pad).toFixed(4), (S + TILE + pad).toFixed(4), (Wd + TILE + pad).toFixed(4)].join(',');
    var q = '[out:json][timeout:20];nwr["amenity"~"^(fast_food|cafe|restaurant|ice_cream)$"](' + bb + ');out center tags;';
    R.tileLoading[k] = fetch(OVERPASS, {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:'data=' + encodeURIComponent(q)})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){
        var list = ((j && j.elements) || []).map(function(e){
          var lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
          return (lat != null && lon != null) ? {id: e.type[0] + e.id, lat:lat, lon:lon, tags:e.tags || {}} : null;
        }).filter(Boolean);
        R.tiles[k] = list; delete R.tileLoading[k]; return list;
      })
      .catch(function(){ delete R.tileLoading[k]; return null; });
    return R.tileLoading[k];
  }
  /* the nearest place with a verified chain, or null */
  function nearest(fix, list){
    var best = null;
    (list || []).forEach(function(p){
      var c = chainFor(p.tags); if(!c) return;
      var d = meters(fix, p);
      if(d <= NEAR_M + Math.min(30, (fix.acc || 0) / 2) && (!best || d < best.d)) best = {place:p, chain:c, d:d};
    });
    return best;
  }
  function onFix(pos){
    var c = pos && pos.coords; if(!c) return;
    var fix = {lat:c.latitude, lon:c.longitude, acc:c.accuracy || 0, speed:(c.speed == null || isNaN(c.speed)) ? null : c.speed, at: pos.timestamp || Date.now()};
    R.last = fix;
    if(fix.acc > 150) return;                                   /* too rough to say which lot */
    chains().then(function(C){
      if(!C) return null;
      return Promise.all([tile(fix.lat, fix.lon)]).then(function(L){ return L[0]; });
    }).then(function(list){
      if(!list) return;
      var n = nearest(fix, list);
      if(!n){ R.near = null; R.since = 0; return; }
      if(!R.near || R.near.place.id !== n.place.id){ R.near = n; R.since = fix.at; return; }
      var moving = fix.speed != null && fix.speed > 4;
      if(moving){ R.since = fix.at; return; }
      if(fix.at - R.since >= DWELL_MS) pulledIn(n);
    });
  }
  function canShow(id){
    if(R.open) return false;
    if(local('radar.muted')[id]) return false;
    var seen = local('radar.seen')[id]; if(seen && Date.now() - seen < SNOOZE_MS) return false;
    if(!document.documentElement.classList.contains('c3-on')) return false;          /* only over a C3 screen */
    if(safe(function(){ return C3.current === 'workout'; }, false)) return false;    /* never over a set */
    if(safe(function(){ return !!h.overlay(); }, false)) return false;
    return true;
  }
  /* the day so far: what is left of the calories and protein */
  function today(){
    var key = safe(function(){ return dkey(Date.now()); }, '');
    var t = safe(function(){ return dayTotals(key); }, null) || {kcal:0, p:0};
    var cT = safe(function(){ return calorieTarget(); }, null), pT = safe(function(){ return proteinTarget(); }, null);
    return {kcal: Math.round(t.kcal || 0), p: Math.round(t.p || 0), kT: (cT && cT.kcal > 0) ? Math.round(cT.kcal) : null, pT: pT > 0 ? Math.round(pT) : null};
  }
  /* the chain's verified orders, best first for what is left today: the ones that fit, then the
     most protein for the calories */
  function picks(chain, D){
    var left = D.kT != null ? D.kT - D.kcal : null;
    return (chain.items || []).filter(function(i){ return i.kcal > 0 && i.protein > 0; }).slice().sort(function(a, b){
      var fa = left == null || a.kcal <= left ? 1 : 0, fb = left == null || b.kcal <= left ? 1 : 0;
      if(fa !== fb) return fb - fa;
      return (b.protein / b.kcal) - (a.protein / a.kcal);
    });
  }
  function coachLine(item, D){
    var left = D.kT != null ? D.kT - D.kcal : null, pLeft = D.pT != null ? D.pT - D.p : null;
    if(left != null && left > 0 && item.kcal <= left){
      return 'Not judging. You have ' + h.fmt.n(left) + ' calories left today. This fits' + (pLeft > 0 ? ' and gets you ' + Math.min(Math.round(item.protein), pLeft) + ' g closer on protein.' : '.');
    }
    if(left != null) return 'You are at ' + h.fmt.n(D.kcal) + ' of ' + h.fmt.n(D.kT) + ' calories today. This is the most protein for the calories on this menu.';
    return 'The most protein for the calories on this menu.';
  }
  function host(url){ return safe(function(){ return new URL(Array.isArray(url) ? url[0] : url).hostname.replace(/^www\./, ''); }, ''); }
  function checkedWord(d){ return safe(function(){ return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); }, d); }
  function layerHTML(){
    var O = R.open, item = O.list[O.i], D = O.D;
    var nova = esc(h.badge('nova-reyes'));
    var pin = '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"></path><circle cx="12" cy="10" r="2.4"></circle></svg>';
    return '<div class="rd">' +
      '<button type="button" class="c3-ov-x rd-x" data-rd="later" aria-label="Not now">' + h.icon('x', 22, 2.6) + '</button>' +
      '<div class="rd-ping" aria-hidden="true"><span></span><span></span>' + pin + '</div>' +
      '<div class="rd-eye">You just pulled in</div>' +
      '<h2 class="rd-brand' + (O.chain.brand.length > 12 ? ' long' : '') + '">' + esc(O.chain.brand) + '</h2>' +
      '<div class="rd-coach"><img src="' + nova + '" alt="" width="52" height="52"><p><b>Nova</b> ' + esc(coachLine(item, D)) + '</p></div>' +
      '<div class="rd-pick"><div class="rd-k">Order this' + (O.list.length > 1 ? ' <span class="c3-num">' + (O.i + 1) + ' of ' + O.list.length + '</span>' : '') + '</div>' +
        '<div class="rd-item">' + esc(item.name) + (item.note ? '<small>' + esc(item.note) + '</small>' : '') + '</div>' +
        '<div class="rd-nums c3-num"><div><b>' + h.fmt.n(Math.round(item.kcal)) + '</b><span>calories</span></div><div><b>' + h.fmt.n(Math.round(item.protein)) + ' g</b><span>protein</span></div></div></div>' +
      '<button type="button" class="c3-btn-primary rd-go" data-rd="log" data-key="rd-log"><span>I\'m ordering this · Log it</span>' + h.icon('arrow', 30) + '</button>' +
      '<div class="rd-links">' + (O.list.length > 1 ? '<button type="button" data-rd="next">Other picks</button>' : '') + '<button type="button" data-rd="later">Not now</button><button type="button" data-rd="mute">Mute here</button></div>' +
      /* a chain whose newest published guide is older than our check says so, with the guide's own date */
      '<p class="rd-src">Numbers from ' + esc(O.chain.site || host(O.chain.source)) + (O.chain.asOf ? ', from its guide dated ' + esc(checkedWord(O.chain.asOf)) : ', checked ' + esc(checkedWord(R.chains.checked))) + '. Your exact location is never sent or saved.</p>' +
    '</div>';
  }
  function paint(){ var p = safe(function(){ return C3.root.querySelector('.c3-ov.radar .c3-ov-panel'); }, null); if(p && R.open) p.innerHTML = layerHTML(); }
  function pulledIn(n){
    var id = n.place.id; if(!canShow(id)) return;
    var D = today(), list = picks(n.chain, D); if(!list.length) return;
    var seen = local('radar.seen'); seen[id] = Date.now(); local('radar.seen', seen);
    R.open = {id:id, chain:n.chain, list:list, i:0, D:D};
    try{ appBuzz([30, 60, 30]); }catch(e){}
    h.openLayer({kind:'radar', label:'You just pulled in: ' + n.chain.brand, html: layerHTML(), onClose: function(){ R.open = null; }});
  }
  h.radarAct = function(a){
    var O = R.open; if(!O) return;
    if(a === 'next'){ O.i = (O.i + 1) % O.list.length; paint(); return; }
    if(a === 'mute'){ var m = local('radar.muted'); m[O.id] = 1; local('radar.muted', m); h.closeOverlay(); return; }
    if(a === 'later'){ h.closeOverlay(); return; }
    if(a === 'log'){
      var it = O.list[O.i];
      var r = safe(function(){ return quickAdd({n: (O.chain.brand + ' ' + it.name).slice(0, 60), kcal: it.kcal, p: it.protein, c: it.carbs, f: it.fat}); }, null);
      h.closeOverlay();
      if(r && r.ok){
        var e = r.entry;
        try{ offerUndo('<b>' + esc(e.n) + '</b> · ' + e.kcal + ' kcal, ' + e.p + ' g protein.', function(){ ALL.food = (ALL.food || []).filter(function(x){ return x.at !== e.at; }); try{ tomb('food', String(e.at)); }catch(x){} save(); try{ drawAll(); }catch(x){} C3.refresh(); }); }catch(x){}
        try{ drawAll(); }catch(x){}
        C3.refresh();
      }
    }
  };
  /* the watch runs while the app is open and the radar is on; nothing in the background */
  function start(){
    if(R.watch != null || !prefs().on || document.hidden || !navigator.geolocation) return;
    chains();
    try{ R.watch = navigator.geolocation.watchPosition(onFix, function(e){ R.err = e && e.code === 1 ? 'denied' : 'unavailable'; if(e && e.code === 1) stop(); }, {enableHighAccuracy:true, maximumAge:15000, timeout:30000}); }catch(e){ R.watch = null; }
  }
  function stop(){ if(R.watch != null){ try{ navigator.geolocation.clearWatch(R.watch); }catch(e){} } R.watch = null; R.near = null; R.since = 0; }
  h.radarSet = function(on){
    ALL.ui = ALL.ui || {}; ALL.ui.radar = ALL.ui.radar || {}; ALL.ui.radar.on = !!on; R.err = '';
    try{ save(); }catch(e){}
    if(on) start(); else stop();
  };
  h.radarState = function(){ return {on: prefs().on, watching: R.watch != null, err: R.err, near: R.near ? {brand: R.near.chain.brand, m: Math.round(R.near.d)} : null}; };
  /* for the proof: a fix as the phone would report it */
  h.radarFix = function(lat, lon, o){ o = o || {}; onFix({coords:{latitude:lat, longitude:lon, accuracy:o.acc || 10, speed:o.speed == null ? 0 : o.speed}, timestamp:o.at || Date.now()}); };
  document.addEventListener('visibilitychange', function(){ if(document.hidden) stop(); else start(); });
  setTimeout(start, 3000);
})(window);

/* =====================================================================================
   v358 ADD: THE PROGRESS STRIP and THE BODY MAP (appended block; nothing above this line is changed)
   Chad, 26 Oct 2026, after the Liftoff audit: "1. One progress strip at the top of every screen: streak, workouts
   this week and protein today, all from real numbers. It replaces the Saved on this device line, and the save
   status becomes a small icon. 2. A body map on Progress and Train, lit by the sets you actually logged this week."

   C3.h.strip()      the strip under the bar. Three numbers, each a door: the day streak (the app's streaks(), the
                     same run the Streak view shows), workouts this week (the Progress screen's own count: sessions
                     logged of the sessions planned) and protein today (h.fractions(): eaten of the target, the Food screen's own numbers).
                     On the research pages (Track and what opens from it) the second and third are the dose week
                     (buildSchedule: taken of scheduled) and the next dose (doseTruth): training and research never
                     share a frame.
   C3.h.bodyMap(o)   front and back, each muscle lit by its working sets since Sunday (muscleSets(), warm-ups out,
                     a helper muscle half a set, exactly the History screen's count), against the app's own pooled
                     band (VOL_EV, volVerdict). Under it the ten counts. o: {from:'progress'|'train'}
   ===================================================================================== */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  var DAYMS = 864e5;
  function weekStart(){ var W = safe(function(){ return h.week(); }, null), t = W && W.days && W.days[0] ? W.days[0].at : Date.now(); var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  var RESEARCH = {doses:1, log:1, protocol:1, addcmp:1, math:1, levels:1};

  /* ---------- the strip ---------- */
  var FLAME = '<path d="M12 21.2c-3.9 0-6.6-2.7-6.6-6.3 0-2.9 1.7-4.8 3.3-6.6.9-1 1.8-2 2.3-3.3.2-.5.8-.6 1.1-.2 1.9 2.3 2.4 4.3 2.2 6 1-.4 1.7-1.2 2-2.2.2-.5.8-.6 1.1-.1 1.2 1.6 1.2 3.4 1.2 4.9 0 4.6-2.8 7.8-6.6 7.8z"></path><path d="M12 21.2c-1.7 0-2.9-1.2-2.9-2.9 0-1.6 1.2-2.6 2.1-3.7.3-.4.9-.3 1 .2.2.8.7 1.4 1.4 1.7.3-.4.6-.9.7-1.5.1-.4.6-.5.9-.2.6.8.8 1.7.8 2.6 0 2.2-1.6 3.8-4 3.8z"></path>';
  var CLOCK = '<circle cx="12" cy="12" r="8.2"></circle><path d="M12 7.6V12l3 2"></path>';
  function svg(inner, size){ return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>'; }
  var KEY = 'ps';
  function item(k, go, params, icon, big, of, word, aria, meter){
    return '<button type="button" class="c3-ps-i ' + k + '" data-go="' + go + '"' + (params ? ' data-params="' + esc(JSON.stringify(params)) + '"' : '') + ' data-key="' + KEY + '-' + k.split(' ')[0] + '" aria-label="' + esc(aria) + '">' +
      '<span class="t">' + icon + '<b class="c3-num">' + esc(big) + (of ? '<small>' + esc(of) + '</small>' : '') + '</b></span>' +
      '<span class="w">' + esc(word[0]) + (word[1] ? '<span class="x"> ' + esc(word[1]) + '</span>' : '') + '</span>' + (meter || '') + '</button>';
  }
  function bar(frac){ frac = Math.max(0, Math.min(1, frac || 0)); return '<span class="m" aria-hidden="true"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></span>'; }
  function pips(done, planned){
    var n = Math.max(planned, done), s = '';
    if(!n) return '<span class="m" aria-hidden="true"></span>';
    for(var i = 0; i < n; i++) s += '<i class="' + (i < done ? 'on' : '') + '"></i>';
    return '<span class="m pips" aria-hidden="true">' + s + '</span>';
  }
  function lastSeven(){
    var A = safe(function(){ return activeDays(); }, null), out = [], now = Date.now();
    for(var i = 6; i >= 0; i--) out.push(!!(A && A.has(safe(function(){ return dkey(now - i * DAYMS); }, ''))));
    return out;
  }
  h.stripData = function(){
    var st = safe(function(){ return streaks(); }, null), run = st ? (st.now | 0) : 0;
    var lane = (RESEARCH[C3.current] || safe(function(){ return C3.section(); }, '') === 'stack') &&
      safe(function(){ return onPeptide() && S && S.sched && S.doses; }, false) ? 'dose' : 'fit';
    var D = {lane: lane, streak: run, week: lastSeven()};
    if(lane === 'dose'){
      var from = weekStart(), to = from + 7 * DAYMS;
      var rows = safe(function(){ return buildSchedule(S, from, to); }, []) || [];
      rows = rows.filter(function(r){ return r.at >= from && r.at < to && r.status !== 'skipped' && r.status !== 'held'; });
      D.taken = rows.filter(function(r){ return r.status === 'taken'; }).length;
      D.sched = rows.length;
      var T = safe(function(){ return doseTruth(S); }, null) || {};
      D.next = T.state || 'none'; D.at = T.at || null;
      var last = safe(function(){ return S.doses.reduce(function(m, d){ return d.at <= Date.now() && d.at > m ? d.at : m; }, 0); }, 0);
      D.gone = (D.at && last && D.at > last) ? Math.max(0, Math.min(1, (Date.now() - last) / (D.at - last))) : (D.next === 'done' || D.next === 'due' || D.next === 'late' ? 1 : 0);
      return D;
    }
    /* workouts: the Progress screen's own count ("You logged 2 workouts this week. Your plan has 4 sessions.") */
    var wk = safe(function(){ var w = recapWindow('week'); return {done: recapData(w).sessions, planned: scorecardFor(w.from).planned}; }, null);
    if(!wk){ var W = safe(function(){ return h.week(); }, null) || {done:0, planned:0}; wk = {done: W.done, planned: W.planned}; }
    var F = safe(function(){ return h.fractions(); }, null), P = F && F.protein ? F.protein : {now:0, target:null};
    D.done = wk.done | 0; D.planned = wk.planned | 0;
    D.protein = Math.round(+P.now || 0); D.target = P.target ? Math.round(+P.target) : null;
    return D;
  };
  function nextWords(D){
    if(D.next === 'done') return ['Done', 'dose today', 'Today’s dose is logged'];
    if(D.next === 'late') return ['Missed', 'last dose', 'A dose was missed'];
    if(D.next === 'due') return ['Now', 'dose due', 'A dose is due now'];
    if(!D.at) return ['None', 'scheduled', 'No dose scheduled'];
    var ms = Math.max(0, D.at - Date.now()), d = Math.floor(ms / DAYMS), hr = Math.floor((ms - d * DAYMS) / 36e5), mi = Math.floor((ms % 36e5) / 6e4);
    var big = d ? d + 'd ' + hr + 'h' : hr ? hr + 'h ' + mi + 'm' : mi + 'm';
    return [big, 'next dose', 'Next dose in ' + (d ? d + (d === 1 ? ' day ' : ' days ') : '') + hr + (hr === 1 ? ' hour' : ' hours')];
  }
  /* v363 (Chad, 27 Oct: "the top strip repeats the big number right below it"): a screen whose own hero shows one of
     the strip's numbers drops it from the strip; the strip keeps what the screen does not show */
  var SHOWN = {food: ['protein'], progress: ['train'], doses: ['next', 'doses']};   /* Track's hero carries the next dose and the doses logged */
  h.strip = function(where){
    KEY = where === 'bar' ? 'psb' : 'ps';
    var D = h.stripData(), skip = SHOWN[C3.current] || [];
    var seven = '<span class="m pips days" aria-hidden="true">' + D.week.map(function(on){ return '<i class="' + (on ? 'on' : '') + '"></i>'; }).join('') + '</span>';
    var s = item('streak', 'recovery', {view: 'streak'}, svg(FLAME, 20), String(D.streak), '', ['day streak'],
      D.streak + (D.streak === 1 ? ' day' : ' days') + ' in a row with something logged, ' + D.week.filter(Boolean).length + ' of the last 7 days. Open your streak', seven);
    if(D.lane === 'dose'){
      var N = nextWords(D);
      if(skip.indexOf('doses') < 0) s += item('doses', 'log', null, h.icon('stack', 20, 2), String(D.taken), D.sched ? '/' + D.sched : '', ['doses', 'this week'],
        D.taken + (D.sched ? ' of ' + D.sched : '') + ' doses logged this week. Open your schedule', pips(D.taken, D.sched));
      if(skip.indexOf('next') < 0) s += item('next ' + D.next, 'doses', null, svg(CLOCK, 20), N[0], '', [N[1]], N[2] + '. Open Track', bar(D.gone));
    }else{
      if(skip.indexOf('train') < 0) s += item('train', 'train', null, h.icon('train', 20, 2), String(D.done), D.planned ? '/' + D.planned : '', ['workouts', 'this week'],
        D.done + (D.planned ? ' of ' + D.planned : '') + ' workouts this week. Open Train', pips(D.done, D.planned));
      if(skip.indexOf('protein') < 0) s += item('protein', 'food', null, h.icon('food', 20, 2), String(D.protein), D.target ? '/' + D.target + ' g' : ' g', ['protein', 'today'],
        D.protein + ' grams of protein today' + (D.target ? ' of ' + D.target : '') + '. Open Food', bar(D.target ? D.protein / D.target : 0));
    }
    return '<nav class="c3-ps ' + D.lane + (where === 'bar' ? ' inbar' : ' row') + '" aria-label="Your progress">' + s + '</nav>';
  };

  /* ---------- the body map ---------- */
  /* left half of each figure (x < 100 in a 200 x 450 box); the right half is the same shape mirrored */
  var BASE = {
    arm: 'M54 86C43 90 35 101 34 117C33 140 31 162 29 182C26 204 24 228 24 250C24 262 26 271 30 276L39 276C40 266 41 255 43 244C47 222 51 200 53 181C55 160 57 140 57 120Z',
    hand: 'M29 274C24 282 23 294 27 302C30 307 35 308 38 304C41 298 41 288 40 274Z',
    torso: 'M100 72C84 72 69 76 57 84C48 90 45 102 47 117C50 148 61 175 65 204C66 216 63 228 60 240L100 252Z',
    leg: 'M60 236C55 268 55 300 61 330C62 352 60 374 62 398C63 412 64 420 63 428L84 430C84 418 83 404 85 390C89 366 89 345 87 330C93 300 98 272 100 252Z',
    foot: 'M63 426C59 432 56 438 58 443C60 446 66 447 74 447C80 447 85 445 86 441C86 436 85 431 84 428Z'
  };
  function rr(x, y, w, hh, r){ return 'M' + (x + r) + ' ' + y + 'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'v' + (hh - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 -' + r + ' ' + r + 'h-' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 -' + r + ' -' + r + 'v-' + (hh - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' -' + r + 'Z'; }
  var FRONT = {
    back:    ['M91 67C86 73 76 79 64 85C73 85 83 82 93 77Z'],
    delts:   ['M56 85C45 89 37 100 37 114C39 123 46 125 52 120C56 108 62 96 71 90C67 86 61 84 56 85Z'],
    chest:   ['M98 92C86 88 72 90 64 98C58 108 60 122 68 130C78 137 92 137 98 130Z'],
    biceps:  ['M40 125C36 137 36 155 40 168C44 173 50 171 52 164C55 150 55 134 51 124C47 120 42 121 40 125Z'],
    core:    [rr(86.5, 140, 12, 16, 3), rr(86, 159.5, 12.5, 17, 3), rr(86.5, 180, 12, 17, 3), 'M88.5 201L98.5 201L98.5 234C94 232 90.5 222 88.5 211Z', 'M71 140C69 160 71 186 79 208L83.5 206C83.5 184 83.5 160 83.5 140Z'],
    quads:   ['M64 247C60 272 60 300 66 324C70 331 78 331 82 324C88 300 92 274 92 255C84 248 72 245 64 247Z'],
    calves:  ['M66 347C62 365 62 386 68 404C72 409 76 407 78 402C82 384 82 364 80 347C76 342 70 342 66 347Z']
  };
  var BACK = {
    back:    ['M100 66C92 70 80 78 66 86C76 92 88 104 100 124Z', 'M66 104C62 124 66 152 78 178C84 186 92 190 98 190L98 132C88 120 78 108 66 104Z', 'M87 194C87 206 89 218 94 228L98.5 230L98.5 194Z'],
    delts:   ['M56 85C45 89 37 100 37 114C39 123 46 125 52 120C56 108 62 96 71 90C67 86 61 84 56 85Z'],
    triceps: ['M40 124C36 138 36 156 40 169C44 174 50 172 52 164C55 150 55 133 51 123C47 119 42 120 40 124Z'],
    glutes:  ['M99 236C86 231 70 236 63 250C60 268 70 282 86 282C95 280 99 271 99 259Z'],
    hams:    ['M64 286C60 308 62 328 68 342C72 347 80 347 84 341C90 323 92 303 90 287C82 283 72 283 64 286Z'],
    calves:  ['M64 352C58 367 60 386 68 402C72 406 78 404 80 398C84 381 84 366 80 353C74 347 68 347 64 352Z']
  };
  var LEVEL = {none:'m0', under:'m1', low:'m2', 'in':'m3', high:'m3', thin:'m4'};
  function half(paths, cls){ return paths.map(function(d){ return '<path class="' + cls + '" d="' + d + '"></path>'; }).join(''); }
  function figure(x0, MAP, lv, label, B, from){
    var base = ['arm', 'hand', 'torso', 'leg', 'foot'].map(function(k){ return '<path class="b" d="' + BASE[k] + '"></path>'; }).join('');
    var byId = {}; (B ? B.rows : []).forEach(function(r){ byId[r.m] = r; });
    var mus = Object.keys(MAP).map(function(m){
      var r = byId[m] || {name: m, sets: 0};
      /* v367: a tap on a muscle opens its sheet (sets vs target, the moves that train it) */
      return '<g class="mu ' + (lv[m] || 'm0') + '" data-m="' + m + '" data-go="muscle" data-params="' + esc(JSON.stringify({m: m, from: from || ''})) + '" role="button" tabindex="-1" aria-label="' + esc(r.name + ', ' + r.sets + ' sets this week') + '">' + half(MAP[m], 'p') + '</g>';
    }).join('');
    var side = base + mus;
    return '<g transform="translate(' + x0 + ' 0)"><ellipse class="b" cx="100" cy="34" rx="20" ry="25"></ellipse><path class="b" d="M90 56L110 56L114 74L86 74Z"></path>' +
      side + '<g transform="translate(200 0) scale(-1 1)">' + side + '</g>' +
      '<text class="c3-bm-t" x="100" y="452">' + label + '</text></g>';
  }
  h.bodyMapData = function(){
    var days = Math.max(1 / 24, (Date.now() - weekStart()) / DAYMS);
    var data = safe(function(){ return muscleSets(days); }, null) || {};
    var list = safe(function(){ return MUSCLES.slice(); }, ['chest', 'back', 'delts', 'biceps', 'triceps', 'quads', 'hams', 'glutes', 'calves', 'core']);
    var label = safe(function(){ return MUSCLE_LABEL; }, {});
    var EV = safe(function(){ return VOL_EV; }, {min: 4, solid: 10, band: [11, 18], thin: 25});
    return {EV: EV, rows: list.map(function(m){
      var n = data[m] ? Math.round(data[m].total * 10) / 10 : 0, v = safe(function(){ return volVerdict(n); }, {k: n ? 'low' : 'none', word: ''});
      return {m: m, name: label[m] || m, sets: n, k: v.k, word: v.word, lv: LEVEL[v.k] || 'm0'};
    })};
  };
  h.bodyMap = function(o){
    o = o || {};
    var B = h.bodyMapData(), lv = {}, total = 0, lit = 0;
    B.rows.forEach(function(r){ lv[r.m] = r.lv; total += r.sets; if(r.sets > 0) lit++; });
    var aria = 'Muscles worked since Sunday: ' + B.rows.map(function(r){ return r.name + ' ' + r.sets + ' sets'; }).join(', ');
    var fig = '<svg class="c3-bm-fig" viewBox="0 0 420 462" focusable="false">' + figure(0, FRONT, lv, 'Front', B, o.from) + figure(220, BACK, lv, 'Back', B, o.from) + '</svg>';
    var rows = B.rows.slice().sort(function(a, b){ return b.sets - a.sets; }).map(function(r){
      return '<li class="' + r.lv + '"><button type="button" class="c3-bm-mu" data-go="muscle" data-params="' + esc(JSON.stringify({m: r.m, from: o.from || ''})) + '" data-key="bm-' + esc(r.m) + '" aria-label="' + esc(r.name + ', ' + r.sets + ' sets this week' + (r.word ? ', ' + r.word : '')) + '"><i aria-hidden="true"></i><span class="n">' + esc(r.name) + '</span><b class="c3-num">' + esc(String(r.sets)) + '</b></button></li>';
    }).join('');
    var key = '<p class="c3-bm-key" aria-hidden="true"><span class="u">Sets</span><span><i class="m0"></i>0</span><span><i class="m1"></i>1-' + (B.EV.min - 1) + '</span><span><i class="m2"></i>' + B.EV.min + '-' + (B.EV.band[0] - 1) + '</span><span><i class="m3"></i>' + B.EV.band[0] + '+ target</span><span><i class="m4"></i>' + B.EV.thin + '+</span></p>';
    return '<section class="c3-bm' + (o.cls ? ' ' + o.cls : '') + '" aria-label="Muscles this week">' +
      '<div class="c3-bm-h"><h2><span>Muscles this week</span><b class="c3-num">' + esc(String(Math.round(total * 10) / 10)) + '</b><small>sets</small></h2></div>' +
      '<div class="c3-bm-in"><div class="c3-bm-go" role="group" aria-label="' + esc(aria) + '">' + fig + '</div>' +
        '<div class="c3-bm-side"><ul class="c3-bm-list">' + rows + '</ul>' + key +
          '<button type="button" class="c3-btn-quiet c3-bm-more" data-go="history" data-params="' + esc(JSON.stringify({sec: 'muscles', from: o.from || ''})) + '" data-key="bm-more">Every muscle, every week ' + h.icon('arrow', 16, 2.6) + '</button></div></div></section>';
  };
})();

