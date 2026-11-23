/* C3 youdeep: the shared kit and the routes for the screens behind You and behind Today's
   check-in (checkin, recovery, reminders, settings, crew, share, coaches, report, data).
   It registers no screen of its own.

   C3.yd      the kit: one frame, one set of controls (switch, picker, tap scale, armed
              confirm), one fallback rule, used by every screen above.
   Routes     the app's own router (showGroup) and the You screen's doors (h.openYou,
              dataPanel) land on these screens instead of the old panes. The old panes stay
              in the file; yd.old(group, pane) is the only way to one, and only the fallback
              uses it. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;
  var yd = C3.yd = {};

  yd.safe = function(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } };
  var safe = yd.safe;
  yd.toast = function(msg, tone){ try{ say(msg, tone); }catch(e){} };
  yd.undo = function(msg, back, label){ try{ offerUndo(msg, back, label); }catch(e){} };
  yd.signedIn = function(){ return safe(function(){ return !!(CLOUD_OK && CLOUD.signedIn()); }, false); };
  yd.cloud = function(){ return safe(function(){ return !!CLOUD_OK; }, false); };
  yd.pro = function(){ return safe(function(){ return !!isPro(); }, true); };
  yd.plural = function(n, one, many){ return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  /* "Oct 9" / "Fri Oct 9" in US English, whatever the device says */
  yd.day = function(at, wk){ return safe(function(){ return new Date(at).toLocaleDateString('en-US', wk ? {weekday:'short', month:'short', day:'numeric'} : {month:'short', day:'numeric'}); }, ''); };
  yd.when = function(at){ return safe(function(){ return new Date(at).toLocaleString('en-US', {weekday:'short', hour:'numeric', minute:'2-digit'}); }, ''); };
  /* app copy carries a few commas where a dash once stood and typographic quotes; the screens say it plainly */
  yd.txt = function(t){ return esc(String(t == null ? '' : t)); };

  /* ---------- icons the shared set does not have ---------- */
  var IC = {
    chev:  '<path d="M9 5l7 7-7 7"></path>',
    back:  '<path d="M15 5l-7 7 7 7"></path>',
    x:     '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
    copy:  '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>',
    down:  '<path d="M12 4v11"></path><path d="M7.5 10.5L12 15l4.500-4.500"></path><path d="M5 19.500h14"></path>',
    up:    '<path d="M12 15V4"></path><path d="M7.500 8.500L12 4l4.500 4.500"></path><path d="M5 19.500h14"></path>',
    print: '<path d="M7 8V4h10v4"></path><rect x="4" y="8" width="16" height="8" rx="2"></rect><path d="M7 14h10v6H7z"></path>',
    share: '<circle cx="6" cy="12" r="2.500"></circle><circle cx="17.500" cy="6" r="2.500"></circle><circle cx="17.500" cy="18" r="2.500"></circle><path d="M8.200 10.800l7-3.600"></path><path d="M8.200 13.200l7 3.600"></path>',
    talk:  '<path d="M5 5h14v10.500H10.500L6.500 19v-3.500H5z"></path>',
    link:  '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"></path><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"></path>',
    file:  '<path d="M7 3.500h7l4 4v13H7z"></path><path d="M14 3.500v4h4"></path>',
    trash: '<path d="M5 7h14"></path><path d="M9 7V4.500h6V7"></path><path d="M7 7l1 13h8l1-13"></path>',
    star:  '<path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1.100 5.800L12 16.800 6.700 19.600l1.100-5.800L3.500 9.700l5.900-.800z"></path>',
    pause: '<path d="M9 6v12"></path><path d="M15 6v12"></path>',
    heart: '<path d="M12 20s-7.500-4.500-7.500-10A4.200 4.200 0 0 1 12 7.500 4.200 4.200 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10z"></path>',
    bell:  '<path d="M6.500 16.500V11a5.500 5.500 0 0 1 11 0v5.500l1.500 2H5z"></path><path d="M10.500 21h3"></path>',
    refresh:'<path d="M19.500 12a7.500 7.500 0 1 1-2.200-5.300"></path><path d="M19.500 4.500v4h-4"></path>',
    clock: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path>'
  };
  yd.icon = function(name, size, sw){
    if(!IC[name]) return h.icon(name, size, sw);
    size = size || 20;
    return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + IC[name] + '</svg>';
  };
  var icon = yd.icon;

  /* ---------- the frame every one of these screens stands in ---------- */
  var PARENT_WORD = {doses:'Track', addcmp:'Add', protocol:'Protocol', levels:'Levels', math:'Math', you:'You', today:'Today', checkin:'Check-in', crew:'Crew', coaches:'Coaches', settings:'Settings', report:'Report', train:'Train', progress:'Progress', food:'Food', plan:'Plan', body:'Body', daily:'Check-in', log:'Schedule'};   /* v357: body, daily, log (the log bar opens the week from them) */
  /* o: {back:'you', eyebrow:'Fri Oct 9', title:'Your', pk:'reminders', right:html} */
  yd.head = function(o){
    var back = o.back === null ? null : (o.back || 'you');   /* v333: null = a tab's own screen, no Back */
    if(back === null) return '<header class="yd-head noback">' + (o.eyebrow ? '<div class="c3-eyebrow yd-eye"><i></i>' + esc(o.eyebrow) + '</div>' : '') +
      '<h1 class="c3-h1 yd-title">' + esc(o.title || '') + (o.pk ? ' <span class="pk">' + esc(o.pk) + '</span>' : '') + '</h1>' + (o.right || '') + '</header>';
    return '<header class="yd-head">' +
      /* data-go decides where it goes (core.js reads data-go before data-back); data-back marks it as
         THE back control, the same as the bar's Back over a deep screen, for anything that looks for one */
      '<button type="button" class="yd-back" data-go="' + esc(back) + '" data-back data-key="yd-back" aria-label="Back to ' + esc(PARENT_WORD[back] || 'You') + '">' + icon('back', 18, 2.800) + '<span>' + esc(PARENT_WORD[back] || 'You') + '</span></button>' +
      (o.eyebrow ? '<div class="c3-eyebrow yd-eye"><i></i>' + esc(o.eyebrow) + '</div>' : '') +
      '<h1 class="c3-h1 yd-title">' + esc(o.title || '') + (o.pk ? ' <span class="pk">' + esc(o.pk) + '</span>' : '') + '</h1>' +
      (o.right || '') +
    '</header>';
  };
  /* a section: a small label on a hairline, then whatever */
  yd.sec = function(label, body, o){
    o = o || {};
    return '<section class="yd-sec' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' data-sec="' + esc(o.id) + '"' : '') + ' aria-label="' + esc(o.aria || label) + '">' +
      (label ? '<h2 class="yd-lbl"><span>' + esc(label) + '</span>' + (o.n != null ? '<span class="c3-num">' + esc(o.n) + '</span>' : '') + (o.right || '') + '</h2>' : '') + body + '</section>';
  };
  /* one quiet line of words; never the first thing in a section */
  yd.note = function(t, cls){ return t ? '<p class="yd-note' + (cls ? ' ' + cls : '') + '">' + t + '</p>' : ''; };
  /* an honest empty state: a short line, nothing drawn that is not there */
  yd.empty = function(t){ return '<p class="yd-empty">' + esc(t) + '</p>'; };
  /* big numbers split by hairlines: [[value, label, extraClass], ...] (values are escaped) */
  yd.stats = function(list, cls){
    return '<div class="c3-stats yd-stats' + (cls ? ' ' + cls : '') + '">' + list.map(function(s){
      return '<div' + (s[2] ? ' class="' + esc(s[2]) + '"' : '') + '><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div>';
  };
  /* a row of a quiet list that goes somewhere: [act, label, value] */
  yd.linkRow = function(act, label, val, attrs){
    return '<li><button type="button" class="yd-row yd-go" ' + (attrs || ('data-act="' + esc(act) + '"')) + ' data-key="row-' + esc(act) + '"><span class="l">' + esc(label) + '</span>' +
      (val ? '<span class="v">' + esc(val) + '</span>' : '') + icon('chev', 16, 2.200) + '</button></li>';
  };

  /* ---------- controls ---------- */
  /* a real switch. The whole row is the control (48 px and more). */
  yd.sw = function(act, on, label, sub, o){
    o = o || {};
    return '<button type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" class="yd-row yd-switch' + (o.cls ? ' ' + o.cls : '') + '" data-act="' + esc(act) + '"' + (o.v != null ? ' data-v="' + esc(o.v) + '"' : '') + ' data-key="sw-' + esc(act) + (o.v != null ? '-' + esc(o.v) : '') + '"' + (o.disabled ? ' disabled' : '') + '>' +
      '<span class="l">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      '<span class="yd-track" aria-hidden="true"><i></i></span></button>';
  };
  /* pick one of a few: opts = [[value, label], ...] */
  yd.seg = function(act, opts, cur, o){
    o = o || {};
    return '<div class="yd-seg' + (o.cls ? ' ' + o.cls : '') + '" role="group"' + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : '') + '>' + opts.map(function(p){
      var on = String(p[0]) === String(cur);
      return '<button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="' + esc(act) + '" data-v="' + esc(p[0]) + '"' + (o.extra ? ' ' + o.extra : '') + ' data-key="' + esc(act) + '-' + esc(p[0]) + (o.k ? '-' + esc(o.k) : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (p[2] ? ' aria-label="' + esc(p[2]) + '"' : '') + '>' + esc(p[1]) + '</button>'; }).join('') + '</div>';
  };
  /* a tap scale: n big targets in one row. opts: [[value, wordUnder], ...]; cur may be null */
  yd.scale = function(act, opts, cur, o){
    o = o || {};
    return '<div class="yd-scale n' + opts.length + (o.cls ? ' ' + o.cls : '') + '" role="radiogroup" aria-label="' + esc(o.aria || '') + '">' + opts.map(function(p){
      var on = cur != null && String(p[0]) === String(cur);
      return '<button type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" class="yd-tap' + (on ? ' on' : '') + '" data-act="' + esc(act) + '" data-v="' + esc(p[0]) + '"' + (o.extra ? ' ' + o.extra : '') +
        ' data-key="' + esc(act) + '-' + esc(o.k || '') + '-' + esc(p[0]) + '" aria-label="' + esc((o.aria ? o.aria + ' ' : '') + (p[2] || p[1] || p[0])) + '">' +
        '<b>' + esc(o.words ? p[1] : p[0]) + '</b>' + (!o.words && p[1] && o.under ? '<span>' + esc(p[1]) + '</span>' : '') + '</button>'; }).join('') + '</div>';
  };
  /* a native select in the C3 look: opts [[value, label], ...] */
  yd.select = function(act, opts, cur, label, o){
    o = o || {};
    return '<label class="yd-field"><span class="k">' + esc(label) + '</span><select class="yd-sel" data-chg="' + esc(act) + '"' + (o.extra ? ' ' + o.extra : '') + ' data-key="sel-' + esc(act) + (o.k ? '-' + esc(o.k) : '') + '">' +
      opts.map(function(p){ return '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(cur) ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') + '</select></label>';
  };
  /* a text / number / time / date field. Written on change (blur or Enter), never on every key. */
  yd.input = function(act, val, label, o){
    o = o || {};
    return '<label class="yd-field' + (o.cls ? ' ' + o.cls : '') + '"><span class="k">' + esc(label) + '</span><input class="yd-in" type="' + esc(o.type || 'text') + '" data-chg="' + esc(act) + '"' + (o.extra ? ' ' + o.extra : '') +
      ' data-key="in-' + esc(act) + (o.k ? '-' + esc(o.k) : '') + '" value="' + esc(val == null ? '' : val) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
      (o.mode ? ' inputmode="' + esc(o.mode) + '"' : '') + (o.min != null ? ' min="' + esc(o.min) + '"' : '') + (o.maxv != null ? ' max="' + esc(o.maxv) + '"' : '') + (o.step ? ' step="' + esc(o.step) + '"' : '') + ' autocomplete="off"></label>';
  };
  /* a quiet neon control */
  yd.btn = function(act, label, o){
    o = o || {};
    return '<button type="button" class="c3-btn-quiet yd-btn' + (o.pink ? ' pink' : '') + (o.cls ? ' ' + o.cls : '') + '" data-act="' + esc(act) + '"' + (o.v != null ? ' data-v="' + esc(o.v) + '"' : '') + (o.extra ? ' ' + o.extra : '') +
      ' data-key="btn-' + esc(act) + (o.v != null ? '-' + esc(o.v) : '') + '"' + (o.disabled ? ' disabled' : '') + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : '') + '>' + (o.icon ? icon(o.icon, 17, 2.200) : '') + '<span>' + esc(label) + '</span></button>';
  };
  /* THE primary control of a screen */
  yd.primary = function(act, label, right, o){
    o = o || {};
    return '<button type="button" class="c3-btn-primary yd-primary' + (o.cls ? ' ' + o.cls : '') + '" data-act="' + esc(act) + '" data-key="primary"' + (o.extra ? ' ' + o.extra : '') + (o.disabled ? ' disabled' : '') + '><span>' + esc(label) + '</span>' +
      '<span class="r">' + (right ? '<small>' + right + '</small>' : '') + icon(o.icon || 'arrow', 34, 3) + '</span></button>';
  };

  /* ---------- Pro: the lock on a gated screen ----------
     Says and does what the app's own lock layer does (lockHTML and applyGates): the words for
     that screen, "Your trial is over..." when it is, and ONE control labeled by the app's
     proOffer(): "Sign in to go Pro" signed out, "Go Pro" signed in, "Get Pro" (with Restore)
     in the phone app. It runs the app's buyPro(): on the web that is BILLING.offer(), which
     opens the sign-in and remembers the wish, or the plan choice on You. A build that cannot
     take payment says so, in the app's sentence. Whether to lock at all is the app's isPro()
     (billing off: never; billing live: the server's trial and plan).
       o: {desc (the words for this screen; default the app's PRO_WHAT line), part (true: the
       whole screen is the Pro part, as the app's sentence says)} */
  yd.lock = function(key, word, o){
    o = o || {};
    var t = safe(function(){ return trialInfo(); }, null) || {}, offer = safe(function(){ return proOffer(); }, null);
    var row = safe(function(){ return PRO_WHAT.filter(function(r){ return r[0] === key; })[0]; }, null);
    var over = t.state === 'expired', out = t.state === 'signedout', pend = t.state === 'pending';
    var says = (o.desc || (row ? row[2] : '')) + ' ' + (over ? (o.part ? 'Your trial is over. Everything you logged is still here and still exports, this screen is the part that needs Pro.'
      : 'Your trial is over. Everything you logged is still here and still exports.') : out ? 'Your trial and your plan live on your FORMED account. Sign in and this screen opens with them.' : pend ? 'Checking your membership. This takes a connection - try again in a moment.' : 'This is part of Pro.');
    return '<div class="yd-lock" data-lock="' + esc(key) + '"><p class="yd-lockw">' + esc(word) + '</p>' + yd.note(esc(says.trim()), 'yd-lockn') +
      (offer ? yd.primary('buy', offer.label, '', {icon:'arrow', extra:'data-buy="1"', cls:'yd-lockb'}) +
          (offer.restore ? '<div class="yd-acts">' + yd.btn('restore', 'Restore a purchase', {extra:'data-restore="1"'}) + '</div>' : '')
        : yd.note('Pro is part of a formed fit membership. Nothing is sold in this build, and it will not pretend otherwise.')) + '</div>';
  };
  /* the lock's controls, for a screen's wire(): exactly the app's handlers on its lock layer */
  yd.lockActs = {
    buy: function(){
      var miss = function(){ yd.toast('That purchase did not go through.', 'bad'); };
      var r0; try{ r0 = buyPro(); }catch(e){ miss(); return; }
      Promise.resolve(r0).then(function(r){
        if(r && r.ok){ yd.toast('Pro is on. Everything is open.'); C3.refresh(); }
        else if(safe(function(){ return buyMiss(r); }, false)) miss();
      }, miss);
    },
    restore: function(){
      Promise.resolve(safe(function(){ return restorePro(); }, null)).then(function(r){
        yd.toast(r && r.ok ? 'Purchase restored.' : 'Nothing to restore on this account.', r && r.ok ? '' : 'bad');
        if(r && r.ok) C3.refresh();
      }, function(){ yd.toast('Nothing to restore on this account.', 'bad'); });
    }
  };
  /* a level bar with a number at its end: frac 0..1 */
  yd.bar = function(frac, cls){
    var f = !(frac > 0) ? 0 : frac > 1 ? 1 : frac;
    return '<span class="yd-bar' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><i style="width:' + (Math.round(f * 1000) / 10) + '%"></i></span>';
  };

  /* ---------- the armed confirm: the app's way of asking "are you sure" without a browser dialog.
     The first press arms the control (its words change, for a few seconds); the second does it.
     Markup: yd.arm(ctx, 'leave', 'Leave the crew', 'Tap again to leave'); the screen's action
     table gets the action under the same name and it only runs on the second press. ---------- */
  var ARM_MS = 6000, armT = 0;
  yd.armed = function(ctx, key){ var a = ctx.state._arm; return !!(a && a.k === key && Date.now() < a.until); };
  yd.arm = function(ctx, act, label, sure, o){
    o = o || {};
    var key = act + (o.v != null ? ':' + o.v : ''), on = yd.armed(ctx, key);
    return '<button type="button" class="c3-btn-quiet yd-btn yd-danger' + (on ? ' armed' : '') + (o.cls ? ' ' + o.cls : '') + '" data-act="' + esc(act) + '" data-arm="1"' + (o.v != null ? ' data-v="' + esc(o.v) + '"' : '') +
      ' data-key="arm-' + esc(key) + '"' + (o.disabled ? ' disabled' : '') + ' aria-live="polite">' + (on ? '' : icon(o.icon || 'x', 16, 2.400)) + '<span>' + esc(on ? sure : label) + '</span></button>';
  };

  /* ---------- wiring: one click listener and one change listener per paint ----------
     acts:  {name: function(value, element, ctx)}   for [data-act]
     chgs:  {name: function(value, element, ctx)}   for [data-chg] (inputs and selects) */
  yd.wire = function(root, ctx, acts, chgs){
    var committingField=false;
    root.querySelectorAll('[data-act]').forEach(function(b){
      function invoke(ev){
        if(b.disabled) return;
        var a = b.getAttribute('data-act'), v = b.getAttribute('data-v'), fn = acts && acts[a];
        if(!fn) return;
        /* A submit must include the focused field before its change handler repaints the button. */
        if(b.hasAttribute('data-commit')){
          var scope=b.getRootNode(),el=scope.activeElement||document.activeElement;
          if(el&&el!==b&&el.hasAttribute&&el.hasAttribute('data-chg')){
            var update=chgs&&chgs[el.getAttribute('data-chg')];
            if(update) try{committingField=true;update(el.value,el,ctx);}catch(e){console.error('[c3] '+ctx.name+' commit field',e);return;}finally{committingField=false;}
          }
        }
        if(b.hasAttribute('data-arm')){
          var key = a + (v != null ? ':' + v : '');
          if(!yd.armed(ctx, key)){
            ctx.state._arm = {k: key, until: Date.now() + ARM_MS};
            clearTimeout(armT); armT = setTimeout(function(){ if(C3.current === ctx.name){ ctx.state._arm = null; C3.render(); } }, ARM_MS + 60);
            C3.render(); return;
          }
          ctx.state._arm = null; clearTimeout(armT);
        }
        try{ fn(v, b, ctx, ev); }catch(e){ console.error('[c3] ' + ctx.name + ' ' + a, e); }
      }
      b.addEventListener('pointerdown',function(ev){
        if(!b.hasAttribute('data-commit')||b.disabled||ev.button!==0)return;
        ev.preventDefault();
      });
      b.addEventListener('click', function(ev){
        invoke(ev);
      });
    });
    root.querySelectorAll('[data-chg]').forEach(function(el){
      el.addEventListener('change', function(){
        if(committingField)return;
        var a = el.getAttribute('data-chg'), fn = chgs && chgs[a];
        if(!fn) return;
        try{ fn(el.value, el, ctx); }catch(e){ console.error('[c3] ' + ctx.name + ' ' + a, e); }
      });
      /* Enter in a field commits it (a change event fires on blur) */
      if(el.tagName === 'INPUT') el.addEventListener('keydown', function(ev){ if(ev.key === 'Enter'){ ev.preventDefault(); el.blur(); } });
    });
  };

  /* ---------- the fallback: a person never sees a blank page ----------
     yd.screen(name, {old:['profile','report'], parent:'you', nav:'you', render, wire, ...}).
     The screen is drawn once before it is shown; if that throws, the old pane opens instead
     (under the C3 bar, with Back). A throw on a later repaint does the same. */
  var bypass = 0, prevShow = null;
  yd.old = function(group, pane){
    bypass++;
    try{ window.showGroup(group, pane); }catch(e){ console.error('[c3] old pane', e); }
    bypass--;
  };
  yd.parents = {};
  yd.screen = function(name, def){
    var old = def.old, inner = def.render, enter0 = def.enter;
    yd.parents[name] = def.parent || 'you';
    function fall(){ if(def.fall) def.fall(); else if(old) yd.old(old[0], old[1]); else C3.go(def.parent || 'you'); }
    def.enter = function(ctx){
      if(enter0 && enter0(ctx) === false) return false;
      try{ var t = inner(ctx); if(typeof t !== 'string') throw new Error('nothing drawn'); }
      catch(e){ console.error('[c3] ' + name + ' could not be drawn, the old screen opens', e); setTimeout(fall, 0); return false; }
      return true;
    };
    def.render = function(ctx){
      try{ return inner(ctx); }
      catch(e){
        console.error('[c3] ' + name + '.render', e);
        setTimeout(function(){ if(C3.mode === 'on' && C3.current === name) fall(); }, 0);
        return '<p class="c3-fail">Opening this screen the other way.</p>';
      }
    };
    if(def.nav == null) def.nav = 'you';
    C3.screen(name, def);
  };

  /* ---------- routes ---------- */
  /* the old pane (by its id; pane ids are unique across groups) -> the screen that replaced it */
  var ROUTE = {ready:'checkin', crew:'coaches', youcrew:'crew', report:'report', train:'program', body:'body', block:'block', cal:'cal', history:'history', moves:'moves', levels:'levels', log:'log', photos:'photos', recap:'recap', ai:'ai', labs:'labs', taper:'taper', ledger:'ledger', mix:'mix', compounds:'stack'};
  /* v319: train = the old Full plan pane; v320: the other seven old deep pages (Body, the next 12 weeks, Calendar, History,
     Library, Levels, Schedule & log) are C3 screens too */
  /* a You door (an old card on the Account pane) -> the screen that replaced the card */
  var ANCHOR = {remCard:'reminders', prefCard:'settings', healthCard:'settings'};
  var signInUntil = 0;
  function usable(name){ return !!(C3.mounted && C3.mode !== 'off' && C3.screens[name] && C3.screens[name].render && !document.body.classList.contains('sharing')); }

  /* helpers.js calls this first in h.openYou (the You screen's doors). True = handled. */
  C3.youRoute = function(pane, anchor){
    var scr = ANCHOR[anchor];
    if(!scr || !usable(scr)) return false;
    return C3.go(scr, anchor === 'healthCard' ? {focus:'health'} : null) !== false;
  };

  function install(){
    if(prevShow) return;
    prevShow = window.showGroup;
    /* printing the report prints the app's own document: while html.c3-printing is set (the
       report screen sets it around the app's print) the C3 host is out and the old shell is in */
    try{
      var ps = document.createElement('style'); ps.id = 'c3ydprint';
      ps.textContent = '@media print{ html.c3-printing #c3{ display:none !important; } html.c3-printing.c3-on:not(#vv):not(#c3x) body .wrap{ display:block !important; margin:0 !important; padding:0 !important; } ' +
        'html.c3-printing.c3-on:not(#vv):not(#c3x) body{ background:#FFFFFF !important; } html.c3-printing #toast, html.c3-printing #restBar{ display:none !important; } }';
      document.body.appendChild(ps);
    }catch(e){}
    window.showGroup = function(g, pane){
      if(!bypass && arguments.length >= 2 && ROUTE[pane] && usable(ROUTE[pane])){
        /* "Sign in" inside a sheet (the app's goSignIn) names the Coaches pane for historical
           reasons; that is a trip to the account, not to the coaches */
        if(pane === 'crew' && Date.now() < signInUntil){ signInUntil = 0; try{ h.openSignIn(); return; }catch(e){} }
        if(C3.go(ROUTE[pane]) !== false) return;
      }
      return prevShow.apply(this, arguments);
    };
    try{
      if(typeof window.goSignIn === 'function'){
        var gs0 = window.goSignIn;
        window.goSignIn = function(){ signInUntil = Date.now() + 1500; return gs0.apply(this, arguments); };
      }
    }catch(e){}
    /* You > "Export my data" asks the app for its export panel on the Account card (v297).
       That door now opens the Data screen; the peptide schedule's own Export / Import
       buttons (no host named) keep the app's panel. */
    try{
      if(typeof window.dataPanel === 'function'){
        var dp0 = window.dataPanel;
        window.dataPanel = function(mode, hostEl){
          if(!yd._raw && hostEl && hostEl.id === 'acctCard' && usable('data')){ if(C3.go('data', {mode: mode}) !== false) return; }
          return dp0.apply(this, arguments);
        };
      }
    }catch(e){}
  }
  /* the app's own data panel, built where nobody sees it, so its buttons can be pressed for
     the exact write path (restore a backup) */
  yd.rawPanel = function(mode, host){ yd._raw = 1; try{ dataPanel(mode, host); }finally{ yd._raw = 0; } };

  /* C3's own showGroup wrap is installed in C3.mount (boot.js calls it last); ours goes on top */
  var mount0 = C3.mount;
  C3.mount = function(){
    var r = mount0.apply(this, arguments);
    if(r){ try{ install(); }catch(e){ console.error('[c3] youdeep routes', e); } }
    return r;
  };

  /* ---------- Escape goes back to the screen above (when no sheet or overlay is up) ---------- */
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'Escape' || ev.defaultPrevented) return;
    if(!C3.mounted || C3.mode !== 'on' || !yd.parents[C3.current]) return;
    var up = function(id){ var el = document.getElementById(id); return !!(el && !el.hidden); };
    if(up('sheet') || up('story') || up('onb') || up('finder') || up('myplan')) return;
    var a = C3.root && C3.root.activeElement;
    if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')){ a.blur(); return; }
    C3.go(yd.parents[C3.current]);
  });

  /* ---------- the mirror ----------
     A few blocks of the old app are drawn by one long renderer straight into a fixed element,
     with their handlers attached there (the report document, the doctor's link, the report
     questions, the import preview). They are not rebuilt: the app draws them where it always
     did (in a pane nobody sees), and yd.mirror(el) reads that element and returns the same
     content in the C3 look. Every control in the copy carries the index of the control it
     stands for; pressing it presses the original, so the app's own handler runs.
       var M = yd.mirror(document.getElementById('shareBody'));   ->  {html, els}
       wire: yd.wire(root, ctx, yd.mirrorActs(function(){ return M.els; }, after), yd.mirrorChgs(...)) */
  var INLINE = {B:1, STRONG:1, I:1, EM:1, SMALL:1, SPAN:1, U:1, CODE:1, BR:1, SUP:1, SUB:1, A:1};
  function hiddenEl(el){ return el.hidden || (el.style && el.style.display === 'none' && !(el.tagName === 'SELECT' && el.dataset && el.dataset.sel)); }
  function clean(t){ return String(t || '').replace(/\s+/g, ' '); }
  yd.mirror = function(src, o){
    o = o || {};
    var els = o.els || [], labels = {}, cap = safe(function(){ return FOLD_CAP; }, 12);
    if(!src) return {html:'', els:els};
    Array.prototype.forEach.call(src.querySelectorAll('label[for]'), function(l){ labels[l.getAttribute('for')] = clean(l.textContent).trim(); });
    function ref(el){ els.push(el); return els.length - 1; }
    function inline(node){
      /* a row the app lays out with flex (a name, a state, a count side by side) has no words between
         its pieces: they are kept apart with a dot */
      var out = '', flexy = /display:\s*flex/.test((node.getAttribute && node.getAttribute('style')) || '');
      Array.prototype.forEach.call(node.childNodes, function(c){
        if(c.nodeType === 3){ out += esc(clean(c.nodeValue)); return; }
        if(c.nodeType !== 1 || hiddenEl(c)) return;
        var t = c.tagName;
        if(flexy && out.trim() && t !== 'BR' && clean(c.textContent).trim()) out += ' · ';
        if(t === 'BR'){ out += '<br>'; return; }
        if(t === 'B' || t === 'STRONG'){ out += '<b>' + inline(c) + '</b>'; return; }
        if(t === 'BUTTON' || t === 'INPUT' || t === 'SELECT'){ out += block(c); return; }
        if(t === 'IMG' || t === 'svg' || t === 'SVG' || t === 'CANVAS') return;
        if(/display:\s*block/.test(c.getAttribute('style') || '')){ out += '<small>' + inline(c) + '</small>'; return; }
        out += inline(c);
      });
      return out;
    }
    function onlyInline(el){ for(var i = 0; i < el.childNodes.length; i++){ var c = el.childNodes[i]; if(c.nodeType === 1 && !INLINE[c.tagName]) return false; } return true; }
    function table(tb, limit){
      var s = '<div class="yd-scroll"><table class="yd-table">', n = 0;
      Array.prototype.forEach.call(tb.querySelectorAll('tr'), function(tr){
        var head = tr.parentNode && tr.parentNode.tagName === 'THEAD';
        if(!head && limit && ++n > limit) return;
        s += '<tr>' + Array.prototype.map.call(tr.children, function(c){ var num = /\bnum\b/.test(c.className || ''), tg = c.tagName === 'TH' ? 'th' : 'td';
          return '<' + tg + (num ? ' class="n"' : '') + (c.colSpan > 1 ? ' colspan="' + c.colSpan + '"' : '') + '>' + (clean(c.textContent).trim() === ',' ? '\u00b7' : inline(c).replace(/^\s*,\s+(?=\S)/, '')) + '</' + tg + '>'; }).join('') + '</tr>';
      });
      return s + '</table></div>';
    }
    function field(el, labelText){
      var i = ref(el), lab = labelText || labels[el.id] || el.getAttribute('aria-label') || '';
      if(el.tagName === 'SELECT'){
        return '<label class="yd-field"><span class="k">' + esc(lab) + '</span><select class="yd-sel" data-chg="mirsel" data-v="' + i + '" data-key="mir-' + i + '"' + (el.disabled ? ' disabled' : '') + '>' +
          Array.prototype.map.call(el.options, function(op){ return '<option value="' + esc(op.value) + '"' + (op.selected ? ' selected' : '') + '>' + esc(clean(op.textContent)) + '</option>'; }).join('') + '</select></label>';
      }
      if(el.tagName === 'TEXTAREA') return '<label class="yd-field"><span class="k">' + esc(lab) + '</span><textarea class="yd-ta yd-mirta" data-chg="mirin" data-v="' + i + '" data-key="mir-' + i + '"' +
        (el.placeholder ? ' placeholder="' + esc(el.placeholder) + '"' : '') + (el.maxLength > 0 ? ' maxlength="' + el.maxLength + '"' : '') + (el.disabled ? ' disabled' : '') + ' rows="' + (el.rows || 2) + '">' + esc(el.value) + '</textarea></label>';
      if(el.readOnly) return '<p class="yd-url c3-num">' + esc(el.value) + '</p>';
      var ty = (el.type === 'number' || el.type === 'date' || el.type === 'time') ? el.type : 'text';
      return '<label class="yd-field"><span class="k">' + esc(lab) + '</span><input class="yd-in" type="' + ty + '" data-chg="mirin" data-v="' + i + '" data-key="mir-' + i + '" value="' + esc(el.value) + '"' +
        (el.placeholder ? ' placeholder="' + esc(el.placeholder) + '"' : '') + (el.maxLength > 0 ? ' maxlength="' + el.maxLength + '"' : '') + (el.disabled ? ' disabled' : '') + ' autocomplete="off"></label>';
    }
    function block(el){
      var t = el.tagName, cls = String(el.className && el.className.baseVal === undefined ? el.className : '');
      if(/\bselw\b/.test(cls)){ var sw = el.querySelector('select'); return sw ? field(sw) : ''; }
      /* the app's number stepper (enhanceNumbers: a − and a + around the field): the field alone; C3 fields take typing */
      if(/\bspin\b/.test(cls)){ var sn = el.querySelector('input'); return sn ? field(sn) : ''; }
      if(/\b(seltrig|selpop)\b/.test(cls)) return '';
      if(hiddenEl(el)) return '';
      if(t === 'TEXTAREA') return o.ta ? field(el) : '';
      if(t === 'STYLE' || t === 'SCRIPT' || t === 'IMG' || t === 'svg' || t === 'SVG' || t === 'CANVAS') return '';
      if(t === 'BUTTON'){
        var i = ref(el), dis = el.disabled ? ' disabled' : '';
        if(/\bfoldhead\b/.test(cls)){
          var n = el.querySelector('.foldn'), tt = el.querySelector('.foldt'), open = el.getAttribute('aria-expanded') === 'true';
          var title = tt ? clean(Array.prototype.filter.call(tt.childNodes, function(c){ return c !== n; }).map(function(c){ return c.textContent; }).join('')).trim() : clean(el.textContent).trim();
          return '<button type="button" class="yd-row yd-fold" data-act="mir" data-v="' + i + '" data-key="mir-' + i + '" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="l">' + esc(title) + '</span>' +
            (n ? '<span class="v">' + esc(clean(n.textContent).trim()) + '</span>' : '') + icon(open ? 'up' : 'chev', 16, 2.200) + '</button>';
        }
        var main = /\bbtn\b/.test(cls) && !/\balt\b/.test(cls), on = /\bon\b/.test(cls) && !main, go = /\bgo\b/.test(cls) && !main && !on;
        var bad = !main && /^(remove|delete|clear|forget|end|erase)\b/i.test(clean(el.textContent).trim());   /* v367: a destructive one reads coral */
        return '<button type="button" class="' + (main ? 'c3-btn-rail yd-mirgo' : 'c3-btn-quiet yd-btn yd-mirbtn' + (on ? ' sel' : '') + (go ? ' yd-go' : '') + (bad ? ' yd-danger' : '')) + '" data-act="mir" data-v="' + i + '" data-key="mir-' + i + '"' + dis + '>' + (function(t){ return /^\+\s/.test(t) ? h.icon('plus', 15, 3) + '<span>' + t.replace(/^\+\s+/, '') + '</span>' : '<span>' + t + '</span>'; })(inline(el)) + (main ? h.icon('arrow', 24, 2.800) : '') + '</button>';   /* v367: a leading "+" is the mint plus mark */
      }
      if(t === 'LABEL'){
        var ck = el.querySelector('input[type="checkbox"]'), ctl = el.querySelector('select, input:not([type="checkbox"])');
        if(ck){
          var j = ref(ck), bb = el.querySelector('b'), ttl = clean(bb ? bb.textContent : el.textContent).trim(), all = clean(el.textContent).trim();
          var sub = bb ? all.slice(all.indexOf(ttl) + ttl.length).trim() : '';
          return '<button type="button" role="switch" aria-checked="' + (ck.checked ? 'true' : 'false') + '" class="yd-row yd-switch" data-act="mirck" data-v="' + j + '" data-key="mir-' + j + '"' + (ck.disabled ? ' disabled' : '') + '><span class="l">' + esc(ttl) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="yd-track" aria-hidden="true"><i></i></span></button>';
        }
        if(ctl){ var own = clean(Array.prototype.filter.call(el.childNodes, function(c){ return c.nodeType === 3; }).map(function(c){ return c.nodeValue; }).join(' ')).trim(); return field(ctl, own || undefined); }
        return '';        /* a label for a control elsewhere: its words go with that control */
      }
      if(t === 'INPUT'){ if(el.type === 'checkbox' || el.type === 'file' || el.type === 'hidden') return ''; return field(el); }
      if(t === 'SELECT') return field(el);
      if(t === 'TABLE') return table(el, el.closest && el.closest('[data-cap]') ? cap : 0);
      if(/\btiles\b/.test(cls)){
        return '<div class="c3-stats yd-stats yd-mirstats">' + Array.prototype.map.call(el.querySelectorAll('.tile'), function(tl){
          var k = tl.querySelector('.k'), v = tl.querySelector('.v'), vt = v ? clean(v.textContent).trim() : '';
          return '<div><b>' + esc(vt === ',' || vt === '' || vt === '%' ? '·' : vt) + '</b><span>' + esc(k ? clean(k.textContent).trim() : '') + '</span></div>'; }).join('') + '</div>';
      }
      if(t === 'H1' || t === 'H2' || t === 'H3' || t === 'H4' || /\b(auxh|rph)\b/.test(cls)) return '<h3 class="yd-lbl"><span>' + esc(clean(el.textContent).trim()) + '</span></h3>';
      if(t === 'P' || (t !== 'UL' && t !== 'OL' && onlyInline(el))){
        var body = inline(el);
        if(/<(button|label)/.test(body)) return '<div class="yd-acts yd-mir">' + body + '</div>';
        if(!clean(el.textContent).trim()) return '';
        var st = (el.getAttribute('style') || '');
        return '<p class="' + (/\b(rpsrc|mvsrc|cfnote|src)\b/.test(cls) ? 'yd-src' : 'yd-note' + (/--red/.test(st) ? ' bad' : (/--amber/.test(st) || /\b(warn|warnbox)\b/.test(cls)) ? ' warn' : '')) + '">' + body + '</p>';
      }
      if(t === 'UL' || t === 'OL') return '<ul class="yd-ul">' + Array.prototype.map.call(el.children, function(li){ return '<li>' + inline(li) + '</li>'; }).join('') + '</ul>';
      var kids = '';
      Array.prototype.forEach.call(el.childNodes, function(c){
        if(c.nodeType === 3){ var tx = clean(c.nodeValue).trim(); if(tx) kids += '<p class="yd-note">' + esc(tx) + '</p>'; return; }
        if(c.nodeType === 1) kids += block(c);
      });
      if(!kids) return '';
      var row = /\b(row2|mvacts|quick|winpick|aisugg|apibar|mvchips|calacts|mvtogs)\b/.test(cls), grid = /\b(fields|impgrid|impcols|row3)\b/.test(cls), fold = /\blogfold\b/.test(cls);
      return '<div class="' + (row ? 'yd-acts yd-mir' : grid ? 'yd-fields yd-mir' : fold ? 'yd-mirfold' : 'yd-mir') + '">' + kids + '</div>';
    }
    var html = '';
    Array.prototype.forEach.call(src.childNodes, function(c){
      if(c.nodeType === 3){ var tx = clean(c.nodeValue).trim(); if(tx) html += '<p class="yd-note">' + esc(tx) + '</p>'; return; }
      if(c.nodeType === 1 && !(o.skip && o.skip(c))) html += block(c);
    });
    return {html: html, els: els};
  };
  function fire(el, type){ try{ el.dispatchEvent(new Event(type, {bubbles:true})); }catch(e){} }
  /* the actions and change handlers of a mirrored block; `after` runs when the app has had its turn */
  yd.mirrorActs = function(getEls, after){
    var el = function(v){ var a = getEls() || []; return a[+v] || null; };
    return {
      mir: function(v){ var x = el(v); if(x){ try{ x.click(); }catch(e){ console.error('[c3] mirror', e); } } if(after) after(); },
      mirck: function(v){ var x = el(v); if(x){ x.checked = !x.checked; fire(x, 'change'); } if(after) after(); }
    };
  };
  yd.mirrorChgs = function(getEls, after){
    var el = function(node){ var a = getEls() || []; return a[+node.getAttribute('data-v')] || null; };
    return {
      mirin: function(v, node){ var x = el(node); if(x){ x.value = v; fire(x, 'input'); fire(x, 'change'); } if(after) after(); },
      mirsel: function(v, node){ var x = el(node); if(x){ x.value = v; fire(x, 'change'); } if(after) after(); }
    };
  };
  /* the app answers a moment later (a server call, a redraw): repaint a few times, cheaply */
  yd.settle = function(){ [0, 120, 400, 1000, 2200, 4500].forEach(function(ms){ setTimeout(function(){ C3.refresh(); }, ms); }); };

  /* ---------- the screens ----------
     Their files sort before this one (splice loads screen files by name), so each one adds its
     registration to a list: (C3.ydq = C3.ydq || []).push(function(yd){ ... }). The list is run here. */
  yd.drain = function(){
    var q = C3.ydq || (C3.ydq = []);
    while(q.length){ var f = q.shift(); try{ f(yd); }catch(e){ console.error('[c3] youdeep screen failed to load', e); } }
  };
  yd.drain();
})();
