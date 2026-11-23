/* A quiet purchase perk, shown only after the server connection is activated. */
(function(){
 'use strict';var C3=window.C3;if(!C3)return;var esc=C3.h.esc,P=C3.purchase={owner:'',ready:false,configured:false,busy:false,data:null,error:'',sequence:0,at:0,controller:null};
 function uid(){try{return CLOUD.signedIn()?String(CLOUD.user().id||''):'';}catch(e){return '';}}
 function native(){try{return !!(window.RUN&&RUN.native);}catch(e){return false;}}
 function api(){return /^https?:$/.test(location.protocol)?'':'https://app.formedlabs.co';}
 function refresh(){if(['member','shop'].includes(C3.current))C3.refresh();}
 function reset(){if(P.owner===uid())return;P.sequence++;if(P.controller)P.controller.abort();P.controller=null;P.owner=uid();P.busy=false;P.data=null;P.error='';P.at=0;}
 P.check=async function(){
  reset();if(P.busy||!P.ready)return;if(!uid()){C3.h.openSignIn();return;}var who=uid(),seq=++P.sequence,ac=P.controller=new AbortController(),timer=setTimeout(function(){ac.abort();},15000);P.busy=true;P.error='';refresh();
  try{var token=await Promise.race([CLOUD.token(),new Promise(function(resolve,reject){ac.signal.addEventListener('abort',function(){reject(Error('Access check timed out. Retry.'));},{once:true});})]);
   var r=await fetch(api()+'/api/purchase-access',{method:'POST',headers:{authorization:'Bearer '+token},cache:'no-store',credentials:'omit',signal:ac.signal}),j=await r.json();
   if(uid()!==who||P.sequence!==seq)return;if(!r.ok||!j.ok)throw Error(j.error||'Access could not be checked. Retry.');P.data=j;P.at=Date.now();
   if(window.BILLING&&BILLING.web())BILLING.entitlement(true);if(native()&&window.formedRefreshNativeAccess)formedRefreshNativeAccess();
  }catch(e){if(uid()===who&&P.sequence===seq)P.error=navigator.onLine===false?'Offline. Reconnect, then check your access.':e.name==='AbortError'?'Access check timed out. Retry.':e.message;}
  finally{clearTimeout(timer);if(P.sequence===seq){P.busy=false;P.controller=null;refresh();}}
 };
 P.init=async function(){
  reset();if(!P.configured){try{var r=await fetch(api()+'/api/config',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(6000)}),j=await r.json();if(r.ok&&j.ok){P.ready=j.purchaseBenefit===true;P.configured=true;refresh();}}catch{}}
  if(P.ready&&uid()&&!P.busy&&Date.now()-P.at>60000)P.check();
 };
 P.render=function(){
  reset();if(!P.ready)return '';var d=P.data,lifetime=d&&d.lifetime,hidden=(ALL.journeyPrefs||{}).purchasePerkDismissed;
  if(hidden&&!lifetime&&!P.error)return '<div class="mb-actions"><button type="button" class="c3-link" data-purchase="check">Check purchase access</button></div>';
  var title=lifetime?'Lifetime access':native()?'Your account access':'Included with your purchase';
  var text=lifetime?'Included with your Formed Labs purchase. No app renewal or expiry.':native()?'Check the access already included with your Formed account.':'Your Formed Labs purchase includes lifetime formed fit access at no extra cost. Use the same email for checkout and your verified Formed account.';
  var status=P.busy?'Checking your access...':d&&!lifetime?(d.review?'Your purchase needs a linking review. Contact info@formedlabs.co from your verified checkout email.':'No purchase benefit is linked yet. Recent payments may take a few minutes to appear. If you used another email, sign in with that verified address.'):'';
  return '<section class="mb-purchase" aria-label="Purchase access"><h2>'+title+'</h2><p>'+text+'</p><p role="status">'+esc(status)+'</p>'+(P.error?'<p role="alert" class="mb-error">'+esc(P.error)+'</p>':'')+'<div class="mb-actions"><button type="button" class="c3-btn-quiet" data-purchase="check" '+(P.busy?'disabled':'')+'>'+(uid()?'Check my access':'Sign in to check access')+'</button>'+(!lifetime?'<button type="button" class="c3-link" data-purchase="dismiss">Dismiss</button>':'')+'</div>'+(!native()?'<details><summary>Purchase benefit details</summary><p>Applies to verified paid product orders from the offer start date. No minimum spend. A full order refund reverses that purchase benefit; partial refunds retain it while a paid balance remains. Another valid purchase or paid membership continues to provide its own access.</p><p>This benefit does not cancel an existing subscription. Review renewal settings with the provider that bills you. Store research-access requirements still apply.</p><button type="button" class="c3-link" data-go="you">Review membership and renewals</button></details>':'')+'</section>';
 };
 P.wire=function(root){root.querySelectorAll('[data-purchase]').forEach(function(b){b.addEventListener('click',function(){if(b.getAttribute('data-purchase')==='dismiss'){ALL.journeyPrefs=Object.assign({},ALL.journeyPrefs||{},{purchasePerkDismissed:true});if(C3.journey)C3.journey.deferSave('purchase-perk');else save();refresh();}else P.check();});});};
 var go=C3.go;C3.go=function(route){var r=go.apply(this,arguments);if(['member','shop'].includes(route))P.init();return r;};
 function refreshAccess(){try{if(!uid())return;if(native()&&window.formedRefreshNativeAccess)formedRefreshNativeAccess();else if(window.BILLING&&BILLING.web())BILLING.entitlement(true);}catch(e){}}
 try{CLOUD.onChange(function(){var before=P.owner;reset();if(before!==P.owner)refreshAccess();if(['member','shop'].includes(C3.current))P.init();});}catch(e){}
 document.addEventListener('visibilitychange',function(){if(!document.hidden){refreshAccess();if(['member','shop'].includes(C3.current))P.init();}});
})();
