import { Router } from "express";
import { db, medicinesTable, doseLogsTable, foodLogsTable, userProfileTable, groceryItemsTable } from "@workspace/db";
import { eq, gte, and, lte, desc } from "drizzle-orm";

const router = Router();

function getDateParam(query: Record<string, unknown>): string {
  const d = query.date;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date().toISOString().split("T")[0];
}

function getMonthParam(query: Record<string, unknown>): string | null {
  const m = query.month;
  if (typeof m !== "string") return null;
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const mon = parseInt(m.split("-")[1], 10);
  if (mon < 1 || mon > 12) return null;
  return m;
}

function logDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

router.get("/summary/dashboard", async (req, res) => {
  try {
    const date = getDateParam(req.query as Record<string, unknown>);

    const [allMedicines, foodLogs, groceryAll, profileRows] = await Promise.all([
      db.select().from(medicinesTable),
      db.select().from(foodLogsTable).where(eq(foodLogsTable.date, date)),
      db.select().from(groceryItemsTable),
      db.select().from(userProfileTable),
    ]);

    const activeMedicines = allMedicines.filter((m) => m.status === "active");

    const todayDosesDue = activeMedicines.reduce(
      (acc, m) => acc + Math.max(1, (m.timesOfDay ?? []).length),
      0
    );

    const todayStart = new Date(date + "T00:00:00.000Z");
    const todayEnd = new Date(date + "T23:59:59.999Z");

    const todayLogs = await db
      .select()
      .from(doseLogsTable)
      .where(gte(doseLogsTable.takenAt, todayStart));

    const todayDosesTaken = todayLogs.filter(
      (l) => l.status === "taken" && l.takenAt <= todayEnd
    ).length;

    const medicinesNeedingRefill = activeMedicines.filter(
      (m) => m.pillCount <= (m.refillThreshold ?? 7)
    ).length;

    const caloriesConsumed = foodLogs.reduce((acc, f) => acc + (f.calories ?? 0), 0);
    const caloriesGoal = profileRows[0]?.calorieGoal ?? 2000;
    const groceryItemsCount = groceryAll.filter((g) => !g.checked).length;

    const upcomingDoses = activeMedicines
      .filter((m) => (m.timesOfDay ?? []).length > 0)
      .flatMap((m) =>
        (m.timesOfDay ?? []).map((time) => ({
          medicineId: m.id,
          medicineName: m.name,
          dose: m.dose,
          scheduledTime: time,
          pillCount: m.pillCount,
          foodInstruction: m.foodInstruction,
        }))
      )
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
      .slice(0, 5);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setDate(today.getDate() + 30);

    const msPerDay = 1000 * 60 * 60 * 24;

    const expiringSoon = activeMedicines
      .filter((m) => {
        if (!m.prescriptionExpiry) return false;
        const expiry = new Date(m.prescriptionExpiry);
        expiry.setHours(0, 0, 0, 0);
        // Only future expirations within 30 days (today inclusive)
        return expiry >= today && expiry <= thirtyDaysOut;
      })
      .map((m) => {
        const expiry = new Date(m.prescriptionExpiry!);
        expiry.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / msPerDay);
        return {
          medicineId: m.id,
          medicineName: m.name,
          expiryDate: m.prescriptionExpiry!,
          daysRemaining,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.json({
      todayDosesDue,
      todayDosesTaken,
      medicinesNeedingRefill,
      activeMedicines: activeMedicines.length,
      caloriesConsumed,
      caloriesGoal,
      groceryItemsCount,
      upcomingDoses,
      expiringSoon,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/summary/adherence", async (req, res) => {
  try {
    const month = getMonthParam(req.query as Record<string, unknown>);

    const medicines = await db
      .select()
      .from(medicinesTable)
      .where(eq(medicinesTable.status, "active"));

    // --- 7-day window (always returned) ---
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const allLogs = await db
      .select()
      .from(doseLogsTable)
      .where(gte(doseLogsTable.takenAt, sevenDaysAgo))
      .orderBy(desc(doseLogsTable.takenAt));

    const totalTaken = allLogs.filter((l) => l.status === "taken").length;
    const totalMissed = allLogs.filter((l) => l.status === "missed").length;
    const totalSkipped = allLogs.filter((l) => l.status === "skipped").length;
    const totalDoses = totalTaken + totalMissed + totalSkipped;
    const adherencePercent = totalDoses > 0 ? (totalTaken / totalDoses) * 100 : 100;

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });

    let overallStreakDays = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      const dayLogs = allLogs.filter((l) => logDate(l.takenAt) === last7Days[i]);
      if (dayLogs.some((l) => l.status === "taken")) {
        overallStreakDays++;
      } else {
        break;
      }
    }

    const perMedicine = medicines.map((med) => {
      const medLogs = allLogs.filter((l) => l.medicineId === med.id);
      const taken = medLogs.filter((l) => l.status === "taken").length;
      const missed = medLogs.filter((l) => l.status === "missed").length;
      const skipped = medLogs.filter((l) => l.status === "skipped").length;

      let streakDays = 0;
      for (let i = last7Days.length - 1; i >= 0; i--) {
        const dayLogs = medLogs.filter((l) => logDate(l.takenAt) === last7Days[i]);
        if (dayLogs.some((l) => l.status === "taken")) {
          streakDays++;
        } else {
          break;
        }
      }

      const dayStatuses = last7Days.map((day) => {
        const dayLog = medLogs.find((l) => logDate(l.takenAt) === day);
        return dayLog ? dayLog.status : "no_dose";
      });

      return {
        medicineId: med.id,
        medicineName: med.name,
        taken,
        missed,
        skipped,
        streakDays,
        last7Days: dayStatuses,
      };
    });

    // --- Monthly heatmap (only when month param provided) ---
    let monthlyDays: {
      date: string;
      taken: number;
      missed: number;
      skipped: number;
      medicines: { medicineId: number; medicineName: string; status: string }[];
    }[] | null = null;
    let monthlyAdherencePercent: number | null = null;
    let monthlyStreakDays: number | null = null;

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const monthStart = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

      const monthLogs = await db
        .select()
        .from(doseLogsTable)
        .where(and(gte(doseLogsTable.takenAt, monthStart), lte(doseLogsTable.takenAt, monthEnd)))
        .orderBy(desc(doseLogsTable.takenAt));

      // Build days array for the entire month
      const daysInMonth = monthEnd.getUTCDate();
      const allMedicinesForMonth = await db.select().from(medicinesTable);

      monthlyDays = Array.from({ length: daysInMonth }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
        const dayLogs = monthLogs.filter((l) => logDate(l.takenAt) === date);

        const medicinesForDay = allMedicinesForMonth.map((med) => {
          const medDayLog = dayLogs.find((l) => l.medicineId === med.id);
          const status = medDayLog ? medDayLog.status : "no_dose";
          return { medicineId: med.id, medicineName: med.name, status };
        });

        const taken = dayLogs.filter((l) => l.status === "taken").length;
        const missed = dayLogs.filter((l) => l.status === "missed").length;
        const skipped = dayLogs.filter((l) => l.status === "skipped").length;

        return { date, taken, missed, skipped, medicines: medicinesForDay };
      });

      // Monthly adherence %
      const mTaken = monthLogs.filter((l) => l.status === "taken").length;
      const mMissed = monthLogs.filter((l) => l.status === "missed").length;
      const mSkipped = monthLogs.filter((l) => l.status === "skipped").length;
      const mTotal = mTaken + mMissed + mSkipped;
      monthlyAdherencePercent = mTotal > 0 ? Math.round((mTaken / mTotal) * 100) : 100;

      // Monthly streak — consecutive days (from most recent backwards) with at least one "taken"
      const today = new Date().toISOString().split("T")[0];
      monthlyStreakDays = 0;
      for (let i = daysInMonth - 1; i >= 0; i--) {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
        if (date > today) continue; // don't count future days
        const dayLogs = monthLogs.filter((l) => logDate(l.takenAt) === date);
        if (dayLogs.some((l) => l.status === "taken")) {
          monthlyStreakDays++;
        } else {
          break;
        }
      }
    }

    res.json({
      overallStreakDays,
      totalDosesTaken: totalTaken,
      totalDosesMissed: totalMissed,
      adherencePercent: Math.round(adherencePercent),
      perMedicine,
      monthlyAdherencePercent,
      monthlyStreakDays,
      monthlyDays,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get adherence summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/summary/macros", async (req, res) => {
  try {
    const date = getDateParam(req.query as Record<string, unknown>);

    const [profileRows, foodLogs] = await Promise.all([
      db.select().from(userProfileTable),
      db.select().from(foodLogsTable).where(eq(foodLogsTable.date, date)),
    ]);

    const profile = profileRows[0];
    const caloriesGoal = profile?.calorieGoal ?? 2000;
    const proteinGoalG = profile?.proteinGoalG ?? 120;
    const carbsGoalG = profile?.carbsGoalG ?? 250;
    const fatGoalG = profile?.fatGoalG ?? 65;

    const totals = foodLogs.reduce(
      (acc, f) => ({
        calories: acc.calories + (f.calories ?? 0),
        protein: acc.protein + (f.proteinG ?? 0),
        carbs: acc.carbs + (f.carbsG ?? 0),
        fat: acc.fat + (f.fatG ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const;
    const mealBreakdown = mealTypes.map((mealType) => {
      const mealLogs = foodLogs.filter((f) => f.mealType === mealType);
      return {
        mealType,
        calories: mealLogs.reduce((acc, f) => acc + (f.calories ?? 0), 0),
        items: mealLogs.length,
      };
    });

    res.json({
      date,
      caloriesConsumed: totals.calories,
      caloriesGoal,
      caloriesRemaining: Math.max(0, caloriesGoal - totals.calories),
      proteinConsumedG: totals.protein,
      proteinGoalG,
      carbsConsumedG: totals.carbs,
      carbsGoalG,
      fatConsumedG: totals.fat,
      fatGoalG,
      mealBreakdown,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get macros summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
