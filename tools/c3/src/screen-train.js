/* C3 screen: train. "What is my week, and what is in each day?"
   The week as seven day columns (computer) or the seven-day strip (phone), then the
   selected day's session as a track: warm-up, each move, sets x reps, rest, load,
   one pip per hard set filled from the real log.
   Today carries the big hard-set counter and the ONE primary control (START / RESUME).
   A missed day offers Catch up, a coming day is a read-only preview, a rest day is calm.
   Every number comes from the app's own functions through C3.h or read at call time. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  var DAY_MS = 86400000, MAX_AHEAD = 12;
  var ABBR = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var watch = 0;   /* a 1 s look at the stretch routine while it runs, so the control flips back when it ends */

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function cap(s){ s = String(s || ''); return s.charAt(0) + s.slice(1).toLowerCase(); }
  /* "Lower B" -> Lower <pink>B</pink>; one word stays white */
  function title(name){
    var w = String(name || '').trim().split(/\s+/);
    if(w.length < 2) return esc(w[0] || '');
    return esc(w.slice(0, -1).join(' ')) + ' <span class="pk">' + esc(w[w.length - 1]) + '</span>';
  }
  function lenClass(name){ var n = String(name || '').length; return n <= 8 ? '' : n <= 12 ? ' len-m' : ' len-l'; }
  var logged = h.logged, hardOf = h.hardDoneOf;   /* the app's own tests, one copy (helpers.js) */
  function logOf(key){ return safe(function(){ return (ALL.workLog || {})[key] || null; }, null); }

  /* ---------- the week on screen ----------
     off = 0 is this week, straight from C3.h.week(). Any other week is built the same
     way from weekAt(weekIndexNow() + off): a coming week is a preview (nothing can be
     logged on it yet), a past week reads done only where the log has a session. */
  function model(off){
    var W0 = h.week(), wi = W0.wi + off;
    var full = safe(function(){ return weekAt(wi); }, []) || [];
    if(!off) return {off:0, wi:wi, W:W0, full:full};
    var now = Date.now(), todayDow = new Date(now).getDay();
    var cfg = safe(function(){ return trainCfg(); }, {});
    var startKey = cfg.startedAt ? safe(function(){ return dkey(cfg.startedAt); }, '') : '';
    var vol = safe(function(){ return weekVolume(full); }, {hardSets:0, minutes:0});
    var days = [], planned = 0, done = 0;
    for(var i = 0; i < 7; i++){
      var d = full[i] || {day:i, name:'Rest', focus:'Rest', rest:true, blocks:[], est:{minutes:0, hardSets:0}};
      var dt = new Date(now); dt.setDate(dt.getDate() - (todayDow - i) + off * 7); dt.setHours(12, 0, 0, 0);
      var key = safe(function(){ return dkey(dt.getTime()); }, '');
      var L = logOf(key), isLogged = logged(L), own = !!(d.rest && L && L.blocks && L.blocks.length && isLogged);
      var status;
      if(isLogged) status = 'done';
      else if(d.rest) status = 'rest';
      else if(off > 0) status = 'future';
      else status = (startKey && key < startKey) ? 'before' : (safe(function(){ return isPaused(key); }, false) ? 'paused' : 'missed');
      var blocks = own ? L.blocks : (d.blocks || []);
      if(status === 'done' || status === 'missed' || status === 'future') planned++;
      if(status === 'done') done++;
      days.push({dow:i, abbr:ABBR[i], letter:ABBR[i].charAt(0), long:LONG[i], date:dt.getDate(), key:key, at:dt.getTime(),
        isToday:false, past: off < 0, rest: !!d.rest && !own, name: own ? (L.name || 'Logged session') : (d.rest ? 'Rest' : d.name),
        focus:d.focus || '', minutes:(d.est && d.est.minutes) || 0, moves:blocks.length, hardSets:(d.est && d.est.hardSets) || 0,
        blocks: blocks.map(function(b){ return {id:b.id, n:b.n, grp:b.grp, group:fmt.group(b.grp), sets:b.sets, reps:b.reps}; }),
        logged:isLogged, status:status, movedTo:null, movedFrom:null, canCatchUp:false});
    }
    return {off:off, wi:wi, full:full, W:{wi:wi, weekNo:wi + 1, label:W0.label, hardSets:vol.hardSets || 0, minutes:vol.minutes || 0,
      hours:fmt.hours(vol.minutes || 0), planned:planned, done:done, todayDow:-1, todayKey:W0.todayKey, catchTo:null, days:days}};
  }

  /* ---------- the selected day, for real ----------
     {d, st, word, tone, isToday, name, focus, minutes, warm, rows:[...], hardDone, hardPlanned, fromLog} */
  function dayView(M, sel, T){
    var W = M.W, d = W.days[sel]; if(!d) return null;
    var st = d.status, isCatch = st === 'future' && d.movedFrom != null;
    var at = (st === 'moved' && d.movedTo != null) ? d.movedTo : sel;      /* a moved day shows the session where it now lives */
    var plan = M.full[at] || {}, key = W.days[at].key, L = logOf(key);
    var today = !M.off && d.isToday;
    var fromLog = st === 'done' && !!(L && L.blocks && L.blocks.length);   /* a finished session shows what it WAS */
    var blocks = fromLog ? L.blocks : h.sessionBlocks(L, plan.blocks || []);
    var hardPlanned = 0, hardDone = 0;
    var rows = blocks.map(function(bl, i){
      var planned = h.sessionCount(L, bl).total;
      var did = Math.min(hardOf(L, bl), planned);
      hardPlanned += planned; hardDone += did;
      var load = fmt.load(bl);
      if(!load && bl.load && bl.load.type === 'rpe' && bl.load.value) load = 'RPE ' + bl.load.value;
      if(M.off < 0 && !fromLog) load = '';                                 /* a past week's plan is not re-priced */
      if(fromLog){
        var best = (L.sets || {})[bl.id];
        load = (best && best.lb > 0) ? safe(function(){ return loadTxt(best.lb); }, best.lb + ' lb') + (best.reps ? ' × ' + best.reps : '') : (best && best.reps ? best.reps + ' reps' : load);
      }
      return {i:i, id:bl.id, n:bl.n, group:fmt.group(bl.grp), sets:planned, reps:bl.reps, setsText:fmt.sets(bl), did:did, load:load, restSec:bl.restSec | 0};
    });
    var word, tone = 'mint';
    if(st === 'today') word = 'Today';
    else if(st === 'done') word = today ? 'Today · Done' : 'Done';
    else if(st === 'missed'){ word = 'Open'; tone = ''; }   /* v330: wins, not guilt */
    else if(st === 'moved'){ word = 'Moved to ' + cap(W.days[d.movedTo].abbr); tone = 'coral'; }
    else if(isCatch){ word = 'Catch-up from ' + cap(W.days[d.movedFrom].abbr); tone = 'coral'; }
    else if(st === 'paused') word = 'Paused';
    else if(st === 'before') word = 'Before you started';
    else if(st === 'rest') word = today ? 'Today · Rest day' : 'Rest day';
    else word = 'Planned';
    var minutes = fromLog ? safe(function(){ return estOfBlocks(L.blocks).minutes; }, 0) : ((plan.est && plan.est.minutes) || 0);
    return {d:d, sel:sel, at:at, st:st, isCatch:isCatch, word:word, tone:tone, isToday:today, fromLog:fromLog,
            name: st === 'rest' ? 'Rest' : (fromLog ? (L.name || d.name) : d.name), focus: (fromLog ? L.focus : plan.focus) || '',
            minutes:minutes, rows:rows, hardDone:hardDone, hardPlanned:hardPlanned,
            warm: (today || st === 'future' || st === 'missed' || st === 'moved') ? h.warmup() : null,
            plan:plan, photoDay:{name: d.name, focus: (fromLog ? L.focus : plan.focus) || ''}};
  }

  /* ---------- the week: head, nav, the seven days ---------- */
  function weekHead(M){
    var W = M.W;
    if(!M.off) return h.weekHeadHTML(W);
    var n = M.off < 0
      ? '<span class="cnt">' + (W.planned > 0 ? '<b>' + W.done + '</b> of <b>' + W.planned + '</b> logged' : 'Nothing was planned') + '</span>'
      : '<span class="cnt">' + (W.planned > 0 ? '<b>' + W.planned + '</b> planned' : 'No sessions planned') + '</span>';
    return '<div class="c3-weekhead">' + n +
      '<span class="prog">Week ' + W.weekNo + (W.label ? ' · ' + esc(W.label) : '') + '</span>' +
      '<span class="vol"><span class="n">Week ' + W.weekNo + ' · </span><b>' + W.hardSets + '</b> sets · <b>' + W.hours + '</b> hours<span class="w"> planned</span></span></div>';
  }
  function weekNav(M){
    var canPrev = M.wi > 0, canNext = M.off < MAX_AHEAD;
    var where = !M.off ? 'This week' : M.off === 1 ? 'Next week' : M.off === -1 ? 'Last week' : (M.off > 0 ? 'In ' + M.off + ' weeks' : (-M.off) + ' weeks ago');
    return '<div class="tr-nav" role="group" aria-label="Week">' +
      '<button type="button" class="tr-nav-b" data-act="prev" data-key="prev" aria-label="Previous week"' + (canPrev ? '' : ' disabled') + '>' + h.icon('back', 22, 2.8) + '</button>' +
      (M.off ? '<button type="button" class="tr-nav-w" data-act="thisweek" data-key="thisweek" aria-label="Week ' + M.W.weekNo + ', ' + esc(where) + '. Back to this week"><b>Week ' + M.W.weekNo + '</b><span>Back to this week</span></button>'
             : (safe(function(){ return isDeloadWeek(M.wi); }, false)
                 ? '<button type="button" class="tr-nav-w dl" data-go="deload" data-key="dlweek" aria-label="Week ' + M.W.weekNo + ', a deload week. Why"><b>Week ' + M.W.weekNo + '</b><span>Deload week</span></button>'
                 : '<span class="tr-nav-w"><b>Week ' + M.W.weekNo + '</b><span>' + esc(where) + '</span></span>')) +
      '<button type="button" class="tr-nav-b next" data-act="next" data-key="next" aria-label="Next week"' + (canNext ? '' : ' disabled') + '>' + h.icon('back', 22, 2.8) + '</button></div>';
  }
  /* the shared strip, with each day's first moves written into its column (shown on a computer) */
  function strip(M, sel, todayFrac){
    var W = M.W;
    return h.weekStripHTML(W, sel, {todayFrac:todayFrac, dayExtra:function(d){
      var src = (d.status === 'moved' && d.movedTo != null) ? W.days[d.movedTo] : d;
      var list = (d.status === 'rest') ? [] : (src.blocks || []), s = '';
      if(!list.length) return '';
      s = '<span class="tr-dm' + (d.isToday ? ' num' : '') + '">';
      list.slice(0, 5).forEach(function(b, k){ s += '<span class="m">' + (d.isToday ? '<i>' + (k + 1) + '</i>' : '') + '<em>' + esc(b.n) + '</em></span>'; });
      if(list.length > 5) s += '<span class="more">+' + (list.length - 5) + ' more</span>';
      return s + '</span>';
    }});
  }

  /* ---------- the selected day ---------- */
  function pips(n, did){
    var s = '<span class="tr-pips" role="img" aria-label="' + did + ' of ' + n + ' sets done">';
    for(var k = 0; k < n; k++) s += '<i' + (k < did ? ' class="on"' : '') + '></i>';
    return s + '</span>';
  }
  function track(V){
    var s = '<ol class="tr-track ' + V.tone + '" aria-label="' + esc(V.name) + ', the moves">';
    var last = V.rows.length - 1;
    if(V.warm){
      s += '<li class="w"><div class="top"><span class="n"><i></i></span><span class="bar"></span></div>' +
        '<div class="txt"><span class="g">Before you lift</span><span class="nm">Warm-up</span>' +
        '<span class="sx">' + V.warm.minutes + ' min</span><span class="sub">' + V.warm.holds + ' holds</span><span class="sub b">No equipment</span></div></li>';
    }
    V.rows.forEach(function(r, i){
      var full = r.sets > 0 && r.did >= r.sets;
      s += '<li class="' + (full ? 'done' : '') + '"><div class="top"><span class="n">' + (full ? h.icon('check', 16, 3.4) : (i + 1)) + '</span><span class="bar' + (i === last ? ' end' : '') + '"></span>' +
           (i === last ? '<span class="flag" aria-hidden="true"><svg width="18" height="20" viewBox="0 0 18 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19V2h11l-3 4 3 4H3"></path></svg></span>' : '') + '</div>' +
           '<div class="txt"><span class="g">' + esc(r.group) + '</span>' +
           '<span class="nw"><span class="nm">' + esc(r.n) + '</span>' + h.watchHTML(r.id, r.n, {key:'watch-' + i + '-' + r.id}) + '</span>' +
           '<span class="sx">' + esc(r.setsText) + '</span>' + pips(r.sets, r.did) +
           (r.load ? '<span class="ld">' + esc(r.load) + '</span>' : '') +
           (r.restSec ? '<span class="sub">rest ' + r.restSec + ' s</span>' : '') + '</div></li>';
    });
    return s + '</ol>';
  }
  /* v345: the live board is set up before the session starts (the stream shows each set as it is logged) */
  function liveLink(){
    if(!C3.screens.post) return '';
    var on = safe(function(){ return !!(C3.live && C3.live.on()); }, false);
    return '<button type="button" class="c3-link tr-live' + (on ? ' on' : '') + '" data-go="post" data-params="' + esc(JSON.stringify({live: 1})) + '" data-key="golive">' + '<i aria-hidden="true"></i>' + (on ? 'Live board on' : 'Go live') + '</button>';
  }
  /* v347: the plan as a document to follow, print or send (screen-docs.js) */
  function docLink(){ return C3.screens.docs ? '<button type="button" class="c3-link" data-go="docs" data-params="' + esc(JSON.stringify({kind: 'train', span: 'week', from: 'train'})) + '" data-key="docs">Print plan</button>' : ''; }
  function postLink(key){ return C3.screens.post ? '<button type="button" class="c3-link" data-go="post" data-params="' + esc(JSON.stringify({key: key})) + '" data-key="post">Post it</button>' : ''; }
  function action(M, V, T, W){
    var d = V.d, st = V.st;
    var edit = '<button type="button" class="c3-link tr-edit" data-act="edit" data-dow="' + V.sel + '" data-key="edit">Edit this day</button>';
    if(V.isToday && st === 'done'){
      return '<div class="tr-done" role="status">' +
        '<svg width="60" height="60" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22" fill="#5CF2B0"></circle><path d="M14.5 24.5l6.5 6.5 12.5-13.5" fill="none" stroke="#141517" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
        '<div><div class="t">' + esc(V.name) + ' done</div><div class="m c3-num">' + V.hardDone + ' / ' + V.hardPlanned + ' sets</div></div></div>' +
        '<div class="tr-quiet">' + postLink(T.key || safe(function(){ return dkey(Date.now()); }, '')) + '<button type="button" class="c3-link" data-deep="train:history" data-key="hist">History</button></div>';
    }
    if(V.isToday && st === 'today'){
      var word = T.started ? 'Resume' : 'Start';
      return '<button type="button" class="c3-btn-primary tr-start" data-act="start" data-key="start" aria-label="' + word + ' ' + esc(V.name) + '">' +
        '<span class="l">' + word + '</span>' +
        '<span class="r"><small>' + (T.started ? '<span>' + V.hardDone + ' / ' + V.hardPlanned + ' sets</span>' : '') + '</small>'   /* v364: the minutes are on the line above; START says Start */ + h.icon('arrow', 54, 3) + '</span></button>' +
        h.moreHTML('train-day', liveLink() + edit + docLink());   /* v362: Go live, Edit this day and Print plan behind one More */
    }
    if(st === 'missed'){
      if(d.canCatchUp && W.catchTo != null){
        return '<button type="button" class="c3-btn-rail tr-catch" data-act="catch" data-from="' + d.dow + '" data-key="catch" aria-label="Catch up ' + esc(V.name) + ' on ' + LONG[W.catchTo] + '">' +
          '<span>Catch up <span class="to">' + esc(cap(W.days[W.catchTo].abbr)) + '</span></span>' + h.icon('arrow', 26, 2.8) + '</button>' +
          '<div class="tr-quiet">' + edit + '</div>';
      }
      return '<div class="tr-note">' + (M.off < 0 ? 'Nothing was logged on this day.' : 'No free rest day left this week to move it to.') + '</div>' + (M.off < 0 ? '' : '<div class="tr-quiet">' + edit + '</div>');
    }
    if(st === 'moved' || V.isCatch){
      var on = st === 'moved' ? 'On ' + cap(W.days[d.movedTo].abbr) : 'Catch-up';
      return '<div class="tr-undo"><span class="on">' + h.icon('check', 18, 3.2) + esc(on) + '</span>' +
        '<button type="button" class="c3-btn-quiet pink bare" data-act="undo" data-dow="' + d.dow + '" data-key="undo">Undo</button></div>' +
        (V.isCatch ? '<div class="tr-quiet">' + edit + '</div>' : '');
    }
    if(st === 'done') return '<div class="tr-note ok">' + h.icon('check', 18, 3.2) + '<span>Logged. ' + V.hardDone + ' sets.</span></div><div class="tr-quiet"><button type="button" class="c3-link" data-deep="train:history" data-key="hist">History</button></div>';
    if(st === 'future'){
      /* v309: no locked days. When today is free, any upcoming session can be done today. */
      var P = M.off === 0 ? h.pullCandidate() : null, todayFree = !!P;
      if(todayFree) return '<button type="button" class="c3-btn-rail tr-catch" data-act="pull" data-from="' + d.dow + '" data-key="pull" aria-label="Do ' + esc(V.name) + ' today">' +
        '<span>Do it today</span>' + h.icon('arrow', 26, 2.8) + '</button><div class="tr-quiet">' + edit + '</div>';
      return '<div class="tr-note">Coming up ' + esc(d.long) + '.</div><div class="tr-quiet">' + edit + '</div>';
    }
    return M.off < 0 ? '' : '<div class="tr-quiet">' + edit + '</div>';
  }
  function restDay(M, V){
    var d = V.d, W = h.warmup(), ctl = '';
    var P = (V.isToday && M.off === 0) ? h.pullCandidate() : null;
    if(P && !(W && W.running)){
      /* v309: the answer to the coach's "put it on today?" is this button */
      ctl = '<button type="button" class="c3-btn-primary tr-start" data-act="pull" data-from="' + P.from + '" data-key="pull" aria-label="Do ' + esc(P.name) + ' today">' +
        '<span class="l">Do it today</span><span class="r"><small><span>' + esc(P.name) + '</span>' + (P.minutes ? '<span>' + P.minutes + ' min</span>' : '') + '</small>' + h.icon('arrow', 54, 3) + '</span></button>';
    }
    if(V.isToday && W){
      ctl += W.running
        ? '<button type="button" class="c3-btn-quiet pink tr-stretch" data-act="stretch-stop" data-key="stretch">Stop stretch</button>'
        : (P ? '<div class="tr-quiet"><button type="button" class="c3-link" data-act="stretch" data-key="stretch">Or rest: ' + W.minutes + ' min stretch</button></div>'
             : '<button type="button" class="c3-btn-quiet tr-stretch" data-act="stretch" data-key="stretch" aria-label="Start ' + W.minutes + ' minute stretch">' + h.icon('arrow', 18, 2.8) + '<span>Start ' + W.minutes + ' min stretch</span></button>');
    }
    return '<div class="tr-hero rest">' +
      '<div class="tr-h-a"><div class="c3-eyebrow plain"><i></i>' + esc(fmt.date(d.at)) + ' · ' + esc(V.word) + '</div>' +
        '<h1 class="c3-h1 soft">Rest</h1></div>' +
      '<div class="tr-rest-line">' + h.icon('moon', 44, 1.8) + '<i></i><span>No session planned</span></div>' +
      '<div class="tr-h-c">' + ctl + (M.off < 0 ? '' : '<div class="tr-quiet"><button type="button" class="c3-link tr-edit" data-act="edit" data-dow="' + V.sel + '" data-key="edit">Edit this day</button></div>') + '</div>' +
    '</div>';
  }
  function hero(M, V, T, W, coach){
    var d = V.d;
    var eye = '<div class="c3-eyebrow ' + (V.tone === 'coral' ? 'coral' : '') + '"><i></i>' + esc(fmt.date(d.at)) + ' · ' + esc(V.word) + (V.focus && V.focus !== 'Rest' ? ' · ' + esc(V.focus) : '') + '</div>';
    var meta = '<div class="tr-meta c3-num">' + (V.minutes ? '<span>' + V.minutes + ' min</span>' : '') + '<span>' + V.rows.length + ' moves</span>' + (V.warm ? '<span>Warm-up ' + V.warm.minutes + ' min</span>' : '') + '</div>';
    var showDone = V.isToday || V.st === 'done';
    var count = '<div class="tr-h-b" role="img" aria-label="' + (showDone ? V.hardDone + ' of ' + V.hardPlanned + ' sets' : V.hardPlanned + ' sets planned') + '">' +
      '<div class="tr-count">' + (showDone ? '<b>' + V.hardDone + '</b><i>/</i>' : '') + '<b>' + V.hardPlanned + '</b></div>' +
      '<div class="tr-count-l">Sets' + (showDone ? '' : ' planned') + '</div></div>';
    return '<div class="tr-hero ' + V.st + '">' +
      '<div class="tr-h-a">' + eye + '<h1 class="c3-h1' + lenClass(V.name) + '">' + title(V.name) + '</h1>' + meta + '</div>' +
      count +
      '<div class="tr-h-c">' + (V.isToday && V.st === 'today' ? '' : coach) + action(M, V, T, W) + '</div>' +   /* v362: today's hero is the session and START; the coach speaks on Today */
    '</div>';
  }
  function more(V){
    /* v316: the deload, with where it stands in the link itself */
    var DL = safe(function(){ return deloadRead(); }, null);
    var dlWord = !DL ? 'Deload' : DL.verdict === 'on' ? 'Deload week' : DL.verdict === 'now' ? 'Deload now' : DL.verdict === 'back' ? 'Deload done' : (DL.weeksTo != null ? 'Deload in ' + DL.weeksTo + ' wk' + (DL.weeksTo === 1 ? '' : 's') : 'Deload');
    /* v339: the 12-week cycle and their own workouts first */
    var links = [['The next 12 weeks', 'data-deep="train:block"'], ['Build my own workout', 'data-act="build"'], ['History', 'data-deep="train:history"'],
                 ['Program', 'data-act="plan"'], [dlWord, 'data-go="deload"' + (DL && (DL.verdict === 'now' || DL.verdict === 'on') ? ' data-hot="1"' : '')], ['Calendar', 'data-deep="train:cal"'], ['Library', 'data-deep="train:moves"']];
    return '<section class="tr-more" aria-label="More training">' +
      '<div class="tr-pic">' + h.pictureHTML(V && V.st !== 'rest' ? h.sessionPhoto(V.photoDay) : 'dakota-stretch') + '</div>' +
      '<nav class="tr-links" aria-label="Go deeper">' + links.map(function(l, i){ return '<button type="button" class="c3-link" ' + l[1] + ' data-key="lk' + i + '">' + l[0] + '</button>'; }).join('') + '</nav>' +
      '<div class="tr-tag" aria-hidden="true"><span class="c3-tag">Earned. Not given.</span></div>' +
    '</section>';
  }

  function offOf(ctx){ var o = ctx.state.off | 0; return o > MAX_AHEAD ? MAX_AHEAD : o; }
  function openDay(off, dow){
    try{
      viewWeekOffset = off;                                           /* the app's day sheet reads the week it is told to */
      if(typeof DAYUI !== 'undefined'){ DAYUI.swap = null; DAYUI.add = false; DAYUI.q = ''; }
      try{ selDay = dow; }catch(e){}
      C3.sheet('day', {dow:dow});
    }catch(e){ console.error('[c3] train edit', e); }
  }

  C3.screen('train', {
    nav: 'train',
    enter: function(){ try{ viewWeekOffset = 0; }catch(e){} return true; },
    render: function(ctx){
      var T = h.today(), F = h.fractions();
      var off = offOf(ctx), M = model(off), W = M.W;
      if(M.wi < 0){ ctx.state.off = off = -h.week().wi; M = model(off); W = M.W; }
      var requested=(ctx.params||{}).day;
      var sel = (ctx.state.sel != null && W.days[ctx.state.sel]) ? ctx.state.sel : (requested!=null&&W.days[requested] ? +requested : (off ? firstPlanned(W) : T.dow));
      var V = dayView(M, sel, T);
      var coach = '<div class="tr-coach">' + h.coachLineHTML('train') + '</div>';
      var week = '<section class="tr-week" aria-label="The week"><div class="tr-wk-head">' + weekHead(M) + weekNav(M) + '</div>' + strip(M, sel, F.train.frac) + '</section>';
      var day;
      if(!V) day = '';
      else if(V.st === 'rest' || !V.rows.length) day = '<section class="tr-day rest" aria-live="polite" aria-label="' + esc(V.d.long) + ', rest">' + restDay(M, V) + '<div class="tr-coach solo">' + h.coachLineHTML('train') + '</div></section>';
      else{
        /* v359: today's session is the log itself: every move and every set, ticked right here (screen-trlog.js) */
        var log = (V.isToday && !off && V.st === 'today' && C3.trlog) ? C3.trlog.html() : '';
        day = '<section class="tr-day ' + V.st + '" aria-live="polite" aria-label="' + esc(V.d.long + ', ' + V.name) + '">' + hero(M, V, T, W, coach) + (log || track(V)) + '</section>';
      }
      /* v339: today's session first, then the week; once they pick another day or week, the week leads so the pick stays in view */
      var dayFirst = ctx.state.sel == null && requested==null && !off;
      return '<div class="tr' + (off ? ' other' : '') + (dayFirst ? ' dayfirst' : '') + '">' + '<div class="tr-guide"><span>Pick a day. Start a session or log sets below.</span><button type="button" class="c3-link" data-act="plan" data-key="plan-guide">Change program</button></div>' + (dayFirst ? day + week : week + day) + (!off && h.bodyMap ? h.bodyMap({from: 'train', cls: 'tr-bm'}) : '') + more(V) + '</div>';   /* v358: the body map, this week */
    },
    wire: function(root, ctx){
      root.querySelectorAll('.tr-pic img').forEach(function(img){
        var failed = function(){ img.parentNode.hidden = true; };
        img.addEventListener('error', failed, {once:true});
        if(img.complete && !img.naturalWidth) failed();
      });
      if(C3.trlog) C3.trlog.wire(root);   /* v359 */
      root.querySelectorAll('[data-day]').forEach(function(b){ b.addEventListener('click', function(){ ctx.set({sel: +b.getAttribute('data-day')}); }); });
      root.querySelectorAll('[data-act]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-act'), off = offOf(ctx);
          if(a === 'start') h.startWorkout();
          else if(a === 'prev') ctx.set({off: off - 1, sel: null});
          else if(a === 'next') ctx.set({off: Math.min(MAX_AHEAD, off + 1), sel: null});
          else if(a === 'thisweek') ctx.set({off: 0, sel: null});
          else if(a === 'catch'){ var r = h.catchUp(+b.getAttribute('data-from')); if(r && r.ok) ctx.set({sel: r.to}); }
          else if(a === 'pull'){ var r2 = h.pullToday(+b.getAttribute('data-from')); if(r2 && r2.ok) ctx.set({sel: r2.to}); }
          else if(a === 'undo') h.undoCatchUp(+b.getAttribute('data-dow'));
          else if(a === 'stretch') h.startStretch();
          else if(a === 'stretch-stop') h.stopStretch();
          else if(a === 'edit') openDay(off, +b.getAttribute('data-dow'));
          else if(a === 'plan'){ if(C3.go('program') === false) h.deep('train', 'train'); }   /* v319: the new Program screen */
          else if(a === 'build'){ try{ openWorkout(null); }catch(e){ console.error('[c3] build', e); } }
        });
      });
      var Wm = h.warmup();
      if(Wm && Wm.running && !watch){
        watch = setInterval(function(){ var w = h.warmup(); if(!w || !w.running){ clearInterval(watch); watch = 0; C3.refresh(); } }, 1000);
      }
    },
    leave: function(){ if(watch){ clearInterval(watch); watch = 0; } }
  });
  /* in a week that is not this one, the first day with a session is the one worth showing */
  function firstPlanned(W){
    for(var i = 0; i < 7; i++){ if(W.days[i].status !== 'rest') return i; }
    return 0;
  }
})();
