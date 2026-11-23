/* C3 screen: DELOAD (v316). Chad, 16 Oct 2026: "build in the DELOAD SECTION explaining why and very
   informative and useful, then resume in case of plateau, and truth, sassy truth".
   Data first: when the deload is (this week, now, in N weeks, done), the weeks around it, Shay's truth,
   the one control (deload this week / resume full training), what it changes in THIS plan's own numbers,
   and what the log says about each lift, the check-in and resting heart rate. The why is below the
   numbers, with its sources. Every number comes from deloadRead() / deloadCompare() in index.html. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc;
  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function fmtLb(v){ return safe(function(){ return fmtW(wNum(v, 0)) + ' ' + wU(); }, Math.round(v) + ' lb'); }
  function pct(v){ return (v > 0 ? '+' : '') + Math.round(v * 100) + '%'; }

  var HEAD = {
    on:   {big:'This week', eye:'Deload', sub:'Lighter on purpose. Same days, same lifts.'},
    now:  {big:'Now', eye:'Deload', sub:'Your log says it is time.'},
    back: {big:'Done', eye:'Deload', sub:'Back to full training. The weights pick up where they were.'},
    soon: {big:'', eye:'Deload', sub:''},
    thin: {big:'', eye:'Deload', sub:''}
  };

  function track(D){
    var from = Math.max(0, D.wi - 3), to = from + 8, out = '';
    for(var i = from; i < to; i++){
      var dl = safe(function(){ return isDeloadWeek(i); }, false), cur = i === D.wi, past = i < D.wi;
      out += '<div class="dl-w' + (dl ? ' is-dl' : '') + (cur ? ' cur' : '') + (past ? ' past' : '') + '"' + (cur ? ' aria-current="true"' : '') + '>' +
        '<i></i><span class="c3-num">' + (dl ? 'D' : 'W' + (i + 1)) + '</span></div>';
    }
    return '<div class="dl-track" role="img" aria-label="Weeks ' + (from + 1) + ' to ' + to + ', deload weeks marked D, this week is week ' + (D.wi + 1) + '">' + out + '</div>';
  }
  function spark(s){
    var w = 120, hh = 34, es = s.map(function(p){ return p.e; }), lo = Math.min.apply(null, es), hi = Math.max.apply(null, es), span = Math.max(1, hi - lo);
    var pts = s.map(function(p, i){ return Math.round(i / Math.max(1, s.length - 1) * w * 10) / 10 + ',' + Math.round((hh - 4 - (p.e - lo) / span * (hh - 8)) * 10) / 10; }).join(' ');
    var last = s.length - 1, lx = Math.round(w * 10) / 10, ly = Math.round((hh - 4 - (es[last] - lo) / span * (hh - 8)) * 10) / 10;
    return '<svg class="dl-spark" viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>' +
      '<circle cx="' + lx + '" cy="' + ly + '" r="3.2" fill="currentColor"></circle></svg>';
  }
  function liftRow(l){
    var word = l.status === 'up' ? 'Climbing ' + pct(l.gain) : l.status === 'down' ? Math.round(-l.drop * 100) + '% under its best' :
      l.status === 'stalled' ? 'No new best in ' + l.since + ' sessions' : 'Holding';
    return '<li class="dl-lift ' + l.status + '"><span class="n">' + esc(l.n) + '</span>' + spark(l.s) +
      '<span class="w">' + esc(word) + '</span><span class="t c3-num">' + esc(fmtLb(l.last.lb) + ' × ' + l.last.reps) + '</span></li>';
  }
  function readSec(D){
    var rows = '';
    if(D.lifts.length) rows += '<ul class="dl-lifts">' + D.lifts.slice(0, 6).map(liftRow).join('') + '</ul>';
    else rows += '<p class="dl-empty">A lift needs four logged sessions in six weeks before its trend means anything. None has that yet.</p>';
    var meters = '';
    if(D.feel){
      var f = D.feel, mx = 28;
      meters += '<div class="dl-meter' + (f.worse ? ' bad' : '') + '"><span class="k">Check-in</span>' +
        '<span class="bars"><i style="width:' + Math.round(f.base / mx * 100) + '%"></i><i class="now" style="width:' + Math.round(f.now / mx * 100) + '%"></i></span>' +
        '<span class="v c3-num">' + f.now + ' <small>vs ' + f.base + '</small></span><span class="s">' + (f.worse ? 'worse than your usual' : 'your usual') + ', lower is better</span></div>';
    }
    if(D.rhr){
      var r = D.rhr;
      meters += '<div class="dl-meter' + (r.up ? ' bad' : '') + '"><span class="k">Resting heart rate</span>' +
        '<span class="bars"><i style="width:' + Math.round(r.base / 100 * 100) + '%"></i><i class="now" style="width:' + Math.round(r.now / 100 * 100) + '%"></i></span>' +
        '<span class="v c3-num">' + r.now + ' <small>vs ' + r.base + ' bpm</small></span><span class="s">' + (r.up ? 'up on your usual' : 'your usual') + ', from Apple Health</span></div>';
    }
    var tally = D.lifts.length ? '<div class="dl-tally"><b class="c3-num">' + D.stuck.length + '</b><span>of <b class="c3-num">' + D.lifts.length + '</b> lifts stuck</span></div>' : '';
    return '<section class="dl-read" aria-label="What your log says"><div class="dl-lbl">What your log says</div>' + tally + rows + meters + '</section>';
  }
  function changeSec(D, C){
    var drop = C.setsFrom > 0 ? Math.round((1 - C.setsTo / C.setsFrom) * 100) : 40;
    var loads = C.loads.length ? '<ul class="dl-loads">' + C.loads.map(function(x){ return '<li><span>' + esc(x.n) + '</span><b class="c3-num">' + esc(fmtLb(x.from)) + '</b><i>→</i><b class="c3-num to">' + esc(fmtLb(x.to)) + '</b></li>'; }).join('') + '</ul>' : '';
    return '<section class="dl-change" aria-label="What the deload changes"><div class="dl-lbl">' + (D.on ? 'This week' : 'Your deload week') + '</div>' +
      '<div class="dl-big"><div><b class="c3-num">' + C.setsFrom + '<i>→</i>' + C.setsTo + '</b><span>Sets, ' + drop + '% fewer</span></div>' +
        '<div><b class="c3-num">10%</b><span>Lighter on every lift</span></div>' +
        '<div><b class="c3-num">3 to 4</b><span>Reps left in the tank</span></div>' +
        '<div><b class="c3-num">Same</b><span>Days and lifts</span></div></div>' + loads + '</section>';
  }
  function act(D){
    if(D.verdict === 'on') return (D.named && !D.forced) ? '' :
      '<div class="dl-act"><button type="button" class="dl-quiet" data-act="dl-resume" data-key="dl-resume">Feeling fresh? Resume full training</button></div>';
    if(D.verdict === 'now') return '<div class="dl-act"><button type="button" class="c3-btn-primary dl-go" data-act="dl-now" data-key="dl-now"><span>Deload this week</span><span class="r">' + h.icon('arrow', 34, 3) + '</span></button></div>';
    if(D.verdict === 'back') return '';
    return '<div class="dl-act"><button type="button" class="dl-quiet" data-act="dl-now" data-key="dl-now">Deload this week anyway</button></div>';
  }
  function shay(D){
    var t = safe(function(){ return shayDeloadLine(D.verdict); }, null);
    if(!t) return '';
    var face = safe(function(){ return coachBadge('shaniqua', 96); }, '');
    return '<div class="dl-shay">' + (face ? '<img src="' + esc(face) + '" alt="" width="52" height="52">' : '') +
      '<p><b>Shay</b> <span>' + esc(t) + '</span></p>' +
      '<button type="button" class="dl-say" data-act="dl-say" data-key="dl-say" aria-label="Hear Shay say it">' + h.icon('play', 16, 2) + '</button></div>';
  }
  var SRC = [
    ['Rogerson et al. 2024, Deloading Practices in Strength and Physique Sports, Sports Medicine Open', 'https://doi.org/10.1186/s40798-024-00691-y'],
    ['Coleman et al. 2024, Gaining more from doing less? A one-week deload during resistance training, PeerJ', 'https://doi.org/10.7717/peerj.16777'],
    ['Bell et al. 2022, coaches on deloading in strength and physique sports, Frontiers in Sports and Active Living', 'https://doi.org/10.3389/fspor.2022.1073223']
  ];
  function why(){
    var S = function(t, body){ return '<div class="dl-q"><h3>' + t + '</h3>' + body + '</div>'; };
    return '<section class="dl-why" aria-label="Why deload">' +
      '<div class="dl-lbl">Why a deload works</div>' +
      '<div class="dl-qs">' +
      S('What it is', '<p>A planned light week. You train the same days and the same lifts, with fewer sets, a little less weight and more reps left in the tank. It is not a week off.</p>') +
      S('Why it works', '<p>Every hard week builds two things: fitness, which lasts, and fatigue, which hides it. Fatigue fades faster than fitness does. One light week lets the fatigue go while the fitness stays, so what you built can show up on the bar.</p>') +
      S('When to pull it early', '<p>Lifts that stop moving. A check-in that keeps getting worse. Joints and muscles that stay beat up. In the survey below, <b class="c3-num">54%</b> of lifters deload when performance stalls and <b class="c3-num">63%</b> when they feel beat up. This screen reads the first two from your log: a lift with no new best in three sessions, and your check-in against your own usual.</p>') +
      S('What lifters actually do', '<p>246 competitive strength and physique athletes, surveyed in 2024: a deload every <b class="c3-num">5.6</b> weeks on average, lasting about <b class="c3-num">6</b> days. <b class="c3-num">92%</b> do it to shed fatigue. They cut sets and reps, take some weight off, stop further from failure, and keep the same exercises and the same number of days. The built-in plan does exactly that every fourth week.</p>') +
      S('The truth about a week off', '<p>A 2024 trial took 39 trained lifters through nine weeks. One group stopped lifting completely for week five. They kept the same muscle and power, but gained less squat strength than the group that kept training. That is why this deload lightens the week instead of canceling it.</p>') +
      S('Do it right', '<ul class="dl-do"><li><b>Do</b> every session, lighter. Same form, same days.</li><li><b>Do</b> keep protein, water and steps where they are.</li><li><b>Do not</b> test a max or chase a record this week.</li><li><b>Do not</b> add sets because it feels easy. Easy is the point.</li></ul>') +
      S('Then resume', '<p>The week after, training goes back to full. The weights pick up from where they were before the deload, not from the light ones, and the next one lands three training weeks later.</p>') +
      '</div><div class="dl-src"><span>Sources</span>' + SRC.map(function(x){ return '<a href="' + esc(x[1]) + '" target="_blank" rel="noopener">' + esc(x[0]) + '</a>'; }).join('') + '</div></section>';
  }

  C3.screen('deload', {
    nav: 'train',
    render: function(ctx){
      var D = safe(function(){ return deloadRead(); }, null);
      if(!D) return '<div class="dl"><button type="button" class="yd-back dl-back" data-go="train" data-key="back">' + h.icon('back', 18, 2.6) + '<span>Train</span></button><p class="dl-empty">Set up your plan first.</p></div>';
      var C = safe(function(){ return deloadCompare(D.on ? D.wi : (D.next != null ? D.next : D.wi)); }, {setsFrom:0, setsTo:0, loads:[]});
      var H = HEAD[D.verdict] || HEAD.soon, big = H.big, sub = H.sub;
      if(D.verdict === 'soon' || D.verdict === 'thin'){ big = D.weeksTo == null ? 'Not set' : 'In ' + D.weeksTo + ' wk' + (D.weeksTo === 1 ? '' : 's'); sub = D.verdict === 'thin' ? 'On the calendar. Your log is still too short to read a plateau.' : 'On the calendar. Your lifts are moving, nothing to pull forward.'; }
      if(D.verdict === 'now' && D.why.length) sub = D.why.join('. ').replace(/^./, function(c){ return c.toUpperCase(); }) + '.';
      var wkline = 'Week ' + (D.wi + 1) + ' of your plan' + (D.last != null ? ' · last deload week ' + (D.last + 1) : '');
      return '<div class="dl v-' + D.verdict + '">' +
        '<button type="button" class="yd-back dl-back" data-go="train" data-key="back">' + h.icon('back', 18, 2.6) + '<span>Train</span></button>' +
        '<div class="dl-top"><div class="dl-head">' +
          '<div class="c3-eyebrow"><i></i>' + esc(H.eye) + '</div>' +
          '<h1 class="c3-h1 dl-h' + (big.length > 9 ? ' long' : '') + '">' + esc(big) + '</h1>' +
          '<p class="dl-sub">' + esc(sub) + '</p><p class="dl-wk c3-num">' + esc(wkline) + '</p>' +
          track(D) + shay(D) + act(D) + changeSec(D, C) +
        '</div>' + readSec(D) + '</div>' +
        why() +
      '</div>';
    },
    wire: function(root){
      if(root.__dl) return; root.__dl = 1;
      root.addEventListener('click', function(e){
        var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if(!b) return;
        var a = b.getAttribute('data-act');
        if(a === 'dl-now'){ safe(function(){ deloadNow(); }); C3.render(true); }
        else if(a === 'dl-resume'){ safe(function(){ deloadResume(); }); C3.render(true); }
        else if(a === 'dl-say'){
          var reset=function(){b.dataset.playing='';b.setAttribute('aria-label','Hear Shay say it');b.setAttribute('aria-pressed','false');b.innerHTML=h.icon('play',16,2);};
          if(b.dataset.playing==='true'){safe(function(){shayHush();});reset();return;}
          var t=safe(function(){return shayDeloadLine(deloadRead().verdict);},null);
          if(!t){if(C3.yd)C3.yd.toast('No spoken guidance is available here yet.');return;}
          b.dataset.playing='true';b.setAttribute('aria-label','Stop Shay speaking');b.setAttribute('aria-pressed','true');b.innerHTML=h.icon('x',16,2);
          var started=safe(function(){shayVoiceUnlock();return shaySpeak(t,true,reset);},false);if(!started){reset();if(C3.yd)C3.yd.toast('Audio is unavailable here. You can read the guidance above.');}
        }
      });
    }
  });
})();
