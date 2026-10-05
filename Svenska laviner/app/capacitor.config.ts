import type { CapacitorConfig } from '@capacitor/cli';

// The appId is permanent once the app is in Google Play / App Store.
const config: CapacitorConfig = {
  appId: 'com.fabsu951.projekt1',
  appName: 'Toppkoll',
  webDir: 'dist',
  // Dark like the app, so there's no white flash while it starts.
  backgroundColor: '#10161d',
  ios: {
    // The page handles the notch itself (viewport-fit=cover + safe-area padding).
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      // Android: the page is edge-to-edge and pads for the bars itself;
      // Capacitor injects --safe-area-inset-* for older web views.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
};

export default config;
