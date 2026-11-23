// Persist each explicit client-carried coach decision before its server request.
export function applyCoachRecovery(html){
 let seenReceipt=false;html=html.replace(/^    Object.entries\(ALL\.coachDecisionReceipts[^\n]*\n/gm,line=>{if(seenReceipt)return '';seenReceipt=true;return line;});
 const patch=(a,b)=>{if(html.includes(b))return;if(!html.includes(a))throw Error('Coach recovery boundary missing: '+a.slice(0,85));html=html.replace(a,b);};
 if(!html.includes('Object.entries(ALL.coachDecisionReceipts||{}).forEach'))patch('    const coach=ALL.coach||{};',"    Object.entries(ALL.coachDecisionReceipts||{}).forEach(([id,r])=>out.push({kind:'pref',key:'coachReceipt|'+id,at:iso(r.at||Date.now()),data:r,updated_at:iso(r.at||Date.now())}));\n    const coach=ALL.coach||{};");
 patch("r.key === 'coachPermissions' || r.key === 'workoutLibrary'", "r.key.startsWith('coachReceipt|') || r.key === 'coachPermissions' || r.key === 'workoutLibrary'");
 const merge=`      out.coachDecisionReceipts={...(local.coachDecisionReceipts||{})};
      Object.entries(R).forEach(([k,v])=>{if(!k.startsWith('coachReceipt|')||!v)return;const id=k.slice(13),old=out.coachDecisionReceipts[id];if(!old||(v.applied===true&&old.applied!==true)||(v.applied===old.applied&&(+v.at||0)>=(+old.at||0)))out.coachDecisionReceipts[id]=v;});
`;
 html=html.replace(/      out\.coachDecisionReceipts=\{[^\n]*\n      Object\.entries\(R\)\.forEach\([^\n]*\n/g,'');
 patch('      if(R.protoX) out._protoX = R.protoX;',merge+'      if(R.protoX) out._protoX = R.protoX;');
 patch("  const key = 'team|'+pr.id+'|'+decision;", "  if(decision==='accepted'&&window.C3?.coachRecovery)C3.coachRecovery.prepare(pr,reviewId);\n  const key = 'team|'+pr.id+'|'+decision;");
 patch("  if(!r.ok) return r;\n  /* the actions the client carries itself */", "  if(!r.ok) return r;\n  if(decision==='accepted'&&r.result?.status!=='accepted')return {ok:false,error:'This proposal was not accepted on the server. Refresh its saved decision.'};\n  if(decision==='accepted'&&window.C3?.coachRecovery){const applied=C3.coachRecovery.confirm(pr.id);if(!applied.ok)return applied;}\n  /* the actions the client carries itself */");
 html=html.replace("    if(decision === 'accepted' && pr.action === 'lighter_week'){ const wi = weekIndexNow(); weekOverrides(wi, true).scale = 0.8; save(); try{ renderTrain(); }catch(e){} }", "    /* Client training changes use the durable, account-owned decision receipt. */");
 html=html.replace("    if(decision === 'accepted' && pr.action === 'tolerance_review'){ ALL.waterSched = {from: dkey(Date.now()), until: dkey(Date.now() + 13*DAY)}; save(); }", "    /* The accepted water schedule retains the original request dates on recovery. */");
 return html;
}
