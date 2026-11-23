/* C3 screen: protocol (v326). One protocol, set up or changed: the compound (from the app's library, never typed), the
   amount the person runs, the route, the days (every N days, set days of the week, or days on and off), the hour,
   the first dose, what a skipped dose does, the steps they were given, and the vial (strength, water, price, spares).
   An existing protocol is written as each field changes, the way the old schedule form wrote it; a new one is a
   draft until "Add this protocol". Nothing is suggested: the amount starts empty and the steps are the person's own.
   Stop keeps the history and takes it off the plan; Delete is the old Remove compound, with its tombstones. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var DW = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
    var RT = [['sc', 'SC'], ['im', 'IM'], ['oral', 'Oral'], ['nasal', 'Nasal'], ['subl', 'Under tongue'], ['top', 'Topical']];
    function locked(id){ return safe(function(){ return !!PRO_PANES[id] && !isPro(); }, false); }
    function n2(v){ return Math.round(v * 1000) / 1000; }
    function iso(ms){ var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function hourWord(hr){ var a = hr % 12 === 0 ? 12 : hr % 12; return a + (hr < 12 ? ' AM' : ' PM'); }
    function blank(){
      var d = new Date(); d.setHours(9, 0, 0, 0); if(d.getTime() < Date.now() - 36e5) d.setDate(d.getDate() + 1);
      return {id: safe(function(){ return newId(); }, 'p' + Date.now().toString(36)), name: '', compound: '', doseMg: 0, everyH: 168, vialMg: 0, diluentMl: 0, deadMl: 0.05, costUsd: 0,
        doses: [], skips: [], holds: [], sched: {kind: 'interval', everyH: 168, anchor: d.getTime(), hourOfDay: 9, onSkip: 'hold', daysOfWeek: [], onDays: 5, offDays: 2}, ladder: [], inv: {spare: 0, leadDays: 7, openedAt: null, budDays: null}};
    }
    /* the protocol the app made up before anyone set one (training mode, never logged) is not a protocol to keep */
    function isPlaceholder(p){ return safe(function(){ return ALL.mode === 'training' && p.id === 'p-main' && !(p.doses || []).length; }, false); }
    function real(){ return (safe(function(){ return pdProtos(true); }, []) || []).filter(function(p){ return !isPlaceholder(p); }); }
    function evH(p){ var sc = p.sched || {}; return sc.kind === 'interval' ? Math.max(1, +sc.everyH || 168) : Math.max(1, Math.round(safe(function(){ return pdEveryDays(p); }, 7) * 24)); }
    /* v328: a compound of their own (its half-life and time to peak, from the paper or label) and a blend */
    function ownForm(st){
      var f = st.ownf || {};
      return '<div class="pr-own">' + yd.input('prof', f.n != null ? f.n : String(st.cq || '').trim(), 'Name', {k: 'n', extra: 'data-f="n"', max: 48}) +
        '<div class="pd-two">' + yd.input('prof', f.t12 || '', 'Half-life (hours)', {type: 'number', mode: 'decimal', min: 0, step: 'any', k: 't12', extra: 'data-f="t12"', ph: 'From the paper'}) + yd.input('prof', f.tmax || '', 'Time to peak (hours)', {type: 'number', mode: 'decimal', min: 0, step: 'any', k: 'tmax', extra: 'data-f="tmax"', ph: 'From the paper'}) + '</div>' +
        '<div class="yd-acts">' + yd.btn('prownok', 'Save custom compound', {icon: 'check',extra:'data-commit'}) + yd.btn('prownx', 'Cancel', {icon: 'x'}) + '</div>' + yd.note('Marked as your own numbers wherever it is drawn, never as published ones.') + '</div>';
    }
    function blendForm(st){
      var f = st.blendf || {}, lib = (safe(function(){ return LIB; }, []) || []).filter(function(c){ return !c.blend; }).slice().sort(function(a, b){ return a.n < b.n ? -1 : 1; });
      var opts = [['', 'Pick one']].concat(lib.map(function(c){ return [c.id, c.n]; }));
      return '<div class="pr-own">' + [1, 2, 3].map(function(i){ return '<div class="pd-two">' + yd.select('prbf', opts, f['c' + i] || '', 'Compound ' + i + (i === 3 ? ' (optional)' : ''), {k: 'c' + i, extra: 'data-f="c' + i + '"'}) +
          yd.input('prbf', f['m' + i] || '', 'mg in the vial', {type: 'number', mode: 'decimal', min: 0, step: 'any', k: 'm' + i, extra: 'data-f="m' + i + '"', ph: 'On the label'}) + '</div>'; }).join('') +
        yd.input('prbf', f.n || '', 'Name (optional)', {k: 'n', extra: 'data-f="n"', max: 48}) +
        '<div class="yd-acts">' + yd.btn('prblendok', 'Add the blend', {icon: 'plus'}) + yd.btn('prblendx', 'Cancel', {icon: 'x'}) + '</div></div>';
    }
    var DWN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    function baseMg(p){ var L = (p.ladder || []).slice().sort(function(a, b){ return a.afterDoses - b.afterDoses; }); return L.length && L[0].afterDoses === 0 ? +L[0].mg : +p.doseMg || 0; }

    yd.screen('protocol', {
      parent: 'doses', nav: 'stack',
      fall: function(){ C3.go('doses'); },
      render: function(ctx){
        var st = ctx.state, p0 = ctx.params || {}, pk = JSON.stringify(p0);
        if(st._in !== pk){ st._in = pk; st.id = p0.id || 'new'; st.cq = ''; st.d = null; st.change = false; st.error = ''; st.saving = false; }
        var isNew = st.id === 'new', P = isNew ? null : safe(function(){ return pdProto(st.id); }, null);
        if(!isNew && !P){ st.id = 'new'; isNew = true; }
        var head = yd.head({back: 'doses', eyebrow: isNew ? 'New protocol' : (P.stopped ? 'Stopped' : 'Your protocol'), title: isNew ? 'Set up' : 'Your', pk: isNew ? 'a protocol' : 'protocol'});
        if(isNew && locked('compounds') && real().length >= 1)
          return '<div class="yd pr">' + head + yd.lock('compounds', 'More than one protocol', {desc:'Running two or more compounds on one clock, with the site rotation and supply across all of them.'}) + '</div>';
        if(!st.d){var retained=((ALL.journeySetup||{}).compoundDrafts||{})[st.id];st.d=retained&&!retained.complete?JSON.parse(JSON.stringify(retained.value)):isNew?blank():JSON.parse(JSON.stringify(P));st.base=retained&&!retained.complete&&retained.base?retained.base:P?JSON.parse(JSON.stringify(P)):{};st.rawInputs=retained&&!retained.complete?retained.rawInputs||{}:{};}
        var p = st.d, c = p.compound ? safe(function(){ return byId(p.compound); }, null) : null, sc = p.sched || {};
        var unit = p.compound ? safe(function(){ return unitWord(p); }, 'mg') : 'mg';
        /* what */
        var what;
        if(c && !st.change){
          what = '<div class="pr-cmp"><span><b>' + esc(c.n) + '</b><small>' + esc([c.cls, c.a ? String(c.a).split(',')[0] : ''].filter(Boolean).join(' · ')) + '</small></span>' + yd.btn('prchange', 'Change', {icon:'refresh'}) + '</div>';
        } else {
          var q = String(st.cq || '').trim().toLowerCase();
          var hits = q.length >= 2 ? (safe(function(){ return LIB; }, []) || []).filter(function(x){ return ((x.n || '') + ' ' + (x.a || '') + ' ' + (x.cls || '')).toLowerCase().indexOf(q) >= 0; }).slice(0, 8) : [];
          what = '<label class="mk-find"><span class="k">Compound</span><input class="yd-in" type="search" data-key="prcq" value="' + esc(st.cq || '') + '" placeholder="Search by name" autocomplete="off"></label>' +
            (hits.length ? '<ul class="pr-hits">' + hits.map(function(x){ return '<li><button type="button" class="pr-hit" data-act="prpick" data-v="' + esc(x.id) + '" data-key="prpick-' + esc(x.id) + '"><b>' + esc(x.n) + '</b><small>' + esc(x.cls || '') + '</small></button></li>'; }).join('') + '</ul>'
              : q.length >= 2 ? yd.empty('Nothing by that name in the library of ' + (safe(function(){ return LIB.length; }, 0)) + '.') : '') +
            /* v328: their own compound and a blend in one vial, here and free */
            (st.own ? ownForm(st) : st.blend ? blendForm(st) : '<div class="yd-acts pr-more">' + yd.btn('prown', q.length >= 2 && !hits.length ? 'Add \u201c' + String(st.cq).trim().slice(0, 30) + '\u201d as my own' : 'One that is not listed', {icon: 'plus'}) + yd.btn('prblend', 'A blend in one vial', {icon: 'plus'}) + '</div>') +
            (c ? '<div class="yd-acts">' + yd.btn('prkeep', 'Keep ' + c.n, {}) + '</div>' : '');
        }
        var amt = baseMg(p), amtShown = amt > 0 ? safe(function(){ return n2(amtOut(p, amt)); }, amt) : '';
        var amountSec = yd.sec('Amount', '<div class="pr-amt">' + yd.input('pramt', amtShown, 'Each dose (' + unit + ')', {type:'number', mode:'decimal', min:0, step:'any', ph:'Your amount'}) +
            (c && safe(function(){ return canIU(c) && !iuOnly(c); }, false) ? yd.seg('prunit', [['mg', 'mg'], ['iu', 'IU']], p.unit === 'iu' ? 'iu' : 'mg', {aria:'Unit', cls:'pd-seg'}) : '') + '</div>' +
          yd.seg('prroute', RT, safe(function(){ return protoRoute(p); }, 'sc'), {aria:'Route', cls:'pd-seg pr-routes'}), {id:'amount'});
        /* days */
        var kind = sc.kind || 'interval', days = '';
        if(kind === 'interval') days = yd.input('prevery', n2((+sc.everyH || 168) / 24), 'Every (days)', {type:'number', mode:'decimal', min:0.25, step:'any'});
        else if(kind === 'weekly') days = '<div class="pr-dow" role="group" aria-label="Days of the week">' + DW.map(function(d){ var on = (sc.daysOfWeek || []).indexOf(d[0]) >= 0;
          return '<button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="prdow" data-v="' + d[0] + '" data-key="prdow-' + d[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + d[1] + '</button>'; }).join('') + '</div>';
        else if(kind === 'cycle') days = '<div class="pd-two">' + yd.input('pron', sc.onDays | 0, 'Days on', {type:'number', mode:'numeric', min:1, step:1}) + yd.input('proff', sc.offDays | 0, 'Days off', {type:'number', mode:'numeric', min:0, step:1}) + '</div>';
        var hrs = []; for(var hr = 0; hr < 24; hr++) hrs.push([hr, hourWord(hr)]);
        if(kind === 'split'){
          /* v328: each day its own amount and hour */
          var SP = sc.split || {};
          days = '<ul class="pr-split">' + DW.map(function(d){ var on = !!SP[d[0]], x = SP[d[0]] || {};
            return '<li class="' + (on ? 'on' : '') + '"><button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="prsplit" data-v="' + d[0] + '" data-key="prsplit-' + d[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + d[1] + '</button>' +
              (on ? yd.input('prsmg', x.mg > 0 ? safe(function(){ return n2(amtOut(p, +x.mg)); }, x.mg) : '', 'Amount (' + unit + ')', {type:'number', mode:'decimal', min:0, step:'any', k: String(d[0]), extra: 'data-d="' + d[0] + '"', ph: 'Yours'}) +
                yd.select('prsh', hrs, Number.isFinite(+x.h) ? +x.h : (Number.isFinite(sc.hourOfDay) ? sc.hourOfDay : 9), 'At', {k: String(d[0]), extra: 'data-d="' + d[0] + '"'}) : '<span class="off">No dose</span>') + '</li>'; }).join('') + '</ul>';
        }
        var nT = Array.isArray(sc.times) && sc.times.length > 1 ? sc.times.length : 1;
        var timesUI = (kind === 'weekly' || kind === 'cycle') ? '<p class="pd-q">Times a day</p>' + yd.seg('prtimes', [[1, 'Once'], [2, 'Twice'], [3, 'Three times']], nT, {aria: 'Times a day', cls: 'pd-seg fill'}) +
          (nT > 1 ? '<div class="pr-times">' + sc.times.map(function(t, i){ return yd.select('prtime', hrs, +t, i === 0 ? 'First' : i === 1 ? 'Second' : 'Third', {k: String(i), extra: 'data-i="' + i + '"'}); }).join('') + '</div>' : '') : '';
        var blocksUI = '<p class="pd-q">Blocks of weeks</p><div class="pd-two">' + yd.input('prbon', sc.blockOn > 0 ? sc.blockOn : '', 'Weeks on', {type:'number', mode:'numeric', min:0, step:1, ph:'Every week'}) + yd.input('prboff', sc.blockOff > 0 ? sc.blockOff : '', 'Weeks off', {type:'number', mode:'numeric', min:0, step:1, ph:'None'}) + '</div>' +
          yd.input('prend', sc.endAt > 0 ? iso(sc.endAt) : '', 'Last day (optional)', {type:'date'});
        var schedSec = yd.sec('Days', yd.seg('prkind', [['interval', 'Every few days'], ['weekly', 'Set days'], ['cycle', 'On and off'], ['split', 'Split week']], kind, {aria:'Pattern', cls:'pd-seg pr-kind'}) + days + timesUI +
          '<div class="pd-two">' + (kind === 'split' || nT > 1 ? '' : yd.select('prhour', hrs, Number.isFinite(sc.hourOfDay) ? sc.hourOfDay : 9, 'At')) + yd.input('prstart', iso(sc.anchor || Date.now()), (p.doses || []).length ? 'Started' : 'First dose', {type:'date'}) + '</div>' + blocksUI +
          (safe(function(){ return rxSchedWord(p); }, '') ? '<p class="pr-word">' + esc(safe(function(){ return rxSchedWord(p); }, '')) + '</p>' : '') +
          '<p class="pd-q">A skipped dose</p>' + yd.seg('prskip', [['hold', 'Keeps the planned days'], ['shift', 'Moves the rest later']], sc.onSkip || 'hold', {aria:'What a skipped dose does', cls:'pd-seg fill wrap2'}), {id:'days'});
        /* steps */
        var L = (p.ladder || []).slice().sort(function(a, b){ return a.afterDoses - b.afterDoses; }).filter(function(r){ return r.afterDoses > 0; });
        var stepsSec = yd.sec('Steps', (L.length ? '<ul class="pr-steps">' + L.map(function(r){ return '<li><span>After <b class="c3-num">' + r.afterDoses + '</b> ' + (r.afterDoses === 1 ? 'dose' : 'doses') + '</span><b class="c3-num">' + esc(safe(function(){ return amtTxt(p, r.mg); }, r.mg + ' mg')) + '</b>' +
            '<button type="button" class="c3-btn-quiet bare pd-sm" data-act="prstepx" data-v="' + r.afterDoses + '" data-key="prstepx-' + r.afterDoses + '" aria-label="Remove the step after ' + r.afterDoses + ' doses">' + yd.icon('x', 14, 2.8) + '</button></li>'; }).join('') + '</ul>' : yd.empty('None. If your amount changes after a number of doses, add each step here.')) +
          '<div class="pd-two pr-addstep">' + yd.input('prsn', st.sn || '', 'After this many doses', {type:'number', mode:'numeric', min:1, step:1, ph:'4'}) + yd.input('prsm', st.sm || '', 'Amount (' + unit + ')', {type:'number', mode:'decimal', min:0, step:'any', ph:'Your amount'}) + '</div>' +
          '<div class="yd-acts">' + yd.btn('prstepadd', 'Add the step', {icon:'plus'}) + '</div>', {id:'steps'});
        /* vial, pen or pills (v335) */
        var inv = p.inv || {}, form = safe(function(){ return pdForm(p); }, 'vial'), conc = form === 'vial' && p.vialMg > 0 && p.diluentMl > 0 ? p.vialMg / p.diluentMl : 0, inj = safe(function(){ return pdInjected(p); }, true);
        var syr = safe(function(){ return pdPrefs().syr; }, 100), Wd = safe(function(){ return pdWords(p); }, null) || {one:'vial', many:'vials'};
        var calc = conc && amt > 0 ? '<ul class="pd-facts"><li><b class="c3-num">' + n2(conc) + ' mg/mL</b> once mixed</li>' + (inj ? '<li><b class="c3-num">' + Math.round(amt / conc * syr * 10) / 10 + ' units</b> a dose on a U-' + syr + ' syringe (' + n2(amt / conc) + ' mL)</li>' : '') +
          '<li>A vial is <b class="c3-num">' + Math.floor(Math.max(0, p.diluentMl - (p.deadMl || 0)) / (amt / conc)) + '</b> doses at this amount</li></ul>' : '';
        if(form === 'pen' && p.penMg > 0 && amt > 0) calc = '<ul class="pd-facts"><li>A pen is <b class="c3-num">' + Math.floor(p.penMg / amt + 1e-9) + '</b> doses at this amount</li></ul>';
        if(form === 'pill' && p.tabMg > 0 && amt > 0) calc = '<ul class="pd-facts"><li><b class="c3-num">' + esc(safe(function(){ return pdTabWord(amt / p.tabMg); }, '')) + '</b> a dose</li>' + (p.tabs > 0 ? '<li>A pack is <b class="c3-num">' + Math.floor(p.tabs / (amt / p.tabMg) + 1e-9) + '</b> doses at this amount</li>' : '') + '</ul>';
        var fields = form === 'pen' ? '<div class="pd-two">' + yd.input('prpmg', p.penMg > 0 ? n2(p.penMg) : '', 'mg in one pen', {type:'number', mode:'decimal', min:0, step:'any', ph:'On the pen'}) + '</div>'
          : form === 'pill' ? '<div class="pd-two">' + yd.input('prtmg', p.tabMg > 0 ? n2(p.tabMg) : '', 'mg a tablet', {type:'number', mode:'decimal', min:0, step:'any', ph:'On the pack'}) +
              yd.input('prtn', p.tabs > 0 ? String(p.tabs) : '', 'Tablets in a pack', {type:'number', mode:'numeric', min:0, step:1, ph:'Count'}) + '</div>'
          : '<div class="pd-two">' + yd.input('prvmg', p.vialMg > 0 ? n2(p.vialMg) : '', 'Strength (mg in the vial)', {type:'number', mode:'decimal', min:0, step:'any', ph:'On the label'}) +
              yd.input('prdil', p.diluentMl > 0 ? n2(p.diluentMl) : '', 'Water added (mL)', {type:'number', mode:'decimal', min:0, step:'any', ph:'What you add'}) + '</div>';
        var vialSec = yd.sec(form === 'pen' ? 'Pen' : form === 'pill' ? 'Pills' : 'Vial', yd.seg('prform', [['vial', 'Vial'], ['pen', 'Pen'], ['pill', 'Pills']], form, {aria:'It comes in', cls:'pd-seg fill'}) + fields +
          '<div class="pd-two pr-cost-stock">' + yd.input('prcost', p.costUsd > 0 ? p.costUsd : '', 'Price of a ' + Wd.one + ' ($)', {type:'number', mode:'decimal', min:0, step:'0.01', ph:'Optional'}) +
            '<div class="pd-hh"><span class="k">Spare ' + Wd.many + '</span>' + yd.btn('prspare', '', {v: Math.max(0, (inv.spare | 0) - 1), icon:'minus', aria:'One spare ' + Wd.one + ' fewer', disabled: (inv.spare | 0) <= 0, cls:'pd-step'}) + '<b class="c3-num">' + (inv.spare | 0) + '</b>' + yd.btn('prspare', '', {v: (inv.spare | 0) + 1, icon:'plus', aria:'One spare ' + Wd.one + ' more', cls:'pd-step'}) + '</div></div>' + calc, {id:'vial'});
        /* v328: the zones this protocol goes in (none picked: every zone its route takes) */
        var route = safe(function(){ return rxRouteOf(p); }, 'sc'), zs = (safe(function(){ return rxZones(); }, []) || []).filter(function(z){ return z.r.indexOf(route) >= 0; }), own = Array.isArray(p.sites) ? p.sites : [];
        var sitesSec = inj ? yd.sec('Sites', '<div class="pr-zones" role="group" aria-label="Zones for this protocol">' + zs.map(function(z){ var on = !own.length || own.indexOf(z.k) >= 0;
            return '<button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="przone" data-v="' + esc(z.k) + '" data-key="przone-' + esc(z.k) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(z.k) + '</button>'; }).join('') + '</div>' +
          yd.note(own.length ? own.length + ' of ' + zs.length + ' ' + route.toUpperCase() + ' zones for this one. ' + '<button type="button" class="pr-link" data-act="przall" data-key="przall">Use them all</button>' : 'Every ' + route.toUpperCase() + ' zone, in rotation with your other protocols. Tap one to leave it out for this protocol.'), {id:'sites'}) : '';
        vialSec = vialSec.replace('</section>', '<div class="yd-acts">' + yd.btn('prmath', 'Open the calculators', {icon:'chev'}) + '</div></section>');
        var nameSec = yd.sec('Label', yd.input('prname', p.name && (!c || p.name !== c.n) ? p.name : '', 'A name for it (optional)', {ph: c ? c.n : 'Morning'}), {id:'name'});
        var acts;
        if(isNew){
          var ok = !!c && amt > 0;
          acts = '<div class="pr-save">' + (st.error ? '<p role="alert">' + esc(st.error) + '</p>' : '') + yd.primary('pradd', 'Save compound', ok ? esc(c.n) : (c ? 'Enter your amount' : 'Choose a compound'), {icon:'check', disabled: !ok,extra:'data-commit'}) + '</div>';
        } else {
          acts = '<div class="pr-save">' + (st.error ? '<p role="alert">' + esc(st.error) + '</p>' : '') + yd.primary('prsave','Save changes','',{icon:'check',extra:'data-commit'}) + '<p>Review your changes, then save to apply them.</p></div><div class="yd-acts">' + (p.stopped ? yd.btn('prrestart', 'Run it again', {icon:'refresh'}) : yd.arm(ctx, 'prstop', 'Stop this protocol', 'Tap again to stop it', {icon:'x'})) +
            ((ALL.protocols || []).length > 1 ? yd.arm(ctx, 'prdel', 'Delete it and its log', 'Tap again to delete', {icon:'x'}) : '') + '</div>' +
            yd.note(P.stopped ? 'Stopped ' + esc(safe(function(){ return new Date(P.stopped).toLocaleDateString('en-US', {month:'short', day:'numeric'}); }, '')) + '. Its log stays; nothing more is planned or reminded.' : 'Stop takes it off the plan and the reminders and keeps every dose you logged.');
        }
        return '<div class="yd pr">' + head + '<div class="yd-cols"><div class="yd-col">' + yd.sec('What', what, {id:'what'}) + amountSec + nameSec + '</div>' +
          '<div class="yd-col">' + schedSec + stepsSec + vialSec + sitesSec + '</div></div>' + acts + '<div class="yd-acts">'+yd.btn('prcancel','Cancel')+'<button type="button" class="c3-btn-quiet" data-go="doses">Back</button></div></div>';
      },
      wire: function(root, ctx){
        var st = ctx.state;
        var isNew = function(){ return st.id === 'new'; };
        var tgt = function(){ return st.d; };
        var put = function(fn){ var p = tgt(); if(!p) return; fn(p); p.sched = p.sched || {}; p.everyH = evH(p); if(!changingInput)C3.render(); };
        var setBase = function(p, mg){ p.ladder = (p.ladder || []).filter(function(r){ return r.afterDoses > 0; }); p.ladder.unshift({afterDoses: 0, mg: mg}); p.doseMg = mg; };
        var anchorAt = function(p, dateStr, hr){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || ''); var base = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(p.sched.anchor || Date.now()); base.setHours(hr, 0, 0, 0); return base.getTime(); };
        var acts0 = {},changes={},changingInput=false;
        function validForm(){var amount=root.querySelector('[data-key="in-pramt"]');if(!amount||!(+amount.value>0))return false;return Array.from(root.querySelectorAll('input[type="number"]')).every(function(el){return el.checkValidity();});}
        yd.wire(root, ctx, Object.assign(acts0, {
          prchange: function(){ st.change = true; st.cq = ''; C3.render(); },
          prkeep: function(){ st.change = false; C3.render(); },
          prpick: function(v){ put(function(p){ var was = p.compound; p.compound = v; var c = safe(function(){ return byId(v); }, null); if(!p.name || (was && safe(function(){ return byId(was).n; }, '') === p.name)) p.name = c ? c.n : p.name;
            if(!(p.vialMg > 0)){ var lv = safe(function(){ return lastVialFor(v); }, null); if(lv){ p.vialMg = lv.vialMg; p.diluentMl = lv.diluentMl; p.deadMl = lv.deadMl || 0.05; if(!(p.costUsd > 0)) p.costUsd = lv.costUsd || 0; } }
            if(c && safe(function(){ return iuOnly(c); }, false)) p.unit = 'iu'; }); st.change = false; st.cq = ''; },
          prunit: function(v){ put(function(p){ p.unit = v === 'iu' ? 'iu' : undefined; if(!p.unit) delete p.unit; }); },
          prroute: function(v){ put(function(p){ p.route = v; }); },
          /* v328 */
          prown: function(){ st.own = true; st.blend = false; st.ownf = {n: String(st.cq || '').trim()}; C3.render(); },
          prownx: function(){ st.own = false; C3.render(); },
          prownok: function(){ var f = st.ownf || {}; ['n', 't12', 'tmax'].forEach(function(k){ var el = root.querySelector('[data-key="in-prof-' + k + '"]'); if(el) f[k] = el.value; });
            var r = safe(function(){ return rxAddOwn({n: f.n, t12: +f.t12, tmax: +f.tmax}); }, {ok: false, why: 'Could not add it.'});
            if(!r.ok){ yd.toast(r.why, 'bad'); st.ownf = f; return; } st.own = false; st.ownf = null; acts0.prpick(r.id); yd.toast(f.n + ' added to your compounds.'); },
          prblend: function(){ st.blend = true; st.own = false; st.blendf = {}; C3.render(); },
          prblendx: function(){ st.blend = false; C3.render(); },
          prblendok: function(){ var f = st.blendf || {};
            var parts = [1, 2, 3].map(function(i){ return {id: f['c' + i], mg: +f['m' + i]}; }).filter(function(x){ return x.id && x.mg > 0; });
            var r = safe(function(){ return rxAddBlend({n: f.n, parts: parts}); }, {ok: false, why: 'Could not add it.'});
            if(!r.ok){ yd.toast(r.why, 'bad'); return; } st.blend = false; st.blendf = null; acts0.prpick(r.id); yd.toast('Blend added.'); },
          prsplit: function(v){ put(function(p){ var S = Object.assign({}, p.sched.split || {}); if(S[v]){ if(Object.keys(S).length > 1) delete S[v]; } else S[v] = {mg: baseMg(p) || 0, h: Number.isFinite(p.sched.hourOfDay) ? p.sched.hourOfDay : 9}; p.sched.split = S; }); },
          prtimes: function(v){ put(function(p){ var nn = Math.max(1, Math.min(3, +v | 0)), h0 = Number.isFinite(p.sched.hourOfDay) ? p.sched.hourOfDay : 9; if(nn === 1){ delete p.sched.times; return; }
            var T = (Array.isArray(p.sched.times) && p.sched.times.length ? p.sched.times.slice() : [h0]); while(T.length < nn) T.push(Math.min(23, (T[T.length - 1] || h0) + (nn === 2 ? 12 : 6))); p.sched.times = T.slice(0, nn).sort(function(a, b){ return a - b; }); p.sched.hourOfDay = p.sched.times[0]; }); },
          przone: function(v){ put(function(p){ var all = (safe(function(){ return rxZones(); }, []) || []).filter(function(z){ return z.r.indexOf(rxRouteOf(p)) >= 0; }).map(function(z){ return z.k; });
            var cur = Array.isArray(p.sites) && p.sites.length ? p.sites.slice() : all.slice(), i = cur.indexOf(v); if(i >= 0){ if(cur.length > 1) cur.splice(i, 1); } else cur.push(v);
            p.sites = cur.length >= all.length ? [] : cur; if(!p.sites.length) delete p.sites; }); },
          przall: function(){ put(function(p){ delete p.sites; }); },
          prmath: function(){ var p = tgt(); C3.go('math', {pid: p && !isNew() ? p.id : '', from: 'protocol'}); },
          prkind: function(v){ put(function(p){ var was = p.sched.kind; p.sched.kind = v; if(v === 'split' && !(p.sched.split && Object.keys(p.sched.split).length)){ var S = {}; S[new Date(p.sched.anchor || Date.now()).getDay()] = {mg: baseMg(p) || 0, h: Number.isFinite(p.sched.hourOfDay) ? p.sched.hourOfDay : 9}; p.sched.split = S; } if(v === 'weekly' && (was !== 'weekly' || !(p.sched.daysOfWeek || []).length)) p.sched.daysOfWeek = [new Date(p.sched.anchor || Date.now()).getDay()];   /* the day it starts on, nothing invented */ if(v === 'cycle'){ if(!(p.sched.onDays > 0)) p.sched.onDays = 5; if(p.sched.offDays == null) p.sched.offDays = 2; } }); },
          prdow: function(v){ put(function(p){ var d = (p.sched.daysOfWeek || []).slice(), i = d.indexOf(+v); if(i >= 0){ if(d.length > 1) d.splice(i, 1); } else d.push(+v); p.sched.daysOfWeek = d.sort(); }); },
          prskip: function(v){ put(function(p){ p.sched.onSkip = v === 'shift' ? 'shift' : 'hold'; }); },
          prstepx: function(v){ put(function(p){ p.ladder = (p.ladder || []).filter(function(r){ return r.afterDoses !== +v; }); }); },
          prstepadd: function(){ var a = root.querySelector('[data-key="in-prsn"]'), b = root.querySelector('[data-key="in-prsm"]'); var n = Math.round(+(a ? a.value : st.sn)), m = +(b ? b.value : st.sm);
            if(!(n > 0 && m > 0)){ yd.toast('A number of doses and an amount, both above zero.', 'bad'); return; } put(function(p){ var mg = safe(function(){ return amtIn(p, m); }, m); if(!(p.ladder || []).some(function(r){ return r.afterDoses === 0; }) && p.doseMg > 0) setBase(p, p.doseMg); p.ladder = (p.ladder || []).filter(function(r){ return r.afterDoses !== n; }); p.ladder.push({afterDoses: n, mg: mg}); p.ladder.sort(function(a, b){ return a.afterDoses - b.afterDoses; }); }); st.sn = ''; st.sm = ''; C3.render(); },
          prform: function(v){ put(function(p){ if(v === 'pen' || v === 'pill') p.form = v; else delete p.form; p.formAt = Date.now(); }); },
          prspare: function(v){ put(function(p){ p.inv = Object.assign({spare: 0, leadDays: 7, openedAt: null, budDays: null}, p.inv || {}); p.inv.spare = Math.max(0, +v | 0); }); },
          pradd: function(){
            if(st.saving)return;
            if(!validForm()){st.error='Check the amount and highlighted numbers before saving.';C3.render();return;}
            var p = st.d; if(!p || !p.compound || !(baseMg(p) > 0)){st.error='Choose a compound and enter an amount above zero.';C3.render();return;}
            st.saving=true;st.error='';
            var before={protocols:(ALL.protocols||[]).slice(),mode:ALL.mode,activeId:ALL.activeId};
            p.everyH = evH(p);
            ALL.protocols = (ALL.protocols || []).filter(function(x){ return !isPlaceholder(x); });
            if(!ALL.protocols.some(function(x){return x.id===p.id;}))ALL.protocols.push(p);
            if(ALL.mode === 'training'){ ALL.mode = 'peptide'; safe(function(){ syncMode(); }); }
            safe(function(){ useProtocol(p.id); });
            p.xAt = Date.now();
            safe(function(){ mergeCustomLib(); });
            safe(function(){ pdAfterWrite(); });
            safe(function(){ syncAllInputs(); });
            if(typeof SAVE_FAIL!=='undefined'&&SAVE_FAIL){ALL.protocols=before.protocols;ALL.mode=before.mode;safe(function(){useProtocol(before.activeId);syncMode();});st.saving=false;st.error='This device could not save. Your entries are still here. Free storage or allow site data, then try Save compound again.';C3.render();return;}
            if(C3.journey)C3.journey.clearCompoundDraft(st.id);
            st.d = null;
            st._in=null;
            yd.toast(pdName(p) + ' saved on this device.');
            C3.go('doses', {tab: 'week'});
          },
          prsave:function(){if(!validForm()){st.error='Check the amount and highlighted numbers before saving.';C3.render();return;}var p=tgt(),actual=pdProto(st.id);if(!p||isNew()||!actual)return;var index=ALL.protocols.indexOf(actual),next=C3.journey.mergeEdits(actual,st.base||actual,p);['doses','skips','holds','weights','sx','audit'].forEach(function(k){if(actual[k]!=null)next[k]=actual[k];});ALL.protocols[index]=next;safe(function(){pdTouch(next);useProtocol(next.id);pdAfterWrite();});if(!saveOk()){ALL.protocols[index]=actual;safe(function(){useProtocol(actual.id);});st.error='This device could not save. Your draft is still here. Retry when storage is available.';C3.render();return;}if(C3.journey)C3.journey.clearCompoundDraft(st.id);yd.toast('Changes saved on this device.');C3.go('doses',{tab:'week'});},
          prcancel:function(){if(C3.journey)C3.journey.clearCompoundDraft(st.id);C3.go('doses');},
          prstop: function(){ put(function(p){ p.stopped = Date.now(); }); yd.toast('Stop selected. Save changes to apply it.'); },
          prrestart: function(){ put(function(p){ delete p.stopped; }); yd.toast('Restart selected. Save changes to apply it.'); },
          prdel: function(){
            var p = pdProto(st.id); if(!p || isNew()) return;
            safe(function(){ tomb('protocols', p.id); (p.doses || []).forEach(function(d){ tomb('doses', p.id + '|' + d.at); }); });
            ALL.protocols = (ALL.protocols || []).filter(function(x){ return x.id !== p.id; });
            safe(function(){ useProtocol((ALL.protocols[0] || {}).id); });
            safe(function(){ pdAfterWrite(); syncAllInputs(); });
            yd.toast(pdName(p) + ' deleted.');
            C3.go('doses');
          }
        }, yd.lockActs), changes={
          pramt: function(v){ var x = +v; if(!(x > 0)) return; put(function(p){ setBase(p, safe(function(){ return amtIn(p, x); }, x)); }); },
          prname: function(v){ put(function(p){ var t = String(v || '').trim().slice(0, 40); var c = safe(function(){ return byId(p.compound); }, null); p.name = t || (c ? c.n : ''); }); },
          prevery: function(v){ var d = +v; if(!(d > 0)) return; put(function(p){ p.sched.everyH = Math.max(1, Math.round(d * 24)); }); },
          pron: function(v){ var d = Math.round(+v); if(!(d >= 1)) return; put(function(p){ p.sched.onDays = d; }); },
          proff: function(v){ var d = Math.round(+v); if(!(d >= 0)) return; put(function(p){ p.sched.offDays = d; }); },
          prhour: function(v){ put(function(p){ var hr = +v | 0; p.sched.hourOfDay = hr; p.sched.anchor = anchorAt(p, iso(p.sched.anchor || Date.now()), hr); }); },
          prstart: function(v){ put(function(p){ p.sched.anchor = anchorAt(p, v, Number.isFinite(p.sched.hourOfDay) ? p.sched.hourOfDay : 9); }); },
          prsmg: function(v, el){ var x = +v; if(!(x > 0)) return; var d = el.getAttribute('data-d'); put(function(p){ var S = Object.assign({}, p.sched.split || {}); S[d] = Object.assign({}, S[d] || {}, {mg: safe(function(){ return amtIn(p, x); }, x)}); p.sched.split = S; }); },
          prsh: function(v, el){ var d = el.getAttribute('data-d'); put(function(p){ var S = Object.assign({}, p.sched.split || {}); S[d] = Object.assign({}, S[d] || {}, {h: +v | 0}); p.sched.split = S; }); },
          prtime: function(v, el){ var i = +el.getAttribute('data-i'); put(function(p){ var T = (p.sched.times || []).slice(); T[i] = +v | 0; p.sched.times = T.sort(function(a, b){ return a - b; }); p.sched.hourOfDay = p.sched.times[0]; }); },
          prbon: function(v){ var x = Math.max(0, Math.round(+v || 0)); put(function(p){ if(x > 0) p.sched.blockOn = x; else { delete p.sched.blockOn; } if(!(p.sched.blockOff > 0) && x > 0) p.sched.blockOff = 0; }); },
          prboff: function(v){ var x = Math.max(0, Math.round(+v || 0)); put(function(p){ if(x > 0) p.sched.blockOff = x; else delete p.sched.blockOff; }); },
          prend: function(v){ put(function(p){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); if(!m){ delete p.sched.endAt; return; } var d = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 0, 0); p.sched.endAt = d.getTime(); }); },
          prof: function(v, el){ st.ownf = st.ownf || {}; st.ownf[el.getAttribute('data-f')] = v; },
          prbf: function(v, el){ st.blendf = st.blendf || {}; st.blendf[el.getAttribute('data-f')] = v; },
          prsn: function(v){ st.sn = v; },
          prsm: function(v){ st.sm = v; },
          prvmg: function(v){ var x = +v; if(!(x >= 0)) return; put(function(p){ p.vialMg = n2(x); }); },
          prdil: function(v){ var x = +v; if(!(x >= 0)) return; put(function(p){ p.diluentMl = n2(x); }); },
          prpmg: function(v){ var x = +v; if(!(x >= 0)) return; put(function(p){ p.penMg = n2(x); }); },
          prtmg: function(v){ var x = +v; if(!(x >= 0)) return; put(function(p){ p.tabMg = n2(x); }); },
          prtn: function(v){ var x = Math.max(0, Math.round(+v || 0)); put(function(p){ p.tabs = x; }); },
          prcost: function(v){ var x = Math.max(0, +v || 0); put(function(p){ p.costUsd = Math.round(x * 100) / 100; }); }
        });
        root.querySelectorAll('[data-chg]').forEach(function(el){var key=el.getAttribute('data-chg');if(!changes[key])return;el.addEventListener('input',function(){changingInput=true;try{changes[key](el.value,el);}finally{changingInput=false;}});});
        Object.entries(st.rawInputs||{}).forEach(function(pair){var el=root.querySelector('[data-key="'+pair[0]+'"]');if(el&&el.matches('input,textarea,select'))el.value=pair[1];});
        var f = root.querySelector('[data-key="prcq"]');
        if(f){ var tmr = 0; f.addEventListener('input', function(){ clearTimeout(tmr); var v = f.value; tmr = setTimeout(function(){ st.cq = v; C3.render(); }, 180); }); }
        var amount=root.querySelector('[data-key="in-pramt"]');
        if(amount&&isNew())amount.addEventListener('input',function(){var p=tgt(),n=+amount.value;if(p)setBase(p,Number.isFinite(n)&&n>0?safe(function(){return amtIn(p,n);},n):0);var b=root.querySelector('[data-act="pradd"]');if(b)b.disabled=!(p&&p.compound&&baseMg(p)>0);});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
