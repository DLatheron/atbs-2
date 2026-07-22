# @atbs/server — Agent Guide

Authoritative Express HTTP API + WebSocket game host. Loads JSON/PNG recipes from `data/`, runs phases, simulates units / combat / visibility / VFX, and pushes renderable updates to clients.

See also: [root AGENT.md](../../AGENT.md), [`@atbs/shared-data`](../shared-data/AGENT.md).

## Stack

- Express 5, `ws`, Zod, lodash, pngjs, zodified-config
- Workspace: `@atbs/maths`, `@atbs/misc`, `@atbs/shared-data`
- Dev: nodemon + tsx (watches `src`, `data`, sibling package `dist`)

## Layout

### Bootstrap

| Path | Role |
|------|------|
| `src/server.ts` | HTTP + WS upgrade on `/ws/game?clientId&gameId` |
| `src/app.ts` | Express; loads recipe/image managers into `app.locals` |
| `src/config/` | Zod config (`config/config.json`) |
| `src/routes/` | `*.router.ts` + `*.handler.ts`; mount under `/api` in `routes/index.ts` |

### Game core (`src/game/`)

| Path | Role |
|------|------|
| `GameManager.ts` | In-memory `Map<GameId, Game>` singleton |
| `Game.ts` | Session, phase machine, turns/sides, message routing |
| `Client.ts` / `ClientManager.ts` | Per-player WS binding |
| `MessageRouter.ts` | Side-targeted send + pause/resume queues |
| `phaseHandlers/*.ts` | Phase-specific WS handlers |
| `Unit.ts` | Move / rotate / fire / throw / damage; `VisibilityViewer` |
| `WorldMap.ts` / `Tile.ts` | Grid map, raycasts, client map rendering |
| `VisibilityManager.ts` / `VisibilityViewer.ts` / `VisibilityPoi.ts` | LOS, view cones, interest masks |
| `Projectile.ts` / `PenetrationSystem.ts` | Ballistics |
| `Scenario.ts` / `Side.ts` | Scenario instance + sides |
| `*RecipeManager.ts` / `ImageManager.ts` | Load `data/` recipes and PNGs |
| `AnimationRecipeManager.ts` / `AnimationDefinitions.ts` | Animation recipes + procedural death spins |
| `Vfx*.ts` | VFX instances/recipes |

### Data (`data/`)

| Dir | Contents |
|-----|----------|
| `animations/` | `*.animation.json` |
| `furniture/` | `*.furniture.json` + PNGs (`*-cl` collision) |
| `items/` | guns, magazines, rounds + PNGs |
| `maps/` | `*.map.json` |
| `materials/` | density / penetration |
| `scenarios/` | sides, units, phase flags |
| `terrain/` | `*.terrain.json` + PNGs |
| `units/` | `*.unit.json` + directional PNGs |
| `vfx/` | `*.vfx.json` + assets |
| `icons/` | UI PNGs |

JSON recipes are Zod-parsed; ids usually match the filename stem. Image id = PNG basename (no `.png`). Duplicate basenames across dirs throw on load. Nodemon CWD is `packages/server`; paths are `./data/...`.

## Patterns

**Connection** — REST create/join registers `Client` → browser opens WS → `Game.receiveMessage` Zod-parses → `MessageManager` → phase handler.

**Phases** — `Game.setPhase` swaps handler. Leaving lobby builds `MessageRouter` from side↔client mapping. Lobby uses `broadcastMessage` / direct `Client.sendMessage` only.

**Turns** — Playing side gets `server:side:start` and queued messages replay; opposition gets `server:wait` and sends are paused. Do not broadcast final `server:visible:tiles` before draining intermediate queued updates on side start.

**Authority** — Combat/movement/visibility live on `Unit`, `Projectile`, `VisibilityManager`, phase handlers. Client receives `RenderList` / tracers / deaths — it does not decide outcomes.

**Recipes** — Singleton `*Manager` loads `./data/<dir>`, Zod-parses, indexes by id. Instantiation managers clone recipes into live entities.

## Do

- Put new simulation logic on the server; expose results via `@atbs/shared-data` messages.
- Add HTTP features as `routes/<feature>/*.router.ts` + `*.handler.ts`, register in `routes/index.ts`.
- Keep `anim-*` tile image placeholders matched to animation `instanceId`s the client registers.
- For death spins: omit `worldPos` on play payloads when the tile already has an `anim-*` placeholder (avoids double-draw).

## Don't

- Mirror game rules on the client.
- Assume `MessageRouter.sendIfVisible` filters by fog of war — it currently always sends.
- Expect `MessageRouter` during lobby (it exists only after leaving lobby).
- Invent image ids that are not loaded by `ImageManager`.
- Edit recipe JSON without matching Zod schemas and referenced ids.
