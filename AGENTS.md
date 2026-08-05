# AGENTS.md

## Project overview

"洛克王国：世界 · 大块头蛋查询工具" — a pure-frontend Vue 3 app for querying creature (精灵) data and assisting egg-size breeding in the game Roco Kingdom: World. No backend, no API calls. All data resets on page refresh.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` (localhost:5173) |
| Build | `npm run build` |
| Type check | `npm run type-check` (vue-tsc --noEmit) |
| Preview build | `npm run preview` |

No linter, formatter, or test framework is configured. The `type-check` script requires `typescript` and `vue-tsc` in node_modules — if missing, copy them from another Vue 3 + Vite project on the same machine (the original node_modules was transplanted this way).

## Architecture

```
src/
├── types/index.ts        # All TypeScript interfaces (PokemonFamily, Individual, EggRecord, etc.)
├── data/*.json           # Static JSON — the sole data source
├── services/             # Data access layer — pages never touch JSON directly
├── utils/                # Pure business logic (calculators, evaluators)
├── views/                # Page components (route targets)
├── components/           # Reusable UI components
├── router/index.ts       # Hash-mode routing (createWebHashHistory)
└── styles/global.css     # Global styles, dark mode via Element Plus
```

**Strict layering**: `views → services → utils → data`. Components must NOT import from `data/` directly — always go through services. This layering is the V2 backend migration seam.

## Data model (critical)

### Static reference data (`pokemonService.ts`, `eggSizeService.ts`)

- `PokemonFamily` contains an array of `PokemonForm` (evolution stages). A family = one evolution chain.
- `Individual` (a player-owned creature) references `familyId` + `currentFormId` — it does NOT store name/avatar. Display names are resolved at runtime via `getFormName(formId)`.
- `EggSizeRule` keyed by `familyId` — contains `bigSizeRule` (heightMin/weightMin) and `smallSizeRule` (heightMax/weightMax).

### Mutable runtime data (`breedingService.ts`)

`breedingService` wraps all JSON imports in a Vue `reactive()` store. This is the **only mutable service** — `pokemonService` and `eggSizeService` are read-only. Auto-increment IDs start at hardcoded values (e.g. `nextIndividualId = 2002`) — when adding mock data, pick IDs above the current max to avoid collisions.

Key entities: `BreedingPlan` → `MedalTask` (4 per plan: 大婉/大粗/小婉/小粗) → `BreedingGroup` (max 5 per plan) → `EggRecord` → `Individual` (on hatch).

### Parent snapshots

`EggRecord` captures `fatherSnapshot` / `motherSnapshot` at egg-production time. These snapshots ensure historical statistics remain accurate after parents are replaced. The `eggPedigree.ts` utility traces the full replacement chain backwards from a snapshot.

## Key algorithms

- **Big size determination** (`bigSizeCalculator.ts`): BOTH height >= heightMin AND weight >= weightMin. Score = average of min(height/heightMin, 1) and min(weight/weightMin, 1). Big and small are mutually exclusive; big takes priority.
- **Stage evaluation** (`individualEvaluator.ts`): Compares a creature's weight against historical same-family + same-form + same-gender + same-voiceMedal data.
- **Replacement advisor** (`replacementAdvisor.ts`): Suggests parent swaps by attempting to insert idle creatures into the Top5 parent pool (sorted by weight descending).

## Routing

Hash mode (`#/path`). Routes:
- `/` Home, `/list` PokemonList, `/detail/:id` PokemonDetail
- `/check` BigSizeCheck (accepts `?pokemonId=` for pre-fill)
- `/breeding` BreedingPlanList, `/breeding/:id` BreedingPlanDetail, `/breeding/:id/stats` BreedingPlanStats
- `/:pathMatch(.*)*` → redirect to `/`

## UI conventions

- Element Plus components used throughout (el-menu, el-card, el-dialog, el-form, el-descriptions, el-progress, el-result, el-tag, el-alert, el-empty, etc.)
- Dark mode enabled by default (`html.dark` class + Element Plus dark CSS vars)
- Page transitions: `<transition name="fade" mode="out-in">` in App.vue
- Responsive grid: `el-row`/`el-col` with `xs/sm/md/lg/xl` breakpoints
- `@/` alias maps to `src/` (configured in both vite.config.ts and tsconfig.json paths)

## Adding data

When adding creatures to `pokemon.json`:
1. Follow the `PokemonFamily` structure — each entry is a family with a `forms` array
2. Add corresponding `EggSizeRule` entry in `eggSizeRules.json` (keyed by `familyId`)
3. `formId` convention: `familyId * 10 + stage` (e.g. familyId=580 → formIds 5801, 5802, 5803)
4. Do not add name/avatar fields to `Individual` — those are resolved from `PokemonForm`

## What NOT to do

- Don't import JSON files directly in views/components — use services
- Don't add backend/API code — V1 is purely static
- Don't use `createWebHistory` — the app uses hash routing (`createWebHashHistory`)
- Don't add `@element-plus/icons-vue` — it was intentionally removed; icon buttons use text instead
- Don't assume `npm install` works in this environment — node_modules was transplanted from another project; missing packages must be copied from sibling projects on the same disk
