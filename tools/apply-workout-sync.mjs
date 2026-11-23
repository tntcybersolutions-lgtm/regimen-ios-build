// Extend the existing account-private transport; no second identity or public profile fields.
export function applyWorkoutSync(html){
 function patch(before,after){if(html.includes(after))return;if(!html.includes(before))throw Error('Workout sync boundary missing: '+before.slice(0,70));html=html.replace(before,after);}
 let seenLibrary=false;html=html.replace(/^    if\(ALL\.workouts \|\| ALL\.workoutsRemoved\) out\.push\([^\n]*\n/gm,line=>{if(seenLibrary)return '';seenLibrary=true;return line;});
 if(!seenLibrary)patch("    const coach=ALL.coach||{};", "    if(ALL.workouts || ALL.workoutsRemoved) out.push({kind:'pref',key:'workoutLibrary',at:iso(Date.now()),data:{list:ALL.workouts||[],removed:ALL.workoutsRemoved||{}},updated_at:iso(Date.now())});\n    const coach=ALL.coach||{};");
 patch("r.key === 'journeyState' || r.key === 'readyRecords'", "r.key === 'workoutLibrary' || r.key === 'journeyState' || r.key === 'readyRecords'");
 patch("      if(R.readyRecords || local.ready || local.readyRemoved){", `      if(R.workoutLibrary || local.workouts || local.workoutsRemoved){
        const r=R.workoutLibrary||{},removed={...(r.removed||{})},items=new Map();
        Object.entries(local.workoutsRemoved||{}).forEach(([k,v])=>removed[k]=Math.max(+removed[k]||0,+v||0));
        for(const w of [...(r.list||[]),...(local.workouts||[])])if(w&&w.id){const prior=items.get(w.id);if(!prior||(+w.updatedAt||+w.createdAt||0)>=(+prior.updatedAt||+prior.createdAt||0))items.set(w.id,w);}
        out.workouts=Array.from(items.values()).filter(w=>!removed[w.id]||(+w.updatedAt||+w.createdAt||0)>removed[w.id]);out.workoutsRemoved=removed;
      }
      if(R.readyRecords || local.ready || local.readyRemoved){`);
 patch("w.updatedAt = Date.now(); if(i >= 0) list[i] = w;", "w.updatedAt = Math.max(Date.now(),+(ALL.workoutsRemoved||{})[w.id]+1||0); if(ALL.workoutsRemoved)delete ALL.workoutsRemoved[w.id]; if(i >= 0) list[i] = w;");
 patch("if(i >= 0) workouts().splice(i, 1); save(); closeSheet(); renderWorkoutsCard(); offerUndo", "if(i >= 0) workouts().splice(i, 1); (ALL.workoutsRemoved=ALL.workoutsRemoved||{})[w.id]=Date.now(); save(); closeSheet(); renderWorkoutsCard(); offerUndo");
 patch("()=>{ workouts().push(w); save(); renderWorkoutsCard(); }); });", "()=>{ workoutSave(w); renderWorkoutsCard(); }); });");
 // A removed favorite used to reappear after merging the other device's old list.
 patch("data:{ids: ALL.foodFav || []}", "data:{ids: ALL.foodFav || [],changes:ALL.foodFavChanges||{}}");
 patch("st.foodFav = Array.isArray(r.data && r.data.ids) ? r.data.ids : [];", "st.foodFav = Array.isArray(r.data && r.data.ids) ? r.data.ids : []; st.foodFavChanges=(r.data&&r.data.changes)||{};");
 patch("      if(R.foodFav || local.foodFav)\n        out.foodFav = Array.from(new Set([].concat(R.foodFav || [], local.foodFav || [])));", `      if(R.foodFav || local.foodFav){
        const changes={...(R.foodFavChanges||{})};
        Object.entries(local.foodFavChanges||{}).forEach(([k,v])=>{if(!changes[k]||(+v.at||0)>=(+changes[k].at||0))changes[k]=v;});
        const ids=new Set([...(R.foodFav||[]),...(local.foodFav||[])]);
        Object.entries(changes).forEach(([k,v])=>{if(v.on)ids.add(k);else ids.delete(k);});out.foodFav=Array.from(ids);out.foodFavChanges=changes;
      }`);
 patch("  if(i >= 0) f.splice(i, 1); else f.push(id);\n  save();", "  if(i >= 0) f.splice(i, 1); else f.push(id);\n  (ALL.foodFavChanges=ALL.foodFavChanges||{})[id]={on:i<0,at:Math.max(Date.now(),+((ALL.foodFavChanges||{})[id]||{}).at+1||0)};\n  save();");
 if(!/full-account-deletion-v[12]/.test(html))patch("    const erased = await rpc('nutrition_erase_me');", "    const coachingErased=await rpc('crew_coaching_erase_me');\n    if(!coachingErased.ok && coachingErased.status!==404)return {ok:false,error:'Could not erase your coaching inbox. Try again.'};\n    const erased = await rpc('nutrition_erase_me');");
 return html;
}
