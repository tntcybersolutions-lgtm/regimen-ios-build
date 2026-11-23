/* C3 screen: muscle (v367). The body map's tap target: one muscle's week against the evidence band, direct and
   helper work, and the moves that train it as photo rows (a tap opens the Watch layer, "every move" jumps into the
   library filtered to the muscle). The app's own numbers throughout: muscleSets() / volVerdict() / VOL_EV,
   MUSCLES / MUSCLE_LABEL, EXERCISES / EQ_LABEL, myMoves(), exImg() from the bundled photo library. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    yd.screen('muscle', {
      parent: 'train', nav: 'train', old: ['train'],
      enter: function(){ safe(function(){ exdbLoad(); }); },
      render: function(ctx){
        var list0 = safe(function(){ return MUSCLES.slice(); }, []) || [];
        var m = (ctx.params && ctx.params.m) || list0[0] || 'chest';
        if(list0.indexOf(m) < 0) m = list0[0] || 'chest';
        var name = safe(function(){ return MUSCLE_LABEL[m]; }, m) || m;
        var from = (ctx.params && ctx.params.from) || 'train';
        var days = 7, wk = 1;
        var data = safe(function(){ return muscleSets(days); }, null) || {};
        var d = data[m] || {total: 0, direct: 0, indirect: 0, by: {}};
        var EV = safe(function(){ return VOL_EV; }, {min: 4, solid: 10, band: [11, 18], thin: 25});
        var v = Math.round(d.total / wk * 10) / 10;
        var vd = safe(function(){ return volVerdict(v); }, {k: v ? 'low' : 'none', word: ''});
        var max = Math.max(EV.thin + 4, v + 2);
        var pct = function(x){ return Math.max(0, Math.min(100, x / max * 100)).toFixed(1); };
        var tone = {none: 'none', under: 'warn', low: 'warn', 'in': 'good', high: 'good', thin: 'bad'}[vd.k] || '';
        /* the moves that train it: yours first (last trained first), then the rest of the library by name */
        var all = safe(function(){ return EXERCISES; }, []) || [];
        var mineIds = {}; (safe(function(){ return myMoves(); }, []) || []).forEach(function(e){ mineIds[e.id] = e._at || 1; });
        var inGrp = all.filter(function(e){ return e.grp === m; });
        var mine = inGrp.filter(function(e){ return mineIds[e.id]; }).sort(function(a, b){ return (mineIds[b.id] || 0) - (mineIds[a.id] || 0); });
        var rest = inGrp.filter(function(e){ return !mineIds[e.id]; }).sort(function(a, b){ return String(a.n).localeCompare(String(b.n)); });
        var moves = mine.concat(rest);
        var db = safe(function(){ return !!EXDB.data; }, false);
        var rows = moves.map(function(e){
          var img = db ? safe(function(){ return exImg(e, 0); }, '') : '';
          var done = d.by && d.by[e.n] ? Math.round(d.by[e.n] / wk * 10) / 10 : 0;
          var meta = [safe(function(){ return EQ_LABEL[e.eq]; }, e.eq)].concat(e.unil ? ['one side'] : []).concat(done ? [done + ' this wk'] : []).join(' · ');
          return '<li><button type="button" class="mv-row" data-act="watch" data-v="' + esc(e.id) + '" data-key="mu-' + esc(e.id) + '" aria-label="' + esc(e.n + ', how to do it') + '">' +
            (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '<span class="mv-noimg" aria-hidden="true">' + h.icon('train', 22, 2) + '</span>') +
            '<span class="l"><b>' + esc(e.n) + (e.cx ? ' <em>yours</em>' : '') + '</b><small>' + esc(meta) + '</small></span>' + h.icon('chev', 16, 2.4) + '</button></li>';
        }).join('');
        var hero = '<div class="ms-hero"><div class="ms-n"><b class="c3-num">' + v + '</b><span>sets this week</span></div>' +
          '<div class="ms-split"><div><b class="c3-num">' + (Math.round(d.direct / wk * 10) / 10) + '</b><span>direct</span></div>' +
          '<div><b class="c3-num">' + (Math.round(d.indirect / wk * 10) / 10) + '</b><span>as a helper</span></div></div></div>';
        var bar = '<div class="ms-barwrap"><div class="ms-bar" role="img" aria-label="' + esc(v + ' sets this week; the target band is ' + EV.band[0] + ' to ' + EV.band[1]) + '"><i class="band" style="left:' + pct(EV.band[0]) + '%;width:' + (pct(EV.band[1]) - pct(EV.band[0])) + '%"></i><i class="now ' + tone + '" style="width:' + pct(v) + '%"></i></div>' +
          '<div class="ms-barn"><span>0</span><span class="tg" style="left:' + pct(EV.band[0]) + '%">' + EV.band[0] + '+ target</span></div></div>';
        var word = vd.word ? '<p class="ms-word">' + esc(vd.word.charAt(0).toUpperCase() + vd.word.slice(1)) + '.</p>' : '';
        return '<div class="yd ms">' + yd.head({back: from, eyebrow: 'Muscle map', title: 'Your', pk: String(name).toLowerCase()}) +
          yd.sec('This week', hero + bar + word, {id: 'week'}) +
          yd.sec('Moves that train it', (rows ? '<ul class="mv-list">' + rows + '</ul>' : yd.empty('No moves in the library for it yet.')) +
            (moves.length ? '<div class="yd-acts">' + yd.btn('allmoves', 'Every ' + String(name).toLowerCase() + ' move') + '</div>' : ''), {id: 'moves', n: moves.length}) +
          '<button type="button" class="c3-btn-quiet ms-hist" data-go="history" data-params="' + esc(JSON.stringify({sec: 'muscles', from: from})) + '" data-key="ms-hist">Every muscle, every week ' + h.icon('arrow', 16, 2.6) + '</button>' +
          '</div>';
      },
      wire: function(root, ctx){
        yd.wire(root, ctx, {
          watch: function(v, el){ h.watch(v, el); },
          allmoves: function(){ try{ var M = MOVEUI; M.open = null; M.scope = 'all'; M.grp = (ctx.params && ctx.params.m) || ''; M.eq = ''; M.q = ''; }catch(e){} C3.go('moves'); }
        });
        if(!safe(function(){ return !!EXDB.data; }, false)){
          var tries = 0, t = setInterval(function(){ if(C3.current !== 'muscle' || ++tries > 40){ clearInterval(t); return; } if(safe(function(){ return !!EXDB.data; }, false)){ clearInterval(t); C3.render(); } }, 250);
        }
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
