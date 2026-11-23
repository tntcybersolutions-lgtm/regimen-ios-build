/* C3 screen: recipe (v325). One planned meal (or any recipe in the library) as you cook it.
   Its numbers at the planned grams, what goes in it (scaled to the people eating and to tomorrow's leftover lunch,
   with the raw or dry weight to start from), the steps with the amounts each one uses and a timer where a step has
   one, cook mode (the screen stays on, the type gets big), and the meal's controls: Log, Swap, favorite, lock,
   never again. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, fmt = h.fmt, safe = yd.safe, mk = C3.mk;
    var tick = 0, lock = null;
    function g1(v){ v = Math.round((+v || 0) * 10) / 10; return String(v).replace(/\.0$/, ''); }
    function amt(id, g){
      var f = safe(function(){ return foodById(id); }, null) || {}, oz = g / 28.3495;
      var s = (f.serv || [])[0], pcs = '';
      if(s && /^1 (large|medium|fruit|tortilla|pita|bun|muffin|bagel|cake|bar|clove|slice|patty)/.test(s[0]) && s[1] > 0){
        var n = Math.round(g / s[1] * 2) / 2, w = s[0].replace(/^1 /, '').replace(/ .*$/, '');
        var noun = /^(large|medium|fruit)$/.test(w) ? (f.n || '').toLowerCase().replace(/,.*$/, '').replace(/s$/, '') : w === 'cake' ? 'rice cake' : w;
        if(n > 0) pcs = (n === Math.round(n) ? n : n.toFixed(1)) + ' ' + (n > 1 ? (/[^aeiou]y$/.test(noun) ? noun.slice(0, -1) + 'ies' : /(ch|sh|s|x|o)$/.test(noun) ? noun + 'es' : noun + 's') : noun); }
      return {g: g >= 10 ? Math.round(g) : g1(g), oz: g >= 20 ? (Math.round(oz * 10) / 10) : null, pcs: pcs.trim()};
    }
    function data(ctx){
      var p = ctx.params || {}, meal = null, r = null, key = p.k, i = p.i;
      if(key != null && i != null){ meal = safe(function(){ return mpMealOf(key, +i); }, null); r = meal ? mk.recipe(meal.rid) : null; }
      else if(p.rid){ r = mk.recipe(p.rid); }
      if(!r) return null;
      var items = meal ? meal.items : r.parts.map(function(x){ return {id: x[0], g: x[2], r: x[1], u: x[3] || 0}; });
      return {meal: meal, r: r, key: key, i: i == null ? null : +i, items: items, tot: safe(function(){ return mpTotals(items); }, {kcal:0, p:0, c:0, f:0, fib:0})};
    }
    function stopTick(){ if(tick){ clearInterval(tick); tick = 0; } }
    function release(){ try{ if(lock){ lock.release(); } }catch(e){} lock = null; }
    function mmss(ms){ var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }

    yd.screen('recipe', {
      parent: 'food', nav: 'food',
      fall: function(){ C3.go('food'); },
      enter: function(){ safe(function(){ mpLoad(); }); },
      leave: function(){ stopTick(); release(); },
      render: function(ctx){
        var p = ctx.params || {}, back = p.from === 'plan' ? 'plan' : 'food', st = ctx.state;
        var pk = JSON.stringify(p); if(st._in !== pk){ for(var kk in st) delete st[kk]; st._in = pk; }
        st.tm = st.tm || {}; st.done = st.done || {};
        if(!mk.ready()) return '<div class="yd rc" aria-busy="true">' + yd.head({back: back, title:'Recipe'}) + yd.empty('Opening the recipe.') + '</div>';
        var D = data(ctx);
        if(!D) return '<div class="yd rc">' + yd.head({back: back, title:'Recipe'}) + yd.empty('That meal is no longer in your plan.') + '</div>';
        var r = D.r, m = D.meal, P = mk.prefs(), today = mk.today();
        var nx = m && D.key ? mk.day(mk.add(D.key, 1)) : null, cooksLeft = !!(nx && nx.meals.some(function(x){ return x.left === D.key && x.rid === r.id; }));
        var people = st.ppl || P.household || 1, mult = people * (cooksLeft && !st.noleft ? 2 : 1);
        var eye = (m ? mk.slotWord(m.slot) + ' · ' + mk.word(D.key, {weekday:'short', month:'short', day:'numeric'}) + ' · ' : '') + ((r.tags || []).indexOf('slow-cooker') >= 0 ? 'slow cooker' : r.min ? r.min + ' min' : 'no cooking');
        var F = r.flags || {}, flags = [];
        if(F.vegan) flags.push('Vegan'); else if(F.vegetarian) flags.push('Vegetarian'); else if(F.pescatarian && !F.vegetarian) flags.push('Pescatarian');
        if(F.glutenFree) flags.push('Gluten-free'); if(F.dairyFree) flags.push('Dairy-free'); if(F.lowCarb) flags.push('Low carb'); if(F.highProtein) flags.push('High protein');
        var top = yd.stats([[fmt.n(D.tot.kcal), 'kcal'], [g1(Math.round(D.tot.p)), 'g protein'], [g1(Math.round(D.tot.c)), 'g carbs'], [g1(Math.round(D.tot.f)), 'g fat']], 'rc-top');
        var buy = MP.lib && MP.lib.buy ? MP.lib.buy : {};
        var ing = '<ul class="rc-ing">' + D.items.map(function(it){
          var f = safe(function(){ return foodById(it.id); }, null) || {n: it.id}, g = it.g * mult, a = amt(it.id, g), b = buy[it.id];
          var raw = b && b.f > 0 ? ' <small>' + (b.as === 'dry' ? 'dry' : 'raw') + ' about ' + Math.round(g * b.f) + ' g</small>' : '';
          return '<li><span class="n">' + esc(f.n) + (f.st && /cooked|baked/.test(f.st) && !/cooked|baked|grilled/i.test(f.n) ? ' <small>cooked weight</small>' : '') + '</span><span class="q c3-num"><b>' + a.g + ' g</b>' + (a.pcs ? ' · ' + esc(a.pcs) : a.oz ? ' · ' + a.oz + ' oz' : '') + raw + '</span></li>';
        }).join('') + '</ul>';
        var serv = '<div class="pl-hh rc-ppl"><span class="k">Cooking for</span>' + yd.btn('ppl', '', {v: people - 1, icon:'minus', aria:'One person fewer', disabled: people <= 1, cls:'pl-step'}) +
          '<b class="c3-num">' + people + '</b><span>' + (people === 1 ? 'person' : 'people') + '</span>' + yd.btn('ppl', '', {v: people + 1, icon:'plus', aria:'One person more', disabled: people >= 8, cls:'pl-step'}) + '</div>' +
          (cooksLeft ? '<p class="rc-left">' + mk.icon('leaf', 15, 2.4) + '<span>' + (st.noleft ? 'Just tonight.' : 'Twice the amount: half is tomorrow\'s lunch.') + '</span>' + yd.btn('noleft', st.noleft ? 'Cook for tomorrow too' : 'Just tonight', {cls:'mk-sm'}) + '</p>' : '') +
          (m && m.left ? '<p class="rc-left">' + mk.icon('leaf', 15, 2.4) + '<span>Leftover from ' + esc(mk.word(m.left, {weekday:'long'})) + '\'s dinner: heat it and eat.</span></p>' : '');
        var steps = '<ol class="rc-steps' + (st.cook ? ' big' : '') + '">' + (r.steps || []).map(function(s, k){
          var am = safe(function(){ return mpStepAmounts(s.t, D.items); }, []) || [], end = st.tm[k], done = !!st.done[k];
          return '<li class="' + (done ? 'done' : '') + '"><button type="button" class="rc-n" data-act="sdone" data-v="' + k + '" data-key="sdone-' + k + '" aria-pressed="' + (done ? 'true' : 'false') + '" aria-label="Step ' + (k + 1) + (done ? ', done' : ', mark done') + '">' + (done ? h.icon('check', 16, 3.2) : String(k + 1)) + '</button>' +
            '<div class="rc-st"><p>' + esc(s.t) + '</p>' +
            (am.length ? '<p class="rc-am">' + am.map(function(it){ var f = safe(function(){ return foodById(it.id); }, null) || {n: it.id}, a = amt(it.id, it.g * mult); return '<span><b class="c3-num">' + a.g + ' g</b> ' + esc(f.n.replace(/,.*$/, '').toLowerCase()) + '</span>'; }).join('') + '</p>' : '') +
            (s.min ? '<p class="rc-tm">' + (end ? '<b class="c3-num" data-tm="' + k + '">' + mmss(end - Date.now()) + '</b>' + yd.btn('tstop', 'Stop', {v: k, cls:'mk-sm'}) : yd.btn('tgo', 'Start ' + (s.min >= 60 ? Math.round(s.min / 60 * 10) / 10 + ' hr' : s.min + ' min'), {v: k, icon:'clock', cls:'mk-sm'})) + '</p>' : '') +
            '</div></li>'; }).join('') + '</ol>';
        var acts = '';
        if(m && !m.logged && D.key === today) acts += yd.btn('rlog', 'Log it', {icon:'plus'}) + yd.btn('rhalf', 'Log half');
        if(m && m.logged) acts += '<span class="mk-done">' + h.icon('check', 15, 3.2) + '<span>Logged</span></span>';
        if(m && !m.logged && D.key >= today) acts += yd.btn('rswap', 'Swap', {icon:'refresh'}) + yd.btn('rlock', m.locked ? 'Locked' : 'Lock', {cls: m.locked ? 'on' : ''});
        acts += yd.btn('rfav', 'Favorite', {icon:'heart', cls: P.fav[r.id] ? 'on fav' : '', extra: 'aria-pressed="' + (P.fav[r.id] ? 'true' : 'false') + '"'});
        if(m && !m.logged && !r.own) acts += yd.btn('rnever', 'Never', {icon:'x', cls:'bare', aria:'Never plan ' + r.t + ' again'});
        return '<div class="yd rc' + (st.cook ? ' cook' : '') + '">' + yd.head({back: back, eyebrow: eye, title: r.t}) + top +
          (flags.length ? '<p class="rc-flags">' + flags.map(function(f){ return '<span>' + esc(f) + '</span>'; }).join('') + (r.cu && r.cu !== 'Yours' ? '<span class="cu">' + esc(r.cu) + '</span>' : '') + '</p>' : '') +
          '<div class="yd-acts rc-acts">' + acts + '</div>' +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('What goes in', serv + ing, {id:'ing', n: D.items.length}) + '</div>' +
          '<div class="yd-col">' + yd.sec('How to make it', '<div class="yd-acts">' + yd.btn('cook', st.cook ? 'Leave cook mode' : 'Cook mode', {icon: st.cook ? 'x' : 'clock', cls: st.cook ? 'on' : ''}) + '</div>' + steps, {id:'steps', n: (r.steps || []).length}) +
          yd.note(st.cook ? 'Cook mode keeps the screen on while this recipe is open.' : 'Numbers: every ingredient is a USDA FoodData Central row, at the planned grams.') + '</div></div></div>';
      },
      wire: function(root, ctx){
        var st = ctx.state, D = data(ctx), today = mk.today();
        st.tm = st.tm || {}; st.done = st.done || {};
        stopTick();
        if(Object.keys(st.tm || {}).length){
          tick = setInterval(function(){
            var any = false;
            Object.keys(st.tm).forEach(function(k){ var end = st.tm[k], el = root.querySelector('[data-tm="' + k + '"]');
              if(end - Date.now() <= 0){ delete st.tm[k]; var step = D && D.r.steps[+k]; safe(function(){ cookRing({label: (D ? D.r.t + ', step ' + (+k + 1) : 'Timer'), id: 'mp' + k}); }); C3.render(); return; }
              any = true; if(el) el.textContent = mmss(end - Date.now()); });
            if(!any) stopTick();
          }, 500);
        }
        var meal = function(){ return D && D.meal ? D : null; };
        yd.wire(root, ctx, {
          ppl: function(v){ ctx.set({ppl: Math.max(1, Math.min(8, +v))}); },
          noleft: function(){ ctx.set({noleft: !st.noleft}); },
          sdone: function(v){ st.done[v] = !st.done[v]; C3.render(); },
          tgo: function(v){ var s = D && D.r.steps[+v]; if(!s) return; st.tm[v] = Date.now() + s.min * 60000; C3.render(); },
          tstop: function(v){ delete st.tm[v]; C3.render(); },
          cook: function(){ st.cook = !st.cook;
            if(st.cook){ try{ if(navigator.wakeLock) navigator.wakeLock.request('screen').then(function(l){ lock = l; }).catch(function(){}); }catch(e){} } else release();
            C3.render(); },
          rlog: function(v, b){ var x = meal(); if(!x) return; b.setAttribute('data-k', x.key); b.setAttribute('data-i', x.i); mk.act('mlog', b, ctx); C3.render(); },
          rhalf: function(v, b){ var x = meal(); if(!x) return; b.setAttribute('data-k', x.key); b.setAttribute('data-i', x.i); mk.act('mhalf', b, ctx); C3.render(); },
          rswap: function(){ var x = meal(); if(!x) return; C3.go('plan', {tab:'week', day: x.key, swap: x.key + ':' + x.i, returnTo:{k:x.key,i:x.i,from:(ctx.params||{}).from||'food'}});
            setTimeout(function(){ try{ var el = C3.root.querySelector('.mk-swap'); if(el) el.scrollIntoView({block:'center'}); }catch(e){} }, 80); },
          rlock: function(){ var x = meal(); if(!x) return; safe(function(){ mpToggleLock(x.key, x.i); }); C3.render(); },
          rfav: function(){ if(!D) return; var on = !mk.prefs().fav[D.r.id]; safe(function(){ mpFav(D.r.id, on); }); yd.toast(on ? 'Added to your favorites: it comes up more often.' : 'Taken off your favorites.'); C3.render(); },
          rnever: function(v, b){ var x = meal(); if(!x) return; b.setAttribute('data-k', x.key); b.setAttribute('data-i', x.i); mk.act('mnever', b, ctx); C3.go((ctx.params || {}).from === 'plan' ? 'plan' : 'food'); }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
