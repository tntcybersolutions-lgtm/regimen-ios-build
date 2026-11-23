// Preserve the legacy app and extend its existing private preference transport.
export function applyLockedExperience(html){
  // Replace the generated journey merge as a whole when this extension is updated.
  html=html.replace(/      if\(R\.journeyState[\s\S]*?(?=      if\(R\.readyRecords)/g,'');
  html=html.replace("coachTone:({off:'direct',playful:'supportive',loud:'sassy'})[d],at:Date.now()", "coachTone:({off:'direct',playful:'supportive',loud:'sassy'})[d],coachToneAt:Date.now(),at:Date.now()");
  function patch(before,after){
    if(html.includes(after))return;
    if(!html.includes(before))throw Error('Locked experience source boundary missing: '+before.slice(0,90));
    html=html.replace(before,after);
  }
  patch("    const coach=ALL.coach||{};", "    if(ALL.dailyGuides || ALL.journeyPrefs || ALL.journeySetup) out.push({kind:'pref',key:'journeyState',at:iso(Date.now()),data:{guides:ALL.dailyGuides||{},prefs:ALL.journeyPrefs||{},setup:ALL.journeySetup||null},updated_at:iso(Date.now())});\n    const coach=ALL.coach||{};");
  patch("r.key === 'readyRecords' || r.key === 'coachPrefs'", "r.key === 'journeyState' || r.key === 'readyRecords' || r.key === 'coachPrefs'");
  patch("      if(R.readyRecords || local.ready || local.readyRemoved){", `      if(R.journeyState || local.dailyGuides || local.journeyPrefs || local.journeySetup){
        const j=R.journeyState||{},guides={...(j.guides||{})};
        const stamp=x=>Math.max(+x?.updatedAt||0,+x?.at||0);
        for(const [k,v] of Object.entries(local.dailyGuides||{}))if(!guides[k]||stamp(v)>=stamp(guides[k]))guides[k]=v;
        out.dailyGuides=guides;
        const a=j.prefs,b=local.journeyPrefs;
        out.journeyPrefs={...(a&&(!b||stamp(a)>stamp(b))?a:(b||{}))};
        const union=(a,b)=>{const map={...(a||{})};for(const [k,v] of Object.entries(b||{}))if(!map[k]||stamp(v)>=stamp(map[k]))map[k]=v;return map;};
        if(a?.groceryLists||b?.groceryLists)out.journeyPrefs.groceryLists=union(a?.groceryLists,b?.groceryLists);
        for(const [field,clock] of [['mode','modeAt'],['coachTone','coachToneAt']]){const ca=+(a?.[clock]||a?.at)||0,cb=+(b?.[clock]||b?.at)||0;const winner=a?.[field]!=null&&(!b||b[field]==null||ca>cb)?a:b;if(winner?.[field]!=null){out.journeyPrefs[field]=winner[field];out.journeyPrefs[clock]=winner[clock]||winner.at||0;}}
        const sa=j.setup,sb=local.journeySetup;
        if(sa||sb){out.journeySetup={...(sa&&(!sb||stamp(sa)>stamp(sb))?sa:sb)};out.journeySetup.groceryDrafts=union(sa?.groceryDrafts,sb?.groceryDrafts);out.journeySetup.compoundDrafts=union(sa?.compoundDrafts,sb?.compoundDrafts);out.journeySetup.injuryDrafts=union(sa?.injuryDrafts,sb?.injuryDrafts);out.journeySetup.trainerDrafts=union(sa?.trainerDrafts,sb?.trainerDrafts);for(const field of ['roomDraft','onboarding','addCompoundDraft','nameDraft','reminderDraft']){const a=sa?.[field],b=sb?.[field];if(a||b)out.journeySetup[field]=a&&(!b||stamp(a)>stamp(b))?a:b;}}
      }
      if(R.readyRecords || local.ready || local.readyRemoved){`);
  patch("? (ONB.focus === 'track' ? ['hello','who'] : ['hello','goal','train','who'])", "? (ONB.focus === 'track' ? ['hello','who'] : ['hello','goal','train','who','food'])");
  patch("  enhanceNumbers(B); enhanceSelects(B);\n  B.scrollTop = 0;", `  if(here==='train' && window.C3?.journey?.onboarding)C3.journey.onboarding(B,ONB);
  enhanceNumbers(B); enhanceSelects(B);
  B.scrollTop = 0;`);
  patch("  ALL.prefs = {why:ONB.why.slice()", "  ALL.train.sessionMinutes=+ONB.sessionMinutes||60;\n  if(Array.isArray(ONB.weekDays)&&ONB.weekDays.length===ONB.days)ALL.train.preferredDays=ONB.weekDays.slice();\n  ALL.prefs = {why:ONB.why.slice()");
  patch("  return applyOverrides(applyPrefs(wk), Math.max(0, weekIndex | 0));", "  if(window.C3?.journey?.fitWeek)wk=C3.journey.fitWeek(wk,o,p);\n  return applyOverrides(applyPrefs(wk), Math.max(0, weekIndex | 0));");
  patch("  return COACH_RULES+'\\n\\nWHO YOU ARE:\\n'+coach.name", "  const preferredTone=({direct:'Direct and concise. Use straightforward language.',supportive:'Supportive and practical. Explain the next action clearly.',sassy:'Playful and energetic when appropriate. Keep sensitive topics straightforward.'})[(ALL.journeyPrefs||{}).coachTone]||'';\n  return COACH_RULES+'\\n'+preferredTone+'\\n\\nWHO YOU ARE:\\n'+coach.name");
  patch("  const S = ALL.shay = ALL.shay || {};\n  if(['off', 'playful', 'loud'].indexOf(S.dial)", "  const S = ALL.shay = ALL.shay || {};\n  const tone=(ALL.journeyPrefs||{}).coachTone;if(tone)S.dial=({direct:'off',supportive:'playful',sassy:'loud'})[tone]||S.dial;\n  if(['off', 'playful', 'loud'].indexOf(S.dial)");
  patch("S.dial = d; try{ save(); }catch(e){} }", "S.dial = d; ALL.journeyPrefs=Object.assign({},ALL.journeyPrefs||{},{coachTone:({off:'direct',playful:'supportive',loud:'sassy'})[d],coachToneAt:Date.now(),at:Date.now()}); try{ save(); }catch(e){} }");
  patch("RDUI.draft[it.k] = (seed && +seed[it.k] >= 1) ? +seed[it.k] : 4;", "RDUI.draft[it.k] = (seed && +seed[it.k] >= 1) ? +seed[it.k] : null;");
  patch("function mpLoad(){\n  if(MP.lib) return Promise.resolve(MP.lib);\n  if(!MP.p) MP.p = fetch('brain/meals/library.json?v=' + MP_LIB_V).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){\n    if(j && Array.isArray(j.recipes) && j.recipes.length){\n      MP.lib = j; MP.by = {}; j.recipes.forEach(function(r){ MP.by[r.id] = r; });\n      try{ if(mpEnsure()) { try{ if(typeof drawAll === 'function') drawAll(); }catch(e){} } }catch(e){ console.warn('[planner]', e); }\n    } else MP.p = null;\n    return MP.lib;\n  }).catch(function(){ MP.p = null; return null; });\n  return MP.p;\n}", "function mpLoad(){\n  if(MP.lib) return Promise.resolve(MP.lib);\n  if(MP.p) return MP.p;\n  MP.failed=false;var abort=new AbortController(),timer=setTimeout(function(){abort.abort();},10000);\n  MP.p=fetch('brain/meals/library.json?v='+MP_LIB_V,{signal:abort.signal}).then(function(r){if(!r.ok)throw Error('Meal library unavailable');return r.json();}).then(function(j){\n    if(!j||!Array.isArray(j.recipes)||!j.recipes.length)throw Error('Meal library unavailable');\n    MP.lib=j;MP.by={};j.recipes.forEach(function(r){MP.by[r.id]=r;});\n    try{mpEnsure();}catch(e){console.warn('[planner]',e);}\n    return MP.lib;\n  }).catch(function(){MP.failed=true;return null;}).finally(function(){\n    clearTimeout(timer);if(!MP.lib)MP.p=null;\n    try{if(typeof drawAll==='function')drawAll();if(window.C3)C3.refresh();}catch(e){}\n  });\n  return MP.p;\n}");
  // Adjacent source extensions share this anchor. Keep exactly one transport row per key.
  const prefSeen=new Set();
  html=html.replace(/^    if\([^\n]*out\.push\(\{kind:'pref',key:'(readyRecords|journeyState)'[^\n]*\n/gm,function(line,key){if(prefSeen.has(key))return '';prefSeen.add(key);return line;});
  return html;
}
