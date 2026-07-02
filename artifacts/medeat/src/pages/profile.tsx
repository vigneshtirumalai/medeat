import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetProfile, 
  getGetProfileQueryKey,
  useUpdateProfile,
  UpdateProfileBodyActivityLevel,
  UpdateProfileBodyHealthGoal
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, UserCircle, Activity, Heart, Target, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  calorieGoal: z.coerce.number().min(500),
  proteinGoalG: z.coerce.number().min(0),
  carbsGoalG: z.coerce.number().min(0),
  fatGoalG: z.coerce.number().min(0),
  heightCm: z.coerce.number().min(50).optional(),
  weightKg: z.coerce.number().min(20).optional(),
  ageYears: z.coerce.number().min(1).optional(),
  activityLevel: z.nativeEnum(UpdateProfileBodyActivityLevel).optional(),
  healthGoal: z.nativeEnum(UpdateProfileBodyHealthGoal).optional(),
});

export default function Profile() {
  const { data: profile, isLoading } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      calorieGoal: 2000,
      proteinGoalG: 150,
      carbsGoalG: 200,
      fatGoalG: 65,
    }
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        calorieGoal: profile.calorieGoal,
        proteinGoalG: profile.proteinGoalG,
        carbsGoalG: profile.carbsGoalG,
        fatGoalG: profile.fatGoalG,
        heightCm: profile.heightCm || undefined,
        weightKg: profile.weightKg || undefined,
        ageYears: profile.ageYears || undefined,
        activityLevel: profile.activityLevel || undefined,
        healthGoal: profile.healthGoal || undefined,
      });
    }
  }, [profile, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateProfile.mutate({ data: values }, {
      onSuccess: () => {
        toast.success("Profile updated");
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setIsEditing(false);
      }
    });
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!profile) return null;

  return (
    <div className="flex-1 flex flex-col p-4 gap-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground">Your health settings</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Target className="w-4 h-4" /> Daily Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="calorieGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calories (kcal)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="proteinGoalG"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protein (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="carbsGoalG"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbs (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fatGoalG"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fat (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-secondary-foreground">
                  <Activity className="w-4 h-4" /> Personal Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="heightCm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height (cm)</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weightKg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (kg)</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ageYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <FormControl><Input type="number" {...field} value={field.value || ""} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="activityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.values(UpdateProfileBodyActivityLevel).map(v => (
                              <SelectItem key={v} value={v}>{v.replace('_', ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 gap-2" disabled={updateProfile.isPending}>
                <Save className="w-4 h-4" /> Save Profile
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-primary/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Target className="w-4 h-4" /> Daily Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-4xl font-bold mb-1 tracking-tight">{profile.calorieGoal} <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">kcal</span></div>
              <div className="flex gap-4 mt-6 bg-muted/40 p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="text-lg font-bold">{profile.proteinGoalG}g</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Protein</div>
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1">
                  <div className="text-lg font-bold">{profile.carbsGoalG}g</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Carbs</div>
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1">
                  <div className="text-lg font-bold">{profile.fatGoalG}g</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Fat</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-destructive/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
                <Heart className="w-4 h-4" /> Allergies
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                {profile.allergens.length > 0 ? (
                  profile.allergens.map(a => (
                    <Badge key={a} variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 font-bold px-3 py-1">
                      {a}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-md border">No allergens listed</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b bg-secondary/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-secondary-foreground">
                <Activity className="w-4 h-4" /> Personal Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-y-6 text-sm">
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Height</div>
                  <div className="font-semibold text-lg">{profile.heightCm || '--'} <span className="text-sm text-muted-foreground font-normal">cm</span></div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Weight</div>
                  <div className="font-semibold text-lg">{profile.weightKg || '--'} <span className="text-sm text-muted-foreground font-normal">kg</span></div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Age</div>
                  <div className="font-semibold text-lg">{profile.ageYears || '--'} <span className="text-sm text-muted-foreground font-normal">yrs</span></div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mb-1">Activity</div>
                  <div className="font-semibold text-base capitalize">{profile.activityLevel?.replace('_', ' ') || '--'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
