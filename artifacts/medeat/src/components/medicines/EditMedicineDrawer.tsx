import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  UpdateMedicineBodyForm, 
  UpdateMedicineBodyFrequency, 
  UpdateMedicineBodyFoodInstruction,
  UpdateMedicineBodyStatus,
  Medicine,
  useUpdateMedicine,
  getListMedicinesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dose: z.string().min(1, "Dose is required"),
  form: z.nativeEnum(UpdateMedicineBodyForm),
  frequency: z.nativeEnum(UpdateMedicineBodyFrequency),
  timesOfDay: z.string().min(1, "At least one time is required"),
  pillCount: z.coerce.number().min(0),
  refillThreshold: z.coerce.number().min(0),
  foodInstruction: z.nativeEnum(UpdateMedicineBodyFoodInstruction),
  status: z.nativeEnum(UpdateMedicineBodyStatus),
});

export function EditMedicineDrawer({ children, medicine }: { children: React.ReactNode, medicine: Medicine }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const updateMedicine = useUpdateMedicine();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: medicine.name,
      dose: medicine.dose,
      form: medicine.form as UpdateMedicineBodyForm,
      frequency: medicine.frequency as UpdateMedicineBodyFrequency,
      timesOfDay: medicine.timesOfDay.join(", "),
      pillCount: medicine.pillCount,
      refillThreshold: medicine.refillThreshold,
      foodInstruction: medicine.foodInstruction as UpdateMedicineBodyFoodInstruction,
      status: medicine.status as UpdateMedicineBodyStatus,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: medicine.name,
        dose: medicine.dose,
        form: medicine.form as UpdateMedicineBodyForm,
        frequency: medicine.frequency as UpdateMedicineBodyFrequency,
        timesOfDay: medicine.timesOfDay.join(", "),
        pillCount: medicine.pillCount,
        refillThreshold: medicine.refillThreshold,
        foodInstruction: medicine.foodInstruction as UpdateMedicineBodyFoodInstruction,
        status: medicine.status as UpdateMedicineBodyStatus,
      });
    }
  }, [open, medicine, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateMedicine.mutate({
      id: medicine.id,
      data: {
        ...values,
        timesOfDay: values.timesOfDay.split(",").map(t => t.trim()),
      }
    }, {
      onSuccess: () => {
        toast.success("Medicine updated");
        queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() });
        setOpen(false);
      },
      onError: () => {
        toast.error("Failed to update medicine");
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
          <DrawerTitle>Edit Medicine</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicine Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Amoxicillin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 500mg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="form"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select form" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(UpdateMedicineBodyForm).map((f) => (
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
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(UpdateMedicineBodyFrequency).map((f) => (
                            <SelectItem key={f} value={f}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="timesOfDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Times (comma separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="08:00, 20:00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pillCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pill Count</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="refillThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refill Alert At</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="foodInstruction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food Instructions</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select instructions" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(UpdateMedicineBodyFoodInstruction).map((f) => (
                          <SelectItem key={f} value={f}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={updateMedicine.isPending}>
                {updateMedicine.isPending ? "Saving..." : "Update Medicine"}
              </Button>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
