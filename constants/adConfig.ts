import { Platform } from 'react-native';

export const AD_CONFIG = {
  android: {
    appId: 'ca-app-pub-5761082044706945~1811380230',
    banner: 'ca-app-pub-5761082044706945/3519680161',
    interstitial: 'ca-app-pub-5761082044706945/7291404211',
    rewarded: 'ca-app-pub-5761082044706945/3088790540',
  },
  ios: {
    appId: '',
    banner: '',
    interstitial: '',
    rewarded: '',
  },
  test: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
};

export const getAdUnitId = (type: 'banner' | 'interstitial' | 'rewarded', useTestAds = false): string => {
  if (useTestAds) {
    return AD_CONFIG.test[type];
  }
  
  const platformConfig = Platform.OS === 'ios' ? AD_CONFIG.ios : AD_CONFIG.android;
  return platformConfig[type];
};

export const getAppId = (): string => {
  return Platform.OS === 'ios' ? AD_CONFIG.ios.appId : AD_CONFIG.android.appId;
};
