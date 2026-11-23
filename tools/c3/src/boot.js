/* C3 boot: runs last, after every screen file has registered.
   The app's own boot is finished by now (window.__READY); if it is not, the app
   failed to start and C3 stays out of the way.
   First run (no dose ever, setup never finished): the welcome screen. Nothing
   plays by itself: no story, no setup wizard, no daily brief. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  function start(){
    if(!C3.mount()) return;
    /* a link that lands somewhere on purpose (?code= reset, ?recipe=) routes through
       showGroup a moment later and C3 follows it; everyone else starts here */
    C3.go(C3.h.firstRun() ? 'welcome' : 'today');
    /* The app's boot gate (html.booting: the body hidden behind the "formed labs" cover) is lifted
       HERE, with the first C3 screen drawn, so the old Today is never painted first. If this
       line is never reached the app's own two releases still lift it (DOMContentLoaded, 6 s). */
    try{ document.documentElement.classList.remove('booting'); }catch(e){}
    nativeLinks();
    /* back from Stripe (?paid=1, ?paid=0), or back from a sign-in that began at a Pro control:
       the plan block on You is where the answer is shown (billing.js) */
    try{ if(window.BILLING) window.BILLING.resume(); }catch(e){ console.error('[c3] billing resume', e); }
    /* coach badges and pictures come from the story manifest; when it arrives, repaint once
       (until then the app hands out a ring with initials, never a broken image) */
    try{ if(typeof storyLoad === 'function') storyLoad().then(function(){ C3.refresh(); }, function(){}); }catch(e){}
    /* The old Today hero draws a 3D vial (three.js) on every animation frame, forever,
       whether or not anyone can see it (measured: it was the whole main thread in a
       software-GL browser, 450 ms tasks back to back). The old Today is never shown
       under C3 (today/console IS the C3 today screen), so its loop is stopped here. */
    try{ window.__vialOff = true; }catch(e){}     /* both vial loops (3D and the 2D fallback) end on their next frame and cannot restart */
    try{ if(typeof V3 !== 'undefined' && V3 && V3.raf){ cancelAnimationFrame(V3.raf); V3.raf = 0; } }catch(e){}
  }

  /* NOTIFICATION TAPS AND SHELL DEEP LINKS (the iPhone app, the web worker): the app routes them
     through NATIVE_GO, written for the old screens (showGroup('today') and a sheet). Under C3
     each one lands on the C3 screen it belongs to, with the app's own sheet over it:
       open / open-today  Today              open-train   Train        open-food    Food
       open-brief         Today + the brief  open-water   Today + water
       open-weigh         Progress + weigh-in
       open-log           Today + dose (on a peptide), else Progress + weigh-in
       open-recap         Progress (this week against last week)
     v344, the reminders' own targets:
       open-water         Today + the water adjust            open-steps   Today + steps
       open-workout       the workout if it is up, else Today (Start)
       open-meal          Food, at that meal of the plan      open-checkin the check-in
       open-dose          Track, on that dose's day (Today when not on a peptide)
     A session in progress is not thrown away: with the workout up, the sheet opens over it.
     On a first run they all land on Welcome and no sheet opens (C3.go sees to the first part).
     RUN and Capacitor are not read here at all; the app reads them live where it needs them. */
  function nativeLinks(){
    var T;
    try{ T = NATIVE_GO; }catch(e){ return; }
    if(!T || T.__c3) return;
    function land(screen, sheet){
      return function(){
        var inWorkout = C3.mode === 'on' && C3.current === 'workout';
        if(!(inWorkout && sheet)) C3.go(screen);
        if(sheet && !C3.h.firstRun()) C3.sheet(typeof sheet === 'function' ? sheet() : sheet);
      };
    }
    function pep(){ try{ return !!onPeptide(); }catch(e){ return false; } }
    T['open'] = land('today');
    T['open-today'] = land('today');
    T['open-train'] = land('train');
    T['open-food'] = land('food');
    T['open-brief'] = land('today', 'brief');
    /* v344: a reminder opens the thing it is about (the banner rides along as d) */
    T['open-water'] = function(){
      var inWorkout = C3.mode === 'on' && C3.current === 'workout';
      if(!inWorkout) C3.go('today');
      if(C3.h.firstRun()) return;
      if(!C3.h.adjust('water')) C3.sheet('water');           /* the water adjust; the sheet if it cannot open */
    };
    T['open-steps'] = land('today', 'steps');
    T['open-workout'] = function(){ if(!(C3.mode === 'on' && C3.current === 'workout')) C3.go('today'); };   /* the session up, or Today with Start */
    T['open-meal'] = function(d){ d = d || {}; C3.go('food', {meal: d.meal == null ? null : +d.meal, day: d.day || null}); };
    T['open-dose'] = function(d){
      d = d || {}; if(!pep()) return land('today')();
      var day = d.day || null; if(!day && d.at){ try{ day = dkey(+d.at); }catch(e){} }
      C3.go('doses', {tab: 'week', day: day});
    };
    T['open-checkin'] = land('daily');
    T['open-weigh'] = land('progress', 'weigh');
    T['open-log'] = function(){ (pep() ? land('today', 'dose') : land('progress', 'weigh'))(); };
    T['open-recap'] = function(){ try{ RECAP.kind = 'week'; RECAP.back = 0; }catch(e){} land('progress')(); };
    /* v344: a tap that comes in with a panel up (an adjust, a coach) puts it away first, so it is not left over the new screen */
    Object.keys(T).forEach(function(k){ var f = T[k]; if(typeof f !== 'function') return;
      T[k] = function(d){ try{ if(C3.h.closeOverlay) C3.h.closeOverlay(true); }catch(e){} return f(d); }; });
    T.__c3 = 1;
  }
  if(window.__READY) start();
  else document.addEventListener('run:ready', start, {once:true});
})();
