/* C3 screen: history (v320). Replaces the old History page (p-history: three boxes: a session list with six
   tiles and two dropdowns, a body map of weekly sets per muscle with three paragraphs of evidence per muscle, and
   a canvas chart of one lift).
   The numbers on top, the weeks as bars, the sessions as rows (each opens to its sets, the app's own table),
   the work per muscle as bars against the evidence band, and one lift's line. Everything is the app's own:
   sessionRows() (every session exactly as logged), sessionTable() (a session's sets), muscleSets() / volVerdict()
   / VOL_EV (weekly sets per muscle and the pooled band), loggedLifts() / liftSeries() (Epley from the logged set),
   ALL.prs. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var DAYMS = 864e5, RANGES = [[30, '30 days'], [90, '90 days'], [365, 'Year'], [0, 'All']];

    function weekStart(at){ var d = new Date(at); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()).getTime(); }
    function kLb(v){ var u = safe(function(){ return wU(); }, 'lb'), x = safe(function(){ return wNum(v, 0); }, v); return x >= 1e6 ? (Math.round(x / 1e4) / 100) + 'M' : x >= 1e3 ? Math.round(x / 1000) + 'k' : String(Math.round(x)); }
    function U(){ return safe(function(){ return wU(); }, 'lb'); }
    function W0(lb){ return safe(function(){ return Math.round(wNum(lb, 0)); }, Math.round(lb)); }

    function model(ctx){
      var all = safe(function(){ return sessionRows(); }, []) || [], days = ctx.state.days != null ? ctx.state.days : 90, focus = ctx.state.focus || '';
      var cut = days ? Date.now() - days * DAYMS : 0;
      var rows = all.filter(function(r){ return r.at >= cut && (!focus || r.focus === focus); });
      var prs = safe(function(){ return Object.values(ALL.prs || {}).filter(function(p){ return p.at >= cut; }).length; }, 0);
      var wks = {}; all.forEach(function(r){ wks[weekStart(r.at)] = 1; });
      var sw = Object.keys(wks).map(Number).sort(function(a, b){ return a - b; }), best = 0, run = 0;
      for(var i = 0; i < sw.length; i++){ run = (i && sw[i] - sw[i - 1] === 7 * DAYMS) ? run + 1 : 1; if(run > best) best = run; }
      return {all: all, rows: rows, days: days, focus: focus, prs: prs, streak: best,
        vol: rows.reduce(function(t, r){ return t + r.vol; }, 0), hard: rows.reduce(function(t, r){ return t + r.hard; }, 0), mins: rows.reduce(function(t, r){ return t + r.mins; }, 0),
        foci: all.map(function(r){ return r.focus; }).filter(Boolean).filter(function(v, i, a){ return a.indexOf(v) === i; }).sort()};
    }
    function weeksChart(all){
      var n = 12, now = weekStart(Date.now()), cols = [];
      for(var i = n - 1; i >= 0; i--){ var ws = now - i * 7 * DAYMS; cols.push({ws: ws, rows: all.filter(function(r){ return r.at >= ws && r.at < ws + 7 * DAYMS; })}); }
      var max = Math.max.apply(null, cols.map(function(c){ return c.rows.reduce(function(t, r){ return t + r.hard; }, 0); }).concat([1]));
      var VW = 640, VH = 190, L = 6, R = 634, T = 24, B = 150, gap = 10, bw = (R - L - gap * (n - 1)) / n;
      var FT = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;', FH = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:600;';   /* v365: chart words in the body face, no tracking */
      var s = '<svg class="hs-chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" focusable="false" aria-label="' + esc('Hard sets in each of the last twelve weeks: ' + cols.map(function(c){ return c.rows.reduce(function(t, r){ return t + r.hard; }, 0); }).join(', ')) + '">';
      s += '<path d="M ' + L + ' ' + B + ' H ' + R + '" stroke="rgba(207,209,213,0.468)" stroke-width="1.5" fill="none"></path>';
      cols.forEach(function(c, k){
        var hs = c.rows.reduce(function(t, r){ return t + r.hard; }, 0), x = L + k * (bw + gap), hh = hs ? Math.max(4, Math.round(hs / max * (B - T))) : 0, last = k === n - 1;
        if(hh) s += '<rect data-wk="' + k + '" x="' + x.toFixed(1) + '" y="' + (B - hh) + '" width="' + bw.toFixed(1) + '" height="' + hh + '" rx="4" fill="#5CF2B0" opacity="' + (last ? 1 : 0.7) + '"' + (last ? ' style="filter:drop-shadow(0 0 8px #5CF2B0)"' : '') + '></rect>' +
          '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (B - hh - 7) + '" text-anchor="middle" fill="#FFFFFF" style="' + FT + 'font-size:13px">' + hs + '</text>';
        else s += '<circle cx="' + (x + bw / 2).toFixed(1) + '" cy="' + (B - 4) + '" r="3" fill="rgba(237,238,239,0.383)"></circle>';
        if(k % 3 === 2 || last) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (B + 24) + '" text-anchor="middle" fill="' + (last ? '#FFFFFF' : '#EDEEEF') + '" style="' + FH + 'font-size:14px">' + esc(last ? 'This wk' : yd.day(c.ws)) + '</text>';
      });
      return s + '</svg>';
    }
    function sessionsSec(M, ctx){
      var open = ctx.state.open, list = M.rows.slice(0, ctx.state.more ? 400 : 12);
      var out = '<div class="hs-filt">' + yd.seg('range', RANGES.map(function(r){ return [r[0], r[1]]; }), M.days, {aria:'Show', cls:'hs-seg txt'}) +
        (M.foci.length ? yd.select('focus', [['', 'All sessions']].concat(M.foci.map(function(f){ return [f, f]; })), M.focus, 'Focus') : '') + '</div>';
      if(!M.rows.length) return yd.sec('Sessions', out + yd.empty(M.all.length ? 'Nothing in this window.' : 'No session logged yet. Every set you tick lands here for good.'), {id:'sessions'});
      out += '<ul class="hs-list">' + list.map(function(r){
        var isOpen = open === r.key;
        var pr = r.done.some(function(id){ var p = (ALL.prs || {})[id], a = r.sets[id]; return p && a && p.lb === a.lb && p.reps === a.reps; });
        var where = r.where && r.where.n ? safe(function(){ return whereLine(r); }, r.where.n) : r.focus;
        var body = '';
        if(isOpen){
          var tmp = document.createElement('div');
          tmp.innerHTML = safe(function(){ return sessionTable(r); }, '');
          body = '<div class="hs-body">' + yd.mirror(tmp).html + '</div>';
        }
        return '<li class="' + (isOpen ? 'open' : '') + (r.partial ? ' part' : '') + '"><button type="button" class="hs-row" data-act="open" data-v="' + esc(r.key) + '" data-key="s-' + esc(r.key) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
          '<span class="dt"><b class="c3-num">' + new Date(r.at).getDate() + '</b><small>' + esc(new Date(r.at).toLocaleDateString('en-US', {month:'short'})) + '</small></span>' +
          '<span class="nm"><b>' + esc(r.name) + '</b>' + (where ? '<small>' + esc(where) + '</small>' : '') + '</span>' +
          '<span class="mx"><b class="c3-num">' + (r.vol ? esc(kLb(r.vol)) + ' ' + esc(U()) : r.done.length + ' logged') + '</b><small class="c3-num">' + r.hard + ' sets · ' + r.mins + ' min</small></span>' +
          '<span class="pr">' + (pr ? 'PR' : '') + '</span>' + yd.icon(isOpen ? 'up' : 'chev', 16, 2.4) + '</button>' + body + '</li>';
      }).join('') + '</ul>' + (M.rows.length > 12 ? '<div class="yd-acts">' + yd.btn('more', ctx.state.more ? 'Fewer' : 'All ' + M.rows.length) + '</div>' : '');
      return yd.sec('Sessions', out, {id:'sessions', n: M.rows.length});
    }
    function musclesSec(ctx){
      var days = ctx.state.vdays || 7, data = safe(function(){ return muscleSets(days); }, null) || {}, wk = days / 7;
      var EV = safe(function(){ return VOL_EV; }, {min:4, solid:10, band:[11, 18], thin:25});
      var max = Math.max(EV.thin + 4, Math.max.apply(null, MUSCLES.map(function(m){ return (data[m] ? data[m].total : 0) / wk; })) + 2);
      var pct = function(x){ return Math.max(0, Math.min(100, x / max * 100)).toFixed(1); };
      var cls = {none:'', under:'warn', low:'warn', 'in':'good', high:'good', thin:'bad'};
      var any = MUSCLES.some(function(m){ return data[m] && data[m].total > 0; });
      var rows = MUSCLES.map(function(m){
        var d = data[m] || {total:0, direct:0, indirect:0, by:{}}, v = Math.round(d.total / wk * 10) / 10, vd = safe(function(){ return volVerdict(v); }, {k:'none', word:''});
        var isOpen = ctx.state.mopen === m;
        var by = Object.entries(d.by || {}).sort(function(a, b){ return b[1] - a[1]; }).slice(0, 5);
        return '<li class="' + (cls[vd.k] || '') + '"><button type="button" class="hs-mu" data-act="mu" data-v="' + esc(m) + '" data-key="mu-' + esc(m) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-label="' + esc(MUSCLE_LABEL[m] + ', ' + v + ' sets a week, ' + vd.word) + '">' +
          '<span class="n">' + esc(MUSCLE_LABEL[m] || m) + '</span>' +
          '<span class="bar"><i class="band" style="left:' + pct(EV.band[0]) + '%;width:' + (pct(EV.band[1]) - pct(EV.band[0])).toFixed(1) + '%"></i><i class="now" style="width:' + pct(v) + '%"></i></span>' +
          '<b class="c3-num">' + v + '</b></button>' +
          (isOpen ? '<div class="hs-mud"><p>' + esc(vd.word) + '. <span class="c3-num">' + (Math.round(d.direct / wk * 10) / 10) + '</span> direct, <span class="c3-num">' + (Math.round(d.indirect / wk * 10) / 10) + '</span> as a helper (half a set each).</p>' +
            (by.length ? '<ul>' + by.map(function(x){ return '<li><span>' + esc(x[0]) + '</span><b class="c3-num">' + (Math.round(x[1] / wk * 10) / 10) + '</b></li>'; }).join('') + '</ul>' : '') + '</div>' : '') + '</li>';
      }).join('');
      return yd.sec('Sets a week, per muscle',
        yd.seg('vdays', [[7, 'This week'], [14, '2 wk'], [28, '4 wk'], [56, '8 wk']], days, {aria:'Window', cls:'hs-seg txt'}) +
        (any ? '<ul class="hs-mus">' + rows + '</ul><p class="hs-src">The band is ' + EV.band[0] + ' to ' + EV.band[1] + ' sets a week (pooled trial data; ' + EV.min + ' is the minimum that works, past ' + EV.thin + ' the trials run out). ' + esc(String(EV.src || '').split(' · ')[0]) + '.</p>'
             : yd.empty('No sets ticked in this window.')), {id:'muscles'});
    }
    function liftSec(ctx){
      var lifts = safe(function(){ return loggedLifts(); }, []) || [];
      if(!lifts.length) return '';
      var id = ctx.state.lift && lifts.some(function(l){ return l[0] === ctx.state.lift; }) ? ctx.state.lift : lifts[0][0];
      var name = (lifts.filter(function(l){ return l[0] === id; })[0] || [id, id])[1], S2 = safe(function(){ return liftSeries(id); }, []) || [];
      var out = yd.select('lift', lifts, id, 'Exercise');
      if(S2.length < 2){
        out += S2.length ? '<p class="hs-line">One session: <b class="c3-num">' + W0(S2[0].lb) + ' ' + esc(U()) + ' × ' + S2[0].reps + '</b>, estimated max <b class="c3-num">' + W0(S2[0].e) + ' ' + esc(U()) + '</b>. One more draws the line.</p>' : '';
        return yd.sec('One lift', out, {id:'lift'});
      }
      var first = S2[0], last = S2[S2.length - 1], best = Math.max.apply(null, S2.map(function(x){ return x.e; }));
      var VW = 640, VH = 220, L = 50, R = 628, T = 20, B = 178, t0 = first.at, span = Math.max(1, last.at - t0);
      var lo = Math.min.apply(null, S2.map(function(x){ return Math.min(x.e, x.lb); })) * 0.95, hi = best * 1.05;
      var X = function(t){ return (L + (t - t0) / span * (R - L)).toFixed(1); }, Y = function(v){ return (B - (v - lo) / (hi - lo) * (B - T)).toFixed(1); };
      var FT = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;', FH = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:600;';   /* v365: chart words in the body face, no tracking */
      var s = '<svg class="hs-chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" focusable="false" aria-label="' + esc(name + ', estimated one-rep max from ' + W0(first.e) + ' to ' + W0(last.e) + ' ' + U() + ' over ' + S2.length + ' sessions') + '">';
      [hi, (hi + lo) / 2, lo].forEach(function(v){ s += '<path d="M ' + L + ' ' + Y(v) + ' H ' + R + '" stroke="rgba(207,209,213,0.238)" stroke-width="1" stroke-dasharray="2 6"></path><text x="' + (L - 8) + '" y="' + (+Y(v) + 5) + '" text-anchor="end" fill="#EDEEEF" style="' + FT + 'font-size:13px">' + W0(v) + '</text>'; });
      s += '<polyline points="' + S2.map(function(x){ return X(x.at) + ',' + Y(x.lb); }).join(' ') + '" fill="none" stroke="rgba(237,238,239,0.51)" stroke-width="1.6" stroke-dasharray="5 5"></polyline>';
      s += '<polyline data-e1="1" points="' + S2.map(function(x){ return X(x.at) + ',' + Y(x.e); }).join(' ') + '" fill="none" stroke="#5CF2B0" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 6px rgba(92,242,176,.8))"></polyline>';
      S2.forEach(function(x){ var pr = x.e >= best - 1e-9; s += '<circle data-pt="1" cx="' + X(x.at) + '" cy="' + Y(x.e) + '" r="' + (pr ? 7 : 4) + '" fill="' + (pr ? '#FFB85C' : '#5CF2B0') + '"' + (pr ? ' style="filter:drop-shadow(0 0 8px #FFB85C)"' : '') + '></circle>'; });
      s += '<text x="' + L + '" y="' + (B + 30) + '" fill="#EDEEEF" style="' + FH + 'font-size:14px">' + esc(yd.day(first.at)) + '</text><text x="' + R + '" y="' + (B + 30) + '" text-anchor="end" fill="#FFFFFF" style="' + FH + 'font-size:14px">' + esc(yd.day(last.at)) + '</text></svg>';
      var gain = last.e - first.e;
      out += yd.stats([[String(W0(last.e)), U() + ' est. max'], [(gain > 0 ? '+' : gain < 0 ? '−' : '') + Math.abs(W0(gain)), U() + ' since ' + yd.day(first.at), gain > 0.5 ? 'good' : gain < -0.5 ? 'bad' : ''], [String(W0(best)), U() + ' best']], 'hs-mini') + s +
        '<p class="hs-src">Epley from the working set you logged, not a max attempt. Dashed: the weight on the bar.</p>';
      return yd.sec('One lift', out, {id:'lift'});
    }

    yd.screen('history', {
      parent: 'train', nav: 'train', old: ['train', 'history'],
      render: function(ctx){
        var M = model(ctx);
        var top = yd.stats([[String(M.rows.length), M.rows.length === 1 ? 'session' : 'sessions'], [M.vol ? kLb(M.vol) : '0', U() + ' lifted'], [String(M.hard), 'hard sets'],
          [M.mins >= 60 ? (Math.round(M.mins / 6) / 10).toFixed(1) : String(M.mins), M.mins >= 60 ? 'hours' : 'minutes'], [String(M.prs), M.prs === 1 ? 'record' : 'records', M.prs ? 'good' : ''], [String(M.streak), 'week streak']], 'hs-top');
        var range = (RANGES.filter(function(r){ return r[0] === M.days; })[0] || [0, ''])[1];
        var p0 = ctx.params || {}; if(p0.from && !ctx.state.from) ctx.state.from = p0.from;   /* v358: opened from the body map */
        return '<div class="yd hs">' + yd.head({back: ctx.state.from || 'train', eyebrow: M.days ? 'Last ' + range : 'Everything', title:'Your', pk:'history'}) + top +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Hard sets, last 12 weeks', weeksChart(M.all), {id:'weeks'}) + sessionsSec(M, ctx) + '</div>' +
          '<div class="yd-col">' + liftSec(ctx) + musclesSec(ctx) + '</div></div></div>';
      },
      wire: function(root, ctx){
        var p0 = ctx.params || {};
        if(p0.sec && ctx.state._sec !== JSON.stringify(p0)){ ctx.state._sec = JSON.stringify(p0); setTimeout(function(){ var el = root.querySelector('[data-sec="' + p0.sec + '"]'); if(el) el.scrollIntoView({block: 'start'}); }, 60); }   /* v358 */
        yd.wire(root, ctx, {
          range: function(v){ ctx.state.days = +v; ctx.state.open = null; C3.render(); },
          open: function(v){ ctx.state.open = ctx.state.open === v ? null : v; C3.render(); },
          more: function(){ ctx.state.more = !ctx.state.more; C3.render(); },
          vdays: function(v){ ctx.state.vdays = +v; C3.render(); },
          mu: function(v){ ctx.state.mopen = ctx.state.mopen === v ? null : v; C3.render(); }
        }, {
          focus: function(v){ ctx.state.focus = v; ctx.state.open = null; C3.render(); },
          lift: function(v){ ctx.state.lift = v; C3.render(); }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
