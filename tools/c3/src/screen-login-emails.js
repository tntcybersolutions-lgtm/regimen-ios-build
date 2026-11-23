/* Device-local email shortcuts. Successful sessions add an address; passwords
   and reset codes never enter this store. Account authentication stays with CLOUD. */
(function(){
 'use strict';
 var C3=window.C3;if(!C3)return;
 var key='formed.loginEmails.v1',limit=5,queued=false;
 function valid(email){return typeof email==='string'&&email.length<=254&&/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email);}
 function list(){try{var rows=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(valid).map(function(e){return e.trim().toLowerCase();}).filter(function(e,i,a){return a.indexOf(e)===i;}).slice(0,limit):[];}catch(e){return [];}}
 function remember(email){email=String(email||'').trim().toLowerCase();if(!valid(email))return false;try{localStorage.setItem(key,JSON.stringify([email].concat(list().filter(function(e){return e!==email;})).slice(0,limit)));return true;}catch(e){return false;}}
 function clear(){try{localStorage.removeItem(key);}catch(e){}try{ACCT.emailDraft='';}catch(e){} }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;mount();});}
 function mount(){
  var input=document.getElementById('acEmail');if(!input)return;
  var up=typeof ACCT!=='undefined'&&ACCT.view==='signup',reset=typeof ACCT!=='undefined'&&ACCT.view==='forgot'&&!!ACCT.resetTo;
  input.autocomplete='username';input.name='username';input.setAttribute('autocapitalize','none');input.spellcheck=false;input.inputMode='email';input.setAttribute('enterkeyhint','next');
  var pass=document.getElementById('acPass');if(pass){pass.name='password';pass.autocomplete=up?'new-password':'current-password';pass.setAttribute('enterkeyhint','go');}
  if(!input._flEmailWired){
   input._flEmailWired=true;
   input.addEventListener('input',function(){try{ACCT.emailDraft=input.value;}catch(e){} });
   input.addEventListener('keydown',function(e){if(e.key==='Enter'&&pass){e.preventDefault();pass.focus();}});
  }
  var emails=list(),draft='';try{draft=ACCT.emailDraft||'';}catch(e){}
  if(!up&&!input.value)input.value=draft||emails[0]||'';
  var old=document.getElementById('flSavedEmails');
  if(up||reset||!emails.length){if(old)old.remove();return;}
  var fingerprint=emails.join('|');
  if(old&&old.dataset.emails===fingerprint){var existing=old.querySelector('select');existing.value=emails.indexOf(input.value.toLowerCase())>=0?input.value.toLowerCase():'';return;}
  if(old)old.remove();
  var box=document.createElement('div');box.id='flSavedEmails';box.dataset.emails=fingerprint;
  var label=document.createElement('label');label.htmlFor='flSavedEmailChoice';label.textContent='Use a saved email';
  var select=document.createElement('select');select.id='flSavedEmailChoice';select.dataset.sel='native';select.setAttribute('aria-label','Use a saved email');
  var prompt=document.createElement('option');prompt.value='';prompt.textContent='Choose a saved email';select.appendChild(prompt);
  emails.forEach(function(email){var option=document.createElement('option');option.value=email;option.textContent=email;select.appendChild(option);});
  select.value=emails.indexOf(input.value.toLowerCase())>=0?input.value.toLowerCase():'';
  select.addEventListener('change',function(){if(!select.value)return;input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));if(pass)pass.focus();else input.focus();});
  var forget=document.createElement('button');forget.type='button';forget.className='mini';forget.textContent='Forget saved emails';
  forget.addEventListener('click',function(){var current=input.value.toLowerCase();clear();if(emails.indexOf(current)>=0)input.value='';box.remove();input.focus();});
  var note=document.createElement('small');note.textContent='Saved on this device after sign-in.';
  box.append(label,select,forget,note);
  var fields=input.closest('.fields');if(fields)fields.before(box);else input.parentElement.before(box);
 }
 function session(){try{var u=CLOUD.user();if(u&&u.email){remember(u.email);ACCT.emailDraft='';}}catch(e){}schedule();}
 window.FL_LOGIN_EMAILS={list:list,remember:remember,clear:clear,mount:mount};
 if(typeof window.renderAccount==='function'){var original=window.renderAccount;window.renderAccount=function(){var result=original.apply(this,arguments);mount();return result;};}
 var host=document.getElementById('acctBody');if(host)new MutationObserver(schedule).observe(host,{childList:true,subtree:true});
 try{CLOUD.onChange(session);}catch(e){}session();
})();
