import { useListMedicines, getListMedicinesQueryKey, useDeleteMedicine, useTakeDose, TakeDoseBodyStatus } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pill, AlertCircle, Clock, Trash2, Edit2, RotateCw, CalendarClock } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AddMedicineDrawer } from "@/components/medicines/AddMedicineDrawer";
import { EditMedicineDrawer } from "@/components/medicines/EditMedicineDrawer";
import { RefillMedicineDrawer } from "@/components/medicines/RefillMedicineDrawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

function getExpiryDaysRemaining(prescriptionExpiry: string | null | undefined): number | null {
  if (!prescriptionExpiry) return null;
  const expiry = new Date(prescriptionExpiry);
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Show badge only for future expirations within 30 days (today inclusive)
function shouldShowExpiryBadge(daysRemaining: number | null): boolean {
  if (daysRemaining === null) return false;
  return daysRemaining >= 0 && daysRemaining <= 30;
}

export default function Medicines() {
  const { data: medicines, isLoading } = useListMedicines({}, { query: { queryKey: getListMedicinesQueryKey({}) } });
  const queryClient = useQueryClient();
  const deleteMedicine = useDeleteMedicine();
  const takeDose = useTakeDose();

  const handleDelete = (id: number) => {
    if (confirm("Delete this medicine?")) {
      deleteMedicine.mutate({ id }, {
        onSuccess: () => {
          toast.success("Medicine deleted");
          queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey({}) });
        }
      });
    }
  };

  const handleTakeDose = (id: number) => {
    takeDose.mutate({ id, data: { status: TakeDoseBodyStatus.taken } }, {
      onSuccess: () => {
        toast.success("Dose logged");
        queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey({}) });
      }
    });
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cabinet</h1>
          <p className="text-sm text-muted-foreground">Your active medicines</p>
        </div>
        <div className="flex gap-2">
          <Link href="/medicines/adherence" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10">
            <Clock className="w-5 h-5" />
          </Link>
          <AddMedicineDrawer>
            <Button size="icon">
              <Plus className="w-5 h-5" />
            </Button>
          </AddMedicineDrawer>
        </div>
      </div>

      {medicines?.length === 0 ? (
        <Card className="border-dashed mt-8 bg-card/50">
          <CardContent className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground">
            <Pill className="w-12 h-12 mb-4 text-muted-foreground/50" />
            <p>Your cabinet is empty.</p>
            <AddMedicineDrawer>
              <Button variant="outline" className="mt-4">Add Medicine</Button>
            </AddMedicineDrawer>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {medicines?.map(med => {
            const daysRemaining = getExpiryDaysRemaining(med.prescriptionExpiry);
            const showExpiryBadge = shouldShowExpiryBadge(daysRemaining);
            const expiryUrgent = daysRemaining !== null && daysRemaining < 7;

            return (
              <Card key={med.id} className="overflow-hidden hover:border-primary/30 transition-colors">
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Pill className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg leading-none">{med.name}</h3>
                        <p className="text-sm text-muted-foreground">{med.dose} • {med.form}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <EditMedicineDrawer medicine={med}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Edit2 className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          </EditMedicineDrawer>
                          <RefillMedicineDrawer medicine={med}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <RotateCw className="w-4 h-4 mr-2" /> Log Refill
                            </DropdownMenuItem>
                          </RefillMedicineDrawer>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(med.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 p-2 rounded-md">
                    <Clock className="w-4 h-4" />
                    <span>{med.frequency.replace(/_/g, ' ')} • {med.timesOfDay.join(', ')}</span>
                  </div>

                  {/* Expiry badge — shown when within 30 days */}
                  {showExpiryBadge && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium w-fit ${
                      expiryUrgent
                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}>
                      <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
                      {daysRemaining! <= 0
                        ? "Prescription expired"
                        : daysRemaining === 1
                        ? "Expires in 1 day — Renew"
                        : `Expires in ${daysRemaining} days`}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Badge variant={med.pillCount <= med.refillThreshold ? "destructive" : "secondary"} className="font-medium">
                        {med.pillCount} pills left
                      </Badge>
                      {med.pillCount <= med.refillThreshold && <AlertCircle className="w-4 h-4 text-destructive animate-pulse" />}
                    </div>
                    <Button size="sm" onClick={() => handleTakeDose(med.id)}>Take Dose</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
