import { LogLevel } from "@atbs/misc";
import { readFileSync } from "fs";
import z from "zod";

const Config = z
    .object({
        port: z.int().min(1024).max(65534).optional().default(3000),
        highlanderGameMode: z.boolean().optional().default(false),
        infiniteActionPoints: z.boolean().optional().default(false),
        infiniteAmmunition: z.boolean().optional().default(false),
        showProjectileDebugGraphics: z.boolean().optional().default(false),
        showVisibilityDebugGraphics: z.boolean().optional().default(false),
        showFragmentExplosionTracers: z.boolean().optional().default(true),
        cleanupDamageCacheOnGameDestroy: z.boolean().optional().default(true),
        logLevels: z
            .object({
                itemManager: LogLevel.optional(),
                unitRecipeManager: LogLevel.optional(),
                furnitureManager: LogLevel.optional(),
                materialManager: LogLevel.optional(),
                furnitureRecipeManager: LogLevel.optional(),
                gameManager: LogLevel.optional(),
                imageManager: LogLevel.optional(),
                mapRecipeManager: LogLevel.optional(),
                scenarioRecipeManager: LogLevel.optional(),
                terrainManager: LogLevel.optional(),
                projectile: LogLevel.optional(),
                game: LogLevel.optional(),
                server: LogLevel.optional(),
                tile: LogLevel.optional(),
                unit: LogLevel.optional(),
                visibilityManager: LogLevel.optional(),
                vfxRecipeManager: LogLevel.optional(),
                vfxManager: LogLevel.optional(),
                opportunityFireManager: LogLevel.optional()
            })
            .optional()
            .default({
                itemManager: LogLevel.enum.error,
                unitRecipeManager: LogLevel.enum.error,
                furnitureManager: LogLevel.enum.error,
                materialManager: LogLevel.enum.error,
                furnitureRecipeManager: LogLevel.enum.error,
                gameManager: LogLevel.enum.error,
                imageManager: LogLevel.enum.error,
                mapRecipeManager: LogLevel.enum.error,
                scenarioRecipeManager: LogLevel.enum.error,
                terrainManager: LogLevel.enum.error,
                projectile: LogLevel.enum.error,
                game: LogLevel.enum.error,
                server: LogLevel.enum.error,
                tile: LogLevel.enum.error,
                unit: LogLevel.enum.error,
                visibilityManager: LogLevel.enum.error,
                vfxRecipeManager: LogLevel.enum.error,
                vfxManager: LogLevel.enum.error,
                opportunityFireManager: LogLevel.enum.info
            })
    })
    .strict();
type Config = z.infer<typeof Config>;

function loadConfig(configFile = `${import.meta.dirname}/../../config/config.json`) {
    const fileContents = readFileSync(configFile, "utf-8");
    const rawRecipe = JSON.parse(fileContents);
    const config = Config.parse(rawRecipe);

    return config;
}

export const config = loadConfig();
