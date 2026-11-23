/* C3 screen: doses (v326). The research lane's tracker, built the way the meal plan is: every protocol the person runs,
   four weeks ahead, kept by the app (the engine is the app's own v326doses script: pdModel and its writers).
   Week: the ring to the next dose, how they keep to it, the seven days as dots, the picked day as rows (each dose's
   amount, syringe units at their own mix, the site it goes in, Log / Site / Skip / Undo), their protocols.
   Month: four weeks as a calendar, with the days a vial opens, the day to order by and the day the amount steps.
   Sites: front and back, every site by how long it has rested, the next one marked, any site switched off.
   Supply: per protocol, the open vial, spares, run-out, order-by, use-by, units per dose, and what it costs.
   Effects: the day's check-in (appetite, side effects) and their own log read back: when effects land after a dose,
   per dose at each amount, weight at each amount, appetite through the week of a dose, reactions by site.
   Nothing here is advice. Every amount is the person's own schedule; no coach is on this screen. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, fmt = h.fmt, safe = yd.safe;
    var TABS = [['week', 'Week'], ['month', 'Month'], ['levels', 'Levels'], ['sites', 'Sites'], ['supply', 'Supply'], ['fx', 'Effects'], ['labs', 'Labs'], ['tl', 'Timeline']];   /* v328: Levels; v329: Labs and one Timeline */
    var DAYMS = 864e5, HR = 36e5;
    var SEV = [[1, 'Slight'], [2, 'Noticeable'], [3, 'Rough'], [4, 'Severe']];
    function ico(d, s, w){ return '<svg class="c3-ic" width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2.2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>'; }
    var IC = {
      pin:   '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"></path><circle cx="12" cy="10" r="2.4"></circle>',
      vial:  '<path d="M9 3h6"></path><path d="M10 3v4l-2.5 3.5V19a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-8.5L14 7V3"></path><path d="M7.5 14h9"></path>',
      step:  '<path d="M4 18h5v-5h5V8h6"></path><path d="M17 5l3 3-3 3"></path>',
      skip:  '<path d="M6 6l12 12"></path><circle cx="12" cy="12" r="8.5"></circle>',
      bell:  '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"></path><path d="M10 20a2 2 0 0 0 4 0"></path>',
      edit:  '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path>',
      cal:   '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16M9 3v4M15 3v4"></path>'
    };
    function icon(n, s, w){ return IC[n] ? ico(IC[n], s, w) : yd.icon(n, s, w); }
    function today(){ return safe(function(){ return dkey(Date.now()); }, ''); }
    function add(key, n){ return safe(function(){ return dkey(new Date(key + 'T12:00:00').getTime() + n * DAYMS); }, key); }
    function word(key, o){ return safe(function(){ return new Date(key + 'T12:00:00').toLocaleDateString('en-US', o || {weekday:'long', month:'short', day:'numeric'}); }, key); }
    function tm(at){ return safe(function(){ return new Date(at).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}); }, ''); }
    function dayOf(at){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'}); }, ''); }
    function shortDay(at){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', {month:'short', day:'numeric'}); }, ''); }
    function money(v){ return '$' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : (Math.round(v * 100) / 100).toFixed(2)); }
    function num(v, d){ var x = Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0); return String(x); }
    function model(){ return safe(function(){ return pdModel(); }, null); }
    /* v335: a vial, a pen or a pack, in its own words */
    function W(p){ return safe(function(){ return pdWords(p); }, null) || {one:'vial', many:'vials', open:'mixed', fresh:'Mix a new vial', act:'I mixed a new vial'}; }
    function amt(p, mg){ return safe(function(){ return pdAmt(p, mg); }, mg + ' mg'); }
    function amtParts(p, mg){ var t = amt(p, mg), i = t.lastIndexOf(' '); return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, '']; }
    function locked(id){ return safe(function(){ return !!PRO_PANES[id] && !isPro(); }, false); }
    function keysFrom(k0, n){ var out = []; for(var i = 0; i < n; i++) out.push(add(k0, i)); return out; }
    function rel(r){
      var now = Date.now(), d = r.at - now;
      if(r.dose) return 'logged ' + tm(r.dose.at);
      if(r.status === 'skipped') return 'skipped';
      if(r.status === 'held') return 'held';
      if(r.status === 'missed') return 'not logged';
      if(d <= 0) return 'due now';
      var hh = d / HR;
      return hh < 1 ? 'in ' + Math.max(1, Math.round(d / 60000)) + ' min' : hh < 36 ? 'in ' + Math.round(hh) + ' h' : 'in ' + Math.round(hh / 24) + ' days';
    }

    /* ---------- the ring: where this cycle is, to the next dose ---------- */
    function ring(frac, size, due, done){
      var sw = size >= 120 ? 12 : 7, r = (size - sw) / 2 - 1, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
      return '<svg class="pd-ring' + (due ? ' due' : '') + (done ? ' done' : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="pdRg' + size + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9FFE8"></stop><stop offset="1" stop-color="#1ED88A"></stop></linearGradient></defs>' +
        '<circle class="trk" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + sw + '"></circle>' +
        '<circle class="arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + sw + '" stroke="' + (due ? 'var(--pink)' : 'url(#pdRg' + size + ')') + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - (done ? 1 : f))).toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"></circle></svg>';
    }
    function hero(M){
      var cy = safe(function(){ return pdCycle(); }, null), A = M.adh, lv = M.live;
      var main = null; lv.forEach(function(x){ if(x.vial && x.vial.ok && (!main || (x.runOut && (!main.runOut || x.runOut < main.runOut)))) main = x; });
      var cost = 0, priced = false; lv.forEach(function(x){ if(x.priced){ cost += x.costWeek; priced = true; } });
      var todayRows = safe(function(){ return pdDay(today()); }, []) || [], doneToday = todayRows.length && todayRows.every(function(r){ return r.dose || r.status === 'skipped' || r.status === 'held'; });
      var big, sub, due = !!(cy && cy.due);
      if(!cy){ big = '·'; sub = 'nothing scheduled'; }
      else if(due){ big = 'Due'; sub = 'now'; }
      else { big = pdLeftWord(cy.ms); sub = 'to the next dose'; }
      var nx = cy ? cy.row : null;
      var nxLine = nx ? '<p class="pd-nx"><b>' + esc(pdName(nx.p)) + '</b><span class="c3-num">' + esc(amt(nx.p, nx.mg)) + (nx.units ? ' · ' + num(nx.units, 1) + ' units' : nx.tabs ? ' · ' + safe(function(){ return pdTabWord(nx.tabs); }, '') : '') + '</span>' +
        '<span>' + esc(dayOf(nx.at)) + ', ' + esc(tm(nx.at)) + (nx.site ? ' · ' + esc(nx.site) : '') + '</span></p>' : '';
      /* v374: only numbers there are (no lone dots); what is missing is a link to add it */
      var sl = [];
      if(A.owed) sl.push([Math.round(A.taken / A.owed * 100) + '%', 'on schedule, 30 days', A.taken / A.owed >= 0.9 ? 'good' : '']);   /* v330: wins, not guilt: no red */
      if(A.owed || A.taken) sl.push([String(A.taken), A.taken === 1 ? 'dose logged, 30 days' : 'doses logged, 30 days', A.taken ? 'good' : '']);
      if(main) sl.push([main.runOut ? shortDay(main.runOut) : '400 d+', lv.length > 1 ? pdName(main.p) + ' runs out' : 'last ' + W(main.p).one + ' runs out', main.orderBy && main.orderBy <= Date.now() ? 'bad' : '']);
      if(priced) sl.push([money(cost), 'a week']);
      var pid0 = lv.length ? lv[0].p.id : '', adds = [];
      if(pid0 && !main) adds.push('Add your supply');
      if(pid0 && !priced) adds.push('Add a price');
      var stats = '<div class="pd-sum">' + (sl.length ? yd.stats(sl, 'pd-top') : '') + (adds.length ? '<div class="pd-adds">' + adds.map(function(t, i){ return '<button type="button" class="c3-link" data-act="pedit" data-v="' + esc(pid0) + '" data-key="padds-' + i + '">' + yd.icon('plus', 15, 3) + '<span>' + esc(t) + '</span></button>'; }).join('') + '</div>' : '') + '</div>';
      var logged = todayRows.filter(function(r){ return r.dose; }).sort(function(a, b){ return b.dose.at - a.dose.at; })[0];
      var doneLine = doneToday && logged ? '<p class="pd-donet">' + h.icon('check', 18, 3.2) + '<span>' + (todayRows.length > 1 ? 'Today\'s doses logged' : 'Today\'s dose logged') + ' · ' + esc(tm(logged.dose.at)) + '</span></p>' : '';
      return '<div class="pd-band"><div class="pd-hero">' +
        '<div class="pd-ringw" role="img" aria-label="' + esc(cy ? (due ? 'A dose is due now' : big + ' to the next dose') : 'Nothing scheduled') + '">' + ring(cy ? cy.frac : 0, 148, due, !cy && doneToday) +
          '<span class="pd-ringt"><b class="c3-num">' + esc(big) + '</b><small>' + esc(sub) + '</small></span></div>' +
        '<div class="pd-heroside">' + nxLine + (nx && canLog(nx) ? '<div class="yd-acts">' + logBtn(nx, true) + '</div>' : doneLine) + '</div></div>' + stats + '</div>';   /* v333: Log is always right here, not only on the day */
    }

    /* ---------- the seven days ---------- */
    function strip(keys, sel, M){
      var t0 = today();
      return '<ol class="pd-days" aria-label="Days">' + keys.map(function(k){
        var rows = M.rows.filter(function(r){ return dkey(r.at) === k && !(r.p.stopped && !r.dose); }), on = k === sel;
        var dots = rows.slice(0, 6).map(function(r){ return '<i class="' + (r.dose ? 'l' : r.status === 'missed' ? 'm' : r.status === 'skipped' || r.status === 'held' ? 's' : r.out ? 'o' : '') + '"></i>'; }).join('');
        var flag = rows.some(function(r){ return r.newVial; }) ? '<em class="v" aria-hidden="true">' + icon('vial', 12, 2.4) + '</em>' : rows.some(function(r){ return r.step; }) ? '<em class="s" aria-hidden="true">' + icon('step', 12, 2.6) + '</em>' : '';
        var lbl = word(k) + (k === t0 ? ', today' : '') + ', ' + (rows.length ? rows.length + (rows.length === 1 ? ' dose' : ' doses') + ', ' + rows.filter(function(r){ return r.dose; }).length + ' logged' : 'no doses');
        return '<li><button type="button" class="pd-d' + (on ? ' on' : '') + (k === t0 ? ' today' : '') + (k < t0 ? ' past' : '') + (rows.length ? '' : ' none') + '" data-act="pday" data-v="' + esc(k) + '" data-key="pday-' + esc(k) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(lbl) + '">' +
          '<span class="dn">' + esc(word(k, {weekday:'short'})) + '</span><span class="dd c3-num">' + new Date(k + 'T12:00:00').getDate() + '</span>' +
          '<span class="dots">' + dots + '</span>' + flag + '</button></li>';
      }).join('') + '</ol>';
    }

    /* ---------- a dose ---------- */
    /* v374: a Log button only for the dose a tap now really is (pdCanLogNow): never next week's dose as a second one today */
    function canLog(r){ return safe(function(){ return pdCanLogNow(r); }, !r.dose); }
    function logBtn(r, big){
      var now = Date.now(), k = r.pid + '-' + r.at;
      if(r.status === 'missed') return '<button type="button" class="c3-btn-quiet pd-log" data-act="plogthen" data-pid="' + esc(r.pid) + '" data-at="' + r.at + '" data-key="plogthen-' + esc(k) + '">' + h.icon('check', 15, 3) + '<span>Took it then</span></button>' +
        (canLog(r) ? '<button type="button" class="c3-btn-quiet bare pd-sm" data-act="plog" data-pid="' + esc(r.pid) + '" data-at="' + r.at + '" data-key="plognow-' + esc(k) + '">Log now</button>' : '');
      if(!canLog(r)) return '';
      return '<button type="button" class="c3-btn-quiet pd-log' + (big ? ' big' : '') + (r.at <= now ? ' due' : '') + '" data-act="plog" data-pid="' + esc(r.pid) + '" data-at="' + r.at + '" data-key="plog-' + (big ? 'h-' : '') + esc(k) + '" aria-label="Log ' + esc(pdName(r.p)) + ', ' + esc(amt(r.p, r.mg)) + (r.site ? ', ' + esc(r.site) : '') + '">' + h.icon('plus', 15, 3) + '<span>' + (r.at > now + 2 * HR ? 'Log now' : 'Log') + '</span></button>';
    }
    function doseRow(r, st){
      var t0 = today(), k = dkey(r.at), key = r.pid + '-' + r.at, open = st.site === key, p = r.p, ap = amtParts(p, r.mg);
      var sub = [];
      if(r.units) sub.push(num(r.units, 1) + ' units');
      else if(r.tabs) sub.push(safe(function(){ return pdTabWord(r.tabs); }, ''));
      if(r.site) sub.push(r.site + (r.siteHand ? ' (moved)' : ''));
      else if(!r.inj) sub.push(safe(function(){ return routeName(protoRoute(p)).toLowerCase(); }, ''));
      else if(r.dose) sub.push('site not logged');   /* v348: a logged injection with no site says so */
      var acts = '';
      if(r.dose){
        acts = '<span class="pd-done">' + h.icon('check', 15, 3.2) + '<span>Logged ' + esc(tm(r.dose.at)) + '</span></span>' +
          (r.inj ? '<button type="button" class="c3-btn-quiet bare pd-sm' + (open ? ' on' : '') + '" data-act="psite" data-v="' + esc(key) + '" data-key="psite-' + esc(key) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + icon('pin', 15, 2.4) + '<span>Site</span></button>' : '') +
          '<button type="button" class="c3-btn-quiet bare pd-sm" data-act="punlog" data-pid="' + esc(r.pid) + '" data-at="' + r.dose.at + '" data-key="punlog-' + esc(key) + '">Undo</button>';
      } else if(r.status === 'skipped' || r.status === 'held'){
        acts = '<span class="pd-done skip">' + icon('skip', 15, 2.6) + '<span>' + (r.status === 'held' ? 'Held' : 'Skipped') + '</span></span>' +
          '<button type="button" class="c3-btn-quiet bare pd-sm" data-act="punskip" data-pid="' + esc(r.pid) + '" data-at="' + r.at + '" data-key="punskip-' + esc(key) + '">Undo</button>';
      } else {
        if(k <= t0 && (r.status !== 'missed' || r.at >= Date.now() - 14 * DAYMS)) acts += logBtn(r);
        if(r.inj && r.status !== 'missed') acts += '<button type="button" class="c3-btn-quiet bare pd-sm' + (open ? ' on' : '') + '" data-act="psite" data-v="' + esc(key) + '" data-key="psite-' + esc(key) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + icon('pin', 15, 2.4) + '<span>Site</span></button>';
        acts += '<button type="button" class="c3-btn-quiet bare pd-sm" data-act="pskip" data-pid="' + esc(r.pid) + '" data-at="' + r.at + '" data-key="pskip-' + esc(key) + '">Skip</button>';
      }
      var flags = '';
      if(r.step) flags += '<span class="pd-flag s">' + icon('step', 14, 2.6) + 'Steps to ' + esc(amt(p, r.mg)) + '</span>';
      if(r.newVial) flags += '<span class="pd-flag v">' + icon('vial', 14, 2.4) + 'Opens a new vial</span>';
      if(r.out) flags += '<span class="pd-flag o">' + icon('vial', 14, 2.4) + 'No vial left for this one</span>';
      if(r.status === 'missed') flags += '<span class="pd-flag o">Not logged</span>';
      return '<li class="pd-row' + (r.dose ? ' logged' : '') + (r.status === 'missed' ? ' missed' : '') + '">' +
        '<span class="pd-tm"><b class="c3-num">' + esc(tm(r.dose ? r.dose.at : r.at)) + '</b><i>' + esc(rel(r)) + '</i></span>' +
        '<span class="pd-nm"><b>' + esc(pdName(p)) + '</b><small>' + esc(sub.join(' · ')) + '</small>' + (flags ? '<span class="pd-flags">' + flags + '</span>' : '') + '</span>' +
        '<span class="pd-amt"><b class="c3-num">' + esc(ap[0]) + '</b> <small>' + esc(ap[1]) + '</small></span>' +
        '<span class="pd-acts">' + acts + '</span>' + (open ? sitePanel(r) : '') + '</li>';
    }
    function sitePanel(r){
      var allow = safe(function(){ return rxProtoZones(r.p); }, null), S = (safe(function(){ return pdSites(); }, []) || []).filter(function(x){ return !allow || allow.indexOf(x.k) >= 0 || x.k === r.site; }), key = r.pid + '-' + r.at;   /* v328 */
      return '<div class="pd-sitep" role="region" aria-label="Pick the site for this dose"><ul class="pd-sitel">' + S.map(function(x){
        var cur = x.k === r.site;
        return '<li><button type="button" class="pd-sitec' + (cur ? ' on' : '') + (x.off ? ' off' : '') + (x.ready ? ' ready' : '') + '" data-act="psetsite" data-v="' + esc(x.k) + '" data-pid="' + esc(r.pid) + '" data-at="' + (r.dose ? r.dose.at : r.at) + '" data-key="pset-' + esc(key) + '-' + esc(x.k) + '"' + (x.off && !cur ? ' disabled' : '') + ' aria-pressed="' + (cur ? 'true' : 'false') + '">' +
          '<b>' + esc(x.k) + '</b><small>' + (x.off ? 'switched off' : x.heal ? 'healing' : x.rest == null ? 'not used yet' : x.rest === 0 ? 'used today' : 'rested ' + x.rest + (x.rest === 1 ? ' day' : ' days')) + '</small></button></li>';
      }).join('') + '</ul></div>';
    }
    function dayRows(key, M, st){
      var rows = M.rows.filter(function(r){ return dkey(r.at) === key && !(r.p.stopped && !r.dose); });
      if(!rows.length) return '<p class="pd-none">' + esc(key === today() ? 'Nothing planned today.' : 'Nothing planned ' + word(key, {weekday:'long'}) + '.') + '</p>';
      return '<ul class="pd-list">' + rows.map(function(r){ return doseRow(r, st); }).join('') + '</ul>';
    }
    function dayHead(key, M){
      var rows = M.rows.filter(function(r){ return dkey(r.at) === key && !(r.p.stopped && !r.dose); }), t0 = today();
      var n = rows.length, l = rows.filter(function(r){ return r.dose; }).length;
      return '<div class="pd-dayh"><span class="dt">' + esc(word(key, {weekday:'long'})) + (key === t0 ? ' · today' : '') + '<em>' + esc(word(key, {month:'short', day:'numeric'})) + '</em></span>' +
        (n ? '<span class="tt"><b class="c3-num">' + l + '</b> of <b class="c3-num">' + n + '</b> logged</span>' : '') + '</div>';
    }

    /* ---------- week ---------- */
    /* v333: the stack, right under the next dose: each compound, its amount, its days, when it is next; a tap opens it.
       Add a compound opens the three-step add (screen-addcmp.js), not the long form. */
    function stackRows(M){
      var all = safe(function(){ return pdProtos(true); }, []) || [], gate = locked('compounds') && all.length >= 1;
      var nextOf = function(p){ var r = (M.rows || []).filter(function(x){ return x.pid === p.id && !x.dose && x.status !== 'skipped' && x.status !== 'held' && x.status !== 'missed'; }).sort(function(a, b){ return a.at - b.at; })[0]; return r ? rel(r) : ''; };
      return yd.sec('What you take', '<ul class="pd-protos pd-stack">' + all.map(function(p){
        var nx = p.stopped ? 'stopped' : nextOf(p);
        return '<li><button type="button" class="pd-proto' + (p.stopped ? ' stopped' : '') + '" data-act="pedit" data-v="' + esc(p.id) + '" data-key="pedit-' + esc(p.id) + '">' +
          '<span class="n"><b>' + esc(pdName(p)) + '</b><small>' + esc(safe(function(){ return pdPatternWord(p); }, '') + (nx ? ' · next ' + nx.replace(/^in /, 'in ') : '')) + '</small></span>' +
          '<span class="a c3-num">' + esc(amt(p, safe(function(){ return pdMgAt(p, Date.now(), p.doses); }, p.doseMg))) + '</span>' + icon('edit', 16, 2.2) + '</button></li>';
      }).join('') + '</ul>' +
        '<div class="yd-acts">' + (gate ? '<button type="button" class="c3-btn-quiet yd-btn" data-act="padd" data-key="padd" data-locked="1" aria-label="Add a compound, needs Pro">' + yd.icon('lock', 16, 2.2) + '<span>Add a compound</span></button>' : yd.btn('padd', 'Add a compound', {icon:'plus'})) + '</div>', {id:'protos', n: String(all.length)});
    }
    function remindRow(){
      var R = safe(function(){ return remCfg(); }, {}) || {}, remOn = !(R.dose && R.dose.on === false);
      var supOn = !(R.supply && R.supply.on === false);
      return '<ul class="yd-list pd-rem">' + '<li>' + yd.sw('prem', remOn, 'Dose reminders', 'Log it, skip it or snooze it from the notification') + '</li>' +
        '<li>' + yd.sw('psup', supOn, 'Supply and cycle alerts', 'A new vial, the use-by, reorder, off weeks and back on') + '</li></ul>';
    }
    function weekTab(ctx, M){
      var st = ctx.state, t0 = today(), w = Math.max(-1, Math.min(3, st.wk || 0)), k0 = add(t0, w * 7), keys = keysFrom(k0, 7);
      var sel = st.day && keys.indexOf(st.day) >= 0 ? st.day : (w === 0 ? t0 : keys[0]);
      var nav = '<div class="pd-nav">' + yd.btn('pwk', '', {v: w - 1, icon:'back', aria:'Earlier week', cls:'pd-arrow', disabled: w <= -1}) +
        '<b>' + esc(word(keys[0], {month:'short', day:'numeric'})) + ' to ' + esc(word(keys[6], {month:'short', day:'numeric'})) + (w === 0 ? ' <span>this week</span>' : w === -1 ? ' <span>last week</span>' : '') + '</b>' +
        yd.btn('pwk', '', {v: w + 1, icon:'chev', aria:'Later week', cls:'pd-arrow', disabled: w >= 3}) + '</div>';
      var ahead = [];
      M.live.forEach(function(x){
        var nm = M.live.length > 1 ? pdName(x.p) + ': ' : '';
        x.steps.slice(0, 1).forEach(function(s){ ahead.push([s.at, 'step', nm + 'steps to ' + amt(x.p, s.mg) + ' ' + dayOf(s.at)]); });
        x.newVials.slice(0, 1).forEach(function(at){ ahead.push([at, 'vial', nm + 'a new ' + W(x.p).one + ' ' + dayOf(at)]); });
        if(x.orderBy) ahead.push([x.orderBy, 'cal', nm + 'order by ' + dayOf(x.orderBy) + (x.orderBy <= Date.now() ? ', that is now' : '')]);
        if(x.bud) ahead.push([x.bud, 'vial', nm + 'the open ' + W(x.p).one + ' is good to ' + dayOf(x.bud)]);
      });
      /* v334: the cycle (blocks of weeks off and back on, a last day) and the last dose the supply covers */
      (safe(function(){ return pdAlerts(); }, []) || []).forEach(function(a){
        var x = M.by && M.by[a.pid]; if(!x) return; var nm = M.live.length > 1 ? pdName(x.p) + ': ' : '';
        if(a.kind === 'off') ahead.push([a.at, 'cal', nm + 'off weeks from ' + dayOf(a.at)]);
        else if(a.kind === 'on') ahead.push([a.at, 'cal', nm + 'back on ' + dayOf(a.at)]);
        else if(a.kind === 'end') ahead.push([a.at, 'cal', nm + 'last day ' + dayOf(a.at)]);
        else if(a.kind === 'last' && !x.orderBy) ahead.push([a.at, 'vial', nm + 'last dose you have ' + dayOf(a.at)]);
      });
      ahead.sort(function(a, b){ return a[0] - b[0]; });
      var aheadHtml = ahead.length ? '<ul class="pd-ahead">' + ahead.slice(0, 5).map(function(a){ return '<li>' + icon(a[1], 16, 2.4) + '<span>' + esc(a[2]) + '</span></li>'; }).join('') + '</ul>' : '';
      return nav + strip(keys, sel, M) +
        '<div class="yd-cols"><div class="yd-col">' + yd.sec('', dayHead(sel, M) + dayRows(sel, M, st), {id:'day', aria:'The day'}) + '</div>' +
        '<div class="yd-col">' + (aheadHtml ? yd.sec('Coming up', aheadHtml, {id:'ahead'}) : '') + remindRow() + '</div></div>';
    }

    /* ---------- month (v327): the same calendar as the meal plan's ---------- */
    function dayOfRows(M, k){ return M.rows.filter(function(r){ return dkey(r.at) === k && !(r.p.stopped && !r.dose); }); }
    function monthTab(ctx, M){
      var st = ctx.state, t0 = today(), first = add(t0, -7), last = add(t0, 27), cx = C3.cx;
      var weeks = cx.weeks(first, last), sel = st.mday || t0, orderDays = {};
      M.live.forEach(function(x){ if(x.orderBy) orderDays[dkey(Math.max(x.orderBy, Date.now()))] = pdName(x.p); });
      var evs = function(k){ return safe(function(){ return calInOn(k); }, []) || []; };
      var cell = function(k){
        var rows = dayOfRows(M, k), E = evs(k);
        if(!rows.length && !E.length && !orderDays[k]) return {none: true, label: word(k) + ', no doses'};
        var logged = rows.filter(function(r){ return r.dose; }).length, miss = rows.filter(function(r){ return r.status === 'missed'; }).length;
        var skip = rows.filter(function(r){ return r.status === 'skipped' || r.status === 'held'; }).length, need = rows.length - skip;
        var tn = 'plan', frac = 0;
        if(k <= t0 && need > 0){ frac = logged / need; tn = miss ? 'over' : logged >= need ? 'ok' : k < t0 ? 'under' : (logged ? 'ok' : 'plan'); }
        else if(k <= t0 && rows.length && !need) tn = 'plan';
        var marks = [];
        if(rows.some(function(r){ return r.newVial; })) marks.push('vial');
        if(rows.some(function(r){ return r.step; })) marks.push('step');
        if(orderDays[k] || rows.some(function(r){ return r.out; })) marks.push('cart');
        if(E.length) marks.push('cal');
        var val = rows.length === 1 ? amt(rows[0].p, rows[0].mg).replace(/ (mg|IU)$/, '$1') : rows.length ? rows.length + ' doses' : '';
        var words = [word(k)];
        if(rows.length) words.push(rows.length + (rows.length === 1 ? ' dose' : ' doses') + (k <= t0 ? ', ' + logged + ' logged' + (miss ? ', ' + miss + ' not logged' : '') : ''));
        if(rows.some(function(r){ return r.newVial; })) words.push('a new vial');
        if(orderDays[k]) words.push('order ' + orderDays[k] + ' by today');
        if(E.length) words.push(E.length + ' on your calendar');
        return {frac: frac, tone: tn, inner: rows.length > 1 ? String(rows.length) : '', val: val, marks: marks, label: words.join(', '), sub: rows.map(function(r){ return pdName(r.p); }).filter(function(x, i, a){ return a.indexOf(x) === i; }).join(', ')};
      };
      var week = function(w){
        var rows = []; w.forEach(function(k){ rows = rows.concat(dayOfRows(M, k)); });
        if(!rows.length) return '';
        var past = rows.filter(function(r){ return dkey(r.at) < t0 || r.dose; }), ahead = rows.filter(function(r){ return !r.dose && dkey(r.at) >= t0 && r.status !== 'skipped' && r.status !== 'held'; });
        var bits = [];
        var need = past.filter(function(r){ return r.status !== 'skipped' && r.status !== 'held'; });
        if(need.length) bits.push('<span class="s">' + cx.icon('check', 13, 3) + '<span><b>' + need.filter(function(r){ return r.dose; }).length + ' of ' + need.length + '</b> logged</span></span>');
        if(ahead.length) bits.push('<span class="s"><span><b>' + ahead.length + '</b> ahead</span></span>');
        var nv = rows.filter(function(r){ return r.newVial; }).length; if(nv) bits.push('<span class="s">' + cx.icon('vial', 13, 2.6) + '<span><b>' + nv + '</b> new ' + (nv === 1 ? 'vial' : 'vials') + '</span></span>');
        var ob = w.filter(function(k){ return orderDays[k]; }); if(ob.length) bits.push('<span class="s">' + cx.icon('cart', 13, 2.6) + '<span>order by <b>' + esc(word(ob[0], {weekday:'short'})) + '</b></span></span>');
        var c = ahead.reduce(function(a, r){ return a + (r.cost || 0); }, 0); if(c > 0) bits.push('<span class="s"><span><b>' + money(c) + '</b></span></span>');
        return bits.join('');
      };
      var panel = function(k){
        var E = evs(k);
        var ev = E.length ? '<ul class="cx-evs" aria-label="On your calendar">' + E.map(function(e){ return '<li><span class="w">' + esc(e.all ? 'All day' : tm(e.s)) + '</span><span class="t">' + esc(e.t) + (e.where ? '<small>' + esc(e.where) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' : '';
        return dayHead(k, M) + dayRows(k, M, st) + ev + (orderDays[k] ? '<p class="mk-reb">' + cx.icon('cart', 15, 2.6) + '<span>Order ' + esc(orderDays[k]) + ' by today to have it before the last vial runs out.</span></p>' : '');
      };
      var ahead = M.rows.filter(function(r){ return r.at > Date.now() && r.at <= Date.now() + 28 * DAYMS && !r.dose && r.status === 'planned' && !r.p.stopped; });
      var nV = 0, cost = 0, priced = false; M.live.forEach(function(x){ nV += x.newVials.filter(function(at){ return at <= Date.now() + 28 * DAYMS; }).length; if(x.priced){ cost += x.costMonth; priced = true; } });
      var top = yd.stats([[String(ahead.length), 'doses ahead'], [String(nV), nV === 1 ? 'new vial' : 'new vials'], [String(M.live.reduce(function(a, x){ return a + x.steps.filter(function(s){ return s.at <= Date.now() + 28 * DAYMS; }).length; }, 0)), 'steps'], [priced ? money(cost) : '·', priced ? 'a month' : 'add a vial price']], 'pd-top');
      var cal = cx.month({weeks: weeks, sel: sel, today: t0, act: 'pmpick', aria: 'Your doses, last week and four weeks ahead', cell: cell, week: week, panel: panel,
        key: cx.key([['ring:ok', 'logged'], ['ring:over', 'not logged'], ['ring:plan', 'planned'], ['vial', 'new vial'], ['step', 'step'], ['cart', 'order by'], ['cal', 'your calendar']])});
      return top + yd.sec(word(first, {month:'long'}) + (word(last, {month:'long'}) !== word(first, {month:'long'}) ? ' to ' + word(last, {month:'long'}) : ''), cal, {id:'month'}) + cx.connect(ctx, {what: 'doses'});
    }

    /* ---------- sites (v328: the body map) ----------
       18 zones (rxZones, the app's v328rx script) and the person's own spots, each with the routes it takes. A phone shows
       one side at a time, big enough to tap each zone (44 px and more); a wider screen shows both. Tap a zone: what it has
       carried, when, and what to do with it (use it next, rest it while it heals, switch it off). The rotation takes only
       zones a protocol's route can use and the ones given to that protocol, never one switched off or resting. */
    function bodyPath(c){
      var X = function(x){ return (c + x * 1000).toFixed(1); }, Y = function(y){ return (y * 1000).toFixed(1); };
      var shW = 0.118, hipW = 0.078, waistW = 0.068, p = '';
      p += 'M' + X(-shW) + ' ' + Y(0.165) + 'C' + X(-shW * 0.6) + ' ' + Y(0.14) + ' ' + X(shW * 0.6) + ' ' + Y(0.14) + ' ' + X(shW) + ' ' + Y(0.165);
      p += 'C' + X(shW + 0.008) + ' ' + Y(0.24) + ' ' + X(waistW + 0.01) + ' ' + Y(0.40) + ' ' + X(waistW) + ' ' + Y(0.445);
      p += 'C' + X(waistW + 0.004) + ' ' + Y(0.485) + ' ' + X(hipW) + ' ' + Y(0.495) + ' ' + X(hipW) + ' ' + Y(0.53);
      p += 'L' + X(-hipW) + ' ' + Y(0.53);
      p += 'C' + X(-hipW) + ' ' + Y(0.495) + ' ' + X(-waistW - 0.004) + ' ' + Y(0.485) + ' ' + X(-waistW) + ' ' + Y(0.445);
      p += 'C' + X(-waistW - 0.01) + ' ' + Y(0.40) + ' ' + X(-shW - 0.008) + ' ' + Y(0.24) + ' ' + X(-shW) + ' ' + Y(0.165) + 'Z';
      [-1, 1].forEach(function(sd){
        var s0 = sd * (shW + 0.02), s1 = sd * (shW + 0.04), s2 = sd * (shW + 0.052);
        p += 'M' + X(s0 - sd * 0.03) + ' ' + Y(0.17) + 'L' + X(s0 + sd * 0.03) + ' ' + Y(0.205) + 'C' + X(s1 + sd * 0.034) + ' ' + Y(0.29) + ' ' + X(s1 + sd * 0.028) + ' ' + Y(0.35) + ' ' + X(s1 + sd * 0.024) + ' ' + Y(0.40);
        p += 'C' + X(s2 + sd * 0.028) + ' ' + Y(0.46) + ' ' + X(s2 + sd * 0.02) + ' ' + Y(0.54) + ' ' + X(s2 + sd * 0.016) + ' ' + Y(0.6);
        p += 'L' + X(s2 - sd * 0.016) + ' ' + Y(0.6) + 'C' + X(s2 - sd * 0.02) + ' ' + Y(0.53) + ' ' + X(s1 - sd * 0.028) + ' ' + Y(0.46) + ' ' + X(s1 - sd * 0.024) + ' ' + Y(0.40);
        p += 'C' + X(s1 - sd * 0.028) + ' ' + Y(0.34) + ' ' + X(s0 - sd * 0.028) + ' ' + Y(0.29) + ' ' + X(s0 - sd * 0.03) + ' ' + Y(0.205) + 'Z';
        var lx = sd * 0.046;
        p += 'M' + X(lx - 0.046) + ' ' + Y(0.525) + 'L' + X(lx + 0.046) + ' ' + Y(0.525) + 'C' + X(lx + 0.05) + ' ' + Y(0.62) + ' ' + X(lx + 0.038) + ' ' + Y(0.70) + ' ' + X(lx + 0.03) + ' ' + Y(0.77);
        p += 'C' + X(lx + 0.034) + ' ' + Y(0.84) + ' ' + X(lx + 0.026) + ' ' + Y(0.91) + ' ' + X(lx + 0.018) + ' ' + Y(0.96) + 'L' + X(lx - 0.018) + ' ' + Y(0.96);
        p += 'C' + X(lx - 0.026) + ' ' + Y(0.91) + ' ' + X(lx - 0.034) + ' ' + Y(0.84) + ' ' + X(lx - 0.03) + ' ' + Y(0.77) + 'C' + X(lx - 0.038) + ' ' + Y(0.70) + ' ' + X(lx - 0.05) + ' ' + Y(0.62) + ' ' + X(lx - 0.046) + ' ' + Y(0.525) + 'Z';
      });
      return '<ellipse cx="' + c + '" cy="' + Y(0.068) + '" rx="41" ry="62"></ellipse><path d="M' + X(-0.024) + ' ' + Y(0.112) + 'L' + X(0.024) + ' ' + Y(0.112) + 'L' + X(0.032) + ' ' + Y(0.155) + 'L' + X(-0.032) + ' ' + Y(0.155) + 'Z"></path><path d="' + p + '"></path>';
    }
    var FIG_Y0 = 100, FIG_H = 700;   /* neck to below the knee: every zone, at the largest size the width allows */
    function wideMap(){ return safe(function(){ return window.matchMedia('(min-width: 700px)').matches; }, false); }
    function figure(S, next, st){
      var wide = wideMap(), views = wide ? ['f', 'b'] : [st.fv === 'b' ? 'b' : 'f'];
      var VW = 500 * views.length, cx = {}; views.forEach(function(v, i){ cx[v] = 250 + 500 * i; });
      var P = safe(function(){ return pdPrefs(); }, {rest: 7});
      var place = st.place && st.place.step === 'tap';
      var s = '<svg class="pd-fig v2' + (place ? ' placing' : '') + '" viewBox="0 ' + FIG_Y0 + ' ' + VW + ' ' + FIG_H + '" data-views="' + views.join('') + '" role="group" aria-label="Your injection sites, ' + (views.length > 1 ? 'front and back' : views[0] === 'f' ? 'front' : 'back') + (next ? '. Next: ' + esc(next) : '') + '">';
      views.forEach(function(v){ s += '<g class="pd-body' + (place ? ' tap' : '') + '"' + (place ? ' data-pv="' + v + '" data-pc="' + cx[v] + '"' : '') + '>' + bodyPath(cx[v]) + '</g>' +
        '<text x="' + cx[v] + '" y="' + (FIG_Y0 + 40) + '" class="pd-figt">' + (v === 'f' ? 'Front' : 'Back') + '</text>' +
        '<text x="' + (cx[v] - 205) + '" y="' + (FIG_Y0 + 240) + '" class="pd-figlr">L</text><text x="' + (cx[v] + 205) + '" y="' + (FIG_Y0 + 240) + '" class="pd-figlr">R</text>'; });
      S.forEach(function(x){
        var z = x.z || {}; if(views.indexOf(z.v) < 0) return;
        var c0 = (cx[z.v] + z.x * 1000).toFixed(1), c1 = (z.y * 1000).toFixed(1), f = x.rest == null ? 1 : Math.min(1, x.rest / Math.max(1, P.rest));
        var cls = x.off ? 'off' : x.heal ? 'heal' : (x.rest == null || x.ready) ? 'ready' : x.rest < 2 ? 'hot' : 'rest';
        var word = x.k + ', ' + (x.off ? 'switched off' : x.heal ? 'resting while it heals' : x.rest == null ? 'not used yet' : x.rest === 0 ? 'used today' : 'rested ' + x.rest + (x.rest === 1 ? ' day' : ' days')) + (x.k === next ? ', next' : '');
        s += '<g class="pd-st ' + cls + (x.k === next ? ' next' : '') + (x.k === st.zone ? ' sel' : '') + (z.own ? ' own' : '') + '" data-act="pzone" data-v="' + esc(x.k) + '" data-key="pzone-' + esc(x.k) + '" role="button" tabindex="0" aria-pressed="' + (x.k === st.zone ? 'true' : 'false') + '" aria-label="' + esc(word) + '">' +
          '<circle class="hit" cx="' + c0 + '" cy="' + c1 + '" r="34"></circle>' +
          (x.k === next ? '<circle class="halo" cx="' + c0 + '" cy="' + c1 + '" r="40"></circle>' : '') +
          (x.k === st.zone ? '<circle class="ring" cx="' + c0 + '" cy="' + c1 + '" r="33"></circle>' : '') +
          '<circle class="bg" cx="' + c0 + '" cy="' + c1 + '" r="24"></circle>' +
          (!x.off ? '<circle class="fill" cx="' + c0 + '" cy="' + c1 + '" r="' + (7 + 15 * (x.heal ? 1 : f)).toFixed(1) + '"></circle>' : '') +
          (z.r && z.r.indexOf('im') >= 0 && z.r.indexOf('sc') < 0 ? '<text x="' + c0 + '" y="' + (+c1 + 5) + '" class="pd-im">IM</text>' : '') + '</g>';
      });
      if(st.place && st.place.v && views.indexOf(st.place.v) >= 0) s += '<circle class="pd-pin" cx="' + (cx[st.place.v] + st.place.x * 1000).toFixed(1) + '" cy="' + (st.place.y * 1000).toFixed(1) + '" r="20"></circle>';
      return s + '</svg>';
    }
    /* the zone picked on the map: its numbers, its last uses, what to do with it */
    function zonePanel(x, M, st, ctx){
      var z = x.z || {}, uses = safe(function(){ return rxZoneUses(x.k, 5); }, []) || [], now = Date.now();
      var routes = (z.r || ['sc']).map(function(r){ return r.toUpperCase(); }).join(' and ');
      var state = x.off ? 'Switched off' : x.heal ? 'Resting while it heals, back ' + shortDay(x.heal) : x.rest == null ? 'Not used yet' : x.rest === 0 ? 'Used today' : 'Rested ' + x.rest + (x.rest === 1 ? ' day' : ' days');
      /* the next planned dose this zone can take: its protocol's route and zones allow it */
      var nx = (M.rows || []).filter(function(r){ return r.inj && !r.dose && (r.status === 'planned' || r.status === 'due') && r.at >= now - 3 * HR; })
        .find(function(r){ return (safe(function(){ return rxProtoZones(r.p); }, []) || []).indexOf(x.k) >= 0; }) || null;
      var acts = [];
      if(nx && !x.off && nx.site !== x.k) acts.push(yd.btn('pzuse', 'Use it ' + (nx.status === 'due' ? 'now' : dayOf(nx.at)), {v: x.k, icon: 'pin', extra: 'data-pid="' + esc(nx.pid) + '" data-at="' + nx.at + '"'}));
      if(!x.off) acts.push(x.heal ? yd.btn('pzheal', 'Back in the rotation', {v: '0', icon: 'refresh', extra: 'data-z="' + esc(x.k) + '"'}) : yd.btn('pzheal', 'Rest it ' + Math.max(7, P0().rest) + ' days', {v: String(Math.max(7, P0().rest)), icon: 'pause', extra: 'data-z="' + esc(x.k) + '"'}));
      acts.push(yd.btn('pzoff', x.off ? 'Back on' : 'Switch it off', {v: x.k, icon: x.off ? 'plus' : 'x'}));
      if(z.own) acts.push(yd.arm(ctx, 'pzdel', 'Remove this spot', 'Tap again to remove it', {v: x.k, icon: 'trash'}));
      return '<div class="pd-zone" data-zone="' + esc(x.k) + '"><p class="pd-zh"><b>' + esc(x.k) + '</b><small>' + esc(routes + ' · ' + state + (x.k === M.nextSite ? ' · next' : '')) + '</small></p>' +
        yd.stats([[String(x.n), 'uses in 12 weeks'], [x.last ? shortDay(x.last) : '·', 'last used'], [String(x.fx), x.fx === 1 ? 'reaction' : 'reactions', x.fx ? 'warn' : '']], 'pd-top pd-top3') +
        (uses.length ? '<ul class="pd-zu">' + uses.map(function(u){ return '<li><span class="c3-num">' + esc(dayOf(u.at)) + '</span><b>' + esc(u.name) + '</b><small>' + esc(amt(u.p, u.mg)) + '</small></li>'; }).join('') + '</ul>' : '') +
        '<div class="yd-acts">' + acts.join('') + '</div></div>';
    }
    function P0(){ return safe(function(){ return pdPrefs(); }, {rest: 7, siteOff: []}); }
    function sitesTab(ctx, M){
      var st = ctx.state, S = safe(function(){ return pdSites(); }, []) || [], P = P0(), next = safe(function(){ return pdNextSite(); }, null);
      M.nextSite = next;
      var on = S.filter(function(x){ return !x.off; }), heal = S.filter(function(x){ return x.heal && !x.off; });
      var reuse = 0; safe(function(){ (ALL.protocols || []).forEach(function(p){ var D = (p.doses || []).filter(function(d){ return d.site && d.at >= Date.now() - 84 * DAYMS; }); D.forEach(function(d){ (ALL.protocols || []).forEach(function(q){ (q.doses || []).forEach(function(e){ if(e !== d && e.site === d.site && e.at < d.at && d.at - e.at < P.rest * DAYMS) reuse++; }); }); }); }); });
      var top = yd.stats([[next || '·', 'next site'], [String(on.length) + ' of ' + S.length, 'zones in the rotation'], [String(reuse), 'reused inside ' + P.rest + ' days', reuse ? 'warn' : 'good'], [String(heal.length), heal.length === 1 ? 'resting to heal' : 'resting to heal', heal.length ? 'warn' : '']], 'pd-top');
      var sel = st.zone ? S.find(function(x){ return x.k === st.zone; }) : null;
      var viewSeg = wideMap() ? '' : yd.seg('pfv', [['f', 'Front'], ['b', 'Back']], st.fv === 'b' ? 'b' : 'f', {aria: 'Side of the body', cls: 'pd-seg fill pd-fv'});
      var placeUI = '';
      if(st.place){
        placeUI = st.place.step === 'tap' ? '<p class="pd-place">Tap the figure where your spot is.</p><div class="yd-acts">' + yd.btn('pplacex', 'Cancel', {icon: 'x'}) + '</div>'
          : '<div class="pd-placef">' + yd.input('pspotn', st.place.n || '', 'Name it', {ph: 'Lower back L', max: 32}) +
            yd.seg('pspotr', [['sc', 'SC'], ['im', 'IM'], ['both', 'Both']], st.place.r || 'sc', {aria: 'Route this spot takes', cls: 'pd-seg fill'}) +
            '<div class="yd-acts">' + yd.btn('pspotok', 'Add the spot', {icon: 'plus'}) + yd.btn('pplacex', 'Cancel', {icon: 'x'}) + '</div></div>';
      }
      var map = viewSeg + figure(S, next, st) +
        '<p class="pd-key"><span><i class="ready"></i> rested</span><span><i class="rest"></i> resting</span><span><i class="hot"></i> used in the last 2 days</span><span><i class="heal"></i> healing</span><span><i class="nx"></i> next</span><span><b class="im">IM</b> muscle only</span></p>' +
        (sel ? zonePanel(sel, M, st, ctx) : (st.place ? '' : '<p class="pd-tapz">Tap a zone for its history.</p>')) + placeUI +
        (!st.place ? '<div class="yd-acts">' + yd.btn('pplace', 'Add a spot of your own', {icon: 'plus'}) + '</div>' : '');
      var groups = {};
      S.forEach(function(x){ var g = (x.z && x.z.g) || 'Yours'; (groups[g] = groups[g] || []).push(x); });
      var list = Object.keys(groups).map(function(g){ return '<li class="pd-sg">' + esc(g) + '</li>' + groups[g].map(function(x){
        var f = x.rest == null ? 1 : Math.min(1, x.rest / Math.max(1, P.rest)), rt = ((x.z && x.z.r) || ['sc']).map(function(r){ return r.toUpperCase(); }).join('/');
        return '<li class="' + (x.off ? 'off' : '') + (x.k === next ? ' next' : '') + (x.heal ? ' heal' : '') + '"><button type="button" class="n" data-act="pzone" data-v="' + esc(x.k) + '" data-key="pzrow-' + esc(x.k) + '"><b>' + esc(x.k) + '</b><small>' + esc(rt + ' · ' + (x.off ? 'switched off' : x.heal ? 'healing, back ' + shortDay(x.heal) : x.rest == null ? 'not used yet' : x.rest === 0 ? 'used today' : 'rested ' + x.rest + (x.rest === 1 ? ' day' : ' days')) + (x.k === next ? ' · next' : '')) + '</small></button>' +
          '<span class="b">' + yd.bar(x.off ? 0 : x.heal ? 0.15 : f, x.heal ? 'warm' : x.ready ? 'ok' : 'warm') + '<small class="c3-num">' + x.n + ' in 12 wk' + (x.fx ? ' · ' + x.fx + (x.fx === 1 ? ' reaction' : ' reactions') : '') + '</small></span>' +
          '<button type="button" role="switch" aria-checked="' + (x.off ? 'false' : 'true') + '" class="pd-siteon" data-act="psiteon" data-v="' + esc(x.k) + '" data-key="psiteon-' + esc(x.k) + '" aria-label="' + esc(x.k) + ' in the rotation"><span class="yd-track" aria-hidden="true"><i></i></span></button></li>';
      }).join(''); }).join('');
      return top + '<div class="yd-cols"><div class="yd-col">' + yd.sec('The map', map, {id: 'fig'}) + '</div>' +
        '<div class="yd-col">' + yd.sec('Every zone', '<ul class="pd-sites">' + list + '</ul>', {id: 'list'}) +
          yd.sec('Rest a zone at least', yd.seg('prest', [[5, '5 days'], [7, '7 days'], [10, '10 days'], [14, '14 days']], P.rest, {aria: 'Days a zone rests before it comes round again', cls: 'pd-seg fill'}), {id: 'rest'}) +
          yd.note('The next zone is the one rested longest, sides alternating, across every protocol you run, from the zones each protocol’s route can take. A reaction you log rests the zone it came from for a week. A zone you switch off is never picked.') + '</div></div>';
    }

    /* ---------- supply ---------- */
    function supplyOne(x, st){
      var p = x.p, V = x.vial, conc = safe(function(){ return pdConc(p); }, 0), mg = safe(function(){ return pdMgAt(p, Date.now(), p.doses); }, p.doseMg), u = safe(function(){ return pdUnits(p, mg); }, 0), inv = safe(function(){ return vialInv(p); }, {}) || {};
      var frac = V.ok && V.usable ? V.leftMl / V.usable : 0, w = W(p), tw = safe(function(){ return pdTabWord(pdTabs(p, mg)); }, '');
      var head = '<div class="pd-sup"><div class="pd-vial" role="img" aria-label="' + esc(Math.round(frac * 100) + ' percent left in the open ' + w.one) + '"><i style="height:' + Math.round(frac * 1000) / 10 + '%"></i><b class="c3-num">' + Math.round(frac * 100) + '%</b></div>' +
        '<div class="pd-supn">' + yd.stats([
          [V.ok ? String(x.leftNow) : '·', V.ok ? (x.leftNow === 1 ? 'dose left in this ' + w.one : 'doses left in this ' + w.one) : 'nothing set up'],
          [String(x.spare), x.spare === 1 ? 'spare ' + w.one : 'spare ' + w.many],
          [x.runOut ? shortDay(x.runOut) : V.ok ? '400 d+' : '·', 'runs out', x.runOut && x.runOut - Date.now() < 10 * DAYMS ? 'bad' : ''],
          [x.orderBy ? (x.orderBy <= Date.now() ? 'Now' : shortDay(x.orderBy)) : '·', 'order by', x.orderBy && x.orderBy <= Date.now() ? 'bad' : '']], 'pd-top') + '</div></div>';
      var facts = [];
      if(V.ok && u) facts.push('<li><b class="c3-num">' + num(u, 1) + ' units</b> a dose on a ' + esc(String(safe(function(){ return pdPrefs().syr; }, 100) === 100 ? 'U-100' : 'U-' + pdPrefs().syr)) + ' syringe, ' + num(mg / conc, 3) + ' mL at ' + num(conc, 2) + ' mg/mL</li>');
      if(tw) facts.push('<li><b class="c3-num">' + esc(tw) + '</b> a dose, ' + esc(num(p.tabMg, 2)) + ' mg each</li>');
      if(V.ok && x.perVial) facts.push('<li>A ' + w.one + ' is <b class="c3-num">' + x.perVial + '</b> doses at ' + esc(amt(p, mg)) + '</li>');
      if(x.newVials.length) facts.push('<li>Next ' + w.one + ' ' + esc(dayOf(x.newVials[0])) + '</li>');
      if(x.bud) facts.push('<li class="' + (x.budFirst ? 'w' : '') + '">The open ' + w.one + ' is good to <b>' + esc(dayOf(x.bud)) + '</b>' + (x.budFirst ? ', before it runs out' : '') + '</li>');
      if(V.mixAt) facts.push('<li>This ' + w.one + ' was ' + w.open + ' ' + esc(dayOf(V.mixAt)) + '</li>');
      var costs = x.priced ? yd.stats([[money(x.costDose), 'a dose'], [money(x.costWeek), 'a week'], [money(x.costMonth), 'a month'], [money(x.spent), 'spent so far']], 'pd-top pd-cost') : '';
      var ctl = '<div class="pd-hh"><span class="k">Spare ' + w.many + '</span>' + yd.btn('pspare', '', {v: p.id + '|' + Math.max(0, x.spare - 1), icon:'minus', aria:'One spare ' + w.one + ' fewer', disabled: x.spare <= 0, cls:'pd-step'}) +
        '<b class="c3-num">' + x.spare + '</b>' + yd.btn('pspare', '', {v: p.id + '|' + (x.spare + 1), icon:'plus', aria:'One spare ' + w.one + ' more', cls:'pd-step'}) + '</div>' +
        '<div class="yd-acts">' + yd.btn('pmixed', w.act, {v: p.id, icon:'refresh'}) + yd.btn('pedit', 'Supply and schedule', {v: p.id, icon:'chev'}) + '</div>' +
        yd.input('pcost', p.costUsd > 0 ? p.costUsd : '', 'Price of a ' + w.one + ' ($)', {type:'number', mode:'decimal', min:0, step:'0.01', extra:'data-pid="' + esc(p.id) + '"', k: p.id, ph:'Optional'}) +
        '<div class="pd-two">' + yd.select('plead', [[3, '3 days'], [5, '5 days'], [7, '7 days'], [10, '10 days'], [14, '14 days'], [21, '21 days']], inv.leadDays == null ? 7 : inv.leadDays, 'Order this far ahead', {extra:'data-pid="' + esc(p.id) + '"', k: p.id}) +
          yd.select('pbud', [[0, 'Not set'], [14, '14 days'], [21, '21 days'], [28, '28 days'], [30, '30 days'], [42, '42 days'], [60, '60 days']], inv.budDays > 0 ? inv.budDays : 0, 'Good for, once ' + w.open, {extra:'data-pid="' + esc(p.id) + '"', k: p.id}) + '</div>';
      return yd.sec(pdName(p) + ' · ' + amt(p, mg), head + (facts.length ? '<ul class="pd-facts">' + facts.join('') + '</ul>' : '') + costs + ctl, {id:'sup-' + p.id});
    }
    function supplyTab(ctx, M){
      var P = safe(function(){ return pdPrefs(); }, {syr:100});
      var parts = M.live.map(function(x){ return supplyOne(x, ctx.state); });
      var half = Math.ceil(parts.length / 2);
      var calc = '<div class="yd-acts pd-calc">' + yd.btn('pmath', 'Calculators: mix, water, blend, oil, nasal, supply', {icon: 'chev'}) + '</div>';   /* v328 */
      return calc + (parts.length ? '<div class="yd-cols"><div class="yd-col">' + parts.slice(0, half).join('') + '</div><div class="yd-col">' + parts.slice(half).join('') +
          (M.live.some(function(x){ return W(x.p).one === 'vial'; }) ? yd.sec('Syringe', yd.seg('psyr', [[100, 'U-100'], [50, 'U-50'], [40, 'U-40']], P.syr, {aria:'The syringe you draw with', cls:'pd-seg fill'}), {id:'syr'}) : '') +   /* v335: a syringe only matters for a vial */
          yd.note('Counted from your own log: every dose comes out of the open vial, pen or pack at the amount it was given, a spare opens when it runs dry. The use-by date is the one you set; the app does not make one up.') + '</div></div>'
        : yd.empty('Add a compound and what it comes in (a vial, a pen or pills), and the supply counts itself.'));
    }

    /* ---------- effects ---------- */
    function bars(rows, o){
      /* rows: [{w, v, n, hi}] vertical bars, value on top */
      var max = Math.max.apply(null, rows.map(function(r){ return Math.abs(r.v); }).concat([o.min || 0.0001]));
      return '<div class="pd-bars' + (o.neg ? ' neg' : '') + '" role="img" aria-label="' + esc(o.aria || '') + '">' + rows.map(function(r){
        var f = Math.abs(r.v) / max;
        return '<div class="pd-bar' + (r.hi ? ' hi' : '') + (r.v < 0 ? ' dn' : '') + '"><b class="c3-num">' + esc(r.lbl != null ? r.lbl : String(r.v)) + '</b><span class="col"><i style="height:' + Math.max(r.v ? 4 : 0, Math.round(f * 100)) + '%"></i></span><small>' + esc(r.w) + '</small></div>';
      }).join('') + '</div>';
    }
    function fxTab(ctx, M){
      var st = ctx.state, t0 = today();
      var app = safe(function(){ return appToday(); }, null), todayFx = (ALL.sx || []).filter(function(s){ return dkey(s.at) === t0; });
      var kind = st.fxk || '';
      var check = C3.rx ? C3.rx.checkin(st) : '';   /* v329: the markers they track, 57 to pick from, and their own */
      if(locked('ledger')) return '<div class="yd-cols"><div class="yd-col">' + check + '</div><div class="yd-col">' + yd.sec('Read back', yd.lock('ledger', 'Your effects, read back', {desc:'When your side effects land after a dose, at each amount, by site, and your weight and appetite at each amount, from your own log.'}), {id:'lock'}) + '</div></div>';
      var live = M.live.map(function(x){ return x.p; }), fp = st.fxp && live.some(function(p){ return p.id === st.fxp; }) ? st.fxp : null;
      var T = safe(function(){ return pdFxTiming(null, fp); }, null) || {n: 0, bins: []};
      var which = live.length > 1 && T.p ? yd.seg('pfxp', live.map(function(p){ return [p.id, pdName(p)]; }), T.p.id, {aria:'After a dose of', cls:'pd-seg fill wrap2'}) : '';
      var timing = T.n ? bars(T.bins.map(function(b){ return {w: b.w, v: b.n, hi: T.top && b === T.top && T.n >= 5}; }), {aria:'Side effects by time after a dose'}) +
          (T.n >= 5 && T.share >= 0.35 ? '<p class="pd-says"><b>' + Math.round(T.share * 100) + '%</b> of yours land <b>' + esc(T.top.w) + '</b> after a dose' + (live.length > 1 ? ' of ' + esc(pdName(T.p)) : '') + ': ' + T.top.n + ' of ' + T.n + '.</p>' : yd.note(T.n + ' logged. The pattern reads from 5.'))
        : yd.empty('Log side effects as they come and this shows when they land after a dose.');
      var B = safe(function(){ return pdFxBySteps(fp); }, null), byStep = B && B.rows.length > 1 && B.rows.some(function(r){ return r.fx; }) ? bars(B.rows.map(function(r){ return {w: amt(B.p, r.mg), v: Math.round(r.rate * 10) / 10, lbl: num(r.rate, 1), n: r.doses}; }), {aria:'Side effects per dose at each amount'}) + yd.note('Side effects per dose, at each amount of ' + esc(pdName(B.p)) + ' you logged. ' + B.rows.map(function(r){ return amt(B.p, r.mg) + ': ' + r.doses + (r.doses === 1 ? ' dose' : ' doses'); }).join(', ') + '.')
        : yd.empty(B && B.rows.length === 1 ? 'One amount so far. When it changes, this compares them.' : 'Doses and side effects at more than one amount fill this in.');
      var Wt = safe(function(){ return pdWeightBySteps(fp); }, null), wt = Wt && Wt.rows.length ? bars(Wt.rows.map(function(r){ return {w: amt(Wt.p, r.mg), v: r.perWk, lbl: (r.perWk > 0 ? '+' : '') + num(r.perWk, 1)}; }), {aria:'Weight change a week at each amount', neg:true}) + yd.note('Pounds a week while you were at each amount, from ' + Wt.rows.reduce(function(a, r){ return a + r.n; }, 0) + ' weigh-ins.')
        : yd.empty('Three weigh-ins over a week at one amount, and this shows the trend at it.');
      var Ap = safe(function(){ return pdAppetiteCycle(fp); }, null), ap = Ap && Ap.n >= 4 ? bars(Ap.rows.map(function(r){ return {w: r.d === 0 ? 'day of' : r.d === 7 ? 'day 7+' : 'day ' + r.d, v: r.v, lbl: num(r.v, 1)}; }), {aria:'Appetite by days after a dose', min: 7}) + yd.note('Average appetite, 1 to 7, by days after a dose of ' + esc(pdName(Ap.p)) + '. ' + Ap.n + ' days logged.')
        : yd.empty('Rate your appetite on a few days and this shows it across the week of a dose.');
      var Sx = (safe(function(){ return pdSites(); }, []) || []).filter(function(x){ return x.fx; });
      var bySite = Sx.length ? '<ul class="pd-facts">' + Sx.map(function(x){ return '<li><b>' + esc(x.k) + '</b>: ' + x.fx + (x.fx === 1 ? ' reaction' : ' reactions') + ' after ' + x.n + (x.n === 1 ? ' dose' : ' doses') + ' in 12 weeks</li>'; }).join('') + '</ul>' : '';
      var recent = (ALL.sx || []).slice(-8).reverse();
      return '<div class="yd-cols"><div class="yd-col">' + check +
          (which ? yd.sec('Read against', which, {id:'which'}) : '') + yd.sec('When they land', timing, {id:'timing'}) + (bySite ? yd.sec('Reactions by site', bySite, {id:'bysite'}) : '') + '</div>' +
        '<div class="yd-col">' + (C3.rx ? yd.sec('Your training week', C3.rx.align(), {id:'align'}) + yd.sec('Patterns', C3.rx.patterns(), {id:'patterns'}) : '') + yd.sec('At each amount', byStep, {id:'bystep'}) + yd.sec('Weight at each amount', wt, {id:'wt'}) + yd.sec('Appetite through the week', ap, {id:'app'}) +
          (recent.length ? yd.sec('Logged', '<ul class="pd-fxlog">' + recent.map(function(s){ return '<li><b>' + esc(s.kind || 'Side effect') + '</b><span class="c3-num">' + (s.sev | 0) + ' · ' + esc((SEV[(s.sev | 0) - 1] || [0, ''])[1]) + '</span><small>' + esc(dayOf(s.at) + ', ' + tm(s.at)) + '</small></li>'; }).join('') + '</ul>', {id:'log'}) : '') +
          yd.note('Read from your own log. A pattern here is what happened to you, not a cause, and not advice.') + '</div></div>';
    }

    yd.screen('doses', {
      parent: 'today', nav: 'stack',
      fall: function(){ C3.go('today'); },
      render: function(ctx){
        var st = ctx.state, p0 = ctx.params || {}, pk = JSON.stringify(p0);
        if(st._in !== pk){ st._in = pk; if(p0.tab) st.tab = p0.tab; if(p0.from) st.from = p0.from; if(p0.day){ st.day = p0.day; var dd = Math.round((new Date(p0.day + 'T12:00:00') - new Date(today() + 'T12:00:00')) / DAYMS); st.wk = Math.max(-1, Math.min(3, Math.floor(dd / 7))); } }
        var back = st.from === 'progress' ? 'progress' : 'today';
        var M = model(), all = safe(function(){ return pdProtos(true); }, []) || [];
        /* v333: an account on training only carries one empty protocol the app keeps for itself; Stack shows nothing for it */
        if(!safe(function(){ return typeof onPeptide !== 'function' || onPeptide(); }, true)) all = all.filter(function(p){ return !(p.id === 'p-main' && !(p.doses || []).length); });
        var tab = st.tab || 'week';
        var eyebrow = all.length ? (M && M.live.length ? M.live.length + (M.live.length === 1 ? ' compound' : ' compounds') + ' running' : 'nothing running') : 'Research log';
        /* v362: Print plan sits in the More under the tabs (Chad, 26 Oct: "cluttered") */
        var printLink = C3.screens.docs ? '<button type="button" class="c3-link pd-print" data-go="docs" data-params="' + esc(JSON.stringify({kind: 'dose', span: 'week', from: 'doses'})) + '" data-key="docs-dose">Print plan</button>' : '';   /* v347 */
        var head = yd.head({back: st.from === 'progress' ? 'progress' : null, eyebrow: 'Peptides & medications', title: '', pk: 'Track', right: ''}) + yd.note('Nothing in the app is medical advice, diagnosis or treatment. Check with your doctor before changing how you train, what you eat, or anything you take.');   /* v338: Track (Chad, 18 Oct) */
        /* v333: nothing yet: the one control is the three-step add */
        if(!M || !all.length) return '<div class="yd pd pd-first">' + head + '<section class="pd-firstgo"><p class="pd-lead"><b>Your personal log.</b> Add what you take, set when, and log each dose here. Reminders, supply and history build from it.</p>' + yd.primary('padd', 'Add a compound', '', {icon:'plus'}) +
          '<ol class="pd-firstl"><li><b>1</b><span>What you take</span></li><li><b>2</b><span>How much, how often</span></li><li><b>3</b><span>Your vial, pen or pills</span></li></ol><p class="pd-lead pd-lead2">It takes about a minute, and you can change anything later. This log records what you enter. It never suggests an amount.</p></section></div>';
        var tabs = '<div class="pd-tabs" role="tablist" aria-label="Doses">' + TABS.map(function(t){ var on = t[0] === tab;
          return '<button type="button" role="tab" class="yd-opt' + (on ? ' on' : '') + '" data-act="ptab" data-v="' + t[0] + '" data-key="ptab-' + t[0] + '" aria-selected="' + (on ? 'true' : 'false') + '">' + t[1] + '</button>'; }).join('') + '</div>';
        var body = tab === 'month' ? monthTab(ctx, M) : tab === 'levels' ? (C3.lv ? C3.lv.view(ctx, {add: true}) : '') : tab === 'sites' ? sitesTab(ctx, M) : tab === 'supply' ? supplyTab(ctx, M) : tab === 'fx' ? fxTab(ctx, M) : tab === 'labs' ? (C3.rx ? C3.rx.labs(ctx) : '') : tab === 'tl' ? (C3.rx ? C3.rx.timeline(ctx) : '') : weekTab(ctx, M);
        return '<div class="yd pd pd-' + tab + '">' + head + hero(M) + stackRows(M) + tabs + body + h.moreHTML('track', printLink) + '</div>';   /* v357: the log bar */   /* v333: the next dose and the stack first, on every tab */
      },
      wire: function(root, ctx){
        var st = ctx.state, re = function(){ C3.render(); };
        var pa = function(el){ return {pid: el.getAttribute('data-pid'), at: +el.getAttribute('data-at')}; };
        yd.wire(root, ctx, Object.assign({}, C3.cx.connectActs(ctx), C3.rx ? C3.rx.acts(ctx) : {}, {
          ptab: function(v){ st.tab = v; st.site = null; st.place = null; re(); },
          /* v328: the body map */
          pzone: function(v){ st.zone = st.zone === v ? null : v; re(); },
          pfv: function(v){ st.fv = v === 'b' ? 'b' : 'f'; st.zone = null; re(); },
          pzuse: function(v, el){ safe(function(){ pdSetSite(el.getAttribute('data-pid'), +el.getAttribute('data-at'), v); }); C3.refresh(); },
          pzheal: function(v, el){ var z = el.getAttribute('data-z'); safe(function(){ rxHeal(z, +v || 0); }); yd.toast(+v ? z + ' rests until ' + shortDay(Date.now() + (+v) * DAYMS) + '.' : z + ' is back in the rotation.'); C3.refresh(); },
          pzoff: function(v, el){ var off = (P0().siteOff || []).indexOf(v) < 0; if(safe(function(){ return pdSiteOn(v, !off); }, false) === false) yd.toast('One zone stays in the rotation.', 'bad'); C3.refresh(); },
          pzdel: function(v){ safe(function(){ rxRemoveSpot(v); }); st.zone = null; yd.toast(v + ' removed.'); C3.refresh(); },
          pplace: function(){ st.place = {step: 'tap'}; st.zone = null; re(); },
          pplacex: function(){ st.place = null; re(); },
          pspotr: function(v){ if(st.place) st.place.r = v; re(); },
          pspotok: function(){ var P = st.place; if(!P) return; var inp = root.querySelector('[data-key="in-pspotn"]'); if(inp) P.n = inp.value;
            var r = safe(function(){ return rxAddSpot(P.n, P.v, P.x, P.y, P.r || 'sc'); }, {ok: false, why: 'Could not add it.'});
            if(!r.ok){ yd.toast(r.why, 'bad'); return; } st.place = null; st.zone = r.k; yd.toast(r.k + ' added to the rotation.'); C3.refresh(); },
          pwk: function(v){ st.wk = Math.max(-1, Math.min(3, +v)); st.day = null; st.site = null; re(); },
          pday: function(v){ st.day = v; st.site = null; re(); },
          pmpick: function(v){ st.mday = (st.mday || today()) === v ? 'none' : v; st.site = null; re(); setTimeout(function(){ var el = root.querySelector('.cx-panel'); if(el){ var r = el.getBoundingClientRect(); if(r.top > window.innerHeight * 0.75 || r.top < 0) el.scrollIntoView({block:'nearest', behavior:'smooth'}); } }, 60); },
          plog: function(v, el){ var a = pa(el); safe(function(){ pdLog(a.pid, a.at); }); st.site = null; C3.refresh(); if(C3.daily) C3.daily.after('track'); },
          plogthen: function(v, el){ var a = pa(el); safe(function(){ pdLog(a.pid, a.at, {at: a.at}); }); st.site = null; C3.refresh(); if(C3.daily) C3.daily.after('track'); },   /* v372: a dose logged in the daily guide moves the day on */
          punlog: function(v, el){ var a = pa(el); safe(function(){ pdUnlog(a.pid, a.at); }); C3.refresh(); },
          pskip: function(v, el){ var a = pa(el); safe(function(){ pdSkip(a.pid, a.at); }); st.site = null; C3.refresh(); },
          punskip: function(v, el){ var a = pa(el); safe(function(){ pdUnskip(a.pid, a.at); }); C3.refresh(); },
          psite: function(v){ st.site = st.site === v ? null : v; re(); },
          psetsite: function(v, el){ var a = pa(el); safe(function(){ pdSetSite(a.pid, a.at, v); }); st.site = null; C3.refresh(); },
          psiteon: function(v, el){ var on = el.getAttribute('aria-checked') !== 'true'; if(safe(function(){ return pdSiteOn(v, on); }, false) === false) yd.toast('One site stays in the rotation.', 'bad'); C3.refresh(); },
          prest: function(v){ safe(function(){ pdSetPrefs({rest: +v}); }); C3.refresh(); },
          psyr: function(v){ safe(function(){ pdSetPrefs({syr: +v}); }); C3.refresh(); },
          pspare: function(v){ var a = String(v).split('|'); safe(function(){ pdInv(a[0], {spare: Math.max(0, +a[1] | 0)}); }); C3.refresh(); },
          pmixed: function(v){ safe(function(){ pdMixed(v); }); C3.refresh(); },
          pedit: function(v){ C3.go('protocol', {id: v, from: 'doses'}); },
          pmath: function(){ var M0 = model(); C3.go('math', {from: 'doses', pid: M0 && M0.live[0] ? M0.live[0].p.id : ''}); },
          padd: function(v, el){ if(el && el.getAttribute('data-locked')){ C3.go('protocol', {id: 'new', from: 'doses'}); return; } C3.go('addcmp', {from: 'doses'}); },
          psup: function(v, el){ var on = el.getAttribute('aria-checked') !== 'true'; safe(function(){ var R = remCfg(); R.supply = Object.assign({}, R.supply || {}, {on: on}); save(); try{ remSync(); }catch(e){} }); yd.toast(on ? 'Supply and cycle alerts on.' : 'Supply and cycle alerts off.'); C3.refresh(); },
          prem: function(v, el){ var on = el.getAttribute('aria-checked') !== 'true'; safe(function(){ var R = remCfg(); R.dose = Object.assign({}, R.dose || {}, {on: on}); save(); try{ remSync(); }catch(e){} }); yd.toast(on ? 'Dose reminders on.' : 'Dose reminders off.'); C3.refresh(); },
          papp: function(v){ safe(function(){ appSet(+v); }); try{ drawAll(); }catch(e){} yd.toast('Appetite ' + v + ' today.'); C3.refresh(); },
          pfxk: function(v){ st.fxk = st.fxk === v ? '' : v; re(); },
          pfxp: function(v){ st.fxp = v; re(); },
          pfxs: function(v){ var k = st.fxk; if(!k) return; safe(function(){ pdFx(k, +v); }); st.fxk = ''; C3.refresh(); }
        }, yd.lockActs), Object.assign(C3.rx ? C3.rx.chgs(ctx) : {}, {
          pspotn: function(v){ if(st.place) st.place.n = v; },
          pcost: function(v, el){ var p = safe(function(){ return pdProto(el.getAttribute('data-pid')); }, null); if(!p) return; var x = Math.max(0, +v || 0); p.costUsd = Math.round(x * 100) / 100; safe(function(){ pdAfterWrite(); }); C3.refresh(); },
          plead: function(v, el){ safe(function(){ pdInv(el.getAttribute('data-pid'), {leadDays: +v | 0}); }); C3.refresh(); },
          pbud: function(v, el){ safe(function(){ var inv = vialInv(pdProto(el.getAttribute('data-pid'))); pdInv(el.getAttribute('data-pid'), {budDays: +v > 0 ? +v : null, openedAt: inv.openedAt || inv.mixAt || Date.now()}); }); C3.refresh(); }
        }));
        C3.cx.wireConnect(root, ctx);
        if(C3.lv) C3.lv.wire(root, ctx);
        if(C3.rx) C3.rx.wire(root, ctx);
        /* v328: a zone is a button for the keyboard too; placing a spot of their own is a tap on the figure */
        root.querySelectorAll('g[data-act="pzone"]').forEach(function(g){ g.addEventListener('keydown', function(ev){ if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); g.dispatchEvent(new MouseEvent('click', {bubbles: true})); } }); });
        var fig = root.querySelector('.pd-fig.placing');
        if(fig) fig.addEventListener('click', function(ev){
          if(ev.target.closest && ev.target.closest('[data-act]')) return;
          var r = fig.getBoundingClientRect(), vb = fig.viewBox.baseVal, x = vb.x + (ev.clientX - r.left) * vb.width / r.width, y = vb.y + (ev.clientY - r.top) * vb.height / r.height;
          var views = fig.getAttribute('data-views') || 'f', i = Math.max(0, Math.min(views.length - 1, Math.floor(x / 500))), v = views.charAt(i), c = 250 + 500 * i;
          st.place = {step: 'name', v: v, x: Math.round((x - c) / 1000 * 1000) / 1000, y: Math.round(y / 1000 * 1000) / 1000, r: 'sc'};
          C3.render();
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
