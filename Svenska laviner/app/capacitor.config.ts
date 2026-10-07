import type { CapacitorConfig } from '@capacitor/cli';

// The appId is permanent once the app is in Google Play / App Store.
const config: CapacitorConfig = {
  appId: 'se.snolage.app',
  appName: 'Snöläge',
  webDir: 'dist',
  // Dark like the app, so there's no white flash while it starts.
  backgroundColor: '#10161d',
  ios: {
    // The page handles the notch itself (viewport-fit=cover + safe-area padding).
    contentInset: 'never',
  },
  plugins: {
    // Push through Firebase Cloud Messaging (services/nativePush.ts); on iPhone
    // also shown while the app is open.
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
    SystemBars: {
      // Android: the page is edge-to-edge and pads for the bars itself;
      // Capacitor injects --safe-area-inset-* for older web views.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
  // Avoids a Swift package name clash in the Firebase plugin (its README).
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
};

export default config;
