# @atbs/shared-data — Agent Guide

**Single source of truth** for wire formats and domain primitives shared by client and server: Zod schemas + inferred TypeScript types.

See also: [root AGENT.md](../../AGENT.md).

## Stack

- Zod, `zod-deep-partial`
- Workspace: `@atbs/maths` (vectors, tiles, orientations, paths, debug graphics)

## Layout

| Path                       | Role                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `src/index.ts`             | Re-exports `./types`                                                  |
| `src/types/index.ts`       | Barrel                                                                |
| `ClientToServerMessage.ts` | Discriminated union `client:…`                                        |
| `ServerToClientMessage.ts` | Discriminated union `server:…`                                        |
| `PrimitiveTypes.ts`        | Ids, `UnitSummary`, `ClientMap`, fire helpers, `VisibilityUpdate`     |
| `Phase.ts`                 | `main_menu \| lobby \| armament \| deployment \| action \| game_over` |
| `SceneObject.ts`           | Recursive scene graph → `RenderList`                                  |
| `AnimationTypes.ts`        | Animation recipes, play/death payloads                                |
| `LobbyState.ts`            | Lobby snapshot                                                        |
| `RestTypes.ts`             | Create/join/status bodies, URL query parsing                          |
| `RenderMode.ts`            | `UI_MODE \| MAP_MODE \| FIRE_MODE`                                    |
| `VfxTypes.ts`              | `VfxId`                                                               |

Exports resolve via package `exports` → `dist/`. Keep the package built or in `pnpm dev` watch when changing schemas.

## Patterns

- **Zod-first**: export `z.infer<typeof Schema>`; `.parse()` at client/server boundaries.
- Message shape: `{ type: string, payload: … }` discriminated unions.
- Naming: client→server `client:…`, server→client `server:…`.
- Partial updates use `zod-deep-partial` (e.g. selected-unit patches).
- Scene trees resolve to `RenderImage[]` given `SceneContext` (mode, orientation, frame, states).
- Fire AP/ammo helpers live here so UI costs and server costs stay aligned.

## Do

- Add or change any WS/REST field here **first**, then implement handlers on both sides.
- Prefer shared id schemas (`ClientId`, `GameId`, unit/item ids) over ad-hoc strings.
- Colocate schema tests next to modules when behavior is non-trivial (`SceneObject.test.ts`).

## Don't

- Define parallel message types or domain DTOs only in client or only in server.
- Treat `VisibilityUpdate.tiles` as objects — they are **strings** (`TilePos.toString()`).
- Confuse `anim-*` image ids (animation instance placeholders) with real PNG ids served by `ImageManager`.
- Change `Phase` or message unions without updating the matching client page and server phase handler.
