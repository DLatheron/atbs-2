import { SideId } from "@atbs/shared-data";
import { CloudGenerator } from "./CloudGenerator.js";
import type { ExplosionDetonationResult } from "./ExplosionSystem.js";

function mergeCloudResults(
    into: ExplosionDetonationResult,
    from: ExplosionDetonationResult
): ExplosionDetonationResult {
    into.tracers.push(...from.tracers);
    into.tileUpdates.push(...from.tileUpdates);
    into.deaths.push(...from.deaths);
    into.hitSparks.push(...from.hitSparks);
    into.animations.push(...from.animations);
    into.animObjects = [...(into.animObjects ?? []), ...(from.animObjects ?? [])];
    into.animObjectRemovals = [
        ...(into.animObjectRemovals ?? []),
        ...(from.animObjectRemovals ?? [])
    ];

    if (from.visibilityUpdatesBySide) {
        const dest = into.visibilityUpdatesBySide ?? new Map();
        into.visibilityUpdatesBySide = dest;
        for (const [sideId, updates] of from.visibilityUpdatesBySide) {
            dest.set(sideId, [...(dest.get(sideId) ?? []), ...updates]);
        }
    }

    return into;
}

export class CloudManager {
    private readonly _sideIdToGenerators = new Map<SideId, CloudGenerator[]>();

    addCloudGenerator(sideId: SideId, generator: CloudGenerator): void {
        const generators = this._sideIdToGenerators.get(sideId) ?? [];
        generators.push(generator);
        this._sideIdToGenerators.set(sideId, generators);
    }

    tickSide(sideId: SideId, timeOffsetMs = 0): ExplosionDetonationResult | null {
        const generators = [...(this._sideIdToGenerators.get(sideId) ?? [])];
        if (generators.length === 0) {
            return null;
        }

        const merged: ExplosionDetonationResult = {
            tracers: [],
            tileUpdates: [],
            deaths: [],
            hitSparks: [],
            animations: [],
            animObjects: [],
            animObjectRemovals: [],
            visibilityUpdatesBySide: new Map()
        };

        const remaining: CloudGenerator[] = [];
        for (const generator of generators) {
            mergeCloudResults(merged, generator.tick(timeOffsetMs));
            if (generator.hasWorkRemaining) {
                remaining.push(generator);
            }
        }

        this._sideIdToGenerators.set(sideId, remaining);

        const hasPlayback =
            merged.tileUpdates.length > 0 ||
            (merged.animObjects?.length ?? 0) > 0 ||
            (merged.animObjectRemovals?.length ?? 0) > 0 ||
            merged.animations.length > 0;

        return hasPlayback ? merged : null;
    }
}
