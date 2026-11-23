// Regenerate the daily experience from reviewed source without replacing bundled assets.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { applyAccountControls } from './apply-account-controls.mjs';
import { applyAccountIsolation } from './apply-account-isolation.mjs';
import { applyLockedExperience } from './apply-locked-experience.mjs';
import { applyWorkoutSync } from './apply-workout-sync.mjs';
import { applyCoachContext } from './apply-coach-context.mjs';
import { applyPurchaseAccess } from './apply-purchase-access.mjs';
import { applyCoachRecovery } from './apply-coach-recovery.mjs';
import { applySaveSync } from './apply-save-sync.mjs';
import { applySharedRecords } from './apply-shared-records.mjs';
import { applyAccountDeletion } from './apply-account-deletion.mjs';
import { applyPersistenceFix } from './apply-persistence-fix.mjs';
const SCAN_CONSENT = "/* external-ai-consent-v1: account-and-service-scoped device consent, never synced. */\nfunction scanConsentKey(){\n let who='guest';try{who=String(CLOUD?.user()?.id||'guest');}catch(e){}\n const service=aiSvcUrl();\n return 'formed.ai-scan-consent.v1:'+encodeURIComponent(who)+':'+encodeURIComponent(service);\n}\nfunction scanConsent(){\n const key=scanConsentKey();\n try{if(localStorage.getItem(key)==='allowed')return true;}catch(e){}\n const service=aiSvcUrl(),custom=!!ownSvc();\n const destination=custom?'your selected AI service ('+service+')':'Anthropic (third-party AI) through formed fit';\n const accepted=window.confirm('Allow AI scanning?\\n\\nSend selected meal/label images or recipe text to '+destination+' to read them. Images may contain personal information. Check AI estimates before saving.\\n\\nOK: allow for this account/service on this device. Cancel: no upload; enter food manually.');\n if(!accepted)return false;\n // Do not remember consent for a different account if a session changed during the prompt.\n if(scanConsentKey()!==key)return false;\n try{localStorage.setItem(key,'allowed');}catch(e){}\n return true;\n}\n";
export function applyScanConsent(html){
 if(html.includes('/* external-ai-consent-v1:'))return html;
 const anchor='async function askModel(prompt, opts){';
 const compact='async function askModel(prompt2,opts){';
 const found=html.includes(anchor)?anchor:html.includes(compact)?compact:null;
 if(!found)throw Error('AI scan consent: askModel anchor missing');
 const optsAnchor=found===anchor?'  opts = opts || {};':'opts=opts||{};';
 const start=html.indexOf(found),at=html.indexOf(optsAnchor,start);
 if(at<start||at>start+150)throw Error('AI scan consent: options anchor missing');
 const guard="if(opts.kind==='scan'&&!scanConsent())return {ok:false,how:'consent',code:'declined',error:'Nothing was uploaded. You can enter food, labels or recipes manually.'};";
 return html.slice(0,start)+SCAN_CONSENT+html.slice(start,at+optsAnchor.length)+guard+html.slice(at+optsAnchor.length);
}


const master = fileURLToPath(new URL('../theregimen-ios/www/index.html', import.meta.url));
const root = fileURLToPath(new URL('../', import.meta.url));
let html = fs.readFileSync(master, 'utf8');
if (!html.includes('id="buildTag"')) throw new Error('Expected app master missing');
html = html.replace('<title>formed stack · peptide tracker by formed labs</title>', '<title>formed fit</title>').replace('<title>Formed Labs Peptide &amp; Fitness Tracker</title>', '<title>formed fit</title>');
html = html.replace(/(id="buildTag" title="Build">)v(?:348\.3|349|350|351|352|353|354|355|356|357|358|359|360|361|362|363|364|365|366|367|368|369|369\.1|370|370\.1|371|371\.1|372|372\.1|373|374|374\.1|375)(?=<)/, '$1v376');
html = html.replaceAll('Titan Kane', 'Kayne').replaceAll('Titan', 'Kayne');   // coach is Kayne everywhere a member can read it, possessives included
html = applyLockedExperience(applyAccountIsolation(applyAccountControls(html)));
html = applyCoachContext(applyWorkoutSync(html));
html = applyPurchaseAccess(applyCoachRecovery(html));
html = applyPersistenceFix(applyAccountDeletion(applySharedRecords(applySaveSync(html))));
html = applyScanConsent(html);
fs.writeFileSync(master, html);
execFileSync(process.execPath, [fileURLToPath(new URL('./c3/splice.mjs', import.meta.url))], { stdio: 'inherit', cwd: root });
execFileSync(process.execPath, [fileURLToPath(new URL('./check-scripts.mjs', import.meta.url))], { stdio: 'inherit', cwd: root });



