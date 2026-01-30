import { Platform } from 'react-native';

export const ADMOB_APP_ID = 'ca-app-pub-5761082044706945~1811380230';

export const AD_UNIT_IDS = {
  banner: Platform.select({
    ios: 'ca-app-pub-5761082044706945/5136369384',
    android: 'ca-app-pub-5761082044706945/3519680161',
    default: 'ca-app-pub-5761082044706945/3519680161',
  }),
  interstitial: Platform.select({
    ios: 'ca-app-pub-5761082044706945/2039077532',
    android: 'ca-app-pub-5761082044706945/7291404211',
    default: 'ca-app-pub-5761082044706945/7291404211',
  }),
  rewarded: Platform.select({
    ios: 'ca-app-pub-5761082044706945/4042779561',
    android: 'ca-app-pub-5761082044706945/3088790540',
    default: 'ca-app-pub-5761082044706945/3088790540',
  }),
};

export const TEST_AD_UNIT_IDS = {
  banner: Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
    default: 'ca-app-pub-3940256099942544/6300978111',
  }),
  interstitial: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
    default: 'ca-app-pub-3940256099942544/1033173712',
  }),
  rewarded: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
    default: 'ca-app-pub-3940256099942544/5224354917',
  }),
};

export const getAdUnitId = (type: 'banner' | 'interstitial' | 'rewarded', testMode: boolean = false) => {
  const ids = testMode ? TEST_AD_UNIT_IDS : AD_UNIT_IDS;
  return ids[type] || '';
};
