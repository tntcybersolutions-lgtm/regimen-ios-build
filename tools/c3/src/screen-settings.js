/* C3 screen: settings. One quiet list: your name, units, language, how much is explained,
   the check-in day, Apple Health, and (in training mode) the door to a peptide protocol.
   Replaces the old "You", "How you read it" and "Apple Health" cards of the Account pane.
   Every change applies at once through the app's own setter and the screen repaints:
     name          me().name + save() + drawShareCard()      (the old #meName handler)
     units         setUnits()
     language      setLang()
     brief         ALL.ui.terse + save() + applyTerse()      (the old #terseBtn handler)
     check-in day  ALL.prefs.checkinDay + save()             (the field the setup wizard writes)
     Apple Health  healthConnect() / healthPull(true) / the old "Stop syncing" handler
     protocol      the old "Start a peptide protocol" button (#startProto), pressed as is
   The theme switch is not here: the app retired it in v161 (one look, the royal ground). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function healthNative(){ return safe(function(){ var R = window.RUN; return !!(R && R.native && R.health && R.health.available()); }, false); }
    function later(){ [60, 400, 1200, 2600].forEach(function(ms){ setTimeout(function(){ C3.refresh(); }, ms); }); }

    function healthHTML(){
      var native = healthNative(), st = safe(function(){ return HEALTH.state; }, 'unknown'), busy = safe(function(){ return !!HEALTH.busy; }, false);
      var msg = safe(function(){ return (HEALTH.err ? yd.note(esc(HEALTH.err), 'bad') : '') + (HEALTH.msg ? yd.note(esc(HEALTH.msg), 'good') : ''); }, '');
      if(!native) return yd.sec('Apple Health', '<p class="st-state" data-health="none"><b>Needs the iPhone app</b></p>' + yd.note('In the iPhone app, you can allow supported Health readings. This version writes weight and body fat only, not workouts.'), {id:'health'});
      if(st !== 'granted'){
        return yd.sec('Apple Health', '<p class="st-state" data-health="off"><b>Not connected</b></p>' +
          '<button type="button" class="c3-btn-rail st-connect" data-act="hkgo" data-key="hkgo"' + (busy ? ' disabled' : '') + '><span>' + (busy ? 'Asking iOS' : 'Connect Apple Health') + '</span>' + h.icon('arrow', 26, 2.800) + '</button>' + msg +
          yd.note('With your permission: read supported weight, steps, workouts, sleep and overnight readings. Write: weight and body fat only. Workout write-back is not supported in this version.'), {id:'health'});
      }
      var sum = safe(function(){ return healthSummary(); }, {weights:0, workouts:0, bodyFat:0, since:0});
      return yd.sec('Apple Health', '<p class="st-state on" data-health="on"><i></i><b>Connected</b>' + (sum.since ? '<span>read ' + esc(safe(function(){ return agoWord(sum.since); }, '')) + '</span>' : '') + '</p>' +
        yd.stats([[String(sum.weights), sum.weights === 1 ? 'Weigh-in' : 'Weigh-ins'], [String(sum.workouts), sum.workouts === 1 ? 'Workout' : 'Workouts'], [String(sum.bodyFat), 'Body-fat readings']], 'st-hk') +
        '<div class="yd-acts">' + yd.btn('hkpull', busy ? 'Reading' : 'Read from Health now', {icon:'refresh', disabled: busy}) + yd.btn('hkoff', 'Stop syncing', {pink:true, icon:'x'}) + '</div>' + msg +
        yd.note('Health permissions are controlled in iOS. Weight and body fat can be written to Health; workouts cannot. Review your account sync and crew sharing separately before sharing records.'), {id:'health'});
    }

    yd.screen('settings', {
      parent: 'you', old: ['profile', 'youaccount'],
      render: function(ctx){
        var retained=(ALL.journeySetup||{}).nameDraft;
        var sys = unitSys(), lg = lang(), terse = !!terseDefault(), name = ctx.state.name != null ? ctx.state.name : retained&&!retained.complete?retained.value:(displayName() || '');
        var set = safe(function(){ return !!(ALL.body && ALL.body.sex); }, false);
        var ck = safe(function(){ return (ALL.prefs && ALL.prefs.checkinDay != null) ? (ALL.prefs.checkinDay | 0) % 7 : null; }, null);
        var pep = safe(function(){ return !!onPeptide(); }, false);

        var you = yd.sec('Your name', '<div class="yd-fields st-name">' + yd.input('name', name, 'Display name', {max:24, ph:'Your name', cls:'wide'}) + '</div><p role="alert">'+esc(ctx.state.nameError||'')+'</p><div class="yd-acts">'+yd.btn('savename','Save name',{extra:'data-commit'})+yd.btn('cancelname','Cancel')+'<button type="button" class="c3-btn-quiet" data-go="you">Back</button></div>', {id:'name'});
        var units = yd.sec('Units', yd.seg('units', [['imperial', 'Pounds · inches'], ['metric', 'Kilograms · centimeters']], sys, {aria:'Units'}) +
          yd.note('What you logged stays as it is. This changes what the screens show and what the boxes expect.'), {id:'units'});
        var langs = yd.sec('Language', yd.seg('lang', LANGS.map(function(l){ return [l[0], l[1]]; }), lg, {aria:'Language', cls:'wrap2'}) +
          (lg !== 'en' ? yd.note('Tabs, headings, labels and buttons are translated. Names, long notes and the library stay in English.') : ''), {id:'lang'});
        var read = yd.sec('Explanations', '<div class="yd-list">' + yd.sw('terse', terse, 'Brief', 'Long explanations fold to two lines. Tap one to open it.') + '</div>', {id:'read'});
        var day = set && ck != null ? yd.sec('Check-in day', yd.seg('ckday', DAYS.map(function(d, i){ return [i, d]; }), ck, {aria:'Check-in day', cls:'fill st-days'}) +
          yd.note('The day you weigh in and the plan updates.'), {id:'checkin'}) : '';
        var proto = (!pep && document.getElementById('startProto')) ? yd.sec('Protocol', yd.note('You are tracking training and body composition.') +
          '<div class="yd-acts">' + yd.btn('proto', 'Start a peptide protocol', {icon:'plus'}) + '</div>', {id:'proto'}) : '';
        /* v318: SAY IT OUT LOUD, the session's spoken cues, off until switched on here (or on Train > Program) */
        var SV = safe(function(){ return voiceCfg(); }, null), canSay = safe(function(){ return sayAvailable(); }, false);
        var sayS = SV ? yd.sec('Say it out loud', canSay
            ? '<div class="yd-list">' + yd.sw('say', !!SV.on, 'Read the session out loud', 'The next set, the weight, the rest and the countdown, while you train.') + '</div>' +
              (SV.on ? '<div class="yd-acts">' + yd.btn('sayhear', 'Hear it', {icon:'play'}) + '</div>' : '')
            : yd.note('This browser has no voice. Open the app in Chrome, Safari or Edge, or on your iPhone.'), {id:'say'}) : '';
        /* v317: the fast-food radar, off until switched on here (it asks for location the first time). It sits with
           the everyday settings, away from the protocol block: food and coaching never share a frame with research */
        var RS = safe(function(){ return h.radarState ? h.radarState() : null; }, null);
        var radar = (RS && navigator.geolocation) ? yd.sec('Fast-food radar', '<div class="yd-list">' +
          yd.sw('radar', RS.on, 'Fast-food radar', 'Pull into a chain and the app shows what to order there and what it costs you today. Only while the app is open. Your exact location is never sent or saved.') + '</div>' +
          (RS.err === 'denied' ? yd.note('Location is off for this app. Turn it on in the browser or phone settings, then switch this on again.') : ''), {id:'radar'}) : '';
        var more = yd.sec('More', '<ul class="yd-list two">' + yd.linkRow('reminders', 'Reminders', '', 'data-go="reminders"') + yd.linkRow('data', 'Export my data', '', 'data-go="data"') + '</ul>', {id:'more'});

        return '<div class="yd st" data-units="' + esc(sys) + '" data-lang="' + esc(lg) + '">' + yd.head({back:'you', eyebrow:h.fmt.unit() + ' · ' + ((LANGS.filter(function(l){ return l[0] === lg; })[0] || [0, 'English'])[1]), title:'Your', pk:'settings'}) +
          '<div class="yd-cols even"><div class="yd-col">' + you + units + langs + read + day + sayS + radar + '</div><div class="yd-col">' + healthHTML() + proto + more + '</div></div></div>';
      },
      wire: function(root, ctx){
        yd.wire(root, ctx, {
          savename:function(){var field=root.querySelector('[data-chg="name"]'),old=me().name,value=String(field?field.value:ctx.state.name||'').trim().slice(0,24);me().name=value;save();if(!saveOk()){me().name=old;ctx.set({nameError:'This device could not save. Your name is still here.'});return;}if(ALL.journeySetup){ALL.journeySetup.nameDraft={complete:true,at:Date.now()};ALL.journeySetup.at=Date.now();save();}ctx.state.name=null;ctx.state.nameError='';yd.toast('Name saved on this device.');C3.render();},
          cancelname:function(){if(ALL.journeySetup){ALL.journeySetup.nameDraft={complete:true,at:Date.now()};ALL.journeySetup.at=Date.now();save();}ctx.state.name=null;ctx.state.nameError='';C3.go('you');},
          units: function(v){ if(v === unitSys()) return; setUnits(v); yd.toast('Reading in <b>' + (unitSys() === 'metric' ? 'kilograms and centimeters' : 'pounds and inches') + '</b> now.'); C3.refresh(); },
          lang: function(v){ if(v === lang()) return; setLang(v); C3.refresh(); },
          terse: function(){ ALL.ui = ALL.ui || {}; ALL.ui.terse = !terseDefault(); save(); applyTerse(); C3.refresh(); },
          ckday: function(v){ ALL.prefs = ALL.prefs || {}; if((ALL.prefs.checkinDay | 0) === +v) return; ALL.prefs.checkinDay = +v; save(); try{ drawAll(); }catch(e){} yd.toast('Check-in day is <b>' + ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][+v] + '</b>.'); },
          hkgo: function(){ try{ Promise.resolve(healthConnect()).then(later, later); }catch(e){} later(); },
          hkpull: function(){ try{ Promise.resolve(healthPull(true)).then(later, later); }catch(e){} later(); },
          hkoff: function(){
            /* the app's own handler lives on the old card's button: draw the card (hidden), press it */
            try{ renderHealth(); var b = document.getElementById('hkOff'); if(b) b.click(); }catch(e){ console.error('[c3] settings health off', e); }
            later();
          },
          proto: function(){ var b = document.getElementById('startProto'); if(b) b.click(); },
          radar: function(){ h.radarSet(!h.radarOn()); C3.refresh(); setTimeout(function(){ try{ C3.refresh(); }catch(e){} }, 1500); },
          say: function(){ var V = voiceCfg(); V.on = !V.on; save(); if(V.on){ Promise.resolve(voiceLoad()).then(function(){ speak('Cues on.', {force:true}); }); } else voiceStop(); C3.refresh(); },
          sayhear: function(){ speak('Back squat. Set two of five. 225 pounds, for 5.', {force:true}); }
        }, {
          name: function(v){ ctx.state.name = String(v).slice(0,24); }
        });
        var n = root.querySelector('[data-chg="name"]');
        if(n) n.addEventListener('input', function(){ ctx.state.name = n.value;var setup=ALL.journeySetup=ALL.journeySetup||{};setup.at=Date.now();setup.nameDraft={value:n.value,at:Date.now()};C3.journey.deferSave('name'); });
        /* You > Apple Health lands on that block */
        if(ctx.params && ctx.params.focus === 'health' && !ctx.state.shown){
          ctx.state.shown = 1;
          setTimeout(function(){ try{ var el = root.querySelector('[data-sec="health"]'); if(el && window.innerWidth < 1024) el.scrollIntoView({block:'start'}); }catch(e){} }, 60);
        }
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
