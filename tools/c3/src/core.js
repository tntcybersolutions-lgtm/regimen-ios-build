/* C3 core: the host, the router, the screen registry, the repaint.
   One global, window.C3. Everything it draws is inside the open shadow root of
   <div id="c3">, so none of the app's 715 KB of global CSS reaches it and none
   of the app's observers see it.

   Reads the app only through its own globals at call time (ALL, S, curGroup,
   curPane, showGroup, drawAll, openSheet, closeSheet). Never caches ALL or S. */
(function(){
  'use strict';
  if(window.C3) return;

  var C3 = window.C3 = {
    version: 1,
    screens: {},        /* name -> definition */
    current: null,      /* the C3 screen that is (or was last) on screen */
    params: {},
    mode: 'off',        /* 'off' | 'on' (a C3 screen) | 'deep' (an old screen under the C3 bar) */
    back: 'today',      /* where Back goes from a deep screen */
    h: {},              /* helpers, filled by helpers.js */
    chrome: null,       /* filled by chrome.js */
    root: null,         /* the shadow root */
    mounted: false
  };

  var host = null, root = null, elWrap = null, elTop = null, elScreen = null, elTabs = null;
  var state = {};            /* per-screen UI state, kept across repaints, reset on arrival */
  var lastHtml = null, lastTop = null, lastTabs = null, raf = 0, busy = 0;
  var extraCss = {};         /* css handed in through C3.screen(name, {css}) */

  /* One screen history shared by web Back, native Back and the visible Back bar.
     Temporary panels keep their own entries, carrying this route underneath. */
  var navId = 0, navActive = null, navQueued = null, navReplay = false, navEntries = {};
  var navSession = String(Date.now()) + '-';
  function navCopy(v){ try{ return JSON.parse(JSON.stringify(v || {})); }catch(e){ return {}; } }
  function navRemember(){
    if(!navActive || navReplay) return;
    navActive.y = window.scrollY || 0;
    navActive.ui = state[C3.current];
  }
  function navSnapshot(){
    var n = {id:navSession + (++navId), mode:C3.mode, name:C3.current, params:navCopy(C3.params), back:C3.back, y:0,
      parent:navActive && navActive.id, ui:state[C3.current]};
    try{ if(C3.mode === 'deep'){ n.group = curGroup; n.pane = curPane; } }catch(e){}
    return n;
  }
  function navSame(a,b){ return !!(a && b && a.mode === b.mode && a.name === b.name && a.group === b.group && a.pane === b.pane && JSON.stringify(a.params) === JSON.stringify(b.params)); }
  function navFlush(){
    if(!navQueued || C3.nav.backing) return;
    var hs = history.state || {};
    /* Drain a closed panel before pushing the next screen. Otherwise Back lands
       on its dead history entry and needs a second swipe. */
    if(hs.flExit || hs.c3ov){ C3.nav.backing = true; history.back(); return; }
    var n = navQueued; navQueued = null;
    try{
      var value = {c3route:{id:n.id,mode:n.mode,name:n.name,params:n.params,back:n.back,group:n.group,pane:n.pane,parent:n.parent}};
      if(!navActive || navSame(navActive,n)){
        if(navActive){ n.id = navActive.id; n.parent = navActive.parent; value.c3route.id=n.id;value.c3route.parent=n.parent; }
        history.replaceState(value,'');
      }else history.pushState(value,'');
    }catch(e){}
    navActive = n; navEntries[n.id] = n;
    paintChrome();
  }
  function navCommit(){ if(navReplay || C3.mode === 'off') return; navQueued = navSnapshot(); navFlush(); }
  function navParent(){
    if(navActive && navEntries[navActive.parent]) return navEntries[navActive.parent].name;
    var d = C3.screens[C3.current] || {};
    if(C3.mode === 'deep') return C3.back || 'today';
    return d.parent || ({stack:'doses',you:'you',train:'train',progress:'progress',food:'food'}[d.nav]) || 'today';
  }
  C3.nav = {backing:false, parent:navParent, remember:navRemember};
  function navPop(){
    C3.nav.backing = false;
    if(navQueued){ navFlush(); return; }
    var route = history.state && history.state.c3route;
    if(!route || (navActive && route.id === navActive.id)) return;
    var n = navEntries[route.id] || route;
    navRemember(); navReplay = true;
    try{
      if(n.mode === 'deep'){
        C3.back = n.back || 'today'; window.showGroup(n.group,n.pane);
      }else{
        C3.go(n.name,n.params);
        if(n.ui){ state[n.name]=n.ui; C3.render(true); }
      }
      navActive=n;navEntries[n.id]=n;paintChrome();
      requestAnimationFrame(function(){ window.scrollTo(0,n.y || 0); });
    }finally{ navReplay=false; }
  }

  function $(id){ return document.getElementById(id); }
  function warn(){ try{ console.warn.apply(console, ['[c3]'].concat([].slice.call(arguments))); }catch(e){} }

  /* ---------- registry ---------- */
  /* C3.screen(name, {
       render(ctx) -> html string            (required unless enter() always redirects)
       wire(root, ctx)                       called after every paint that changed the DOM
       css                                   optional extra css text for the shadow root
       enter(ctx)                            runs before the screen is shown; return false to cancel
                                             (a screen that only forwards somewhere else does this)
       leave()                               runs when another screen replaces this one
       hold(ctx) -> bool                     return true to skip a repaint that the app asked for
                                             (drawAll); C3.render() still paints
       chrome: false                         full-screen: no bar, no tabs (welcome, workout)
       nav: 'train'                          which nav item lights up (default: the screen name)
     }) */
  C3.screen = function(name, def){
    if(!name || !def){ warn('screen() needs a name and a definition'); return; }
    C3.screens[name] = def;
    if(def.css){ extraCss[name] = String(def.css); if(C3.mounted) paintCss(); }
    if(C3.mounted && C3.mode === 'on' && C3.current === name) C3.render(true);
  };

  /* ---------- the host ---------- */
  function paintCss(){
    var st = root.getElementById('c3css'); if(!st) return;
    var add = ''; Object.keys(extraCss).sort().forEach(function(k){ add += '\n/* ---- ' + k + ' (inline) ---- */\n' + extraCss[k]; });
    st.textContent = (window.C3_CSS || '') + add;
  }
  function build(){
    host = $('c3');
    if(!host){ host = document.createElement('div'); host.id = 'c3'; document.body.appendChild(host); }
    root = C3.root = host.shadowRoot || host.attachShadow({mode:'open'});
    root.innerHTML = '<style id="c3css"></style>' +
      '<div class="c3" data-mode="off">' +
        '<div class="c3-top" id="c3top"></div>' +
        '<main class="c3-screen" id="c3screen" tabindex="-1"></main>' +
        '<div class="c3-tabs-host" id="c3tabs"></div>' +
      '</div>';
    paintCss();
    elWrap = root.querySelector('.c3'); elTop = root.getElementById('c3top');
    elScreen = root.getElementById('c3screen'); elTabs = root.getElementById('c3tabs');
    /* v368: a deep (old) screen starts under the fixed C3 bar. On a phone the bar is two rows (Back, and the streak
       strip) and 102 px tall, and the old shell's room for it was 60 px, so the top 42 px of every deep page stood
       under the strip. The bar's real bottom edge is measured and handed to the page (c3global.css). */
    try{
      var topEdge = function(){ try{ var b = elTop.getBoundingClientRect().bottom; if(b > 0) document.documentElement.style.setProperty('--c3-top-b', (Math.ceil(b) + 1) + 'px'); }catch(e){} };
      if(window.ResizeObserver) new ResizeObserver(topEdge).observe(elTop);
      window.addEventListener('resize', topEdge); topEdge();
    }catch(e){}
    elWrap.addEventListener('click', onClick);
    /* v336: the app's translator walks the page and never enters this root, so a language other than English
       never reached a C3 screen. Every change in here is translated before it is painted (a microtask). */
    try{
      var tr = function(){ try{ if(typeof lang === 'function' && lang() !== 'en' && typeof translateDOM === 'function') translateDOM(root); }catch(e){} };
      new MutationObserver(tr).observe(root, {childList: true, subtree: true, characterData: true});
    }catch(e){}
  }

  /* declarative actions, so most screens need no wiring for navigation:
       data-go="food"                      C3.go('food')       (data-params='{"k":1}' optional)
       data-deep="progress:body"           the old screen, under the C3 bar
       data-sheet="steps"                  the app's own sheet (data-sheet="" is the Log picker)
       data-coach="nova-reyes"             that coach's chat sheet
       data-back                           back from a deep screen */
  function onClick(e){
    /* v362: a screen's "More": its quieter links folded behind one control; open or shut, it stays that way across
       repaints (C3.moreOpen, by key) */
    var mt = e.target && e.target.closest ? e.target.closest('[data-more]') : null;
    if(mt){
      e.preventDefault();
      C3.moreOpen = C3.moreOpen || {};
      var mk = mt.getAttribute('data-more'), on = !C3.moreOpen[mk]; C3.moreOpen[mk] = on;
      var mp = mt.parentElement && mt.parentElement.querySelector('.c3-more-p');
      if(mp) mp.hidden = !on;
      mt.setAttribute('aria-expanded', on ? 'true' : 'false');
      return;
    }
    var ym = e.target && e.target.closest ? e.target.closest('[data-youmenu]') : null;
    if(ym){ e.preventDefault(); if(C3.youMenuToggle) C3.youMenuToggle(); return; }
    var yso = e.target && e.target.closest ? e.target.closest('[data-yousignout]') : null;
    if(yso){ e.preventDefault(); if(C3.youMenuClose) C3.youMenuClose(); if(C3.signOutFromMenu) C3.signOutFromMenu(); return; }
    var t = e.target && e.target.closest ? e.target.closest('[data-go],[data-deep],[data-sheet],[data-coach],[data-back]') : null;
    if(!t || t.disabled) return;
    if(t.hasAttribute('data-go')){
      var p = null; try{ p = t.getAttribute('data-params') ? JSON.parse(t.getAttribute('data-params')) : null; }catch(x){}
      e.preventDefault(); C3.go(t.getAttribute('data-go'), p); return;
    }
    if(t.hasAttribute('data-deep')){ var d = t.getAttribute('data-deep').split(':'); e.preventDefault(); C3.deep(d[0], d[1] || undefined); return; }
    if(t.hasAttribute('data-coach')){ e.preventDefault(); C3.sheet('coach', {coach: t.getAttribute('data-coach')}); return; }
    if(t.hasAttribute('data-sheet')){ e.preventDefault(); C3.sheet(t.getAttribute('data-sheet') || null); return; }
    if(t.hasAttribute('data-back')){ e.preventDefault(); C3.goBack(); return; }
  }

  /* ---------- modes ---------- */
  function setMode(m, def){
    C3.mode = m;
    var cl = document.documentElement.classList;
    cl.toggle('c3-on', m === 'on'); cl.toggle('c3-deep', m === 'deep');
    cl.toggle('c3-bare', m === 'on' && !!def && def.chrome === false);
    cl.toggle('c3-workout', m === 'on' && C3.current === 'workout');      /* the app's toast moves to the top there (c3global.css) */
    if(elWrap){
      elWrap.setAttribute('data-mode', m);
      elWrap.setAttribute('data-screen', m === 'on' ? (C3.current || '') : '');
      elWrap.classList.toggle('bare', m === 'on' && !!def && def.chrome === false);
    }
  }
  function ctxFor(name){
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    return {
      name: name, params: C3.params || {}, state: state[name] || (state[name] = {}), h: C3.h,
      w: w, phone: w < 700, tablet: w >= 700 && w < 1024, desktop: w >= 1024,
      root: elScreen,
      /* merge into this screen's UI state and repaint */
      set: function(patch){ var s = state[name] || (state[name] = {}); for(var k in patch) s[k] = patch[k]; if(C3.current === name) C3.render(); },
      render: function(){ if(C3.current === name) C3.render(); }
    };
  }

  /* a deep screen opened by someone who has never set the app up (h.firstRun) */
  C3.firstDeep = function(){ try{ return C3.mode === 'deep' && !!(C3.h.firstRun && C3.h.firstRun()); }catch(e){ return false; } };

  /* ---------- paint ---------- */
  function paintChrome(){
    if(!C3.chrome || !elTop) return;
    try{ document.documentElement.classList.toggle('c3-first', C3.firstDeep()); }catch(e){}
    var t = '', b = '';
    try{ t = C3.chrome.top() || ''; b = C3.chrome.tabs() || ''; }catch(e){ console.error('[c3] chrome', e); }
    if(t !== lastTop){ elTop.innerHTML = t; lastTop = t; }
    if(b !== lastTabs){ elTabs.innerHTML = b; lastTabs = b; }
  }
  var painting=false,repaintAfter=false;
  function paint(force){
    if(painting){repaintAfter=true;return;}
    painting=true;
    try{paintNow(force);}finally{painting=false;if(repaintAfter){repaintAfter=false;C3.refresh();}}
  }
  function paintNow(force){
    if(!C3.mounted) return;
    paintChrome();
    if(C3.mode !== 'on') return;
    var name = C3.current, def = C3.screens[name]; if(!def || !def.render) return;
    var ctx = ctxFor(name), html;
    try{ html = def.render(ctx); }
    catch(e){ console.error('[c3] ' + name + '.render', e); html = '<p class="c3-fail">This screen could not be drawn. Your log is safe.</p>'; }
    if(typeof html !== 'string') html = '';
    if(C3.daily)html=C3.daily.rail(name)+html;
    if(!force && html === lastHtml) return;
    /* keep the keyboard where it was: an element with data-key (or an id) gets focus back */
    var keep = null,keepSelection=null;
    try{ var a = root.activeElement; if(a && elScreen.contains(a)){keep = a.getAttribute('data-key') ? '[data-key="' + a.getAttribute('data-key') + '"]' : (a.id ? '#' + a.id : null);if(typeof a.selectionStart==='number')keepSelection=[a.selectionStart,a.selectionEnd];} }catch(e){}
    elScreen.innerHTML = html; lastHtml = html;
    try{ if(def.wire) def.wire(elScreen, ctx); }catch(e){ console.error('[c3] ' + name + '.wire', e); }
    if(C3.daily)C3.daily.wireRail(elScreen);
    if(C3.journey)C3.journey.attach(elScreen,name,ctx);
    if(keep){ try{ var n = elScreen.querySelector(keep); if(n){n.focus({preventScroll:true});if(keepSelection&&n.setSelectionRange)n.setSelectionRange(keepSelection[0],keepSelection[1]);} }catch(e){} }
  }
  /* paint now. C3.render(true) repaints even when the markup is unchanged. */
  C3.render = function(force){ if(raf){ cancelAnimationFrame(raf); raf = 0; } paint(!!force); };
  /* the app repainted (drawAll): repaint the C3 screen once this frame, unless it holds */
  C3.refresh = function(){
    if(!C3.mounted || C3.mode === 'off' || raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      /* Welcome -> "I have an account" -> signed in, and the account came down from the cloud
         (the app adopted its state): this is a set-up person now, so they land on Today. */
      if(C3.mode === 'deep' && C3.back === 'welcome' && !(C3.h.firstRun && C3.h.firstRun())){ C3.back = 'today'; C3.go('today'); return; }
      if(C3.mode === 'on'){
        if(root.querySelector('.dj-help[open]')){paintChrome();return;}
        var def = C3.screens[C3.current];
        try{ if(def && def.hold && def.hold(ctxFor(C3.current))){ paintChrome(); return; } }catch(e){}
      }
      paint(false);
    });
  };

  /* ---------- the router ---------- */
  C3.go = function(name, params){
    if(!C3.mounted){ warn('go() before mount'); return false; }
    if(C3.journey&&C3.journey.flushDrafts)C3.journey.flushDrafts();
    /* someone who has never set the app up has one screen: Welcome. Whatever asked (a tab, a
       notification, a link), nobody walks into an app with no plan in it. */
    if(name !== 'welcome' && C3.screens.welcome && C3.screens.welcome.render && C3.h.firstRun && C3.h.firstRun()){ name = 'welcome'; params = null; }
    var def = C3.screens[name];
    if(!def){ warn('no screen named', name); return false; }
    navRemember();
    var prev = C3.current, prevMode = C3.mode;
    /* moving somewhere else puts the open sheet away, the way the app's own router does */
    if(name !== prev || prevMode !== 'on'){ try{ var sh = $('sheet'); if(sh && !sh.hidden && typeof closeSheet === 'function') closeSheet(); }catch(e){} }
    var savedParams = C3.params; C3.params = params || {};
    if(def.enter){
      var ok; busy++;
      try{ ok = def.enter(ctxFor(name)); }catch(e){ console.error('[c3] ' + name + '.enter', e); ok = false; }
      busy--;
      if(ok === false){ C3.params = savedParams; return false; }
    }
    if(!def.render){ C3.params = savedParams; return false; }
    if(prev && prev !== name){ var pd = C3.screens[prev]; try{ if(pd && pd.leave) pd.leave(); }catch(e){} }
    /* v346.4: the full-screen workout keeps its messages under its top row; a message raised on the screen before it
       ("Upper Body 1 is now on Sunday. Undo" from Do it today) sat over the set count, the rest time and the muscle
       for its last seconds. Starting the workout puts it away. */
    if(name === 'workout' && prev !== 'workout'){ try{ var tt = document.getElementById('toast'); if(tt) tt.classList.remove('on'); }catch(e){} }
    if(prev !== name || prevMode !== 'on') state[name] = {};
    park();
    C3.current = name;
    setMode('on', def);
    lastHtml = null;
    C3.render(true);
    try{ window.scrollTo(0, 0); }catch(e){}
    try{ if(prev !== name || prevMode !== 'on') elScreen.focus({preventScroll:true}); }catch(e){}
    navCommit();
    return true;
  };
  /* While a C3 screen is up the old shell is parked on its own Today (hidden). Two reasons.
     1. The app stops whatever a screen was running when that screen is left (drawAll: the
        photo camera and timelapse, the charts of the pane): left "showing" behind C3, a deep
        screen kept running after Back.
     2. The app's router compares against where the old shell is. Parked, "showGroup(curGroup)"
        (the app re-showing itself after a restore or a print) always means Today, and a call
        to another group always means navigation. */
  var show0 = null;
  function park(){
    try{
      if(!show0) return;
      if(curGroup === 'today' && curPane === 'console') return;
      busy++;
      try{ show0('today', 'console'); }finally{ busy--; }
    }catch(e){ console.error('[c3] park', e); }
  }
  /* the C3 screen that stands for a whole group of the old app */
  var GROUP_SCREEN = {today:'today', train:'train', progress:'progress', profile:'you'};
  var GROUP_ALIAS = {plan:'train', crew:'profile'};

  /* an old screen, shown under the C3 bar with Back */
  C3.deep = function(group, pane){
    try{ window.showGroup(group, pane); }catch(e){ console.error('[c3] deep', e); }
  };
  C3.goBack = function(){
    if(C3.nav.backing) return;
    try{ if(C3.root && C3.root.querySelector('.c3-ov:not([hidden])')){ if(C3.h.closeOverlay) C3.h.closeOverlay(); return; } }catch(e){}
    if(C3.dismiss && C3.dismiss.close()) return;
    if(navActive && navActive.parent){ C3.nav.backing=true; history.back(); return; }
    var p=navParent(); C3.go(p === C3.current ? 'today' : p);
  };
  /* the app's own sheets work over C3: C3.sheet('steps'), C3.sheet('coach', {coach:id}), C3.sheet(null) = Log picker */
  C3.sheet = function(kind, preset){
    try{ if(preset) window.openSheet(kind, preset); else window.openSheet(kind == null ? null : kind); }catch(e){ console.error('[c3] sheet', e); }
  };
  /* which nav item is lit: 'today' | 'train' | 'food' | 'progress' | 'you' | '' */
  C3.section = function(){
    if(C3.mode === 'on'){ var d = C3.screens[C3.current] || {}; return d.nav != null ? d.nav : (C3.current || ''); }
    if(C3.mode === 'deep'){
      var g = '', p = ''; try{ g = curGroup; p = curPane; }catch(e){}
      if(g === 'train') return 'train';
      if(g === 'peptides') return 'stack';
      if(g === 'progress') return 'progress';
      if(g === 'profile') return 'you';
      if(g === 'today') return p === 'food' ? 'food' : 'today';
    }
    return '';
  };
  /* the label of the deep screen that is up, from the app's own nav table */
  C3.deepLabel = function(){
    try{ var m = (GROUPS[curGroup] || []).filter(function(x){ return x[0] === curPane; })[0]; return m ? m[1] : ''; }catch(e){ return ''; }
  };

  function enterDeep(){
    if(C3.mode === 'on' && C3.current && C3.screens[C3.current] && C3.screens[C3.current].render){
      C3.back = C3.current;
      var pd = C3.screens[C3.current]; try{ if(pd.leave) pd.leave(); }catch(e){}
    }
    setMode('deep');
    if(elScreen){ elScreen.innerHTML = ''; lastHtml = null; }
    paintChrome();
  }

  /* ---------- mount: called once by boot.js, after every screen file has registered ---------- */
  C3.mount = function(){
    if(C3.mounted) return true;
    if(document.body.classList.contains('sharing')) return false;      /* a shared record is not the app */
    if(typeof window.showGroup !== 'function' || typeof window.drawAll !== 'function'){ warn('the app did not boot; C3 stays out'); return false; }
    build();
    C3.mounted = true;
    try{ history.scrollRestoration='manual'; }catch(e){}
    window.addEventListener('popstate',function(){
      /* The panel listeners run first; a route is restored after they close it. */
      queueMicrotask(navPop);
    });
    /* Escape follows the same path when no temporary panel consumes it. */
    document.addEventListener('keydown',function(e){
      if(e.key !== 'Escape' || e.defaultPrevented || C3.mode === 'off') return;
      var target=e.composedPath ? e.composedPath()[0] : e.target;
      if(target && target.matches && target.matches('input,textarea,select,[contenteditable]')) return;
      queueMicrotask(function(){ if(!e.defaultPrevented && navActive && navActive.parent) C3.goBack(); });
    });
    try{
      var app = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if(app && app.addListener) app.addListener('backButton',function(){ C3.goBack(); });
    }catch(e){}

    /* the app repaints -> the C3 screen repaints (same frame, once) */
    var draw0 = window.drawAll;
    window.drawAll = function(){ var r = draw0.apply(this, arguments); try{ C3.refresh(); }catch(e){} return r; };

    /* Not every change repaints the app (a set ticked inside the session sheet saves and
       redraws only the sheet). Every change does call save(), that is the app's contract,
       so save() is the second signal: the C3 screen repaints once, next frame, and only
       if its markup actually changed. */
    if(typeof window.save === 'function'){
      var save0 = window.save;
      window.save = function(){ var r = save0.apply(this, arguments); try{ C3.refresh(); }catch(e){} return r; };
    }
    /* coming back to the tab (possibly on a new day) repaints too */
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) C3.refresh(); });

    /* the app routes -> C3 follows. Today (the old console) IS the C3 today
       screen; every other old screen is a deep screen under the C3 bar. */
    show0 = window.showGroup;
    window.showGroup = function(g, paneId){
      if(!busy) navRemember();
      var bg = '', bp = ''; try{ bg = curGroup; bp = curPane; }catch(e){}
      var nargs = arguments.length;
      /* the app sends someone to a whole area ("Train", "You") without naming a screen: that
         area's C3 screen. (Naming a screen, showGroup('train','history'), is a deep screen.) */
      if(nargs < 2 && !busy && C3.mode !== 'off' && !document.body.classList.contains('sharing')){
        var gg = GROUP_ALIAS[g] || g, scr = GROUP_SCREEN[gg];
        if(scr && gg !== bg && C3.screens[scr] && C3.screens[scr].render){ C3.go(scr); return; }
      }
      var r = show0.apply(this, arguments);
      try{
        if(document.body.classList.contains('sharing')) return r;
        var cg = '', cp = ''; try{ cg = curGroup; cp = curPane; }catch(e){}
        /* showGroup(curGroup) with no pane is the app re-showing the screen it is
           already on (after a restore, after printing). That is not navigation:
           whatever the person is looking at stays. */
        var reshow = nargs < 2 && cg === bg && cp === bp;
        if(reshow && C3.mode !== 'off'){ C3.refresh(); return r; }
        if(cg === 'today' && cp === 'console'){ if(!busy) C3.go(C3.h.firstRun && C3.h.firstRun() ? 'welcome' : 'today'); }
        else { enterDeep(); if(!busy) navCommit(); }
      }catch(e){ console.error('[c3] route', e); }
      return r;
    };
    return true;
  };
})();



