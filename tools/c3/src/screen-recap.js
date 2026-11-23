/* C3 screen: recap. The old Recap pane on Progress (renderRecap, renderStreak, the
   huddle and the scorecard) on one page: the period switch and the step back and forward,
   the four rings, the recap itself, the scorecard, the team's morning note, and the
   showing-up block. All of it reads the same shell helpers and the same RECAP state; only
   the frame changes - no cards, no banded gradients, the rings are the only things drawn. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    function kinds(){ return safe(function(){ return RECAP_KINDS; }, [['week','Week'],['month','Month'],['year','Year']]); }
    function backN(){ return safe(function(){ return RECAP.back | 0; }, 0); }

    /* the old pane's renderStreak, word for word, with the host passed in instead of the
       fixed rdStreak id; every helper it touches is the shell's own */
    function streakInto(host){
      if(!host) return;
      var S2 = safe(function(){ return streaks(); }, null);
      if(!S2) return;
      var rep = safe(function(){ return repairable(); }, []);
      var today = dkey(Date.now());
      var A = safe(function(){ return activeDays(); }, new Set());
      var days = [];
      for(var i = 13; i >= 0; i--){
        (function(){
          var t = Date.now() - i * DAY, k = dkey(t);
          days.push({k:k, t:t, logged:A.has(k), paused:safe(function(){ return isPaused(k); }, false), repair:!!safe(function(){ return pauses()[k] && pauses()[k].repair; }, false), today:k === today});
        })();
      }
      host.innerHTML = '<div class="tiles"><div class="tile"><div class="k">Streak</div><div class="v" style="color:var(--blue-t)">' + S2.now + '<small>day' + (S2.now === 1 ? '' : 's') + '</small></div></div>' +
        (S2.differs ? '<div class="tile"><div class="k">Counting pauses</div><div class="v">' + S2.held + '<small>' + S2.paused + ' held</small></div></div>' : '') +
        '<div class="tile"><div class="k">Longest ever</div><div class="v">' + S2.best + '</div></div>' +
        '<div class="tile"><div class="k">Repairs left</div><div class="v">' + S2.repairs + '<small>of ' + STREAK_FREEZES + ' a month</small></div></div></div>' +
        '<div class="stdots">' + days.map(function(d){
          return '<button class="stdot' + (d.logged ? ' on' : '') + (d.paused ? ' held' : '') + (d.today ? ' now' : '') + '" data-pause="' + d.k + '" title="' + new Date(d.t).toLocaleDateString(void 0, {weekday:'long', month:'short', day:'numeric'}) + ', ' + (d.logged ? 'logged' : d.paused ? d.repair ? 'repaired' : 'paused' : 'nothing') + '" aria-label="' + new Date(d.t).toLocaleDateString() + ', ' + (d.logged ? 'logged' : d.paused ? 'paused' : 'nothing logged') + '"><i></i><span>' + new Date(d.t).toLocaleDateString(void 0, {weekday:'narrow'}) + '</span></button>';
        }).join('') + '</div>' +
        (rep.length ? '<div class="exaux"><div class="auxh">A day you missed</div><div class="auxr"><b>' + new Date(Date.parse(rep[0] + 'T12:00:00')).toLocaleDateString(void 0, {weekday:'long', month:'short', day:'numeric'}) + '</b><span>nothing logged</span></div>' + (S2.repairs ? '<button class="mini go" data-repair="' + rep[0] + '">Repair it (' + S2.repairs + ' left)</button>' : '<p class="note" style="color:var(--amber)">No repairs left this month.</p>') + '</div>' : '') +
        safe(function(){ return goalHTML(); }, '') +
        '<p class="note">' + (S2.differs ? 'Your run is <b>' + S2.now + ' day' + (S2.now === 1 ? '' : 's') + '</b> unbroken, or <b>' + S2.held + '</b> if the ' + S2.paused + ' paused day' + (S2.paused === 1 ? '' : 's') + ' ' + (S2.paused === 1 ? 'is' : 'are') + ' treated as neutral. Both are shown because a streak that quietly counts frozen days is a number you cannot read: ninety real days and sixty with thirty frozen would look the same.' : 'Tap any day to mark it paused, a week off, illness, travel. A paused day is never counted as logged; it is held, and the app shows you both numbers rather than one it has quietly adjusted.') + '</p>';
      host.querySelectorAll('[data-pause]').forEach(function(b){
        b.addEventListener('click', function(){
          var k = b.dataset.pause;
          if(safe(function(){ return activeDays().has(k); }, false)){ safe(function(){ say('That day has something logged on it, there is nothing to pause.'); }); return; }
          var on = safe(function(){ return pauseDay(k); }, null);
          streakInto(host);
          if(on && on.vacay){ safe(function(){ say('That day is inside your ' + esc(on.vacay.from) + ', ' + esc(on.vacay.to) + ' break. Remove the break below rather than the day.'); }); return; }
          safe(function(){ say(on ? 'Marked as a day off.' : 'Pause removed.'); });
        });
      });
      safe(function(){ wireGoal(host); });
      host.querySelectorAll('[data-repair]').forEach(function(b){
        b.addEventListener('click', function(){
          var r = safe(function(){ return repairDay(b.dataset.repair); }, {ok:false, why:'That repair did not go through.'});
          streakInto(host);
          safe(function(){ say(r.ok ? 'Repaired, ' + r.left + ' left this month.' : r.why); });
        });
      });
    }

    yd.screen('recap', {
      parent: 'progress', old: ['progress', 'recap'], nav: 'progress',
      render: function(ctx){
        var st = ctx.state;
        var w = safe(function(){ return recapStep(RECAP.kind, Date.now(), -Math.abs(RECAP.back | 0)); }, null);
        if(!w) throw new Error('no recap window');
        st.w = w;
        var kind = safe(function(){ return RECAP.kind; }, 'week');
        var back = backN();

        var head = yd.head({back:'progress', eyebrow:'Progress', title:'Your ', pk:'recap'});
        var nav = yd.seg('kind', kinds(), kind, {aria:'Period'}) +
          '<div class="rc-nav">' +
            '<button type="button" class="rc-navbtn" data-act="prev" data-key="rc-prev">' + yd.icon('back', 16, 2.4) + '<span>Earlier</span></button>' +
            '<div class="rc-label">' + esc(w.label + (back ? '' : ' so far')) + '</div>' +
            '<button type="button" class="rc-navbtn" data-act="next" data-key="rc-next"' + (back <= 0 ? ' disabled' : '') + '><span>Later</span>' + yd.icon('chev', 16, 2.4) + '</button>' +
          '</div>' +
          yd.note('Built from what you logged, nothing estimated.');

        var R = safe(function(){ return recapData(w); }, null);
        st.R = R;
        var dials = '';
        if(R && !R.empty && R.days){
          dials = '<div class="dials rc-dials">' +
            '<div class="dial"><canvas id="c3rcD1" width="240" height="240"></canvas><div class="dv" id="c3rcV1"></div><div class="dk">Sessions</div></div>' +
            '<div class="dial"><canvas id="c3rcD2" width="240" height="240"></canvas><div class="dv" id="c3rcV2"></div><div class="dk">Protein</div></div>' +
            '<div class="dial"><canvas id="c3rcD3" width="240" height="240"></canvas><div class="dv" id="c3rcV3"></div><div class="dk">Steps</div></div>' +
            '<div class="dial"><canvas id="c3rcD4" width="240" height="240"></canvas><div class="dv" id="c3rcV4"></div><div class="dk">Weigh-ins</div></div>' +
          '</div>';
        }

        var body = '<div id="c3rcBody">' + safe(function(){ return recapHTML(w); }, '') + '</div>';

        var score = safe(function(){
          milestoneCheck();
          var S2 = scorecardCurrent();
          scorecardWords(S2);
          return scorecardHTML() + milestoneHTML();
        }, '');
        var scoreSec = score ? '<div id="c3rcScore">' + score + '</div>' : '';

        var hd = safe(function(){ return huddleHTML(); }, '');
        var huddleSec = hd ? yd.sec('Your team, this morning',
          yd.note('Before you opened the app, the four met about you') + '<div id="c3rcHuddle">' + hd + '</div>', {id:'huddle'}) : '';

        var streakSec = yd.sec('Showing up',
          yd.note('Both numbers, the run unbroken, and the run with pauses held.') + '<div id="c3rcStreak"></div>', {id:'streak'});

        return '<div class="yd rc">' + head + nav + dials + body + scoreSec + huddleSec + streakSec + '</div>';
      },
      wire: function(root, ctx){
        var st = ctx.state, w = st.w, R = st.R;
        if(R && !R.empty && R.days){
          var planned = 0, pT = 0, sT = 0;
          safe(function(){ planned = (coachProfile().planned7 || 0) * Math.max(1, R.days / 7); });
          safe(function(){ pT = proteinTarget() || 0; });
          safe(function(){ sT = stepTarget(false) || 0; });
          var of = function(a, b, u){ return a + '<span class="of"> / ' + b + (u ? ' ' + u : '') + '</span>'; };
          safe(function(){ ring(root.querySelector('#c3rcD1'), planned ? R.sessions / planned : 0, '#4DA3FF'); });
          var v1 = root.querySelector('#c3rcV1'); if(v1) v1.innerHTML = of(R.sessions, planned ? Math.round(planned) : 'n/a');
          safe(function(){ ring(root.querySelector('#c3rcD2'), pT && R.protMean ? R.protMean / pT : 0, '#3DDC97'); });
          var v2 = root.querySelector('#c3rcV2'); if(v2) v2.innerHTML = R.protMean ? of(Math.round(R.protMean), pT ? Math.round(pT) : 'n/a', 'g') : '<span class="of">no full days</span>';
          safe(function(){ ring(root.querySelector('#c3rcD3'), sT && R.stepMean ? R.stepMean / sT : 0, '#5CF2B0'); });
          var v3 = root.querySelector('#c3rcV3'); if(v3) v3.innerHTML = R.stepMean ? of(Math.round(R.stepMean).toLocaleString(), sT.toLocaleString()) : '<span class="of">none logged</span>';
          safe(function(){ ring(root.querySelector('#c3rcD4'), R.days ? R.weighIns / R.days : 0, '#4DA3FF'); });
          var v4 = root.querySelector('#c3rcV4'); if(v4) v4.innerHTML = of(R.weighIns, R.days, 'days');
        }
        var sh = root.querySelector('#rcShare');
        if(sh && w) sh.addEventListener('click', function(){ safe(function(){ shareRecap(w); }); });
        var sc = root.querySelector('#c3rcScore');
        if(sc) safe(function(){ wireScorecard(sc); });
        streakInto(root.querySelector('#c3rcStreak'));
        yd.wire(root, ctx, {
          kind: function(v){ safe(function(){ RECAP.kind = v; RECAP.back = 0; }); C3.render(); },
          prev: function(){ safe(function(){ RECAP.back++; }); C3.render(); },
          next: function(){ if(backN() > 0){ safe(function(){ RECAP.back--; }); C3.render(); } }
        }, {});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
