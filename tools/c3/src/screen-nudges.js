/* C3 module: coach nudges at the right moment (build-plan item 3).
   Not a screen: no render function. Wraps the shell's remPlan() so the day's
   notification plan also carries quiet, timely coach pushes, and mirrors them
   into the coach feed. The shell evaluates before C3, so window.remPlan is
   always defined at load time. Every probe is defensive: if a helper is
   missing, the nudge silently stays home and the original plan is untouched.

   v1 nudges (cap 2 per day, none before 4pm, reminders.coach.on === false opts out):
     1. Protein pacing, 5:30pm: logged protein meaningfully short of target.
     2. Session saver, 6:30pm: a planned training day still undone.
     3. Streak saver, 6:45pm: a 3+ day run with nothing logged today (only if a slot is free).
   No dose, med or weight content, ever. */
(function(){
  'use strict';
  if(window.remPlan && !window.remPlan.__v375){
    var origRemPlan = window.remPlan;
    var NUDGE_TIMES = { protein:'17:30', session:'18:30', streak:'18:45' };

    function coachOff(){
      try{ var c = (ALL.reminders||{}).coach; return !!(c && c.on === false); }catch(e){ return false; }
    }
    function round5(n){ return Math.max(5, Math.round(n/5)*5); }
    function plannedToday(){
      try{
        var wk = weekAt(weekIndexNow());
        var d = wk[new Date().getDay()];
        return (d && !d.rest && d.blocks && d.blocks.length) ? d : null;
      }catch(e){ return null; }
    }
    function trainedToday(key){
      try{
        var w = (ALL.workLog||{})[key];
        if(!w || !w.rows) return false;
        for(var id in w.rows){ if((w.rows[id]||[]).some(function(r){ return r && r.done; })) return true; }
      }catch(e){}
      return false;
    }
    function coachFeed(entry){
      /* mirror into the coach feed, once per nudge per day, only on live scheduling */
      try{
        ALL.coach = ALL.coach || {}; ALL.coach.log = ALL.coach.log || [];
        if(ALL.coach.log.some(function(x){ return x.key === entry.key; })) return;
        ALL.coach.log.push({
          id: 'cn' + Math.random().toString(36).slice(2, 10),
          at: Date.now(),
          coach: ALL.coach.lead || 'dakota-jane',
          kind: 'nudge',
          key: entry.key,
          text: entry.text,
          go: entry.go,
          up: null, acted: null, ai: false
        });
      }catch(e){}
    }

    window.remPlan = function(fromMs){
      var out = origRemPlan.apply(this, arguments);
      try{
        if(coachOff()) return out;
        var live = fromMs == null;
        var now = Date.now();
        var key = dkey(now);
        var dayMs = +new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate());
        if(typeof isPaused === 'function' && isPaused(key)) return out;
        var added = 0;
        function at(slot){
          try{ var t = atOn(dayMs, slot); return (t != null && t > now) ? t : null; }catch(e){ return null; }
        }

        /* 1. protein pacing: short of target with dinner still ahead */
        try{
          var tPro = (typeof proteinTarget === 'function') ? proteinTarget() : null;
          if(tPro){
            var tot = dayTotals(key);
            var gap = tPro - (tot.p || 0);
            var at1 = at(NUDGE_TIMES.protein);
            if(at1 && tot.n > 0 && gap >= 25 && added < 2){
              var g = round5(Math.min(gap, 40));   /* dinner-sized suggestion, not the whole gap */
              out.push({ id:'nudge-protein-'+key, at: at1, kind:'coach-nudge', channel:'habits',
                title:'Protein is ' + Math.round(tot.p) + ' of ' + tPro + ' g',
                body:'A ' + g + ' g dinner puts you on target.',
                action:'open-meal', open:'open-meal', meal:2, day:key });
              if(live) coachFeed({ key:'nudge-protein-'+key,
                text:'Protein is ' + Math.round(tot.p) + ' of ' + tPro + ' g. A ' + g + ' g dinner puts you on target.',
                go:{ label:'Open today', pane:'today' } });
              added++;
            }
          }
        }catch(e){}

        /* 2. session saver: today is a training day and it is still undone */
        try{
          var d = plannedToday();
          var at2 = at(NUDGE_TIMES.session);
          if(at2 && d && !trainedToday(key) && added < 2){
            out.push({ id:'nudge-session-'+key, at: at2, kind:'coach-nudge', channel:'habits',
              title: d.name + ' is still on the table',
              body:'20 minutes is enough.',
              action:'open-workout', open:'open-workout' });
            if(live) coachFeed({ key:'nudge-session-'+key,
              text: d.name + ' is still on the table. 20 minutes is enough.',
              go:{ label:'Open training', pane:'train' } });
            added++;
          }
        }catch(e){}

        /* 3. streak saver: a real run is one quiet day from breaking */
        try{
          var at3 = at(NUDGE_TIMES.streak);
          if(at3 && added < 2 && typeof streaks === 'function' && typeof activeDays === 'function'){
            var st = streaks();
            var run = (st && st.trueRun) || 0;
            var todayActive = activeDays().has(key) || trainedToday(key);
            if(run >= 3 && !todayActive){
              out.push({ id:'nudge-streak-'+key, at: at3, kind:'coach-nudge', channel:'habits',
                title:'The ' + run + '-day run breaks tomorrow',
                body:'One log keeps it.',
                action:'open-brief', open:'open-brief' });
              if(live) coachFeed({ key:'nudge-streak-'+key,
                text:'The ' + run + '-day run breaks tomorrow. One log keeps it.',
                go:{ label:'Open today', pane:'today' } });
              added++;
            }
          }
        }catch(e){}
      }catch(e){}
      return out;
    };
    window.remPlan.__v375 = true;
  }
})();
