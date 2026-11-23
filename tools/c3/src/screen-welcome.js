/* C3 screen: welcome. The signed-out first run. It replaces the walkthrough that used
   to play by itself: nothing opens here until the person taps.
   The team picture shown whole (it has its own words baked in, so nothing sits on it),
   the logo, one headline, ONE primary control (START FREE -> the app's own setup wizard,
   openOnboarding) and a quiet "I have an account" (the app's own sign-in screen).
   When setup finishes the app routes to Today (onbFinish -> showGroup('today','console'))
   and C3 follows; once the person has data this screen never shows again (h.firstRun). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  /* the trial length a new person is really promised (the app's trialDaysOffered(): the server's number on the
     web, the shell's own in the phone app); 0 when nothing is sold yet or it cannot be read, and then no number is shown */
  function trialDays(){ return safe(function(){ return trialDaysOffered() | 0; }, 0) || 0; }

  var openSignIn = h.openSignIn, openTeam = h.openTeam;   /* the shared doors (helpers.js) */

  /* the small four-color ring beside the headline: a picture of the day ring, not a number */
  function glyph(){
    var cols = [h.RING_COLORS.train, h.RING_COLORS.protein, h.RING_COLORS.water, h.RING_COLORS.steps], s = '', len = 2 * Math.PI * 18 / 4;
    cols.forEach(function(c, i){
      s += '<circle cx="24" cy="24" r="18" fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (len - 11).toFixed(1) + ' 200" transform="rotate(' + (180 + i * 90 + 17.5) + ' 24 24)"></circle>';
    });
    return '<svg class="wl-ring" viewBox="0 0 48 48" width="56" height="56" aria-hidden="true" focusable="false">' + s + '</svg>';
  }
  function coachHTML(c){
    var parts = String(c.name).split(' '), role = String(c.role || '').split(' · ');
    return '<div class="wl-co"><i class="bar"></i>' +
      '<img class="wl-face" src="' + esc(c.badge) + '" alt="" width="168" height="168" decoding="async">' +
      '<span class="wl-co-n">' + esc(parts[0]) + (parts.length > 1 ? '<span class="x"> ' + esc(parts.slice(1).join(' ')) + '</span>' : '') + '</span>' +
      '<span class="wl-co-r">' + esc(role[0]) + (role.length > 1 ? '<span class="x"> · ' + esc(role.slice(1).join(' · ')) + '</span>' : '') + '</span></div>';
  }

  C3.screen('welcome', {
    nav: '', chrome: false,
    /* someone who is set up, or has ever logged a dose, never sees this again */
    enter: function(){ if(!h.firstRun()){ C3.go('today'); return false; } },
    render: function(){
      /* an account arrived while this was up (sign-in, sync): step aside for Today */
      if(!h.firstRun()) setTimeout(function(){ if(C3.mode === 'on' && C3.current === 'welcome' && !h.firstRun()) C3.go('today'); }, 0);
      var d = trialDays(), coaches = h.coaches();
      /* terms already accepted on this device (same version): no second tick, nothing to get in the way */
      var accepted = safe(function(){ var a = JSON.parse(localStorage.getItem('ff-terms-accept') || 'null'); return !!(a && a.v === '2026-10-28'); }, false);
      /* v327.2: signed in already (on this device or another) with nothing set up yet: no "I have an account" (it read
         as "you are not signed in"); the one control is the setup, and the account is named */
      var me = safe(function(){ return (typeof CLOUD_OK === 'undefined' || CLOUD_OK) && CLOUD.signedIn() ? (CLOUD.user() || {}).email || 'your account' : ''; }, '');
      return '<div class="wl">' +
        '<header class="wl-top"><span class="wl-logo" role="img" aria-label="formed fit">' + h.markSVG() + '</span><span class="wl-say"><b>formed fit</b><span class="by">by formed labs</span></span></header>' +
        '<div class="wl-main">' +
          '<div class="wl-picbox">' + h.pictureHTML('welcome-your-team', {eager:true, cls:'wl-pic'}) + '</div>' +
          '<section class="wl-start" aria-label="Start free">' +
            '<div class="wl-head"><div class="c3-eyebrow wl-eye"><i></i>Training · Food · Four coaches</div>' +
              '<h1 class="wl-h1"><span class="a"><span>Train. Eat.</span> <span class="t">Track.</span></span><span class="b"><span class="pk">One ring.</span>' + glyph() + '</span></h1></div>' +
            '<div class="wl-act">' +
              (accepted ? '' : '<label class="wl-agree" style="display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;font-size:12.5px;line-height:1.45;opacity:.85;cursor:pointer;max-width:52ch;text-align:left">' +
              '<input type="checkbox" id="wl-agree" style="position:static;appearance:auto;-webkit-appearance:checkbox;margin:2px 0 0;width:16px;height:16px;flex:none">' +
              '<span>I understand formed fit is not medical advice and that I use it at my own risk. I agree to the <a href="/terms" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Terms of Use</a> and the <a href="/privacy" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Privacy Policy</a>.</span></label>') +
              '<span id="wl-agree-err" role="alert" style="display:block;margin:0 0 10px;font-size:12.5px;color:#b42318;font-weight:700"></span>' +
              '<div class="wl-cta"><button type="button" class="c3-btn-primary wl-go" data-act="setup" data-key="setup"><span>' + (me ? 'Set up my plan' : 'Start free') + '</span>' + h.icon('arrow', 50, 3) + '</button></div>' +
              (me ? '<div class="wl-facts"><span class="f wl-me">Signed in as <b>' + esc(me) + '</b></span></div>'
                : '<div class="wl-facts"><span class="f">' + (d ? '<b class="c3-num">' + d + '</b> days free. No card.' : 'Free to start. No card.') + '</span>' +
                '<button type="button" class="c3-link wl-in" data-act="signin" data-key="signin">I have an account</button></div>') +
            '</div>' +
          '<p class="wl-med" style="margin:14px 0 0;font-size:12.5px;opacity:.62;max-width:52ch;line-height:1.45">Nothing in the app is medical advice, diagnosis or treatment. Check with your doctor before changing how you train, what you eat, or anything you take.</p>' +
          '</section>' +
        '</div>' +
        '<section class="wl-team" aria-label="Your four coaches">' +
          '<div class="wl-team-h"><span class="lbl">Your four coaches</span>' +
            '<button type="button" class="c3-link wl-meet" data-act="story" data-key="story">Meet the team</button>' +
            '<span class="c3-tag" aria-hidden="true">Earned. Not given.</span></div>' +
          '<div class="wl-cos">' + coaches.map(coachHTML).join('') + '</div>' +
        '</section>' +
      '</div>';
    },
    wire: function(root){
      var bx = root.querySelector('#wl-agree');
      if(bx) bx.addEventListener('change', function(){ var e = root.querySelector('#wl-agree-err'); if(e && bx.checked) e.textContent = ''; });
      root.querySelectorAll('[data-act]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-act');
          if(a === 'setup' || a === 'signin'){
            /* terms + privacy consent (v2026-10-28): required before setup or sign-in; keep the version in step with terms.html */
            var box = root.querySelector('#wl-agree');
            if(box && !box.checked){
              var err = root.querySelector('#wl-agree-err');
              try{ box.focus(); box.scrollIntoView({block:'center', behavior:'smooth'}); }catch(e){}
              if(err) err.textContent = 'Tick the box above to agree to the Terms and Privacy Policy, then tap again.';
              return;
            }
            try{ localStorage.setItem('ff-terms-accept', JSON.stringify({v:'2026-10-28', at:Date.now()})); }catch(e){}
            if(a === 'setup'){ try{ openOnboarding(); }catch(e){ console.error('[c3] welcome setup', e); } }
            else openSignIn();
          }
          else if(a === 'story') openTeam();
        });
      });
    }
  });
})();

