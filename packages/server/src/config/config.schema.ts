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
                vfxManager: LogLevel.optional()
            })
            .optional()
            .default({
                itemManager: LogLevel.enum.info,
                unitRecipeManager: LogLevel.enum.info,
                furnitureManager: LogLevel.enum.info,
                materialManager: LogLevel.enum.info,
                furnitureRecipeManager: LogLevel.enum.info,
                gameManager: LogLevel.enum.info,
                imageManager: LogLevel.enum.info,
                mapRecipeManager: LogLevel.enum.info,
                scenarioRecipeManager: LogLevel.enum.info,
                terrainManager: LogLevel.enum.info,
                projectile: LogLevel.enum.info,
                game: LogLevel.enum.info,
                server: LogLevel.enum.info,
                tile: LogLevel.enum.info,
                unit: LogLevel.enum.info,
                visibilityManager: LogLevel.enum.info,
                vfxRecipeManager: LogLevel.enum.info,
                vfxManager: LogLevel.enum.info
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
