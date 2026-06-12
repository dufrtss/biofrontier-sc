# BioFrontier SC

Interactive frontier intelligence map for biodiversity discovery in Santa Catarina, Brazil. Combines GBIF occurrence data with survey effort scoring and H3 hexagonal grids to rank locations by probability of undescribed species discovery.

**Languages:** PT-BR · EN · ES

---

## Prerequisites

- Node.js 20+
- npm
- Docker (optional — for production container and dev container)

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Dev Container

Requires VS Code with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension.

1. Open this folder in VS Code
2. When prompted, click **Reopen in Container**
3. `npm install` runs automatically
4. Run `npm run dev` inside the container

---

## Lint

```bash
npm run lint
```

---

## Test

```bash
npm run test            # run once
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

Tests cover pure scoring and geometry logic in `src/lib/`.

---

## Production Build (local)

```bash
npm run build
npm start
```

---

## Docker (production)

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Stop with `docker compose down`.

---

## Data Scripts

Pre-computed data is bundled in `public/data/`. To regenerate:

```bash
npm run data:fetch             # fetch GBIF occurrences for SC → public/data/hexbins.json
npm run data:habitat           # compute habitat scores → public/data/habitat-by-hex.json
npm run data:habitat-fallback  # fallback habitat computation (no external API)
```

Bulk GBIF downloads (>100k records) require a free GBIF account. See `scripts/` for details.

---

## Architecture

```
src/
├── app/[locale]/        # Next.js app router — locale routing
├── features/
│   ├── map/             # GapMap — Leaflet hex grid visualisation
│   ├── ranking/         # FrontierRanking — top 20 ranked hexbins sidebar
│   ├── detail/          # HexDetail — selected hex information panel
│   ├── controls/        # TaxonSelector, LocaleSwitcher, DataSummaryBar
│   └── methodology/     # MethodologyPanel — scoring methodology docs
├── components/
│   ├── shell/           # AppShell — top-level layout orchestrator
│   └── ui/              # InfoTooltip — shared stateless primitives
├── hooks/               # useBiofrontierData — data fetching and derived state
├── lib/                 # Pure functions: scoring, h3-utils, color, types
├── i18n/                # next-intl routing and request config
└── messages/            # Translation files: en, pt-BR, es
```

Features do not import from each other. Cross-feature data flows through `hooks/` or props via `AppShell`.
