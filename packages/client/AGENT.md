# @atbs/client — Agent Guide

React 19 + MUI shell and canvas **World** renderer. Connects via REST + WebSocket, drives phase pages from `server:phase`, sends player intents, and plays tracers / animations / fog from server payloads. **No authoritative simulation.**

See also: [root AGENT.md](../../AGENT.md), [`@atbs/shared-data`](../shared-data/AGENT.md), [`@atbs/server`](../server/AGENT.md).

## Stack

- React 19, React Router 7, MUI 9, Emotion, Vite 6
- Workspace: `@atbs/maths`, `@atbs/misc`, `@atbs/shared-data`

## Layout

| Path | Role |
|------|------|
| `src/main.tsx` | Router → `App` |
| `src/App.tsx` | Phase switch; global `server:phase` / wait handlers |
| `src/GameSocket.ts` | Browser WebSocket to `/ws/game` |
| `src/hooks/useServerSocket.ts` | Create/join REST + socket + URL params |
| `src/hooks/useServerMessageManager.ts` | **Singleton** MessageManager + `sendMessage` |
| `src/hooks/useWorld.ts` | `World.GetSingleton()` |
| `src/pages/*` | Phase UIs (`MainMenu`, `Lobby`, `Armament`, `Deployment`, `Action`) |
| `src/World.ts` | Map camera, modes, fog, tracers, death timeline, draw |
| `src/RenderHelpers.ts` | Canvas drawing helpers |
| `src/Camera2d.ts` | Viewport / interpolation |
| `src/ImageCache.ts` | Fetches `/api/image/:id` |
| `src/Animation*.ts` | Client animation playback |
| `src/modeHandlers/*` | Map / unit / fire interaction |
| `src/components/Map/` | Canvas host |
| `vite.config.ts` | Proxies `/api`, `/ws`, `/public` → `:3000` |

## Patterns

**Phase UI** — `App` keeps pages mounted with `visible={phase === …}`; remount on new `gameId`.

**Pages** — `*Page.tsx` + `use*Page.ts` for handlers/state. Action page owns most `server:*` combat handlers.

**World singleton** — Holds `ClientMap`, selection, visibility, `AnimationController`, mode handlers. `mapMode` switches `MAP_MODE` / `FIRE_MODE`. Image ids starting with `anim-` draw via `AnimationController`, not `ImageCache`.

**Intents (examples)** — `client:unit:move|rotate|fire|throw`, `client:game:turn:end`, `client:tile:click`. Outcomes come back as `server:fire:trace`, map updates, visibility, animations.

## Do

- Import message/types from `@atbs/shared-data`.
- Register MessageManager handlers via the existing singleton in `useServerMessageManager`.
- Treat `server:fire:trace` as async playback that **blocks** the message queue until finished.
- Fetch images only through `ImageCache` / `/api/image/:id`.

## Don't

- Implement game rules (AP, LOS, damage, turn order) on the client.
- Create a second `MessageManager` instance without coordinating with the singleton.
- Deep-import `../shared-data/src/...` (prefer package exports); avoid spreading that pattern.
- Assume remounting a page recreates `World` — it is a process-wide singleton; reset carefully.
- Read `packages/server/data` from the client.
