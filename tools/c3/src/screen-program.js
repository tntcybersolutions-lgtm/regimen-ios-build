/* C3 screen: program (v319). Replaces the old "Full plan" page (the p-train pane: 8 boxes, 1,140 words,
   227 buttons, 11,147 px tall). Chad, 17 Oct: users say the app is not as easy, clear or crisp as the top
   apps; one tap past the new screens it turned back into a wall of boxes and paragraphs.
   One screen, the numbers first, no boxes, almost no words. Everything the old page did, through the
   app's own functions:
     the numbers   weekAt(weekIndexNow()) + weekVolume()         this week's sessions, hard sets, hours
     program       trainCfg().prog = id | null; a named program sets the days; startedAt = now
                   (renderProgPicker's own write)
     built for     trainCfg().goal / days / experience / build / equipment + save()  (renderTrain's pickers;
                   equipment keeps at least one; days are the program's while one runs)
     my workouts   workouts(), workoutStart(id), openWorkout(id | null)          (renderWorkoutsCard)
     a session     startQuickWorkout(); the session sheet for one already done   (Train's "Log a session")
     stretch       ROUTINES, routineWord(), mobStart(id), mobStop(), MOBUI.run     (renderMobility)
     the gym       the app's own gym card on the old Train pane, painted by paintGeoCard() and pressed
                   as it is: on/off, check, "that is it", somewhere else, not now, forget
     say it        voiceCfg().on, the same switch as Settings
   The week itself is on Train. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe, icon = yd.icon;
    var tick = 0;

    /* Consume Escape once, before the shared parent/history listeners both see it. */
    document.addEventListener('keydown', function(ev){
      if(ev.key !== 'Escape' || ev.defaultPrevented || C3.current !== 'program' || C3.mode !== 'on') return;
      if(C3.overlay) return;
      var up = function(id){ var el = document.getElementById(id); return el && !el.hidden; };
      if(['sheet','story','onb','finder','myplan'].some(up)) return;
      var a = C3.root && C3.root.activeElement;
      if(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){ a.blur(); ev.preventDefault(); return; }
      ev.preventDefault(); C3.go('train');
    }, true);

    function T(){ return trainCfg(); }
    function model(){
      var t = T(), wi = Math.max(0, weekIndexNow()), p = progById(t.prog);
      var week = safe(function(){ return weekAt(wi); }, []) || [];
      var vol = safe(function(){ return weekVolume(week); }, {hardSets:0, minutes:0}) || {hardSets:0, minutes:0};
      var sessions = week.filter(function(d){ return d && !d.rest; }).length;
      var deload = week.some(function(d){ return d && d.deload; });
      return {t:t, wi:wi, p:p, week:week, vol:vol, sessions:sessions, deload:deload};
    }
    function hours(min){ var x = Math.round((+min || 0) / 6) / 10; return x % 1 === 0 ? String(x) : x.toFixed(1); }
    function eqWord(v){ return (EQS.filter(function(e){ return e[0] === v; })[0] || [v, v])[1]; }
    function firstSentence(s){ var m = String(s || '').match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(s || '')).trim(); }
    function cycleWord(p){ return p.cycle > 1 ? p.cycle + '-week cycle' : 'week on week'; }

    /* ---------- the program running, and the others ---------- */
    function progSec(M, ctx){
      var cur = M.t.prog || null, o = safe(function(){ return weekOpts(M.wi); }, {});
      var rows = [null].concat(PROGRAMS).map(function(p){
        var id = p ? p.id : '', on = (p ? p.id : null) === cur, open = !on && ctx.state.open === id;
        var feas = p ? safe(function(){ return progFeasible(p, o); }, {ok:true, missing:[]}) : {ok:true, missing:[]};
        var meta = p ? p.days + ' days · ' + cycleWord(p) + ' · ' + p.by : 'Your days, goal and kit · rotates weekly';
        var need = (!feas.ok && feas.missing && feas.missing.length) ? '<small class="pgm-need">Needs ' + esc(feas.missing.map(function(m){ return eqWord(m).toLowerCase(); }).join(', ')) + '</small>' : '';
        var prev = p && open ? safe(function(){ return progPreview(p, o); }, '') : '';
        return '<li class="pgm-row' + (on ? ' on' : '') + (open ? ' open' : '') + '">' +
          '<button type="button" class="pgm-main" data-act="progopen" data-v="' + esc(id) + '" data-key="prog-' + esc(id || 'gen') + '"' + (on ? ' aria-current="true"' : ' aria-expanded="' + (open ? 'true' : 'false') + '"') + '>' +
            '<span class="l"><b>' + esc(p ? p.n : 'Built for you') + '</b><small>' + esc(meta) + '</small>' + need + '</span>' +
            (on ? '<span class="pgm-on">Running</span>' : icon(open ? 'up' : 'chev', 16, 2.400)) + '</button>' +
          (open ? '<div class="pgm-open">' +
            (p ? '<p class="pgm-what">' + esc(firstSentence(p.what)) + (prev ? ' <span class="c3-num">' + esc(prev) + '</span>' : '') + '</p>'
               : '<p class="pgm-what">Rotates the lifts every week, deloads every fourth, moves the weight off your own logged sets.</p>') +
            '<button type="button" class="c3-btn-quiet pgm-run" data-act="progrun" data-v="' + esc(id) + '" data-key="run-' + esc(id || 'gen') + '">' + h.icon('play', 15, 2) + '<span>' + esc(p ? 'Run ' + p.n : 'Back to built for you') + '</span></button>' +
          '</div>' : '') +
        '</li>';
      }).join('');
      return yd.sec('Program', '<ul class="pgm-list">' + rows + '</ul>', {id:'program'});
    }

    /* ---------- who the generator builds for ---------- */
    function buildSec(M){
      var t = M.t, named = M.p;
      var eq = t.equipment || [];
      return yd.sec('Built for',
        '<div class="pgm-field"><span class="k">Goal</span>' + yd.seg('goal', GOALS, t.goal, {aria:'Goal', cls:'pgm-seg'}) + '</div>' +
        '<div class="pgm-field"><span class="k">Days a week' + (named ? '<em>' + esc(named.n) + ' sets ' + named.days + '</em>' : '') + '</span>' +
          yd.seg('days', [2, 3, 4, 5, 6].map(function(n){ return [n, String(n), n + ' days a week']; }), named ? named.days : t.days, {aria:'Training days a week', cls:'nums pgm-seg fill pgm-days' + (named ? ' off' : '')}) + '</div>' +
        '<div class="pgm-field"><span class="k">Experience</span>' + yd.seg('exp', EXPS.map(function(e){ return [e[0], e[1]]; }), t.experience, {aria:'Experience', cls:'pgm-seg'}) + '</div>' +
        '<div class="pgm-field"><span class="k">Build</span>' + yd.seg('build', BUILDS.map(function(b){ return [b[0], b[1]]; }), t.build, {aria:'Build', cls:'pgm-seg'}) + '</div>' +
        '<div class="pgm-field"><span class="k">Equipment<em class="c3-num">' + eq.length + ' of ' + EQS.length + '</em></span>' +
          '<div class="yd-seg pgm-seg pgm-eq" role="group" aria-label="Equipment you have">' + EQS.map(function(e){
            var on = eq.indexOf(e[0]) >= 0, last = on && eq.length === 1;
            return '<button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="eq" data-v="' + esc(e[0]) + '" data-key="eq-' + esc(e[0]) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (last ? ' disabled' : '') + '>' + esc(e[1]) + '</button>'; }).join('') +
          '</div></div>', {id:'build'});
    }

    /* ---------- the workouts the person built ---------- */
    function mineSec(){
      var list = safe(function(){ return workouts(); }, []) || [];
      var rows = list.map(function(w){
        var b = safe(function(){ return workoutBlocks(w); }, []) || [], est = safe(function(){ return estOfBlocks(b); }, {minutes:0}) || {minutes:0};
        var nm = w.name || 'My workout';
        return '<li class="pgm-row">' +
          '<button type="button" class="pgm-main" data-act="wkedit" data-v="' + esc(w.id) + '" data-key="wkedit-' + esc(w.id) + '" aria-label="Edit ' + esc(nm) + '">' +
            '<span class="l"><b>' + esc(nm) + '</b><small class="c3-num">' + b.length + (b.length === 1 ? ' move' : ' moves') + ' · ' + (est.minutes || 0) + ' min</small></span>' + icon('chev', 16, 2.400) + '</button>' +
          (b.length ? '<button type="button" class="c3-btn-quiet pgm-go" data-act="wkstart" data-v="' + esc(w.id) + '" data-key="wkstart-' + esc(w.id) + '" aria-label="Start ' + esc(nm) + '">' + h.icon('play', 15, 2) + '<span>Start</span></button>' : '') +
        '</li>';
      }).join('');
      return yd.sec('My workouts', (!rows ? '<p class="pgm-guide">No saved workouts yet. Build one to choose your moves, or start an empty workout and add them as you go.</p>' : '') + (rows ? '<ul class="pgm-list">' + rows + '</ul>' : '') +
        '<div class="yd-acts">' + yd.btn('wknew', 'Build one', {icon:'plus'}) + yd.btn('empty', 'Empty workout', {icon:'play'}) + yd.btn('logdone', 'Log one I did', {icon:'check'}) + '</div>',
        {id:'mine', n: list.length || null});
    }

    /* ---------- stretch: the routines, and the one running ---------- */
    function stretchSec(){
      var R = safe(function(){ return MOBUI.run; }, null);
      var run = '';
      if(R){
        var st = R.steps[R.i] || R.steps[R.steps.length - 1] || {};
        run = '<div class="pgm-now" role="status"><b class="c3-num">' + Math.min(R.i + 1, R.steps.length) + '<i>/' + R.steps.length + '</i></b>' +
          '<span class="l"><b>' + esc(st.n || '') + (st.side ? ' · ' + esc(st.side) : '') + '</b><small>' + esc(R.n) + '</small></span>' +
          '<button type="button" class="c3-btn-quiet pink pgm-go" data-act="mobstop" data-key="mobstop">' + h.icon('x', 15, 2.400) + '<span>Stop</span></button></div>';
      }
      var rows = ROUTINES.map(function(r){
        var here = R && R.id === r.id;
        return '<li class="pgm-row' + (here ? ' on' : '') + '">' +
          '<span class="pgm-main pgm-static"><span class="l"><b>' + esc(r.n) + '</b><small class="c3-num">' + esc(safe(function(){ return routineWord(r); }, (r.mins || 0) + ' min')) + '</small></span></span>' +
          (R ? '' : '<button type="button" class="c3-btn-quiet pgm-go" data-act="mob" data-v="' + esc(r.id) + '" data-key="mob-' + esc(r.id) + '" aria-label="Start ' + esc(r.n) + '">' + h.icon('play', 15, 2) + '<span>Start</span></button>') + '</li>';
      }).join('');
      return yd.sec('Stretch', run + '<ul class="pgm-list">' + rows + '</ul>', {id:'stretch'});
    }

    /* ---------- the gym it remembers, and the voice ---------- */
    function geoUI(){ return safe(function(){ return GEOUI; }, {}) || {}; }
    function moreSec(){
      var g = safe(function(){ return geoState(); }, {on:false, pins:{}}) || {on:false, pins:{}}, G = geoUI();
      var gym = safe(function(){ return activeGym(); }, null);
      var f = G.found, out = '';
      out += '<div class="yd-list">' + yd.sw('geo', !!g.on, 'Remember the gym', g.on && gym && gym.n ? gym.n + (gym.addr ? ' · ' + gym.addr : '') : 'Each session keeps the gym it was done at') + '</div>';
      if(f){
        out += '<div class="pgm-found" role="status"><span class="l"><b>' + esc(f.n || 'A gym') + '</b><small class="c3-num">' + (f.addr ? esc(f.addr) + ' · ' : '') + 'about ' + Math.round(+f.d || 0) + ' m away</small></span></div>' +
          '<div class="yd-acts">' + yd.btn('geoyes', 'That is my gym', {icon:'check'}) + ((G.cands || []).length > 1 ? yd.btn('geonext', 'Somewhere else') : '') + yd.btn('geono', 'Not now') + '</div>';
      } else if(g.on){
        out += '<div class="yd-acts">' + yd.btn('geocheck', G.busy ? 'Looking' : 'Check where I am', {disabled: !!G.busy}) + '</div>';
      }
      if(G.err) out += yd.note(esc(G.err), 'warn');
      /* the card's last word, when it still fits the switch (the app keeps it until the next press) */
      else if(G.said && !f && !/^(Looking|Set\.)/.test(G.said) && (g.on ? !/^Off\./.test(G.said) : /^Off\./.test(G.said))) out += yd.note(esc(G.said));
      var pins = Object.keys(g.pins || {}).map(function(id){ return Object.assign({id:id}, g.pins[id]); }).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
      if(pins.length) out += '<ul class="pgm-list">' + pins.map(function(p){
        return '<li class="pgm-row"><span class="pgm-main pgm-static"><span class="l"><b>' + esc(p.n || 'A gym') + '</b>' + (p.addr ? '<small>' + esc(p.addr) + '</small>' : '') + '</span></span>' +
          '<button type="button" class="c3-btn-quiet pgm-go" data-act="geoforget" data-v="' + esc(p.id) + '" data-key="geoforget-' + esc(p.id) + '" aria-label="Forget ' + esc(p.n || 'this gym') + '">' + h.icon('x', 15, 2.400) + '<span>Forget</span></button></li>'; }).join('') + '</ul>';
      /* the same switch as Settings, and the same honest line where the browser has no voice at all */
      var sayOn = safe(function(){ return !!voiceCfg().on; }, false), canSay = safe(function(){ return sayAvailable(); }, false);
      out += canSay ? '<div class="yd-list">' + yd.sw('say', sayOn, 'Say it out loud', 'Sets, weights and rest, read during a session') + '</div>'
        : yd.note('Say it out loud: this browser has no voice. Open the app in Chrome, Safari or Edge, or on your iPhone.');
      return yd.sec('Gym and voice', out, {id:'more'});
    }
    /* the app's own gym card, where the app paints it (the old Train pane), pressed as it is */
    function geoPress(sel){
      try{ paintGeoCard(); }catch(e){}
      var w = document.querySelector('#p-train > .geowrap'), b = w && w.querySelector(sel);
      if(!b){ console.error('[c3] program: the gym card has no ' + sel); return false; }
      b.click(); return true;
    }
    /* what the screen draws from state the app changes on its own clock (a stretch moving on, a gym lookup) */
    function sig(){
      var R = safe(function(){ return MOBUI.run; }, null), G = geoUI();
      return [R ? R.id + ':' + R.i : '-', G.busy ? 1 : 0, G.found ? G.found.n + (G.ci || 0) : '-', G.err || '', G.said || ''].join('|');
    }

    yd.screen('program', {
      parent: 'train', nav: 'train', old: ['train', 'train'],
      render: function(ctx){
        var M = model();
        var eye = (M.p ? M.p.n + ' · week ' + (M.p.cycle > 1 ? ((M.wi % M.p.cycle) + 1) + ' of ' + M.p.cycle : (M.wi + 1)) : 'Week ' + (M.wi + 1)) + (M.deload ? ' · deload' : '');
        var top = yd.stats([
          [String(M.sessions), M.sessions === 1 ? 'Session' : 'Sessions'],
          [String(M.vol.hardSets || 0), 'Hard sets', M.deload ? 'warn' : ''],
          [hours(M.vol.minutes), 'Hours']], 'pgm-top');
        return '<div class="yd pgm">' + yd.head({back:'train', eyebrow: eye, title:'Your', pk:'program'}) + '<p class="pgm-guide">Choose a program or adjust Built for to shape your week. Your changes save automatically. Return to Train to start a session.</p>' + top +
          '<div class="yd-cols even"><div class="yd-col">' + progSec(M, ctx) + buildSec(M) + '</div>' +
          '<div class="yd-col">' + mineSec() + stretchSec() + moreSec() + '</div></div></div>';
      },
      wire: function(root, ctx){
        var t = T();
        var after = function(msg){ try{ save(); }catch(e){} try{ drawAll(); }catch(e){} if(msg) yd.toast(msg); C3.refresh(); };
        yd.wire(root, ctx, {
          progopen: function(v){ if((v || null) === (t.prog || null)) return; ctx.state.open = ctx.state.open === v ? null : v; C3.render(); },
          progrun: function(v){
            var id = v || null, np = progById(id);
            t.prog = id; if(np) t.days = np.days; t.startedAt = Date.now(); ctx.state.open = null;
            after(np ? '<b>' + esc(np.n) + '</b> is running, week 1 starts today' : 'Back to the program built for you');
          },
          goal: function(v){ if(t.goal === v) return; t.goal = v; after(); },
          days: function(v){ if(progById(t.prog)) return; var n = Math.max(2, Math.min(6, +v | 0)); if(t.days === n) return; t.days = n; after(); },
          exp: function(v){ if(t.experience === v) return; t.experience = v; after(); },
          build: function(v){ if(t.build === v) return; t.build = v; after(); },
          eq: function(v){ var i = t.equipment.indexOf(v); if(i >= 0){ if(t.equipment.length <= 1) return; t.equipment.splice(i, 1); } else t.equipment.push(v); after(); },
          wkedit: function(v){ openWorkout(v); },
          wkstart: function(v){ workoutStart(v); },
          wknew: function(){ openWorkout(null); },
          empty: function(){ startQuickWorkout(); },
          logdone: function(){ LS.day = dkey(Date.now()); LS.items = []; LS.q = ''; openSheet('session'); },
          mob: function(v){ mobStart(v); C3.render(); },
          mobstop: function(){ mobStop(); C3.render(); },
          geo: function(){ geoPress('[data-geotoggle]'); C3.render(); },
          geocheck: function(){ geoPress('[data-geocheck]'); C3.render(); },
          geoyes: function(){ var f = geoUI().found; if(geoPress('[data-geoyes]') && f) setTimeout(function(){ var gy = safe(function(){ return activeGym(); }, null); if(gy && gy.n) yd.toast('<b>' + esc(gy.n) + '</b> is your gym now'); }, 400); C3.render(); },
          geonext: function(){ geoPress('[data-geonext]'); C3.render(); },
          geono: function(){ geoPress('[data-geono]'); C3.render(); },
          geoforget: function(v){ geoPress('[data-geoforget="' + String(v).replace(/["\\]/g, '\\$&') + '"]'); C3.render(); },
          say: function(){ var V = voiceCfg(); V.on = !V.on; save(); if(V.on){ Promise.resolve(voiceLoad()).then(function(){ speak('Cues on.', {force:true}); }); } else voiceStop(); C3.render(); }
        });
        /* a stretch moves on and a gym lookup answers on their own clocks: repaint when they do */
        if(!tick){
          var was = sig();
          tick = setInterval(function(){
            if(C3.current !== 'program' || C3.mode !== 'on'){ clearInterval(tick); tick = 0; return; }
            var now = sig(); if(now !== was){ was = now; C3.render(); }
          }, 500);
        }
      },
      leave: function(){ if(tick){ clearInterval(tick); tick = 0; } }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
