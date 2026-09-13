import {
    DeathAnimation,
    HitSpark,
    OnTarget,
    RenderList,
    SideId,
    TimedAnimatableObject,
    TimedAnimatableObjectRemoval,
    TimedPlayAnimation,
    TimedTileUpdate,
    TimedVisibilityUpdate,
    Tracer,
    VisibilityFilter
} from "@atbs/shared-data";
import { TilePos, Vec2 } from "@atbs/maths";
import type { Game } from "./Game.js";

export interface FireTraceBasePayload {
    tracers: Tracer[];
    isOnTarget: OnTarget;
    tileUpdates: TimedTileUpdate[];
    deaths: DeathAnimation[];
    hitSparks: HitSpark[];
    animations: TimedPlayAnimation[];
    animObjects: TimedAnimatableObject[];
    animObjectRemovals: TimedAnimatableObjectRemoval[];
}

export interface BroadcastFireTraceProps {
    game: Game;
    payload: FireTraceBasePayload;
    actingSideId: SideId;
    originWorldPos: Vec2;
    originTilePos: TilePos;
    visibilityUpdatesBySide?: Map<SideId, TimedVisibilityUpdate[]>;
    /** Gun / explosion loudness for hear-only sides. When 0/omitted, no hearing cue. */
    noise?: number;
    /** If true, skip emitNoise (caller will emit once for a burst). */
    deferHearing?: boolean;
}

function sideCanSeeTile(game: Game, sideId: SideId, tilePos: TilePos): boolean {
    const tile = game.map.sampleTile(tilePos);
    return !!tile && game.getSide(sideId).canSee(tile);
}

function tracerVisibleToSide(game: Game, sideId: SideId, tracer: Tracer): boolean {
    return tracer.segments.some((segment) =>
        sideCanSeeTile(game, sideId, game.map.worldToTile(new Vec2(segment.pos)))
    );
}

function tileUpdateMentionsImage(update: TimedTileUpdate, imageId: string): boolean {
    const lists = [update.tileByRenderMode.MAP_MODE, update.tileByRenderMode.FIRE_MODE];
    for (const list of lists) {
        for (const image of list) {
            if (image.imageId === imageId) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Permanent map structure only: terrain / furniture / damage overlays.
 * Drops FOW-gated sprites (units, items, vfx) and death-anim placeholders.
 */
export function toStructuralTileUpdate(update: TimedTileUpdate): TimedTileUpdate {
    const strip = (list: RenderList): RenderList =>
        list.filter(
            (image) =>
                !image.visibilityFilter?.includes(VisibilityFilter.enum.visible) &&
                !image.imageId?.startsWith("anim-")
        );

    return {
        ...update,
        tileByRenderMode: {
            MAP_MODE: strip(update.tileByRenderMode.MAP_MODE),
            FIRE_MODE: strip(update.tileByRenderMode.FIRE_MODE)
        }
    };
}

function tileUpdatesForSide(
    game: Game,
    sideId: SideId,
    tileUpdates: TimedTileUpdate[]
): TimedTileUpdate[] {
    return tileUpdates.map((update) => {
        const tilePos = new TilePos(update.tilePos.col, update.tilePos.row);
        if (sideCanSeeTile(game, sideId, tilePos)) {
            return update;
        }
        return toStructuralTileUpdate(update);
    });
}

/**
 * World / ephemeral effects (gas, smoke, shockwave, hit sparks) are gated by the
 * effect's own tile — never by firer / shot origin visibility.
 */
function animObjectVisibleToSide(
    game: Game,
    sideId: SideId,
    animObject: TimedAnimatableObject,
    tileUpdates: TimedTileUpdate[]
): boolean {
    const { worldPos, instanceId } = animObject.recipe;
    if (worldPos) {
        return sideCanSeeTile(game, sideId, game.map.worldToTile(new Vec2(worldPos)));
    }

    const vfx = game.vfxManager?.findVfx?.(instanceId);
    if (vfx?.location) {
        return sideCanSeeTile(game, sideId, new TilePos(vfx.location.col, vfx.location.row));
    }

    return tileUpdates.some(
        (update) =>
            tileUpdateMentionsImage(update, instanceId) &&
            sideCanSeeTile(game, sideId, new TilePos(update.tilePos.col, update.tilePos.row))
    );
}

function animationVisibleToSide(
    game: Game,
    sideId: SideId,
    animation: TimedPlayAnimation,
    tileUpdates: TimedTileUpdate[],
    canSeeOrigin: boolean
): boolean {
    const { worldPos, instanceId } = animation.playAnimation;
    if (worldPos) {
        return sideCanSeeTile(game, sideId, game.map.worldToTile(new Vec2(worldPos)));
    }

    const mentionedOnVisibleTile = tileUpdates.some(
        (update) =>
            tileUpdateMentionsImage(update, instanceId) &&
            sideCanSeeTile(game, sideId, new TilePos(update.tilePos.col, update.tilePos.row))
    );
    if (mentionedOnVisibleTile) {
        return true;
    }

    // Muzzle-tied / origin-only animations without a world position.
    return canSeeOrigin;
}

function filterPayloadForSide(
    game: Game,
    sideId: SideId,
    payload: FireTraceBasePayload,
    originTilePos: TilePos
): FireTraceBasePayload | null {
    const canSeeOrigin = sideCanSeeTile(game, sideId, originTilePos);

    // Structural map damage always reaches every side. Unit sprites / death
    // placeholders stay visibility-gated via toStructuralTileUpdate.
    const tileUpdates = tileUpdatesForSide(game, sideId, payload.tileUpdates);

    const deaths = payload.deaths.filter((death) => {
        const id = death.playAnimation.instanceId;
        return payload.tileUpdates.some(
            (update) =>
                tileUpdateMentionsImage(update, id) &&
                sideCanSeeTile(game, sideId, new TilePos(update.tilePos.col, update.tilePos.row))
        );
    });

    const hitSparks = payload.hitSparks.filter((spark) =>
        sideCanSeeTile(game, sideId, game.map.worldToTile(new Vec2(spark.pos)))
    );

    const pathVisible = payload.tracers.some((tracer) => tracerVisibleToSide(game, sideId, tracer));
    const tracers =
        canSeeOrigin || pathVisible
            ? payload.tracers.filter(
                  (tracer) => canSeeOrigin || tracerVisibleToSide(game, sideId, tracer)
              )
            : [];

    const animations = payload.animations.filter((animation) =>
        animationVisibleToSide(game, sideId, animation, payload.tileUpdates, canSeeOrigin)
    );
    const animObjects = payload.animObjects.filter((animObject) =>
        animObjectVisibleToSide(game, sideId, animObject, payload.tileUpdates)
    );
    // Removals are cleanup: include whenever we send. Clients that never spawned
    // the object no-op; sides that saw the cloud still clear it on decay.
    const animObjectRemovals = payload.animObjectRemovals;

    const hasEphemeralVisual =
        canSeeOrigin ||
        tracers.length > 0 ||
        deaths.length > 0 ||
        hitSparks.length > 0 ||
        animations.length > 0 ||
        animObjects.length > 0;

    // Always deliver when there are tile updates (structural sync) or ephemeral visuals.
    if (!hasEphemeralVisual && tileUpdates.length === 0) {
        return null;
    }

    return {
        tracers,
        isOnTarget: payload.isOnTarget,
        tileUpdates,
        deaths,
        hitSparks,
        animations,
        animObjects,
        animObjectRemovals
    };
}

/**
 * Per-side fire:trace broadcast:
 * - Acting side: full payload
 * - Other sides: structural tile updates always; tracers/deaths/unit sprites when
 *   visible; gas/smoke/shockwave/hit sparks by effect tile (not firer);
 *   hear-only sides still get structural tiles (emitNoise separately)
 */
export function broadcastFilteredFireTrace(props: BroadcastFireTraceProps): Set<SideId> {
    const {
        game,
        payload,
        actingSideId,
        originWorldPos,
        originTilePos,
        visibilityUpdatesBySide,
        noise,
        deferHearing
    } = props;

    const sidesWithVisual = new Set<SideId>();

    for (const side of game.sides) {
        if (side.id === actingSideId) {
            game.messageRouter.send(
                {
                    type: "server:fire:trace",
                    payload: {
                        ...payload,
                        visibilityUpdates: visibilityUpdatesBySide?.get(side.id) ?? []
                    }
                },
                side.id
            );
            sidesWithVisual.add(side.id);
            continue;
        }

        const filtered = filterPayloadForSide(game, side.id, payload, originTilePos);
        if (filtered) {
            game.messageRouter.send(
                {
                    type: "server:fire:trace",
                    payload: {
                        ...filtered,
                        visibilityUpdates: visibilityUpdatesBySide?.get(side.id) ?? []
                    }
                },
                side.id
            );
            sidesWithVisual.add(side.id);
        }
    }

    if (!deferHearing && noise && noise > 0) {
        const relevantTilePoses = [
            originTilePos,
            ...payload.tileUpdates.map((u) => new TilePos(u.tilePos.col, u.tilePos.row))
        ];
        game.hearingManager.emitNoise({
            worldPos: originWorldPos,
            noise,
            actingSideId,
            relevantTilePoses
        });
    }

    return sidesWithVisual;
}
