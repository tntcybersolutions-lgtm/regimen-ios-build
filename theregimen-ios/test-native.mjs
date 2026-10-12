/* Exercise the shell against fake plugins, the way the app will call it.
   Proves the JS contract without a device: every RUN member the app reads
   exists, every call resolves to the shape the app expects, and window.Capacitor
   is read live (a Capacitor that appears AFTER load must still be seen). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const calls = [];
const fake = (name) => new Proxy({}, { get: (_, m) => (...a) => { calls.push(name + '.' + String(m)); return Promise.resolve({
  readAuthorized: ['weight','bodyFat','steps','workouts'],
  samples: [{ value: 80, unit: 'kilogram', startDate: '2026-09-16T12:00:00.000Z', sourceName: 'Scale' }],
  workouts: [{ workoutType: 'traditionalStrengthTraining', startDate: '2026-09-16T10:00:00.000Z', endDate: '2026-09-16T11:00:00.000Z', totalEnergyBurned: 300 }],
  base64String: 'abc', format: 'jpeg',
}); } });
const doc = { readyState: 'complete', addEventListener(){}, dispatchEvent(e){ calls.push('event:' + e.type); return true; } };
const window = { document: doc, navigator: {}, Event: class { constructor(t){ this.type = t; } } };
window.window = window;
const ctx = vm.createContext({ window, document: doc, navigator: window.navigator, Event: window.Event, console });
vm.runInContext(readFileSync('www/native.js', 'utf8'), ctx);
const RUN = window.RUN;
let fails = 0; const ok = (n, c, d='') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ' -- ' + d : ''}`); if (!c) fails++; };
ok('window.RUN exists', !!RUN);
ok('run-native-ready fired', calls.includes('event:run-native-ready'));
ok('RUN.native is false with no Capacitor', RUN.native === false);
ok('health.available() false with no Capacitor', RUN.health.available() === false);
ok('notify.available() false with no Capacitor', RUN.notify.available() === false);
ok('store.buy without store -> {ok:false, reason}', (await RUN.store.buy('x')).ok === false);
// Capacitor appears AFTER load (the real-device case): every accessor must see it
window.Capacitor = { isNativePlatform: () => true, Plugins: { Health: fake('Health'), LocalNotifications: fake('LocalNotifications'), Share: fake('Share'), Camera: fake('Camera') } };
ok('RUN.native flips to true when Capacitor appears later', RUN.native === true);
ok('health.available() flips to true', RUN.health.available() === true);
const c = await RUN.health.connect(); ok('health.connect -> granted', c.ok && c.granted, JSON.stringify(c));
const r = await RUN.health.read(Date.now() - 864e5);
ok('health.read -> weights in lb', r.weights.length === 1 && Math.round(r.weights[0].lb) === 176, JSON.stringify(r.weights));
ok('health.read -> workouts mapped', r.workouts.length === 1 && r.workouts[0].kcal === 300);
ok('health.pushWeight -> saveSample in kg', (await RUN.health.pushWeight(Date.now(), 176)).ok && calls.includes('Health.saveSample'));
ok('health.pushWorkout is honest about not writing', (await RUN.health.pushWorkout({})).ok === false);
ok('notify.available() true', RUN.notify.available());
await RUN.notify.schedule({ id: 7, at: Date.now() + 60000, title: 't', body: 'b', action: 'dose' });
ok('notify.schedule -> LocalNotifications.schedule', calls.includes('LocalNotifications.schedule'));
await RUN.restNotify(90, 'Squat'); ok('restNotify schedules after cancel', calls.filter(x => x === 'LocalNotifications.cancel').length >= 1);
await RUN.share({ text: 'x', title: 'y' }); ok('share -> Share.share', calls.includes('Share.share'));
ok('labs is null so the app keeps its own photo path', RUN.labs === null);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
