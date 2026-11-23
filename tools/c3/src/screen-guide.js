/* C3 screen: guide (v342). The member's own copy of the free guide, "Build Muscle. Lose Fat. Get Healthy."
   (plan.formedlabs.co/guide/, read 18 Oct 2026), turned into a screen you look at: every field of the guide filled from
   their own log and drawn as rings, bars and a chart. The guide's words (the training rules, eating when you're not
   hungry, building a plate, reading your progress, staying safe) are folded under one line at the end.
   Chad, 18 Oct 2026: "use a copy of our free fitness guide ... as every user's sheet, fully going through and using every
   field and section", "free members can use the document but only will get autonomous bot discussions to review numbers
   etc if they are on paid plan", and on the first build: "IT LOOKS LIKE A BOOK". So: show, don't explain.
     Free, for everyone: every number and every chart.
     Pro (the app's own isPro(): paid, a running trial, or 'open'): under a chart, the coach whose job it is says what they
     read in it, one line; tapping it opens that coach's chat asked the question (answered from the person's own rows).
   Every number is the app's own: weigh-ins (ALL.weights), targets (proteinRange, proteinTarget, calorieTarget,
   hydrationTarget, stepTarget), the program (weekAt, BLOCK_WEEKS), the meal plan (the meal kit), the log (ALL.workLog rows,
   dayTotals). Nothing is drawn that they have not logged. No compound appears here. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, fmt = h.fmt, safe = yd.safe;
    var DAY = 864e5, WEEK = 7 * DAY;
    var n0 = function(v){ return Math.round(+v || 0).toLocaleString('en-US'); };
    var r1 = function(v){ return Math.round((+v || 0) * 10) / 10; };
    var metric = function(){ return safe(function(){ return !!isMetric(); }, false); };
    var unit = function(){ return safe(function(){ return wU(); }, 'lb'); };
    var wnum = function(lb){ return safe(function(){ return wNum(lb, 1); }, r1(lb)); };   /* a body weight in their unit, no unit word */
    var lnum = function(lb){ return safe(function(){ return loadNum(lb); }, lb); };      /* a load on the bar in their unit */
    var kday = function(at){ return safe(function(){ return dkey(at); }, ''); };
    var pTot = function(k){ return safe(function(){ return dayTotals(k).p; }, 0) || 0; };
    /* the coach chat's own chips (COACH_LOCAL_CHIPS), spelled as the app spells them: a chip is answered from the rows */
    var Q_WEEK = "How's my week?", Q_PROT = 'Protein today', Q_NOW = 'What do I do now?';
    var PRO = false;

    /* ---------- drawing ---------- */
    function ring(frac, color, big, small, label){
      var f = Math.max(0, Math.min(1, +frac || 0)), C = 2 * Math.PI * 42;
      return '<div class="gd-ring"><div class="gd-ring-c"><svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle class="t" cx="50" cy="50" r="42"></circle>' +
        (f > 0 ? '<circle class="a" cx="50" cy="50" r="42" stroke="' + color + '" stroke-dasharray="' + r1(f * C) + ' ' + r1(C) + '" transform="rotate(-90 50 50)"></circle>' : '') + '</svg>' +
        '<span class="in"><b class="c3-num">' + esc(big) + '</b>' + (small ? '<small class="c3-num">' + esc(small) + '</small>' : '') + '</span></div><span class="lb">' + esc(label) + '</span></div>';
    }
    /* vertical bars: [{v, top, label, on, now}] against max, an optional aim line */
    function bars(list, max, aria, aim, flat){
      var m = max > 0 ? max : 1, line = aim > 0 ? '<em class="gd-aim" style="bottom:' + Math.min(100, r1(aim / m * 100)) + '%"></em>' : '';
      return '<div class="gd-bars n' + list.length + (flat ? ' flat' : '') + '" role="img" aria-label="' + esc(aria) + '">' + list.map(function(b){
        var f = Math.max(0, Math.min(1, (+b.v || 0) / m));
        return '<div class="gd-bar' + (b.on ? ' on' : '') + (b.now ? ' now' : '') + '"><span class="v c3-num">' + esc(b.top || '') + '</span><span class="col"><i style="height:' + r1(f * 100) + '%"></i>' + line + '</span><span class="l">' + esc(b.label) + '</span></div>';
      }).join('') + '</div>';
    }
    /* a section: its label on a hairline, the visual, the coach's line (Pro), a way on */
    function part(id, label, body, o){
      o = o || {};
      return '<section class="gd-part' + (o.wide ? ' wide' : '') + '" data-sec="' + id + '" aria-label="' + esc(label) + '"><h2 class="gd-lbl"><span>' + esc(label) + '</span>' + (o.go || '') + '</h2>' +
        (o.right ? '<p class="gd-sub c3-num">' + o.right + '</p>' : '') + body + (o.say || '') + (o.cta || '') + '</section>';
    }
    function link(attr, label, key){ return '<button type="button" class="gd-link" ' + attr + ' data-key="gd-' + key + '"><span>' + esc(label) + '</span>' + h.icon('arrow', 15, 3) + '</button>'; }
    /* Pro: the coach's one line; the whole line is the control that opens the chat asked the question */
    function say(id, line, ask){
      if(!PRO || !line) return '';
      var c = safe(function(){ return h.coaches().filter(function(x){ return x.id === id; })[0]; }, null); if(!c) return '';
      return '<button type="button" class="gd-say" data-act="review" data-v="' + esc(id + '|' + ask) + '" data-rev="' + esc(id) + '" data-key="say-' + esc(id) + '-' + esc(ask) + '" aria-label="' + esc(c.name + ': ' + line + ' Review it with ' + c.name.split(' ')[0]) + '">' +
        '<img src="' + esc(c.badge) + '" alt="" width="36" height="36"><span class="t"><b>' + esc(c.name.split(' ')[0]) + '</b> ' + esc(line) + '</span><span class="gd-link r"><span>Review</span>' + h.icon('arrow', 15, 3) + '</span></button>';
    }
    function empty(t){ return '<p class="gd-none">' + esc(t) + '</p>'; }

    /* ---------- their numbers, read once a paint ---------- */
    function nums(){
      var b = ALL.body || {}, cfg = safe(function(){ return trainCfg(); }, ALL.train || {}) || {};
      var now = safe(function(){ return goalWeighed(); }, 0) || 0, goal = +b.goalLb || 0, G = safe(function(){ return foodGoal(); }, null);
      var diff = (goal > 0 && now > 0) ? goal - now : 0;
      var pr = safe(function(){ return proteinRange(); }, null), kc = safe(function(){ return calorieTarget(); }, null), P = safe(function(){ return mpPrefs(); }, null) || {};
      var tr = safe(function(){ return isTrainingToday(); }, false);
      return {name: safe(function(){ return firstName(); }, ''), now: now, goal: goal, diff: diff,
        dir: diff > 0.5 ? 1 : diff < -0.5 ? -1 : (G && G.dir === 'gain') ? 1 : (G && G.dir === 'cut') ? -1 : 0,
        prot: pr ? {min: pr.min, max: pr.max} : null, pt: safe(function(){ return proteinTarget(); }, 0) || 0, kcal: kc ? kc.kcal : null, meals: P.meals || 4,
        water: now > 0 ? safe(function(){ return hydrationTarget(tr); }, 0) : 0, steps: safe(function(){ return stepTarget(tr); }, 0),
        start: +cfg.startedAt || 0, wk: safe(function(){ return weekIndexNow(); }, 0), weeks: safe(function(){ return BLOCK_WEEKS; }, 12),
        W: (ALL.weights || []).filter(function(w){ return w && w.lb > 0; }).slice().sort(function(a, x){ return a.at - x.at; })};
    }
    function counted(rows){ return (rows || []).filter(function(r){ return safe(function(){ return setMath(r).counts; }, !!(r && r.done && r.t !== 'W')); }); }
    function logged(L){ return safe(function(){ return h.logged(L); }, false); }
    function rateOf(N){
      var W = N.W, last = W.length ? W[W.length - 1] : null; if(!last) return null;
      var back = W.filter(function(x){ return x.at <= last.at - 13 * DAY; }).pop();
      return (back && last.at > back.at) ? (last.lb - back.lb) / ((last.at - back.at) / WEEK) : null;
    }
    /* the guide's "Reading your progress" table, for the way they are going; the row their last 2 weeks land on */
    function readRow(N, rate){
      var down = N.dir < 0;
      var R = down ? ['Take about 250 calories a day out: the evening snack, or the oil in two meals.', 'Keep going. It’s working.', 'Add the evening snack back and keep everything else the same.']
                   : ['Add a second shake, or 1 Tbsp of olive oil or nut butter to two meals. About 250 more calories a day.', 'Keep going. It’s working.', 'Drop the evening snack and keep everything else the same.'];
      if(rate == null) return null;
      var r = rate * (down ? -1 : 1);
      return r > 2 ? R[2] : r < 0.25 ? R[0] : R[1];
    }

    /* ---------- the top: where they are, in three rings, and the one line beside them ---------- */
    function nextDay(W){ return (W.days || []).filter(function(d){ return d.status === 'today' || d.status === 'future'; })[0] || null; }
    function hero(N, W){
      var tk = kday(Date.now()), p = pTot(tk), wkN = Math.min(W.weekNo, N.weeks);
      var missed = (W.days || []).filter(function(d){ return d.status === 'missed'; }).length, nx = nextDay(W);
      /* the app's own word for a session that went by (v330): open, never "missed" */
      var line = missed ? missed + (missed === 1 ? ' session' : ' sessions') + ' open this week. ' + (nx ? nx.name + (nx.isToday ? ' today' : ' ' + nx.long) + ' gets you back.' : 'Next week starts clean.')
        : nx ? 'Nothing open this week. Keep it going.' : 'Week done. Rest up.';
      return '<section class="gd-hero" data-sec="hero" aria-label="Where you are">' +
        '<div class="gd-rings">' +
          ring(wkN / N.weeks, '#5CF2B0', String(W.weekNo), 'of ' + N.weeks, 'Week') +
          ring(W.planned ? W.done / W.planned : 0, '#FF4FCB', W.done + '/' + (W.planned || 0), '', 'Workouts') +
          ring(N.pt ? p / N.pt : 0, '#33353B', n0(p), N.pt ? 'of ' + N.pt + ' g' : 'g', 'Protein today') +
        '</div>' + (PRO ? say('dakota-jane', line, Q_WEEK) : freeLine()) +
      '</section>';
    }

    /* ---------- Dial it in: the guide's numbers, theirs ---------- */
    function numbers(N){
      if(!(N.now > 0)) return part('numbers', 'Your numbers', empty('No weigh-in yet.'), {cta: yd.primary('finish', 'Finish your plan', '', {icon: 'arrow'})});
      var per = N.prot ? Math.round(N.prot.min / N.meals) + '-' + Math.round(N.prot.max / N.meals) + ' g a meal' : '';
      return part('numbers', 'Your numbers', '<div class="gd-nums">' +
        '<div><b class="c3-num">' + (N.prot ? N.prot.min + '-' + N.prot.max : '-') + '<small>g</small></b><span>Protein a day</span>' + (per ? '<em class="c3-num">' + esc(per) + '</em>' : '') + '</div>' +
        '<div><b class="c3-num">' + (N.kcal ? n0(N.kcal) : '-') + '</b><span>Calories to start</span><em>the scale decides</em></div>' +
        '<div><b class="c3-num">' + (N.water ? fmt.liters(N.water, 1) : '-') + '<small>L</small></b><span>Water</span><em>between meals</em></div>' +
        '<div><b class="c3-num">' + (N.steps ? n0(N.steps) : '-') + '</b><span>Steps</span><em>sleep 7-9 h</em></div></div>',
        {go: link('data-act="finish"', 'Change', 'numbers')});
    }

    /* ---------- weight: their weigh-ins against the guide's band (½ to 1 lb a week their way), out to the goal ---------- */
    function weight(N){
      var W = N.W.filter(function(x){ return !N.start || x.at >= N.start - 14 * DAY; }); if(!W.length) W = N.W.slice(-1);
      if(!W.length) return part('weight', 'Weight', empty('No weigh-in yet.'), {cta: yd.primary('finish', 'Finish your plan', '', {icon: 'arrow'})});
      var now = Date.now(), t0 = W[0].at, w0 = W[0].lb, d = N.dir;
      var toGoal = N.goal > 0 && Math.abs(N.goal - w0) > 0.5 ? Math.ceil(Math.abs(N.goal - w0) / 0.5) : 0;   /* the slow end of the band reaches the goal here */
      var span = Math.min(52, Math.max(8, toGoal || 8, Math.ceil((now - t0) / WEEK) + 2)), t1 = t0 + span * WEEK;
      var band = function(t, k){ var wk = (t - t0) / WEEK; return d ? w0 + d * k * wk : w0 + (k === 0.5 ? -1 : 1); };
      var cut = function(v){ return N.goal > 0 && d ? (d > 0 ? Math.min(v, N.goal) : Math.max(v, N.goal)) : v; };   /* the band stops at the goal */
      var vals = W.map(function(x){ return x.lb; }).concat([cut(band(t1, 0.5)), cut(band(t1, 1))]);
      if(N.goal > 0) vals.push(N.goal);
      var lo = Math.min.apply(null, vals) - 2, hi = Math.max.apply(null, vals) + 2;
      var X = function(t){ return r1(66 + (t - t0) / (t1 - t0) * 514); }, Y = function(v){ return r1(14 + (hi - v) / (hi - lo) * 166); };
      var steps = [], k; for(k = 0; k <= 24; k++){ var t = t0 + (t1 - t0) * k / 24; steps.push(t); }
      var poly = steps.map(function(t){ return X(t) + ',' + Y(cut(band(t, 0.5))); }).concat(steps.slice().reverse().map(function(t){ return X(t) + ',' + Y(cut(band(t, 1))); })).join(' ');
      var ws = W.map(function(x){ return x.lb; }), a = Math.max.apply(null, ws), z = Math.min.apply(null, ws);
      var fast = toGoal ? Math.ceil(toGoal / 2) : 0;
      var svg = '<svg class="gd-wchart" viewBox="0 0 600 214" role="img" aria-label="Your weigh-ins against the band of ' + (metric() ? '0.2 to 0.5 kg' : 'half to 1 lb') + ' a week' + (N.goal ? ', out to your goal' : '') + '">' +
        '<line class="ax" x1="66" y1="180" x2="580" y2="180"></line>' +
        '<polygon class="band" points="' + poly + '"></polygon>' +
        (N.goal > 0 ? '<line class="goal" x1="66" y1="' + Y(N.goal) + '" x2="580" y2="' + Y(N.goal) + '"></line><text class="gl" x="' + (d < 0 ? 72 : 576) + '" y="' + (d < 0 ? Y(N.goal) - 9 : Y(N.goal) + 26) + '" text-anchor="' + (d < 0 ? 'start' : 'end') + '">Goal ' + esc(String(wnum(N.goal))) + '</text>' : '') +
        (W.length > 1 ? '<polyline class="ln" points="' + W.map(function(x){ return X(x.at) + ',' + Y(x.lb); }).join(' ') + '"></polyline>' : '') +
        W.map(function(x, i){ return '<circle class="pt' + (i === W.length - 1 ? ' last' : '') + '" cx="' + X(x.at) + '" cy="' + Y(x.lb) + '" r="' + (i === W.length - 1 ? 7 : 4.5) + '"></circle>'; }).join('') +
        '<text class="yl" x="54" y="' + (Y(a) + 5) + '" text-anchor="end">' + esc(String(wnum(a))) + '</text>' + (a - z >= 2 ? '<text class="yl" x="54" y="' + (Y(z) + 5) + '" text-anchor="end">' + esc(String(wnum(z))) + '</text>' : '') +
        '<text class="xl" x="66" y="206">' + (X(now) - X(t0) < 90 ? 'Today' : 'Start') + '</text>' + (X(now) - X(t0) >= 90 ? '<text class="xl" x="' + X(now) + '" y="206" text-anchor="' + (X(now) > 520 ? 'end' : 'middle') + '">Today</text>' : '') +
        (fast && X(t0 + fast * WEEK) < 500 && X(t0 + fast * WEEK) - X(now) > 70 ? '<line class="tick" x1="' + X(t0 + fast * WEEK) + '" y1="176" x2="' + X(t0 + fast * WEEK) + '" y2="184"></line><text class="xl" x="' + X(t0 + fast * WEEK) + '" y="206" text-anchor="middle">Wk ' + fast + '</text>' : '') +
        '<text class="xl" x="580" y="206" text-anchor="end">Wk ' + span + '</text></svg>';
      var rate = rateOf(N), act = readRow(N, rate), u = unit(), since = W[W.length - 1].lb - W[0].lb;
      var top = '<div class="gd-wtop"><div><b class="c3-num">' + esc(String(wnum(N.now))) + '</b><span>Now, ' + esc(u) + '</span></div>' +
        (N.goal ? '<div><b class="c3-num">' + esc(String(wnum(N.goal))) + '</b><span>Goal</span></div>' : '') +
        (toGoal ? '<div><b class="c3-num">' + fast + '-' + toGoal + '</b><span>Weeks to goal</span></div>' : '') +
        '<div><b class="c3-num">' + (since > 0 ? '+' : '') + esc(String(r1(metric() ? since / 2.20462 : since))) + '</b><span>Since start</span></div></div>';
      var ck = safe(function(){ return ALL.prefs && ALL.prefs.checkinDay != null ? fmt.dayLong(ALL.prefs.checkinDay | 0) : ''; }, '');
      var line = rate != null ? (rate > 0 ? '+' : '') + r1(metric() ? rate / 2.20462 : rate) + ' ' + u + ' a week. ' + act
        : 'Weigh in ' + (ck ? ck + ' morning' : 'once a week') + ', same scale. Two weigh-ins read the trend.';
      return part('weight', 'Weight', top + svg, {say: say('shaniqua', line, Q_WEEK), go: link('data-sheet="weigh"', 'Weigh in', 'weigh')});
    }

    /* ---------- this week: the app's own week ---------- */
    function week(N, W){
      return part('week', 'This week', h.weekHeadHTML(W) + h.weekStripHTML(W, W.todayDow), {go: link('data-go="train"', 'Workouts', 'train')});
    }

    /* ---------- the 12 weeks: sets per exercise, planned (outline) and done (filled) ---------- */
    function block(N){
      var log = ALL.workLog || {}, now = Date.now(), list = [], mx = 1;
      for(var i = 0; i < N.weeks; i++){
        var w = safe(function(){ return weekAt(i); }, []) || [], s = 0, n = 0, plan = 0, did = 0;
        w.forEach(function(x){ if(x && !x.rest) (x.blocks || []).forEach(function(bl){ s += +bl.sets || 0; n++; }); });
        if(N.start && i <= N.wk){ for(var d = 0; d < 7; d++){ var at = N.start + i * WEEK + d * DAY, x = w[new Date(at).getDay()]; if(x && !x.rest && (x.blocks || []).length && at <= now){ plan++; if(logged(log[kday(at)])) did++; } } }
        var v = n ? s / n : 0; mx = Math.max(mx, v);
        list.push({v: v, done: plan ? did / plan : 0, label: String(i + 1), now: i === N.wk, past: i < N.wk});
      }
      var full = mx;
      list.forEach(function(b){ b.light = b.v > 0 && b.v < full * 0.8; b.top = (b.now || b.light) ? String(r1(b.v)) : ''; });
      var m = mx * 1.12;
      var html = '<div class="gd-bars plan n' + list.length + '" role="img" aria-label="Sets per exercise, weeks 1 to ' + N.weeks + ', planned and done">' + list.map(function(b){
        return '<div class="gd-bar' + (b.now ? ' now' : '') + (b.light ? ' light' : '') + '"><span class="v c3-num">' + esc(b.top) + '</span><span class="col"><u style="height:' + r1(b.v / m * 100) + '%"></u>' +
          (b.done > 0 ? '<i style="height:' + r1(b.v / m * b.done * 100) + '%"></i>' : '') + '</span><span class="l">' + esc(b.label) + '</span></div>'; }).join('') + '</div>';
      return part('block', 'Your ' + N.weeks + ' weeks', html, {right: 'Week ' + Math.min(N.wk + 1, N.weeks) + ' of ' + N.weeks + ' · sets per exercise', go: link('data-deep="train:block"', 'All ' + N.weeks, 'block')});
    }

    /* ---------- protein, the last 7 days, against their number ---------- */
    function protein(N){
      if(!(N.pt > 0)) return part('protein', 'Protein, last 7 days', empty('No weigh-in yet.'));
      var now = Date.now(), list = [], hit = 0, sum = 0, any = 0, mx = N.pt * 1.25;
      for(var d = 6; d >= 0; d--){
        var at = now - d * DAY, p = pTot(kday(at));
        if(p > 0){ any++; sum += p; } if(p >= N.pt) hit++; mx = Math.max(mx, p * 1.08);
        list.push({v: p, top: p > 0 ? n0(p) : '', label: d === 0 ? 'Today' : fmt.dayAbbr(new Date(at).getDay()), on: p >= N.pt, now: d === 0});
      }
      var avg = any ? sum / any : 0;
      var line = !any ? 'Log breakfast and I start counting.' : avg < N.pt ? 'About ' + n0(N.pt - avg) + ' g short a day. One shake closes it.' : 'On target. Keep protein first at every meal.';
      return part('protein', 'Protein, last 7 days', bars(list, mx, 'Protein the last 7 days against ' + N.pt + ' g', N.pt, !any),
        {right: hit + ' of 7 days at ' + N.pt + ' g', say: say('nova-reyes', line, Q_PROT)});
    }

    /* ---------- today's meals: their meal plan, protein per meal, planned (outline) and logged (filled) ---------- */
    function dayPlan(){
      var mk = C3.mk; if(!mk) return null;
      var key = mk.today(), aim = safe(function(){ return mpAim(key); }, null);
      if(!aim) return {key: key};
      if(!mk.ready()){ safe(function(){ mpLoad().then(function(){ if(C3.current === 'guide') C3.refresh(); }); }); return {key: key, aim: aim, loading: true}; }
      if(!mk.day(key)) safe(function(){ mpEnsure(); });
      var D = mk.day(key); return (!D || D.off) ? {key: key, aim: aim, off: true} : {key: key, aim: aim, D: D, t: mk.dayTot(D)};
    }
    function meals(N, plan){
      var mk = C3.mk, L = "Today's meals", go = link('data-go="food"', 'Food', 'food');
      if(!plan || !plan.aim) return part('meals', L, empty('No weigh-in yet.'), {go: go});
      if(plan.loading) return part('meals', L, empty('Building your meals.'), {go: go});
      if(plan.off) return part('meals', L, empty('Eating out today.'), {go: go});
      var D = plan.D, t = plan.t, mx = Math.max.apply(null, D.meals.map(function(m){ return mk.tot(m).p; }).concat([1]));
      var nLog = D.meals.filter(function(m){ return m.logged; }).length, nx = D.meals.filter(function(m){ return !m.logged; })[0];
      var rows = '<ul class="gd-meals">' + D.meals.map(function(m){ var x = mk.tot(m);
        return '<li' + (m.logged ? ' class="on"' : '') + '><span class="tm c3-num">' + esc(m.time || mk.slotWord(m.slot)) + '</span><span class="nm">' + esc(m.t) + '</span><span class="g c3-num">' + n0(x.p) + ' g</span>' +
          '<span class="br"><i style="width:' + r1(Math.max(4, x.p / mx * 100)) + '%"></i></span></li>'; }).join('') + '</ul>';
      var line = nx ? 'Next: ' + nx.t + (nx.time ? ', ' + nx.time : '') + '.' : 'All ' + D.meals.length + ' meals logged. Done for today.';
      return part('meals', L, rows, {right: nLog + ' of ' + D.meals.length + ' logged · ' + n0(t.p) + ' g · ' + n0(t.kcal) + ' kcal', say: say('nova-reyes', line, Q_PROT), go: go});
    }

    /* ---------- your first 4 weeks: the guide's starter chart, checked off from the log ---------- */
    function starter(N){
      if(!N.start) return '';
      var log = ALL.workLog || {}, now = Date.now(), tk = kday(now), cols = {}, done = 0, planned = 0, weeks = [];
      for(var i = 0; i < 4; i++){
        var s = N.start + i * WEEK, w = safe(function(){ return weekAt(i); }, []) || [], days = [];
        for(var d = 0; d < 7; d++){ var at = s + d * DAY, dow = new Date(at).getDay(), x = w[dow]; days.push({at: at, key: kday(at), dow: dow, plan: !!(x && !x.rest && (x.blocks || []).length)}); }
        days.forEach(function(x){ if(x.plan) cols[x.dow] = 1; });
        weeks.push({s: s, e: s + WEEK, days: days});
      }
      var d0 = new Date(N.start).getDay();
      var dows = Object.keys(cols).map(Number).sort(function(a, b){ return ((a - d0 + 7) % 7) - ((b - d0 + 7) % 7); });   /* in the order each week runs */
      var first = N.W.filter(function(x){ return x.at >= N.start - 3 * DAY; })[0] || N.W[0] || null;
      var rows = weeks.map(function(wk, i){
        var dots = dows.map(function(dow){
          var x = wk.days.filter(function(y){ return y.dow === dow; })[0];
          if(!x || !x.plan) return '<i class="no"></i>';
          planned++; var ok = logged(log[x.key]); if(ok) done++;
          /* the date in the mark, so a row's Monday is plainly the 12th, not this week's 5th */
          return '<i class="' + (ok ? 'on' : x.key === tk ? 'today' : x.key > tk ? 'later' : 'miss') + '" aria-label="' + esc(fmt.dayLong(x.dow) + ' ' + new Date(x.at).getDate() + (ok ? ', done' : x.key === tk ? ', today' : x.key > tk ? '' : ', open')) + '">' +
            (ok ? h.icon('check', 13, 3.6) : '<b class="c3-num">' + new Date(x.at).getDate() + '</b>') + '</i>';
        }).join('');
        var wkW = N.W.filter(function(x){ return x.at >= wk.s && x.at < wk.e; }).pop(), pDays = 0;
        wk.days.forEach(function(x){ if(N.pt > 0 && x.at <= now && pTot(x.key) >= N.pt) pDays++; });
        return '<div class="gd-sr' + (now >= wk.s && now < wk.e ? ' now' : wk.s > now ? ' later' : '') + '"><span class="k">Wk ' + (i + 1) + '</span><span class="dots">' + dots + '</span>' +
          '<span class="w c3-num">' + (wkW ? esc(String(wnum(wkW.lb))) : '') + '</span><span class="p c3-num">' + (wk.s > now ? '' : pDays + '/7') + '</span></div>';
      }).join('');
      var head = '<div class="gd-sr th"><span class="k"></span><span class="dots">' + dows.map(function(d){ return '<i class="h">' + esc(fmt.dayAbbr(d).charAt(0)) + '</i>'; }).join('') + '</span><span class="w">' + esc(unit()) + '</span><span class="p">Protein</span></div>';
      var last = N.W.length ? N.W[N.W.length - 1] : null, since = (first && last) ? last.lb - first.lb : 0;
      return part('starter', 'Your first 4 weeks', '<div class="gd-start">' + head + rows + '</div>',
        {right: done + ' of ' + planned + ' workouts · ' + (since > 0 ? '+' : '') + r1(metric() ? since / 2.20462 : since) + ' ' + esc(unit())});
    }

    /* ---------- weight used, last set: their lifts, weeks 1 to 4 ---------- */
    function lifts(N){
      if(!N.start) return '';
      var log = ALL.workLog || {}, names = {}, cell = {}, order = [];
      safe(function(){ (weekAt(N.wk) || []).forEach(function(d){ (d && !d.rest && d.blocks || []).forEach(function(bl){ if(!names[bl.id]){ names[bl.id] = bl.n; order.push(bl.id); } }); }); });
      Object.keys(log).sort().forEach(function(k){
        var L = log[k], i = Math.floor((Date.parse(k + 'T12:00:00') - N.start) / WEEK); if(!(i >= 0 && i < 4) || !L || !L.rows) return;
        Object.keys(L.rows).forEach(function(id){ var c = counted(L.rows[id]).filter(function(r){ return +r.lb > 0; }); if(!c.length) return; (cell[id] = cell[id] || {})[i] = +c[c.length - 1].lb; if(!names[id]){ names[id] = ((L.blocks || []).filter(function(b){ return b && b.id === id; })[0] || {}).n || ''; if(names[id]) order.push(id); } });
      });
      var have = order.filter(function(id){ return cell[id]; });
      var first = {}, last = {}; have.forEach(function(id){ var ks = Object.keys(cell[id]).map(Number).sort(); first[id] = cell[id][ks[0]]; last[id] = cell[id][ks[ks.length - 1]]; });
      var best = have.filter(function(id){ return last[id] > first[id]; }).sort(function(a, b){ return (last[b] - first[b]) - (last[a] - first[a]); })[0];
      var T = h.today(), nx = T.rest ? (nextDay(h.week()) || {}).name : T.name;
      var line = best ? names[best] + ' up ' + lnum(last[best] - first[best]) + ' ' + unit() + ' since your first session.'
        : 'Log ' + (nx || 'your next session') + ' and I set next week’s weights from it.';
      var show = have.length ? have.slice(0, 8) : order.slice(0, 3);
      var body = '<ul class="gd-lifts' + (have.length ? '' : ' ghost') + '">' + show.map(function(id){
          var c = cell[id] || {}, mx = Math.max.apply(null, [0, 1, 2, 3].map(function(i){ return c[i] || 0; }).concat([1]));
          return '<li><span class="nm">' + esc(names[id]) + '</span><span class="gd-w4">' + [0, 1, 2, 3].map(function(i){ var v = c[i];
            return '<span class="c' + (v ? ' on' : '') + '"><i style="height:' + (v ? r1(Math.max(14, v / mx * 100)) : 100) + '%"></i><em class="c3-num">' + (v ? esc(String(lnum(v))) : '') + '</em></span>'; }).join('') + '</span></li>';
        }).join('') + '</ul><div class="gd-wkl"><span></span><span class="gd-w4"><i>1</i><i>2</i><i>3</i><i>4</i></span></div>';
      return part('lifts', 'Weight used, last set', body, {right: (have.length ? have.length : '0') + (have.length === 1 ? ' lift' : ' lifts') + ' logged' + ' · ' + esc(unit()), say: say('titan-kane', line, Q_NOW), go: link('data-go="train"', 'Log', 'lift')});
    }

    /* ---------- the guide's words, folded under one line ---------- */
    function tips(N){
      var g = function(t, list){ return '<div class="gd-tg"><h3>' + esc(t) + '</h3><ul>' + list.map(function(x){ return '<li><b>' + esc(x[0]) + '</b> ' + esc(x[1]) + '</li>'; }).join('') + '</ul></div>'; };
      var down = N.dir < 0;
      return '<details class="gd-fold" data-sec="tips"><summary data-key="gd-fold"><img src="story/scenes/plan-book-cover.webp" width="1176" height="1522" alt="" decoding="async">' +
        '<span class="t"><b>The guide</b><span>Build Muscle. Lose Fat. Get Healthy. Training, food, appetite, safety.</span></span>' + h.icon('chev', 20, 2.4) + '</summary><div class="gd-tips">' +
        g('Training', [['Warm up.', '5 minutes of easy walking or biking, then one light set of your first exercise.'], ['Effort.', 'Stop every set with 1 or 2 good reps left in you. Hard, but never sloppy.'],
          ['Move up.', 'Hit the top of the rep range on every set? Go up 5 lb or grab the next dumbbell.'], ['Eat after.', 'A shake or a meal within an hour or two after every workout.'],
          ['Walk.', 'Take a 10-minute walk after your biggest meal every day.']]) +
        g('Eating when you’re not hungry', [['Eat by the clock.', 'Every 3 to 4 hours, hungry or not. Set phone alarms.'], ['Drink it.', 'A shake goes down easier than a plate.'],
          ['Protein first.', 'Eat the protein on your plate before anything else.'], ['Pack it in.', 'Olive oil, nut butter, cheese or avocado: same bite, more fuel.'],
          ['Water between meals.', 'Sip with food, drink the rest in between.'], ['Walk first.', 'A 10-minute walk before you eat wakes your appetite up.'],
          ['Keep it in sight.', 'Boiled eggs, cheese sticks, jerky, nuts and yogurt cups at eye level.'], ['Go bold.', 'Salsa, lemon, garlic, spices and hot sauce.'], ['Go cold.', 'Yogurt, cottage cheese and shakes still go down easy.']]) +
        g('Build a plate', [['Protein.', '1 to 2 palms, at every meal and every snack.'], ['Slow carbs.', '1 cupped hand: oatmeal, beans, lentils, quinoa, sweet potatoes, berries, brown rice.'],
          ['Vegetables.', '1 fist, cooked.'], ['Healthy fat.', '2 to 3 thumbs: olive oil, avocado, nuts, nut butters, cheese.'],
          ['Skip.', 'Juice, soda, sweetened coffee drinks, candy, pastries, mass gainers.'], ['Check the label.', 'Protein powder and jerky with 5 g of sugar or less.']]) +
        g('Reading your progress', [[down ? 'Up or stuck 2 weeks?' : 'Down or stuck 2 weeks?', down ? 'About 250 calories a day out.' : 'About 250 calories a day more: a second shake.'],
          ['Moving ½ to 1 lb a week your way?', 'Keep going. It’s working.'], ['More than 2 lb a week, 2 weeks running?', down ? 'Add the evening snack back.' : 'Drop the evening snack.'],
          ['Lifts stuck 2 weeks?', 'Check sleep and calories, then drop the weight 10% and build back up.']]) +
        g('Stay safe', [['Your doctor first.', 'Run this by your doctor, especially the protein amount and any daily medication you take.'],
          ['Never train empty.', 'Keep a small snack in your gym bag. Shaky, dizzy, sweaty or suddenly weak? Stop and eat it.'], ['Sharp pain means stop.', 'Sore for a day or two after is normal.']]) +
      '</div></details>';
    }

    /* ---------- the free line ---------- */
    function freeLine(){
      if(PRO) return '';
      var o = safe(function(){ return proOffer(); }, null);
      return '<div class="gd-free"><p>Coach reviews of your numbers come with Pro.</p>' + (o ? yd.btn('buy', o.label, {extra: 'data-buy="1"', pink: true}) : '') + '</div>';
    }

    yd.screen('guide', {
      parent: 'today', nav: 'today',
      render: function(ctx){
        PRO = yd.pro();
        var N = nums(), W = h.week(), plan = dayPlan();
        var head = yd.head({back: 'today', eyebrow: (N.name ? N.name + '’s plan' : 'Your plan') + ' · from the free guide', title: 'Your', pk: 'guide'});
        return '<div class="yd gd' + (PRO ? ' pro' : ' free') + '">' + head + hero(N, W) + '<div class="gd-body">' +
          weight(N) + numbers(N) + week(N, W) + block(N) + protein(N) + meals(N, plan) + starter(N) + lifts(N) + '</div>' + tips(N) + '</div>';
      },
      wire: function(root, ctx){
        root.querySelectorAll('[data-day]').forEach(function(b){b.addEventListener('click',function(){C3.go('train',{day:+b.getAttribute('data-day')});});});
        yd.wire(root, ctx, {
          finish: function(){ safe(function(){ (ALL.ui && ALL.ui.planOpen) ? openFinishPlan() : openSetupEdit(); }); },
          buy: yd.lockActs.buy,
          /* Pro: the coach's chat, asked this chart's question; a chip is answered from the person's own rows */
          review: function(v){
            if(!yd.pro()) return;
            var p = String(v || '').split('|'), id = p[0], q = p.slice(1).join('|');
            C3.sheet('coach', {coach: id});
            if(q) safe(function(){ coachAsk(id, q, {chip: true}); });
          }
        });
      }
    });
  });
})();
