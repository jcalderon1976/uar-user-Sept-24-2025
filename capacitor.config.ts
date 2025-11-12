import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uar.app',
  appName: 'uar-user',
  webDir: 'www',
  server: {
    cleartext: true,
    allowNavigation: [
      '*.firebaseapp.com',
      '*.googleapis.com',
      '*.google.com',
      'firestore.googleapis.com',
      'identitytoolkit.googleapis.com',
      'securetoken.googleapis.com'
    ]
  },
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false
  }
};

export default config;
