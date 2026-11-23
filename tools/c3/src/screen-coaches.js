/* C3 screen: coaches (the old You > Coaches pane, #p-crew: renderCoaches and the team card).
   The four coaches with Talk and "lead", whether they speak up on their own, how often the
   team reads, what they have learned (the app's own numbers), the weekly team review (the
   app's own sheet), and the file each coach keeps on you, every line deletable.
   Writes exactly what the old pane wrote: coachState().lead / .on / .budget + save(),
   fileDel(), consent/expiry/corrections and separate memory/conversation resets.
   The old pane's strip of the last five coach messages is not here: a C3 screen never reads
   the coach log (it carries promos); every message is in that coach's chat (Talk). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    function first(c){ return String(c.name).split(' ')[0]; }
    /* the weekly review, as a state word and the label of the control (the review itself is the app's sheet) */
    function team(){
      var signed = yd.signedIn(), c = safe(function(){ return TEAM.cur; }, null);
      if(safe(function(){ var H = brainHuddle(); return !!(H && H.turns.length); }, false)) return {word:'Met this morning', sub:'Before you opened the app', btn:'Read it'};
      if(!signed) return {word:'Needs an account', sub:'The review reads the diary on your account.', btn:'Open'};
      if(!c) return safe(function(){ return teamReady(); }, false) ? {word:'Ready to meet', sub:'Four coaches, the same fourteen days, one thing back.', btn:'Meet with my team'}
                                                                     : {word:'Not enough yet', sub:'Log three days of food, or build a week.', btn:'Open'};
      var pr = c.proposal || {}, dec = pr.decision;
      return {word: pr.status === 'open' ? 'One thing to read' : dec ? (dec.decision === 'accepted' ? 'Accepted' : dec.decision === 'rejected' ? 'Declined' : 'Left for later') : 'Closed',
              sub: 'Met ' + yd.day(c.created_at, true) + (c.next_review ? ' · next ' + yd.day(c.next_review + 'T12:00:00', true) : ''), btn: pr.status === 'open' ? 'Read it' : 'Open'};
    }

    yd.screen('coaches', {
      parent: 'you', nav: 'coach', old: ['profile', 'crew'],
      render: function(ctx){
        var st = coachState(), L = safe(function(){ return coachLearned(); }, {n:0, up:0, down:0, actsOn:[], ignored:[]}), P = safe(function(){ return coachProfile(); }, null);
        var M = safe(function(){ return modelMeter(); }, {n:0}), full = safe(function(){ return modelBudget() === 'full'; }, false), voice = safe(function(){ return !!voiceAvailable(); }, false);
        var coaches = h.coaches(), lead = coaches.filter(function(c){ return c.id === st.lead; })[0] || coaches[0];
        var T = team(), open = ctx.state.file || '', memory=C3.memory, mp=memory.prefs();

        var roster = '<section class="co-roster" aria-label="Your coaches"><div class="co-cos">' + coaches.map(function(c){
          var isLead = c.id === st.lead, role = String(c.role || '');
          return '<div class="co-co' + (isLead ? ' lead' : '') + '">' +
            '<img class="co-face" src="' + esc(c.badge) + '" alt="" width="150" height="150" decoding="async">' +
            '<span class="co-n">' + esc(c.name) + '</span><span class="co-r">' + esc(role) + '</span>' +
            '<button type="button" class="c3-btn-quiet pink co-talk" data-coach="' + esc(c.id) + '" data-key="talk-' + esc(c.id) + '" aria-label="Talk to ' + esc(c.name) + '">' + yd.icon('talk', 17, 2.200) + '<span>Talk</span></button>' +
            '<button type="button" class="co-lead" data-act="lead" data-v="' + esc(c.id) + '" data-key="lead-' + esc(c.id) + '" aria-pressed="' + (isLead ? 'true' : 'false') + '" aria-label="' + esc(isLead ? c.name + ' is your lead coach' : 'Make ' + c.name + ' your lead coach') + '">' +
              (isLead ? yd.icon('star', 15, 2.200) + '<span>Lead</span>' : '<span>Lead</span>')   /* v367: one word; filled with a star means chosen (Make lead wrapped in German and French) */ + '</button>' +
          '</div>'; }).join('') + '</div></section>';

        var tone=(ALL.journeyPrefs||{}).coachTone||'supportive';
        var toneHTML=yd.sec('Coaching tone',yd.seg('tone',[['direct','Direct'],['supportive','Supportive'],['sassy','Sassy']],tone,{aria:'Preferred coaching tone'})+yd.note('Choose the style you prefer. You can change it at any time.'),{id:'tone'});
        var how = yd.sec('How they work', '<div class="yd-list">' +
          yd.sw('on', !!st.on, 'They speak up on their own', 'A short line when something in your log calls for it.') +
          (voice ? yd.sw('voice', safe(function(){ return !!coachVoiceOn(); }, false), 'Out loud', 'Coach lines are spoken.') : '') +
          (voice ? yd.sw('room', safe(function(){ return !!roomOn(); }, false), 'Shay in the room', 'Spoken cues during a session.') : '') +
          yd.sw('full', full, 'Full team reads', 'A fresh read on every change. Off: at most every 30 minutes, six a day.') +
          '</div>' + '<p class="co-meter"><b class="c3-num">' + (M.n | 0) + '</b><span>' + ((M.n | 0) === 1 ? 'read' : 'reads') + ' today</span></p>', {id:'how'});

        var learned = P ? yd.sec('What they have learned',
          yd.stats([[P.adherence28 != null ? P.adherence28 + '%' : '·', 'Sessions kept · 28 d'], [L.actedRate != null ? L.actedRate + '%' : '·', 'Advice acted on'], [L.up + ' · ' + L.down, 'Up · down'], [P.usualHour != null ? String(P.usualHour).padStart(2, '0') + ':00' : '·', 'You usually train']], 'co-stats') +
          ((L.actsOn && L.actsOn.length) ? yd.note('You act on: <b>' + esc(L.actsOn.map(function(k){ return k.replace(/-/g, ' '); }).join(', ')) + '</b>.') : '') +
          ((L.ignored && L.ignored.length) ? yd.note('They have gone quieter about: <b>' + esc(L.ignored.map(function(k){ return k.replace(/-/g, ' '); }).join(', ')) + '</b>.') : '') +
          (L.terse ? yd.note('You prefer it short. They know.') : '') +
          (!L.n ? yd.note('Activity summaries come from your diary records.') : ''), {id:'learned'}) : '';

        var review = yd.sec('Weekly review', '<div class="co-review"><p class="co-word" data-team="' + esc(T.word) + '">' + esc(T.word) + '</p><p class="co-sub">' + esc(T.sub) + '</p>' +
          '<button type="button" class="c3-btn-rail co-meet" data-sheet="team" data-key="team"><span>' + esc(T.btn) + '</span>' + h.icon('arrow', 26, 2.800) + '</button></div>', {id:'review'});

        var memoryControls=yd.sec('Coach memory', '<div class="yd-list">'+yd.sw('memory',mp.enabled===true,'Remember between conversations','Optional. Save dated notes from your chats and team reviews for the four coaches. Pausing stops saving and using these notes; your diary stays available.')+'</div><label class="co-retention">New notes expire after<select id="memory-retention">'+[7,30,90,365].map(function(n){return '<option value="'+n+'"'+((+mp.days||90)===n?' selected':'')+'>'+n+' days</option>';}).join('')+'</select></label><p class="yd-note">Review or correct each note below. Forgetting memory leaves the original conversations and diary records in place. Expired notes are excluded from coach context.</p><div class="yd-acts">'+yd.arm(ctx,'forget','Forget all coach memory','Tap again to forget memory',{icon:'trash'})+'</div>',{id:'memory'});
        var files = yd.sec('Saved memory notes', '<ul class="yd-list co-files">' + coaches.map(function(c){
          var lines = safe(function(){ return memory.list(c.id); }, []), isOpen = open === c.id, words = safe(function(){ return fileWords(c.id); }, 0);
          return '<li><button type="button" class="yd-row co-file" data-act="file" data-v="' + esc(c.id) + '" data-key="file-' + esc(c.id) + '" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
              '<img class="co-mini" src="' + esc(c.badge) + '" alt="" width="40" height="40" decoding="async">' +
              '<span class="l">' + esc(first(c)) + '<small>' + (lines.length ? yd.plural(lines.length, 'line') + ' · ' + words + ' of 600 words' : 'No saved notes.') + '</small></span>' + yd.icon(isOpen ? 'up' : 'chev', 16, 2.200) + '</button>' +
            (isOpen ? (lines.length ? '<ul class="co-lines">' + lines.slice().reverse().map(function(l){
                var expires=+l.expiresAt||memory.expiry(l.at),editing=ctx.state.edit===l.key;
                return '<li><span class="t">'+esc(l.text)+'<small>'+esc(yd.day(l.at))+' · '+(l.src==='huddle'?'team review':l.src==='manual'?'member note':'conversation')+(l.editedBy?' · corrected '+esc(yd.day(l.updatedAt)):'')+' · '+(memory.active(l)?'expires ':'expired ')+esc(yd.day(expires))+'</small>'+(editing?'<label>Correct this note<textarea id="memory-edit" maxlength="220">'+esc(l.text)+'</textarea></label><label>Renew for<select id="memory-edit-days">'+[7,30,90,365].map(function(n){return '<option value="'+n+'"'+(n===90?' selected':'')+'>'+n+' days</option>';}).join('')+'</select></label><button type="button" class="c3-btn-quiet" data-act="fsave" data-v="'+esc(l.key)+'">Save correction</button><button type="button" class="c3-btn-quiet" data-act="fcancel">Cancel</button><span id="memory-edit-error" role="alert"></span>':'')+'</span><button type="button" class="co-edit" data-act="fedit" data-v="'+esc(l.key)+'" aria-label="Correct this memory note">Edit</button>'+
                  '<button type="button" class="yd-x" data-act="fdel" data-v="' + esc(l.key) + '" data-key="fdel-' + esc(l.key) + '" aria-label="Forget this memory note">' + yd.icon('x', 18, 2.400) + '</button></li>'; }).join('') + '</ul>'
              : '<p class="yd-note co-nofile">Enable coach memory to keep useful notes from future chats. Each note shows its source and expiry and can be corrected or forgotten.</p>') : '') + '</li>'; }).join('') + '</ul>', {id:'files'});

        var answers=memory.answers();
        var answerPanel=answers.length?yd.sec('Saved conversation answers','<p class="yd-note">Answers saved for reuse share your memory consent and expiry. Review or correct them here.</p><ul class="co-lines">'+answers.map(function(a){var token=a.kind+':'+a.key,editing=ctx.state.answerEdit===token;return '<li><span class="t"><b>'+esc(a.q||a.title||'Saved answer')+'</b>'+esc(a.body||a.a||'')+'<small>Conversation · '+(a.kind==='cand'?'candidate':'saved answer')+' · '+(memory.active(a)?'expires ':'expired ')+esc(yd.day(+a.expiresAt||memory.expiry(a.at)))+(a.editedBy?' · corrected '+esc(yd.day(a.updatedAt)):'')+'</small>'+(editing?'<label>Correct this saved answer<textarea id="memory-answer-edit" maxlength="1400">'+esc(a.body||a.a||'')+'</textarea></label><button type="button" class="c3-btn-quiet" data-act="asave" data-kind="'+a.kind+'" data-v="'+esc(a.key)+'">Save answer correction</button><button type="button" class="c3-btn-quiet" data-act="acancel">Cancel</button><span id="memory-answer-error" role="alert"></span>':'')+'</span><button type="button" class="co-edit" data-act="aedit" data-v="'+esc(token)+'">Edit</button><button type="button" class="yd-x" data-act="adel" data-kind="'+a.kind+'" data-v="'+esc(a.key)+'" aria-label="Forget saved answer">'+yd.icon('x',18)+'</button></li>';}).join('')+'</ul>',{id:'answers'}):'';
        var conversations=yd.sec('Conversations','<button type="button" class="c3-btn-quiet" data-go="conversations">View conversation history</button>'+yd.note('Clearing conversations keeps saved memory. Use Forget all coach memory to remove those notes too.')+'<div class="yd-acts">'+yd.arm(ctx,'chats','Clear coach conversations','Tap again to clear conversations',{icon:'trash'})+'</div>',{id:'conversations'});

        return '<div class="yd co" data-lead="' + esc(st.lead) + '">' +
          yd.head({back:null, eyebrow:'Lead: ' + (lead ? lead.name : ''), title:'Your', pk:'coaches'}) +
          '<p class="yd-note co-ai" style="opacity:.75">Coaches are AI. They can be wrong. Nothing they say is medical advice. Check with your doctor.</p>' +
          roster +
          '<div class="yd-cols"><div class="yd-col">' + review + (C3.coachControls?C3.coachControls.html():'') + toneHTML + how + learned + '</div>' +
          '<div class="yd-col"><div class="co-pic">' + h.pictureHTML('train-team') + '</div>' + memoryControls + files + answerPanel + conversations +
            '<div class="yd-acts co-team"><button type="button" class="c3-btn-quiet pink yd-btn" data-act="story" data-key="story"><span>Meet the team</span>' + h.icon('arrow', 18, 2.600) + '</button></div></div></div></div>';
      },
      wire: function(root, ctx){
        if(C3.coachControls)C3.coachControls.wire(root);
        yd.wire(root, ctx, {
          tone:function(v){if(['direct','supportive','sassy'].indexOf(v)<0)return;ALL.journeyPrefs=Object.assign({},ALL.journeyPrefs||{},{coachTone:v,at:Date.now()});shaySetDial(v==='direct'?'off':v==='sassy'?'loud':'playful');save();C3.refresh();},
          lead: function(v){ var st = coachState(); if(st.lead === v) return; st.lead = v; st.prefAt=Date.now(); save(); var c = h.coaches().filter(function(x){ return x.id === v; })[0]; yd.toast('<b>' + esc(c ? c.name : 'Coach') + '</b> is your lead now.'); },
          on: function(){ var st = coachState(); st.on = !st.on; st.prefAt=Date.now(); save(); try{ paintCoachLines(); }catch(e){} },
          voice: function(v, el){ try{ coachVoiceToggle(el.getAttribute('aria-checked') !== 'true'); }catch(e){} C3.refresh(); },
          room: function(v, el){ try{ roomToggle(el.getAttribute('aria-checked') !== 'true'); }catch(e){} C3.refresh(); },
          full: function(){ coachState().budget = (modelBudget() === 'full') ? 'economy' : 'full'; coachState().prefAt=Date.now(); save(); },
          memory:function(){ C3.memory.change({enabled:!C3.memory.enabled()}); },
          forget:function(){var snap=C3.memory.forget();yd.undo('Memory forgotten and paused. Original conversations kept.',function(){C3.memory.restore(snap);});},
          chats:function(){var owner=C3.memory.ownerToken(),st=coachState(),log=st.log,threads=st.threads;st.log=[];st.threads={};st.chatsClearedAt=Date.now();save();yd.undo('Coach conversations cleared. Memory kept.',function(){if(!C3.memory.sameOwner(owner))return;var current=coachState();current.log=log.concat(current.log||[]);Object.values(threads).forEach(function(list){list.forEach(function(t){t.updatedAt=Date.now()+1;});});current.threads=Object.assign({},threads,current.threads||{});save();});},
          aedit:function(k){ctx.set({answerEdit:k});},acancel:function(){ctx.set({answerEdit:''});},
          asave:function(k,el){if(C3.memory.editAnswer(el.getAttribute('data-kind'),k,root.querySelector('#memory-answer-edit').value)){ctx.set({answerEdit:''});yd.toast('Saved answer corrected.');}else root.querySelector('#memory-answer-error').textContent='Enter 1 to 1400 characters. Care instructions belong in your private tracking records.';},
          adel:function(k,el){var row=brainState()[el.getAttribute('data-kind')][k],owner=C3.memory.ownerToken();row.del=Date.now();BRAIN_IDF.map=null;save();yd.undo('Saved answer forgotten.',function(){if(!C3.memory.sameOwner(owner))return;delete row.del;row.updatedAt=Date.now();BRAIN_IDF.map=null;save();});},
          fedit:function(k){ctx.set({edit:k});},fcancel:function(){ctx.set({edit:''});},
          fsave:function(k){var text=root.querySelector('#memory-edit'),days=root.querySelector('#memory-edit-days');if(C3.memory.edit(k,text&&text.value,days&&days.value)){ctx.set({edit:''});yd.toast('Memory corrected.');}else{root.querySelector('#memory-edit-error').textContent='Enter a note of 1 to 220 characters. Care details belong in your private tracking records.';}},
          file: function(v){ ctx.set({file: ctx.state.file === v ? '' : v}); },
          fdel: function(k){
            var owner=C3.memory.ownerToken(),was = safe(function(){ return coachFile()[k]; }, null);
            fileDel(k);
            if(was) yd.undo('Line removed from the file.', function(){ if(!C3.memory.sameOwner(owner))return; delete coachFile()[k].del; coachFile()[k].updatedAt=Date.now(); });
          },
          story: function(){ h.openTeam(); }
        });
        root.querySelector('#memory-retention').addEventListener('change',function(e){C3.memory.change({days:+e.target.value});});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();

