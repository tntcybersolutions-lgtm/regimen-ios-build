/* Safety controls are account-bound and confirmed only by the server.
   Reporting and blocking never use browser dialogs (window.prompt is dead on the phone app):
   the control opens an inline panel, the person reviews it, and the server confirms. */
(function(){
 'use strict';var C3=window.C3;if(!C3)return;var esc=C3.h.esc;
 var S=C3.safety={owner:'',blocked:[],hidden:[],busy:false,error:'',message:'',loaded:false,panel:null};
 function uid(){try{return String(CLOUD.user().id||'');}catch(e){return '';}}
 function reset(){if(S.owner===uid())return;Object.assign(S,{owner:uid(),blocked:[],hidden:[],busy:false,error:'',message:'',loaded:false,panel:null});}
 async function call(action,data){reset();if(!uid()||S.busy)return false;var who=uid();S.busy=true;S.error='';
 try{var token=await CLOUD.token(),base=/^https?:$/.test(location.protocol)?'':'https://app.formedlabs.co';var r=await fetch(base+'/api/safety',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action},data||{})),signal:AbortSignal.timeout(15000)}),j=await r.json();if(who!==uid())return false;if(!r.ok||!j.ok)throw Error(j.error||'Nothing confirmed saved. Retry.');S.blocked=j.blocked||[];S.hidden=j.hidden||[];S.loaded=true;S.message=action==='report'?'Report recorded. Reference: '+j.report_id:action==='block'?'Member blocked. Their content is hidden.':action==='unblock'?'Member unblocked.':'';return true;
 }catch(e){if(who===uid())S.error=e.message||'Could not save. Retry or contact info@formedlabs.co.';return false;}finally{if(who===uid()){S.busy=false;C3.refresh();}}}
 S.call=call;S.visible=function(id){reset();return S.hidden.indexOf(String(id))<0;};
 function key(surface,context,member,content){return surface+'|'+context+'|'+member+'|'+(content||'');}
 S.controls=function(surface,context,member,content,snapshot){if(!member||member===uid())return '';
  var k=key(surface,context,member,content);
  if(S.panel&&S.panel.k===k){
   if(S.panel.kind==='report')return '<div class="ti-actions sf-panel"><label class="sf-reason"><span>What should formed fit review?</span><textarea data-safety-reason maxlength="1000" rows="3" placeholder="Say what happened. Do not include private health information.">'+esc(S.panel.draft||'')+'</textarea></label><div class="sf-acts"><button type="button" class="c3-btn-quiet" data-safety="send-report"'+(S.busy?' disabled':'')+'>Send report</button><button type="button" class="c3-link" data-safety="cancel">Cancel</button></div></div>';
   return '<div class="ti-actions sf-panel"><p>Block this member? Their content is hidden from you, and direct messages and workout proposals are blocked. They are not told.</p><div class="sf-acts"><button type="button" class="c3-btn-quiet" data-safety="confirm-block"'+(S.busy?' disabled':'')+'>Block member</button><button type="button" class="c3-link" data-safety="cancel">Cancel</button></div></div>';
  }
  return '<div class="ti-actions"><button type="button" class="c3-link" data-safety="report" data-skey="'+esc(k)+'" data-surface="'+esc(surface)+'" data-context="'+esc(context)+'" data-member="'+esc(member)+'" data-content="'+esc(content||'')+'" data-snapshot="'+esc(String(snapshot||'').slice(0,3000))+'">Report content or member</button><button type="button" class="c3-link" data-safety="block" data-skey="'+esc(k)+'" data-member="'+esc(member)+'">Block member</button></div>';};
 S.note=function(){if(C3.current==='safety')return '';return '<p class="sf-mini">Harassment, threats and objectionable content are not allowed. Use Report or Block on any member. <button type="button" class="c3-link" data-go="safety">Safety and blocked members</button></p>';};
 S.wire=function(root){root.querySelectorAll('[data-safety]').forEach(function(b){b.addEventListener('click',function(){if(S.busy)return;var a=b.getAttribute('data-safety'),id=b.getAttribute('data-member');
  if(a==='cancel'){S.panel=null;C3.refresh();return;}
  if(a==='block'){S.panel={kind:'block',k:b.getAttribute('data-skey'),member:id};C3.refresh();return;}
  if(a==='report'){S.panel={kind:'report',k:b.getAttribute('data-skey'),member:id,surface:b.getAttribute('data-surface'),context:b.getAttribute('data-context'),content:b.getAttribute('data-content'),snapshot:b.getAttribute('data-snapshot'),draft:''};C3.refresh();return;}
  if(a==='confirm-block'){var pb=S.panel;S.panel=null;if(pb)call('block',{target_user_id:pb.member});return;}
  if(a==='send-report'){var pr=S.panel,ta=root.querySelector('[data-safety-reason]'),reason=ta?ta.value.trim():'';if(!reason){S.error='Add a short reason so the review team knows what to look at.';C3.refresh();return;}S.panel=null;if(pr)call('report',{request_id:C3.member.key(),target_user_id:pr.member,surface:pr.surface,context_id:pr.context,content_id:pr.content,snapshot:pr.snapshot,reason:reason.slice(0,1000)});return;}
  if(a==='unblock'){call('unblock',{target_user_id:id});return;}});});
  var ta=root.querySelector('[data-safety-reason]');if(ta&&S.panel)ta.addEventListener('input',function(){if(S.panel)S.panel.draft=ta.value;});};
 S.status=function(){reset();var t=S.busy?'Saving safety choice...':S.error||S.message;if(!t)return '';return '<p role="status" class="'+(S.error?'yd-note bad sf-status':'sf-status')+'">'+esc(t)+'</p>';};
 C3.screen('safety',{nav:'you',enter:function(){call('get');},render:function(){reset();
  var signed=!!uid();
  var top='<div class="sf"><button type="button" class="yd-back" data-go="you" aria-label="Back to You">'+C3.h.icon('back',18,2.8)+'<span>You</span></button><div class="c3-eyebrow"><i></i>Your account</div><h1 class="c3-h1">Safety</h1><p>Control what reaches you. Report content or block a member from your crew, a Together room or the coaching inbox. Reports go to the formed fit review team. You can also email <a href="mailto:info@formedlabs.co">info@formedlabs.co</a>.</p>';
  if(!signed)return top+'<p class="yd-empty">Sign in to manage reports and blocked members.</p><button type="button" class="c3-btn-rail sf-sign" data-safety-signin><span>Sign in</span>'+C3.h.icon('arrow',24,2.8)+'</button></div>';
  var list=!S.loaded?'<p class="yd-empty">Loading your blocked members...</p>':S.blocked.length?'<ul class="sf-list">'+S.blocked.map(function(id){return '<li><div><b>Member '+esc(id.slice(0,8))+'</b><small>Blocked by you. Their content is hidden and they cannot message you.</small></div><button type="button" class="c3-btn-quiet" data-safety="unblock" data-member="'+esc(id)+'"'+(S.busy?' disabled':'')+'>Unblock</button></li>';}).join('')+'</ul>':'<p class="yd-empty">No blocked members. Nothing is hidden from you right now.</p>';
  return top+S.status()+'<section class="sf-sec"><h2>Blocked members</h2>'+list+'</section><section class="sf-sec"><h2>How it works</h2><p>Blocking hides a member\u2019s messages, activity and workout proposals from you and stops direct contact between you. They are not told, and unblocking restores everything. Reporting sends the content and your note to the review team; it never changes your plan or your log.</p></section></div>';},
  wire:function(root,ctx){S.wire(root);var b=root.querySelector('[data-safety-signin]');if(b)b.addEventListener('click',function(){C3.h.openSignIn();});}});
})();
