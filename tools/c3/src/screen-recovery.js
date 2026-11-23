/* C3 screen: recovery. Everything the old Check-in pane (#p-ready) held under the four
   questions, one view at a time:
     day     mood, energy, stress, digestion, cycle, travel, heart rate   (renderLife)
     rec     how recovered each muscle is, and the load figures           (renderRecovery)
     rate    how a trained muscle felt: pump, soreness, workload          (renderRate)
     inj     the injury list the program reads                            (renderInjuries)
     streak  showing up: the run, pauses, repairs, the weekly goal, breaks (renderStreak, goalHTML)
     str     the strength score                                           (renderStrength)
     notes   every note in the app, by #tag                               (renderTags)
     obj     what the phone measured                                      (renderObjective)
   All numbers come from the app's own functions; every write is the app's own setter. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var DAYMS = 86400000;
    var VIEWS = [['day', 'The day'], ['rec', 'Recovery'], ['rate', 'Muscle feel'], ['inj', 'Injuries'], ['streak', 'Showing up'], ['str', 'Strength'], ['notes', 'Notes'], ['obj', 'Phone']];
    function viewOf(ctx){ var v = ctx.state.view || (ctx.params && ctx.params.view) || 'day'; return VIEWS.some(function(x){ return x[0] === v; }) ? v : 'day'; }
    function todayKey(){ return dkey(Date.now()); }
    function keyAt(k){ return Date.parse(k + 'T12:00:00'); }
    function cap(s){ s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
    function muscle(m){ return safe(function(){ return h.fmt.group(m); }, '') || cap(m); }
    /* the trips the app keeps (ALL.travel, the list its own reader returns); written only through travelAdd / travelDelete */
    function tripList(){ return safe(function(){ return Array.isArray(ALL.travel) ? ALL.travel : []; }, []); }
    function n1(v){ return String(Math.round(v * 10) / 10); }

    /* ================= the day ================= */
    function dayKeyOf(ctx){ var k = ctx.state.day; return (k && k <= todayKey()) ? k : todayKey(); }
    function viewDay(ctx){
      var day = dayKeyOf(ctx), isToday = day === todayKey(), d = lifeDay(day), L = lifeSummary(day);
      var trend = function(f){ var t = lifeTrend(f); return t.short ? t.n + ' of ' + t.need + ' days logged' : t.word; };
      var q = function(field, list, label, val){
        return '<div class="yd-q"><div class="yd-qh"><b>' + esc(label) + '</b><span>' + esc(trend(field)) + '</span></div>' +
          yd.scale('life', list.map(function(x){ return [x[0], x[1]]; }), val, {aria: label, k: field, under: true, extra: 'data-f="' + field + '"'}) + '</div>';
      };
      var nav = '<div class="rv-daynav">' +
        '<button type="button" class="c3-btn-quiet rv-step" data-act="dayshift" data-v="-1" data-key="day-prev" aria-label="Previous day">' + yd.icon('back', 18, 2.600) + '</button>' +
        '<b>' + esc(yd.day(keyAt(day), true)) + (isToday ? ' · today' : '') + '</b>' +
        '<button type="button" class="c3-btn-quiet rv-step" data-act="dayshift" data-v="1" data-key="day-next" aria-label="Next day"' + (isToday ? ' disabled' : '') + '>' + yd.icon('chev', 18, 2.600) + '</button>' +
        '<span class="c3-num rv-got">' + L.logged + ' of 4</span></div>';

      /* digestion: the published seven-type scale, the chosen type named under it */
      var br = BRISTOL.filter(function(x){ return x[0] === L.bristol; })[0];
      var Bv = safe(function(){ return bristolVsDose(); }, null), bins = '';
      if(Bv && Bv.rows && Bv.rows.length){
        bins = Bv.short ? yd.note(Bv.rows.length + ' of ' + Bv.need + ' logged days line up with a dose.')
          : yd.stats(Bv.bins.map(function(b){ return [b.mean == null ? '·' : String(b.mean), (b.hi > 900 ? '5 d+' : b.lo + ' to ' + b.hi + ' h') + ' after']; }), 'rv-small') + yd.note('Mean type by time since your last dose. Your own log described, not a finding.');
      }
      var dig = yd.sec('Digestion', yd.scale('life', BRISTOL.map(function(x){ return [x[0], x[1]]; }), L.bristol, {aria:'Bristol type', k:'bristol', extra:'data-f="bristol"'}) +
        '<p class="rv-pick">' + (br ? 'Type ' + br[0] + ': ' + esc(br[1]) + (br[2] ? ' · ' + esc(br[2]) : '') : 'Bristol Stool Scale, types 1 to 7. Types 3 and 4 are the ones usually called normal.') + '</p>' + bins, {cls:'rv-dig'});

      var cyc = yd.sec('Cycle', '<div class="yd-list">' + yd.sw('cycle', !!d.cycleStart, 'This day is a start day', L.cycle ? 'Day ' + L.cycle.day + ' · ' + L.cycle.phase + (L.cycle.mean ? ' · your cycles average ' + L.cycle.mean + ' days' : '') : 'Counts from the last start day. No predictions.') + '</div>');

      var trips = tripList().slice(-5).reverse();
      var trv = yd.sec('Travel',
        (L.jetlag ? yd.note('<b>' + yd.plural(L.jetlag.left, 'day') + ' left</b> to adjust: ' + esc(L.jetlag.trip.to || 'your trip') + ', ' + yd.plural(Math.abs(L.jetlag.trip.zones), 'zone') + ' ' + esc(L.jetlag.dir) + ', ' + yd.plural(L.jetlag.days, 'day') + ' ago.', 'warn') : '') +
        (ctx.state.trip
          ? '<div class="yd-fields">' + yd.input('tfrom', ctx.state.tfrom || '', 'From', {max:40, ph:'Phoenix'}) + yd.input('tto', ctx.state.tto || '', 'To', {max:40, ph:'London'}) +
              yd.input('tzones', ctx.state.tzones == null ? 0 : ctx.state.tzones, 'Zones (+ east, - west)', {type:'number', min:-14, maxv:14, step:1, mode:'numeric'}) + yd.input('tat', ctx.state.tat || day, 'Date', {type:'date', maxv: todayKey()}) + '</div>' +
            '<div class="yd-acts">' + yd.btn('tripsave', 'Save trip', {icon:'check'}) + yd.btn('trip', 'Cancel', {pink:true}) + '</div>'
          : '<div class="yd-acts">' + yd.btn('trip', 'Log a trip', {icon:'plus'}) + '</div>') +
        (trips.length ? '<ul class="yd-list rv-trips">' + trips.map(function(t){
          return '<li><div class="yd-row"><span class="l">' + esc(t.from || '?') + ' to ' + esc(t.to || '?') + '<small>' + esc(yd.day(t.at)) + '</small></span><span class="v">' + (t.zones > 0 ? '+' : '') + esc(t.zones) + '</span>' +
            '<button type="button" class="yd-x" data-act="triprm" data-v="' + esc(t.id) + '" data-key="triprm-' + esc(t.id) + '" aria-label="Remove this trip">' + yd.icon('x', 18, 2.400) + '</button></div></li>'; }).join('') + '</ul>' : ''));

      var H = L.hr, mx = safe(function(){ return hrMax(); }, null);
      var hr = yd.sec('Heart rate',
        (H ? yd.stats([[String(H.mean), 'Mean bpm'], [String(H.max), 'Peak'], [String(H.min), 'Low'], [String(H.n), 'Readings']], 'rv-small') +
             (H.zones ? '<div class="rv-zones">' + H.zones.map(function(z){ return '<div class="rv-zone"><span>Z' + z.z + '</span>' + yd.bar(z.n / Math.max(1, H.n), z.z >= 4 ? 'pink' : '') + '<b class="c3-num">' + z.n + '</b></div>'; }).join('') + '</div>' : '')
           : yd.empty('No readings for this day.')) +
        /* v315: the monitor itself, one tap from here (a strap, a watch, earbuds; Apple Watch through Health in the app) */
        (safe(function(){ return heartAny() || !!HEART.kind; }, false) ? '<div class="rv-hrgo">' + yd.btn('heartsheet', safe(function(){ return HEART.kind ? 'Heart rate: ' + heartLabel() : 'Connect a heart rate monitor'; }, 'Heart rate'), {pink:true}) + '</div>' : '') +
        (mx ? yd.note('Measured max <b>' + mx.bpm + ' bpm</b>. Zones are drawn from it.') : yd.note('Zones need a measured maximum, not an age formula.')) +
        '<div class="yd-fields rv-max">' + yd.input('hrmax', mx ? mx.bpm : '', 'Measured max (bpm)', {type:'number', min:120, maxv:230, step:1, mode:'numeric', ph:'from a real max test'}) + '</div>');

      return nav + '<div class="rv-qs">' + q('mood', MOOD, 'Mood', L.mood) + q('energy', ENERGY, 'Energy', L.energy) + q('stress', STRESS, 'Stress', L.stress) + '</div>' + dig + cyc + trv + hr;
    }

    /* ================= recovery ================= */
    function barTone(p){ return p >= 60 ? '' : p >= 35 ? 'amber' : 'coral'; }
    function viewRec(ctx){
      var win = ctx.state.win || 7;
      var RA = recoveryAll(), rows = Object.keys(RA).map(function(m){ return [m, RA[m]]; }).filter(function(x){ return x[1].lastAt > 0; }).sort(function(a, b){ return a[1].pct - b[1].pct; });
      if(!rows.length) return yd.empty('Nothing to recover from yet. Tick some sets off and each muscle starts its own clock here.');
      var ML = muscularLoad(win), CL = cardioLoad(win);
      return yd.stats([[h.fmt.n(ML.load), 'Muscular load'], [h.fmt.weight(ML.vol, 0), 'Raw volume'], [String(CL.mins), 'Conditioning min'], [CL.stepsOver ? h.fmt.n(CL.stepsOver) : '0', 'Steps over target']], 'rv-load') +
        yd.seg('win', [[7, '7 days'], [14, '14 days'], [28, '28 days']], win, {aria:'Window'}) +
        (ML.unrated ? yd.note(yd.plural(ML.unrated, 'set') + ' logged without an RIR, counted at face volume.') : '') +
        yd.sec('Each muscle', '<div class="rv-mus">' + rows.map(function(x){ var v = x[1];
          return '<div class="rv-m"><span class="n">' + esc(muscle(x[0])) + '</span>' + yd.bar(v.pct / 100, barTone(v.pct)) + '<b class="c3-num">' + v.pct + '%</b>' +
            '<span class="d">' + (v.daysSince == null ? '' : v.daysSince < 1 ? 'today' : n1(v.daysSince) + ' d ago') + '</span></div>'; }).join('') + '</div>', {n: rows.length}) +
        '<p class="yd-src">Muscular load is volume weighted by how close each set was to failure. Conditioning is kept separate.</p>';
    }

    /* ================= how that muscle felt ================= */
    function viewRate(ctx){
      var recent = Object.keys(ALL.workLog || {}).sort().reverse().slice(0, 10);
      var day = ctx.state.rday || todayKey(), trained = musclesTrained(day);
      var picks = recent.length ? yd.seg('rday', recent.map(function(k){ return [k, yd.day(keyAt(k))]; }), day, {aria:'Session day', cls:'rv-days'}) : '';
      if(!trained.length) return picks + yd.empty(recent.length ? 'Nothing trained on ' + yd.day(keyAt(day)) + '. Pick a day you trained.' : 'Log a session and this is where you say how it felt.');
      return picks + trained.map(function(m){
        var r = rateGet(day, m) || {}, done = r.pump != null && r.sore != null && r.work != null;
        var ch = done ? setChange(r.pump, r.sore, r.work) : null, nx = safe(function(){ return nextVolume(m); }, null);
        var sc = function(key, list, lbl){ return '<div class="yd-q"><div class="yd-qh"><b>' + lbl + '</b></div>' + yd.scale('rate', list.map(function(x){ return [x[0], x[1]]; }), r[key] == null ? null : r[key], {aria: muscle(m) + ' ' + lbl, k: m + '-' + key, words: true, cls: 'words', extra: 'data-m="' + esc(m) + '" data-f="' + key + '"'}) + '</div>'; };
        return yd.sec(muscle(m), sc('pump', RATE_PUMP, 'Pump') + sc('sore', RATE_SORE, 'Soreness') + sc('work', RATE_WORK, 'Workload') +
          (ch ? '<p class="rv-verd ' + (ch.d > 0 ? 'up' : ch.d < 0 ? 'down' : '') + '"><b>' + (ch.d > 0 ? '+' + ch.d : ch.d === 0 ? 'Hold' : String(ch.d)) + (ch.d === 0 ? '' : ' set' + (Math.abs(ch.d) === 1 ? '' : 's') + ' next week') + '</b><span>' + esc(ch.why) + '</span></p>'
              : '<p class="rv-verd pend"><span>Answer all three and the set change shows here.</span></p>'),
          {right: nx && nx.did != null ? '<span class="c3-num">' + yd.plural(nx.did, 'set') + ' this week</span>' : ''});
      }).join('');
    }

    /* ================= injuries ================= */
    function viewInj(ctx){
      var act = injActive(), all = injuries();
      var blocked = [], eased = [];
      if(act.length){
        safe(function(){
          var eq = (trainCfg().equipment || []);
          var base = EXERCISES.filter(function(e){ return !e.ext && (!eq.length || eq.indexOf(e.eq) >= 0); });
          var kept = {}; injFilter(base).forEach(function(e){ kept[e.id] = 1; });
          blocked = base.filter(function(e){ return !kept[e.id]; });
          eased = Object.keys(INJ_EASED || {});
        });
      }
      /* what this week could not fill: the app's own sentence, as plain lines */
      var gap = safe(function(){
        var t = gapNoteHTML(); if(!t) return '';
        var doc = new DOMParser().parseFromString('<div>' + t + '</div>', 'text/html'), out = '';
        var hd = doc.querySelector('.auxh'); if(hd) out += '<h2 class="yd-lbl"><span>' + esc(hd.textContent) + '</span></h2>';
        doc.querySelectorAll('.auxr, p').forEach(function(p){ out += yd.note(esc(p.textContent.replace(/\s+/g, ' ').trim())); });
        return out ? '<section class="yd-sec">' + out + '</section>' : '';
      }, '');
      return yd.sec('Add one', '<div class="yd-seg rv-areas">' + INJ_AREAS.map(function(a){ return yd.btn('injadd', a.n, {v: a.k, icon: 'plus'}); }).join('') + '</div>') +
        yd.sec('Your list', all.length ? '<ul class="yd-list rv-inj">' + all.slice().reverse().map(function(i){
          var a = injArea(i.area),retained=((ALL.journeySetup||{}).injuryDrafts||{})[i.id],value=(ctx.state.injNotes||{})[i.id];if(value==null)value=retained&&!retained.complete?retained.value:i.note||'';
          return '<li class="' + (i.healed ? 'healed' : 'open') + '"><div class="rv-injh"><b>' + esc(a.n) + '</b><span>' + (i.healed ? 'Cleared ' + esc(yd.day(i.healed)) : 'Since ' + esc(yd.day(i.at)) + ' · ' + yd.plural(Math.max(1, Math.round((Date.now() - i.at) / DAYMS)), 'day')) + '</span></div>' +
            yd.input('injnote', value, 'What it is, in your words', {max:120, k: i.id, extra: 'data-id="' + esc(i.id) + '"'}) +
            '<p role="alert">'+esc((ctx.state.injErrors||{})[i.id]||'')+'</p><div class="yd-acts">'+yd.btn('injsave','Save note',{v:i.id,extra:'data-commit'})+yd.btn('injcancel','Cancel',{v:i.id}) + yd.btn('injheal', i.healed ? 'Reopen' : 'Cleared', {v: i.id, icon: i.healed ? 'refresh' : 'check'}) + yd.btn('injdel', 'Remove', {v: i.id, pink: true, icon: 'x'}) + '</div></li>'; }).join('') + '</ul>'
          : yd.empty('Nothing on the list.'), {n: act.length || null}) +
        (act.length ? yd.sec('While ' + (injWord() || 'it') + ' ' + (act.length === 1 ? 'is' : 'are') + ' on the list',
          yd.stats([[String(blocked.length), blocked.length === 1 ? 'Movement out' : 'Movements out']], 'rv-small') +
          (blocked.length ? yd.note(esc(blocked.slice(0, 8).map(function(e){ return e.n; }).join(', ')) + (blocked.length > 8 ? ' and ' + (blocked.length - 8) + ' more' : '') + '.') : '') +
          (eased.length ? yd.note(esc(eased.map(muscle).join(', ')) + ' kept the gentlest movements so no muscle is left with nothing.') : '') +
          '<p class="yd-src">A filter you set, not a diagnosis. It never stops you logging what you did.</p>') : '') + gap;
    }

    /* ================= showing up ================= */
    function viewStreak(ctx){
      var S2 = streaks(), rep = repairable(), tk = todayKey(), A = activeDays(), days = [];
      for(var i = 13; i >= 0; i--){ var t = Date.now() - i * DAYMS, k = dkey(t); days.push({k:k, t:t, logged:A.has(k), paused:isPaused(k), repair:!!(pauses()[k] && pauses()[k].repair), today:k === tk}); }
      var st = [[String(S2.now), S2.now === 1 ? 'Day streak' : 'Day streak']];
      if(S2.differs) st.push([String(S2.held), 'With pauses']);
      st.push([String(S2.best), 'Longest'], [String(S2.repairs), 'Repairs left']);
      var dots = '<div class="rv-dots" role="group" aria-label="The last 14 days. Tap a day to pause it.">' + days.map(function(d){
        var word = d.logged ? 'logged' : d.paused ? (d.repair ? 'repaired' : 'paused') : 'nothing logged';
        return '<button type="button" class="rv-dot' + (d.logged ? ' on' : '') + (d.paused ? ' held' : '') + (d.today ? ' now' : '') + '" data-act="pause" data-v="' + d.k + '" data-key="dot-' + d.k + '" aria-label="' + esc(yd.day(d.t, true) + ', ' + word) + '"><i></i><span>' + esc(yd.day(d.t, true).charAt(0)) + '</span></button>'; }).join('') + '</div>';
      var W = weekStreak(), c = W.current, V = vacayNow();
      var wst = [[String(W.weeks), 'Weeks in a row']]; if(W.differs) wst.push([String(W.held), 'With breaks']);
      wst.push([c.n + ' / ' + c.goal, 'This week'], [String(W.best), 'Best run']);
      var bars = '<div class="rv-weeks" aria-hidden="true">' + W.rows.slice().reverse().map(function(w){
        return '<div class="rv-wk' + (w.hit ? ' hit' : '') + (w.allVac ? ' away' : '') + (w.running ? ' now' : '') + '"><i style="height:' + Math.max(8, Math.min(100, w.n / Math.max(1, w.goal) * 100)) + '%"></i><span>' + esc(w.key.slice(5).replace('-', '/')) + '</span></div>'; }).join('') + '</div>';
      var vac = vacays();
      return yd.stats(st, 'rv-streak') + dots +
        (rep.length ? '<div class="yd-acts rv-repair"><span class="rv-miss">' + esc(yd.day(keyAt(rep[0]), true)) + ': nothing logged</span>' + (S2.repairs ? yd.btn('repair', 'Repair it (' + S2.repairs + ' left)', {v: rep[0], icon: 'check'}) : '<span class="rv-miss">No repairs left this month.</span>') + '</div>' : '') +
        yd.note(S2.differs ? 'A paused day is held, never counted as logged. Both numbers are shown.' : 'Tap a day to pause it: a week off, illness, travel.') +
        yd.sec('Weekly goal', yd.seg('goal', GOAL_CHOICES.map(function(g){ return [g[0], g[1]]; }), W.goal, {aria:'Days a week', cls:'fill rv-goal'}) + yd.stats(wst, 'rv-small') + bars + yd.note(esc(weekWord(W)))) +
        yd.sec('A break', (V ? yd.note('<b>Away until ' + esc(V.to) + '</b>' + (V.why ? ', ' + esc(V.why) : '') + '. Every day in the range is held.', 'good') : '') +
          '<div class="yd-fields three rv-vac">' + yd.input('vfrom', ctx.state.vfrom || tk, 'From', {type:'date'}) + yd.input('vto', ctx.state.vto || dkey(Date.now() + 7 * DAYMS), 'To', {type:'date'}) + yd.input('vwhy', ctx.state.vwhy || '', 'Why (optional)', {max:60, ph:'vacation, surgery, work trip'}) + '</div>' +
          '<div class="yd-acts">' + yd.btn('vacadd', 'Set the break', {icon:'pause'}) + '</div>' +
          (vac.length ? '<ul class="yd-list">' + vac.slice().reverse().map(function(v){ return '<li><div class="yd-row"><span class="l">' + esc(v.from) + ' to ' + esc(v.to) + (v.why ? '<small>' + esc(v.why) + '</small>' : '') + '</span>' +
            '<button type="button" class="yd-x" data-act="vacrm" data-v="' + esc(v.id) + '" data-key="vacrm-' + esc(v.id) + '" aria-label="Remove this break">' + yd.icon('x', 18, 2.400) + '</button></div></li>'; }).join('') + '</ul>' : ''));
    }

    /* ================= strength score ================= */
    function viewStr(){
      var S = strengthScore();
      if(S.short) return yd.empty(S.why.replace(/, those are/, '. Those are'));
      return yd.stats([[S.dots == null ? '·' : S.dots.toFixed(1), 'DOTS'], [S.gl == null ? '·' : S.gl.toFixed(1), 'IPF GL'], [h.fmt.weight(S.totalLb, 0), 'Total'], [h.fmt.weight(S.bwLb, 1), 'Bodyweight']], 'rv-str') +
        '<table class="yd-table"><thead><tr><th>Lift</th><th>From</th><th class="n">Best</th></tr></thead><tbody>' + S.lifts.map(function(L){
          return '<tr><td><b>' + esc(L.n) + '</b></td><td>' + (L.best ? esc(L.best.n) + (L.best.exact ? '' : ', estimated') : 'nothing logged') + '</td><td class="n">' + (L.best ? esc(h.fmt.weight(Math.round(L.best.lb), 0)) : '·') + '</td></tr>'; }).join('') + '</tbody></table>' +
        (S.partial ? yd.note('<b>Not a full total.</b> ' + S.have.length + ' of the three lifts have something logged.', 'warn') : '') +
        (S.anyEstimated ? yd.note('At least one is an estimated one-rep max (Epley) from a set you did.') : '') +
        (S.clamped ? yd.note('Your bodyweight is outside the range DOTS was fitted over; the nearest bound is used.', 'warn') : '') +
        '<p class="yd-src">DOTS (Konertz, 2019) and IPF GL (2020) score a competition total by bodyweight. This is your gym log, not a platform total.</p>';
    }

    /* ================= notes ================= */
    function viewNotes(ctx){
      var counts = tagCounts(), all = notedItems(), tag = ctx.state.tag || '';
      var list = tag ? all.filter(function(x){ return x.tags.indexOf(tag) >= 0; }) : all, show = ctx.state.all ? list : list.slice(0, 12);
      return (counts.length ? yd.seg('tag', [['', 'All ' + all.length]].concat(counts.map(function(c){ return [c.tag, '#' + c.tag + ' ' + c.n]; })), tag, {aria:'Filter by tag', cls:'rv-tags'}) : '') +
        (list.length ? '<table class="yd-table rv-notes"><thead><tr><th>When</th><th>Where</th><th>Note</th></tr></thead><tbody>' + show.map(function(x){
            return '<tr><td>' + esc(yd.day(x.at)) + '</td><td>' + esc(x.where) + '</td><td>' + esc(x.text).replace(/#([a-z0-9][a-z0-9_-]{0,23})/gi, '<b>#$1</b>') + '</td></tr>'; }).join('') + '</tbody></table>' +
            (list.length > 12 ? '<div class="yd-acts">' + yd.btn('all', ctx.state.all ? 'Show fewer' : 'Show all ' + list.length) + '</div>' : '')
          : yd.empty(tag ? 'Nothing tagged #' + tag + '.' : 'No notes yet.')) +
        '<p class="yd-src">Every note on a dose, a weigh-in, a set, a check-in or a diary entry. Write #travel or #sick in any of them to filter by it.</p>';
    }

    /* ================= what the phone measured ================= */
    function viewObj(){
      var O = objRead();
      if(!O.any) return yd.empty('Nothing from the phone yet.') + '<div class="yd-acts"><button type="button" class="c3-btn-quiet yd-btn" data-go="settings" data-params=\'{"focus":"health"}\' data-key="to-health">' + yd.icon('heart', 17, 2.200) + '<span>Apple Health</span></button></div>';
      var tone = function(z){ return z == null ? '' : z <= -1 ? 'warn' : z >= 1 ? 'good' : ''; };
      var st = [];
      if(O.sleep) st.push([O.sleep.now != null ? minsWord(O.sleep.now) : '·', 'Slept' + (O.sleep.mean != null ? ' · usual ' + minsWord(O.sleep.mean) : ''), tone(O.sleep.z)]);
      if(O.rhr) st.push([O.rhr.now != null ? String(O.rhr.now) : '·', 'Resting HR' + (O.rhr.mean != null ? ' · usual ' + O.rhr.mean : ''), tone(O.rhr.z == null ? null : -O.rhr.z)]);
      if(O.hrv) st.push([O.hrv.now != null ? O.hrv.now + ' ms' : '·', 'HRV' + (O.hrv.mean != null ? ' · usual ' + O.hrv.mean : ''), tone(O.hrv.z)]);
      if(O.spo2) st.push([O.spo2.now != null ? O.spo2.now + '%' : '·', 'Blood oxygen' + (O.spo2.mean != null ? ' · usual ' + O.spo2.mean + '%' : ''), tone(O.spo2.z)]);
      if(O.rr) st.push([O.rr.now != null ? O.rr.now + '/min' : '·', 'Breathing' + (O.rr.mean != null ? ' · usual ' + O.rr.mean : ''), tone(O.rr.z == null ? null : -O.rr.z)]);
      if(O.wrist) st.push([O.wrist.now != null && O.wrist.mean != null ? (O.wrist.now - O.wrist.mean >= 0 ? '+' : '-') + Math.abs(Math.round((O.wrist.now - O.wrist.mean) * 10) / 10) + '°' : (O.wrist.now != null ? O.wrist.now + '°' : '·'), 'Wrist temp' + (O.wrist.mean != null ? ' from your usual' : ''), tone(O.wrist.z == null ? null : -O.wrist.z)]);
      if(O.vo2) st.push([String(O.vo2.now), 'VO2 max' + (O.vo2.change != null ? ' · ' + (O.vo2.change >= 0 ? '+' : '') + O.vo2.change + ' in 3 months' : ''), '']);
      return (O.offPattern ? yd.note('<b>Your body may be fighting something.</b> ' + esc(O.off.join(', ')) + '. A reason to take today lighter; yours to decide.', 'warn') : '') +
        yd.stats(st, 'rv-obj') + '<p class="yd-src">Each is read against your own last 28 days. They sit beside your answers and are never averaged into them.</p>';
    }

    var DRAW = {day:viewDay, rec:viewRec, rate:viewRate, inj:viewInj, streak:viewStreak, str:viewStr, notes:viewNotes, obj:viewObj};
    var EYE = {day:'Mood, energy, digestion, travel', rec:'By muscle', rate:'After a session', inj:'What the program avoids', streak:'Streak and weekly goal', str:'DOTS and IPF GL', notes:'By #tag', obj:'Beside your answers'};

    yd.screen('recovery', {
      nav: 'today', parent: 'checkin', old: ['today', 'ready'],
      /* asked for a view while already here (a door with params): that view, not the one left open */
      enter: function(ctx){ if(ctx.params && ctx.params.view){ ctx.state.view = ctx.params.view; ctx.state.all = false; } },
      render: function(ctx){
        var v = viewOf(ctx);
        return '<div class="yd rv" data-view="' + v + '">' +
          yd.head({back:'checkin', eyebrow:EYE[v], title:'Body and', pk:'recovery'}) +
          '<nav class="rv-nav" aria-label="Sections">' + yd.seg('view', VIEWS, v, {aria:'Section', cls:'rv-views'}) + '</nav>' +
          '<div class="rv-body">' + DRAW[v](ctx) + '</div></div>';
      },
      wire: function(root, ctx){
        function clearNote(id){if(ctx.state.injNotes)delete ctx.state.injNotes[id];if(ctx.state.injErrors)delete ctx.state.injErrors[id];var setup=ALL.journeySetup=ALL.journeySetup||{};setup.injuryDrafts=Object.assign({},setup.injuryDrafts||{});setup.injuryDrafts[id]={complete:true,at:Date.now()};setup.at=Date.now();save();}
        var val = function(name){ var el = root.querySelector('[data-chg="' + name + '"]'); return el ? el.value : ''; };
        yd.wire(root, ctx, {
          view: function(v){ ctx.set({view: v, all: false}); try{ window.scrollTo(0, 0); }catch(e){} },
          /* ---- the day ---- */
          dayshift: function(v){ var k = dkey(keyAt(dayKeyOf(ctx)) + (+v) * DAYMS); if(k > todayKey()) return; ctx.set({day: k}); },
          life: function(v, el){ var f = el.getAttribute('data-f'), day = dayKeyOf(ctx), cur = lifeDay(day)[f], p = {}; p[f] = (cur === +v) ? null : +v; lifeSet(day, p); },
          cycle: function(){ var day = dayKeyOf(ctx); lifeSet(day, {cycleStart: lifeDay(day).cycleStart ? null : true}); },
          trip: function(){ ctx.set({trip: !ctx.state.trip}); },
          tripsave: function(){
            var at = val('tat') ? new Date(val('tat') + 'T12:00:00').getTime() : Date.now();
            var t = travelAdd({at: at, from: val('tfrom'), to: val('tto'), zones: +val('tzones') || 0});
            ctx.state.trip = false; ctx.state.tfrom = ctx.state.tto = ''; ctx.state.tzones = 0; ctx.state.tat = '';
            yd.undo('Trip logged.', function(){ travelDelete(t.id); });
          },
          triprm: function(id){ var gone = tripList().filter(function(t){ return t.id === id; })[0]; travelDelete(id); if(gone) yd.undo('Trip removed.', function(){ travelAdd(gone); }); },
          /* ---- recovery ---- */
          win: function(v){ ctx.set({win: +v}); },
          /* ---- muscle feel ---- */
          rday: function(v){ ctx.set({rday: v}); },
          rate: function(v, el){ var p = {}; p[el.getAttribute('data-f')] = +v; rateSet(ctx.state.rday || todayKey(), el.getAttribute('data-m'), p); },
          /* ---- injuries ---- */
          injadd: function(v){ injAdd(v); },
          injsave:function(id){var i=injuries().find(function(x){return x.id===id;}),field=root.querySelector('[data-chg="injnote"][data-id="'+id+'"]');if(!i||!field)return;var old=i.note;i.note=field.value.trim().slice(0,120);save();if(!saveOk()){i.note=old;ctx.state.injErrors=Object.assign({},ctx.state.injErrors||{});ctx.state.injErrors[id]='This device could not save. Your note is still here.';C3.render();return;}clearNote(id);yd.toast('Note saved on this device.');C3.render(true);},
          injcancel:function(id){clearNote(id);C3.render(true);},
          injheal: function(id){ var i = injuries().filter(function(x){ return x.id === id; })[0]; injHeal(id, !(i && i.healed)); },
          injdel: function(id){ var gone = injDelete(id); if(gone) yd.undo('Removed.', function(){ injuries().push(gone); }); },
          /* ---- showing up ---- */
          pause: function(k){
            if(activeDays().has(k)){ yd.toast('That day has something logged on it. There is nothing to pause.'); return; }
            var on = pauseDay(k);
            if(on && on.vacay){ yd.toast('That day is inside your ' + esc(on.vacay.from) + ' to ' + esc(on.vacay.to) + ' break. Remove the break instead.'); return; }
            yd.toast(on ? 'Marked as a day off.' : 'Pause removed.');
          },
          repair: function(k){ var r = repairDay(k); yd.toast(r.ok ? 'Repaired, ' + r.left + ' left this month.' : r.why); C3.refresh(); },
          goal: function(v){ setWeekGoal(+v); C3.refresh(); },
          vacadd: function(){
            var r = vacayAdd(val('vfrom'), val('vto'), val('vwhy'));
            if(!r){ yd.toast('Pick two dates.'); return; }
            if(!r.ok){ yd.toast(esc(r.why)); return; }
            ctx.state.vfrom = ctx.state.vto = ctx.state.vwhy = '';
            yd.undo('<b>' + yd.plural(r.days, 'day') + ' held.</b>', function(){ vacayDelete(r.rec.id); });
            C3.refresh();
          },
          vacrm: function(id){ var gone = vacayDelete(id); if(gone) yd.undo('Break removed.', function(){ vacayAdd(gone.from, gone.to, gone.why); }); C3.refresh(); },
          /* ---- notes ---- */
          tag: function(v){ ctx.set({tag: v, all: false}); },
          all: function(){ ctx.set({all: !ctx.state.all}); },
          heartsheet: function(){ C3.sheet('heart'); }
        }, {
          tfrom: function(v){ ctx.state.tfrom = v; }, tto: function(v){ ctx.state.tto = v; }, tzones: function(v){ ctx.state.tzones = v; }, tat: function(v){ ctx.state.tat = v; },
          vfrom: function(v){ ctx.state.vfrom = v; }, vto: function(v){ ctx.state.vto = v; }, vwhy: function(v){ ctx.state.vwhy = v; },
          hrmax: function(v){
            v = +v || 0;
            if(!(v >= 120 && v <= 230)){ yd.toast('A measured max is between 120 and 230. It is a test result, not a guess.', 'bad'); C3.render(true); return; }
            ALL.body = ALL.body || {}; ALL.body.hrMax = Math.round(v); save();
            yd.toast('<b>Max saved.</b> Zones are drawn from your own measurement now.');
          },
          injnote:function(v,el){ctx.state.injNotes=Object.assign({},ctx.state.injNotes||{});ctx.state.injNotes[el.getAttribute('data-id')]=String(v).slice(0,120);}
        });
        root.querySelectorAll('[data-chg="injnote"]').forEach(function(el){el.addEventListener('input',function(){var id=el.getAttribute('data-id');ctx.state.injNotes=Object.assign({},ctx.state.injNotes||{});ctx.state.injNotes[id]=el.value;var setup=ALL.journeySetup=ALL.journeySetup||{};setup.injuryDrafts=Object.assign({},setup.injuryDrafts||{});setup.injuryDrafts[id]={value:el.value,at:Date.now()};setup.at=Date.now();C3.journey.deferSave('injury');});});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
