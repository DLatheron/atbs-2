import { Aabb, Colour, IVec2, Orientation, Vec2 } from "@atbs/maths";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
import { PNG } from "pngjs";

export class Image {
    private readonly _name: string;

    private readonly _png: PNG;

    constructor(name: string, png: PNG) {
        this._name = name;
        this._png = png;
    }

    get name(): string {
        return this._name;
    }

    get width(): number {
        return this._png.width;
    }
    get height(): number {
        return this._png.height;
    }
    get data(): Buffer {
        return this._png.data;
    }

    get tileBounds() {
        return new Aabb(0, 0, this.width, this.height);
    }

    _rotateSample(pos: IVec2, orientation: number): Vec2 {
        switch (orientation) {
            case Orientation.NORTH:
                return new Vec2(pos.x, pos.y);

            case Orientation.EAST:
                return new Vec2(pos.y, this.width - 1 - pos.x);

            case Orientation.SOUTH:
                return new Vec2(this.width - 1 - pos.x, this.height - 1 - pos.y);

            case Orientation.WEST:
                return new Vec2(this.height - 1 - pos.y, pos.x);

            case Orientation.CENTER:
                // Not directional for VFX - so assume North!
                return new Vec2(pos.x, pos.y);

            default:
                throw new Error(
                    `Invalid orientation ${orientation}, allowed values are: [0, 2, 4, 6]`
                );
        }
    }

    _getIndex(pos: IVec2, orientation: number): number {
        const { x, y } = this._rotateSample(pos, orientation);
        return (this.width * Math.round(y) + Math.round(x)) << 2;
    }

    getColour(pos: IVec2, orientation: Orientation): Colour {
        if (!this.tileBounds.isPointInside(pos)) {
            throw new Error(
                `getColour({ ${pos.x}, ${pos.y} }) called to sample outside image bounds of (0, 0) to (${this.width}, ${this.height})`
            );
        }

        const idx = this._getIndex(pos, orientation);

        return new Colour({
            r: Colour.NormaliseComponent(this.data[idx + 0]),
            g: Colour.NormaliseComponent(this.data[idx + 1]),
            b: Colour.NormaliseComponent(this.data[idx + 2]),
            a: Colour.NormaliseComponent(this.data[idx + 3])
        });
    }

    setColour(pos: IVec2, orientation: number, { r, g, b, a }: Colour): void {
        if (!this.tileBounds.isPointInside(pos)) {
            throw new Error(
                `setColour({ ${pos.x}, ${pos.y} }) called to sample outside image bounds of (0, 0) to (${this.width}, ${this.height})`
            );
        }

        const idx = this._getIndex(pos, orientation);

        this.data[idx + 0] = Colour.DenormaliseComponent(r);
        this.data[idx + 1] = Colour.DenormaliseComponent(g);
        this.data[idx + 2] = Colour.DenormaliseComponent(b);
        this.data[idx + 3] = Colour.DenormaliseComponent(a);
    }

    dumpAll(): void {
        for (let orientation = 0; orientation < 8; orientation += 2) {
            console.info("Orientation", orientation);
            this.dump(orientation);
        }
    }

    dump(orientation: number): void {
        for (let y = 0; y < this.height; ++y) {
            let line = "";

            for (let x = 0; x < this.width; ++x) {
                const colour = this.getColour({ x, y }, orientation);

                if (colour.a > 0.5) {
                    line += "1";
                } else {
                    line += "0";
                }
            }

            console.info(line);
        }
    }

    async save(fullPath: string): Promise<void> {
        return await new Promise((resolve, reject) =>
            this._png
                .pack()
                .pipe(createWriteStream(fullPath))
                .on("finish", resolve)
                .on("error", reject)
        );
    }

    static async Load(fullPath: string): Promise<Image> {
        const filename = path.basename(fullPath);

        return await new Promise((resolve, reject) =>
            createReadStream(fullPath)
                .pipe(new PNG({ filterType: 4 }))
                .on("parsed", function (this: PNG) {
                    const image = new Image(filename, this);

                    resolve(image);
                })
                .on("error", reject)
        );
    }
}
