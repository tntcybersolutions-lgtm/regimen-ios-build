/* C3 screen: math (v328). Every calculator a person running a protocol reaches for, free, in one place:
     Mix      a vial and the water in it: strength, the draw for an amount, where the plunger lands on the marks of
              the syringe in hand, doses in the vial, and the three water volumes that land it right on a mark
              (the app's own mixOne / solveMix)
     Water    the other way round: the draw they want, the water that makes it
     Blend    two or three compounds in one vial: what one draw carries of each, or the draw for an amount of one
     Oil      a strength in mg/mL: the draw, a week, the vial, the 28 days a punctured vial is good for; a
              testosterone ester shows the testosterone in it (the app's trtCalc)
     Nasal    a spray bottle: what one spray carries, sprays for an amount, sprays in the bottle
     Supply   a run of weeks: vials, what it costs, when it ends
     Free T   free and bioavailable testosterone from a lab result (Vermeulen; the app's freeT)
   Nothing is suggested: every amount starts empty or comes from the person's own protocol (From my protocol).
   Not advice; no coach on this screen. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var TABS = [['mix', 'Mix'], ['water', 'Water'], ['blend', 'Blend'], ['oil', 'Oil'], ['nasal', 'Nasal'], ['supply', 'Supply'], ['ft', 'Free T']];
    var BARRELS = [['100|1|0.3', 'U-100, 30 units'], ['100|0.5|0.3', 'U-100, 30 units, half marks'], ['100|1|0.5', 'U-100, 50 units'], ['100|1|1', 'U-100, 100 units'], ['40|1|1', 'U-40, 40 units']];
    function n(v){ v = +v; return isFinite(v) && v > 0 ? v : 0; }
    function r(v, d){ var p = Math.pow(10, d == null ? 2 : d); return String(Math.round(v * p) / p); }
    function money(v){ return '$' + (Math.round(v * 100) / 100).toFixed(2); }
    function day(at){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'}); }, ''); }
    function barrel(v){ var a = String(v || '100|1|0.5').split('|'); return {syr: +a[0] || 100, tick: +a[1] || 1, capMl: +a[2] || 0.5}; }
    function toMg(v, u){ return u === 'mcg' ? n(v) / 1000 : n(v); }
    function F(st, k){ return st.m[k] == null ? '' : st.m[k]; }
    function num(k, label, st, o){ o = o || {}; return yd.input('mf', F(st, k), label, {type: 'number', mode: 'decimal', min: 0, step: 'any', ph: o.ph || '', k: k, extra: 'data-f="' + k + '"'}); }

    /* the syringe: marks every tick (every 2 on a 100), numbers every 10, the draw filled */
    function syringe(units, B, o){
      o = o || {};
      var cap = Math.round(B.capMl * B.syr), W = 640, H = 120, L = 70, R = W - 24, T = 34, Bt = 86;
      var X = function(u){ return L + Math.min(u, cap) / cap * (R - L); };
      var step = cap > 60 ? 2 : B.tick, s = '<svg class="mx-syr" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(units > 0 ? 'Draw to ' + r(units, 1) + ' units on a ' + cap + '-unit syringe' : 'Syringe') + '">';
      s += '<rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (Bt - T) + '" rx="8" class="b"></rect>';
      if(units > 0) s += '<rect x="' + L + '" y="' + (T + 3) + '" width="' + Math.max(0, X(units) - L).toFixed(1) + '" height="' + (Bt - T - 6) + '" rx="6" class="f' + (units > cap ? ' over' : '') + '"></rect>';
      for(var u = 0; u <= cap + 1e-9; u += step){ var x = X(u).toFixed(1), big = Math.abs(u % 10) < 1e-9; s += '<path d="M ' + x + ' ' + T + ' V ' + (T + (big ? 22 : 11)) + '" class="t' + (big ? ' big' : '') + '"></path>'; if(big) s += '<text x="' + x + '" y="' + (Bt + 22) + '" class="n">' + u + '</text>'; }
      s += '<rect x="20" y="' + (T + 8) + '" width="' + (L - 20) + '" height="' + (Bt - T - 16) + '" rx="4" class="p"></rect><rect x="' + R + '" y="' + ((T + Bt) / 2 - 4) + '" width="20" height="8" rx="2" class="nd"></rect>';
      if(units > 0 && units <= cap) s += '<path d="M ' + X(units).toFixed(1) + ' ' + (T - 10) + ' V ' + (Bt + 4) + '" class="m"></path><text x="' + X(units).toFixed(1) + '" y="' + (T - 14) + '" class="mt">' + r(units, 1) + '</text>';
      return s + '</svg>';
    }
    function big(list){ return yd.stats(list, 'mx-big' + (list.length > 2 ? ' four' : '')); }
    function protoPick(st){
      var ps = (safe(function(){ return pdProtos(); }, []) || []).filter(function(p){ return p.compound; });
      if(!ps.length) return '';
      return '<div class="mx-from"><span class="k">From my protocol</span><div class="mx-fromb">' + ps.map(function(p){ return yd.btn('mfrom', pdName(p), {v: p.id, icon: 'refresh'}); }).join('') + '</div></div>';
    }

    function mixTab(st){
      var u = st.m.du || 'mg', iu = u === 'iu', B = barrel(st.m.bar), vial = n(st.m.vial), water = n(st.m.water), dose = iu ? n(st.m.dose) : toMg(st.m.dose, u), dead = st.m.dead == null || st.m.dead === '' ? 0.05 : Math.max(0, +st.m.dead || 0);
      var inp = protoPick(st) + '<div class="pd-two">' + num('vial', iu ? 'Vial (IU)' : 'Vial (mg)', st, {ph: 'On the label'}) + num('water', 'Water added (mL)', st, {ph: 'What you add'}) + '</div>' +
        '<div class="pd-two mx-du">' + num('dose', 'Your amount (' + (iu ? 'IU' : u) + ')', st, {ph: 'Yours'}) + yd.seg('mdu', [['mg', 'mg'], ['mcg', 'mcg'], ['iu', 'IU']], u, {aria: 'Unit', cls: 'pd-seg fill'}) + '</div>' +
        yd.select('mbar', BARRELS, st.m.bar || '100|1|0.5', 'Syringe') + num('dead', 'Left in the vial (mL)', st, {ph: '0.05'});
      var out;
      if(vial && water && dose){
        var m = safe(function(){ return mixOne(vial, dose, water, 1 / B.syr, B.tick, dead); }, null);
        if(!m || m.bad) out = yd.empty('Check the numbers.');
        else {
          var cap = B.capMl * B.syr, over = m.units > cap;
          out = big([[r(m.units, 1), 'units to draw'], [r(m.uRound, 1), 'nearest mark'], [r(m.conc, 3) + (iu ? ' IU' : ' mg') + '/mL', 'strength'], [String(m.dosesPer), 'doses in the vial']]) + syringe(m.units, B) +
            '<ul class="pd-facts"><li><b class="c3-num">' + r(m.drawMl, 3) + ' mL</b> a draw</li><li>At the nearest mark you get <b class="c3-num">' + r(m.realMg * (u === 'mcg' ? 1000 : 1), 3) + ' ' + (iu ? 'IU' : u) + '</b>, ' + (m.errPct >= 0 ? '+' : '') + r(m.errPct, 1) + '% off your amount</li>' +
            (over ? '<li class="w">More than this syringe holds (' + cap + ' units). Use a bigger one or less water.</li>' : '') + (m.units < 4 ? '<li class="w">Under 4 units is hard to draw evenly. More water spreads it out.</li>' : '') + '</ul>';
          var best = safe(function(){ return solveMix(vial, dose, 1 / B.syr, B.tick, cap, dead); }, []) || [];
          if(best.length) out += '<h3 class="mx-h">Water that lands on a mark</h3><ul class="mx-best">' + best.map(function(b){ return '<li><button type="button" class="mx-use" data-act="mwater" data-v="' + b.diluentMl + '" data-key="mwater-' + b.diluentMl + '"><b class="c3-num">' + r(b.diluentMl, 2) + ' mL</b><span>draw <b class="c3-num">' + r(b.uRound, 1) + '</b> units, ' + b.dosesPer + ' doses</span></button></li>'; }).join('') + '</ul>';
        }
      } else out = yd.empty('The vial, the water and your amount, and the draw shows here.');
      return [inp, out];
    }
    function waterTab(st){
      var u = st.m.du || 'mg', B = barrel(st.m.bar), vial = n(st.m.vial), dose = toMg(st.m.dose, u === 'iu' ? 'mg' : u), units = n(st.m.units), dead = st.m.dead == null || st.m.dead === '' ? 0.05 : Math.max(0, +st.m.dead || 0);
      var inp = protoPick(st) + num('vial', 'Vial (mg)', st, {ph: 'On the label'}) + '<div class="pd-two mx-du">' + num('dose', 'Your amount (' + (u === 'iu' ? 'mg' : u) + ')', st, {ph: 'Yours'}) + yd.seg('mdu', [['mg', 'mg'], ['mcg', 'mcg']], u === 'iu' ? 'mg' : u, {aria: 'Unit', cls: 'pd-seg fill'}) + '</div>' +
        num('units', 'Units you want to draw', st, {ph: '10'}) + yd.select('mbar', BARRELS, st.m.bar || '100|1|0.5', 'Syringe');
      var w = safe(function(){ return rxWater({vialMg: vial, doseMg: dose, units: units, syr: B.syr, deadMl: dead}); }, {ok: false});
      var out = w.ok ? big([[r(w.waterMl, 2) + ' mL', 'water to add'], [r(w.conc, 3) + ' mg/mL', 'strength'], [String(w.dosesPer), 'doses in the vial']]) + syringe(units, B) + (units > B.capMl * B.syr ? '<p class="mx-w">More than this syringe holds.</p>' : '')
        : (w.why ? yd.empty(w.why) : yd.empty('The vial, your amount and the draw you want, and the water shows here.'));
      return [inp, out];
    }
    function blendTab(st){
      var B = barrel(st.m.bar), parts = [1, 2, 3].map(function(i){ return {n: st.m['bn' + i] || '', mg: n(st.m['bm' + i])}; }), water = n(st.m.water);
      var ti = st.m.bt != null ? +st.m.bt : -1, tmg = toMg(st.m.btm, st.m.du === 'mcg' ? 'mcg' : 'mg');
      var inp = [1, 2, 3].map(function(i){ return '<div class="pd-two">' + yd.input('mf', F(st, 'bn' + i), 'Compound ' + i, {ph: i === 3 ? 'Optional' : 'Name', k: 'bn' + i, extra: 'data-f="bn' + i + '"', max: 40}) + num('bm' + i, 'mg in the vial', st, {ph: 'On the label'}) + '</div>'; }).join('') +
        num('water', 'Water added (mL)', st, {ph: 'What you add'}) + yd.select('mbar', BARRELS, st.m.bar || '100|1|0.5', 'Syringe') +
        '<p class="pd-q">Work out the draw from</p>' + yd.seg('mbt', [['-1', 'Units']].concat(parts.map(function(p, i){ return p.mg > 0 ? [String(i), p.n || 'Compound ' + (i + 1)] : null; }).filter(Boolean)), String(ti), {aria: 'Draw from', cls: 'pd-seg fill wrap2'}) +
        (ti >= 0 ? '<div class="pd-two mx-du">' + num('btm', 'Amount of it (' + (st.m.du === 'mcg' ? 'mcg' : 'mg') + ')', st, {ph: 'Yours'}) + yd.seg('mdu', [['mg', 'mg'], ['mcg', 'mcg']], st.m.du === 'mcg' ? 'mcg' : 'mg', {aria: 'Unit', cls: 'pd-seg fill'}) + '</div>' : num('units', 'Units you draw', st, {ph: '10'}));
      var b = safe(function(){ return rxBlend({parts: parts.map(function(p, i){ return {n: p.n || 'Compound ' + (i + 1), mg: p.mg}; }), waterMl: water, units: n(st.m.units), syr: B.syr, target: ti >= 0 ? ti : null, targetMg: tmg, deadMl: 0.05}); }, {ok: false});
      var out;
      if(b.ok && b.units > 0){
        out = big([[r(b.units, 1), 'units a draw'], [String(b.dosesPer), 'draws in the vial']].concat(b.parts.slice(0, 2).map(function(p){ return [r(p.perDraw * 1000, 0) + ' mcg', p.n]; }))) + syringe(b.units, B) +
          '<ul class="pd-facts">' + b.parts.map(function(p){ return '<li><b>' + esc(p.n) + '</b>: <b class="c3-num">' + r(p.perDraw, 3) + ' mg</b> a draw (' + r(p.perDraw * 1000, 0) + ' mcg), ' + Math.round(p.share * 100) + '% of the vial, ' + r(p.conc, 3) + ' mg/mL</li>'; }).join('') + '</ul>';
      } else if(b.ok) out = '<ul class="pd-facts">' + b.parts.map(function(p){ return '<li><b>' + esc(p.n) + '</b>: ' + r(p.conc, 3) + ' mg/mL, ' + Math.round(p.share * 100) + '% of the vial</li>'; }).join('') + '</ul>' + yd.empty('The units you draw, or an amount of one of them, and each part of a draw shows here.');
      else out = yd.empty('Two compounds or more with their mg, and the water.');
      return [inp, out];
    }
    function oilTab(st){
      var es = safe(function(){ return ESTERS; }, []) || [], ester = st.m.ester || '';
      var inp = num('conc', 'Strength (mg/mL)', st, {ph: 'On the label'}) + '<div class="pd-two">' + num('dose', 'Your amount a shot (mg)', st, {ph: 'Yours'}) + num('per', 'Shots a week', st, {ph: '2'}) + '</div>' + num('vialml', 'Vial size (mL)', st, {ph: '10'}) +
        (es.length ? yd.select('mester', [['', 'Not testosterone']].concat(es.map(function(e){ return [e.id, 'Testosterone ' + e.n.toLowerCase()]; })), ester, 'Compound') : '');
      var o = safe(function(){ return rxOil({mgPerMl: n(st.m.conc), doseMg: n(st.m.dose), perWeek: n(st.m.per), vialMl: n(st.m.vialml)}); }, {ok: false});
      var out;
      if(o.ok){
        out = big([[r(o.ml, 3) + ' mL', 'a shot'], [r(o.units, 0), 'units on a U-100 1 mL']].concat(o.mgWeek ? [[r(o.mgWeek, 1) + ' mg', 'a week']] : []).concat(o.perVial ? [[String(o.perVial), 'shots in the vial']] : [])) + syringe(o.units, {syr: 100, tick: 1, capMl: 1});
        var f = [];
        if(o.weeks) f.push('<li>The vial lasts <b class="c3-num">' + r(o.weeks, 1) + ' weeks</b></li>');
        if(o.budDays && o.weeks && o.weeks * 7 > o.budDays) f.push('<li class="w">A punctured multi-dose vial is good for ' + o.budDays + ' days unless the label says longer (USP 797). In that time you use ' + o.budUses + ' shots; ' + r(o.budLeftMl, 2) + ' mL would be left.</li>');
        if(ester){ var t = safe(function(){ return trtCalc({ester: ester, weeklyMg: o.mgWeek || n(st.m.dose), perWeek: n(st.m.per) || 1, concMgMl: n(st.m.conc), vialMl: n(st.m.vialml) || 1}); }, null); if(t) f.push('<li><b class="c3-num">' + t.pctT + '%</b> of the ester’s weight is testosterone: <b class="c3-num">' + t.tEach + ' mg</b> a shot' + (o.mgWeek ? ', <b class="c3-num">' + t.tWeek + ' mg</b> a week' : '') + '</li>'); }
        out += f.length ? '<ul class="pd-facts">' + f.join('') + '</ul>' : '';
      } else out = yd.empty('The strength and your amount, and the draw shows here.');
      return [inp, out];
    }
    function nasalTab(st){
      var u = st.m.du === 'mcg' ? 'mcg' : 'mg';
      var inp = '<div class="pd-two">' + num('vial', 'Powder in the bottle (mg)', st, {ph: 'On the label'}) + num('water', 'Water added (mL)', st, {ph: 'What you add'}) + '</div>' + num('spray', 'One spray (mL)', st, {ph: 'On the pump, often 0.1'}) +
        '<div class="pd-two mx-du">' + num('dose', 'Your amount (' + u + ')', st, {ph: 'Yours'}) + yd.seg('mdu', [['mg', 'mg'], ['mcg', 'mcg']], u, {aria: 'Unit', cls: 'pd-seg fill'}) + '</div>' + num('prime', 'Sprays to prime the pump', st, {ph: '0'});
      var o = safe(function(){ return rxNasal({vialMg: n(st.m.vial), waterMl: n(st.m.water), sprayMl: n(st.m.spray), doseMg: toMg(st.m.dose, u), prime: +st.m.prime || 0}); }, {ok: false});
      var out = o.ok ? big([[r(o.perSpray * 1000, 0) + ' mcg', 'a spray'], [String(o.inBottle), 'sprays in the bottle']].concat(o.sprays ? [[r(o.sprays, 1), 'sprays for your amount'], [String(o.doses), 'doses in the bottle']] : [])) +
          (o.sprays ? '<ul class="pd-facts"><li>At <b class="c3-num">' + o.whole + '</b> whole ' + (o.whole === 1 ? 'spray' : 'sprays') + ' you get <b class="c3-num">' + r(o.realMg * (u === 'mcg' ? 1000 : 1), 2) + ' ' + u + '</b></li><li>Strength <b class="c3-num">' + r(o.conc, 3) + ' mg/mL</b></li></ul>' : '')
        : yd.empty('The powder, the water and the spray size, and each spray shows here.');
      return [inp, out];
    }
    function supplyTab(st){
      var u = st.m.du === 'mcg' ? 'mcg' : 'mg';
      var inp = protoPick(st) + '<div class="pd-two mx-du">' + num('dose', 'Your amount (' + u + ')', st, {ph: 'Yours'}) + yd.seg('mdu', [['mg', 'mg'], ['mcg', 'mcg']], u, {aria: 'Unit', cls: 'pd-seg fill'}) + '</div>' +
        '<div class="pd-two">' + num('per', 'Doses a week', st, {ph: '7'}) + num('weeks', 'Weeks', st, {ph: '12'}) + '</div><div class="pd-two">' + num('vial', 'Vial (mg)', st, {ph: 'On the label'}) + num('price', 'Price of a vial ($)', st, {ph: 'Optional'}) + '</div>' +
        yd.input('mf', F(st, 'start'), 'Starting', {type: 'date', k: 'start', extra: 'data-f="start"'});
      var start = /^\d{4}-\d{2}-\d{2}$/.test(st.m.start || '') ? new Date(st.m.start + 'T09:00:00').getTime() : Date.now();
      var o = safe(function(){ return rxSupply({doseMg: toMg(st.m.dose, u), perWeek: n(st.m.per), weeks: n(st.m.weeks), vialMg: n(st.m.vial), price: +st.m.price || 0, startAt: start}); }, {ok: false});
      var out = o.ok ? big([[String(o.vials), o.vials === 1 ? 'vial' : 'vials'], [String(o.doses), 'doses']].concat(o.cost ? [[money(o.cost), 'in all'], [money(o.perWeek), 'a week']] : [])) +
          '<ul class="pd-facts"><li><b class="c3-num">' + o.perVial + '</b> whole doses in a vial; <b class="c3-num">' + r(o.leftMg, 2) + ' mg</b> left over at the end</li><li>Ends <b>' + esc(day(o.endAt)) + '</b></li>' + (o.cost ? '<li><b class="c3-num">' + money(o.perDose) + '</b> a dose</li>' : '') + '</ul>'
        : (o.why ? yd.empty(o.why) : yd.empty('Your amount, how often, how long and the vial, and the run shows here.'));
      return [inp, out];
    }
    function ftTab(st){
      var tu = st.m.tu === 'nmol' ? 'nmol' : 'ngdl';
      var inp = '<div class="pd-two mx-du">' + num('tt', 'Total testosterone', st, {ph: 'From your lab'}) + yd.seg('mtu', [['ngdl', 'ng/dL'], ['nmol', 'nmol/L']], tu, {aria: 'Unit', cls: 'pd-seg fill'}) + '</div>' +
        num('shbg', 'SHBG (nmol/L)', st, {ph: 'From your lab'}) + num('alb', 'Albumin (g/dL)', st, {ph: '4.3 if not tested'});
      var T = n(st.m.tt), tng = tu === 'nmol' ? safe(function(){ return ngdlFromNmol(T); }, 0) : T, alb = n(st.m.alb) || safe(function(){ return ALB_DEFAULT_GDL; }, 4.3);
      var o = tng && st.m.shbg !== '' && st.m.shbg != null ? safe(function(){ return freeT(tng, +st.m.shbg, alb); }, null) : null;
      var out = o ? big([[r(o.pgml, 1) + ' pg/mL', 'free testosterone'], [r(o.pct, 2) + '%', 'of the total'], [r(o.bioNgdl, 0) + ' ng/dL', 'bioavailable']]) +
          '<p class="mx-src">Vermeulen, J Clin Endocrinol Metab 1999. A calculation from your total, SHBG and albumin' + (n(st.m.alb) ? '' : ' (4.3 g/dL used; enter yours if it was tested)') + ', not a measurement.</p>'
        : yd.empty('Your total testosterone and SHBG from a lab report.');
      return [inp, out];
    }

    yd.screen('math', {
      parent: 'doses', nav: 'stack',
      render: function(ctx){
        var st = ctx.state, p0 = ctx.params || {}, pk = JSON.stringify(p0);
        if(st._in !== pk){ st._in = pk; st.m = st.m || {}; if(p0.tab) st.tab = p0.tab; st.back = p0.from || st.back || 'doses'; if(p0.pid) fill(st, p0.pid); }
        st.m = st.m || {};
        var tab = st.tab && TABS.some(function(t){ return t[0] === st.tab; }) ? st.tab : 'mix';
        var parts = tab === 'water' ? waterTab(st) : tab === 'blend' ? blendTab(st) : tab === 'oil' ? oilTab(st) : tab === 'nasal' ? nasalTab(st) : tab === 'supply' ? supplyTab(st) : tab === 'ft' ? ftTab(st) : mixTab(st);
        var tabs = '<div class="mx-tabs" role="tablist" aria-label="Calculators">' + TABS.map(function(t){ var on = t[0] === tab; return '<button type="button" role="tab" class="yd-opt' + (on ? ' on' : '') + '" data-act="mtab" data-v="' + t[0] + '" data-key="mtab-' + t[0] + '" aria-selected="' + (on ? 'true' : 'false') + '">' + t[1] + '</button>'; }).join('') + '</div>';
        return '<div class="yd mx mx-' + tab + '">' + yd.head({back: st.back === 'protocol' ? 'doses' : st.back, eyebrow: 'Your numbers, worked out', title: 'The', pk: 'math'}) + tabs +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Your numbers', parts[0], {id: 'in'}) + '</div><div class="yd-col">' + yd.sec('Worked out', parts[1], {id: 'out'}) + '</div></div>' +
          yd.note('Arithmetic on the numbers you enter. It never suggests an amount.') + yd.note('Nothing in the app is medical advice, diagnosis or treatment. Check with your doctor before changing how you train, what you eat, or anything you take.') + '</div>';
      },
      wire: function(root, ctx){
        var st = ctx.state;
        yd.wire(root, ctx, {
          mtab: function(v){ st.tab = v; C3.render(); },
          mdu: function(v){ st.m.du = v; C3.render(); },
          mtu: function(v){ st.m.tu = v; C3.render(); },
          mbt: function(v){ st.m.bt = +v; C3.render(); },
          mwater: function(v){ st.m.water = v; C3.render(); },
          mfrom: function(v){ fill(st, v); C3.render(); }
        }, {
          /* drawn on the next turn: a change fires on blur, while the field it came from may be on its way out */
          mf: function(v, el){ st.m[el.getAttribute('data-f')] = v; setTimeout(function(){ C3.render(); }, 0); },
          mbar: function(v){ st.m.bar = v; setTimeout(function(){ C3.render(); }, 0); },
          mester: function(v){ st.m.ester = v; setTimeout(function(){ C3.render(); }, 0); }
        });
      }
    });
    /* From my protocol: the vial, the water, the amount now, the syringe, the price, doses a week */
    function fill(st, pid){
      var p = safe(function(){ return pdProto(pid); }, null); if(!p) return;
      var mg = safe(function(){ return pdMgAt(p, Date.now(), p.doses); }, p.doseMg) || p.doseMg || 0, syr = safe(function(){ return pdPrefs().syr; }, 100);
      st.m = st.m || {};
      if(p.vialMg > 0) st.m.vial = String(p.vialMg);
      if(p.diluentMl > 0) st.m.water = String(p.diluentMl);
      if(mg > 0){ st.m.dose = String(Math.round(mg * 1e6) / 1e6); st.m.du = 'mg'; }
      st.m.bar = syr === 40 ? '40|1|1' : (st.m.bar && st.m.bar.indexOf('100|') === 0 ? st.m.bar : '100|1|0.5');
      if(p.costUsd > 0) st.m.price = String(p.costUsd);
      var ev = safe(function(){ return pdEveryDays(p); }, 0); if(ev > 0) st.m.per = String(Math.round(7 / ev * 100) / 100);
      if(p.deadMl >= 0) st.m.dead = String(p.deadMl);
    }
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
