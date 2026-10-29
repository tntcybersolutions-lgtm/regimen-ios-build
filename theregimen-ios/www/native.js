/* ═══════════════════════════════════════════════════════════════════════════
   formed fit, native shell for iOS (Capacitor).

   The app (index.html) never talks to a plugin directly. It looks for
   `window.RUN` and asks it questions; this file is the only place that knows
   which plugin answers. The contract, read out of the app itself
   (app/index.html, 16 Sep 2026):

     RUN.native                        true inside the shell
     RUN.store.buy(productId)          -> {ok, reason}        isPro/buyPro   ~12784
     RUN.store.restore()               -> {ok, owned}         restorePro
     RUN.health.available()            -> bool                renderHealth   ~20921
     RUN.health.connect()              -> {ok, granted}
     RUN.health.read(since)            -> {weights:[{at,lb}], workouts:[...], bodyFat:[...]}
     RUN.health.pushWeight(at, lb), pushComposition(comp)  (pushWorkout: not supported, returns ok:false)
     RUN.health.disconnect(), onChange(fn)
     RUN.notify.available()            -> bool                remNative      ~26117
     RUN.notify.schedule({id,at,title,body,...}), cancel(id)
     RUN.restNotify(seconds, exName), RUN.restCancel()         ~14276
     RUN.rest.available()/start(...)   Live Activity  -- optional, absent here
     RUN.watch.available()             Apple Watch    -- optional, absent here
     RUN.health.heartRate(since)       -> {ok, readings:[{at,bpm,source}]}   (v315, a session's watch readings)
     RUN.ble.available()/pick()/start(id, onBytes, onLost)/stop(id)   (v315, Bluetooth heart rate)
     RUN.share({text, title})                                 shareRecap     ~26482
     RUN.shareFile({filename, base64, mime, title})           C3.xlsx.share  (v371, the Excel menu)
     RUN.labs                          null: the app's own file-input photo path is used (see below)
     RUN.ai.ask(...)                   optional; absent -> app uses its own service
     window.onNativeAction(d)          the APP defines this; we call it when a
                                       notification action is tapped
     'run-native-ready' event          fired once RUN is populated
     (v129) the status bar's text follows <html data-theme> through @capacitor/status-bar

   ⚠️ READ window.Capacitor LIVE, INSIDE EACH ACCESSOR. Capturing it in a const
   at load leaves it undefined forever on a real device (learned the hard way,
   see docs/HANDOFF.md). Every function below reaches for it fresh.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const cap = () => (typeof window !== 'undefined' && window.Capacitor) || null;
  const plugin = (name) => { const c = cap(); return c && c.Plugins ? c.Plugins[name] || null : null; };
  const isNative = () => { const c = cap(); return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform()); };

  /* ---------- store: StoreKit through cordova-plugin-purchase (v13) ---------- */
  /* The product id is whatever the app asks for (PRO_PRODUCT in index.html).
     It must exist in App Store Connect under this bundle id, as an auto-renewing
     subscription. The shell does not decide the id. */
  const store = {
    _ready: null,
    _init(productId) {
      if (this._ready) return this._ready;
      this._ready = new Promise((resolve) => {
        const CdvPurchase = window.CdvPurchase;
        if (!CdvPurchase) return resolve(false);
        const { store: s, ProductType, Platform } = CdvPurchase;
        s.register([{ id: productId, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.APPLE_APPSTORE }]);
        s.when().approved((tx) => tx.verify()).verified((r) => r.finish());
        s.initialize([Platform.APPLE_APPSTORE]).then(() => resolve(true)).catch(() => resolve(false));
      });
      return this._ready;
    },
    async buy(productId) {
      if (!isNative()) return { ok: false, reason: 'no-store' };
      const ok = await this._init(productId);
      if (!ok) return { ok: false, reason: 'store-unavailable' };
      const s = window.CdvPurchase.store;
      const product = s.get(productId, window.CdvPurchase.Platform.APPLE_APPSTORE);
      const offer = product && product.getOffer();
      if (!offer) return { ok: false, reason: 'product-not-found' };
      try {
        const err = await offer.order();
        if (err) return { ok: false, reason: err.isError ? 'canceled' : String(err.message || 'failed') };
        return { ok: !!(product.owned), reason: product.owned ? undefined : 'pending' };
      } catch (e) { return { ok: false, reason: 'failed' }; }
    },
    async restore() {
      if (!isNative()) return { ok: false, owned: false };
      const CdvPurchase = window.CdvPurchase;
      if (!CdvPurchase) return { ok: false, owned: false };
      try {
        await CdvPurchase.store.restorePurchases();
        const owned = CdvPurchase.store.verifiedPurchases.some((p) => p.isExpired === false || p.isExpired === undefined);
        return { ok: true, owned };
      } catch (e) { return { ok: false, owned: false }; }
    },
  };

  /* ---------- health: HealthKit through @capgo/capacitor-health ----------
     Read from the plugin's own Swift (Health.swift): it reads any type in its
     HealthDataType enum and writes any HKQuantityType. Weight (kilogram) and
     bodyFat (percent) go both ways; steps, workouts and, since 18 Sep 2026,
     sleep, resting heart rate, HRV (SDNN), VO2max, blood oxygen, respiratory
     rate and sleeping wrist temperature are read. ECG classifications, walking
     steadiness and the rhythm / hypertension notifications are NOT in the
     plugin's enum, so they are not claimed. It does NOT write workouts or lean
     body mass; those two pushes return {ok:false} and are listed as a gap in
     BUILD.md rather than faked. iOS dates must carry milliseconds.

     Two things HealthKit hands over in its own terms, normalised here so the
     app never has to know: a `percent` quantity is a fraction (0.97, 0.25) —
     the app reads 97 and 25; a sleep sample is one stage segment, and a night
     is the asleep segments that END on a day, summed under that day. */
  const READ = ['weight', 'bodyFat', 'steps', 'workouts', 'sleep', 'heartRate', 'restingHeartRate',
    'heartRateVariability', 'vo2Max', 'oxygenSaturation', 'respiratoryRate', 'appleSleepingWristTemperature'];
  const WRITE = ['weight', 'bodyFat'];
  const HK = () => plugin('Health');
  const iso = (t) => new Date(t).toISOString();   // always has .sss
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayOf = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const pct = (x) => (x.unit === 'percent' && x.value <= 1) ? x.value * 100 : x.value;
  const ASLEEP = { asleep: 1, rem: 1, deep: 1, light: 1 };   // not inBed, not awake
  const health = {
    _changed: [],
    READ, WRITE,
    available() { return isNative() && !!HK(); },
    async connect() {
      const hk = HK(); if (!hk) return { ok: false, granted: false };
      try {
        const st = await hk.requestAuthorization({ read: READ, write: WRITE });
        const granted = !!(st && st.readAuthorized && st.readAuthorized.includes('weight'));
        return { ok: true, granted, readAuthorized: (st && st.readAuthorized) || [] };
      } catch (e) { return { ok: false, granted: false, error: String(e && e.message || e) }; }
    },
    /* Pure: the plugin's samples in, the app's payload out. Exported so the
       shape is testable without a phone (tools/health-test.mjs). */
    shape(raw) {
      const w = raw.weight || [], bf = raw.bodyFat || [], wo = raw.workouts || [];
      const at = (x) => Date.parse(x.startDate);
      const series = (arr, field, map) => (arr || []).map((x) => ({ at: at(x), [field]: map ? map(x) : x.value, source: x.sourceName }))
        .filter((r) => Number.isFinite(r.at) && Number.isFinite(r[field]));
      /* a night: asleep segments summed under the day they end on */
      const nights = {};
      for (const x of (raw.sleep || [])) {
        if (!ASLEEP[x.sleepState]) continue;
        const end = Date.parse(x.endDate), start = Date.parse(x.startDate);
        if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) continue;
        const day = dayOf(end);
        nights[day] = (nights[day] || 0) + (end - start) / 60000;
      }
      const stepsByDay = {};
      for (const b of (raw.steps || [])) {
        const v = b.value != null ? b.value : (b.values && b.values.sum);
        if (!(v > 0)) continue;
        const day = dayOf(Date.parse(b.startDate));
        stepsByDay[day] = Math.max(stepsByDay[day] || 0, Math.round(v));
      }
      return {
        weights: w.map((x) => ({ at: at(x), lb: x.unit === 'kilogram' ? x.value * 2.2046226 : x.value, source: x.sourceName })),
        bodyFat: bf.map((x) => ({ at: at(x), pct: pct(x), source: x.sourceName })),
        workouts: wo.map((x) => ({ start: Date.parse(x.startDate), end: Date.parse(x.endDate), kind: x.workoutType, kcal: x.totalEnergyBurned, source: x.sourceName })),
        steps: Object.entries(stepsByDay).map(([day, count]) => ({ day, count })),
        sleep: Object.entries(nights).map(([day, minutes]) => ({ day, minutes: Math.round(minutes) })),
        restingHR: series(raw.restingHeartRate, 'bpm'),
        hrv: series(raw.heartRateVariability, 'ms'),
        vo2: series(raw.vo2Max, 'v'),
        spo2: series(raw.oxygenSaturation, 'pct', pct),
        respRate: series(raw.respiratoryRate, 'v'),
        wristTemp: series(raw.appleSleepingWristTemperature, 'c', (x) => x.unit === 'fahrenheit' ? (x.value - 32) * 5 / 9 : x.value),
        readAt: Date.now(),
      };
    },
    async read(since) {
      const hk = HK(); if (!hk) return { weights: [], workouts: [], bodyFat: [], available: false };
      const startDate = iso(since || Date.now() - 90 * 864e5), endDate = iso(Date.now());
      const samples = async (dataType) => {
        try { const r = await hk.readSamples({ dataType, startDate, endDate, limit: 0 }); return (r && r.samples) || []; }
        catch (e) { return []; }
      };
      const raw = {};
      const want = ['weight', 'bodyFat', 'sleep', 'restingHeartRate', 'heartRateVariability', 'vo2Max',
        'oxygenSaturation', 'respiratoryRate', 'appleSleepingWristTemperature'];
      const got = await Promise.all(want.map(samples));
      want.forEach((k, i) => { raw[k] = got[i]; });
      try { const r = await hk.queryWorkouts({ startDate, endDate, limit: 500 }); raw.workouts = (r && r.workouts) || []; } catch (e) { raw.workouts = []; }
      try { const r = await hk.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' }); raw.steps = (r && r.aggregatedData) || (r && r.samples) || []; } catch (e) { raw.steps = []; }
      return health.shape(raw);
    },
    /* v315: heart rate during a session. An Apple Watch running a workout (or AirPods / Powerbeats
       that measure it) saves a reading every few seconds into Health; this reads the ones after
       `since`, oldest first, as {at, bpm, source}. The app polls it while a session is open. */
    async heartRate(since) {
      const hk = HK(); if (!hk) return { ok: false, readings: [] };
      try {
        const r = await hk.readSamples({ dataType: 'heartRate', startDate: iso(since || Date.now() - 10 * 60000), endDate: iso(Date.now() + 1000), limit: 0 });
        const readings = ((r && r.samples) || []).map((x) => ({ at: Date.parse(x.startDate), bpm: Math.round(x.value), source: x.sourceName || '' }))
          .filter((x) => Number.isFinite(x.at) && x.bpm > 20 && x.bpm < 240).sort((a, b) => a.at - b.at);
        return { ok: true, readings };
      } catch (e) { return { ok: false, readings: [], error: String(e && e.message || e) }; }
    },
    async pushWeight(at, lb) {
      const hk = HK(); if (!hk) return { ok: false };
      try { await hk.saveSample({ dataType: 'weight', value: lb / 2.2046226, unit: 'kilogram', startDate: iso(at), endDate: iso(at) }); return { ok: true }; }
      catch (e) { return { ok: false, error: String(e && e.message || e) }; }
    },
    async pushComposition(comp) {
      const hk = HK(); if (!hk || !comp) return { ok: false };
      const at = iso(comp.at || Date.now());
      const out = { ok: false, bodyFat: false, leanMass: 'not-supported-by-plugin' };
      if (comp.bodyFatPct != null) {
        try { await hk.saveSample({ dataType: 'bodyFat', value: comp.bodyFatPct, unit: 'percent', startDate: at, endDate: at }); out.bodyFat = true; out.ok = true; }
        catch (e) { out.error = String(e && e.message || e); }
      }
      return out;
    },
    async pushWorkout() { return { ok: false, reason: 'not-supported-by-plugin' }; },
    async disconnect() { /* iOS has no programmatic revoke; the app stops asking. */ },
    onChange(fn) { if (typeof fn === 'function') this._changed.push(fn); },
  };


  /* ---------- ble (v315): Bluetooth heart rate through @capacitor-community/bluetooth-le ----------
     Any strap, watch, armband or earbud that sends the standard Bluetooth Heart Rate service
     (0x180D, measurement 0x2A37): Polar, Garmin, Wahoo, Coros, Suunto, Whoop broadcast mode,
     Garmin/Coros/Polar watches in "broadcast heart rate". The app parses the bytes (hrParse in
     index.html); this only moves them. Read from the plugin's own Swift (Plugin.swift, 8.3.0):
       requestDevice -> the iOS picker (displayMode 'list'), resolves {deviceId, name}
       connect / disconnect, the 'disconnected|<id>' event
       startNotifications -> events 'notification|<id>|<service>|<characteristic>' with {value: hex}
     The Swift writes the service and characteristic as CBUUID.uuidString lowercased, which for a
     standard UUID can be the short form ("180d") rather than the 128-bit one, so both are listened to. */
  const BL = () => plugin('BluetoothLe');
  const U = (short) => '0000' + short + '-0000-1000-8000-00805f9b34fb';
  const HR_SVC = U('180d'), HR_MEAS = U('2a37'), BATT_SVC = U('180f'), BATT_LVL = U('2a19');
  const hexBytes = (hex) => { const h = String(hex || '').replace(/[^0-9a-f]/gi, ''); const out = []; for (let i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16)); return out; };
  const ble = {
    _subs: {},
    available() { return isNative() && !!BL(); },
    async init() { const b = BL(); if (!b) return false; try { await b.initialize({ androidNeverForLocation: true }); return true; } catch (e) { return false; } },
    /* the picker; resolves {ok, id, name} or {ok:false, reason} */
    async pick() {
      const b = BL(); if (!b) return { ok: false, reason: 'no-plugin' };
      if (!(await ble.init())) return { ok: false, reason: 'bluetooth-off' };
      try {
        const d = await b.requestDevice({ services: [HR_SVC], optionalServices: [BATT_SVC], displayMode: 'list' });
        return d && d.deviceId ? { ok: true, id: d.deviceId, name: d.name || '' } : { ok: false, reason: 'none' };
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    },
    /* connect and stream: onBytes(bytes[]) for every measurement, onLost() when the link drops */
    async start(id, onBytes, onLost) {
      const b = BL(); if (!b || !id) return { ok: false, reason: 'no-plugin' };
      await ble.stop(id);
      if (!(await ble.init())) return { ok: false, reason: 'bluetooth-off' };
      const subs = ble._subs[id] = [];
      const on = async (ev, fn) => { try { const h = await b.addListener(ev, fn); subs.push(h); } catch (e) {} };
      await on('disconnected|' + id, () => { if (typeof onLost === 'function') onLost(); });
      try { await b.connect({ deviceId: id, timeout: 12000 }); }
      catch (e) { await ble.stop(id); return { ok: false, reason: String(e && e.message || e) }; }
      let last = 0;
      const feed = (ev) => { const bytes = hexBytes(ev && ev.value); const t = Date.now(); if (bytes.length >= 2 && t - last > 5) { last = t; onBytes(bytes); } };
      for (const [svc, ch] of [[HR_SVC, HR_MEAS], ['180d', '2a37'], ['180D', '2A37']]) await on('notification|' + id + '|' + svc + '|' + ch, feed);
      try { await b.startNotifications({ deviceId: id, service: HR_SVC, characteristic: HR_MEAS }); }
      catch (e) { await ble.stop(id); return { ok: false, reason: String(e && e.message || e) }; }
      let battery = null;
      try { const r = await b.read({ deviceId: id, service: BATT_SVC, characteristic: BATT_LVL }); const v = hexBytes(r && r.value); if (v.length) battery = v[0]; } catch (e) {}
      return { ok: true, battery };
    },
    async stop(id) {
      const b = BL(); const subs = ble._subs[id] || []; delete ble._subs[id];
      for (const h of subs) { try { await h.remove(); } catch (e) {} }
      if (b && id) { try { await b.stopNotifications({ deviceId: id, service: HR_SVC, characteristic: HR_MEAS }); } catch (e) {} try { await b.disconnect({ deviceId: id }); } catch (e) {} }
    },
  };

  /* ---------- notifications: @capacitor/local-notifications ---------- */
  const LN = () => plugin('LocalNotifications');
  const REST_ID = 900001;
  const notify = {
    available() { return isNative() && !!LN(); },
    async schedule(n) {
      const ln = LN(); if (!ln) return;
      await ln.requestPermissions().catch(() => {});
      await ln.schedule({ notifications: [{
        id: Number(n.id) || Math.floor(Math.random() * 1e6),
        title: n.title || 'formed fit', body: n.body || '',
        schedule: { at: new Date(n.at) },
        extra: { action: n.action || '', open: n.open || '', meal: n.meal == null ? null : n.meal, day: n.day || null, proto: n.proto || null, mg: n.mg || null, at: +new Date(n.at) || null },   /* v344: open = where a plain tap goes */
        actionTypeId: n.actionType || 'REGIMEN_DEFAULT',
      }] });
    },
    async cancel(id) { const ln = LN(); if (!ln) return; try { await ln.cancel({ notifications: [{ id: Number(id) }] }); } catch (e) {} },
  };

  async function restNotify(seconds, exName) {
    const ln = LN(); if (!ln || !seconds) return;
    try {
      await ln.cancel({ notifications: [{ id: REST_ID }] });
      await ln.schedule({ notifications: [{ id: REST_ID, title: 'Rest is up', body: (exName || 'Next set') + ' — go.',
        schedule: { at: new Date(Date.now() + seconds * 1000) }, extra: { action: 'rest-done' } }] });
    } catch (e) {}
  }
  async function restCancel() { const ln = LN(); if (!ln) return; try { await ln.cancel({ notifications: [{ id: REST_ID }] }); } catch (e) {} }

  /* ---------- share: @capacitor/share ---------- */
  async function share(o) {
    const sh = plugin('Share');
    if (!sh) { if (navigator.share) return navigator.share(o); throw new Error('no share'); }
    return sh.share({ title: o.title, text: o.text, dialogTitle: o.title });
  }

  /* ---------- v371: share a file (the Excel menu): written to the app's cache with @capacitor/filesystem, then the
     share sheet gets the file itself (Excel, Numbers, Files, Mail, Messages, AirDrop, Print) ---------- */
  async function shareFile(o) {
    const fs = plugin('Filesystem'), sh = plugin('Share');
    if (!fs || !sh) throw new Error('file sharing is not available');
    const name = String(o.filename || 'formed-fit.xlsx').replace(/[^\w.\- ]+/g, '-');
    const w = await fs.writeFile({ path: name, data: o.base64, directory: 'CACHE' });
    return sh.share({ title: o.title, files: [w.uri], dialogTitle: o.title });
  }

  /* ---------- labs: deliberately absent ----------
     The app reads lab and label photos through <input type="file"
     capture="environment">, which WKWebView presents as camera-or-library on
     its own. RUN.labs.scan would have to return TEXT, and the app exposes no
     reader for the shell to call, so claiming availability would put a scan
     button on screen that cannot finish. labs = null keeps the working path. */
  const labs = null;

  /* ---------- notification taps -> the app's onNativeAction ---------- */
  function wireActions() {
    const ln = LN(); if (!ln || wireActions.done) return; wireActions.done = true;
    /* the dose banner carries its three buttons; a plain tap keeps the
       notification's own action (open the screen it names) */
    ln.registerActionTypes({ types: [
      { id: 'REGIMEN_DOSE', actions: [
        { id: 'dose-log', title: 'Took it' },
        { id: 'dose-skip', title: 'Skip', destructive: true },
        { id: 'dose-snooze', title: 'In an hour' } ] },
      { id: 'REGIMEN_DEFAULT', actions: [] } ] }).catch(() => {});
    ln.addListener('localNotificationActionPerformed', (ev) => {
      const extra = (ev && ev.notification && ev.notification.extra) || {};
      /* v344: a button is its own action; a plain tap opens what the banner is about (a dose banner's tap used to log it) */
      const pressed = ev && ev.actionId && ev.actionId !== 'tap' ? ev.actionId : (extra.open || extra.action);
      if (typeof window.onNativeAction === 'function' && pressed) window.onNativeAction({ ...extra, action: pressed, at: extra.at || Date.now() });
    });
  }

  const RUN = {
    get native() { return isNative(); },
    platform: 'ios',
    store, health, ble, notify, restNotify, restCancel, share, shareFile, labs,
    ai: null, rest: null, watch: null,
    strip: true,
  };
  window.RUN = RUN;

  /* ---------- status bar (v129): dark text on the light theme, light text on dark; the page runs under it ---------- */
  function statusBarFollow() {
    const sb = plugin('StatusBar'); if (!sb || !isNative()) return;
    /* v297: the C3 screens (and the C3 bar that stays over an old screen) are royal blue whatever the
       theme, so with one of them up the status bar text is light ('DARK' is Capacitor's name for
       light text on a dark ground). The class is read live on every change. */
    const apply = () => { const el = document.documentElement; const c3 = el.classList.contains('c3-on') || el.classList.contains('c3-deep');
      const light = !c3 && el.dataset.theme === 'light'; try { sb.setStyle({ style: light ? 'LIGHT' : 'DARK' }); } catch (e) {} };
    apply();
    try { new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] }); } catch (e) {}
  }

  const ready = () => {
    wireActions();
    statusBarFollow();
    try { document.dispatchEvent(new Event('run-native-ready')); } catch (e) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();



/* ios-native-fallback: App Store review shell. When strip is set, the dosage
   calculators (math), the compound catalog (addcmp), the shop link (shop),
   the peptide onboarding options and the compound setup empty-state are
   hidden or redirected INSIDE the native build only (RUN.native).
   Web (RUN.native false) is unchanged. Remove strip to retire the fallback. */
if (window.RUN && window.RUN.strip) {
  var RUN = window.RUN;
  var STRIP_ROUTES = ['math', 'addcmp', 'shop'];
  var ffStripTimer = setInterval(function () {
    if (!(window.C3 && C3.go)) return;
    clearInterval(ffStripTimer);
    if (!RUN.native) return;
    var go0 = C3.go;
    C3.go = function (route) {
      if (STRIP_ROUTES.indexOf(route) >= 0) {
        if (route === 'addcmp') return go0.call(this, 'doses');
        return;
      }
      return go0.apply(this, arguments);
    };
    var css = '[data-go="math"],[data-go="addcmp"],[data-go="shop"],[data-act="padd"],[data-key="padd"],[data-act="pmath"],.pd-calc{display:none!important}'
      + '.tl-row:has([data-go="math"]),.tl-row:has([data-go="addcmp"]),.tl-row:has([data-go="shop"]){display:none!important}'
      + '#onb [data-focus="track"],#onb [data-focus="both"]{display:none!important}';
    var st0 = document.createElement('style');
    st0.id = 'ff-strip';
    st0.textContent = css;
    document.head.appendChild(st0);
    var ffRootTimer = setInterval(function () {
      if (!C3.root) return;
      clearInterval(ffRootTimer);
      var st1 = document.createElement('style');
      st1.id = 'ff-strip-shadow';
      st1.textContent = css + '.pd-firstgo{display:none!important}.dj-help{display:none!important}';
      C3.root.appendChild(st1);
      var ffNote = function () {
        var first = C3.root.querySelector('.pd-first');
        if (first && !first.querySelector('#ff-strip-note')) {
          var p = document.createElement('p');
          p.className = 'yd-note';
          p.id = 'ff-strip-note';
          p.style.marginTop = '14px';
          p.textContent = 'Nothing to track yet. Your training, food and progress are all here.';
          first.appendChild(p);
        }
      };
      ffNote();
      new MutationObserver(ffNote).observe(C3.root, {childList: true, subtree: true});
    }, 100);
  }, 50);
}


