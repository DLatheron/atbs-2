import z from "zod";
import {
    ClientId,
    FireDetails,
    FireMode,
    FireSelector,
    ItemId,
    Prime,
    ScenarioId,
    SideId,
    ThrowDetails,
    UnitId
} from "./PrimitiveTypes.js";
import { ITilePos, IVec2, Orientation } from "@atbs/maths";
import { UnitActionType } from "./ActionTypes.js";

export const ClientPingPayload = z.object({ nonce: z.number() });
export type ClientPingPayload = z.infer<typeof ClientPingPayload>;

export const ClientRenamePayload = z.object({ name: z.string().nonempty() });
export type ClientRenamePayload = z.infer<typeof ClientRenamePayload>;

export const ClientToServerMessage = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("client:ping"),
        payload: ClientPingPayload
    }),
    z.object({
        type: z.literal("client:rename"),
        payload: ClientRenamePayload
    }),
    z.object({
        type: z.literal("client:side:change"),
        payload: z.object({
            clientId: ClientId,
            sideId: SideId.nullable()
        })
    }),
    z.object({
        type: z.literal("client:ready"),
        payload: z.object({
            ready: z.boolean()
        })
    }),
    z.object({
        type: z.literal("client:scenario:change"),
        payload: z.object({
            scenarioId: ScenarioId.nullable()
        })
    }),
    z.object({
        type: z.literal("client:lobby:game:start"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:armament:end"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:armament:buy"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId,
            use: z.boolean().optional(),
            insertionPoint: z.int().nonnegative().optional()
        })
    }),
    z.object({
        type: z.literal("client:armament:sell"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId,
            quantity: z.int().positive()
        })
    }),
    z.object({
        type: z.literal("client:armament:load"),
        payload: z.object({
            unitId: UnitId,
            receiverId: ItemId,
            ammoId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:armament:unload"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:armament:use"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:armament:unuse"),
        payload: z.object({
            unitId: UnitId
        })
    }),
    z.object({
        type: z.literal("client:armament:reorder"),
        payload: z.object({
            unitId: UnitId,
            fromIndex: z.int().nonnegative(),
            toIndex: z.int().nonnegative()
        })
    }),
    z.object({
        type: z.literal("client:deployment:end"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:deployment:deploy"),
        payload: z.object({
            unitId: UnitId,
            tilePos: ITilePos
        })
    }),
    z.object({
        type: z.literal("client:deployment:undeploy"),
        payload: z.object({
            unitId: UnitId
        })
    }),
    z.object({
        type: z.literal("client:deployment:deploy:random"),
        payload: z.object({
            unitId: UnitId
        })
    }),
    z.object({
        type: z.literal("client:deployment:deploy:all"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:deployment:undeploy:all"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:game:refresh"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:game:tile:info"),
        payload: z.object({
            tilePos: ITilePos
        })
    }),
    z.object({
        type: z.literal("client:game:turn:end"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:game:tile:click"),
        payload: z.object({
            tilePos: ITilePos,
            worldPos: IVec2
        })
    }),
    z.object({
        type: z.literal("client:unit:move:end"),
        payload: UnitId
    }),
    z.object({
        type: z.literal("client:unit:rotate"),
        payload: z.object({
            unitId: UnitId,
            orientation: z.enum(Orientation)
        })
    }),
    z.object({
        type: z.literal("client:unit:move"),
        payload: z.object({
            unitId: UnitId,
            orientation: z.enum(Orientation)
        })
    }),
    z.object({
        type: z.literal("client:unit:mode:fire"),
        payload: UnitId
    }),
    z.object({
        type: z.literal("client:unit:mode:fire:end"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:unit:fire:selector"),
        payload: z.object({
            unitId: UnitId,
            weaponId: ItemId,
            fireSelector: FireSelector
        })
    }),
    z.object({
        type: z.literal("client:unit:fire:mode"),
        payload: z.object({
            unitId: UnitId,
            fireMode: FireMode
        })
    }),
    z.object({
        type: z.literal("client:unit:weapon:index"),
        payload: z.object({
            unitId: UnitId,
            weaponIndex: z.int().nonnegative()
        })
    }),
    z.object({
        type: z.literal("client:unit:fire"),
        payload: FireDetails
    }),
    z.object({
        type: z.literal("client:unit:throw"),
        payload: ThrowDetails
    }),
    z.object({
        type: z.literal("client:unit:inventory"),
        payload: z.object({
            unitId: UnitId
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:use"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:unuse"),
        payload: z.object({
            unitId: UnitId
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:drop"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:pickup"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId,
            use: z.boolean().optional()
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:load"),
        payload: z.object({
            unitId: UnitId,
            receiverId: ItemId,
            ammoId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:unload"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId
        })
    }),
    z.object({
        type: z.literal("client:unit:inventory:reorder"),
        payload: z.object({
            unitId: UnitId,
            fromIndex: z.int().nonnegative(),
            toIndex: z.int().nonnegative()
        })
    }),
    z.object({
        type: z.literal("client:unit:action"),
        payload: z.object({
            unitId: UnitId,
            action: UnitActionType,
            orientation: z.enum(Orientation)
        })
    }),
    z.object({
        type: z.literal("client:raycast"),
        payload: z.object({
            srcWorldPos: IVec2,
            dstWorldPos: IVec2
        })
    }),
    z.object({
        type: z.literal("client:game:unit:next"),
        payload: z.null()
    }),
    z.object({
        type: z.literal("client:unit:prime"),
        payload: z.object({
            unitId: UnitId,
            itemId: ItemId,
            prime: Prime
        })
    })
]);
export type ClientToServerMessage = z.infer<typeof ClientToServerMessage>;
