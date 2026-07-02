import { Router } from "express";

const router = Router();

interface OpenFDAResult {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    dosage_form?: string[];
    route?: string[];
  };
  food_effect_anda?: string[];
  dosage_and_administration?: string[];
}

// Must match CreateMedicineBodyForm enum exactly
type MedicineForm = "tablet" | "capsule" | "syrup" | "injection" | "drops" | "patch" | "other";
// Must match CreateMedicineBodyFoodInstruction enum exactly
type FoodInstruction = "any" | "before_food" | "after_food" | "with_water";

function mapDosageForm(raw: string): MedicineForm {
  const lower = raw.toLowerCase();
  if (lower.includes("tablet") || lower.includes("tab")) return "tablet";
  if (lower.includes("capsule") || lower.includes("cap")) return "capsule";
  if (
    lower.includes("solution") ||
    lower.includes("liquid") ||
    lower.includes("syrup") ||
    lower.includes("suspension") ||
    lower.includes("oral") && lower.includes("soln")
  ) return "syrup";
  if (lower.includes("injection") || lower.includes("injectable") || lower.includes("vial")) return "injection";
  if (lower.includes("drop") || lower.includes("ophthalmic") || lower.includes("otic")) return "drops";
  if (lower.includes("patch") || lower.includes("transdermal")) return "patch";
  // inhaler, cream, ointment, gel, lotion, powder, spray → "other"
  return "other";
}

function inferFoodInstruction(result: OpenFDAResult): FoodInstruction {
  const text = [
    ...(result.dosage_and_administration ?? []),
    ...(result.food_effect_anda ?? []),
  ].join(" ").toLowerCase();

  // empty_stomach / before-food patterns → before_food
  if (
    text.includes("empty stomach") ||
    text.includes("before meal") ||
    text.includes("before eating") ||
    text.includes("1 hour before") ||
    text.includes("30 minutes before") ||
    text.includes("before food")
  ) return "before_food";

  // with-water patterns (before checking with-meal, since many "take with water" also say "with meal")
  if (
    text.includes("with a full glass of water") ||
    text.includes("with plenty of water")
  ) return "with_water";

  // after-meal / with-meal patterns → after_food
  if (
    text.includes("after meal") ||
    text.includes("after food") ||
    text.includes("after eating") ||
    text.includes("with meal") ||
    text.includes("with food") ||
    text.includes("with a meal")
  ) return "after_food";

  return "any";
}

function extractDose(result: OpenFDAResult): string {
  const admin = (result.dosage_and_administration ?? []).join(" ");
  const match = admin.match(/\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|IU|units?)\b/i);
  if (match) return `${match[1]}${match[2].toLowerCase()}`;
  return "";
}

router.get("/drugs/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const encoded = encodeURIComponent(q);
    const url = `https://api.fda.gov/drug/label.json?search=(openfda.brand_name:"${encoded}"+openfda.generic_name:"${encoded}")&limit=10`;
    const response = await fetch(url, {
      headers: { "User-Agent": "MedEat/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const fallbackUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encoded}&limit=10`;
      const fallback = await fetch(fallbackUrl, {
        headers: { "User-Agent": "MedEat/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!fallback.ok) { res.json([]); return; }
      const fallbackData = (await fallback.json()) as { results?: OpenFDAResult[] };
      res.json(processResults(fallbackData.results ?? []));
      return;
    }

    const data = (await response.json()) as { results?: OpenFDAResult[] };
    res.json(processResults(data.results ?? []));
  } catch (err) {
    req.log.warn({ err }, "OpenFDA search failed");
    res.json([]);
  }
});

function processResults(results: OpenFDAResult[]) {
  const seen = new Set<string>();
  const out: { name: string; dose: string; form: MedicineForm; foodInstruction: FoodInstruction }[] = [];

  for (const r of results) {
    const brandNames = r.openfda?.brand_name ?? [];
    const genericNames = r.openfda?.generic_name ?? [];
    const dosageForms = r.openfda?.dosage_form ?? [];
    const names = brandNames.length > 0 ? brandNames : genericNames;

    for (const name of names) {
      const normalized = name.replace(/\s+/g, " ").trim();
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        name: normalized,
        dose: extractDose(r),
        form: mapDosageForm(dosageForms[0] ?? ""),
        foodInstruction: inferFoodInstruction(r),
      });

      if (out.length >= 8) break;
    }
    if (out.length >= 8) break;
  }

  return out;
}

export default router;
