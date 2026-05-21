import { useState, useEffect } from 'react';

let currentBadgeCount = 0;
const listeners = new Set<(count: number) => void>();

export const badgeManager = {
  getBadgeCount: () => currentBadgeCount,
  increment: () => {
    currentBadgeCount += 1;
    listeners.forEach((listener) => listener(currentBadgeCount));
  },
  reset: () => {
    currentBadgeCount = 0;
    listeners.forEach((listener) => listener(currentBadgeCount));
  },
  addListener: (listener: (count: number) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useBadgeCount() {
  const [count, setCount] = useState(currentBadgeCount);

  useEffect(() => {
    // Sync initially in case it changed before component mounted
    setCount(badgeManager.getBadgeCount());
    
    return badgeManager.addListener((newCount) => {
      setCount(newCount);
    });
  }, []);

  return count;
}
