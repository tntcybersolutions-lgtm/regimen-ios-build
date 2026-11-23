/* C3 chrome: the one bar.
   Computer (>= 1024 px): logo, Today / Train / Food / Progress, the trial line,
   "+ Log" (the app's own Log picker), You.
   Phone and tablet: logo + trial line + You in a small header; Today / Train /
   "+" / Food / Progress in a bar at the bottom.
   Over a deep (old) screen the same bar stays, fixed, with a Back control to the
   C3 screen the person came from. CSS (chrome.css) decides which pieces show. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;
  /* v333: [section, word, screen]. Chad, 18 Oct: "users cant even find our peptide tracking". The stack is a tab of its
     own (it was a section at the foot of Today and a link). On a phone the bar is Today, Stack, +, Train, Food, and
     Progress sits up top beside You; a computer's bar has all five. */
  var NAV = [['today','Today','today'], ['train','Train','train'], ['stack','Track','doses'], ['progress','Progress','progress'], ['you','You','you']];
  var TITLE = {today:'Today', train:'Train', food:'Food', progress:'Progress', you:'You', workout:'Workout', welcome:'Welcome'};
  /* wave2:youdeep start (the word on Back when a deep screen was opened from one of these) */
  TITLE.checkin = 'Check-in'; TITLE.recovery = 'Recovery'; TITLE.reminders = 'Reminders'; TITLE.settings = 'Settings';
  TITLE.doses = 'Track'; TITLE.stack = 'Track';   /* v338: Stack is called Track (Chad, 18 Oct) */
  TITLE.crew = 'Crew'; TITLE.share = 'Share'; TITLE.coaches = 'Coaches'; TITLE.report = 'Report'; TITLE.data = 'Data';
  function routeBar(){
    if(C3.mode !== 'on' || ['welcome','today','train','doses','progress','you','workout'].indexOf(C3.current)>=0) return '';
    /* Screens with a declared parent already render their own explicit yd.head Back. */
    if((C3.screens[C3.current] || {}).parent) return '';
    var name=TITLE[C3.current] || String(C3.current || '').replace(/-/g,' ');
    return '<nav class="c3-routebar" aria-label="Page navigation"><button type="button" class="c3-back" data-back aria-label="Go back">'+h.icon('back',20,2.8)+'<span>Back</span></button><span class="c3-route-name">'+esc(name)+'</span><button type="button" class="c3-route-home" data-go="today">Today</button></nav>';
  }
  /* wave2:youdeep end */

  /* v344: what happened to what they logged, from the app's own sync (SYNC, canSync). Signed in only. */
  function syncState(){
    return safe0(function(){
      if(C3.saveStatus)return C3.saveStatus();
      if(!canSync()) return null;
      if(typeof navigator !== 'undefined' && navigator.onLine === false) return {k:'off', w:'Offline. Saved on this phone.', s:'Offline'};
      if(SYNC.state === 'busy' || SYNC.pending) return {k:'busy', w:'Saving\u2026', s:'Saving'};
      if(SYNC.state === 'error') return {k:'err', w:'Couldn\u2019t sync. Trying again.', s:'Not synced'};
      if(!SYNC.at) return {k:'busy', w:'Not synced yet', s:'Not synced'};
      var tm = new Date(SYNC.at).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
      return {k:'ok', w:'Saved ' + tm, s:'Saved'};
    }, null);
  }
  function safe0(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  var SYIC = {ok:'<path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.6A4.6 4.6 0 0 0 7 18.5z"></path><path d="M9.5 13.5l2 2 3.5-3.6"></path>',
              busy:'<path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.6A4.6 4.6 0 0 0 7 18.5z"></path><path d="M9.5 14.5h.01"></path><path d="M12 14.5h.01"></path><path d="M14.5 14.5h.01"></path>',
              err:'<path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.6A4.6 4.6 0 0 0 7 18.5z"></path><path d="M12 11v3.2"></path><path d="M12 16.4h.01"></path>',
              off:'<path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.6A4.6 4.6 0 0 0 7 18.5z"></path><path d="M5 5l14 14"></path>'};
  function syncHTML(){
    var S = syncState(); if(!S) return '';
    var tr = safe0(function(){ return !!h.trial(); }, false);   /* the bar shows the trial words: the mark makes room */
    return '<button type="button" class="c3-sync ' + S.k + (tr ? ' has-trial' : '') + '" data-sync onclick="C3syncTap()" aria-label="' + esc(S.w) + '" title="' + esc(S.w) + '">' +
      '<svg class="c3-ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SYIC[S.k] + '</svg>' +
      '<span class="w">' + esc(S.w) + '</span></button>';
  }
  function receiptHTML(){var S=syncState();return S?'<button type="button" class="c3-save-receipt '+S.k+'" onclick="C3syncTap()" aria-label="'+esc(S.w)+'. Save and sync details"><span>'+esc(S.w)+'</span><small>Details</small>'+h.icon('chev',16)+'</button>':'';}
  C3.syncPaint = function(){
    try{ var r = C3.root; if(!r) return; var html = syncHTML(); r.querySelectorAll('.c3-sync').forEach(function(el){ if(html) el.outerHTML = html; else el.remove(); });r.querySelectorAll('.c3-save-receipt').forEach(function(el){el.outerHTML=receiptHTML();}); }catch(e){}
  };
  /* a tap says it in full; when it failed, it tries again now */
  window.C3syncTap = function(){
    if(C3.screens['save-status']){C3.go('save-status');return;}
    var S = syncState(); if(!S) return;
    try{ say(S.w, S.k === 'err' || S.k === 'off' ? 'bad' : ''); }catch(e){}
    if(S.k === 'err'){ try{ runSync('tap'); }catch(e){} }
  };
  C3.chrome = {
    top: function(){
      var def = C3.screens[C3.current] || {};
      if(C3.mode === 'on' && def.chrome === false) return '';
      var sec = C3.section(), deep = C3.mode === 'deep', t = h.trial();
      var signedIn = safe0(function(){ return !!(typeof CLOUD!=="undefined" && CLOUD.signedIn && CLOUD.signedIn()); }, false);
      var backTo = TITLE[C3.back] || 'Today';
      /* A first-run person over a deep screen (the sign-in form opened from Welcome) gets Back and
         nothing else: no tabs, no Log, no You, no way into an app that was never set up. */
      if(deep && C3.firstDeep()){
        return '<header class="c3-bar deep first"><div class="c3-bar-l">' +
          '<button type="button" class="c3-back" data-back aria-label="Back to Welcome">' + h.icon('back', 20, 2.8) + '<span>Back</span></button>' +
          '<span class="c3-deep-name">' + esc(C3.deepLabel()) + '</span></div></header>';
      }
      /* v362: the full product name lives in the logo's label, the page title and You; the line over every screen is gone (clutter) */
      var s = '<header class="c3-bar' + (deep ? ' deep' : '') + '">' +
        '<div class="c3-bar-l">' +
          '<button type="button" class="c3-logo" data-go="today"' + (!deep && sec === 'today' ? ' aria-current="page" aria-label="formed fit. Today"' : ' aria-label="formed fit. Go to Today"') + '>' + h.markSVG() + '<span class="c3-logo-w" aria-hidden="true">fit</span></button>' +   /* v338: the app's name beside the mark (Chad, 18 Oct) */
          (deep ? '<button type="button" class="c3-back" data-back aria-label="Back to ' + esc(backTo) + '">' + h.icon('back', 20, 2.8) + '<span>' + esc(backTo) + '</span></button>' +
                  '<span class="c3-deep-name">' + esc(C3.deepLabel()) + '</span>' : '') +
        '</div>' +
        '<nav class="c3-nav" aria-label="Main">' +
          NAV.map(function(n){ return '<button type="button" data-go="' + n[2] + '"' + (sec === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + '</button>'; }).join('') +
        '</nav>' +
        '<div class="c3-bar-r">' +
          (!safe0(function(){ return h.firstRun(); }, false) && h.strip ? safe0(function(){ return h.strip('bar'); }, '') : '') +   /* v358: the strip inside the bar on a wide screen */
          syncHTML() +
          (t ? '<span class="c3-trial"><span class="w">' + esc(t.text) + '</span><span class="n">' + esc(t.short) + '</span></span>' : '') +
          '<button type="button" class="c3-log" data-sheet="" aria-label="Log something">' + h.icon('plus', 16, 3) + '<span>Log</span></button>' +
          '<button type="button" class="c3-tools" data-go="tools"' + (sec === 'tools' ? ' aria-current="page"' : '') + ' aria-label="All tools"><svg class="c3-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 6 6"></path></svg><span>All tools</span></button>' +
          '<span class="c3-you-wrap">' +
            '<button type="button" class="c3-you" data-youmenu aria-haspopup="menu" aria-expanded="false"' + (sec === 'you' ? ' aria-current="page"' : '') + ' aria-label="You. Account menu">' +
              '<span class="c3-you-ic">' + h.icon('you', 20, 2) + '</span><span class="c3-you-t">You</span></button>' +
            '<span class="c3-you-menu" role="menu" aria-label="Account" hidden>' +
              '<button type="button" role="menuitem" data-go="you">' + h.icon('you', 18, 2) + '<span>You</span></button>' +
              (signedIn ? '<button type="button" role="menuitem" data-yousignout>' + h.icon('out', 18, 2) + '<span>Log out</span></button>' : '') +
            '</span>' +
          '</span>' +
        '</div>' +
      '</header>';
      s+=receiptHTML();
      if(!safe0(function(){ return h.firstRun(); }, false) && h.strip) s += safe0(function(){ return h.strip(); }, '');   /* v358: the progress strip (Chad, 26 Oct) */
      var active=safe0(function(){return h.today();},null);
      if(!deep && C3.current !== 'workout' && !(C3.current === 'train' && C3.trlog) && active && active.started && !active.done){   /* v359: on Train the list is the workout */
        s += '<button type="button" class="c3-resume" data-go="workout" data-params="'+esc(JSON.stringify({key:active.key,wi:active.wi,dow:active.dow}))+'"><span>Resume workout</span><b>'+active.hardDone+' / '+active.hardPlanned+' sets</b>'+h.icon('arrow',18)+'</button>';}
      return s + routeBar();
    },
    tabs: function(){
      var def = C3.screens[C3.current] || {};
      if(C3.mode === 'on' && def.chrome === false) return '';
      if(C3.mode === 'deep' && C3.firstDeep()) return '';
      var sec = C3.section();
      function tab(id, label, go){ return '<button type="button" class="c3-tab" data-go="' + (go || id) + '"' + (sec === id ? ' aria-current="page"' : '') + '>' + (id === 'coach' ? '<svg class="c3-ic" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16v12H9l-5 4z"></path></svg>' : h.icon(id, 22, 2)) + '<span>' + label + '</span></button>'; }
      /* v359 (Chad, 26 Oct: "easy and nice as Liftoff"): ONE way to log, the + in the middle of the bar, as Liftoff has it.
         It opens the app's own Log picker (food, water, weigh-in, steps, check-in, workout, dose). You is the round
         face at the top right. */
      return '<nav class="c3-tabs" aria-label="Main">' + tab('today','Today') + tab('train','Train') +
        '<div class="c3-tab-mid"><button type="button" class="c3-tab-log" data-sheet="" data-key="tab-log" aria-label="Log something">' + h.icon('plus', 30, 3) + '</button></div>' +
        tab('stack','Track','doses') + tab('progress','Progress') + '</nav>';
    }
  };

  /* the You face's account menu: You, and Log out when signed in. Log out runs the app's own
     Account-screen sign-out button (#acOut), so the sync-then-sign-out path stays the app's own. */
  function menuParts(){ return { m: C3.root && C3.root.querySelector('.c3-you-menu'), b: C3.root && C3.root.querySelector('[data-youmenu]') }; }
  function menuClose(){ var p = menuParts(); if(p.m) p.m.hidden = true; if(p.b) p.b.setAttribute('aria-expanded', 'false'); }
  C3.youMenuToggle = function(){
    var p = menuParts(); if(!p.m || !p.b) return;
    var willOpen = p.m.hidden;
    p.m.hidden = !willOpen;
    p.b.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  };
  C3.youMenuClose = menuClose;
  C3.signOutFromMenu = function(){
    menuClose();
    try{
      try{ if(typeof renderAccount === 'function') renderAccount(); }catch(e){}
      if(!document.getElementById('acOut') && typeof openYou === 'function'){ try{ openYou('youaccount', 'acctCard'); }catch(e){} }
      var tries = 0;
      var watch = function(){
        var n = 0;
        var w = setInterval(function(){
          var inn = false;
          try{ inn = !!(typeof CLOUD!=="undefined" && CLOUD.signedIn && CLOUD.signedIn()); }catch(x){}
          if(inn && ++n < 80) return;
          clearInterval(w);
          if(!inn && typeof toast === 'function') toast('Signed out. Everything you logged is still on this device.');
          try{ C3.refresh(); }catch(x){}
        }, 250);
      };
      var attempt = function(){
        var b = document.getElementById('acOut');
        if(b){ b.click(); watch(); return; }
        if(++tries < 15){ setTimeout(attempt, 200); return; }
        if(typeof toast === 'function') toast('Open You, then Account, to sign out.', 'bad');
      };
      attempt();
    }catch(e){ console.error('[c3] menu sign out', e); }
  };
  if(!C3._youMenuWired){
    C3._youMenuWired = true;
    /* any tap outside the wrap closes the menu; composedPath sees inside this (open) shadow root */
    document.addEventListener('click', function(e){
      var path = e.composedPath ? e.composedPath() : [];
      for(var i = 0; i < path.length; i++){ var n = path[i]; if(n && n.classList && n.classList.contains('c3-you-wrap')) return; }
      menuClose();
    }, true);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') menuClose(); });
  }
})();

