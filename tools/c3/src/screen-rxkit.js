/* C3 kit: the research side's three new views (v329), drawn inside the dose tracker:
     Effects   today's check-in on the markers the person tracks (scales 1 to 5 in one tap each, side effects as a chip
               and how bad), the 57 markers to pick from plus their own, and Patterns read from their own log
     Labs      every marker from their lab results, the latest value against the range on their own report, the
               trend as a line, results added by hand or pasted from a report (the app's parseLabText), on the
               same days as their doses
     Timeline  one axis: each protocol's doses, the level, weight, the markers, side effects, labs and photos;
               a day tapped opens everything on it
   Engine: the app's v329mk script (rxMk*, rxPatterns, rxTimeline, rxDayAll) and its lab log (labPanels, labSave).
   Nothing here is advice; no coach on any of it. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var DAYMS = 864e5;
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  function esc(t){ return C3.h.esc(t); }
  function yd(){ return C3.yd; }
  function today(){ return safe(function(){ return dkey(Date.now()); }, ''); }
  function day(at, o){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', o || {weekday: 'short', month: 'short', day: 'numeric'}); }, ''); }
  function tm(at){ return safe(function(){ return new Date(at).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}); }, ''); }
  function n1(v){ return String(Math.round(v * 10) / 10); }
  var SEV = [[1, 'Slight'], [2, 'Noticeable'], [3, 'Rough'], [4, 'Severe']];
  var SC = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']];
  function width(){ return C3.lv ? C3.lv.width() : 360; }

  /* ---------- Effects ---------- */
  function cycleBars(p){
    var max = Math.max.apply(null, p.rows.map(function(r){ return r.v; }).concat([p.m.t === 'sc' ? 5 : 4]));
    return '<div class="rx-cyc" role="img" aria-label="' + esc(p.text) + '">' + p.rows.map(function(r){
      var f = r.v / max, hi = r === p.hi, lo = r === p.lo, goodHigh = p.m.t === 'sc' && !p.m.inv;   /* energy high is good; nausea high is not */
      return '<span class="' + (hi ? (goodHigh ? 'lo' : 'hi') : lo ? (goodHigh ? 'hi' : 'lo') : '') + '"><b class="c3-num">' + n1(r.v) + '</b><i><em style="height:' + Math.max(4, Math.round(f * 100)) + '%"></em></i><small>' + (r.d === 0 ? 'day of' : 'day ' + r.d) + '</small></span>';
    }).join('') + '</div>';
  }
  /* v330: the training week lines up with their low days (the training screens say only "a low day in your week") */
  function alignHTML(){
    var Y = yd(), L = safe(function(){ return typeof rxLowDays === 'function' ? rxLowDays() : null; }, null), on = safe(function(){ return trainCfg().alignDose !== false; }, true);
    var DW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], dows = L ? (safe(function(){ return rxLowDows(); }, []) || []) : [];
    var words = L ? 'Your low days: ' + L.offs.map(function(o){ return o === 0 ? 'the day of a dose' : o === 1 ? 'the day after' : o + ' days after'; }).join(' and ') + ' of ' + pdName(L.p) + ' (' + L.offs.map(function(o, i){ return L.why[i] === 'energy' ? 'your energy runs low' : 'your stomach runs rough'; }).filter(function(x, i, a){ return a.indexOf(x) === i; }).join(', ') + ').' +
        (dows.length ? ' This week: ' + dows.map(function(d){ return DW[d]; }).join(', ') + '.' : '') : 'Three weeks of check-ins and doses, and the days after a dose when your energy runs low show here.';
    return '<div class="rx-align"><p class="t">' + esc(words) + '</p>' + (L ? Y.sw('rxalign', on, 'Training goes 20% lighter on those days', 'Same lifts, fewer sets. Full session is one tap on the day.') : '') + '</div>';
  }
  function patternsHTML(){
    var Y = yd(), list = safe(function(){ return rxPatterns(); }, []) || [];
    if(!list.length) return Y.empty('Check in on a few days, and log your doses, and what moves for you shows here: through the days after a dose, with your level, week against week.');
    return '<ul class="rx-pats">' + list.slice(0, 8).map(function(p){
      var vis = p.kind === 'cycle' ? cycleBars(p) : p.kind === 'level' ? '<p class="rx-r"><b class="c3-num">' + (p.r > 0 ? '+' : '') + (Math.round(p.r * 100) / 100) + '</b><span>with the level</span></p>'
        : p.kind === 'week' ? '<p class="rx-wk ' + (p.good ? 'good' : 'bad') + '"><b class="c3-num">' + n1(p.before) + '</b><span>' + (p.now > p.before ? '↑' : '↓') + '</span><b class="c3-num">' + n1(p.now) + '</b><small>four weeks before, this week</small></p>'
        : p.kind === 'steps' ? '<p class="rx-wk">' + p.B.rows.map(function(r){ return '<span><b class="c3-num">' + n1(r.rate) + '</b><small>' + esc(safe(function(){ return pdAmt(p.B.p, r.mg); }, r.mg + ' mg')) + '</small></span>'; }).join('') + '</p>' : '';
      return '<li>' + vis + '<p class="t">' + esc(p.text) + '</p><p class="nn">' + p.n + ' days of your log' + (p.kind === 'level' ? '' : '') + '</p></li>';
    }).join('') + '</ul>' + Y.note('From your own log: what happened to you, not a cause, and not advice.');
  }
  function checkinHTML(st){
    var Y = yd(), d = today(), T = safe(function(){ return rxTracked(); }, []) || [];
    var scales = T.filter(function(m){ return m.t === 'sc'; }), sx = T.filter(function(m){ return m.t === 'sx'; });
    var app = safe(function(){ return appToday(); }, null), logged = safe(function(){ return rxSxDay(d); }, []) || [];
    var h = scales.map(function(m){ var v = safe(function(){ return rxScaleGet(m.k, d); }, null);
      return '<div class="rx-sc"><p class="pd-q">' + esc(m.n) + (m.inv ? ' <small>(1 is least)</small>' : '') + '</p>' + Y.scale('rxsc', SC, v, {aria: m.n + ' today, 1 to 5', k: m.k, extra: 'data-mk="' + esc(m.k) + '"'}) + '</div>'; }).join('');
    h += '<div class="rx-sc"><p class="pd-q">Appetite</p>' + Y.scale('papp', [[1, 'None'], [2, ''], [3, ''], [4, 'Normal'], [5, ''], [6, ''], [7, 'All day']], app ? app.v : null, {aria: 'Appetite today, 1 to 7', under: true, k: 'app'}) + '</div>';
    if(sx.length){
      h += '<p class="pd-q">Side effects today</p><div class="pd-chips" role="group" aria-label="Side effect">' + sx.map(function(m){ var on = st.fxk === m.k, n = logged.filter(function(s){ var x = rxMkByName(s.kind); return x && x.k === m.k; }).length;
        return '<button type="button" class="yd-opt' + (on ? ' on' : '') + (n ? ' had' : '') + '" data-act="rxfx" data-v="' + esc(m.k) + '" data-key="rxfx-' + esc(m.k) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(m.n) + (n ? ' · ' + n : '') + '</button>'; }).join('') + '</div>';
      if(st.fxk){ var mk = safe(function(){ return rxMk(st.fxk); }, null); if(mk) h += '<p class="pd-q">' + esc(mk.n) + ', how bad</p>' + Y.scale('rxsev', SEV, null, {aria: mk.n + ', how bad', under: true, k: 'sev'}); }
    }
    if(logged.length) h += '<ul class="pd-fxday">' + logged.map(function(s){ return '<li><b>' + esc(s.kind || 'Side effect') + '</b><span class="c3-num">' + (s.sev | 0) + '</span><small>' + esc(tm(s.at)) + '</small></li>'; }).join('') + '</ul>';
    h += '<div class="yd-acts">' + Y.btn('rxpick', st.mkpick ? 'Done picking' : 'Track more (' + (safe(function(){ return rxMkAll().length; }, 57)) + ')', {icon: st.mkpick ? 'check' : 'plus'}) + '</div>';
    if(st.mkpick) h += pickerHTML(st);
    return Y.sec('Today', h, {id: 'today'});
  }
  function pickerHTML(st){
    var Y = yd(), on = (safe(function(){ return rxTracked(); }, []) || []).map(function(m){ return m.k; }), all = safe(function(){ return rxMkAll(); }, []) || [];
    var groups = {}; all.forEach(function(m){ (groups[m.g] = groups[m.g] || []).push(m); });
    return '<div class="rx-pick">' + Object.keys(groups).map(function(g){ return '<p class="rx-g">' + esc(g) + '</p><div class="pd-chips">' + groups[g].map(function(m){ var o = on.indexOf(m.k) >= 0;
        return '<button type="button" class="yd-opt' + (o ? ' on' : '') + '" data-act="rxtrack" data-v="' + esc(m.k) + '" data-key="rxtrack-' + esc(m.k) + '" aria-pressed="' + (o ? 'true' : 'false') + '">' + esc(m.n) + '</button>'; }).join('') + '</div>'; }).join('') +
      '<p class="rx-g">Your own</p><div class="pd-two">' + Y.input('rxown', st.ownmk || '', 'Name it', {ph: 'Hand tremor', max: 32}) + Y.seg('rxownt', [['sc', '1 to 5'], ['sx', 'Side effect']], st.ownt || 'sc', {aria: 'Kind', cls: 'pd-seg fill'}) + '</div>' +
      '<div class="yd-acts">' + Y.btn('rxownok', 'Add it', {icon: 'plus'}) + '</div></div>';
  }

  /* ---------- Labs ---------- */
  function spark(series, R){
    var W = 120, H = 30; if(series.length < 2) return '';
    var vs = series.map(function(x){ return x.v; }), lo = Math.min.apply(null, vs.concat(R && R.lo != null ? [R.lo] : [])), hi = Math.max.apply(null, vs.concat(R && R.hi != null ? [R.hi] : []));
    if(hi === lo){ hi += 1; lo -= 1; }
    var X = function(i){ return 2 + i / (series.length - 1) * (W - 4); }, Y = function(v){ return H - 3 - (v - lo) / (hi - lo) * (H - 6); };
    var band = R && R.lo != null && R.hi != null ? '<rect x="0" y="' + Y(R.hi).toFixed(1) + '" width="' + W + '" height="' + Math.max(1, Y(R.lo) - Y(R.hi)).toFixed(1) + '" class="bd"></rect>' : '';
    return '<svg class="rx-spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + band + '<polyline points="' + series.map(function(x, i){ return X(i).toFixed(1) + ',' + Y(x.v).toFixed(1); }).join(' ') + '"></polyline><circle cx="' + X(series.length - 1).toFixed(1) + '" cy="' + Y(vs[vs.length - 1]).toFixed(1) + '" r="3"></circle></svg>';
  }
  function labsHTML(ctx){
    var Y = yd(), st = ctx.state, P = safe(function(){ return labPanels(); }, []) || [];
    var ids = {}; P.forEach(function(p){ Object.keys(p.r || {}).forEach(function(id){ ids[id] = 1; }); });
    var rows = Object.keys(ids).map(function(id){ var m = safe(function(){ return LAB_BY[id]; }, null); if(!m) return null; var S = safe(function(){ return labSeries(id); }, []) || []; if(!S.length) return null; var last = S[S.length - 1], R = safe(function(){ return labRange(m, last); }, {}), f = safe(function(){ return labFlag(last.v, R); }, 'na');
      return {id: id, m: m, S: S, last: last, R: R, f: f, prev: S.length > 1 ? S[S.length - 2] : null}; }).filter(Boolean);
    rows.sort(function(a, b){ var o = {high: 0, low: 0, ok: 1, na: 2}; return (o[a.f] - o[b.f]) || (safe(function(){ return LAB_PANELS.indexOf(a.m.p) - LAB_PANELS.indexOf(b.m.p); }, 0)); });
    var latest = P[0], out = latest ? Object.keys(latest.r || {}).filter(function(id){ var m = safe(function(){ return LAB_BY[id]; }, null); if(!m) return false; var R = safe(function(){ return labRange(m, latest.r[id]); }, {}); var f = safe(function(){ return labFlag(latest.r[id].v, R); }, 'na'); return f === 'high' || f === 'low'; }).length : 0;
    var top = Y.stats([[String(P.length), P.length === 1 ? 'lab report' : 'lab reports'], [latest ? day(latest.at, {month: 'short', day: 'numeric', year: 'numeric'}) : '·', 'latest'], [String(rows.length), 'markers'], [String(out), 'outside the range on the latest', out ? 'warn' : 'good']], 'pd-top');
    var list = rows.length ? '<ul class="rx-labs">' + rows.map(function(r){
      var ch = r.prev ? r.last.v - r.prev.v : null, rg = r.R && (r.R.lo != null || r.R.hi != null) ? (r.R.lo != null ? r.R.lo : '') + ' to ' + (r.R.hi != null ? r.R.hi : '') : '';
      return '<li class="' + r.f + '"><span class="n"><b>' + esc(r.m.n) + '</b><small>' + esc((rg ? 'range ' + rg + (r.R.own ? ' (your report)' : '') : 'no range') + ' · ' + day(r.last.at, {month: 'short', day: 'numeric', year: 'numeric'})) + '</small></span>' +
        spark(r.S.map(function(x){ return {v: x.v}; }), r.R) + '<span class="v"><b class="c3-num">' + esc(String(r.last.v)) + '</b><small>' + esc(r.last.u || r.m.u || '') + (ch != null && ch !== 0 ? ' · ' + (ch > 0 ? '+' : '') + n1(ch) : '') + '</small>' + (r.f === 'high' || r.f === 'low' ? '<em>' + r.f + '</em>' : '') + '</span></li>';
    }).join('') + '</ul>' : Y.empty('Add a lab result by hand or paste a report, and every marker shows here against its range, with its trend.');
    var opts = [['', 'Pick a marker']].concat((safe(function(){ return LABS; }, []) || []).map(function(m){ return [m.id, m.n + ' (' + m.u + ')']; }));
    var f = st.lab || {}, add = '<div class="rx-add">' + Y.input('rxlab', f.date || today(), 'Drawn on', {type: 'date', k: 'date', extra: 'data-f="date"'}) + Y.select('rxlabm', opts, f.id || '', 'Marker') +
      '<div class="pd-two">' + Y.input('rxlab', f.v || '', 'Result', {type: 'number', mode: 'decimal', step: 'any', k: 'v', extra: 'data-f="v"', ph: 'From the report'}) + Y.input('rxlab', f.u || '', 'Unit', {k: 'u', extra: 'data-f="u"', ph: f.id ? safe(function(){ return LAB_BY[f.id].u; }, '') : ''}) + '</div>' +
      '<div class="pd-two">' + Y.input('rxlab', f.lo || '', 'Range low (your report)', {type: 'number', mode: 'decimal', step: 'any', k: 'lo', extra: 'data-f="lo"', ph: 'Optional'}) + Y.input('rxlab', f.hi || '', 'Range high', {type: 'number', mode: 'decimal', step: 'any', k: 'hi', extra: 'data-f="hi"', ph: 'Optional'}) + '</div>' +
      '<div class="yd-acts">' + Y.btn('rxlabok', 'Add the result', {icon: 'plus'}) + '</div></div>';
    var paste = '<div class="rx-add"><label class="yd-field"><span class="k">Paste the report’s text</span><textarea class="yd-in rx-ta" data-key="rxpaste" rows="5" placeholder="Copy the results from the lab’s site or PDF and paste them here">' + esc(st.paste || '') + '</textarea></label>' +
      '<div class="yd-acts">' + Y.btn('rxread', 'Read it', {icon: 'chev'}) + '</div>' + (st.parsed ? parsedHTML(st.parsed) : '') + '</div>';
    return top + '<div class="yd-cols"><div class="yd-col">' + Y.sec('Your markers', list, {id: 'labs'}) + '</div><div class="yd-col">' + Y.sec('Add a result', add, {id: 'add'}) + Y.sec('Or paste a report', paste, {id: 'paste'}) +
      Y.note('The range printed on your own report wins over the built-in one. Results are on the Timeline beside your doses.') + '</div></div>';
  }
  function parsedHTML(p){
    var Y = yd();
    if(!p.rows || !p.rows.length) return Y.empty('No markers found in that text.' + (p.unknown && p.unknown.length ? ' Lines not recognized: ' + p.unknown.slice(0, 3).map(function(u){ return u.label || ''; }).join(', ') + '.' : ''));
    return '<ul class="pd-facts">' + p.rows.map(function(r){ var m = safe(function(){ return LAB_BY[r.id]; }, {n: r.id}); return '<li><b>' + esc(m.n) + '</b>: <b class="c3-num">' + esc(String(r.v)) + '</b> ' + esc(r.u || m.u || '') + (r.lo != null || r.hi != null ? ' (range ' + (r.lo != null ? r.lo : '') + ' to ' + (r.hi != null ? r.hi : '') + ')' : '') + '</li>'; }).join('') + '</ul>' +
      '<p class="pd-q">' + p.rows.length + ' markers' + (p.at ? ', drawn ' + esc(day(p.at, {month: 'short', day: 'numeric', year: 'numeric'})) : '') + '</p><div class="yd-acts">' + Y.btn('rxsave', 'Save these ' + p.rows.length, {icon: 'check'}) + '</div>';
  }

  /* ---------- Timeline ---------- */
  var PH = {list: null, busy: false};
  function photos(){
    if(PH.list || PH.busy) return PH.list || [];
    PH.busy = true;
    safe(function(){ return PHOTOS.all(); }, Promise.resolve([])).then(function(r){ PH.list = (r || []).map(function(x){ return {id: x.id, at: x.at, blob: x.blob}; }); PH.busy = false; if(C3.current === 'doses') C3.refresh(); }, function(){ PH.list = []; PH.busy = false; });
    return [];
  }
  function timelineHTML(ctx){
    var Y = yd(), st = ctx.state, wk = +(st.tlr || 12), now = Date.now(), from = now - wk * 7 * DAYMS, to = now + 2 * DAYMS;
    var T = safe(function(){ return rxTimeline(from, to); }, null); if(!T) return Y.empty('Nothing to draw.');
    var ph = photos().filter(function(p){ return p.at >= from && p.at <= to; });
    var W = width(), L = 0, R = W, X = function(t){ return L + (t - from) / (to - from) * (R - L); };
    var y = 0, s = '', lane = function(h, label){ var top = y; s += '<text x="0" y="' + (top + 12) + '" class="ll">' + esc(label) + '</text>'; y += h; return top + 16; };
    /* doses, a lane each */
    var cols = ['#5CF2B0', '#FF4FCB', '#FFB85C', '#FFFFFF', '#C79BFF', '#FF8A5C'];
    T.protocols.forEach(function(p, i){ var y0 = lane(34, p.name + (p.doses.length ? ' · ' + p.doses.length : '')); p.doses.forEach(function(d){ s += '<rect x="' + (X(d.at) - 1.5).toFixed(1) + '" y="' + y0 + '" width="3" height="14" rx="1.5" fill="' + cols[i % cols.length] + '"></rect>'; }); });
    /* the level */
    var LV = safe(function(){ return rxLevels({from: from, to: to, n: Math.min(400, W)}); }, {lines: []});
    if(LV.lines.length){ var y1 = lane(66, 'Level'); LV.lines.forEach(function(l){ var mx = Math.max(100, l.peakPct); s += '<polyline points="' + l.pts.map(function(p){ return X(p[0]).toFixed(1) + ',' + (y1 + 46 - p[1] / mx * 44).toFixed(1); }).join(' ') + '" fill="none" stroke="' + l.color + '" stroke-width="2" opacity=".9"></polyline>'; }); }
    /* weight */
    if(T.weights.length >= 2){ var y2 = lane(60, 'Weight'), ws = T.weights.map(function(w){ return w.lb; }), lo = Math.min.apply(null, ws), hi = Math.max.apply(null, ws); if(hi === lo){ hi += 1; lo -= 1; }
      s += '<polyline points="' + T.weights.map(function(w){ return X(w.at).toFixed(1) + ',' + (y2 + 40 - (w.lb - lo) / (hi - lo) * 38).toFixed(1); }).join(' ') + '" fill="none" stroke="#FFFFFF" stroke-width="2"></polyline>' +
        '<text x="' + (R - 2) + '" y="' + (y2 - 2) + '" class="lr">' + esc(String(Math.round(T.weights[T.weights.length - 1].lb * 10) / 10)) + ' lb</text>'; }
    /* each tracked scale: a strip of days */
    Object.keys(T.scales).forEach(function(k){ var S = T.scales[k]; if(!S.length) return; var m = safe(function(){ return rxMk(k); }, {n: k}), y3 = lane(30, m.n), cw = Math.max(2, (R - L) / (wk * 7 + 2) - 1);
      S.forEach(function(x){ s += '<rect x="' + (X(x.at) - cw / 2).toFixed(1) + '" y="' + y3 + '" width="' + cw.toFixed(1) + '" height="10" rx="2" fill="#5CF2B0" opacity="' + (0.15 + (x.v - 1) / 4 * 0.85).toFixed(2) + '"></rect>'; }); });
    /* side effects */
    if(T.sx.length){ var y4 = lane(30, 'Side effects · ' + T.sx.length); T.sx.forEach(function(x){ s += '<circle cx="' + X(x.at).toFixed(1) + '" cy="' + (y4 + 5) + '" r="' + (2 + x.sev) + '" fill="#FF4FCB" opacity=".8"></circle>'; }); }
    /* labs and photos */
    if(T.labs.length){ var y5 = lane(30, 'Labs'); T.labs.forEach(function(x){ var c = X(x.at); s += '<path d="M ' + c.toFixed(1) + ' ' + y5 + ' l 6 6 l -6 6 l -6 -6 z" fill="#FFB85C"></path>'; }); }
    if(ph.length){ var y6 = lane(30, 'Photos · ' + ph.length); ph.forEach(function(x){ s += '<rect x="' + (X(x.at) - 5).toFixed(1) + '" y="' + y6 + '" width="10" height="8" rx="2" fill="none" stroke="#FFFFFF" stroke-width="1.6"></rect>'; }); }
    /* weeks and now */
    var gy = y; y += 22;
    for(var t = from; t <= to; t += 7 * DAYMS){ var gx = X(t).toFixed(1); s = '<path d="M ' + gx + ' 0 V ' + gy + '" class="gw"></path>' + s; }
    var lab = ''; var step = wk <= 4 ? 1 : wk <= 12 ? 2 : 4, lastX = -1e9;
    for(var i = 0; i <= wk; i += step){ var tt = from + i * 7 * DAYMS, xx = X(tt); if(xx - lastX < 64 || xx > R - 24 || xx < 24) continue; lastX = xx; lab += '<text x="' + xx.toFixed(1) + '" y="' + (gy + 16) + '" class="xl">' + esc(day(tt, {month: 'short', day: 'numeric'})) + '</text>'; }
    var xn = X(now).toFixed(1);
    s += '<path d="M ' + xn + ' 0 V ' + gy + '" class="now"></path>';
    if(st.tld){ var xd = X(new Date(st.tld + 'T12:00:00').getTime()).toFixed(1); s += '<path d="M ' + xd + ' 0 V ' + gy + '" class="sel"></path>'; }
    var svg = '<svg class="rx-tl" viewBox="0 0 ' + W + ' ' + y + '" width="' + W + '" height="' + y + '" data-from="' + from + '" data-to="' + to + '" role="img" aria-label="Your timeline, ' + wk + ' weeks: doses, level, weight, markers, side effects, labs and photos">' + s + lab + '<rect class="hit" x="0" y="0" width="' + W + '" height="' + gy + '" fill="transparent"></rect></svg>';
    var dayP = st.tld ? dayHTML(st.tld, ph) : '<p class="pd-tapz">Tap a day for everything on it.</p>';
    return Y.sec('One timeline', Y.seg('tlr', [['4', '4 wk'], ['12', '12 wk'], ['26', '26 wk']], String(wk), {aria: 'Range', cls: 'lv2-range'}) + '<div class="rx-tlw" data-w="' + W + '">' + svg + '</div>' + dayP, {id: 'timeline'});
  }
  function dayHTML(d, ph){
    var Y = yd(), A = safe(function(){ return rxDayAll(d); }, null); if(!A) return '';
    var rows = [];
    A.doses.forEach(function(x){ rows.push('<li><span class="c3-num">' + esc(tm(x.at)) + '</span><b>' + esc(x.name) + ' ' + esc(x.amt) + '</b><small>' + esc(x.site || '') + '</small></li>'); });
    A.sx.forEach(function(x){ rows.push('<li><span class="c3-num">' + esc(tm(x.at)) + '</span><b>' + esc(x.kind || 'Side effect') + '</b><small>' + esc((SEV[(x.sev | 0) - 1] || [0, ''])[1]) + '</small></li>'); });
    A.scales.forEach(function(x){ rows.push('<li><span class="c3-num">' + x.v + ' of 5</span><b>' + esc(x.n) + '</b><small></small></li>'); });
    if(A.app) rows.push('<li><span class="c3-num">' + A.app + ' of 7</span><b>Appetite</b><small></small></li>');
    if(A.weight) rows.push('<li><span class="c3-num">' + A.weight + ' lb</span><b>Weigh-in</b><small></small></li>');
    A.labs.forEach(function(p){ rows.push('<li><span class="c3-num">Labs</span><b>' + Object.keys(p.r || {}).length + ' markers</b><small>' + esc(p.lab || '') + '</small></li>'); });
    var pics = (ph || []).filter(function(p){ return dkey(p.at) === d; });
    var picH = pics.length ? '<div class="rx-pics">' + pics.map(function(p){ var u = safe(function(){ return PHOTOS.url(p.blob); }, ''); return u ? '<img src="' + esc(u) + '" alt="Progress photo, ' + esc(day(p.at)) + '" loading="lazy">' : ''; }).join('') + '</div>' : '';
    return '<div class="cx-panel rx-day"><p class="pd-zh"><b>' + esc(day(new Date(d + 'T12:00:00').getTime(), {weekday: 'long', month: 'short', day: 'numeric'})) + '</b></p>' + (rows.length ? '<ul class="cx-evs rx-dl">' + rows.join('') + '</ul>' : Y.empty('Nothing logged that day.')) + picH + '</div>';
  }

  /* ---------- actions ---------- */
  function acts(ctx){
    var st = ctx.state, Y = yd();
    return {
      rxsc: function(v, el){ var k = el.getAttribute('data-mk'); safe(function(){ rxScaleSet(k, +v); }); C3.refresh(); },
      rxfx: function(v){ st.fxk = st.fxk === v ? '' : v; C3.render(); },
      rxsev: function(v){ var k = st.fxk; if(!k) return; safe(function(){ rxSxLog(k, +v); }); st.fxk = ''; C3.refresh(); },
      rxpick: function(){ st.mkpick = !st.mkpick; C3.render(); },
      rxalign: function(v, el){ var on = el.getAttribute('aria-checked') !== 'true'; safe(function(){ rxAlignSet(on); }); Y.toast(on ? 'Training lines up with your low days.' : 'Training stays as planned.'); C3.refresh(); },
      rxtrack: function(v, el){ var on = el.getAttribute('aria-pressed') !== 'true'; if(safe(function(){ return rxTrack(v, on); }, false) === false) Y.toast('Track one at least.', 'bad'); C3.render(); },
      rxownt: function(v){ st.ownt = v; C3.render(); },
      rxownok: function(el){ var i = C3.root.querySelector('[data-key="in-rxown"]'); var r = safe(function(){ return rxAddMarker(i ? i.value : st.ownmk, st.ownt || 'sc'); }, {ok: false, why: 'Could not add it.'}); if(!r.ok){ Y.toast(r.why, 'bad'); return; } st.ownmk = ''; Y.toast('Tracking it from today.'); C3.render(); },
      rxlabok: function(){ var f = st.lab || {}; C3.root.querySelectorAll('[data-chg="rxlab"]').forEach(function(i){ f[i.getAttribute('data-f')] = i.value; });
        var m = safe(function(){ return LAB_BY[f.id]; }, null), v = parseFloat(f.v), mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.date || '');
        if(!m || !isFinite(v) || !mt){ Y.toast('A date, a marker and its result.', 'bad'); return; }
        var r = {}; r[f.id] = {v: v, u: f.u || m.u}; if(f.lo !== '' && f.lo != null && isFinite(+f.lo)) r[f.id].lo = +f.lo; if(f.hi !== '' && f.hi != null && isFinite(+f.hi)) r[f.id].hi = +f.hi;
        var at = new Date(+mt[1], +mt[2] - 1, +mt[3], 9).getTime(); safe(function(){ labSave({at: at, r: r}); });
        st.lab = {date: f.date}; Y.toast(m.n + ' added.'); C3.refresh(); },
      rxread: function(){ var ta = C3.root.querySelector('[data-key="rxpaste"]'); st.paste = ta ? ta.value : ''; st.parsed = safe(function(){ return parseLabText(st.paste); }, null) || {rows: []}; C3.render(); },
      rxsave: function(){ var p = st.parsed; if(!p || !p.rows || !p.rows.length) return; var r = {}; p.rows.forEach(function(x){ r[x.id] = {v: x.v, u: x.u, lo: x.lo, hi: x.hi}; });
        var res = safe(function(){ return labSave({at: p.at || Date.now(), lab: p.lab || null, r: r}); }, null); st.parsed = null; st.paste = ''; Y.toast(res ? (res.merged ? 'Added to the report from that day.' : p.rows.length + ' markers saved.') : 'Could not save.'); C3.refresh(); },
      tlr: function(v){ st.tlr = +v; st.tld = null; C3.render(); }
    };
  }
  function chgs(ctx){
    var st = ctx.state;
    return {
      rxown: function(v){ st.ownmk = v; },
      rxlab: function(v, el){ st.lab = st.lab || {}; st.lab[el.getAttribute('data-f')] = v; },
      rxlabm: function(v){ st.lab = st.lab || {}; st.lab.id = v; var m = safe(function(){ return LAB_BY[v]; }, null); if(m && !st.lab.u) st.lab.u = m.u; setTimeout(function(){ C3.render(); }, 0); }
    };
  }
  function wire(root, ctx){
    var st = ctx.state, svg = root.querySelector('.rx-tl');
    if(svg) svg.addEventListener('click', function(ev){
      var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, x = (ev.clientX - r.left) * vb.width / r.width;
      var from = +svg.getAttribute('data-from'), to = +svg.getAttribute('data-to'), t = from + x / vb.width * (to - from);
      st.tld = safe(function(){ return dkey(t); }, null); C3.render();
      setTimeout(function(){ var p = C3.root.querySelector('.rx-day'); if(p){ var b = p.getBoundingClientRect(); if(b.top > window.innerHeight * 0.7) p.scrollIntoView({block: 'nearest', behavior: 'smooth'}); } }, 60);
    });
  }
  function invalidatePhotos(){ PH.list = null; }
  C3.rx = {checkin: checkinHTML, patterns: patternsHTML, align: alignHTML, labs: labsHTML, timeline: timelineHTML, acts: acts, chgs: chgs, wire: wire, photosChanged: invalidatePhotos};
})();
