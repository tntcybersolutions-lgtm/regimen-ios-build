// The shell's membership, owned end to end by the server (v369/v370): the account decides,
// the shell sells nothing, an unknown answer is pending (never open), trials end at endsAt
// even offline, and a paid answer ages out of its offline grace. Daily releases re-apply this
// region; edit it here, not in the generated app file.
export function applyPurchaseAccess(html){
 const start=html.indexOf('let NSP_AT = 0'),end=html.indexOf('\nfunction trialInfo(){',start);
 if(start<0||end<0)throw Error('Purchase access: native entitlement boundary missing');
 const native=`let NSP_AT = 0, NSP_UID = '', NSP_RUN = 0;
/* v370: how long the shell trusts a paid answer without the server. Older than a day it
   re-asks in the background; older than thirty days offline it stops granting and asks -
   a paid answer is never trusted forever. */
const NATIVE_PAID_RECHECK = 24*3600000, NATIVE_PAID_GRACE = 30*86400000;
function nativeServerPaid(force){
  if(!onNative()) return Promise.resolve(null);
  const E=ent(), user=(typeof CLOUD!=='undefined'&&CLOUD&&CLOUD.signedIn())?CLOUD.user():null, who=String(user&&user.id||'');
  if(NSP_UID!==who){NSP_UID=who;NSP_AT=0;NSP_RUN++;}
  if(E.serverPaidUid!==who||!who){E.serverPaid=false;E.serverLifetime=false;E.serverPaidUid=who;E.serverTrial=null;E.serverTrialUid=who;}   /* v369: the trial goes with the plan */
  if(!who||(!force&&Date.now()-NSP_AT<5*60000))return Promise.resolve(null);
  NSP_AT=Date.now();const run=++NSP_RUN,ac=new AbortController(),timer=setTimeout(()=>ac.abort(),10000);
  const same=()=>ent()===E&&NSP_RUN===run&&CLOUD.signedIn()&&String(CLOUD.user()?.id||'')===who;
  return Promise.resolve(CLOUD.token()).then(tok=>tok?fetch('https://app.formedlabs.co/api/entitlement',{headers:{authorization:'Bearer '+tok},cache:'no-store',credentials:'omit',signal:ac.signal}):null)
    .then(r=>(r&&r.ok)?r.json():null).then(j=>{
      if(!same()||!j||j.ok!==true||typeof j.paid!=='boolean')return null;
      const tr=j.trial&&typeof j.trial==='object'?{state:String(j.trial.state||''),daysLeft:+j.trial.daysLeft||0,endsAt:+j.trial.endsAt||0}:null;   /* v369: the server's trial, kept with the plan */
      const was=JSON.stringify([E.serverPaid,E.serverLifetime,E.serverTrial]);E.serverPaid=j.paid;E.serverLifetime=j.lifetime===true;E.serverPaidUid=who;E.serverTrial=tr;E.serverTrialUid=who;E.serverPaidAt=Date.now();   /* v370: the answer carries its time, for the offline grace */
      if(was!==JSON.stringify([E.serverPaid,E.serverLifetime,E.serverTrial])){try{save();}catch(e){}try{entRepaint();}catch(e){}}
      return j;
    }).catch(()=>{if(same())NSP_AT=0;return null;}).finally(()=>clearTimeout(timer));
}
window.formedRefreshNativeAccess=function(){return nativeServerPaid(true);};
/* v369: the server's answer belongs to one account. Sign-out and account switches drop it,
   so the next screen never shows the last member's plan. CLOUD.storeSession reports both. */
function clearNativeAccess(){
  const E=ent();
  E.serverPaid=false;E.serverLifetime=false;E.serverPaidUid='';E.serverTrial=null;E.serverTrialUid='';E.serverPaidAt=0;
  try{save();}catch(e){}
  try{entRepaint();}catch(e){}
}
try{
  if(typeof CLOUD!=='undefined'&&CLOUD&&CLOUD.onChange){
    let ACCESS_UID='';try{ACCESS_UID=(CLOUD.signedIn()&&CLOUD.user())?String(CLOUD.user().id||''):'';}catch(e){}
    CLOUD.onChange(function(){
      let who='';try{who=(CLOUD.signedIn()&&CLOUD.user())?String(CLOUD.user().id||''):'';}catch(e){}
      if(who===ACCESS_UID)return;
      ACCESS_UID=who;
      clearNativeAccess();
    });
  }
}catch(e){}
/* v369: coming back to the app re-asks the server, so a plan bought on the web is open by
   the time the member looks at a Pro screen. visibilitychange fires on foreground in the shell. */
document.addEventListener('visibilitychange',function(){
  if(document.hidden)return;
  try{if(onNative())nativeServerPaid(true);}catch(e){}
});
/* v369: the shell's membership, from the server's last answer (nativeServerPaid keeps it fresh).
   No account: 'signedout', and the Pro screens point at the sign-in. An answer that has not
   arrived yet is 'open' rather than a lock: nobody is shut out on a maybe, and the last answer
   survives a restart, so an offline day changes nothing for a known member. */
function nativeTrial(E){
  const user=(typeof CLOUD!=='undefined'&&CLOUD&&CLOUD.signedIn&&CLOUD.signedIn())?CLOUD.user():null;
  if(!user) return {state:'signedout', daysLeft:0, endsAt:0, days:0, source:'server'};
  const who=String(user.id||''), now=Date.now();
  /* v370: a paid answer ages. Past the recheck it is quietly confirmed again; past the
     grace (a long time offline) it stops granting until the server can answer. An answer
     from before this rule has no time and reads as old on purpose. */
  const paidState=()=>{
    const age=now-(+E.serverPaidAt||0);
    if(age>NATIVE_PAID_GRACE) return {state:'pending', daysLeft:0, endsAt:0, days:0, source:'server'};
    if(age>NATIVE_PAID_RECHECK){ try{nativeServerPaid(true);}catch(e){} }
    return {state:'paid', daysLeft:0, endsAt:0, days:0, source:'server'};
  };
  if(E.serverPaid&&E.serverPaidUid===who) return paidState();
  const tr=E.serverTrial;
  if(tr&&E.serverTrialUid===who){
    /* v370: the trial ends at endsAt, even offline, and the count comes from the clock,
       not from the number the server sent then */
    if(tr.state==='active'){
      if(tr.endsAt&&now>=tr.endsAt) return {state:'expired', daysLeft:0, endsAt:tr.endsAt, days:TRIAL_DAYS, source:'server'};
      const left=tr.endsAt?Math.ceil((tr.endsAt-now)/DAY):Math.max(1,tr.daysLeft|0);
      return {state:'active', daysLeft:Math.max(1,left), endsAt:tr.endsAt, days:TRIAL_DAYS, source:'server'};
    }
    if(tr.state==='over') return {state:'expired', daysLeft:0, endsAt:tr.endsAt, days:TRIAL_DAYS, source:'server'};
    if(tr.state==='paid') return paidState();
  }
  /* v370: signed in with no answer yet is pending, never open. A first load on a failed
     connection is not Pro; the screens say they are checking and offer a retry. */
  return {state:'pending', daysLeft:0, endsAt:0, days:0, source:'unknown'};
}`;
 html=html.slice(0,start)+native+html.slice(end);
 return html;
}
