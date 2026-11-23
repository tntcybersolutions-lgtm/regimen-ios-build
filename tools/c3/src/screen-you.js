/* C3 screen: you. The account place.
   The team picture, who is signed in, the plan from the app's own trialInfo(), the
   four coaches with a Talk control each, the walkthrough ("Meet the team", the only
   door to openStory), and a quiet list into the old deep screens and settings that
   really exist.

   THE PLAN BLOCK is where Pro is sold on the web (v298, window.BILLING, billing.js):
     billing not live      one line, "Pro opens soon. Everything is free until then."
                           No price, no control: there is nothing to press.
     live, signed out      the trial, the plans and their prices, "Sign in to go Pro".
     live, signed in       the trial as the SERVER counts it, the plans the server says
                           are configured, the consent box, ONE primary: "Start Pro".
     paid                  the plan's name, the date it is paid through, "Manage or cancel".
     back from Stripe      "Confirming your payment" until the server says paid; a
                           canceled checkout says nothing was charged.
   Inside the iPhone / Android shell none of that applies: the block is the one it was,
   and Go Pro calls the app's own buyPro() (the store). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function toast(msg, tone){ try{ say(msg, tone); }catch(e){} }

  /* ---------- local icons (the shared set has no talk, pictures, chevron or settings glyphs) ---------- */
  var IC = {
    talk:    '<path d="M5 5h14v10.5H10.500L6.500 19v-3.500H5z"></path>',
    pics:    '<rect x="3.5" y="6.5" width="14" height="12" rx="2"></rect><path d="M7 3.500h11.500a2 2 0 0 1 2 2V15"></path><path d="M4.500 16l3.500-3.500 3 3 2-2 3.500 3.500"></path>',
    chev:    '<path d="M9 5l7 7-7 7"></path>',
    account: '<circle cx="12" cy="8.5" r="3.6"></circle><path d="M4.500 20c1.200-3.600 4-5.400 7.500-5.400s6.300 1.800 7.500 5.400"></path>',
    plan:    '<path d="M5 4.500h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"></path><path d="M5 17a3 3 0 0 1 3-3h11"></path>',
    crew:    '<circle cx="9" cy="9" r="3"></circle><path d="M3.500 19c.8-3 2.900-4.500 5.500-4.500s4.700 1.500 5.500 4.500"></path><circle cx="17" cy="8" r="2.400"></circle><path d="M16.500 14.600c2.100.3 3.500 1.700 4 4"></path>',
    report:  '<path d="M7 3.500h7l4 4v13H7z"></path><path d="M14 3.500v4h4"></path><path d="M10 12h5"></path><path d="M10 16h5"></path>',
    bell:    '<path d="M6.500 16.500V11a5.500 5.500 0 0 1 11 0v5.500l1.500 2H5z"></path><path d="M10.500 21h3"></path>',
    units:   '<path d="M4 15.500L15.500 4l4.500 4.500L8.500 20z"></path><path d="M8 12l1.500 1.500"></path><path d="M11 9l1.500 1.500"></path><path d="M14 6l1.500 1.500"></path>',
    heart:   '<path d="M12 20s-7.500-4.500-7.500-10A4.200 4.200 0 0 1 12 7.500 4.200 4.200 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10z"></path>',
    exp:     '<path d="M12 4v11"></path><path d="M7.500 10.500L12 15l4.500-4.500"></path><path d="M5 19.500h14"></path>',
    checkin: '<rect x="4" y="5.500" width="16" height="14" rx="2"></rect><path d="M4 10h16"></path><path d="M8.500 3.500v4"></path><path d="M15.500 3.500v4"></path><path d="M9 14.500l2 2 4-4"></path>',
    setup:   '<path d="M4 7h10"></path><path d="M18 7h2"></path><path d="M4 17h2"></path><path d="M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle>',
    out:     '<path d="M10 4.500H5.500v15H10"></path><path d="M10 12h9.500"></path><path d="M15.500 8l4 4-4 4"></path>',
    print:   '<path d="M7 8V4h10v4"></path><rect x="4" y="8" width="16" height="8" rx="2"></rect><path d="M7 14h10v6H7z"></path>',
    /* v345: Post and go live, a camera with the live dot */
    live:    '<path d="M3.500 8.500h3l1.600-2.500h7.800l1.600 2.500h3v10h-17z"></path><circle cx="12" cy="13.200" r="3.400"></circle><circle cx="18.600" cy="5" r="1.600" fill="currentColor" stroke="none"></circle>',
    /* v342: the guide, an open book */
    guide:   '<path d="M12 6.500C10 5 7.500 4.500 4 4.500v13c3.500 0 6 .5 8 2 2-1.500 4.500-2 8-2v-13c-3.500 0-6 .5-8 2z"></path><path d="M12 6.500v13"></path>'
  };
  function ic(name, size, sw){
    return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IC[name] || '') + '</svg>';
  }

  /* ---------- facts, read from the app at call time ---------- */
  /* {signedIn, email, cloud (accounts reachable in this build), name} */
  function who(){
    var cloud = safe(function(){ return !!CLOUD_OK; }, false);
    var inn = cloud && safe(function(){ return !!CLOUD.signedIn(); }, false);
    var u = inn ? safe(function(){ return CLOUD.user(); }, null) : null;
    return {cloud: cloud, signedIn: inn, email: (u && u.email) || '', name: safe(function(){ return displayName(); }, '') || ''};
  }
  /* the sync state in the app's own words (paintSync), or '' when there is nothing to sync */
  function syncWord(){
    return safe(function(){
      if(!canSync()) return '';
      return SYNC.state === 'busy' ? 'Syncing…'
           : SYNC.state === 'error' ? 'Last sync failed, ' + SYNC.err
           : SYNC.auto ? 'Synced ' + agoWord(SYNC.at)
           : 'Automatic sync is off · last synced ' + agoWord(SYNC.at);
    }, '');
  }
  /* {state:'paid'|'active'|'expired', daysLeft} straight from trialInfo() */
  function plan(){ return safe(function(){ var t = trialInfo(); return {state: t.state, daysLeft: t.daysLeft | 0}; }, null); }
  function canBuy(){ return safe(function(){ return !!store(); }, false); }
  /* the web's billing view, or null inside the phone shell (and if the module is not there) */
  function bill(){ return safe(function(){ var B = window.BILLING; return (B && B.web()) ? B : null; }, null); }
  /* how many frames of the walkthrough carry a picture; 0 until the manifest is in */
  function storyPictures(){ return safe(function(){ return STORY.data.steps.filter(function(s){ return !!s.image; }).length; }, 0) || 0; }
  function healthReady(){ return safe(function(){ var R = window.RUN; return !!(R && R.native && R.health && R.health.available()); }, false); }
  function buildTag(){ return safe(function(){ return String((document.querySelector('.buildtag') || {}).textContent || '').trim(); }, ''); }
  function checkinDay(){ return safe(function(){ return (ALL.prefs && ALL.prefs.checkinDay != null && ALL.body && ALL.body.sex) ? (ALL.prefs.checkinDay | 0) % 7 : null; }, null); }
  function hasFn(name){ return typeof window[name] === 'function'; }

  /* ---------- doors into the old app (shared ones live in helpers.js) ---------- */
  var openYou = h.openYou, openSignIn = h.openSignIn, openTeam = h.openTeam;
  /* GO PRO: the app's purchase entry point, with the lock layer's own messages */
  var buying = false;
  function goPro(){
    if(buying) return; buying = true;
    var end = function(){ buying = false; C3.refresh(); };
    try{
      Promise.resolve(buyPro()).then(function(r){
        if(r && r.ok) toast('Pro is on. Everything is open.');
        else if(r && r.why === 'no-store') toast('Nothing is sold in this build. Your membership rides on your FORMED account.', 'bad');
        else if(!r || r.why !== 'canceled') toast('That purchase did not go through.', 'bad');
        end();
      }, function(){ toast('That purchase did not go through.', 'bad'); end(); });
    }catch(e){ end(); console.error('[c3] you buy', e); }
  }
  function restore(){
    try{
      Promise.resolve(restorePro()).then(function(r){ toast(r && r.ok ? 'Purchase restored.' : 'Nothing to restore on this account.', r && r.ok ? '' : 'bad'); C3.refresh(); },
        function(){ toast('Nothing to restore on this account.', 'bad'); });
    }catch(e){ console.error('[c3] you restore', e); }
  }
  /* SIGN OUT: the app's own handler lives on the Account screen's button (#acOut): it syncs
     first, signs out, clears the crew and repaints. That exact handler is run. */
  var outWatch = 0;
  function signOut(){
    try{
      renderAccount();
      var b = document.getElementById('acOut');
      if(!b){ openYou('youaccount', 'acctCard'); return; }
      b.click();
      /* the handler is async (it syncs first): watch for the session to end, then say so and repaint */
      if(outWatch) clearInterval(outWatch);
      var n = 0;
      outWatch = setInterval(function(){
        var inn = safe(function(){ return !!CLOUD.signedIn(); }, false);
        if(inn && ++n < 80) return;
        clearInterval(outWatch); outWatch = 0;
        if(!inn) toast('Signed out. Everything you logged is still on this device.');
        C3.refresh();
      }, 250);
    }catch(e){ console.error('[c3] you sign out', e); }
  }
  /* EXPORT: the app's own "Export everything" (dataPanel('exp'): the whole log as JSON, to copy or
     save as a file). It used to exist only on the peptide schedule screen; since v297 the app can
     put the panel on the Account screen, which every mode has. */
  function exportData(){
    openYou('youaccount', 'acctCard');
    try{ dataPanel('exp', document.getElementById('acctCard')); }catch(e){ console.error('[c3] you export', e); }
    setTimeout(function(){ try{ var el = document.getElementById('dataBox'); if(el) el.scrollIntoView({block:'center'}); }catch(e){} }, 180);
  }
  function editSetup(step){
    try{
      openSetupEdit();
      if(step){ var i = onbFlow().indexOf(step); if(i > 0){ ONB.step = i; onbRender(); } }
    }catch(e){ console.error('[c3] you setup', e); }
  }

  /* ---------- pieces ---------- */
  function nameHTML(n){
    if(!n) return 'Yo<span class="pk">u</span>';
    var w = String(n).trim().split(/\s+/);
    if(w.length < 2) return esc(w[0]);
    return esc(w.slice(0, -1).join(' ')) + ' <span class="pk">' + esc(w[w.length - 1]) + '</span>';
  }
  function coachHTML(c){
    var parts = String(c.name).split(' '), first = parts[0], rest = parts.slice(1).join(' ');
    var role = String(c.role || '').split(' · ');
    return '<div class="yu-co">' +
      '<img class="yu-face" src="' + esc(c.badge) + '" alt="" width="150" height="150" decoding="' + (h.isWarm && h.isWarm(c.badge) ? 'sync' : 'async') + '">' +
      '<span class="yu-co-n">' + esc(first) + (rest ? '<span class="x"> ' + esc(rest) + '</span>' : '') + '</span>' +
      '<span class="yu-co-r">' + esc(role[0]) + (role.length > 1 ? '<span class="x"> · ' + esc(role.slice(1).join(' · ')) + '</span>' : '') + '</span>' +
      '<button type="button" class="c3-btn-quiet pink yu-talk" data-coach="' + esc(c.id) + '" data-key="talk-' + esc(c.id) + '" aria-label="Talk to ' + esc(c.name) + '">' + ic('talk', 17, 2.2) + '<span>Talk</span></button>' +
    '</div>';
  }
  function planHTML(P){
    if(!P) return '';
    var offer = safe(function(){ return proOffer(); }, null);   /* v369: the only Pro control is what the app itself offers (the shell: a sign-in, or nothing) */
    var block, fact;
    if(P.state === 'signedout'){
      /* v369: no account, no trial and no plan to show: the block asks for the sign-in */
      return '<section class="yu-plan signedout" aria-label="Your plan" data-state="signedout"><div class="yu-trial"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v">Sign in</span></span></div>' +
        '<p class="yu-fact">Your trial and your plan live on your FORMED account.</p>' +
        '<div class="yu-buy"><button type="button" class="c3-btn-primary yu-go" data-act="pro" data-key="pro"><span>Sign in</span>' + h.icon('arrow', 50, 3) + '</button></div></section>';
    }
    if(P.state === 'pending'){
      /* v370: the account's answer has not arrived: say so, and give the retry. Never reads as Pro. */
      return '<section class="yu-plan pending" aria-label="Your plan" data-state="pending"><div class="yu-trial"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v">Checking</span></span></div>' +
        '<p class="yu-fact">Checking your membership. This takes a connection.</p>' +
        (offer ? '<div class="yu-buy"><button type="button" class="c3-btn-primary yu-go" data-act="pro" data-key="pro"><span>' + esc(offer.label) + '</span>' + h.icon('arrow', 50, 3) + '</button></div>' : '') + '</section>';
    }
    if(P.state === 'paid'){
      block = '<div class="yu-trial paid"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v pk">Pro</span></span></div>';
      fact = 'Pro is on. Everything is open.';
    }else if(P.state === 'open'){
      /* v338: the phone app while it sells nothing: everything is open, and there is nothing to press */
      return '<section class="yu-plan open" aria-label="Your plan" data-state="open"><div class="yu-trial open"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v">Free</span></span></div>' +
        '<p class="yu-fact">Everything is open.</p></section>';
    }else if(P.state === 'active'){
      block = '<div class="yu-trial" role="img" aria-label="Trial, ' + P.daysLeft + ' day' + (P.daysLeft === 1 ? '' : 's') + ' left"><b class="yu-n c3-num">' + P.daysLeft + '</b>' +
              '<span class="yu-tw"><span class="k"><i></i>Trial</span><span class="v">day' + (P.daysLeft === 1 ? '' : 's') + ' left</span></span></div>';
      fact = 'Everything is open. After the trial your log, food and training stay free.';
    }else{
      block = '<div class="yu-trial over"><span class="yu-tw"><span class="k"><i></i>Trial</span><span class="v">Ended</span></span></div>';
      fact = 'Your log, food and training stay free. The reading screens need Pro.';
    }
    var buy = (P.state === 'paid' || !offer) ? '' :
      '<div class="yu-buy"><button type="button" class="c3-btn-primary yu-go" data-act="pro" data-key="pro"><span>' + esc(offer.label) + '</span>' + h.icon('arrow', 50, 3) + '</button></div>';
    return '<section class="yu-plan ' + esc(P.state) + '" aria-label="Your plan" data-state="' + esc(P.state) + '">' + block + '<p class="yu-fact">' + fact + '</p>' + buy + '</section>';
  }
  /* ---------- the plan block on the web ---------- */
  function daysWord(n){ return n + ' day' + (n === 1 ? '' : 's'); }
  /* which plan is selected: the person's tap, else the one they picked before signing in, else yearly, else the first */
  function pick(V, st){
    var ids = V.plans.map(function(p){ return p.id; });
    if(st.plan && ids.indexOf(st.plan) >= 0) return st.plan;
    if(V.want && ids.indexOf(V.want) >= 0) return V.want;
    if(ids.indexOf('yearly') >= 0) return 'yearly';
    return ids[0] || '';
  }
  function optHTML(p, on){
    var sub = p.id === 'founding' && p.left > 0 ? 'First 100 members. <span class="c3-num">' + p.left + '</span> left.' : '';
    return '<button type="button" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" class="yu-opt' + (on ? ' on' : '') + '" data-plan="' + esc(p.id) + '" data-key="plan-' + esc(p.id) + '">' +
      '<span class="rd" aria-hidden="true"></span>' +
      '<span class="nm">' + esc(p.name) + (p.save > 0 ? '<span class="sv">Save ' + p.save + '%</span>' : '') + '</span>' +
      '<span class="pr"><b class="c3-num">' + esc(p.price) + '</b><span class="pp"> / ' + esc(p.per) + '</span></span>' +
      (sub ? '<span class="lf">' + sub + '</span>' : '') +
    '</button>';
  }
  var RET = {
    checking:    'Confirming your payment with Stripe.',
    pending:     'Stripe has not confirmed the payment to the app yet. Pro turns on here by itself when it does. There is no need to pay again.',
    paid:        'Payment confirmed. Pro is on.',
    canceled:    'Checkout canceled. Nothing was charged.',
    unconfirmed: 'No payment has reached this account. If your card was charged, contact us from your Stripe receipt.',
    signin:      'Sign in to finish. Your payment belongs to your account.'
  };
  function retHTML(V){
    var k = V.ret; if(!k || !RET[k]) return '';
    return '<p class="yu-ret ' + esc(k) + '" role="status" data-ret="' + esc(k) + '">' + RET[k] + '</p>';
  }
  function buyWebHTML(V, st){
    /* a payment is on its way: no pay control until the server has answered, so nobody pays twice */
    if(V.ret === 'signin'){
      return retHTML(V) + '<div class="yu-buy"><button type="button" class="c3-btn-primary yu-go" data-act="signin" data-key="pro"><span>Sign in</span>' + h.icon('arrow', 50, 3) + '</button></div>';
    }
    if(V.ret === 'checking' || V.ret === 'pending' || V.pending){
      return retHTML({ret: V.ret === 'pending' ? 'pending' : 'checking'}) +
        (V.ret === 'pending' ? '<div class="yu-buy"><button type="button" class="c3-btn-quiet yu-manage" data-act="recheck" data-key="recheck">Check again</button></div>' : '');
    }
    if(V.lapsed){
      return retHTML(V) + '<p class="yu-ret pending" role="status" data-ret="lapsed">' + esc(V.lapsed.name) + '. Your last payment did not go through, so Pro is paused. Update your card and it comes back.</p>' +
        '<div class="yu-buy"><button type="button" class="c3-btn-quiet yu-manage" data-act="manage" data-key="manage"' + (V.busy === 'portal' ? ' disabled aria-disabled="true"' : '') + '>' + (V.busy === 'portal' ? 'Opening billing' : 'Update card or cancel') + '</button></div>' +
        (V.msg ? '<p class="yu-msg" role="alert">' + esc(V.msg) + '</p>' : '');
    }
    var sel = pick(V, st), cur = V.plans.filter(function(p){ return p.id === sel; })[0];
    var opts = V.plans.length ? '<div class="yu-opts" role="radiogroup" aria-label="Choose a plan">' + V.plans.map(function(p){ return optHTML(p, p.id === sel); }).join('') + '</div>' : '';
    var out = retHTML(V) + opts;
    if(!cur) return out + '<p class="yu-fine">No plan is open right now.</p>';
    if(!V.signedIn){
      return out +
        '<div class="yu-buy"><button type="button" class="c3-btn-primary yu-go long" data-act="pro" data-key="pro"><span>Sign in to go Pro</span>' + h.icon('arrow', 50, 3) + '</button></div>' +
        '<p class="yu-fine">Pro belongs to an account, so it follows you to every device. Cancel anytime.</p>';
    }
    var busy = V.busy === 'pay', agreed = !!st.agree && st.agree === V.terms.version, ok = agreed && !busy;
    return out +
      '<label class="yu-agree"><input type="checkbox" data-agree data-key="agree"' + (agreed ? ' checked' : '') + (busy ? ' disabled' : '') + '>' +
        '<span id="yuAgreeTxt">I agree to the <a href="' + esc(V.terms.url) + '" target="_blank" rel="noopener">Terms</a> and <a href="' + esc(V.terms.privacy) + '" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>' +
      '<div class="yu-buy"><button type="button" class="c3-btn-primary yu-go" data-act="pro" data-key="pro"' + (busy ? ' disabled aria-disabled="true"' : '') + (agreed ? '' : ' data-need="agree" aria-describedby="yuAgreeTxt"') + '>' +
        '<span>' + (busy ? 'Opening checkout' : 'Start Pro') + '</span>' + h.icon('arrow', 50, 3) + '</button></div>' +
      '<p class="yu-fine"><span class="c3-num">' + esc(cur.price) + '</span> today, then every ' + esc(cur.per) + ' until you cancel. Cancel anytime from this screen. No refunds except billing mistakes.</p>' +
      (V.msg ? '<p class="yu-msg" role="alert">' + esc(V.msg) + '</p>' : '');
  }
  function planWebHTML(V, st){
    var s = V.state, block, fact, body = '';
    if(s === 'paid'){
      block = '<div class="yu-trial paid"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v pk">Pro</span></span></div>';
      fact = !V.paid ? 'Pro is on. Everything is open.'
        : V.paid.pastDue ? esc(V.paid.name) + '. Your last payment did not go through. Update your card under Manage or cancel.'
        : V.paid.life ? 'Pro for life. Everything is open, nothing to pay.'
        : esc(V.paid.name) + '.' + (V.paid.through ? ' Paid through ' + esc(V.paid.through) + '.' : '');
      body = retHTML(V) + (V.paid && !V.paid.life ? '<div class="yu-buy"><button type="button" class="c3-btn-quiet yu-manage" data-act="manage" data-key="manage"' + (V.busy === 'portal' ? ' disabled aria-disabled="true"' : '') + '>' +
        (V.busy === 'portal' ? 'Opening billing' : 'Manage or cancel') + '</button></div>' + (V.msg ? '<p class="yu-msg" role="alert">' + esc(V.msg) + '</p>' : '') : '');
    }else if(s === 'open'){
      /* nothing is sold yet: no price, no control, nothing locked */
      block = '<div class="yu-trial open"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v">Free</span></span></div>';
      fact = 'Pro opens soon. Everything is free until then.';
    }else{
      if(s === 'active'){
        block = '<div class="yu-trial" role="img" aria-label="Trial, ' + daysWord(V.daysLeft) + ' left"><b class="yu-n c3-num">' + V.daysLeft + '</b>' +
                '<span class="yu-tw"><span class="k"><i></i>Trial</span><span class="v">day' + (V.daysLeft === 1 ? '' : 's') + ' left</span></span></div>';
        fact = 'Everything is open. After the trial your log, food and training stay free.';
      }else if(V.lapsed){
        /* had Pro, the card failed: this is not a trial that ended, and it is not called one */
        block = '<div class="yu-trial over"><span class="yu-tw"><span class="k"><i></i>Plan</span><span class="v">Paused</span></span></div>';
        fact = 'Your log, food and training stay free. The reading screens need Pro.';
      }else{
        block = '<div class="yu-trial over"><span class="yu-tw"><span class="k"><i></i>Trial</span><span class="v">Ended</span></span></div>';
        fact = 'Your log, food and training stay free. The reading screens need Pro.';
      }
      body = buyWebHTML(V, st);
    }
    return '<section class="yu-plan web ' + esc(s) + '" aria-label="Your plan" data-state="' + esc(s) + '" data-live="' + (V.live ? '1' : '0') + '">' + block + '<p class="yu-fact">' + fact + '</p>' + body + '</section>';
  }
  function row(act, icon, label, val, key){
    return '<li><button type="button" class="yu-row" data-act="' + act + '" data-key="' + (key || act) + '">' + ic(icon, 19, 1.8) +
      '<span class="l">' + esc(label) + '</span>' + (val ? '<span class="v">' + esc(val) + '</span>' : '') + ic('chev', 16, 2.2) + '</button></li>';
  }

  C3.screen('you', {
    nav: 'you',
    render: function(ctx){
      var W = who(), P = plan(), coaches = h.coaches(), n = storyPictures(), tag = buildTag(), ck = checkinDay();
      var B = bill(), V = B ? safe(function(){ return B.view(); }, null) : null;
      var groups = safe(function(){ return (GROUPS.profile || []).map(function(x){ return x[0]; }); }, []);
      var has = function(p){ return groups.indexOf(p) >= 0; };

      var team = '<section class="yu-team" aria-label="Your team">' +
        '<div class="yu-pic">' + h.pictureHTML('one-team-every-goal', {eager:true}) + '</div>' +
        '<button type="button" class="yu-meet" data-act="story" data-key="story">' + ic('pics', 30, 2) + '<span class="t">Meet the team</span>' +
          '<span class="n">' + (n ? '<span class="c3-num">' + n + ' pictures</span>' : '') + h.icon('arrow', 28, 2.6) + '</span></button>' +
        '<div class="yu-coaches" role="group" aria-label="Your coaches">' +
          '<div class="yu-lbl">Your coaches<span class="c3-num">' + coaches.length + '</span></div>' +
          '<div class="yu-cos">' + coaches.map(coachHTML).join('') + '</div></div>' +
      '</section>';

      var state = !W.cloud ? '<span class="s">Your log lives on this device.</span>'
        : W.signedIn ? '<span class="s on"><i></i>Signed in</span>' + (W.email ? '<span class="e">' + esc(W.email) + '</span>' : '')
        : '<span class="s">Not signed in. Your log lives on this device.</span>';
      var sync = W.signedIn ? syncWord() : '';
      var me = '<section class="yu-me" aria-label="Your account">' +
        '<div class="c3-eyebrow yu-eye"><i></i>Your account</div>' +
        '<h1 class="c3-h1 yu-name' + (W.name.length > 14 ? ' len-l' : W.name.length > 8 ? ' len-m' : '') + '">' + nameHTML(W.name) + '</h1>' +
        '<p class="yu-who">' + state + '</p>' +
        (sync ? '<p class="yu-sync">' + esc(sync) + '</p>' : '') +
        '<p class="yu-guide">' + (W.signedIn
          ? 'Your account, reminders and plan live here. Start with Plan to see your trial and Pro options. Sign out is at the end of Settings.'
          : 'Sign in to back up your log and use it on every device. You can keep going without an account.') + '</p>' +
        (W.signedIn ? '' : '<button type="button" class="c3-btn-rail yu-signin" data-act="signin" data-key="signin"><span>Sign in or create account</span>' + h.icon('arrow', 26, 2.8) + '</button>') +
      '</section>';

      /* v363 (Chad, 27 Oct: "You still has 14 settings rows"): Settings holds the settings a person changes; the
         guide, benefits, shop, printing, posting, crew, report and export fold behind one More under it */
      var list = '', more = '';
      if(has('youaccount')) list += row('account', 'account', 'Account', '');
      if(has('youplan'))    list += row('plan', 'plan', 'Plan', '');
      if(has('youaccount')) list += row('reminders', 'bell', 'Reminders', '');
      if(has('youaccount')) list += row('units', 'units', 'Units', h.fmt.unit());
      if(hasFn('openSetupEdit') && ck != null) list += row('checkin', 'checkin', 'Check-in day', h.fmt.dayAbbr(ck).charAt(0) + h.fmt.dayAbbr(ck).slice(1).toLowerCase());
      if(hasFn('openSetupEdit') && safe(function(){ return !!(ALL.body && ALL.body.sex); }, false)) list += row('setup', 'setup', 'Edit my setup', '');
      if(has('youaccount') && healthReady()) list += row('health', 'heart', 'Apple Health', '');
      /* v315: the heart rate monitor (a strap, a watch, earbuds; Apple Watch through Health in the app) */
      if(safe(function(){ return heartAny() || !!HEART.kind; }, false)) list += row('heartrate', 'heart', 'Heart rate', safe(function(){ return HEART.kind ? (heartFresh() && HEART.bpm ? HEART.bpm + ' bpm' : heartLabel()) : ''; }, ''));
      if(W.signedIn) list += row('signout', 'out', 'Sign out', '');
      /* v342: their own copy of the free guide, filled in from the log (the guide screen) */
      if(C3.screens.guide) more += row('guide', 'guide', 'Your guide', '');
      if(C3.screens.member) more += row('member', 'plan', 'Member benefits', '');
      if(C3.screens.shop) more += row('shop', 'out', 'Shop', '');
      if(C3.screens.docs) more += row('docs', 'print', 'Print your plan', '');   /* v347: workouts, food, doses as a document */
      /* v345: the studio and the live board for TikTok, Facebook, YouTube and X, from here as well as after a workout */
      if(C3.screens.post) more += row('post', 'live', 'Post and go live', safe(function(){ return C3.live && C3.live.on() ? 'Live board on' : ''; }, ''));
      if(has('youcrew'))    more += row('crew', 'crew', 'Crew', '');
      if(has('report'))     more += row('report', 'report', 'Report', '');
      more += row('export', 'exp', 'Export my data', '');

      /* v339: you and your settings first; the plan after them; the coaches and their pictures last (Chad's approved plan, 18 Oct) */
      return '<div class="yu ' + (W.signedIn ? 'in' : 'out') + '">' + me +
        '<section class="yu-set" aria-label="Settings"><div class="yu-lbl">Settings</div><ul class="yu-list">' + list + '</ul>' +
          h.moreHTML('you', more ? '<ul class="yu-list yu-more">' + more + '</ul>' : '', 'More settings') + '</section>' +
        (V ? planWebHTML(V, ctx.state) : planHTML(P)) +
        '<div class="yu-tag">' + (!V && P && P.state !== 'paid' && canBuy() ? '<button type="button" class="c3-link yu-restore" data-act="restore" data-key="restore">Restore a purchase</button>' : '') +
          '<span class="c3-tag" aria-hidden="true">Earned. Not given.</span></div>' +
        team +
        (tag ? '<p class="yu-build">Build <span class="c3-num">' + esc(tag) + '</span></p>' : '') +
      '</div>';
    },
    wire: function(root, ctx){
      var B = bill(), st = ctx.state;
      if(B){
        var V = safe(function(){ return B.view(); }, null);
        /* the plan picked before signing in is the one selected now; the note of it has done its job */
        if(V && V.signedIn && V.want){ if(!st.plan) st.plan = V.want; B.clearWant(); }
        root.querySelectorAll('[data-plan]').forEach(function(b){ b.addEventListener('click', function(){ ctx.set({plan: b.getAttribute('data-plan')}); }); });
        var box = root.querySelector('[data-agree]');
        /* what is remembered is WHICH version was agreed to: new terms mean an empty box */
        if(box) box.addEventListener('change', function(){ var Vc = safe(function(){ return B.view(); }, null); ctx.set({agree: (box.checked && Vc) ? (Vc.terms.version || 'x') : ''}); });
        /* arriving from a Pro control, from Stripe or from the sign-in: the plan block is what they came for */
        if(ctx.params && ctx.params.plan && !st.shown){
          st.shown = 1;
          setTimeout(function(){ try{
            var el = C3.root.querySelector('.yu-plan'); if(!el) return;
            var bar = C3.root.querySelector('.c3-top'), off = (bar ? bar.getBoundingClientRect().height : 60) + 12;
            var y = el.getBoundingClientRect().top + window.pageYOffset - off;
            if(el.getBoundingClientRect().bottom > window.innerHeight || el.getBoundingClientRect().top < off) window.scrollTo(0, Math.max(0, y));
          }catch(e){} }, 80);
        }
      }
      root.querySelectorAll('[data-act]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-act');
          if(a === 'story') openTeam();
          else if(a === 'signin') openSignIn();
          else if(a === 'pro' && B){
            var Vn = safe(function(){ return B.view(); }, null); if(!Vn) return;
            var sel = pick(Vn, st);
            if(!Vn.signedIn){ B.goSignIn(sel); toast('Sign in to go Pro. Your plan choice is next.'); }
            else if(!(st.agree && st.agree === Vn.terms.version)){
              /* not agreed yet: the button stays lit (a gray button reads as broken); the tap
                 points at the one thing left to do instead of sending anything */
              var ag = root.querySelector('.yu-plan .yu-agree'), box = ag && ag.querySelector('input');
              if(ag){ ag.classList.remove('yu-need'); void ag.offsetWidth; ag.classList.add('yu-need');
                ag.scrollIntoView({block:'center', behavior:'smooth'}); if(box) box.focus({preventScroll:true}); }
              toast('Tick the box to agree to the Terms, then tap Start Pro.');
            }
            else B.checkout(sel, true);
          }
          else if(a === 'manage' && B) B.manage();
          else if(a === 'recheck' && B) B.checkAgain();
          else if(a === 'pro') goPro();
          else if(a === 'restore') restore();
          else if(a === 'guide') C3.go('guide');
          else if(a === 'member') C3.go('member');
          else if(a === 'shop') C3.go('shop');
          else if(a === 'post') C3.go('post');
          else if(a === 'docs') C3.go('docs', {from: 'you'});
          else if(a === 'account') openYou('youaccount', 'acctCard');
          else if(a === 'plan') openYou('youplan');
          else if(a === 'crew') openYou('youcrew');
          else if(a === 'report') C3.deep('profile', 'report');
          else if(a === 'reminders') openYou('youaccount', 'remCard');
          else if(a === 'units') openYou('youaccount', 'prefCard');
          else if(a === 'health') openYou('youaccount', 'healthCard');
          else if(a === 'heartrate') C3.sheet('heart');
          else if(a === 'export') exportData();
          else if(a === 'checkin') editSetup('checkin');
          else if(a === 'setup') editSetup('');
          else if(a === 'signout') signOut();
        });
      });
    }
  });

  /* signing in or out anywhere repaints this screen */
  try{
    if(typeof CLOUD !== 'undefined' && CLOUD.onChange) CLOUD.onChange(function(){ C3.refresh(); });
  }catch(e){}
})();
