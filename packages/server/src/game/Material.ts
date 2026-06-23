import { Colour } from "@atbs/maths";
import {
    RGBColor,
    MaterialDensityMap,
    MaterialId,
    HSLColor,
    MaterialDensityType
} from "@atbs/shared-data";
import z from "zod";

const HSL_IMPORTANCE_SCALERS = {
    h: 1,
    s: 1,
    l: 1
};

function rgbToHsl({ r, g, b }: RGBColor): HSLColor {
    // Find greatest and smallest channel values
    const cmin = Math.min(r, g, b);
    const cmax = Math.max(r, g, b);
    const delta = cmax - cmin;
    let h;
    let s = 0;
    let l = 0;
    // Calculate hue
    // No difference
    if (delta === 0) {
        h = 0;
        // Red is max
    } else if (cmax === r) {
        h = ((g - b) / delta) % 6;
        // Green is max
    } else if (cmax === g) {
        h = (b - r) / delta + 2;
        // Blue is max
    } else {
        h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);

    // Make negative hues positive behind 360°
    if (h < 0) {
        h += 360;
    }
    // Calculate lightness
    l = (cmax + cmin) / 2;

    // Calculate saturation
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    // Multiply l and s by 100
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);

    return {
        h,
        s,
        l
    };
}

export const MaterialRecipe = z
    .object({
        id: MaterialId,
        category: z.string().nonempty(),
        rgb: RGBColor.optional(),
        hsl: HSLColor.optional(),
        densityMap: MaterialDensityMap
    })
    .refine((data) => data.rgb != null || data.hsl != null, {
        error: "Provide at least one of rgb or hsl"
    });
export type MaterialRecipe = z.infer<typeof MaterialRecipe>;

export class Material {
    protected readonly _recipe: MaterialRecipe;

    constructor(recipe: MaterialRecipe) {
        this._recipe = {
            ...recipe,
            hsl: recipe.hsl ?? rgbToHsl(RGBColor.parse(recipe.rgb))
        };
    }

    get id() {
        return this._recipe.id;
    }

    get category() {
        return this._recipe.category;
    }

    get rgb(): RGBColor | undefined {
        return this._recipe.rgb;
    }

    get hsl(): HSLColor {
        if (!this._recipe.hsl) {
            throw new Error("HSL must have been calculated at construction time");
        }
        return this._recipe.hsl;
    }

    get densityMap(): MaterialDensityMap {
        return this._recipe.densityMap;
    }

    getDensityForType(type?: MaterialDensityType): number {
        const { densityMap } = this;

        if (type === undefined) {
            return densityMap.default;
        }
        return type in densityMap ? densityMap[type] : densityMap.default;
    }

    static DetermineMaterial(
        rgb: Colour,
        materials: Material[]
    ): [material: Material, marginOfError: number] {
        const hsl = rgbToHsl(rgb);

        let hitMaterial = materials.find(
            ({ hsl: { h, s, l } }) => h === hsl.h && s === hsl.s && l === hsl.l
        );
        if (hitMaterial) {
            return [
                hitMaterial,
                0 // Margin of error.
            ];
        }

        const distanceToMaterialInHSLColourSpace = materials.map(
            ({ hsl: { h, s, l } }) =>
                Math.abs(h - hsl.h) * HSL_IMPORTANCE_SCALERS.h +
                Math.abs(s - hsl.s) * HSL_IMPORTANCE_SCALERS.s +
                (Math.abs(l - hsl.l) + HSL_IMPORTANCE_SCALERS.l)
        );

        const closest = distanceToMaterialInHSLColourSpace.reduce<
            undefined | { index: number; distanceInHSL: number }
        >((best, distanceInHSL, index) => {
            if (!best || distanceInHSL < best.distanceInHSL) {
                best = {
                    index,
                    distanceInHSL
                };
            }
            return best;
        }, undefined);
        if (closest === undefined) {
            throw new Error("Closest should never be 'undefined' - check the algorithm");
        }

        hitMaterial = materials[closest.index];

        return [hitMaterial, closest.distanceInHSL];
    }
}
