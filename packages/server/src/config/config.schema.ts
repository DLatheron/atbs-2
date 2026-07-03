import { LogLevel } from "@atbs/misc";
import { readFileSync } from "fs";
import z from "zod";

const Config = z
    .object({
        port: z.int().min(1024).max(65534).optional().default(3000),
        highlanderGameMode: z.boolean().optional().default(false),
        infiniteActionPoints: z.boolean().optional().default(false),
        infiniteAmmunition: z.boolean().optional().default(false),
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
                unit: LogLevel.optional()
            })
            .optional()
            .default({
                itemManager: LogLevel.enum.warn,
                unitRecipeManager: LogLevel.enum.warn,
                furnitureManager: LogLevel.enum.warn,
                materialManager: LogLevel.enum.warn,
                furnitureRecipeManager: LogLevel.enum.warn,
                gameManager: LogLevel.enum.warn,
                imageManager: LogLevel.enum.warn,
                mapRecipeManager: LogLevel.enum.warn,
                scenarioRecipeManager: LogLevel.enum.warn,
                terrainManager: LogLevel.enum.warn,
                projectile: LogLevel.enum.warn,
                game: LogLevel.enum.warn,
                server: LogLevel.enum.warn,
                tile: LogLevel.enum.warn,
                unit: LogLevel.enum.warn
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
