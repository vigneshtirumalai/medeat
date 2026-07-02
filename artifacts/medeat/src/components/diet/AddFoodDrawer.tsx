import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  CreateFoodLogBodyMealType,
  useCreateFoodLog,
  getListFoodLogsQueryKey,
  getGetMacrosSummaryQueryKey,
  getGetDietChartSuggestionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const formSchema = z.object({
  foodName: z.string().min(1, "Name is required"),
  calories: z.coerce.number().min(0),
  proteinG: z.coerce.number().min(0),
  carbsG: z.coerce.number().min(0),
  fatG: z.coerce.number().min(0),
  mealType: z.nativeEnum(CreateFoodLogBodyMealType),
  servingSize: z.string().optional(),
});

export function AddFoodDrawer({ children, date }: { children: React.ReactNode, date: Date }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const createFoodLog = useCreateFoodLog();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      foodName: "",
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      mealType: CreateFoodLogBodyMealType.breakfast,
      servingSize: "1 serving",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const dateStr = format(date, "yyyy-MM-dd");
    createFoodLog.mutate({
      data: {
        ...values,
        date: dateStr,
      }
    }, {
      onSuccess: () => {
        toast.success("Food logged successfully");
        queryClient.invalidateQueries({ queryKey: getListFoodLogsQueryKey({ date: dateStr }) });
        queryClient.invalidateQueries({ queryKey: getGetMacrosSummaryQueryKey({ date: dateStr }) });
        queryClient.invalidateQueries({ queryKey: getGetDietChartSuggestionsQueryKey({ date: dateStr }) });
        setOpen(false);
        form.reset();
      },
      onError: () => {
        toast.error("Failed to log food");
      }
    });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Log Food</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="foodName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Banana" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="servingSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serving Size</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1 medium" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="mealType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meal</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select meal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(CreateFoodLogBodyMealType).map((f) => (
                            <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="calories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calories (kcal)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="proteinG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protein (g)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="carbsG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carbs (g)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fatG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fat (g)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" variant="secondary" className="w-full" disabled={createFoodLog.isPending}>
                {createFoodLog.isPending ? "Saving..." : "Log Food"}
              </Button>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
