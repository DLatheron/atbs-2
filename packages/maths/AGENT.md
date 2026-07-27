# @atbs/maths — Agent Guide

Shared 2D math and geometry used by client and server: vectors, tile positions, orientations, AABBs, paths, penetration helpers, colours, debug graphic schemas.

See also: [root AGENT.md](../../AGENT.md).

## Stack

- `line-intersect`, `uuid`, `zod`, `zod-class`
- No workspace package dependencies (leaf library)

## Layout

| Path                                 | Role                                             |
| ------------------------------------ | ------------------------------------------------ |
| `src/index.ts`                       | Public exports                                   |
| `Vec2.ts`                            | Vector ops, direction steps                      |
| `TilePos.ts`                         | Grid coords; stringification for visibility sets |
| `Orientation.ts`                     | 8 directions + `CENTER`; degree/radian maps      |
| `Path.ts`                            | Timed path segments (tracers)                    |
| `Penetration.ts`                     | Pixel penetration cost helpers                   |
| `Aabb.ts` / `Mat22.ts` / `Colour.ts` | Bounds, matrices, colours                        |
| `DebugGraphics.ts`                   | Zod schemas for debug overlays                   |
| `Maths.ts` / `Misc.ts`               | Numeric helpers (`Misc` also as namespace)       |

## Patterns

- Classes plus Zod schemas for serializable shapes (`IVec2`, `ITilePos`).
- Orientation numeric values matter for directional sprite arrays (`0..7` + `CENTER`).
- Tests colocated: `*.test.ts` (Vec2, Path, TilePos, Penetration, Mat22).

## Do

- Prefer these types over ad-hoc `{ x, y }` / `{ col, row }` when crossing package boundaries.
- Put **pure geometry** here when both client and server need it.

## Don't

- Put game rules (visibility policy, AP, damage) in this package — those belong on the server.
- Break `TilePos` string formatting without updating visibility wire keys in `@atbs/shared-data` / server.
