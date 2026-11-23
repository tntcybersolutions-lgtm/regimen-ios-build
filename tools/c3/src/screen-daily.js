/* Locked daily journey. Drafts are account/day scoped; actual records require confirmation. */
(function(){
 'use strict';
 var C3=window.C3;if(!C3)return;
 var h=C3.h,esc=h.esc,busy=false,focusStep='',draftTimer=0;
 function safe(fn,d){try{var v=fn();return v===undefined?d:v;}catch(e){return d;}}
 function owner(){return safe(function(){return String((CLOUD.user()||{}).id||'guest');},'guest');}
 function day(){return dkey(Date.now());}
 function scope(){return owner()+'|'+day();}
 function state(){
  var all=ALL.dailyGuides=ALL.dailyGuides||{},key=scope();
  if(!all[key]){var r=safe(readyToday,null),w=(ALL.weights||[]).filter(function(x){return dkey(x.at)===day();}).slice(-1)[0];
   all[key]={quick:!!prefs().compactCheckin,day:day(),owner:owner(),at:Date.now(),updatedAt:Date.now(),step:0,answers:{},skipped:{},weight:w?wNum(w.lb,1):'',weightInitial:w?wNum(w.lb,1):'',weightAt:w?w.at:null,water:'',waterApplied:0,note:r&&r.note||'',later:{},order:[],active:false};
   if(r){questions().forEach(function(q){if(r[q.k]!=null)all[key].answers[q.k]=r[q.k];});all[key].savedAt=r.at;all[key].checkinAt=r.at;}
  }
  var d=all[key];d.skipped=d.skipped||{};d.order=d.order||[];d.later=d.later||{};return d;
 }
 function persist(){var d=state();d.updatedAt=Math.max(Date.now(),(+d.updatedAt||0)+1);save();return saveOk();}
 function draft(){clearTimeout(draftTimer);var who=owner(),when=day();draftTimer=setTimeout(function(){if(who===owner()&&when===day()){persist();draftStatus();}},250);}
 function draftStatus(){var el=C3.root&&C3.root.querySelector('#daily-draft-status');if(el)el.textContent=saveOk()?'Draft saved on this device. Confirm the review to record these entries.':'Draft is not saved. Keep this screen open and retry saving.';}
 function bucket(){var hour=new Date().getHours();return hour<11?'morning':hour<16?'midday':'evening';}
 function mealCount(){var period=bucket();return (ALL.food||[]).filter(function(e){var hour=new Date(e.at).getHours();return dkey(e.at)===day()&&(hour<11?'morning':hour<16?'midday':'evening')===period;}).length;}
 function tracking(){return !!(ALL.ui&&ALL.ui.focus==='track'&&!ALL.ui.trainOn);}
 function prefs(){return ALL.journeyPrefs||{};}
 function mode(value){ALL.journeyPrefs=Object.assign({},prefs(),{mode:value,modeAt:Date.now(),at:Date.now()});persist();}
 function tasks(){
  var d=state(),T=h.today(),checked=!!readyToday()||!!d.savedAt,only=tracking(),m=mealCount(),hour=new Date().getHours();
  var a=[{kind:'checkin',title:checked?'Daily check-in saved':'Start your daily check-in',why:'Sleep, energy, soreness, mood and optional measurements, reviewed together.',button:!checked&&(d.step||Object.keys(d.answers).length||Object.keys(d.skipped).length)?'Resume check-in':'Start my day',done:checked,go:'daily'}];
  if(ALL.ui&&ALL.ui.planOpen&&!only)a.push({kind:'setup',title:'Finish your personal plan',why:'Your own answers set up your food and training plan.',button:'Continue setup',done:false});
  if(!only){a.push({kind:'meal',title:m?'Meal recorded':'Your '+(hour<11?'breakfast':hour<16?'lunch':'evening meal'),why:m?'Your diary has food recorded for this part of the day.':'Review your planned meals. Log only what you actually ate.',button:'Log my '+(hour<11?'breakfast':hour<16?'lunch':'dinner'),done:m>0,go:'food'});
   a.push({kind:'train',title:T.rest?'Recovery day':T.done?T.name+' completed':(T.started?'Resume ':'Prepare for ')+T.name,why:T.rest?'No lifting session is planned today. Stretching is optional.':(T.minutes?T.minutes+' minutes planned. ':'')+safe(function(){return (trainCfg().equipment||[]).map(function(k){return k.replace(/\b\w/g,function(c){return c.toUpperCase();});}).join(', ');},''),button:T.started?'Resume workout':'Prepare my workout',done:!!T.done||!!T.rest,go:T.rest?'recovery':'prepare'});}
  /* v372: the dose step is there on a day with a dose: done once today's are logged, skipped or held; open from two hours before */
  var dz=doseDay();if(dz.rows.length){var nx=dz.open[0];
   a.push({kind:'track',title:nx?'Your '+safe(function(){return pdName(nx.p);},'')+' dose':'Today’s doses logged',why:nx?[safe(function(){return pdAmt(nx.p,nx.mg);},''),safe(function(){return new Date(nx.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});},'')].filter(Boolean).join(' · '):'Every dose planned for today is recorded.',
    button:'Log my dose',done:!nx,go:'doses',available:!nx||nx.at<=Date.now()+2*36e5,when:nx?'At '+safe(function(){return new Date(nx.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});},''):''});}
  a.push({kind:'evening',title:d.eveningAt?'Day reviewed':'Review today and prepare tomorrow',why:'See what you recorded, note anything useful and review tomorrow’s plan.',button:'Review my day',done:!!d.eveningAt,go:'evening',available:hour>=17});
  a.forEach(function(x){x.later=!!d.later[x.kind==='meal'?'meal-'+bucket():x.kind];});
  a.sort(function(x,y){if(x.kind==='checkin'||y.kind==='checkin')return x.kind==='checkin'?-1:1;var i=d.order.indexOf(x.kind),j=d.order.indexOf(y.kind);return (i<0?99:i)-(j<0?99:j);});
  return a;
 }
 function doseDay(){
  if(!safe(onPeptide,false))return {rows:[],open:[]};
  var rows=(safe(function(){return pdModel().rows;},[])||[]).filter(function(r){return safe(function(){return dkey(r.at);},'')===day()&&r.status!=='skipped'&&r.status!=='held';});
  return {rows:rows,open:rows.filter(function(r){return !r.dose;})};
 }
 function next(){
  var a=tasks(),d=state(),x=a.filter(function(t){return !t.done&&!t.later&&t.available!==false;})[0];
  if(x)return x;
  return {kind:'summary',title:d.eveningAt?'You’re set for today. Tomorrow is ready.':'You’re set for now',why:d.eveningAt?'Your review is saved. Tomorrow’s plan is ready to inspect.':'Your available steps are complete or set aside for later. Your agenda is below.',button:'See my full day'};
 }
 function openTask(kind){
  var d=state(),n=tasks().filter(function(x){return x.kind===kind;})[0];if(!n)return;
  d.active=true;d.task=kind;delete d.later[kind==='meal'?'meal-'+bucket():kind];persist();
  if(kind==='setup'){C3.go('today');safe(openFinishPlan);return;}
  if(kind==='train'){C3.go('prepare');return;}
  /* v372 (Chad, 28 Oct: "after logging how i feel ... it takes me here 'your plan' ... i cant log anything here ... it should
     flow through good morning then go to log breakfast"): the meal step opens Food at that meal, its Log the big button */
  C3.go(n.go,kind==='meal'?{meal:bucket()==='morning'?0:bucket()==='midday'?1:2,guide:1}:{});
 }
 function openNext(){var n=next();if(n.kind==='summary'){state().active=false;persist();C3.go('today',{full:true});return;}openTask(n.kind);}
 function later(){var d=state(),n=next();d.later[n.kind==='meal'?'meal-'+bucket():n.kind]=true;persist();C3.go('today');}
 function after(kind){if(C3.coachControls&&!C3.coachControls.allows('advance'))return;var d=state();if(!d.active||d.task!==kind||!saveOk())return;var who=owner(),when=day();setTimeout(function(){if(owner()!==who||day()!==when)return;var n=next();if(n.kind==='summary')C3.go('today');else openNext();},350);}
 /* v373: the "do this next" card (build plan item 1): one next action pulled from plan, check-in, food and
    training state, one neon pink button, and the two steps after it named quietly underneath */
 function shortTask(t){
  if(t.kind==='checkin')return 'daily check-in';
  if(t.kind==='setup')return 'plan setup';
  if(t.kind==='train')return t.title.replace(/^(Prepare for|Resume) /,'');
  if(t.kind==='track')return 'log your dose';
  if(t.kind==='evening')return 'evening review';
  if(t.kind==='meal')return t.button.replace(/^Log my /,'log ');
  return t.title.toLowerCase();
 }
 function thenLine(a){
  var rest=a.filter(function(t){return !t.done&&!t.later&&t.available!==false;}).slice(1,3);
  return rest.length?'<p class="dg-then">Then: '+esc(rest.map(shortTask).join(', '))+'</p>':'';
 }
 function home(){
  var d=state(),n=next(),a=tasks(),T=h.today(),checked=!!readyToday()||!!d.savedAt,quick=prefs().mode==='quick';
  var name=safe(displayName,'').trim().split(/\s+/)[0],greet=bucket()==='morning'?'Morning':bucket()==='midday'?'Afternoon':'Evening';
  var progress=a.filter(function(t){return t.done;}).length;
  var photo=tracking()||safe(onPeptide,false)?'':'<div class="dj-photo">'+h.pictureHTML(T.rest?'dakota-stretch':h.sessionPhoto(T.day),{eager:true})+'<p>Shay coordinates your day. Your coaches are one tap away.</p><button type="button" class="c3-btn-quiet" data-go="coaches">Meet with my coaches</button></div>';
  var agenda='<section class="dj-agenda" aria-label="Today’s agenda"><h2 class="c3-h2">Your day</h2><ol>'+a.map(function(t,i){return '<li class="'+(t.done?'done':'')+'"><span class="dj-step" aria-label="'+(t.done?'Completed':'Step '+(i+1))+'">'+(t.done?h.icon('check',18):i+1)+'</span><div><b>'+esc(t.title)+'</b><small>'+esc(t.done?(t.kind==='train'&&T.rest?'No workout planned. Optional recovery is available.':'Recorded'):t.later?'Set aside for later':t.available===false?(t.when||'Available this evening'):t.why)+'</small>'+(!t.done&&t.kind===n.kind?'':'<button type="button" class="c3-link" data-daily="task" data-kind="'+t.kind+'">'+esc(t.done?'Review':t.available===false?'Preview':t.button)+'</button>')+'</div>'+(i>1?'<button type="button" class="c3-btn-quiet dj-up" data-daily="up" data-kind="'+t.kind+'" aria-label="Move '+esc(t.title)+' earlier">'+h.icon('back',18)+'</button>':'')+'</li>';}).join('')+'</ol></section>';
  return '<div class="dg-home dj-home"><header class="dj-greeting"><div class="c3-eyebrow"><i></i>'+esc(h.fmt.date(new Date()))+'</div><h1 class="c3-h1">'+esc(greet+(name?', '+name:'')+'.')+'<span>What to do today.</span></h1></header><div class="dj-layout"><div class="dj-main"><div class="dj-modes dj-modes-top" role="group" aria-label="How to use today"><button type="button" data-daily="guide" aria-pressed="'+(!quick)+'">Guide me</button><button type="button" data-daily="quick" aria-pressed="'+quick+'">Quick access</button></div><section class="dg-next" aria-label="'+(n.kind==='summary'?'All set':'Do this next')+'">'+(n.kind==='summary'?'':'<div class="dg-kicker dg-next-label">Do this next</div>')+'<h2>'+esc(n.title)+'</h2><p>'+esc(!checked&&n.kind==='checkin'?'Your check-in takes about two minutes.':n.why)+'</p><button type="button" class="c3-btn-primary dg-main pink" data-daily="next"><span>'+esc(n.kind==='summary'?'See my full day':n.button)+'</span>'+h.icon('arrow',30)+'</button>'+thenLine(a)+(n.kind!=='checkin'&&n.kind!=='summary'?'<button type="button" class="c3-btn-quiet" data-daily="later">Do this later</button>':'')+'<p class="dj-count" role="status">'+progress+' of '+a.length+' daily steps complete</p><progress max="'+a.length+'" value="'+progress+'" aria-label="Daily steps completed"></progress></section>'+(quick?'<section class="dj-quick" aria-label="Quick access"><button type="button" class="c3-btn-quiet" data-sheet="">Log something</button><button type="button" class="c3-btn-quiet" data-go="train">Training</button><button type="button" class="c3-btn-quiet" data-go="food">Food diary</button><button type="button" class="c3-btn-quiet" data-go="doses">Track</button><button type="button" class="c3-btn-quiet" data-go="reminders">Reminders</button></section>':'')+agenda+'</div><aside class="dj-context">'+photo+'<details class="dj-links"><summary>More for your day</summary><div class="dj-link-list"><button type="button" data-go="food">Food diary '+h.icon('chev',18,2.4)+'</button><button type="button" data-go="plan" data-params=\'{"tab":"groc"}\'>Your groceries '+h.icon('chev',18,2.4)+'</button><button type="button" data-go="coaches">Your four coaches '+h.icon('chev',18,2.4)+'</button><button type="button" data-go="tools">All tools '+h.icon('chev',18,2.4)+'</button><button type="button" data-go="today" data-params=\'{"full":true}\'>See my full day '+h.icon('chev',18,2.4)+'</button></div></details></aside></div></div>';
 }
 function wireHome(root){root.querySelectorAll('[data-daily]').forEach(function(b){b.addEventListener('click',function(){var act=b.getAttribute('data-daily'),kind=b.getAttribute('data-kind');if(act==='task')openTask(kind);else if(act==='up'){var d=state(),list=tasks().map(function(t){return t.kind;}),i=list.indexOf(kind);if(i>1){list.splice(i,1);list.splice(i-1,0,kind);d.order=list;persist();C3.render();}}else if(act==='guide'||act==='quick'){mode(act==='guide'?'guide':'quick');C3.render();}else if(act==='later')later();else openNext();});});}
 function rail(name){var d=state();if(!d.active||['plan','food','train','doses','prepare'].indexOf(name)<0)return '';
  var a=tasks(),i=a.map(function(t){return t.kind;}).indexOf(d.task),meal=bucket()==='morning'?'breakfast':bucket()==='midday'?'lunch':'dinner';
  var what={meal:meal,train:'workout',track:'dose'}[d.task]||'';
  /* the last step done before this one, in words */
  var prev=a.slice(0,Math.max(0,i)).filter(function(t){return t.done;}).pop(),said=prev?{checkin:'Check-in saved. ',meal:(mealCount()?meal.charAt(0).toUpperCase()+meal.slice(1)+' logged. ':''),train:'Workout done. ',track:'Dose logged. '}[prev.kind]||'':'';
  var head='Your day'+(i>=0?' · step '+(i+1)+' of '+a.length:''),line=what?said+'Your '+what+' is next.':'Continue when this step is done.';
  return '<aside class="dg-rail" aria-label="Daily guide"><div><b>'+esc(head)+'</b><span>'+esc(line)+'</span></div>'+(what?'<button type="button" class="c3-btn-quiet" data-daily="skip">Skip '+esc(what)+'</button>':'<button type="button" class="c3-btn-quiet" data-daily="finish">Continue my day</button>')+'<button type="button" class="c3-btn-quiet" data-daily="later">Finish later</button></aside>';}
 function wireRail(root){root.querySelectorAll('.dg-rail [data-daily]').forEach(function(b){b.addEventListener('click',function(){var d=state();if(b.getAttribute('data-daily')==='later'){d.active=false;persist();C3.go('today');return;}
   if(b.getAttribute('data-daily')==='skip'){d.later[d.task==='meal'?'meal-'+bucket():d.task]=true;persist();openNext();return;}   /* v372: skip this step for now, on to the next one */if(d.task==='meal'&&!mealCount()){safe(function(){say('Log what you ate, or choose Finish later.');});return;}if(d.task==='track'){d.trackingReviewed=true;persist();}openNext();});});}
 function questions(){return HOOPER.concat([APPETITE,{k:'mood',n:'Mood',lo:'Very low',hi:'Very positive'}]);}
 function quickForm(d){
  return '<div class="dg-quick-fields">'+questions().map(function(q){var v=d.skipped[q.k]?'skip':d.answers[q.k]||'';return '<label class="dg-field"><span>'+esc(q.n)+'</span><select data-dq="'+q.k+'" aria-label="'+esc(q.n)+'"><option value="">Choose for today</option>'+[1,2,3,4,5,6,7].map(function(n){return '<option value="'+n+'" '+(+v===n?'selected':'')+'>'+n+' of 7'+(n===1?' · '+esc(q.lo):n===7?' · '+esc(q.hi):'')+'</option>';}).join('')+'<option value="skip" '+(v==='skip'?'selected':'')+'>Skip for now</option></select><small>1: '+esc(q.lo)+'. 7: '+esc(q.hi)+'.</small></label>';}).join('')+'</div><details class="dg-optional" '+(d.editOptional||d.weight||d.water||d.note?'open':'')+'><summary>Optional weight, water and note</summary><div class="dg-quick-fields"><label class="dg-field">Weight ('+esc(wU())+')<input id="daily-weight" type="number" inputmode="decimal" min="0" step="0.1" value="'+esc(d.weight)+'" placeholder="Optional"></label><label class="dg-field">Additional water already drunk (mL)<input id="daily-water" type="number" inputmode="decimal" min="0" max="2000" value="'+esc(d.water)+'" placeholder="Optional"></label></div><label class="dg-field">Today’s note<textarea id="daily-note" maxlength="400" placeholder="Optional">'+esc(d.note)+'</textarea></label><p class="dg-note">Use measurements you actually took. Existing entries are retained; unchanged weight and repeated water saves add no duplicates.</p></details>';
 }
 function quickReview(d,error){
  var missing=questions().find(function(q){return !d.skipped[q.k]&&!(+d.answers[q.k]>=1&&+d.answers[q.k]<=7);});
  if(missing){error.textContent='Choose '+missing.n.toLowerCase()+' for today, or select Skip for now.';C3.root.querySelector('[data-dq="'+missing.k+'"]').focus();return;}
  var w=d.weight===''?null:wIn(d.weight),water=d.water===''?0:+d.water;
  if(w!==null&&(!Number.isFinite(w)||w<=0||w>2000)||!Number.isFinite(water)||water<0||water>2000){error.textContent='Check the optional weight and additional water amounts.';return;}
  d.step=9;persist();C3.render(true);
 }
 var LAST=9;
 function advance(d){d.step=Math.min(LAST,+d.step+1);persist();C3.render(true);}
 function saveAll(){
  var d=state();if(busy||d.owner!==owner()||d.day!==day())return false;
  var weight=d.weight===''?null:wIn(d.weight),water=d.water===''?0:+d.water;
  if(weight!==null&&(!Number.isFinite(weight)||weight<=0||weight>2000)||!Number.isFinite(water)||water<0||water>2000)return false;
  var valid=questions().every(function(q){return d.skipped[q.k]||(+d.answers[q.k]>=1&&+d.answers[q.k]<=7);});if(!valid)return false;
  busy=true;var old=JSON.parse(JSON.stringify({ready:ALL.ready||[],weights:ALL.weights||[],hydration:ALL.hydration||{},d:d})),save0=window.save;
  try{
   window.save=function(){};var vals={note:d.note.trim()||undefined,skipped:Object.assign({},d.skipped)};questions().forEach(function(q){if(!d.skipped[q.k])vals[q.k]=+d.answers[q.k];});
   var result=readySave(vals);if(d.checkinAt)result.row.at=d.checkinAt;
   if(weight!==null&&String(d.weight)!==String(d.weightInitial)){
    if(!d.weightAt){d.weightAt=d.at;while((ALL.weights||[]).some(function(w){return w.at===d.weightAt;}))d.weightAt++;}
    var w=(ALL.weights||[]).filter(function(x){return x.at===d.weightAt;})[0];if(w)w.lb=weight;else weighAdd(d.weightAt,weight);
   }
   ALL.hydration=ALL.hydration||{};var delta=Math.round(water)-(+d.waterApplied||0);if(delta)ALL.hydration[d.day]=Math.max(0,(+ALL.hydration[d.day]||0)+delta);d.waterApplied=Math.round(water);
   d.savedAt=Date.now();d.checkinAt=result.row.at;d.active=true;d.task='checkin';d.updatedAt=Date.now();RDUI.draft=null;
  }catch(e){ALL.ready=old.ready;ALL.weights=old.weights;ALL.hydration=old.hydration;ALL.dailyGuides[scope()]=old.d;return false;}
  finally{window.save=save0;busy=false;}
  save0();if(!saveOk()){ALL.ready=old.ready;ALL.weights=old.weights;ALL.hydration=old.hydration;ALL.dailyGuides[scope()]=old.d;C3.refresh();return false;}
  safe(function(){drawAll();say('Check-in saved on this device. Here is your next step.');});openNext();return true;
 }
 C3.daily={state:state,next:next,tasks:tasks,persist:persist,prefs:prefs,mode:mode,home:home,wireHome:wireHome,rail:rail,wireRail:wireRail,openNext:openNext,openTask:openTask,after:after,save:saveAll,mealCount:mealCount};
 (C3.ydq=C3.ydq||[]).push(function(yd){
  yd.screen('daily',{nav:'today',parent:'today',hold:function(){return !!(C3.root&&C3.root.activeElement&&C3.root.activeElement.matches('#daily-weight,#daily-water,#daily-note'));},render:function(){
   var d=state(),step=Math.min(LAST,+d.step||0),q=questions()[step],quick=d.quick===true,title='',hint='',content='';
   if(quick&&step<LAST){title='Your daily check-in';hint='Choose how you feel today. Review everything together before it is recorded.';content=quickForm(d);}
   else if(q){title=q.k==='sleep'?'How did you sleep?':q.k==='fatigue'?'How is your energy?':q.k==='stress'?'How stressed do you feel?':q.k==='soreness'?'How sore are you?':q.k==='mood'?'How is your mood?':'How is your appetite?';var why={sleep:'Keep a record of your sleep alongside your training.',fatigue:'Your reported energy adds context to today’s session.',stress:'A record of stress helps you review changes over time.',soreness:'Record how you feel before training. You can change or pause a session.',appetite:'Keep your appetite alongside your food records.',mood:'Your own mood record is separate from the readiness score.'};hint=why[q.k]+' 1: '+q.lo+'. 7: '+q.hi+'.';content='<div class="dg-scale" role="group" aria-label="'+esc(q.n)+'">'+[1,2,3,4,5,6,7].map(function(n){return '<button type="button" data-dg="answer" data-value="'+n+'" aria-label="'+esc(q.n)+' '+n+' of 7" aria-pressed="'+(+d.answers[q.k]===n&&!d.skipped[q.k])+'"><b>'+n+'</b><small>'+(n===1?esc(q.lo):n===7?esc(q.hi):'')+'</small></button>';}).join('')+'</div>';}
   else if(step===6){title='A weigh-in, if you want';hint=(d.weightInitial?'Today already has '+d.weightInitial+' '+wU()+'. Keeping it unchanged adds no duplicate. ':'')+'Optional. Use a measurement you actually took.';content='<label class="dg-field">Weight ('+esc(wU())+')<input id="daily-weight" data-key="daily-weight" type="number" inputmode="decimal" min="0" step="0.1" value="'+esc(d.weight)+'" placeholder="Optional"></label>';}
   else if(step===7){title='Any water to log?';hint='Already recorded today: '+(+((ALL.hydration||{})[day()])||0)+' mL. Enter only additional water you already drank.';content='<label class="dg-field">Additional water already drunk (mL)<input id="daily-water" data-key="daily-water" type="number" inputmode="decimal" min="0" max="2000" value="'+esc(d.water)+'" placeholder="Optional"></label>';}
   else if(step===8){title='Anything else to note?';hint='Optional. Your own words stay with today’s check-in.';content='<label class="dg-field">Today’s note<textarea id="daily-note" data-key="daily-note" maxlength="400" placeholder="Optional">'+esc(d.note)+'</textarea></label>';}
   else{title='Review your check-in';hint='Confirm these entries together. Your next unfinished activity opens after a successful save.';content='<dl class="dg-review">'+questions().map(function(item,i){return '<div><dt>'+esc(item.n)+'</dt><dd>'+esc(d.skipped[item.k]?'Skipped':d.answers[item.k]||'Not answered')+' <button type="button" class="c3-link" data-dg="edit" data-step="'+i+'" aria-label="Edit '+esc(item.n)+'">Edit</button></dd></div>';}).join('')+'<div><dt>Weight</dt><dd>'+esc(d.weight?d.weight+' '+wU():'No new entry')+' <button type="button" class="c3-link" data-dg="edit" data-step="6" aria-label="Edit weight">Edit</button></dd></div><div><dt>Additional water</dt><dd>'+esc(d.water?d.water+' mL':'No new entry')+' <button type="button" class="c3-link" data-dg="edit" data-step="7" aria-label="Edit additional water">Edit</button></dd></div>'+'<div><dt>Note</dt><dd>'+esc(d.note||'No note')+' <button type="button" class="c3-link" data-dg="edit" data-step="8" aria-label="Edit note">Edit</button></dd></div>'+'</dl><p class="dg-note">Skipping a readiness answer keeps its total unavailable. Mood and appetite are separate records.</p>';}
   return '<div class="dg"><div class="dg-top"><button type="button" class="c3-btn-quiet" data-dg="later">Save for later</button><span role="status">Daily check-in · '+(quick?(step===LAST?'2 of 2':'1 of 2'):(step+1)+' of 10')+'</span></div><div class="dj-modes" role="group" aria-label="Check-in format"><button type="button" data-dg="guided" aria-pressed="'+(!quick)+'">Step by step</button><button type="button" data-dg="quick" aria-pressed="'+quick+'">Quick check-in</button></div><progress max="'+(quick?2:10)+'" value="'+(quick?(step===LAST?2:1):step+1)+'" aria-label="Check-in progress"></progress><h1 class="c3-h1 dg-title" tabindex="-1">'+esc(title)+'</h1><p class="dg-hint">'+esc(hint)+'</p>'+content+'<p id="daily-error" role="alert"></p><div class="dg-actions"><button type="button" class="c3-btn-quiet" data-dg="back">Back</button>'+(!quick&&step<LAST?'<button type="button" class="c3-btn-quiet" data-dg="skip">Skip for now</button>':'')+'<button type="button" class="c3-btn-primary dg-main" data-dg="'+(step===LAST?'save':quick?'review':'next')+'"><span>'+(step===LAST?'Save check-in &amp; start today':quick?'Review check-in':'Continue')+'</span>'+h.icon('arrow',30)+'</button></div><p class="dg-note" id="daily-draft-status">'+(saveOk()?'Draft saved on this device. Confirm the review to record these entries.':'Draft is not saved. Keep this screen open and retry saving.')+'</p></div>';
  },wire:function(root){
   var d=state(),step=+d.step||0,view=scope()+':'+step+':'+!!d.quick;if(focusStep!==view){focusStep=view;root.querySelector('.dg-title').focus({preventScroll:true});}
   root.querySelectorAll('[data-dq]').forEach(function(el){el.addEventListener('change',function(){var k=el.getAttribute('data-dq');if(el.value==='skip'){d.skipped[k]=true;delete d.answers[k];}else{delete d.skipped[k];if(el.value)d.answers[k]=+el.value;else delete d.answers[k];}persist();draftStatus();});});
   ['weight','water','note'].forEach(function(k){var el=root.querySelector('#daily-'+k);if(el)el.addEventListener('input',function(){d[k]=el.value;draft();});});
   root.querySelectorAll('[data-dg]').forEach(function(b){b.addEventListener('click',function(){var act=b.getAttribute('data-dg'),q=questions()[step],error=root.querySelector('#daily-error');
    if(act==='answer'){d.answers[q.k]=+b.getAttribute('data-value');delete d.skipped[q.k];persist();C3.render();}
    else if(act==='quick'||act==='guided'){d.quick=act==='quick';ALL.journeyPrefs=Object.assign({},prefs(),{compactCheckin:d.quick,at:Date.now(),modeAt:Date.now()});d.step=d.quick?0:Math.max(0,questions().findIndex(function(x){return !d.skipped[x.k]&&!d.answers[x.k];}));persist();C3.render(true);}
    else if(act==='review')quickReview(d,error);
    else if(act==='later'){persist();if(saveOk())C3.go('today');else error.textContent='This device could not save your draft. Keep this screen open and retry.';}
    else if(act==='edit'){var edit=+b.getAttribute('data-step');d.editOptional=d.quick&&edit>=6;d.step=d.quick?0:edit;persist();C3.render();var field=edit===6?'#daily-weight':edit===7?'#daily-water':edit===8?'#daily-note':d.quick?'[data-dq="'+questions()[edit].k+'"]':null;if(field){var target=C3.root.querySelector(field);if(target){target.focus();target.scrollIntoView({block:'center',behavior:'auto'});}}}
    else if(act==='back'){if(!step){persist();if(saveOk())C3.go('today');else error.textContent='This device could not save your draft. Keep this screen open and retry.';}else{d.step=d.quick?0:step-1;persist();C3.render();}}
    else if(act==='skip'){if(q){d.skipped[q.k]=true;delete d.answers[q.k];}else if(step===6)d.weight='';else if(step===7)d.water='';else if(step===8)d.note='';advance(d);}
    else if(act==='next'){if(q&&!d.skipped[q.k]&&!(+d.answers[q.k]>=1&&+d.answers[q.k]<=7)){error.textContent='Choose an answer or use Skip for now.';return;}var n=step===6?(d.weight===''?null:wIn(d.weight)):(d.water===''?null:+d.water);if((step===6||step===7)&&n!==null&&(!Number.isFinite(n)||n<0||step===6&&n===0||n>2000)){error.textContent='Enter a valid amount or choose Skip for now.';return;}advance(d);}
    else if(act==='save'&&!saveAll())error.textContent='Your entries are still here. Review unanswered items, or retry after this device can save.';
   });});
  }});
 });if(C3.yd&&C3.yd.drain)C3.yd.drain();
})();
