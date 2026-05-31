export class Colour {
    public r: number;
    public g: number;
    public b: number;
    public a: number;

    constructor({ r, g, b, a = 1 }: { r: number; g: number; b: number; a?: number }) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    get asRGBAColorString(): string {
        return `rgba(${this.r},${this.g},${this.b},${this.a})`;
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
}

export const whiteColour = new Colour({ r: 255, g: 255, b: 255, a: 1 });
export const blackColour = new Colour({ r: 0, g: 0, b: 0, a: 1 });
