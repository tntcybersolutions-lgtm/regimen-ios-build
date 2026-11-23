/* C3 screen: today. "What do I do today?" answered without scrolling:
   the session and START, the day ring, the week.
   Training day and rest day are two layouts of the same pieces (see screen-today.css).
   Every number comes from C3.h (the app's own functions); nothing is made up. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  var watch = 0;   /* a 1 s look at the stretch routine while it runs, so the control flips back when it ends */

  /* "Lower B" -> Lower <pink>B</pink>; one word stays white */
  function title(name){
    var w = String(name || '').trim().split(/\s+/);
    if(w.length < 2) return esc(w[0] || '');
    return esc(w.slice(0, -1).join(' ')) + ' <span class="pk">' + esc(w[w.length - 1]) + '</span>';
  }
  function lenClass(name){ var n = String(name || '').length; return n <= 8 ? '' : n <= 11 ? ' len-m' : ' len-l'; }
  function cap(s){ s = String(s || ''); return s.charAt(0) + s.slice(1).toLowerCase(); }

  /* ---------- the four labels around the ring ---------- */
  /* the whole block of a number is one control (laid over it, under the quick button):
     Train opens Train, Protein opens the food list, Water and Steps open ADJUST */
  function winsStrip(){ return safe(function(){ return C3.wins ? C3.wins.stripHTML() : ''; }, ''); }
  function hit(attr, key, say){ return '<button type="button" class="td-m-hit" ' + attr + ' data-key="' + key + '" aria-label="' + esc(say) + '"></button>'; }
  function meter(key, F, T, phone){
    var bar = '<i class="td-m-bar"></i>', adj = '<span class="td-m-s adj">' + h.adjustHintHTML() + '</span>';
    if(key === 'train'){
      return '<div class="td-m train">' + hit('data-act="train"', 'm-train', 'Train today: ' + F.train.done + ' of ' + F.train.planned + ' sets. Open Train') + bar + '<span class="td-m-n">Train</span>' +
        '<span class="td-m-v"><b>' + F.train.done + '</b><span> / ' + F.train.planned + '</span></span><span class="td-m-s">sets</span></div>';
    }
    if(key === 'protein'){
      var p = F.protein, closed = p.applies && p.frac >= 1;
      return '<div class="td-m protein">' + hit('data-act="protein"', 'm-protein', 'Protein today: ' + fmt.n(p.now) + (p.target ? ' of ' + fmt.n(p.target) : '') + ' grams. Open the food list') + bar + '<span class="td-m-n">Protein</span>' +
        '<span class="td-m-v"><b>' + fmt.n(p.now) + '</b><span>' + (p.target ? ' / ' + fmt.n(p.target) : '') + ' g</span></span>' +
        (closed ? '<span class="c3-closed">' + h.icon('check', 18, 3.2) + (phone ? 'Hit' : 'Closed') + '</span>'
                : '<button type="button" class="c3-btn-quiet pink td-m-btn" data-go="food" data-key="food" aria-label="Log food. Protein so far ' + fmt.n(p.now) + ' grams">' + h.icon('plus', 16, 3) + '<span class="t">Food</span></button>') +
        '</div>';
    }
    if(key === 'water'){
      var w = F.water, wc = w.frac >= 1;
      return '<div class="td-m water">' + hit('data-adjust="water"', 'adj-water', 'Water today: ' + fmt.liters(w.now) + ' of ' + fmt.liters(w.target, 1) + ' liters. Adjust') + bar + '<span class="td-m-n">Water</span>' +
        '<span class="td-m-v"><b>' + fmt.liters(w.now) + '</b><span> / ' + fmt.liters(w.target, 1) + ' L</span></span>' + adj +
        (wc ? '<span class="c3-closed">' + h.icon('check', 18, 3.2) + (phone ? 'Hit' : 'Closed') + '</span>' : '') +
        '<button type="button" class="c3-btn-quiet num td-m-btn' + (wc ? ' bare' : '') + '" data-act="water" data-key="water" aria-label="Add 250 milliliters of water">' + h.icon('plus', 16, 3) + '<span class="t">250 mL</span></button>' +
        '</div>';
    }
    var s = F.steps;
    return '<button type="button" class="td-m steps" data-adjust="steps" data-key="steps" aria-label="Steps today: ' + fmt.n(s.now) + ' of ' + fmt.n(s.target) + '. Adjust">' + bar + '<span class="td-m-n">Steps</span>' +
      '<span class="td-m-v' + (fmt.n(s.now).length >= 7 ? ' wide' : '') + '"><b>' + fmt.n(s.now) + '</b><span> / ' + fmt.n(s.target) + '</span></span>' + adj + '</button>';
  }
  function ringSection(ctx, T, F, S){
    var compact = ctx.w < 860;
    /* v309: with the numbered steps on the screen, the ring IS the steps: one arc per step, the
       count of steps done in the middle, and no second set of labels and buttons beside it */
    if(S && S.list.length){
      var fr = function(x){ return x.k === 'train' ? (x.done ? 1 : (x.v && /^Do/.test(x.v) ? 0 : F.train.frac || 0)) : x.done ? 1 : (F[x.k] ? F[x.k].frac : 0); };
      var nDone = S.list.filter(function(x){ return x.done; }).length;
      var ringS = h.ringSVG({
        arcs: S.list.map(function(x){ return {key:x.k, frac:Math.max(0, Math.min(1, fr(x)))}; }),
        start: S.list.length === 4 ? 180 : 270, compact: compact,
        top: esc(fmt.date(T.date)), big: nDone + '/' + S.list.length, bottom: 'steps done',
        label: 'Day ring, ' + nDone + ' of ' + S.list.length + ' steps done'
      });
      return '<section class="td-ring stepped n' + S.list.length + '" aria-label="Your day">' + '<div class="td-ringbox">' + ringS + '</div></section>';
    }
    var order = F.training ? ['train', 'protein', 'water', 'steps'] : ['protein', 'water', 'steps'];
    var keys = order.filter(function(k){ return F[k].applies; });
    var ring = h.ringSVG({
      arcs: keys.map(function(k){ return {key:k, frac:F[k].frac}; }),
      start: keys.length === 4 ? 180 : 270, compact: compact,
      top: (!compact && !T.rest) ? 'Today' : esc(fmt.date(T.date)),
      big: F.pct + '%',
      bottom: compact ? 'of your day' : (F.of > 0 ? F.closed + ' of ' + F.of + ' closed' : ''),
      label: 'Day ring, ' + F.pct + ' percent. ' + keys.join(', ')
    });
    var labels = (F.training ? ['train', 'protein', 'steps', 'water'] : ['steps', 'protein', 'water']).map(function(k){ return meter(k, F, T, compact); }).join('');
    return '<section class="td-ring n' + keys.length + '" aria-label="Your day">' + '<div class="td-ringbox">' + ring + '</div>' + labels + '</section>';
  }

  /* ---------- v309: the day as numbered steps ----------
     Chad, 14 Oct 2026: "no one has a logical clue what to do". The day is the same three or four
     things every time, in the same order as the ring: train, eat, water, walk. Each step shows its
     live number and a check when it is closed; the first open one is lit and the big button under
     it does exactly that step. Every number is the ring's own (h.fractions). */
  /* v333: the dose is a step of the day. Chad, 18 Oct: "users cant even find our peptide tracking the daily tasks are
     not easy to follow". It was a section at the foot of the screen, under the moves and a picture. Now a day with a
     dose planned starts with it: DOSE, then train, eat, water, walk. The step says Due now / the time / Done, never the
     compound (training and research never share a frame); its button logs it in one tap, the site picked by the
     rotation, with Undo. A dose later in the day waits its turn: the first step lit is the first one that is time. */
  function doseToday(){
    return safe(function(){
      if(typeof pdDay !== 'function' || (typeof onPeptide === 'function' && !onPeptide()) || !(safe(function(){ return pdProtos(); }, []) || []).length) return null;
      var rows = pdDay(dkey(Date.now())) || []; if(!rows.length) return null;
      var open = rows.filter(function(r){ return !r.dose && r.status !== 'skipped' && r.status !== 'held'; }).sort(function(a, b){ return a.at - b.at; });
      var nx = open[0] || null, now = Date.now();
      return {rows: rows, nx: nx, done: !nx, ready: !!nx && nx.at <= now + 2 * 36e5, due: !!nx && nx.at <= now};
    }, null);
  }
  /* setup's yes, not added yet (ALL.ui.addFirst, set by onbFinish): step 1 is adding it, three steps, or Not now */
  function addFirst(){ return safe(function(){ return !!(ALL.ui && ALL.ui.addFirst) && !(typeof onPeptide === 'function' && onPeptide()); }, false); }
  /* v339: setup skipped or left before the body step: their plan is open, and finishing it is the first thing to do */
  function planOpen(){ return safe(function(){ return !!(ALL.ui && ALL.ui.planOpen) && !(ALL.body && ALL.body.wt > 0); }, false); }
  /* v339: they came for peptide tracking only: no training plan on Today until they ask for one */
  function trackOnly(){ return safe(function(){ return !!(ALL.ui && ALL.ui.focus === 'track' && !ALL.ui.trainOn); }, false); }
  var MARK = {plan:'plan', dose:'stack', train:'train', protein:'food', water:'drop', steps:'walk'};
  function daySteps(T, F, P){
    var list = [], D = doseToday();
    if(planOpen()) list.push({k:'plan', n:'Your plan', v:'Finish it', done:false, ready:true, act:'data-act="step" data-step="plan"', cta:'data-act="plan"'});
    if(!D && addFirst()) list.push({k:'dose', n:'Dose', v:'Add yours', done:false, ready:true, add:true, act:'data-act="step" data-step="dose-add"', cta:'data-act="dose-add"'});
    if(D) list.push({k:'dose', n:'Dose', v: D.done ? 'Done' : D.due ? 'Due now' : esc(h.clock(D.nx.at)), done: D.done, ready: D.done || D.ready, D: D, act:'data-act="step" data-step="dose"', cta:'data-act="dose"'});
    /* the steps carry their own data-act="step" so no selector meant for the ring's quick buttons
       can ever land on a step by accident; the screen's wire sends each one where it belongs */
    if(!T.rest && T.hardPlanned > 0) list.push({k:'train', n:'Train', v: T.done ? 'Done' : esc(T.name), done: !!T.done, act:'data-act="step" data-step="train"', cta:'data-act="start"'});
    else if(P) list.push({k:'train', n:'Train', v: esc(P.name), done:false, act:'data-act="step" data-step="pull" data-from="' + P.from + '"', cta:'data-act="pull" data-from="' + P.from + '"'});
    if(F.protein.applies) list.push({k:'protein', n:'Eat', v: fmt.n(F.protein.now) + '<span class="of"> / ' + fmt.n(F.protein.target) + '</span> g', done: F.protein.frac >= 1, act:'data-act="step" data-step="protein"', cta:'data-go="food"'});
    if(F.water.applies) list.push({k:'water', n:'Water', v: fmt.liters(F.water.now) + '<span class="of"> / ' + fmt.liters(F.water.target, 1) + '</span> L', done: F.water.frac >= 1, act:'data-act="step" data-step="water"', cta:'data-act="water"'});
    if(F.steps.applies) list.push({k:'steps', n:'Walk', v: fmt.n(F.steps.now) + '<span class="of"> / ' + fmt.n(F.steps.target) + '</span>', done: F.steps.frac >= 1, act:'data-act="step" data-step="steps"', cta:'data-adjust="steps"'});
    var cur = -1; list.forEach(function(x, i){ if(cur < 0 && !x.done && x.ready !== false) cur = i; });
    if(cur < 0) list.forEach(function(x, i){ if(cur < 0 && !x.done) cur = i; });
    return {list:list, cur:cur};
  }
  function stepsHTML(S){
    if(!S.list.length) return '';
    return '<nav class="td-steps n' + S.list.length + '" aria-label="Today\'s checklist">' +
      S.list.map(function(x, i){
        var state = x.done ? 'done' : i === S.cur ? 'now' : 'next';
        return '<button type="button" class="td-step ' + x.k + ' ' + state + '" ' + x.act + ' data-key="step-' + x.k + '" aria-label="' + x.n + ', ' + (x.done ? 'done' : x.v.replace(/<[^>]+>/g, '')) + '">' +
          '<span class="td-step-dot">' + (x.done ? h.icon('check', 22, 3.6) : h.icon(MARK[x.k] || 'today', 22, 2.4)) + '</span>' +   /* v339: any order, so a mark, not a number */
          '<span class="td-step-n">' + x.n + '</span><span class="td-step-v c3-num">' + x.v + '</span></button>';
      }).join('') + '</nav>';
  }
  /* the big button once training is done (or there is none): the next open step */
  function nextCTA(S, F, extra, lead){
    extra = extra || ''; lead = lead || '';
    var x = S.cur >= 0 ? S.list[S.cur] : null;
    if(!x && !S.list.length) return '<div class="td-cta">'+lead+'<p class="td-help">No daily targets are set. Choose what you want to track in your profile.</p><button type="button" class="c3-btn-primary" data-go="you">Set up my day</button>'+extra+'</div>';
    if(!x) return '<div class="td-cta">' + lead + extra + '<div class="td-done" role="status"><svg width="68" height="68" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22" fill="#5CF2B0"></circle><path d="M14.5 24.5l6.5 6.5 12.5-13.5" fill="none" stroke="#141517" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path></svg><div><div class="td-done-t">Day closed</div><div class="td-done-m">Every step is done.</div></div></div></div>';
    if(x.k === 'train') return '';
    if(x.k === 'plan'){
      return '<div class="td-cta">' + lead + '<button type="button" class="c3-btn-primary td-start td-next td-plan" data-act="plan" data-key="start" aria-label="Finish your plan: your body numbers set your targets">' +
        '<span class="l">Finish your plan</span><span class="r"><small><span>' + (trackOnly() ? '1 step' : '3 steps') + '</span><span>sets your targets</span></small>' + h.icon('arrow', 54, 3) + '</span></button>' + extra + '</div>';
    }
    if(x.k === 'dose' && x.add){
      return '<div class="td-cta">' + lead + '<button type="button" class="c3-btn-primary td-start td-next td-dose" data-act="dose-add" data-key="start" aria-label="Add your compound, three steps">' +
        '<span class="l">Add yours</span><span class="r"><small><span>3 steps</span><span>under a minute</span></small>' + h.icon('arrow', 54, 3) + '</span></button>' +
        '<div class="td-alt"><button type="button" class="c3-link" data-act="dose-later" data-key="dose-later">Not now</button></div>' + extra + '</div>';
    }
    if(x.k === 'dose'){
      var r = x.D && x.D.nx; if(!r) return '';
      var am = safe(function(){ return pdAmt(r.p, r.mg); }, ''), un = (r.inj && r.units > 0) ? fmt.n(Math.round(r.units * 10) / 10) + ' units' : r.tabs > 0 ? safe(function(){ return pdTabWord(r.tabs); }, '') : '';
      return '<div class="td-cta">' + lead + '<button type="button" class="c3-btn-primary td-start td-next td-dose" data-act="dose" data-pid="' + esc(r.pid) + '" data-at="' + r.at + '" data-key="start" aria-label="Log dose, ' + esc(am) + (r.site ? ', ' + esc(r.site) : '') + '">' +
        '<span class="l">Log dose</span><span class="r"><small><span>' + esc(am) + '</span>' + (un ? '<span>' + esc(un) + '</span>' : '') + '<span>' + esc(r.site || (x.D.due ? 'due now' : h.clock(r.at))) + '</span></small>' + h.icon('check', 54, 3) + '</span></button>' +
        '<div class="td-alt"><button type="button" class="c3-link" data-go="doses" data-key="stack">Track</button></div>' + extra + '</div>';
    }
    /* v313: the protein step logs their go-to protein in one tap; "Other food" opens Food */
    var usual = (x.k === 'protein' && nowKind !== 'refuel') ? safe(function(){ return h.learn().protein; }, null) : null;   /* the refuel strip already offers it */
    if(usual){
            return '<div class="td-cta">' + lead + '<button type="button" class="c3-btn-primary td-start td-next td-usual" data-act="now-food" data-id="' + esc(usual.id) + '" data-g="' + usual.g + '" data-key="start" aria-label="Log ' + esc(usual.n) + ', ' + fmt.n(Math.round(usual.p)) + ' grams of protein">' +
        '<span class="l">Log my usual</span><span class="r"><small><span>' + esc(usual.n) + '</span><span>+' + fmt.n(Math.round(usual.p)) + ' g protein</span></small>' + h.icon('arrow', 54, 3) + '</span></button>' +
        '<div class="td-alt"><button type="button" class="c3-link" data-go="food" data-key="other-food">Other food</button></div>' + extra + '</div>';
    }
    var label = x.k === 'protein' ? 'Log food' : x.k === 'water' ? 'Add 250 mL' : 'Log steps';
    var left = x.k === 'protein' ? fmt.n(Math.max(0, F.protein.target - F.protein.now)) + ' g protein to go'
             : x.k === 'water' ? fmt.liters(Math.max(0, F.water.target - F.water.now), 1) + ' L to go'
             : fmt.n(Math.max(0, F.steps.target - F.steps.now)) + ' steps to go';
    return '<div class="td-cta">' + lead + '<button type="button" class="c3-btn-primary td-start td-next" ' + x.cta + ' data-key="start" aria-label="' + label + ', ' + left + '">' +
      '<span class="l">' + label + '</span><span class="r"><small><span>' + x.n + '</span><span>' + left + '</span></small>' + h.icon('arrow', 54, 3) + '</span></button>' + extra + '</div>';
  }

  /* ---------- v313: NOW, the one thing this minute is for (C3.h.now) ----------
     Before anything else on the screen: the morning weigh-in for someone who weighs in the mornings
     ("That's me", one tap, the app's own weigh-in with Undo), or the refuel after a session (their
     go-to protein, one tap). Laid on the page with a hairline under it, no box. */
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  var nowKind = null;
  function nowStrip(N){
    if(!N) return '';
    var face = safe(function(){ return h.badge('nova-reyes'); }, '');
    if(N.kind === 'weigh'){
      var wv = safe(function(){ var m = /^(.*?)\s*([a-z]+)$/i.exec(wTxt(N.lb, 1)); return m ? [m[1], m[2]] : null; }, null) || [String(N.lb), 'lb'];
      return '<section class="td-now weigh" aria-label="Right now">' +
        '<div class="td-now-eye"><i></i>Right now · your morning weigh-in</div>' +
        '<div class="td-now-row"><div class="td-now-v"><b class="c3-num">' + esc(wv[0]) + '</b><span>' + esc(wv[1]) + (N.health ? ' from Health' : ' last time') + '</span></div>' +
        '<div class="td-now-go"><button type="button" class="c3-btn-primary pink td-now-btn" data-act="now-weigh" data-key="now-weigh" aria-label="Log ' + N.lb + ' pounds now">' + h.icon('check', 22, 3.2) + '<span>That\u2019s me</span></button>' +
        '<button type="button" class="c3-link" data-sheet="weigh" data-key="now-weigh-other">Different? Enter it</button></div></div></section>';
    }
    if(N.kind === 'refuel'){
      var f = N.food;
      return '<section class="td-now refuel" aria-label="Right now">' +
        '<div class="td-now-eye"><i></i>Right now · refuel' + (N.mins != null ? ', ' + (N.mins < 2 ? 'just' : N.mins + ' min') + ' after training' : '') + '</div>' +
        '<div class="td-now-row"><div class="td-now-v"><b class="c3-num">' + fmt.n(N.left) + '</b><span>g protein to go</span></div>' +
        '<div class="td-now-go">' + (face ? '<img class="td-now-face" src="' + esc(face) + '" alt="">' : '') +
        '<button type="button" class="c3-btn-primary pink td-now-btn" data-act="now-food" data-id="' + esc(f.id) + '" data-g="' + f.g + '" data-key="now-food" aria-label="Log ' + esc(f.n) + ', ' + f.g + ' grams, ' + f.p + ' grams of protein">' + h.icon('plus', 22, 3.2) + '<span>' + esc(f.n) + ' · ' + fmt.n(Math.round(f.p)) + ' g</span></button></div></div></section>';
    }
    return '';
  }

  /* ---------- the hero ---------- */
  function cta(T){
    if(T.rest){
      var W = T.warm;
      if(W && W.running) return '<div class="td-cta"><button type="button" class="c3-btn-rail" data-act="stretch-stop" data-key="start"><span>Stretch running</span><span>Stop</span></button></div>';
      /* v309: a free rest day with a session that can move here: training today is the big button,
         the stretch drops to a quiet link under it */
      var P = h.pullCandidate();
      if(P){
        return '<div class="td-cta"><button type="button" class="c3-btn-primary td-start" data-act="pull" data-from="' + P.from + '" data-key="start" aria-label="Do ' + esc(P.name) + ' today">' +
          '<span class="l">Do it today</span><span class="r"><small><span>' + esc(P.name) + '</span>' + (P.minutes ? '<span>' + P.minutes + ' min</span>' : '') + '</small>' + h.icon('arrow', 54, 3) + '</span></button>' +
          (W ? '<div class="td-alt"><button type="button" class="c3-link" data-act="stretch" data-key="stretch">Or rest: ' + W.minutes + ' min stretch</button></div>' : '') + '</div>';
      }
      if(!W) return '';
      return '<div class="td-cta"><button type="button" class="c3-btn-primary td-start" data-act="stretch" data-key="start" aria-label="Start ' + W.minutes + ' minute stretch"><span>Start ' + W.minutes + ' min stretch</span>' + h.icon('arrow', 50, 3) + '</button></div>';
    }
    if(T.done){
      return '<div class="td-cta"><div class="td-done" role="status">' +
        '<svg width="68" height="68" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22" fill="#5CF2B0"></circle><path d="M14.5 24.5l6.5 6.5 12.5-13.5" fill="none" stroke="#141517" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
        '<div><div class="td-done-t">' + esc(T.name) + ' done</div><div class="td-done-m c3-num">' + T.hardDone + ' / ' + T.hardPlanned + ' sets</div></div></div></div>';
    }
    var word = T.started ? 'Resume' : 'Start', short = String(T.name).length <= 9;
    return '<div class="td-cta"><button type="button" class="c3-btn-primary td-start" data-act="start" data-key="start" aria-label="' + word + ' ' + esc(T.name) + '">' +
      '<span class="l">' + word + (short ? '<span class="nm"> ' + esc(T.name) + '</span>' : '') + '</span>' +
      '<span class="r"><small>' + (short ? '<span>' + esc(T.name) + '</span>' : '') + '<span>' + (T.started ? T.hardDone + ' / ' + T.hardPlanned + ' sets' : T.minutes + ' min') + '</span></small>' + h.icon('arrow', 54, 3) + '</span></button>' + liveAlt() + '</div>';
  }
  /* v345: the live board for the stream, set up before the session starts */
  function liveAlt(){
    if(!C3.screens.post) return '';
    var on = false; try{ on = !!(C3.live && C3.live.on()); }catch(e){}
    return '<div class="td-alt"><button type="button" class="c3-link td-live' + (on ? ' on' : '') + '" data-go="post" data-params="' + esc(JSON.stringify({live: 1})) + '" data-key="golive">' + '<i aria-hidden="true"></i>' + (on ? 'Live board on' : 'Go live') + '</button></div>';
  }
  /* v333: on a phone the list shows the first three moves and "All 6 moves"; the session itself has every one. A
     computer has the room and shows them all. */
  function moves(T, all){
    if(T.rest || !T.rows.length) return '';
    var cap = (all || T.rows.length <= 4) ? 1e9 : 3;
    var s = '<ol class="td-moves' + (cap < 1e9 ? ' cut' : '') + '" aria-label="Today\'s moves">';
    if(T.warm) s += '<li class="w"><span class="i">W</span><span class="tx"><span class="n">Warm-up, before you lift</span><span class="d"><span class="s">' + esc(T.warm.word) + '</span></span></span></li>';
    /* each move: its name, what to do, and Watch right beside the name */
    T.rows.forEach(function(r){
      var part = r.hardDone > 0 && !r.done;
      var cl = (r.done ? 'done' : '') + (r.i >= cap ? ' x' : '');
      s += '<li' + (cl ? ' class="' + cl.trim() + '"' : '') + '><span class="i">' + (r.done ? h.icon('check', 15, 3.4) : (r.i + 1)) + '</span>' +
           '<span class="tx"><span class="n">' + esc(r.n) + '</span>' +
           '<span class="d"><span class="s">' + (part ? r.hardDone + ' of ' : '') + esc(r.setsText) + '</span>' + (r.loadTxt ? '<span class="l">' + esc(r.loadTxt) + '</span>' : '') + '</span></span>' +
           h.watchHTML(r.id, r.n, {key:'watch-m-' + r.id}) + '</li>';
    });
    if(cap < 1e9) s += '<li class="td-more"><button type="button" class="c3-link" data-act="moves-all" data-key="moves-all">All ' + T.rows.length + ' moves</button></li>';
    return s + '</ol>';
  }
  function stats(T){
    if(T.rest){
      var W = T.warm; if(!W) return '';
      return '<div class="c3-stats td-stats"><div><b>' + W.minutes + '</b><span>Min</span></div><div><b>' + W.holds + '</b><span>Holds</span></div><div><b>0</b><span>Equipment</span></div></div>';
    }
    return '<div class="c3-stats td-stats"><div><b>' + T.minutes + '</b><span>Min</span></div><div><b>' + T.moves + '</b><span>Moves</span></div><div><b>' + T.hardPlanned + '</b><span>Sets</span></div></div>';
  }

  /* ---------- the day the strip is showing ---------- */
  function stops(list, tone, more){
    var s = '<ol class="td-stops ' + tone + '">';
    list.forEach(function(p, i){
      s += '<li' + (p.warm ? ' class="w"' : '') + '><div class="top"><span class="n">' + (p.warm ? '<i></i>' : esc(p.n)) + '</span><span class="bar' + (i === list.length - 1 && !more ? ' end' : '') + '"></span></div>' +
           '<div class="txt">' + (p.g ? '<span class="g">' + esc(p.g) + '</span>' : '') + '<span class="nm">' + esc(p.name) + '</span>' +
           (p.sub ? '<span class="sub">' + esc(p.sub) + '</span>' : '') +
           (p.id ? h.watchHTML(p.id, p.name, {key:'watch-s-' + p.id}) : '') +
           (p.sets ? '<span class="dashes" aria-hidden="true">' + new Array(p.sets + 1).join('x').split('').map(function(_, k){ return '<i' + (k < p.did ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' : '') +
           '</div></li>';
    });
    if(more) s += '<li class="more"><div class="top"><span class="n">+' + more + '</span><span class="bar end"></span></div><div class="txt"><span class="nm">more</span></div></li>';
    return s + '</ol>';
  }
  function names(blocks, max){ var n = blocks.slice(0, max).map(function(b){ return b.n; }); return {list:n, ids:blocks.slice(0, max).map(function(b){ return b.id; }), more: Math.max(0, blocks.length - max)}; }
  function detail(W, T, sel){
    var d = W.days[sel]; if(!d) return '';
    var eye = d.abbr + ' ' + fmt.date(d.at).split(' ').slice(1).join(' ');
    var st = d.status, isCatch = st === 'future' && d.movedFrom != null;
    var src = st === 'moved' && d.movedTo != null ? W.days[d.movedTo] : d;           /* a moved day shows the session where it now lives */
    var blocks = src.blocks || [];
    var word, tone = 'mint', act = '', kind = st;
    var toName = W.catchTo != null ? cap(W.days[W.catchTo].abbr) : '';
    if(st === 'rest' || (!blocks.length && st !== 'today')){
      return '<div class="td-detail rest" aria-live="polite">' +
        '<div class="td-d-head"><span class="td-d-eye plain">' + esc(eye) + (d.isToday ? ' · Today' : '') + '</span><span class="td-d-name soft">Rest</span></div>' +
        '<div class="td-d-rest">' + h.icon('moon', 40, 1.8) + '<i></i><span>No session planned</span></div>' +
        '<div class="td-d-line"><b>' + esc(d.abbr.charAt(0) + d.abbr.slice(1).toLowerCase() + ' ' + d.date) + ' · Rest</b><span>No session planned</span></div></div>';
    }
    if(st === 'today'){ word = 'Today'; }
    else if(st === 'done'){ word = d.isToday ? 'Today · Done' : 'Done'; }
    else if(st === 'missed'){ word = 'Open'; tone = '';   /* v330: wins, not guilt */
      if(d.canCatchUp) act = '<button type="button" class="c3-btn-rail td-catch" data-act="catch" data-from="' + d.dow + '" data-key="catch"><span>Catch up<span class="to"> ' + esc(toName) + '</span></span>' + h.icon('arrow', 26, 2.8) + '</button>'; }
    else if(st === 'moved'){ word = 'Moved to ' + cap(W.days[d.movedTo].abbr); tone = 'coral';
      act = '<div class="td-undo"><span class="on">' + h.icon('check', 18, 3.2) + 'On ' + esc(cap(W.days[d.movedTo].abbr)) + '</span><button type="button" class="c3-btn-quiet pink bare" data-act="undo" data-dow="' + d.dow + '" data-key="undo">Undo</button></div>'; }
    else if(isCatch){ word = 'From ' + cap(W.days[d.movedFrom].abbr); tone = 'coral'; kind = 'catch';
      act = '<div class="td-undo"><span class="on">' + h.icon('check', 18, 3.2) + 'Catch-up</span><button type="button" class="c3-btn-quiet pink bare" data-act="undo" data-dow="' + d.dow + '" data-key="undo">Undo</button></div>'; }
    else if(st === 'paused'){ word = 'Paused'; }
    else if(st === 'before'){ word = 'Before you started'; }
    else { word = 'Planned'; }

    var meta = (src.minutes ? src.minutes + ' min · ' : '') + (st === 'today' || (st === 'done' && d.isToday) ? T.hardPlanned + ' sets' : blocks.length + ' moves');
    var list;
    if(d.isToday && (st === 'today' || st === 'done') && T.rows.length){
      list = (T.warm ? [{warm:true, g:'Before you lift', name:'Warm-up', sub:T.warm.word}] : []).concat(T.rows.map(function(r){ return {n:r.i + 1, id:r.id, g:r.group, name:r.n, sets:r.sets, did:Math.min(r.hardDone, r.sets)}; }));
      list = stops(list, 'mint', 0);
    }else{
      var nm = names(blocks, 5);
      list = stops(nm.list.map(function(x, i){ return {n:i + 1, id:nm.ids[i], name:x}; }), tone, nm.more);
    }
    var two = names(blocks, 2);
    return '<div class="td-detail ' + kind + (act ? ' has-act' : '') + '" aria-live="polite">' +
      '<div class="td-d-head"><span class="td-d-eye ' + tone + '"><i></i>' + esc(eye) + ' · ' + esc(word) + '</span>' +
        '<span class="td-d-name">' + esc(src.name) + '</span><span class="td-d-meta c3-num">' + esc(meta) + '</span></div>' +
      list +
      '<div class="td-d-line"><b>' + esc(cap(d.abbr) + ' ' + d.date + ' · ' + src.name + (src.minutes ? ' · ' + src.minutes + ' min' : '')) + '</b>' +
        '<span><em class="' + tone + '">' + esc(word) + '</em> ' + esc(two.list.join(', ') + (two.more ? ', +' + two.more + ' more' : '')) + '</span></div>' +
      (act ? '<div class="td-d-act">' + act + '</div>' : '') +
    '</div>';
  }

  /* ---------- the research lane: its own section, no coach in it ---------- */
  function peptide(){
    var P = h.peptide();
    /* v326: a protocol set up and nothing logged yet still has its next dose, from the dose plan */
    if(!P){
      var nx = safe(function(){ if(!onPeptide() || typeof pdModel !== 'function' || !pdProtos().length) return null; var M = pdModel(); return M.next; }, null);
      if(!nx) return '';
      var due = nx.at <= Date.now();
      return '<section class="td-pep" aria-label="Research log">' +
        '<div class="td-pep-a"><span class="c3-label nm">' + esc(pdName(nx.p)) + ' ' + esc(pdAmt(nx.p, nx.mg)) + '</span></div>' +
        '<div class="td-pep-b"><span>' + esc(safe(function(){ return pdPatternWord(nx.p); }, '')) + '</span><span>' + esc(nx.site || '') + '</span></div>' +
        '<div class="td-pep-c"><span class="truth">' + esc(due ? 'Due now' : 'First dose ' + safe(function(){ return new Date(nx.at).toLocaleDateString('en-US', {weekday:'short'}) + ' ' + new Date(nx.at).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}); }, '')) + '</span>' +
          '<button type="button" class="c3-btn-quiet pink" data-sheet="dose" data-key="dose">' + h.icon('plus', 16, 3) + '<span>Log dose</span></button>' +
          '<button type="button" class="c3-link" data-go="doses" data-key="doses">Your doses</button></div>' +
      '</section>';
    }
    var t = P.truth || {};
    return '<section class="td-pep" aria-label="Research log">' +
      '<div class="td-pep-a"><span class="c3-label nm">' + esc(P.name) + ' ' + esc(P.mgTxt) + ' mg</span><span class="c3-meter" role="img" aria-label="' + P.pct + ' percent of steady-state peak"><i style="width:' + Math.min(100, P.pct) + '%"></i></span><b class="c3-num">' + P.pct + '%</b></div>' +
      '<div class="td-pep-b"><span>' + esc(P.everyTxt) + '</span><span>of steady-state peak</span></div>' +
      '<div class="td-pep-c"><span class="truth">' + esc(t.word || '') + '</span>' +
        (t.state === 'done' ? '' : '<button type="button" class="c3-btn-quiet pink" data-sheet="dose" data-key="dose">' + h.icon('plus', 16, 3) + '<span>Log dose</span></button>') +
        '<button type="button" class="c3-link" data-go="doses" data-key="doses">Your doses</button></div>' +
    '</section>';
  }

  /* ---------- v340: today's meals, from their own plan (the meal kit, C3.mk, the same rows as Food) ----------
     Chad, 18 Oct: "I still don't see a prebuilt workout, prebuilt food plan, peptides". The 28-day plan was only on
     Food. Today now shows today's meals with Log, Half, Swap and the recipe. A planned meal is not eaten until Log. */
  /* v342: the member's own copy of the free guide, filled in from their log (the guide screen). One line, the cover, no box. */
  function guideLine(){
    if(!C3.screens.guide) return '';
    return '<button type="button" class="td-guide" data-go="guide" data-key="guide"><img src="story/scenes/plan-book-cover.webp" width="1176" height="1522" alt="" decoding="async">' +
      '<span class="t"><b>Your guide</b><span>Build Muscle. Lose Fat. Get Healthy. Every field filled in from your log.</span></span>' + h.icon('arrow', 30, 2.8) + '</button>';
  }
  function meals(ctx){
    var mk = C3.mk; if(!mk || trackOnly()) return '';
    var key = mk.today();
    if(!safe(function(){ return mpAim(key); }, null)) return '';
    var head = function(right){ return '<div class="td-meals-h"><h2 class="c3-eyebrow td-meals-t"><i></i>Today\'s meals</h2>' + (right || '') + '</div>'; };
    if(!mk.ready()){ safe(function(){ if(!MP.failed)mpLoad(); }); return '<section class="td-meals" aria-label="Today\'s meals" aria-busy="true">' + head('') + C3.journey.mealLoading('Building your meals.')+'</section>'; }
    if(!mk.day(key)) safe(function(){ mpEnsure(); });
    var D = mk.day(key); if(!D) return '';
    var t = mk.dayTot(D), all = D.off ? 0 : (D.meals || []).length, done = D.off ? 0 : (D.meals || []).filter(function(m){ return m.logged; }).length;
    var right = '<span class="td-meals-n c3-num">' + (all ? done + ' / ' + all + ' logged' : '') + '</span>' +
      '<button type="button" class="c3-link td-meals-go" data-go="food" data-key="meals-food">Food plan</button>';
    return '<section class="td-meals" aria-label="Today\'s meals">' + head(right) + mk.meals(key, ctx.state) + '</section>';
  }

  C3.screen('today', {
    nav: 'today',
    /* v330: this week's sessions on their low days go lighter, read again each visit (their log moves) */
    enter: function(){ safe(function(){ if(typeof rxAlignWeek === 'function') rxAlignWeek(); }); },
    render: function(ctx){
      if(C3.daily&&!ctx.params.full)return C3.daily.home();
      var T = h.today(), F = h.fractions(), W = h.week(), TO = trackOnly();
      /* v339: tracking only: the day is their checklist (dose, water, walk), with no session and no week of training */
      if(TO){ T = Object.assign({}, T, {rest: true, warm: null, hardPlanned: 0}); F = Object.assign({}, F, {training: false, train: Object.assign({}, F.train, {applies: false})}); }
      var sel = (ctx.state.sel != null && W.days[ctx.state.sel]) ? ctx.state.sel : T.dow;
      var P = (T.rest && !TO) ? h.pullCandidate() : null, PD = P ? W.days[P.from] : null;
      var S = daySteps(T, F, P);
      var NOW = safe(function(){ return h.now(); }, null); nowKind = NOW ? NOW.kind : null;
      var eyebrow = '<div class="c3-eyebrow td-eye"><i></i>' + esc(fmt.date(T.date)) + ' · ' + esc(TO ? 'Peptides & medications' : P ? 'Yours to do today' : T.rest ? 'Rest day' : (T.focus || 'Training')) + '</div>';
      var name = TO ? 'Today' : P ? P.name : T.rest ? 'Rest Day' : T.name;
      var head = '<div class="td-head"><p class="td-help">Your full day. Choose a task to log it, or return to the step-by-step guide.</p><button type="button" class="c3-link" data-go="today">Back to daily guide</button><h1 class="c3-h1' + lenClass(name) + '">' + title(name) + '</h1>' +
                 (T.rest && !P && !TO ? '<div class="td-when"><span>' + esc(fmt.date(T.date)) + '</span><span>No session</span></div>' : '') +
                 (P && PD ? '<div class="c3-stats td-stats"><div><b>' + (PD.minutes || 0) + '</b><span>Min</span></div><div><b>' + PD.moves + '</b><span>Moves</span></div><div><b>' + (PD.hardSets || 0) + '</b><span>Sets</span></div></div>' : stats(T)) + '</div>';
      var steps = stepsHTML(S);
      /* v330: why today is lighter (a low day in their week, or their check-in), and the watch's offer; never a compound */
      var light = '';
      if(!T.rest && !T.done && T.lighter) light = '<p class="td-light"><b>' + T.lighter + '% lighter today</b><span>' + (T.lowDay ? 'A low day in your week. Same lifts, fewer sets.' : 'Same lifts, fewer sets.') + '</span>' +
        (T.lowDay ? '<button type="button" class="c3-link" data-act="full" data-key="full">Full session</button>' : '') + '</p>';
      else if(!T.rest && !T.done){ var WO = safe(function(){ return typeof rxWearOffer === 'function' ? rxWearOffer() : null; }, null);
        if(WO) light = '<p class="td-light watch"><b>Your watch: ' + esc(WO.off.slice(0, 3).join(', ')) + '</b><span>Off your usual overnight. Yours to decide.</span><button type="button" class="c3-link" data-act="wearlight" data-key="wearlight">Go 30% lighter</button></p>'; }
      /* the big button: training while training is the open step, otherwise the next open step */
      var trainOpen = S.cur >= 0 && S.list[S.cur].k === 'train';
      var big;
      if(T.rest && !P){
        /* a plain rest day: the next open step is the big button; the stretch is a quiet extra */
        var Wm = T.warm;
        big = (Wm && Wm.running) ? cta(T) : nextCTA(S, F,
              TO ? '<div class="td-alt"><button type="button" class="c3-link" data-act="train-on" data-key="train-on">Add a training plan</button></div>'
              : Wm ? '<div class="td-alt"><button type="button" class="c3-link" data-act="stretch" data-key="stretch" aria-label="Start ' + Wm.minutes + ' minute stretch">Rest day extra: ' + Wm.minutes + ' min stretch</button></div>' : '');
      }else if(S.cur >= 0 && (S.list[S.cur].k === 'dose' || S.list[S.cur].k === 'plan')) big = nextCTA(S, F);   /* v339: Finish your plan comes before the session */
      else if(trainOpen || !T.done) big = cta(T);
      else{
        /* the finished session keeps its moment, and the next step is the button right under it */
        var doneBadge = '<div class="td-done" role="status"><svg width="68" height="68" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22" fill="#5CF2B0"></circle><path d="M14.5 24.5l6.5 6.5 12.5-13.5" fill="none" stroke="#141517" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
          '<div><div class="td-done-t">' + esc(T.name) + ' done</div><div class="td-done-m c3-num">' + T.hardDone + ' / ' + T.hardPlanned + ' sets</div>' +
          /* v331: the session's numbers under their own photos and clips */
          '<button type="button" class="c3-link td-post" data-go="post" data-params="' + esc(JSON.stringify({key: T.key})) + '" data-key="post">Post it</button></div></div>';
        big = S.cur >= 0 ? nextCTA(S, F, '', doneBadge) : nextCTA(S, F);
      }
      var coach = '<div class="td-coach">' + h.coachLineHTML('today') + '</div>';
      var pic = '<div class="td-pic">' + h.pictureHTML(P && PD ? h.sessionPhoto(PD) : T.rest ? 'dakota-stretch' : h.sessionPhoto(T.day), {eager:true}) + '</div>';
      var tag = '<div class="td-tag" aria-hidden="true"><span class="c3-tag">Earned. Not given.</span></div>';
      var week = '<section class="td-week" aria-label="The week">' + h.weekHeadHTML(W) + h.weekStripHTML(W, sel, {todayFrac:F.train.frac}) + (sel === T.dow ? '' : detail(W, T, sel)) + '</section>';   /* v317: today's moves are listed once, under START; the strip opens another day's */
      if(TO){ pic = ''; coach = ''; week = ''; tag = ''; }   /* v339: tracking only: no coach beside the dose, no training week */
      var main = T.rest
        ? '<div class="td-main"><section class="td-a" aria-label="' + (TO ? 'Today' : 'Rest day') + '">' + eyebrow + head + steps + big + pic + coach + '</section>' + ringSection(ctx, T, F, S) + '</div>'
        : '<div class="td-main"><section class="td-a" aria-label="Today\'s session">' + eyebrow + head + light + steps + big + moves(T, ctx.state.allMoves) + '</section>' + ringSection(ctx, T, F, S) +
          '<section class="td-c" aria-label="Your coach">' + pic + coach + tag + '</section></div>';
      var hasDose = S.list.some(function(x){ return x.k === 'dose'; });
      /* v340: the next dose and today's meals come before the week, so the workout, the food and the dose are one look */
      return '<div class="td ' + (T.rest ? 'rest' : 'train') + (T.done ? ' done' : '') + (NOW ? ' has-now' : '') + '">' + nowStrip(NOW) + main + winsStrip() + (TO ? '' : guideLine()) + (hasDose ? '' : peptide()) + '<nav class="td-shortcuts" aria-label="Daily tools"><button type="button" data-go="daily">Daily check-in</button><button type="button" data-go="doses">Peptide &amp; medication tracking</button><button type="button" data-go="together">Together workout</button><button type="button" data-go="tools">All tools</button></nav>' + meals(ctx) + week + (T.rest ? tag : '') + '</div>';
    },
    wire: function(root, ctx){
      if(C3.daily&&!ctx.params.full){C3.daily.wireHome(root);return;}
      root.querySelectorAll('[data-day]').forEach(function(b){ b.addEventListener('click', function(){ ctx.set({sel: +b.getAttribute('data-day')}); }); });
      /* v340: the meal rows are the meal kit's, and so are their controls */
      root.querySelectorAll('[data-chg]').forEach(function(el){ el.addEventListener('change', function(){ if(C3.mk) C3.mk.chg(el.getAttribute('data-chg'), el, ctx); }); });
      if(C3.mk) C3.mk.wireFind(root, ctx);
      root.querySelectorAll('[data-act]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-act');
          if(C3.mk && /^m(log|half|unlog|swap|use|never|lock|recipe|regen)$/.test(a) && C3.mk.act(a, b, ctx)) return;
          if(a === 'start') h.startWorkout();
          else if(a === 'stretch') h.startStretch();
          else if(a === 'stretch-stop') h.stopStretch();
          else if(a === 'water') h.addWater(250);
          else if(a === 'train') C3.go('train');
          else if(a === 'protein') C3.go('food');
          else if(a === 'catch') h.catchUp(+b.getAttribute('data-from'));
          else if(a === 'pull'){ var r = h.pullToday(+b.getAttribute('data-from')); if(r && r.ok) C3.refresh(); }
          else if(a === 'dose-add') C3.go('addcmp', {from: 'today'});
          else if(a === 'plan') safe(function(){ openFinishPlan(); });
          else if(a === 'train-on'){ safe(function(){ ALL.ui = Object.assign({}, ALL.ui || {}, {trainOn: Date.now()}); save(); }); C3.go('train'); }
          else if(a === 'dose-later'){ safe(function(){ delete ALL.ui.addFirst; save(); }); C3.refresh(); }
          else if(a === 'dose'){ var pid = b.getAttribute('data-pid'), at = +b.getAttribute('data-at'); if(pid){ safe(function(){ pdLog(pid, at); }); C3.refresh(); } }
          else if(a === 'step'){
            var k = b.getAttribute('data-step');
            if(k === 'plan') safe(function(){ openFinishPlan(); });
            else if(k === 'dose') C3.go('doses');
            else if(k === 'dose-add') C3.go('addcmp', {from: 'today'});
            else if(k === 'train') h.startWorkout();
            else if(k === 'pull'){ var r3 = h.pullToday(+b.getAttribute('data-from')); if(r3 && r3.ok) C3.refresh(); }
            else if(k === 'protein') C3.go('food');
            else if(k === 'water') h.addWater(250);
            else if(k === 'steps') h.adjust('steps', b);
          }
          else if(a === 'undo') h.undoCatchUp(+b.getAttribute('data-dow'));
          else if(a === 'moves-all') ctx.set({allMoves: 1});
          else if(a === 'now-weigh'){ if(h.weighAgain()) C3.refresh(); }
          else if(a === 'full'){ safe(function(){ rxAlignFull(new Date().getDay()); drawAll(); }); C3.refresh(); }
          else if(a === 'wearlight'){ safe(function(){ rxWearLighter(); drawAll(); }); C3.refresh(); }
          else if(a === 'now-food'){ if(h.logFood(b.getAttribute('data-id'), +b.getAttribute('data-g'))) C3.refresh(); }
        });
      });
      var W = h.warmup();
      if(W && W.running && !watch){
        watch = setInterval(function(){ var w = h.warmup(); if(!w || !w.running){ clearInterval(watch); watch = 0; C3.refresh(); } }, 1000);
      }
    },
    leave: function(){ if(watch){ clearInterval(watch); watch = 0; } }
  });
})();
