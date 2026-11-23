/* C3 screen: addcmp (v333). ADD A COMPOUND IN THREE STEPS.
   Chad, 18 Oct 2026: "users feedback says our peptide tracking is confusing and impossible to use", "users cant even
   find our peptide tracking". Adding one used to be a single form of thirty-odd controls (the compound, the route, a
   label, four kinds of schedule, the hour, the first day, blocks of weeks, a last day, what a skip does, steps, the
   vial, the price, spares and eighteen site chips) before anything could be logged. Now:
     1. What do you take?   a search, and the eight most people start with
     2. How much, how often?   the amount (mg, mcg or IU), every day / every other day / every 3 days / twice a week /
        once a week / pick days, morning to bedtime, today or tomorrow
     3. What it comes in   a vial (mg in it and the water added, and the units to draw shown as they type), a pen
        (mg in one pen, and the doses in it), or pills (mg a tablet and how many in a pack: the tablets a dose and
        the doses in the pack). v335. Skipping it is fine; nasal and topical ones have two steps.
   Then it is in the stack and its first dose is planned. Everything else (route, steps, blocks, sites, price) is on
   the compound's own screen, untouched, for whoever wants it. Nothing is suggested: no amount is filled in for them. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var POPULAR = ['sema', 'tirz', 'reta', 'bpc', 'tb5', 'ipa', 'cjc', 'tcyp'];
    var FREQ = [['daily', 'Every day'], ['eod', 'Every other day'], ['e3', 'Every 3 days'], ['2w', 'Twice a week'], ['weekly', 'Once a week'], ['days', 'Pick the days']];
    var HOURS = {daily: 24, eod: 48, e3: 72, weekly: 168};
    var WHEN = [[7, 'Morning', '7 AM'], [12, 'Midday', '12 PM'], [18, 'Evening', '6 PM'], [21, 'Bedtime', '9 PM']];
    var DW = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
    var cmp = function(id){ return safe(function(){ return byId(id); }, null); };
    var lib = function(){ return safe(function(){ return LIB; }, []) || []; };
    var injected = function(c){ var r = safe(function(){ return nativeRoute(c); }, 'sc'); return r === 'sc' || r === 'im'; };
    function units(c){ if(safe(function(){ return iuOnly(c); }, false)) return [['iu', 'IU']]; var o = [['mg', 'mg'], ['mcg', 'mcg']]; if(safe(function(){ return canIU(c); }, false)) o.push(['iu', 'IU']); return o; }
    function isPlaceholder(p){ return safe(function(){ return ALL.mode === 'training' && p.id === 'p-main' && !(p.doses || []).length; }, false); }
    function hourWord(hr){ var a = hr % 12 === 0 ? 12 : hr % 12; return a + (hr < 12 ? ' AM' : ' PM'); }
    var oralish = function(c){ var r = safe(function(){ return nativeRoute(c); }, 'sc'); return r === 'oral' || r === 'subl'; };
    function steps(st){ var c = cmp(st.cid); return c && !injected(c) && !oralish(c) ? 2 : 3; }
    var FORMS = [['vial', 'Vial'], ['pen', 'Pen'], ['pill', 'Pills']];

    /* the protocol these answers make, in the app's own shape (the same one the full form writes) */
    function build(st){
      var c = cmp(st.cid); if(!c) return null;
      var d = new Date(); d.setHours(st.hour, 0, 0, 0); if(st.start === 'tomorrow') d.setDate(d.getDate() + 1);
      var p = {id: safe(function(){ return newId(); }, 'p' + Date.now().toString(36)), name: c.n, compound: c.id, doseMg: 0, everyH: 168,
        vialMg: +st.vmg > 0 ? +st.vmg : 0, diluentMl: +st.vml > 0 ? +st.vml : 0, deadMl: 0.05, costUsd: 0, doses: [], skips: [], holds: [],
        sched: {kind: 'interval', everyH: 168, anchor: d.getTime(), hourOfDay: st.hour, onSkip: 'hold', daysOfWeek: [], onDays: 5, offDays: 2},
        ladder: [], inv: {spare: 0, leadDays: 7, openedAt: null, budDays: null}};
      if(st.unit === 'iu') p.unit = 'iu';
      /* v335: a pen (mg in one pen) or pills (mg a tablet, tablets in a pack) in place of a vial */
      if(st.form === 'pen'){ p.form = 'pen'; p.penMg = +st.pmg > 0 ? +st.pmg : 0; p.vialMg = 0; p.diluentMl = 0; p.deadMl = 0; p.formAt = Date.now(); }
      else if(st.form === 'pill'){ p.form = 'pill'; p.tabMg = +st.tmg > 0 ? +st.tmg : 0; p.tabs = +st.tn > 0 ? Math.round(+st.tn) : 0; p.vialMg = 0; p.diluentMl = 0; p.deadMl = 0; p.formAt = Date.now(); }
      var v = +st.amt; if(st.unit === 'mcg') v = v / 1000;
      var mg = st.unit === 'iu' ? safe(function(){ return amtIn(p, v); }, v) : v;
      p.ladder = [{afterDoses: 0, mg: mg}]; p.doseMg = mg;
      if(HOURS[st.freq]){ p.sched.kind = 'interval'; p.sched.everyH = HOURS[st.freq]; p.everyH = HOURS[st.freq]; }
      else {
        var days = st.freq === '2w' ? [d.getDay(), (d.getDay() + 3) % 7] : (st.dows || []).slice();
        if(!days.length) days = [d.getDay()];
        p.sched.kind = 'weekly'; p.sched.daysOfWeek = days.sort(function(a, b){ return a - b; });
        p.everyH = Math.max(1, Math.round(safe(function(){ return pdEveryDays(p); }, 7 / days.length) * 24));
      }
      return p;
    }
    C3.addcmp = {build: build};
    /* what the vial gives: units to draw on their syringe, the volume, and how many doses it holds */
    /* what a pen or a pack gives: the doses in it, and for pills the tablets a dose */
    function held(st){
      var p = build(st); if(!p || !(p.doseMg > 0)) return null;
      if(p.form === 'pen') return p.penMg > 0 ? {n: Math.floor(p.penMg / p.doseMg + 1e-9)} : null;
      if(p.form === 'pill') return p.tabMg > 0 ? {t: p.doseMg / p.tabMg, n: p.tabs > 0 ? Math.floor(p.tabs / (p.doseMg / p.tabMg) + 1e-9) : null} : null;
      return null;
    }
    function draw(st){
      var p = build(st); if(!p || p.form || !(p.doseMg > 0) || !(p.vialMg > 0) || !(p.diluentMl > 0)) return null;
      var u = safe(function(){ return pdUnits(p, p.doseMg); }, 0), ml = safe(function(){ return pdMl(p, p.doseMg); }, 0), syr = safe(function(){ return pdPrefs().syr; }, 100);
      var n = Math.floor(safe(function(){ return pdUsable(p) * pdConc(p) / p.doseMg; }, 0) + 1e-9);
      return {u: u, ml: ml, syr: syr, n: n};
    }

    /* v374 (Chad, 2 Nov): a dropdown of every compound at the very top of the flow, so nobody is stranded on the dose step */
    function picker(st){
      var L = lib().slice().sort(function(a, b){ return String(a.n).localeCompare(String(b.n)); });
      return '<label class="ac-sel-w"><span class="c3-sr">Choose a compound</span><select class="yd-in ac-sel" data-key="acsel" aria-label="Choose a compound"><option value=""' + (st.cid ? '' : ' selected') + '>Choose a compound (' + L.length + ')</option>' +
        L.map(function(x){ return '<option value="' + esc(x.id) + '"' + (x.id === st.cid ? ' selected' : '') + '>' + esc(x.n) + '</option>'; }).join('') + '<option value="__own">Not in the list? Add your own</option></select></label>';
    }
    function step1(st){
      var q = String(st.q || '').trim().toLowerCase(), L = lib();
      var hits = q.length >= 2 ? L.filter(function(x){ return ((x.n || '') + ' ' + (x.a || '')).toLowerCase().indexOf(q) >= 0; }).slice(0, 8)
        : POPULAR.map(cmp).filter(Boolean);
      var rows = hits.map(function(x){
        var aka = String(x.a || '').split(',')[0].trim();
        return '<li><button type="button" class="ac-pick" data-act="acpick" data-v="' + esc(x.id) + '" data-key="acpick-' + esc(x.id) + '"><b>' + esc(x.n) + '</b>' + (aka && aka.toLowerCase() !== String(x.n).toLowerCase() ? '<small>' + esc(aka) + '</small>' : '') + h.icon('chev', 18, 2.4) + '</button></li>';
      }).join('');
      return picker(st) + '<h2 class="ac-q">What do you take?</h2>' +
        '<label class="ac-find"><span class="c3-sr">Search ' + L.length + ' compounds and brand names</span><input class="yd-in ac-in" type="search" data-key="adq" value="' + esc(st.q || '') + '" placeholder="Search ' + L.length + ' compounds and brands" autocomplete="off" enterkeyhint="search"></label>' +
        (q.length >= 2 ? '' : '<p class="ac-lbl">Most people start with</p>') +
        (rows ? '<ul class="ac-list">' + rows + '</ul>' : '<p class="ac-none">Nothing by that name.</p>') +
        '<div class="ac-alt"><button type="button" class="c3-link" data-act="acown" data-key="acown">Not in the list? Add your own</button></div>' +
        (safe(function(){ var C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); }, false) ? '<p class="ac-web">Some tracking options are available on the web at app.formedlabs.co.</p>' : '');
    }
    /* v373 (Chad, 28 Oct: "rebuild this page to be professional and visually fortune 500 quality like rest of app not all
       these floaty buttons they look terrible and its confusing workflow is all over on this page"): one column read top to
       bottom: the amount, how often, when, the first dose, then the schedule those answers make, in words; every choice a
       word on a line (the chosen one bold, white, underlined in mint, with a check), no pills, no boxes. */
    function opt(act, v, word, sub, on){
      return '<button type="button" class="ac-o' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '" data-key="' + act + '-' + esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<b>' + esc(word) + (on ? h.icon('check', 15, 3.2) : '') + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
    }
    function set(label, cls, inner){ return '<fieldset class="ac-set"><legend class="ac-lbl">' + esc(label) + '</legend><div class="ac-opts ' + cls + '">' + inner + '</div></fieldset>'; }
    var dayOf = function(off){ var d = new Date(); d.setDate(d.getDate() + off); return d; };
    var dw = function(d, o){ return d.toLocaleDateString('en-US', o); };
    /* the schedule these answers make, in words: "250 mcg, once a week" / "Wednesdays at 7 AM · first dose today, Oct 28" */
    function sumHTML(st){
      var c = cmp(st.cid), U = units(c), uWord = (U.filter(function(u){ return u[0] === st.unit; })[0] || U[0])[1];
      var amt = +st.amt > 0 ? String(+st.amt) + ' ' + uWord : '';
      var first = dayOf(st.start === 'tomorrow' ? 1 : 0), fd = first.getDay(), names = {0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'};
      var how = {daily: 'every day', eod: 'every other day', e3: 'every 3 days', '2w': 'twice a week', weekly: 'once a week'}[st.freq] || '';
      if(st.freq === 'days'){ var nd = (st.dows || []).length; how = !nd ? 'pick your days' : nd === 1 ? 'once a week' : nd === 7 ? 'every day' : nd + ' days a week'; }   /* v373: says how many days, the days follow */
      var on = st.freq === 'weekly' ? dw(first, {weekday: 'long'}) + 's' : st.freq === '2w' ? names[fd] + ' and ' + names[(fd + 3) % 7]
        : st.freq === 'days' ? DW.filter(function(d){ return (st.dows || []).indexOf(d[0]) >= 0; }).map(function(d){ return d[1]; }).join(', ') : '';
      var when = (on ? on + ' at ' : 'At ') + hourWord(st.hour) + ' · first dose ' + (st.start === 'tomorrow' ? 'tomorrow' : 'today') + ', ' + dw(first, {month: 'short', day: 'numeric'});
      return '<span class="k">Your schedule</span><b class="c3-num">' + (amt ? esc(amt) + ', ' : '<i>Your amount</i>, ') + esc(how) + '</b><span class="w">' + esc(when) + '</span>';
    }
    function step2(st){
      var c = cmp(st.cid), U = units(c), uWord = (U.filter(function(u){ return u[0] === st.unit; })[0] || U[0])[1];
      var t0 = dayOf(0), t1 = dayOf(1);
      return picker(st) + '<h2 class="ac-q"><span class="ac-cmp">' + esc(c ? c.n : '') + '</span>How much, how often?</h2>' +
        '<div class="ac-amt"><label class="ac-big"><span class="ac-each">Each dose</span><input class="ac-num c3-num" type="number" inputmode="decimal" min="0" step="any" data-key="adamt" value="' + esc(st.amt || '') + '" placeholder="0" autocomplete="off" aria-label="Each dose, in ' + esc(uWord) + '"></label>' +
          (U.length > 1 ? '<div class="ac-opts units" role="group" aria-label="Unit">' + U.map(function(u){ return opt('acunit', u[0], u[1], '', u[0] === st.unit); }).join('') + '</div>' : '<span class="ac-u">' + esc(uWord) + '</span>') + '</div>' +
        set('How often', 'six', FREQ.map(function(f){ return opt('acfreq', f[0], f[1], '', st.freq === f[0]); }).join('')) +
        (st.freq === 'days' ? '<div class="ac-opts seven" role="group" aria-label="Which days">' + DW.map(function(d){ return opt('acdow', d[0], d[1], '', (st.dows || []).indexOf(d[0]) >= 0); }).join('') + '</div>' : '') +
        set('When', 'four', WHEN.map(function(w){ return opt('acwhen', w[0], w[1], w[2], +st.hour === w[0]); }).join('')) +
        set('First dose', 'two', opt('acstart', 'today', 'Today', dw(t0, {weekday: 'short', month: 'short', day: 'numeric'}), st.start !== 'tomorrow') + opt('acstart', 'tomorrow', 'Tomorrow', dw(t1, {weekday: 'short', month: 'short', day: 'numeric'}), st.start === 'tomorrow'));
    }
    function step3(st){
      var D = draw(st), c = cmp(st.cid), p = build(st), amtW = p ? safe(function(){ return amtTxt(p, p.doseMg); }, '') : '', f = st.form || 'vial';
      var top = '<h2 class="ac-q"><span class="ac-cmp">' + esc(c ? c.n : '') + ' · ' + esc(amtW) + '</span>' + (f === 'pen' ? 'Your pen' : f === 'pill' ? 'Your pills' : 'Your vial') + '</h2>' +
        '<div class="ac-opts three" role="group" aria-label="It comes in">' + FORMS.map(function(x){ return opt('acform', x[0], x[1], '', f === x[0]); }).join('') + '</div>';
      if(f === 'pen'){
        var H = held(st);
        return top + '<div class="ac-two">' + yd.input('acpmg', st.pmg || '', 'mg in one pen', {type: 'number', mode: 'decimal', min: 0, step: 'any', ph: 'On the pen'}) + '</div>' +
          (H ? '<div class="ac-draw" role="status"><b class="c3-num">' + H.n + '</b><span>' + (H.n === 1 ? 'dose in this pen' : 'doses in this pen') + '<small class="c3-num">' + esc(amtW) + ' each</small></span></div>'
             : '<div class="ac-draw ac-draw-0" role="status"><b class="c3-num">·</b><span>doses in this pen<small>from the mg on the pen</small></span></div>');
      }
      if(f === 'pill'){
        var Hp = held(st), tw = Hp ? safe(function(){ return pdTabWord(Hp.t); }, '') : '', tn = tw.replace(/ tablets?$/, '');
        return top + '<div class="ac-two">' + yd.input('actmg', st.tmg || '', 'mg a tablet', {type: 'number', mode: 'decimal', min: 0, step: 'any', ph: 'On the pack'}) +
            yd.input('actn', st.tn || '', 'Tablets in a pack', {type: 'number', mode: 'numeric', min: 0, step: 1, ph: 'Count'}) + '</div>' +
          (Hp ? '<div class="ac-draw" role="status"><b class="c3-num">' + esc(tn) + '</b><span>' + (Hp.t > 1 + 1e-9 ? 'tablets a dose' : 'tablet a dose') + (Hp.n != null ? '<small class="c3-num">' + Hp.n + (Hp.n === 1 ? ' dose' : ' doses') + ' in this pack</small>' : '') + '</span></div>'
              : '<div class="ac-draw ac-draw-0" role="status"><b class="c3-num">·</b><span>tablets a dose<small>from the mg on the pack</small></span></div>');
      }
      return top +
        '<div class="ac-two">' + yd.input('acvmg', st.vmg || '', 'mg in the vial', {type: 'number', mode: 'decimal', min: 0, step: 'any', ph: 'On the label'}) +
          yd.input('acvml', st.vml || '', 'mL of water you add', {type: 'number', mode: 'decimal', min: 0, step: 'any', ph: 'e.g. 2'}) + '</div>' +
        (D ? '<div class="ac-draw" role="status"><b class="c3-num">' + esc(String(Math.round(D.u * 10) / 10)) + '</b><span>units to draw<small class="c3-num">' + esc(String(Math.round(D.ml * 1000) / 1000)) + ' mL on a ' + D.syr + '-unit syringe · ' + D.n + (D.n === 1 ? ' dose' : ' doses') + ' in this vial</small></span></div>'
           : '<div class="ac-draw ac-draw-0" role="status"><b class="c3-num">·</b><span>units to draw<small>from the vial and the water</small></span></div>');
    }

    yd.screen('addcmp', {
      parent: 'doses', nav: 'stack',
      fall: function(){ C3.go('doses'); },
      render: function(ctx){
        var st = ctx.state, p0 = ctx.params || {}, pk = JSON.stringify(p0);
        if(st._in !== pk){ st._in = pk; st.step = 1; st.q = ''; st.cid = ''; st.amt = ''; st.unit = 'mg'; st.freq = 'weekly'; st.dows = []; st.hour = 7; st.start = 'today'; st.vmg = ''; st.vml = ''; st.form = 'vial'; st.pmg = ''; st.tmg = ''; st.tn = ''; st.saveId = null; st.saving = false; st.error = ''; st.from = p0.from || 'doses'; st.first = !!p0.first;var retained=(ALL.journeySetup||{}).addCompoundDraft;if(retained&&!retained.complete)Object.assign(st,retained.value); }
        var n = steps(st), ok2 = +st.amt > 0 && (st.freq !== 'days' || (st.dows || []).length);
        var dots = '<ol class="ac-dots" aria-label="Step ' + st.step + ' of ' + n + '">' + [1, 2, 3].slice(0, n).map(function(i){ return '<li class="' + (i < st.step ? 'done' : i === st.step ? 'on' : '') + '"></li>'; }).join('') + '</ol>';
        var head = yd.head({back: st.first ? 'today' : st.from, eyebrow: 'Step ' + st.step + ' of ' + n, title: 'Add', pk: 'a compound'});
        var body = st.step === 1 ? step1(st) : st.step === 2 ? step2(st) : step3(st);
        var foot = '';
        if(st.step === 2) foot = n === 2 ? yd.primary('acdone', 'Save compound', '', {icon: 'check', disabled: !ok2}) : yd.primary('acnext', 'Next', '<span>' + (!(+st.amt > 0) ? 'enter an amount first' : (st.freq === 'days' && !(st.dows || []).length) ? 'pick a day first' : st.form === 'pill' ? 'your pills' : 'your supply') + '</span>', {icon: 'arrow', disabled: !ok2});
        if(st.step === 3) foot = yd.primary('acdone', 'Save compound', '', {icon: 'check'});
        var back = '<div class="ac-back">' + (st.step > 1 ? '<button type="button" class="c3-link" data-act="acback" data-key="acback">Back</button>' : '') + '<button type="button" class="c3-link ac-cancel" data-act="accancel" data-key="btn-accancel">Cancel</button></div>';
        /* v373: the answers on the left; on the right (under them on a phone) the schedule they make, the one big button,
           Back and Cancel. Only the big button stays in reach on a phone; on a computer the column sits beside the form. */
        var sum = st.step >= 2 ? '<div class="ac-sum" role="status" aria-live="polite">' + sumHTML(st) + '</div>' : '';
        return '<div class="yd ac ac-s' + st.step + '">' + head + dots + '<section class="ac-body" aria-label="Step ' + st.step + '">' + body + '</section>' +
          sum + (st.error ? '<p class="ac-error" role="alert">' + esc(st.error) + '</p>' : '') + (foot ? '<div class="ac-foot">' + foot + '</div>' : '') + back + '</div>';
      },
      wire: function(root, ctx){
        var st = ctx.state, re = function(){ C3.render(); };
        var f = root.querySelector('[data-key="adq"]');
        if(f){ var tmr = 0; f.addEventListener('input', function(){ clearTimeout(tmr); var v = f.value; tmr = setTimeout(function(){ st.q = v; C3.render(); }, 160); });
          if(st.step === 1 && !st.q && !st.focused){ st.focused = 1; try{ f.focus({preventScroll: true}); }catch(e){} } }
        /* the amount and the vial answer as they are typed: the Next control and the units follow every key */
        var a = root.querySelector('[data-key="adamt"]');
        if(a) a.addEventListener('input', function(){ st.amt = a.value; var b = root.querySelector('[data-key="primary"]'); if(b) b.disabled = !(+st.amt > 0 && (st.freq !== 'days' || (st.dows || []).length));
          var sm = root.querySelector('.ac-sum'); if(sm) sm.innerHTML = sumHTML(st); });   /* v373: the schedule line follows every key */
        var FK = {acvmg: 'vmg', acvml: 'vml', acpmg: 'pmg', actmg: 'tmg', actn: 'tn'};
        Object.keys(FK).forEach(function(k){ var el = root.querySelector('[data-key="in-' + k + '"]'); if(el) el.addEventListener('input', function(){ st[FK[k]] = el.value; clearTimeout(st._dt); st._dt = setTimeout(re, 250); }); });
        var sel = root.querySelector('[data-key="acsel"]');
        if(sel) sel.addEventListener('change', function(){ var v = sel.value; if(v === '__own'){ C3.go('protocol', {id: 'new', from: 'doses'}); return; } var c = cmp(v); if(!c) return;
          var keep = st.step === 2 && +st.amt > 0 && units(c).some(function(u){ return u[0] === st.unit; });
          st.cid = v; if(!keep){ st.unit = units(c)[0][0]; } st.form = oralish(c) ? 'pill' : 'vial'; st.step = 2; re(); });
        yd.wire(root, ctx, {
          acpick: function(v){ var c = cmp(v); if(!c) return; st.cid = v; st.unit = units(c)[0][0]; st.form = oralish(c) ? 'pill' : 'vial'; st.step = 2; re(); },
          acform: function(v){ st.form = v === 'pen' || v === 'pill' ? v : 'vial'; re(); },
          acown: function(){ C3.go('protocol', {id: 'new', from: 'doses'}); },
          acunit: function(v){ st.unit = v; re(); },
          acfreq: function(v){ st.freq = v; if(v === 'days' && !(st.dows || []).length) st.dows = [new Date().getDay()]; re(); },
          acdow: function(v){ var d = (st.dows || []).slice(), i = d.indexOf(+v); if(i >= 0){ if(d.length > 1) d.splice(i, 1); } else d.push(+v); st.dows = d; re(); },
          acwhen: function(v){ st.hour = +v; re(); },
          acstart: function(v){ st.start = v === 'tomorrow' ? 'tomorrow' : 'today'; re(); },
          acnext: function(){ if(+st.amt > 0) { st.step = 3; re(); } },
          acback: function(){ st.step = Math.max(1, st.step - 1); re(); },
          accancel:function(){if(C3.journey)C3.journey.clearAddCompoundDraft();C3.go(st.from||'doses');},
          acdone: function(){
            if(st.saving) return;
            var p = build(st); if(!p || !(p.doseMg > 0)) { yd.toast('Put in your amount first.', 'bad'); return; }
            st.saving = true; st.error = ''; st.saveId = st.saveId || p.id; p.id = st.saveId;
            var before={protocols:(ALL.protocols||[]).slice(),mode:ALL.mode,activeId:ALL.activeId,ui:Object.assign({},ALL.ui||{})};
            ALL.protocols = (ALL.protocols || []).filter(function(x){ return !isPlaceholder(x); });
            var existing=ALL.protocols.findIndex(function(x){return x.id===p.id;});if(existing>=0)ALL.protocols[existing]=p;else ALL.protocols.push(p);
            if(ALL.mode === 'training'){ ALL.mode = 'peptide'; safe(function(){ syncMode(); }); }
            if(ALL.ui && ALL.ui.addFirst) delete ALL.ui.addFirst;
            safe(function(){ useProtocol(p.id); });
            p.xAt = Date.now();
            safe(function(){ pdAfterWrite(); });
            safe(function(){ syncAllInputs(); });
            if(typeof SAVE_FAIL !== 'undefined' && SAVE_FAIL){ALL.protocols=before.protocols;ALL.mode=before.mode;ALL.ui=before.ui;safe(function(){useProtocol(before.activeId);syncMode();});st.saving = false; st.error = 'This device could not save your compound. Your entries are still here. Free storage or allow site data, then tap Save compound again.'; re(); return; }
            if(C3.journey)C3.journey.clearAddCompoundDraft();
            var first = new Date(p.sched.anchor), when = (st.start === 'tomorrow' ? 'tomorrow' : 'today') + ', ' + hourWord(st.hour);
            if(p.sched.kind === 'weekly' && p.sched.daysOfWeek.indexOf(first.getDay()) < 0) when = safe(function(){ var r = pdModel().rows.filter(function(x){ return x.pid === p.id && !x.dose; }).sort(function(x, y){ return x.at - y.at; })[0]; return r ? new Date(r.at).toLocaleDateString('en-US', {weekday: 'long'}) + ', ' + hourWord(st.hour) : when; }, when);
            yd.toast('<b>' + esc(p.name) + '</b> saved on this device. First dose ' + esc(when) + '.');
            st._in = null;
            C3.go('doses', {tab: 'week'});
          }
        }, {
          /* typing already answered it (the input listener); leaving the field must not paint over the next one */
          acvmg: function(v){ if(st.vmg === v) return; st.vmg = v; re(); },
          acvml: function(v){ if(st.vml === v) return; st.vml = v; re(); },
          acpmg: function(v){ if(st.pmg === v) return; st.pmg = v; re(); },
          actmg: function(v){ if(st.tmg === v) return; st.tmg = v; re(); },
          actn: function(v){ if(st.tn === v) return; st.tn = v; re(); }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
