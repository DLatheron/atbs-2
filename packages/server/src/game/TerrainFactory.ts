import { CastToArray } from "@atbs/misc";
import { Orientation } from "@atbs/maths";
import { decodeCompoundId, isCompoundId } from "./ImageManager.js";
import { Terrain, TerrainRecipe } from "./Terrain.js";
import { TerrainManager } from "./TerrainManager.js";

export class TerrainFactory {
    static createCompoundTerrain(terrainId: string): Terrain {
        if (!isCompoundId(terrainId)) {
            throw new Error(`Not a compound terrain id: ${terrainId}`);
        }

        const {
            background: { id: backgroundId, orientation: backgroundOrientation },
            blend: { id: blendId, orientation: blendOrientation },
            foreground: { id: foregroundId, orientation: foregroundOrientation }
        } = decodeCompoundId(terrainId);

        const foregroundRecipeId = `${foregroundId}.terrain`;
        const backgroundRecipeId = `${backgroundId}.terrain`;

        const foregroundTerrain = TerrainManager.GetSingleton().get(foregroundRecipeId);
        const backgroundTerrain = TerrainManager.GetSingleton().get(backgroundRecipeId);

        const terrainRecipe: TerrainRecipe = {
            id: terrainId,
            name: `${foregroundTerrain.name} & ${backgroundTerrain.name}`,
            category: "Terrain",
            description: [
                ...CastToArray(foregroundTerrain.description),
                ...CastToArray(backgroundTerrain.description)
            ],
            orientation: Orientation.NORTH,
            renderable: {
                default: [{ imageId: terrainId }],
                FIRE_MODE: []
            }
        };

        const terrain = new Terrain(terrainRecipe);
        TerrainManager.GetSingleton().add(terrain);

        TerrainFactory.Logger?.info?.({
            terrainId,
            backgroundId,
            backgroundOrientation,
            blendId,
            blendOrientation,
            foregroundId,
            foregroundOrientation
        });

        return terrain;
    }

    private static Logger = {
        info: (msg: unknown) => console.info("[TerrainFactory]", msg)
    };
}
