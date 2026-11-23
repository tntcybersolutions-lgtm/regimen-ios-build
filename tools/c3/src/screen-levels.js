/* C3 screen: levels (v320). Replaces the old Levels page (p-levels: a box with four fields, a sim bar, a canvas,
   a legend of six swatches, six tiles and a source paragraph; the trials card under it).
   The curve first, drawn from the app's own model: byId (the compound and its published numbers), keOf /
   kaFromTmax (absorption solved from tmax), concAt (every dose superposed), steadyState / levelBand (peak,
   trough, average). The fields, the simulation bar (Back to my protocol / Apply) and the phase tag are the
   app's own, drawn by renderLevels() into its own page and mirrored, so Apply is exactly the app's write.
   The six numbers are the ones renderLevels() wrote. The source line is the compound's own. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var MIR = {els: []};

    function txt(id){ var el = document.getElementById(id); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
    function model(){
      var c = byId(document.getElementById('lCmp').value);
      var mg = safe(function(){ return num(document.getElementById('lDose').value, S.doseMg || 1, {min:0.001}); }, 1) || 1;
      var tau = safe(function(){ return num(document.getElementById('lEvery').value, S.everyH || 168, {min:1}); }, 168) || 168;
      var weeks = Math.max(1, Math.min(52, safe(function(){ return num(document.getElementById('lWeeks').value, 12, {min:1, integer:1}); }, 12) || 12));
      var ke = keOf(c.t12), ka = kaFromTmax(c.tmax, ke, c.id), ss = steadyState(mg, tau, ka, ke), B = levelBand(mg, tau, ka, ke);
      return {c: c, mg: mg, tau: tau, weeks: weeks, ke: ke, ka: ka, ss: ss, B: B};
    }
    function chart(M){
      var VW = 640, VH = 260, L = 46, R = 630, T = 16, Bt = 214, horizon = M.weeks * 168, N = 360;
      var doses = []; for(var t = 0; t <= horizon; t += M.tau) doses.push({tH: t, mg: M.mg});
      var vals = [], i, v;
      for(i = 0; i <= N; i++){ var tt = i / N * horizon; vals.push([tt, concAt(tt, doses, M.ka, M.ke)]); }
      var maxV = Math.max.apply(null, [M.ss.peak].concat(vals.map(function(p){ return p[1]; }))) * 1.12;
      var X = function(t){ return (L + t / horizon * (R - L)).toFixed(1); }, Y = function(x){ return (Bt - x / maxV * (Bt - T)).toFixed(1); };
      var FT = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;', FH = 'font-family:\'Barlow Condensed\',\'Arial Narrow\',sans-serif;font-weight:800;letter-spacing:0;';
      var last = vals[vals.length - 1], pct = M.ss.peak ? Math.round(last[1] / M.ss.peak * 100) : 0;
      var s = '<svg class="lv-chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" focusable="false" aria-label="' + esc('Modeled level of ' + M.c.n + ', ' + M.mg + ' mg every ' + M.tau + ' hours, over ' + M.weeks + ' weeks; ends at ' + pct + ' percent of steady-state peak') + '">';
      [0, 50, 100].forEach(function(p){ var y = Y(p / 100 * M.ss.peak); s += '<path d="M ' + L + ' ' + y + ' H ' + R + '" stroke="rgba(207,209,213,0.212)" stroke-width="1" stroke-dasharray="2 6"></path><text x="' + (L - 8) + '" y="' + (+y + 5) + '" text-anchor="end" fill="var(--ink2, #536176)" style="' + FT + 'font-size:12px">' + p + '%</text>'; });
      if(!M.B.clears && M.B.hi > M.B.lo) s += '<rect x="' + L + '" y="' + Y(M.B.hi) + '" width="' + (R - L) + '" height="' + Math.max(1, Y(M.B.lo) - Y(M.B.hi)).toFixed(1) + '" fill="rgba(92,242,176,.12)"></rect>';
      s += '<path d="M ' + L + ' ' + Bt + ' ' + vals.map(function(p){ return 'L ' + X(p[0]) + ' ' + Y(p[1]); }).join(' ') + ' L ' + R + ' ' + Bt + ' Z" fill="rgba(255,79,203,.16)"></path>';
      s += '<polyline data-level="1" points="' + vals.map(function(p){ return X(p[0]) + ',' + Y(p[1]); }).join(' ') + '" fill="none" stroke="#FF4FCB" stroke-width="2.6" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(255,79,203,.8))"></polyline>';
      s += '<path d="M ' + L + ' ' + Y(M.ss.peak) + ' H ' + R + '" stroke="#FFB85C" stroke-width="1.6" stroke-dasharray="6 6"></path><text x="' + (L + 6) + '" y="' + (+Y(M.ss.peak) - 6) + '" fill="#FFB85C" style="' + FH + 'font-size:14px">Steady-state peak</text>';
      if(M.B.avg > 0 && M.B.avg < maxV) s += '<path d="M ' + L + ' ' + Y(M.B.avg) + ' H ' + R + '" stroke="var(--ink, #182136)" stroke-width="1.2" stroke-dasharray="2 5" opacity=".7"></path><text x="' + (R - 4) + '" y="' + (+Y(M.B.avg) - 6) + '" text-anchor="end" fill="var(--ink, #182136)" style="' + FH + 'font-size:13px">Average</text>';
      doses.forEach(function(d){ var x = X(d.tH); s += '<path data-dose="1" d="M ' + x + ' ' + Bt + ' V ' + (Bt - 7) + '" stroke="rgba(237,238,239,0.51)" stroke-width="1"></path>'; });
      var step = M.weeks <= 14 ? 1 : M.weeks <= 30 ? 4 : 8;
      for(i = 0; i <= M.weeks; i += step) s += '<text x="' + X(i * 168) + '" y="' + (Bt + 22) + '" text-anchor="middle" fill="var(--ink2, #536176)" style="' + FH + 'font-size:13px">W' + i + '</text>';
      s += '<circle cx="' + X(last[0]) + '" cy="' + Y(last[1]) + '" r="6" fill="#FF4FCB" style="filter:drop-shadow(0 0 8px #FF4FCB)"></circle>';
      return s + '</svg>';
    }

    yd.screen('levels', {
      parent: 'progress', nav: 'progress', old: ['peptides', 'levels'],
      enter: function(){ try{ if(!document.getElementById('lCmp').options.length) syncLevelInputs(); }catch(e){} },
      render: function(ctx){
        /* v328: free (Chad, 17 Oct: "Keep the calculator, site map, level chart and stacks free"). First, every protocol
           from what was logged (C3.lv, the same view as the dose tracker's Levels tab); under it, the simulator */
        safe(function(){ renderLevels(); });
        var M = model();
        MIR.els = [];
        var fields = document.querySelector('#p-levels .fields'), sim = document.getElementById('lvlState'), ph = document.getElementById('pkPhase');
        var fh = fields ? yd.mirror(fields, {els: MIR.els}).html : '', sh = sim ? yd.mirror(sim, {els: MIR.els}).html : '', phh = ph && !ph.hidden ? yd.mirror(ph, {els: MIR.els}).html : '';
        var top = yd.stats([[txt('kHalf'), 'half-life'], [txt('kTmax').replace(/after dose/, '').trim(), 'peak after a dose'], [txt('kSS'), 'to steady state'], [txt('kR'), 'accumulation']], 'lv-top');
        var conf = safe(function(){ return confOf(M.c); }, null);
        var mine = C3.lv ? C3.lv.view(ctx) : '';
        return '<div class="yd lv">' + yd.head({back:'progress', eyebrow: 'From your log', title:'Your', pk:'levels'}) +
          '<p class="lv-guide">These are model estimates, not measured blood levels or dosing advice. Start with your logged history below; changing the model below does not change your log. Check with your doctor before changing anything you take.</p>' + mine + '<h2 class="lv-try">Try a schedule <span>' + esc(M.c.n) + '</span></h2>' + top +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Modeled level', (phh ? '<div class="lv-phase">' + phh + '</div>' : '') + chart(M) +
            '<p class="lv-band">' + esc(txt('pkBand')) + '</p>' +
            '<p class="lv-src">' + (conf && conf.note ? '<b class="' + (M.c.conf === 'iv' ? 'warn' : 'bad') + '">' + esc(conf.word) + '.</b> ' : '') + esc(M.c.n + ': ' + (M.c.src || '')) + '. One-compartment model, first-order absorption solved from tmax; drawn as a share of the steady-state peak.</p>', {id:'curve'}) + '</div>' +
          '<div class="yd-col">' + yd.sec('Model', '<div class="lv-mir">' + fh + sh + '</div>' + yd.stats([[txt('kAbs'), 'absorption t½'], [txt('kPT'), 'peak : trough']], 'lv-mini'), {id:'model'}) + '</div></div></div>';
      },
      wire: function(root, ctx){
        var after = function(){ setTimeout(function(){ C3.render(); }, 40); };
        var mir = yd.mirrorActs(function(){ return MIR.els; }, after), mirC = yd.mirrorChgs(function(){ return MIR.els; }, after);
        yd.wire(root, ctx, { mir: mir.mir, mirck: mir.mirck, buy: yd.lockActs.buy, restore: yd.lockActs.restore }, { mirin: mirC.mirin, mirsel: mirC.mirsel });
        if(C3.lv) C3.lv.wire(root, ctx);
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
