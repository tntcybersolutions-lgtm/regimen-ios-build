/* A lost reply cannot silently lose an explicitly accepted local training change. */
(function(){
 'use strict';var C3=window.C3;if(!C3)return;var esc=C3.h.esc,R=C3.coachRecovery={busy:false,owner:'',message:'',error:'',armed:'',sequence:0};
 function owner(){try{return String(CLOUD.user().id||'');}catch(e){return '';}}
 function reset(){if(R.owner===owner())return;R.sequence++;R.owner=owner();R.busy=false;R.message='';R.error='';R.armed='';}
 function rows(){return ALL.coachDecisionReceipts||(ALL.coachDecisionReceipts={});}
 function put(r){r.at=Math.max(Date.now(),(+r.at||0)+1);rows()[r.id]=r;save();}
 function target(r){return r.action==='lighter_week'?((weekOverrides(r.week)||{}).scale??null):(ALL.waterSched||null);}
 R.prepare=function(pr,review){
  reset();if(!['lighter_week','tolerance_review'].includes(pr.action))return null;
  var prior=rows()[pr.id];if(prior)return prior;
  var r={id:pr.id,review:review,owner:owner(),action:pr.action,week:weekIndexNow(),from:dkey(Date.now()),until:dkey(Date.now()+13*DAY),createdAt:Date.now(),status:'pending',applied:false};r.before=JSON.stringify(target(r));put(r);return r;
 };
 R.confirm=function(id,force){
  reset();var r=rows()[id];if(!r)return {ok:true};if(r.owner!==owner())return {ok:false,error:'Account changed. Reopen the original account.'};
  if(r.applied)return {ok:true};
  if(r.action==='lighter_week'&&r.week!==weekIndexNow()){r.status='past';put(r);return {ok:true};}
  var desired=r.action==='lighter_week'?0.8:{from:r.from,until:r.until},actual=JSON.stringify(target(r));
  if(!force&&actual!==r.before&&actual!==JSON.stringify(desired)){r.status='conflict';put(r);return {ok:false,error:'Your settings changed while this decision was saving. Review the pending change under Coaches.'};}
  if(r.action==='lighter_week')weekOverrides(r.week,true).scale=desired;else ALL.waterSched=desired;
  r.status='applied';r.applied=true;put(r);try{renderTrain();}catch(e){}return {ok:true};
 };
 R.check=async function(id,force){
  reset();if(R.busy)return;var r=rows()[id];if(!r||r.owner!==owner())return;var who=owner(),state=ALL,seq=++R.sequence,timer;R.busy=true;R.error='';R.message='';C3.refresh();
  try{
   var g=await Promise.race([CLOUD.reviewGet(r.review),new Promise(function(resolve,reject){timer=setTimeout(function(){reject(Error('The check timed out. Reconnect and retry.'));},15000);})]);if(owner()!==who||ALL!==state||R.sequence!==seq)return;
   if(!g.ok)throw Error(g.error||'Could not check the saved decision. Retry.');var pr=g.review&&g.review.proposal;
   if(!pr||pr.id!==id||pr.action!==r.action)throw Error('The saved proposal does not match. Open the weekly review.');
   if(pr.status==='accepted'){var result=R.confirm(id,force);if(!result.ok)throw Error(result.error);R.message=r.status==='past'?'That training week has ended. Your current week was kept.':'The accepted change is saved on this account.';}
   else if(['rejected','expired','stale'].includes(pr.status)){r.status='closed';put(r);R.message='This change was not accepted. Your settings were kept.';}
   else{r.status='pending';put(r);R.message='No accepted decision is recorded. Open Weekly review to decide again.';}
  }catch(e){if(owner()===who&&ALL===state&&R.sequence===seq)R.error=e.message||'Reconnect and retry checking the decision.';}
  finally{clearTimeout(timer);if(R.sequence===seq){R.busy=false;R.armed='';C3.refresh();}}
 };
 function html(){reset();var pending=Object.values(rows()).filter(function(r){return r.owner===owner()&&['pending','conflict'].includes(r.status);});if(!pending.length&&!R.message&&!R.error)return '';
  return '<section class="yd-sec"><h2 class="c3-h2">Finish a saved decision</h2><p>A decision interrupted by a connection or account change is checked against the saved server result before anything is applied.</p>'+pending.map(function(r){var name=r.action==='lighter_week'?'Lighter training week':'Accepted water schedule',armed=R.armed===r.id;return '<div class="co-recovery"><h3>'+name+'</h3><p>Requested '+esc(new Date(r.createdAt).toLocaleDateString())+'. '+(r.status==='conflict'?'Your settings changed afterward. Keep them, or explicitly apply the accepted change.':'Waiting to confirm the saved decision.')+'</p><div class="yd-acts"><button type="button" class="c3-btn-quiet" data-coach-recover="check" data-receipt="'+esc(r.id)+'" '+(R.busy?'disabled':'')+'>Check saved decision</button>'+(r.status==='conflict'?'<button type="button" class="c3-btn-quiet" data-coach-recover="apply" data-receipt="'+esc(r.id)+'" '+(R.busy?'disabled':'')+'>'+(armed?'Tap again to apply accepted change':'Apply accepted change')+'</button>':'')+(armed?'<button type="button" class="c3-link" data-coach-recover="cancel">Cancel</button>':'')+'</div></div>';}).join('')+'<p role="status">'+esc(R.busy?'Checking the saved decision...':R.message)+'</p>'+(R.error?'<p role="alert">'+esc(R.error)+'</p>':'')+'<button type="button" class="c3-link" data-sheet="team">Open Weekly review</button></section>';
 }
 function wire(root){root.querySelectorAll('[data-coach-recover]').forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-receipt'),a=b.getAttribute('data-coach-recover');if(a==='cancel'){R.armed='';C3.refresh();}else if(a==='apply'&&R.armed!==id){R.armed=id;C3.refresh();}else R.check(id,a==='apply');});});}
 var controls=C3.coachControls,oldHTML=controls.html,oldWire=controls.wire;controls.html=function(){return oldHTML.apply(this,arguments)+html();};controls.wire=function(root){oldWire.apply(this,arguments);wire(root);};
})();
