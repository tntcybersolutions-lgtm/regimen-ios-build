/* The same save receipt in the header and its accessible detail screen. */
(function(){
 'use strict';var C3=window.C3;if(!C3)return;
 var h=C3.h,esc=h.esc;
 function status(){
  var local=typeof saveOk==='function'&&saveOk();
  if(!local)return {k:'err',w:'Not saved on this device',detail:'Keep the app open. Retry saving, or export your records before closing.',action:'device',button:'Retry device save'};
  var signed=false;try{signed=canSync();}catch(e){}
  if(!signed)return {k:'off',w:'Saved on this device',detail:'Sign in to keep an account copy and sync across your devices.',action:'signin',button:'Sign in to sync'};
  if(SYNC.state==='error')return {k:'err',w:'Saved on device · Retry sync',detail:SYNC.err||'Your account copy is not up to date. Your device copy is kept.',action:'sync',button:'Retry sync now'};
  if(navigator.onLine===false)return {k:'off',w:'Saved on device · Offline',detail:'Your changes stay on this device. Reconnect, then sync your account.',action:'sync',button:'Try syncing again'};
  if(SYNC.state==='busy')return {k:'busy',w:'Saved on device · Syncing',detail:'Your device copy is kept while your account is updated. You can keep using the app.',action:'busy',button:'Syncing'};
  if(!SYNC.auto)return {k:'off',w:'Saved on device · Auto sync off',detail:'Automatic sync is off. Sync now to send the latest saved records to your account.',action:'sync',button:'Sync now'};
  if(SYNC.pending||SYNC.dirty)return {k:'busy',w:'Saved on device · Waiting to sync',detail:'Your latest edits are saved here and are waiting for your account sync.',action:'sync',button:'Sync now'};
  if(!SYNC.at)return {k:'off',w:'Saved on device · Not synced yet',detail:'Your device copy is kept. Complete a sync to update your account.',action:'sync',button:'Sync now'};
  return {k:'ok',w:'Synced at '+new Date(SYNC.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),detail:'The last completed sync includes the current saved records. New edits are saved on this device first.',action:'sync',button:'Sync again'};
 }
 C3.saveStatus=status;
 var paint=C3.syncPaint,lastReceipt='';
 C3.syncPaint=function(){if(paint)paint.apply(C3,arguments);if(C3.current==='save-status'){var key=JSON.stringify(status());if(key!==lastReceipt){lastReceipt=key;C3.refresh();}}};
 (C3.ydq=C3.ydq||[]).push(function(yd){yd.screen('save-status',{nav:'you',parent:'you',render:function(){var s=status();return '<div class="sv-page"><button type="button" class="yd-back" data-go="you" aria-label="Back to You">'+h.icon('back',18,2.8)+'<span>You</span></button><p class="c3-eyebrow">Your records</p><h1 class="c3-h1">Save &amp; sync</h1><p class="sv-state" role="status" aria-live="polite">'+esc(s.w)+'</p><p class="sv-detail">'+esc(s.detail)+'</p><div class="sv-actions"><button type="button" class="c3-btn-primary" data-save-action="'+s.action+'" '+(s.action==='busy'?'disabled':'')+'><span>'+esc(s.button)+'</span>'+h.icon('arrow',30)+'</button><button type="button" class="c3-btn-quiet" data-go="today">Continue my day</button></div><p class="sv-detail">Changing accounts opens that account’s own records. Sign out only after your device has saved successfully.</p><button type="button" class="c3-link" data-go="data">Export or restore a device file</button></div>';},wire:function(root){var b=root.querySelector('[data-save-action]');b.addEventListener('click',async function(){var a=b.getAttribute('data-save-action');if(a==='device'){save();C3.render();}else if(a==='signin')h.openSignIn();else if(a==='sync'){b.disabled=true;try{await runSync('save-status');}finally{if(C3.current==='save-status')C3.render();}}});}});});
 if(C3.yd&&C3.yd.drain)C3.yd.drain();
})();
