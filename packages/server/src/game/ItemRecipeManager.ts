import { ItemId } from "@atbs/shared-data";
import { Item, ItemAdditionalData, ItemOverrides, ItemRecipe } from "./Item.js";
import { readdir, readFile } from "fs/promises";
import path from "path";

const ItemDirectory = "./data/items";

export class ItemRecipeManager {
    private readonly _ItemRecipeMap = new Map<ItemId, ItemRecipe>();

    constructor() {
        this._ItemRecipeMap = new Map<ItemId, ItemRecipe>();
    }

    newItem(ItemId: ItemId, overrides: ItemOverrides, additionalData: ItemAdditionalData): Item {
        const ItemRecipe = this.getRecipe(ItemId);

        return new Item(ItemRecipe, overrides, additionalData);
    }

    async loadItemRecipes(directory = ItemDirectory): Promise<void> {
        const directoryContents = await readdir(directory, {
            encoding: "utf-8",
            withFileTypes: true
        });
        const files = directoryContents
            .filter((dirent) => dirent.isFile())
            .filter((dirent) => path.extname(dirent.name).toLowerCase() === ".json")
            .map(({ name }) => name);

        for (const file of files) {
            const fullPath = path.join(directory, file);

            try {
                const fileContents = await readFile(fullPath, "utf-8");
                const rawRecipe = JSON.parse(fileContents);
                const recipe = ItemRecipe.parse(rawRecipe);

                console.info(`Loaded Item recipe: ${fullPath}`);

                this.addRecipe(recipe);
            } catch (error) {
                console.error(`ERROR Loading Item recipe: ${file}`, error);
            }
        }
    }

    findRecipe(ItemId: ItemId): ItemRecipe | undefined {
        return this._ItemRecipeMap.get(ItemId);
    }

    getRecipe(ItemId: ItemId): ItemRecipe {
        const scenario = this.findRecipe(ItemId);
        if (!scenario) {
            throw new Error(`Item recipe ${ItemId} not found`);
        }
        return scenario;
    }

    hasRecipe(ItemId: ItemId): boolean {
        return !!this.findRecipe(ItemId);
    }

    addRecipe(ItemRecipe: ItemRecipe) {
        if (this.findRecipe(ItemRecipe.id)) {
            throw new Error(`Item recipe ${ItemRecipe.id} already registered`);
        }

        this._ItemRecipeMap.set(ItemRecipe.id, ItemRecipe);
    }

    removeRecipe(ItemId: ItemId): boolean {
        return this.removeRecipe(ItemId);
    }

    private static readonly _singleton = new ItemRecipeManager();
    static GetSingleton(): ItemRecipeManager {
        return ItemRecipeManager._singleton;
    }
}
