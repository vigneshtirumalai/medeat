import { useEffect } from "react";
import { format } from "date-fns";
import {
  useGetDashboardSummary,
  useGetAdherenceSummary,
  useListMedicines,
  getGetDashboardSummaryQueryKey,
  getGetAdherenceSummaryQueryKey,
  getListMedicinesQueryKey,
} from "@workspace/api-client-react";
import {
  useAlertsContext,
  saveDismissed,
  saveSnoozed,
} from "@/contexts/alerts-context";

export type AlertItem =
  | {
      id: string;
      type: "expiry";
      medicineId: number;
      medicineName: string;
      daysRemaining: number;
    }
  | {
      id: string;
      type: "refill";
      medicineId: number;
      medicineName: string;
      pillCount: number;
      refillThreshold: number;
    }
  | {
      id: string;
      type: "missed";
      medicineId: number;
      medicineName: string;
      missedCount: number;
    };

const FIVE_MINUTES = 5 * 60 * 1000;

export function useAlerts() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: summary } = useGetDashboardSummary(
    { date: todayStr },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ date: todayStr }), staleTime: FIVE_MINUTES } }
  );
  const { data: adherence } = useGetAdherenceSummary(
    undefined,
    { query: { queryKey: getGetAdherenceSummaryQueryKey(), staleTime: FIVE_MINUTES } }
  );
  const { data: medicines } = useListMedicines(
    {},
    { query: { queryKey: getListMedicinesQueryKey({}), staleTime: FIVE_MINUTES } }
  );

  const { dismissed, setDismissed, snoozed, setSnoozed } = useAlertsContext();

  const allAlerts: AlertItem[] = [];

  for (const item of summary?.expiringSoon ?? []) {
    allAlerts.push({
      id: `expiry-${item.medicineId}`,
      type: "expiry",
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      daysRemaining: item.daysRemaining,
    });
  }

  for (const med of medicines ?? []) {
    if (med.pillCount <= med.refillThreshold) {
      allAlerts.push({
        id: `refill-${med.id}`,
        type: "refill",
        medicineId: med.id,
        medicineName: med.name,
        pillCount: med.pillCount,
        refillThreshold: med.refillThreshold,
      });
    }
  }

  for (const item of adherence?.perMedicine ?? []) {
    if (item.missed > 0) {
      allAlerts.push({
        id: `missed-${item.medicineId}`,
        type: "missed",
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        missedCount: item.missed,
      });
    }
  }

  const currentIds = new Set(allAlerts.map((a) => a.id));
  const now = Date.now();

  const cleanedDismissed = new Set([...dismissed].filter((k) => currentIds.has(k)));

  const cleanedSnoozed: Record<string, number> = {};
  for (const [id, expiresAt] of Object.entries(snoozed)) {
    if (currentIds.has(id) && expiresAt > now) {
      cleanedSnoozed[id] = expiresAt;
    }
  }

  const snoozedEntryCount = Object.keys(snoozed).length;
  const cleanedEntryCount = Object.keys(cleanedSnoozed).length;
  useEffect(() => {
    if (cleanedEntryCount < snoozedEntryCount) {
      setSnoozed(cleanedSnoozed);
      saveSnoozed(cleanedSnoozed);
    }
  }, [snoozedEntryCount, cleanedEntryCount]);

  const activeAlerts = allAlerts.filter(
    (a) => !cleanedDismissed.has(a.id) && !(a.id in cleanedSnoozed)
  );

  const dismissAlert = (id: string) => {
    const next = new Set(cleanedDismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
  };

  const dismissAll = () => {
    const next = new Set([...cleanedDismissed, ...activeAlerts.map((a) => a.id)]);
    setDismissed(next);
    saveDismissed(next);
  };

  const snoozeAlert = (id: string, hours: number) => {
    const expiresAt = Date.now() + hours * 60 * 60 * 1000;
    const next = { ...cleanedSnoozed, [id]: expiresAt };
    setSnoozed(next);
    saveSnoozed(next);
  };

  const unsnoozeAlert = (id: string) => {
    const next = { ...cleanedSnoozed };
    delete next[id];
    setSnoozed(next);
    saveSnoozed(next);
  };

  const snoozedAlerts = allAlerts
    .filter((a) => a.id in cleanedSnoozed && !cleanedDismissed.has(a.id))
    .map((a) => ({ alert: a, expiresAt: cleanedSnoozed[a.id] }));

  return {
    alerts: activeAlerts,
    totalCount: activeAlerts.length,
    snoozedAlerts,
    dismissAlert,
    dismissAll,
    snoozeAlert,
    unsnoozeAlert,
  };
}
