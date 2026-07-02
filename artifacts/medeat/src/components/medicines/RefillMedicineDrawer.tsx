import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Medicine,
  useRefillMedicine,
  getListMedicinesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  newCount: z.coerce.number().min(1, "Amount must be at least 1"),
});

export function RefillMedicineDrawer({ children, medicine }: { children: React.ReactNode, medicine: Medicine }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const refillMedicine = useRefillMedicine();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newCount: 30, // Default refill amount
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    refillMedicine.mutate({
      id: medicine.id,
      data: {
        newCount: values.newCount,
      }
    }, {
      onSuccess: () => {
        toast.success(`Added ${values.newCount} pills to ${medicine.name}`);
        queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() });
        setOpen(false);
        form.reset();
      },
      onError: () => {
        toast.error("Failed to log refill");
      }
    });
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Refill {medicine.name}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <p className="text-sm text-muted-foreground mb-4">Current count: {medicine.pillCount}</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pills Added</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={refillMedicine.isPending}>
                {refillMedicine.isPending ? "Saving..." : "Log Refill"}
              </Button>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
