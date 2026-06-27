import { readFileSync } from "fs";
import z from "zod";

const Config = z
    .object({
        port: z.int().min(1024).max(65534).optional().default(3000),
        highlanderGameMode: z.boolean().optional().default(false),
        infiniteActionPoints: z.boolean().optional().default(false),
        infiniteAmmunition: z.boolean().optional().default(false)
    })
    .strict();
type Config = z.infer<typeof Config>;

function loadConfig(configFile = "./config/config.json") {
    const fileContents = readFileSync(configFile, "utf-8");
    const rawRecipe = JSON.parse(fileContents);
    const config = Config.parse(rawRecipe);

    return config;
}

export const config = loadConfig();
