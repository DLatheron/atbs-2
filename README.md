# ATBS

TypeScript monorepo with a React client, Express API, and shared workspace packages.

## Packages

| Package             | Description                  |
| ------------------- | ---------------------------- |
| `@atbs/client`      | React front-end (Vite)       |
| `@atbs/server`      | Express API                  |
| `@atbs/maths`       | Shared maths utilities       |
| `@atbs/misc`        | Shared misc utilities        |
| `@atbs/shared-data` | Shared Zod schemas and types |

## Prerequisites

- Node.js 24+ (see `.nvmrc`)
- [pnpm](https://pnpm.io/)

## Setup

```bash
pnpm install
pnpm build
```

## Development

Run client and server together (shared packages rebuild in watch mode):

```bash
pnpm dev
```

Or run them separately:

```bash
pnpm dev:shared   # watch-build shared packages
pnpm dev:server   # API on http://localhost:3001 (nodemon + tsx)
pnpm dev:client   # UI on http://localhost:5173 (Vite, proxies /api to the server)
```

Open http://localhost:5173 — the page shows the message from `GET /api/status`.

## Scripts

| Script        | Description        |
| ------------- | ------------------ |
| `pnpm build`  | Build all packages |
| `pnpm test`   | Run Vitest tests   |
| `pnpm lint`   | ESLint             |
| `pnpm format` | Prettier write     |

## API layout

Routes live under `packages/server/src/routes/`. Each feature has its own folder with a `*.router.ts` (wiring) and `*.handler.ts` (logic). Register routers in `routes/index.ts` under the `/api` prefix.

Example: `GET /api/status` → `routes/status/status.handler.ts`.
# atbs-2
