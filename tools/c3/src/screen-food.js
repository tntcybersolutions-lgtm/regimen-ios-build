/* C3 screen: food. "How much protein is left, and add food in one tap."
   Today only. Every number comes from the app's own food functions (dayTotals,
   proteinTarget, calorieTarget, foodSearch, usualGrams, scaleFood, foodLog); every
   change goes through the app's own writers (foodAdd, foodDelete, tomb,
   save, offerUndo). Search, barcode, photo and the typed entry are the app's own
   flows inside its food diary, opened as a deep screen under the C3 bar. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  /* 26.7 -> "26.7", 23 -> "23" (the diary's own way of writing grams) */
  function g1(v){ v = Math.round((+v || 0) * 10) / 10; return String(v).replace(/\.0$/, ''); }
  function clamp01(x){ x = +x; return !(x > 0) ? 0 : x > 1 ? 1 : x; }
  function flv(){ return safe(function(){ return !!(C3.foodlog && C3.foodlog.available().voice); }, false); }
  function ico(d, size, sw){
    return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
  }
  var IC = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path>',
    scan:   '<path d="M3 8V5a2 2 0 0 1 2-2h3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M21 16v3a2 2 0 0 1-2 2h-3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path><path d="M8 8v8"></path><path d="M12 8v8"></path><path d="M16 8v8"></path>',
    photo:  '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"></path><circle cx="12" cy="13" r="3.4"></circle>',
    type:   '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"></path><path d="M14.5 7.5l3 3"></path>',
    mic:    '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path>',
    undo:   '<path d="M9 6L4 11l5 5"></path><path d="M4 11h10.5a5.5 5.5 0 0 1 0 11H12"></path>',
    redo:   '<path d="M20 12a8 8 0 1 1-2.34-5.66"></path><path d="M20 4v5h-5"></path>',
    x:      '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    menu:   '<rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M3.5 9h17"></path><path d="M3.5 14.5h17"></path><path d="M9.5 9v11"></path>',
    down:   '<path d="M6 9l6 6 6-6"></path>'
  };

  /* ---------- today, read fresh on every paint ---------- */
  function read(){
    var now = Date.now(), key = safe(function(){ return dkey(now); }, '');
    var t = safe(function(){ return dayTotals(key); }, null) || {kcal:0, p:0, c:0, f:0, fib:0, n:0, fibKnown:true};
    var rows = safe(function(){ return foodLog(key); }, []) || [];
    var pT = safe(function(){ return proteinTarget(); }, null);
    var cT = safe(function(){ return calorieTarget(); }, null);
    /* v321: the goal behind the numbers, the fat floor and the carbs left over, and what is missing when there is no target */
    var mT = safe(function(){ return macroTargets(); }, null);
    var gl = cT ? safe(function(){ return goalLine(cT); }, '') : '';
    var need = cT ? null : safe(function(){ return lwNeeds(); }, null);
    var foods = (safe(function(){ return foodSearch('', 10); }, []) || []).map(function(f){
      var g = safe(function(){ return usualGrams(f); }, 100) || 100;
      var s = safe(function(){ return scaleFood(f, g); }, null) || {kcal:0, p:0};
      return {id:f.id, n:f.n, g:g, kcal:s.kcal, p:s.p, today: rows.filter(function(e){ return e.id === f.id; }).length};
    });
    return {now:now, key:key, t:t, rows:rows, pT: pT > 0 ? pT : null, cT: (cT && cT.kcal > 0) ? cT : null, foods:foods,
            mT: mT, gl: gl, need: need, conflict: cT && cT.goal ? cT.goal.conflict : null, goal: cT && cT.goal ? cT.goal : null,
            water: h.fractions().water,
            bar: safe(function(){ return !!barcodeAvailable().ok; }, false),
            photo: safe(function(){ return !!photoAvailable().ok; }, false)};
  }

  /* ---------- the hero: protein, calories, the three macros ---------- */
  function protein(D){
    var p = D.t.p || 0, whole = Math.floor(p + 1e-9), dec = Math.round((p - whole) * 10);
    if(dec >= 10){ whole += 1; dec = 0; }
    var num = '<b>' + fmt.n(whole) + '</b>' + (dec ? '<small>.' + dec + '</small>' : '');
    var date = '<span class="fd-date">' + esc(fmt.date(D.now)) + '</span>';
    var eye = '<div class="c3-eyebrow fd-eye"><i></i>' + esc(fmt.date(D.now)) + ' · Food</div>';
    var lab = '<h1 class="fd-lab"><i></i>Protein</h1>';
    if(!D.pT){
      /* no weight on the log: the app has no target, so none is shown */
      return '<section class="fd-prot none" aria-label="Protein today">' + eye + lab + date +
        '<div class="fd-p-num' + (fmt.n(whole).length >= 4 ? ' long' : '') + '">' + num + '<span>g eaten</span></div>' +
        '<div class="fd-p-st"><button type="button" class="c3-btn-quiet bare fd-setw" data-sheet="weigh" data-key="setw">' + h.icon('plus', 16, 3) + '<span>Weigh in to set a target</span></button></div>' +
      '</section>';
    }
    var left = Math.max(0, Math.round((D.pT - p) * 10) / 10), hit = p >= D.pT, w = Math.round(clamp01(p / D.pT) * 1000) / 10;
    /* v362: "145 g to go" said again what the number and the bar show; only a hit target is said in words */
    var st = hit ? '<span class="fd-hit">' + h.icon('check', 22, 3.2) + 'Target hit</span>' : '';
    return '<section class="fd-prot" aria-label="Protein today">' + eye + lab + date +
      '<div class="fd-p-st" aria-live="polite">' + st + '</div>' +
      '<div class="fd-p-num' + (fmt.n(whole).length >= 4 ? ' long' : '') + '">' + num + '<span>/ ' + fmt.n(D.pT) + ' g</span></div>' +
      '<div class="fd-p-bar" role="img" aria-label="Protein ' + g1(p) + ' of ' + D.pT + ' grams"><i style="width:' + w + '%"><u></u></i></div>' +
    '</section>';
  }
  function calories(D){
    var k = D.t.kcal || 0, T = D.cT, s = '<section class="fd-kcal" aria-label="Calories today"><div class="fd-k-lab"><i></i>Calories</div>';
    if(T){
      var lo = +T.lo > 0 ? Math.round(+T.lo) : 0, hi = +T.hi > 0 ? Math.round(+T.hi) : 0, range = lo > 0 && hi > lo;
      var scale = range ? hi : T.kcal, w = Math.round(clamp01(k / scale) * 1000) / 10;
      var gap = T.kcal - k, word = (range && k >= lo && k <= hi) ? 'In range' : gap > 0 ? '' : gap < 0 ? fmt.n(-gap) + ' over' : 'On target';
      s += '<div class="fd-k-num' + (fmt.n(k).length >= 6 ? ' long' : '') + '"><b>' + fmt.n(k) + '</b><span><i>/ ' + fmt.n(T.kcal) + '</i> <i>kcal</i></span></div>' +
        '<div class="fd-k-bar' + (range ? ' band' : '') + '" role="img" aria-label="Calories ' + fmt.n(k) + ' of ' + fmt.n(T.kcal) + (range ? '. Range ' + fmt.n(lo) + ' to ' + fmt.n(hi) : '') + '"' +
          (range ? ' style="--lo:' + (Math.round(lo / hi * 1000) / 10) + '%"' : '') + '><i style="width:' + w + '%"></i></div>' +
        '<div class="fd-k-note"><b aria-live="polite">' + word + '</b>' + (range ? '<span>range <em>' + fmt.n(lo) + ' to ' + fmt.n(hi) + '</em></span>' : '') + '</div>';
    }else{
      s += '<div class="fd-k-num"><b>' + fmt.n(k) + '</b><span><i>kcal</i> <i>eaten</i></span></div>';
    }
    var fib = (D.t.fibKnown === false ? '≥' : '') + g1(D.t.fib), M = D.mT || {};
    var cOf = M.carbAbout > 0 ? '<i> / ' + fmt.n(M.carbAbout) + '</i>' : '', fOf = M.fatMin > 0 ? '<i> / ' + fmt.n(M.fatMin) + '+</i>' : '';
    s += '<div class="fd-macros" aria-label="Carbs, fat and fiber today' + (M.carbAbout > 0 ? '. Carbs about ' + M.carbAbout + ' grams, fat at least ' + M.fatMin + ' grams' : '') + '">' +
      '<div><b>' + g1(D.t.c) + ' g' + cOf + '</b><span>Carbs</span></div><div><b>' + g1(D.t.f) + ' g' + fOf + '</b><span>Fat</span></div><div><b>' + fib + ' g</b><span>Fiber</span></div></div>';
    /* v321: the goal the numbers come from, and a goal weight that points the other way */
    if(D.gl) s += '<p class="fd-goal gl">' + esc(D.gl) + '</p>';
    if(D.conflict && D.goal) s += '<p class="fd-goal warn">Your goal weight, ' + fmt.n(Math.round(D.goal.goalLb)) + ' lb, is ' + (D.conflict === 'below' ? 'under' : 'over') + ' today\'s ' + fmt.n(Math.round(D.goal.lb)) + ' lb.' +
      '<button type="button" class="c3-btn-quiet bare fd-goalbtn" data-act="goal" data-key="goal">Change goal</button></p>';
    if(!T && D.need && D.need.words) s += '<p class="fd-goal"><button type="button" class="c3-btn-quiet bare fd-goalbtn" data-act="needs" data-key="needs">' + h.icon('plus', 15, 3) + '<span>Add ' + esc(D.need.words) + ' to set calories</span></button></p>';
    return s + '</section>';
  }

  /* ---------- quick add: what this person logs most (the app's defaults until there is history) ---------- */
  function quick(D, more){
    var n = D.foods.length; if(!n) return '';
    var s = '<section class="fd-quick" aria-label="Quick add">' +
      '<div class="fd-q-head"><span class="fd-sec"><i></i>Quick add</span><span class="fd-q-cnt"><b>' + n + '</b> foods</span>' +
        (n > 5 && !more ? '<button type="button" class="fd-more" data-act="more" data-key="more" aria-label="Show all ' + n + ' foods">' + h.icon('plus', 15, 3) + '<span>All ' + n + '</span></button>' : '') + '</div>' +
      '<div class="fd-q-cols" aria-hidden="true"><span><span>Food · serving</span><span>Protein</span></span><span><span>Food · serving</span><span>Protein</span></span></div>' +
      '<ol class="fd-q-list' + (more ? ' all' : '') + '" style="--rows:' + Math.ceil(n / 2) + '">';
    D.foods.forEach(function(f){
      s += '<li><span class="nm"><b>' + esc(f.n) + '</b><small>' + g1(f.g) + ' g · ' + fmt.n(f.kcal) + ' kcal</small></span>' +
        '<span class="ct"' + (f.today ? ' aria-label="Added ' + f.today + ' time' + (f.today === 1 ? '' : 's') + ' today">×' + f.today : ' aria-hidden="true">') + '</span>' +
        '<span class="pv"><b>' + g1(f.p) + '</b><small> g</small><em>Protein</em></span>' +
        '<button type="button" class="c3-btn-quiet fd-add" data-act="add" data-id="' + esc(f.id) + '" data-g="' + f.g + '" data-key="add-' + esc(f.id) + '" aria-label="Add ' + esc(f.n) + ', ' + g1(f.g) + ' grams, ' + g1(f.p) + ' grams of protein">' +
          h.icon('plus', 16, 3) + '<span>Add</span></button></li>';
    });
    s += '</ol>';
    return s + '</section>';
  }

  /* ---------- the other ways in: the app's own flows ---------- */
  /* ---------- v313: RIGHT NOW, ONE TAP (C3.h.learn) ----------
     What this person eats around this time of day (on 2+ days in the last four weeks), and yesterday's
     meal at this hour while this meal is not logged yet ("All", one tap, one Undo). Learned on the phone
     from their own diary; nothing here until there is history, and then it is first. */
  function rightNow(L){
    if(!L) return '';
    var rows = L.likely || [], M = L.meal;
    if(!rows.length && !M) return '';
    var s = '<section class="fd-now" aria-label="Right now, one tap"><div class="fd-now-head"><span class="fd-sec"><i></i>Right now · one tap</span><span class="fd-now-when c3-num">' + esc(h.clock(L.now)) + '</span></div><ol class="fd-q-list all fd-now-list">';
    if(M){
      var names = M.items.map(function(x){ return x.n; });
      s += '<li class="meal"><span class="nm"><b>Repeat yesterday\'s ' + esc(M.word) + '</b><small>' + esc(names.slice(0, 3).join(', ') + (names.length > 3 ? ', +' + (names.length - 3) + ' more' : '')) + '</small></span>' +
        '<span class="pv"><b>' + g1(M.p) + '</b><small> g</small><em>Protein</em></span>' +
        '<button type="button" class="c3-btn-quiet pink fd-add" data-act="repeat" data-key="repeat" aria-label="Log yesterday\'s ' + esc(M.word) + ' again: ' + esc(names.join(', ')) + ', ' + g1(M.p) + ' grams of protein">' + h.icon('plus', 16, 3) + '<span>All</span></button></li>';
    }
    rows.forEach(function(f){
      s += '<li><span class="nm"><b>' + esc(f.n) + '</b><small>' + g1(f.g) + ' g · your usual now, ' + f.days + ' days</small></span>' +
        '<span class="pv"><b>' + g1(f.p) + '</b><small> g</small><em>Protein</em></span>' +
        '<button type="button" class="c3-btn-quiet fd-add" data-act="add" data-id="' + esc(f.id) + '" data-g="' + f.g + '" data-key="now-' + esc(f.id) + '" aria-label="Add ' + esc(f.n) + ', ' + g1(f.g) + ' grams, ' + g1(f.p) + ' grams of protein">' + h.icon('plus', 16, 3) + '<span>Add</span></button></li>';
    });
    return s + '</ol></section>';
  }

  function ways(D, st){
    var b = function(act, icon, label, short){ return '<button type="button" class="fd-way' + (short ? ' two' : '') + '" data-act="' + act + '" data-key="way-' + act + '">' + ico(IC[icon], 18, 2.2) + '<span class="l">' + label + '</span>' + (short ? '<span class="s">' + short + '</span>' : '') + '</button>'; };
    /* v371 (Chad, 28 Oct: "add a click link next to type it in Full Menu w a drop down havin selections day week month"):
       the whole plan for a day, a week or a month, every meal and ingredient, with Open in Excel, Print / PDF and Share */
    var open = !!(st && st.menu), go = function(span, word){
      return '<button type="button" class="c3-btn-quiet fd-menu-go" data-go="docs" data-params="' + esc(JSON.stringify({kind: 'food', span: span, from: 'food', menu: 1})) + '" data-key="menu-' + span + '">' + word + '</button>'; };
    var menu = C3.screens.docs ? '<button type="button" class="fd-way two fd-menu' + (open ? ' on' : '') + '" data-act="menu" data-key="way-menu" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="fdMenu">' +
      ico(IC.menu, 18, 2.2) + '<span class="fd-menu-w"><span class="l">Full menu</span><span class="s">Full menu</span>' + ico(IC.down, 14, 2.8).replace('class="c3-ic"', 'class="c3-ic fd-menu-chev"') + '</span></button>' : '';
    return '<nav class="fd-ways" aria-label="Log food">' + b('search', 'search', 'Search') +
      (D.bar ? b('scan', 'scan', 'Scan barcode', 'Scan') : '') + (D.photo ? b('photo', 'photo', 'Photo') : '') + (flv() ? b('voice', 'mic', 'Say it', 'Say it') : '') + b('type', 'type', 'Type it in', 'Type') + menu + '</nav>' +
      (open ? '<div class="fd-menu-drop" id="fdMenu" role="group" aria-label="Full menu"><span class="fd-menu-k">Full menu for</span>' + go('day', 'Day') + go('week', 'Week') + go('month', 'Month') + '</div>' : '');
  }

  /* ---------- eaten today: the real entries, each removable ---------- */
  function clock(at){ return safe(function(){ return new Date(at).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}); }, ''); }
  function eaten(D, all){
    var rows = D.rows, n = rows.length, last = rows[n - 1];
    var s = '<section class="fd-eaten" aria-label="Eaten today"><div class="fd-e-head">' +
      '<span class="fd-sec plain">Eaten today</span><b class="fd-e-n" aria-live="polite">' + n + '</b>' +
      '<span class="fd-e-note">' + (n ? (n === 1 ? 'food' : 'foods') + ' · ' + g1(D.t.p) + ' g protein · ' + fmt.n(D.t.kcal) + ' kcal' : '') + '</span>' +
      '<span class="fd-e-acts">' +
        (last ? '<button type="button" class="c3-btn-quiet pink bare fd-undo" data-act="del" data-at="' + last.at + '" data-key="undo-last" aria-label="Remove the last food, ' + esc(last.n) + '">' + ico(IC.undo, 16, 2.6) + '<span>Undo last</span></button>' : '') +
        '<button type="button" class="c3-link fd-diary" data-act="diary" data-key="diary">Full food diary</button></span></div>';
    if(!n){
      return s + '<div class="fd-e-none"><i></i><span>Nothing logged yet. Tap Log on a meal above, or add anything with the buttons up top.</span><u></u></div></section>';
    }
    var show = all ? rows : rows.slice(-6), hid = n - show.length;
    s += '<ul class="fd-e-list">';
    show.forEach(function(e){
      /* a row with a known food and a weight opens ADJUST on its portion; a typed-in row can only be removed */
      var can = e.g > 0 && !!safe(function(){ return foodById(e.id); }, null);
      var words = '<b>' + esc(e.n) + '</b><small>' + (can ? h.adjustHintHTML(g1(e.g) + ' g') : (e.g != null ? g1(e.g) + ' g' : 'typed in')) + ' · ' + fmt.n(e.kcal || 0) + ' kcal</small>';
      s += '<li><span class="tm">' + esc(clock(e.at)) + '</span>' +
        (can ? '<button type="button" class="nm" data-adjust="food" data-arg="' + e.at + '" data-key="adj-' + e.at + '" aria-label="' + esc(e.n) + ', ' + g1(e.g) + ' grams. Adjust the portion">' + words + '</button>'
             : '<span class="nm">' + words + '</span>') +
        '<span class="pv"><b>' + g1(e.p) + '</b><small> g</small></span>' +
        '<button type="button" class="fd-del" data-act="del" data-at="' + e.at + '" data-key="del-' + e.at + '" aria-label="Remove ' + esc(e.n) + '">' + ico(IC.x, 16, 2.6) + '</button></li>';
    });
    s += '</ul>';
    if(hid > 0) s += '<button type="button" class="fd-more show" data-act="all" data-key="all">' + h.icon('plus', 15, 3) + '<span>' + hid + ' earlier</span></button>';
    return s + '</section>';
  }

  /* ---------- water: one meter, one control ---------- */
  function water(D){
    var w = D.water; if(!w || !(w.target > 0)) return '';
    var closed = w.frac >= 1;
    return '<section class="fd-water" aria-label="Water today"><span class="fd-sec sky"><i></i>Water</span>' +
      '<span class="fd-w-v"><b>' + fmt.liters(w.now) + '</b> / ' + fmt.liters(w.target, 1) + ' L</span>' +
      '<span class="fd-w-m" role="img" aria-label="Water ' + fmt.liters(w.now) + ' of ' + fmt.liters(w.target, 1) + ' liters"><i style="width:' + (Math.round(w.frac * 1000) / 10) + '%"></i></span>' +
      (closed ? '<span class="c3-closed">' + h.icon('check', 18, 3.2) + 'Closed</span>' : '') +
      '<button type="button" class="c3-btn-quiet num' + (closed ? ' bare' : '') + ' fd-w-add" data-act="water" data-key="water" aria-label="Add 250 milliliters of water">' + h.icon('plus', 16, 3) + '<span>250 mL</span></button>' +
      '<button type="button" class="c3-btn-quiet bare fd-w-adj" data-adjust="water" data-key="adj-water" aria-label="Water today: ' + fmt.liters(w.now) + ' of ' + fmt.liters(w.target, 1) + ' liters. Adjust">' + h.icon('adjust', 16, 2.6) + '<span>Adjust</span></button></section>';
  }

  /* ---------- a portion, corrected: the same ADJUST control as water and steps ----------
     An eaten row with a known food and a weight opens it on its grams. The app has no "edit an
     entry" (the diary only deletes), and its sync identifies an entry by its moment, so a new
     portion is the app's own delete (foodDelete: tombstone, save) plus the app's own add
     (foodAdd: the macros stamped on the entry) one millisecond later: the row keeps its place
     and its time. Anything else logged at that same moment is moved along with it, unchanged. */
  function portionOf(at){
    var e = (safe(function(){ return ALL.food || []; }, []) || []).filter(function(x){ return x.at === at; })[0];
    if(!e || !(e.g > 0)) return null;
    var f = safe(function(){ return foodById(e.id); }, null);
    return f ? {e:e, f:f} : null;
  }
  function setPortion(at, grams){
    try{
      var P = portionOf(at); if(!P || !(grams > 0)) return;
      var old = (ALL.food || []).filter(function(x){ return x.at === at; });
      var t = at + 1;
      var free = function(){ while((ALL.food || []).some(function(x){ return x.at === t; })) t += 1; return t; };
      foodDelete(at);
      var made = [], ne = foodAdd(P.f, grams, free());
      made.push(ne);
      old.forEach(function(x){ if(x === P.e) return; var c = JSON.parse(JSON.stringify(x)); c.at = free(); ALL.food.push(c); made.push(c); });
      ALL.food.sort(function(a, b){ return a.at - b.at; });
      save();
      offerUndo('<b>' + esc(P.f.n) + '</b> ' + g1(ne.g) + ' g · ' + ne.kcal + ' kcal, ' + g1(ne.p) + ' g protein.', function(){
        ALL.food = (ALL.food || []).filter(function(x){ return !made.some(function(m){ return m.at === x.at; }); });
        made.forEach(function(m){ tomb('food', String(m.at)); });
        old.forEach(function(x){ ALL.food.push(x); });
        ALL.food.sort(function(a, b){ return a.at - b.at; });
        if(ALL.tomb && ALL.tomb.food) delete ALL.tomb.food[String(at)];
      });
      drawAll();
    }catch(err){ console.error('[c3] food portion', err); }
  }
  if(h.adjustKinds) h.adjustKinds.food = function(arg){
    var at = +arg, P = portionOf(at); if(!P) return null;
    var f = P.f, serv = (f.serv || []).filter(function(s){ return s && s[1] > 0; }).slice(0, 3);
    var mac = function(v){ var s = safe(function(){ return scaleFood(f, v); }, null); return s ? g1(s.p) + ' g protein · ' + fmt.n(s.kcal) + ' kcal' : ''; };
    return {
      id:'food', title:f.n, tone:'food', live:false, step:10, min:1, max:5000,
      round:function(v){ return Math.round(v * 10) / 10; },
      read:function(){ return +P.e.g || 0; },
      apply:function(v){ setPortion(at, v); },
      show:function(v){ return g1(v); }, unit:'g', sub:mac,
      lessSay:'10 grams less', moreSay:'10 grams more',
      quick:serv.map(function(s){ return {set:s[1], label:g1(s[1]) + ' g', sub:String(s[0]).replace(/\s*\(.*$/, '').slice(0, 18)}; }),
      setLabel:'Set grams', decimal:true, entryUnit:'g', entry:function(v){ return g1(v); }, hint:'Grams, like 150',
      parse:function(t){ var m = /^(\d+(?:[.,]\d+)?)\s*g?$/i.exec(String(t).trim()); if(!m) return null; var n = parseFloat(m[1].replace(',', '.')); return (n >= 1 && n <= 5000) ? Math.round(n * 10) / 10 : null; },
      remove:{label:'Remove', run:function(){ removeFood(at); }}
    };
  };

  /* ---------- actions ---------- */
  /* ONE TAP. The app's writer (foodAdd: stamps the macros on the entry, sorts, saves) and the app's
     Undo toast (offerUndo), on today, at this very moment.
     Why not fdLogOne: it writes on whatever day the old diary was left on (FOODUI.day) and rounds the
     time to the whole minute. The diary deletes by moment (foodDelete(at) and the sync tombstone take
     everything logged at that timestamp), so two taps inside one minute could only ever be removed
     together. Every entry made here gets its own millisecond, so each row has its own Remove. */
  function addFood(id, grams){
    var f = safe(function(){ return foodById(id); }, null); if(!f || !(grams > 0)) return;
    try{
      var at = Date.now();
      while((ALL.food || []).some(function(x){ return x.at === at; })) at += 1;
      var e = foodAdd(f, grams, at);
      offerUndo('<b>' + esc(f.n) + '</b> ' + g1(grams) + ' g · ' + e.kcal + ' kcal, ' + g1(e.p) + ' g protein.', function(){
        ALL.food = (ALL.food || []).filter(function(x){ return x.at !== e.at; }); tomb('food', String(e.at));
      });
      drawAll();
    }catch(err){ console.error('[c3] food add', err); }
  }
  /* REMOVE: the diary's own delete (foodDelete tombs the moment and saves) with its own Undo.
     The app's rule is that a delete takes everything logged at that exact moment (entries the old
     diary wrote in the same minute share one); when that happens the toast says so and Undo
     brings all of it back. */
  function removeFood(at){
    try{
      var gone = (ALL.food || []).filter(function(e){ return e.at === at; }); if(!gone.length) return;
      foodDelete(at);
      offerUndo('Removed <b>' + esc(gone[0].n) + '</b>' + (gone.length > 1 ? ' and ' + (gone.length - 1) + ' more logged at the same minute' : '') + '.', function(){
        ALL.food = ALL.food || [];
        gone.forEach(function(g){ ALL.food.push(g); }); ALL.food.sort(function(a, b){ return a.at - b.at; });
        if(ALL.tomb && ALL.tomb.food) delete ALL.tomb.food[String(at)];
      });
      drawAll();
    }catch(err){ console.error('[c3] food remove', err); }
  }
  /* the app's food diary, on today, as a deep screen; then the part of it that was asked for */
  function diary(what){
    try{ FOODUI.day = null; FOODUI.pick = null; if(what === 'search') FOODUI.q = ''; }catch(e){}
    C3.deep('today', 'food');
    var tries = 0;
    var go = function(){
      var el = null, done = false;
      try{
        if(what === 'search'){ el = document.getElementById('fdQ'); if(el){ el.focus({preventScroll:true}); el.scrollIntoView({block:'center'}); done = true; } }
        else if(what === 'scan'){ el = document.getElementById('fdBar'); if(el){ el.scrollIntoView({block:'center'}); el.click(); done = true; } }
        else if(what === 'photo'){ el = document.getElementById('fdPhoto'); if(el){ el.scrollIntoView({block:'center'}); el.click(); done = true; } }
        else if(what === 'type'){ el = document.getElementById('quickCard'); var f = document.getElementById('qaName');
          if(el && f){ el.open = true; el.scrollIntoView({block:'start'}); f.focus({preventScroll:true}); f.scrollIntoView({block:'center'}); done = true; } }
        else done = true;
      }catch(e){ done = true; }
      if(!done && ++tries < 12) setTimeout(go, 80);
    };
    go();   /* in the same tap when the diary is already drawn (a phone keyboard and a file picker need that) */
  }

  /* ---------- v325: YOUR PLAN. Chad, 17 Oct: "what you did is not a food plan ... it must auto build week to week,
     month food plans for any individual with options to swap". v324 put the old 30-meal week here; this is the
     planner (mpEnsure: 28 days ahead, built and kept by itself) drawn by the meal kit (C3.mk): the next seven days as
     bars against each day's aim, the day picked as its meals with Log, Swap and the recipe, a new day, and the doors
     to the month, the groceries and the settings. ---------- */
  /* v370 (Chad, 28 Oct: "lift off still seems more user friendly with button flow ... u have to scroll to bottom of page
     finally realizing thats where u actaul full day's food plan lives not aceptable"): the day's meals come straight
     after the numbers, the next one to eat carrying the screen's one big Log button; adding something else, the diary,
     water and the week follow. The plan itself is unchanged (mpEnsure: 28 days ahead, kept by itself; the meal kit
     C3.mk draws the rows). */
  function planDay(st){
    var mk = C3.mk; if(!mk) return '';
    var today = mk.today();
    var head = function(t, right){ return '<div class="fd-wk-head"><h2 class="fd-sec"><i></i>' + esc(t) + '</h2>' + (right || '') + '</div>'; };
    var aim = safe(function(){ return mpAim(today); }, null);
    if(!aim){
      var need = safe(function(){ return lwNeeds(); }, null), w = need && need.words ? need.words : 'a weigh-in';
      return '<section class="fd-week fd-day none" id="c3Week" aria-label="Today\'s meals">' + head('Today\'s meals', '') +
        '<button type="button" class="c3-btn-primary fd-build" data-act="wkneeds" data-key="wkneeds"><span class="l">Build my meal plan</span><span class="r"><small><span>Add ' + esc(w) + '</span></small>' + h.icon('arrow', 30, 3) + '</span></button></section>';
    }
    if(!mk.ready()){ safe(function(){ if(!MP.failed)mpLoad(); }); return '<section class="fd-week fd-day" id="c3Week" aria-label="Today\'s meals" aria-busy="true">' + head('Today\'s meals', '') + C3.journey.mealLoading('Building your plan.')+'</section>'; }
    if(!mk.day(today)) safe(function(){ mpEnsure(); });
    var keys = []; for(var i = 0; i < 7; i++) keys.push(mk.add(today, i));
    var sel = st.pday && keys.indexOf(st.pday) >= 0 ? st.pday : today, D = mk.day(sel);
    var all = D && !D.off ? (D.meals || []).length : 0, done = all ? D.meals.filter(function(m){ return m.logged; }).length : 0;
    var title = sel === today ? 'Today\'s meals' : mk.word(sel, {weekday:'long'}) + '\'s meals';
    var right = '<span class="fd-day-r">' + (all ? '<span class="fd-day-n c3-num' + (done === all ? ' all' : '') + '">' + (done === all ? h.icon('check', 16, 3.2) : '') + '<b>' + done + '</b><span>/ ' + all + ' logged</span></span>' : '') +
      (sel !== today ? '<button type="button" class="c3-link fd-day-back" data-act="mday" data-v="' + esc(today) + '" data-key="mday-back">Back to today</button>' : '') + '</span>';
    return '<section class="fd-week fd-plan fd-day" id="c3Week" aria-label="' + esc(title) + '">' + head(title, right) +
      /* today: the numbers at the top are the day's targets, so the plan's own totals (its aim inside the same range, protein
         above the minimum) are not shown again beside them; a later day shows its totals */
      (sel === today ? mk.rebNote(sel) : mk.dayHead(sel)) + mk.meals(sel, st, {next: true, slot: st.slot || ''}) + '</section>';
  }
  function planWeek(st){
    var mk = C3.mk; if(!mk || !mk.ready()) return '';
    var today = mk.today(); if(!safe(function(){ return mpAim(today); }, null)) return '';
    var keys = []; for(var i = 0; i < 7; i++) keys.push(mk.add(today, i));
    var sel = st.pday && keys.indexOf(st.pday) >= 0 ? st.pday : today;
    var g = safe(function(){ return mpGrocery(today, 7); }, []) || [];
    var left = g.filter(function(x){ return !x.on && !x.staple; }).length;
    var right = '<button type="button" class="c3-link fd-plan-go" data-act="pgo" data-v="week" data-key="pgo">28 days ' + mk.icon('chev', 15, 2.6) + '</button>';
    return '<section class="fd-week fd-wkplan" aria-label="This week\'s meal plan"><div class="fd-wk-head"><h2 class="fd-sec"><i></i>This week</h2>' + right + '</div>' +
      '<p class="fd-planline">' + esc(mk.line()) + '</p>' + mk.strip(keys, sel) +
      '<div class="fd-wk-acts">' +
        '<button type="button" class="c3-btn-quiet" data-act="pgo" data-v="groc" data-key="pgo-groc">' + mk.icon('cart', 16, 2.4) + '<span>Groceries</span><b class="c3-num">' + left + '</b></button>' +
        (sel >= today ? '<button type="button" class="c3-btn-quiet bare" data-act="mregen" data-k="' + esc(sel) + '" data-key="mregen">' + ico(IC.redo, 16, 2.4) + '<span>New meals for ' + esc(sel === today ? 'today' : mk.word(sel, {weekday:'long'})) + '</span></button>' : '') +
        '<button type="button" class="c3-btn-quiet bare" data-act="pgo" data-v="month" data-key="pgo-month">Month</button>' +
        '<button type="button" class="c3-btn-quiet bare" data-act="pgo" data-v="prefs" data-key="pgo-prefs">Settings</button>' +
        (C3.screens.docs ? '<button type="button" class="c3-btn-quiet bare" data-go="docs" data-params="' + esc(JSON.stringify({kind: 'food', span: 'week', from: 'food'})) + '" data-key="docs-food">Print plan</button>' : '') +   /* v347 */
      '</div></section>';
  }
  /* v370: the one-tap lists (right now, quick add) under the day's meals */
  function other(now, quick){
    return (now || quick) ? '<div class="fd-other">' + now + quick + '</div>' : '';
  }

  C3.screen('food', {
    nav: 'food',
    render: function(ctx){
      var D = read();
      var LN = safe(function(){ return h.learn(); }, null), now = rightNow(LN);
      var side = '<aside class="fd-side" aria-label="Your food coach">' +
        '<div class="fd-pic">' + h.pictureHTML('nova-cook', {cls:'tall', eager: ctx.desktop}) + h.pictureHTML('nova-water', {cls:'wide', eager: !ctx.desktop}) + '</div>' +
        '<div class="fd-coach">' + h.coachLineHTML('food') + '</div>' +
        '<div class="fd-tag" aria-hidden="true"><span class="c3-tag">Earned. Not given.</span></div></aside>';
      /* v370: the numbers and the four ways to log, today's meals (the next one is the big button), the one-tap lists,
         the diary, water, the week. Search and scan stay first (Chad's plan, 18 Oct); the day's plan is right under them. */
      var guide = '<p class="fd-guide">Log your next meal below, or add anything above.</p>';
      return '<div class="fd' + (now ? ' has-now' : '') + '"><div class="fd-main">' +
        '<div class="fd-hero">' + protein(D) + calories(D) + '</div>' + ways(D, ctx.state) + guide + (C3.foodlog ? C3.foodlog.render(ctx) : '') + planDay(ctx.state) +
        other(now, quick(D, !!ctx.state.more)) + eaten(D, !!ctx.state.all) + water(D) + planWeek(ctx.state) +
      '</div>' + side + '</div>';
    },
    wire: function(root, ctx){
      /* v344: a meal reminder opens Food at that meal of today's plan (breakfast, lunch, dinner; else the nearest time) */
      var pm = ctx.params || {};
      if(pm.meal != null && ctx.state._mealGo !== JSON.stringify(pm)){
        ctx.state._mealGo = JSON.stringify(pm);
        /* v372: and that meal carries the big Log button */
        var want0 = ['breakfast', 'lunch', 'dinner'][+pm.meal];
        if(want0 && ctx.state.slot !== want0){ ctx.state.slot = want0; ctx.state.pday = null; setTimeout(function(){ C3.render(); }, 0); }
        setTimeout(function(){
          try{
            var mk = C3.mk, D = mk && mk.day(mk.today()), want = ['breakfast', 'lunch', 'dinner'][+pm.meal], j = -1;
            if(D && D.meals) D.meals.forEach(function(m, i){ if(j < 0 && m.slot === want) j = i; });
            var rows = root.querySelectorAll('#c3Week .mk-list > .mk-meal');
            if(j < 0 && rows.length) j = Math.min(+pm.meal, rows.length - 1);
            var el = j >= 0 ? rows[j] : root.querySelector('#c3Week');
            /* v372: from the daily guide the page stays put when the meal is already on the screen, so the guide's line
               ("Check-in saved. Your breakfast is next.") stays in view above it */
            var tg = el ? el.querySelector('.mk-next') || el : null, r = tg ? tg.getBoundingClientRect() : null, seen = r && r.top >= 0 && r.bottom <= innerHeight - 90;
            if(el){ el.classList.add('mk-go'); if(!(pm.guide && seen)) el.scrollIntoView({block: 'center'}); setTimeout(function(){ el.classList.remove('mk-go'); }, 2600); }
          }catch(e){}
        }, 80);
      }
      if(ctx.state.toDay){ ctx.state.toDay = false; var sec = root.querySelector('#c3Week'); if(sec) setTimeout(function(){ try{ sec.scrollIntoView({block: 'start', behavior: 'smooth'}); }catch(e){} }, 30); }
      root.querySelectorAll('[data-chg]').forEach(function(el){ el.addEventListener('change', function(){ var ck = el.getAttribute('data-chg'); if(/^fl-/.test(ck) && C3.foodlog){ C3.foodlog.chg(ck, el, ctx); return; } if(C3.mk) C3.mk.chg(ck, el, ctx); }); });
      if(C3.mk) C3.mk.wireFind(root, ctx);
      root.querySelectorAll('[data-act]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-act');
          if(a === 'mday'){ ctx.set({pday: b.getAttribute('data-v'), swap: null, toDay: b.getAttribute('data-key') !== 'mday-back'}); return; }   /* v370: a day picked in This week shows its meals up top */
          if(a === 'pgo'){ C3.go('plan', {tab: b.getAttribute('data-v') || 'week'}); return; }
          if(a === 'wkneeds'){ safe(function(){ lwAskNeeds(); }); return; }
          if(C3.mk && /^m/.test(a) && C3.mk.act(a, b, ctx)) return;
          if(a === 'add') addFood(b.getAttribute('data-id'), +b.getAttribute('data-g'));
          else if(a === 'repeat'){ var L = safe(function(){ return h.learn(); }, null); if(L && L.meal && h.repeatMeal(L.meal.items)) C3.refresh(); }
          else if(a === 'del') removeFood(+b.getAttribute('data-at'));
          else if(a === 'water') h.addWater(250);
          else if(a === 'menu') ctx.set({menu: !ctx.state.menu});   /* v371: Full menu opens and closes its Day, Week, Month */
          else if(a === 'more') ctx.set({more:true});
          else if(a === 'all') ctx.set({all:true});
          else if(a === 'diary') diary('');
          else if(a === 'goal') C3.go('program');
          else if(a === 'needs') safe(function(){ lwAskNeeds(); });
          else if(C3.foodlog && (/^fl-/.test(a) || a === 'voice' || (a === 'photo' && C3.foodlog.available().photo)) && C3.foodlog.act(a, b, ctx, root)) return;
          else diary(a);
        });
      });
    }
  });
})();
