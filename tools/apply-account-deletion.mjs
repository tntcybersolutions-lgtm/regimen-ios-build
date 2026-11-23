// Account deletion is unavailable until the tested revoke-and-erase DB RPC is installed.
function baseDeletion(html){
 if(html.includes('/* full-account-deletion-v2 */'))return html.replace('Cancel subscriptions with Apple or your billing provider first. Deletion does not cancel a subscription.','Billing continues after account deletion unless you cancel. Please cancel with Apple or your billing provider first. You can still delete your account now. <a href="https://apps.apple.com/account/subscriptions/" target="_blank" rel="noopener">Manage Apple subscriptions</a>.').replace('This permanently erases personal data from connected FORMED services and deletes your shared sign-in, including fit, crossword and plans.','This permanently erases your fit data and personal data from connected services we can reach, and deletes your shared FORMED sign-in. You will lose access to fit, crossword and plans.').replace('Only order and billing records required by law are retained.','Order and billing records are kept without personal details for seven years.');
 if(html.includes('/* full-account-deletion-v1 */'))return html.replace('/* full-account-deletion-v1 */','/* full-account-deletion-v2 */').replace('This permanently erases your fit records and deletes your shared FORMED sign-in, including access to the crossword and plans. It cannot be undone. Deleting your account does not cancel an App Store subscription. Cancel it in Apple subscription settings first.','This permanently erases your fit data and personal data from connected services we can reach, and deletes your shared FORMED sign-in. You will lose access to fit, crossword and plans. Order and billing records are kept without personal details for seven years. It cannot be undone. Billing continues after account deletion unless you cancel. Please cancel with Apple or your billing provider first. You can still delete your account now. <a href="https://apps.apple.com/account/subscriptions/" target="_blank" rel="noopener">Manage Apple subscriptions</a>.').replace("? 'Your fit records and shared FORMED sign-in were deleted.'","? (r.deviceCleanup===false?'Your account was deleted. Clear this site data to remove a remaining device copy.':'Your personal records and shared FORMED sign-in were deleted.')");
 const patch=(a,b)=>{if(!html.includes(a))throw Error('Account deletion anchor missing: '+a.slice(0,80));html=html.replace(a,b);};
 const a=html.indexOf('  async function deleteAccount(){'),b=html.indexOf('\n  /* ============================================================',a);
 if(a<0||b<0)throw Error('Missing delete function boundary');
 html=html.slice(0,a)+`  /* full-account-deletion-v2 */
  let deletingAccount=false;
  async function deleteAccount(password){
    if(!signedIn())return {ok:false,error:'Sign in first.'};
    if(syncing || deletingAccount)return {ok:false,error:'Wait for the current save to finish, then try again.'};
    deletingAccount=true;
    const owner=user().id;
    const priorAuto=typeof SYNC!=='undefined'?SYNC.auto:false;
    try{
      if(typeof SYNC!=='undefined'){SYNC.auto=false;clearTimeout(SYNC.timer);clearTimeout(SYNC.retry);}
      const tok=await token();
      const response=await sess('delete_account',{password,confirm:'DELETE SHARED FORMED ACCOUNT'},tok);
      if(!response.ok||!response.body?.loginGone)return {ok:false,error:authErr(response)};
      // Empty the active object before signout can back it up under this UUID.
      if(typeof ALL!=='undefined'){ALL=wrapFlat(demoState());ALL._ownerUid=owner;useProtocol(ALL.activeId);}
      let deviceCleanup=true;
      try{if(typeof PHOTOS!=='undefined'){const cleared=await PHOTOS.clear();if(!cleared.ok)deviceCleanup=false;PHOTOS.releaseAll();}if(typeof FILESDB!=='undefined'){clearTimeout(_stowT);for(const id of await FILESDB.keys())await FILESDB.del(id);}}catch(e){deviceCleanup=false;}
      storeSession(null);
      try{
        for(const key of Object.keys(localStorage))if(key.includes(owner))localStorage.removeItem(key);
        localStorage.removeItem('theregimen.syncedAt');localStorage.removeItem('theregimen.billing.ent');
        if(localStorage.getItem('formed.profile.legacy')===owner)localStorage.removeItem('formed.profile.legacy');
        if(localStorage.getItem('formed.profile.claimed')===owner)localStorage.removeItem('formed.profile.claimed');
      }catch(e){return {ok:false,error:'Your account is deleted. Clear this site data to remove the remaining device copy.'};}
      return {ok:true,loginGone:true,deviceCleanup};
    }finally{deletingAccount=false;if(signedIn()&&typeof SYNC!=='undefined')SYNC.auto=priorAuto;}
  }
`+html.slice(b);
 patch('async function runSync(why){',"async function runSync(why){\n  if(window.FL_ACCOUNT_DELETING)return {ok:false,error:'Account deletion is in progress.'};");
 patch("'<button type=\"button\" class=\"flac-word danger\" id=\"acDel\">Delete my account</button>'", "'<label for=\"acDeletePassword\">Current password to confirm deletion</label><input id=\"acDeletePassword\" type=\"password\" autocomplete=\"current-password\"><label><input id=\"acDeleteConfirm\" type=\"checkbox\"> I understand this permanently deletes my shared FORMED account.</label>' +\n            '<button type=\"button\" class=\"flac-word danger\" id=\"acDel\">Delete my account</button>'");
 patch('Deleting your account removes every dose, weigh-in, session and note from the server for good. What is on this device stays until you clear it.', 'This permanently erases your fit data and personal data from connected services we can reach, and deletes your shared FORMED sign-in. You will lose access to fit, crossword and plans. Order and billing records are kept without personal details for seven years. It cannot be undone. Billing continues after account deletion unless you cancel. Please cancel with Apple or your billing provider first. You can still delete your account now. <a href="https://apps.apple.com/account/subscriptions/" target="_blank" rel="noopener">Manage Apple subscriptions</a>.');
 patch("acArm('acDel', 'Tap again to delete for good', async ()=>{", "$('acDeleteConfirm').addEventListener('change',e=>{ACCT.deleteConfirmed=e.target.checked;ACCT.deleteOwner=CLOUD.user()?.id;});\n    $('acDeletePassword').addEventListener('input',e=>{ACCT.deletePassword=e.target.value;ACCT.deleteOwner=CLOUD.user()?.id;});\n    $('acDel').addEventListener('click',async ()=>{\n      if(!ACCT.deleteConfirmed||ACCT.deleteOwner!==CLOUD.user()?.id){acctSay('Confirm that you want to delete the shared account.','');return;}");
 patch('const r = await acctRun(()=>CLOUD.deleteAccount());', "window.FL_ACCOUNT_DELETING=true;\n      let r;try{r=await acctRun(()=>CLOUD.deleteAccount(ACCT.deletePassword||''));}finally{window.FL_ACCOUNT_DELETING=false;delete ACCT.deletePassword;delete ACCT.deleteConfirmed;delete ACCT.deleteOwner;}");
 patch('Account and all its data deleted. This device still has its own copy.', 'Your personal records and shared FORMED sign-in were deleted.');
 html=html.replace("? 'Your personal records and shared FORMED sign-in were deleted.'","? (r.deviceCleanup===false?'Your account was deleted. Clear this site data to remove a remaining device copy.':'Your personal records and shared FORMED sign-in were deleted.')");
 return html;
}

export function applyAccountDeletion(html){
 html=baseDeletion(html);
 if(html.includes('/* delete-otp-v1 */'))return html;
 html=html.replace('deleteAccount, DELETE_TABLES,','sendDeletionCode:async()=>{const r=await sess(\'delete_code_send\',{},await token());return {ok:r.ok,error:authErr(r)};},deleteAccount, DELETE_TABLES,');
 html=html.replace('async function deleteAccount(password){','/* delete-otp-v1 */\n  async function deleteAccount(password,code){');
 html=html.replace("{password,confirm:'DELETE SHARED FORMED ACCOUNT'}","{password,code,confirm:'DELETE SHARED FORMED ACCOUNT'}");
 html=html.replace('<label for="acDeletePassword">Current password to confirm deletion</label><input id="acDeletePassword" type="password" autocomplete="current-password">','<label for="acDeletePassword">Confirm with your password or an email code</label><input id="acDeletePassword" type="password" autocomplete="current-password" placeholder="Current password"><button type="button" id="acDeleteSendCode">Email me a deletion code</button><input id="acDeleteCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Deletion email code" placeholder="6-digit email code">');
 html=html.replace("$('acDeleteConfirm').addEventListener", "$('acDeleteSendCode').addEventListener('click',async()=>{const r=await CLOUD.sendDeletionCode();acctSay(r.ok?'A code was sent to the email on this account.':'Could not send a code. Try again.','');});\n    $('acDeleteCode').addEventListener('input',e=>{ACCT.deleteCode=e.target.value;ACCT.deleteOwner=CLOUD.user()?.id;});\n    $('acDeleteConfirm').addEventListener");
 html=html.replace("CLOUD.deleteAccount(ACCT.deletePassword||'')","CLOUD.deleteAccount(ACCT.deletePassword||'',ACCT.deleteCode||'')").replace('delete ACCT.deletePassword;','delete ACCT.deletePassword;delete ACCT.deleteCode;');
 html=html.replace('It cannot be undone. Billing continues','If you own a shared group, ownership passes to its longest-standing remaining member. Empty groups are deleted. It cannot be undone. Billing continues');
 return html;
}
