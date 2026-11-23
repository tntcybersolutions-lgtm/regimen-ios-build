/* C3 screen: built. v341. The end of the first setup: what was actually built, in numbers, before the first day.
   The top-rated apps (Fitbod, MacroFactor, Ladder; research 18 Oct 2026) end setup with a plan summary and land on a
   workout that is ready. Every number here is read from the app's own plan: the 12-week block (BLOCK_WEEKS, buildBlock),
   this week (h.week), today's meals and the week's groceries (the meal kit, mpGrocery), the check-in day (ALL.prefs).
   Nothing is shown that was not built. One primary control: Start my day. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function stat(n, label){ return '<div><b class="c3-num">' + esc(String(n)) + '</b><span>' + esc(label) + '</span></div>'; }

  C3.screen('built', {
    nav: 'today', chrome: false,
    render: function(ctx){
      var W = h.week(), weeks = safe(function(){ return BLOCK_WEEKS; }, 12);
      var trainDays = safe(function(){ return ALL.train.days | 0; }, 0) || (W.days || []).filter(function(d){ return d && !d.rest; }).length;
      var mk = C3.mk, key = mk ? mk.today() : '', meals = null, groc = 0, mealsLine = '';
      var aim = safe(function(){ return mpAim(key); }, null);
      if(mk && aim){
        if(!mk.ready()){ safe(function(){ mpLoad().then(function(){ if(C3.current === 'built') C3.refresh(); }); }); mealsLine = 'Building your meals.'; }
        else {
          if(!mk.day(key)) safe(function(){ mpEnsure(); });
          var D = mk.day(key);
          if(D && !D.off){ meals = D.meals.length; var t = mk.dayTot(D); mealsLine = 'Today: ' + meals + ' meals, ' + fmt.n(t.kcal) + ' kcal, ' + fmt.n(t.p) + ' g protein.'; }
          groc = (safe(function(){ return mpGrocery(key, 7); }, []) || []).filter(function(x){ return !x.staple; }).length;
        }
      }
      var ck = safe(function(){ return (ALL.prefs && ALL.prefs.checkinDay != null) ? ALL.prefs.checkinDay | 0 : null; }, null);
      var stats = '<div class="c3-stats bt-stats">' + stat(weeks, 'weeks of training') + stat(trainDays, trainDays === 1 ? 'day a week' : 'days a week') +
        (meals != null ? stat(meals, 'meals today') : '') + (groc ? stat(groc, 'groceries this week') : '') + '</div>';
      var lines = '<ul class="bt-lines">' +
        '<li><span class="k">Training</span><span class="v">' + esc(weeks + ' weeks, ' + (W.label || (trainDays + '-day plan'))) + '. Week ' + W.weekNo + ' starts now.</span></li>' +
        (mealsLine ? '<li><span class="k">Meals</span><span class="v">' + esc(mealsLine) + (groc ? ' ' + groc + ' groceries for the week.' : '') + '</span></li>' : '') +
        (ck != null ? '<li><span class="k">Check-in</span><span class="v">Every ' + esc(DAYS[ck]) + '.</span></li>' : '') +
      '</ul>';
      return '<div class="bt">' +
        '<header class="bt-head"><div class="c3-eyebrow"><i></i>Your plan is built</div><h1 class="c3-h1">Ready<span class="pk">.</span></h1></header>' +
        stats +
        '<section class="bt-week" aria-label="This week">' + h.weekHeadHTML(W) + h.weekStripHTML(W, W.todayDow) + '</section>' +
        lines +
        '<div class="bt-go"><button type="button" class="c3-btn-primary bt-start" data-act="start" data-key="start"><span>Start my day</span>' + h.icon('arrow', 50, 3) + '</button>' +
        '<div class="bt-more"><button type="button" class="c3-link" data-deep="train:block" data-key="block">See the 12 weeks</button>' +
        (C3.screens.guide ? '<button type="button" class="c3-link" data-go="guide" data-key="guide">Open your guide</button>' : '') + '</div></div>' +
      '</div>';
    },
    wire: function(root){
      root.querySelectorAll('[data-day]').forEach(function(b){b.addEventListener('click',function(){C3.go('train',{day:+b.getAttribute('data-day')});});});
      root.querySelectorAll('[data-act="start"]').forEach(function(b){ b.addEventListener('click', function(){ C3.go('today'); }); });
    }
  });
})();
