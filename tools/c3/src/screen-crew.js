/* C3 screen: crew (the old You > Crew pane, #p-youcrew: renderCrew, renderCoach, renderChallenges,
   and "what the crew sees" from the old You card).
   Your crew first: the code, who is in it and what each one shares; then what YOU share, the
   trainer's view of every member, the challenges, and your level and badges. The share card
   is one tap from here.
   Every server call goes through the app's own functions (crewRun, crewLoad, coachLoad,
   challengeRefresh, CLOUD.*), so the rules stay where they are: in Postgres.
   Leaving a crew and removing a challenge are confirmed on the control itself (press twice),
   never with a browser dialog. Crews are part of Pro, exactly as on the old screen. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    /* repaint while the app is talking to the server, and once more when it is done */
    var watchT = 0;
    function settled(){ return safe(function(){ return !(CREW.busy || COACH.busy || CHUI.busy) && CREW.loaded && (!CREW.id || COACH.loaded); }, true); }
    function watch(){
      if(watchT) return;
      var n = 0, calm = 0;
      watchT = setInterval(function(){
        if(C3.safety && C3.safety.panel){ return; }
        C3.refresh();
        calm = settled() ? calm + 1 : 0;
        if(calm > 2 || ++n > 120 || C3.current !== 'crew'){ clearInterval(watchT); watchT = 0; C3.refresh(); }
      }, 250);
    }
    /* The app reloads the trainer's numbers at the end of every crewLoad(). Its renderCoach()
       calls coachLoad() again while a load is already running whenever rows are still held
       (index.html, renderCoach: "if(!COACH.loaded){ ...; coachLoad(); return; }" with COACH.busy
       true), which recurses until the stack is gone. Dropping the held rows first puts it on
       its own "Reading" branch, so every reload asked for from this screen goes through here. */
    function reload(){ safe(function(){ COACH.rows = []; }); }
    function run(fn, ok){ reload(); try{ Promise.resolve(crewRun(fn, ok)).then(function(){ C3.refresh(); }, function(){ C3.refresh(); }); }catch(e){ console.error('[c3] crew', e); } watch(); }
    function uid(){ return safe(function(){ return myUid(); }, null); }
    function initial(n){ return esc(String(n || 'M').slice(0, 1).toUpperCase()); }
    var SHARE_OPTS = [['full', 'Everything'], ['stats', 'Sessions, steps, PRs'], ['prs', 'PRs only'], ['none', 'Nothing']];
    var SHARE_SAYS = {
      none: 'Nothing is shared. Not with the crew and not with a trainer.',
      full: 'The crew sees your sessions, steps, personal records and your latest weight.',
      prs: 'Other members see your personal records only. Crew trainers can also see your shared training, steps and latest weight.',
      stats: 'Other members see your sessions, steps and personal records, but not your weight. Crew trainers can also see your latest weight.'
    };

    function notes(){ return safe(function(){ return (CREW.err ? yd.note(esc(CREW.err), 'bad') : '') + (CREW.msg ? yd.note(esc(CREW.msg), 'good') : ''); }, ''); }

    /* ---------- your crew ---------- */
    function crewHTML(ctx){
      if(!yd.cloud()) return {state:'nocloud', html: yd.empty('Crews need the app. This build cannot reach a server.')};
      if(!yd.signedIn()) return {state:'signedout', html: '<p class="cr-word">A crew needs an account</p>' + yd.note('Start a crew or join one with a six-character code. Whoever starts it is the trainer.') +
        '<button type="button" class="c3-btn-rail cr-rail" data-act="signin" data-key="signin"><span>Sign in</span>' + h.icon('arrow', 26, 2.800) + '</button>'};
      if(!CREW.loaded) return {state:'loading', html: yd.empty('Checking your crew')};
      var busy = !!CREW.busy;
      if(!CREW.id){
        return {state:'none', html:
          '<div class="yd-fields cr-join">' + yd.input('code', ctx.state.code || '', 'Join with a code', {max:6, ph:'ABC123', cls:'cr-codein', extra:'autocapitalize="characters" spellcheck="false"'}) + '</div>' +
          yd.primary('join', 'Join a crew', '', {disabled: busy}) +
          '<div class="yd-acts">' + yd.btn('start', 'Start one, I am the trainer', {icon:'plus', disabled: busy}) + '</div>' + notes() +(C3.safety?C3.safety.status()+C3.safety.note():'')+
          yd.note('Up to 200 people by default. The trainer sees every member’s sessions; everyone else sees only what each member shares.')};
      }
      var me = uid(), owner = CREW.owner === me, mem = (CREW.roster || []).filter(function(m){return !C3.safety||C3.safety.visible(m.user_id);}), cap = CREW.cap || 200;
      var members = '<ul class="yd-list cr-mem">' + mem.map(function(m){
        var you = m.user_id === me, nm = m.display_name || (you ? 'You' : 'Member');
        return '<li><div class="yd-row cr-m"><span class="cr-av" style="border-color:' + esc(m.color || '#5CF2B0') + '" aria-hidden="true">' + initial(nm) + '</span>' +
          '<span class="l">' + esc(nm) + (you && nm !== 'You' ? ' (you)' : '') + (m.role === 'trainer' ? ' <em>trainer</em>' : '') + '<small>' + esc(safe(function(){ return crewLine(m); }, '')) + '</small>'+(C3.safety?C3.safety.controls('crew',CREW.id,m.user_id,'',nm):'')+'</span>' +
          (owner && !you ? yd.btn('role', m.role === 'trainer' ? 'Make member' : 'Make trainer', {v: m.user_id, extra: 'data-to="' + (m.role === 'trainer' ? 'member' : 'trainer') + '"', disabled: busy}) : '') + '</div></li>'; }).join('') + '</ul>';
      var feed = (CREW.feed || []).filter(function(f){return !C3.safety||C3.safety.visible(f.user_id);}).length ? '<ul class="yd-list cr-feed">' + CREW.feed.filter(function(f){return !C3.safety||C3.safety.visible(f.user_id);}).map(function(f){ return '<li><div class="yd-row"><span class="l">' + esc(f.display_name || 'Someone') + '<small>' + esc(f.text || '') + '</small>'+(C3.safety?C3.safety.controls('crew',CREW.id,f.user_id,f.id,f.text):'')+'</span><span class="v">' + esc(yd.day(f.at)) + '</span></div></li>'; }).join('') + '</ul>'
        : yd.empty('No personal records broadcast yet.');
      return {state:'in', html:
        '<div class="cr-top"><button type="button" class="cr-code" data-act="copy" data-key="copy" aria-label="Crew code ' + esc(CREW.code) + '. Copy it">' + '<b class="c3-num">' + esc(CREW.code) + '</b>' + yd.icon('copy', 22, 2) + '</button>' +
          '<div class="cr-who"><b>' + esc(CREW.name || 'Crew') + '</b><span>' + mem.length + ' of ' + cap + (owner ? ' · you started it' : '') + '</span></div></div>' + notes() +(C3.safety?C3.safety.status()+C3.safety.note():'')+
        (owner ? '<div class="yd-fields cr-cap">' + yd.input('cap', ctx.state.cap != null ? ctx.state.cap : cap, 'How many people can be in it', {type:'number', min: Math.max(2, mem.length), maxv:500, step:1, mode:'numeric'}) +
          '<div class="yd-acts cr-capset">' + yd.btn('capset', 'Set', {icon:'check', disabled: busy}) + '</div></div>' : '') +
        members + '<button type="button" class="c3-btn-quiet" data-go="trainer">Open coaching inbox</button>' +
        '<div class="yd-acts">' + yd.btn('refresh', 'Refresh', {icon:'refresh', disabled: busy}) +
          yd.arm(ctx, 'leave', owner ? 'Leave and hand it over' : 'Leave the crew', owner ? (mem.length > 1 ? 'Tap again: the longest-standing member becomes trainer' : 'Tap again: the crew is deleted') : 'Tap again to leave', {disabled: busy}) + '</div>' +
        yd.sec('The feed', feed, {cls:'cr-feedsec'})};
    }

    /* ---------- the trainer's view ---------- */
    function coachHTML(){
      if(COACH.busy && !COACH.rows.length) return yd.empty('Reading');
      if(!COACH.loaded) return yd.empty('Reading');
      if(COACH.err) return yd.note(esc(COACH.err), 'bad');
      var rows = coachSorted(), w = coachWin();
      return '<div class="cr-bar">' + yd.seg('cwin', COACH_WINS.map(function(d){ return [d, d + ' d']; }), w, {aria:'Window'}) +
          yd.seg('csort', [['name', 'A to Z'], ['least', 'Least active'], ['stale', 'Longest gap']], COACH.sort, {aria:'Sort'}) + yd.btn('cre', 'Refresh', {icon:'refresh'}) + '</div>' +
        (rows.length ? '<ul class="yd-list cr-rows">' + rows.map(function(r){
          var D = coachDays(r), pct = coachPct(r), tr = coachTrend(r, 'sessions'), sess = coachPick(r, 'sessions'), dose = coachPick(r, 'doses'), blind = D == null && sess == null, rate = coachRate(r, 'sessions');
          return '<li class="cr-row' + (blind ? ' blind' : '') + '"><div class="cr-rh"><span class="cr-av" style="border-color:' + esc(r.color || '#5CF2B0') + '" aria-hidden="true">' + initial(r.display_name) + '</span>' +
            '<span class="l">' + esc(r.display_name || 'Member') + (r.role === 'trainer' ? ' <em>trainer</em>' : '') + '<small>' + esc(lastSeenWord(r)) + '</small></span></div>' +
            (blind ? '<p class="yd-note">Shares nothing. Nothing to show, and they are still here.</p>'
              : (!sess && dose == null && (!D || !D.n)) ? '<p class="yd-note">Nothing logged in this window yet.</p>'
              : yd.stats([[sess == null ? '·' : String(sess), sess === 1 ? 'Session' : 'Sessions'], [D ? String(D.n) : '·', 'Of ' + w + ' days'], [rate == null ? '·' : String(rate), 'A week']].concat(dose != null ? [[String(dose), dose === 1 ? 'Dose' : 'Doses']] : []), 'cr-nums') +
                (D ? '<div class="cr-pct">' + yd.bar(D.pct / 100) + '<b class="c3-num">' + D.pct + '%</b></div>' : '')) +
            ((pct != null || tr) ? '<p class="cr-tags">' + (pct != null ? '<span class="' + (pct >= 100 ? 'hit' : pct >= 70 ? 'near' : 'under') + '">' + pct + '% of their goal</span>' : '') + (tr ? '<span>' + esc(tr.word) + ' vs 90 d</span>' : '') + '</p>'
              : (r.share_level === 'full' && !blind ? '<p class="cr-tags"><span>no weekly goal set</span></p>' : '')) + '</li>'; }).join('') + '</ul>'
          : yd.empty('Nobody in the crew yet.')) +
        '<p class="yd-src">Counts are what the server can see. A percentage shows only where a member shares fully and set their own weekly goal.</p>';
    }

    /* ---------- challenges ---------- */
    function chalHTML(ctx){
      var me = safe(function(){ return (ALL.me || {}).id; }, null), kinds = safe(function(){ return CLOUD.CHALLENGES || []; }, []), by = {};
      (CHUI.board || []).forEach(function(r){ (by[r.challenge_id] = by[r.challenge_id] || []).push(r); });
      var list = (CHUI.list || []).filter(function(c){ return !C3.safety || !c.created_by || C3.safety.visible(c.created_by); }).map(function(c){
        var L = challengeLive(c), board = (by[c.id] || []).slice().sort(function(a, b){ return b.value - a.value; });
        var mine = board.filter(function(r){ return r.user_id === me; })[0], kind = kinds.filter(function(k){ return k.k === c.metric; })[0] || {n: c.metric, unit: ''}, top = board.length ? board[0].value : 0;
        return '<li class="cr-ch"><div class="cr-chh"><b>' + esc(c.name) + '</b><span>' + esc(kind.n) + ' · ' + (L.ahead ? 'starts ' + esc(yd.day(L.starts)) : L.running ? yd.plural(L.daysLeft, 'day') + ' left' : 'finished ' + esc(yd.day(L.ends))) + '</span></div>' +
          (board.length ? '<div class="cr-board">' + board.map(function(r, i){ return '<div class="cr-br' + (r.user_id === me ? ' me' : '') + '"><span class="p c3-num">' + (i + 1) + '</span><span class="n">' + esc(r.display_name || 'Member') + (r.user_id === me ? ' (you)' : '') + '</span>' +
              yd.bar(top > 0 ? r.value / top : 0, r.user_id === me ? 'pink' : '') + '<b class="c3-num">' + esc(h.fmt.n(r.value)) + (kind.unit ? ' ' + esc(kind.unit) : '') + '</b></div>'; }).join('') + '</div>' : yd.empty('Nobody has sent a score yet.')) +
          (c.target > 0 ? yd.note('Target ' + esc(h.fmt.n(c.target)) + ' ' + esc(kind.unit) + (mine ? ' · you are at ' + Math.round(mine.value / c.target * 100) + '%' : '')) : '') +
          '<div class="yd-acts">' + ((L.running || L.done) ? yd.btn('chsend', 'Send my score', {v: c.id, icon: 'up'}) : '') + (c.created_by === me ? yd.arm(ctx, 'chdel', 'Remove', 'Tap again: removed for everyone', {v: c.id}) : '') + '</div>' + (C3.safety && c.created_by ? C3.safety.controls('crew', safe(function(){ return CREW.id; }, '') + '/challenge/' + c.id, c.created_by, c.id, c.name) : '') + '</li>'; }).join('');
      var add = ctx.state.adding
        ? '<div class="cr-new"><div class="yd-fields">' + yd.input('chname', ctx.state.chname || '', 'Name', {max:60, ph:'Volume week', cls:'wide'}) +
            yd.select('chkind', kinds.map(function(k){ return [k.k, k.n]; }), ctx.state.chkind || (kinds[0] && kinds[0].k), 'What counts') +
            yd.input('chdays', ctx.state.chdays || 7, 'How many days', {type:'number', min:1, maxv:90, step:1, mode:'numeric'}) +
            yd.input('chtarget', ctx.state.chtarget || '', 'Target (optional)', {type:'number', min:0, step:1, mode:'numeric', ph:'none', cls:'wide'}) + '</div>' +
          '<div class="yd-acts">' + yd.btn('chsave', 'Start it', {icon:'check'}) + yd.btn('chnew', 'Cancel', {pink:true}) + '</div></div>'
        : '<div class="yd-acts">' + yd.btn('chnew', 'Start a challenge', {icon:'plus'}) + '</div>';
      return (CHUI.err ? yd.note(esc(CHUI.err), 'bad') : '') + (list ? '<ul class="yd-list cr-chs">' + list + '</ul>' : yd.empty('No challenges yet.')) + add +
        '<p class="yd-src">Your score is worked out on this device and one number is sent. The crew sees the score, not the log.</p>';
    }

    /* ---------- level, badges, the latest record (the old "You" level bar and "Badges" card) ---------- */
    function levelHTML(){
      var st = stats(), L = levelOf(st), pep = safe(function(){ return !!onPeptide(); }, false), last = (ALL.prFeed || [])[0];
      var from = [yd.plural(st.sessions, 'session'), yd.plural((ALL.weights || []).length, 'weigh-in'), yd.plural(st.prs, 'personal best')];
      if(pep) from.unshift(yd.plural(st.doses, 'dose'));
      var got = 0, badges = BADGES.map(function(b){
        var has = !!b.test(st); if(has) got++;
        return '<li class="cr-bdg' + (has ? ' got' : '') + (has && b.gold ? ' gold' : '') + '"><span class="m" aria-hidden="true">' + esc(b.unit ? badgeIcon(b) : b.ic) + '</span><span class="t">' + esc(badgeTitle(b)) + '<span class="c3-sr">' + (has ? ', earned' : ', not yet') + '</span></span></li>'; }).join('');
      return yd.sec('Level and badges',
        '<div class="cr-lvl"><p class="cr-lv"><span>Level</span><b class="c3-num">' + L.lvl + '</b></p><div class="cr-xp">' + yd.bar(L.pct / 100, 'pink') + '<p><b class="c3-num">' + L.xp + ' XP</b><span>' + L.toNext + ' to the next level</span></p></div></div>' +
        yd.note('Earned from ' + esc(from.join(', ')) + '.') +
        '<ul class="cr-bdgs" aria-label="Badges, ' + got + ' of ' + BADGES.length + ' earned">' + badges + '</ul>' +
        (last ? '<p class="cr-pr"><span>Latest record</span><b>' + esc(last.n) + '</b><i class="c3-num">' + esc(safe(function(){ return loadTxt(last.lb); }, last.lb + ' lb')) + ' \u00d7 ' + esc(last.reps) + ' \u00b7 ' + esc(yd.day(last.at)) + '</i></p>' : ''),
        {id:'level', n: got + ' / ' + BADGES.length});
    }

    yd.screen('crew', {
      parent: 'you', old: ['profile', 'youcrew'],
      render: function(ctx){
        /* locked: the app's lock (its words and its one control, yd.lock); what the crew sees, the level and the badges stay */
        var pro = yd.pro(), C = pro ? crewHTML(ctx) : {state:'locked', html: yd.lock('crew', 'Crews are part of Pro', {desc:'Up to 200 people, challenges and a trainer view.'})};
        var share = me().share, inCrew = C.state === 'in';
        var mine = yd.sec('What the crew sees', yd.seg('share', SHARE_OPTS, share, {aria:'What the crew sees', cls:'wrap2 cr-share'}) + yd.note(esc(SHARE_SAYS[share] || SHARE_SAYS.stats)) + yd.note('These are the sharing presets. Separate account permissions can change access, including trainer access. Review those permissions before sharing sensitive records.'), {id:'share'});
        var more = yd.sec('Show it', '<ul class="yd-list">' + yd.linkRow('sharecard', 'The share card', '', 'data-go="share"') + '</ul>', {id:'more'});
        return '<div class="yd cr" data-state="' + C.state + '">' +
          yd.head({back:'you', eyebrow: inCrew ? yd.plural((CREW.roster || []).length, 'member') : (C.state === 'locked' ? 'Pro' : 'Up to 200 people'), title:'Your', pk:'crew'}) +
          '<div class="yd-cols"><div class="yd-col"><section class="yd-sec cr-crew" aria-label="Your crew">' + C.html + '</section>' +
            (inCrew ? yd.sec('Challenges', chalHTML(ctx), {id:'chal', n: (CHUI.list || []).filter(function(c){ return !C3.safety || !c.created_by || C3.safety.visible(c.created_by); }).length || null}) : '') + '</div>' +
          '<div class="yd-col">' + mine + (inCrew ? yd.sec('The coach view', coachHTML(), {id:'coach'}) : '') + levelHTML() + more + '</div></div></div>';
      },
      wire: function(root, ctx){if(C3.safety){if(!C3.safety.loaded&&!C3.safety.error)C3.safety.call('get');C3.safety.wire(root);}
        /* the old pane asked the server the first time it was drawn; so does this one */
        safe(function(){
          if(!yd.pro() || !yd.signedIn()) return;
          if(!CREW.loaded && !CREW.busy) crewLoad();
          else if(CREW.id && !COACH.loaded && !COACH.busy) coachLoad();
          if(!settled()) watch();
        });
        var val = function(name){ var el = root.querySelector('[data-chg="' + name + '"]'); return el ? el.value : ''; };
        yd.wire(root, ctx, {
          signin: function(){ h.openSignIn(); },
          buy: yd.lockActs.buy, restore: yd.lockActs.restore,
          join: function(){
            var c = String(val('code') || '').trim().toUpperCase();
            if(c.length !== 6){ crewSay('A crew code is six characters.', ''); C3.refresh(); return; }
            ctx.state.code = '';
            run(function(){ return CLOUD.joinCrew(c); }, 'You are in.');
          },
          start: function(){ run(function(){ return CLOUD.createCrew(displayName() ? displayName() + '’s crew' : 'Crew'); }, 'Crew started. Share the code.'); },
          copy: function(){
            var t = CREW.code, done = function(){ yd.toast('Code copied.'); };
            try{ if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function(){ yd.toast('Your code is <b>' + esc(t) + '</b>.'); }); else yd.toast('Your code is <b>' + esc(t) + '</b>.'); }
            catch(e){ yd.toast('Your code is <b>' + esc(t) + '</b>.'); }
          },
          capset: function(){
            var mem = (CREW.roster || []).length, v = Math.round(+val('cap') || 0), floor = Math.max(2, mem);
            if(!(v >= floor && v <= 500)){ crewSay('A crew holds between ' + floor + ' and 500 people.', ''); C3.refresh(); return; }
            ctx.state.cap = null;
            run(function(){ return CLOUD.setCrewCap(CREW.id, v); }, 'Crew size set to ' + v + '.');
          },
          role: function(id, el){ run(function(){ return CLOUD.setRole(CREW.id, id, el.getAttribute('data-to')); }, 'Role changed.'); },
          refresh: function(){ reload(); crewLoad(); watch(); },
          leave: function(){
            reload();
            try{ Promise.resolve(crewRun(function(){ return CLOUD.leaveCrew(CREW.id); }, 'You have left the crew.')).then(function(r){ if(r && r.ok){ ALL.crew = null; save(); } C3.refresh(); }, function(){ C3.refresh(); }); }catch(e){}
            watch();
          },
          share: function(v){
            if(me().share === v) return;
            me().share = v; save();
            try{ renderMe(); renderCrew(); }catch(e){}
            yd.toast(v === 'none' ? 'Nothing is shared with anyone now.' : 'Sharing updated. The crew sees the new level.');
          },
          /* the trainer's view */
          cwin: function(v){ COACH.win = +v; C3.render(); },
          csort: function(v){ COACH.sort = v; C3.render(); },
          cre: function(){ reload(); COACH.loaded = false; coachLoad(); watch(); },
          /* challenges */
          chnew: function(){ ctx.set({adding: !ctx.state.adding}); },
          chsave: function(){
            var days = Math.max(1, Math.min(90, Math.round(+val('chdays') || 7))), starts = Date.now(), ends = starts + days * 86400000;
            var target = String(val('chtarget')).trim() ? Math.max(0, +val('chtarget') || 0) : 0, name = String(val('chname')).trim() || 'Challenge', kind = val('chkind');
            Promise.resolve(CLOUD.createChallenge(CREW.id, name, kind, starts, ends, target)).then(function(r){
              if(!r || !r.ok){ CHUI.err = (r && r.error) || 'The challenge was not started.'; C3.refresh(); return; }
              ctx.state.adding = false; ctx.state.chname = ''; ctx.state.chtarget = '';
              return Promise.resolve(challengePush()).then(function(){ yd.toast('Challenge started.'); C3.refresh(); });
            }).catch(function(){ CHUI.err = 'The challenge was not started.'; C3.refresh(); });
          },
          chsend: function(id){
            var c = (CHUI.list || []).filter(function(x){ return x.id === id; })[0]; if(!c) return;
            var L = challengeLive(c), v = challengeScore(c.metric, L.starts, Math.min(L.ends, Date.now()));
            Promise.resolve(CLOUD.pushScore(c.id, v)).then(function(r){
              if(!r || !r.ok){ CHUI.err = (r && r.error) || 'The score was not sent.'; C3.refresh(); return; }
              var kk = safe(function(){ return (CLOUD.CHALLENGES || []).filter(function(k){ return k.k === c.metric; })[0]; }, null); return Promise.resolve(challengeRefresh()).then(function(){ yd.toast('Sent, <b>' + esc(h.fmt.n(v)) + (kk && kk.unit ? ' ' + esc(kk.unit) : '') + '</b>.'); C3.refresh(); });
            }).catch(function(){ C3.refresh(); });
          },
          chdel: function(id){
            Promise.resolve(CLOUD.deleteChallenge(id)).then(function(r){
              if(!r || !r.ok){ CHUI.err = (r && r.error) || 'The challenge was not removed.'; C3.refresh(); return; }
              return Promise.resolve(challengeRefresh()).then(function(){ C3.refresh(); });
            }).catch(function(){ C3.refresh(); });
          }
        }, {
          code: function(v){ ctx.state.code = String(v).toUpperCase(); },
          cap: function(v){ ctx.state.cap = v; },
          chname: function(v){ ctx.state.chname = v; }, chkind: function(v){ ctx.state.chkind = v; }, chdays: function(v){ ctx.state.chdays = v; }, chtarget: function(v){ ctx.state.chtarget = v; }
        });
        var code = root.querySelector('[data-chg="code"]');
        if(code) code.addEventListener('keydown', function(ev){ if(ev.key === 'Enter'){ var b = root.querySelector('[data-act="join"]'); if(b) setTimeout(function(){ b.click(); }, 0); } });
      },
      leave: function(){ clearInterval(watchT); watchT = 0; }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
