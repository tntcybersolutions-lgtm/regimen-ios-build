/* C3 billing: web payments, and the server as the one that says who has Pro.
   One global, window.BILLING. It does not need C3 to be mounted (a shared record
   has no C3) and it does nothing at all inside the iPhone / Android shell, where
   the store is StoreKit / Play Billing and the app's own code is left as it was.

   The four doors (api/, all on this same origin):
     GET  /api/config        which switches are on: billingLive, plans, trialDays,
                             trialFrom, terms, aiRequirePro, ready
     GET  /api/entitlement   Authorization: Bearer <token>   paid, plan, status,
                             periodEnd, trial:{state, daysLeft, endsAt}
     GET  /api/pay           foundingLeft (the real number, or null)
     POST /api/pay           {plan, agree:true, terms:<version>} -> {url}
     POST /api/pay-portal    -> {url}   (Manage or cancel)

   WHO DECIDES (the app asks through ONE function, trialInfo() in index.html,
   which calls BILLING.truth()):
     billing is not live, or the server has never been reached
         -> 'open': nothing is locked and nothing is sold. Nobody is locked out
            of an app that has no way to take their money.
     billing is live and the server has answered for this account
         -> the server's answer: paid, or the trial it counted (endsAt).
            Nothing on the device can change it: not ALL.ent.paid, not the clock
            of first launch.
     billing is live and there is no answer for this person (signed out, or
     signed in and the server cannot be reached and never has been)
         -> the device counts a trial of the server's length (trialDays, from
            trialFrom). A paid flag on the device is NOT honored: on the web the
            only thing that can say "paid" is the server.
     the server cannot be reached but has answered this account before
         -> the last answer stands (kept in localStorage): somebody who was paid
            at the last check keeps Pro through a dropped connection, somebody
            who was not does not get it by going offline.

   The prices are display text tied to the plan ids the server reports. The amount
   a member is charged is the Stripe Price behind that id; the two are kept equal
   by hand (docs/billing/README.md).

   Everything here is safe to call at any time and never throws. */
(function(){
  'use strict';
  if(window.BILLING) return;

  var DAY = 86400000;
  var K_CFG = 'theregimen.billing.config', K_ENT = 'theregimen.billing.ent', K_PEND = 'theregimen.billing.pending', K_WANT = 'theregimen.billing.want';
  var PEND_MS = 10 * 60000;             /* how long "your payment is being confirmed" stands in for the pay control */
  var POLL = [0, 1500, 2500, 4000, 6000, 8000, 10000];   /* after checkout: the browser can beat the webhook */

  /* Chad's prices. cents are for the one sum on screen (what yearly saves). */
  var PRICES = {
    /* v309: these are only the fallback until GET /api/pay answers with what Stripe actually charges
       (the Stripe prices made on 11 Oct 2026 were $12.99 and $79.99; the screen still said $14.99 and $89.99) */
    monthly:  {id:'monthly',  name:'Monthly',  full:'Pro monthly',     price:'$12.99', per:'month', cents:1299, months:1},
    yearly:   {id:'yearly',   name:'Yearly',   full:'Pro yearly',      price:'$79.99', per:'year',  cents:7999, months:12},
    founding: {id:'founding', name:'Founding', full:'Founding yearly', price:'$59.99', per:'year',  cents:5999, months:12}
  };
  /* what the server calls each plan on a subscription (api/pay.js PLANS) */
  var PLAN_NAMES = {pro_monthly:'Pro monthly', pro_yearly:'Pro yearly', founding_yearly:'Founding yearly', pro:'Pro', lifetime:'Pro for life'};   /* v327: lifetime, given by the owner (db 022 comp_grants) */
  var ORDER = ['founding', 'yearly', 'monthly'];

  var CFG = null;            /* the last answer of /api/config (this load, or kept from an earlier one) */
  var cfgFresh = false, cfgP = null, cfgTried = 0;
  var ENT = null;            /* the last answer of /api/entitlement: {uid, at, paid, plan, status, periodEnd, trial, fresh} */
  var entP = null;
  var FOUNDING = {left:null, at:0, p:null};
  var UI = {busy:'', msg:'', tone:'', ret:null};
  var lastUid = '', lastSig = '', pollTimer = 0, pollN = 0;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function lsGet(k){ try{ var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; }catch(e){ return null; } }
  function lsSet(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function ssGet(k){ try{ return sessionStorage.getItem(k) || ''; }catch(e){ return ''; } }
  function ssSet(k, v){ try{ if(v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); }catch(e){} }
  function toast(msg, tone){ try{ window.say(msg, tone); }catch(e){} }

  /* ---------- where we are ---------- */
  /* the iPhone / Android shell: read live, never captured (the bridge arrives late on a real device) */
  function native(){ return safe(function(){ return !!(window.RUN && window.RUN.native); }, false); }
  function web(){ return !native() && /^https?:$/.test(location.protocol); }
  function cloud(){ return safe(function(){ return (typeof CLOUD_OK === 'undefined' || !!CLOUD_OK) && typeof CLOUD !== 'undefined' && !!CLOUD; }, false); }
  function signedIn(){ return cloud() && safe(function(){ return !!CLOUD.signedIn(); }, false); }
  function uid(){ if(!signedIn()) return ''; var u = safe(function(){ return CLOUD.user(); }, null); return String((u && (u.id || u.email)) || 'member'); }

  /* ---------- fetch: a timeout, JSON, never a throw ---------- */
  function ask(url, opts, ms){
    var ac = (typeof AbortController === 'function') ? new AbortController() : null;
    var t = ac ? setTimeout(function(){ try{ ac.abort(); }catch(e){} }, ms || 8000) : 0;
    var o = opts || {};
    return fetch(url, {method: o.method || 'GET', headers: o.headers || {}, body: o.body, cache:'no-store', credentials:'omit', signal: ac ? ac.signal : undefined})
      .then(function(r){ return r.text().then(function(txt){ var body = null; try{ body = txt ? JSON.parse(txt) : null; }catch(e){} return {status:r.status, body: (body && typeof body === 'object') ? body : null}; }); })
      .catch(function(){ return {status:0, body:null}; })
      .then(function(v){ if(t) clearTimeout(t); return v; });
  }
  function token(){ return Promise.resolve(safe(function(){ return CLOUD.token(); }, null)).then(function(t){ return t || null; }, function(){ return null; }); }

  /* ---------- config ---------- */
  function shapeCfg(j){
    var p = j.plans || {}, t = j.terms || {}, r = j.ready || {};
    return {
      billingLive: j.billingLive === true, aiRequirePro: j.aiRequirePro === true,
      trialDays: (+j.trialDays > 0 && +j.trialDays < 366) ? Math.round(+j.trialDays) : 0,
      trialFrom: +j.trialFrom > 0 ? +j.trialFrom : 0,
      plans: {monthly: p.monthly === true, yearly: p.yearly === true, founding: p.founding === true},
      terms: {version: String(t.version || ''), url: String(t.url || '/terms'), privacy: String(t.privacy || '/privacy')},
      ready: {stripeKey: r.stripeKey === true, webhookSecret: r.webhookSecret === true, billingDb: r.billingDb === true},
      at: Date.now()
    };
  }
  /* once per load. A failed try may be repeated later (coming back online, the tab shown again). */
  function config(){
    if(!web()) return Promise.resolve(null);
    if(cfgP) return cfgP;
    cfgTried = Date.now();
    cfgP = ask('/api/config', null, 6000).then(function(r){
      var j = r.body;
      if(r.status === 200 && j && j.ok === true && typeof j.billingLive === 'boolean'){
        CFG = shapeCfg(j); cfgFresh = true; lsSet(K_CFG, CFG);
        if(live()) founding();   /* v309: also brings the real prices, so it runs whenever checkout is live */
      }else{
        cfgP = null;                         /* not an answer: the kept one (if any) stands, and a later call asks again */
      }
      changed();
      return cfg();
    });
    return cfgP;
  }
  function cfg(){
    if(!CFG) return null;
    return {billingLive: CFG.billingLive, plans: CFG.plans, trialDays: CFG.trialDays, trialFrom: CFG.trialFrom, terms: CFG.terms, aiRequirePro: CFG.aiRequirePro, ready: CFG.ready, fresh: cfgFresh};
  }
  /* can somebody actually pay right now? The switch, the key and at least one plan. */
  function live(){
    return web() && !!CFG && CFG.billingLive && CFG.ready.stripeKey && (CFG.plans.monthly || CFG.plans.yearly || CFG.plans.founding);
  }
  /* the founding count: the server's real number or null. Asked only when founding is on sale. */
  /* v309: the server's real amounts replace the fallback prices, so the screen and the charge agree */
  function applyPrices(P){
    if(!P || typeof P !== 'object') return;
    Object.keys(P).forEach(function(k){
      var x = P[k], row = PRICES[k];
      if(!row || !x || typeof x.cents !== 'number' || x.cents <= 0 || String(x.currency || '').toLowerCase() !== 'usd') return;
      row.cents = Math.round(x.cents); row.price = '$' + (row.cents / 100).toFixed(2);
    });
  }
  function founding(force){
    if(!live()) return Promise.resolve(null);
    if(FOUNDING.p) return FOUNDING.p;
    if(!force && FOUNDING.at && Date.now() - FOUNDING.at < 60000) return Promise.resolve(FOUNDING.left);
    FOUNDING.p = ask('/api/pay', null, 8000).then(function(r){
      var j = r.body, n = (r.status === 200 && j && j.ok === true && CFG.plans.founding && typeof j.foundingLeft === 'number' && j.foundingLeft >= 0) ? Math.floor(j.foundingLeft) : null;
      if(r.status === 200 && j && j.ok === true) applyPrices(j.prices);
      FOUNDING.left = n; FOUNDING.at = Date.now(); FOUNDING.p = null;
      changed();
      return n;
    });
    return FOUNDING.p;
  }

  /* ---------- entitlement ---------- */
  function entFor(){ var u = uid(); return (u && ENT && ENT.uid === u) ? ENT : null; }
  /* Single flight. Without force, an answer younger than a minute is reused. Returns the answer
     for the account that is signed in, or null (signed out, no token, server unreachable). */
  function entitlement(force){
    if(!web() || !signedIn()) return Promise.resolve(null);
    if(entP) return entP;
    var have = entFor();
    if(!force && have && have.fresh && Date.now() - have.at < 60000) return Promise.resolve(have);
    var who = uid();
    entP = token().then(function(tok){
      if(!tok) return null;
      return ask('/api/entitlement', {headers:{authorization:'Bearer ' + tok}}, 8000);
    }).then(function(r){
      entP = null;
      if(!r || who !== uid()) return null;          /* signed out, or another account, while this was in the air */
      var j = r.body;
      if(r.status === 200 && j && j.ok === true && typeof j.paid === 'boolean'){
        var t = j.trial || {};
        ENT = {uid: who, at: Date.now(), fresh: true, paid: j.paid, plan: j.plan ? String(j.plan) : '', status: j.status ? String(j.status) : '',
               periodEnd: j.periodEnd ? String(j.periodEnd) : '', lifetime:j.lifetime===true,accessVia:String(j.accessVia||''),
               trial: {state: String(t.state || 'unknown'), daysLeft: Math.max(0, +t.daysLeft || 0), endsAt: +t.endsAt > 0 ? +t.endsAt : 0}};
        lsSet(K_ENT, ENT);
        if(ENT.paid) lsSet(K_PEND, null);
        changed();
        return ENT;
      }
      changed();
      return null;                                   /* 401, 503, offline: no new answer. The kept one stands. */
    }, function(){ entP = null; return null; });
    return entP;
  }

  /* ---------- the truth, for trialInfo() ---------- */
  /* null                              the shell: the app's own code decides, as before
     {state:'open'}                    nothing is sold: everything open
     {state:'paid'|'active'|'expired'} the server's answer
     {local:true, days, from}          count on the device, with the server's trial length; a
                                       device "paid" flag is not honored */
  function truth(){
    if(!web()) return null;
    var e = entFor();
    var days = CFG ? CFG.trialDays : 0;
    if(e && e.paid) return {state:'paid', daysLeft:0, endsAt:0, days:days, plan:e.plan, status:e.status, periodEnd:e.periodEnd, source:'server'};
    if(!live()) return {state:'open', daysLeft:0, endsAt:0, days:0, source: CFG ? 'server' : 'none'};
    if(e && e.trial.endsAt > 0){
      var now = Date.now();
      if(now < e.trial.endsAt) return {state:'active', daysLeft: Math.max(1, Math.ceil((e.trial.endsAt - now) / DAY)), endsAt: e.trial.endsAt, days:days, source:'server'};
      return {state:'expired', daysLeft:0, endsAt: e.trial.endsAt, days:days, source:'server'};
    }
    return {local:true, days: days || 7, from: CFG.trialFrom || 0};
  }

  /* ---------- repaint when something a person can see has changed ---------- */
  function changed(){
    var sig = safe(function(){ return JSON.stringify([truth(), live(), signedIn(), FOUNDING.left, UI, pending(), CFG ? [CFG.terms, CFG.plans, CFG.trialDays, CFG.trialFrom] : 0]); }, '');
    if(sig === lastSig) return;
    lastSig = sig;
    try{ if(typeof window.entRepaint === 'function') window.entRepaint(); else if(window.C3 && window.C3.refresh) window.C3.refresh(); }catch(e){}
  }
  function note(msg, tone, quiet){ UI.msg = msg || ''; UI.tone = tone || ''; if(msg && !quiet) toast(msg, tone); changed(); }

  /* ---------- a payment that is on its way ---------- */
  function pending(){
    var p = lsGet(K_PEND);
    if(!p || !p.at) return false;
    if(Date.now() - p.at > PEND_MS || Date.now() < p.at - 60000 || (p.uid && p.uid !== uid())){ lsSet(K_PEND, null); return false; }
    var e = entFor();
    if(e && e.paid){ lsSet(K_PEND, null); return false; }
    return true;
  }
  function poll(){
    if(pollTimer){ clearTimeout(pollTimer); pollTimer = 0; }
    if(!signedIn()){ UI.ret = 'signin'; changed(); return; }
    var wait = pollN < POLL.length ? POLL[pollN] : 20000;
    pollTimer = setTimeout(function(){
      pollTimer = 0;
      entitlement(true).then(function(e){
        pollN++;
        if(e && e.paid){
          lsSet(K_PEND, null);
          UI.ret = 'paid'; UI.msg = ''; changed();
          toast('Payment confirmed. Pro is on.');
          return;
        }
        if(pending()){
          if(pollN >= POLL.length && UI.ret === 'checking'){ UI.ret = 'pending'; changed(); }
          poll();                                    /* slower now, and only until the ten minutes are up */
        }else if(UI.ret === 'checking' || UI.ret === 'pending'){ UI.ret = 'unconfirmed'; changed(); }
      });
    }, wait);
  }
  function checkAgain(){ if(UI.busy) return; pollN = 0; UI.ret = 'checking'; if(!lsGet(K_PEND)) lsSet(K_PEND, {uid: uid(), at: Date.now()}); changed(); poll(); }

  /* ---------- doors ---------- */
  function closeOverlays(){
    try{ var mp = document.getElementById('myplan'); if(mp && !mp.hidden){ var x = document.getElementById('mpClose'); if(x) x.click(); } }catch(e){}
    try{ var sh = document.getElementById('sheet'); if(sh && !sh.hidden && typeof closeSheet === 'function') closeSheet(); }catch(e){}
  }
  function goPlans(){
    closeOverlays();
    try{ if(window.C3 && window.C3.mounted){ window.C3.go('you', {plan:1}); return true; } }catch(e){}
    try{ window.showGroup('profile', 'youaccount'); }catch(e){}
    return false;
  }
  function goSignIn(plan){
    ssSet(K_WANT, plan || '1');
    closeOverlays();
    try{ if(window.C3 && window.C3.h && window.C3.h.openSignIn){ window.C3.h.openSignIn(); return; } }catch(e){}
    try{ ACCT.view = 'signin'; window.showGroup('profile', 'youaccount'); renderAccount(); }catch(e){}
  }
  /* what every "Go Pro" control in the old screens does on the web (the app's buyPro()) */
  function offer(){
    if(!web()) return Promise.resolve({ok:false, why:'no-store'});
    if(!live()){ toast('Pro opens soon. Everything is free until then.'); return Promise.resolve({ok:false, why:'closed'}); }
    if(!signedIn()){ goSignIn(''); toast('Sign in to go Pro. Your plan choice is next.'); return Promise.resolve({ok:false, why:'signin'}); }
    goPlans();
    return Promise.resolve({ok:false, why:'plans'});
  }
  /* after a sign-in that was started from a Pro control: back to the plan choice */
  function resume(){
    if(!web()) return;
    if(UI.ret){ goPlans(); return; }
    if(ssGet(K_WANT) && signedIn() && live()){ goPlans(); }
  }
  function wanted(){ var w = ssGet(K_WANT); return PRICES[w] ? w : ''; }
  function clearWant(){ ssSet(K_WANT, ''); }

  var SAY = {
    closed:       'Pro is not open yet. Nothing was charged.',
    unconfigured: 'That plan is not open yet. Nothing was charged.',
    signin:       'Sign in again to go Pro. Nothing was charged.',
    verify:       'Confirm your email first. Open the link we sent (You, then Account, then Send it again). Already confirmed? Log out and back in once. Nothing was charged.',
    consent:      'Tick the box to agree to the Terms and the Privacy Policy first.',
    terms:        'The terms were updated. Reload the page, read them and agree again. Nothing was charged.',
    subscribed:   'This account already has Pro. Nothing was charged.',
    past_due:     'Your last payment did not go through. Update your card under Manage or cancel.',
    sold_out:     'The founding places have all gone. Nothing was charged.',
    plan:         'Pick a plan first.',
    network:      'No connection. Nothing was charged. Try again when you are back online.',
    failed:       'Checkout could not start. Nothing was charged. Try again in a moment.'
  };
  function leave(url){ try{ window.location.assign(url); }catch(e){ try{ window.location.href = url; }catch(x){} } }

  /* Start checkout for one plan. agreed is the consent box. Resolves {ok, why}; on ok the page is
     already on its way to Stripe. */
  function checkout(plan, agreed){
    if(!web()) return Promise.resolve({ok:false, why:'no-store'});
    if(UI.busy) return Promise.resolve({ok:false, why:'busy'});
    if(!live()){ note(SAY.closed, 'bad'); return Promise.resolve({ok:false, why:'closed'}); }
    if(!PRICES[plan] || !CFG.plans[plan]){ note(SAY.plan, 'bad'); return Promise.resolve({ok:false, why:'plan'}); }
    if(!signedIn()){ goSignIn(plan); toast('Sign in to go Pro. Your plan choice is next.'); return Promise.resolve({ok:false, why:'signin'}); }
    if(agreed !== true){ note(SAY.consent, 'bad'); return Promise.resolve({ok:false, why:'consent'}); }
    if(pending()){ return Promise.resolve({ok:false, why:'pending'}); }
    UI.busy = 'pay'; UI.msg = ''; UI.tone = ''; UI.ret = null; changed();
    var done = function(why, msg){ UI.busy = ''; note(msg || SAY[why] || SAY.failed, 'bad'); return {ok:false, why:why}; };
    return token().then(function(tok){
      if(!tok) return done('signin');
      return ask('/api/pay', {method:'POST', headers:{'content-type':'application/json', authorization:'Bearer ' + tok},
        body: JSON.stringify({plan: plan, agree: true, terms: CFG.terms.version})}, 20000).then(function(r){
        var j = r.body || {};
        if(r.status === 200 && j.ok === true && /^https:\/\//.test(String(j.url || ''))){
          clearWant();
          leave(j.url);                              /* busy stays on: the page is leaving */
          return {ok:true};
        }
        if(r.status === 0) return done('network');
        var code = String(j.code || '');
        if(!code) code = r.status === 401 ? 'signin' : r.status === 409 ? 'subscribed' : 'failed';
        if(code === 'sold_out'){ FOUNDING.left = 0; FOUNDING.at = Date.now(); }
        if(code === 'subscribed' || code === 'past_due') entitlement(true);
        if(code === 'terms'){ cfgP = null; config(); }
        if(code === 'unavailable' || code === 'stripe') code = 'failed';
        return done(SAY[code] ? code : 'failed');
      });
    }, function(){ return done('failed'); });
  }
  /* Manage or cancel: the Stripe Billing Portal for this member */
  function manage(){
    if(!web()) return Promise.resolve({ok:false, why:'no-store'});
    if(UI.busy) return Promise.resolve({ok:false, why:'busy'});
    if(!signedIn()){ goSignIn(''); return Promise.resolve({ok:false, why:'signin'}); }
    UI.busy = 'portal'; UI.msg = ''; UI.tone = ''; changed();
    var done = function(why, msg){ UI.busy = ''; note(msg, 'bad'); return {ok:false, why:why}; };
    return token().then(function(tok){
      if(!tok) return done('signin', 'Sign in again to manage your plan.');
      return ask('/api/pay-portal', {method:'POST', headers:{'content-type':'application/json', authorization:'Bearer ' + tok}, body:'{}'}, 20000).then(function(r){
        var j = r.body || {};
        if(r.status === 200 && j.ok === true && /^https:\/\//.test(String(j.url || ''))){ leave(j.url); return {ok:true}; }
        if(r.status === 0) return done('network', 'No connection. Try again when you are back online.');
        if(r.status === 401) return done('signin', 'Sign in again to manage your plan.');
        if(j.code === 'none'){ entitlement(true); return done('none', 'There is no subscription on this account.'); }
        return done('failed', 'Billing could not open. Try again in a moment.');
      });
    }, function(){ return done('failed', 'Billing could not open. Try again in a moment.'); });
  }

  /* ---------- what the plan block draws ---------- */
  function dateWord(iso){
    var t = Date.parse(iso || ''); if(!(t > 0)) return '';
    return safe(function(){ return new Date(t).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); }, '');
  }
  /* the plans on sale right now, in the order they are shown */
  function plans(){
    if(!live()) return [];
    var mo = PRICES.monthly, out = [];
    ORDER.forEach(function(id){
      if(!CFG.plans[id]) return;
      var p = PRICES[id], row = {id:p.id, name:p.name, full:p.full, price:p.price, per:p.per, save:0, left:null};
      if(id === 'founding'){
        /* sold only while the server can count places and some are left; the count is shown because it is the server's */
        if(!(FOUNDING.left > 0)) return;
        row.left = FOUNDING.left;
      }
      /* what a year of this costs against twelve months of monthly, rounded DOWN so it is never overstated.
         Only said when monthly is really on sale beside it. */
      if(p.months === 12 && CFG.plans.monthly) row.save = Math.max(0, Math.floor((1 - p.cents / (mo.cents * 12)) * 100));
      out.push(row);
    });
    return out;
  }
  function view(){
    var T = safe(function(){ return trialInfo(); }, null) || {state:'open', daysLeft:0};
    var e = entFor();
    var isPaid = T.state === 'paid';
    return {
      web: web(), known: !!CFG, live: live(), signedIn: signedIn(),
      state: T.state, daysLeft: T.daysLeft | 0, days: T.days | 0, source: T.source || '',
      plans: (isPaid || !live() || (e && !e.paid && e.status === 'past_due')) ? [] : plans(),
      terms: CFG ? CFG.terms : {version:'', url:'/terms', privacy:'/privacy'},
      paid: (isPaid && e && e.paid) ? {name: PLAN_NAMES[e.plan] || 'Pro', through: e.plan === 'lifetime' ? '' : dateWord(e.periodEnd), pastDue: e.status === 'past_due', life: e.plan === 'lifetime'} : null,
      /* a subscription exists but its card failed and the days already paid for are over: api/pay.js will not
         sell a second one, so the control is the portal (update the card, or cancel) */
      lapsed: (!isPaid && e && !e.paid && e.status === 'past_due') ? {name: PLAN_NAMES[e.plan] || 'Pro'} : null,
      ret: UI.ret, pending: pending(), busy: UI.busy, msg: UI.msg, tone: UI.tone, want: wanted()
    };
  }

  /* ---------- start ---------- */
  function onAccount(){
    var u = uid();
    if(u === lastUid) return;                       /* a token refresh, not a different person */
    lastUid = u;
    if(!u){ ENT = null; lsSet(K_ENT, null); lsSet(K_PEND, null); if(pollTimer){ clearTimeout(pollTimer); pollTimer = 0; } if(UI.ret){ UI.ret = null; } UI.msg = ''; changed(); return; }
    if(ENT && ENT.uid !== u){ ENT = null; lsSet(K_ENT, null); lsSet(K_PEND, null); }
    changed();
    entitlement(true).then(function(){
      if(UI.ret === 'signin'){ UI.ret = 'checking'; pollN = 0; changed(); poll(); }
    });
    /* a sign-in that began at a Pro control: once the app has settled, back to the plan choice */
    if(ssGet(K_WANT)) setTimeout(function(){ config().then(function(){ if(signedIn() && ssGet(K_WANT) && live()) goPlans(); }); }, 900);
  }
  function landing(){
    var q; try{ q = new URLSearchParams(location.search || ''); }catch(e){ return; }
    var paid = q.get('paid'), portal = q.get('portal'), sid = q.get('session') || '';
    if(paid !== '1' && paid !== '0' && portal !== '1') return;
    /* scrub first: a reload, a bookmark or the Back button must not replay the return */
    try{
      q.delete('paid'); q.delete('session'); q.delete('portal');
      var rest = q.toString();
      history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + (location.hash || ''));
    }catch(e){}
    if(paid === '1'){
      UI.ret = 'checking'; pollN = 0;
      lsSet(K_PEND, {uid: uid(), at: Date.now()});
      clearWant();
      /* v309: a second road to Pro that does not wait on the webhook: the server reads this
         checkout back from Stripe and records it. The polling below still runs either way. */
      if(/^cs_(live|test)_[A-Za-z0-9]+$/.test(sid)){
        token().then(function(tok){
          if(!tok) return null;
          return ask('/api/pay', {method:'POST', headers:{authorization:'Bearer ' + tok, 'content-type':'application/json'}, body: JSON.stringify({confirm: sid})}, 12000);
        }).then(function(r){ if(r && r.status === 200 && r.body && r.body.paid) entitlement(true).then(function(){ changed(); }); }).catch(function(){});
      }
      poll();
    }else if(paid === '0'){
      UI.ret = 'canceled';
    }else{
      UI.ret = 'portal';
      entitlement(true);
    }
  }
  function start(){
    if(!web()) return;
    CFG = lsGet(K_CFG);
    if(!CFG || typeof CFG.billingLive !== 'boolean' || !CFG.plans || !CFG.terms || !CFG.ready) CFG = null;
    ENT = lsGet(K_ENT);
    if(!ENT || !ENT.uid || typeof ENT.paid !== 'boolean' || !ENT.trial) ENT = null; else ENT.fresh = false;
    lastUid = uid();
    if(ENT && ENT.uid !== lastUid){ ENT = null; lsSet(K_ENT, null); }
    landing();
    config().then(function(){ if(UI.ret !== 'checking') entitlement(true); });
    if(UI.ret !== 'checking' && pending()){ UI.ret = 'checking'; pollN = POLL.length - 2; poll(); }
    try{ if(typeof CLOUD !== 'undefined' && CLOUD.onChange) CLOUD.onChange(function(){ try{ onAccount(); }catch(e){} }); }catch(e){}
    var again = function(){
      if(document.hidden || !web()) return;
      if(!cfgFresh && Date.now() - cfgTried > 30000) config();
      entitlement(false);                            /* throttled: at most one a minute */
      founding();                                    /* the same throttle: the count on screen is never an old one for long */
      changed();                                     /* a trial that ran out while the tab was away */
    };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('online', again);
    window.addEventListener('pageshow', function(ev){ if(ev && ev.persisted){ UI.busy = ''; changed(); again(); } });   /* Back from Stripe out of the page cache */
    changed();
  }

  window.BILLING = {
    PRICES: PRICES,
    web: web, live: live, signedIn: signedIn,
    config: config, cfg: cfg, entitlement: entitlement, founding: founding,
    truth: truth, view: view, plans: plans,
    checkout: checkout, manage: manage, offer: offer, resume: resume, checkAgain: checkAgain,
    goSignIn: goSignIn, clearWant: clearWant,
    dismiss: function(){ if(UI.ret === 'canceled' || UI.ret === 'paid' || UI.ret === 'portal' || UI.ret === 'unconfirmed'){ UI.ret = null; } UI.msg = ''; UI.tone = ''; changed(); }
  };
  try{ start(); }catch(e){ try{ console.error('[billing] start', e); }catch(x){} }
})();
