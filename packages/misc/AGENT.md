# @atbs/misc — Agent Guide

Small cross-cutting utilities shared by client and server: logging, typed message dispatch, priority queue, array/TS helpers.

See also: [root AGENT.md](../../AGENT.md).

## Stack

- `uuid`
- No workspace package dependencies (leaf library)

## Layout

| Path                                      | Role                                                                |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `src/index.ts`                            | Public exports                                                      |
| `MessageManager.ts`                       | Typed register / enqueue / process for `{ type, payload }` messages |
| `Logger.ts`                               | Level-filtered console logger + `LogLevel` Zod enum                 |
| `PriorityQueue.ts`                        | Used by server projectile collision scheduling                      |
| `CastToArray.ts` / `typescriptHelpers.ts` | Small helpers                                                       |

## Patterns

**MessageManager** is the event bus on both ends:

- Server: `ClientToServerMessage` from `Client`
- Client: `ServerToClientMessage` via the singleton in `useServerMessageManager`

Handlers register by message `type` and return unregister handles `[type, handlerId]`. Async handlers are awaited sequentially; errors are logged and processing continues.

Tests: `MessageManager.test.ts`.

## Do

- Register handlers **before** messages of that type can arrive (`getMessageHandlerEntries` throws otherwise).
- On the client, use the existing module-level singleton — do not create a second instance per page without coordinating.
- Use `Logger` with a system name; server levels come from `config.logLevels`.

## Don't

- Put domain schemas or game logic here — use `@atbs/shared-data` / `@atbs/server`.
- Assume failed handlers abort the whole queue; they are logged and the next message still runs.
