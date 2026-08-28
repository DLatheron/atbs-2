import z from "zod";
import { LobbyState } from "./LobbyState.js";
import {
    ClientMap,
    ClientSummary,
    Description,
    ErrorType,
    FireModeItemSummary,
    FireModeWeaponSummary,
    InventorySnapshot,
    ItemSummary,
    OnTarget,
    ScenarioId,
    ScenarioSummary,
    SideSummary,
    TileInfo,
    Tracer,
    TimedTileUpdate,
    HitSpark,
    WaitingFor,
    TileUpdate,
    VisibilityUpdate,
    TimedVisibilityUpdate,
    UnitId,
    InstanceId,
    StoreSnapshot,
    DeploymentZoneSummaryWire,
    UnitDeploymentWire
} from "./PrimitiveTypes.js";
import { Phase } from "./Phase.js";
import { zodDeepPartial } from "zod-deep-partial";
import { IVec2, ITilePos, DebugGraphic } from "@atbs/maths";
import {
    AnimatableObjectRecipe,
    DeathAnimation,
    PlayAnimation,
    TimedAnimatableObject,
    TimedAnimatableObjectRemoval,
    TimedPlayAnimation
} from "./AnimationTypes.js";
import { UnitSummary } from "./UnitSummary.js";

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
        // Keep Description/ItemSummary intact; deep-partial unions strip `{ text }` to `{}`.
        payload: zodDeepPartial(UnitSummary.omit({ description: true, itemInUse: true })).extend({
            description: Description.optional(),
            itemInUse: ItemSummary.nullable().optional()
        })
    }),
    z.object({
        type: z.literal("server:unit:mode:fire"),
        payload: FireModeItemSummary.nullable()
    }),
    z.object({
        type: z.literal("server:unit:mode:fire:end"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("server:unit:weapon:update"),
        payload: zodDeepPartial(
            FireModeItemSummary.omit({ description: true, weapons: true })
        ).extend({
            description: Description.optional(),
            weapons: z.array(FireModeWeaponSummary).optional()
        })
    }),
    z.object({
        type: z.literal("server:unit:mode:throw"),
        payload: ItemSummary.nullable()
    }),
    z.object({
        type: z.literal("server:unit:inventory"),
        payload: InventorySnapshot
    }),
    z.object({
        type: z.literal("server:armament:state"),
        payload: z.object({
            units: z.array(UnitSummary),
            store: StoreSnapshot,
            inventories: z.array(InventorySnapshot)
        })
    }),
    z.object({
        type: z.literal("server:armament:update"),
        payload: z.object({
            unitId: UnitId,
            inventory: InventorySnapshot,
            store: StoreSnapshot,
            unit: UnitSummary
        })
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
        payload: z.array(TileUpdate)
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
            tileUpdates: z.array(TimedTileUpdate).optional().default([]),
            deaths: z.array(DeathAnimation).optional().default([]),
            hitSparks: z.array(HitSpark).optional().default([]),
            animations: z.array(TimedPlayAnimation).optional().default([]),
            animObjects: z.array(TimedAnimatableObject).optional().default([]),
            animObjectRemovals: z.array(TimedAnimatableObjectRemoval).optional().default([]),
            visibilityUpdates: z.array(TimedVisibilityUpdate).optional().default([])
        })
    }),
    z.object({
        type: z.literal("server:debug:graphics"),
        payload: z.array(DebugGraphic).nullable()
    }),
    z.object({
        type: z.literal("server:visible:tiles"),
        payload: VisibilityUpdate
    }),
    z.object({
        type: z.literal("server:animations:play"),
        payload: z.array(PlayAnimation)
    }),
    z.object({
        type: z.literal("server:anim:objects:create"),
        payload: z.array(AnimatableObjectRecipe)
    }),
    z.object({
        type: z.literal("server:anim:objects:remove"),
        payload: z.array(InstanceId)
    }),
    z.object({
        type: z.literal("server:opportunity:fire"),
        payload: z.object({
            unit: z.object({
                id: UnitId,
                name: z.string()
            })
        })
    }),
    z.object({
        type: z.literal("server:opportunity:fire:start"),
        payload: z.object({
            unit: z.object({
                name: z.string()
            })
        })
    }),
    z.object({
        type: z.literal("server:opportunity:fire:end"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("server:deployment:side:start"),
        payload: z.object({
            side: SideSummary,
            units: z.array(UnitSummary)
        })
    }),
    z.object({
        type: z.literal("server:deployment:markers"),
        payload: z.object({
            marker: z.string(),
            deploymentZones: DeploymentZoneSummaryWire,
            units: z
                .record(UnitId, UnitDeploymentWire)
                .describe("Deployment location and facing for each unit"),
            canEndDeployment: z
                .boolean()
                .describe(
                    "True when all units are deployed and every zone meets its minUnits requirement"
                ),
            endDeploymentBlockedReason: z
                .string()
                .nullable()
                .describe("Why deployment cannot end; null when canEndDeployment is true")
        })
    })
]);
export type ServerToClientMessage = z.infer<typeof ServerToClientMessage>;
