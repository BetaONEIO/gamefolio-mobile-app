// Level system configuration and utilities
// Levels are based on total Points earned from engagement activities

// Points thresholds for each level
// Level 1: 0 Points
// Level 2: 100 Points
// Level 3: 500 Points
// Level 4: 1000 Points
// Level 5: 2000 Points
// Level 6: 3500 Points
// Level 7: 5500 Points
// Level 8: 8000 Points
// Level 9: 11000 Points
// Level 10: 15000 Points
// And continues to scale...

export const LEVEL_THRESHOLDS: { [level: number]: number } = {
  1: 0,
  2: 100,
  3: 500,
  4: 1000,
  5: 2000,
  6: 3500,
  7: 5500,
  8: 8000,
  9: 11000,
  10: 15000,
  11: 20000,
  12: 26000,
  13: 33000,
  14: 41000,
  15: 50000,
  16: 60000,
  17: 71000,
  18: 83000,
  19: 96000,
  20: 110000,
  21: 125000,
  22: 141000,
  23: 158000,
  24: 176000,
  25: 195000,
  26: 215000,
  27: 236000,
  28: 258000,
  29: 281000,
  30: 305000,
  31: 330000,
  32: 356000,
  33: 383000,
  34: 411000,
  35: 440000,
  36: 470000,
  37: 501000,
  38: 533000,
  39: 566000,
  40: 600000,
  41: 635000,
  42: 671000,
  43: 708000,
  44: 746000,
  45: 785000,
  46: 825000,
  47: 866000,
  48: 908000,
  49: 951000,
  50: 995000,
};

/**
 * Calculate user level based on total Points
 * @param points Total Points amount
 * @returns User level (1-50+)
 */
export function calculateLevel(points: number): number {
  if (points < 0) return 1;
  
  // Find the highest level the user has reached
  let level = 1;
  
  for (let i = 50; i >= 1; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  
  // If Points exceed level 50, calculate extended levels
  if (points >= LEVEL_THRESHOLDS[50]) {
    const pointsAbove50 = points - LEVEL_THRESHOLDS[50];
    const pointsPerLevelAbove50 = 50000; // Each level above 50 requires 50k more Points
    const additionalLevels = Math.floor(pointsAbove50 / pointsPerLevelAbove50);
    level = 50 + additionalLevels;
  }
  
  return level;
}

/**
 * Get Points required for next level
 * @param currentLevel Current user level
 * @returns Points required to reach next level
 */
export function getPointsForNextLevel(currentLevel: number): number {
  if (currentLevel >= 50) {
    // For levels above 50, each level requires 50k more Points
    return LEVEL_THRESHOLDS[50] + (currentLevel - 49) * 50000;
  }
  
  return LEVEL_THRESHOLDS[currentLevel + 1] || LEVEL_THRESHOLDS[50];
}

/**
 * Get Points progress to next level
 * @param points Total Points amount
 * @param currentLevel Current user level
 * @returns Object with current Points, Points for next level, and progress percentage
 */
export function getLevelProgress(points: number, currentLevel: number): {
  currentPoints: number;
  pointsForCurrentLevel: number;
  pointsForNextLevel: number;
  pointsRemaining: number;
  progressPercent: number;
} {
  const pointsForCurrentLevel = currentLevel >= 50 
    ? LEVEL_THRESHOLDS[50] + (currentLevel - 50) * 50000
    : LEVEL_THRESHOLDS[currentLevel];
    
  const pointsForNextLevel = getPointsForNextLevel(currentLevel);
  const pointsIntoCurrentLevel = points - pointsForCurrentLevel;
  const pointsNeededForLevel = pointsForNextLevel - pointsForCurrentLevel;
  const progressPercent = Math.min(100, Math.max(0, (pointsIntoCurrentLevel / pointsNeededForLevel) * 100));
  
  return {
    currentPoints: points,
    pointsForCurrentLevel,
    pointsForNextLevel,
    pointsRemaining: pointsForNextLevel - points,
    progressPercent,
  };
}
