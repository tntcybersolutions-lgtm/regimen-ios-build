/* Account-backed workout rooms. Only deliberately shared exercise names and set counts leave the private log. */
(function(){
 'use strict';var C3=window.C3;if(!C3)return;
 var h=C3.h,esc=h.esc,R=C3.together={room:null,error:'',busy:false,last:0,loaded:false},timer=0,requestId='',actor='';
 function safe(fn,d){try{return fn();}catch(e){return d;}}
 function uid(){return safe(function(){return CLOUD.signedIn()?String(CLOUD.user().id||myUid()||''):'';},'');}
 function me(){return R.room&&(R.room.members||[]).filter(function(m){return m.id===uid();})[0];}
 function api(){return /^https?:$/.test(location.protocol)?'':'https://app.formedlabs.co';}
 function requestKey(){if(crypto.randomUUID)return crypto.randomUUID();var a=crypto.getRandomValues(new Uint8Array(16));a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;var x=Array.from(a,function(v){return v.toString(16).padStart(2,'0');}).join('');return x.slice(0,8)+'-'+x.slice(8,12)+'-'+x.slice(12,16)+'-'+x.slice(16,20)+'-'+x.slice(20);}
 function paint(){if(C3.current==='together'&&!(C3.safety&&C3.safety.panel))C3.refresh();}
 async function call(action,data,quiet){
  var who=uid();if(C3.safety&&!C3.safety.loaded)C3.safety.call('get');if(!who){R.room=null;R.loaded=false;R.error='Sign in to use Together.';paint();return false;}
  if(R.busy)return false;
  if(actor!==who){R.room=null;R.last=0;R.loaded=false;actor=who;}
  R.busy=true;if(!quiet)R.error='';paint();
  try{
   var controller=new AbortController(),alarm=setTimeout(function(){controller.abort();},15000);
   var token=await Promise.race([CLOUD.token(),new Promise(function(resolve,reject){controller.signal.addEventListener('abort',function(){reject(Error('The connection timed out. Choose Refresh to try again.'));},{once:true});})]);if(!token)throw Error('Sign in again to reconnect.');
   var body=Object.assign({action:action},data||{});
   if(R.room){body.room_id=R.room.id;body.revision=R.room.revision;}
   var res=await fetch(api()+'/api/together',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:controller.signal});
   var j=await res.json();if(uid()!==who)return false;
   if(!res.ok||!j.ok)throw Error(j.error||'Could not update the room. Try again.');
   R.room=j.room;R.last=Date.now();R.loaded=true;R.error='';if(action==='create')requestId='';
   return true;
  }catch(e){if(uid()===who)R.error=(navigator.onLine===false?'Offline. Reconnect to update the room.':e.message||'Could not connect to the room.');return false;}
  finally{if(alarm)clearTimeout(alarm);R.busy=false;paint();}
 }
 R.refresh=function(){return call('get',{},true);};R.action=call;
 function tick(){
  if(!uid()){if(R.room){R.room=null;R.loaded=false;actor='';paint();}return;}
  if(document.hidden||R.busy)return;
  var m=me();
  if(R.room&&R.room.status==='active'&&m&&m.sharing&&!m.paused){
   var T=h.today(),next=T.rows.filter(function(r){return !r.done;})[0];
   call('progress',{completed_sets:T.hardDone,exercise:next?next.n:''},true);
  }else if(C3.current==='together')R.refresh();
 }
 function startPoll(){if(!timer)timer=setInterval(tick,5000);}
 function button(action,label,extra){return '<button type="button" class="c3-btn-quiet" data-room="'+action+'" '+(extra||'')+(R.busy?' disabled':'')+'>'+label+'</button>';}
 function draft(){return (ALL.journeySetup||{}).roomDraft||{};}
 function saveDraft(st){ALL.journeySetup=Object.assign({},ALL.journeySetup||{},{at:Date.now(),roomDraft:Object.assign({},st,{at:Date.now()})});if(C3.journey)C3.journey.deferSave('room');else save();}
 function localTime(at){if(!at)return '';var d=new Date(at);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
 function scheduleHTML(r,host,st){
  var zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  return '<section class="tg-schedule"><h2>Shared session</h2><p>'+(r.scheduled_at?esc(new Date(r.scheduled_at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}))+' · your time · '+esc(r.scheduled_zone||'UTC')+' entered zone · '+r.duration_minutes+' min':'No shared time set yet.')+'</p>'+(host&&r.status==='lobby'?'<label>Session time ('+esc(zone)+')<input type="datetime-local" data-room-field="scheduledLocal" value="'+esc(st.scheduledLocal===undefined?localTime(r.scheduled_at):st.scheduledLocal)+'"></label><label>Session length (minutes)<input type="number" min="15" max="240" step="15" data-room-field="duration" value="'+esc(st.duration||r.duration_minutes||60)+'"></label>'+button('schedule','Save shared time')+'<p>All members see this time. Saving an empty time clears the schedule.</p>':'')+(r.scheduled_at?button('calendar','Add to my calendar'):'')+'</section>';
 }
 function status(){return '<p class="tg-status" role="status">'+(R.busy?'Connecting...':R.last?'Updated '+new Date(R.last).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'')+'</p>'+(R.error?'<p class="tg-error" role="alert">'+esc(R.error)+'</p>':'');}
 C3.screen('together',{
  nav:'train',enter:function(){if(uid()){startPoll();setTimeout(R.refresh,0);}},
  render:function(ctx){
   if(!ctx.state.draftLoaded){Object.assign(ctx.state,draft());ctx.state.draftLoaded=true;}
   var signed=!!uid(),r=R.room,m=me(),who=uid();
   var top='<div class="tg"><button type="button" class="yd-back" data-go="train" aria-label="Back to Train">'+C3.h.icon('back',18,2.8)+'<span>Train</span></button><header class="tg-head"><div class="c3-eyebrow"><i></i>Train wherever you are</div><h1 class="c3-h1">Together</h1><p>Your own weights. Your own pace. One shared room.</p></header>';
   if(!signed)return top+'<p>A Formed account keeps your room available when you return.</p><button type="button" class="c3-btn-rail tg-sign" data-room="signin"><span>Sign in</span>'+h.icon('arrow',24,2.8)+'</button><button type="button" class="c3-link" data-go="train">Train solo</button></div>';
   if(actor&&actor!==who)r=null;
   if(!r){return top+(C3.safety?C3.safety.status()+C3.safety.note():'')+status()+(R.error?button('refresh','Try again'):'')+'<div class="tg-setup"><label>Your display name<input data-room-field="nickname" maxlength="32" autocomplete="nickname" value="'+esc(ctx.state.nickname||'')+'" placeholder="What the room should call you"></label><section><h2>Start a room</h2><label>Workout name<input data-room-field="title" maxlength="60" value="'+esc(ctx.state.title||'')+'" placeholder="Evening workout"></label>'+button('create','Create room')+'</section><section><h2>Join a room</h2><label>Invitation code<input data-room-field="code" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" value="'+esc(ctx.state.code||'')+'" placeholder="12-character code"></label>'+button('join','Join room')+'</section></div><p class="tg-note">Rooms hold up to eight members. Invitations expire after 24 hours. Display names and ready status are shared. Workout progress is optional.</p></div>';}
   var host=who===r.organizer_id,trainer=who===r.trainer_id,can=host||trainer,closed=r.status==='ended',expired=Date.parse(r.expires_at)<=Date.now(),allReady=r.members.some(function(x){return !x.paused;})&&r.members.every(function(x){return x.ready||x.paused;});
   var rows=r.members.filter(function(x){return !C3.safety||C3.safety.visible(x.id);}).map(function(x){var role=x.id===r.organizer_id?'Organizer':x.id===r.trainer_id?'Trainer':'Member';var online=Date.now()-Date.parse(x.seen_at)<20000;
    return '<li><div><b>'+esc(x.nickname)+(x.id===who?' (you)':'')+'</b><small>'+role+' · '+(online?'Connected':'Last seen '+new Date(x.seen_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))+'</small></div><span class="tg-ready">'+(x.paused?'Paused':x.ready?'Ready':'Not ready')+'</span><p>'+(x.attended_at?'Attendance confirmed '+esc(new Date(x.attended_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})):'Attendance not confirmed')+'</p><p>'+(x.sharing?'<b class="c3-num">'+x.completed_sets+'</b> sets'+(x.exercise?' · '+esc(x.exercise):''):'Workout details private')+'</p>'+(C3.safety?C3.safety.controls('together',r.id,x.id,'',x.nickname+' '+(x.exercise||'')):'')+(host&&x.id!==who?button('trainer','Make trainer','data-member="'+esc(x.id)+'"')+button('handover',ctx.state.confirm==='handover:'+x.id?'Tap again to hand over to '+esc(x.nickname):'Hand over room','data-member="'+esc(x.id)+'"'):'')+'</li>';}).join('');
   return top+(C3.safety?C3.safety.status()+C3.safety.note():'')+status()+'<section class="tg-room"><div class="tg-room-head"><div><h2>'+esc(r.title)+'</h2><p>'+esc(closed?'Workout complete':expired?'Room expired':r.status==='lobby'?'Ready check':'Workout in progress')+' · '+r.members.length+' / '+r.capacity+'</p></div><div class="tg-code"><span>Invitation code</span><b>'+esc(r.code)+'</b>'+button('copy','Copy code')+'</div></div><ul class="tg-members">'+rows+'</ul>'+
    scheduleHTML(r,can,ctx.state)+
    (m&&r.status!=='lobby'?button('attendance',m.attended_at?'Correct my attendance: I did not attend':'Confirm I attended'):'')+
    '<section class="tg-milestone"><h2>Team builder</h2><p>'+(r.referral_count>0?'Earned: '+r.referral_count+' '+(r.referral_count===1?'person has':'people have')+' joined through your room invitations.':'Invite someone to join a room you organize to earn the Team builder milestone.')+'</p><p>The milestone recognizes a first room invitation accepted by another account. It carries no cash value or purchase requirement.</p></section>'+
    (!closed&&!expired&&m?'<div class="tg-controls">'+button('pause',m.paused?'Resume my room updates':'Pause my room updates')+(!m.paused?button('ready',m.ready?'Not ready yet':'I am ready'):'')+'<label class="tg-share"><input type="checkbox" data-room-share '+(m.sharing?'checked':'')+(R.busy?' disabled':'')+'>Share my exercise and completed set count</label></div>':'')+
    (r.status==='active'&&!expired?'<div class="tg-session"><p>Shared exercise <b class="c3-num">'+(r.exercise_index+1)+'</b></p><button type="button" class="c3-btn-primary" data-room="workout"><span>Open my workout</span>'+h.icon('arrow',30)+'</button><p>Log your actual weights and reps in your own workout. Those numbers stay private.</p>'+(can?button('next','Next shared exercise'):'')+'</div>':'')+
    (!closed&&!expired&&r.status==='lobby'&&can?button('start',allReady?'Start together':'Waiting for everyone to be ready',allReady?'':'disabled '):'')+
    '<div class="tg-footer">'+(ctx.state.confirm?button('cancel','Cancel'):'')+button('refresh','Refresh')+(!closed&&!expired&&can?button('end',ctx.state.confirm==='end'?'Tap again to end for everyone':'End room'):'')+button('leave',ctx.state.confirm==='leave'?'Tap again to leave':'Leave room')+'<button type="button" class="c3-link" data-go="crew">Crew and trainer tools</button></div><p class="tg-note">Your room returns when you sign in again. Your private workout, care instructions, dose records and coaching conversations are kept separately.</p></section></div>';
  },
  wire:function(root,ctx){if(C3.safety)C3.safety.wire(root);
   root.querySelectorAll('[data-room-field]').forEach(function(el){el.setAttribute('data-key','room-'+el.getAttribute('data-room-field'));el.addEventListener('input',function(){ctx.state[el.getAttribute('data-room-field')]=el.value;saveDraft(ctx.state);});});
   var share=root.querySelector('[data-room-share]');if(share)share.addEventListener('change',function(){call('share',{sharing:share.checked});});
   root.querySelectorAll('[data-room]').forEach(function(b){b.addEventListener('click',function(){
    var a=b.getAttribute('data-room'),m=me();
    if(a==='schedule'){var local=ctx.state.scheduledLocal,at=local?new Date(local):null,duration=+(ctx.state.duration||(R.room||{}).duration_minutes||60);if(at&&!Number.isFinite(at.getTime())||!Number.isInteger(duration)||duration<15||duration>240){R.error='Choose a valid time and session length from 15 to 240 minutes.';paint();return;}call('schedule',{scheduled_at:at?at.toISOString():null,scheduled_zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',duration_minutes:duration});return;}
    if(a==='attendance'){call('attendance',{attended:!(m&&m.attended_at)});return;}
    if(a==='calendar'){
     var r=R.room;if(!r||!r.scheduled_at)return;var stamp=function(v){return new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');},clean=function(v){return String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,function(c){return '\\'+c;});};
     var body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//formed labs//formed fit Together//EN','BEGIN:VEVENT','UID:'+r.id+'@app.formedlabs.co','DTSTAMP:'+stamp(Date.now()),'DTSTART:'+stamp(r.scheduled_at),'DTEND:'+stamp(Date.parse(r.scheduled_at)+(+r.duration_minutes||60)*60000),'SUMMARY:'+clean(r.title),'DESCRIPTION:Open Together in formed fit to review your shared session.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
     var url=URL.createObjectURL(new Blob([body],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='formed-shared-session.ics';link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);return;
    }
    if(a==='signin'){h.openSignIn();return;}
    if(a==='workout'){h.startWorkout();return;}
    if(a==='copy'){if(navigator.clipboard)navigator.clipboard.writeText(R.room.code).then(function(){safe(function(){say('Invitation code copied.');});},function(){R.error='Copy the invitation code shown above.';paint();});return;}
    if(a==='refresh'){R.refresh();return;}
    if(a==='create'||a==='join'){
     var nickname=String(ctx.state.nickname||'').trim();if(!nickname){R.error='Enter the display name you want to share.';paint();return;}
     if(a==='create'){if(!requestId)requestId=requestKey();call('create',{nickname:nickname,title:ctx.state.title||'Workout together',request_id:requestId});}
     else call('join',{nickname:nickname,code:String(ctx.state.code||'').trim().toUpperCase()});return;
    }
    if(a==='cancel'){ctx.set({confirm:''});return;}
    if(a==='pause'){call('pause',{paused:!(m&&m.paused)});return;}
    if(a==='handover'){var target=b.getAttribute('data-member');if(ctx.state.confirm!=='handover:'+target){ctx.set({confirm:'handover:'+target});return;}ctx.state.confirm='';call('handover',{user_id:target});return;}
    if(a==='ready'){call('ready',{ready:!(m&&m.ready)});return;}
    if(a==='trainer'){call('role',{user_id:b.getAttribute('data-member')});return;}
    if(a==='end'||a==='leave'){if(ctx.state.confirm!==a){ctx.set({confirm:a});return;}ctx.state.confirm='';}
    call(a,{});
   });});
  }
 });
 document.addEventListener('visibilitychange',function(){if(!document.hidden)tick();});window.addEventListener('online',tick);
})();
