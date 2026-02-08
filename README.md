# Cricket GM

A local-first, fictional cricket franchise simulation game (single-season MVP) inspired by management-sim UX patterns while using an original cricket-specific simulation and data model.

## MVP Features

- 10 fictional city-inspired franchises (no real IPL teams or real player names)
- Simplified budget auction with squad caps
- T20 regular-season fixture generation
- Deterministic canonical match simulation (seed-based)
- Team standings and player season stats
- Roster setup (playing XI + bowling preset)
- Save import/export with strict validation and rollback safety
- PWA shell with offline support after first load
- Storage adapter fallback chain:
  - OPFS SQLite
  - IndexedDB SQLite
  - IndexedDB KV emergency fallback

## Architecture

- `src/domain`: pure simulation rules, entities, invariants
- `src/application`: use cases, contracts, mappers
- `src/infrastructure`: storage adapters and repository
- `src/ui`: route pages and layout
- `src/workers`: season simulation worker

## Scripts

- `npm run dev`: start local dev server
- `npm run lint`: run ESLint
- `npm run test`: run unit/integration/property tests with coverage
- `npm run build`: typecheck + production build
- `npm run test:e2e`: run Playwright smoke test

## Testing Notes

If Playwright browsers are not installed locally:

```bash
npx playwright install chromium
```

## Legal/Content Safety

This project is a fictional simulation and is not affiliated with IPL franchises or real players.
