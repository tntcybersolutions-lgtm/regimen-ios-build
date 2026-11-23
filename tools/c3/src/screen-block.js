/* C3 screen: block (v320). Replaces the old "The next 12 weeks" page (p-block: three boxes, a table of twelve
   rows of five columns, a paragraph on every phase).
   One picture of the twelve weeks, the week under the finger, and the one setting the block takes (cardio).
   Everything is the app's own: buildBlock() (weekAt for every week, the same generator as Train, so the two
   cannot disagree), isDeloadWeek, phaseOf / phaseName / phaseIntent, cardioPlan / setCardio / cardioFor /
   cardioKcal, blockEating (the calorie target, projected past this week), blockWeight. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var PH = ['#5CF2B0', '#FF4FCB', '#FFB85C'];          /* Foundation, Build, Peak */

    function W(lb, dp){ return safe(function(){ return wNum(lb, dp == null ? 1 : dp); }, lb); }
    function U(){ return safe(function(){ return wU(); }, 'lb'); }

    function chart(B, sel){
      var n = B.weeks.length, VW = 640, VH = 230, L = 34, R = 632, T = 26, Bt = 176, gap = 8;
      var bw = (R - L - gap * (n - 1)) / n, max = Math.max.apply(null, B.weeks.map(function(w){ return w.hardSets; }).concat([1]));
      var FT = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;';
      var FH = 'font-family:\'Barlow Condensed\',\'Arial Narrow\',sans-serif;font-weight:800;letter-spacing:0;';
      var s = '<svg class="blk-chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" focusable="false" aria-label="' + esc('Hard sets in each of the twelve weeks, ' + B.weeks.map(function(w){ return 'week ' + (w.i + 1) + ' ' + w.hardSets + (w.deload ? ' deload' : ''); }).join(', ')) + '">';
      s += '<path d="M ' + L + ' ' + Bt + ' H ' + R + '" stroke="rgba(207,209,213,0.468)" stroke-width="1.5" fill="none"></path>';
      B.weeks.forEach(function(w, k){
        var x = L + k * (bw + gap), hh = Math.max(4, Math.round(w.hardSets / max * (Bt - T))), y = Bt - hh, c = PH[w.phase] || PH[0];
        var op = w.past ? 0.38 : w.deload ? 0.55 : 1, on = sel === w.i;
        s += '<rect data-bar="' + w.i + '" x="' + x.toFixed(1) + '" y="' + y + '" width="' + bw.toFixed(1) + '" height="' + hh + '" rx="4" fill="' + c + '" opacity="' + op + '"' + (w.now ? ' style="filter:drop-shadow(0 0 8px ' + c + ')"' : '') + '></rect>';
        if(on) s += '<rect x="' + x.toFixed(1) + '" y="' + (y + hh + 6) + '" width="' + bw.toFixed(1) + '" height="3" rx="1.5" fill="#5CF2B0"></rect>';
        s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 7) + '" text-anchor="middle" fill="#FFFFFF" style="' + FT + 'font-size:13px">' + w.hardSets + '</text>' +
          '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (Bt + 22) + '" text-anchor="middle" fill="' + (w.now ? '#FFFFFF' : '#EDEEEF') + '" style="' + FH + 'font-size:15px">' + (w.deload ? 'DL' : 'W' + (w.i + 1)) + '</text>';
        if(w.now) s += '<circle cx="' + (x + bw / 2).toFixed(1) + '" cy="' + (Bt + 36) + '" r="4" fill="#FFFFFF"></circle>';
      });
      [0, 1, 2].forEach(function(p){
        var x0 = L + p * 4 * (bw + gap), x1 = x0 + 4 * bw + 3 * gap;
        s += '<path d="M ' + x0.toFixed(1) + ' ' + (VH - 8) + ' H ' + x1.toFixed(1) + '" stroke="' + PH[p] + '" stroke-width="3" stroke-linecap="round"></path>';
      });
      return s + '</svg>';
    }
    function weekDetail(w){
      var fmtD = function(ms){ return yd.day(ms); };
      var eat = w.eat || {}, cd = w.cardio || {}, k = w.cardioKcal;
      var rows = '<ol class="blk-days">' + (w.names.length ? w.names.map(function(n){ return '<li>' + esc(n) + '</li>'; }).join('') : '<li class="rest">Rest week</li>') + '</ol>';
      var st = [[String(w.days), w.days === 1 ? 'session' : 'sessions'], [String(w.hardSets), 'hard sets'], [String(Math.round(w.minutes)), 'min lifting']];
      if(cd.sessions) st.push([cd.sessions + '×' + cd.minutes, safe(function(){ return cardioKindWord(cd.kind); }, 'cardio').toLowerCase() + (cd.eased ? ', eased' : '')]);
      if(eat.kcal) st.push([String(eat.kcal), 'kcal a day' + (eat.projected ? ', projected' : '')]);
      if(w.weight) st.push([(Math.round(W(w.weight.lb) * 10) / 10).toFixed(1), U() + ' if the rate holds']);
      return '<div class="blk-week">' +
        '<div class="blk-wh"><span>' + esc(fmtD(w.at)) + ' · ' + esc(safe(function(){ return phaseName(w.phase); }, '')) + (w.deload ? ' · deload' : '') + (w.now ? ' · now' : '') + '</span></div>' +
        yd.stats(st, 'blk-st') + rows +
        (k ? '<p class="blk-line">Cardio worth about <b class="c3-num">' + k.lo + ' to ' + k.hi + '</b> kcal across the week.</p>' : '') +
        (!eat.kcal && eat.why ? '<p class="blk-line flat">' + esc(eat.why) + '</p>' : '') +
      '</div>';
    }

    yd.screen('block', {
      parent: 'train', nav: 'train', old: ['train', 'block'],
      render: function(ctx){
        /* the twelve weeks are one of the app's Pro screens (PRO_PANES.block): its lock, in this look */
        if(!yd.pro()) return '<div class="yd blk locked" data-state="locked">' + yd.head({back:'train', eyebrow:'Pro', title:'Next', pk:'12 weeks'}) + '<section class="yd-sec">' + yd.lock('block', 'The next 12 weeks is part of Pro', {part:true}) + '</section></div>';
        var B = buildBlock(), t = trainCfg(), c = cardioPlan();
        var sel = ctx.state.sel != null ? ctx.state.sel : Math.min(B.weeks.length - 1, B.nowIdx);
        var now = B.weeks[Math.min(B.weeks.length - 1, B.nowIdx)] || B.weeks[0];
        var w = B.weeks[sel] || now;
        var past = B.nowIdx >= B.weeks.length;
        var top = yd.stats([
          [past ? 'Done' : String(B.nowIdx + 1), past ? 'all 12 weeks' : 'week of 12'],
          [safe(function(){ return phaseName(phaseOf(Math.min(11, B.nowIdx))); }, ''), 'phase'],
          [String(B.totalSets), 'hard sets'],
          [String(Math.round(B.totalMins / 60)), 'hours']], 'blk-top');
        var weeksNav = '<div class="blk-pick" role="group" aria-label="Pick a week">' + B.weeks.map(function(x){
          return '<button type="button" class="yd-opt' + (x.i === sel ? ' on' : '') + (x.deload ? ' dl' : '') + '" data-act="wk" data-v="' + x.i + '" data-key="wk-' + x.i + '" aria-pressed="' + (x.i === sel ? 'true' : 'false') + '" aria-label="Week ' + (x.i + 1) + (x.deload ? ', deload' : '') + (x.now ? ', this week' : '') + '">' + (x.i + 1) + '</button>'; }).join('') + '</div>';
        var phase = '<p class="blk-phase"><i style="background:' + (PH[w.phase] || PH[0]) + '"></i><b>' + esc(safe(function(){ return phaseName(w.phase); }, '')) + '</b> ' + esc(safe(function(){ return phaseIntent(w.phase); }, '')) + '</p>';
        var k0 = safe(function(){ return cardioKcal(0); }, null);
        var cardio = yd.sec('Cardio',
          yd.seg('ck', CARDIO_KINDS.map(function(x){ return [x[0], x[1]]; }), c.kind, {aria:'Kind of cardio', cls:'blk-seg'}) +
          '<div class="yd-fields">' + yd.input('cks', c.sessions, 'Sessions a week', {type:'number', mode:'numeric', min:0, maxv:7, step:'1'}) + yd.input('ckm', c.minutes, 'Minutes each', {type:'number', mode:'numeric', min:0, maxv:180, step:'5'}) + '</div>' +
          (k0 ? '<p class="blk-line"><b class="c3-num">' + k0.mins + '</b> min a week, about <b class="c3-num">' + k0.lo + ' to ' + k0.hi + '</b> kcal. Deload weeks ease it.</p>' : '<p class="blk-line flat">No sessions: the daily step target does the work.</p>') +
          (c.set ? '' : yd.note('Starting numbers for a ' + esc(t.goal) + ' block. Yours to change.')), {id:'cardio'});
        return '<div class="yd blk">' + yd.head({back:'train', eyebrow: 'Deload every fourth week', title:'Next', pk:'12 weeks'}) + top +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Hard sets, week by week', chart(B, sel) + weeksNav + phase, {id:'chart'}) + '</div>' +
          '<div class="yd-col">' + yd.sec('Week ' + (w.i + 1), weekDetail(w), {id:'week'}) + cardio + '</div></div></div>';
      },
      wire: function(root, ctx){
        yd.wire(root, ctx, {
          buy: yd.lockActs.buy, restore: yd.lockActs.restore,
          wk: function(v){ ctx.state.sel = +v; C3.render(); },
          ck: function(v){ setCardio({kind: v}); try{ drawAll(); }catch(e){} C3.refresh(); }
        }, {
          cks: function(v){ setCardio({sessions: v}); try{ drawAll(); }catch(e){} C3.refresh(); },
          ckm: function(v){ setCardio({minutes: v}); try{ drawAll(); }catch(e){} C3.refresh(); }
        });
        /* a bar is a week too */
        root.querySelectorAll('[data-bar]').forEach(function(b){ b.style.cursor = 'pointer'; b.addEventListener('click', function(){ ctx.state.sel = +b.getAttribute('data-bar'); C3.render(); }); });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
