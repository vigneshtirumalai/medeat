import { format } from "date-fns";
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey,
  useTakeDose,
  TakeDoseBodyStatus
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Pill, Utensils, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Home() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { data: summary, isLoading } = useGetDashboardSummary(
    { date: todayStr }, 
    { query: { queryKey: getGetDashboardSummaryQueryKey({ date: todayStr }) } }
  );

  const queryClient = useQueryClient();
  const takeDose = useTakeDose();

  const handleTakeDose = (medicineId: number, scheduledTime: string) => {
    takeDose.mutate({
      id: medicineId,
      data: {
        status: TakeDoseBodyStatus.taken,
        scheduledTime,
      }
    }, {
      onSuccess: () => {
        toast.success("Dose logged!");
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ date: todayStr }) });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) return null;

  const calPercent = summary.caloriesGoal > 0 ? (summary.caloriesConsumed / summary.caloriesGoal) * 100 : 0;
  const dosesPercent = summary.todayDosesDue > 0 ? (summary.todayDosesTaken / summary.todayDosesDue) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col p-4 gap-6 animate-in fade-in zoom-in-95 duration-300">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Good Morning.</h1>
        <p className="text-muted-foreground text-sm">Here's your health summary for today.</p>
      </header>

      {/* Daily Rings / Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" className="stroke-primary/20" strokeWidth="6" />
                <circle cx="32" cy="32" r="28" fill="none" className="stroke-primary" strokeWidth="6" strokeDasharray="175" strokeDashoffset={175 - (175 * dosesPercent) / 100} strokeLinecap="round" />
              </svg>
              <Pill className="absolute w-5 h-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{summary.todayDosesTaken}/{summary.todayDosesDue}</p>
              <p className="text-xs font-medium text-primary/70 uppercase tracking-wider">Doses</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/10 border-secondary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" className="stroke-secondary/30" strokeWidth="6" />
                <circle cx="32" cy="32" r="28" fill="none" className="stroke-secondary" strokeWidth="6" strokeDasharray="175" strokeDashoffset={175 - (175 * Math.min(100, calPercent)) / 100} strokeLinecap="round" />
              </svg>
              <Utensils className="absolute w-5 h-5 text-secondary-foreground" />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-secondary-foreground">{summary.caloriesConsumed}</p>
              <p className="text-xs font-medium text-secondary-foreground/70 uppercase tracking-wider">Calories</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Doses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Upcoming Doses</h2>
        </div>
        
        {summary.upcomingDoses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-primary/50" />
              <p className="text-sm">All caught up for now!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {summary.upcomingDoses.map((dose, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="flex items-stretch border-l-4 border-l-primary">
                  <div className="p-3 bg-primary/5 flex items-center justify-center min-w-[70px]">
                    <span className="font-bold text-primary">{dose.scheduledTime}</span>
                  </div>
                  <div className="flex-1 p-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{dose.medicineName}</h3>
                      <p className="text-sm text-muted-foreground">{dose.dose} • {dose.foodInstruction.replace("_", " ")}</p>
                    </div>
                    <Button size="sm" onClick={() => handleTakeDose(dose.medicineId, dose.scheduledTime)}>
                      Take
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
