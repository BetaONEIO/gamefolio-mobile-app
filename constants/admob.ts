import { Platform } from 'react-native';

export const ADMOB_APP_ID = 'ca-app-pub-5761082044706945~1811380230';

export const AD_UNIT_IDS = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-5761082044706945/5136369384',
    android: 'ca-app-pub-5761082044706945/3519680161',
    default: 'ca-app-pub-5761082044706945/5136369384',
  }),
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-5761082044706945/2039077532',
    android: 'ca-app-pub-5761082044706945/7291404211',
    default: 'ca-app-pub-5761082044706945/2039077532',
  }),
  REWARDED: Platform.select({
    ios: 'ca-app-pub-5761082044706945/4042779561',
    android: 'ca-app-pub-5761082044706945/3088790540',
    default: 'ca-app-pub-5761082044706945/4042779561',
  }),
};

export const TEST_AD_UNIT_IDS = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
    default: 'ca-app-pub-3940256099942544/2934735716',
  }),
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
    default: 'ca-app-pub-3940256099942544/4411468910',
  }),
  REWARDED: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
    default: 'ca-app-pub-3940256099942544/1712485313',
  }),
};

export const getAdUnitId = (type: 'BANNER' | 'INTERSTITIAL' | 'REWARDED', useTestAds: boolean = false): string => {
  const ids = useTestAds ? TEST_AD_UNIT_IDS : AD_UNIT_IDS;
  return ids[type] || '';
};
