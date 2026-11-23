import type { CapacitorConfig } from '@capacitor/cli';

/* formed stack (by formed labs), iOS shell. Renamed from The Regimen on 18 Oct 2026; the bundle id stays. Bundle and name per the 16 Sep 2026 handoff.
   The Pro product id is NOT set here: the app asks the shell for whatever
   PRO_PRODUCT says in app/index.html, and App Store Connect must carry that
   exact id under this bundle. */
const config: CapacitorConfig = {
  appId: 'ai.saltiq.theregimen',
  appName: 'formed fit',
  webDir: 'www',
  backgroundColor: '#EEF2F7',       /* v370: the soft glass ground (--ground in zz-glass.css); the shell is light now */
  ios: {
    contentInset: 'never',           /* v129: the page runs under the status bar and the home indicator and pads the safe areas itself (viewport-fit=cover in build.mjs); 'automatic' left it floating inside dark bars */
    backgroundColor: '#EEF2F7',
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#EEF2F7', launchAutoHide: true },   /* v370: the glass ground, not the old near-black */
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#2e86f5' },
  },
};

export default config;

