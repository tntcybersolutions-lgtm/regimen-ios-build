/* C3 module: the wins engine (build-plan item 5).
   Not a screen: no render function of its own. Detects wins from the app's own
   state, keeps each one once (ALL.coach.wins), mirrors the big ones into the
   coach feed (kind 'win', same shape as the nudge and meal mirrors), and gives
   Today its wins strip and Progress its wins collection.

   v1 wins (the shell's own milestones already cover ten sessions, five pounds,
   PRs and thirty check-ins, so these never repeat them):
     first-session / first-food / first-weigh   first-of-a-kind logs, once each
     streak-3 / streak-7 / streak-14 / streak-30   true consecutive logged days
     week-kept (weekly)                         every planned session done last week
     protein (daily, quiet)                     protein target met: collection only

   The first run on an account with history seeds what is already true WITHOUT
   feed entries: celebrations are for new transitions, not for import day.
   Feed entries cap at 2 a day; anything past that is still recorded.
   Detection rides the shell's drawAll (wraps it the way the nudges wrap remPlan)
   and runs once at load. Every probe is defensive: a missing helper means the
   win stays home and the app is untouched. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;
  function safe(fn, d){ try{ var v = fn(); return v === undefined ? d : v; }catch(e){ return d; } }
  var DAYMS = 864e5;

  var ICONS = {
    first:  '<path d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7-6-3.3-6 3.3 1.3-6.7-5-4.6 6.8-.8z"></path>',
    streak: '<path d="M12 21.2c-3.9 0-6.6-2.7-6.6-6.3 0-2.9 1.7-4.8 3.3-6.6.9-1 1.8-2 2.3-3.3.2-.5.8-.6 1.1-.2 1.9 2.3 2.4 4.3 2.2 6 1-.4 1.7-1.2 2-2.2.2-.5.8-.6 1.1-.1 1.2 1.6 1.2 3.4 1.2 4.9 0 4.6-2.8 7.8-6.6 7.8z"></path><path d="M12 21.2c-1.7 0-2.9-1.2-2.9-2.9 0-1.6 1.2-2.6 2.1-3.7.3-.4.9-.3 1 .2.2.8.7 1.4 1.4 1.7.3-.4.6-.9.7-1.5.1-.4.6-.5.9-.2.6.8.8 1.7.8 2.6 0 2.2-1.6 3.8-4 3.8z"></path>',
    week:   '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path><path d="M9 15.5l2 2 4-4.5"></path>',
    protein:'<circle cx="12" cy="12" r="8.2"></circle><path d="M8.5 12.2l2.4 2.4 4.6-5"></path>'
  };
  function icon(k, size){ return '<svg class="c3-ic" width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[k] || ICONS.first) + '</svg>'; }
  function md(at){ try{ return new Date(at).toLocaleDateString(undefined, {month:'short', day:'numeric'}); }catch(e){ return ''; } }

  /* the win table: detection + the member-approved lines (2026-10-30) */
  var DEFS = [
    { id:'first-session', n:'First session', icon:'first', pane:'train',
      text:'First session on the board. Every run starts exactly like this.',
      goLabel:'Open training',
      test:function(){ return safe(function(){ return sessionRows().length; }, 0) >= 1; } },
    { id:'first-food', n:'First food log', icon:'first', pane:'food',
      text:'First food log in. Now the numbers can coach you.',
      goLabel:'Open food',
      test:function(){ return safe(function(){ return (ALL.food || []).length; }, 0) >= 1; } },
    { id:'first-weigh', n:'First weigh-in', icon:'first', pane:'body',
      text:'First weigh-in logged. The trend starts here.',
      goLabel:'Open progress',
      test:function(){ return safe(function(){ return (ALL.weights || []).length; }, 0) >= 1; } },
    { id:'streak-3', n:'3-day run', icon:'streak', pane:'console', run:3,
      text:'Three days straight. That is a run now.', goLabel:'Open today' },
    { id:'streak-7', n:'7-day run', icon:'streak', pane:'console', run:7,
      text:'Seven days straight. A full week, no gaps.', goLabel:'Open today' },
    { id:'streak-14', n:'14-day run', icon:'streak', pane:'console', run:14,
      text:'Fourteen days straight. Two weeks of showing up.', goLabel:'Open today' },
    { id:'streak-30', n:'30-day run', icon:'streak', pane:'console', run:30,
      text:'Thirty days straight. This is who you are now.', goLabel:'Open today' },
    { id:'week-kept', n:'Perfect week', icon:'week', pane:'recap', repeat:'week',
      text:'Every planned session last week, done. That is a perfect week.', goLabel:'Open progress' },
    { id:'protein', n:'Protein day', icon:'protein', pane:'food', repeat:'day', quiet:true }
  ];

  function store(){ ALL.coach = ALL.coach || {}; if(!ALL.coach.wins) ALL.coach.wins = {}; return ALL.coach.wins; }
  function meta(){ ALL.coach = ALL.coach || {}; if(!ALL.coach.winsMeta) ALL.coach.winsMeta = {}; return ALL.coach.winsMeta; }
  function runDays(){ return safe(function(){ var s = streaks(); return (s && (s.now || s.trueRun)) | 0; }, 0); }
  function lastWeek(){ return safe(function(){ return recapWindow('week', Date.now() - 7 * DAYMS); }, null); }

  function keyFor(def){
    if(def.repeat === 'day') return def.id + ':' + safe(function(){ return dkey(Date.now()); }, '');
    if(def.repeat === 'week'){ var w = lastWeek(); return def.id + ':' + (w ? w.from : 'now'); }
    return def.id;
  }
  function truthy(def){
    try{
      if(def.run) return runDays() >= def.run;
      if(def.id === 'week-kept'){
        /* only worth computing while last week's result is fresh (Sun - Tue) */
        if(new Date().getDay() > 2) return false;
        var w = lastWeek(); if(!w) return false;
        var S = safe(function(){ return scorecardFor(w.from); }, null);
        return !!(S && S.planned > 0 && S.sessions >= S.planned);
      }
      if(def.id === 'protein'){
        var key = safe(function(){ return dkey(Date.now()); }, '');
        var t = safe(function(){ return dayTotals(key); }, null);
        var pT = safe(function(){ return proteinTarget(); }, 0);
        return !!(t && (t.n | 0) > 0 && pT > 0 && (t.p || 0) >= pT);
      }
      return !!def.test();
    }catch(e){ return false; }
  }
  function lineFor(def){
    if(def.id === 'protein'){
      var key = safe(function(){ return dkey(Date.now()); }, '');
      var t = safe(function(){ return dayTotals(key); }, null);
      var pT = safe(function(){ return proteinTarget(); }, 0);
      return (t && pT) ? (Math.round(t.p) + ' of ' + Math.round(pT) + ' g protein') : 'Protein target met';
    }
    if(def.id === 'week-kept'){
      var w = lastWeek();
      var S = w ? safe(function(){ return scorecardFor(w.from); }, null) : null;
      return S ? (S.sessions + ' of ' + S.planned + ' planned sessions') : def.text;
    }
    return def.text;
  }

  function celebrate(fresh){
    var M = meta(), day = safe(function(){ return dkey(Date.now()); }, '');
    if(M.feedDay !== day){ M.feedDay = day; M.feedN = 0; }
    fresh.forEach(function(def){
      try{
        if(def.quiet) return;
        if((M.feedN | 0) >= 2) return;
        ALL.coach = ALL.coach || {}; ALL.coach.log = ALL.coach.log || [];
        var k = 'win:' + keyFor(def);
        if(ALL.coach.log.some(function(x){ return x && x.key === k; })) return;
        M.feedN = (M.feedN | 0) + 1;
        ALL.coach.log.push({
          id: 'wn' + Math.random().toString(36).slice(2, 10),
          at: Date.now(),
          coach: ALL.coach.lead || 'dakota-jane',
          kind: 'win',
          key: k,
          text: def.text,
          go: { label: def.goLabel, pane: def.pane },
          up: null, acted: null, ai: false
        });
      }catch(e){}
    });
  }

  function check(){
    var W, M;
    try{ W = store(); M = meta(); }catch(e){ return; }
    var seeding = !M.seeded, fresh = [];
    DEFS.forEach(function(def){
      try{
        var k = keyFor(def);
        if(W[k] || !truthy(def)) return;
        W[k] = { id:def.id, n:def.n, line:lineFor(def), at:Date.now(), icon:def.icon, pane:def.pane };
        fresh.push(def);
      }catch(e){}
    });
    if(seeding) M.seeded = Date.now();
    if(fresh.length){
      if(!seeding) celebrate(fresh);
      try{ save(); }catch(e){}
    } else if(seeding){ try{ save(); }catch(e){} }
  }

  /* ---------- the surfaces ---------- */
  function all(){
    var W = safe(function(){ return store(); }, {}) || {};
    return Object.keys(W).map(function(k){ return W[k]; }).filter(function(w){ return w && w.at; })
      .sort(function(a, b){ return b.at - a.at; });
  }
  function stripHTML(){
    try{
      var L = all();
      if(!L.length) return '';
      var latest = L[0];
      var from = safe(function(){ return recapWindow('week').from; }, 0);
      var wc = L.filter(function(w){ return w.at >= from; }).length;
      var when = md(latest.at);
      return '<section class="wn-strip" aria-label="Your wins">' +
        '<button type="button" data-go="progress" data-key="wn-strip" aria-label="Latest win: ' + esc(latest.n) + '. ' + wc + (wc === 1 ? ' win' : ' wins') + ' this week. Open your wins">' +
        icon(latest.icon, 20) +
        '<span class="wn-s-last"><b>' + esc(latest.n) + '</b><span>' + esc(when) + '</span></span>' +
        '<span class="wn-s-count"><b class="c3-num">' + wc + '</b><span>' + (wc === 1 ? 'win' : 'wins') + ' this week</span></span>' +
        '</button></section>';
    }catch(e){ return ''; }
  }
  function winRoute(w){ return ({console:'today', recap:'progress'})[w.pane] || w.pane || 'today'; }
  function sectionHTML(){
    try{
      var L = all();
      var list = L.length
        ? '<ol class="wn-list">' + L.slice(0, 50).map(function(w){
            return '<li><button type="button" class="wn-open" data-go="' + esc(winRoute(w)) + '" aria-label="' + esc(w.n + ', open related log') + '"><span class="wn-ic">' + icon(w.icon, 18) + '</span><span class="wn-nm"><b>' + esc(w.n) + '</b>' + (w.line ? '<span>' + esc(w.line) + '</span>' : '') + '</span><span class="wn-d">' + esc(md(w.at)) + '</span></button></li>';
          }).join('') + '</ol>'
        : '<p class="wn-none">Your first workout, food log or weigh-in earns a win.</p><button type="button" class="c3-btn-quiet" data-go="train">Log your first workout</button>';
      return '<section class="pg-wins" aria-label="Wins">' +
        '<div class="pg-sec"><i></i>Wins</div><p class="wn-guide">Milestones from your own logs. Tap a win to open its related log.</p>' +
        '<div class="wn-num"><b class="c3-num">' + L.length + '</b><span>' + (L.length === 1 ? 'win' : 'wins') + ' earned</span></div>' + list +
      '</section>';
    }catch(e){ return ''; }
  }

  C3.wins = { all: all, check: check, stripHTML: stripHTML, sectionHTML: sectionHTML };

  /* ride the shell's draw cycle: every save and screen change re-checks, cheaply */
  try{
    if(window.drawAll && !window.drawAll.__vWins){
      var orig = window.drawAll;
      window.drawAll = function(){
        var out = orig.apply(this, arguments);
        try{ check(); }catch(e){}
        return out;
      };
      window.drawAll.__vWins = true;
    }
  }catch(e){}
  try{ check(); }catch(e){}
})();
