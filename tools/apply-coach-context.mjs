// Guard account context across delayed coach/plan responses and persist explicit permissions.
export function applyCoachContext(html){
 function patch(a,b){if(html.includes(b))return;if(!html.includes(a))throw Error('Coach context boundary missing: '+a.slice(0,75));html=html.replace(a,b);}
 patch("['memoryPrefs', 'toolPrefs'].forEach", "['coachPermissions', 'memoryPrefs', 'toolPrefs'].forEach");
 patch("r.key === 'workoutLibrary' || r.key === 'journeyState'", "r.key === 'coachPermissions' || r.key === 'workoutLibrary' || r.key === 'journeyState'");
 patch("['memoryPrefs', 'toolPrefs', 'mealPrefs', 'mealPlan', 'pepPrefs', 'pepPlan'].forEach", "['coachPermissions', 'memoryPrefs', 'toolPrefs', 'mealPrefs', 'mealPlan', 'pepPrefs', 'pepPlan'].forEach");
 const helpers=`function formedAccountContext(){return {state:ALL,user:String((CLOUD.user()||{}).id||'')};}
function formedSameAccount(c){return c.state===ALL&&c.user===String((CLOUD.user()||{}).id||'')&&(!window.FL_PROFILE||FL_PROFILE.owner()===c.user);}
function formedAccountChanged(){return {ok:false,error:'Account changed. Reopen this account to review its saved result.'};}
`;
 if(!html.includes('function formedAccountContext()'))patch('async function planRefresh(){',helpers+'async function planRefresh(){');
 function replace(name,next,body){const start=html.indexOf('async function '+name+'('),end=html.indexOf('\n'+next,start);if(start<0||end<0)throw Error('Coach function boundary missing: '+name);html=html.slice(0,start)+body+'\n'+html.slice(end+1);}
 replace('planRefresh','function planToday()',`async function planRefresh(){
  if(!CLOUD_OK || !CLOUD.signedIn())return;const context=formedAccountContext();if(!formedSameAccount(context))return;
  const r=await CLOUD.planCurrent();if(!formedSameAccount(context))return;
  if(r.ok){PLAN.cur=r.plan;PLAN.at=Date.now();}
}`);
 replace('planRun','const SCENARIO_WORDS',`async function planRun(fn){
  const context=formedAccountContext();if(!formedSameAccount(context))return formedAccountChanged();
  PLAN.busy=true;PLAN.err='';PLAN.msg='Working...';renderWeekSheet();let r;
  try{r=await fn();}catch(e){r={ok:false,error:e.message||'That did not work.'};}
  if(!formedSameAccount(context))return formedAccountChanged();PLAN.busy=false;PLAN.err=r&&r.ok?'':r&&r.error||'That did not work.';PLAN.msg='';renderWeekSheet();return r;
}`);
 replace('teamRefresh','async function teamRun',`async function teamRefresh(){
  if(!CLOUD_OK||!CLOUD.signedIn())return;const context=formedAccountContext();if(!formedSameAccount(context))return;const yKey=dkey(Date.now()-DAY);
  try{const st=await CLOUD.dayStatuses(dkey(Date.now()-20*DAY),dkey(Date.now()));if(!formedSameAccount(context))return;if(st.ok){TEAM.days={};st.rows.forEach(r=>TEAM.days[r.local_date]=r.completeness);}}catch(e){}
  const l=await CLOUD.reviewsList();if(!formedSameAccount(context)||!l.ok)return;TEAM.list=l.list||[];const wk=isoWeekKey(Date.now()),has=TEAM.list.some(c=>c.trigger==='weekly'&&c.period===wk);
  if(!has&&teamReady()&&window.C3?.coachControls?.allows('reviews')){
    const r=await CLOUD.reviewRun('weekly',yKey);if(!formedSameAccount(context))return;
    if(r.ok&&r.review){TEAM.cur=r.review;TEAM.at=Date.now();const l2=await CLOUD.reviewsList();if(!formedSameAccount(context))return;if(l2.ok)TEAM.list=l2.list||[];try{renderTeamCard();coachTick(true);}catch(e){}return;}
  }
  if(TEAM.list.length){const g=await CLOUD.reviewGet(TEAM.list[0].id);if(!formedSameAccount(context))return;if(g.ok)TEAM.cur=g.review;}
  TEAM.at=Date.now();try{renderTeamCard();}catch(e){}
}`);
 replace('teamRun','/* The week as activate',`async function teamRun(fn){
  const context=formedAccountContext();if(!formedSameAccount(context))return formedAccountChanged();TEAM.busy=true;TEAM.err='';TEAM.msg='Working...';renderTeamSheet();let r;
  try{r=await fn();}catch(e){r={ok:false,error:e.message||'That did not work.'};}
  if(!formedSameAccount(context))return formedAccountChanged();TEAM.busy=false;TEAM.err=r&&r.ok?'':r&&r.error||'That did not work.';TEAM.msg='';renderTeamSheet();return r;
}`);
 // Keep the reviewed server decision logic; guard every delayed response before local application.
 patch("async function teamDecide(decision, reason){\n  const pr", "async function teamDecide(decision, reason){\n  const context=formedAccountContext();if(!formedSameAccount(context))return formedAccountChanged();const reviewId=TEAM.cur&&TEAM.cur.id;\n  const pr");
 patch("const r = await CLOUD.proposalDecide(pr.id, decision, days, reason || null, key);\n  if(!r.ok)","const r = await CLOUD.proposalDecide(pr.id, decision, days, reason || null, key);\n  if(!formedSameAccount(context))return formedAccountChanged();\n  if(!r.ok)");
 html=html.replace("try{ const ph = await CLOUD.phasesList(); if(!formedSameAccount(context))return formedAccountChanged(); if(ph.ok) NUT.phases = ph.list;","try{ const ph = await CLOUD.phasesList(); if(ph.ok) NUT.phases = ph.list;");
 patch("pr.action === 'phase_change'){ const ph = await CLOUD.phasesList(); if(ph.ok)","pr.action === 'phase_change'){ const ph = await CLOUD.phasesList(); if(!formedSameAccount(context))return formedAccountChanged(); if(ph.ok)");
 patch("if(days){ await planRefresh(); try{ renderFood(); }catch(e){} }", "if(days){ await planRefresh();if(!formedSameAccount(context))return formedAccountChanged(); try{ renderFood(); }catch(e){} }");
 patch("const g = await CLOUD.reviewGet(TEAM.cur.id); if(g.ok) TEAM.cur = g.review;", "const g = await CLOUD.reviewGet(reviewId);if(!formedSameAccount(context))return formedAccountChanged(); if(g.ok) TEAM.cur = g.review;");
 patch("const l = await CLOUD.reviewsList(); if(l.ok) TEAM.list = l.list || [];", "const l = await CLOUD.reviewsList();if(!formedSameAccount(context))return formedAccountChanged(); if(l.ok) TEAM.list = l.list || [];");
 patch("function coachTick(force){\n  const st", "function coachTick(force){\n  if(window.C3?.coachControls&&!C3.coachControls.allows('proactive'))return;\n  const st");
 patch("function coachMoment(kind){\n  const st", "function coachMoment(kind){\n  if(window.C3?.coachControls&&!C3.coachControls.allows('proactive'))return;\n  const st");
 patch("function brainAllowed(){\n  if(!coachPro())", "function brainAllowed(){\n  if(window.C3?.coachControls&&!C3.coachControls.allows('proactive'))return false;\n  if(!coachPro())");
 patch("await modelProbe(); if(!talkModelReady()) return;", "await modelProbe();if(reviewOwner&&!C3.memory.sameOwner(reviewOwner)||!brainAllowed())return; if(!talkModelReady()) return;");
 patch("const lines = {}; let presence = null;\n    for(const r of reads)", "if(reviewOwner&&!C3.memory.sameOwner(reviewOwner)||!brainAllowed())return;\n    const lines = {}; let presence = null;\n    for(const r of reads)");
 patch("async ()=>{ const r = await CLOUD.reviewRun('weekly', dkey(Date.now()-DAY)); if(r.ok){ TEAM.cur = r.review;", "async ()=>{const context=formedAccountContext(); const r = await CLOUD.reviewRun('weekly', dkey(Date.now()-DAY));if(!formedSameAccount(context))return formedAccountChanged(); if(r.ok){ TEAM.cur = r.review;");
 // Retired account responses cannot refill the freshly cleared server caches.
 function scoped(name,changes){const a=html.indexOf('async function '+name+'(');if(a<0)throw Error('Missing scoped loader '+name);const tail=html.slice(a),match=tail.slice(1).search(/\n(?:async )?function /),end=match<0?html.length:a+match+1;let part=html.slice(a,end);for(const [before,after]of changes){if(part.includes(after))continue;if(!part.includes(before))throw Error('Missing '+name+' loader boundary');part=part.replace(before,after);}html=html.slice(0,a)+part+html.slice(end);}
 scoped('crewLoad',[
  ["async function crewLoad(){","async function crewLoad(){\n  const context=formedAccountContext();"],
  ["const mine = await CLOUD.myCrews();","const mine = await CLOUD.myCrews();if(!formedSameAccount(context))return;"],
  ["const [rs, fd] = await Promise.all([CLOUD.roster(c.id), CLOUD.crewFeed(c.id)]);","const [rs, fd] = await Promise.all([CLOUD.roster(c.id), CLOUD.crewFeed(c.id)]);if(!formedSameAccount(context))return;"],
  ["  CREW.busy = false; CREW.loaded = true;","  if(!formedSameAccount(context))return;CREW.busy = false; CREW.loaded = true;"]
 ]);
 scoped('coachLoad',[
  ["async function coachLoad(){","async function coachLoad(){\n  const context=formedAccountContext();"],
  ["COACH.rows = await CLOUD.compliance(CREW.id) || [];","const coachingRows=await CLOUD.compliance(CREW.id);if(!formedSameAccount(context))return;COACH.rows=coachingRows||[];"],
  ["}catch(e){ COACH.err =", "}catch(e){if(!formedSameAccount(context))return; COACH.err ="]
 ]);
 scoped('challengeRefresh',[
  ["async function challengeRefresh(){","async function challengeRefresh(){\n  const context=formedAccountContext();"],
  ["CHUI.list = await CLOUD.challenges(CREW.id);", "const list=await CLOUD.challenges(CREW.id);if(!formedSameAccount(context))return;CHUI.list=list;"],
  ["CHUI.board = await CLOUD.challengeBoard(CREW.id);", "const board=await CLOUD.challengeBoard(CREW.id);if(!formedSameAccount(context))return;CHUI.board=board;"],
  ["}catch(e){ CHUI.err =", "}catch(e){if(!formedSameAccount(context))return; CHUI.err ="]
 ]);
 scoped('nutRefresh',[
  ["async function nutRefresh(){","async function nutRefresh(){\n  const context=formedAccountContext();"],
  ["const r = await CLOUD.nutLoad();", "const r = await CLOUD.nutLoad();if(!formedSameAccount(context))return;"],
  ["const r2 = await CLOUD.nutLoad(); if(r2.ok)", "const r2 = await CLOUD.nutLoad();if(!formedSameAccount(context))return; if(r2.ok)"],
  ["const ph = await CLOUD.phasesList(); if(ph.ok)", "const ph = await CLOUD.phasesList();if(!formedSameAccount(context))return; if(ph.ok)"]
 ]);
 return html;
}
