import { useState, useRef, useEffect } from "react";
import { Bell, X, CalendarClock, AlertCircle, TrendingDown, ChevronRight, Clock, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAlerts, type AlertItem } from "@/hooks/use-alerts";
import { useAlertsContext } from "@/contexts/alerts-context";
import { useLocation } from "wouter";

const SNOOZE_OPTIONS: { label: string; hours: number }[] = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

function SnoozeMenu({
  onSnooze,
  colorClass,
}: {
  onSnooze: (hours: number) => void;
  colorClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState("1");
  const [customHours, setCustomHours] = useState("0");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCustomSnooze = () => {
    const days = Math.max(0, parseInt(customDays, 10) || 0);
    const hours = Math.min(23, Math.max(0, parseInt(customHours, 10) || 0));
    const totalHours = days * 24 + hours;
    if (totalHours <= 0) return;
    onSnooze(totalHours);
    setOpen(false);
    setShowCustom(false);
    setCustomDays("1");
    setCustomHours("0");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((v) => !v); setShowCustom(false); }}
        className={cn("ml-1 transition-colors", colorClass)}
        aria-label="Snooze alert"
        title="Snooze"
      >
        <Clock className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-1 pb-1">
            Snooze for
          </p>
          {SNOOZE_OPTIONS.map(({ label, hours }) => (
            <button
              key={hours}
              onClick={() => {
                onSnooze(hours);
                setOpen(false);
              }}
              className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors text-foreground"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="w-full text-left text-xs px-3 py-1.5 hover:bg-muted transition-colors text-foreground border-t border-border/50 mt-1 pt-1.5"
          >
            Custom…
          </button>
          {showCustom && (
            <div className="px-3 pb-2 pt-1 space-y-1.5">
              <div className="flex gap-1.5 items-center">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Days</label>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                    className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <button
                onClick={handleCustomSnooze}
                disabled={(parseInt(customDays, 10) || 0) * 24 + (parseInt(customHours, 10) || 0) <= 0}
                className="w-full text-xs bg-primary text-primary-foreground rounded px-2 py-1 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Snooze
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  onDismiss,
  onSnooze,
  onNavigate,
}: {
  alert: AlertItem;
  onDismiss: () => void;
  onSnooze: (hours: number) => void;
  onNavigate: () => void;
}) {
  if (alert.type === "expiry") {
    const urgent = alert.daysRemaining < 7;
    return (
      <div className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        urgent
          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
          : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
      )}>
        <CalendarClock className={cn(
          "w-4 h-4 mt-0.5 flex-shrink-0",
          urgent ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-semibold truncate",
            urgent ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"
          )}>
            {alert.medicineName}
          </p>
          <p className={cn(
            "text-xs mt-0.5",
            urgent ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
          )}>
            {alert.daysRemaining === 0
              ? "Expires today — Renew now"
              : alert.daysRemaining === 1
              ? "Expires in 1 day — Renew now"
              : `Prescription expires in ${alert.daysRemaining} days`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onNavigate}
            className={cn(
              "text-xs font-semibold underline underline-offset-2",
              urgent ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
            )}
            aria-label="Go to Medicine Cabinet"
          >
            View
          </button>
          <SnoozeMenu
            onSnooze={onSnooze}
            colorClass={
              urgent
                ? "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
                : "text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
            }
          />
          <button
            onClick={onDismiss}
            className={cn(
              "ml-0.5 transition-colors",
              urgent
                ? "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
                : "text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
            )}
            aria-label="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (alert.type === "refill") {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg border bg-destructive/5 border-destructive/20">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive truncate">{alert.medicineName}</p>
          <p className="text-xs text-destructive/80 mt-0.5">
            Only {alert.pillCount} pill{alert.pillCount !== 1 ? "s" : ""} left — running low
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onNavigate}
            className="text-xs font-semibold text-destructive underline underline-offset-2"
            aria-label="Go to Medicine Cabinet"
          >
            View
          </button>
          <SnoozeMenu
            onSnooze={onSnooze}
            colorClass="text-destructive/50 hover:text-destructive transition-colors"
          />
          <button
            onClick={onDismiss}
            className="ml-0.5 text-destructive/50 hover:text-destructive transition-colors"
            aria-label="Dismiss alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
      <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 truncate">{alert.medicineName}</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
          {alert.missedCount} dose{alert.missedCount !== 1 ? "s" : ""} missed in the last 7 days
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onNavigate}
          className="text-xs font-semibold text-blue-700 dark:text-blue-400 underline underline-offset-2"
          aria-label="Go to Adherence"
        >
          View
        </button>
        <SnoozeMenu
          onSnooze={onSnooze}
          colorClass="text-blue-500/60 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
        />
        <button
          onClick={onDismiss}
          className="ml-0.5 text-blue-500/60 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function formatSnoozeRemaining(expiresAt: number): string {
  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) return "expiring soon";
  const hoursLeft = msLeft / (1000 * 60 * 60);
  if (hoursLeft < 1) return "less than 1 hour left";
  if (hoursLeft < 24) {
    const h = Math.ceil(hoursLeft);
    return `${h} more hour${h !== 1 ? "s" : ""}`;
  }
  const daysLeft = Math.ceil(hoursLeft / 24);
  return `${daysLeft} more day${daysLeft !== 1 ? "s" : ""}`;
}

function SnoozedSection({
  snoozedAlerts,
  onUnsnooze,
  onDismiss,
}: {
  snoozedAlerts: { alert: AlertItem; expiresAt: number }[];
  onUnsnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  if (snoozedAlerts.length === 0) return null;

  return (
    <div className="border-t mt-4 pt-3">
      <button
        className="w-full flex items-center justify-between px-0.5 py-1 group"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Snoozed ({snoozedAlerts.length})
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {snoozedAlerts.map(({ alert, expiresAt }) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40"
            >
              <Clock className="w-4 h-4 flex-shrink-0 text-muted-foreground/60" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate">
                  {alert.medicineName}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Snoozed for {formatSnoozeRemaining(expiresAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => onUnsnooze(alert.id)}
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
                  aria-label={`Un-snooze ${alert.medicineName}`}
                >
                  Un-snooze
                </button>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  aria-label={`Dismiss ${alert.medicineName}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { alerts, totalCount, snoozedAlerts, dismissAlert, dismissAll, snoozeAlert, unsnoozeAlert } = useAlerts();
  // Subscribing to syncTick ensures this component (and its portal-rendered
  // SheetContent) re-renders whenever a cross-tab storage event fires, keeping
  // the open panel in sync with dismiss/snooze actions made in other tabs.
  const { syncTick } = useAlertsContext();
  const [, navigate] = useLocation();

  void syncTick;

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const getAlertPath = (alert: AlertItem) => {
    if (alert.type === "missed") return "/medicines/adherence";
    return "/medicines";
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative p-2 rounded-full hover:bg-muted transition-colors"
          aria-label={`Notifications${totalCount > 0 ? ` — ${totalCount} active` : ""}`}
        >
          <Bell className="w-5 h-5 text-foreground" strokeWidth={2} />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 animate-in zoom-in-50 duration-200">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
            {alerts.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={dismissAll}
              >
                Dismiss all
              </Button>
            )}
          </div>
          {totalCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCount} active alert{totalCount !== 1 ? "s" : ""}
            </p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col h-full">
              <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16 text-center px-6">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1">No active health alerts right now.</p>
                </div>
              </div>
              {snoozedAlerts.length > 0 && (
                <div className="px-4 pb-4">
                  <SnoozedSection
                    snoozedAlerts={snoozedAlerts}
                    onUnsnooze={unsnoozeAlert}
                    onDismiss={dismissAlert}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {alerts.some(a => a.type === "expiry") && (
                <div className="mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
                    Expiring Prescriptions
                  </p>
                  <div className="space-y-2">
                    {alerts
                      .filter(a => a.type === "expiry")
                      .map(alert => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          onDismiss={() => dismissAlert(alert.id)}
                          onSnooze={(days) => snoozeAlert(alert.id, days)}
                          onNavigate={() => handleNavigate(getAlertPath(alert))}
                        />
                      ))}
                  </div>
                </div>
              )}

              {alerts.some(a => a.type === "refill") && (
                <div className="mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5 mt-3">
                    Low Stock
                  </p>
                  <div className="space-y-2">
                    {alerts
                      .filter(a => a.type === "refill")
                      .map(alert => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          onDismiss={() => dismissAlert(alert.id)}
                          onSnooze={(days) => snoozeAlert(alert.id, days)}
                          onNavigate={() => handleNavigate(getAlertPath(alert))}
                        />
                      ))}
                  </div>
                </div>
              )}

              {alerts.some(a => a.type === "missed") && (
                <div className="mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5 mt-3">
                    Missed Doses
                  </p>
                  <div className="space-y-2">
                    {alerts
                      .filter(a => a.type === "missed")
                      .map(alert => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          onDismiss={() => dismissAlert(alert.id)}
                          onSnooze={(days) => snoozeAlert(alert.id, days)}
                          onNavigate={() => handleNavigate(getAlertPath(alert))}
                        />
                      ))}
                  </div>
                </div>
              )}

              <SnoozedSection
                snoozedAlerts={snoozedAlerts}
                onUnsnooze={unsnoozeAlert}
                onDismiss={dismissAlert}
              />

              <div className="pt-3 border-t mt-4">
                <button
                  onClick={() => handleNavigate("/medicines")}
                  className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-1 rounded"
                >
                  <span>View Medicine Cabinet</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleNavigate("/medicines/adherence")}
                  className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-1 rounded"
                >
                  <span>View Adherence History</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
