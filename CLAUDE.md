# iReports

Internal platform of the **iRepair** company — a layer built on top of the company's corporate ERP systems and the central point where all company data is collected. The project aggregates reporting, analytics, and IT services that automate the work of the company's three business lines, and is gradually becoming a single source of truth for the entire organization.

## About the company

**iRepair** ([irepair.ru](https://irepair.ru), [irepair-store.ru](https://irepair-store.ru)) is an Apple service center and reseller that has been on the market for more than 10 years. The company specializes in selling, repairing, and servicing Apple devices and related accessories, as well as providing associated services. Diagnostics are free, and completed repairs and installed parts are covered by a warranty of up to 12 months.

The company's business is split into three lines, each represented in the project as a separate domain:

- **Wholesale (`opt`)** — wholesale sales of Apple devices and accessories. This domain is reserved for future development; no functionality has been implemented yet, and the corresponding directory is empty.
- **Service (`service`)** — repair and maintenance of Apple devices. The company's core business line, and the one with the most functionality implemented in the project so far (deal analytics, service sales funnel, payroll reports, etc.).
- **Shop (`shop`)** — retail sale of new devices and accessories to end customers.

Each business line has its own accounting (ERP) system, which iReports integrates with:

| Business line | ERP system |
|---|---|
| Service | **RemOnline** (referred to in the project as the RoApp integration) |
| Shop | **МойСклад** (MoySklad) |
| Company-wide (CRM, deals, document flow) | **Bitrix24** |

## Repository architecture

A monorepo consisting of three parts:

```
iReports/
├── backend/      — API and business logic (NestJS)
├── frontend/     — web UI (React)
├── contracts/    — shared contracts between backend and frontend
└── docker-compose.yml
```

### `contracts` — shared contracts

A separate npm package (`ireports-contracts`) reused by both the backend and the frontend as the single source of truth for the shape of the data they exchange. Schemas are defined with [Zod](https://zod.dev), which provides both runtime validation and static TypeScript types without duplication. The backend consumes the package as a workspace dependency; the frontend does the same from within the monorepo.

### `backend` — API

- **NestJS** (Node.js/TypeScript) — the main framework.
- **CQRS** (`@nestjs/cqrs`) — separation of commands and queries within the domain logic.
- **Prisma** + **PostgreSQL** (the `pgvector/pgvector` image, with support for vector fields for future AI scenarios) — data access.
- **Zod** / `nestjs-zod` — request validation based on contracts from `contracts`.
- Code is organized by domain (`src/domains/{opt,service,shop}`); each domain has its own integrations, modules, and syncs with the corresponding external ERP system. Cross-domain infrastructure and shared abstractions live in `src/shared` and `src/infrustructure`.
- External integrations: **Bitrix24**, **RoApp/RemOnline**, **МойСклад (MoySklad)**, Google Sheets, and an AI integration (OpenAI-compatible API) for analytics and auxiliary scenarios.
- `backend/deprecated` contains code from the previous version of the backend, before it was split into domains — kept around while functionality is being migrated over.

### `frontend` — web UI

- **React 19** + **Vite** + **TypeScript**.
- **TanStack Query** — server state and API request caching.
- **React Router** — routing.
- **Tailwind CSS** + **shadcn/radix-ui** — styling and UI components.
- **Recharts** — charts and analytics dashboards.
- The architecture follows **Feature-Sliced Design** principles: layers `app` (bootstrapping and configuration) → `pages` (screens) → `features` (business functionality) → `kernel` (shared types/interfaces) → `shared` (pure infrastructure with no business logic), with rules restricting the direction of imports between layers.

### Infrastructure

- Deployment via **Docker Compose**: `postgres` (pgvector), `backend`, `frontend` (Nginx).
- CI/CD — GitHub Actions (`.github/workflows/deploy.yml`).

## Endpoint list

The up-to-date list of backend HTTP endpoints is in [`ENDPOINTS.md`](./ENDPOINTS.md).

## Further documentation

As the project grows, this section will link to more detailed MD files for each domain and module:

- `opt/` — _(in development)_
- `service/` — _(to be added)_
- `shop/` — _(to be added)_
- `contracts/` — _(to be added)_

## AI agent instructions

- [`backend/CLAUDE.md`](./backend/CLAUDE.md) — instructions for working on the backend.
- [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) — instructions for working on the frontend.