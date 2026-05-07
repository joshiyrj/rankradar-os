# Run Report

Generated on: 2026-05-08

## Completed

- Built React frontend dashboard source.
- Built Node.js API gateway source.
- Built Python FastAPI data service source.
- Added SQLite mock data store.
- Added PostgreSQL migration.
- Added DataDive mock/live provider interface.
- Added alert detection, summaries, heatmap data, sync run tracking.
- Added README and architecture docs.

## Tests Actually Run

### Python

```bash
cd services/rankradar-worker
python3 -m unittest discover -s tests
```

Result: `9 tests passed`.

### Node API

```bash
cd apps/api
npm test
```

Result: `3 tests passed`.

### Syntax Checks

```bash
cd rankradar-os
npm --workspace apps/api run check
python3 -m compileall services/rankradar-worker/app
```

Result: passed.

## Not Run

React/Vite tests were added but not run in this sandbox because frontend npm dependency installation timed out. Run locally with:

```bash
cd apps/web
npm install
npm test
npm run build
```
