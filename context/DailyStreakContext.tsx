import React, { createContext, useContext, useState, useCallback } from 'react';

interface StreakInfo {
  currentStreak: number;
  bonusAwarded: number;
  message: string;
  isNewMilestone: boolean;
}

interface DailyStreakContextType {
  streakInfo: StreakInfo | null;
  showStreak: (info: StreakInfo) => void;
  dismissStreak: () => void;
}

const DailyStreakContext = createContext<DailyStreakContextType>({
  streakInfo: null,
  showStreak: () => {},
  dismissStreak: () => {},
});

export function DailyStreakProvider({ children }: { children: React.ReactNode }) {
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);

  const showStreak = useCallback((info: StreakInfo) => {
    if (info.bonusAwarded > 0) {
      setStreakInfo(info);
    }
  }, []);

  const dismissStreak = useCallback(() => {
    setStreakInfo(null);
  }, []);

  return (
    <DailyStreakContext.Provider value={{ streakInfo, showStreak, dismissStreak }}>
      {children}
    </DailyStreakContext.Provider>
  );
}

export function useDailyStreak() {
  return useContext(DailyStreakContext);
}
