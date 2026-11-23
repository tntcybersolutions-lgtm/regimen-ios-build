/* C3 screen: progress. "Am I getting anywhere?", answered honestly.
   This week and last week from the app's own recap (recapData, recapWindow, recapPrev,
   scorecardFor), the weight chart from the real weigh-ins (ALL.weights), the trend only
   when the app reports one (coachProfile().slopeLbWk), records from ALL.prs / ALL.prFeed.
   The research lane (peptide level, next dose) is its own section, with no coach in it,
   and only when C3.h.peptide() is not null. Nothing here is made up: no data reads as
   an honest zero or "not yet". */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var ORD = ['1st','2nd','3rd','4th','5th'];
  var DAY_MS = 86400000;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function clamp01(x){ x = +x; return !(x > 0) ? 0 : x > 1 ? 1 : x; }
  function md(at){ var d = new Date(at); return MON[d.getMonth()] + ' ' + d.getDate(); }
  function r1(v){ return Math.round(v * 10) / 10; }
  function ico(d, size, sw){
    return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
  }
  var IC = {
    chev: '<path d="M9 5l7 7-7 7"></path>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>'
  };
  /* a weight stored in lb, in the person's unit: {n:"199.4", u:"lb"} through the app's own unit helpers */
  function wParts(lb, dp){
    var t = String(fmt.weight(lb, dp == null ? 1 : dp)), i = t.lastIndexOf(' ');
    return i > 0 ? {n:t.slice(0, i), u:t.slice(i + 1)} : {n:t, u:fmt.unit()};
  }
  /* a number of pounds as a number in the person's unit (for chart labels), no unit word */
  function wN(lb){ return wParts(lb, 1).n; }
  /* does the app gate this old screen right now? (its own table, its own test) */
  function locked(id){ return safe(function(){ return !!PRO_PANES[id] && !isPro(); }, false); }
  /* n segments, the first `on` lit: the paired bars and the pills */
  function segs(on, n, cls){
    var s = '<span class="pg-segs' + (cls ? ' ' + cls : '') + '" aria-hidden="true">';
    for(var i = 0; i < n; i++) s += '<i' + (i < on ? ' class="on"' : '') + '></i>';
    return s + '</span>';
  }

  /* ---------- the two weeks ---------- */
  function weeks(){
    var w = recapWindow('week'), p = recapPrev(w);
    var R = recapData(w), Q = recapData(p);
    var S1 = safe(function(){ return scorecardFor(w.from); }, null) || {};
    var S0 = safe(function(){ return scorecardFor(p.from); }, null) || {};
    var started = safe(function(){ return trainCfg().startedAt || 0; }, 0);
    return {w:w, p:p, R:R, Q:Q, S1:S1, S0:S0,
            planned: S1.planned | 0,
            /* a week that ended before the plan began had nothing planned in it */
            plannedPrev: (started && started >= p.to) ? 0 : (S0.planned | 0),
            target: safe(function(){ return proteinTarget(); }, null)};
  }
  function span(w){ return md(w.from) + ' to ' + md(w.to - DAY_MS); }

  function metricRoute(label){
    if(/session|record/i.test(label)) return ' data-go="history"';
    if(/weigh|weight/i.test(label)) return ' data-sheet="weigh"';
    if(/step/i.test(label)) return ' data-sheet="steps"';
    if(/water/i.test(label)) return ' data-sheet="water"';
    if(/food|protein/i.test(label)) return ' data-go="food"';
    return ' data-go="recap"';
  }
  function stat(big, small, label, under){
    return '<button type="button" class="pg-stat"' + metricRoute(label) + ' aria-label="' + esc(label + ', open details') + '"><span class="v' + (String(big).length >= 7 ? ' xlong' : String(big).length >= 6 ? ' long' : '') + '"><b>' + big + '</b>' + (small ? '<span>' + small + '</span>' : '') + '</span>' +
      '<span class="k">' + label + '</span>' + (under || '') + '</button>';
  }
  function thisWeek(K){
    var R = K.R, full = R.days >= 7;
    var steps = R.stepMean != null ? fmt.n(R.stepMean) : '0';
    /* never "0 of 0": with no food day in the week the count stands alone beside the honest note */
    var prot = K.target ? stat(String(K.S1.prot | 0), (R.foodDays | 0) > 0 ? 'of ' + (R.foodDays | 0) : '', 'Protein days', '<span class="u">' + ((R.foodDays | 0) ? 'food days at ' + fmt.n(K.target) + ' g' : 'no food logged yet') + '</span>')
                        : stat(String(R.foodDays | 0), R.days > 0 ? 'of ' + R.days : '', 'Food days', '<span class="u">no protein target yet</span>');
    return '<section class="pg-week" aria-label="This week">' +
      '<div class="pg-title"><div class="c3-eyebrow"><i></i>' + esc(span(K.w)) + (full ? '' : ' · so far') + '</div>' +
        '<h1 class="c3-h1 pg-h1">This <span class="pk">week</span></h1></div>' +
      '<p class="pg-summary">You logged '+(R.sessions | 0)+' '+((R.sessions | 0)===1?'workout':'workouts')+' this week. '+(K.planned?'Your plan has '+K.planned+' sessions. ':'No session target is set. ')+(function(){var W=h.week(),d=(W.days||[]).filter(function(x){return !x.rest&&x.status!=='done'&&!x.past;})[0];return d?'Next planned: '+esc(d.long||d.abbr)+' · '+esc(d.name)+'.':'Review your calendar for the next session.';})()+'</p><div class="pg-next"><button type="button" class="c3-btn-quiet" data-go="cal">Open calendar</button><button type="button" class="c3-btn-quiet" data-go="share">Make a share card</button></div>'+  '<div class="pg-stats">' +
        stat(String(R.sessions | 0), K.planned ? '/ ' + K.planned : '', 'Sessions logged', K.planned ? segs(R.sessions | 0, K.planned, 'mint') + '<span class="u">of ' + K.planned + ' planned this week</span>' : '<span class="u">none planned</span>') +
        stat(String(R.activeDays | 0), R.days > 0 ? 'of ' + R.days : '', 'Days logged', segs(R.activeDays | 0, R.days, 'pink') + '<span class="u">days with activity recorded</span>') +
        stat(String(R.weighIns | 0), '', (R.weighIns | 0) === 1 ? 'Weigh-in' : 'Weigh-ins', '<span class="u">' + (R.weightTo != null ? esc(fmt.weight(R.weightTo, 1)) : 'none this week') + '</span>') +
        stat(steps, '', 'Steps a day', '<span class="u">' + (R.stepDays ? 'average over ' + R.stepDays + (R.stepDays === 1 ? ' day' : ' days') : 'no steps logged yet') + '</span>') +
        prot +
      '</div><div class="pg-key" aria-label="Weekly bar key"><button type="button" data-go="history"><i class="mint"></i>Green: sessions logged</button><button type="button" data-go="recap"><i class="pink"></i>Pink: days with a log</button><button type="button" data-go="cal"><i class="empty"></i>Empty: not logged yet</button><p>So far this week, not future days.</p></div>' +
      /* v362: the records and the report behind one More (Chad, 26 Oct: "overwhelming and cluttered") */
      h.moreHTML('progress', '<button type="button" class="c3-link" data-go="history" data-key="pg-hist">Workout records</button><button type="button" class="c3-link" data-go="report" data-key="pg-report">Export a report</button>') + '</section>';
  }

  /* Plain readout from recorded activity, not an AI or medical assessment.
     A partial current week is never presented as a full-week performance change. */
  function weeklyReadout(K){
    var R=K.R,Q=K.Q,has=(R.activeDays|0)>0,prior=(Q.activeDays|0)>0;
    var change=!has?'No activity is recorded for this week yet. Missing logs do not mean you did nothing.':
      'So far: '+(R.sessions|0)+' workouts and '+(R.foodDays|0)+' food days logged.';
    if(has&&prior)change+=' Last week had '+(Q.sessions|0)+' workouts and '+(Q.foodDays|0)+' food days. This week is still in progress, so these are not equal-length comparisons.';
    else if(has)change+=' There is no recorded activity last week to compare with.';
    var W=safe(function(){return h.week();},{days:[]}),next=(W.days||[]).filter(function(d){return !d.rest&&d.status!=='done'&&!d.past;})[0];
    var advice=!has?'Start with one honest log today. Build a record before changing your plan.':
      K.planned>0&&(R.sessions|0)>=K.planned?'Your recorded sessions meet the plan for this week. Keep the planned recovery days; do not add work just to fill a chart.':
      next?'Keep your next planned session: '+next.long+' - '+next.name+'. Do not cram missed sessions into one day.':
      'Review your calendar before adding another session. Keep changes small and use your recovery as context.';
    return '<section class="pg-readout" aria-label="Weekly review"><h2 class="c3-h2">What changed</h2><p>'+esc(change)+'</p><h3>What to adjust</h3><p>'+esc(advice)+'</p><p class="pg-readout-note">Based on your saved logs. This review does not change your plan.</p><div class="yd-acts"><button type="button" class="c3-btn-quiet" data-go="today">Do the next step today</button><button type="button" class="c3-btn-quiet" data-go="cal">Review my calendar</button></div></section>';
  }

  /* ---------- this week against last week: paired bars, labeled directly ---------- */
  function pair(label, a, an, b, bn, cls, big){
    var row = function(who, v, n, dim){
      return '<div class="pg-pr' + (dim ? ' was' : '') + '"><span class="w">' + who + '</span>' +
        (n > 0 ? segs(Math.min(v, n), n, cls) : '<span class="pg-segs none" aria-hidden="true"></span>') +
        '<span class="n">' + v + (n > 0 ? ' / ' + n : '') + '</span></div>';
    };
    return '<button type="button" class="pg-pair' + (big ? ' big' : '') + '"' + metricRoute(label) + ' aria-label="' + esc(label + ': this week ' + a + (an > 0 ? ' of ' + an : '') + ', last week ' + b + (bn > 0 ? ' of ' + bn : '')) + '">' +
      '<div class="pg-pl">' + esc(label) + '</div>' + row('This week', a, an, false) + row('Last week', b, bn, true) + '</button>';
  }
  function versus(K){
    var R = K.R, Q = K.Q;
    return '<section class="pg-vs" aria-label="This week against last week">' +
      '<div class="pg-vs-head"><span class="pg-sec plain">Vs last week</span><span class="when">' + esc(span(K.p)) + '</span></div>' +
      pair('Sessions kept', R.sessions | 0, K.planned, Q.sessions | 0, K.plannedPrev, 'mint', true) +
      '<div class="pg-pairs">' +
        pair('Days logged', R.activeDays | 0, R.days, Q.activeDays | 0, Q.days, 'pink') +
        pair('Weigh-ins', R.weighIns | 0, 0, Q.weighIns | 0, 0, 'mint') +
        pair('Step days', R.stepDays | 0, R.days, Q.stepDays | 0, Q.days, 'amber') +
        pair('Water days', R.waterDays | 0, R.days, Q.waterDays | 0, Q.days, 'sky') +
        pair('Food days', R.foodDays | 0, R.days, Q.foodDays | 0, Q.days, 'pink') +
        (K.target ? pair('Protein days', K.S1.prot | 0, R.days, K.S0.prot | 0, Q.days, 'pink') : '') +
      '</div></section>';
  }

  /* ---------- weight: the real weigh-ins, drawn ---------- */
  function readings(){
    return (safe(function(){ return (ALL.weights || []).slice(); }, []) || [])
      .filter(function(x){ return x && Number.isFinite(+x.at) && +x.at > 0 && Number.isFinite(new Date(+x.at).getTime()) && Number.isFinite(+x.lb) && +x.lb > 0; })
      .map(function(x){ return {at:+x.at, lb:+x.lb}; }).sort(function(a, b){ return a.at - b.at; });
  }
  var FT = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;';
  var FH = 'font-family:\'Barlow Condensed\',\'Arial Narrow\',sans-serif;font-weight:800;letter-spacing:0;';
  function chart(all){
    var W = all.slice(-40), n = W.length;
    var VW = 400, VH = 236, L = 50, R = 392, T = 30, B = 196;
    var axis = '<path d="M ' + L + ' 8 V ' + B + ' H ' + (R + 4) + '" fill="none" stroke="var(--hair, #bac4d4)" stroke-width="1.5" stroke-linecap="round"></path>';
    var slot = function(x, lit){ return '<circle cx="' + x + '" cy="' + B + '" r="' + (lit ? 11 : 9) + '" fill="var(--well, #f1f4fa)" stroke="' + (lit ? '#FF4FCB' : 'var(--ink2, #536176)') + '" stroke-width="' + (lit ? 2 : 1.5) + '" stroke-dasharray="' + (lit ? '4 4' : '3 5') + '"' + (lit ? ' class="c3-ring-pulse"' : '') + '></circle>'; };
    var word = function(x, t, bright){ return '<text x="' + x + '" y="' + (B + 28) + '" text-anchor="middle" fill="' + (bright ? 'var(--ink, #182136)' : 'var(--ink2, #536176)') + '" style="' + FH + 'font-size:15px">' + t + '</text>'; };
    var open = function(label){ return '<svg class="pg-chart" data-go="body" tabindex="0" data-n="' + n + '" viewBox="0 0 ' + VW + ' ' + VH + '" role="button" aria-label="' + esc(label + ". Open weight details") + '" focusable="false">'; };
    var xs = [86, 158, 230, 302, 374], s, i;
    if(n === 0){
      s = open('Weight chart. No weigh-in yet. The first place is empty and waiting') + axis;
      for(i = 0; i < 5; i++) s += slot(xs[i], i === 0) + word(xs[i], ORD[i], i === 0);
      return s + '</svg>';
    }
    if(n === 1){
      var y1 = 104, one = wParts(W[0].lb, 1);
      s = open('Weight chart with one weigh-in at ' + one.n + ' ' + one.u + ' on ' + md(W[0].at) + '. The next places are empty and waiting') + axis +
        '<path d="M ' + L + ' ' + y1 + ' H ' + (L + 12) + '" fill="none" stroke="var(--hair, #bac4d4)" stroke-width="1.5" stroke-linecap="round"></path>' +
        '<path d="M ' + xs[0] + ' ' + (y1 + 22) + ' V ' + B + '" fill="none" stroke="rgba(92,242,176,.45)" stroke-width="1.5" stroke-dasharray="2 6" stroke-linecap="round"></path>' +
        '<text x="' + (L - 8) + '" y="' + (y1 + 5) + '" text-anchor="end" fill="var(--ink, #182136)" style="' + FT + 'font-size:14px">' + esc(one.n) + '</text>' +
        '<circle class="c3-ring-pulse" cx="' + xs[0] + '" cy="' + y1 + '" r="20" fill="none" stroke="#5CF2B0" stroke-width="2"></circle>' +
        '<circle data-pt="1" cx="' + xs[0] + '" cy="' + y1 + '" r="11" fill="#5CF2B0" style="filter:drop-shadow(0 0 9px #5CF2B0)"></circle>' +
        '<circle cx="' + xs[0] + '" cy="' + y1 + '" r="4" fill="var(--ink, #182136)"></circle>' +
        '<text x="' + xs[0] + '" y="' + (y1 - 34) + '" text-anchor="middle" fill="var(--ink, #182136)" style="' + FT + 'font-size:17px">' + esc(one.n + ' ' + one.u) + '</text>' +
        word(xs[0], esc(md(W[0].at)), true);
      for(i = 1; i < 5; i++) s += slot(xs[i], i === 1) + word(xs[i], ORD[i], i === 1);
      return s + '</svg>';
    }
    /* two or more: a line through the real readings, spaced by real time */
    var t0 = W[0].at, t1 = W[n - 1].at, lo = Infinity, hi = -Infinity;
    W.forEach(function(x){ if(x.lb < lo) lo = x.lb; if(x.lb > hi) hi = x.lb; });
    if(hi - lo < 1){ var mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }    /* a flat log is drawn flat, not as a cliff */
    var X0 = L + 22, X1 = R - 14, Y0 = T + 14, Y1 = B - 22;
    var px = function(x, k){ return Math.round((t1 > t0 ? X0 + (x.at - t0) / (t1 - t0) * (X1 - X0) : X0 + k / (n - 1) * (X1 - X0)) * 10) / 10; };
    var py = function(x){ return Math.round((Y1 - (x.lb - lo) / (hi - lo) * (Y1 - Y0)) * 10) / 10; };
    var pts = W.map(function(x, k){ return [px(x, k), py(x)]; });
    var first = wParts(W[0].lb, 1), last = wParts(W[n - 1].lb, 1), lp = pts[n - 1];
    s = open('Weight chart, ' + n + ' weigh-ins from ' + md(t0) + ' to ' + md(t1) + ': ' + first.n + ' to ' + last.n + ' ' + last.u) + axis;
    /* the scale: the highest and the lowest reading on the chart, in the person's unit */
    var yHi = Y1 - (Math.max.apply(null, W.map(function(x){ return x.lb; })) - lo) / (hi - lo) * (Y1 - Y0);
    var yLo = Y1 - (Math.min.apply(null, W.map(function(x){ return x.lb; })) - lo) / (hi - lo) * (Y1 - Y0);
    var tick = function(y, lb){ return '<path d="M ' + L + ' ' + y + ' H ' + R + '" fill="none" stroke="var(--hair, #bac4d4)" stroke-width="1" stroke-dasharray="2 6" stroke-linecap="round"></path>' +
      '<text x="' + (L - 8) + '" y="' + (y + 5) + '" text-anchor="end" fill="var(--ink, #182136)" style="' + FT + 'font-size:13px">' + esc(wN(lb)) + '</text>'; };
    var mx = Math.max.apply(null, W.map(function(x){ return x.lb; })), mn = Math.min.apply(null, W.map(function(x){ return x.lb; }));
    s += tick(Math.round(yHi * 10) / 10, mx);
    if(yLo - yHi > 18) s += tick(Math.round(yLo * 10) / 10, mn);
    s += '<polyline data-line="1" points="' + pts.map(function(p){ return p[0] + ',' + p[1]; }).join(' ') + '" fill="none" stroke="#5CF2B0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(92,242,176,.8))"></polyline>';
    var rad = n > 24 ? 3 : n > 12 ? 4 : 5.5;
    pts.forEach(function(p, k){ if(k < n - 1) s += '<circle data-pt="1" cx="' + p[0] + '" cy="' + p[1] + '" r="' + rad + '" fill="var(--well, #f1f4fa)" stroke="#5CF2B0" stroke-width="2.5"></circle>'; });
    s += '<circle class="c3-ring-pulse" cx="' + lp[0] + '" cy="' + lp[1] + '" r="17" fill="none" stroke="#5CF2B0" stroke-width="2"></circle>' +
         '<circle data-pt="1" cx="' + lp[0] + '" cy="' + lp[1] + '" r="9" fill="#5CF2B0" style="filter:drop-shadow(0 0 9px #5CF2B0)"></circle><circle cx="' + lp[0] + '" cy="' + lp[1] + '" r="3.5" fill="var(--ink, #182136)"></circle>';
    s += '<text x="' + X0 + '" y="' + (B + 26) + '" text-anchor="middle" fill="var(--ink2, #536176)" style="' + FH + 'font-size:15px">' + esc(md(t0)) + '</text>' +
         '<text x="' + X1 + '" y="' + (B + 26) + '" text-anchor="end" fill="var(--ink, #182136)" style="' + FH + 'font-size:15px">' + esc(md(t1)) + '</text>';
    return s + '</svg>';
  }
  /* what can honestly be said under the chart */
  function weightLine(all){
    var n = all.length;
    if(n === 0) return ['No weigh-in yet.', 'The first one starts the chart.'];
    if(n === 1) return ['One weigh-in.', 'Add more readings over time to see a trend.'];
    var slope = safe(function(){ return coachProfile().slopeLbWk; }, null);
    if(slope != null && isFinite(slope)){
      var a = wParts(Math.abs(slope), 1);
      return [n + ' weigh-ins.', slope === 0 ? 'Trend: level.' : 'Trend: ' + (slope < 0 ? 'down ' : 'up ') + a.n + ' ' + a.u + ' a week.'];
    }
    var shown = all.slice(-40), d = r1(shown[shown.length - 1].lb - shown[0].lb), c = wParts(Math.abs(d), 1);
    return [n + ' weigh-ins.', (d === 0 ? 'Level' : (d < 0 ? 'Down ' : 'Up ') + c.n + ' ' + c.u) + ' since ' + md(shown[0].at) + '.'];
  }
  function weight(doseFirst){
    var all = readings(), n = all.length, lb = n ? all[n - 1].lb : 0;
    var setup = !n ? safe(function(){ return lastWeightLb(); }, 0) : 0;       /* the weight given at setup, when there is no weigh-in */
    var P = (n || setup > 0) ? wParts(n ? lb : setup, 1) : null, line = weightLine(all);
    var btn = doseFirst
      ? '<button type="button" class="c3-btn-quiet pg-weigh" data-sheet="weigh" data-key="weigh">' + h.icon('plus', 17, 3) + '<span>Weigh in</span></button>'
      : '<button type="button" class="c3-btn-primary pg-go pg-weigh" data-sheet="weigh" data-key="weigh"><span>Weigh in</span>' + h.icon('plus', 34, 3) + '</button>';
    return '<section class="pg-weight" aria-label="Weight">' +
      '<div class="pg-w-top"><div class="pg-sec"><i></i>Weight' + (n
          /* the last weigh-in can be corrected or removed: the same ADJUST control as water and steps */
          ? '<button type="button" class="when pg-w-adj" data-adjust="weight" data-key="adj-weight" aria-label="Weigh-in of ' + esc(md(all[n - 1].at)) + ': ' + esc(P.n + ' ' + P.u) + '. Adjust">' + esc(md(all[n - 1].at)) + h.adjustHintHTML() + '</button>'
          : (P ? '<span class="when">from setup</span>' : '')) + '</div>' +
        (P ? '<div data-go="body" role="button" tabindex="0" aria-label="Open body and weight details" class="pg-w-num l' + Math.min(7, P.n.length) + '"><b>' + esc(P.n) + '</b><span>' + esc(P.u) + '</span></div>' : '<div class="pg-w-num none"><b>No weight yet</b></div>') + '</div>' +
      /* v370 (Chad, 28 Oct: one button flow app wide): Weigh in, the screen's one big button, sits under the number it
         changes, not under the chart at the foot of the page */
      '<div class="pg-w-act">' + btn + '</div>' +
      chart(all) +
      '<p class="pg-chart-key" role="button" tabindex="0" data-go="body">Green dots = recorded weigh-ins in ' + esc(fmt.unit()) + '. The line joins those readings; empty rings are waiting for a reading.</p>' +
      (n ? '<details class="pg-readings"><summary>View ' + (Math.min(n, 40) === 1 ? 'the plotted weigh-in' : 'the ' + Math.min(n, 40) + ' plotted weigh-ins') + '</summary><ol>' + all.slice(-40).map(function(w){ return '<li><time datetime="' + new Date(w.at).toISOString() + '">' + esc(new Date(w.at).toLocaleString('en-US', {month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'})) + '</time><b>' + esc(fmt.weight(w.lb, 1)) + '</b></li>'; }).join('') + '</ol></details>' : '') +
      '<div class="pg-w-foot"><p class="pg-w-line" aria-live="polite">' + esc(line[0]) + '<br>' + esc(line[1]) + '</p></div>' +
    '</section>';
  }

  /* the last weigh-in, in ADJUST: through the app's own weighEdit / weighDelete (the functions its
     calendar uses; they save and leave the tombstone a sync needs), each with the app's Undo */
  if(h.adjustKinds) h.adjustKinds.weight = function(){
    var all = readings(), n = all.length; if(!n) return null;
    var w = all[n - 1], at = w.at, lb0 = w.lb;
    var U = fmt.unit(), toU = function(lb){ return r1(safe(function(){ return wNum(lb, 1); }, lb)); }, toLb = function(v){ return safe(function(){ return wIn(v); }, v); };
    var redraw = function(){ try{ useProtocol(ALL.activeId); syncBodyInputs(); }catch(e){} drawAll(); };
    return {
      id:'weight', title:'Weigh-in, ' + md(at), tone:'weight', live:false, step:0.1, min:toU(50), max:toU(900),
      round:r1,
      read:function(){ return toU(lb0); },
      apply:function(v){
        weighEdit(at, {lb: toLb(v)}); redraw();
        offerUndo('Weigh-in set to <b>' + esc(fmt.weight(toLb(v), 1)) + '</b>.', function(){ weighEdit(at, {lb: lb0}); try{ useProtocol(ALL.activeId); syncBodyInputs(); }catch(e){} });
      },
      show:function(v){ return v.toFixed(1); }, unit:U,
      sub:function(v){ return v === toU(lb0) ? 'as logged' : 'was ' + toU(lb0).toFixed(1) + ' ' + U; },
      lessSay:'0.1 ' + U + ' less', moreSay:'0.1 ' + U + ' more',
      quick:[{add:-1, label:'− 1'}, {add:-0.5, label:'− 0.5'}, {add:0.5, label:'+ 0.5'}, {add:1, label:'+ 1'}],
      note:'Check the value and unit, then tap Done to save. Close cancels your edit.', setLabel:'Set weight', decimal:true, entryUnit:U, entry:function(v){ return v.toFixed(1); }, hint:'A weight, like ' + toU(lb0).toFixed(1),
      parse:function(t){
        var m = /^(\d+(?:[.,]\d+)?)\s*(lb|lbs|kg)?$/i.exec(String(t).trim()); if(!m) return null;
        var x = parseFloat(m[1].replace(',', '.')), suffix = (m[2] || '').toLowerCase();
        /* Explicit units must be converted, never silently read as the account's unit. */
        if(suffix) x = toU(suffix === 'kg' ? x * 2.2046226218487757 : x);
        x = r1(x);
        return Number.isFinite(x) && x >= toU(50) && x <= toU(900) ? x : null;
      },
      remove:{label:'Remove', run:function(){
        var gone = weighDelete(at); if(!gone) return;
        redraw();
        offerUndo('Removed the weigh-in of <b>' + esc(fmt.weight(gone.lb, 1)) + '</b>.', function(){
          ALL.weights.push(gone); ALL.weights.sort(function(a, b){ return a.at - b.at; });
          if(ALL.tomb && ALL.tomb.weights) delete ALL.tomb.weights[String(gone.at)];
          try{ useProtocol(ALL.activeId); syncBodyInputs(); }catch(e){}
        });
      }}
    };
  };

  /* ---------- records ---------- */
  function records(){
    var n = safe(function(){ return Object.keys(ALL.prs || {}).length; }, 0);
    var feed = (safe(function(){ return (ALL.prFeed || []).slice(); }, []) || []).filter(function(e){ return e && e.n; })
      .sort(function(a, b){ return (b.at || 0) - (a.at || 0); }).slice(0, 3);
    var list = feed.length
      ? '<ol class="pg-r-list">' + feed.map(function(e){
          return '<li><span class="nm">' + esc(e.n) + '</span><span class="v">' + esc(fmt.load({load:{type:'lb', value:+e.lb}}) || '') + ' × ' + esc(e.reps) + '</span><span class="d">' + esc(md(e.at)) + '</span></li>';
        }).join('') + '</ol>'
      : '<p class="pg-r-none">No records yet. Log a workout with sets to start your record history.</p>';
    return '<section class="pg-rec" data-go="history" role="button" tabindex="0" aria-label="Personal bests, open workout records">' +
      '<div class="pg-r-top"><div class="pg-sec amber"><i></i>Personal bests</div>' +
        '<div class="pg-r-num"><b>' + n + '</b><span>' + (n === 1 ? 'Record' : 'Records') + '</span></div>' + list + '</div>' +
      '<div class="pg-r-pic">' + h.pictureHTML('train-heavy') + '</div>' +
      '<div class="pg-r-coach">' + h.coachLineHTML('progress') + '</div>' +
    '</section>';
  }

  function wins(){ return safe(function(){ return C3.wins ? C3.wins.sectionHTML() : ''; }, ''); }

  /* ---------- the research lane: its own section, no coach, no face, no picture ---------- */
  function gauge(pct){
    var f = clamp01(pct / 100), len = Math.PI * 130, a = Math.PI * (1 - f);
    var dx = Math.round((160 + 130 * Math.cos(a)) * 10) / 10, dy = Math.round((152 - 130 * Math.sin(a)) * 10) / 10;
    var arc = function(r){ return 'M ' + (160 - r) + ' 152 A ' + r + ' ' + r + ' 0 0 1 ' + (160 + r) + ' 152'; };
    return '<div class="pg-gauge" data-go="levels" role="button" tabindex="0" aria-label="Open level details"><svg viewBox="0 0 320 170" role="img" aria-label="Level meter at ' + pct + ' percent of steady-state peak" focusable="false">' +
      '<path d="' + arc(130) + '" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="28" stroke-linecap="round"></path>' +
      '<path d="' + arc(130) + '" fill="none" stroke="#FF4FCB" stroke-opacity=".2" stroke-width="28" stroke-linecap="round"></path>' +
      '<path d="' + arc(146) + '" fill="none" stroke="#FF4FCB" stroke-opacity=".8" stroke-width="1.5" stroke-linecap="round"></path>' +
      '<path d="' + arc(114) + '" fill="none" stroke="#FF4FCB" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"></path>' +
      (f > 0 ? '<path d="' + arc(130) + '" fill="none" stroke="#FF4FCB" stroke-width="28" stroke-linecap="round" stroke-dasharray="' + (Math.round(f * len * 10) / 10) + ' 2000" style="filter:drop-shadow(0 0 9px #FF4FCB)"></path>' : '') +
      '<circle cx="' + dx + '" cy="' + dy + '" r="5" fill="var(--ink, #182136)"></circle></svg>' +
      '<div class="mid"><b>' + pct + '%</b><span>of steady-state peak</span></div>' +
      '<div class="ends" aria-hidden="true"><span>0</span><span>Peak</span></div></div>';
  }
  function peptide(P, K){
    if(!P) return '';
    var t = P.truth || {}, due = t.state === 'due' || t.state === 'late', n = K.R.doses | 0;
    var panes = safe(function(){ return (GROUPS.peptides || []).slice(); }, []) || [];
    var links = panes.map(function(x){
      var lk = locked(x[0]);
      return '<button type="button" class="pg-link" data-deep="peptides:' + esc(x[0]) + '" data-key="pep-' + esc(x[0]) + '"' + (lk ? ' data-locked="1" aria-label="' + esc(x[1]) + ', needs Pro"' : '') + '><span>' + esc(x[1]) + '</span>' + (lk ? ico(IC.lock, 15, 2.2) : ico(IC.chev, 15, 2.4)) + '</button>';
    }).join('');
    var btn = due
      ? '<button type="button" class="c3-btn-primary pg-go pg-dose" data-sheet="dose" data-key="dose"><span>Log dose</span>' + h.icon('plus', 34, 3) + '</button>'
      : '<button type="button" class="c3-btn-quiet pink pg-dose" data-sheet="dose" data-key="dose">' + h.icon('plus', 17, 3) + '<span>Log dose</span></button>';
    return '<section class="pg-pep" aria-label="Research log">' +
      '<div class="pg-sec pink pg-p-name"><i></i><span>' + esc(P.name) + ' ' + esc(P.mgTxt) + ' mg · ' + esc(P.everyTxt) + '</span></div>' +
      /* the level is one of the app's Pro readings: when the app gates Levels, so does this */
      (locked('levels')
        ? '<button type="button" class="pg-p-locked" data-deep="peptides:levels" data-key="lv-lock" aria-label="Level meter, needs Pro">' + ico(IC.lock, 22, 2.2) + '<span><b>Level meter</b><small>Part of Pro</small></span></button>'
        : gauge(P.pct) +
          '<div class="pg-p-flat" data-go="levels" role="button" tabindex="0" aria-label="Open level details"><b>' + P.pct + '%</b><span>of steady-state peak</span><span class="c3-meter" role="img" aria-label="' + P.pct + ' percent of steady-state peak"><i style="width:' + Math.min(100, P.pct) + '%"></i></span></div>') +
      '<div class="pg-p-next"><b>' + esc(t.word || 'No dose scheduled') + '</b>' + (t.sub ? '<span class="s">' + esc(t.sub) + '</span>' : '') +
        '<span class="pg-p-wk"><b>' + n + '</b> ' + (n === 1 ? 'dose' : 'doses') + ' logged this week</span></div>' +
      '<div class="pg-p-act">' + btn + '</div>' +
      '<div class="pg-p-doses"><button type="button" class="c3-btn-quiet pg-doses" data-go="doses" data-params=\'{"from":"progress"}\' data-key="pg-doses">' + ico(IC.chev, 16, 2.6) + '<span>Your doses</span></button></div>' +
      '<nav class="pg-p-links" aria-label="Research screens">' + links + '</nav>' +
    '</section>';
  }

  /* ---------- the old deep screens ---------- */
  function deepLinks(){
    var panes = safe(function(){ return (GROUPS.progress || []).slice(); }, []) || [];
    if(!panes.length) return '';
    return '<nav class="pg-links" aria-label="More of your progress">' + panes.map(function(x){
      var lk = locked(x[0]);
      return '<button type="button" class="pg-link" data-deep="progress:' + esc(x[0]) + '" data-key="go-' + esc(x[0]) + '"' + (lk ? ' data-locked="1" aria-label="' + esc(x[1]) + ', needs Pro"' : '') + '><span>' + esc(x[1]) + '</span>' + (lk ? ico(IC.lock, 16, 2.2) : ico(IC.chev, 16, 2.4)) + '</button>';
    }).join('') + '</nav>';
  }

  C3.screen('progress', {
    nav: 'progress',
    wire: function(root){
      root.querySelectorAll('.pg [role="button"][tabindex="0"]').forEach(function(el){
        el.onkeydown=function(e){ if(e.target!==el) return; if(e.key==='Enter'||e.key===' '){e.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true}));} };
      });
    },
    render: function(){
      var K = weeks(), P = h.peptide();
      var due = !!(P && P.truth && (P.truth.state === 'due' || P.truth.state === 'late'));
      return '<div class="pg' + (P ? ' has-pep' : '') + (due ? ' due' : '') + '">' +
        /* v370: the week in words, then weight with Weigh in (the one big button), then the body map (v358) and the rest */
        thisWeek(K) + weeklyReadout(K) + '<div class="pg-body">' + weight(due) + versus(K) + records() + wins() + '</div>' +
        (h.bodyMap ? h.bodyMap({from: 'progress', cls: 'pg-bm'}) : '') +
        peptide(P, K) + deepLinks() +
      '</div>';
    }
  });
})();
