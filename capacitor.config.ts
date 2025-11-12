import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.orchids.uar.user',
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
      'securetoken.googleapis.com',
      '*.placetopay.com',
      'checkout-test.placetopay.com',
      'checkout.placetopay.com'
    ]
  },
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false
  }
};

export default config;
