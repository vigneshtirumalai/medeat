import type { MonthlyAdherenceDay } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, MinusCircle, Circle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface DayDrillDownProps {
  day: MonthlyAdherenceDay;
}

const STATUS_CONFIG = {
  taken: { icon: CheckCircle2, className: "text-emerald-500", label: "Taken" },
  missed: { icon: XCircle, className: "text-red-500", label: "Missed" },
  skipped: { icon: MinusCircle, className: "text-amber-500", label: "Skipped" },
  no_dose: { icon: Circle, className: "text-muted-foreground/40", label: "No dose" },
} as const;

export function DayDrillDown({ day }: DayDrillDownProps) {
  const hasDoses = day.medicines.some((m) => m.status !== "no_dose");

  return (
    <div className="overflow-hidden">
      <div
        className="animate-in slide-in-from-top-2 fade-in duration-200"
      >
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              {format(parseISO(day.date), "EEEE, MMMM d")}
            </h3>
            <div className="flex gap-3 text-xs">
              {day.taken > 0 && (
                <span className="text-emerald-600 font-medium">{day.taken} taken</span>
              )}
              {day.missed > 0 && (
                <span className="text-red-500 font-medium">{day.missed} missed</span>
              )}
              {day.skipped > 0 && (
                <span className="text-amber-500 font-medium">{day.skipped} skipped</span>
              )}
            </div>
          </div>

          {!hasDoses ? (
            <p className="text-sm text-muted-foreground">No doses were scheduled on this day.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {day.medicines
                .map((m) => {
                  const cfg = STATUS_CONFIG[m.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.no_dose;
                  const Icon = cfg.icon;
                  return (
                    <div key={m.medicineId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.className}`} />
                      <span className="text-sm flex-1 truncate">{m.medicineName}</span>
                      <span className={`text-xs font-medium ${cfg.className}`}>{cfg.label}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
