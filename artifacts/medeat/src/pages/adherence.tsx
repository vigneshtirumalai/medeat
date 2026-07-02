import { useState, useCallback } from "react";
import { format, subDays, addMonths, subMonths } from "date-fns";
import {
  useGetAdherenceSummary,
  getGetAdherenceSummaryQueryKey,
  type MonthlyAdherenceDay,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, TrendingUp, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { Link } from "wouter";
import { MonthCalendar } from "@/components/adherence/MonthCalendar";
import { DayDrillDown } from "@/components/adherence/DayDrillDown";

function formatMonthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function Adherence() {
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthParam = formatMonthParam(viewMonth);

  const { data: summary, isLoading } = useGetAdherenceSummary(
    { month: monthParam },
    { query: { queryKey: getGetAdherenceSummaryQueryKey({ month: monthParam }) } }
  );

  const goToPrevMonth = useCallback(() => {
    setViewMonth((d) => subMonths(d, 1));
    setSelectedDate(null);
  }, []);

  const goToNextMonth = useCallback(() => {
    const next = addMonths(viewMonth, 1);
    const now = new Date();
    if (next <= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setViewMonth(next);
      setSelectedDate(null);
    }
  }, [viewMonth]);

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  }, []);

  const isCurrentMonth =
    viewMonth.getFullYear() === new Date().getFullYear() &&
    viewMonth.getMonth() === new Date().getMonth();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) return null;

  const monthlyDays: MonthlyAdherenceDay[] = summary.monthlyDays ?? [];
  const monthlyPct = summary.monthlyAdherencePercent ?? summary.adherencePercent;
  const monthlyStreak = summary.monthlyStreakDays ?? summary.overallStreakDays;

  const selectedDayData = selectedDate
    ? monthlyDays.find((d) => d.date === selectedDate) ?? null
    : null;

  return (
    <div className="flex-1 flex flex-col p-4 gap-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mt-4">
        <Link
          href="/medicines"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-10 w-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Adherence</h1>
          <p className="text-sm text-muted-foreground">Your medicine track record</p>
        </div>
      </div>

      {/* Month Navigation */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Nav row */}
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevMonth}
              className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="font-semibold text-base">
              {format(viewMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Monthly badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-primary/10 rounded-xl p-3">
              <TrendingUp className="w-6 h-6 text-primary flex-shrink-0" />
              <div>
                <div className="text-xl font-bold text-primary">{monthlyPct}%</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                  This month
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-amber-500/10 rounded-xl p-3">
              <Flame className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <div>
                <div className="text-xl font-bold text-amber-600">{monthlyStreak}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                  Day streak
                </div>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <MonthCalendar
            year={viewMonth.getFullYear()}
            month={viewMonth.getMonth() + 1}
            days={monthlyDays}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
          />
        </CardContent>
      </Card>

      {/* Drill-down panel — slides in below calendar when a day is selected */}
      {selectedDayData && (
        <DayDrillDown day={selectedDayData} />
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium">Last 7 days</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Overall 7-day stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-primary">{summary.adherencePercent}%</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">7-day avg</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-emerald-600">{summary.totalDosesTaken}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Taken</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-lg font-bold text-red-500">{summary.totalDosesMissed}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Missed</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-medicine 7-day dot rows */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base">By Medicine</h2>
        {summary.perMedicine.length === 0 && (
          <p className="text-sm text-muted-foreground">No active medicines to track.</p>
        )}
        {summary.perMedicine.map((med) => (
          <Card key={med.medicineId}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm truncate pr-2">{med.medicineName}</h3>
                <span className="text-xs text-primary font-medium whitespace-nowrap">
                  {med.streakDays}d streak
                </span>
              </div>
              <div className="flex justify-between items-center">
                {med.last7Days.map((status, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {format(subDays(new Date(), 6 - i), "EEE").charAt(0)}
                    </span>
                    <div
                      className={`w-6 h-6 rounded-full ${
                        status === "taken"
                          ? "bg-emerald-500"
                          : status === "missed"
                          ? "bg-red-500"
                          : status === "skipped"
                          ? "bg-amber-400"
                          : "bg-muted"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
