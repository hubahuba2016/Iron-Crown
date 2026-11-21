import type { HighScoreRecord } from './types';

const STORAGE_KEY = 'iron_crown_records_v1';

const DEFAULT_RECORD: HighScoreRecord = {
  highScore: 0,
  bestDistance: 0,
  bestKills: 0,
  bestCombo: 0,
};

export function loadHighScoreRecord(): HighScoreRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RECORD };
    const parsed = JSON.parse(raw) as Partial<HighScoreRecord>;
    return {
      highScore: typeof parsed.highScore === 'number' && parsed.highScore >= 0 ? parsed.highScore : 0,
      bestDistance: typeof parsed.bestDistance === 'number' && parsed.bestDistance >= 0 ? parsed.bestDistance : 0,
      bestKills: typeof parsed.bestKills === 'number' && parsed.bestKills >= 0 ? parsed.bestKills : 0,
      bestCombo: typeof parsed.bestCombo === 'number' && parsed.bestCombo >= 0 ? parsed.bestCombo : 0,
    };
  } catch {
    return { ...DEFAULT_RECORD };
  }
}

export function saveHighScoreRecord(record: HighScoreRecord): HighScoreRecord {
  const current = loadHighScoreRecord();
  const merged: HighScoreRecord = {
    highScore: Math.max(current.highScore, Math.floor(record.highScore)),
    bestDistance: Math.max(current.bestDistance, Math.floor(record.bestDistance)),
    bestKills: Math.max(current.bestKills, Math.floor(record.bestKills)),
    bestCombo: Math.max(current.bestCombo, Math.floor(record.bestCombo)),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
  return merged;
}
