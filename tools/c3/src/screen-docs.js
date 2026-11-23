/* C3 screen: docs (v347). YOUR PLAN, AS A DOCUMENT: the workouts, the meal plan or the doses, for a day, a week or a
   month, laid out to follow on a phone or a computer, and to print, save as a PDF or send as a file.
   Chad, 18 Oct 2026: "allow users to click a button to open document form of the workouts daily weekly or monthly and
   export or print them and do same for food plan and doses" and "BUILD A CLEAN CLEAR VIEWER FOR MOBILE AND WEB SO THE
   USERS CAN OPEN AND FOLLOW IT IF THEY CHOOSE".
   Everything in it is read from the app, nothing made up:
     workouts  the week the Train screen draws (weekAt), and on a day already trained, what was logged (ALL.workLog)
     food      the meal plan the Food screen shows (mpPlan through C3.mk), each meal's ingredients in kitchen amounts (mpQty)
     doses     the dose tracker's own schedule and log (pdModel), with the amount, the syringe units and the site
   A day the plan does not reach says so. The doses are their own document, never on a page with the training.
   The file that is printed, saved or sent is one self-contained page (dark type on white), the same days as the screen. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, fmt = h.fmt, safe = yd.safe;
    var DAYMS = 864e5;
    var KINDS = [['train', 'Workouts'], ['food', 'Food plan'], ['dose', 'Doses']];
    var SPANS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']];

    /* ---------- dates (keys are the app's YYYY-MM-DD) ---------- */
    var noon = function(k){ return new Date(k + 'T12:00:00'); };
    var keyOf = function(d){ return safe(function(){ return dkey(d.getTime()); }, ''); };
    var todayKey = function(){ return safe(function(){ return dkey(Date.now()); }, ''); };
    var addDays = function(k, n){ var d = noon(k); d.setDate(d.getDate() + n); return keyOf(d); };
    function range(span, at){
      var d = noon(at), out = [];
      if(span === 'day') return [at];
      if(span === 'week'){ var s = addDays(at, -d.getDay()); for(var i = 0; i < 7; i++) out.push(addDays(s, i)); return out; }
      var m = new Date(d.getFullYear(), d.getMonth(), 1, 12);
      while(m.getMonth() === d.getMonth()){ out.push(keyOf(m)); m.setDate(m.getDate() + 1); }
      return out;
    }
    function step(span, at, dir){
      if(span === 'day') return addDays(at, dir);
      if(span === 'week') return addDays(at, 7 * dir);
      var d = noon(at); return keyOf(new Date(d.getFullYear(), d.getMonth() + dir, 1, 12));
    }
    var dw = function(k, o){ return noon(k).toLocaleDateString('en-US', o); };
    function spanWord(span, keys){
      if(span === 'day') return dw(keys[0], {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
      if(span === 'month') return dw(keys[0], {month: 'long', year: 'numeric'});
      var a = noon(keys[0]), b = noon(keys[6]);
      return dw(keys[0], {month: 'short', day: 'numeric'}) + ' to ' + (a.getMonth() === b.getMonth() ? b.getDate() : dw(keys[6], {month: 'short', day: 'numeric'})) + ', ' + b.getFullYear();
    }
    var dayWord = function(k){ return dw(k, {weekday: 'short', month: 'short', day: 'numeric'}); };
    var tm = function(at){ return safe(function(){ return new Date(at).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'}); }, ''); };
    var n1 = function(v){ v = Math.round((+v || 0) * 10) / 10; return String(v).replace(/\.0$/, ''); };

    var pep = function(){ return safe(function(){ return !!onPeptide(); }, false); };
    var who = function(){ return safe(function(){ return displayName(); }, '') || ''; };

    /* ---------- WORKOUTS: one day ---------- */
    var WK = {};
    function weekFor(wi){ if(!WK[wi]) WK[wi] = safe(function(){ return weekAt(wi); }, null) || []; return WK[wi]; }
    function setWord(r){
      if(r.sec != null && r.sec > 0 && !(r.reps > 0)) return (r.lb > 0 ? n1(r.lb) + ' lb, ' : '') + r.sec + ' s';
      return (r.lb > 0 ? n1(r.lb) + ' × ' : '') + (r.reps > 0 ? r.reps : '?') + (r.lb > 0 ? '' : ' reps');
    }
    function trainDay(k){
      var t = noon(k).getTime(), start = safe(function(){ return trainCfg().startedAt; }, 0) || 0;
      if(start && t < new Date(new Date(start).toDateString()).getTime()) return {k: k, before: true};
      var wi = Math.max(0, Math.floor((t - start) / (7 * DAYMS)));
      var d = weekFor(wi)[noon(k).getDay()] || null;
      var L = safe(function(){ return (ALL.workLog || {})[k] || null; }, null);
      var did = L && h.logged(L);
      var blocks = (did && L.blocks && L.blocks.length ? L.blocks : (d && d.blocks)) || [];
      if((!d || d.rest) && !did) return {k: k, rest: true, wi: wi};
      var rows = blocks.map(function(bl){
        var sets = ((L && L.rows || {})[bl.id] || []).filter(function(r){ return r && r.done && r.t !== 'W'; });
        return {n: bl.n, sets: safe(function(){ return fmt.sets(bl); }, ''), load: safe(function(){ return fmt.load(bl); }, ''), note: bl.note || '',
          did: sets.length, planned: bl.sets | 0, log: sets.map(setWord)};
      });
      var est = d && d.est ? d.est : {};
      return {k: k, wi: wi, name: (L && L.name) || (d && (d.name || d.focus)) || 'Session', minutes: est.minutes || 0, rows: rows, done: !!did, fin: !!(L && L.fin), deload: !!(d && d.deload)};
    }
    function trainHTML(keys, span){
      var days = keys.map(trainDay), body = '', on = 0, sets = 0, did = 0;
      days.forEach(function(D){
        if(D.before){ body += '<section class="dc-day q"><h3><span>' + esc(dayWord(D.k)) + '</span><small>Before your plan started</small></h3></section>'; return; }
        if(D.rest){ body += '<section class="dc-day q"><h3><span>' + esc(dayWord(D.k)) + '</span><small>Rest</small></h3></section>'; return; }
        on++; D.rows.forEach(function(r){ sets += r.planned; did += Math.min(r.did, r.planned || r.did); });
        body += '<section class="dc-day"><h3><span>' + esc(dayWord(D.k)) + '</span><b>' + esc(D.name) + '</b>' +
          '<small>' + (D.done ? (D.fin ? 'Done' : 'Started') : (D.minutes ? D.minutes + ' min' : '')) + (D.deload ? ' · lighter week' : '') + '</small></h3>' +
          '<ol class="dc-list">' + D.rows.map(function(r){
            return '<li><span class="dc-n">' + esc(r.n) + '</span><span class="dc-v">' + esc(r.sets) + (r.load ? ' · ' + esc(r.load) : '') + '</span>' +
              (r.log.length ? '<span class="dc-done">Logged: ' + esc(r.log.join(', ')) + '</span>' : (span === 'month' ? '' : '<span class="dc-box" aria-hidden="true">' + new Array((r.planned || 0) + 1).join('<i></i>') + '</span>')) +
              (span === 'day' && r.note && !r.log.length ? '<span class="dc-note">' + esc(r.note) + '</span>' : '') + '</li>';
          }).join('') + '</ol></section>';
      });
      return {body: body, sum: [[on, on === 1 ? 'session' : 'sessions'], [sets, 'sets planned'], [did, 'sets logged']]};
    }

    /* a small amount in the kitchen's own spoons, worked out from the food's own serving data ("1 tbsp" = 13.5 g for
       olive oil), so a meal does not read "10 g" beside "0.5 oz"; a food with no spoon serving keeps the app's wording */
    var FR = {0.25: '\u00bc', 0.5: '\u00bd', 0.75: '\u00be'};
    function fr(x){ var w = Math.floor(x + 1e-9), r = Math.round((x - w) * 4) / 4; if(r === 1){ w++; r = 0; } return (w ? String(w) : '') + (r ? FR[r] : '') || '0'; }
    function spoonG(f){
      var out = null;
      (f.serv || []).some(function(s){
        var m = /^(\d+(?:\.\d+)?|\d+\/\d+|\u00bd|\u00bc|\u00be)\s*(tbsp|tablespoons?|tsp|teaspoons?)\b/i.exec(String(s[0] || ''));
        if(!m || !(s[1] > 0)) return false;
        var q = m[1] === '\u00bd' ? 0.5 : m[1] === '\u00bc' ? 0.25 : m[1] === '\u00be' ? 0.75 : m[1].indexOf('/') > 0 ? (+m[1].split('/')[0] / +m[1].split('/')[1]) : +m[1];
        var tsp = /^t(bsp|ablespoon)/i.test(m[2]) ? q * 3 : q;
        if(tsp > 0){ out = s[1] / tsp; return true; } return false;
      });
      return out;
    }
    function kitchen(id, g){
      var f = safe(function(){ return foodById(id); }, null) || {};
      if(g < 15){
        var per = spoonG(f);
        if(per > 0){ var t = g / per; return t >= 2.75 ? fr(Math.round(t / 3 * 2) / 2) + ' tbsp' : fr(Math.max(0.25, Math.round(t * 4) / 4)) + ' tsp'; }
        if(g >= 7) return fr(Math.max(0.25, Math.round(g / 28.3495 * 4) / 4)) + ' oz';
      }
      return safe(function(){ return mpQty(id, g); }, Math.round(g) + ' g');
    }
    /* ---------- FOOD: the meal plan ---------- */
    function foodHTML(keys, span){
      var mk = C3.mk;
      if(!mk || !mk.ready()){ safe(function(){ mpLoad(); }); return {wait: true, body: '<p class="dc-none">Loading your meal plan.</p>', sum: []}; }
      var body = '', kc = 0, pr = 0, nd = 0;
      keys.forEach(function(k){
        var D = mk.day(k);
        if(!D){ body += '<section class="dc-day q"><h3><span>' + esc(dayWord(k)) + '</span><small>' + (k < todayKey() ? 'No meal plan' : 'Not planned yet') + '</small></h3></section>'; return; }
        if(D.off){ body += '<section class="dc-day q"><h3><span>' + esc(dayWord(k)) + '</span><small>Off the plan</small></h3></section>'; return; }
        var t = mk.dayTot(D); nd++; kc += t.kcal; pr += t.p;
        body += '<section class="dc-day"><h3><span>' + esc(dayWord(k)) + '</span><b class="c3-num">' + Math.round(t.kcal).toLocaleString('en-US') + ' kcal</b>' +
          '<small>' + Math.round(t.p) + ' g protein' + (D.aim && D.aim.k ? ' · aim ' + Math.round(D.aim.k).toLocaleString('en-US') + ' kcal' : '') + '</small></h3><ol class="dc-list">' +
          (D.meals || []).map(function(m){
            var x = mk.tot(m), ing = span === 'month' ? [] : (m.items || []).map(function(it){
              var f = safe(function(){ return foodById(it.id); }, null); if(!f) return '';
              var q = kitchen(it.id, it.g), m = /^([\d.]+) ([a-z ]+)$/.exec(q), base = String(f.n).toLowerCase().replace(/,.*$/, '');
              /* a count of the thing itself says it once: "1 banana", "1 hamburger bun" (was "Banana 1 banana") */
              if(m && !/^(g|oz|lb|cups?|tbsp|tsp)$/.test(m[2]) && base.indexOf(m[2].replace(/(es|s)$/, '')) >= 0) return '<i>' + esc(m[1]) + '</i> ' + esc(+m[1] > 1 && !/s$/.test(base) ? base + 's' : base);
              return esc(f.n) + ' <i>' + esc(q) + '</i>'; }).filter(Boolean);
            return '<li><span class="dc-n"><em>' + esc(mk.slotWord(m.slot)) + (m.time ? ' · ' + esc(m.time) : '') + '</em>' + esc(m.t || '') + '</span>' +
              '<span class="dc-v">' + Math.round(x.kcal) + ' kcal · ' + Math.round(x.p) + ' g protein' + (m.logged ? ' · eaten' : '') + '</span>' +
              (ing.length ? '<span class="dc-ing">' + ing.join('<br>') + '</span>' : '') + '</li>';
          }).join('') + '</ol></section>';
      });
      var one = span === 'day';
      return {body: body, sum: nd ? (one ? [] : [[nd, nd === 1 ? 'day planned' : 'days planned']]).concat([[Math.round(kc / nd).toLocaleString('en-US'), one ? 'kcal' : 'kcal a day'], [Math.round(pr / nd) + ' g', one ? 'protein' : 'protein a day']]) : []};
    }

    /* ---------- DOSES: the tracker's schedule and log ---------- */
    function doseHTML(keys){
      if(!pep()) return {body: '<p class="dc-none">No compound is being tracked yet. Add one on Track and its schedule shows here.</p>', sum: []};
      var rows = safe(function(){ return pdModel().rows; }, []) || [], set = {}, body = '', tk = 0, pl = 0;
      keys.forEach(function(k){ set[k] = []; });
      rows.forEach(function(r){ var k = safe(function(){ return dkey(r.at); }, ''); if(set[k]) set[k].push(r); });
      var lo = Date.now() - 70 * DAYMS, hi = Date.now() + 28 * DAYMS, gap = false;
      keys.forEach(function(k){
        var list = set[k], t = noon(k).getTime();
        if(t < lo || t > hi){ gap = true; return; }
        if(!list.length) return;
        body += '<section class="dc-day"><h3><span>' + esc(dayWord(k)) + '</span></h3><ol class="dc-list nonum">' + list.map(function(r){
          var p = r.p, st = r.dose ? 'Logged ' + tm(r.dose.at) : r.status === 'missed' ? 'Not logged' : r.status === 'skipped' ? 'Skipped' : r.status === 'held' ? 'Held' : r.status === 'due' ? 'Due' : 'Planned';
          if(r.dose) tk++; else if(r.status === 'planned' || r.status === 'due') pl++;
          var sub = [safe(function(){ return pdAmt(p, r.mg); }, n1(r.mg) + ' mg')];
          if(r.units) sub.push(n1(r.units) + ' units');
          if(r.site) sub.push(r.site); else if(r.dose && r.inj) sub.push('site not logged');
          return '<li class="' + (r.dose ? 'ok' : r.status === 'missed' ? 'bad' : '') + '"><span class="dc-n"><em>' + esc(tm(r.dose ? r.dose.at : r.at)) + '</em>' + esc(safe(function(){ return pdName(p); }, 'Dose')) + '</span>' +
            '<span class="dc-v">' + esc(sub.join(' · ')) + '</span><span class="dc-st">' + esc(st) + '</span></li>';
        }).join('') + '</ol></section>';
      });
      if(!body) body = '<p class="dc-none">' + (gap ? 'The dose plan covers the last 10 weeks and the next 4.' : 'No doses on these days.') + '</p>';
      else if(gap) body += '<p class="dc-none">The dose plan covers the last 10 weeks and the next 4.</p>';
      return {body: body, sum: [[tk, 'logged'], [pl, 'planned']]};
    }

    /* days in a row that say the same quiet thing ("No meal plan for this day") are one line: "Sun, Oct 4 to Thu, Oct 8" */
    function fold(html){
      var box = document.createElement('div'); box.innerHTML = html;
      var kids = Array.prototype.slice.call(box.children), out = [], run = [];
      var note = function(el){ var s = el.querySelector('h3 small'); return el.classList.contains('q') && s ? s.textContent : null; };
      var flush = function(){
        if(run.length > 1){ var a = run[0].querySelector('h3 span').textContent, b = run[run.length - 1].querySelector('h3 span').textContent;
          run[0].querySelector('h3 span').textContent = a + ' to ' + b; out.push(run[0].outerHTML); }
        else if(run.length) out.push(run[0].outerHTML);
        run = [];
      };
      kids.forEach(function(el){ var n = note(el); if(n && n !== 'Rest' && run.length && note(run[0]) === n) run.push(el); else { flush(); if(n && n !== 'Rest') run.push(el); else out.push(el.outerHTML); } });
      flush();
      return out.join('');
    }
    /* ---------- v371: THE SAME DAYS AS AN EXCEL WORKBOOK (C3.xlsx). Chad, 28 Oct 2026: "Full Menu ... that opens a xcel
       sheet with full menu and items ... make it printalbe shareable and exportable". One row per meal and one per
       ingredient (kitchen amount and grams, with its own calories and macros), each day's totals, and for the days still
       ahead the grocery list; workouts and doses the same way. Every number is the app's own (mk.tot, scaleFood, pdModel). */
    var longDay = function(k){ return dw(k, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'}); };
    var rnd = function(v){ return Math.round(+v || 0); };
    function foodBook(keys){
      var mk = C3.mk, rows = [], today = todayKey();
      keys.forEach(function(k){
        var D = mk.day(k), dt = longDay(k);
        if(!D){ rows.push({s: 'note', c: [dt, '', '', k < today ? 'No meal plan for this day' : 'Not planned yet']}); return; }
        if(D.off){ rows.push({s: 'note', c: [dt, '', '', 'Eating out: nothing planned']}); return; }
        var t = mk.dayTot(D), ms = D.meals || [], done = ms.filter(function(m){ return m.logged; }).length;
        rows.push({s: 'day', c: [dt, D.tr ? 'Training day' : 'Rest day', '', 'Day total', '', '', rnd(t.kcal), rnd(t.p), rnd(t.c), rnd(t.f), ms.length ? (done === ms.length ? 'All' : done + ' of ' + ms.length) : '']});
        ms.forEach(function(m){
          var x = mk.tot(m), sl = mk.slotWord(m.slot);
          rows.push({s: 'meal', c: [dt, sl, m.time || '', m.t || '', '', '', rnd(x.kcal), rnd(x.p), rnd(x.c), rnd(x.f), m.logged ? (m.logged.por && m.logged.por !== 1 ? 'Half' : 'Yes') : '']});
          (m.items || []).forEach(function(it){
            var f = safe(function(){ return foodById(it.id); }, null); if(!f) return;
            var v = safe(function(){ return scaleFood(f, it.g); }, null) || {};
            var d1 = function(x){ return Math.round((+x || 0) * 10) / 10; };   /* one decimal: the ingredients add up to the meal */
            rows.push({s: 'item', c: [dt, sl, '', '    ' + f.n, kitchen(it.id, it.g), rnd(it.g), rnd(v.kcal), d1(v.p), d1(v.c), d1(v.f), '']});
          });
        });
      });
      var sheets = [{name: 'Menu', rows: rows, cols: [{h: 'Date', w: 17}, {h: 'Meal', w: 11}, {h: 'Time', w: 9}, {h: 'Dish and ingredients', w: 44}, {h: 'Amount', w: 18},
        {h: 'Grams', w: 8}, {h: 'Calories', w: 10}, {h: 'Protein (g)', w: 11}, {h: 'Carbs (g)', w: 10}, {h: 'Fat (g)', w: 9}, {h: 'Eaten', w: 10, center: true}]}];
      var ahead = keys.filter(function(k){ return k >= today; });
      if(ahead.length){
        var g = safe(function(){ return mpGrocery(ahead[0], ahead.length); }, []) || [], P = safe(function(){ return mpPrefs(); }, {}) || {};
        if(g.length) sheets.push({name: 'Groceries', cols: [{h: 'Aisle', w: 18}, {h: 'Item', w: 36}, {h: 'Buy', w: 22}, {h: 'Grams', w: 9}, {h: 'Meals', w: 8}, {h: 'Have it', w: 10, center: true}],
          rows: g.map(function(it){ return {s: 'plain', c: [it.aisle || '', it.n, it.qty + (it.as ? ' ' + it.as : ''), rnd(it.g), it.meals || '', it.on ? 'Yes' : it.staple ? 'Pantry' : '']}; })
            .concat(P.household > 1 ? [{s: 'note', c: ['', 'Amounts are for ' + P.household + ' people']}] : [])});
      }
      return sheets;
    }
    function trainBook(keys){
      var rows = [];
      keys.map(trainDay).forEach(function(D){
        var dt = longDay(D.k);
        if(D.before){ rows.push({s: 'note', c: [dt, 'Before your plan started']}); return; }
        if(D.rest){ rows.push({s: 'note', c: [dt, 'Rest']}); return; }
        var pl = 0, dn = 0; D.rows.forEach(function(r){ pl += r.planned; dn += Math.min(r.did, r.planned || r.did); });
        rows.push({s: 'day', c: [dt, D.name, '', '', '', pl, dn, D.done ? (D.fin ? 'Done' : 'Started') : (D.minutes ? D.minutes + ' min planned' : ''), D.deload ? 'Lighter week' : '']});
        D.rows.forEach(function(r){ rows.push({s: 'item', c: [dt, D.name, r.n, r.sets, r.load, r.planned, r.did, r.log.join(', '), r.note]}); });
      });
      return [{name: 'Workouts', rows: rows, cols: [{h: 'Date', w: 17}, {h: 'Session', w: 22}, {h: 'Exercise', w: 30}, {h: 'Sets', w: 14}, {h: 'Load', w: 16},
        {h: 'Sets planned', w: 12}, {h: 'Sets logged', w: 11}, {h: 'Logged', w: 34}, {h: 'Note', w: 30}]}];
    }
    function doseBook(keys){
      var rows = [], set = {}, all = pep() ? (safe(function(){ return pdModel().rows; }, []) || []) : [];
      keys.forEach(function(k){ set[k] = []; });
      all.forEach(function(r){ var k = safe(function(){ return dkey(r.at); }, ''); if(set[k]) set[k].push(r); });
      keys.forEach(function(k){ set[k].forEach(function(r){
        var p = r.p, st = r.dose ? 'Logged' : r.status === 'missed' ? 'Not logged' : r.status === 'skipped' ? 'Skipped' : r.status === 'held' ? 'Held' : r.status === 'due' ? 'Due' : 'Planned';
        rows.push({s: r.dose ? 'meal' : 'item', c: [longDay(k), tm(r.dose ? r.dose.at : r.at), safe(function(){ return pdName(p); }, 'Dose'), safe(function(){ return pdAmt(p, r.mg); }, n1(r.mg) + ' mg'),
          r.units ? Math.round(r.units * 10) / 10 : '', r.site || (r.dose && r.inj ? 'not logged' : ''), st]});
      }); });
      if(!rows.length) rows.push({s: 'note', c: ['', '', pep() ? 'No doses on these days' : 'No compound is being tracked yet']});
      return [{name: 'Doses', rows: rows, cols: [{h: 'Date', w: 17}, {h: 'Time', w: 10}, {h: 'Compound', w: 26}, {h: 'Amount', w: 14}, {h: 'Units', w: 9}, {h: 'Site', w: 18}, {h: 'Status', w: 12, center: true}]}];
    }
    function book(st){
      var keys = range(st.span, st.at), kw = (KINDS.filter(function(x){ return x[0] === st.kind; })[0] || KINDS[0])[1], nm = who();
      var sheets = st.kind === 'food' ? foodBook(keys) : st.kind === 'dose' ? doseBook(keys) : trainBook(keys);
      return {title: (st.kind === 'food' ? 'Full menu' : kw) + ', ' + spanWord(st.span, keys) + (nm ? ' · ' + nm : ''), sheets: sheets,
        file: 'formed-fit-' + ({train: 'workouts', food: 'full-menu', dose: 'doses'}[st.kind]) + '-' + st.span + '-' + keys[0] + '.xlsx'};
    }
    var foodReady = function(st){ return st.kind !== 'food' || !!(C3.mk && C3.mk.ready()); };

    /* ---------- the document ---------- */
    function build(st){
      WK = {};
      var keys = range(st.span, st.at), D = st.kind === 'food' ? foodHTML(keys, st.span) : st.kind === 'dose' ? doseHTML(keys) : trainHTML(keys, st.span);
      D.body = safe(function(){ return fold(D.body); }, D.body);
      var kw = (KINDS.filter(function(x){ return x[0] === st.kind; })[0] || KINDS[0])[1];
      return {keys: keys, kind: kw, when: spanWord(st.span, keys), body: D.body, sum: D.sum || [], wait: !!D.wait,
        title: kw + ', ' + spanWord(st.span, keys), file: 'formed-fit-' + ({train: 'workouts', food: 'food-plan', dose: 'doses'}[st.kind]) + '-' + st.span + '-' + keys[0] + '.html'};
    }
    function sumHTML(sum){ return sum.length ? '<div class="dc-sum">' + sum.map(function(s){ return '<div><b class="c3-num">' + esc(String(s[0])) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div>' : ''; }
    /* the file: one page, no outside requests, dark type on white, made to print */
    var FILECSS = '*{box-sizing:border-box}body{margin:0;background:#fff;color:#14161c;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
      '.pg{max-width:760px;margin:0 auto;padding:28px 22px 40px}header{border-bottom:3px solid #2F3136;padding-bottom:12px;margin-bottom:18px}' +
      '.br{display:flex;align-items:center;gap:8px;font-weight:900;font-size:18px;color:#14161c}.br span{letter-spacing:1.5px;text-transform:uppercase}.br svg{height:34px;width:auto;flex:none}h1{font-size:26px;line-height:1.15;margin:6px 0 4px}' +
      '.mt{font-size:13px;color:#4a4f5c}.dc-sum{display:flex;gap:26px;margin:14px 0 6px}.dc-sum b{display:block;font-size:22px}.dc-sum span{font-size:12px;color:#4a4f5c;text-transform:uppercase;letter-spacing:1px}' +
      '.dc-day{border-top:1px solid #d8dbe3;padding:12px 0 8px;break-inside:avoid}.dc-day h3{margin:0 0 6px;font-size:15px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}' +
      '.dc-day h3 span{font-weight:800}.dc-day h3 small{color:#4a4f5c;font-weight:500}.dc-day.q{padding:8px 0}.dc-day.q h3{margin:0}' +
      '.dc-list{margin:0;padding:0 0 0 22px}.dc-list.nonum{list-style:none;padding:0}.dc-list li{margin:0 0 8px}.dc-n{display:block;font-weight:700}.dc-n em{display:block;font-style:normal;font-weight:600;font-size:12px;color:#4a4f5c;text-transform:uppercase;letter-spacing:1px}' +
      '.dc-v,.dc-done,.dc-note,.dc-ing,.dc-st{display:block;font-size:14px}.dc-done{color:#1d7a4f}.dc-note,.dc-ing{color:#4a4f5c}.dc-ing i{font-style:normal;color:#14161c}' +
      '.dc-box{display:flex;gap:6px;margin-top:4px}.dc-box i{width:16px;height:16px;border:1.5px solid #14161c;border-radius:3px}.ok .dc-st{color:#1d7a4f}.bad .dc-st{color:#b3261e}' +
      'header+.dc-day{border-top:0}.dc-none{color:#4a4f5c}footer{margin-top:22px;border-top:1px solid #d8dbe3;padding-top:10px;font-size:12px;color:#4a4f5c}' +
      '@media print{.pg{padding:0}@page{margin:14mm}}';
    function fileHTML(doc){
      var nm = who();
      return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(doc.title) + '</title><style>' + FILECSS + '</style></head><body><div class="pg">' +
        '<header><div class="br">' + safe(function(){ return h.markSVG(); }, '') + '<span>fit</span></div><h1>' + esc(doc.kind) + '</h1><div class="mt">' + esc(doc.when) + (nm ? ' · ' + esc(nm) : '') + '</div>' + sumHTML(doc.sum) + '</header>' +
        doc.body + '<footer>Made ' + esc(new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})) + ' from your log in formed fit · app.formedlabs.co</footer></div></body></html>';
    }
    /* print: the file, in a frame of its own, so only the document goes to the printer (or to Save as PDF) */
    function printDoc(doc){
      yd.toast('Preparing your document for printing.');
      var f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true'); f.title = 'Print';
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(f);
      var done = function(){ setTimeout(function(){ if(f.parentNode) f.parentNode.removeChild(f); }, 1000); };
      f.onload = function(){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ yd.toast('This device cannot print from here. Save the file and print it.', 'bad'); } done(); };
      f.srcdoc = fileHTML(doc);
    }
    function fileOf(doc){ return new File([fileHTML(doc)], doc.file, {type: 'text/html'}); }
    function download(doc){
      var u = URL.createObjectURL(new Blob([fileHTML(doc)], {type: 'text/html'})), a = document.createElement('a');
      a.href = u; a.download = doc.file; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
      yd.toast('Saved as <b>' + esc(doc.file) + '</b>.');
    }
    var canShare = function(){ return safe(function(){ return !!(navigator.share && navigator.canShare && navigator.canShare({files: [new File(['x'], 'x.html', {type: 'text/html'})]})); }, false); };
    /* the words alone, for a phone that cannot send a file: the same days, as text */
    function textOf(doc){
      var el = document.createElement('div'); el.innerHTML = doc.body;
      el.querySelectorAll('h3, li, p').forEach(function(x){ x.insertAdjacentText('afterend', '\n'); });
      el.querySelectorAll('.dc-box').forEach(function(x){ x.remove(); });
      return 'formed fit \u00b7 ' + doc.title + '\n\n' + (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    }
    /* v371: Share sends the Excel workbook (the phone's share sheet: Excel, Numbers, Files, Mail, Messages, Print);
       without the workbook writer it sends the page, as before */
    function share(doc, st){
      if(st && C3.xlsx && foodReady(st)){ var B = book(st); C3.xlsx.share(B, B.file); return; }
      var file = safe(function(){ return fileOf(doc); }, null);
      if(file && canShare()){ Promise.resolve(navigator.share({files: [file], title: doc.title})).then(function(){}, function(e){ if(!e || e.name !== 'AbortError') download(doc); }); return; }
      if(native() && safe(function(){ return !!(RUN && RUN.share); }, false)){ Promise.resolve(RUN.share({title: doc.title, text: textOf(doc)})).catch(function(){}); return; }
      download(doc);
    }
    var native = function(){ return !/^https?:$/.test(location.protocol); };
    function navFor(kind){ var me = C3.screens.docs; if(me) me.nav = {train: 'train', food: 'food', dose: 'stack'}[kind] || 'train'; }

    yd.screen('docs', {
      parent: 'you', nav: 'train',
      /* the top tab that lights up is the plan's own: Train, Food or Track */
      enter: function(ctx){ var k = (ctx.params || {}).kind; navFor(k || ctx.state.kind || 'train'); },
      render: function(ctx){
        /* where it opened from (Train, Food, Track, You) sets the plan and the span; after that the controls do */
        var p = ctx.params || {}, st = ctx.state, pk = JSON.stringify(p);
        if(st.pk !== pk || !st.at){
          st.pk = pk;
          st.kind = ['train', 'food', 'dose'].indexOf(p.kind) >= 0 ? p.kind : (st.kind || 'train');
          st.span = ['day', 'week', 'month'].indexOf(p.span) >= 0 ? p.span : (st.span || 'week');
          st.at = /^\d{4}-\d\d-\d\d$/.test(p.at || '') ? p.at : todayKey();
          st.back = p.from || 'you';
          st.menu = !!p.menu;   /* v371: opened from Food's Full menu */
        }
        navFor(st.kind);
        var doc = build(st), kinds = KINDS.filter(function(x){ return x[0] !== 'dose' || pep(); });
        if(st.kind === 'dose' && !pep()) st.kind = 'train';
        var nav = '<div class="dc-nav" role="group" aria-label="Which ' + esc(st.span) + '">' +
          '<button type="button" class="c3-btn-quiet dc-step" data-act="dstep" data-v="-1" data-key="dprev" aria-label="Earlier">' + yd.icon('back', 20, 2.6) + '</button>' +
          '<span class="dc-when"><b>' + esc(doc.when) + '</b>' + (st.at !== todayKey() && doc.keys.indexOf(todayKey()) < 0 ? '<button type="button" class="c3-link" data-act="dnow" data-key="dnow">Today</button>' : '') + '</span>' +
          '<button type="button" class="c3-btn-quiet dc-step" data-act="dstep" data-v="1" data-key="dnext" aria-label="Later">' + yd.icon('chev', 20, 2.6) + '</button></div>';
        var SHEET = '<svg class="c3-ic" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="4" width="17" height="16" rx="2"></rect><path d="M3.5 9h17"></path><path d="M3.5 14.5h17"></path><path d="M9.5 9v11"></path></svg>';
        var xl = C3.xlsx ? '<button type="button" class="c3-btn-primary yd-primary dc-xlsx" data-act="dxlsx" data-key="primary" aria-label="Open in Excel: ' + esc(st.kind === 'food' ? 'every meal and ingredient' : st.kind === 'dose' ? 'every dose' : 'every set') + '"><span>Open in Excel</span><span class="r"><small>' +
          esc(st.kind === 'food' ? 'every meal and ingredient' : st.kind === 'dose' ? 'every dose' : 'every set') + '</small>' + SHEET + '</span></button>' : '';
        var acts = xl + '<div class="yd-acts dc-acts">' +
          (native() ? yd.btn('dshare', 'Share or print', {icon: 'share'}) : yd.btn('dprint', 'Print / PDF', {icon: 'print', aria: 'Print, or save as a PDF'}) + (canShare() ? yd.btn('dshare', 'Share', {icon: 'share'}) : '')) +
          yd.btn('dsave', 'Save page', {icon: 'down', aria: 'Save this page as a file'}) + '</div>';
        return '<div class="yd dc">' + yd.head({back: st.back, eyebrow: st.menu && st.kind === 'food' ? (who() || '') : doc.kind + (who() ? ' · ' + who() : ''), title: st.menu && st.kind === 'food' ? 'Full' : 'Your', pk: st.menu && st.kind === 'food' ? 'menu' : 'plan'}) +
          '<div class="dc-ctl">' + (st.menu && st.kind === 'food' ? '' : yd.seg('dkind', kinds, st.kind, {aria: 'Which plan', cls: 'dc-kinds txt'})) +   /* v371: Full menu is the food plan only */ yd.seg('dspan', SPANS, st.span, {aria: 'How long', cls: 'dc-spans txt'}) + nav + acts + '</div>' +
          '<article class="dc-doc ' + esc(st.span) + '" aria-label="' + esc(doc.title) + '">' + sumHTML(doc.sum) + doc.body + '</article></div>';
      },
      wire: function(root, ctx){
        var st = ctx.state, doc = function(){ return build(st); };
        if(st.kind === 'food' && !(C3.mk && C3.mk.ready()) && !st.waiting){ st.waiting = 1; var n = 0, t = setInterval(function(){ if((C3.mk && C3.mk.ready()) || ++n > 40){ clearInterval(t); st.waiting = 0; if(C3.current === 'docs') C3.render(); } }, 300); }
        yd.wire(root, ctx, {
          dkind: function(v){ st.kind = v; C3.render(); },
          dspan: function(v){ st.span = v; C3.render(); },
          dstep: function(v){ st.at = step(st.span, st.at, +v); C3.render(); },
          dnow: function(){ st.at = todayKey(); C3.render(); },
          dprint: function(){ printDoc(doc()); },
          dshare: function(){ share(doc(), st); },
          dxlsx: function(){ if(!foodReady(st)){ yd.toast('Your meal plan is still loading. Try again in a moment.'); return; } var B = book(st); if(native()) C3.xlsx.share(B, B.file); else C3.xlsx.save(B, B.file); },
          dsave: function(){ download(doc()); }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
