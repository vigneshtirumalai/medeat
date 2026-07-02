import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export const STORAGE_KEY = "notification-center-dismissed";
export const SNOOZE_STORAGE_KEY = "notification-center-snoozed";

export type SnoozedMap = Record<string, number>;

export function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
  }
  return new Set();
}

export function saveDismissed(keys: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
  }
}

export function loadSnoozed(): SnoozedMap {
  try {
    const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SnoozedMap;
  } catch {
  }
  return {};
}

export function saveSnoozed(map: SnoozedMap): void {
  try {
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}

interface AlertsContextValue {
  dismissed: Set<string>;
  setDismissed: (next: Set<string>) => void;
  snoozed: SnoozedMap;
  setSnoozed: (next: SnoozedMap) => void;
  syncTick: number;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [snoozed, setSnoozed] = useState<SnoozedMap>(loadSnoozed);
  const [syncTick, setSyncTick] = useState(0);

  const handleStorage = useCallback((event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      setDismissed(loadDismissed());
      setSyncTick((n) => n + 1);
    }
    if (event.key === SNOOZE_STORAGE_KEY) {
      setSnoozed(loadSnoozed());
      setSyncTick((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [handleStorage]);

  return (
    <AlertsContext.Provider value={{ dismissed, setDismissed, snoozed, setSnoozed, syncTick }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlertsContext(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlertsContext must be used inside AlertsProvider");
  }
  return ctx;
}
