# MedEat

A full-stack mobile-first health app combining medicine tracking with diet & nutrition management.

## Architecture

**Monorepo** managed with pnpm workspaces.

### Artifacts
- `artifacts/medeat` — React + Vite frontend (port 18573, preview path `/`)
- `artifacts/api-server` — Express backend (port 8080, preview path `/api`)

### Shared Libraries
- `lib/db` — Drizzle ORM schema + PostgreSQL client (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec + orval codegen (`@workspace/api-spec`)
- `lib/api-zod` — Generated Zod validators + React Query hooks (`@workspace/api-zod`)

## Database Schema (PostgreSQL + Drizzle ORM)

Five tables:
- `medicines` — medicine cabinet (name, dose, form, frequency, times_of_day, pill_count, refill_threshold, status, food_instruction, prescription_expiry)
- `dose_logs` — tracks each dose taken/missed/skipped
- `food_logs` — daily food entries with macros (calories, protein_g, carbs_g, fat_g, meal_type, date)
- `grocery_items` — shopping list items (name, quantity, category, checked)
- `user_profile` — single-row profile (calorie_goal, macro goals, allergens, personal stats)

## API Routes

All routes served under `/api`:

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/medicines` | List/create medicines |
| GET/PATCH/DELETE | `/medicines/:id` | Get/update/delete medicine |
| POST | `/medicines/:id/take` | Log a dose |
| POST | `/medicines/:id/refill` | Refill pill count |
| GET | `/dose-logs` | List dose logs (filterable by medicineId, startDate, endDate) |
| GET/POST | `/food-logs` | List/create food log entries |
| DELETE | `/food-logs/:id` | Delete food log entry |
| GET/POST | `/grocery` | List/create grocery items |
| PATCH/DELETE | `/grocery/:id` | Update/delete grocery item |
| DELETE | `/grocery/clear-checked` | Clear completed items |
| GET/PUT | `/profile` | Get/update user profile |
| GET | `/recipes/suggestions` | AI recipe suggestions (GPT-4o-mini with fallback) |
| GET | `/summary/dashboard` | Dashboard overview stats |
| GET | `/summary/adherence` | 7-day adherence stats per medicine |
| GET | `/summary/macros` | Daily macro breakdown |

## Frontend Pages

All pages mobile-first, Wouter routing, bottom nav with 5 tabs:

- `/` — **Home** dashboard: dose progress ring, calorie ring, upcoming doses, quick-take actions
- `/medicines` — **Cabinet**: medicine cards with refill alerts, take dose, add/edit/delete drawers
- `/medicines/adherence` — **Adherence**: 7-day streak calendar per medicine
- `/diet` — **Diet**: daily macros card, meals by type, food logging drawer with day navigation
- `/recipes` — **AI Recipes**: recipe cards with macros, "Cook This" adds ingredients to grocery list
- `/grocery` — **Grocery List**: checkable items, quick add, clear done button
- `/profile` — **Profile**: calorie/macro goals, allergens, personal stats

## Design System

- **Teal/green** (`#0d9488`) for medicines/health actions
- **Amber/gold** (`#f59e0b`) for nutrition/calories
- Mobile-first, max-width 640px centered layout
- Component library: `lucide-react` icons, `sonner` toasts, custom CSS variables

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session secret
- `OPENAI_API_KEY` — Optional; enables real AI recipe generation (falls back to 3 static recipes)

## Key Files

- `lib/api-spec/openapi.yaml` — Full OpenAPI 3.0 spec
- `lib/api-spec/orval.config.ts` — Orval codegen config
- `lib/db/src/schema/` — All Drizzle table definitions
- `artifacts/api-server/src/routes/` — All Express route handlers
- `artifacts/medeat/src/` — React frontend components and pages
- `artifacts/medeat/src/index.css` — Design system CSS variables
