// Keep the existing record format; retain a private device copy for each login.
const profileCode = `
window.FL_PROFILE=(function(){
  const prefix='formed.profile.v1.', legacy='formed.profile.legacy';
  let prior;try{prior=+localStorage.getItem('theregimen.syncedAt')>0&&ALL.me&&ALL.me.id;}catch(e){}
  let current=String(ALL._ownerUid || (CLOUD.user()||{}).id || prior || 'guest');
  ALL._ownerUid=current;
  try{if(!localStorage.getItem(legacy))localStorage.setItem(legacy,current);}catch(e){}
  function db(base){let first;try{first=localStorage.getItem(legacy);}catch(e){}return first===current?base:base+'.'+encodeURIComponent(current);}
  function switchTo(id){
    const next=String(id||'guest');if(next===current)return;
    try{window.C3?.journey?.flushDrafts();}catch(e){}
    const original=serialise();
    // Never discard a device record if its backup cannot be written.
    localStorage.setItem(prefix+current,JSON.stringify(original));
    let incoming=null;const raw=localStorage.getItem(prefix+next);
    if(raw){incoming=JSON.parse(raw);if(!incoming||!Array.isArray(incoming.protocols))throw new Error('The saved profile could not be opened.');}
    if(!incoming&&current==='guest'&&next!=='guest'){
      incoming=original;localStorage.setItem('formed.profile.claimed',next);
      if(incoming.dailyGuides){for(const [key,value] of Object.entries(incoming.dailyGuides)){if(value&&value.owner==='guest'){const moved={...value,owner:next,updatedAt:Date.now()};incoming.dailyGuides[next+'|'+value.day]=moved;delete incoming.dailyGuides[key];}}}
      if(incoming.journeySetup?.onboarding?.owner==='guest')incoming.journeySetup.onboarding.owner=next;
      // The first account claims pre-login entries; the guest view becomes empty.
      const empty=wrapFlat(demoState());empty._ownerUid='guest';localStorage.setItem(prefix+'guest',JSON.stringify(empty));
      if(localStorage.getItem(legacy)==='guest')localStorage.setItem(legacy,next);
    }
    incoming=incoming||wrapFlat(demoState());incoming._ownerUid=next;
    localStorage.setItem(KEY,JSON.stringify({state:incoming,isDemo:false}));
    try{const def=window.C3&&C3.screens[C3.current];if(def&&def.leave)def.leave();}catch(e){}
    try{Object.assign(NUT,{goals:[],restrictions:[],preferences:[],target:null,profile:null,draft:null,phases:[],med:null,medSent:'',at:0,busy:false,err:'',msg:''});}catch(e){}
    try{Object.assign(PLAN,{cur:null,at:0,busy:false,err:'',msg:'',options:null,chosen:null});}catch(e){}
    try{Object.assign(TEAM,{cur:null,list:[],days:{},at:0,busy:false,err:'',msg:''});}catch(e){}
    try{CREW={id:null,code:null,name:'',owner:null,roster:[],feed:[],busy:false,msg:'',err:'',loaded:false};}catch(e){}
    try{Object.assign(COACH,{rows:[],busy:false,err:'',loaded:false});}catch(e){}
    try{Object.assign(CHUI,{list:[],board:[],busy:false,err:'',adding:false,draft:null,loaded:false});}catch(e){}
    ALL=incoming;current=next;isDemo=false;useProtocol(ALL.activeId);
    try{clearTimeout(SYNC.timer);clearTimeout(SYNC.retry);SYNC.at=0;SYNC.state='idle';SYNC.pending=false;localStorage.removeItem('theregimen.syncedAt');}catch(e){}
    try{PH.list=[];PHOTOS.releaseAll();}catch(e){}
    try{clearTimeout(_stowT);clearTimeout(_snapT);pushSnapshot();}catch(e){}
    try{syncMode();syncAllInputs();syncBodyInputs();drawAll();}catch(e){}
    queueMicrotask(()=>{try{if(window.C3&&C3.mounted)C3.go(C3.h.firstRun()?'welcome':'today');}catch(e){}});
  }
  if(current!==String((CLOUD.user()||{}).id||'guest'))switchTo((CLOUD.user()||{}).id);
  return {owner:()=>current,db,switchTo};
})();
`;

export function applyAccountIsolation(html) {
  html=html.replace("if(syncing)throw new Error('Your log is finishing a sync.","if(syncing && s?.userId)throw new Error('Your log is finishing a sync.");
  const patch=(a,b)=>{if(html.includes(b))return;if(!html.includes(a))throw new Error('Account isolation anchor missing: '+a.slice(0,70));html=html.replace(a,b);};
  html=html.replace(/\nwindow\.FL_PROFILE=\(function\(\)\{[\s\S]*?\n\}\)\(\);\n/, '');
  patch('ALL = load(); useProtocol(ALL.activeId);','ALL = load(); useProtocol(ALL.activeId);'+profileCode);
  patch('  function storeSession(s){\n    SESS = s;',`  function storeSession(s){
    if(window.FL_PROFILE && String(s?.userId||'guest')!==FL_PROFILE.owner()){
      if(syncing && s?.userId)throw new Error('Your log is finishing a sync. Please try signing in again in a moment.');
      FL_PROFILE.switchTo(s?.userId||null);
    }
    SESS = s;`);
  patch('const canSync = () => CLOUD_OK && CLOUD.signedIn() && !isDemo;',"const canSync = () => CLOUD_OK && CLOUD.signedIn() && !isDemo && (!window.FL_PROFILE || String(CLOUD.user()?.id)===FL_PROFILE.owner());");
  patch("      if(syncing)throw new Error('Your log is finishing a sync. Please try signing in again in a moment.');", "      if(syncing && s?.userId)throw new Error('Your log is finishing a sync. Please try signing in again in a moment.');");
  patch("    localStorage.setItem(KEY, JSON.stringify({state:serialise(), isDemo}));", "    const savedState=serialise();\n    if(window.FL_PROFILE){savedState._ownerUid=FL_PROFILE.owner();localStorage.setItem('formed.profile.v1.'+FL_PROFILE.owner(),JSON.stringify(savedState));}\n    localStorage.setItem(KEY, JSON.stringify({state:savedState, isDemo}));");
  patch("  if(!canSync()) return {ok:false, error:'Not signed in.'};\n  if(SYNC.state", "  if(!canSync()) return {ok:false, error:'Not signed in.'};\n  const syncOwner=CLOUD.user()?.id;\n  if(SYNC.state");
  patch("  if(r && r.ok){\n    if(r.state) adoptMerged(r.state);", "  if(CLOUD.user()?.id!==syncOwner){SYNC.state='idle';return {ok:false,error:'Account changed.'};}\n  if(r && r.ok){\n    if(r.state) adoptMerged(r.state);");
  patch("    if(!signedIn()) return {ok:false, error:'Not signed in.'};\n    if(syncing)","    if(!signedIn()) return {ok:false, error:'Not signed in.'};\n    if(window.FL_PROFILE && String(user()?.id)!==FL_PROFILE.owner())return {ok:false,error:'Account changed. Sign in again.'};\n    if(syncing)");
  // Both binary stores retain the original database for its original owner.
  for(const store of ['PHOTOS','FILESDB']){
    const start=html.indexOf('const '+store+' = (function(){'),end=html.indexOf('})();',start)+5;
    if(start<0||end<5)throw new Error('Missing binary store '+store);
    let section=html.slice(start,end);
    if(!section.includes('const selected = window.FL_PROFILE'))section=section.replace('    if(_db) return Promise.resolve(_db);',"    const selected = window.FL_PROFILE ? FL_PROFILE.db(DB) : DB;\n    if(_db && _db.name===selected) return Promise.resolve(_db);\n    if(_db){_db.close();_db=null;}").replace('indexedDB.open(DB, 1)','indexedDB.open(selected, 1)');
    html=html.slice(0,start)+section+html.slice(end);
  }
  patch("  async function add(file, meta){\n    if(!file)","  async function add(file, meta){\n    const photoOwner=window.FL_PROFILE?.owner();\n    if(!file)");
  patch("    const rec = {id:'ph_'", "    if(photoOwner!==window.FL_PROFILE?.owner())return {ok:false,error:'Account changed. Add the photo again.'};\n    const rec = {id:'ph_'");
  patch("      await CLOUD.signOut();\n      ACCT.view = 'signin';", "      await CLOUD.signOut();\n      ACCT.view = 'signin';");
  patch('Signed out. Everything you logged is still on this device.','Signed out. Your log is kept for this account on this device.');
  return html;
}
