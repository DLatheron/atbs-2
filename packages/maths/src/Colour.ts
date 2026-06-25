import z from "zod";
import { Z } from "zod-class";

export const IColour = z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255),
    a: z.number().min(0).max(1)
});
export type IColour = z.infer<typeof IColour>;

export function isIColour(arg: unknown): arg is IColour {
    return IColour.safeParse(arg).success;
}

export function colourToRGBA(colour: IColour) {
    return `rgba(${colour.r}, ${colour.g}, ${colour.b}, ${colour.a ?? 1})`;
}

export class Colour
    extends Z.class({
        r: z.number().min(0).max(255),
        g: z.number().min(0).max(255),
        b: z.number().min(0).max(255),
        a: z.number().min(0).max(1)
    })
    implements IColour
{
    constructor({ r, g, b, a = 1 }: { r: number; g: number; b: number; a?: number }) {
        super({ r, g, b, a });
    }

    get asRGBAColorString(): string {
        return colourToRGBA(this);
    }

    static EnsuredNormalised(component: number): number {
        return Math.min(Math.max(component, 0), 1);
    }

    static NormaliseComponent(component0to255: number): number {
        return Colour.EnsuredNormalised(component0to255 / 255.0);
    }

    static DenormaliseComponent(component0to1: number): number {
        return Colour.EnsuredNormalised(component0to1) * 255.0;
    }

    static Blend(colourA: Colour, colourB: Colour, blend: number): Colour {
        return new Colour({
            r: colourA.r * blend + colourB.r * (1.0 - blend),
            g: colourA.g * blend + colourB.g * (1.0 - blend),
            b: colourA.b * blend + colourB.b * (1.0 - blend),
            a: 1.0
        });
    }

    static Transparent = new Colour({ r: 0, g: 0, b: 0, a: 0 });
    static Red = new Colour({ r: 255, g: 0, b: 0, a: 1 });
    static Yellow = new Colour({ r: 255, g: 255, b: 0, a: 1 });
    static Green = new Colour({ r: 0, g: 255, b: 0, a: 1 });
    static Cyan = new Colour({ r: 0, g: 255, b: 255, a: 1 });
    static Blue = new Colour({ r: 0, g: 0, b: 255, a: 1 });
    static Magenta = new Colour({ r: 255, g: 0, b: 255, a: 1 });
    static White = new Colour({ r: 255, g: 255, b: 255, a: 1 });
    static Black = new Colour({ r: 0, g: 0, b: 0, a: 1 });
}
