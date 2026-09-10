import { createContext, PropsWithChildren, useEffect, useState } from 'react';

import { mockSettings } from '@/data/mockSettings';
import { clearSettings, loadSettings, saveSettings } from '@/storage/settingsStorage';
import { TrainingDifficulty, TrainingSettings } from '@/types/settings';

interface SettingsContextValue {
  settings: TrainingSettings;
  isHydrated: boolean;
  setDifficulty: (difficulty: TrainingDifficulty) => void;
  setPreference: (name: keyof Omit<TrainingSettings, 'difficulty'>, value: boolean) => void;
  resetSettings: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState(mockSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    void loadSettings().then((loadedSettings) => {
      if (isCancelled) return;
      setSettings(loadedSettings);
      setIsHydrated(true);
    });
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    if (isHydrated) void saveSettings(settings);
  }, [isHydrated, settings]);

  function setDifficulty(difficulty: TrainingDifficulty) {
    setSettings((current) => ({ ...current, difficulty }));
  }

  function setPreference(name: keyof Omit<TrainingSettings, 'difficulty'>, value: boolean) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  async function resetSettings() {
    await clearSettings();
    setSettings(mockSettings);
  }

  return <SettingsContext.Provider value={{ settings, isHydrated, setDifficulty, setPreference, resetSettings }}>{children}</SettingsContext.Provider>;
}