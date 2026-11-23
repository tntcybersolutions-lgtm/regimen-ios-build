/* C3 meal kit (v325): what the Food screen, the Plan screen and the Recipe screen share about a planned meal.
   It registers no screen. C3.mk draws a day of the plan (the meals as rows, each with Log, Swap and its recipe), the
   seven days as bars, the swap options, and answers their controls. Every number is the planner's own
   (mpTotals of the planned grams); every change is the planner's own writer (mpLog, mpUnlog, mpSwap, mpRegenDay,
   mpToggleLock, mpNever), with the app's Undo. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  var mk = C3.mk = {};
  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  mk.safe = safe;
  var SLOTW = {breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snack:'Snack'};
  var DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function ico(d, size, sw){ return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>'; }
  var IC = {
    swap:  '<path d="M7 7h11l-3-3"></path><path d="M17 17H6l3 3"></path>',
    lock:  '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
    redo:  '<path d="M20 12a8 8 0 1 1-2.34-5.66"></path><path d="M20 4v5h-5"></path>',
    check: '<path d="M4 12.5l5.5 5.5L20 7"></path>',
    heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.5 4.2 4.2 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z"></path>',
    x:     '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    chev:  '<path d="M9 5l7 7-7 7"></path>',
    back:  '<path d="M15 5l-7 7 7 7"></path>',
    cart:  '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"></path><circle cx="9" cy="19" r="1.5"></circle><circle cx="17" cy="19" r="1.5"></circle>',
    clock: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path>',
    leaf:  '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"></path><path d="M5 19l7-7"></path>'
  };
  mk.icon = function(n, s, w){ return IC[n] ? ico(IC[n], s || 16, w || 2.4) : h.icon(n, s, w); };
  mk.today = function(){ return safe(function(){ return dkey(Date.now()); }, ''); };
  mk.dow = function(key){ return new Date(key + 'T12:00:00').getDay(); };
  mk.word = function(key, o){ return safe(function(){ return new Date(key + 'T12:00:00').toLocaleDateString('en-US', o || {weekday:'long', month:'short', day:'numeric'}); }, key); };
  mk.add = function(key, n){ return safe(function(){ return dkey(new Date(key + 'T12:00:00').getTime() + n * DAY); }, key); };
  mk.ready = function(){ return safe(function(){ return !!MP.lib; }, false); };
  mk.plan = function(){ return safe(function(){ return mpPlan(); }, {days:{}}); };
  mk.day = function(key){ var p = mk.plan(); return p.days ? p.days[key] || null : null; };
  mk.tot = function(m){ return safe(function(){ return mpTotals(m.items); }, {kcal:0, p:0, c:0, f:0}); };
  mk.dayTot = function(D){ var t = {kcal:0, p:0, c:0, f:0}; if(D && D.off) return t; (D.meals || []).forEach(function(m){ var x = mk.tot(m), k = m.logged ? (m.logged.por || 1) : 1; t.kcal += x.kcal * k; t.p += x.p * k; t.c += x.c * k; t.f += x.f * k; }); t.kcal = Math.round(t.kcal); t.p = Math.round(t.p); t.c = Math.round(t.c); t.f = Math.round(t.f); return t; };
  mk.slotWord = function(s){ return SLOTW[s] || s; };
  mk.prefs = function(){ return safe(function(){ return mpPrefs(); }, {}); };
  mk.recipe = function(id){ return safe(function(){ return mpRecipe(id); }, null); };

  /* what the plan is built to, in one line: "Recomp · 4 meals a day · vegetarian · for 2" */
  mk.line = function(){
    var P = mk.prefs(), a = safe(function(){ return mpAim(mk.today()); }, null), bits = [];
    if(a && a.word) bits.push(a.word);
    bits.push(P.meals + ' meals a day');
    var diet = safe(function(){ return (MP_DIETS.filter(function(d){ return d[0] === P.diet; })[0] || [])[1]; }, '');
    if(P.diet && P.diet !== 'any' && diet) bits.push(diet.toLowerCase());
    if(P.allergies && P.allergies.length) bits.push('no ' + P.allergies.join(', '));
    if(P.household > 1) bits.push('for ' + P.household);
    return bits.join(' · ');
  };

  /* the seven days as bars: each day's planned calories against its own aim (the pink tick at the same height) */
  mk.strip = function(keys, sel, act){
    var today = mk.today();
    return '<ol class="mk-days" aria-label="Days">' + keys.map(function(k){
      var D = mk.day(k), t = D ? mk.dayTot(D) : {kcal:0}, aim = D && D.aim ? D.aim.k : 0, on = k === sel;
      var hgt = aim > 0 ? Math.round(Math.min(1, t.kcal / aim * 0.8) * 1000) / 10 : 0;
      var done = D ? D.meals.filter(function(m){ return m.logged; }).length : 0, all = D ? D.meals.length : 0;
      return '<li><button type="button" class="mk-d' + (on ? ' on' : '') + (k === today ? ' today' : '') + (k < today ? ' past' : '') + '" data-act="' + (act || 'mday') + '" data-v="' + esc(k) + '" data-key="mday-' + esc(k) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(mk.word(k)) + (k === today ? ', today' : '') + ', ' + fmt.n(t.kcal) + ' calories planned' + (D && D.tr ? ', training day' : '') + '">' +
        '<span class="dn">' + esc(mk.word(k, {weekday:'short'})) + '</span><span class="dd c3-num">' + new Date(k + 'T12:00:00').getDate() + '</span>' +
        '<span class="bar"><i style="height:' + hgt + '%"></i>' + (aim ? '<u style="bottom:80%"></u>' : '') + '</span>' +
        '<b class="kc">' + (D ? (D.off ? 'out' : fmt.n(t.kcal)) : '') + '</b>' +
        '<em class="' + (D && D.tr ? 'tr' : 'rs') + '" aria-hidden="true"></em>' + (all && done === all ? '<span class="dn-all" aria-hidden="true">' + mk.icon('check', 12, 3.4) + '</span>' : '') +
      '</button></li>';
    }).join('') + '</ol>';
  };

  /* the picked day: its name, its numbers against its aim */
  mk.dayHead = function(key){
    var D = mk.day(key); if(!D) return '';
    var t = mk.dayTot(D), today = mk.today();
    return '<div class="mk-dayh"><span class="dt">' + esc(mk.word(key, {weekday:'long'})) + (key === today ? ' · today' : '') + '<em>' + (D.tr ? 'Training day' : 'Rest day') + '</em></span>' +
      '<span class="tt"><b>' + fmt.n(t.kcal) + '</b> kcal <i>aim ' + fmt.n(D.aim.k) + '</i> · <b>' + fmt.n(t.p) + '</b> g protein</span>' +
      '<span class="mac"><span><b>' + fmt.n(t.c) + '</b> g carbs</span><span><b>' + fmt.n(t.f) + '</b> g fat</span></span></div>' + mk.rebNote(key);
  };
  /* v370: the rebalance note alone (Food's today: the targets above already say the day's numbers) */
  mk.rebNote = function(key){
    var D = mk.day(key); if(!D) return '';
    return key === mk.today() && D.reb && D.reb.k > 0 ? '<p class="mk-reb">' + mk.icon('redo', 15, 2.6) + '<span>Rebalanced around the <b>' + fmt.n(D.reb.k) + ' kcal</b> you logged outside the plan.</span></p>' : '';
  };

  /* one planned meal */
  /* v370: opt.next (Food only): today's first meal not yet logged is the step, its Log the screen's one big button
     (Chad, 28 Oct: Liftoff's button flow; "u have to scroll to bottom of page finally realizing thats where u actual
     full day's food plan lives") */
  mk.mealRow = function(key, i, m, st, opt){
    var t = mk.tot(m), today = mk.today(), r = mk.recipe(m.rid), open = st && st.swap === key + ':' + i;
    var next = !!(opt && opt.next === i && key === today && !m.logged);
    var sub = [];
    if(r) sub.push((r.tags || []).indexOf('slow-cooker') >= 0 ? 'slow cooker' : (r.min ? r.min + ' min' : 'no cooking'));
    if(m.left) sub.push('leftover from ' + mk.word(m.left, {weekday:'long'}));
    else { var nx = mk.day(mk.add(key, 1)), nl = nx && nx.meals.filter(function(x){ return x.left === key && x.rid === m.rid; })[0]; if(nl) sub.push('cook 2: tomorrow\'s lunch'); }
    if(m.extra) sub.push('added to reach your day');
    if(r && r.cu && r.cu !== 'Yours') sub.push(r.cu);
    var acts = '';
    if(m.logged){
      acts = '<span class="mk-done">' + mk.icon('check', 15, 3.2) + '<span>' + (m.logged.por && m.logged.por !== 1 ? 'Half logged' : 'Logged') + '</span></span>' +
        '<button type="button" class="c3-btn-quiet bare mk-sm" data-act="munlog" data-k="' + esc(key) + '" data-i="' + i + '" data-key="munlog-' + esc(key) + '-' + i + '">Undo</button>';
    } else {
      if(next) acts += '<button type="button" class="c3-btn-primary mk-next" data-act="mlog" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mnext" aria-label="Log ' + esc(mk.slotWord(m.slot)).toLowerCase() + ': ' + esc(m.t) + ', ' + fmt.n(t.kcal) + ' calories, ' + fmt.n(Math.round(t.p)) + ' grams of protein">' +
        '<span class="l">Log ' + esc(mk.slotWord(m.slot)).toLowerCase() + '</span><span class="r"><small><span>' + fmt.n(t.kcal) + ' kcal</span><span>' + fmt.n(Math.round(t.p)) + ' g protein</span></small>' + h.icon('check', 30, 3.2) + '</span></button>' +
        '<button type="button" class="c3-btn-quiet bare mk-sm" data-act="mhalf" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mhalf-' + esc(key) + '-' + i + '">Half</button>';
      else if(key === today) acts += '<button type="button" class="c3-btn-quiet mk-log" data-act="mlog" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mlog-' + esc(key) + '-' + i + '" aria-label="Log ' + esc(m.t) + ', ' + fmt.n(t.kcal) + ' calories">' + h.icon('plus', 14, 3) + '<span>Log</span></button>' +
        '<button type="button" class="c3-btn-quiet bare mk-sm" data-act="mhalf" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mhalf-' + esc(key) + '-' + i + '">Half</button>';
      if(key >= today) acts += '<button type="button" class="c3-btn-quiet bare mk-sm' + (open ? ' on' : '') + '" data-act="mswap" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mswap-' + esc(key) + '-' + i + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + mk.icon('swap', 15, 2.4) + '<span>Swap</span></button>';
      if(key >= today) acts += '<button type="button" class="c3-btn-quiet bare mk-sm mk-lk' + (m.locked ? ' on' : '') + '" data-act="mlock" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mlock-' + esc(key) + '-' + i + '" aria-pressed="' + (m.locked ? 'true' : 'false') + '" aria-label="' + (m.locked ? 'Unlock' : 'Lock') + ' this meal">' + mk.icon('lock', 14, 2.4) + '<span>' + (m.locked ? 'Locked' : 'Lock') + '</span></button>';
    }
    return '<li class="mk-meal' + (m.logged ? ' logged' : '') + (next ? ' next' : '') + '">' +
      '<span class="mk-sl">' + esc(mk.slotWord(m.slot)) + '<i>' + esc(m.time || '') + '</i></span>' +
      '<button type="button" class="mk-nm" data-act="mrecipe" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mrecipe-' + esc(key) + '-' + i + '" aria-label="' + esc(m.t) + ', the recipe">' +
        '<b>' + esc(m.t) + '</b><small>' + esc(sub.join(' · ')) + '</small></button>' +
      '<span class="mk-kv"><b>' + fmt.n(t.kcal) + '</b><small> kcal</small></span><span class="mk-pv"><b>' + fmt.n(Math.round(t.p)) + '</b><small> g</small></span>' +
      '<span class="mk-acts">' + acts + '</span>' +
      (open ? mk.swapPanel(key, i, st.swapq || '') : '') + '</li>';
  };
  mk.meals = function(key, st, opt){
    var D = mk.day(key); if(!D) return '';
    if(D.off) return '<p class="mk-none">Eating out this day: nothing planned, nothing on the grocery list.</p>';   /* v327 */
    var o = null;
    if(opt && opt.next && key === mk.today()){
      var j = -1;
      /* v372: a meal asked for (the daily guide's breakfast, lunch or dinner, a meal reminder) carries it when not yet logged */
      if(opt.slot) D.meals.forEach(function(m, i){ if(j < 0 && !m.logged && m.slot === opt.slot) j = i; });
      if(j < 0) D.meals.forEach(function(m, i){ if(j < 0 && !m.logged) j = i; });
      if(j >= 0) o = {next: j};
    }
    return '<ul class="mk-list">' + D.meals.map(function(m, i){ return mk.mealRow(key, i, m, st, o); }).join('') + '</ul>';
  };

  /* the options for one meal: solved to the same numbers */
  mk.swapPanel = function(key, i, q){
    var opts = safe(function(){ return mpOptions(key, i, q, 6); }, []) || [], m = (mk.day(key) || {meals:[]}).meals[i] || {};
    return '<div class="mk-swap" role="region" aria-label="Other meals for this ' + esc(mk.slotWord(m.slot)).toLowerCase() + '">' +
      '<label class="mk-find"><span class="k">Find a meal</span><input class="yd-in" type="search" data-chg="mswapq" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mswapq" value="' + esc(q || '') + '" placeholder="Chicken, tacos, 15 min, vegan" autocomplete="off"></label>' +
      (opts.length ? '<ul class="mk-opts">' + opts.map(function(o){
        return '<li><span class="on"><b>' + esc(o.t) + '</b><small>' + esc([o.cu, (o.tags || []).indexOf('slow-cooker') >= 0 ? 'slow cooker' : (o.min ? o.min + ' min' : 'no cooking')].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="om c3-num"><b>' + fmt.n(o.tot.kcal) + '</b> kcal <b>' + fmt.n(Math.round(o.tot.p)) + '</b> g P <span>' + fmt.n(Math.round(o.tot.c)) + ' C · ' + fmt.n(Math.round(o.tot.f)) + ' F</span></span>' +
          '<button type="button" class="c3-btn-quiet mk-use" data-act="muse" data-k="' + esc(key) + '" data-i="' + i + '" data-v="' + esc(o.rid) + '" data-key="muse-' + esc(o.rid) + '">Use</button></li>';
      }).join('') + '</ul>' : '<p class="mk-none">Nothing else fits that search and your settings.</p>') +
      '<div class="mk-swapacts"><button type="button" class="c3-btn-quiet bare mk-sm" data-act="mnever" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mnever">' + mk.icon('x', 14, 2.8) + '<span>Never plan ' + esc(m.t || 'this') + '</span></button>' +
      '<button type="button" class="c3-btn-quiet bare mk-sm" data-act="mswap" data-k="' + esc(key) + '" data-i="' + i + '" data-key="mswapclose">Close</button></div></div>';
  };

  /* the controls, for any screen that draws these rows. Returns true when it handled the action. */
  mk.act = function(a, el, ctx){
    var key = el.getAttribute('data-k'), i = +el.getAttribute('data-i'), st = ctx.state;
    var undo = function(msg, back){ safe(function(){ offerUndo(msg, function(){ back(); try{ save(); }catch(e){} }); }); };
    if(a === 'mlog' || a === 'mhalf'){
      var m = (mk.day(key) || {meals:[]}).meals[i]; if(!m) return true;
      var n = safe(function(){ return mpLog(key, i, a === 'mhalf' ? 0.5 : 1); }, 0), t = mk.tot(m);
      undo('<b>' + esc(m.t) + '</b>' + (a === 'mhalf' ? ', half' : '') + ' logged: ' + fmt.n(Math.round(t.kcal * (a === 'mhalf' ? 0.5 : 1))) + ' kcal, ' + n + ' food' + (n === 1 ? '' : 's') + '.', function(){ safe(function(){ mpUnlog(key, i); }); });
      safe(function(){ drawAll(); }); C3.refresh(); if(n>0&&key===mk.today()&&C3.daily)C3.daily.after('meal'); return true;
    }
    if(a === 'munlog'){ safe(function(){ mpUnlog(key, i); }); safe(function(){ drawAll(); }); C3.refresh(); return true; }
    if(a === 'mswap'){ var k = key + ':' + i,closing=st.swap===k,back=C3.params.returnTo;ctx.set({swap:closing?null:k,swapq:''});if(closing&&back)C3.go('recipe',back);return true; }
    if(a === 'muse'){
      var rid = el.getAttribute('data-v'), was = safe(function(){ return mpSwap(key, i, rid); }, null);
      ctx.set({swap: null, swapq: ''});
      if(was){ var now = (mk.day(key) || {meals:[]}).meals[i];
        undo('<b>' + esc(now ? now.t : '') + '</b> in, instead of ' + esc(was.t) + '.', function(){ var D = mk.day(key); if(D){ D.meals[i] = was; safe(function(){ mpFixDay(D, D.aim); }); } }); }
      safe(function(){ drawAll(); }); C3.refresh(); return true;
    }
    if(a === 'mnever'){
      var mm = (mk.day(key) || {meals:[]}).meals[i]; if(!mm) return true;
      var rid2 = mm.rid, title = mm.t;
      safe(function(){ mpNever(rid2); });
      ctx.set({swap: null});
      undo('<b>' + esc(title) + '</b> will not be planned again.', function(){ var M = ALL.mealPrefs || {}; if(M.never) delete M.never[rid2]; safe(function(){ mpEnsure(true); }); });
      C3.refresh(); return true;
    }
    if(a === 'mlock'){ safe(function(){ mpToggleLock(key, i); }); C3.render(); return true; }
    if(a === 'mrecipe'){ C3.go('recipe', {k: key, i: i, from: ctx.name}); return true; }
    if(a === 'mregen'){
      var before = JSON.stringify(mk.day(key));
      if(safe(function(){ return mpRegenDay(key); }, false)) undo('New meals for ' + esc(mk.word(key, {weekday:'long'})) + '.', function(){ var p = mk.plan(); p.days[key] = JSON.parse(before); });
      safe(function(){ drawAll(); }); C3.refresh(); return true;
    }
    return false;
  };
  mk.chg = function(a, el, ctx){
    if(a === 'mswapq'){ ctx.set({swapq: el.value}); return true; }
    return false;
  };
  /* typing in Find a meal answers as it is typed (the field keeps its focus through the repaint, by data-key) */
  mk.wireFind = function(root, ctx){
    var f = root.querySelector('[data-key="mswapq"]'); if(!f) return;
    var tm = 0; f.addEventListener('input', function(){ clearTimeout(tm); var v = f.value; tm = setTimeout(function(){ ctx.state.swapq = v; C3.render(); }, 180); });
  };
})();
