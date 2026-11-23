/* C3 screen: reminders (the old "Reminders" card, #remCard on the Account pane).
   Each reminder is a row with a real switch; its times show under it when it is on.
   What is booked for the next days comes from the app's own remPlan(). Switching one on
   goes through the app's own permission flow (remAsk); every change is remCfg() + save()
   + remSync(true), exactly what the old card did.
   The morning brief and the dose reminder were always part of the app's plan (REM_DEFAULTS)
   and never had a switch. They have one now, on the same settings object. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    function commit(){ save(); try{ remSync(true); }catch(e){} C3.refresh(); }
    /* where a notification can actually arrive, in a word, and the app's own sentence for it */
    function delivery(){
      var nat = safe(function(){ return !!remNative(); }, false);
      var perm = (typeof Notification === 'undefined') ? 'none' : Notification.permission;
      return {native: nat, perm: perm, ok: nat || perm === 'granted',
              word: nat ? 'On this phone' : perm === 'none' ? 'Not available here' : perm === 'denied' ? 'Blocked in this browser' : perm === 'granted' ? 'While this tab is open' : 'Asks the first time',
              text: perm === 'default' && !nat ? 'Save reminders to request browser permission. Browser reminders only arrive while this tab stays open.' : safe(function(){ return remHowText(); }, '')};
    }
    function time(act, v, label, extra){ return yd.input(act, v || '', label, {type:'time', extra: extra || '', k: (extra || '').replace(/[^a-z0-9]/gi, '')}); }

    yd.screen('reminders', {
      parent: 'you', old: ['profile', 'youaccount'],
      render: function(ctx){
        var retained=(ALL.journeySetup||{}).reminderDraft;
        if(!ctx.state.draft)ctx.state.draft=JSON.parse(JSON.stringify(retained&&!retained.complete?retained.value:remCfg()));
        var R = ctx.state.draft, plan = remPlan().slice().sort(function(a,b){return a.at-b.at;}), D = delivery(), pep = safe(function(){ return !!onPeptide(); }, false);
        R.coach = Object.assign({on:true}, R.coach || {});   /* v375: coach nudges default on; the nudge module reads reminders.coach.on === false as the opt-out */
        var onN = ['brief', 'checkin', 'meals', 'water', 'weigh', 'steps', 'recap', 'coach'].filter(function(k){ return R[k] && R[k].on; }).length + (pep && R.dose.on !== false ? 1 : 0);
        var next = plan[0];

        var top = '<section class="rm-top" aria-label="Applied reminder plan">' +
          (onN || plan.length ? yd.stats([[String(onN), onN === 1 ? 'Reminder selected' : 'Reminders selected'], [String(plan.length), 'Planned · ' + REM_DAYS + ' days']], 'rm-stats') : '') +
          '<p class="rm-next">' + (next ? '<span>Next</span><b>' + esc(next.title) + '</b><i class="c3-num">' + esc(yd.when(next.at)) + '</i>' : '<span>Next</span><b>Nothing booked</b>') + '</p>' +
          yd.note(esc(D.text), (D.perm === 'denied' || D.perm === 'none') && !D.native ? 'warn' : '') +
        '</section>';

        var rows = '';
        rows += '<li>' + yd.sw('on', !!R.brief.on, 'Morning brief', 'Your day in one place, at the time you wake.', {v:'brief'}) +
          (R.brief.on ? '<div class="yd-fields rm-set">' + time('t', R.brief.time, 'Time', 'data-k="brief"') + '</div>' : '') + '</li>';
        /* v344: the daily check-in and an evening steps nudge; each banner opens its own screen */
        rows += '<li>' + yd.sw('on', !!(R.checkin && R.checkin.on), 'Check-in', 'Your guided daily review. Quiet once today’s is in.', {v:'checkin'}) +
          (R.checkin && R.checkin.on ? '<div class="yd-fields rm-set">' + time('t', R.checkin.time, 'Time', 'data-k="checkin"') + '</div>' : '') + '</li>';
        if(pep) rows += '<li>' + yd.sw('on', R.dose.on !== false, 'Dose', 'When a dose on your schedule is due. Quiet once it is logged.', {v:'dose'}) + '</li>';
        rows += '<li>' + yd.sw('on', !!R.meals.on, 'Meals', 'One nudge per meal, dropped once you log around that time.', {v:'meals'}) +
          (R.meals.on ? '<div class="yd-fields three rm-set">' + R.meals.times.map(function(t, i){ return time('t', t, MEAL_NAMES[i] || 'Meal', 'data-k="meals" data-i="' + i + '"'); }).join('') + '</div>' : '') + '</li>';
        rows += '<li>' + yd.sw('on', !!R.water.on, 'Water', 'Spaced through the day. Stops when you hit the day’s target.', {v:'water'}) +
          (R.water.on ? '<div class="yd-fields three rm-set">' + time('t', R.water.from, 'From', 'data-k="water" data-i="from"') + time('t', R.water.to, 'Until', 'data-k="water" data-i="to"') +
            yd.select('every', [1, 2, 3, 4].map(function(n){ return [n, n + ' hour' + (n === 1 ? '' : 's')]; }), +R.water.everyH, 'Every') + '</div>' : '') + '</li>';
        rows += '<li>' + yd.sw('on', !!R.weigh.on, 'Weigh-in', 'Only on the days you pick, never on a day you already weighed.', {v:'weigh'}) +
          (R.weigh.on ? '<div class="yd-fields rm-set">' + time('t', R.weigh.time, 'Time', 'data-k="weigh"') + '</div>' +
            '<div class="yd-seg fill rm-days" role="group" aria-label="Weigh-in days">' + DOW.map(function(n, v){ var on = (R.weigh.days || []).indexOf(v) >= 0;
              return '<button type="button" class="yd-opt' + (on ? ' on' : '') + '" data-act="wday" data-v="' + v + '" data-key="wday-' + v + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(n) + '</button>'; }).join('') + '</div>' : '') + '</li>';
        rows += '<li>' + yd.sw('on', !!(R.steps && R.steps.on), 'Steps', 'One evening nudge, only on a day you are short of your steps.', {v:'steps'}) +
          (R.steps && R.steps.on ? '<div class="yd-fields rm-set">' + time('t', R.steps.time, 'Time', 'data-k="steps"') + '</div>' : '') + '</li>';
        rows += '<li>' + yd.sw('on', !!R.coach.on, 'Coach nudges', 'Timely pushes from your coach: protein pacing, a session still on the table, a streak at risk. Never about doses.', {v:'coach'}) + '</li>';
        rows += '<li>' + yd.sw('on', !!R.recap.on, 'Weekly recap', 'Your week in one line, on the evening you choose.', {v:'recap'}) +
          (R.recap.on ? '<div class="yd-fields rm-set">' + yd.select('rday', DOW.map(function(n, v){ return [v, n]; }), +R.recap.day, 'Day') + time('t', R.recap.time, 'Time', 'data-k="recap"') + '</div>' +
            yd.note('It will read: <b>' + esc(safe(function(){ return remRecapLine(recapWindow('week')); }, '')) + '</b>') : '') + '</li>';

        var booked = yd.sec('Applied plan', plan.length
          ? '<ul class="yd-list rm-plan">' + plan.slice(0, 8).map(function(p){ return '<li><div class="yd-row"><span class="l">' + esc(p.title) + '</span><span class="v">' + esc(yd.when(p.at)) + '</span></div></li>'; }).join('') + '</ul>' +
            (plan.length > 8 ? yd.note('and ' + (plan.length - 8) + ' more over the next ' + REM_DAYS + ' days.') : '')
          : yd.empty('Nothing booked. Switch one on, or everything for today is already logged.'), {n: plan.length || null, cls: 'rm-booked'});

        return '<div class="yd rm">' + yd.head({back:'you', eyebrow:D.word, title:'Your', pk:'reminders'}) + '<p class="rm-intro">Choose reminders and times, then tap Save reminders. Browser reminders need this tab to stay open.</p>' +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Reminders', '<ul class="yd-list rm-list">' + rows + '</ul>', {n: onN}) + '</div>' +
          '<div class="yd-col">' + top + booked + '</div></div><p>Applied plan shows saved choices, not proof of delivery.</p><p role="alert">'+esc(ctx.state.error||'')+'</p><div class="yd-acts rm-save">'+yd.primary('save','Save reminders','',{extra:'data-commit',icon:'check'})+yd.btn('cancel','Cancel')+'<button type="button" class="c3-btn-quiet" data-go="you">Back</button></div></div>';
      },
      wire: function(root, ctx){
        var draft=ctx.state.draft;
        var commit=function(){var s=ALL.journeySetup=ALL.journeySetup||{};s.at=Date.now();s.reminderDraft={value:JSON.parse(JSON.stringify(draft)),at:Date.now()};C3.journey.deferSave('reminders');C3.render();};
        function clear(){var s=ALL.journeySetup=ALL.journeySetup||{};s.at=Date.now();s.reminderDraft={complete:true,at:Date.now()};save();}
        yd.wire(root, ctx, {
          save:async function(){if(ctx.state.saving)return;if(draft.water&&draft.water.on&&(hm(draft.water.from)==null||hm(draft.water.to)==null||hm(draft.water.to)<=hm(draft.water.from))){ctx.state.error='For water reminders, choose an Until time later than From on the same day.';C3.render();return;}ctx.state.saving=true;var owner=C3.memory.ownerToken();try{var pep=safe(function(){return !!onPeptide();},false),enabled=Object.keys(draft).some(function(k){return ((k!=='dose'&&k!=='supply')||pep)&&draft[k]&&draft[k].on;});if(enabled&&!await remAsk()&&!remNative()){ctx.state.error='Notifications are not allowed yet. Allow them in this site’s browser settings, then save again. Your choices are still here.';C3.render();return;}if(!C3.memory.sameOwner(owner))return;var before=ALL.reminders;ALL.reminders=JSON.parse(JSON.stringify(draft));save();if(!saveOk()){ALL.reminders=before;ctx.state.error='This device could not save. Your reminder choices are still here.';C3.render();return;}clear();ctx.state.draft=null;ctx.state.error='';remSync(true);yd.toast('Reminder choices saved on this device.');C3.go('you');}catch(e){ctx.state.error='Reminders could not be updated. Your choices are still here.';C3.render();}finally{ctx.state.saving=false;}},
          cancel:function(){clear();ctx.state.draft=null;ctx.state.error='';C3.go('you');},
          on: function(k, el){
            var want = el.getAttribute('aria-checked') !== 'true';
            draft[k].on=want;commit();
          },
          wday: function(v){
            var R = draft, list = R.weigh.days = R.weigh.days || [], i = list.indexOf(+v);
            if(i >= 0){ if(list.length > 1) list.splice(i, 1); else { yd.toast('Keep at least one day.'); return; } } else list.push(+v);
            list.sort(); commit();
          }
        }, {
          t: function(v, el){
            var k = el.getAttribute('data-k'), i = el.getAttribute('data-i');
            if(hm(v) == null){ yd.toast('That is not a time the reminder can use.', 'bad'); C3.render(true); return; }
            var R = draft;
            if(k === 'meals') R.meals.times[+i] = v;
            else if(k === 'water') R.water[i] = v;
            else R[k].time = v;
            commit();
          },
          every: function(v){ draft.water.everyH = +v || 3; commit(); },
          rday: function(v){ draft.recap.day = +v || 0; commit(); }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
