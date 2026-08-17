import { DamageMap, VfxId } from "@atbs/shared-data";
import { Vfx } from "./Vfx.js";
import { ITilePos } from "@atbs/maths";
import { Game } from "./Game.js";
import type { VfxRecipeManager } from "./VfxRecipeManager.js";
import { Material } from "./Material.js";

export interface NewVfxProps {
    location: ITilePos;
    fromLocation: ITilePos;
    lifetimeTurns: number;
    damageMap?: DamageMap;
    disorientationPerFullTurn?: number;
    materials: Material[];
}

export class VfxManager {
    private readonly _game: Game;
    private readonly _vfxMap: Map<VfxId, Vfx>;
    private _instanceIndex: number;

    constructor(game: Game) {
        this._game = game;
        this._vfxMap = new Map<VfxId, Vfx>();
        this._instanceIndex = 0;
    }

    get game(): Game {
        return this._game;
    }

    get vfxRecipeManager(): VfxRecipeManager {
        return this.game.vfxRecipeManager;
    }

    newVfx(recipeId: VfxId, props: NewVfxProps): Vfx {
        const vfxRecipe = this.vfxRecipeManager.getRecipe(recipeId);

        const vfx = new Vfx(this, vfxRecipe, {
            ...props,
            instanceIndex: this._instanceIndex++
        });
        this._vfxMap.set(vfx.id, vfx);
        return vfx;
    }

    findVfx(id: VfxId): Vfx | undefined {
        return this._vfxMap.get(id);
    }

    getVfx(id: VfxId): Vfx | never {
        const vfx = this.findVfx(id);
        if (!vfx) {
            throw new Error(`Vfx not found: ${id}`);
        }
        return vfx;
    }

    removeVfx(id: VfxId): void {
        this._vfxMap.delete(id);
    }
}
