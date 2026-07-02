import { useState, useRef, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CreateMedicineBodyForm,
  CreateMedicineBodyFrequency,
  CreateMedicineBodyFoodInstruction,
  useCreateMedicine,
  useDeleteMedicine,
  getListMedicinesQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Camera, Search, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CameraScanner, type ParsedMedicine } from "./CameraScanner";

interface DrugSuggestion {
  name: string;
  dose: string;
  form: string;
  foodInstruction: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dose: z.string().min(1, "Dose is required"),
  form: z.nativeEnum(CreateMedicineBodyForm),
  frequency: z.nativeEnum(CreateMedicineBodyFrequency),
  timesOfDay: z.string().min(1, "At least one time is required"),
  pillCount: z.coerce.number().min(0),
  refillThreshold: z.coerce.number().min(0),
  foodInstruction: z.nativeEnum(CreateMedicineBodyFoodInstruction),
  prescriptionExpiry: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const safeForm = (v: string): CreateMedicineBodyForm =>
  Object.values(CreateMedicineBodyForm).find(e => e === v) ?? CreateMedicineBodyForm.tablet;

const safeFreq = (v: string): CreateMedicineBodyFrequency =>
  Object.values(CreateMedicineBodyFrequency).find(e => e === v) ?? CreateMedicineBodyFrequency.daily;

const safeFoodInstr = (v: string): CreateMedicineBodyFoodInstruction =>
  Object.values(CreateMedicineBodyFoodInstruction).find(e => e === v) ?? CreateMedicineBodyFoodInstruction.any;

export function AddMedicineDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [scanFilled, setScanFilled] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const createMedicine = useCreateMedicine();
  const deleteMedicine = useDeleteMedicine();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dose: "",
      form: CreateMedicineBodyForm.tablet,
      frequency: CreateMedicineBodyFrequency.daily,
      timesOfDay: "08:00",
      pillCount: 30,
      refillThreshold: 5,
      foodInstruction: CreateMedicineBodyFoodInstruction.any,
      prescriptionExpiry: "",
    },
  });

  const searchDrugs = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowDropdown(false); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: DrugSuggestion[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      }
    } catch {
      // silently fail — user can still type manually
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setScanFilled(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchDrugs(value), 350);
  }, [searchDrugs]);

  const applySuggestion = useCallback((drug: DrugSuggestion) => {
    form.setValue("name", drug.name);
    if (drug.dose) form.setValue("dose", drug.dose);
    const fv = Object.values(CreateMedicineBodyForm).find(v => v === drug.form);
    if (fv) form.setValue("form", fv);
    const fi = Object.values(CreateMedicineBodyFoodInstruction).find(v => v === drug.foodInstruction);
    if (fi) form.setValue("foodInstruction", fi);
    setSearchQuery(drug.name);
    setShowDropdown(false);
    setSuggestions([]);
  }, [form]);

  /** Called by CameraScanner when the user taps Undo on the success screen. */
  const handleUndoDelete = useCallback(async (id: number) => {
    await deleteMedicine.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() });
  }, [deleteMedicine, queryClient]);

  /**
   * Called by CameraScanner after GPT parsing.
   * Immediately saves to DB — scanner shows progress/success UI.
   */
  const handleScanParsed = useCallback(async (parsed: ParsedMedicine): Promise<{ success: boolean; savedId?: number }> => {
    try {
      const med = await createMedicine.mutateAsync({
        data: {
          name: parsed.name ?? "Unknown",
          dose: parsed.dose ?? "—",
          form: safeForm(parsed.form),
          frequency: safeFreq(parsed.frequency),
          timesOfDay: Array.isArray(parsed.timesOfDay) && parsed.timesOfDay.length
            ? parsed.timesOfDay
            : ["08:00"],
          pillCount: parsed.pillCount ?? 30,
          refillThreshold: 5,
          foodInstruction: safeFoodInstr(parsed.foodInstruction),
          prescriptionExpiry: parsed.prescriptionExpiry ?? undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() });
      return { success: true, savedId: med?.id };
    } catch {
      toast.error("Could not save — please fill in the form manually.");
      return { success: false };
    }
  }, [createMedicine, queryClient]);

  /**
   * Called when user taps "Edit" on the scanner success screen,
   * or when auto-save fails. Opens the drawer with fields pre-filled.
   */
  const handleEditFallback = useCallback((parsed: ParsedMedicine) => {
    form.setValue("name", parsed.name ?? "");
    form.setValue("dose", parsed.dose ?? "");
    form.setValue("form", safeForm(parsed.form));
    form.setValue("frequency", safeFreq(parsed.frequency));
    form.setValue("timesOfDay", Array.isArray(parsed.timesOfDay) && parsed.timesOfDay.length
      ? parsed.timesOfDay.join(", ")
      : "08:00");
    form.setValue("foodInstruction", safeFoodInstr(parsed.foodInstruction));
    if (parsed.pillCount != null) form.setValue("pillCount", parsed.pillCount);
    if (parsed.prescriptionExpiry) form.setValue("prescriptionExpiry", parsed.prescriptionExpiry);
    setSearchQuery(parsed.name ?? "");
    setScanFilled(true);
    setOpen(true); // ensure drawer is open for editing
  }, [form]);

  const handleCameraClose = useCallback(() => {
    setShowCamera(false);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onSubmit = (values: FormValues) => {
    createMedicine.mutate({
      data: {
        ...values,
        timesOfDay: values.timesOfDay.split(",").map(t => t.trim()),
      }
    }, {
      onSuccess: () => {
        toast.success("Medicine added successfully");
        queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() });
        setOpen(false);
        form.reset();
        setSearchQuery("");
        setSuggestions([]);
        setScanFilled(false);
      },
      onError: () => toast.error("Failed to add medicine"),
    });
  };

  const hasCameraSupport = !cameraBlocked
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices?.getUserMedia;

  return (
    <>
      {/* Camera scanner — full-screen overlay, rendered outside the Drawer */}
      {showCamera && (
        <CameraScanner
          onParsed={handleScanParsed}
          onUndoDelete={handleUndoDelete}
          onEditFallback={handleEditFallback}
          onClose={handleCameraClose}
          onDenied={() => { setShowCamera(false); setCameraBlocked(true); }}
        />
      )}

      <Drawer open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setSearchQuery(""); setSuggestions([]); setShowDropdown(false); setScanFilled(false); }
      }}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>Add Medicine</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto pb-6 space-y-4">

            {/* Scan-filled banner */}
            {scanFilled && (
              <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <p className="text-xs text-teal-800 dark:text-teal-300">
                  Fields pre-filled from scan — review and save.
                </p>
              </div>
            )}

            {/* Search + camera row */}
            <div ref={searchRef} className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Search drug database…"
                    className="w-full h-10 pl-9 pr-8 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                  {searchQuery && !isSearching && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setSuggestions([]); setShowDropdown(false); setScanFilled(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {hasCameraSupport && (
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="h-10 w-10 shrink-0 flex items-center justify-center border border-input rounded-md bg-background hover:bg-accent transition-colors"
                    title="Scan prescription or tablet"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showDropdown && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                  {suggestions.map((drug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(drug)}
                      className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors flex items-start gap-3 border-b border-border/50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{drug.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[drug.dose, drug.form].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && suggestions.length === 0 && !scanFilled && (
                <p className="text-xs text-muted-foreground mt-1 px-1">No matches — fill in the details below manually.</p>
              )}
            </div>

            <div className="border-t border-border/50" />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicine Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Amoxicillin" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="dose" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dose</FormLabel>
                      <FormControl><Input placeholder="e.g. 500mg" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="form" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Form</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(CreateMedicineBodyForm).map(f => (
                            <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="frequency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(CreateMedicineBodyFrequency).map(f => (
                            <SelectItem key={f} value={f}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="timesOfDay" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Times (comma sep.)</FormLabel>
                      <FormControl><Input placeholder="08:00, 20:00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="pillCount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pill Count</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="refillThreshold" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Refill Alert At</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="foodInstruction" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Food Instructions</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select instructions" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(CreateMedicineBodyFoodInstruction).map(f => (
                          <SelectItem key={f} value={f}>{f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="prescriptionExpiry" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prescription Expiry (optional)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full" disabled={createMedicine.isPending}>
                  {createMedicine.isPending ? "Saving..." : "Add Medicine"}
                </Button>
              </form>
            </Form>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
