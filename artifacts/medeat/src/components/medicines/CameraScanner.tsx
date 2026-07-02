import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, AlertCircle, FileText, Pill, CheckCircle2, Clock, Edit2, RefreshCw, Sun, Move, AlignCenter, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TIPS_SEEN_KEY = "medeat_scan_tips_seen";

export interface ParsedMedicine {
  name: string;
  dose: string;
  form: string;
  frequency: string;
  timesOfDay: string[];
  foodInstruction: string;
  pillCount: number | null;
  prescriptionExpiry: string | null;
  confidence: string;
  scanType: string;
}

interface CameraScannerProps {
  /** Called after GPT parse. Return { success: true, savedId } if save succeeded, false to fall back to form. */
  onParsed: (parsed: ParsedMedicine) => Promise<{ success: boolean; savedId?: number }>;
  /** Called when the user taps "Undo". Should delete the medicine by id and invalidate the cache. Throws on failure. */
  onUndoDelete?: (id: number) => Promise<void>;
  /** Called when the user taps "Edit" or auto-save fails — opens the pre-filled form. */
  onEditFallback: (parsed: ParsedMedicine) => void;
  onClose: () => void;
  onDenied?: () => void;
}

type ScanMode = "prescription" | "pill";
type Status = "starting" | "ready" | "processing" | "saving" | "success" | "low-confidence" | "error";

/** Minimum confidence level accepted without showing "Try again". */
const CONFIDENCE_THRESHOLD = "medium"; // accepts "medium" or "high"

/** Average luminance (0–255) below this value triggers the low-light warning. */
const LUMINANCE_THRESHOLD = 50;

/**
 * Sample average pixel luminance from a canvas that has already been drawn with
 * the current video frame.  Uses a scaled-down copy for speed.
 */
function sampleAverageLuminance(
  video: HTMLVideoElement,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
): number {
  const sampleCanvas = document.createElement("canvas");
  const SAMPLE_SIZE = 64; // tiny sample — fast enough for a pre-capture check
  sampleCanvas.width = SAMPLE_SIZE;
  sampleCanvas.height = SAMPLE_SIZE;
  const ctx = sampleCanvas.getContext("2d");
  if (!ctx) return 255; // assume bright if we can't sample
  ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (data.length / 4);
}

function isConfidenceAcceptable(confidence: string): boolean {
  const normalized = confidence.toLowerCase().trim();
  return normalized === "high" || normalized === CONFIDENCE_THRESHOLD;
}

function scheduleLabel(parsed: ParsedMedicine): string {
  const freq = parsed.frequency?.replace(/_/g, " ") ?? "daily";
  const times = Array.isArray(parsed.timesOfDay) ? parsed.timesOfDay.join(", ") : "08:00";
  return `${freq.charAt(0).toUpperCase() + freq.slice(1)} at ${times}`;
}

/**
 * Pre-process a canvas region for better OCR:
 * 1. Convert to grayscale (luminance-weighted)
 * 2. Boost contrast
 */
function applyOcrPreprocessing(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const contrast = 1.6; // contrast multiplier (>1 = more contrast)
  const intercept = 128 * (1 - contrast); // keeps midpoint anchored

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const adjusted = Math.min(255, Math.max(0, contrast * gray + intercept));
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
    // alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
}

export function CameraScanner({ onParsed, onUndoDelete, onEditFallback, onClose, onDenied }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const [mode, setMode] = useState<ScanMode>("prescription");
  const [parsedResult, setParsedResult] = useState<ParsedMedicine | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [lowLight, setLowLight] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const [undoSecsLeft, setUndoSecsLeft] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTips, setShowTips] = useState(() => {
    try {
      return localStorage.getItem(TIPS_SEEN_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const dismissTips = useCallback(() => {
    try {
      localStorage.setItem(TIPS_SEEN_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setShowTips(false);
  }, []);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearInterval(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoSecsLeft(0);
    setLastSavedId(null);
  }, []);

  const startUndoTimer = useCallback((id: number) => {
    setLastSavedId(id);
    setUndoSecsLeft(5);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoSecsLeft((s) => {
        if (s <= 1) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          undoTimerRef.current = null;
          setLastSavedId(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const handleUndo = useCallback(async (id: number, name: string) => {
    try {
      if (onUndoDelete) {
        await onUndoDelete(id);
      } else {
        const res = await fetch(`/api/medicines/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      }
      clearUndoTimer();
      // Reconcile session bookkeeping so the final summary toast is accurate
      setSavedNames((names) => names.filter((n) => n !== name));
      setSavedCount((c) => Math.max(0, c - 1));
      toast.success(`"${name}" removed`);
      setParsedResult(null);
      setLowLight(false);
      setStatus("starting");
      setCameraKey((k) => k + 1);
    } catch {
      toast.error("Could not undo — please delete it manually from the cabinet.");
    }
  }, [clearUndoTimer, onUndoDelete]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        const e = err as DOMException;
        if (e.name === "NotAllowedError") {
          setErrorMsg("Camera permission denied. Please allow camera access and try again.");
          onDenied?.();
        } else if (e.name === "NotFoundError") {
          setErrorMsg("No camera found on this device.");
        } else {
          setErrorMsg("Could not start camera. Please try again.");
        }
        setStatus("error");
      }
    }
    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDenied, cameraKey]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || status !== "ready") return;

    const video = videoRef.current;

    // Guard: video not yet playing or stream stalled
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error("Camera not ready yet — please wait a moment and try again.");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── 1. Determine the crop region from the viewfinder overlay ────────────
    //
    // The <video> uses `object-cover`, so the browser scales the stream to
    // fill the element's layout box and clips the excess symmetrically.
    // We must account for that hidden clip offset when mapping viewfinder
    // screen-pixels back to natural-video pixels.
    //
    // object-cover math:
    //   scale  = max(containerW / naturalW,  containerH / naturalH)
    //   clipX  = (naturalW * scale - containerW) / 2   [rendered px clipped per side, X]
    //   clipY  = (naturalH * scale - containerH) / 2   [rendered px clipped per side, Y]
    //
    //   naturalX = (relLeft + clipX) / scale
    //   naturalY = (relTop  + clipY) / scale
    //   naturalW = frameWidth  / scale
    //   naturalH = frameHeight / scale

    const videoNaturalW = video.videoWidth;
    const videoNaturalH = video.videoHeight;

    let srcX = 0, srcY = 0, srcW = videoNaturalW, srcH = videoNaturalH;

    if (viewfinderRef.current) {
      const videoRect = video.getBoundingClientRect();
      const frameRect = viewfinderRef.current.getBoundingClientRect();

      const containerW = videoRect.width;
      const containerH = videoRect.height;

      if (containerW > 0 && containerH > 0) {
        // object-cover scale: largest uniform scale that fully covers the container
        const scale = Math.max(containerW / videoNaturalW, containerH / videoNaturalH);

        // Symmetric clip offsets (positive = stream extends beyond container)
        const clipX = (videoNaturalW * scale - containerW) / 2;
        const clipY = (videoNaturalH * scale - containerH) / 2;

        // Viewfinder position relative to the video container's top-left corner
        const relLeft = frameRect.left - videoRect.left;
        const relTop  = frameRect.top  - videoRect.top;

        // Map to natural-video pixel space
        const rawSrcX = (relLeft + clipX) / scale;
        const rawSrcY = (relTop  + clipY) / scale;
        const rawSrcW = frameRect.width  / scale;
        const rawSrcH = frameRect.height / scale;

        // Clamp to valid natural-video bounds
        srcX = Math.max(0, rawSrcX);
        srcY = Math.max(0, rawSrcY);
        srcW = Math.min(videoNaturalW - srcX, rawSrcW);
        srcH = Math.min(videoNaturalH - srcY, rawSrcH);

        // Safety: fall back to full frame if crop is degenerate
        if (srcW <= 0 || srcH <= 0) {
          srcX = 0; srcY = 0;
          srcW = videoNaturalW; srcH = videoNaturalH;
        }
      }
    }

    // ── 2. Brightness check — BEFORE switching status so the badge and the
    //       processing state are batched into the same React render, keeping
    //       the advisory badge visible while the scan runs.
    const luminance = sampleAverageLuminance(video, srcX, srcY, srcW, srcH);
    const isDark = luminance < LUMINANCE_THRESHOLD;
    setLowLight(isDark);

    // Switch to processing *after* the brightness check so both state updates
    // flush in one render pass.
    setStatus("processing");

    // ── 3. Draw the cropped region onto the canvas ──────────────────────────
    canvas.width = Math.round(srcW);
    canvas.height = Math.round(srcH);
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

    // ── 4. Pre-process: grayscale + contrast boost ──────────────────────────
    applyOcrPreprocessing(ctx, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.92);

    try {
      const res = await fetch("/api/medicines/parse-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, mode }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast.error(err.error ?? "Scan failed — try again or enter details manually.");
        setStatus("ready");
        return;
      }

      const parsed = await res.json() as ParsedMedicine;

      // ── 4. Confidence gate ─────────────────────────────────────────────────
      // Keep the stream running so "Try again" can capture a new frame.
      if (!isConfidenceAcceptable(parsed.confidence)) {
        setParsedResult(parsed);
        setStatus("low-confidence");
        return;
      }

      setParsedResult(parsed);

      // Stop the camera stream — we don't need the live feed any more
      stopStream();
      setStatus("saving");

      const { success, savedId } = await onParsed(parsed);

      if (success) {
        if (savedId != null) startUndoTimer(savedId);
        setStatus("success");
      } else {
        // Auto-save failed — fall through to edit form
        onEditFallback(parsed);
        onClose();
      }
    } catch {
      toast.error("Scan failed — check your connection and try again.");
      setStatus("ready");
    }
  }, [status, mode, onParsed, onEditFallback, onClose, stopStream]);

  /** Go back to the live viewfinder without restarting the stream. */
  const retryCapture = useCallback(() => {
    setParsedResult(null);
    setLowLight(false);
    setStatus("ready");
  }, []);

  /** Restart camera so user can scan another medicine in the same session. */
  const scanAnother = useCallback((savedName: string) => {
    const undoId = lastSavedId;
    const remainingMs = undoSecsLeft * 1000;
    clearUndoTimer();

    if (undoId != null && remainingMs > 0) {
      toast.success(`"${savedName}" saved — scan your next medicine`, {
        duration: remainingMs,
        action: {
          label: `Undo (${undoSecsLeft}s)`,
          onClick: () => handleUndo(undoId, savedName),
        },
      });
    } else {
      toast.success(`"${savedName}" saved — scan your next medicine`);
    }

    setSavedCount((c) => c + 1);
    setSavedNames((names) => [...names, savedName]);
    setParsedResult(null);
    setLowLight(false);
    setStatus("starting");
    setCameraKey((k) => k + 1);
  }, [clearUndoTimer, handleUndo, lastSavedId, undoSecsLeft]);

  /** Close the scanner, showing a summary toast when 2+ medicines were scanned. */
  const handleDone = useCallback(() => {
    if (savedCount >= 1 && parsedResult) {
      const allNames = [...savedNames, parsedResult.name];
      const total = allNames.length;
      toast.success(`${total} medicines added: ${allNames.join(", ")}`, { duration: 5000 });
    }
    onClose();
  }, [savedCount, savedNames, parsedResult, onClose]);

  const frameAspect = mode === "pill" ? "aspect-square" : "aspect-[3/1]";
  const frameHint = mode === "pill"
    ? "Centre the tablet in the frame"
    : "Point at the prescription or label";

  // ── Success screen (stream already stopped — separate tree is fine) ──────
  if (status === "success" && parsedResult) {
    const saved = parsedResult;
    const canUndo = lastSavedId != null && undoSecsLeft > 0;
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-6 px-8 text-center animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-teal-400" />
        </div>
        <div>
          <h2 className="text-white text-xl font-bold">{saved.name}</h2>
          <p className="text-white/70 text-sm mt-1">{saved.dose} · {saved.form}</p>
        </div>
        <div className="bg-white/10 rounded-xl px-5 py-4 w-full max-w-xs text-left space-y-2">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Clock className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>{scheduleLabel(saved)}</span>
          </div>
          {saved.foodInstruction && saved.foodInstruction !== "any" && (
            <p className="text-white/60 text-xs pl-6">
              {saved.foodInstruction.replace(/_/g, " ")}
            </p>
          )}
          {saved.prescriptionExpiry && (
            <p className="text-white/60 text-xs pl-6">
              Expires {saved.prescriptionExpiry}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-teal-400 font-medium text-sm">
            Added to your schedule
            {savedCount > 0 && (
              <span className="ml-2 bg-teal-500/20 text-teal-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                {savedCount + 1} scanned
              </span>
            )}
          </p>
          {canUndo && (
            <button
              onClick={() => handleUndo(lastSavedId!, saved.name)}
              className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mt-1 px-3 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors animate-in fade-in duration-200"
            >
              <RefreshCw className="w-3 h-3" />
              Undo ({undoSecsLeft}s)
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button
            className="w-full bg-teal-500 hover:bg-teal-600 text-white"
            onClick={() => scanAnother(saved.name)}
          >
            <Camera className="w-4 h-4 mr-1.5" /> Scan another
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-white/30 text-white bg-transparent hover:bg-white/10"
              onClick={() => { onEditFallback(saved); onClose(); }}
            >
              <Edit2 className="w-4 h-4 mr-1.5" /> Edit
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-white/30 text-white bg-transparent hover:bg-white/10"
              onClick={handleDone}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main camera view (always rendered unless status === "success") ────────
  // The <video> must stay mounted so the stream remains attached for retries.
  // Processing, low-confidence, and error states are shown as overlays on top.
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div className="flex items-center gap-2 text-white">
          <Camera className="w-5 h-5" />
          <span className="font-medium text-sm">Scan Medicine</span>
        </div>
        <button onClick={onClose} className="text-white p-1" aria-label="Close camera">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Mode toggle — hidden while processing/saving/low-confidence */}
      {(status === "ready" || status === "starting") && (
        <div className="flex justify-center gap-2 py-3 bg-black/60">
          <button
            onClick={() => setMode("prescription")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              mode === "prescription"
                ? "bg-teal-500 text-white"
                : "bg-white/15 text-white/70 hover:bg-white/25"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Prescription / Label
          </button>
          <button
            onClick={() => setMode("pill")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              mode === "pill"
                ? "bg-teal-500 text-white"
                : "bg-white/15 text-white/70 hover:bg-white/25"
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            Tablet / Pill
          </button>
        </div>
      )}

      {/* Camera view — always rendered so <video> stays mounted */}
      <div className="flex-1 relative overflow-hidden">
        {/* Live video feed — always present */}
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

        {/* Scanning frame — shown only while camera is interactive */}
        {(status === "ready" || status === "starting") && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div ref={viewfinderRef} className={`relative w-4/5 max-w-xs ${frameAspect} rounded-lg`}>
                <div className="absolute inset-0 border-2 border-white/60 rounded-lg" />
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
                {status === "ready" && (
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-teal-400/80 animate-pulse" />
                )}
              </div>
            </div>
            <div className="absolute top-4 inset-x-0 text-center">
              {status === "starting" && (
                <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">Starting camera…</span>
              )}
              {status === "ready" && (
                <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">{frameHint}</span>
              )}
            </div>
          </>
        )}

        {/* Processing / Saving overlay */}
        {(status === "processing" || status === "saving") && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-teal-400/30 border-t-teal-400 animate-spin" />
            <p className="text-white text-sm font-medium animate-pulse">
              {status === "processing"
                ? mode === "pill" ? "Identifying pill…" : "Reading prescription…"
                : "Adding to schedule…"}
            </p>
          </div>
        )}

        {/* Error overlay */}
        {status === "error" && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4 px-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-white text-sm">{errorMsg}</p>
            <Button variant="outline" onClick={onClose} className="text-white border-white">
              Close
            </Button>
          </div>
        )}

        {/* Low-confidence overlay — stream stays live so "Try again" works */}
        {status === "low-confidence" && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-6 px-8 text-center animate-in fade-in duration-200">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold">Couldn't read clearly</h2>
              <p className="text-white/70 text-sm mt-2">
                The scan result has low confidence. Try holding the camera steadier,
                ensuring good lighting, and keeping the label fully inside the frame.
              </p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="outline"
                className="flex-1 border-white/30 text-white bg-transparent hover:bg-white/10"
                onClick={() => { if (parsedResult) { onEditFallback(parsedResult); onClose(); } }}
              >
                <Edit2 className="w-4 h-4 mr-1.5" /> Use anyway
              </Button>
              <Button
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                onClick={retryCapture}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" /> Try again
              </Button>
            </div>
            <button onClick={onClose} className="text-white/50 text-sm underline underline-offset-2">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar: badge + capture button
          Kept visible during "processing" so the low-light badge (if set) stays
          near the capture button while the scan is running. The button itself
          is only shown when the camera is interactive. */}
      {(status === "ready" || status === "starting" || status === "processing") && (
        <div className="flex flex-col items-center gap-3 pt-4 pb-14 bg-black/80">
          {/* Low-light advisory badge — visible during ready AND processing */}
          {lowLight && (status === "ready" || status === "processing") && (
            <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-full animate-in fade-in duration-200">
              <Sun className="w-3.5 h-3.5 flex-shrink-0" />
              Low light — move to a brighter area
            </div>
          )}
          {(status === "ready" || status === "starting") && (
            <button
              onClick={capture}
              disabled={status !== "ready"}
              aria-label="Capture and add to schedule"
              className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* First-time scan tips overlay */}
      {showTips && (
        <div className="absolute inset-0 z-10 bg-black/90 flex flex-col items-center justify-center px-6 animate-in fade-in duration-300">
          <div className="w-full max-w-sm flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-white text-xl font-bold">Scan Tips</h2>
              <p className="text-white/60 text-sm mt-1">Follow these for the best results</p>
            </div>

            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sun className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Use good lighting</p>
                  <p className="text-white/55 text-xs mt-0.5">Bright, even light works best. Avoid shadows or glare directly on the label.</p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Move className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Keep the right distance</p>
                  <p className="text-white/55 text-xs mt-0.5">Hold the camera 15–25 cm (6–10 inches) from the label — not too close, not too far.</p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlignCenter className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Fill the viewfinder</p>
                  <p className="text-white/55 text-xs mt-0.5">Make sure the entire label or prescription text fits inside the rectangle on screen.</p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Hand className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Hold steady</p>
                  <p className="text-white/55 text-xs mt-0.5">Brace your elbows and wait for the image to look sharp before tapping the shutter.</p>
                </div>
              </li>
            </ul>

            <Button
              className="w-full bg-teal-500 hover:bg-teal-600 text-white mt-1"
              onClick={dismissTips}
            >
              Got it — start scanning
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
