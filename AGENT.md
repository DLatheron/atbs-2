# ATBS — Agent Guide

Turn-based tactical combat game. **Authoritative server** owns simulation; **thin React + canvas client** renders and sends intents. Wire contracts live in Zod schemas in `@atbs/shared-data`.

## Packages

| Package | Role |
|---------|------|
| [`@atbs/client`](packages/client/AGENT.md) | React UI + canvas World renderer |
| [`@atbs/server`](packages/server/AGENT.md) | Express HTTP + WebSocket game host |
| [`@atbs/shared-data`](packages/shared-data/AGENT.md) | Shared Zod schemas / message types |
| [`@atbs/maths`](packages/maths/AGENT.md) | 2D vectors, tiles, orientations, paths |
| [`@atbs/misc`](packages/misc/AGENT.md) | Logger, MessageManager, PriorityQueue |

Dependency graph:

```
maths ← shared-data ← client
  ↑         ↑            ↑
  └──── misc ←───────────┘
  ↑         ↑
  └──── server
```

## Tooling

- **Node** 24+ (`.nvmrc`), **pnpm** workspace (`packages/*`)
- ESM everywhere (`"type": "module"`)
- Shared TS: `tsconfig.base.json` (ES2022, NodeNext, strict, composite)
- Tests: `pnpm test` (Vitest; `packages/**/*.test.ts`; aliases `@atbs/*` → package `src`)
- Lint/format: ESLint 9 flat config, Prettier

## Development

```bash
pnpm install && pnpm build
pnpm dev   # shared packages watch + server (:3000) + client (:5173)
```

Vite proxies `/api`, `/ws`, `/public` to the server. Open http://localhost:5173 with `client-id`, `game-id`, and `mode=create|join` query params (see README).

Prefer `pnpm --filter @atbs/<pkg> …` over the root `dev:maths` / `dev:misc` script names (those labels are swapped).

## Client ↔ server communication

```
Browser
  POST /api/game/create|join  →  GameManager registers Client
  WS   /ws/game?clientId&gameId
       ClientToServerMessage  →  Game → MessageManager → PhaseHandler
       ServerToClientMessage  ←  Client.sendMessage / MessageRouter
  GET  /api/image/:id         →  ImageManager PNG
```

- Messages are `{ type, payload }` discriminated unions. Prefixes: `client:…` / `server:…`.
- Parse with Zod at boundaries; extend schemas in `@atbs/shared-data` first.
- Lobby: direct/broadcast send. Post-lobby: `MessageRouter` routes by side and can pause/queue opposition traffic until their turn.

## Architecture rules for AIs

1. **Simulation stays on the server** (AP, LOS, damage, turns). Client only presents and sends intents.
2. **Never add parallel message/types** in client or server — extend `@atbs/shared-data`, rebuild, then implement handlers.
3. Images are server-served by id (PNG basename). Do not hardcode assets on the client from `packages/server/data`.
4. Put pure geometry in `@atbs/maths`, cross-cutting utils in `@atbs/misc`, wire types in `@atbs/shared-data`.
5. Shared packages emit `dist/`; keep them built or watching before importing from client/server.
6. Compiled packages use `.js` extensions in relative imports (NodeNext).

## Phase flow

`main_menu → lobby → armament → deployment → action → game_over`

Armament/deployment may be skipped when the scenario marks them fixed/unneeded.
