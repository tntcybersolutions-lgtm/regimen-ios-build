import type { CapacitorConfig } from '@capacitor/cli';

/* formed stack (by formed labs), iOS shell. Renamed from The Regimen on 18 Oct 2026; the bundle id stays. Bundle and name per the 16 Sep 2026 handoff.
   The Pro product id is NOT set here: the app asks the shell for whatever
   PRO_PRODUCT says in app/index.html, and App Store Connect must carry that
   exact id under this bundle. */
const config: CapacitorConfig = {
  appId: 'ai.saltiq.theregimen',
  appName: 'formed fit',
  webDir: 'www',
  backgroundColor: '#0F1013',       /* v360: the near-black ground; v299: the C3 ground (was the v129 light #F3F4F6, a white flash before the first paint) */
  ios: {
    contentInset: 'never',           /* v129: the page runs under the status bar and the home indicator and pads the safe areas itself (viewport-fit=cover in build.mjs); 'automatic' left it floating inside dark bars */
    backgroundColor: '#0F1013',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#050a12', launchAutoHide: true },
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#2e86f5' },
  },
};

export default config;

