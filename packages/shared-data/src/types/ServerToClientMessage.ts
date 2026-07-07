import z from "zod";
import { LobbyState } from "./LobbyState.js";
import {
    ClientMap,
    ClientSummary,
    ErrorType,
    FireModeItemSummary,
    ItemSummary,
    OnTarget,
    RenderList,
    ScenarioId,
    ScenarioSummary,
    SideSummary,
    TileInfo,
    Tracer,
    TimedTileUpdate,
    UnitSummary,
    WaitingFor
} from "./PrimitiveTypes.js";
import { Phase } from "./Phase.js";
import { zodDeepPartial } from "zod-deep-partial";
import { RenderMode } from "./RenderMode.js";
import { IVec2, ITilePos, DebugGraphic } from "@atbs/maths";

export const ServerToClientMessage = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("server:hello"),
        payload: z.object({ gameId: z.string() })
    }),
    z.object({
        type: z.literal("server:pong"),
        payload: z.object({ nonce: z.number() })
    }),
    z.object({
        type: z.literal("server:lobby:state"),
        payload: LobbyState
    }),
    z.object({
        type: z.literal("server:client:connected"),
        payload: z.object({
            client: ClientSummary
        })
    }),
    z.object({
        type: z.literal("server:client:disconnected"),
        payload: z.object({
            client: ClientSummary
        })
    }),
    z.object({
        type: z.literal("server:lobby:client:renamed"),
        payload: z.object({
            oldName: z.string(),
            newName: z.string()
        })
    }),
    z.object({
        type: z.literal("server:lobby:client:side:changed"),
        payload: z.object({
            client: ClientSummary,
            oldSide: SideSummary.optional(),
            newSide: SideSummary.optional()
        })
    }),
    z.object({
        type: z.literal("server:lobby:client:ready"),
        payload: z.object({
            client: ClientSummary,
            ready: z.boolean()
        })
    }),
    z.object({
        type: z.literal("server:phase"),
        payload: z.object({ phase: Phase })
    }),
    z.object({
        type: z.literal("server:lobby:scenario:list"),
        payload: z.object({
            scenarios: z.array(ScenarioSummary).min(1)
        })
    }),
    z.object({
        type: z.literal("server:lobby:scenario:changed"),
        payload: z.object({
            client: ClientSummary,
            oldScenario: z
                .object({
                    id: ScenarioId,
                    name: z.string()
                })
                .optional(),
            newScenario: z
                .object({
                    id: ScenarioId,
                    name: z.string()
                })
                .optional()
        })
    }),
    z.object({
        type: z.literal("server:wait"),
        payload: WaitingFor.nullable()
    }),
    z.object({
        type: z.literal("server:map"),
        payload: ClientMap
    }),
    z.object({
        type: z.literal("server:unit:mode:move"),
        payload: UnitSummary.nullable()
    }),
    z.object({
        type: z.literal("server:unit:selected:update"),
        payload: zodDeepPartial(UnitSummary)
    }),
    z.object({
        type: z.literal("server:unit:mode:fire"),
        payload: FireModeItemSummary.nullable()
    }),
    z.object({
        type: z.literal("server:unit:weapon:update"),
        payload: zodDeepPartial(FireModeItemSummary)
    }),
    z.object({
        type: z.literal("server:unit:mode:throw"),
        payload: ItemSummary.nullable()
    }),
    z.object({
        type: z.literal("server:turn:start"),
        payload: z.object({
            turn: z.number().min(1)
        })
    }),
    z.object({
        type: z.literal("server:side:start"),
        payload: z.object({
            side: SideSummary
        })
    }),
    z.object({
        type: z.literal("server:game:tile:info"),
        payload: TileInfo
    }),
    z.object({
        type: z.literal("server:error"),
        payload: ErrorType
    }),
    z.object({
        type: z.literal("server:camera:move:to"),
        payload: z.discriminatedUnion("target", [
            z.object({
                target: z.literal("world"),
                worldPos: IVec2,
                trackingSpeed: z.number()
            }),
            z.object({
                target: z.literal("tile"),
                tilePos: ITilePos,
                trackingSpeed: z.number()
            })
        ])
    }),
    z.object({
        type: z.literal("server:wait:time"),
        payload: z.number().positive()
    }),
    z.object({
        type: z.literal("server:map:update"),
        payload: z.array(
            z.object({
                tilePos: ITilePos,
                tileByRenderMode: z.object({
                    [RenderMode.enum.MAP_MODE]: RenderList,
                    [RenderMode.enum.FIRE_MODE]: RenderList
                })
            })
        )
    }),
    z.object({
        type: z.literal("server:ui:disabled"),
        payload: z.boolean()
    }),
    z.object({
        type: z.literal("server:fire:trace"),
        payload: z.object({
            tracers: z.array(Tracer),
            isOnTarget: OnTarget,
            tileUpdates: z.array(TimedTileUpdate).optional().default([])
        })
    }),
    z.object({
        type: z.literal("server:debug:graphics"),
        payload: z.array(DebugGraphic).nullable()
    })
]);
export type ServerToClientMessage = z.infer<typeof ServerToClientMessage>;
