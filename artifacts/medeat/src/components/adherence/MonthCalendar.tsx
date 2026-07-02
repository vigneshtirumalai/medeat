import { useMemo } from "react";
import type { MonthlyAdherenceDay } from "@workspace/api-client-react";

interface MonthCalendarProps {
  year: number;
  month: number; // 1-indexed
  days: MonthlyAdherenceDay[];
  selectedDate: string | null;
  onDayClick: (date: string) => void;
}

type DayCellStatus = "all_taken" | "any_missed" | "mixed" | "no_dose" | "future";

function getDayStatus(day: MonthlyAdherenceDay, today: string): DayCellStatus {
  if (day.date > today) return "future";
  const total = day.taken + day.missed + day.skipped;
  if (total === 0) return "no_dose";
  if (day.missed > 0) return "any_missed";
  if (day.skipped > 0) return "mixed"; // skipped-only (no misses) → amber
  return "all_taken"; // taken > 0, missed === 0, skipped === 0
}

const STATUS_CLASSES: Record<DayCellStatus, string> = {
  all_taken: "bg-emerald-500 text-white",
  any_missed: "bg-red-500 text-white",
  mixed: "bg-amber-400 text-white",
  no_dose: "bg-muted text-muted-foreground",
  future: "bg-transparent text-muted-foreground/40",
};

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function MonthCalendar({ year, month, days, selectedDate, onDayClick }: MonthCalendarProps) {
  const today = new Date().toISOString().split("T")[0];

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // Map date string → MonthlyAdherenceDay for quick lookup
    const dayMap = new Map(days.map((d) => [d.date, d]));

    const cells: Array<{ date: string; dayNum: number; status: DayCellStatus } | null> = [];

    // Leading empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(null);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayData = dayMap.get(dateStr);
      const status = dayData ? getDayStatus(dayData, today) : (dateStr > today ? "future" : "no_dose");
      cells.push({ date: dateStr, dayNum: d, status });
    }

    return cells;
  }, [year, month, days, today]);

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} />;
          }
          const isSelected = selectedDate === cell.date;
          const isToday = cell.date === today;
          return (
            <button
              key={cell.date}
              onClick={() => onDayClick(cell.date)}
              disabled={cell.status === "future"}
              className={`
                relative aspect-square rounded-lg flex items-center justify-center text-xs font-medium
                transition-all duration-150 active:scale-90
                ${STATUS_CLASSES[cell.status]}
                ${isSelected ? "ring-2 ring-offset-1 ring-primary scale-105" : ""}
                ${isToday && !isSelected ? "ring-2 ring-offset-1 ring-foreground/40" : ""}
                ${cell.status === "future" ? "cursor-default" : "cursor-pointer"}
              `}
              aria-label={`${cell.date} — ${cell.status.replace(/_/g, " ")}`}
            >
              {cell.dayNum}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
        {[
          { color: "bg-emerald-500", label: "All taken" },
          { color: "bg-amber-400", label: "Skipped" },
          { color: "bg-red-500", label: "Missed" },
          { color: "bg-muted", label: "No doses" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
