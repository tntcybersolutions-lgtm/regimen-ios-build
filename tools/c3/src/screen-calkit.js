/* C3 calendar kit (v327): the one month calendar the meal plan and the dose tracker share, so the two read the same.
   It registers no screen. C3.cx.month draws full weeks (Sunday to Saturday) of day cells: each day a ring (how
   the day went, or what is planned), a number under it and up to three marks; under each week one line of what
   that week holds; and the day picked opens right under its own week (not at the bottom of the page), with its
   rows and its controls. C3.cx.connect draws the person's calendar both ways: the plan out to Google, Apple or
   Outlook (the app's live feed, signed in; the .ics file, signed out), and their own calendar in (the private
   address Google, Outlook and Apple give a calendar, read through the app's own reader). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;
  var cx = C3.cx = {};
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  function ico(d, s, w){ return '<svg class="c3-ic" width="' + (s || 12) + '" height="' + (s || 12) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2.6) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>'; }
  var IC = {
    dumb:  '<rect x="4.5" y="6.5" width="3.5" height="11" rx="1"></rect><rect x="16" y="6.5" width="3.5" height="11" rx="1"></rect><path d="M2 10v4M22 10v4M8 12h8"></path>',
    pot:   '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"></path><path d="M2 10h20"></path><path d="M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"></path>',
    box:   '<rect x="4" y="8" width="16" height="12" rx="2"></rect><path d="M4 12h16M9 8V5h6v3"></path>',
    cart:  '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"></path><circle cx="9" cy="19.5" r="1.4"></circle><circle cx="17" cy="19.5" r="1.4"></circle>',
    out:   '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v6M9 3v6M16 21V3c2.5 1 3.5 4 3.5 7s-1.5 4-3.5 4"></path>',
    cal:   '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16M9 3v4M15 3v4"></path>',
    check: '<path d="M4 12.5l5.5 5.5L20 7"></path>',
    vial:  '<path d="M9 3h6"></path><path d="M10 3v4l-2.5 3.5V19a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-8.5L14 7V3"></path>',
    step:  '<path d="M4 18h5v-5h5V8h6"></path>',
    bolt:  '<path d="M13 3L5 14h6l-1 7 8-11h-6z"></path>',
    link:  '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"></path><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"></path>',
    ext:   '<path d="M14 4h6v6"></path><path d="M20 4l-9 9"></path><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>'
  };
  cx.icon = function(n, s, w){ return IC[n] ? ico(IC[n], s, w) : h.icon(n, s, w); };
  function dk(ms){ var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  cx.add = function(key, n){ var d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dk(d.getTime()); };
  cx.dow = function(key){ return new Date(key + 'T12:00:00').getDay(); };
  /* full weeks, Sunday to Saturday, covering from..to */
  cx.weeks = function(from, to){
    var k = cx.add(from, -cx.dow(from)), out = [];
    while(k <= to || out.length === 0){ var w = []; for(var i = 0; i < 7; i++){ w.push(k); k = cx.add(k, 1); } out.push(w); if(out.length > 8) break; }
    return out;
  };
  /* a ring: frac 0..1+, tone ok | under | over | miss | plan | done */
  cx.ring = function(frac, tone, size){
    var sz = size || 30, sw = sz >= 40 ? 4.5 : 3.6, r = (sz - sw) / 2 - 0.5, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
    var arc = tone === 'plan' || tone === 'miss' ? '' : '<circle class="a" cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r.toFixed(2) + '" stroke-width="' + sw + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(2) + '" transform="rotate(-90 ' + sz / 2 + ' ' + sz / 2 + ')"></circle>';
    return '<svg class="cx-ring ' + (tone || 'plan') + '" width="' + sz + '" height="' + sz + '" viewBox="0 0 ' + sz + ' ' + sz + '" aria-hidden="true" focusable="false">' +
      '<circle class="t" cx="' + sz / 2 + '" cy="' + sz / 2 + '" r="' + r.toFixed(2) + '" stroke-width="' + sw + '"></circle>' + arc + '</svg>';
  };
  /* the month. o: {weeks, sel, today, act, cell(key) -> {frac, tone, val, marks[], dim, none, label}, week(keys) -> html, panel(key) -> html, aria, key: html} */
  cx.month = function(o){
    var DN = ['S','M','T','W','T','F','S'];
    var html = '<div class="cx" role="grid" aria-label="' + esc(o.aria || 'Calendar') + '"><div class="cx-dh" role="row">' + DN.map(function(d){ return '<span role="columnheader" aria-hidden="true">' + d + '</span>'; }).join('') + '</div>';
    o.weeks.forEach(function(w){
      html += '<div class="cx-wk" role="row">' + w.map(function(k){
        var c = safe(function(){ return o.cell(k); }, null) || {none: true}, on = k === o.sel;
        var marks = (c.marks || []).slice(0, 3).map(function(m){ return '<i class="m-' + esc(m) + '">' + cx.icon(m, 11, 2.6) + '</i>'; }).join('');
        return '<button type="button" role="gridcell" class="cx-c' + (on ? ' on' : '') + (k === o.today ? ' today' : '') + (k < o.today ? ' past' : '') + (c.none ? ' none' : '') + (c.dim ? ' dim' : '') + '"' +
          ' data-act="' + esc(o.act) + '" data-v="' + esc(k) + '" data-key="' + esc(o.act) + '-' + esc(k) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(c.label || k) + '"' + (c.none && !o.openNone ? ' disabled' : '') + '>' +
          '<span class="n c3-num">' + new Date(k + 'T12:00:00').getDate() + '</span>' +
          (c.none ? '' : '<span class="rg">' + cx.ring(c.frac, c.tone) + (c.inner ? '<b class="in">' + esc(c.inner) + '</b>' : '') + '</span>' +
            '<span class="v c3-num">' + esc(c.val == null ? '' : c.val) + '</span>' + (c.sub ? '<span class="sb">' + esc(c.sub) + '</span>' : '') + '<span class="mk">' + marks + '</span>') + '</button>';
      }).join('') + '</div>';
      var ws = o.week ? safe(function(){ return o.week(w); }, '') : '';
      if(ws) html += '<div class="cx-ws">' + ws + '</div>';
      if(o.sel && w.indexOf(o.sel) >= 0 && o.panel){
        var col = w.indexOf(o.sel);
        html += '<div class="cx-panel" style="--col:' + col + '" role="region" aria-label="' + esc(safe(function(){ return new Date(o.sel + 'T12:00:00').toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}); }, o.sel)) + '">' + safe(function(){ return o.panel(o.sel); }, '') + '</div>';
      }
    });
    return html + '</div>' + (o.key || '');
  };
  /* the legend, from [[iconOrRing, words], ...] */
  cx.key = function(list){
    return '<p class="cx-key">' + list.map(function(x){
      var g = x[0].indexOf('ring:') === 0 ? cx.ring(x[0].slice(5) === 'plan' ? 0 : 0.72, x[0].slice(5), 16) : '<i class="m-' + esc(x[0]) + '">' + cx.icon(x[0], 13, 2.6) + '</i>';
      return '<span>' + g + esc(x[1]) + '</span>'; }).join('') + '</p>';
  };
  /* a two-number bar: value against an aim, with the aim's range shaded */
  cx.bar = function(label, val, aim, lo, hi, unit, tone){
    var top = Math.max(val, hi || aim, aim) * 1.15 || 1, pct = function(v){ return Math.max(0, Math.min(100, v / top * 100)); };
    return '<div class="cx-bar ' + (tone || '') + '"><span class="l">' + esc(label) + '</span><span class="tr">' +
      (lo && hi ? '<em style="left:' + pct(lo).toFixed(1) + '%;width:' + (pct(hi) - pct(lo)).toFixed(1) + '%"></em>' : '') +
      '<i style="width:' + pct(val).toFixed(1) + '%"></i><u style="left:' + pct(aim).toFixed(1) + '%"></u></span>' +
      '<span class="nv c3-num"><b>' + esc(h.fmt.n(Math.round(val))) + '</b> / ' + esc(h.fmt.n(Math.round(aim))) + ' ' + esc(unit || '') + '</span></div>';
  };

  /* ---------- the person's calendar, both ways ---------- */
  function signed(){ return safe(function(){ return !!(CLOUD_OK && CLOUD.signedIn()); }, false); }
  function feedLinks(){
    var url = safe(function(){ return feedUrl(); }, ''); if(!url) return null;
    var webcal = url.replace(/^https:/, 'webcal:');
    return {g: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal), a: webcal, o: 'https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent(url) + '&name=' + encodeURIComponent('formed fit')};
  }
  function ago(ms){ var m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
  /* o: {what: 'food' | 'doses'} */
  cx.connect = function(ctx, o){
    o = o || {};
    var st = ctx.state, F = safe(function(){ return feedOpts(); }, {meals: true, doses: true, training: true}), L = feedLinks(), C = safe(function(){ return calInCfg(); }, null);
    var opts = '<div class="cx-gopts" role="group" aria-label="What goes into your calendar">' + [['meals', 'Meals'], ['doses', 'Doses'], ['training', 'Training']].filter(function(x){ return x[0] !== 'doses' || safe(function(){ return onPeptide(); }, false); }).map(function(x){
      var on = F[x[0]] !== false;
      return '<button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="cxopt" data-v="' + x[0] + '" data-key="cxopt-' + x[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? cx.icon('check', 13, 3) : '') + '<span>' + x[1] + '</span></button>'; }).join('') + '</div>';
    var out;
    if(L) out = '<div class="cx-gbtns"><a class="c3-btn-quiet cx-gbtn g" href="' + esc(L.g) + '" target="_blank" rel="noopener" data-key="cxg-google">' + cx.icon('cal', 17, 2.4) + '<span>Google Calendar</span>' + cx.icon('ext', 14, 2.4) + '</a>' +
      '<a class="c3-btn-quiet bare cx-gbtn" href="' + esc(L.a) + '" data-key="cxg-apple"><span>Apple</span>' + cx.icon('ext', 14, 2.4) + '</a>' +
      '<a class="c3-btn-quiet bare cx-gbtn" href="' + esc(L.o) + '" target="_blank" rel="noopener" data-key="cxg-outlook"><span>Outlook</span>' + cx.icon('ext', 14, 2.4) + '</a></div>' +
      '<p class="cx-gs">' + cx.icon('check', 14, 3) + '<span>Live: it updates itself a few minutes after any change' + (safe(function(){ return ALL.feed.at; }, 0) ? ', last ' + esc(ago(ALL.feed.at)) : '') + '.</span></p>';
    else if(signed()) out = '<div class="cx-gbtns"><button type="button" class="c3-btn-quiet cx-gbtn g" data-act="cxfeed" data-key="cxfeed"' + (st.cxBusy ? ' disabled' : '') + '>' + cx.icon('cal', 17, 2.4) + '<span>' + (st.cxBusy ? 'Making your calendar' : 'Connect Google Calendar') + '</span></button>' +
      '<button type="button" class="c3-btn-quiet bare cx-gbtn" data-act="cxics" data-key="cxics"><span>.ics file</span></button></div>' + (st.cxErr ? '<p class="cx-gs bad">' + esc(st.cxErr) + '</p>' : '');
    else out = '<div class="cx-gbtns"><button type="button" class="c3-btn-quiet cx-gbtn g" data-act="cxsign" data-key="cxsign">' + cx.icon('cal', 17, 2.4) + '<span>Sign in to connect</span></button>' +
      '<button type="button" class="c3-btn-quiet bare cx-gbtn" data-act="cxics" data-key="cxics"><span>.ics file now</span></button></div>' +
      '<p class="cx-gs">A calendar that keeps itself up to date comes with your account. The file is today\'s plan, once.</p>';
    var inn;
    if(C){
      var n = (C.ev || []).filter(function(e){ return e.s >= Date.now() - 864e5; }).length;
      inn = '<p class="cx-gstat"><b>' + esc(C.name || safe(function(){ return calInWord(C.url); }, 'Your calendar')) + '</b><span>' + (C.err ? esc(C.err) : n + (n === 1 ? ' event' : ' events') + ' ahead' + (C.at ? ' · read ' + esc(ago(C.at)) : '')) + '</span></p>' +
        (o.what === 'food' ? '<p class="cx-gs">' + cx.icon('bolt', 14, 2.6) + '<span>An evening with something on it from 5 to 8:30 gets a dinner that takes 20 minutes or less.</span></p>' : '') +
        '<div class="cx-gbtns"><button type="button" class="c3-btn-quiet bare cx-gbtn" data-act="cxread" data-key="cxread"' + (st.cxBusy ? ' disabled' : '') + '><span>' + (st.cxBusy ? 'Reading' : 'Read it now') + '</span></button>' +
        '<button type="button" class="c3-btn-quiet bare cx-gbtn" data-act="cxoff" data-key="cxoff"><span>Disconnect</span></button></div>';
    } else {
      inn = '<label class="mk-find"><span class="k">Your calendar\'s private address</span><input class="yd-in" type="url" inputmode="url" data-key="cxurl" value="' + esc(st.cxUrl || '') + '" placeholder="https://calendar.google.com/calendar/ical/..." autocomplete="off" spellcheck="false"></label>' +
        '<div class="cx-gbtns"><button type="button" class="c3-btn-quiet cx-gbtn g" data-act="cxin" data-key="cxin"' + (st.cxBusy ? ' disabled' : '') + '>' + cx.icon('link', 16, 2.4) + '<span>' + (st.cxBusy ? 'Reading' : 'Show it here') + '</span></button></div>' +
        (st.cxErr2 ? '<p class="cx-gs bad">' + esc(st.cxErr2) + '</p>' : '') +
        '<p class="cx-gs">Google Calendar on a computer: Settings, your calendar, "Secret address in iCal format". Outlook: Settings, Calendar, Shared calendars, Publish. Apple: share the calendar as Public.</p>';
    }
    return '<section class="yd-sec cx-g" data-sec="gcal" aria-label="Google Calendar"><h2 class="yd-lbl"><span>Google Calendar</span></h2>' +
      '<div class="cx-gcols"><div class="cx-gcol"><p class="cx-gq">Your plan in your calendar</p>' + opts + out + '</div>' +
      '<div class="cx-gcol"><p class="cx-gq">Your calendar here</p>' + inn + '</div></div></section>';
  };
  /* what is typed in the address field survives a repaint */
  cx.wireConnect = function(root, ctx){
    var f = root.querySelector('[data-key="cxurl"]');
    if(f) f.addEventListener('input', function(){ ctx.state.cxUrl = f.value; });
  };
  /* its controls, for a screen's wire() */
  cx.connectActs = function(ctx){
    var st = ctx.state, re = function(){ C3.render(); };
    return {
      cxopt: function(v){ safe(function(){ var F = Object.assign({}, feedOpts()); F[v] = F[v] === false; F.at = Date.now(); ALL.feedOpts = F; save(); }); re(); },
      cxsign: function(){ safe(function(){ h.openSignIn(); }); },
      cxics: function(){ safe(function(){ var text = icsCalendar(icsAhead({})); if(typeof RUN !== 'undefined' && RUN && RUN.native && RUN.share){ RUN.share({title: 'formed fit calendar', text: text}).catch(function(){}); return; } icsDownload(text, 'formed-labs.ics'); }); safe(function(){ say('Downloaded. Open it and your calendar takes it in.'); }); },
      cxfeed: function(){
        /* the window opens on the tap (a browser blocks one opened later), then goes to Google once the feed exists */
        var w = null; try{ w = window.open('', '_blank'); }catch(e){}
        st.cxBusy = true; st.cxErr = ''; re();
        Promise.resolve(safe(function(){ return feedEnsure(); }, null)).then(function(f){
          st.cxBusy = false;
          var L = feedLinks();
          if(f && L){ if(w) w.location.href = L.g; else window.open(L.g, '_blank'); safe(function(){ feedRefreshNow(); }); }
          else { if(w) try{ w.close(); }catch(e){} st.cxErr = 'Your calendar could not be made just now. Try again in a minute.'; }
          C3.render();
        }, function(){ st.cxBusy = false; st.cxErr = 'Your calendar could not be made just now. Try again in a minute.'; if(w) try{ w.close(); }catch(e){} C3.render(); });
      },
      cxin: function(v, el, c2, ev){
        var inp = el && el.closest ? (el.closest('.cx-g') || {querySelector: function(){ return null; }}).querySelector('[data-key="cxurl"]') : null;
        var url = inp ? inp.value : st.cxUrl; st.cxUrl = url; st.cxErr2 = '';
        if(!safe(function(){ return calInCheck(url); }, null)){ st.cxErr2 = 'That is not a Google, Outlook or Apple calendar address.'; re(); return; }
        st.cxBusy = true; re();
        Promise.resolve(safe(function(){ return calInSet(url); }, null)).then(function(r){
          st.cxBusy = false;
          if(r && r.ok){ st.cxUrl = ''; safe(function(){ say('Your calendar is here: ' + r.n + (r.n === 1 ? ' event.' : ' events.')); }); }
          else st.cxErr2 = (r && r.why) || 'That address did not answer with a calendar.';
          C3.refresh();
        });
      },
      cxread: function(){ st.cxBusy = true; re(); Promise.resolve(safe(function(){ return calInFetch(true); }, null)).then(function(){ st.cxBusy = false; C3.refresh(); }); },
      cxoff: function(){ var was = safe(function(){ return calInForget(); }, null); safe(function(){ offerUndo('Your calendar is off this screen.', function(){ if(was){ was.set = Date.now(); ALL.calIn = was; save(); try{ mpEnsure(); }catch(e){} C3.refresh(); } }); }); C3.refresh(); }
    };
  };
})();
