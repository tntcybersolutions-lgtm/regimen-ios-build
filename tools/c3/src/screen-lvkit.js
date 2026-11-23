/* C3 kit: levels from the log (v328). The dose tracker's Levels tab and the Levels screen draw the same thing:
   every protocol the person runs as a share of its own steady-state peak (rxLevels, the app's v328rx script, on
   the app's own one-compartment model), the doses logged solid and the doses planned dashed, now, the low point
   before the next dose and the next peak, and a stopped one until it has cleared. A finger or a pointer across the
   chart reads every line at that moment. The chart is drawn at the width it is shown at (its units are pixels), so
   its words are the same size on a phone as on a monitor; a resize that changes the width draws it again.
   Nothing here is advice: the amounts are the person's own, the curve is published pharmacokinetics, and a
   compound with no human data says so beside its name. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var RANGES = [['2', '2 wk'], ['6', '6 wk'], ['12', '12 wk'], ['26', '6 mo']];
  var WIN = {'2': [10, 4], '6': [28, 14], '12': [63, 21], '26': [154, 28]};
  var DAYMS = 864e5, HRMS = 36e5;
  var memo = {k: '', v: null};
  function safe(fn, d){ try{ return fn(); }catch(e){ return d; } }
  function esc(t){ return C3.h.esc(t); }
  function day(at, o){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', o || {weekday: 'short', month: 'short', day: 'numeric'}); }, ''); }
  function tm(at){ return safe(function(){ return new Date(at).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}); }, ''); }
  function pct(v){ return Math.round(v) + '%'; }
  function hrs(h){ return h >= 48 ? (Math.round(h / 24 * 10) / 10) + ' days' : (Math.round(h * 10) / 10) + ' h'; }
  function width(){
    var el = safe(function(){ return C3.root.getElementById('c3screen'); }, null), w = el ? el.clientWidth : (window.innerWidth || 390);
    var gut = w >= 700 ? 64 : 32;
    return Math.max(300, Math.min(1040, Math.round(w - gut)));
  }
  function data(range){
    var r = WIN[range] ? range : '6', now = Date.now(), w = WIN[r];
    var sig = safe(function(){ return pdSig(); }, '') + '|' + r;
    if(memo.k === sig && memo.v) return memo.v;
    var from = now - w[0] * DAYMS, to = now + w[1] * DAYMS;
    var D = safe(function(){ return rxLevels({from: from, to: to, n: 360}); }, null) || {from: from, to: to, now: now, lines: []};
    D.range = r;
    memo = {k: sig, v: D};
    return D;
  }
  function confMark(c){ var x = safe(function(){ return confOf(c); }, null); return x && x.mark ? x.mark.replace(/^·\s*/, '') : ''; }

  /* the chart: o.w (px), o.h; the focused line drawn over the rest with its area */
  function chart(D, o){
    o = o || {};
    var W = o.w || width(), H = o.h || (W >= 700 ? 320 : 250), L = 44, R = W - 14, T = 26, B = H - 34;
    var lines = D.lines || [];
    var maxV = 110; lines.forEach(function(x){ if(x.peakPct > maxV - 10) maxV = Math.min(400, x.peakPct * 1.12); });
    var X = function(t){ return L + (t - D.from) / (D.to - D.from) * (R - L); }, Y = function(v){ return B - Math.min(v, maxV) / maxV * (B - T); };
    var f1 = function(v){ return (Math.round(v * 10) / 10).toFixed(1); };
    var s = '<svg class="lv2-chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" focusable="false" data-from="' + D.from + '" data-to="' + D.to + '" data-l="' + L + '" data-r="' + R + '" aria-label="' +
      esc('Modeled levels from your log: ' + lines.map(function(x){ return x.name + ' ' + pct(x.nowPct) + ' of its steady-state peak now'; }).join(', ')) + '">';
    /* grid */
    [0, 50, 100].concat(maxV >= 190 ? [150] : []).forEach(function(p){
      var y = f1(Y(p));
      s += '<path d="M ' + L + ' ' + y + ' H ' + R + '" class="g' + (p === 100 ? ' hi' : '') + '"></path><text x="' + (L - 8) + '" y="' + (+y + 4) + '" text-anchor="end" class="yl">' + p + '%</text>';
    });
    s += '<text x="' + (L + 4) + '" y="' + f1(Y(100) - 6) + '" class="ss">Steady-state peak</text>';
    /* dates */
    var spanD = (D.to - D.from) / DAYMS, step = spanD <= 16 ? 2 : spanD <= 45 ? 7 : spanD <= 90 ? 14 : 28;
    var d0 = new Date(D.from); d0.setHours(12, 0, 0, 0);
    var minGap = W < 520 ? 64 : 80, lastX = -1e9;
    for(var t = d0.getTime(); t <= D.to; t += DAYMS){
      var dd = new Date(t), n = Math.round((t - d0.getTime()) / DAYMS);
      if(n % step) continue;
      var x = X(t); if(x < L + 10 || x > R - 10 || x - lastX < minGap) continue; lastX = x;
      s += '<path d="M ' + f1(x) + ' ' + B + ' V ' + (B + 5) + '" class="tk"></path><text x="' + f1(x) + '" y="' + (B + 20) + '" text-anchor="middle" class="xl">' + esc(day(t, {month: 'short', day: 'numeric'})) + '</text>';
    }
    /* now */
    var xn = f1(X(D.now));
    s += '<path d="M ' + xn + ' ' + (T - 10) + ' V ' + B + '" class="now"></path><text x="' + xn + '" y="' + (T - 14) + '" text-anchor="middle" class="nowt">Now</text>';
    /* lines: the rest first, the focused one last with its area */
    var focus = o.focus && lines.some(function(x){ return x.key === o.focus; }) ? o.focus : (lines[0] && lines[0].key);
    var order = lines.filter(function(x){ return x.key !== focus; }).concat(lines.filter(function(x){ return x.key === focus; }));
    order.forEach(function(x){
      var past = x.pts.filter(function(p){ return p[0] <= D.now; }), ahead = x.pts.filter(function(p){ return p[0] >= D.now; });
      var path = function(P){ return P.map(function(p, i){ return (i ? 'L ' : 'M ') + f1(X(p[0])) + ' ' + f1(Y(p[1])); }).join(' '); };
      var on = x.key === focus;
      if(on && past.length > 1) s += '<path d="' + path(past) + ' L ' + f1(X(past[past.length - 1][0])) + ' ' + B + ' L ' + f1(X(past[0][0])) + ' ' + B + ' Z" fill="' + x.color + '" opacity=".12"></path>';
      if(past.length > 1) s += '<path data-lv="' + esc(x.key) + '" d="' + path(past) + '" class="ln' + (on ? ' on' : '') + '" stroke="' + x.color + '"></path>';
      if(ahead.length > 1) s += '<path data-lvp="' + esc(x.key) + '" d="' + path(ahead) + '" class="ln plan' + (on ? ' on' : '') + '" stroke="' + x.color + '"></path>';
      var yn = Y(x.nowPct);
      s += '<circle cx="' + xn + '" cy="' + f1(yn) + '" r="' + (on ? 5.5 : 4) + '" fill="' + x.color + '" class="dot"></circle>';
    });
    /* dose marks along the bottom, one row per line */
    lines.forEach(function(x, i){
      var y = B - 4 - i * 6;
      x.logged.forEach(function(d){ var xx = X(d.at); if(xx < L || xx > R) return; s += '<rect x="' + f1(xx - 1.5) + '" y="' + (y - 4) + '" width="3" height="5" rx="1" fill="' + x.color + '" class="dm"></rect>'; });
      x.planned.forEach(function(d){ var xx = X(d.at); if(xx < L || xx > R) return; s += '<rect x="' + f1(xx - 1) + '" y="' + (y - 4) + '" width="2" height="5" rx="1" fill="' + x.color + '" opacity=".45" class="dm plan"></rect>'; });
    });
    s += '<path class="scrub" d="M 0 ' + T + ' V ' + B + '" visibility="hidden"></path>';
    s += '<rect class="hit" x="' + L + '" y="' + (T - 10) + '" width="' + (R - L) + '" height="' + (B - T + 10) + '" fill="transparent"></rect>';
    return s + '</svg>';
  }

  /* the whole view: numbers, range, chart, the reading under a finger, a row per line */
  function view(ctx, o){
    o = o || {};
    var st = ctx.state, D = data(st.lvr || '6'), lines = D.lines;
    var yd = C3.yd;
    if(!lines.length){
      return yd.sec('Levels', yd.empty('Nothing to draw yet. Each protocol draws here from its first logged or planned dose.') + (o.add ? '<div class="yd-acts">' + yd.btn('padd', 'Add a protocol', {icon: 'plus'}) + '</div>' : ''), {id: 'levels'});
    }
    var top = lines.slice(0, 4).map(function(x){ return [pct(x.nowPct), x.name + ' now']; });
    var focus = st.lvf && lines.some(function(x){ return x.key === st.lvf; }) ? st.lvf : lines[0].key;
    var legend = '<div class="lv2-leg" role="group" aria-label="Lines">' + lines.map(function(x){
      var on = x.key === focus, m = confMark(x.compound);
      return '<button type="button" class="lv2-lg' + (on ? ' on' : '') + '" data-act="lvfocus" data-v="' + esc(x.key) + '" data-key="lvfocus-' + esc(x.key) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><i style="background:' + x.color + '"></i><span>' + esc(x.name) + (m ? '<small>' + esc(m) + '</small>' : '') + '</span></button>';
    }).join('') + '</div>';
    var rows = '<ul class="lv2-rows">' + lines.map(function(x){
      var bits = [];
      if(x.next) bits.push('<span><b class="c3-num">' + pct(x.next.lowPct) + '</b> low before the next dose, ' + esc(day(x.next.at) + ' ' + tm(x.next.at)) + '</span>', '<span><b class="c3-num">' + pct(x.next.peakPct) + '</b> peak after it, ' + esc(day(x.next.peakAt)) + '</span>');
      if(x.clearAt) bits.push('<span>Below 1% about <b>' + esc(day(x.clearAt)) + '</b></span>');
      else if(!x.next && x.stopped) bits.push('<span>Stopped</span>');
      if(x.ssAt) bits.push(x.ssAt <= D.now ? '<span>Five half-lives on this amount: <b>steady</b></span>' : '<span>Five half-lives on this amount <b>' + esc(day(x.ssAt)) + '</b></span>');
      bits.push('<span>Half-life <b class="c3-num">' + esc(hrs(x.t12)) + '</b>, peak <b class="c3-num">' + esc(hrs(x.tmax)) + '</b> after a dose</span>');
      return '<li><i style="background:' + x.color + '"></i><div class="lv2-r"><p class="n"><b>' + esc(x.name) + '</b>' + (x.of ? '<small>in ' + esc(x.of) + '</small>' : '') + '<em class="c3-num">' + pct(x.nowPct) + '</em></p><p class="f">' + bits.join('') + '</p></div></li>';
    }).join('') + '</ul>';
    var weak = lines.filter(function(x){ return x.conf && x.conf !== 'human'; });
    var src = '<p class="lv2-src">Each line is a share of its own steady-state peak at the amount planned now: 100% is as high as that schedule ever gets. Published half-life and time to peak, one-compartment model, your logged doses at their real times.' +
      (weak.length ? ' ' + weak.map(function(x){ var c = safe(function(){ return confOf(x.compound); }, null); return '<b>' + esc(x.name) + '</b>: ' + esc(c ? c.word : 'no published pharmacokinetics') + '.'; }).join(' ') : '') + '</p>';
    return yd.stats(top, 'lv2-top' + (top.length > 2 ? ' four' : '')) +
      yd.sec('Your levels', yd.seg('lvr', RANGES, D.range, {aria: 'Range', cls: 'lv2-range txt'}) + legend +
        '<div class="lv2-wrap" data-w="' + width() + '">' + chart(D, {focus: focus}) + '</div>' +
        '<p class="lv2-read" aria-live="polite" data-key="lvread">' + esc('Move across the chart to read it.') + '</p>' + rows + src, {id: 'levels'});
  }

  /* the scrub: one listener on the chart, reading every line at the pointer */
  function wire(root, ctx){
    var st = ctx.state;
    root.querySelectorAll('[data-act="lvfocus"]').forEach(function(b){ b.addEventListener('click', function(){ st.lvf = b.getAttribute('data-v'); C3.render(); }); });
    root.querySelectorAll('[data-act="lvr"]').forEach(function(b){ b.addEventListener('click', function(){ st.lvr = b.getAttribute('data-v'); C3.render(); }); });
    var svg = root.querySelector('.lv2-chart'), out = root.querySelector('.lv2-read');
    if(!svg || !out) return;
    var D = data(st.lvr || '6'), from = +svg.getAttribute('data-from'), to = +svg.getAttribute('data-to'), L = +svg.getAttribute('data-l'), R = +svg.getAttribute('data-r');
    var line = svg.querySelector('.scrub');
    function read(ev){
      var r = svg.getBoundingClientRect(), vbW = svg.viewBox.baseVal.width || r.width;
      var x = (ev.clientX - r.left) * vbW / r.width; if(x < L || x > R) return;
      var t = from + (x - L) / (R - L) * (to - from);
      line.setAttribute('d', 'M ' + x.toFixed(1) + ' 16 V ' + (svg.viewBox.baseVal.height - 34));
      line.setAttribute('visibility', 'visible');
      out.innerHTML = '<b>' + esc(day(t) + ', ' + tm(t)) + '</b>' + D.lines.map(function(L0){ return '<span><i style="background:' + L0.color + '"></i>' + esc(L0.name) + ' <b class="c3-num">' + pct(safe(function(){ return rxLevelAt(L0, t); }, 0)) + '</b></span>'; }).join('');
    }
    svg.addEventListener('pointermove', read);
    svg.addEventListener('pointerdown', read);
  }
  /* drawn again when the width it was drawn for changes (a phone turned, a window resized) */
  var rt = 0;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){
      var w = safe(function(){ return C3.root.querySelector('.lv2-wrap'); }, null);
      if(w && Math.abs(+w.getAttribute('data-w') - width()) > 24) C3.render();
    }, 180);
  });
  C3.lv = {data: data, chart: chart, view: view, wire: wire, width: width, RANGES: RANGES};
})();
