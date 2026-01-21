export const ADS_CONFIG = {
  enabled: true,
  
  frequency: {
    feedInterval: 5,
    minContentBeforeAd: 3,
  },
  
  placements: {
    homeFeed: true,
    trending: true,
    explore: true,
    betweenSections: true,
  },
  
  testMode: __DEV__,
};

export const AD_NETWORKS = {
  placeholder: {
    name: 'Placeholder Ads',
    enabled: true,
  },
};

export const shouldShowAd = (index: number, totalItems: number): boolean => {
  if (!ADS_CONFIG.enabled) return false;
  if (totalItems < ADS_CONFIG.frequency.minContentBeforeAd) return false;
  
  return (index + 1) % ADS_CONFIG.frequency.feedInterval === 0;
};

export const getAdPlacementIndex = (contentIndex: number): number => {
  return Math.floor(contentIndex / ADS_CONFIG.frequency.feedInterval);
};
