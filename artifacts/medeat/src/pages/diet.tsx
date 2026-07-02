import { useState, useRef } from "react";
import { format, subDays, addDays } from "date-fns";
import {
  useGetMacrosSummary,
  getGetMacrosSummaryQueryKey,
  useListFoodLogs,
  getListFoodLogsQueryKey,
  useDeleteFoodLog,
  useCreateFoodLog,
  useGetDietChart,
  getGetDietChartQueryKey,
  useUploadDietChart,
  useGetDietChartSuggestions,
  getGetDietChartSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Utensils, Trash2, ChevronLeft, ChevronRight, Upload, Sparkles, FileText, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AddFoodDrawer } from "@/components/diet/AddFoodDrawer";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Diet() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useGetMacrosSummary(
    { date: dateStr },
    { query: { queryKey: getGetMacrosSummaryQueryKey({ date: dateStr }) } }
  );
  const { data: foods, isLoading: loadingFoods } = useListFoodLogs(
    { date: dateStr },
    { query: { queryKey: getListFoodLogsQueryKey({ date: dateStr }) } }
  );
  const { data: dietChart } = useGetDietChart({
    query: { queryKey: getGetDietChartQueryKey() },
  });
  const { data: suggestions, isLoading: loadingSuggestions } = useGetDietChartSuggestions(
    { date: dateStr },
    { query: { queryKey: getGetDietChartSuggestionsQueryKey({ date: dateStr }), enabled: !!dietChart } }
  );

  const uploadChart = useUploadDietChart();
  const deleteFood = useDeleteFoodLog();
  const createFood = useCreateFoodLog();

  const handleLogSuggestion = (s: { name: string; mealType: string; calories: number; proteinG: number; carbsG: number; fatG: number }) => {
    createFood.mutate(
      {
        data: {
          foodName: s.name,
          mealType: s.mealType as "breakfast" | "lunch" | "dinner" | "snack",
          calories: s.calories,
          proteinG: s.proteinG,
          carbsG: s.carbsG,
          fatG: s.fatG,
          date: dateStr,
          servingSize: "1 serving",
        },
      },
      {
        onSuccess: () => {
          toast.success(`${s.name} logged!`);
          queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: dateStr }) });
          queryClient.invalidateQueries({ queryKey: getGetMacrosSummaryQueryKey({ date: dateStr }) });
          queryClient.invalidateQueries({ queryKey: getGetDietChartSuggestionsQueryKey({ date: dateStr }) });
        },
        onError: () => toast.error("Failed to log meal"),
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this food log?")) {
      deleteFood.mutate(
        { id },
        {
          onSuccess: () => {
            toast.success("Food log deleted");
            queryClient.invalidateQueries({ queryKey: getGetMacrosSummaryQueryKey({ date: dateStr }) });
            queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: dateStr }) });
            queryClient.invalidateQueries({ queryKey: getGetDietChartSuggestionsQueryKey({ date: dateStr }) });
          },
        }
      );
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    try {
      const pdfDataUrl = await toBase64(file);
      await uploadChart.mutateAsync(
        { data: { pdfDataUrl } },
        {
          onSuccess: () => {
            toast.success("Diet chart loaded — targets updated");
            queryClient.invalidateQueries({ queryKey: getGetDietChartQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetMacrosSummaryQueryKey({ date: dateStr }) });
            queryClient.invalidateQueries({ queryKey: getGetDietChartSuggestionsQueryKey({ date: dateStr }) });
          },
          onError: () => {
            toast.error("Could not read the PDF — make sure it's a diet chart");
          },
        }
      );
    } catch {
      toast.error("Failed to read the file");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const today = new Date();
  const isToday = format(today, "yyyy-MM-dd") === dateStr;
  const maxDate = addDays(today, 7);
  const isMaxDate = selectedDate >= maxDate;

  const caloriesGoal = dietChart ? dietChart.caloriesKcal : (summary?.caloriesGoal ?? 2000);
  const proteinGoal = dietChart ? dietChart.proteinG : (summary?.proteinGoalG ?? 120);
  const carbsGoal = dietChart ? dietChart.carbsG : (summary?.carbsGoalG ?? 250);
  const fatGoal = dietChart ? dietChart.fatG : (summary?.fatGoalG ?? 65);

  const mealTypeLabel: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diet</h1>
          <p className="text-sm text-muted-foreground">Your daily nutrition</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="icon"
            variant="outline"
            className="rounded-full shadow-sm hover:shadow transition-all"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadChart.isPending}
            title="Upload diet chart PDF"
          >
            {uploadChart.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
          </Button>
          <AddFoodDrawer date={selectedDate}>
            <Button size="icon" variant="secondary" className="rounded-full shadow-sm hover:shadow transition-all">
              <Plus className="w-5 h-5" />
            </Button>
          </AddFoodDrawer>
        </div>
      </div>

      {dietChart && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs cursor-pointer hover:bg-green-100 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          title="Tap to upload a new diet chart"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Diet chart loaded — targets updated</span>
          <Upload className="w-3 h-3 ml-auto opacity-50" />
        </div>
      )}

      <div className="flex items-center justify-between bg-card p-1 rounded-lg border shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium">{isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}</span>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} disabled={isMaxDate}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {loadingSummary || loadingFoods ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : summary ? (
        <>
          <Card className="bg-secondary text-secondary-foreground shadow-md border-transparent overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <CardContent className="p-6 flex flex-col gap-4 relative z-10">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-4xl font-bold tracking-tight">{Math.round(summary.caloriesConsumed)}</div>
                  <div className="text-xs opacity-80 uppercase tracking-wider font-bold mt-1">Calories Eaten</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold opacity-95">{Math.max(0, Math.round(caloriesGoal - summary.caloriesConsumed))}</div>
                  <div className="text-xs opacity-75 uppercase tracking-wider font-bold mt-1">Remaining</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-secondary-foreground/15">
                {[
                  { label: "Protein", consumed: summary.proteinConsumedG, goal: proteinGoal },
                  { label: "Carbs", consumed: summary.carbsConsumedG, goal: carbsGoal },
                  { label: "Fat", consumed: summary.fatConsumedG, goal: fatGoal },
                ].map(({ label, consumed, goal }) => (
                  <div key={label} className="text-center bg-secondary-foreground/5 rounded-lg p-2">
                    <div className="text-sm font-bold">{Math.round(consumed)}g</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-70 mb-1">{label}</div>
                    <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black/40"
                        style={{ width: `${Math.min(100, (consumed / goal) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[9px] opacity-50 mt-1">
                      {Math.round(goal)}g {dietChart ? <span className="opacity-75">·&nbsp;nutritionist</span> : "goal"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 pb-4">
            <h2 className="font-semibold text-lg px-1">Meals</h2>

            {["breakfast", "lunch", "dinner", "snack"].map((mealType) => {
              const mealFoods = foods?.filter((f) => f.mealType === mealType) || [];
              if (mealFoods.length === 0) return null;

              return (
                <Card key={mealType} className="overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30 flex justify-between items-center">
                    <h3 className="font-semibold capitalize text-sm">{mealTypeLabel[mealType] ?? mealType}</h3>
                    <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-1 rounded-full border">
                      {Math.round(mealFoods.reduce((acc, f) => acc + f.calories, 0))} kcal
                    </span>
                  </div>
                  <div className="divide-y">
                    {mealFoods.map((food) => (
                      <div key={food.id} className="p-3 px-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                        <div>
                          <div className="font-medium text-sm">{food.foodName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {food.servingSize || "1 serving"} · P:{Math.round(food.proteinG)}g C:{Math.round(food.carbsG)}g F:{Math.round(food.fatG)}g
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{Math.round(food.calories)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                            onClick={() => handleDelete(food.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}

            {foods?.length === 0 && (
              <div className="text-center py-12 px-4 text-muted-foreground flex flex-col items-center border border-dashed rounded-xl">
                <Utensils className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No food logged yet.</p>
                <p className="text-xs opacity-70 mt-1">Tap the plus button to add your meals.</p>
              </div>
            )}
          </div>

          {dietChart && (loadingSuggestions || (suggestions && suggestions.length > 0)) && (
            <div className="space-y-4 pb-6">
              <div className="flex items-center gap-2 px-1">
                <Sparkles className="w-4 h-4 text-secondary" />
                <h2 className="font-semibold text-lg">Suggested meals</h2>
              </div>

              {loadingSuggestions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((mealType) => {
                    const group = (suggestions ?? []).filter((s) => s.mealType === mealType);
                    if (group.length === 0) return null;
                    return (
                      <div key={mealType} className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                          {mealTypeLabel[mealType]}
                        </h3>
                        {group.map((s, i) => (
                          <Card key={i} className="overflow-hidden border-secondary/20">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="font-semibold text-sm">{s.name}</div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 px-2 text-xs shrink-0 gap-1"
                                  onClick={() => handleLogSuggestion(s)}
                                  disabled={createFood.isPending}
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Log
                                </Button>
                              </div>
                              <div className="text-xs text-muted-foreground mb-3">{s.description}</div>
                              <div className="flex gap-2 flex-wrap">
                                {[
                                  { label: "cal", value: Math.round(s.calories) },
                                  { label: "P", value: `${Math.round(s.proteinG)}g` },
                                  { label: "C", value: `${Math.round(s.carbsG)}g` },
                                  { label: "F", value: `${Math.round(s.fatG)}g` },
                                ].map(({ label, value }) => (
                                  <span
                                    key={label}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full"
                                  >
                                    <span className="opacity-60">{label}</span>
                                    {value}
                                  </span>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!dietChart && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-secondary/30 text-muted-foreground cursor-pointer hover:border-secondary/60 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-5 h-5 shrink-0 text-secondary/60" />
              <div>
                <p className="text-sm font-medium">Upload your nutritionist's diet chart</p>
                <p className="text-xs opacity-70">PDF format · Macros will be imported automatically</p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
