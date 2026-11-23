/* C3 screen: plan (v325). The meal plan, 28 days ahead, built and kept by the planner (mpEnsure).
   Week: the seven days as bars, the day picked as its meals (Log, Swap, the recipe), the rest of the week in a line
   each, a new day, a new week. Month: the four weeks as a calendar of planned calories. Groceries: the plan itself as
   a list, merged, by aisle, in what to buy, for the household, ticks kept, copy or share it. Settings: everything the
   planner reads (diet, allergies, foods you never want, cuisines, meals a day, cooking time, household, leftovers,
   slow cooker, budget, variety, favorites and never-again). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, fmt = h.fmt, safe = yd.safe, mk = C3.mk;
    var TABS = [['week', 'Week'], ['month', 'Month'], ['groc', 'Groceries'], ['prefs', 'Settings']];
    /* which days the grocery list covers: this week, next, two weeks, or one calendar week from the month */
    function grRange(st, today){
      var R = st.gr || 'this';
      if(R === 'wk' && st.grFrom){ var f = st.grFrom < today ? today : st.grFrom; var off = Math.round((new Date(f + 'T12:00:00') - new Date(st.grFrom + 'T12:00:00')) / 864e5); return {from: f, days: Math.max(1, 7 - off)}; }
      return {from: R === 'next' ? mk.add(today, 7) : today, days: R === 'two' ? 14 : 7};
    }
    function keysFrom(k0, n){ var out = []; for(var i = 0; i < n; i++) out.push(mk.add(k0, i)); return out; }
    function weekStats(keys){
      var n = 0, k = 0, p = 0, meals = 0, cook = 0, left = 0, rids = {};
      keys.forEach(function(key){ var D = mk.day(key); if(!D) return; n++; var t = mk.dayTot(D); k += t.kcal; p += t.p;
        D.meals.forEach(function(m){ meals++; rids[m.rid] = 1; if(m.left) left++; else { var r = mk.recipe(m.rid); if(r && r.min > 10 && (r.tags || []).indexOf('no-cook') < 0) cook++; } }); });
      return {n: n, k: n ? Math.round(k / n) : 0, p: n ? Math.round(p / n) : 0, meals: meals, cook: cook, left: left, distinct: Object.keys(rids).length};
    }

    /* ---------- week ---------- */
    function weekTab(ctx){
      var st = ctx.state, today = mk.today(), w = Math.max(0, Math.min(3, st.wk || 0)), k0 = mk.add(today, w * 7), keys = keysFrom(k0, 7);
      var sel = st.day && keys.indexOf(st.day) >= 0 ? st.day : keys[0], S = weekStats(keys);
      var nav = '<div class="pl-nav">' + yd.btn('wk', '', {v: w - 1, icon:'back', aria:'Earlier week', cls:'pl-arrow', disabled: w === 0}) +
        '<b>' + esc(mk.word(keys[0], {month:'short', day:'numeric'})) + ' to ' + esc(mk.word(keys[6], {month:'short', day:'numeric'})) + (w === 0 ? ' <span>this week</span>' : '') + '</b>' +
        yd.btn('wk', '', {v: w + 1, icon:'chev', aria:'Later week', cls:'pl-arrow', disabled: w === 3}) + '</div>';
      var top = yd.stats([[fmt.n(S.k), 'kcal a day'], [String(S.p), 'g protein'], [String(S.distinct), 'meals'], [String(S.cook), 'times cooking']], 'pl-top');
      var rest = '<ul class="pl-rest">' + keys.filter(function(k){ return k !== sel; }).map(function(k){
        var D = mk.day(k); if(!D) return '';
        var t = mk.dayTot(D);
        return '<li><button type="button" class="pl-restrow" data-act="mday" data-v="' + esc(k) + '" data-key="rest-' + esc(k) + '"><span class="d">' + esc(mk.word(k, {weekday:'short'})) + ' <span class="c3-num">' + new Date(k + 'T12:00:00').getDate() + '</span></span>' +
          '<span class="t">' + esc(D.meals.map(function(m){ return m.t; }).join(' · ')) + '</span><span class="k c3-num">' + fmt.n(t.kcal) + '</span></button></li>'; }).join('') + '</ul>';
      return top + nav + mk.strip(keys, sel) +
        '<div class="yd-cols"><div class="yd-col">' + yd.sec('', mk.dayHead(sel) + mk.meals(sel, st) +
          '<div class="yd-acts">' + (sel >= today ? yd.btn('mregen', 'New meals for ' + (sel === today ? 'today' : mk.word(sel, {weekday:'long'})), {icon:'refresh', extra:'data-k="' + esc(sel) + '"'}) : '') + '</div>', {id:'day', aria:'The day'}) + '</div>' +
        '<div class="yd-col">' + yd.sec('The rest of the week', rest, {id:'rest'}) +
          '<div class="yd-acts">' + yd.btn('regenweek', 'New meals for the whole week', {icon:'refresh', v: k0}) + '</div>' +
          yd.note('Locked meals, meals you swapped in and meals you logged stay. Every day is solved to its own numbers: training days toward the top of your range, rest days toward the bottom.') + '</div></div>';
    }

    /* ---------- month (v327): the calendar that tells you how it went and what is coming ---------- */
    function eaten(k){ return safe(function(){ return dayTotals(k); }, null) || {kcal: 0, p: 0, n: 0}; }
    function evs(k){ return safe(function(){ return calInOn(k); }, []) || []; }
    function batch(k, D){ var nx = mk.day(mk.add(k, 1)); return !!(nx && !nx.off && D.meals.some(function(m){ return m.slot === 'dinner' && !m.left && nx.meals.some(function(x){ return x.left === k && x.rid === m.rid; }); })); }
    function shopDay(k, today){ var ws = mk.add(k, -C3.cx.dow(k)); var first = ws < today ? today : ws; return k === first; }
    function tone(k, D, today){
      var a = D.aim || {}, t = eaten(k);
      if(k <= today && t.kcal > 0) return {tone: t.kcal < a.lo ? 'under' : t.kcal > a.hi ? 'over' : 'ok', frac: a.k ? t.kcal / a.k : 0, val: t.kcal, eaten: true};
      if(k < today) return {tone: D.off ? 'plan' : 'miss', frac: 0, val: null};
      return {tone: 'plan', frac: 0, val: D.off ? null : mk.dayTot(D).kcal};
    }
    function foodCell(k, today){
      var D = mk.day(k), E = evs(k);
      if(!D) return {none: true, label: mk.word(k) + ', nothing planned'};
      var T = tone(k, D, today), marks = [], all = D.meals.length && D.meals.every(function(m){ return m.logged; });
      if(D.off) marks.push('out');
      if(k <= today && all) marks.push('check');
      if(k >= today && !D.off && shopDay(k, today)) marks.push('cart');
      if(!D.off && D.busy) marks.push('bolt');
      if(D.tr) marks.push('dumb');
      if(!D.off && k >= today && batch(k, D)) marks.push('box');
      if(E.length) marks.push('cal');
      var words = [mk.word(k)];
      if(T.eaten) words.push(fmt.n(Math.round(T.val)) + ' calories eaten of ' + fmt.n(D.aim.k) + (T.tone === 'ok' ? ', on target' : T.tone === 'under' ? ', under' : ', over'));
      else if(k < today && !D.off) words.push('nothing logged');
      else if(!D.off) words.push(fmt.n(T.val) + ' calories planned');
      if(D.off) words.push('eating out');
      if(D.tr) words.push('training day');
      if(D.busy) words.push('busy evening, a quick dinner');
      if(E.length) words.push(E.length + (E.length === 1 ? ' event' : ' events') + ' on your calendar');
      var dn = D.meals.filter(function(m){ return m.slot === 'dinner'; })[0];
      return {frac: T.frac, tone: T.tone, val: D.off ? 'out' : T.val == null ? '' : fmt.n(Math.round(T.val)), marks: marks, label: words.join(', '), sub: D.off ? 'Eating out' : dn ? dn.t : ''};
    }
    function foodWeek(w, today){
      var past = [], ahead = [];
      w.forEach(function(k){ var D = mk.day(k); if(!D) return; if(k < today) past.push([k, D]); else ahead.push([k, D]); });
      var bits = [];
      var logged = past.filter(function(x){ return eaten(x[0]).kcal > 0; }), onT = logged.filter(function(x){ var t = eaten(x[0]).kcal; return t >= x[1].aim.lo && t <= x[1].aim.hi; });
      if(logged.length) bits.push('<span class="s">' + C3.cx.icon('check', 13, 3) + '<span><b>' + onT.length + ' of ' + logged.length + '</b> on target, avg <b>' + fmt.n(Math.round(logged.reduce(function(a, x){ return a + eaten(x[0]).kcal; }, 0) / logged.length)) + '</b> eaten</span></span>');
      else if(past.length && !ahead.length) bits.push('<span class="s"><span>Nothing logged this week</span></span>');
      var on = ahead.filter(function(x){ return !x[1].off; });
      if(on.length){
        var k = 0, p = 0; on.forEach(function(x){ var t = mk.dayTot(x[1]); k += t.kcal; p += t.p; });
        bits.push('<span class="s"><span>Avg <b>' + fmt.n(Math.round(k / on.length)) + '</b> kcal, <b>' + Math.round(p / on.length) + '</b> g protein</span></span>');
        var b = on.filter(function(x){ return batch(x[0], x[1]); }).length; if(b) bits.push('<span class="s">' + C3.cx.icon('box', 13, 2.6) + '<span><b>' + b + '</b> cook once, eat twice</span></span>');
        var q = on.filter(function(x){ return x[1].busy; }).length; if(q) bits.push('<span class="s">' + C3.cx.icon('bolt', 13, 2.6) + '<span><b>' + q + '</b> quick ' + (q === 1 ? 'dinner' : 'dinners') + '</span></span>');
      }
      var outN = ahead.filter(function(x){ return x[1].off; }).length; if(outN) bits.push('<span class="s">' + C3.cx.icon('out', 13, 2.6) + '<span><b>' + outN + '</b> out</span></span>');
      if(on.length) bits.push('<button type="button" class="go" data-act="mgweek" data-v="' + esc(w[0]) + '" data-key="mgweek-' + esc(w[0]) + '">' + C3.cx.icon('cart', 15, 2.6) + '<span>Groceries</span></button>');
      return bits.join('');
    }
    function foodPanel(k, st, today){
      var D = mk.day(k); if(!D) return '';
      var a = D.aim, t = eaten(k), past = k <= today && t.kcal > 0, pl = mk.dayTot(D);
      var T = tone(k, D, today);
      var bars = '<div class="cx-bars">' + C3.cx.bar('Calories', past ? t.kcal : (D.off ? 0 : pl.kcal), a.k, a.lo, a.hi, 'kcal', past ? T.tone : 'plan') +
        C3.cx.bar('Protein', past ? t.p : (D.off ? 0 : pl.p), a.p, 0, 0, 'g', past ? (t.p >= a.p - 5 ? 'ok' : 'under') : 'plan') + '</div>';
      var E = evs(k), ev = E.length ? '<ul class="cx-evs" aria-label="On your calendar">' + E.map(function(e){ return '<li><span class="w">' + esc(e.all ? 'All day' : new Date(e.s).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'})) + '</span><span class="t">' + esc(e.t) + (e.where ? '<small>' + esc(e.where) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' : '';
      var acts = [], open = D.meals.filter(function(m){ return !m.logged; }).length, any = D.meals.some(function(m){ return m.logged; });
      if(!D.off && k <= today && open) acts.push(yd.btn('mlogday', k === today ? 'Log the rest of today' : 'I ate the plan', {v: k, icon:'check', pink: true}));
      if(!D.off && k >= today) acts.push(yd.btn('mregen', 'New meals', {icon:'refresh', extra:'data-k="' + esc(k) + '"'}));
      if(k >= today && !any) acts.push(yd.btn('moff', D.off ? 'Back on the plan' : 'Eating out', {v: k, icon: D.off ? 'plus' : 'x'}));
      var body = D.off ? '<p class="cx-off">' + C3.cx.icon('out', 18, 2.4) + '<span>Eating out. Nothing planned, nothing on the grocery list.</span></p>' : mk.meals(k, st);
      return mk.dayHead(k) + (D.busy && !D.off ? '<p class="mk-reb">' + C3.cx.icon('bolt', 15, 2.6) + '<span>Busy evening on your calendar: dinner takes 20 minutes or less.</span></p>' : '') + bars + ev + body +
        (acts.length ? '<div class="cx-dayacts">' + acts.join('') + '</div>' : '');
    }
    function monthTab(ctx){
      var st = ctx.state, today = mk.today(), first = mk.add(today, -7), last = mk.add(today, 27);
      var weeks = C3.cx.weeks(first, last), sel = st.mday || today;
      /* the two weeks behind: how it went */
      var L = 0, T = 0, sumK = 0;
      for(var i = 1; i <= 14; i++){ var k = mk.add(today, -i), D = mk.day(k); if(!D || D.off) continue; var e = eaten(k).kcal; if(e > 0){ L++; sumK += e; if(e >= D.aim.lo && e <= D.aim.hi) T++; } }
      var ahead = [], rids = {}, b = 0;
      for(var j = 0; j < 28; j++){ var kk = mk.add(today, j), DD = mk.day(kk); if(!DD || DD.off) continue; ahead.push(kk); DD.meals.forEach(function(m){ rids[m.rid] = 1; }); if(batch(kk, DD)) b++; }
      var top = yd.stats([
        [L ? T + ' of ' + L : '·', L ? 'days on target, 2 weeks' : 'log a day to see it', L ? (T / L >= 0.7 ? 'good' : T / L >= 0.4 ? 'warn' : 'bad') : ''],
        [L ? fmt.n(Math.round(sumK / L)) : '·', 'kcal a day eaten'],
        [String(Object.keys(rids).length), 'different meals ahead'],
        [String(b), 'cook once, eat twice']], 'pl-top');
      var cal = C3.cx.month({weeks: weeks, sel: sel, today: today, act: 'mpick', aria: 'Your meal plan, last week and four weeks ahead',
        cell: function(k){ return foodCell(k, today); }, week: function(w){ return foodWeek(w, today); }, panel: function(k){ return foodPanel(k, st, today); },
        key: C3.cx.key([['ring:ok', 'on target'], ['ring:under', 'under'], ['ring:over', 'over'], ['ring:miss', 'not logged'], ['ring:plan', 'planned'], ['dumb', 'training'], ['box', 'cook once, eat twice'], ['bolt', 'quick dinner'], ['cart', 'shop'], ['out', 'eating out'], ['cal', 'your calendar']])});
      return top + yd.sec(mk.word(first, {month:'long'}) + (mk.word(last, {month:'long'}) !== mk.word(first, {month:'long'}) ? ' to ' + mk.word(last, {month:'long'}) : ''), cal, {id:'month'}) + C3.cx.connect(ctx, {what: 'food'});
    }

    /* ---------- groceries ---------- */
    function grocTab(ctx){
      var st = ctx.state, today = mk.today(), R = st.gr || 'this', G = grRange(st, today), from = G.from, days = G.days;
      var editKey=from+'|'+days,stored=((ALL.journeyPrefs||{}).groceryLists||{})[editKey];
      var retained=((ALL.journeySetup||{}).groceryDrafts||{})[editKey];
      var editable=st.groceryKey===editKey&&st.groceryText!=null?st.groceryText:retained&&!retained.complete?retained.text:stored&&!stored.reset?stored.text:safe(function(){return mpGroceryText(from,days);},'');
      var editor='<details class="pl-grocery-edit"><summary>Edit shopping list</summary><label>Shopping list<textarea data-chg="groceryText" data-key="groceryText" maxlength="12000">'+esc(editable)+'</textarea></label><p>Adjust quantities or add anything else you need. Copy and Share use your saved list.</p><p role="alert">'+esc(st.groceryError||'')+'</p><div class="yd-acts">'+yd.btn('gsave','Save shopping list',{extra:'data-commit'})+yd.btn('gcancel','Cancel')+yd.btn('greset','Reset from meal plan')+'</div></details>';
      var items = safe(function(){ return mpGrocery(from, days); }, []) || [], P = mk.prefs();
      var main = items.filter(function(x){ return !x.staple; }), stap = items.filter(function(x){ return x.staple; });
      var left = main.filter(function(x){ return !x.on; }).length;
      var segs = [['this', 'This week'], ['next', 'Next week'], ['two', 'Two weeks']]; if(R === 'wk' && st.grFrom) segs.push(['wk', 'Week of ' + mk.word(st.grFrom, {month:'short', day:'numeric'})]);
      var seg = yd.seg('gr', segs, R, {aria:'Which days to shop for', cls:'pl-seg'});
      var hh = '<div class="pl-hh"><span class="k">Shopping for</span>' + yd.btn('hh', '', {v: P.household - 1, icon:'minus', aria:'One person fewer', disabled: P.household <= 1, cls:'pl-step'}) +
        '<b class="c3-num">' + P.household + '</b><span>' + (P.household === 1 ? 'person' : 'people') + '</span>' + yd.btn('hh', '', {v: P.household + 1, icon:'plus', aria:'One person more', disabled: P.household >= 8, cls:'pl-step'}) + '</div>';
      var row = function(it){
        return '<li><button type="button" class="pl-gi' + (it.on ? ' on' : '') + '" data-act="gtick" data-v="' + esc(it.id) + '" data-key="g-' + esc(it.id) + '" aria-pressed="' + (it.on ? 'true' : 'false') + '">' +
          '<span class="ck" aria-hidden="true">' + (it.on ? h.icon('check', 14, 3.4) : '') + '</span><span class="gn">' + esc(it.n) + '</span>' +
          '<span class="q c3-num">' + esc(it.qty) + (it.as ? ' <small>' + esc(it.as) + '</small>' : '') + '</span></button></li>';
      };
      var by = function(list){ var out = '', a = ''; list.forEach(function(it){ if(it.aisle !== a){ if(a) out += '</ul>'; a = it.aisle; out += '<h3 class="pl-aisle">' + esc(a) + '</h3><ul class="pl-gl">'; } out += row(it); }); return out + (a ? '</ul>' : ''); };
      var top = yd.stats([[String(left), 'to get'], [String(main.length - left), 'in the cart'], [String(stap.length), 'pantry staples']], 'pl-top');
      return top + '<div class="yd-acts pl-gtop">' + seg + hh + '</div>' +
        '<div class="yd-acts">' + yd.btn('gcopy', 'Copy the list', {icon:'copy'}) + (navigator.share ? yd.btn('gshare', 'Share', {icon:'share'}) : '') + '</div>' + editor + (stored&&!stored.reset?'<section class="pl-custom-saved"><h2 class="c3-h2">Your saved shopping list</h2><p>'+esc(stored.text||'Nothing on your saved list.').replace(/\n/g,'<br>')+'</p></section><h2 class="c3-h2">Original meal-plan quantities</h2>':'') +
        (items.length ? by(main) +
          (stap.length ? '<button type="button" class="c3-btn-quiet bare pl-stap" data-act="gstap" data-key="gstap" aria-expanded="' + (st.stap ? 'true' : 'false') + '">' + h.icon(st.stap ? 'minus' : 'plus', 15, 3) + '<span>Probably in your pantry</span><b class="c3-num">' + stap.length + '</b></button>' + (st.stap ? by(stap) : '') : '') +
          yd.note('Meat and fish are the raw weight to buy, rice, pasta and grains the dry weight, worked from USDA\'s raw and cooked numbers. Canned beans are drained weight. Leftover lunches are cooked with the dinner before, so they are on this list.')
        : yd.empty('Nothing to buy for these days.'));
    }

    /* ---------- settings ---------- */
    function prefsTab(ctx){
      var P = mk.prefs(), st = ctx.state;
      var chips = function(act, list, on){ return '<div class="pl-chips" role="group">' + list.map(function(x){ var v = x[0], l = x[1], a = on.indexOf(v) >= 0;
        return '<button type="button" class="yd-opt' + (a ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '" data-key="' + act + '-' + esc(v) + '" aria-pressed="' + (a ? 'true' : 'false') + '">' + esc(l) + '</button>'; }).join('') + '</div>'; };
      var dis = P.dislikes.map(function(id){ var f = safe(function(){ return foodById(id); }, null); return '<button type="button" class="pl-tag" data-act="undis" data-v="' + esc(id) + '" data-key="undis-' + esc(id) + '" aria-label="Allow ' + esc(f ? f.n : id) + ' again">' + esc(f ? f.n : id) + yd.icon('x', 13, 2.8) + '</button>'; }).join('');
      var q = String(st.dq || '').trim().toLowerCase(), hits = q.length >= 2 ? (safe(function(){ return allFoods(); }, []) || []).filter(function(f){ return P.dislikes.indexOf(f.id) < 0 && ((f.n || '') + ' ' + (f.a || '')).toLowerCase().indexOf(q) >= 0; }).slice(0, 6) : [];
      var favs = Object.keys(P.fav).map(function(id){ var r = mk.recipe(id); return r ? '<button type="button" class="pl-tag fav" data-act="unfav" data-v="' + esc(id) + '" data-key="unfav-' + esc(id) + '">' + yd.icon('heart', 13, 2.4) + esc(r.t) + yd.icon('x', 13, 2.8) + '</button>' : ''; }).join('');
      var nev = Object.keys(P.never).map(function(id){ var r = mk.recipe(id); return r ? '<button type="button" class="pl-tag" data-act="unnever" data-v="' + esc(id) + '" data-key="unnever-' + esc(id) + '" aria-label="Plan ' + esc(r.t) + ' again">' + esc(r.t) + yd.icon('x', 13, 2.8) + '</button>' : ''; }).join('');
      return '<div class="yd-cols"><div class="yd-col">' +
        yd.sec('How you eat', yd.seg('diet', MP_DIETS, P.diet, {aria:'Diet', cls:'pl-seg wrap2'}), {id:'diet'}) +
        yd.sec('Never in my plan', chips('allergy', MP_ALLERGY, P.allergies) +
          '<div class="pl-tags">' + dis + '</div>' +
          '<label class="mk-find"><span class="k">A food you never want</span><input class="yd-in" type="search" data-key="dq" value="' + esc(st.dq || '') + '" placeholder="Mushrooms, olives, salmon" autocomplete="off"></label>' +
          (hits.length ? '<div class="pl-tags">' + hits.map(function(f){ return '<button type="button" class="pl-tag add" data-act="dis" data-v="' + esc(f.id) + '" data-key="dis-' + esc(f.id) + '">' + h.icon('plus', 13, 3) + esc(f.n) + '</button>'; }).join('') + '</div>' : (q.length >= 2 ? yd.empty('No food by that name.') : '')), {id:'avoid'}) +
        yd.sec('Cuisines I like', chips('cui', MP_CUISINES.map(function(c){ return [c, c]; }), P.cuisines), {id:'cuisine'}) +
        yd.sec('Favorites', favs ? '<div class="pl-tags">' + favs + '</div>' : yd.empty('Tap the heart on a recipe and it comes up more often.'), {id:'fav'}) +
        (nev ? yd.sec('Never again', '<div class="pl-tags">' + nev + '</div>', {id:'never'}) : '') +
      '</div><div class="yd-col">' +
        yd.sec('Meals a day', yd.seg('meals', [[3, '3'], [4, '4'], [5, '5'], [6, '6']], P.meals, {aria:'Meals a day', cls:'pl-seg nums'}), {id:'meals'}) +
        yd.sec('Cooking time, weekdays', yd.seg('cwd', [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour']], P.cookWeekday, {aria:'Most minutes to cook on a weekday', cls:'pl-seg fill'}), {id:'cwd'}) +
        yd.sec('Cooking time, weekends', yd.seg('cwe', [[30, '30 min'], [60, '1 hour'], [90, '90 min'], [120, '2 hours']], P.cookWeekend, {aria:'Most minutes to cook on a weekend day', cls:'pl-seg fill'}), {id:'cwe'}) +
        yd.sec('Household', yd.seg('hhs', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], P.household, {aria:'People eating these meals', cls:'pl-seg nums'}) + yd.note('Portions are yours; the grocery list and the recipes scale for everyone.'), {id:'hh'}) +
        yd.sec('Budget', yd.seg('bud', [['tight', 'Tight'], ['normal', 'Normal'], ['open', 'No limit']], P.budget, {aria:'Food budget', cls:'pl-seg fill'}), {id:'bud'}) +
        yd.sec('Variety', yd.seg('var', [['simple', 'Keep it simple'], ['balanced', 'Balanced'], ['max', 'Most variety']], P.variety, {aria:'Variety', cls:'pl-seg fill wrap2'}), {id:'var'}) +
        yd.sec('', '<ul class="yd-list">' + '<li>' + yd.sw('left', P.leftovers, 'Leftovers for lunch', 'A batch dinner is the next day\'s lunch') + '</li>' + '<li>' + yd.sw('slow', P.slowCooker, 'Slow cooker meals', 'Twenty minutes of work, dinner by evening') + '</li>' + '</ul>', {id:'sw', aria:'Leftovers and slow cooker'}) +
        yd.note('A change rebuilds the days ahead. What you logged, locked or swapped in stays.') +
      '</div></div>';
    }

    yd.screen('plan', {
      hold:function(){return !!(C3.root&&C3.root.querySelector('.pl-grocery-edit[open]'));},
      parent: 'food', nav: 'food',
      fall: function(){ C3.go('food'); },
      /* C3.go clears a screen's state after enter(), so the door's params (tab, day, swap) are read on the first paint */
      enter: function(){ safe(function(){ mpLoad(); }); },
      render: function(ctx){
        var st = ctx.state, p0 = ctx.params || {};
        var pk = JSON.stringify(p0);
        if(st._in !== pk){ st._in = pk; if(p0.tab) st.tab = p0.tab; if(p0.swap) st.swap = p0.swap; st.from = p0.from || '';   /* v357: Back goes where it was opened from (the log bar) */
          if(p0.day){ var dd = Math.round((new Date(p0.day + 'T12:00:00') - new Date(mk.today() + 'T12:00:00')) / 864e5); st.wk = Math.max(0, Math.min(3, Math.floor(dd / 7))); st.day = p0.day; } }
        var tab = st.tab || 'week', today = mk.today();
        var head = yd.head({back: st.from || 'food', eyebrow: mk.ready() ? '28 days ahead' : '', title:'Your', pk:'plan'});
        var aim = safe(function(){ return mpAim(today); }, null);
        if(!aim){ var ne = safe(function(){ return lwNeeds(); }, null);
          return '<div class="yd pl">' + head + yd.sec('', yd.empty('Your plan is sized to your calories and protein.') + '<div class="yd-acts">' + yd.btn('needs', 'Add ' + (ne && ne.words ? ne.words : 'a weigh-in'), {icon:'plus'}) + '</div>', {id:'needs'}) + '</div>'; }
        if(!mk.ready()) return '<div class="yd pl" aria-busy="true">' + head + C3.journey.mealLoading('Building your plan.') + '</div>';
        if(!mk.day(today)) safe(function(){ mpEnsure(); });
        var body = tab === 'month' ? monthTab(ctx) : tab === 'groc' ? grocTab(ctx) : tab === 'prefs' ? prefsTab(ctx) : weekTab(ctx);
        return '<div class="yd pl pl-' + esc(tab) + '">' + head + '<p class="pl-line">' + esc(mk.line()) + '</p>' +
          yd.seg('tab', TABS, tab, {aria:'Plan views', cls:'pl-tabs fill'}) + body + '</div>';
      },
      leave: function(){},
      wire: function(root, ctx){
        var st = ctx.state, today = mk.today();
        var setP = function(patch){ safe(function(){ mpSetPrefs(patch); }); safe(function(){ drawAll(); }); C3.render(); };
        var P = mk.prefs();
        var toggle = function(list, v){ var a = list.slice(), i = a.indexOf(v); if(i >= 0) a.splice(i, 1); else a.push(v); return a; };
        var acts = Object.assign({}, C3.cx.connectActs(ctx), {
          tab: function(v){ ctx.set({tab: v, swap: null}); },
          wk: function(v){ ctx.set({wk: +v, day: null, swap: null}); },
          mday: function(v){ ctx.set({day: v, swap: null}); },
          /* the day opens under its own week; a second tap on it closes it */
          mpick: function(v){ ctx.set({mday: (st.mday || today) === v ? 'none' : v, swap: null}); setTimeout(function(){ var el = root.querySelector('.cx-panel'); if(el){ var r = el.getBoundingClientRect(); if(r.top > window.innerHeight * 0.75 || r.top < 0) el.scrollIntoView({block:'nearest', behavior:'smooth'}); } }, 60); },
          mgweek: function(v){ ctx.set({tab: 'groc', gr: 'wk', grFrom: v}); },
          mlogday: function(v){ var D = mk.day(v); var done = safe(function(){ return mpLogDay(v); }, []) || []; safe(function(){ drawAll(); });
            if(done.length) safe(function(){ offerUndo('<b>' + done.length + (done.length === 1 ? ' meal' : ' meals') + '</b> logged for ' + (v === today ? 'today' : mk.word(v, {weekday:'long'})) + '.', function(){ done.forEach(function(i){ try{ mpUnlog(v, i); }catch(e){} }); try{ drawAll(); }catch(e){} C3.render(); }); });
            C3.render(); },
          moff: function(v){ var D = mk.day(v); if(!D) return; var on = !D.off; var ok = safe(function(){ return mpSetOff(v, on); }, false); if(!ok){ yd.toast('A day with something logged stays on the plan.', 'warn'); return; }
            safe(function(){ drawAll(); }); if(on) safe(function(){ offerUndo('Eating out ' + mk.word(v, {weekday:'long'}) + '. Off the grocery list.', function(){ try{ mpSetOff(v, false); }catch(e){} C3.render(); }); }); C3.render(); },
          regenweek: function(v){ var p = mk.plan(), before = JSON.stringify(p.days); var n = safe(function(){ return mpRegenWeek(v); }, 0);
            safe(function(){ offerUndo('New meals for ' + n + ' day' + (n === 1 ? '' : 's') + '.', function(){ p.days = JSON.parse(before); try{ save(); }catch(e){} }); }); safe(function(){ drawAll(); }); C3.render(); },
          gr: function(v){ ctx.set({gr: v}); },
          hh: function(v){ setP({household: Math.max(1, Math.min(8, +v))}); },
          gtick: function(v, b){ var from = grRange(st, today).from; safe(function(){ mpGroceryTick(from, v, b.getAttribute('aria-pressed') !== 'true'); }); C3.render(); },
          gstap: function(){ ctx.set({stap: !st.stap}); },
          gsave:function(){var G=grRange(st,today),key=G.from+'|'+G.days,input=root.querySelector('[data-chg="groceryText"]'),text=input?input.value:st.groceryText;if(typeof text!=='string'||text.length>12000){ctx.set({groceryError:'Keep the list within 12,000 characters.'});return;}var p=ALL.journeyPrefs=Object.assign({},ALL.journeyPrefs||{}),old=p.groceryLists;p.groceryLists=Object.assign({},old||{});p.groceryLists[key]={text:text,at:Date.now()};p.at=Date.now();save();if(!saveOk()){p.groceryLists=old;st.groceryKey=key;st.groceryText=text;ctx.set({groceryError:'This device could not save. Your edited list is still here.'});return;}if(ALL.journeySetup&&ALL.journeySetup.groceryDrafts)ALL.journeySetup.groceryDrafts[key]={complete:true,at:Date.now()};save();st.groceryText=null;st.groceryError='';yd.toast('Shopping list saved on this device.');C3.render();},
          gcancel:function(){var G=grRange(st,today),key=G.from+'|'+G.days;if(ALL.journeySetup&&ALL.journeySetup.groceryDrafts){ALL.journeySetup.groceryDrafts[key]={complete:true,at:Date.now()};ALL.journeySetup.at=Date.now();save();}st.groceryText=null;st.groceryError='';C3.render(true);},
          greset:function(){var G=grRange(st,today),key=G.from+'|'+G.days;st.groceryKey=key;st.groceryText=mpGroceryText(G.from,G.days);st.groceryError='';var setup=ALL.journeySetup=ALL.journeySetup||{};setup.groceryDrafts=Object.assign({},setup.groceryDrafts||{});setup.groceryDrafts[key]={text:st.groceryText,at:Date.now()};setup.at=Date.now();C3.journey.deferSave('groceries');C3.render(true);},
          gcopy: function(){ var G = grRange(st, today), edit=((ALL.journeyPrefs||{}).groceryLists||{})[G.from+'|'+G.days],txt = edit&&!edit.reset?edit.text:safe(function(){ return mpGroceryText(G.from, G.days); }, '');
            var done = function(){ yd.toast('The list is copied.'); }; try{ navigator.clipboard.writeText(txt).then(done, function(){ yd.toast('Copying is blocked here.', 'warn'); }); }catch(e){ yd.toast('Copying is blocked here.', 'warn'); } },
          gshare: function(){ var G = grRange(st, today),edit=((ALL.journeyPrefs||{}).groceryLists||{})[G.from+'|'+G.days],txt=edit&&!edit.reset?edit.text:safe(function(){ return mpGroceryText(G.from, G.days); }, ''); try{ navigator.share({title:'Groceries', text: txt}).catch(function(){}); }catch(e){} },
          diet: function(v){ setP({diet: v}); },
          allergy: function(v){ setP({allergies: toggle(P.allergies, v)}); },
          cui: function(v){ setP({cuisines: toggle(P.cuisines, v)}); },
          dis: function(v){ st.dq = ''; setP({dislikes: toggle(P.dislikes, v)}); },
          undis: function(v){ setP({dislikes: P.dislikes.filter(function(x){ return x !== v; })}); },
          unfav: function(v){ safe(function(){ mpFav(v, false); }); C3.render(); },
          unnever: function(v){ var M = ALL.mealPrefs || {}; var nv = Object.assign({}, M.never || {}); delete nv[v]; setP({never: nv}); },
          meals: function(v){ setP({meals: +v}); },
          cwd: function(v){ setP({cookWeekday: +v}); },
          cwe: function(v){ setP({cookWeekend: +v}); },
          hhs: function(v){ setP({household: +v}); },
          bud: function(v){ setP({budget: v}); },
          'var': function(v){ setP({variety: v}); },
          left: function(){ setP({leftovers: !P.leftovers}); },
          slow: function(){ setP({slowCooker: !P.slowCooker}); },
          needs: function(){ safe(function(){ lwAskNeeds(); }); }
        });
        ['mlog', 'mhalf', 'munlog', 'mswap', 'muse', 'mnever', 'mlock', 'mrecipe', 'mregen'].forEach(function(a){ acts[a] = function(v, b){ mk.act(a, b, ctx); }; });
        yd.wire(root, ctx, acts, {mswapq: function(v, el){ mk.chg('mswapq', el, ctx); },groceryText:function(v){var G=grRange(st,today);st.groceryKey=G.from+'|'+G.days;st.groceryText=v;}});
        var grocery=root.querySelector('[data-chg="groceryText"]');
        if(grocery)grocery.addEventListener('input',function(){var G=grRange(st,today),key=G.from+'|'+G.days;st.groceryKey=key;st.groceryText=grocery.value;var setup=ALL.journeySetup=ALL.journeySetup||{};setup.at=Date.now();setup.groceryDrafts=Object.assign({},setup.groceryDrafts||{});setup.groceryDrafts[key]={text:grocery.value,at:Date.now()};C3.journey.deferSave('groceries');});
        mk.wireFind(root, ctx);
        C3.cx.wireConnect(root, ctx);
        var dq = root.querySelector('[data-key="dq"]');
        if(dq){ var tm = 0; dq.addEventListener('input', function(){ clearTimeout(tm); var v = dq.value; tm = setTimeout(function(){ st.dq = v; C3.render(); }, 180); }); }
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
